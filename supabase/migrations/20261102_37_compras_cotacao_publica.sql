-- 37 (B-04 · PLANO_COTACAO_FORNECEDORES §7.4, A1, A4): API pública do fornecedor (sem login) por token.
--
-- Q-02 (revisão QA, 2026-11-02) — correções feitas neste arquivo:
--   1) 4× `IF CASE WHEN ... THEN ... END ... THEN` (validar_resposta ×3, responder ×1): o plpgsql termina a condição do IF no 1º THEN
--      (o do CASE) → "syntax error at end of input" e a migration não compilava. Envolvido em parênteses (confirmado com parser).
--   2) obter/responder: corpo após o rate limit agora em sub-bloco com EXCEPTION WHEN OTHERS → {ok:false, codigo:'ERRO_INTERNO'}
--      (+RAISE LOG). Antes, uma exceção inesperada desfazia a transação inteira, inclusive os contadores de rate limit (permitiria
--      sondagem sem consumir limite) e devolvia a mensagem SQL ao anon. NOVO código para o front mapear: ERRO_INTERNO.
--   3) responder: ordem de locks cotação (FOR SHARE) → convite (FOR UPDATE), igual às RPCs internas (evita deadlock com revisar) e
--      impede resposta concorrente a decidir/cancelar (que travam a cotação FOR UPDATE).
--   4) validar_resposta: teto de R$ 1.000.000.000 no total dos itens (base_total/total_informado são numeric(14,2): estouro virava exceção).
--
-- Q-02b (pendências médias, 2026-11-02):
--   5) obter/responder: o limite por token e o global só são consumidos DEPOIS de achar o token em compras_cotacao_tokens; token
--      inexistente/malformado conta apenas no limite por IP (e não cria linha 'tk:*'/'gl:*' em compras_rate_limit).
--   6) compras_request_ip: cf-connecting-ip → ÚLTIMO item de x-forwarded-for (o que o proxy confiável anexa; os anteriores são
--      forjáveis pelo cliente) → x-real-ip. SUPOSIÇÃO a confirmar no diagnóstico B-00 (quais headers chegam ao PostgREST).
--   7) B-09: compras_limpeza_publica() + agendamento diário condicional via pg_cron (DO block checa pg_extension; não quebra sem ele).
--      ROLLBACK extra: SELECT cron.unschedule('compras-limpeza-publica'); DROP FUNCTION public.compras_limpeza_publica();
--
-- Objetivo:
--   * Helpers internos (sem grant): compras_request_ip, compras_ip_hash, compras_rl_consumir, compras_limpar_texto,
--     compras_cotacao_validar_resposta.
--     (compras_token_hash e compras_valor_presente já vêm da 36/35; compras_condicao_totais também é da 36.)
--   * RPCs públicas (SECURITY DEFINER, search_path fixo, GRANT EXECUTE TO anon, authenticated — ÚNICAS exceções do módulo):
--       cotacao_publica_obter(p_token text) → jsonb
--       cotacao_publica_responder(p_token text, p_resposta jsonb) → jsonb
--     Erros de negócio NÃO são exceções: voltam como {ok:false, codigo, ...} (para o rate limit commitar e o front mapear o texto).
--     Códigos: INDISPONIVEL, LINK_INVALIDO, LINK_SUBSTITUIDO, MUITAS_TENTATIVAS, PRAZO_ENCERRADO, COTACAO_ENCERRADA,
--              LISTA_ALTERADA, PAYLOAD_GRANDE, LIMITE_VERSOES, DADOS_INVALIDOS (com campo e mensagem).
--   * Rate limit: por IP (hash com pepper), por token e global (disjuntor). Se o IP não vier em request.headers, os limites
--     por IP são ignorados (valem os de token e o global) — evita bloquear todos os clientes sem IP num balde só.
--   * Nunca devolve: ids de pedido, cliente, obra, endereço, solicitante, urgência, outros convites/respostas, preços de referência,
--     taxa_mensal nem o WhatsApp do próprio fornecedor (D15).
--
-- Formato de ENTRADA do responder (o mesmo devolvido em obter().resposta):
--   { versao_lista:int, recusou?:bool, prazo_entrega_dias:int(0..365), frete:{tipo:'cif'|'valor', valor?:num(0..1e7)}, observacao?:text(≤1000),
--     itens:[{id:uuid-da-linha, tem_item:bool, preco_unitario?:num(>0,≤1e9,≤4 casas), quantidade_disponivel?:num(>0,≤1e7,≤3 casas), observacao?:text(≤200)}],
--     condicoes:[{tipo:'a_vista', desconto_tipo?:'percentual'|'valor', desconto_valor?:num}
--              | {tipo:'parcelado', parcelas:int(1..24), entrada_valor?:num, primeira_parcela_dias?:int(0..180), total?:num}] }
--
-- >>> KILL SWITCH (incidente): execute no SQL Editor, sem migration:
-- >>>   REVOKE EXECUTE ON FUNCTION public.cotacao_publica_obter(text), public.cotacao_publica_responder(text, jsonb) FROM anon;
-- >>> Reativar: GRANT EXECUTE ON FUNCTION ... TO anon;   (alternativa mais suave: compras_config.link_publico_ativo = false)
--
-- Dependências: 34, 35, 36. Pré-requisito de B-00: pgcrypto (extensions.gen_random_bytes) usado na 36 para gerar tokens.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.cotacao_publica_responder(text, jsonb), public.cotacao_publica_obter(text),
--     public.compras_cotacao_validar_resposta(jsonb, uuid), public.compras_limpar_texto(text),
--     public.compras_rl_consumir(text, int, interval), public.compras_ip_hash(text), public.compras_request_ip();

