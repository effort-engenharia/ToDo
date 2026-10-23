-- 18: (1) risco por progresso: o esperado conta só dias úteis já concluídos (sem hoje) e só vale com 2+ etapas principais;
-- (2) "Horas a executar" soma só etapas principais (antes somava a etapa e as sub-etapas = horas em dobro); datas no fuso de Brasília.
CREATE OR REPLACE FUNCTION public.execucao_saude_core()
RETURNS TABLE (obra_id uuid, saude text, motivos text[], progresso_esperado int, progresso_real int, dias_atraso int,
               etapas_vencidas int, sem_responsavel int, material_pendente int, replanejamento int, pausadas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT o.id, o.cidade_id, o.data_inicio_prevista di, o.data_fim_prevista df, COALESCE(o.progresso_geral, 0) prog,
           (SELECT count(*)::int FROM public.execucao_obras_etapas x WHERE x.obra_id = o.id AND x.etapa_pai_id IS NULL AND x.status <> 'cancelada') np
      FROM public.execucao_obras o WHERE o.status NOT IN ('concluida', 'cancelada')
  ), calc AS (
    SELECT b.*,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.status NOT IN ('concluida', 'cancelada') AND COALESCE(e.progresso, 0) < 100
          AND public.execucao_add_dias_uteis(e.data_fim, 2, b.cidade_id) < (now() AT TIME ZONE 'America/Sao_Paulo')::date) vencidas,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.status NOT IN ('concluida', 'cancelada') AND e.tipo <> 'estoque'
          AND e.responsavel_id IS NULL AND cardinality(e.equipe_ids) = 0
          AND e.data_fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND e.data_inicio <= public.execucao_add_dias_uteis((now() AT TIME ZONE 'America/Sao_Paulo')::date, 5, b.cidade_id)) semresp,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.tipo = 'estoque' AND e.status NOT IN ('concluida', 'cancelada')
          AND e.data_fim <= public.execucao_add_dias_uteis((now() AT TIME ZONE 'America/Sao_Paulo')::date, 5, b.cidade_id)
          AND NOT EXISTS (SELECT 1 FROM public.execucao_pedidos_material p WHERE p.etapa_id = e.id AND p.data_material_disponivel IS NOT NULL)) mat,
      (SELECT count(*)::int FROM public.execucao_atividades a JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
        WHERE e.obra_id = b.id AND a.solicita_replanejamento AND a.status NOT IN ('concluida', 'cancelada')) repl,
      (SELECT count(*)::int FROM public.execucao_atividades a JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
        WHERE e.obra_id = b.id AND a.status = 'pausada'
          AND public.execucao_add_dias_uteis(a.updated_at::date, 1, b.cidade_id) < (now() AT TIME ZONE 'America/Sao_Paulo')::date) paus,
      -- Progresso esperado = dias úteis JÁ concluídos (sem contar hoje) / total. Só faz sentido com 2+ etapas principais:
      -- numa obra de uma etapa só o progresso é 0% ou 100%, então o tempo decorrido não indica risco.
      CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::date > b.di AND b.df > b.di AND b.np >= 2
           THEN LEAST(100, round(100.0 * public.execucao_dias_uteis_entre(b.di, LEAST((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, b.df), b.cidade_id)
                                  / NULLIF(public.execucao_dias_uteis_entre(b.di, b.df, b.cidade_id), 0)))::int
           ELSE 0 END esperado
    FROM base b
  )
  SELECT c.id,
         CASE WHEN c.df < (now() AT TIME ZONE 'America/Sao_Paulo')::date OR c.vencidas > 0 THEN 'atrasada'
              WHEN ((now() AT TIME ZONE 'America/Sao_Paulo')::date >= c.di AND c.prog < c.esperado - 15) OR c.semresp > 0 OR c.mat > 0 THEN 'em_risco'
              WHEN c.repl > 0 OR c.paus > 0 THEN 'pendencia'
              ELSE 'no_prazo' END,
         array_remove(ARRAY[
           CASE WHEN c.df < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'Prazo final vencido' END,
           CASE WHEN c.vencidas > 0 THEN c.vencidas || ' etapa(s) vencida(s)' END,
           CASE WHEN (now() AT TIME ZONE 'America/Sao_Paulo')::date >= c.di AND c.prog < c.esperado - 15 THEN 'Progresso abaixo do esperado (' || c.prog || '% de ' || c.esperado || '%)' END,
           CASE WHEN c.semresp > 0 THEN c.semresp || ' etapa(s) próxima(s) sem responsável' END,
           CASE WHEN c.mat > 0 THEN 'Material sem data de disponibilidade' END,
           CASE WHEN c.repl > 0 THEN 'Replanejamento solicitado pelo técnico' END,
           CASE WHEN c.paus > 0 THEN c.paus || ' atividade(s) pausada(s) há mais de 1 dia útil' END], NULL),
         c.esperado, c.prog, GREATEST(0, (now() AT TIME ZONE 'America/Sao_Paulo')::date - c.df), c.vencidas, c.semresp, c.mat, c.repl, c.paus
    FROM calc c
