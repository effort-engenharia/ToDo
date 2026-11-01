-- 36 (B-03 · PLANO_COTACAO_FORNECEDORES §7.2, §7.1 final, §5.8 parcial): RPCs de cotação, preços de referência, alertas e reescrita
-- de compras_alterar_status, compras_listar_pedidos e compras_detalhe_pedido.
--
-- Q-02b (pendências baixas): (a) compras_cotacao_abrir revalida que todos os fornecedores convidados continuam ativos e não
--   anonimizados; (b) compras_cotacao_montar_itens valida o formato de id/material_id/pedido_id (UUID) e da quantidade das origens
--   antes dos casts, devolvendo erro em pt-BR em vez de "invalid input syntax for type uuid". (Quantidade com o mesmo formato de
--   compras_parse_quantidade: até 10 inteiros e 6 decimais, ponto decimal.)
--
-- Objetivo:
--   * RPCs autenticadas (SECURITY DEFINER, search_path fixo, is_compras() validado dentro): compras_cotacao_criar, _montar_itens,
--     _incluir_pedidos, _remover_pedido, _definir_fornecedores, _abrir, _gerar_link, _registrar_envio, _prorrogar, _revisar,
--     _cancelar, _listar, _detalhe, _respostas_versoes, _decidir; compras_precos_referencia, compras_material_historico,
--     compras_verificar_alertas.
--   * Helpers internos (sem grant): compras_exigir_compras, compras_token_hash, compras_cotacao_evento, compras_cotacao_novo_token,
--     compras_cotacao_origens_atuais, compras_cotacao_recompor, compras_cotacao_itens_json, compras_cotacao_anexar_pedidos,
--     compras_cotacao_liberar_pedido, compras_cotacao_apos_remocao. Puro (grant authenticated): compras_condicao_totais.
--   * Reescrita de compras_alterar_status, compras_listar_pedidos, compras_detalhe_pedido (ver "DIFF" abaixo).
--
-- DIFF em relação às definições anteriores (partindo dos ARQUIVOS 25/26/28 com o gate da 33 aplicado; produção não foi consultada
-- neste ambiente — ANTES DE APLICAR (B-08/Q-02), comparar com pg_get_functiondef de produção; qualquer divergência além do diff abaixo
-- deve ser reconciliada):
--   compras_alterar_status (25 + 33):
--     + bloqueia em_cotacao → aguardando_compra ("Pedido está na cotação nº X: remova-o da cotação") e em_cotacao → comprado
--       ("Decida pela cotação nº X") quando há vínculo ativo e a flag de sessão compras.cotacao_rpc <> '1';
--     + ao cancelar, remove o pedido da cotação (vínculo ativa=false; requer_revisao=true se a cotação já foi enviada).
--     Gate mantido: is_compras() (mig. 33).
--   compras_listar_pedidos (26): + coluna cotacao_ativa jsonb {id, numero, status} e filtro p_filtros.sem_cotacao (bool).
--     MUDA o tipo de retorno (coluna nova) → DROP FUNCTION + CREATE + GRANT (CREATE OR REPLACE não permite). Gate mantido: pode_ver_compras().
--   compras_detalhe_pedido (28): + chave "cotacoes": [{id, numero, status, ativa}]. Gate mantido: pode_ver_compras().
--
-- Divergências em relação ao plano (Anexo C):
--   * compras_token_hash é criado aqui (usado por compras_cotacao_abrir) e não na 37.
--   * compras_cotacao_montar_itens(p_cot, NULL) recompõe automaticamente a lista (útil quando requer_revisao=true em rascunho).
--   * compras_cotacao_detalhe também devolve "decisao" (quando existir) e "pedidos[].ativa".
--
-- Dependências: 34 e 35. A atualização de questionamentos (tipo 'adicao', colunas origem/prazo_resposta_em/alerta_enviado_em) é da 38:
--   compras_verificar_alertas só trata aceites vencidos quando essas colunas existirem.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_verificar_alertas(), public.compras_material_historico(uuid, int), public.compras_precos_referencia(uuid[]),
--     public.compras_cotacao_decidir(uuid, jsonb), public.compras_cotacao_respostas_versoes(uuid), public.compras_cotacao_detalhe(uuid),
--     public.compras_cotacao_listar(jsonb, int, jsonb), public.compras_cotacao_cancelar(uuid, text), public.compras_cotacao_revisar(uuid, text, timestamptz),
--     public.compras_cotacao_prorrogar(uuid, timestamptz, text), public.compras_cotacao_registrar_envio(uuid, text, boolean),
--     public.compras_cotacao_gerar_link(uuid, text), public.compras_cotacao_abrir(uuid, timestamptz, text),
--     public.compras_cotacao_definir_fornecedores(uuid, uuid[]), public.compras_cotacao_remover_pedido(uuid, uuid, text),
--     public.compras_cotacao_incluir_pedidos(uuid, uuid[]), public.compras_cotacao_montar_itens(uuid, jsonb),
--     public.compras_cotacao_criar(uuid[], text, text), public.compras_condicao_totais(numeric, text, text, numeric, int, numeric, int, numeric, numeric),
--     public.compras_cotacao_apos_remocao(uuid, uuid), public.compras_cotacao_liberar_pedido(uuid, uuid, text, uuid, boolean),
--     public.compras_cotacao_anexar_pedidos(uuid, uuid[], uuid), public.compras_cotacao_itens_json(uuid, boolean),
--     public.compras_cotacao_recompor(uuid, int), public.compras_cotacao_origens_atuais(uuid), public.compras_cotacao_novo_token(uuid, uuid, text),
--     public.compras_cotacao_evento(uuid, uuid, uuid, text, jsonb), public.compras_token_hash(text), public.compras_exigir_compras();
--   Reaplicar as definições anteriores de compras_alterar_status (25 + 33), compras_listar_pedidos (26: DROP + CREATE sem cotacao_ativa)
--   e compras_detalhe_pedido (28).

-- =====================================================================================================================
-- Helpers internos (sem grant)
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_exigir_compras() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid := public.current_usuario_id();
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.compras_token_hash(p text) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT sha256(convert_to(COALESCE(p, ''), 'UTF8')) $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_evento(p_cot uuid, p_conv uuid, p_uid uuid, p_tipo text, p_dados jsonb DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.compras_cotacao_eventos (cotacao_id, convite_id, usuario_id, tipo, dados) VALUES (p_cot, p_conv, p_uid, p_tipo, p_dados)
$$;

-- Revoga o token vivo do convite (com o motivo) e cria um novo. Devolve o token em claro (43 caracteres base64url).
CREATE OR REPLACE FUNCTION public.compras_cotacao_novo_token(p_convite uuid, p_uid uuid, p_motivo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tok text;
BEGIN
  UPDATE public.compras_cotacao_tokens SET revogado_em = now(), motivo_revogacao = COALESCE(p_motivo, 'novo_link')
   WHERE convite_id = p_convite AND revogado_em IS NULL;
  v_tok := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  INSERT INTO public.compras_cotacao_tokens (token_hash, convite_id, criado_por) VALUES (public.compras_token_hash(v_tok), p_convite, p_uid);
  RETURN v_tok;
END $$;

-- Itens atuais (com id) dos pedidos ATIVOS da cotação, já com chave de consolidação (alias do catálogo ou nome|unidade normalizados).
-- Item sem quantidade numérica > 0 conta como 1.
CREATE OR REPLACE FUNCTION public.compras_cotacao_origens_atuais(p_cot uuid)
RETURNS TABLE (pedido_id uuid, item_id text, nome text, unidade text, unid_norm text, quantidade numeric, chave text,
               material_id uuid, snap jsonb, ord bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.pedido_id, x.item_id, x.nome, x.unidade, x.un, x.q,
         COALESCE('mat:' || al.material_id::text, public.compras_normalizar_nome(x.nome) || '|' || x.un),
         al.material_id, x.v, x.ord
    FROM (
      SELECT y.pedido_id, y.item_id, y.nome, y.unidade, y.un, y.v, y.ord,
             CASE WHEN y.qs ~ '^[0-9]{1,10}(\.[0-9]{1,6})?$' THEN (CASE WHEN y.qs::numeric > 0 THEN y.qs::numeric ELSE 1 END) ELSE 1 END AS q
        FROM (
          SELECT p.id AS pedido_id, e.v ->> 'id' AS item_id, btrim(e.v ->> 'nome') AS nome,
                 COALESCE(NULLIF(btrim(e.v ->> 'unidade'), ''), 'un') AS unidade,
                 public.compras_normalizar_unidade(COALESCE(NULLIF(btrim(e.v ->> 'unidade'), ''), 'un')) AS un,
                 replace(btrim(COALESCE(e.v ->> 'quantidade', '')), ',', '.') AS qs,
                 e.v AS v, row_number() OVER (ORDER BY cp.incluido_em, p.id, e.o) AS ord
            FROM public.compras_cotacao_pedidos cp
            JOIN public.execucao_pedidos_material p ON p.id = cp.pedido_id
            CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.itens) = 'array' THEN p.itens ELSE '[]'::jsonb END)
                       WITH ORDINALITY AS e(v, o)
           WHERE cp.cotacao_id = p_cot AND cp.ativa AND jsonb_typeof(e.v) = 'object'
                 AND btrim(COALESCE(e.v ->> 'nome', '')) <> '' AND COALESCE(e.v ->> 'id', '') <> ''
        ) y
    ) x
    LEFT JOIN public.compras_materiais_aliases al
      ON al.nome_normalizado = public.compras_normalizar_nome(x.nome) AND al.unidade = x.un
     AND EXISTS (SELECT 1 FROM public.compras_materiais m WHERE m.id = al.material_id AND m.ativo AND m.mesclado_em_id IS NULL)
$$;

-- Recompõe as linhas consolidadas (compras_cotacao_itens + origens) a partir dos itens atuais dos pedidos ativos.
--   * Linha que ainda tem alguma origem (pedido,item_id) presente mantém o id; origem nova entra na linha de mesma chave ou numa linha nova;
--     linha sem origem fica ativo=false.
--   * p_marca (nº da versão da lista) liga o rastreio de mudanças: linhas novas/alteradas/removidas recebem versao_alterada = p_marca.
--     NULL = sem rastreio (rascunho ou cotação sem envio).
CREATE OR REPLACE FUNCTION public.compras_cotacao_recompor(p_cot uuid, p_marca int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int; v_vl int;
BEGIN
  SELECT versao_lista INTO v_vl FROM public.compras_cotacoes WHERE id = p_cot;
  CREATE TEMP TABLE IF NOT EXISTS _cmp_cur (
    pedido_id uuid, item_id text, nome text, unidade text, unid_norm text, quantidade numeric, chave text,
    material_id uuid, snap jsonb, ord bigint, linha_id uuid) ON COMMIT DROP;
  DELETE FROM _cmp_cur;
  INSERT INTO _cmp_cur (pedido_id, item_id, nome, unidade, unid_norm, quantidade, chave, material_id, snap, ord)
  SELECT o.pedido_id, o.item_id, o.nome, o.unidade, o.unid_norm, o.quantidade, o.chave, o.material_id, o.snap, o.ord
    FROM public.compras_cotacao_origens_atuais(p_cot) o;

  -- 1) origem já existente numa linha ativa
  UPDATE _cmp_cur c SET linha_id = m.cotacao_item_id
    FROM (SELECT DISTINCT ON (io.pedido_id, io.item_id) io.pedido_id, io.item_id, io.cotacao_item_id
            FROM public.compras_cotacao_item_origens io
            JOIN public.compras_cotacao_itens ci ON ci.id = io.cotacao_item_id AND ci.cotacao_id = p_cot AND ci.ativo
           ORDER BY io.pedido_id, io.item_id, ci.seq) m
   WHERE m.pedido_id = c.pedido_id AND m.item_id = c.item_id;
  -- 2) origem nova com chave igual à de uma linha ativa
  UPDATE _cmp_cur c SET linha_id = (SELECT ci.id FROM public.compras_cotacao_itens ci
                                     WHERE ci.cotacao_id = p_cot AND ci.ativo AND ci.chave_consolidacao = c.chave ORDER BY ci.seq LIMIT 1)
   WHERE c.linha_id IS NULL;
  -- 3) linhas novas para o restante (1 por chave)
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.compras_cotacao_itens WHERE cotacao_id = p_cot;
  INSERT INTO public.compras_cotacao_itens (cotacao_id, seq, descricao, unidade, quantidade, material_id, chave_consolidacao, versao_criada, versao_alterada)
  SELECT p_cot, v_seq + row_number() OVER (ORDER BY g.o), left(g.nome, 200), g.un, g.q, g.mat, g.chave,
         COALESCE(p_marca, v_vl), p_marca
    FROM (SELECT c.chave, min(c.ord) AS o, (array_agg(c.nome ORDER BY c.ord))[1] AS nome, (array_agg(c.unidade ORDER BY c.ord))[1] AS un,
                 (array_agg(c.material_id) FILTER (WHERE c.material_id IS NOT NULL))[1] AS mat, sum(c.quantidade) AS q
            FROM _cmp_cur c WHERE c.linha_id IS NULL GROUP BY c.chave) g;
  UPDATE _cmp_cur c SET linha_id = (SELECT ci.id FROM public.compras_cotacao_itens ci
                                     WHERE ci.cotacao_id = p_cot AND ci.ativo AND ci.chave_consolidacao = c.chave ORDER BY ci.seq LIMIT 1)
   WHERE c.linha_id IS NULL;

  -- 4) quantidades das linhas mantidas
  UPDATE public.compras_cotacao_itens ci
     SET quantidade = s.q,
         versao_alterada = CASE WHEN p_marca IS NOT NULL AND ci.quantidade IS DISTINCT FROM s.q THEN p_marca ELSE ci.versao_alterada END
    FROM (SELECT linha_id, sum(quantidade) AS q FROM _cmp_cur WHERE linha_id IS NOT NULL GROUP BY linha_id) s
   WHERE ci.id = s.linha_id AND ci.quantidade IS DISTINCT FROM s.q;
  -- 5) linhas sem origem saem
  UPDATE public.compras_cotacao_itens ci
     SET ativo = false, versao_alterada = COALESCE(p_marca, ci.versao_alterada)
   WHERE ci.cotacao_id = p_cot AND ci.ativo AND NOT EXISTS (SELECT 1 FROM _cmp_cur c WHERE c.linha_id = ci.id);
  -- 6) origens
  DELETE FROM public.compras_cotacao_item_origens
   WHERE cotacao_item_id IN (SELECT id FROM public.compras_cotacao_itens WHERE cotacao_id = p_cot);
  INSERT INTO public.compras_cotacao_item_origens (cotacao_item_id, pedido_id, item_id, quantidade, item_snapshot)
  SELECT c.linha_id, c.pedido_id, c.item_id, c.quantidade, c.snap FROM _cmp_cur c WHERE c.linha_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  DELETE FROM _cmp_cur;
