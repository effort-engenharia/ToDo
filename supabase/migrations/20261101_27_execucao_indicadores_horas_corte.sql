-- 27 (N1-d ressalva 1 · N1-e): data de corte nas horas realizadas + indicador "conclusões sem localização".
--
-- Objetivo:
--   1. execucao_indicadores(p_inicio, p_fim): 'horas_por_tipo' (previstas × realizadas × ajustadas) passa a considerar SÓ atividades
--      com horas_origem IS NOT NULL (série nova, mig. 20). Conclusões anteriores à mig. 20 (horas_origem NULL = "previsto salvo ajuste")
--      saem do comparativo para não misturar as duas séries. Contrato de retorno PRESERVADO (mesmas chaves e tipos).
--   2. execucao_media_realizada_templates() (calibração de templates): mesmo corte (a.horas_origem IS NOT NULL) no cálculo da média.
--      Mesmas colunas de retorno.
--   3. Chave NOVA e ADITIVA em execucao_indicadores: 'conclusoes_sem_localizacao' (por técnico responsável; ver Anexo F.7).
--      Conta conclusões do período registradas pela mig. 20 (conclusao_registrada_em IS NOT NULL) cujo conclusao_geo_status é
--      diferente de 'ok' (negada, indisponivel, tempo_esgotado, nao_suportado ou nulo = app antigo sem o dado).
--      Serve para a gestão acompanhar a cobertura da coleta; NÃO usar em ranking, bônus ou avaliação individual (N1-e/N1-d.6).
--      Ficam de fora conclusões antigas (sem conclusao_registrada_em), que nunca coletaram localização.
--   'pontualidade', 'pausas_por_motivo', 'obras_no_prazo', 'lead_time_dias' e 'horas_extras' ficam idênticos aos da mig. 06.
--   Observação: horas_origem NOT NULL inclui origem 'previstas' (concluída sem "Iniciar", P2): ela entra com realizadas = previstas.
--   Para medir só o tempo realmente medido, trocar o filtro por: a.horas_origem IN ('intervalos', 'ajuste_admin', 'ajuste_tecnico').
--
-- Depende da 20261101_20 (colunas horas_origem, conclusao_geo_status, conclusao_registrada_em). Antes da 20 NÃO aplicar (erro de coluna).
-- Efeito esperado logo após aplicar: 'horas_por_tipo' e a calibração ficam vazios até haver conclusões novas (a série recomeça na data de corte,
-- ver execucao_horas_data_corte()). O front deve tratar lista vazia com a mensagem "Sem dados desde a nova regra de horas".
--
-- ROLLBACK:
--   Reaplicar de supabase/migrations/20261023_06_execucao_planejamento.sql os blocos
--   CREATE OR REPLACE FUNCTION public.execucao_indicadores (L267–300) e public.execucao_media_realizada_templates (L302–315).
--   (os GRANTs permanecem; CREATE OR REPLACE não os altera)

