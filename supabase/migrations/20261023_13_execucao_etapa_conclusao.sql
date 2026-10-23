-- 13: a etapa só é concluída quando TODAS as atividades dela estão concluídas (antes, concluir uma atividade fechava a etapa)
CREATE OR REPLACE FUNCTION public.alterar_status_atividade(
  p_id uuid, p_status text, p_motivo text DEFAULT NULL,
  p_ocorrido_em timestamptz DEFAULT NULL, p_id_cliente uuid DEFAULT NULL,
  p_motivo_codigo text DEFAULT NULL, p_solicita_replanejamento boolean DEFAULT false,
  p_horas_realizadas numeric DEFAULT NULL
) RETURNS public.execucao_atividades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  a public.execucao_atividades;
  v_old text; v_tecnico text;
  v_tipo_acao text := 'status_alterado'; v_desc text := 'Status alterado para ' || p_status;
  v_notif_tipo text; v_notif_titulo text; v_notif_msg text;
  v_etapa uuid; v_obra uuid; v_quando timestamptz; v_dia date; v_total int; v_feitas int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  IF NOT (public.is_admin_execucao() OR a.tecnico_responsavel_id = v_uid OR public.execucao_participa(p_id)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta atividade';
  END IF;

  -- Reenvio da mesma ação (fila offline) não repete nada
  IF p_id_cliente IS NOT NULL THEN
    INSERT INTO public.execucao_acoes_cliente (id, usuario_id, tipo) VALUES (p_id_cliente, v_uid, 'status')
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN a; END IF;
  END IF;

  v_quando := LEAST(COALESCE(p_ocorrido_em, now()), now());
  v_dia := (v_quando AT TIME ZONE 'America/Sao_Paulo')::date;
  v_old := a.status;
  SELECT COALESCE(nome_completo, 'Técnico') INTO v_tecnico FROM public.usuarios WHERE id = v_uid;
  v_tecnico := COALESCE(v_tecnico, 'Técnico');

  UPDATE public.execucao_atividades SET
    status = p_status,
    updated_at = now(),
    inicio_real_em = CASE WHEN p_status IN ('em_andamento', 'concluida') THEN COALESCE(inicio_real_em, v_quando) ELSE inicio_real_em END,
    fim_real_em = CASE WHEN p_status = 'concluida' THEN v_quando
                       WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE fim_real_em END,
    solicita_replanejamento = CASE WHEN p_status = 'pausada' THEN (solicita_replanejamento OR COALESCE(p_solicita_replanejamento, false))
                                   ELSE solicita_replanejamento END,
    horas_realizadas = CASE WHEN p_status = 'concluida' THEN COALESCE(p_horas_realizadas, horas_previstas) ELSE horas_realizadas END,
    horas_ajustadas = CASE WHEN p_status = 'concluida'
                           THEN (p_horas_realizadas IS NOT NULL AND p_horas_realizadas IS DISTINCT FROM horas_previstas)
                           ELSE horas_ajustadas END
   WHERE id = p_id RETURNING * INTO a;

  IF p_status = 'concluida' THEN
    v_tipo_acao := 'conclusao'; v_desc := 'Atividade concluída';
    v_notif_tipo := 'conclusao'; v_notif_titulo := '✅ Atividade Concluída';
    v_notif_msg := format('%s concluiu a atividade "%s"', v_tecnico, a.titulo);
  ELSIF p_status = 'cancelada' THEN
    v_tipo_acao := 'cancelamento'; v_desc := 'Atividade cancelada';
  ELSIF p_status = 'pausada' THEN
    v_tipo_acao := 'pausa';
    v_desc := CASE WHEN p_motivo IS NOT NULL THEN 'Atividade pausada. Motivo: ' || p_motivo ELSE 'Atividade pausada' END;
    v_notif_tipo := 'pausa'; v_notif_titulo := '⏸️ Atividade Pausada';
    v_notif_msg := format('%s pausou a atividade "%s"%s%s', v_tecnico, a.titulo,
                          CASE WHEN p_motivo IS NOT NULL THEN '. Motivo: ' || p_motivo ELSE '' END,
                          CASE WHEN p_solicita_replanejamento THEN ' (solicitou atualização do planejamento)' ELSE '' END);
  ELSIF p_status = 'em_andamento' AND v_old = 'pausada' THEN
    v_tipo_acao := 'retomada'; v_desc := 'Atividade retomada';
    v_notif_tipo := 'retomada'; v_notif_titulo := '▶️ Atividade Retomada';
    v_notif_msg := format('%s retomou a atividade "%s"', v_tecnico, a.titulo);
  ELSIF p_status = 'pendente' THEN
    v_notif_tipo := 'pendente'; v_notif_titulo := '📋 Atividade Pendente';
    v_notif_msg := format('A atividade "%s" foi marcada como pendente', a.titulo);
  END IF;

  INSERT INTO public.execucao_atividades_historico
    (atividade_id, usuario_id, tipo_acao, descricao, valor_anterior, valor_novo, motivo_codigo, created_at)
  VALUES (p_id, v_uid, v_tipo_acao, v_desc, v_old, p_status, p_motivo_codigo, v_quando);

  IF v_notif_tipo IS NOT NULL THEN
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, usuario_origem_id)
    VALUES (v_notif_tipo, v_notif_titulo, v_notif_msg, p_id, v_uid);
  END IF;

  -- Etapa/obra vinculadas: datas reais, status e progresso
  v_etapa := a.etapa_id;
  IF v_etapa IS NULL AND p_status = 'concluida' THEN
    SELECT e.id INTO v_etapa FROM public.execucao_obras_etapas e
      JOIN public.execucao_obras o ON o.id = e.obra_id
     WHERE e.nome = a.titulo AND o.nome_cliente = a.cliente_nome LIMIT 1;
    IF v_etapa IS NOT NULL THEN UPDATE public.execucao_atividades SET etapa_id = v_etapa WHERE id = p_id; END IF;
  END IF;

  IF v_etapa IS NOT NULL THEN
    SELECT obra_id INTO v_obra FROM public.execucao_obras_etapas WHERE id = v_etapa;
    IF p_status IN ('em_andamento', 'concluida') THEN
      UPDATE public.execucao_obras_etapas
         SET data_inicio_real = COALESCE(data_inicio_real, v_dia),
             status = CASE WHEN status = 'pendente' THEN 'em_andamento' ELSE status END, updated_at = now()
       WHERE id = v_etapa;
      UPDATE public.execucao_obras
         SET data_inicio_real = COALESCE(data_inicio_real, v_dia),
             status = CASE WHEN status = 'planejada' THEN 'em_andamento' ELSE status END, updated_at = now()
       WHERE id = v_obra;
    END IF;
    IF p_status = 'concluida' THEN
      -- A etapa só conclui quando todas as suas atividades (não canceladas) estão concluídas
      SELECT count(*), count(*) FILTER (WHERE status = 'concluida') INTO v_total, v_feitas
        FROM public.execucao_atividades WHERE etapa_id = v_etapa AND status <> 'cancelada';
      UPDATE public.execucao_obras_etapas
         SET progresso = CASE WHEN v_feitas >= v_total THEN 100 ELSE GREATEST(COALESCE(progresso, 0), round(100.0 * v_feitas / v_total)::int) END,
             status = CASE WHEN v_feitas >= v_total THEN 'concluida' ELSE status END,
             data_fim_real = CASE WHEN v_feitas >= v_total THEN v_dia ELSE data_fim_real END,
             updated_at = now()
       WHERE id = v_etapa;
    END IF;
    PERFORM public.execucao_recalcular_progresso_obra(v_obra);
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;