END $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_itens_json(p_cot uuid, p_somente_ativos boolean DEFAULT true) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', ci.id, 'seq', ci.seq, 'descricao', ci.descricao, 'unidade', ci.unidade, 'quantidade', ci.quantidade,
           'material_id', ci.material_id, 'observacao_publica', ci.observacao_publica, 'ativo', ci.ativo,
           'versao_criada', ci.versao_criada, 'versao_alterada', ci.versao_alterada,
           'origens', (SELECT COALESCE(jsonb_agg(jsonb_build_object('pedido_id', io.pedido_id, 'item_id', io.item_id, 'quantidade', io.quantidade)
                                                 ORDER BY io.pedido_id, io.item_id), '[]'::jsonb)
                         FROM public.compras_cotacao_item_origens io WHERE io.cotacao_item_id = ci.id)
         ) ORDER BY ci.seq), '[]'::jsonb)
    FROM public.compras_cotacao_itens ci
   WHERE ci.cotacao_id = p_cot AND (NOT p_somente_ativos OR ci.ativo)
$$;

-- Trava, valida e vincula pedidos à cotação; pedidos aguardando_compra passam a em_cotacao.
CREATE OR REPLACE FUNCTION public.compras_cotacao_anexar_pedidos(p_cot uuid, p_ids uuid[], p_uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.execucao_pedidos_material; v_num bigint; v_outra bigint; v_n int;
BEGIN
  SELECT numero INTO v_num FROM public.compras_cotacoes WHERE id = p_cot;
  PERFORM 1 FROM public.execucao_pedidos_material WHERE id = ANY (p_ids) ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_n FROM public.execucao_pedidos_material WHERE id = ANY (p_ids);
  IF v_n <> cardinality(p_ids) THEN RAISE EXCEPTION 'Algum pedido não foi encontrado'; END IF;

  FOR r IN SELECT * FROM public.execucao_pedidos_material WHERE id = ANY (p_ids) ORDER BY id LOOP
    IF r.status_compra NOT IN ('aguardando_compra', 'em_cotacao') THEN
      RAISE EXCEPTION 'O pedido "%" não pode entrar em cotação (status: %)', COALESCE(r.descricao, r.id::text), r.status_compra;
    END IF;
    IF NOT public.execucao_pedido_tem_itens(r.itens) THEN
      RAISE EXCEPTION 'O pedido "%" não tem itens preenchidos', COALESCE(r.descricao, r.id::text);
    END IF;
    SELECT c.numero INTO v_outra FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
     WHERE cp.pedido_id = r.id AND cp.ativa LIMIT 1;
    IF v_outra IS NOT NULL THEN
      RAISE EXCEPTION 'O pedido "%" já está na cotação nº %', COALESCE(r.descricao, r.id::text), v_outra;
    END IF;

    INSERT INTO public.compras_cotacao_pedidos (cotacao_id, pedido_id, ativa, incluido_por, incluido_em, removido_em, motivo_remocao)
    VALUES (p_cot, r.id, true, p_uid, now(), NULL, NULL)
    ON CONFLICT (cotacao_id, pedido_id) DO UPDATE
      SET ativa = true, incluido_por = EXCLUDED.incluido_por, incluido_em = now(), removido_em = NULL, motivo_remocao = NULL;

    IF r.status_compra = 'aguardando_compra' THEN
      UPDATE public.execucao_pedidos_material
         SET status_compra = 'em_cotacao', comprador_id = COALESCE(comprador_id, p_uid), status_compra_em = now(),
             fila_compras_em = COALESCE(fila_compras_em, now()), updated_at = now()
       WHERE id = r.id;
      PERFORM public.execucao_compras_historico(r.id, p_uid, 'cotacao', format('Pedido incluído na cotação nº %s (em cotação)', v_num),
        jsonb_build_object('status_compra', 'aguardando_compra'), jsonb_build_object('status_compra', 'em_cotacao', 'cotacao_id', p_cot));
    ELSE
      PERFORM public.execucao_compras_historico(r.id, p_uid, 'cotacao', format('Pedido incluído na cotação nº %s', v_num),
        NULL, jsonb_build_object('cotacao_id', p_cot));
    END IF;
  END LOOP;
END $$;

-- Tira o pedido da cotação (vínculo inativo); em_cotacao volta a aguardando_compra (p_reverter) — usado por remover/cancelar.
CREATE OR REPLACE FUNCTION public.compras_cotacao_liberar_pedido(p_cot uuid, p_pedido uuid, p_motivo text, p_uid uuid, p_reverter boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num bigint; v_rev boolean;
BEGIN
  UPDATE public.compras_cotacao_pedidos SET ativa = false, removido_em = now(), motivo_remocao = p_motivo
   WHERE cotacao_id = p_cot AND pedido_id = p_pedido AND ativa;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT numero INTO v_num FROM public.compras_cotacoes WHERE id = p_cot;
  IF p_reverter THEN
    UPDATE public.execucao_pedidos_material SET status_compra = 'aguardando_compra', status_compra_em = now(), updated_at = now()
     WHERE id = p_pedido AND status_compra = 'em_cotacao';
    v_rev := FOUND;
    UPDATE public.execucao_pedidos_material SET status_compra_anterior = 'aguardando_compra', updated_at = now()
     WHERE id = p_pedido AND status_compra = 'aguardando_solicitante' AND status_compra_anterior = 'em_cotacao';
  END IF;
  PERFORM public.execucao_compras_historico(p_pedido, p_uid, 'cotacao',
    format('Pedido saiu da cotação nº %s%s', v_num, CASE WHEN NULLIF(btrim(COALESCE(p_motivo, '')), '') IS NOT NULL THEN ': ' || p_motivo ELSE '' END),
    CASE WHEN COALESCE(v_rev, false) THEN jsonb_build_object('status_compra', 'em_cotacao') END,
    CASE WHEN COALESCE(v_rev, false) THEN jsonb_build_object('status_compra', 'aguardando_compra') END, p_motivo);
END $$;

-- Após remover pedido(s): recompõe as linhas e, se a cotação já foi enviada, marca requer_revisao.
CREATE OR REPLACE FUNCTION public.compras_cotacao_apos_remocao(p_cot uuid, p_uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.compras_cotacoes; v_env boolean;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cot FOR UPDATE;
  IF NOT FOUND OR c.status NOT IN ('rascunho', 'aberta') THEN RETURN; END IF;
  v_env := c.status = 'aberta' AND EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE cotacao_id = p_cot AND status <> 'nao_enviado');
  PERFORM public.compras_cotacao_recompor(p_cot, CASE WHEN v_env THEN c.versao_lista + 1 END);
  IF v_env AND NOT c.requer_revisao THEN
    UPDATE public.compras_cotacoes SET requer_revisao = true, updated_at = now() WHERE id = p_cot;
    PERFORM public.compras_cotacao_evento(p_cot, NULL, p_uid, 'requer_revisao', jsonb_build_object('motivo', 'pedido_removido'));
    IF c.criado_por IS NOT NULL AND c.criado_por IS DISTINCT FROM p_uid THEN
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
      VALUES ('compra_cotacao', '⚠️ Lista alterada: revise a cotação', left(format('Lista alterada: revise a cotação nº %s', c.numero), 500),
              NULL, c.criado_por, p_uid, jsonb_build_object('cotacao_id', p_cot));
    END IF;
  END IF;
END $$;

-- Totais de uma condição (§8.1, N2): total_itens (T) e VP dos itens (sem frete). p_base = Σ preço × quantidade atendida.
CREATE OR REPLACE FUNCTION public.compras_condicao_totais(
  p_base numeric, p_tipo text, p_desc_tipo text, p_desc_valor numeric, p_parcelas int, p_entrada numeric,
  p_primeira int, p_total_inf numeric, p_taxa numeric
) RETURNS TABLE (total numeric, vp numeric)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT t.total, public.compras_valor_presente(t.total, p_tipo, p_parcelas, p_entrada, p_primeira, p_taxa)
    FROM (SELECT round(CASE WHEN p_tipo = 'a_vista'
                            THEN CASE p_desc_tipo WHEN 'percentual' THEN p_base * (1 - COALESCE(p_desc_valor, 0) / 100)
                                                  WHEN 'valor' THEN GREATEST(p_base - COALESCE(p_desc_valor, 0), 0)
                                                  ELSE p_base END
                            ELSE COALESCE(p_total_inf, p_base) END, 2) AS total) t
$$;

REVOKE ALL ON FUNCTION public.compras_exigir_compras(), public.compras_token_hash(text),
  public.compras_cotacao_evento(uuid, uuid, uuid, text, jsonb), public.compras_cotacao_novo_token(uuid, uuid, text),
  public.compras_cotacao_origens_atuais(uuid), public.compras_cotacao_recompor(uuid, int), public.compras_cotacao_itens_json(uuid, boolean),
  public.compras_cotacao_anexar_pedidos(uuid, uuid[], uuid), public.compras_cotacao_liberar_pedido(uuid, uuid, text, uuid, boolean),
  public.compras_cotacao_apos_remocao(uuid, uuid), public.compras_condicao_totais(numeric, text, text, numeric, int, numeric, int, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compras_condicao_totais(numeric, text, text, numeric, int, numeric, int, numeric, numeric) TO authenticated;

-- =====================================================================================================================
-- RPCs de cotação
-- =====================================================================================================================
-- Retorno: {cotacao_id, numero, itens:[{id, seq, descricao, unidade, quantidade, material_id, observacao_publica, ativo, versao_criada, versao_alterada, origens:[...]}]}
CREATE OR REPLACE FUNCTION public.compras_cotacao_criar(p_pedidos uuid[], p_observacao_publica text DEFAULT NULL, p_regiao_entrega text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); v_ids uuid[]; v_id uuid; v_num bigint;
  v_obs text := NULLIF(btrim(COALESCE(p_observacao_publica, '')), ''); v_reg text := NULLIF(btrim(COALESCE(p_regiao_entrega, '')), '');
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(COALESCE(p_pedidos, '{}')) x WHERE x IS NOT NULL;
  IF cardinality(v_ids) < 1 OR cardinality(v_ids) > 30 THEN RAISE EXCEPTION 'Selecione de 1 a 30 pedidos'; END IF;
  IF v_obs IS NOT NULL AND length(v_obs) > 500 THEN RAISE EXCEPTION 'A observação pode ter no máximo 500 caracteres'; END IF;
  IF v_reg IS NOT NULL AND length(v_reg) > 80 THEN RAISE EXCEPTION 'A região de entrega pode ter no máximo 80 caracteres'; END IF;

  INSERT INTO public.compras_cotacoes (criado_por, observacao_publica, regiao_entrega) VALUES (v_uid, v_obs, v_reg)
  RETURNING id, numero INTO v_id, v_num;
  PERFORM public.compras_cotacao_anexar_pedidos(v_id, v_ids, v_uid);
  PERFORM public.compras_cotacao_recompor(v_id, NULL);
  PERFORM public.compras_cotacao_evento(v_id, NULL, v_uid, 'criada', jsonb_build_object('pedidos', to_jsonb(v_ids)));
  RETURN jsonb_build_object('cotacao_id', v_id, 'numero', v_num, 'itens', public.compras_cotacao_itens_json(v_id, true));
END $$;

-- p_itens: [{id?, descricao, unidade, material_id?, observacao_publica?, origens:[{pedido_id, item_id, quantidade}]}]
-- p_itens NULL = recomposição automática (só rascunho ou aberta com requer_revisao). Retorno: jsonb itens (ativos).
CREATE OR REPLACE FUNCTION public.compras_cotacao_montar_itens(p_cotacao uuid, p_itens jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_marca int;
  l jsonb; o jsonb; v_i int := 0; v_n int; v_lid uuid; v_mat uuid; v_desc text; v_unid text; v_qtd numeric; v_un_norm text; v_chave text;
  v_cur record; v_seen text[] := '{}'; v_key text; v_total_cur int; v_ped uuid; v_nome_origem text;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF NOT (c.status = 'rascunho' OR (c.status = 'aberta' AND c.requer_revisao)) THEN
    RAISE EXCEPTION 'A lista só pode ser montada com a cotação em rascunho (ou aberta aguardando revisão)';
  END IF;
  v_marca := CASE WHEN c.status = 'aberta' THEN c.versao_lista + 1 END;

  IF p_itens IS NULL THEN
    PERFORM public.compras_cotacao_recompor(p_cotacao, v_marca);
  ELSE
    IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) < 1 OR jsonb_array_length(p_itens) > 500 THEN
      RAISE EXCEPTION 'Informe de 1 a 500 linhas';
    END IF;
    -- 0) Q-02b: formato dos identificadores/quantidades ANTES dos casts (UUID malformado vira erro tratado, não exceção de cast)
    FOR l IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      IF jsonb_typeof(l) <> 'object' OR jsonb_typeof(l -> 'origens') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Linha inválida: cada linha precisa de descrição, unidade e origens';
      END IF;
      IF (NULLIF(l ->> 'id', '') IS NOT NULL AND (l ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         OR (NULLIF(l ->> 'material_id', '') IS NOT NULL AND (l ->> 'material_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RAISE EXCEPTION 'Identificador inválido em uma das linhas';
      END IF;
      FOR o IN SELECT * FROM jsonb_array_elements(l -> 'origens') LOOP
        IF jsonb_typeof(o) <> 'object' OR COALESCE(o ->> 'pedido_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR COALESCE(o ->> 'item_id', '') = '' OR COALESCE(o ->> 'quantidade', '') !~ '^[0-9]{1,10}(\.[0-9]{1,6})?$' THEN
          RAISE EXCEPTION 'Origem inválida: informe pedido_id (uuid), item_id e quantidade numérica';
        END IF;
      END LOOP;
    END LOOP;
    -- 1) cada origem informada exatamente uma vez, igual à lista atual, mesma unidade por linha
    FOR l IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      IF jsonb_typeof(l) <> 'object' OR jsonb_typeof(l -> 'origens') <> 'array' OR jsonb_array_length(l -> 'origens') < 1 THEN
        RAISE EXCEPTION 'Cada linha precisa de ao menos uma origem';
      END IF;
      v_un_norm := NULL;
      FOR o IN SELECT * FROM jsonb_array_elements(l -> 'origens') LOOP
        v_key := (o ->> 'pedido_id') || '|' || (o ->> 'item_id');
        IF v_key = ANY (v_seen) THEN RAISE EXCEPTION 'O item % aparece em mais de uma linha', o ->> 'item_id'; END IF;
        v_seen := v_seen || v_key;
        SELECT a.unid_norm, a.quantidade INTO v_cur FROM public.compras_cotacao_origens_atuais(p_cotacao) a
         WHERE a.pedido_id = (o ->> 'pedido_id')::uuid AND a.item_id = o ->> 'item_id';
        IF NOT FOUND THEN RAISE EXCEPTION 'Origem inexistente na cotação: item %', o ->> 'item_id'; END IF;
        IF (o ->> 'quantidade')::numeric IS DISTINCT FROM v_cur.quantidade THEN
          RAISE EXCEPTION 'A quantidade do item % não confere com a do pedido (% )', o ->> 'item_id', v_cur.quantidade;
        END IF;
        IF v_un_norm IS NOT NULL AND v_un_norm <> v_cur.unid_norm THEN
          RAISE EXCEPTION 'Os itens de uma mesma linha precisam ter a mesma unidade';
        END IF;
        v_un_norm := v_cur.unid_norm;
      END LOOP;
    END LOOP;
    SELECT count(*) INTO v_total_cur FROM public.compras_cotacao_origens_atuais(p_cotacao);
    IF cardinality(v_seen) <> v_total_cur THEN RAISE EXCEPTION 'Todos os itens dos pedidos precisam estar em alguma linha (faltam %)', v_total_cur - cardinality(v_seen); END IF;

    -- 2) aplica: linhas fora da lista saem; as demais são atualizadas/criadas
    UPDATE public.compras_cotacao_itens SET ativo = false, versao_alterada = COALESCE(v_marca, versao_alterada)
     WHERE cotacao_id = p_cotacao AND ativo
       AND id NOT IN (SELECT (e ->> 'id')::uuid FROM jsonb_array_elements(p_itens) e WHERE NULLIF(e ->> 'id', '') IS NOT NULL);
    DELETE FROM public.compras_cotacao_item_origens WHERE cotacao_item_id IN (SELECT id FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao);

    FOR l IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      v_i := v_i + 1;
      v_desc := left(btrim(COALESCE(l ->> 'descricao', '')), 200);
      v_unid := btrim(COALESCE(l ->> 'unidade', ''));
      IF v_desc = '' OR v_unid = '' THEN RAISE EXCEPTION 'Informe descrição e unidade em todas as linhas'; END IF;
      v_mat := NULLIF(l ->> 'material_id', '')::uuid;
      IF v_mat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.compras_materiais WHERE id = v_mat AND ativo AND mesclado_em_id IS NULL) THEN
        RAISE EXCEPTION 'Material inválido na linha %', v_i;
      END IF;
      SELECT sum(((o2 ->> 'quantidade')::numeric)) INTO v_qtd FROM jsonb_array_elements(l -> 'origens') o2;
      v_chave := COALESCE('mat:' || v_mat::text, public.compras_normalizar_nome(v_desc) || '|' || public.compras_normalizar_unidade(v_unid));

      v_lid := NULLIF(l ->> 'id', '')::uuid;
      IF v_lid IS NOT NULL THEN
        UPDATE public.compras_cotacao_itens
           SET seq = v_i, descricao = v_desc, unidade = v_unid, material_id = v_mat, chave_consolidacao = v_chave,
               observacao_publica = NULLIF(left(btrim(COALESCE(l ->> 'observacao_publica', '')), 200), ''),
               versao_alterada = CASE WHEN v_marca IS NOT NULL AND (quantidade IS DISTINCT FROM v_qtd OR NOT ativo) THEN v_marca ELSE versao_alterada END,
               quantidade = v_qtd, ativo = true
         WHERE id = v_lid AND cotacao_id = p_cotacao;
        IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não pertence a esta cotação', v_lid; END IF;
      ELSE
        INSERT INTO public.compras_cotacao_itens (cotacao_id, seq, descricao, unidade, quantidade, material_id, chave_consolidacao,
                                                  observacao_publica, versao_criada, versao_alterada)
        VALUES (p_cotacao, v_i, v_desc, v_unid, v_qtd, v_mat, v_chave, NULLIF(left(btrim(COALESCE(l ->> 'observacao_publica', '')), 200), ''),
                COALESCE(v_marca, c.versao_lista), v_marca)
        RETURNING id INTO v_lid;
      END IF;

      INSERT INTO public.compras_cotacao_item_origens (cotacao_item_id, pedido_id, item_id, quantidade, item_snapshot)
      SELECT v_lid, (o3 ->> 'pedido_id')::uuid, o3 ->> 'item_id', (o3 ->> 'quantidade')::numeric,
             (SELECT a.snap FROM public.compras_cotacao_origens_atuais(p_cotacao) a WHERE a.pedido_id = (o3 ->> 'pedido_id')::uuid AND a.item_id = o3 ->> 'item_id')
        FROM jsonb_array_elements(l -> 'origens') o3;

      -- D12: confirmação da atendente alimenta o alias (nome normalizado do item de origem + unidade → material)
      IF v_mat IS NOT NULL THEN
        INSERT INTO public.compras_materiais_aliases (nome_normalizado, unidade, material_id, created_by)
        SELECT DISTINCT public.compras_normalizar_nome(a.nome), a.unid_norm, v_mat, v_uid
          FROM public.compras_cotacao_origens_atuais(p_cotacao) a
         WHERE (a.pedido_id::text || '|' || a.item_id) IN (SELECT (o4 ->> 'pedido_id') || '|' || (o4 ->> 'item_id') FROM jsonb_array_elements(l -> 'origens') o4)
           AND public.compras_normalizar_nome(a.nome) <> ''
        ON CONFLICT (nome_normalizado, unidade) DO UPDATE SET material_id = EXCLUDED.material_id;
      END IF;
    END LOOP;
  END IF;

  IF c.status = 'rascunho' THEN
    UPDATE public.compras_cotacoes SET requer_revisao = false, updated_at = now() WHERE id = p_cotacao;
  END IF;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'itens_montados',
    jsonb_build_object('automatico', p_itens IS NULL, 'linhas', (SELECT count(*) FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo)));
  RETURN public.compras_cotacao_itens_json(p_cotacao, true);
END $$;

-- Retorno: {cotacao_id, itens, requer_revisao}
CREATE OR REPLACE FUNCTION public.compras_cotacao_incluir_pedidos(p_cotacao uuid, p_pedidos uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_ids uuid[]; v_env boolean; v_n int;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status NOT IN ('rascunho', 'aberta') THEN RAISE EXCEPTION 'A cotação está %: não aceita novos pedidos', c.status; END IF;
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(COALESCE(p_pedidos, '{}')) x WHERE x IS NOT NULL;
  IF cardinality(v_ids) < 1 THEN RAISE EXCEPTION 'Selecione ao menos um pedido'; END IF;
  SELECT count(*) INTO v_n FROM public.compras_cotacao_pedidos WHERE cotacao_id = p_cotacao AND ativa;
  IF v_n + cardinality(v_ids) > 30 THEN RAISE EXCEPTION 'A cotação pode ter no máximo 30 pedidos'; END IF;
  v_env := c.status = 'aberta' AND EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao AND status <> 'nao_enviado');

  PERFORM public.compras_cotacao_anexar_pedidos(p_cotacao, v_ids, v_uid);
  PERFORM public.compras_cotacao_recompor(p_cotacao, CASE WHEN v_env THEN c.versao_lista + 1 END);
  IF v_env THEN UPDATE public.compras_cotacoes SET requer_revisao = true, updated_at = now() WHERE id = p_cotacao; END IF;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'pedido_incluido', jsonb_build_object('pedidos', to_jsonb(v_ids)));
  RETURN jsonb_build_object('cotacao_id', p_cotacao, 'itens', public.compras_cotacao_itens_json(p_cotacao, true),
                            'requer_revisao', v_env OR c.requer_revisao);
END $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_remover_pedido(p_cotacao uuid, p_pedido uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_mot text := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status NOT IN ('rascunho', 'aberta') THEN RAISE EXCEPTION 'A cotação está %: não é possível remover pedidos', c.status; END IF;
  IF v_mot IS NULL OR length(v_mot) < 3 THEN RAISE EXCEPTION 'Informe o motivo da remoção'; END IF;
  PERFORM 1 FROM public.compras_cotacao_pedidos WHERE cotacao_id = p_cotacao AND pedido_id = p_pedido AND ativa;
  IF NOT FOUND THEN RAISE EXCEPTION 'O pedido não está nesta cotação'; END IF;
  PERFORM 1 FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;

  PERFORM public.compras_cotacao_liberar_pedido(p_cotacao, p_pedido, v_mot, v_uid, true);
  PERFORM public.compras_cotacao_apos_remocao(p_cotacao, v_uid);
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'pedido_removido', jsonb_build_object('pedido_id', p_pedido, 'motivo', v_mot));
  RETURN jsonb_build_object('cotacao_id', p_cotacao, 'itens', public.compras_cotacao_itens_json(p_cotacao, true),
                            'requer_revisao', (SELECT requer_revisao FROM public.compras_cotacoes WHERE id = p_cotacao));
END $$;

-- Retorno: jsonb [{convite_id, fornecedor_id, status}]
CREATE OR REPLACE FUNCTION public.compras_cotacao_definir_fornecedores(p_cotacao uuid, p_fornecedores uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_ids uuid[]; v_n int;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status NOT IN ('rascunho', 'aberta') THEN RAISE EXCEPTION 'A cotação está %: não aceita alteração de fornecedores', c.status; END IF;
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(COALESCE(p_fornecedores, '{}')) x WHERE x IS NOT NULL;
  IF cardinality(v_ids) < 1 OR cardinality(v_ids) > 15 THEN RAISE EXCEPTION 'Escolha de 1 a 15 fornecedores'; END IF;
  SELECT count(*) INTO v_n FROM public.compras_fornecedores WHERE id = ANY (v_ids) AND ativo AND anonimizado_em IS NULL;
  -- fornecedores já convidados continuam mesmo se inativados depois; só os NOVOS precisam estar ativos
  IF EXISTS (SELECT 1 FROM unnest(v_ids) f
              WHERE NOT EXISTS (SELECT 1 FROM public.compras_cotacao_convites cv WHERE cv.cotacao_id = p_cotacao AND cv.fornecedor_id = f)
                AND NOT EXISTS (SELECT 1 FROM public.compras_fornecedores x WHERE x.id = f AND x.ativo AND x.anonimizado_em IS NULL)) THEN
    RAISE EXCEPTION 'Algum fornecedor está inativo, anonimizado ou não existe';
  END IF;

  DELETE FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao AND status = 'nao_enviado' AND NOT (fornecedor_id = ANY (v_ids))
    AND NOT EXISTS (SELECT 1 FROM public.compras_cotacao_respostas r WHERE r.convite_id = compras_cotacao_convites.id);
  INSERT INTO public.compras_cotacao_convites (cotacao_id, fornecedor_id)
  SELECT p_cotacao, f FROM unnest(v_ids) f ON CONFLICT (cotacao_id, fornecedor_id) DO NOTHING;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('convite_id', id, 'fornecedor_id', fornecedor_id, 'status', status) ORDER BY created_at, id), '[]'::jsonb)
            FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao);
