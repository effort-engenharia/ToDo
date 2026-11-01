-- 38 (B-06 · PLANO_COTACAO_FORNECEDORES §5.8, §7.5, §11, A7): alterações da atendente nas listas, com ciência ou aceite do solicitante.
--
-- Q-02b (revisão QA, 2026-11-02): compras_alterar_itens, ação 'quantidade' (redução): com unidade un/cx/pct o ceil() podia devolver a
--   própria quantidade antiga e registrar uma "ciência" 5 → 5 (histórico e notificação sem mudança); agora rejeita com mensagem clara.
--
-- Objetivo:
--   * execucao_pedidos_questionamentos: CHECK de tipo aceita 'adicao'; colunas novas origem ('questionamento'|'alteracao_compras'),
--     motivo_alteracao, prazo_resposta_em, alerta_enviado_em (+ índice parcial para o alerta de aceite vencido).
--   * compras_somar_horas_uteis(timestamptz, int): interna (24 h corridas por dia útil seg–sex, America/Sao_Paulo, pula feriado nacional).
--   * compras_parse_quantidade(text): interna (texto → numeric > 0, ou NULL).
--   * execucao_compras_abrir_questionamento_interno(...): corpo extraído de compras_abrir_questionamento (mig. 25), agora com 'adicao',
--     origem, motivo e prazo. compras_abrir_questionamento (assinatura inalterada) vira um invólucro (is_compras()).
--   * compras_responder_questionamento (reescrita a partir da mig. 25): aprova 'adicao' (append em itens; o id vem do trigger da mig. 23)
--     e grava o histórico com tipo_alteracao='alteracao_compras' quando origem='alteracao_compras'.
--   * compras_alterar_itens(p_pedido, p_alteracoes, p_motivo, p_revisar_cotacao): ciência aplicada na hora (histórico + notificação
--     'compra_alteracao'); aumento de quantidade / substituição / adição abrem questionamento (aceite). Em cotação enviada exige
--     p_revisar_cotacao {novo_prazo} e chama compras_cotacao_revisar na mesma transação.
--   * compras_listar_questionamentos (reescrita a partir da mig. 28): 3 colunas novas NO FIM (origem, motivo_alteracao, prazo_resposta_em).
--     MUDA o tipo de retorno → DROP + CREATE + GRANT. compras_detalhe_pedido (mig. 36) usa to_jsonb(q) e herda as chaves.
--
-- Partida das reescritas: ARQUIVOS 25 (abrir/responder) e 28 (listar_questionamentos), com o gate da 33 (listar mantém pode_ver_compras();
-- responder não tem gate de papel além da regra do solicitante/admin). Produção NÃO foi consultada (sem MCP/credenciais neste ambiente):
-- ANTES DE APLICAR (B-08/Q-02) comparar com pg_get_functiondef de produção das 3 funções; divergência além do diff acima → reconciliar.
--
-- Depende de: 24, 25, 28, 34 (compras_exigir_compras na 36, compras_similaridade na 34), 35 e 36 (compras_cotacao_revisar). Ordem: após a 37.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_alterar_itens(uuid, jsonb, text, jsonb);
--   DROP FUNCTION IF EXISTS public.compras_listar_questionamentos(uuid, text[]);   -- e recriar a versão da mig. 28 (sem as 3 colunas novas)
--   Reaplicar compras_responder_questionamento e compras_abrir_questionamento da mig. 25 (CREATE OR REPLACE);
--   DROP FUNCTION IF EXISTS public.execucao_compras_abrir_questionamento_interno(uuid, uuid, text, text, text, jsonb, text, text, timestamptz),
--     public.compras_somar_horas_uteis(timestamptz, int), public.compras_parse_quantidade(text);
--   UPDATE public.execucao_pedidos_questionamentos SET status = 'cancelado' WHERE tipo = 'adicao' AND status = 'aberto';
--   DELETE FROM public.execucao_pedidos_questionamentos WHERE tipo = 'adicao';   -- só após exportar; senão o CHECK antigo não é reaplicável
--   DROP INDEX IF EXISTS public.idx_quest_aceite_vencendo;
--   ALTER TABLE public.execucao_pedidos_questionamentos DROP COLUMN IF EXISTS alerta_enviado_em, DROP COLUMN IF EXISTS prazo_resposta_em,
--     DROP COLUMN IF EXISTS motivo_alteracao, DROP COLUMN IF EXISTS origem;
--   (recriar o CHECK de tipo com ('substituicao','quantidade','duvida'))

