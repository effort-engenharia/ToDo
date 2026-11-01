-- 26 (B8 · R6/R8 · D7/D9 · N1-l/N1-n): leitura do Dashboard de Compras via RPC (STABLE, SECURITY DEFINER).
--
-- Objetivo:
--   * compras_listar_pedidos(p_filtros, p_limite, p_cursor): fila/lista com nomes já resolvidos (não abre RLS de usuarios/obras
--     para COMPRAS), paginação por keyset (created_at DESC, id ASC). Fila (N1-n) = pedidos com ≥ 1 item preenchido OU pedido de
--     falta de material (atividade_id preenchido); fora: listas de obra vazias. Sem filtro de status, 'cancelado' fica de fora.
--     Selos devolvidos: sem_itens ("Sem lista de itens"), obra_cancelada ("obra cancelada"), atrasado.
--     Filtros (jsonb, todos opcionais): de, ate (datas, inclusivas, fuso America/Sao_Paulo), campo_data ('pedido' = created_at
--     [padrão] | 'evento' = status_compra_em), status_compra [], urgencia [], busca (descrição/cliente/nome de item),
--     solicitante_id, comprador_id, pedido_id (detalhe de um pedido), com_questionamento_aberto (bool).
--     Cursor: {"created_at": "...", "id": "..."} (valores da última linha recebida). p_limite: 1..200.
--   * compras_indicadores(p_de, p_ate): KPIs da D9 ajustados pelo Negócio (§3.1.3) num único jsonb. NÃO expõe valor de contrato
--     nem dados comerciais. Período padrão: últimos 30 dias.
--
-- Depende da 20261101_25 (e 24).
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_indicadores(date, date);
--   DROP FUNCTION IF EXISTS public.compras_listar_pedidos(jsonb, int, jsonb);
--   DROP INDEX IF EXISTS public.idx_pedidos_created_id;

CREATE INDEX IF NOT EXISTS idx_pedidos_created_id ON public.execucao_pedidos_material (created_at DESC, id);
-- (S9) idx_execucao_pedidos_data (created_at) fica coberto por este índice; NÃO foi removido aqui. Só dropar depois de
-- pg_stat_user_indexes mostrar idx_scan = 0 para ele: DROP INDEX IF EXISTS public.idx_execucao_pedidos_data;