END $$;

-- Retorno: {cotacao:{id, numero, status, prazo_resposta, versao_lista}, links:[{convite_id, fornecedor_id, token}]} (tokens em claro UMA vez)
CREATE OR REPLACE FUNCTION public.compras_cotacao_abrir(p_cotacao uuid, p_prazo timestamptz DEFAULT NULL, p_mensagem text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; cfg public.compras_config; v_prazo timestamptz; v_links jsonb := '[]'::jsonb; cv record;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status <> 'rascunho' THEN RAISE EXCEPTION 'Só é possível abrir cotações em rascunho (status atual: %)', c.status; END IF;
  IF c.requer_revisao THEN RAISE EXCEPTION 'A lista dos pedidos mudou: remonte os itens antes de abrir a cotação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo) THEN RAISE EXCEPTION 'A cotação não tem itens'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao) THEN RAISE EXCEPTION 'Escolha ao menos um fornecedor'; END IF;
  IF p_mensagem IS NOT NULL AND length(p_mensagem) > 1000 THEN RAISE EXCEPTION 'A mensagem pode ter no máximo 1.000 caracteres'; END IF;
  SELECT * INTO cfg FROM public.compras_config WHERE id = 1;
  v_prazo := COALESCE(p_prazo, now() + make_interval(hours => cfg.prazo_padrao_horas));
  IF v_prazo < now() + interval '1 hour' OR v_prazo > now() + interval '30 days' THEN
    RAISE EXCEPTION 'O prazo de resposta deve estar entre 1 hora e 30 dias a partir de agora';
  END IF;

  -- Q-02b: revalida os fornecedores no momento de abrir (podem ter sido inativados/anonimizados depois de escolhidos)
  IF EXISTS (SELECT 1 FROM public.compras_cotacao_convites cv
               LEFT JOIN public.compras_fornecedores fo ON fo.id = cv.fornecedor_id
              WHERE cv.cotacao_id = p_cotacao AND (fo.id IS NULL OR NOT fo.ativo OR fo.anonimizado_em IS NOT NULL)) THEN
    RAISE EXCEPTION 'Há fornecedor inativo ou anonimizado na cotação: ajuste os fornecedores antes de abrir';
  END IF;

  UPDATE public.compras_cotacoes
     SET status = 'aberta', prazo_resposta = v_prazo, aberta_em = now(), versao_lista = 1, taxa_mensal = cfg.taxa_mensal,
         empate_pct = cfg.empate_pct, mensagem = NULLIF(btrim(COALESCE(p_mensagem, '')), ''), updated_at = now()
   WHERE id = p_cotacao;
  FOR cv IN SELECT id, fornecedor_id FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao ORDER BY created_at, id LOOP
    v_links := v_links || jsonb_build_object('convite_id', cv.id, 'fornecedor_id', cv.fornecedor_id,
                                              'token', public.compras_cotacao_novo_token(cv.id, v_uid, 'novo_link'));
  END LOOP;
  DELETE FROM public.compras_rate_limit WHERE janela < now() - interval '2 days';
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'aberta', jsonb_build_object('prazo_resposta', v_prazo, 'convites', jsonb_array_length(v_links)));
  RETURN jsonb_build_object('cotacao', jsonb_build_object('id', c.id, 'numero', c.numero, 'status', 'aberta', 'prazo_resposta', v_prazo, 'versao_lista', 1),
                            'links', v_links);