-- =====================================================================================================================
-- 1. Tabela de questionamentos: tipo 'adicao' + colunas novas
-- =====================================================================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.execucao_pedidos_questionamentos'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%substituicao%' LOOP
    EXECUTE format('ALTER TABLE public.execucao_pedidos_questionamentos DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.execucao_pedidos_questionamentos ADD CONSTRAINT execucao_pedidos_questionamentos_tipo_check
    CHECK (tipo IN ('substituicao', 'quantidade', 'duvida', 'adicao'));
END $$;

ALTER TABLE public.execucao_pedidos_questionamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'questionamento' CHECK (origem IN ('questionamento', 'alteracao_compras')),
  ADD COLUMN IF NOT EXISTS motivo_alteracao text CHECK (motivo_alteracao IS NULL OR length(motivo_alteracao) <= 500),
  ADD COLUMN IF NOT EXISTS prazo_resposta_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_enviado_em timestamptz;

-- compras_verificar_alertas (mig. 36) procura aceites vencidos ainda sem alerta
CREATE INDEX IF NOT EXISTS idx_quest_aceite_vencendo ON public.execucao_pedidos_questionamentos (prazo_resposta_em)
  WHERE origem = 'alteracao_compras' AND status = 'aberto' AND alerta_enviado_em IS NULL;

-- =====================================================================================================================
-- 2. Helpers internos (sem grant)
-- =====================================================================================================================
-- Soma p_horas "úteis": cada 24 h = 1 dia útil (seg–sex, sem feriado nacional com considerar_feriado), mantendo o horário local;
-- o resto (< 24 h) é somado em horas corridas. Aproximação documentada: não há horário comercial.
-- Feriado recorrente casa por dia/mês; os móveis (recorrente=false) casam pela data exata.
CREATE OR REPLACE FUNCTION public.compras_somar_horas_uteis(p_inicio timestamptz, p_horas int) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_loc timestamp; v_d date; v_dias int; v_rest int; v_guarda int := 0;
BEGIN
  IF p_inicio IS NULL THEN RETURN NULL; END IF;
  v_loc := p_inicio AT TIME ZONE 'America/Sao_Paulo';
  v_d := v_loc::date;
  v_dias := GREATEST(COALESCE(p_horas, 0), 0) / 24;
  v_rest := GREATEST(COALESCE(p_horas, 0), 0) % 24;
  WHILE v_dias > 0 AND v_guarda < 1000 LOOP
    v_d := v_d + 1;
    v_guarda := v_guarda + 1;
    IF EXTRACT(ISODOW FROM v_d) BETWEEN 1 AND 5
       AND NOT EXISTS (SELECT 1 FROM public.execucao_feriados f
                        WHERE f.considerar_feriado AND f.abrangencia = 'nacional'
                          AND (f.data = v_d
                               OR (f.recorrente AND EXTRACT(MONTH FROM f.data) = EXTRACT(MONTH FROM v_d)
                                                AND EXTRACT(DAY FROM f.data) = EXTRACT(DAY FROM v_d)))) THEN
      v_dias := v_dias - 1;
    END IF;
  END LOOP;
  RETURN ((v_d + v_loc::time) AT TIME ZONE 'America/Sao_Paulo') + make_interval(hours => v_rest);
END $$;

-- '12', '12,5', '12.5' → numeric; qualquer outra coisa → NULL (nunca levanta erro)
CREATE OR REPLACE FUNCTION public.compras_parse_quantidade(p text) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN replace(btrim(COALESCE(p, '')), ',', '.') ~ '^[0-9]{1,10}(\.[0-9]{1,6})?$'
              THEN replace(btrim(p), ',', '.')::numeric END
$$;

-- Corpo do questionamento (mig. 25) + 'adicao' + origem/motivo/prazo. A chamadora valida o papel; aqui o pedido é travado (FOR UPDATE).
CREATE OR REPLACE FUNCTION public.execucao_compras_abrir_questionamento_interno(
  p_uid uuid, p_pedido uuid, p_item_id text, p_tipo text, p_pergunta text, p_sugestao jsonb,
  p_origem text DEFAULT 'questionamento', p_motivo text DEFAULT NULL, p_prazo timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.execucao_pedidos_material; v_item jsonb; v_sug jsonb := NULL; v_id uuid; v_nome text; v_qtd numeric; v_un text;
  v_titulo text;
BEGIN
  IF p_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_tipo NOT IN ('substituicao', 'quantidade', 'duvida', 'adicao') THEN RAISE EXCEPTION 'Tipo de questionamento inválido'; END IF;
  IF p_origem NOT IN ('questionamento', 'alteracao_compras') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF length(btrim(COALESCE(p_pergunta, ''))) < 3 THEN RAISE EXCEPTION 'Descreva o questionamento'; END IF;
  IF length(p_pergunta) > 1000 THEN RAISE EXCEPTION 'O questionamento pode ter no máximo 1.000 caracteres'; END IF;

  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra NOT IN ('aguardando_compra', 'em_cotacao', 'aguardando_solicitante') THEN
    RAISE EXCEPTION 'Questionamentos só podem ser abertos até a cotação (status atual: %)', v_p.status_compra;
  END IF;

  IF p_tipo = 'adicao' THEN
    NULL;  -- adição não aponta para item existente
  ELSIF p_item_id IS NOT NULL AND btrim(p_item_id) <> '' THEN
    SELECT x.value INTO v_item FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_p.itens) = 'array' THEN v_p.itens ELSE '[]'::jsonb END) x
     WHERE x.value ->> 'id' = p_item_id LIMIT 1;
    IF v_item IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;
  ELSIF p_tipo <> 'duvida' THEN
    RAISE EXCEPTION 'Informe o item do questionamento';
  END IF;

  IF p_tipo = 'substituicao' THEN
    v_nome := btrim(COALESCE(p_sugestao ->> 'nome', ''));
    IF v_nome = '' THEN RAISE EXCEPTION 'Informe o item sugerido para a substituição'; END IF;
    v_sug := jsonb_build_object('nome', v_nome);
  ELSIF p_tipo = 'quantidade' THEN
    IF COALESCE((p_sugestao ->> 'quantidade')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Informe a quantidade sugerida (maior que zero)'; END IF;
    v_sug := jsonb_build_object('quantidade', (p_sugestao ->> 'quantidade')::numeric);
  ELSIF p_tipo = 'adicao' THEN
    v_nome := btrim(COALESCE(p_sugestao ->> 'nome', ''));
    IF v_nome = '' OR length(v_nome) > 200 THEN RAISE EXCEPTION 'Informe o nome do item a adicionar (até 200 caracteres)'; END IF;
    v_qtd := (p_sugestao ->> 'quantidade')::numeric;
    IF COALESCE(v_qtd, 0) <= 0 THEN RAISE EXCEPTION 'Informe a quantidade do item a adicionar (maior que zero)'; END IF;
    v_un := NULLIF(btrim(COALESCE(p_sugestao ->> 'unidade', '')), '');
    IF v_un IS NULL THEN RAISE EXCEPTION 'Informe a unidade do item a adicionar'; END IF;
    v_sug := jsonb_build_object('nome', v_nome, 'quantidade', v_qtd, 'unidade', v_un);
  ELSIF p_sugestao IS NOT NULL AND jsonb_typeof(p_sugestao) = 'object' THEN
    v_sug := NULLIF(jsonb_strip_nulls(jsonb_build_object('nome', NULLIF(btrim(COALESCE(p_sugestao ->> 'nome', '')), ''),
                                                          'quantidade', (p_sugestao ->> 'quantidade')::numeric)), '{}'::jsonb);
  END IF;
  IF v_sug IS NOT NULL AND NULLIF(btrim(COALESCE(p_sugestao ->> 'unidade', '')), '') IS NOT NULL THEN
    v_sug := v_sug || jsonb_build_object('unidade', btrim(p_sugestao ->> 'unidade'));
  END IF;
  IF v_sug IS NOT NULL AND p_tipo = 'substituicao' AND (p_sugestao ->> 'quantidade') IS NOT NULL THEN
    IF (p_sugestao ->> 'quantidade')::numeric <= 0 THEN RAISE EXCEPTION 'Quantidade sugerida inválida'; END IF;
    v_sug := v_sug || jsonb_build_object('quantidade', (p_sugestao ->> 'quantidade')::numeric);
  END IF;

  INSERT INTO public.execucao_pedidos_questionamentos
    (pedido_id, item_id, item_snapshot, tipo, pergunta, sugestao, criado_por, origem, motivo_alteracao, prazo_resposta_em)
  VALUES (p_pedido, CASE WHEN p_tipo = 'adicao' THEN NULL ELSE NULLIF(btrim(COALESCE(p_item_id, '')), '') END, v_item, p_tipo,
          btrim(p_pergunta), v_sug, p_uid, p_origem, NULLIF(left(btrim(COALESCE(p_motivo, '')), 500), ''),
          CASE WHEN p_origem = 'alteracao_compras' THEN p_prazo END)
  RETURNING id INTO v_id;

  IF v_p.status_compra IN ('aguardando_compra', 'em_cotacao') THEN
    UPDATE public.execucao_pedidos_material
       SET status_compra_anterior = v_p.status_compra, status_compra = 'aguardando_solicitante', status_compra_em = now(),
           comprador_id = COALESCE(comprador_id, p_uid), fila_compras_em = COALESCE(fila_compras_em, now()), updated_at = now()
     WHERE id = p_pedido;
  END IF;

  PERFORM public.execucao_compras_historico(p_pedido, p_uid, 'questionamento',
    format('%s (%s)%s', CASE WHEN p_origem = 'alteracao_compras' THEN 'Alteração da Compras aguarda aceite' ELSE 'Questionamento aberto' END, p_tipo,
           CASE WHEN v_item IS NOT NULL THEN ': ' || COALESCE(v_item ->> 'nome', '')
                WHEN p_tipo = 'adicao' THEN ': ' || COALESCE(v_nome, '') ELSE '' END),
    NULL, NULL, COALESCE(NULLIF(btrim(COALESCE(p_motivo, '')), ''), btrim(p_pergunta)));

  v_titulo := CASE WHEN p_origem = 'alteracao_compras' THEN '✏️ Alteração da Compras aguarda seu aceite' ELSE '❓ Questionamento da Compras' END;
  PERFORM public.execucao_compras_notificar_solicitante(p_pedido, 'compra_questionamento', v_titulo,
    format('%s: %s%s', COALESCE((SELECT nome_completo FROM public.usuarios WHERE id = p_uid), 'Compras'),
           COALESCE(v_p.cliente_nome || ' — ', ''), btrim(p_pergunta)),
    jsonb_build_object('pedido_id', p_pedido, 'questionamento_id', v_id), p_uid);
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.compras_somar_horas_uteis(timestamptz, int), public.compras_parse_quantidade(text),
  public.execucao_compras_abrir_questionamento_interno(uuid, uuid, text, text, text, jsonb, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- =====================================================================================================================
-- 3. compras_abrir_questionamento (assinatura e retorno inalterados): invólucro com is_compras()
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_abrir_questionamento(
  p_pedido uuid, p_item_id text, p_tipo text, p_pergunta text, p_sugestao jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão: apenas o setor de Compras abre questionamentos'; END IF;
  RETURN public.execucao_compras_abrir_questionamento_interno(v_uid, p_pedido, p_item_id, p_tipo, p_pergunta, p_sugestao,
                                                              'questionamento', NULL, NULL);
END $$;

-- =====================================================================================================================
-- 4. compras_responder_questionamento (mig. 25 + 'adicao' + histórico por origem)
-- Retorno: jsonb { questionamento_id, status, status_compra, item_alterado }
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_responder_questionamento(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  q public.execucao_pedidos_questionamentos; v_p public.execucao_pedidos_material;
  v_obs text := NULLIF(btrim(COALESCE(p_observacao, '')), '');
  v_nivel_sol text; v_ok boolean; v_alterou boolean := false; v_ant jsonb; v_novo jsonb; v_patch jsonb := '{}'::jsonb;
  v_unid text; v_qtd numeric; v_novo_status text; v_desc text; v_nome_ant text; v_tipo_hist text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe aprovar ou reprovar'; END IF;

  SELECT * INTO q FROM public.execucao_pedidos_questionamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionamento não encontrado'; END IF;
  IF q.status <> 'aberto' THEN RAISE EXCEPTION 'Este questionamento já foi encerrado (%)', q.status; END IF;
  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = q.pedido_id FOR UPDATE;

  SELECT na.nome INTO v_nivel_sol FROM public.usuarios u JOIN public.niveis_acesso na ON na.id = u.nivel_acesso_id WHERE u.id = v_p.solicitante_id;
  -- 'adicao' segue a regra de 'quantidade' (solicitante não TECNICO ou admin); só 'substituicao' exige is_admin_execucao()
  v_ok := public.is_admin_execucao()
          OR (q.tipo <> 'substituicao' AND v_p.solicitante_id = v_uid AND COALESCE(v_nivel_sol, 'TECNICO') <> 'TECNICO');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Sem permissão para responder este questionamento%',
      CASE WHEN q.tipo = 'substituicao' THEN ' (substituição técnica exige o administrador de execução)' ELSE '' END;
  END IF;
  IF (NOT p_aprovar OR q.tipo = 'duvida' OR v_p.solicitante_id IS DISTINCT FROM v_uid) AND (v_obs IS NULL OR length(v_obs) < 3) THEN
    RAISE EXCEPTION 'Informe a observação da resposta%',
      CASE WHEN v_p.solicitante_id IS DISTINCT FROM v_uid THEN ' (ex.: confirmado com o solicitante/técnico)' ELSE '' END;
  END IF;

  IF p_aprovar AND q.tipo IN ('substituicao', 'quantidade') AND q.sugestao IS NOT NULL THEN
    v_ant := jsonb_build_object('itens', v_p.itens);
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id) THEN
      RAISE EXCEPTION 'O item do questionamento não existe mais no pedido';
    END IF;
    SELECT x.value ->> 'nome' INTO v_nome_ant FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id;
    IF NULLIF(btrim(COALESCE(q.sugestao ->> 'nome', '')), '') IS NOT NULL THEN
      v_patch := v_patch || jsonb_build_object('nome', btrim(q.sugestao ->> 'nome'));
    END IF;
    IF NULLIF(q.sugestao ->> 'unidade', '') IS NOT NULL THEN v_patch := v_patch || jsonb_build_object('unidade', q.sugestao ->> 'unidade'); END IF;
    IF (q.sugestao ->> 'quantidade') IS NOT NULL THEN
      v_qtd := (q.sugestao ->> 'quantidade')::numeric;
      v_unid := COALESCE(q.sugestao ->> 'unidade',
                         (SELECT x.value ->> 'unidade' FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id));
      IF lower(COALESCE(v_unid, '')) IN ('un', 'cx', 'pct') THEN v_qtd := ceil(v_qtd); END IF;  -- N1-a/N1-b
      v_patch := v_patch || jsonb_build_object('quantidade', v_qtd);
    END IF;
    PERFORM set_config('execucao.compras_rpc', '1', true);
    UPDATE public.execucao_pedidos_material
       SET itens = (SELECT jsonb_agg(CASE WHEN e.v ->> 'id' = q.item_id THEN e.v || v_patch ELSE e.v END ORDER BY e.ord)
                      FROM jsonb_array_elements(v_p.itens) WITH ORDINALITY AS e(v, ord)),
           updated_at = now()
     WHERE id = v_p.id
    RETURNING jsonb_build_object('itens', itens) INTO v_novo;
    PERFORM set_config('execucao.compras_rpc', '', true);
    v_alterou := true;
  ELSIF p_aprovar AND q.tipo = 'adicao' AND q.sugestao IS NOT NULL THEN
    v_ant := jsonb_build_object('itens', v_p.itens);
    v_nome_ant := btrim(COALESCE(q.sugestao ->> 'nome', ''));
    v_unid := NULLIF(btrim(COALESCE(q.sugestao ->> 'unidade', '')), '');
    v_qtd := (q.sugestao ->> 'quantidade')::numeric;
    IF v_nome_ant = '' OR v_unid IS NULL OR COALESCE(v_qtd, 0) <= 0 THEN RAISE EXCEPTION 'Sugestão de adição inválida'; END IF;
    IF lower(v_unid) IN ('un', 'cx', 'pct') THEN v_qtd := ceil(v_qtd); END IF;  -- N1-a/N1-b
    PERFORM set_config('execucao.compras_rpc', '1', true);
    UPDATE public.execucao_pedidos_material
       SET itens = (CASE WHEN jsonb_typeof(itens) = 'array' THEN itens ELSE '[]'::jsonb END)
                   || jsonb_build_array(jsonb_build_object('nome', v_nome_ant, 'quantidade', v_qtd, 'unidade', v_unid)),  -- id: trigger da mig. 23
           updated_at = now()
     WHERE id = v_p.id
    RETURNING jsonb_build_object('itens', itens) INTO v_novo;
    PERFORM set_config('execucao.compras_rpc', '', true);
    v_alterou := true;
  END IF;

  v_novo_status := CASE WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END;
  UPDATE public.execucao_pedidos_questionamentos
     SET status = v_novo_status, resposta_observacao = v_obs, respondido_por = v_uid, respondido_em = now(), updated_at = now()
   WHERE id = p_id;

  v_desc := format('Questionamento %s (%s)%s', CASE WHEN p_aprovar AND q.tipo = 'duvida' THEN 'respondido' WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END,
                   q.tipo, CASE WHEN v_alterou THEN ': ' || COALESCE(v_nome_ant, '') ELSE '' END);
  v_tipo_hist := CASE WHEN q.origem = 'alteracao_compras' THEN 'alteracao_compras' ELSE 'questionamento' END;
  PERFORM public.execucao_compras_historico(v_p.id, v_uid, v_tipo_hist, v_desc, v_ant, v_novo, v_obs);

  PERFORM public.execucao_compras_restaurar_status(v_p.id);

  IF q.criado_por IS NOT NULL THEN
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
    VALUES ('compra_resposta', CASE WHEN p_aprovar THEN '✅ Questionamento respondido' ELSE '🚫 Questionamento reprovado' END,
            left(format('%s%s%s', COALESCE(v_p.cliente_nome || ' — ', ''), v_desc, CASE WHEN v_obs IS NOT NULL THEN ': ' || v_obs ELSE '' END), 500),
            v_p.atividade_id, q.criado_por, v_uid, jsonb_build_object('pedido_id', v_p.id, 'questionamento_id', p_id));
  END IF;

  RETURN jsonb_build_object('questionamento_id', p_id, 'status', v_novo_status,
                            'status_compra', (SELECT status_compra FROM public.execucao_pedidos_material WHERE id = v_p.id),
                            'item_alterado', v_alterou);
END $$;

-- =====================================================================================================================
-- 5. compras_listar_questionamentos (mig. 28 + 3 colunas no fim). Retorno muda → DROP + CREATE + GRANT.
-- =====================================================================================================================
DROP FUNCTION IF EXISTS public.compras_listar_questionamentos(uuid, text[]);
CREATE FUNCTION public.compras_listar_questionamentos(p_pedido uuid DEFAULT NULL, p_status text[] DEFAULT NULL)
RETURNS TABLE (
  id uuid, pedido_id uuid, item_id text, item_snapshot jsonb, tipo text, pergunta text, sugestao jsonb, status text,
  resposta_observacao text, criado_por uuid, criador_nome text, respondido_por uuid, respondedor_nome text,
  respondido_em timestamptz, created_at timestamptz, updated_at timestamptz,
  origem text, motivo_alteracao text, prazo_resposta_em timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT q.id, q.pedido_id, q.item_id, q.item_snapshot, q.tipo, q.pergunta, q.sugestao, q.status,
         q.resposta_observacao, q.criado_por, uc.nome_completo::text, q.respondido_por, ur.nome_completo::text,
         q.respondido_em, q.created_at, q.updated_at,
         q.origem, q.motivo_alteracao, q.prazo_resposta_em
    FROM public.execucao_pedidos_questionamentos q
    LEFT JOIN public.usuarios uc ON uc.id = q.criado_por
    LEFT JOIN public.usuarios ur ON ur.id = q.respondido_por
   WHERE (p_pedido IS NULL OR q.pedido_id = p_pedido)
     AND (p_status IS NULL OR cardinality(p_status) = 0 OR q.status = ANY (p_status))
   ORDER BY q.created_at ASC, q.id ASC
   LIMIT 500;
END $$;

-- =====================================================================================================================
-- 6. compras_alterar_itens (§7.5)
-- p_alteracoes: [{acao:'quantidade'|'remover'|'corrigir'|'substituir'|'adicionar', item_id?, quantidade?, nome?, unidade?}] (1–50)
-- p_revisar_cotacao: {novo_prazo} (obrigatório se o pedido está em cotação aberta já enviada)
-- Retorno: {aplicadas:[{acao,item_id,resumo}], pendentes_aceite:[{questionamento_id,acao,item_id}], status_compra,
--           cotacao?:{id,numero,versao_lista,revisada}}
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_alterar_itens(
  p_pedido uuid, p_alteracoes jsonb, p_motivo text, p_revisar_cotacao jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras();
  v_p public.execucao_pedidos_material;
  v_mot text := btrim(COALESCE(p_motivo, ''));
  v_itens jsonb; v_ant jsonb;
  a jsonb; v_ord int; v_acao text; v_iid text; v_it jsonb; v_nome text; v_nome_novo text; v_un text; v_un_novo text;
  v_q numeric; v_qold numeric; v_patch jsonb; v_ids text[] := '{}'; v_sim real;
  v_aplicadas jsonb := '[]'::jsonb; v_resumos text[] := '{}'; v_pend jsonb := '[]'::jsonb; v_pend_out jsonb := '[]'::jsonb;
  v_resumo text; v_n_ciencia int := 0;
  v_cot public.compras_cotacoes; v_enviada boolean := false; v_prazo timestamptz; v_cot_res jsonb := NULL; v_rev jsonb;
  v_horas int; v_prazo_aceite timestamptz; v_qid uuid; r jsonb;
BEGIN
  IF v_mot = '' OR length(v_mot) < 5 THEN RAISE EXCEPTION 'Informe o motivo da alteração (mínimo 5 caracteres)'; END IF;
  IF length(v_mot) > 500 THEN RAISE EXCEPTION 'O motivo pode ter no máximo 500 caracteres'; END IF;
  IF p_alteracoes IS NULL OR jsonb_typeof(p_alteracoes) <> 'array' OR jsonb_array_length(p_alteracoes) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Informe de 1 a 50 alterações';
  END IF;

  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra NOT IN ('aguardando_compra', 'em_cotacao', 'aguardando_solicitante') THEN
    RAISE EXCEPTION 'A lista só pode ser alterada até a cotação (status atual: %)', v_p.status_compra;
  END IF;
  v_itens := CASE WHEN jsonb_typeof(v_p.itens) = 'array' THEN v_p.itens ELSE '[]'::jsonb END;
  v_ant := v_itens;

  -- cotação ativa já enviada?
  SELECT c.* INTO v_cot FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
   WHERE cp.pedido_id = p_pedido AND cp.ativa LIMIT 1;
  v_enviada := v_cot.id IS NOT NULL AND v_cot.status = 'aberta'
               AND EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE cotacao_id = v_cot.id AND status <> 'nao_enviado');
  IF v_enviada THEN
    IF p_revisar_cotacao IS NULL OR jsonb_typeof(p_revisar_cotacao) <> 'object' THEN
      RAISE EXCEPTION 'Pedido em cotação enviada: use "Aplicar e revisar cotação"';
    END IF;
    BEGIN
      v_prazo := (p_revisar_cotacao ->> 'novo_prazo')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Novo prazo da cotação inválido';
    END;
    IF v_prazo IS NULL THEN RAISE EXCEPTION 'Informe o novo prazo da cotação'; END IF;
  END IF;

  -- ---------- classificação (sem escrever nada ainda) ----------
  FOR a, v_ord IN SELECT x.value, x.ord::int FROM jsonb_array_elements(p_alteracoes) WITH ORDINALITY AS x(value, ord) LOOP
    IF jsonb_typeof(a) <> 'object' THEN RAISE EXCEPTION 'Alteração % inválida', v_ord; END IF;
    v_acao := a ->> 'acao';
    IF v_acao IS NULL OR v_acao NOT IN ('quantidade', 'remover', 'corrigir', 'substituir', 'adicionar') THEN
      RAISE EXCEPTION 'Ação inválida na alteração %', v_ord;
    END IF;
    v_iid := NULLIF(btrim(COALESCE(a ->> 'item_id', '')), '');
    v_it := NULL;

    IF v_acao <> 'adicionar' THEN
      IF v_iid IS NULL THEN RAISE EXCEPTION 'Informe o item da alteração %', v_ord; END IF;
      IF v_iid = ANY (v_ids) THEN RAISE EXCEPTION 'O mesmo item não pode ter duas alterações na mesma chamada'; END IF;
      v_ids := v_ids || v_iid;
      SELECT e.value INTO v_it FROM jsonb_array_elements(v_itens) e WHERE e.value ->> 'id' = v_iid LIMIT 1;
      IF v_it IS NULL THEN RAISE EXCEPTION 'Item da alteração % não encontrado no pedido', v_ord; END IF;
      IF EXISTS (SELECT 1 FROM public.execucao_pedidos_questionamentos qq
                  WHERE qq.pedido_id = p_pedido AND qq.item_id = v_iid AND qq.status = 'aberto') THEN
        RAISE EXCEPTION 'O item "%" tem um questionamento aberto: resolva-o antes de alterar', COALESCE(v_it ->> 'nome', '');
      END IF;
      v_nome := COALESCE(v_it ->> 'nome', '');
      v_un := COALESCE(NULLIF(btrim(v_it ->> 'unidade'), ''), 'un');
      v_qold := public.compras_parse_quantidade(v_it ->> 'quantidade');
    END IF;

    IF v_acao = 'quantidade' THEN
      v_q := public.compras_parse_quantidade(a ->> 'quantidade');
      IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantidade inválida na alteração %', v_ord; END IF;
      IF v_qold IS NOT NULL AND v_q = v_qold THEN RAISE EXCEPTION 'A quantidade de "%" já é %', v_nome, v_qold; END IF;
      IF v_qold IS NOT NULL AND v_q < v_qold THEN  -- redução: ciência
        IF lower(v_un) IN ('un', 'cx', 'pct') THEN v_q := ceil(v_q); END IF;
        IF v_q >= v_qold THEN RAISE EXCEPTION 'A quantidade de "%" já é %: informe um valor menor', v_nome, v_qold; END IF;  -- Q-02b: arredondar (un/cx/pct) não pode anular a redução
        v_itens := (SELECT jsonb_agg(CASE WHEN e.v ->> 'id' = v_iid THEN e.v || jsonb_build_object('quantidade', v_q) ELSE e.v END ORDER BY e.ord)
                      FROM jsonb_array_elements(v_itens) WITH ORDINALITY AS e(v, ord));
        v_resumo := format('"%s": quantidade %s → %s', v_nome, v_qold, v_q);
        v_aplicadas := v_aplicadas || jsonb_build_object('acao', v_acao, 'item_id', v_iid, 'resumo', v_resumo);
        v_resumos := v_resumos || v_resumo; v_n_ciencia := v_n_ciencia + 1;
      ELSE  -- aumento (ou quantidade antiga ilegível): aceite
        v_pend := v_pend || jsonb_build_object('acao', v_acao, 'tipo', 'quantidade', 'item_id', v_iid,
          'sugestao', jsonb_build_object('quantidade', v_q),
          'pergunta', format('Alteração da Compras: aumentar a quantidade de "%s" de %s para %s', v_nome, COALESCE(v_qold::text, '?'), v_q));
      END IF;

    ELSIF v_acao = 'remover' THEN
      v_itens := COALESCE((SELECT jsonb_agg(e.v ORDER BY e.ord) FROM jsonb_array_elements(v_itens) WITH ORDINALITY AS e(v, ord)
                            WHERE e.v ->> 'id' <> v_iid), '[]'::jsonb);
      v_resumo := format('removeu "%s"', v_nome);
      v_aplicadas := v_aplicadas || jsonb_build_object('acao', v_acao, 'item_id', v_iid, 'resumo', v_resumo);
      v_resumos := v_resumos || v_resumo; v_n_ciencia := v_n_ciencia + 1;

    ELSIF v_acao = 'corrigir' THEN
      v_nome_novo := NULLIF(btrim(COALESCE(a ->> 'nome', '')), '');
      v_un_novo := NULLIF(btrim(COALESCE(a ->> 'unidade', '')), '');
      IF v_nome_novo IS NULL AND v_un_novo IS NULL THEN RAISE EXCEPTION 'Informe o novo nome e/ou a nova unidade (alteração %)', v_ord; END IF;
      IF length(COALESCE(v_nome_novo, '')) > 200 OR length(COALESCE(v_un_novo, '')) > 20 THEN
        RAISE EXCEPTION 'Nome ou unidade grande demais (alteração %)', v_ord;
      END IF;
      IF (v_nome_novo IS NULL OR v_nome_novo = v_nome) AND (v_un_novo IS NULL OR v_un_novo = v_un) THEN
        RAISE EXCEPTION 'A correção não muda nada (alteração %)', v_ord;
      END IF;
      -- ciência só para correção de grafia/sinônimo; do contrário é substituição
      IF v_nome_novo IS NOT NULL AND v_nome_novo <> v_nome THEN
        v_sim := public.compras_similaridade(public.compras_normalizar_nome(v_nome_novo), public.compras_normalizar_nome(v_nome));
        IF NOT (public.compras_normalizar_nome(v_nome_novo) = public.compras_normalizar_nome(v_nome) OR COALESCE(v_sim, 0) >= 0.6) THEN
          RAISE EXCEPTION 'A correção de "%" muda o item: use "Substituir" (aceite do solicitante)', v_nome;
        END IF;
      END IF;
      IF v_un_novo IS NOT NULL AND v_un_novo <> v_un
         AND public.compras_normalizar_unidade(v_un_novo) <> public.compras_normalizar_unidade(v_un) THEN
        RAISE EXCEPTION 'A unidade de "%" não é sinônima da atual: use "Substituir" (aceite do solicitante)', v_nome;
      END IF;
      v_patch := '{}'::jsonb;
      IF v_nome_novo IS NOT NULL THEN v_patch := v_patch || jsonb_build_object('nome', v_nome_novo); END IF;
      IF v_un_novo IS NOT NULL THEN v_patch := v_patch || jsonb_build_object('unidade', v_un_novo); END IF;
      v_itens := (SELECT jsonb_agg(CASE WHEN e.v ->> 'id' = v_iid THEN e.v || v_patch ELSE e.v END ORDER BY e.ord)
                    FROM jsonb_array_elements(v_itens) WITH ORDINALITY AS e(v, ord));
      v_resumo := format('corrigiu "%s" → "%s" (%s)', v_nome, COALESCE(v_nome_novo, v_nome), COALESCE(v_un_novo, v_un));
      v_aplicadas := v_aplicadas || jsonb_build_object('acao', v_acao, 'item_id', v_iid, 'resumo', v_resumo);
      v_resumos := v_resumos || v_resumo; v_n_ciencia := v_n_ciencia + 1;

    ELSIF v_acao = 'substituir' THEN
      v_nome_novo := NULLIF(btrim(COALESCE(a ->> 'nome', '')), '');
      IF v_nome_novo IS NULL OR length(v_nome_novo) > 200 THEN RAISE EXCEPTION 'Informe o item substituto (alteração %)', v_ord; END IF;
      v_patch := jsonb_build_object('nome', v_nome_novo);
      v_un_novo := NULLIF(btrim(COALESCE(a ->> 'unidade', '')), '');
      IF v_un_novo IS NOT NULL THEN v_patch := v_patch || jsonb_build_object('unidade', v_un_novo); END IF;
      IF NULLIF(btrim(COALESCE(a ->> 'quantidade', '')), '') IS NOT NULL THEN
        v_q := public.compras_parse_quantidade(a ->> 'quantidade');
        IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantidade inválida na alteração %', v_ord; END IF;
        v_patch := v_patch || jsonb_build_object('quantidade', v_q);
      END IF;
      v_pend := v_pend || jsonb_build_object('acao', v_acao, 'tipo', 'substituicao', 'item_id', v_iid, 'sugestao', v_patch,
        'pergunta', format('Alteração da Compras: substituir "%s" por "%s"', v_nome, v_nome_novo));

    ELSE  -- adicionar
      v_nome_novo := NULLIF(btrim(COALESCE(a ->> 'nome', '')), '');
      v_un_novo := NULLIF(btrim(COALESCE(a ->> 'unidade', '')), '');
      v_q := public.compras_parse_quantidade(a ->> 'quantidade');
      IF v_nome_novo IS NULL OR length(v_nome_novo) > 200 THEN RAISE EXCEPTION 'Informe o nome do item a adicionar (alteração %)', v_ord; END IF;
      IF v_un_novo IS NULL OR length(v_un_novo) > 20 THEN RAISE EXCEPTION 'Informe a unidade do item a adicionar (alteração %)', v_ord; END IF;
      IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Informe a quantidade do item a adicionar (alteração %)', v_ord; END IF;
      v_pend := v_pend || jsonb_build_object('acao', v_acao, 'tipo', 'adicao', 'item_id', NULL,
        'sugestao', jsonb_build_object('nome', v_nome_novo, 'quantidade', v_q, 'unidade', v_un_novo),
        'pergunta', format('Alteração da Compras: adicionar "%s" (%s %s)', v_nome_novo, v_q, v_un_novo));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_itens) = 0 THEN
    RAISE EXCEPTION 'A lista ficaria sem itens: para descartar o pedido, cancele-o';
  END IF;

  -- ---------- aplicação: ciências ----------
  IF v_n_ciencia > 0 THEN
    PERFORM set_config('execucao.compras_rpc', '1', true);  -- evita o aviso "pedido editado pelo solicitante"
    UPDATE public.execucao_pedidos_material SET itens = v_itens, updated_at = now() WHERE id = p_pedido;
    PERFORM set_config('execucao.compras_rpc', '', true);
    PERFORM public.execucao_compras_historico(p_pedido, v_uid, 'alteracao_compras',
      left('Compras alterou a lista (ciência): ' || array_to_string(v_resumos, '; '), 1000),
      jsonb_build_object('itens', v_ant), jsonb_build_object('itens', v_itens), v_mot);
    PERFORM public.execucao_compras_notificar_solicitante(p_pedido, 'compra_alteracao', '✏️ Compras alterou a lista',
      format('%s%s: %s. Motivo: %s', COALESCE(v_p.cliente_nome || ' — ', ''), COALESCE(v_p.descricao, 'Pedido de material'),
             array_to_string(v_resumos, '; '), v_mot),
      jsonb_build_object('pedido_id', p_pedido), v_uid);
  END IF;

  -- ---------- aplicação: aceites (questionamentos) ----------
  IF jsonb_array_length(v_pend) > 0 THEN
    SELECT COALESCE(prazo_aceite_horas_uteis, 24) INTO v_horas FROM public.compras_config WHERE id = 1;
    v_prazo_aceite := public.compras_somar_horas_uteis(now(), COALESCE(v_horas, 24));
    FOR r IN SELECT x.value FROM jsonb_array_elements(v_pend) AS x(value) LOOP
      v_qid := public.execucao_compras_abrir_questionamento_interno(
        v_uid, p_pedido, r ->> 'item_id', r ->> 'tipo', left((r ->> 'pergunta') || '. Motivo: ' || v_mot, 1000), r -> 'sugestao',
        'alteracao_compras', v_mot, v_prazo_aceite);
      v_pend_out := v_pend_out || jsonb_build_object('questionamento_id', v_qid, 'acao', r ->> 'acao', 'item_id', r ->> 'item_id');
    END LOOP;
  END IF;

  -- ---------- cotação enviada: revisão na mesma transação (só se houve ciência; o aceite liga requer_revisao ao ser aprovado) ----------
  IF v_cot.id IS NOT NULL THEN
    IF v_enviada AND v_n_ciencia > 0 THEN
      v_rev := public.compras_cotacao_revisar(v_cot.id, v_mot, v_prazo);
      v_cot_res := jsonb_build_object('id', v_cot.id, 'numero', v_cot.numero, 'versao_lista', (v_rev ->> 'versao_lista')::int, 'revisada', true);
    ELSE
      v_cot_res := jsonb_build_object('id', v_cot.id, 'numero', v_cot.numero,
        'versao_lista', (SELECT versao_lista FROM public.compras_cotacoes WHERE id = v_cot.id), 'revisada', false);
    END IF;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object('aplicadas', v_aplicadas, 'pendentes_aceite', v_pend_out,
    'status_compra', (SELECT status_compra FROM public.execucao_pedidos_material WHERE id = p_pedido), 'cotacao', v_cot_res));
END $$;

-- ---------- Permissões ----------
REVOKE ALL ON FUNCTION public.compras_abrir_questionamento(uuid, text, text, text, jsonb),
  public.compras_responder_questionamento(uuid, boolean, text), public.compras_listar_questionamentos(uuid, text[]),
  public.compras_alterar_itens(uuid, jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_abrir_questionamento(uuid, text, text, text, jsonb),
  public.compras_responder_questionamento(uuid, boolean, text), public.compras_listar_questionamentos(uuid, text[]),
  public.compras_alterar_itens(uuid, jsonb, text, jsonb) TO authenticated;