$$;

CREATE OR REPLACE FUNCTION public.execucao_painel_carteira() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; v_horas_rest numeric; v_horas_sem numeric;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT COALESCE(sum(e.horas_previstas * (100 - COALESCE(e.progresso, 0)) / 100.0), 0) INTO v_horas_rest
    FROM public.execucao_obras_etapas e JOIN public.execucao_obras o ON o.id = e.obra_id
   WHERE o.status NOT IN ('concluida', 'cancelada') AND e.status NOT IN ('concluida', 'cancelada')
     AND e.etapa_pai_id IS NULL;  -- a etapa principal já soma as horas das sub-etapas
  SELECT COALESCE(sum(c.disponivel_min) / 60.0, 0) INTO v_horas_sem
    FROM public.execucao_capacidade((now() AT TIME ZONE 'America/Sao_Paulo')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 6) c WHERE c.usuario_id IS NOT NULL;

  WITH s AS (SELECT * FROM public.execucao_saude_core()),
       o AS (SELECT ob.*, s.saude, s.sem_responsavel, s.material_pendente, s.replanejamento, s.pausadas
               FROM public.execucao_obras ob LEFT JOIN s ON s.obra_id = ob.id)
  SELECT jsonb_build_object(
    'em_execucao', count(*) FILTER (WHERE o.status = 'em_andamento'),
    'comecam_15d', count(*) FILTER (WHERE o.status = 'planejada' AND o.data_inicio_prevista BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date AND (now() AT TIME ZONE 'America/Sao_Paulo')::date + 15),
    'atrasadas', count(*) FILTER (WHERE o.saude = 'atrasada'),
    'em_risco', count(*) FILTER (WHERE o.saude = 'em_risco'),
    'no_prazo', count(*) FILTER (WHERE o.saude IN ('no_prazo', 'pendencia')),
    'pendencias', jsonb_build_object(
       'sem_responsavel', COALESCE(sum(o.sem_responsavel), 0),
       'material', COALESCE(sum(o.material_pendente), 0),
       'replanejamento', COALESCE(sum(o.replanejamento), 0),
       'pausadas', COALESCE(sum(o.pausadas), 0),
       'horas_extras', (SELECT count(*) FROM public.execucao_horas_extras h WHERE h.status = 'pendente')),
    'carteira_valor', COALESCE(sum(o.valor_contrato * (1 - COALESCE(o.progresso_geral, 0) / 100.0))
                               FILTER (WHERE o.status NOT IN ('concluida', 'cancelada')), 0),
    'horas_restantes', round(v_horas_rest, 1),
    'horas_semana', round(v_horas_sem, 1),
    'semanas_carteira', CASE WHEN v_horas_sem > 0 THEN round(v_horas_rest / v_horas_sem, 1) END
  ) INTO r FROM o;
  RETURN r;
END $$;