END $$;

-- p_motivo: 'novo_link' (padrão) ou 'lembrete'. Retorno: {convite_id, token}
CREATE OR REPLACE FUNCTION public.compras_cotacao_gerar_link(p_convite uuid, p_motivo text DEFAULT 'novo_link') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); cv public.compras_cotacao_convites; c public.compras_cotacoes; v_anon timestamptz; v_tok text;
BEGIN
  IF COALESCE(p_motivo, 'novo_link') NOT IN ('novo_link', 'lembrete') THEN RAISE EXCEPTION 'Motivo inválido (use novo_link ou lembrete)'; END IF;
  SELECT * INTO cv FROM public.compras_cotacao_convites WHERE id = p_convite;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = cv.cotacao_id FOR UPDATE;
  IF c.status <> 'aberta' THEN RAISE EXCEPTION 'A cotação não está aberta'; END IF;
  SELECT anonimizado_em INTO v_anon FROM public.compras_fornecedores WHERE id = cv.fornecedor_id;
  IF v_anon IS NOT NULL THEN RAISE EXCEPTION 'Fornecedor anonimizado: não é possível gerar link'; END IF;
  v_tok := public.compras_cotacao_novo_token(p_convite, v_uid, COALESCE(p_motivo, 'novo_link'));
  PERFORM public.compras_cotacao_evento(c.id, p_convite, v_uid, 'link_gerado', jsonb_build_object('motivo', COALESCE(p_motivo, 'novo_link')));
  RETURN jsonb_build_object('convite_id', p_convite, 'token', v_tok);
END $$;

-- p_canal: 'whatsapp' | 'copia'. Retorno: linha do convite (jsonb)
CREATE OR REPLACE FUNCTION public.compras_cotacao_registrar_envio(p_convite uuid, p_canal text, p_lembrete boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); cv public.compras_cotacao_convites; c public.compras_cotacoes;
BEGIN
  IF p_canal IS NULL OR p_canal NOT IN ('whatsapp', 'copia') THEN RAISE EXCEPTION 'Canal inválido (use whatsapp ou copia)'; END IF;
  SELECT * INTO cv FROM public.compras_cotacao_convites WHERE id = p_convite FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = cv.cotacao_id;
  IF c.status <> 'aberta' THEN RAISE EXCEPTION 'A cotação não está aberta'; END IF;
  UPDATE public.compras_cotacao_convites
     SET status = CASE WHEN status = 'nao_enviado' THEN 'enviado' ELSE status END,
         envios = envios + 1, enviado_em = COALESCE(enviado_em, now()), enviado_por = COALESCE(enviado_por, v_uid), ultimo_canal = p_canal
   WHERE id = p_convite RETURNING * INTO cv;
  PERFORM public.compras_cotacao_evento(cv.cotacao_id, p_convite, v_uid, CASE WHEN COALESCE(p_lembrete, false) THEN 'lembrete' ELSE 'enviado' END,
                                        jsonb_build_object('canal', p_canal));
  RETURN to_jsonb(cv);
END $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_prorrogar(p_cotacao uuid, p_novo_prazo timestamptz, p_motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status <> 'aberta' THEN RAISE EXCEPTION 'Só cotações abertas podem ser prorrogadas'; END IF;
  IF p_novo_prazo IS NULL OR p_novo_prazo <= now() OR p_novo_prazo <= c.prazo_resposta THEN
    RAISE EXCEPTION 'O novo prazo precisa ser futuro e maior que o prazo atual';
  END IF;
  IF p_novo_prazo > now() + interval '30 days' THEN RAISE EXCEPTION 'O prazo pode ir no máximo 30 dias à frente'; END IF;
  UPDATE public.compras_cotacoes SET prazo_resposta = p_novo_prazo, updated_at = now() WHERE id = p_cotacao;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'prorrogada',
    jsonb_build_object('de', c.prazo_resposta, 'para', p_novo_prazo, 'motivo', NULLIF(btrim(COALESCE(p_motivo, '')), '')));
  RETURN jsonb_build_object('cotacao_id', p_cotacao, 'prazo_resposta', p_novo_prazo);
END $$;

-- Retorno: {versao_lista, convites_reconfirmar:[{convite_id, fornecedor_id}], itens}
CREATE OR REPLACE FUNCTION public.compras_cotacao_revisar(p_cotacao uuid, p_motivo text, p_novo_prazo timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_nv int; v_rec jsonb; v_diff jsonb;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status <> 'aberta' THEN RAISE EXCEPTION 'Só cotações abertas podem ser revisadas'; END IF;
  IF p_novo_prazo IS NULL OR p_novo_prazo < now() + interval '1 hour' OR p_novo_prazo > now() + interval '30 days' THEN
    RAISE EXCEPTION 'O novo prazo deve estar entre 1 hora e 30 dias a partir de agora';
  END IF;
  v_nv := c.versao_lista + 1;
  PERFORM public.compras_cotacao_recompor(p_cotacao, v_nv);
  IF NOT EXISTS (SELECT 1 FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo) THEN
    RAISE EXCEPTION 'A cotação ficaria sem itens: cancele a cotação em vez de revisar';
  END IF;
  UPDATE public.compras_cotacoes SET versao_lista = v_nv, requer_revisao = false, prazo_resposta = p_novo_prazo, updated_at = now() WHERE id = p_cotacao;
  UPDATE public.compras_cotacao_convites SET precisa_reconfirmar = true WHERE cotacao_id = p_cotacao AND status IN ('respondido', 'recusou');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('convite_id', id, 'fornecedor_id', fornecedor_id) ORDER BY created_at, id), '[]'::jsonb) INTO v_rec
    FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao AND precisa_reconfirmar;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'descricao', descricao, 'quantidade', quantidade, 'ativo', ativo)), '[]'::jsonb) INTO v_diff
    FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND versao_alterada = v_nv;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'revisada',
    jsonb_build_object('versao_lista', v_nv, 'motivo', NULLIF(btrim(COALESCE(p_motivo, '')), ''), 'prazo_resposta', p_novo_prazo, 'linhas_alteradas', v_diff));
  RETURN jsonb_build_object('versao_lista', v_nv, 'convites_reconfirmar', v_rec, 'itens', public.compras_cotacao_itens_json(p_cotacao, true));
END $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_cancelar(p_cotacao uuid, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_mot text := NULLIF(btrim(COALESCE(p_motivo, '')), ''); r record;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status NOT IN ('rascunho', 'aberta') THEN RAISE EXCEPTION 'A cotação já está %', c.status; END IF;
  IF v_mot IS NULL OR length(v_mot) < 5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento (mínimo 5 caracteres)'; END IF;
  FOR r IN SELECT pedido_id FROM public.compras_cotacao_pedidos WHERE cotacao_id = p_cotacao AND ativa ORDER BY pedido_id LOOP
    PERFORM 1 FROM public.execucao_pedidos_material WHERE id = r.pedido_id FOR UPDATE;
    PERFORM public.compras_cotacao_liberar_pedido(p_cotacao, r.pedido_id, 'Cotação cancelada: ' || v_mot, v_uid, true);
  END LOOP;
  UPDATE public.compras_cotacao_tokens SET revogado_em = now(), motivo_revogacao = 'cotacao_cancelada'
   WHERE revogado_em IS NULL AND convite_id IN (SELECT id FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao);
  UPDATE public.compras_cotacoes SET status = 'cancelada', cancelada_em = now(), cancelada_por = v_uid, motivo_cancelamento = v_mot, updated_at = now()
   WHERE id = p_cotacao;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'cancelada', jsonb_build_object('motivo', v_mot));
END $$;

-- filtros: {status[], busca, de ('YYYY-MM-DD'), ate, minhas(bool)}; cursor {created_at, id}. Retorno: {itens:[...], proximo_cursor}
CREATE OR REPLACE FUNCTION public.compras_cotacao_listar(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite int DEFAULT 30, p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); f jsonb := COALESCE(p_filtros, '{}'::jsonb);
  v_lim int := LEAST(GREATEST(COALESCE(p_limite, 30), 1), 100);
  v_status text[] := CASE WHEN jsonb_typeof(f -> 'status') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(f -> 'status')) END;
  v_busca text := NULLIF(btrim(COALESCE(f ->> 'busca', '')), ''); v_like text;
  v_de date := NULLIF(f ->> 'de', '')::date; v_ate date := NULLIF(f ->> 'ate', '')::date;
  v_min boolean := COALESCE((f ->> 'minhas')::boolean, false);
  v_cur_t timestamptz := NULLIF(p_cursor ->> 'created_at', '')::timestamptz; v_cur_id uuid := NULLIF(p_cursor ->> 'id', '')::uuid;
  v_rows jsonb; v_prox jsonb := NULL; v_last jsonb;
