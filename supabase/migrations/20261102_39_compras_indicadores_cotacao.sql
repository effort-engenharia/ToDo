-- 39 (B-07 · PLANO_COTACAO_FORNECEDORES §7.6, §12): KPIs de cotação para o módulo Compras.
--
-- Objetivo:
--   * compras_indicadores_cotacao(p_de date, p_ate date) → jsonb (K1–K10 do §12). Só is_compras() (COMPRAS e Administrador).
--     STABLE, SECURITY DEFINER, search_path fixo. Somente leitura; sem tabelas nem colunas novas.
--
-- Decisões de cálculo (ver Anexo C):
--   * Período = [p_de 00:00, p_ate + 1 dia 00:00) em America/Sao_Paulo. Padrão: últimos 90 dias. Máximo 5 anos.
--     K1, K2, K6, K7, K9, K10 e K4 (decisão) usam compras_cotacao_decisoes.decidido_em; K3, K4 (1ª resposta) usam compras_cotacoes.aberta_em;
--     K8 usa created_at do questionamento / data_alteracao do histórico; K5 não tem filtro de período.
--   * Referência de cada linha decidida (K1, K2, K10) = a MESMA regra de compras_precos_referencia, mas avaliada NO MOMENTO da decisão:
--     média simples do VP unitário de compras 'comprado' do material, anteriores a decidido_em e de OUTRA cotação, dentro de
--     janela_referencia_meses; se a janela estiver vazia, média das últimas fallback_ultimas_compras. Sem histórico → linha sem referência.
--     (A referência por linha não é gravada em compras_cotacao_decisao_itens; por isso é recalculada aqui.)
--   * Valores em VP unitário × quantidade (K1/K2/K10); K6/K9 em NOMINAL × quantidade (sem frete). Percentuais em pontos percentuais (4.5 = 4,5 %).
--   * K3: respondidos = convites com status 'respondido' (recusas aparecem em "recusaram" e não contam como resposta).
--   * K7: vitória = fornecedor igual a recomendacao_snapshot->>'vencedor_recomendado_fornecedor_id'; taxa = vitórias ÷ cotações decididas no
--     período em que o fornecedor tem resposta atual válida (participações). Decisões sem esse campo no snapshot ficam fora.
--   * K8 (históricos): conta só históricos 'alteracao_compras' gerados por compras_alterar_itens (descricao 'Compras alterou a lista%'),
--     pois a aprovação do solicitante também grava esse tipo.
--
-- Depende de: 34–38 (K8 usa questionamentos.origem da 38). Ordem: após a 38.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_indicadores_cotacao(date, date);