CREATE OR REPLACE FUNCTION public.execucao_indicadores(p_inicio date, p_fim date) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT jsonb_build_object(
    'pontualidade', (SELECT jsonb_build_object('concluidas', count(*),
         'no_prazo', count(*) FILTER (WHERE (a.fim_real_em AT TIME ZONE 'America/Sao_Paulo')::date <= COALESCE(a.data_fim, a.data_programada)))
       FROM public.execucao_atividades a
       WHERE a.status = 'concluida' AND a.fim_real_em IS NOT NULL
         AND (a.fim_real_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim),
    'pausas_por_motivo', COALESCE((SELECT jsonb_agg(jsonb_build_object('codigo', m.codigo, 'total', m.total) ORDER BY m.total DESC)
       FROM (SELECT COALESCE(h.motivo_codigo, 'sem_motivo') codigo, count(*) total
               FROM public.execucao_atividades_historico h
              WHERE h.tipo_acao = 'pausa' AND h.created_at::date BETWEEN p_inicio AND p_fim GROUP BY 1) m), '[]'::jsonb),
    -- data de corte: só a série nova (horas_origem preenchida pela mig. 20)
    'horas_por_tipo', COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', t.tipo, 'previstas', t.prev, 'realizadas', t.real, 'ajustadas', t.aj, 'atividades', t.n))
       FROM (SELECT a.tipo_execucao tipo, sum(a.horas_previstas) prev, sum(a.horas_realizadas) real,
                    count(*) FILTER (WHERE a.horas_ajustadas) aj, count(*) n
               FROM public.execucao_atividades a
              WHERE a.status = 'concluida' AND a.horas_previstas IS NOT NULL AND a.horas_origem IS NOT NULL
                AND (a.fim_real_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim GROUP BY 1) t), '[]'::jsonb),
    'obras_no_prazo', (SELECT jsonb_build_object('concluidas', count(*), 'no_prazo', count(*) FILTER (WHERE o.data_fim_real <= o.data_fim_prevista))
       FROM public.execucao_obras o WHERE o.status = 'concluida' AND o.data_fim_real BETWEEN p_inicio AND p_fim),
    'lead_time_dias', (SELECT round(avg(o.data_inicio_real - ap.created_at::date), 1)
       FROM public.execucao_obras o JOIN public.apontamentos_comerciais ap ON ap.id = o.apontamento_id
       WHERE o.data_inicio_real BETWEEN p_inicio AND p_fim),
    'horas_extras', (SELECT jsonb_build_object(
         'aprovadas', COALESCE(sum(h.horas) FILTER (WHERE h.status = 'aprovada' AND h.tipo <> 'emergencia'), 0),
         'emergencia', COALESCE(sum(h.horas) FILTER (WHERE h.status = 'aprovada' AND h.tipo = 'emergencia'), 0),
         'pendentes', COALESCE(sum(h.horas) FILTER (WHERE h.status = 'pendente'), 0))
       FROM public.execucao_horas_extras h WHERE h.data BETWEEN p_inicio AND p_fim),
    -- NOVO (aditivo): conclusões do período sem localização válida, por técnico responsável
    'conclusoes_sem_localizacao', COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'usuario_id', g.usuario_id, 'nome', g.nome, 'concluidas', g.concluidas, 'sem_localizacao', g.sem_loc,
           'negada', g.negada, 'indisponivel', g.indisp, 'tempo_esgotado', g.tempo, 'nao_suportado', g.nao_sup, 'sem_dado', g.sem_dado)
           ORDER BY g.sem_loc DESC, g.nome)
       FROM (SELECT a.tecnico_responsavel_id AS usuario_id, COALESCE(u.nome_completo, 'Sem técnico') AS nome,
                    count(*) AS concluidas,
                    count(*) FILTER (WHERE a.conclusao_geo_status IS DISTINCT FROM 'ok') AS sem_loc,
                    count(*) FILTER (WHERE a.conclusao_geo_status = 'negada') AS negada,
                    count(*) FILTER (WHERE a.conclusao_geo_status = 'indisponivel') AS indisp,
                    count(*) FILTER (WHERE a.conclusao_geo_status = 'tempo_esgotado') AS tempo,
                    count(*) FILTER (WHERE a.conclusao_geo_status = 'nao_suportado') AS nao_sup,
                    count(*) FILTER (WHERE a.conclusao_geo_status IS NULL) AS sem_dado
               FROM public.execucao_atividades a
               LEFT JOIN public.usuarios u ON u.id = a.tecnico_responsavel_id
              WHERE a.status = 'concluida' AND a.conclusao_registrada_em IS NOT NULL
                AND (a.fim_real_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
              GROUP BY a.tecnico_responsavel_id, u.nome_completo) g), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.execucao_media_realizada_templates()
RETURNS TABLE (template_id uuid, item_id uuid, item_nome text, horas_previstas numeric, media_realizada numeric, execucoes int, ajustes int)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT i.template_id, i.id, i.nome::text, i.horas_previstas, round(avg(x.horas), 2), count(*)::int, count(*) FILTER (WHERE x.ajustou)::int
    FROM public.execucao_templates_etapas_itens i
    JOIN public.execucao_obras o ON o.template_id = i.template_id
    JOIN public.execucao_obras_etapas e ON e.obra_id = o.id AND e.nome = i.nome AND e.status = 'concluida'
    -- data de corte: só atividades da série nova (horas_origem preenchida pela mig. 20)
    CROSS JOIN LATERAL (SELECT sum(a.horas_realizadas) horas, bool_or(a.horas_ajustadas) ajustou
                          FROM public.execucao_atividades a
                         WHERE a.etapa_id = e.id AND a.horas_realizadas IS NOT NULL AND a.horas_origem IS NOT NULL) x
   WHERE public.is_admin_execucao() AND x.horas IS NOT NULL
   GROUP BY i.template_id, i.id, i.nome, i.horas_previstas
$$;