BEGIN
  IF v_busca IS NOT NULL THEN v_like := '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC, t.id ASC), '[]'::jsonb) INTO v_rows FROM (
    SELECT c.id, c.numero, c.status, c.prazo_resposta, c.requer_revisao, c.created_at,
           (SELECT count(*) FROM public.compras_cotacao_pedidos cp WHERE cp.cotacao_id = c.id AND cp.ativa) AS n_pedidos,
           (SELECT count(*) FROM public.compras_cotacao_itens ci WHERE ci.cotacao_id = c.id AND ci.ativo) AS n_itens,
           (SELECT count(*) FROM public.compras_cotacao_convites cv WHERE cv.cotacao_id = c.id) AS n_convites,
           (SELECT count(*) FROM public.compras_cotacao_convites cv WHERE cv.cotacao_id = c.id AND cv.status <> 'nao_enviado') AS n_enviados,
           (SELECT count(*) FROM public.compras_cotacao_convites cv WHERE cv.cotacao_id = c.id AND cv.status IN ('respondido', 'recusou')) AS n_respondidos,
           (SELECT u.nome_completo FROM public.usuarios u WHERE u.id = c.criado_por) AS criado_por_nome
      FROM public.compras_cotacoes c
     WHERE (v_status IS NULL OR cardinality(v_status) = 0 OR c.status = ANY (v_status))
       AND (NOT v_min OR c.criado_por = v_uid)
       AND (v_de IS NULL OR c.created_at >= v_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND (v_ate IS NULL OR c.created_at < (v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
       AND (v_busca IS NULL OR c.numero::text = v_busca
            OR EXISTS (SELECT 1 FROM public.compras_cotacao_itens ci WHERE ci.cotacao_id = c.id AND ci.descricao ILIKE v_like)
            OR EXISTS (SELECT 1 FROM public.compras_cotacao_convites cv JOIN public.compras_fornecedores fo ON fo.id = cv.fornecedor_id
                        WHERE cv.cotacao_id = c.id AND fo.empresa ILIKE v_like))
       AND (v_cur_t IS NULL OR c.created_at < v_cur_t OR (c.created_at = v_cur_t AND c.id > v_cur_id))
     ORDER BY c.created_at DESC, c.id ASC
     LIMIT v_lim + 1) t;
  IF jsonb_array_length(v_rows) > v_lim THEN
    v_rows := v_rows - v_lim;
    v_last := v_rows -> (v_lim - 1);
    v_prox := jsonb_build_object('created_at', v_last ->> 'created_at', 'id', v_last ->> 'id');
  END IF;
  RETURN jsonb_build_object('itens', v_rows, 'proximo_cursor', v_prox);
END $$;

-- Detalhe completo (dado interno; o token NUNCA é devolvido). Ver Anexo C.
CREATE OR REPLACE FUNCTION public.compras_cotacao_detalhe(p_cotacao uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_mats uuid[]; v_ped jsonb; v_conv jsonb; v_resp jsonb; v_ev jsonb; v_dec jsonb; v_ref jsonb;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'descricao', p.descricao, 'cliente_nome', p.cliente_nome,
           'solicitante_nome', (SELECT u.nome_completo FROM public.usuarios u WHERE u.id = p.solicitante_id),
           'status_compra', p.status_compra, 'urgencia', p.urgencia, 'ativa', cp.ativa) ORDER BY cp.incluido_em, p.id), '[]'::jsonb) INTO v_ped
    FROM public.compras_cotacao_pedidos cp JOIN public.execucao_pedidos_material p ON p.id = cp.pedido_id
   WHERE cp.cotacao_id = p_cotacao;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', cv.id, 'fornecedor_id', cv.fornecedor_id, 'status', cv.status, 'enviado_em', cv.enviado_em, 'envios', cv.envios,
           'ultimo_canal', cv.ultimo_canal, 'primeira_visualizacao_em', cv.primeira_visualizacao_em, 'ultima_visualizacao_em', cv.ultima_visualizacao_em,
           'respondido_em', cv.respondido_em, 'versao_lista_respondida', cv.versao_lista_respondida, 'precisa_reconfirmar', cv.precisa_reconfirmar,
           'fornecedor', jsonb_build_object('nome_contato', fo.nome_contato, 'empresa', fo.empresa, 'whatsapp', fo.whatsapp),
           'expirado', (c.status = 'aberta' AND c.prazo_resposta < now() AND cv.status NOT IN ('respondido', 'recusou')),
           'compras_anteriores', (SELECT count(DISTINCT di.decisao_id) FROM public.compras_cotacao_decisao_itens di WHERE di.fornecedor_id = cv.fornecedor_id),
           'tem_token_vivo', EXISTS (SELECT 1 FROM public.compras_cotacao_tokens tk WHERE tk.convite_id = cv.id AND tk.revogado_em IS NULL)
         ) ORDER BY cv.created_at, cv.id), '[]'::jsonb) INTO v_conv
    FROM public.compras_cotacao_convites cv JOIN public.compras_fornecedores fo ON fo.id = cv.fornecedor_id
   WHERE cv.cotacao_id = p_cotacao;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'convite_id', r.convite_id, 'versao', r.versao, 'versao_lista', r.versao_lista, 'recusou', r.recusou,
           'prazo_entrega_dias', r.prazo_entrega_dias, 'frete_tipo', r.frete_tipo, 'frete_valor', r.frete_valor, 'observacao', r.observacao,
           'base_total', r.base_total, 'enviado_em', r.enviado_em,
           'itens', (SELECT COALESCE(jsonb_agg(jsonb_build_object('cotacao_item_id', ri.cotacao_item_id, 'tem_item', ri.tem_item,
                       'preco_unitario', ri.preco_unitario, 'quantidade_disponivel', ri.quantidade_disponivel, 'observacao', ri.observacao)), '[]'::jsonb)
                       FROM public.compras_cotacao_resposta_itens ri WHERE ri.resposta_id = r.id),
           'condicoes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', cc.id, 'tipo', cc.tipo, 'desconto_tipo', cc.desconto_tipo,
                       'desconto_valor', cc.desconto_valor, 'parcelas', cc.parcelas, 'entrada_valor', cc.entrada_valor,
                       'primeira_parcela_dias', cc.primeira_parcela_dias, 'total_informado', cc.total_informado,
                       'total_itens', cc.total_itens, 'valor_presente_itens', cc.valor_presente_itens) ORDER BY cc.tipo), '[]'::jsonb)
                       FROM public.compras_cotacao_resposta_condicoes cc WHERE cc.resposta_id = r.id)
         ) ORDER BY r.enviado_em, r.id), '[]'::jsonb) INTO v_resp
    FROM public.compras_cotacao_respostas r WHERE r.cotacao_id = p_cotacao AND r.atual;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'convite_id', e.convite_id, 'usuario_id', e.usuario_id, 'tipo', e.tipo,
           'dados', e.dados, 'created_at', e.created_at) ORDER BY e.created_at DESC, e.id), '[]'::jsonb) INTO v_ev
    FROM (SELECT * FROM public.compras_cotacao_eventos WHERE cotacao_id = p_cotacao ORDER BY created_at DESC, id LIMIT 100) e;

  SELECT COALESCE(array_agg(DISTINCT material_id), '{}') INTO v_mats
    FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND material_id IS NOT NULL;
  v_ref := CASE WHEN cardinality(v_mats) > 0 THEN public.compras_precos_referencia(v_mats) ELSE '{}'::jsonb END;

  SELECT to_jsonb(d) || jsonb_build_object('itens', (SELECT COALESCE(jsonb_agg(to_jsonb(di)), '[]'::jsonb)
                                                         FROM public.compras_cotacao_decisao_itens di WHERE di.decisao_id = d.id))
    INTO v_dec FROM public.compras_cotacao_decisoes d WHERE d.cotacao_id = p_cotacao;

  RETURN jsonb_build_object('cotacao', to_jsonb(c), 'pedidos', v_ped,
                            'itens', public.compras_cotacao_itens_json(p_cotacao, false),
                            'convites', v_conv, 'respostas_atuais', v_resp, 'referencias', v_ref, 'eventos', v_ev, 'decisao', v_dec);
END $$;

CREATE OR REPLACE FUNCTION public.compras_cotacao_respostas_versoes(p_convite uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.compras_exigir_compras();
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'versao', r.versao, 'versao_lista', r.versao_lista, 'atual', r.atual, 'recusou', r.recusou,
           'prazo_entrega_dias', r.prazo_entrega_dias, 'frete_tipo', r.frete_tipo, 'frete_valor', r.frete_valor, 'observacao', r.observacao,
           'base_total', r.base_total, 'enviado_em', r.enviado_em,
           'itens', (SELECT COALESCE(jsonb_agg(jsonb_build_object('cotacao_item_id', ri.cotacao_item_id, 'tem_item', ri.tem_item,
                       'preco_unitario', ri.preco_unitario, 'quantidade_disponivel', ri.quantidade_disponivel, 'observacao', ri.observacao)), '[]'::jsonb)
                       FROM public.compras_cotacao_resposta_itens ri WHERE ri.resposta_id = r.id),
           'condicoes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', cc.id, 'tipo', cc.tipo, 'desconto_tipo', cc.desconto_tipo,
                       'desconto_valor', cc.desconto_valor, 'parcelas', cc.parcelas, 'entrada_valor', cc.entrada_valor,
                       'primeira_parcela_dias', cc.primeira_parcela_dias, 'total_informado', cc.total_informado,
                       'total_itens', cc.total_itens, 'valor_presente_itens', cc.valor_presente_itens) ORDER BY cc.tipo), '[]'::jsonb)
                       FROM public.compras_cotacao_resposta_condicoes cc WHERE cc.resposta_id = r.id)
         ) ORDER BY r.versao), '[]'::jsonb)
    FROM public.compras_cotacao_respostas r WHERE r.convite_id = p_convite);
END $$;