CREATE OR REPLACE FUNCTION public.compras_indicadores_cotacao(p_de date DEFAULT NULL, p_ate date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_de date := COALESCE(p_de, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 90);
  v_ate date := COALESCE(p_ate, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_ini timestamptz; v_fim timestamptz;
  cfg public.compras_config; v_neutra numeric; v_meses int; v_fb int;
  v_res jsonb;
BEGIN
  PERFORM public.compras_exigir_compras();
  IF v_ate < v_de THEN RAISE EXCEPTION 'Período inválido: a data final é anterior à inicial'; END IF;
  IF v_ate - v_de > 1830 THEN RAISE EXCEPTION 'Período máximo: 5 anos'; END IF;
  v_ini := v_de::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (v_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT * INTO cfg FROM public.compras_config WHERE id = 1;
  v_neutra := COALESCE(cfg.faixa_neutra_pct, 0.02);
  v_meses := COALESCE(cfg.janela_referencia_meses, 6);
  v_fb := COALESCE(cfg.fallback_ultimas_compras, 5);

  WITH
  linhas AS (
    SELECT di.decisao_id, di.cotacao_item_id, di.fornecedor_id, di.quantidade, di.preco_unitario_nominal AS nom, di.preco_unitario_vp AS vp,
           d.cotacao_id, d.decidido_em, ci.material_id, ci.unidade, cc.tipo AS condicao, m.nome AS material_nome, m.categoria
      FROM public.compras_cotacao_decisoes d
      JOIN public.compras_cotacao_decisao_itens di ON di.decisao_id = d.id
      JOIN public.compras_cotacao_itens ci ON ci.id = di.cotacao_item_id
      JOIN public.compras_cotacao_resposta_condicoes cc ON cc.id = di.condicao_id
      LEFT JOIN public.compras_materiais m ON m.id = ci.material_id
     WHERE d.decidido_em >= v_ini AND d.decidido_em < v_fim
  ),
  lr AS (
    SELECT l.*, rf.ref
      FROM linhas l
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(*) FILTER (WHERE z.na_janela) > 0 THEN avg(z.vp) FILTER (WHERE z.na_janela)
                    ELSE avg(z.vp) FILTER (WHERE z.rn <= v_fb) END AS ref
          FROM (SELECT ph.preco_unitario_vp AS vp,
                       ph.registrado_em >= l.decidido_em - make_interval(months => v_meses) AS na_janela,
                       row_number() OVER (ORDER BY ph.registrado_em DESC, ph.id) AS rn
                  FROM public.compras_precos_historico ph
                 WHERE ph.material_id = l.material_id AND ph.tipo = 'comprado'
                   AND ph.cotacao_id IS DISTINCT FROM l.cotacao_id AND ph.registrado_em < l.decidido_em) z
      ) rf ON l.material_id IS NOT NULL
  ),
  lr2 AS (
    SELECT lr.*, CASE WHEN lr.ref > 0 THEN (lr.vp - lr.ref) / lr.ref END AS delta FROM lr
  ),
  decs AS (
    SELECT d.id, d.cotacao_id, c.aberta_em, d.decidido_em,
           CASE WHEN d.recomendacao_snapshot ->> 'vencedor_recomendado_fornecedor_id'
                     ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (d.recomendacao_snapshot ->> 'vencedor_recomendado_fornecedor_id')::uuid END AS venc
      FROM public.compras_cotacao_decisoes d JOIN public.compras_cotacoes c ON c.id = d.cotacao_id
     WHERE d.decidido_em >= v_ini AND d.decidido_em < v_fim
  ),
  cots AS (
    SELECT c.id, c.aberta_em, (SELECT min(r.enviado_em) FROM public.compras_cotacao_respostas r WHERE r.cotacao_id = c.id) AS prim
      FROM public.compras_cotacoes c
     WHERE c.aberta_em >= v_ini AND c.aberta_em < v_fim
  ),
  pf_conv AS (
    SELECT cv.fornecedor_id,
           count(*) FILTER (WHERE cv.status <> 'nao_enviado') AS enviados,
           count(*) FILTER (WHERE cv.status = 'respondido') AS respondidos,
           count(*) FILTER (WHERE cv.status = 'recusou') AS recusaram
      FROM public.compras_cotacao_convites cv JOIN public.compras_cotacoes c ON c.id = cv.cotacao_id
     WHERE c.aberta_em >= v_ini AND c.aberta_em < v_fim
     GROUP BY cv.fornecedor_id
  ),
  pf_gasto AS (SELECT fornecedor_id, sum(nom * quantidade) AS gasto FROM lr2 GROUP BY fornecedor_id),
  pf_vit AS (SELECT venc AS fornecedor_id, count(*) AS vitorias FROM decs WHERE venc IS NOT NULL GROUP BY venc),
  pf_part AS (
    SELECT cv.fornecedor_id, count(DISTINCT dc.id) AS participacoes
      FROM decs dc
      JOIN public.compras_cotacao_respostas r ON r.cotacao_id = dc.cotacao_id AND r.atual AND NOT r.recusou
      JOIN public.compras_cotacao_convites cv ON cv.id = r.convite_id
     WHERE dc.venc IS NOT NULL
     GROUP BY cv.fornecedor_id
  ),
  pf_ids AS (
    SELECT fornecedor_id FROM pf_conv UNION SELECT fornecedor_id FROM pf_gasto UNION SELECT fornecedor_id FROM pf_vit
  ),
  pf AS (
    SELECT i.fornecedor_id, fo.empresa, COALESCE(c.enviados, 0) AS enviados, COALESCE(c.respondidos, 0) AS respondidos,
           COALESCE(c.recusaram, 0) AS recusaram, COALESCE(g.gasto, 0) AS gasto, COALESCE(v.vitorias, 0) AS vitorias,
           COALESCE(p.participacoes, 0) AS participacoes
      FROM pf_ids i
      JOIN public.compras_fornecedores fo ON fo.id = i.fornecedor_id
      LEFT JOIN pf_conv c ON c.fornecedor_id = i.fornecedor_id
      LEFT JOIN pf_gasto g ON g.fornecedor_id = i.fornecedor_id
      LEFT JOIN pf_vit v ON v.fornecedor_id = i.fornecedor_id
      LEFT JOIN pf_part p ON p.fornecedor_id = i.fornecedor_id
  ),
  gasto_tot AS (SELECT COALESCE(sum(nom * quantidade), 0) AS total FROM lr2),
  qa AS (
    SELECT q.criado_por, q.status, q.created_at, q.respondido_em
      FROM public.execucao_pedidos_questionamentos q
     WHERE q.origem = 'alteracao_compras' AND q.created_at >= v_ini AND q.created_at < v_fim
  ),
  ha AS (
    SELECT h.usuario_id
      FROM public.execucao_historico_pedidos h
     WHERE h.tipo_alteracao = 'alteracao_compras' AND h.descricao LIKE 'Compras alterou a lista%'
       AND h.data_alteracao >= v_ini AND h.data_alteracao < v_fim
  ),
  k8_user AS (
    SELECT u.id AS usuario_id, u.nome_completo AS nome,
           (SELECT count(*) FROM qa WHERE qa.criado_por = u.id) AS questionamentos,
           (SELECT count(*) FROM ha WHERE ha.usuario_id = u.id) AS historicos
      FROM public.usuarios u
     WHERE u.id IN (SELECT criado_por FROM qa WHERE criado_por IS NOT NULL UNION SELECT usuario_id FROM ha WHERE usuario_id IS NOT NULL)
  ),
  k10 AS (
    SELECT l.material_id, max(l.material_nome) AS nome, max(l.unidade) AS unidade, count(*) AS n,
           sum(l.ref * l.quantidade) AS tot_ref, sum(l.vp * l.quantidade) AS tot_vp, sum(l.quantidade) AS qtd
      FROM lr2 l WHERE l.ref > 0 AND l.material_id IS NOT NULL
     GROUP BY l.material_id
    HAVING sum(l.vp * l.quantidade) > sum(l.ref * l.quantidade)
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    -- K1 economia obtida
    'k1', (SELECT jsonb_build_object(
              'valor', round(COALESCE(sum((ref - vp) * quantidade), 0), 2),
              'pct', CASE WHEN sum(ref * quantidade) > 0 THEN round(sum((ref - vp) * quantidade) / sum(ref * quantidade) * 100, 2) END,
              'total_referencia', round(COALESCE(sum(ref * quantidade), 0), 2),
              'n_linhas', count(*), 'suficiente', count(*) >= 5)
             FROM lr2 WHERE ref > 0),
    -- K2 variação vs. referência (faixa neutra = ±faixa_neutra_pct)
    'k2', (SELECT jsonb_build_object(
              'acima', count(*) FILTER (WHERE delta > v_neutra),
              'abaixo', count(*) FILTER (WHERE delta < -v_neutra),
              'neutras', count(*) FILTER (WHERE delta BETWEEN -v_neutra AND v_neutra),
              'acima_pct', CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE delta > v_neutra) * 100.0 / count(*), 1) END,
              'abaixo_pct', CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE delta < -v_neutra) * 100.0 / count(*), 1) END,
              'neutras_pct', CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE delta BETWEEN -v_neutra AND v_neutra) * 100.0 / count(*), 1) END,
              'n_linhas', count(*), 'suficiente', count(*) >= 5)
             FROM lr2 WHERE delta IS NOT NULL),
    -- K3 taxa de resposta
    'k3', (SELECT jsonb_build_object(
              'enviados', COALESCE(sum(enviados), 0), 'respondidos', COALESCE(sum(respondidos), 0), 'recusaram', COALESCE(sum(recusaram), 0),
              'taxa', CASE WHEN sum(enviados) > 0 THEN round(sum(respondidos) * 100.0 / sum(enviados), 1) END,
              'suficiente', COALESCE(sum(enviados), 0) >= 1)
             FROM pf_conv),
    -- K4 ciclo da cotação (medianas em horas)
    'k4', (SELECT jsonb_build_object(
              'primeira_resposta_horas', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM prim - aberta_em) / 3600.0))::numeric, 1)
                                            FROM cots WHERE prim IS NOT NULL),
              'decisao_horas', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM decidido_em - aberta_em) / 3600.0))::numeric, 1)
                                  FROM decs WHERE aberta_em IS NOT NULL),
              'n_primeira_resposta', (SELECT count(*) FROM cots WHERE prim IS NOT NULL),
              'n_decisao', (SELECT count(*) FROM decs WHERE aberta_em IS NOT NULL),
              'suficiente', (SELECT count(*) FROM cots WHERE prim IS NOT NULL) >= 3 OR (SELECT count(*) FROM decs WHERE aberta_em IS NOT NULL) >= 3)),
    -- K5 abertas e vencendo (sem filtro de período)
    'k5', (SELECT jsonb_build_object(
              'abertas', count(*),
              'vencendo_24h', count(*) FILTER (WHERE c.prazo_resposta > now() AND c.prazo_resposta < now() + interval '24 hours'),
              'prazo_vencido', count(*) FILTER (WHERE c.prazo_resposta <= now()),
              'sem_respostas', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.compras_cotacao_respostas r WHERE r.cotacao_id = c.id)),
              'suficiente', true)
             FROM public.compras_cotacoes c WHERE c.status = 'aberta'),
    -- K6 gasto por fornecedor e categoria
    'k6', jsonb_build_object(
              'total', (SELECT round(total, 2) FROM gasto_tot),
              'concentracao_pct', (SELECT CASE WHEN (SELECT total FROM gasto_tot) > 0 THEN round(max(gasto) * 100.0 / (SELECT total FROM gasto_tot), 1) END FROM pf_gasto),
              'fornecedor_top', (SELECT jsonb_build_object('fornecedor_id', p.fornecedor_id, 'empresa', p.empresa, 'gasto', round(p.gasto, 2))
                                   FROM pf p WHERE p.gasto > 0 ORDER BY p.gasto DESC, p.empresa LIMIT 1),
              'por_categoria', COALESCE((SELECT jsonb_agg(jsonb_build_object('categoria', t.cat, 'valor', round(t.v, 2)) ORDER BY t.v DESC, t.cat)
                                           FROM (SELECT COALESCE(NULLIF(btrim(categoria), ''), 'Sem categoria') AS cat, sum(nom * quantidade) AS v
                                                   FROM lr2 GROUP BY 1) t), '[]'::jsonb),
              'suficiente', EXISTS (SELECT 1 FROM decs)),
    -- K7 competitividade (resumo; o detalhe por fornecedor está em por_fornecedor[])
    'k7', jsonb_build_object(
              'cotacoes_com_ranking', (SELECT count(*) FROM decs WHERE venc IS NOT NULL),
              'suficiente', (SELECT count(*) FROM decs WHERE venc IS NOT NULL) >= 3),
    -- K8 alterações em listas
    'k8', jsonb_build_object(
              'questionamentos', (SELECT count(*) FROM qa),
              'aprovados', (SELECT count(*) FROM qa WHERE status = 'aprovado'),
              'reprovados', (SELECT count(*) FROM qa WHERE status = 'reprovado'),
              'abertos', (SELECT count(*) FROM qa WHERE status = 'aberto'),
              'historicos', (SELECT count(*) FROM ha),
              'mediana_aceite_horas', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM respondido_em - created_at) / 3600.0))::numeric, 1)
                                         FROM qa WHERE status IN ('aprovado', 'reprovado') AND respondido_em IS NOT NULL),
              'por_atendente', COALESCE((SELECT jsonb_agg(jsonb_build_object('usuario_id', usuario_id, 'nome', nome,
                                                                              'questionamentos', questionamentos, 'historicos', historicos)
                                                           ORDER BY questionamentos + historicos DESC, nome) FROM k8_user), '[]'::jsonb),
              'suficiente', (SELECT count(*) FROM qa) + (SELECT count(*) FROM ha) >= 1),
    -- K9 parcelado × à vista (gasto nominal)
    'k9', (SELECT jsonb_build_object(
              'a_vista', round(COALESCE(sum(nom * quantidade) FILTER (WHERE condicao = 'a_vista'), 0), 2),
              'parcelado', round(COALESCE(sum(nom * quantidade) FILTER (WHERE condicao = 'parcelado'), 0), 2),
              'a_vista_pct', CASE WHEN sum(nom * quantidade) > 0 THEN round(sum(nom * quantidade) FILTER (WHERE condicao = 'a_vista') * 100.0 / sum(nom * quantidade), 1) END,
              'parcelado_pct', CASE WHEN sum(nom * quantidade) > 0 THEN round(sum(nom * quantidade) FILTER (WHERE condicao = 'parcelado') * 100.0 / sum(nom * quantidade), 1) END,
              'suficiente', count(*) >= 1)
             FROM lr2),
    -- K10 itens mais caros vs. referência (top 5 por Δ% positivo)
    'k10', jsonb_build_object(
              'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                    'material_id', t.material_id, 'nome', t.nome, 'unidade', t.unidade, 'n_linhas', t.n,
                                    'delta_pct', round((t.tot_vp - t.tot_ref) / t.tot_ref * 100, 1),
                                    'ref_medio', round(t.tot_ref / t.qtd, 4), 'vp_medio', round(t.tot_vp / t.qtd, 4))
                                  ORDER BY (t.tot_vp - t.tot_ref) / t.tot_ref DESC, t.nome)
                                   FROM (SELECT * FROM k10 ORDER BY (tot_vp - tot_ref) / tot_ref DESC, nome LIMIT 5) t), '[]'::jsonb),
              'suficiente', (SELECT count(*) FROM lr2 WHERE ref > 0) >= 5),
    'por_fornecedor', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'fornecedor_id', fornecedor_id, 'empresa', empresa, 'enviados', enviados, 'respondidos', respondidos,
                          'recusaram', recusaram,
                          'taxa', CASE WHEN enviados > 0 THEN round(respondidos * 100.0 / enviados, 1) END,
                          'vitorias', vitorias, 'participacoes', participacoes,
                          'taxa_vitoria', CASE WHEN participacoes > 0 THEN round(vitorias * 100.0 / participacoes, 1) END,
                          'gasto', round(gasto, 2))
                        ORDER BY gasto DESC, enviados DESC, empresa) FROM pf), '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END $$;

REVOKE ALL ON FUNCTION public.compras_indicadores_cotacao(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_indicadores_cotacao(date, date) TO authenticated;
