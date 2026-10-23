-- 10: deslocar_etapas move as atividades em dias úteis (antes usava dias corridos e podia cair no fim de semana)
CREATE OR REPLACE FUNCTION public.deslocar_etapas(p_obra_id uuid, p_a_partir_da_ordem int, p_dias_uteis int, p_aplicar boolean DEFAULT false)
RETURNS TABLE (etapa_id uuid, nome text, ordem int, data_inicio_antes date, data_fim_antes date,
               data_inicio_depois date, data_fim_depois date, atividades_afetadas int,
               obra_fim_previsto date, obra_fim_depois date)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_cidade uuid; v_fim_obra date; v_max_fim date; r record; v_uid uuid := public.current_usuario_id();
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT cidade_id, data_fim_prevista INTO v_cidade, v_fim_obra FROM public.execucao_obras WHERE id = p_obra_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obra não encontrada'; END IF;
  SELECT max(e.data_fim) INTO v_max_fim FROM public.execucao_obras_etapas e WHERE e.obra_id = p_obra_id;

  FOR r IN
    SELECT e.id, e.nome AS nome_etapa, e.ordem AS ordem_etapa, e.data_inicio di, e.data_fim df,
           public.execucao_add_dias_uteis(e.data_inicio, p_dias_uteis, v_cidade) ndi,
           public.execucao_add_dias_uteis(e.data_fim, p_dias_uteis, v_cidade) ndf,
           (SELECT count(*)::int FROM public.execucao_atividades a WHERE a.etapa_id = e.id AND a.status NOT IN ('cancelada', 'concluida')) nat
      FROM public.execucao_obras_etapas e
     WHERE e.obra_id = p_obra_id AND COALESCE(e.ordem, 0) >= p_a_partir_da_ordem AND e.status NOT IN ('concluida', 'cancelada')
     ORDER BY e.ordem, e.data_inicio
  LOOP
    IF p_aplicar THEN
      UPDATE public.execucao_obras_etapas SET data_inicio = r.ndi, data_fim = r.ndf, updated_at = now() WHERE id = r.id;
      UPDATE public.execucao_atividades a
         SET data_programada = public.execucao_add_dias_uteis(a.data_programada, p_dias_uteis, v_cidade),
             data_fim = CASE WHEN a.data_fim IS NOT NULL THEN public.execucao_add_dias_uteis(a.data_fim, p_dias_uteis, v_cidade) END,
             updated_at = now()
       WHERE a.etapa_id = r.id AND a.status NOT IN ('cancelada', 'concluida');
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id)
      SELECT 'replanejamento', '📅 Atividade remarcada',
             format('"%s" foi remarcada para %s', a.titulo, to_char(a.data_programada, 'DD/MM/YYYY')), a.id, eq.usuario_id, v_uid
        FROM public.execucao_atividades a JOIN public.execucao_atividades_equipe eq ON eq.atividade_id = a.id
       WHERE a.etapa_id = r.id AND a.status NOT IN ('cancelada', 'concluida');
    END IF;
    etapa_id := r.id; nome := r.nome_etapa; ordem := r.ordem_etapa;
    data_inicio_antes := r.di; data_fim_antes := r.df; data_inicio_depois := r.ndi; data_fim_depois := r.ndf;
    atividades_afetadas := r.nat; obra_fim_previsto := v_fim_obra;
    obra_fim_depois := GREATEST(COALESCE(v_max_fim, r.ndf), r.ndf);
    RETURN NEXT;
  END LOOP;

  IF p_aplicar THEN
    UPDATE public.execucao_obras o
       SET data_fim_prevista = GREATEST(COALESCE(o.data_fim_prevista, '-infinity'::date),
                                        (SELECT max(e.data_fim) FROM public.execucao_obras_etapas e WHERE e.obra_id = o.id)),
           updated_at = now()
     WHERE o.id = p_obra_id AND (SELECT max(e.data_fim) FROM public.execucao_obras_etapas e WHERE e.obra_id = o.id) > COALESCE(o.data_fim_prevista, '-infinity'::date);
  END IF;
END $$;