-- p_decisao: {modo:'unico'|'dividido'|'manual', segue_recomendacao, justificativa?,
--             itens:[{cotacao_item_id, convite_id, condicao_tipo:'a_vista'|'parcelado'}],
--             datas_disponibilidade:{<pedido_id>:'YYYY-MM-DD'}, recomendacao_snapshot?}
-- Retorno: {decisao_id, pedidos:[{pedido_id, status_compra, data_material_disponivel, etapa_chegada_id}]}
CREATE OR REPLACE FUNCTION public.compras_cotacao_decidir(p_cotacao uuid, p_decisao jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.compras_exigir_compras(); c public.compras_cotacoes; v_modo text; v_segue boolean; v_just text; v_snap jsonb; v_itens jsonb; v_datas jsonb;
  v_nlin int; v_dec uuid; v_n int; v_conv int; v_cond int; v_frete_nom numeric; v_tot_nom numeric; v_tot_vp numeric; v_tot_ref numeric;
  v_ref jsonb; v_mats uuid[]; v_vp_escolhido numeric; v_vp_min numeric; v_ped record; v_data date; v_res jsonb; v_pedidos jsonb := '[]'::jsonb;
  v_forn jsonb; v_desc text;
BEGIN
  SELECT * INTO c FROM public.compras_cotacoes WHERE id = p_cotacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF c.status <> 'aberta' THEN RAISE EXCEPTION 'Só cotações abertas podem ser decididas (status atual: %)', c.status; END IF;
  IF c.requer_revisao THEN RAISE EXCEPTION 'A lista mudou: revise a cotação antes de decidir'; END IF;
  IF p_decisao IS NULL OR jsonb_typeof(p_decisao) <> 'object' THEN RAISE EXCEPTION 'Informe a decisão'; END IF;

  v_modo := p_decisao ->> 'modo';
  IF v_modo IS NULL OR v_modo NOT IN ('unico', 'dividido', 'manual') THEN RAISE EXCEPTION 'Modo de decisão inválido'; END IF;
  v_segue := COALESCE((p_decisao ->> 'segue_recomendacao')::boolean, true);
  v_just := NULLIF(btrim(COALESCE(p_decisao ->> 'justificativa', '')), '');
  v_snap := p_decisao -> 'recomendacao_snapshot';
  IF v_snap IS NOT NULL AND pg_column_size(v_snap) > 200000 THEN RAISE EXCEPTION 'Snapshot da recomendação grande demais'; END IF;
  IF (v_modo = 'manual' OR NOT v_segue) AND (v_just IS NULL OR length(v_just) < 10) THEN
    RAISE EXCEPTION 'Informe a justificativa (mínimo 10 caracteres) para decidir fora da recomendação';
  END IF;
  v_itens := p_decisao -> 'itens'; v_datas := COALESCE(p_decisao -> 'datas_disponibilidade', '{}'::jsonb);
  IF jsonb_typeof(v_itens) <> 'array' THEN RAISE EXCEPTION 'Informe o fornecedor vencedor de cada item'; END IF;

  PERFORM 1 FROM public.execucao_pedidos_material p JOIN public.compras_cotacao_pedidos cp ON cp.pedido_id = p.id
    WHERE cp.cotacao_id = p_cotacao AND cp.ativa ORDER BY p.id FOR UPDATE OF p;
  IF NOT EXISTS (SELECT 1 FROM public.compras_cotacao_pedidos WHERE cotacao_id = p_cotacao AND ativa) THEN RAISE EXCEPTION 'A cotação não tem pedidos ativos'; END IF;
  IF EXISTS (SELECT 1 FROM public.compras_cotacao_pedidos cp JOIN public.execucao_pedidos_material p ON p.id = cp.pedido_id
              WHERE cp.cotacao_id = p_cotacao AND cp.ativa AND p.status_compra <> 'em_cotacao') THEN
    RAISE EXCEPTION 'Há pedido da cotação que não está em cotação (pode estar aguardando o solicitante ou cancelado)';
  END IF;
  SELECT count(*) INTO v_nlin FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo;
  IF v_nlin = 0 THEN RAISE EXCEPTION 'A cotação não tem itens ativos'; END IF;
  IF EXISTS (SELECT 1 FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo AND material_id IS NULL) THEN
    RAISE EXCEPTION 'Confirme o material de todos os itens antes de decidir';
  END IF;

  BEGIN
    SELECT count(DISTINCT e ->> 'cotacao_item_id') INTO v_n FROM jsonb_array_elements(v_itens) e;
    IF v_n <> v_nlin OR jsonb_array_length(v_itens) <> v_nlin THEN
      RAISE EXCEPTION 'Escolha exatamente um fornecedor para cada item ativo (esperado %, recebido %)', v_nlin, jsonb_array_length(v_itens);
    END IF;

    INSERT INTO public.compras_cotacao_decisoes (cotacao_id, modo, segue_recomendacao, justificativa, recomendacao_snapshot, decidido_por)
    VALUES (p_cotacao, v_modo, v_segue, v_just, v_snap, v_uid) RETURNING id INTO v_dec;

    -- escolhas validadas contra a RESPOSTA ATUAL; preços recalculados no servidor (mesma função SQL do envio)
    INSERT INTO public.compras_cotacao_decisao_itens
      (decisao_id, cotacao_item_id, convite_id, condicao_id, fornecedor_id, quantidade, preco_unitario_base, preco_unitario_nominal, preco_unitario_vp)
    SELECT v_dec, ci.id, cv.id, cc.id, cv.fornecedor_id, ci.quantidade, ri.preco_unitario,
           round(ri.preco_unitario * t.total / NULLIF(r.base_total, 0), 4), round(ri.preco_unitario * t.vp / NULLIF(r.base_total, 0), 4)
      FROM jsonb_array_elements(v_itens) e
      JOIN public.compras_cotacao_itens ci ON ci.id = (e ->> 'cotacao_item_id')::uuid AND ci.cotacao_id = p_cotacao AND ci.ativo
      JOIN public.compras_cotacao_convites cv ON cv.id = (e ->> 'convite_id')::uuid AND cv.cotacao_id = p_cotacao
      JOIN public.compras_cotacao_respostas r ON r.convite_id = cv.id AND r.atual AND NOT r.recusou
      JOIN public.compras_cotacao_resposta_itens ri ON ri.resposta_id = r.id AND ri.cotacao_item_id = ci.id AND ri.tem_item
           AND (ri.quantidade_disponivel IS NULL OR ri.quantidade_disponivel >= ci.quantidade)
      JOIN public.compras_cotacao_resposta_condicoes cc ON cc.resposta_id = r.id AND cc.tipo = e ->> 'condicao_tipo'
      CROSS JOIN LATERAL public.compras_condicao_totais(r.base_total, cc.tipo, cc.desconto_tipo, cc.desconto_valor, cc.parcelas,
                                                       cc.entrada_valor, cc.primeira_parcela_dias, cc.total_informado, c.taxa_mensal) t
     WHERE ci.versao_alterada IS NULL OR ci.versao_alterada <= r.versao_lista;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> v_nlin THEN
      RAISE EXCEPTION 'Alguma escolha é inválida: o fornecedor precisa ter respondido o item (com quantidade suficiente) na versão atual da lista e na condição escolhida';
    END IF;
  EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN
    RAISE EXCEPTION 'Escolhas inválidas: identificadores mal formados';
  END;

  SELECT count(DISTINCT convite_id), count(DISTINCT condicao_id) INTO v_conv, v_cond FROM public.compras_cotacao_decisao_itens WHERE decisao_id = v_dec;
  IF v_modo = 'unico' AND (v_conv > 1 OR v_cond > 1) THEN
    RAISE EXCEPTION 'No modo único, todos os itens devem ser do mesmo fornecedor e da mesma condição';
  END IF;

  -- fretes dos fornecedores efetivamente usados (N1: pago no instante zero, nominal)
  SELECT COALESCE(sum(CASE WHEN r.frete_tipo = 'valor' THEN r.frete_valor ELSE 0 END), 0) INTO v_frete_nom
    FROM public.compras_cotacao_respostas r
   WHERE r.atual AND r.convite_id IN (SELECT DISTINCT convite_id FROM public.compras_cotacao_decisao_itens WHERE decisao_id = v_dec);
  SELECT round(COALESCE(sum(preco_unitario_nominal * quantidade), 0) + v_frete_nom, 2), round(COALESCE(sum(preco_unitario_vp * quantidade), 0) + v_frete_nom, 2)
    INTO v_tot_nom, v_tot_vp FROM public.compras_cotacao_decisao_itens WHERE decisao_id = v_dec;

  -- verificação de recomendação (modo único): existe proposta completa com VP total menor que VP_escolhido × (1 − empate_pct)?
  IF v_modo = 'unico' THEN
    SELECT cc.valor_presente_itens + CASE WHEN r.frete_tipo = 'valor' THEN r.frete_valor ELSE 0 END INTO v_vp_escolhido
      FROM public.compras_cotacao_decisao_itens di JOIN public.compras_cotacao_resposta_condicoes cc ON cc.id = di.condicao_id
      JOIN public.compras_cotacao_respostas r ON r.id = cc.resposta_id WHERE di.decisao_id = v_dec LIMIT 1;
    SELECT min(cc.valor_presente_itens + CASE WHEN r.frete_tipo = 'valor' THEN r.frete_valor ELSE 0 END) INTO v_vp_min
      FROM public.compras_cotacao_respostas r JOIN public.compras_cotacao_resposta_condicoes cc ON cc.resposta_id = r.id
     WHERE r.cotacao_id = p_cotacao AND r.atual AND NOT r.recusou AND cc.valor_presente_itens IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.compras_cotacao_itens ci
                        WHERE ci.cotacao_id = p_cotacao AND ci.ativo
                          AND NOT EXISTS (SELECT 1 FROM public.compras_cotacao_resposta_itens ri
                                           WHERE ri.resposta_id = r.id AND ri.cotacao_item_id = ci.id AND ri.tem_item
                                             AND (ri.quantidade_disponivel IS NULL OR ri.quantidade_disponivel >= ci.quantidade)
                                             AND (ci.versao_alterada IS NULL OR ci.versao_alterada <= r.versao_lista)));
    IF v_vp_min IS NOT NULL AND v_vp_escolhido IS NOT NULL AND v_vp_min < v_vp_escolhido * (1 - COALESCE(c.empate_pct, 0))
       AND (v_just IS NULL OR length(v_just) < 10) THEN
      RAISE EXCEPTION 'Existe proposta completa mais barata que a escolhida: informe a justificativa (mínimo 10 caracteres)';
    END IF;
  END IF;

  -- referência de preço (ANTES de gravar o histórico desta compra)
  SELECT COALESCE(array_agg(DISTINCT material_id), '{}') INTO v_mats FROM public.compras_cotacao_itens WHERE cotacao_id = p_cotacao AND ativo;
  v_ref := public.compras_precos_referencia(v_mats);
  SELECT sum((v_ref -> ci.material_id::text ->> 'media_janela')::numeric * ci.quantidade) INTO v_tot_ref
    FROM public.compras_cotacao_decisao_itens di JOIN public.compras_cotacao_itens ci ON ci.id = di.cotacao_item_id
   WHERE di.decisao_id = v_dec AND (v_ref -> ci.material_id::text ->> 'media_janela') IS NOT NULL;
  UPDATE public.compras_cotacao_decisoes SET total_nominal = v_tot_nom, total_vp = v_tot_vp, total_referencia = round(v_tot_ref, 2) WHERE id = v_dec;

  -- histórico de preços: comprado (1 por linha decidida)
  INSERT INTO public.compras_precos_historico
    (material_id, fornecedor_id, cotacao_id, cotacao_item_id, resposta_id, tipo, condicao, parcelas, unidade, quantidade,
     preco_unitario_nominal, preco_unitario_vp, pedido_ids)
  SELECT ci.material_id, di.fornecedor_id, p_cotacao, ci.id, cc.resposta_id, 'comprado', cc.tipo, cc.parcelas,
         public.compras_normalizar_unidade(ci.unidade), di.quantidade, di.preco_unitario_nominal, di.preco_unitario_vp,
         (SELECT array_agg(DISTINCT io.pedido_id) FROM public.compras_cotacao_item_origens io WHERE io.cotacao_item_id = ci.id)
    FROM public.compras_cotacao_decisao_itens di JOIN public.compras_cotacao_itens ci ON ci.id = di.cotacao_item_id
    JOIN public.compras_cotacao_resposta_condicoes cc ON cc.id = di.condicao_id
   WHERE di.decisao_id = v_dec;
  -- cotado: 1 por linha × resposta atual com tem_item, na condição de menor VP da resposta
  INSERT INTO public.compras_precos_historico
    (material_id, fornecedor_id, cotacao_id, cotacao_item_id, resposta_id, tipo, condicao, parcelas, unidade, quantidade,
     preco_unitario_nominal, preco_unitario_vp, pedido_ids)
  SELECT ci.material_id, cv.fornecedor_id, p_cotacao, ci.id, r.id, 'cotado', best.tipo, best.parcelas,
         public.compras_normalizar_unidade(ci.unidade), ci.quantidade,
         round(ri.preco_unitario * best.total / NULLIF(r.base_total, 0), 4), round(ri.preco_unitario * best.vp / NULLIF(r.base_total, 0), 4),
         (SELECT array_agg(DISTINCT io.pedido_id) FROM public.compras_cotacao_item_origens io WHERE io.cotacao_item_id = ci.id)
    FROM public.compras_cotacao_respostas r
    JOIN public.compras_cotacao_convites cv ON cv.id = r.convite_id
    JOIN public.compras_cotacao_resposta_itens ri ON ri.resposta_id = r.id AND ri.tem_item
    JOIN public.compras_cotacao_itens ci ON ci.id = ri.cotacao_item_id AND ci.ativo
    CROSS JOIN LATERAL (SELECT cc.tipo, cc.parcelas, t.total, t.vp
                          FROM public.compras_cotacao_resposta_condicoes cc
                          CROSS JOIN LATERAL public.compras_condicao_totais(r.base_total, cc.tipo, cc.desconto_tipo, cc.desconto_valor, cc.parcelas,
                                               cc.entrada_valor, cc.primeira_parcela_dias, cc.total_informado, c.taxa_mensal) t
                         WHERE cc.resposta_id = r.id ORDER BY t.vp ASC, cc.tipo ASC LIMIT 1) best
   WHERE r.cotacao_id = p_cotacao AND r.atual AND NOT r.recusou AND (ci.versao_alterada IS NULL OR ci.versao_alterada <= r.versao_lista);

  -- pedidos → comprado (via compras_alterar_status, com a flag que libera a transição) + histórico sem preços (N5)
  PERFORM set_config('compras.cotacao_rpc', '1', true);
  FOR v_ped IN SELECT cp.pedido_id FROM public.compras_cotacao_pedidos cp WHERE cp.cotacao_id = p_cotacao AND cp.ativa ORDER BY cp.pedido_id LOOP
    BEGIN
      v_data := NULLIF(v_datas ->> v_ped.pedido_id::text, '')::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Data de disponibilidade inválida para um dos pedidos';
    END;
    IF v_data IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade de todos os pedidos da cotação'; END IF;

    v_res := public.compras_alterar_status(v_ped.pedido_id, 'comprado', format('Cotação nº %s', c.numero), v_data);

    SELECT COALESCE(jsonb_agg(jsonb_build_object('empresa', x.empresa, 'itens', x.ids) ORDER BY x.empresa), '[]'::jsonb),
           string_agg(format('%s (%s %s)', x.empresa, jsonb_array_length(x.ids), CASE WHEN jsonb_array_length(x.ids) = 1 THEN 'item' ELSE 'itens' END), ', ' ORDER BY x.empresa)
      INTO v_forn, v_desc
      FROM (SELECT fo.empresa, jsonb_agg(io.item_id ORDER BY io.item_id) AS ids
              FROM public.compras_cotacao_decisao_itens di JOIN public.compras_fornecedores fo ON fo.id = di.fornecedor_id
              JOIN public.compras_cotacao_item_origens io ON io.cotacao_item_id = di.cotacao_item_id AND io.pedido_id = v_ped.pedido_id
             WHERE di.decisao_id = v_dec GROUP BY fo.empresa) x;
    PERFORM public.execucao_compras_historico(v_ped.pedido_id, v_uid, 'cotacao', format('Cotação nº %s decidida: %s', c.numero, COALESCE(v_desc, '')),
      NULL, jsonb_build_object('cotacao_id', p_cotacao, 'fornecedores', v_forn));
    v_pedidos := v_pedidos || jsonb_build_object('pedido_id', v_ped.pedido_id, 'status_compra', v_res ->> 'status_compra',
                                                 'data_material_disponivel', v_res ->> 'data_material_disponivel',
                                                 'etapa_chegada_id', v_res ->> 'etapa_chegada_id');
  END LOOP;
  PERFORM set_config('compras.cotacao_rpc', '', true);

  UPDATE public.compras_cotacao_pedidos SET ativa = false, removido_em = now(), motivo_remocao = 'Cotação decidida' WHERE cotacao_id = p_cotacao AND ativa;
  UPDATE public.compras_cotacao_tokens SET revogado_em = now(), motivo_revogacao = 'cotacao_encerrada'
   WHERE revogado_em IS NULL AND convite_id IN (SELECT id FROM public.compras_cotacao_convites WHERE cotacao_id = p_cotacao);
  UPDATE public.compras_cotacoes SET status = 'encerrada', encerrada_em = now(), encerrada_por = v_uid, updated_at = now() WHERE id = p_cotacao;
  PERFORM public.compras_cotacao_evento(p_cotacao, NULL, v_uid, 'decidida', jsonb_build_object('decisao_id', v_dec, 'modo', v_modo, 'segue_recomendacao', v_segue));
  RETURN jsonb_build_object('decisao_id', v_dec, 'pedidos', v_pedidos);