-- ---------- Helpers internos ----------
-- Lê o IP do visitante em request.headers. Ordem: cf-connecting-ip → ÚLTIMO item de x-forwarded-for → x-real-ip. NULL se ausente/inválido.
-- SUPOSIÇÃO (Q-02b): o PostgREST do Supabase fica atrás de proxy confiável (Cloudflare/gateway) que ANEXA o IP do cliente ao FIM de
-- x-forwarded-for; os itens anteriores podem ser forjados pelo cliente, por isso usamos o último e não o primeiro. Se o B-00 mostrar
-- que há mais de um proxy confiável em cadeia, trocar para o N-ésimo a partir do fim.
CREATE OR REPLACE FUNCTION public.compras_request_ip() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE h json; v text; v_xff text;
BEGIN
  h := current_setting('request.headers', true)::json;
  IF h IS NULL THEN RETURN NULL; END IF;
  v_xff := COALESCE(h ->> 'x-forwarded-for', '');
  v := COALESCE(NULLIF(btrim(h ->> 'cf-connecting-ip'), ''),
                NULLIF(btrim((string_to_array(v_xff, ','))[cardinality(string_to_array(v_xff, ','))]), ''),
                NULLIF(btrim(h ->> 'x-real-ip'), ''));
  IF v IS NULL THEN RETURN NULL; END IF;
  RETURN host(v::inet);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.compras_ip_hash(p_ip text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_ip IS NULL THEN NULL
              ELSE encode(sha256(convert_to((SELECT pepper_ip FROM public.compras_config_segredo WHERE id = 1) || '|' || p_ip, 'UTF8')), 'hex') END
$$;

-- Consome 1 do contador da janela (blocos de p_janela alinhados ao epoch). true = dentro do limite.
CREATE OR REPLACE FUNCTION public.compras_rl_consumir(p_chave text, p_limite int, p_janela interval) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secs numeric := extract(epoch FROM p_janela); v_ini timestamptz; v_cont int;
BEGIN
  v_ini := to_timestamp(floor(extract(epoch FROM now()) / v_secs) * v_secs);
  INSERT INTO public.compras_rate_limit (chave, janela, contador) VALUES (p_chave, v_ini, 1)
  ON CONFLICT (chave, janela) DO UPDATE SET contador = public.compras_rate_limit.contador + 1
  RETURNING contador INTO v_cont;
  RETURN v_cont <= p_limite;
END $$;

-- Remove quebras/controles, colapsa em espaço, btrim; vazio vira NULL
CREATE OR REPLACE FUNCTION public.compras_limpar_texto(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(btrim(regexp_replace(regexp_replace(COALESCE(p, ''), '[\r\n\t]+', ' ', 'g'), '[[:cntrl:]]', '', 'g')), '')
$$;

-- Validação estrita da resposta. NULL = válida; senão {campo, mensagem}.
CREATE OR REPLACE FUNCTION public.compras_cotacao_validar_resposta(p jsonb, p_cot uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[]; v_seen uuid[] := '{}'; e jsonb; i int; v_id uuid; v_q numeric; v_qd numeric; v_pr numeric; v_base numeric := 0; v_any boolean := false;
  v_tipos text[] := '{}'; v_t text; v_total numeric; v_x numeric; v_n int; v_tem boolean; s text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN jsonb_build_object('campo', 'resposta', 'mensagem', 'Resposta inválida'); END IF;
  IF p ? 'recusou' AND jsonb_typeof(p -> 'recusou') <> 'boolean' THEN RETURN jsonb_build_object('campo', 'recusou', 'mensagem', 'Valor inválido'); END IF;
  IF p ? 'observacao' AND jsonb_typeof(p -> 'observacao') NOT IN ('string', 'null') THEN
    RETURN jsonb_build_object('campo', 'observacao', 'mensagem', 'Texto inválido');
  END IF;
  IF jsonb_typeof(p -> 'observacao') = 'string' AND length(public.compras_limpar_texto(p ->> 'observacao')) > 1000 THEN
    RETURN jsonb_build_object('campo', 'observacao', 'mensagem', 'A observação pode ter no máximo 1.000 caracteres');
  END IF;
  IF COALESCE((p ->> 'recusou')::boolean, false) THEN RETURN NULL; END IF;

  -- itens: exatamente as linhas ativas
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM public.compras_cotacao_itens WHERE cotacao_id = p_cot AND ativo;
  IF (CASE WHEN jsonb_typeof(p -> 'itens') = 'array' THEN jsonb_array_length(p -> 'itens') ELSE -1 END) <> cardinality(v_ids) THEN
    RETURN jsonb_build_object('campo', 'itens', 'mensagem', 'Responda todos os itens da lista');
  END IF;
  i := -1;
  FOR e IN SELECT x.value FROM jsonb_array_elements(p -> 'itens') AS x(value) LOOP
    i := i + 1;
    IF jsonb_typeof(e) <> 'object' THEN RETURN jsonb_build_object('campo', format('itens[%s]', i), 'mensagem', 'Item inválido'); END IF;
    s := e ->> 'id';
    IF s IS NULL OR s !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RETURN jsonb_build_object('campo', format('itens[%s].id', i), 'mensagem', 'Item inválido');
    END IF;
    v_id := s::uuid;
    IF NOT (v_id = ANY (v_ids)) OR v_id = ANY (v_seen) THEN
      RETURN jsonb_build_object('campo', format('itens[%s].id', i), 'mensagem', 'Item inválido ou repetido');
    END IF;
    v_seen := v_seen || v_id;
    IF jsonb_typeof(e -> 'tem_item') IS DISTINCT FROM 'boolean' THEN
      RETURN jsonb_build_object('campo', format('itens[%s].tem_item', i), 'mensagem', 'Informe se tem o item');
    END IF;
    v_tem := (e ->> 'tem_item')::boolean;
    IF e ? 'observacao' AND jsonb_typeof(e -> 'observacao') NOT IN ('string', 'null') THEN
      RETURN jsonb_build_object('campo', format('itens[%s].observacao', i), 'mensagem', 'Texto inválido');
    END IF;
    IF jsonb_typeof(e -> 'observacao') = 'string' AND length(public.compras_limpar_texto(e ->> 'observacao')) > 200 THEN
      RETURN jsonb_build_object('campo', format('itens[%s].observacao', i), 'mensagem', 'A observação do item pode ter no máximo 200 caracteres');
    END IF;
    IF v_tem THEN
      v_any := true;
      IF jsonb_typeof(e -> 'preco_unitario') IS DISTINCT FROM 'number' THEN
        RETURN jsonb_build_object('campo', format('itens[%s].preco_unitario', i), 'mensagem', 'Informe o preço unitário');
      END IF;
      v_pr := (e ->> 'preco_unitario')::numeric;
      IF v_pr <= 0 OR v_pr > 1000000000 OR round(v_pr, 4) <> v_pr THEN
        RETURN jsonb_build_object('campo', format('itens[%s].preco_unitario', i), 'mensagem', 'Preço inválido (maior que zero, até 4 casas decimais)');
      END IF;
      SELECT quantidade INTO v_q FROM public.compras_cotacao_itens WHERE id = v_id;
      v_qd := NULL;
      IF e ? 'quantidade_disponivel' AND jsonb_typeof(e -> 'quantidade_disponivel') <> 'null' THEN
        IF jsonb_typeof(e -> 'quantidade_disponivel') <> 'number' THEN
          RETURN jsonb_build_object('campo', format('itens[%s].quantidade_disponivel', i), 'mensagem', 'Quantidade inválida');
        END IF;
        v_qd := (e ->> 'quantidade_disponivel')::numeric;
        IF v_qd <= 0 OR v_qd > 10000000 OR round(v_qd, 3) <> v_qd THEN
          RETURN jsonb_build_object('campo', format('itens[%s].quantidade_disponivel', i), 'mensagem', 'Quantidade disponível inválida');
        END IF;
      END IF;
      v_base := v_base + v_pr * LEAST(v_q, COALESCE(v_qd, v_q));
    END IF;
  END LOOP;
  IF NOT v_any THEN
    RETURN jsonb_build_object('campo', 'itens', 'mensagem', 'Informe o preço de ao menos um item ou recuse a cotação');
  END IF;
  v_base := round(v_base, 2);
  -- Q-02: teto do total (base_total/total_informado são numeric(14,2); evita estouro numérico → exceção)
  IF v_base > 1000000000 THEN
    RETURN jsonb_build_object('campo', 'itens', 'mensagem', 'Valor total da proposta acima do limite permitido');
  END IF;
  -- prazo de entrega e frete (obrigatórios, D5)
  IF jsonb_typeof(p -> 'prazo_entrega_dias') IS DISTINCT FROM 'number' THEN
    RETURN jsonb_build_object('campo', 'prazo_entrega_dias', 'mensagem', 'Informe o prazo de entrega em dias');
  END IF;
  v_x := (p ->> 'prazo_entrega_dias')::numeric;
  IF v_x < 0 OR v_x > 365 OR v_x <> trunc(v_x) THEN
    RETURN jsonb_build_object('campo', 'prazo_entrega_dias', 'mensagem', 'Prazo de entrega inválido (0 a 365 dias)');
  END IF;
  IF jsonb_typeof(p -> 'frete') <> 'object' OR (p -> 'frete' ->> 'tipo') IS NULL OR (p -> 'frete' ->> 'tipo') NOT IN ('cif', 'valor') THEN
    RETURN jsonb_build_object('campo', 'frete.tipo', 'mensagem', 'Informe o frete (incluso ou valor)');
  END IF;
  IF (p -> 'frete' ->> 'tipo') = 'valor' THEN
    IF jsonb_typeof(p -> 'frete' -> 'valor') IS DISTINCT FROM 'number' THEN
      RETURN jsonb_build_object('campo', 'frete.valor', 'mensagem', 'Informe o valor do frete');
    END IF;
    v_x := (p -> 'frete' ->> 'valor')::numeric;
    IF v_x < 0 OR v_x > 10000000 OR round(v_x, 2) <> v_x THEN
      RETURN jsonb_build_object('campo', 'frete.valor', 'mensagem', 'Valor de frete inválido');
    END IF;
  END IF;

  -- condições: 1–2, tipos distintos
  IF (CASE WHEN jsonb_typeof(p -> 'condicoes') = 'array' THEN jsonb_array_length(p -> 'condicoes') ELSE -1 END) NOT BETWEEN 1 AND 2 THEN
    RETURN jsonb_build_object('campo', 'condicoes', 'mensagem', 'Informe 1 ou 2 condições de pagamento');
  END IF;
  i := -1;
  FOR e IN SELECT x.value FROM jsonb_array_elements(p -> 'condicoes') AS x(value) LOOP
    i := i + 1;
    IF jsonb_typeof(e) <> 'object' THEN RETURN jsonb_build_object('campo', format('condicoes[%s]', i), 'mensagem', 'Condição inválida'); END IF;
    v_t := e ->> 'tipo';
    IF v_t IS NULL OR v_t NOT IN ('a_vista', 'parcelado') OR v_t = ANY (v_tipos) THEN
      RETURN jsonb_build_object('campo', format('condicoes[%s].tipo', i), 'mensagem', 'Tipo de condição inválido ou repetido');
    END IF;
    v_tipos := v_tipos || v_t;
    IF v_t = 'a_vista' THEN
      s := e ->> 'desconto_tipo';
      IF s IS NOT NULL AND s NOT IN ('percentual', 'valor') THEN
        RETURN jsonb_build_object('campo', format('condicoes[%s].desconto_tipo', i), 'mensagem', 'Tipo de desconto inválido');
      END IF;
      IF s IS NOT NULL THEN
        IF jsonb_typeof(e -> 'desconto_valor') IS DISTINCT FROM 'number' THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].desconto_valor', i), 'mensagem', 'Informe o valor do desconto');
        END IF;
        v_x := (e ->> 'desconto_valor')::numeric;
        IF v_x < 0 OR round(v_x, 4) <> v_x OR (s = 'percentual' AND v_x > 50) OR (s = 'valor' AND v_x > v_base) THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].desconto_valor', i),
                                    'mensagem', CASE WHEN s = 'percentual' THEN 'Desconto inválido (0% a 50%)' ELSE 'Desconto inválido (não pode passar do total)' END);
        END IF;
      END IF;
    ELSE
      IF (CASE WHEN jsonb_typeof(e -> 'parcelas') = 'number'
              THEN ((e ->> 'parcelas')::numeric = trunc((e ->> 'parcelas')::numeric) AND (e ->> 'parcelas')::numeric BETWEEN 1 AND 24)
              ELSE false END) IS NOT TRUE THEN
        RETURN jsonb_build_object('campo', format('condicoes[%s].parcelas', i), 'mensagem', 'Número de parcelas inválido (1 a 24)');
      END IF;
      v_total := v_base;
      IF e ? 'total' AND jsonb_typeof(e -> 'total') <> 'null' THEN
        IF jsonb_typeof(e -> 'total') <> 'number' THEN RETURN jsonb_build_object('campo', format('condicoes[%s].total', i), 'mensagem', 'Total inválido'); END IF;
        v_total := (e ->> 'total')::numeric;
        IF round(v_total, 2) <> v_total OR v_total < v_base * 0.5 OR v_total > v_base * 3 THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].total', i), 'mensagem', 'Total do parcelamento fora do esperado');
        END IF;
      END IF;
      IF e ? 'entrada_valor' AND jsonb_typeof(e -> 'entrada_valor') <> 'null' THEN
        IF jsonb_typeof(e -> 'entrada_valor') <> 'number' THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].entrada_valor', i), 'mensagem', 'Entrada inválida');
        END IF;
        v_x := (e ->> 'entrada_valor')::numeric;
        IF v_x < 0 OR round(v_x, 2) <> v_x OR v_x > v_total THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].entrada_valor', i), 'mensagem', 'Entrada inválida (não pode passar do total)');
        END IF;
      END IF;
      IF e ? 'primeira_parcela_dias' AND jsonb_typeof(e -> 'primeira_parcela_dias') <> 'null' THEN
        IF jsonb_typeof(e -> 'primeira_parcela_dias') <> 'number' THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].primeira_parcela_dias', i), 'mensagem', 'Prazo da 1ª parcela inválido');
        END IF;
        v_x := (e ->> 'primeira_parcela_dias')::numeric;
        IF v_x < 0 OR v_x > 180 OR v_x <> trunc(v_x) THEN
          RETURN jsonb_build_object('campo', format('condicoes[%s].primeira_parcela_dias', i), 'mensagem', 'Prazo da 1ª parcela inválido (0 a 180 dias)');
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.compras_request_ip(), public.compras_ip_hash(text), public.compras_rl_consumir(text, int, interval),
  public.compras_limpar_texto(text), public.compras_cotacao_validar_resposta(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- =====================================================================================================================
-- cotacao_publica_obter
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.cotacao_publica_obter(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.compras_config; v_ip text; v_iph text; v_hash bytea; tk public.compras_cotacao_tokens; cv public.compras_cotacao_convites;
  c public.compras_cotacoes; fo public.compras_fornecedores; v_resp jsonb; v_itens jsonb; r public.compras_cotacao_respostas;
BEGIN
  SELECT * INTO cfg FROM public.compras_config WHERE id = 1;
  IF NOT FOUND OR NOT cfg.link_publico_ativo THEN RETURN jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL'); END IF;

  v_ip := public.compras_request_ip(); v_iph := public.compras_ip_hash(v_ip);
  IF v_iph IS NOT NULL AND NOT public.compras_rl_consumir('ip:obter:' || v_iph, cfg.rl_ip_obter_10min, interval '10 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'MUITAS_TENTATIVAS');
  END IF;
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_INVALIDO'); END IF;
  v_hash := public.compras_token_hash(p_token);

  -- Q-02b: token inexistente conta só no limite por IP (acima) e NÃO cria linha de rate limit por token inventado
  SELECT * INTO tk FROM public.compras_cotacao_tokens WHERE token_hash = v_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_INVALIDO'); END IF;
  IF NOT public.compras_rl_consumir('tk:obter:' || encode(v_hash, 'hex'), cfg.rl_token_obter_10min, interval '10 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'MUITAS_TENTATIVAS');
  END IF;
  IF tk.revogado_em IS NOT NULL THEN
    IF tk.motivo_revogacao IN ('lembrete', 'novo_link') THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_SUBSTITUIDO'); END IF;
    RETURN jsonb_build_object('ok', true, 'estado', 'encerrada', 'empresa_contratante', cfg.nome_empresa_publico);
  END IF;
  BEGIN  -- Q-02: erro inesperado desfaz só este sub-bloco; os contadores de rate limit acima permanecem e nada do erro vaza ao anon

  SELECT * INTO cv FROM public.compras_cotacao_convites WHERE id = tk.convite_id;
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = cv.cotacao_id;
  SELECT * INTO fo FROM public.compras_fornecedores WHERE id = cv.fornecedor_id;
  IF c.status IN ('cancelada', 'encerrada') THEN
    RETURN jsonb_build_object('ok', true, 'estado', 'encerrada', 'empresa_contratante', cfg.nome_empresa_publico);
  END IF;
  IF c.status <> 'aberta' THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_INVALIDO'); END IF;

  -- visualização (1ª vez: nao_enviado/enviado → visualizado); evento com IP no máximo 1×/hora por convite
  UPDATE public.compras_cotacao_convites
     SET status = CASE WHEN status IN ('nao_enviado', 'enviado') THEN 'visualizado' ELSE status END,
         primeira_visualizacao_em = COALESCE(primeira_visualizacao_em, now()), ultima_visualizacao_em = now()
   WHERE id = cv.id;
  IF NOT EXISTS (SELECT 1 FROM public.compras_cotacao_eventos WHERE convite_id = cv.id AND tipo = 'visualizado' AND created_at > now() - interval '1 hour') THEN
    INSERT INTO public.compras_cotacao_eventos (cotacao_id, convite_id, tipo, ip, ip_hash) VALUES (c.id, cv.id, 'visualizado', v_ip, v_iph);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ci.id, 'seq', ci.seq, 'descricao', ci.descricao, 'unidade', ci.unidade,
           'quantidade', ci.quantidade, 'observacao', ci.observacao_publica, 'alterado_na_versao', ci.versao_alterada) ORDER BY ci.seq), '[]'::jsonb)
    INTO v_itens FROM public.compras_cotacao_itens ci WHERE ci.cotacao_id = c.id AND ci.ativo;

  SELECT * INTO r FROM public.compras_cotacao_respostas WHERE convite_id = cv.id AND atual;
  IF FOUND THEN
    v_resp := jsonb_build_object(
      'versao', r.versao, 'enviado_em', r.enviado_em, 'versao_lista', r.versao_lista, 'recusou', r.recusou,
      'prazo_entrega_dias', r.prazo_entrega_dias,
      'frete', CASE WHEN r.recusou THEN NULL ELSE jsonb_build_object('tipo', r.frete_tipo, 'valor', r.frete_valor) END,
      'observacao', r.observacao,
      'itens', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ri.cotacao_item_id, 'tem_item', ri.tem_item, 'preco_unitario', ri.preco_unitario,
                         'quantidade_disponivel', ri.quantidade_disponivel, 'observacao', ri.observacao)), '[]'::jsonb)
                  FROM public.compras_cotacao_resposta_itens ri JOIN public.compras_cotacao_itens ci ON ci.id = ri.cotacao_item_id AND ci.ativo
                 WHERE ri.resposta_id = r.id),
      'condicoes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', cc.tipo, 'desconto_tipo', cc.desconto_tipo, 'desconto_valor', cc.desconto_valor,
                         'parcelas', cc.parcelas, 'entrada_valor', cc.entrada_valor, 'primeira_parcela_dias', cc.primeira_parcela_dias,
                         'total', cc.total_informado) ORDER BY cc.tipo), '[]'::jsonb)
                    FROM public.compras_cotacao_resposta_condicoes cc WHERE cc.resposta_id = r.id));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'estado', CASE WHEN c.prazo_resposta < now() THEN 'prazo_encerrado' ELSE 'aberta' END,
    'empresa_contratante', cfg.nome_empresa_publico,
    'cotacao', jsonb_build_object('numero', c.numero, 'prazo_resposta', c.prazo_resposta, 'versao_lista', c.versao_lista,
                                  'observacao', c.observacao_publica, 'regiao_entrega', c.regiao_entrega),
    'fornecedor', jsonb_build_object('nome_contato', fo.nome_contato, 'empresa', fo.empresa),
    'itens', v_itens,
    'precisa_reconfirmar', cv.precisa_reconfirmar,
    'resposta', v_resp);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'cotacao_publica_obter: % (%)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object('ok', false, 'codigo', 'ERRO_INTERNO');
  END;