CREATE OR REPLACE FUNCTION public.compras_listar_pedidos(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite int DEFAULT 50, p_cursor jsonb DEFAULT NULL)
RETURNS TABLE (
  id uuid, created_at timestamptz, updated_at timestamptz, descricao text, urgencia text, status text, status_compra text,
  status_compra_em timestamptz, comprado_em timestamptz, fila_compras_em timestamptz, observacoes text,
  cliente_nome text, endereco_obra text, obra_id uuid, obra_status text, obra_cancelada boolean,
  atividade_id uuid, atividade_titulo text, solicitante_id uuid, solicitante_nome text, comprador_id uuid, comprador_nome text,
  data_lista_pronta date, data_material_disponivel date, data_entrega timestamptz, etapa_chegada_id uuid,
  itens jsonb, qtd_itens int, qtd_questionamentos_abertos int, sem_itens boolean, atrasado boolean
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
         (p.data_material_disponivel IS NOT NULL AND p.data_material_disponivel < v_hoje AND p.status_compra NOT IN ('entregue', 'cancelado'))
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
     AND (v_busca IS NULL OR p.descricao ILIKE v_busca OR p.cliente_nome ILIKE v_busca OR p.itens::text ILIKE v_busca)
     AND (v_cur_t IS NULL OR p.created_at < v_cur_t OR (p.created_at = v_cur_t AND p.id > v_cur_id))
   ORDER BY p.created_at DESC, p.id ASC
   LIMIT v_lim;
END $$;

-- KPIs (D9 + §3.1.3). Estoque (sem período): fila por status, atrasados, urgentes, obras paradas. Período: comprados/entregues
-- pelo instante do evento; tempos a partir de "entrou na fila"; resposta a questionamentos só dos respondidos.
CREATE OR REPLACE FUNCTION public.compras_indicadores(p_de date DEFAULT NULL, p_ate date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_de date := COALESCE(p_de, v_hoje - 30);
  v_ate date := COALESCE(p_ate, v_hoje);
  v_ini timestamptz; v_fim timestamptz; r jsonb;
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_ate < v_de THEN RAISE EXCEPTION 'Período inválido'; END IF;
  v_ini := v_de::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  WITH fila AS (
    SELECT p.* FROM public.execucao_pedidos_material p
     WHERE public.execucao_pedido_tem_itens(p.itens) OR p.atividade_id IS NOT NULL
  ), abertos AS (
    SELECT * FROM fila WHERE status_compra NOT IN ('entregue', 'cancelado')
  ), tempos AS (
    SELECT EXTRACT(EPOCH FROM (comprado_em - fila_compras_em)) / 86400.0 AS dias
      FROM fila WHERE comprado_em >= v_ini AND comprado_em < v_fim AND fila_compras_em IS NOT NULL AND comprado_em >= fila_compras_em
  ), resp AS (
    SELECT EXTRACT(EPOCH FROM (q.respondido_em - q.created_at)) / 3600.0 AS horas
      FROM public.execucao_pedidos_questionamentos q
     WHERE q.status IN ('aprovado', 'reprovado') AND q.respondido_em >= v_ini AND q.respondido_em < v_fim
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'por_status', COALESCE((SELECT jsonb_object_agg(s.status_compra, s.n) FROM (SELECT status_compra, count(*) n FROM fila GROUP BY 1) s), '{}'::jsonb),
    'aguardando_compra', (SELECT count(*) FROM fila WHERE status_compra = 'aguardando_compra'),
    'em_cotacao', (SELECT count(*) FROM fila WHERE status_compra = 'em_cotacao'),
    'aguardando_solicitante', jsonb_build_object(
        'pedidos', (SELECT count(*) FROM fila WHERE status_compra = 'aguardando_solicitante'),
        'questionamentos_abertos', (SELECT count(*) FROM public.execucao_pedidos_questionamentos WHERE status = 'aberto'),
        'mais_antigo_dias', (SELECT round(EXTRACT(EPOCH FROM (now() - min(created_at))) / 86400.0, 1)
                               FROM public.execucao_pedidos_questionamentos WHERE status = 'aberto')),
    -- N1-l: atraso do comprador = previsão de chegada vencida (NÃO data_lista_pronta, que é prazo de quem monta a lista)
    'atrasados', (SELECT count(*) FROM abertos WHERE data_material_disponivel IS NOT NULL AND data_material_disponivel < v_hoje),
    'urgentes_em_aberto', (SELECT count(*) FROM abertos WHERE urgencia IN ('alta', 'urgente')),
    'obras_paradas_falta_material', (
        SELECT jsonb_build_object('atividades', count(*), 'obras', count(DISTINCT e.obra_id))
          FROM public.execucao_atividades a
          LEFT JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
         WHERE a.status = 'pausada'
           AND (SELECT h.motivo_codigo FROM public.execucao_atividades_historico h
                 WHERE h.atividade_id = a.id AND h.tipo_acao = 'pausa' ORDER BY h.created_at DESC, h.id DESC LIMIT 1) = 'falta_material'),
    'comprados_periodo', (SELECT count(*) FROM fila WHERE comprado_em >= v_ini AND comprado_em < v_fim),
    'entregues_periodo', (SELECT count(*) FROM fila WHERE status_compra = 'entregue'
                             AND COALESCE(data_entrega, status_compra_em, updated_at) >= v_ini
                             AND COALESCE(data_entrega, status_compra_em, updated_at) < v_fim),
    'tempo_fila_ate_comprado_dias', jsonb_build_object(
        'media', (SELECT round(avg(dias)::numeric, 2) FROM tempos),
        'mediana', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY dias))::numeric, 2) FROM tempos),
        'amostra', (SELECT count(*) FROM tempos)),
    'tempo_resposta_questionamento_horas', jsonb_build_object(
        'media', (SELECT round(avg(horas)::numeric, 1) FROM resp),
        'mediana', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY horas))::numeric, 1) FROM resp),
        'amostra', (SELECT count(*) FROM resp))
  ) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.compras_listar_pedidos(jsonb, int, jsonb), public.compras_indicadores(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_listar_pedidos(jsonb, int, jsonb), public.compras_indicadores(date, date) TO authenticated;