END $$;

-- =====================================================================================================================
-- Preços e alertas
-- =====================================================================================================================
-- Retorno: {<material_id>: {ultimo:{preco_vp, preco_nominal, data, quantidade, fornecedor}, media_janela, n_janela, menor:{preco_vp, data}, fora_janela, n_total}}
-- Só tipo='comprado'. media_janela = média simples do VP unitário nos últimos janela_referencia_meses; se n_janela=0 usa a média das últimas
-- fallback_ultimas_compras (fora_janela=true). "menor" = menor VP unitário de todo o histórico de compras do material.
CREATE OR REPLACE FUNCTION public.compras_precos_referencia(p_materiais uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg public.compras_config; v_res jsonb;
BEGIN
  PERFORM public.compras_exigir_compras();
  IF p_materiais IS NULL OR cardinality(p_materiais) = 0 THEN RETURN '{}'::jsonb; END IF;
  IF cardinality(p_materiais) > 500 THEN RAISE EXCEPTION 'Informe no máximo 500 materiais'; END IF;
  SELECT * INTO cfg FROM public.compras_config WHERE id = 1;
  WITH h AS (
    SELECT ph.material_id, ph.preco_unitario_vp, ph.preco_unitario_nominal, ph.quantidade, ph.registrado_em, fo.empresa,
           row_number() OVER (PARTITION BY ph.material_id ORDER BY ph.registrado_em DESC, ph.id) AS rn
      FROM public.compras_precos_historico ph LEFT JOIN public.compras_fornecedores fo ON fo.id = ph.fornecedor_id
     WHERE ph.tipo = 'comprado' AND ph.material_id = ANY (p_materiais) AND ph.preco_unitario_vp IS NOT NULL
  ), a AS (
    SELECT h.material_id, count(*) AS n_total,
           count(*) FILTER (WHERE h.registrado_em >= now() - make_interval(months => cfg.janela_referencia_meses)) AS n_janela,
           avg(h.preco_unitario_vp) FILTER (WHERE h.registrado_em >= now() - make_interval(months => cfg.janela_referencia_meses)) AS media_j,
           avg(h.preco_unitario_vp) FILTER (WHERE h.rn <= cfg.fallback_ultimas_compras) AS media_fb,
           min(h.preco_unitario_vp) AS menor,
           (array_agg(h.registrado_em ORDER BY h.preco_unitario_vp ASC, h.registrado_em DESC))[1] AS menor_data
      FROM h GROUP BY h.material_id
  )
  SELECT COALESCE(jsonb_object_agg(a.material_id::text, jsonb_build_object(
           'ultimo', jsonb_build_object('preco_vp', u.preco_unitario_vp, 'preco_nominal', u.preco_unitario_nominal, 'data', u.registrado_em,
                                        'quantidade', u.quantidade, 'fornecedor', u.empresa),
           'media_janela', round(CASE WHEN a.n_janela > 0 THEN a.media_j ELSE a.media_fb END, 4),
           'n_janela', a.n_janela,
           'menor', jsonb_build_object('preco_vp', a.menor, 'data', a.menor_data),
           'fora_janela', a.n_janela = 0,
           'n_total', a.n_total)), '{}'::jsonb)
    INTO v_res FROM a JOIN h u ON u.material_id = a.material_id AND u.rn = 1;
  RETURN v_res;
END $$;

-- Lista (comprado e cotado) mais recentes do material, com fornecedor e nº da cotação
CREATE OR REPLACE FUNCTION public.compras_material_historico(p_material uuid, p_limite int DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.compras_exigir_compras();
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', t.id, 'tipo', t.tipo, 'condicao', t.condicao, 'parcelas', t.parcelas, 'unidade', t.unidade, 'quantidade', t.quantidade,
            'preco_unitario_nominal', t.preco_unitario_nominal, 'preco_unitario_vp', t.preco_unitario_vp, 'registrado_em', t.registrado_em,
            'fornecedor_id', t.fornecedor_id, 'fornecedor', t.empresa, 'cotacao_id', t.cotacao_id, 'cotacao_numero', t.numero)
            ORDER BY t.registrado_em DESC, t.id), '[]'::jsonb)
            FROM (SELECT ph.*, fo.empresa, c.numero FROM public.compras_precos_historico ph
                    LEFT JOIN public.compras_fornecedores fo ON fo.id = ph.fornecedor_id
                    LEFT JOIN public.compras_cotacoes c ON c.id = ph.cotacao_id
                   WHERE ph.material_id = p_material ORDER BY ph.registrado_em DESC, ph.id
                   LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 500)) t);
END $$;

-- Idempotente (throttle de 10 min). Retorno: {aceites_alertados, cotacoes_vencendo, rate_limit_limpos}.
-- Chamável também pelo pg_cron (sessão postgres, sem usuário).
CREATE OR REPLACE FUNCTION public.compras_verificar_alertas() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id(); v_ace int := 0; v_cot int := 0; v_rl int := 0; r record; v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  ELSIF NOT public.is_compras() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.compras_config SET alertas_ultima_execucao = now()
   WHERE id = 1 AND (alertas_ultima_execucao IS NULL OR alertas_ultima_execucao < now() - interval '10 minutes')
  RETURNING true INTO v_ok;
  IF v_ok IS NULL THEN RETURN jsonb_build_object('aceites_alertados', 0, 'cotacoes_vencendo', 0, 'rate_limit_limpos', 0); END IF;

  -- (a) aceites vencidos (colunas da mig. 38; só executa se já existirem)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'execucao_pedidos_questionamentos'
                AND column_name IN ('origem', 'prazo_resposta_em', 'alerta_enviado_em') HAVING count(*) = 3) THEN
    FOR r IN SELECT q.id, q.pedido_id, q.criado_por, p.cliente_nome, p.atividade_id, p.descricao
               FROM public.execucao_pedidos_questionamentos q JOIN public.execucao_pedidos_material p ON p.id = q.pedido_id
              WHERE q.origem = 'alteracao_compras' AND q.status = 'aberto' AND q.prazo_resposta_em < now() AND q.alerta_enviado_em IS NULL
              ORDER BY q.created_at LIMIT 200 LOOP
      IF r.criado_por IS NOT NULL THEN
        INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
        VALUES ('compra_questionamento', '⏰ Aceite do solicitante pendente',
                left(format('%s%s: o solicitante ainda não respondeu à alteração da lista', COALESCE(r.cliente_nome || ' — ', ''), COALESCE(r.descricao, 'Pedido')), 500),
                r.atividade_id, r.criado_por, NULL, jsonb_build_object('pedido_id', r.pedido_id, 'questionamento_id', r.id));
      END IF;
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
      VALUES ('compra_questionamento', '⏰ Aceite do solicitante pendente',
              left(format('%s%s: alteração da Compras aguarda resposta há mais de 24 h úteis', COALESCE(r.cliente_nome || ' — ', ''), COALESCE(r.descricao, 'Pedido')), 500),
              r.atividade_id, NULL, NULL, jsonb_build_object('pedido_id', r.pedido_id, 'questionamento_id', r.id));
      UPDATE public.execucao_pedidos_questionamentos SET alerta_enviado_em = now() WHERE id = r.id;
      v_ace := v_ace + 1;
    END LOOP;
  END IF;

  -- (b) cotações abertas com prazo em < 24 h e nenhuma resposta (1 alerta por cotação)
  FOR r IN SELECT c.id, c.numero, c.criado_por FROM public.compras_cotacoes c
            WHERE c.status = 'aberta' AND c.prazo_resposta > now() AND c.prazo_resposta < now() + interval '24 hours'
              AND NOT EXISTS (SELECT 1 FROM public.compras_cotacao_respostas rp WHERE rp.cotacao_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM public.compras_cotacao_eventos e WHERE e.cotacao_id = c.id AND e.tipo = 'alerta_vencendo')
            ORDER BY c.prazo_resposta LIMIT 200 LOOP
    IF r.criado_por IS NOT NULL THEN
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
      VALUES ('compra_cotacao', '⏰ Cotação vencendo sem respostas', left(format('A cotação nº %s vence em menos de 24 h e ainda não recebeu respostas', r.numero), 500),
              NULL, r.criado_por, NULL, jsonb_build_object('cotacao_id', r.id));
    END IF;
    PERFORM public.compras_cotacao_evento(r.id, NULL, NULL, 'alerta_vencendo', NULL);
    v_cot := v_cot + 1;
  END LOOP;

  -- (c) rate limit antigo; (d) IP bruto com mais de 12 meses (LGPD)
  DELETE FROM public.compras_rate_limit WHERE janela < now() - interval '2 days';
  GET DIAGNOSTICS v_rl = ROW_COUNT;
  UPDATE public.compras_cotacao_eventos SET ip = NULL WHERE ip IS NOT NULL AND created_at < now() - interval '12 months';

  RETURN jsonb_build_object('aceites_alertados', v_ace, 'cotacoes_vencendo', v_cot, 'rate_limit_limpos', v_rl);
END $$;

-- =====================================================================================================================
-- Reescrita: compras_alterar_status (25 + 33 + bloqueios/remoção de cotação)
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_alterar_status(p_pedido uuid, p_status text, p_obs text DEFAULT NULL, p_data_disponibilidade date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); v_p public.execucao_pedidos_material;
  v_obs text := NULLIF(btrim(COALESCE(p_obs, '')), ''); v_ok boolean; v_data date; v_disp jsonb := '{}'::jsonb;
  v_cot_num bigint; v_cot record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_status NOT IN ('aguardando_compra', 'em_cotacao', 'comprado', 'entregue_parcial', 'entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Status inválido (aguardando_solicitante é automático e não pode ser definido manualmente)';
  END IF;

  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra = p_status THEN
    RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', v_p.status_compra, 'data_material_disponivel', v_p.data_material_disponivel);
  END IF;

  v_ok := CASE v_p.status_compra
            WHEN 'aguardando_compra' THEN p_status IN ('em_cotacao', 'cancelado')
            WHEN 'em_cotacao' THEN p_status IN ('aguardando_compra', 'comprado', 'cancelado')
            WHEN 'aguardando_solicitante' THEN p_status IN ('cancelado')
            WHEN 'comprado' THEN p_status IN ('entregue_parcial', 'entregue', 'cancelado')
            WHEN 'entregue_parcial' THEN p_status IN ('entregue', 'cancelado')
            ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transição não permitida: % → %', v_p.status_compra, p_status; END IF;

  -- Cotação ativa: só as RPCs de cotação (flag de sessão) movem em_cotacao para aguardando_compra/comprado
  IF v_p.status_compra = 'em_cotacao' AND p_status IN ('aguardando_compra', 'comprado')
     AND COALESCE(current_setting('compras.cotacao_rpc', true), '') <> '1' THEN
    SELECT c.numero INTO v_cot_num FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
     WHERE cp.pedido_id = p_pedido AND cp.ativa LIMIT 1;
    IF v_cot_num IS NOT NULL THEN
      IF p_status = 'aguardando_compra' THEN RAISE EXCEPTION 'Pedido está na cotação nº %: remova-o da cotação', v_cot_num;
      ELSE RAISE EXCEPTION 'Decida pela cotação nº %', v_cot_num; END IF;
    END IF;
  END IF;

  IF p_status = 'cancelado' AND (v_obs IS NULL OR length(v_obs) < 3) THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  IF p_status = 'entregue_parcial' AND (v_obs IS NULL OR length(v_obs) < 3) THEN RAISE EXCEPTION 'Informe o que ainda falta entregar'; END IF;
  IF p_status = 'em_cotacao' AND v_p.status_compra = 'aguardando_compra'
     AND NOT (public.execucao_pedido_tem_itens(v_p.itens) OR v_p.atividade_id IS NOT NULL) THEN
    RAISE EXCEPTION 'O pedido ainda não tem itens preenchidos';
  END IF;
  IF p_status = 'comprado' THEN
    v_data := COALESCE(p_data_disponibilidade, v_p.data_material_disponivel);
    IF v_data IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade para marcar como comprado'; END IF;
  END IF;

  IF p_status = 'cancelado' THEN  -- fecha questionamentos abertos
    UPDATE public.execucao_pedidos_questionamentos
       SET status = 'cancelado', resposta_observacao = 'Pedido cancelado', respondido_por = v_uid, respondido_em = now(), updated_at = now()
     WHERE pedido_id = p_pedido AND status = 'aberto';
    -- e tira o pedido da cotação ativa (sem reverter o status: ele vai para cancelado logo abaixo)
    FOR v_cot IN SELECT cp.cotacao_id FROM public.compras_cotacao_pedidos cp WHERE cp.pedido_id = p_pedido AND cp.ativa LOOP
      PERFORM public.compras_cotacao_liberar_pedido(v_cot.cotacao_id, p_pedido, 'Pedido cancelado', v_uid, false);
      PERFORM public.compras_cotacao_apos_remocao(v_cot.cotacao_id, v_uid);
    END LOOP;
  END IF;

  UPDATE public.execucao_pedidos_material SET
    status_compra = p_status, status_compra_anterior = NULL, status_compra_em = now(), updated_at = now(),
    comprador_id = CASE WHEN p_status IN ('em_cotacao', 'comprado') THEN COALESCE(comprador_id, v_uid) ELSE comprador_id END,
    fila_compras_em = CASE WHEN p_status <> 'cancelado' THEN COALESCE(fila_compras_em, now()) ELSE fila_compras_em END,
    comprado_em = CASE WHEN p_status = 'comprado' THEN now() ELSE comprado_em END,
    -- D6: o status legado acompanha entregue/cancelado (trg_avisar_material continua avisando os técnicos)
    status = CASE WHEN p_status = 'entregue' THEN 'entregue' WHEN p_status = 'cancelado' THEN 'cancelado' ELSE status END,
    data_entrega = CASE WHEN p_status = 'entregue' THEN COALESCE(data_entrega, now()) ELSE data_entrega END
  WHERE id = p_pedido;

  IF p_status = 'comprado' THEN v_disp := public.execucao_compras_aplicar_disponibilidade(p_pedido, v_data, v_uid); END IF;

  PERFORM public.execucao_compras_historico(p_pedido, v_uid, 'compra_status',
    format('Status de compra: %s → %s', v_p.status_compra, p_status),
    jsonb_build_object('status_compra', v_p.status_compra), jsonb_build_object('status_compra', p_status), v_obs);

  IF p_status IN ('comprado', 'entregue_parcial', 'entregue', 'cancelado') THEN
    PERFORM public.execucao_compras_notificar_solicitante(p_pedido, 'compra_status',
      CASE p_status WHEN 'comprado' THEN '🛒 Pedido comprado' WHEN 'entregue_parcial' THEN '📦 Entrega parcial'
                    WHEN 'entregue' THEN '✅ Pedido entregue' ELSE '🚫 Pedido cancelado' END,
      format('%s%s%s', COALESCE(v_p.cliente_nome || ' — ', ''), COALESCE(v_p.descricao, 'Pedido de material'),
             CASE WHEN v_obs IS NOT NULL THEN ' · ' || v_obs ELSE '' END),
      jsonb_build_object('pedido_id', p_pedido), v_uid);
  END IF;

  RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', p_status,
                            'data_material_disponivel', COALESCE(v_data, v_p.data_material_disponivel)) || v_disp;