END $$;

-- =====================================================================================================================
-- cotacao_publica_responder
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.cotacao_publica_responder(p_token text, p_resposta jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.compras_config; v_ip text; v_iph text; v_hash bytea; tk public.compras_cotacao_tokens; cv public.compras_cotacao_convites;
  c public.compras_cotacoes; fo public.compras_fornecedores; v_err jsonb; v_recusou boolean; v_ver int; v_vl int; v_base numeric := 0;
  v_resp_id uuid; v_agora timestamptz := now(); e jsonb; v_ua text; v_notificar boolean; cnd record;
BEGIN
  SELECT * INTO cfg FROM public.compras_config WHERE id = 1;
  IF NOT FOUND OR NOT cfg.link_publico_ativo THEN RETURN jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL'); END IF;

  v_ip := public.compras_request_ip(); v_iph := public.compras_ip_hash(v_ip);
  IF v_iph IS NOT NULL AND NOT public.compras_rl_consumir('ip:resp:' || v_iph, cfg.rl_ip_responder_10min, interval '10 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'MUITAS_TENTATIVAS');
  END IF;
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_INVALIDO'); END IF;
  v_hash := public.compras_token_hash(p_token);

  -- Q-02b: token inexistente conta só no limite por IP e NÃO cria linha de rate limit (token nem global) por token inventado
  SELECT * INTO tk FROM public.compras_cotacao_tokens WHERE token_hash = v_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_INVALIDO'); END IF;
  IF NOT public.compras_rl_consumir('tk:resp:' || encode(v_hash, 'hex'), cfg.rl_token_responder_10min, interval '10 minutes')
     OR NOT public.compras_rl_consumir('gl:resp', cfg.rl_global_responder_hora, interval '1 hour') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'MUITAS_TENTATIVAS');
  END IF;
  IF tk.revogado_em IS NOT NULL THEN
    IF tk.motivo_revogacao IN ('lembrete', 'novo_link') THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LINK_SUBSTITUIDO'); END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'COTACAO_ENCERRADA');
  END IF;

  BEGIN  -- Q-02: erro inesperado desfaz só este sub-bloco; os contadores de rate limit acima permanecem e nada do erro vaza ao anon
  -- ordem de locks igual à das RPCs internas (cotação → convite); FOR SHARE impede resposta concorrente com decidir/cancelar
  SELECT * INTO cv FROM public.compras_cotacao_convites WHERE id = tk.convite_id;
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = cv.cotacao_id FOR SHARE;
  -- serializa as respostas do mesmo convite
  SELECT * INTO cv FROM public.compras_cotacao_convites WHERE id = tk.convite_id FOR UPDATE;
  IF c.status <> 'aberta' THEN RETURN jsonb_build_object('ok', false, 'codigo', 'COTACAO_ENCERRADA'); END IF;
  IF v_agora > c.prazo_resposta THEN RETURN jsonb_build_object('ok', false, 'codigo', 'PRAZO_ENCERRADO'); END IF;
  IF p_resposta IS NOT NULL AND pg_column_size(p_resposta) > 200000 THEN RETURN jsonb_build_object('ok', false, 'codigo', 'PAYLOAD_GRANDE'); END IF;
  IF p_resposta IS NULL OR jsonb_typeof(p_resposta) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'DADOS_INVALIDOS', 'campo', 'resposta', 'mensagem', 'Resposta inválida');
  END IF;
  IF (CASE WHEN jsonb_typeof(p_resposta -> 'versao_lista') = 'number'
          THEN (p_resposta ->> 'versao_lista')::numeric = trunc((p_resposta ->> 'versao_lista')::numeric)
          ELSE false END) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'DADOS_INVALIDOS', 'campo', 'versao_lista', 'mensagem', 'Versão da lista inválida');
  END IF;
  IF (p_resposta ->> 'versao_lista')::numeric <> c.versao_lista THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LISTA_ALTERADA'); END IF;
  SELECT COALESCE(max(versao), 0) INTO v_ver FROM public.compras_cotacao_respostas WHERE convite_id = cv.id;
  IF v_ver >= 20 THEN RETURN jsonb_build_object('ok', false, 'codigo', 'LIMITE_VERSOES'); END IF;

  v_err := public.compras_cotacao_validar_resposta(p_resposta, c.id);
  IF v_err IS NOT NULL THEN
    INSERT INTO public.compras_cotacao_eventos (cotacao_id, convite_id, tipo, ip, ip_hash, dados)
    VALUES (c.id, cv.id, 'resposta_rejeitada', v_ip, v_iph, v_err);
    RETURN jsonb_build_object('ok', false, 'codigo', 'DADOS_INVALIDOS', 'campo', v_err ->> 'campo', 'mensagem', v_err ->> 'mensagem');
  END IF;

  v_recusou := COALESCE((p_resposta ->> 'recusou')::boolean, false);
  v_vl := c.versao_lista;
  v_ver := v_ver + 1;
  BEGIN
    v_ua := left(public.compras_limpar_texto(current_setting('request.headers', true)::json ->> 'user-agent'), 200);
  EXCEPTION WHEN OTHERS THEN v_ua := NULL;
  END;

  UPDATE public.compras_cotacao_respostas SET atual = false WHERE convite_id = cv.id AND atual;

  IF v_recusou THEN
    INSERT INTO public.compras_cotacao_respostas (convite_id, cotacao_id, versao, versao_lista, atual, recusou, frete_valor, observacao, enviado_em, ip_hash, user_agent)
    VALUES (cv.id, c.id, v_ver, v_vl, true, true, 0, left(public.compras_limpar_texto(p_resposta ->> 'observacao'), 1000), v_agora, v_iph, v_ua)
    RETURNING id INTO v_resp_id;
  ELSE
    -- itens (já validados): base = Σ preço × min(quantidade, disponível)
    INSERT INTO public.compras_cotacao_respostas (convite_id, cotacao_id, versao, versao_lista, atual, recusou, prazo_entrega_dias, frete_tipo, frete_valor,
                                                  observacao, base_total, enviado_em, ip_hash, user_agent)
    VALUES (cv.id, c.id, v_ver, v_vl, true, false, (p_resposta ->> 'prazo_entrega_dias')::int, p_resposta -> 'frete' ->> 'tipo',
            CASE WHEN p_resposta -> 'frete' ->> 'tipo' = 'valor' THEN (p_resposta -> 'frete' ->> 'valor')::numeric ELSE 0 END,
            left(public.compras_limpar_texto(p_resposta ->> 'observacao'), 1000), 0, v_agora, v_iph, v_ua)
    RETURNING id INTO v_resp_id;

    INSERT INTO public.compras_cotacao_resposta_itens (resposta_id, cotacao_item_id, tem_item, preco_unitario, quantidade_disponivel, observacao)
    SELECT v_resp_id, (x ->> 'id')::uuid, (x ->> 'tem_item')::boolean,
           CASE WHEN (x ->> 'tem_item')::boolean THEN (x ->> 'preco_unitario')::numeric END,
           CASE WHEN (x ->> 'tem_item')::boolean AND jsonb_typeof(x -> 'quantidade_disponivel') = 'number' THEN (x ->> 'quantidade_disponivel')::numeric END,
           left(public.compras_limpar_texto(x ->> 'observacao'), 200)
      FROM jsonb_array_elements(p_resposta -> 'itens') x;

    SELECT round(COALESCE(sum(ri.preco_unitario * LEAST(ci.quantidade, COALESCE(ri.quantidade_disponivel, ci.quantidade))), 0), 2) INTO v_base
      FROM public.compras_cotacao_resposta_itens ri JOIN public.compras_cotacao_itens ci ON ci.id = ri.cotacao_item_id
     WHERE ri.resposta_id = v_resp_id AND ri.tem_item;
    UPDATE public.compras_cotacao_respostas SET base_total = v_base WHERE id = v_resp_id;

    FOR e IN SELECT x.value FROM jsonb_array_elements(p_resposta -> 'condicoes') AS x(value) LOOP
      INSERT INTO public.compras_cotacao_resposta_condicoes
        (resposta_id, tipo, desconto_tipo, desconto_valor, parcelas, entrada_valor, primeira_parcela_dias, total_informado, total_itens, valor_presente_itens)
      SELECT v_resp_id, e ->> 'tipo',
             CASE WHEN e ->> 'tipo' = 'a_vista' THEN e ->> 'desconto_tipo' END,
             CASE WHEN e ->> 'tipo' = 'a_vista' AND (e ->> 'desconto_tipo') IS NOT NULL THEN (e ->> 'desconto_valor')::numeric END,
             CASE WHEN e ->> 'tipo' = 'parcelado' THEN (e ->> 'parcelas')::int END,
             CASE WHEN e ->> 'tipo' = 'parcelado' THEN COALESCE((e ->> 'entrada_valor')::numeric, 0) ELSE 0 END,
             CASE WHEN e ->> 'tipo' = 'parcelado' THEN COALESCE((e ->> 'primeira_parcela_dias')::int, 30) ELSE 30 END,
             CASE WHEN e ->> 'tipo' = 'parcelado' AND jsonb_typeof(e -> 'total') = 'number' THEN (e ->> 'total')::numeric END,
             t.total, t.vp
        FROM public.compras_condicao_totais(
               v_base, e ->> 'tipo', CASE WHEN e ->> 'tipo' = 'a_vista' THEN e ->> 'desconto_tipo' END,
               CASE WHEN e ->> 'tipo' = 'a_vista' AND (e ->> 'desconto_tipo') IS NOT NULL THEN (e ->> 'desconto_valor')::numeric END,
               CASE WHEN e ->> 'tipo' = 'parcelado' THEN (e ->> 'parcelas')::int END,
               CASE WHEN e ->> 'tipo' = 'parcelado' THEN COALESCE((e ->> 'entrada_valor')::numeric, 0) ELSE 0 END,
               CASE WHEN e ->> 'tipo' = 'parcelado' THEN COALESCE((e ->> 'primeira_parcela_dias')::int, 30) ELSE 30 END,
               CASE WHEN e ->> 'tipo' = 'parcelado' AND jsonb_typeof(e -> 'total') = 'number' THEN (e ->> 'total')::numeric END,
               c.taxa_mensal) t;
    END LOOP;
  END IF;

  -- notificação: no máximo 1 a cada 10 min por convite
  v_notificar := NOT EXISTS (SELECT 1 FROM public.compras_cotacao_eventos
                              WHERE convite_id = cv.id AND tipo = 'resposta_enviada' AND created_at > v_agora - interval '10 minutes');

  UPDATE public.compras_cotacao_convites
     SET status = CASE WHEN v_recusou THEN 'recusou' ELSE 'respondido' END, respondido_em = v_agora,
         versao_lista_respondida = v_vl, precisa_reconfirmar = false
   WHERE id = cv.id;
  INSERT INTO public.compras_cotacao_eventos (cotacao_id, convite_id, tipo, ip, ip_hash, dados)
  VALUES (c.id, cv.id, 'resposta_enviada', v_ip, v_iph, jsonb_build_object('versao', v_ver, 'recusou', v_recusou));

  IF v_notificar AND c.criado_por IS NOT NULL THEN
    SELECT * INTO fo FROM public.compras_fornecedores WHERE id = cv.fornecedor_id;
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
    VALUES ('compra_cotacao', CASE WHEN v_recusou THEN '🚫 Fornecedor recusou a cotação' ELSE '📨 Nova resposta de cotação' END,
            left(format('📨 %s %s a cotação nº %s', fo.empresa, CASE WHEN v_recusou THEN 'recusou' ELSE 'respondeu' END, c.numero), 500),
            NULL, c.criado_por, NULL, jsonb_build_object('cotacao_id', c.id, 'convite_id', cv.id));
  END IF;

  RETURN jsonb_build_object('ok', true, 'versao', v_ver, 'enviado_em', v_agora);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'cotacao_publica_responder: % (%)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object('ok', false, 'codigo', 'ERRO_INTERNO');
  END;