END $$;

-- =====================================================================================================================
-- Reescrita: compras_listar_pedidos (26) + cotacao_ativa e filtro sem_cotacao. Retorno muda → DROP + CREATE + GRANT.
-- =====================================================================================================================
DROP FUNCTION IF EXISTS public.compras_listar_pedidos(jsonb, int, jsonb);
CREATE FUNCTION public.compras_listar_pedidos(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite int DEFAULT 50, p_cursor jsonb DEFAULT NULL)
RETURNS TABLE (
  id uuid, created_at timestamptz, updated_at timestamptz, descricao text, urgencia text, status text, status_compra text,
  status_compra_em timestamptz, comprado_em timestamptz, fila_compras_em timestamptz, observacoes text,
  cliente_nome text, endereco_obra text, obra_id uuid, obra_status text, obra_cancelada boolean,
  atividade_id uuid, atividade_titulo text, solicitante_id uuid, solicitante_nome text, comprador_id uuid, comprador_nome text,
  data_lista_pronta date, data_material_disponivel date, data_entrega timestamptz, etapa_chegada_id uuid,
  itens jsonb, qtd_itens int, qtd_questionamentos_abertos int, sem_itens boolean, atrasado boolean,
  cotacao_ativa jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f jsonb := COALESCE(p_filtros, '{}'::jsonb);
  v_lim int := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
  v_de date := NULLIF(f ->> 'de', '')::date;
  v_ate date := NULLIF(f ->> 'ate', '')::date;
  v_evento boolean := COALESCE(f ->> 'campo_data', 'pedido') = 'evento';
  v_status text[] := CASE WHEN jsonb_typeof(f -> 'status_compra') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(f -> 'status_compra')) END;
  v_urg text[] := CASE WHEN jsonb_typeof(f -> 'urgencia') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(f -> 'urgencia')) END;
  v_busca text := NULLIF(btrim(COALESCE(f ->> 'busca', '')), '');
  v_sol uuid := NULLIF(f ->> 'solicitante_id', '')::uuid;
  v_comp uuid := NULLIF(f ->> 'comprador_id', '')::uuid;
  v_pedido uuid := NULLIF(f ->> 'pedido_id', '')::uuid;
  v_quest boolean := COALESCE((f ->> 'com_questionamento_aberto')::boolean, false);
  v_semcot boolean := COALESCE((f ->> 'sem_cotacao')::boolean, false);
  v_cur_t timestamptz := NULLIF(p_cursor ->> 'created_at', '')::timestamptz;
  v_cur_id uuid := NULLIF(p_cursor ->> 'id', '')::uuid;
  v_ini timestamptz; v_fim timestamptz; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  v_ini := CASE WHEN v_de IS NOT NULL THEN v_de::timestamp AT TIME ZONE 'America/Sao_Paulo' END;
  v_fim := CASE WHEN v_ate IS NOT NULL THEN (v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo' END;
  IF v_busca IS NOT NULL THEN
    v_busca := '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  RETURN QUERY
  SELECT p.id, p.created_at, p.updated_at, p.descricao, p.urgencia::text, p.status::text, p.status_compra,
         p.status_compra_em, p.comprado_em, p.fila_compras_em, p.observacoes,
         p.cliente_nome::text, p.endereco_obra, p.obra_id, o.status::text, COALESCE(o.status = 'cancelada', false),
         p.atividade_id, at.titulo::text, p.solicitante_id, us.nome_completo::text, p.comprador_id, uc.nome_completo::text,
         p.data_lista_pronta, p.data_material_disponivel, p.data_entrega, p.etapa_chegada_id,
         p.itens,
         (SELECT count(*)::int FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.itens) = 'array' THEN p.itens ELSE '[]'::jsonb END) e
           WHERE jsonb_typeof(e) = 'object' AND btrim(COALESCE(e ->> 'nome', '')) <> ''),
         (SELECT count(*)::int FROM public.execucao_pedidos_questionamentos q WHERE q.pedido_id = p.id AND q.status = 'aberto'),
         NOT public.execucao_pedido_tem_itens(p.itens),
         (p.data_material_disponivel IS NOT NULL AND p.data_material_disponivel < v_hoje AND p.status_compra NOT IN ('entregue', 'cancelado')),
         (SELECT jsonb_build_object('id', c.id, 'numero', c.numero, 'status', c.status)
            FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
           WHERE cp.pedido_id = p.id AND cp.ativa LIMIT 1)
    FROM public.execucao_pedidos_material p
    LEFT JOIN public.execucao_obras o ON o.id = p.obra_id
    LEFT JOIN public.execucao_atividades at ON at.id = p.atividade_id
    LEFT JOIN public.usuarios us ON us.id = p.solicitante_id
    LEFT JOIN public.usuarios uc ON uc.id = p.comprador_id
   WHERE (public.execucao_pedido_tem_itens(p.itens) OR p.atividade_id IS NOT NULL)            -- N1-n: fora, listas de obra vazias
     AND (CASE WHEN v_status IS NULL OR cardinality(v_status) = 0 THEN p.status_compra <> 'cancelado'
               ELSE p.status_compra = ANY (v_status) END)
     AND (v_urg IS NULL OR cardinality(v_urg) = 0 OR p.urgencia = ANY (v_urg))
     AND (v_ini IS NULL OR (CASE WHEN v_evento THEN COALESCE(p.status_compra_em, p.updated_at) ELSE p.created_at END) >= v_ini)
     AND (v_fim IS NULL OR (CASE WHEN v_evento THEN COALESCE(p.status_compra_em, p.updated_at) ELSE p.created_at END) < v_fim)
     AND (v_sol IS NULL OR p.solicitante_id = v_sol)
     AND (v_comp IS NULL OR p.comprador_id = v_comp)
     AND (v_pedido IS NULL OR p.id = v_pedido)
     AND (NOT v_quest OR EXISTS (SELECT 1 FROM public.execucao_pedidos_questionamentos q WHERE q.pedido_id = p.id AND q.status = 'aberto'))
     AND (NOT v_semcot OR NOT EXISTS (SELECT 1 FROM public.compras_cotacao_pedidos cp WHERE cp.pedido_id = p.id AND cp.ativa))
     AND (v_busca IS NULL OR p.descricao ILIKE v_busca OR p.cliente_nome ILIKE v_busca OR p.itens::text ILIKE v_busca)
     AND (v_cur_t IS NULL OR p.created_at < v_cur_t OR (p.created_at = v_cur_t AND p.id > v_cur_id))
   ORDER BY p.created_at DESC, p.id ASC
   LIMIT v_lim;
END $$;
REVOKE ALL ON FUNCTION public.compras_listar_pedidos(jsonb, int, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_listar_pedidos(jsonb, int, jsonb) TO authenticated;

-- =====================================================================================================================
-- Reescrita: compras_detalhe_pedido (28) + cotacoes
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public.compras_detalhe_pedido(p_pedido uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido jsonb; v_hist jsonb; v_quest jsonb; v_cots jsonb;
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT to_jsonb(r) INTO v_pedido
    FROM public.compras_listar_pedidos(
           jsonb_build_object('pedido_id', p_pedido,
                              'status_compra', jsonb_build_array('aguardando_compra', 'em_cotacao', 'aguardando_solicitante',
                                                                  'comprado', 'entregue_parcial', 'entregue', 'cancelado')),
           1, NULL) r;
  IF v_pedido IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado ou fora da fila de Compras'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', h.id, 'tipo_alteracao', h.tipo_alteracao, 'descricao', h.descricao,
           'usuario_id', h.usuario_id, 'usuario_nome', COALESCE(h.usuario_nome, u.nome_completo),
           'data_alteracao', h.data_alteracao, 'dados_anteriores', h.dados_anteriores, 'dados_novos', h.dados_novos,
           'data_limite_anterior', h.data_limite_anterior, 'data_limite_nova', h.data_limite_nova, 'motivo', h.motivo)
         ORDER BY h.data_alteracao DESC, h.id), '[]'::jsonb)
    INTO v_hist
    FROM public.execucao_historico_pedidos h LEFT JOIN public.usuarios u ON u.id = h.usuario_id
   WHERE h.pedido_id = p_pedido;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at, q.id), '[]'::jsonb)
    INTO v_quest FROM public.compras_listar_questionamentos(p_pedido, NULL) q;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero, 'status', c.status, 'ativa', cp.ativa) ORDER BY c.created_at DESC, c.id), '[]'::jsonb)
    INTO v_cots FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id WHERE cp.pedido_id = p_pedido;

  RETURN jsonb_build_object('pedido', v_pedido, 'historico', v_hist, 'questionamentos', v_quest, 'cotacoes', v_cots);
END $$;

-- =====================================================================================================================
-- Permissões das RPCs autenticadas (anon NUNCA)
-- =====================================================================================================================
REVOKE ALL ON FUNCTION public.compras_cotacao_criar(uuid[], text, text), public.compras_cotacao_montar_itens(uuid, jsonb),
  public.compras_cotacao_incluir_pedidos(uuid, uuid[]), public.compras_cotacao_remover_pedido(uuid, uuid, text),
  public.compras_cotacao_definir_fornecedores(uuid, uuid[]), public.compras_cotacao_abrir(uuid, timestamptz, text),
  public.compras_cotacao_gerar_link(uuid, text), public.compras_cotacao_registrar_envio(uuid, text, boolean),
  public.compras_cotacao_prorrogar(uuid, timestamptz, text), public.compras_cotacao_revisar(uuid, text, timestamptz),
  public.compras_cotacao_cancelar(uuid, text), public.compras_cotacao_listar(jsonb, int, jsonb), public.compras_cotacao_detalhe(uuid),
  public.compras_cotacao_respostas_versoes(uuid), public.compras_cotacao_decidir(uuid, jsonb), public.compras_precos_referencia(uuid[]),
  public.compras_material_historico(uuid, int), public.compras_verificar_alertas(),
  public.compras_alterar_status(uuid, text, text, date), public.compras_detalhe_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_cotacao_criar(uuid[], text, text), public.compras_cotacao_montar_itens(uuid, jsonb),
  public.compras_cotacao_incluir_pedidos(uuid, uuid[]), public.compras_cotacao_remover_pedido(uuid, uuid, text),
  public.compras_cotacao_definir_fornecedores(uuid, uuid[]), public.compras_cotacao_abrir(uuid, timestamptz, text),
  public.compras_cotacao_gerar_link(uuid, text), public.compras_cotacao_registrar_envio(uuid, text, boolean),
  public.compras_cotacao_prorrogar(uuid, timestamptz, text), public.compras_cotacao_revisar(uuid, text, timestamptz),
  public.compras_cotacao_cancelar(uuid, text), public.compras_cotacao_listar(jsonb, int, jsonb), public.compras_cotacao_detalhe(uuid),
  public.compras_cotacao_respostas_versoes(uuid), public.compras_cotacao_decidir(uuid, jsonb), public.compras_precos_referencia(uuid[]),
  public.compras_material_historico(uuid, int), public.compras_verificar_alertas(),
  public.compras_alterar_status(uuid, text, text, date), public.compras_detalhe_pedido(uuid) TO authenticated;