END $$;

-- ---------- Permissões: ÚNICAS funções do módulo chamáveis por anon ----------
REVOKE ALL ON FUNCTION public.cotacao_publica_obter(text), public.cotacao_publica_responder(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_publica_obter(text), public.cotacao_publica_responder(text, jsonb) TO anon, authenticated;

-- ---------- B-09: limpeza periódica (Q-02b) ----------
-- Apaga contadores de rate limit com mais de 2 dias e tokens revogados há mais de 180 dias (token revogado antigo vira LINK_INVALIDO).
-- Interna (sem grant); chamada só pelo pg_cron (sessão postgres). Idempotente. A limpeza de rate limit também continua em
-- compras_cotacao_abrir e compras_verificar_alertas (a função de alertas é chamada pelo front do módulo Compras).
CREATE OR REPLACE FUNCTION public.compras_limpeza_publica() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rl int; v_tk int;
BEGIN
  DELETE FROM public.compras_rate_limit WHERE janela < now() - interval '2 days';
  GET DIAGNOSTICS v_rl = ROW_COUNT;
  DELETE FROM public.compras_cotacao_tokens WHERE revogado_em IS NOT NULL AND revogado_em < now() - interval '180 days';
  GET DIAGNOSTICS v_tk = ROW_COUNT;
  RETURN jsonb_build_object('rate_limit_limpos', v_rl, 'tokens_limpos', v_tk);
END $$;
REVOKE ALL ON FUNCTION public.compras_limpeza_publica() FROM PUBLIC, anon, authenticated;

-- Agenda diariamente às 06:30 UTC (03:30 em Brasília) SOMENTE se o pg_cron existir; não quebra a migration se faltar ou falhar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE $c$SELECT cron.schedule('compras-limpeza-publica', '30 6 * * *', 'SELECT public.compras_limpeza_publica()')$c$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron presente, mas o agendamento falhou (%): agende manualmente compras_limpeza_publica()', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron não habilitado: limpeza segue só por compras_cotacao_abrir / compras_verificar_alertas';
  END IF;
END $$;
