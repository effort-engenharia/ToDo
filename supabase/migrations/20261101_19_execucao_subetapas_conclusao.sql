-- 19 (B1 · R14 · D8): a etapa pai só conclui quando TODAS as sub-etapas (não canceladas) e TODAS as atividades
-- próprias dela (não canceladas) estão concluídas. Fim da cascata pai → sub-etapas; passos marcáveis pelo técnico.
--
-- Objetivo:
--   1. execucao_recalcular_etapa_pai(uuid): única função de agregação (conclui / mantém em_andamento / reabre).
--   2. execucao_sincronizar_etapa_pai(uuid): resolve o pai (da sub-etapa ou da própria etapa com filhos) e delega.
--   3. alterar_status_atividade (assinatura de 8 parâmetros, a mesma da mig. 16): SEM a cascata da mig. 16 L228–236
--      e com o fallback de vínculo por nome restrito (folha + mesma data + exatamente 1 correspondência).
--      A mig. 20 recria esta função com os parâmetros novos (aplicar 19 e 20 na mesma janela).
--   4. execucao_marcar_passo(...): o técnico marca/desmarca um passo (sub-etapa) da atividade; idempotente (fila offline).
--   5. execucao_contexto_atividades: devolve também o id de cada sub-etapa (e o progresso).
--   6. CHECK de execucao_atividades_historico.tipo_acao ganha 'passo', 'reabertura' e 'horas_ajustadas' (NOT VALID:
--      só valida linhas novas; a lista antiga é subconjunto da nova).
--
-- A correção dos DADOS (reabrir etapas pai indevidas) NÃO está aqui: ver supabase/manutencao/corrigir_etapas_pai_concluidas.sql.
--
-- ROLLBACK:
--   -- (a) reaplicar de supabase/migrations/20261023_16_execucao_subetapas_passos.sql: o bloco
--   --     CREATE OR REPLACE FUNCTION public.alterar_status_atividade(...) (L116–243) e o
--   --     CREATE OR REPLACE FUNCTION public.execucao_contexto_atividades (L249–262, com DROP antes);
--   -- (b) reaplicar de supabase/migrations/20261023_14_execucao_sub_etapas.sql L4–27
--   --     (CREATE OR REPLACE FUNCTION public.execucao_sincronizar_etapa_pai);
--   -- (c) DROP FUNCTION IF EXISTS public.execucao_marcar_passo(uuid, uuid, boolean, uuid, timestamptz);
--   --     DROP FUNCTION IF EXISTS public.execucao_recalcular_etapa_pai(uuid);
--   -- (d) ALTER TABLE public.execucao_atividades_historico DROP CONSTRAINT IF EXISTS execucao_atividades_historico_tipo_acao_check;
--   --     (recriar a lista antiga só se necessário: 'criacao','comentario','status_alterado','transferencia','conclusao',
--   --      'edicao','cancelamento','pausa','retomada'; linhas com 'passo'/'reabertura' precisam ser removidas ou migradas antes).

-- ---------- 6. tipos de ação do histórico ----------
ALTER TABLE public.execucao_atividades_historico DROP CONSTRAINT IF EXISTS execucao_atividades_historico_tipo_acao_check;
ALTER TABLE public.execucao_atividades_historico ADD CONSTRAINT execucao_atividades_historico_tipo_acao_check
  CHECK (tipo_acao::text IN ('criacao', 'comentario', 'status_alterado', 'transferencia', 'conclusao', 'edicao',
                             'cancelamento', 'pausa', 'retomada', 'passo', 'reabertura', 'horas_ajustadas')) NOT VALID;

-- ---------- 1. agregação única da etapa pai ----------
CREATE OR REPLACE FUNCTION public.execucao_recalcular_etapa_pai(p_pai uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text; v_old_prog int; v_old_ini date; v_old_fim date;
  v_subs_total int; v_subs_feitas int; v_subs_ini int; v_subs_prog int;
  v_atv_total int; v_atv_feitas int; v_atv_ini int;
  v_completa boolean; v_ini boolean; v_prog int;
  v_new_status text; v_new_ini date; v_new_fim date;
  v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT status, progresso, data_inicio_real, data_fim_real INTO v_status, v_old_prog, v_old_ini, v_old_fim
    FROM public.execucao_obras_etapas WHERE id = p_pai FOR UPDATE;
  IF NOT FOUND OR v_status = 'cancelada' THEN RETURN; END IF;

  SELECT count(*), count(*) FILTER (WHERE s.status = 'concluida'), count(*) FILTER (WHERE s.status IN ('em_andamento', 'concluida')),
         round(sum(COALESCE(s.progresso, 0) * s.w) / NULLIF(sum(s.w), 0))::int
    INTO v_subs_total, v_subs_feitas, v_subs_ini, v_subs_prog
    FROM (SELECT status, progresso, GREATEST(COALESCE(NULLIF(horas_previstas, 0), 1)::numeric, 0.01) AS w
            FROM public.execucao_obras_etapas WHERE etapa_pai_id = p_pai AND status <> 'cancelada') s;

  SELECT count(*), count(*) FILTER (WHERE status = 'concluida'), count(*) FILTER (WHERE status IN ('em_andamento', 'pausada', 'concluida'))
    INTO v_atv_total, v_atv_feitas, v_atv_ini
    FROM public.execucao_atividades WHERE etapa_id = p_pai AND status <> 'cancelada';

  IF COALESCE(v_subs_total, 0) + COALESCE(v_atv_total, 0) = 0 THEN RETURN; END IF;

  v_completa := v_subs_feitas = v_subs_total AND v_atv_feitas = v_atv_total;
  v_ini := (v_subs_ini + v_atv_ini) > 0;
  -- Com passos, o progresso é o dos passos; sem passos, a razão das atividades. Só chega a 100 quando tudo fecha.
  v_prog := CASE WHEN v_completa THEN 100
                 WHEN v_subs_total > 0 THEN LEAST(99, GREATEST(0, COALESCE(v_subs_prog, 0)))
                 ELSE LEAST(99, round(100.0 * v_atv_feitas / v_atv_total)::int) END;

  v_new_status := CASE WHEN v_completa THEN 'concluida'
                       WHEN v_status = 'concluida' THEN 'em_andamento'          -- reabre: algo voltou a ficar pendente
                       WHEN v_ini AND v_status = 'pendente' THEN 'em_andamento'
                       ELSE v_status END;
  v_new_ini := CASE WHEN v_ini OR v_completa THEN COALESCE(v_old_ini, v_dia) ELSE v_old_ini END;
  v_new_fim := CASE WHEN v_completa THEN COALESCE(v_old_fim, v_dia) ELSE NULL END;

  -- Só grava quando algo muda: sem escrita inútil (não toca updated_at, não gera evento Realtime nem linha de auditoria)
  UPDATE public.execucao_obras_etapas
     SET progresso = v_prog, status = v_new_status, data_inicio_real = v_new_ini, data_fim_real = v_new_fim, updated_at = now()
   WHERE id = p_pai
     AND (progresso, status, data_inicio_real, data_fim_real) IS DISTINCT FROM (v_prog, v_new_status, v_new_ini, v_new_fim);
END $$;
REVOKE ALL ON FUNCTION public.execucao_recalcular_etapa_pai(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- 2. resolve o pai e delega ----------
CREATE OR REPLACE FUNCTION public.execucao_sincronizar_etapa_pai(p_etapa uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pai uuid;
BEGIN
  SELECT COALESCE(e.etapa_pai_id,
                  CASE WHEN EXISTS (SELECT 1 FROM public.execucao_obras_etapas f WHERE f.etapa_pai_id = e.id) THEN e.id END)
    INTO v_pai
    FROM public.execucao_obras_etapas e WHERE e.id = p_etapa;
  IF v_pai IS NULL THEN RETURN; END IF;
  PERFORM public.execucao_recalcular_etapa_pai(v_pai);
END $$;
REVOKE ALL ON FUNCTION public.execucao_sincronizar_etapa_pai(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- 3. alterar_status_atividade sem cascata (mesma assinatura da mig. 16) ----------
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
  v_n int; v_tem_filhos boolean;
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
    -- Fallback restrito (mig. 16 ligava por nome+cliente e podia cair na etapa errada, inclusive no pai):
    -- só etapas FOLHA, mesma obra/cliente, mesma data de início e somente se houver EXATAMENTE 1 correspondência.
    SELECT count(*) INTO v_n
      FROM public.execucao_obras_etapas e JOIN public.execucao_obras o ON o.id = e.obra_id
     WHERE e.nome = a.titulo AND o.nome_cliente = a.cliente_nome AND e.data_inicio = a.data_programada
       AND e.status <> 'cancelada'
       AND NOT EXISTS (SELECT 1 FROM public.execucao_obras_etapas f WHERE f.etapa_pai_id = e.id);
    IF v_n = 1 THEN
      SELECT e.id INTO v_etapa
        FROM public.execucao_obras_etapas e JOIN public.execucao_obras o ON o.id = e.obra_id
       WHERE e.nome = a.titulo AND o.nome_cliente = a.cliente_nome AND e.data_inicio = a.data_programada
         AND e.status <> 'cancelada'
         AND NOT EXISTS (SELECT 1 FROM public.execucao_obras_etapas f WHERE f.etapa_pai_id = e.id);
      UPDATE public.execucao_atividades SET etapa_id = v_etapa WHERE id = p_id;
    END IF;
  END IF;

  IF v_etapa IS NOT NULL THEN
    SELECT obra_id INTO v_obra FROM public.execucao_obras_etapas WHERE id = v_etapa;
    v_tem_filhos := EXISTS (SELECT 1 FROM public.execucao_obras_etapas f WHERE f.etapa_pai_id = v_etapa);
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
    IF p_status = 'concluida' AND NOT v_tem_filhos THEN
      -- Etapa folha: conclui quando todas as suas atividades (não canceladas) estão concluídas
      SELECT count(*), count(*) FILTER (WHERE status = 'concluida') INTO v_total, v_feitas
        FROM public.execucao_atividades WHERE etapa_id = v_etapa AND status <> 'cancelada';
      UPDATE public.execucao_obras_etapas
         SET progresso = CASE WHEN v_feitas >= v_total THEN 100 ELSE GREATEST(COALESCE(progresso, 0), round(100.0 * v_feitas / v_total)::int) END,
             status = CASE WHEN v_feitas >= v_total THEN 'concluida' ELSE status END,
             data_fim_real = CASE WHEN v_feitas >= v_total THEN v_dia ELSE data_fim_real END,
             updated_at = now()
       WHERE id = v_etapa;
      -- (sem cascata: a mig. 16 L228–236 concluía todas as sub-etapas aqui; removido por causa do R14)
    ELSIF p_status = 'em_andamento' AND v_tem_filhos THEN
      UPDATE public.execucao_obras_etapas
         SET status = 'em_andamento', data_inicio_real = COALESCE(data_inicio_real, v_dia), updated_at = now()
       WHERE etapa_pai_id = v_etapa AND status = 'pendente';
    END IF;
    -- Etapa com filhos (ou sub-etapa): agregação única. Nunca conclui o pai se restar passo ou atividade própria aberta.
    PERFORM public.execucao_sincronizar_etapa_pai(v_etapa);
    PERFORM public.execucao_recalcular_progresso_obra(v_obra);
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;

REVOKE ALL ON FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric) TO authenticated;

-- ---------- 4. marcar passo (sub-etapa) da atividade ----------
-- Retorno: jsonb { sub_etapa_id, status, progresso, pai_id, pai_status, pai_progresso, passos_total, passos_feitos, repetido }
CREATE OR REPLACE FUNCTION public.execucao_marcar_passo(
  p_atividade uuid, p_sub_etapa uuid, p_concluido boolean,
  p_id_cliente uuid DEFAULT NULL, p_ocorrido_em timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  a public.execucao_atividades;
  s public.execucao_obras_etapas;
  v_quando timestamptz; v_dia date; v_novo text; v_repetido boolean := false;
  v_pai_status text; v_pai_prog int; v_total int; v_feitos int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_concluido IS NULL THEN RAISE EXCEPTION 'Informe se o passo está concluído'; END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_atividade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  IF NOT (public.is_admin_execucao() OR a.tecnico_responsavel_id = v_uid OR public.execucao_participa(p_atividade)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta atividade';
  END IF;

  SELECT * INTO s FROM public.execucao_obras_etapas WHERE id = p_sub_etapa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Passo não encontrado'; END IF;
  IF a.etapa_id IS NULL OR s.etapa_pai_id IS DISTINCT FROM a.etapa_id THEN
    RAISE EXCEPTION 'O passo não pertence a esta atividade';
  END IF;
  IF s.status = 'cancelada' THEN RAISE EXCEPTION 'Passo cancelado'; END IF;
  IF a.status = 'cancelada' THEN RAISE EXCEPTION 'Atividade cancelada'; END IF;

  -- Reenvio da mesma ação (fila offline) não repete nada
  IF p_id_cliente IS NOT NULL THEN
    INSERT INTO public.execucao_acoes_cliente (id, usuario_id, tipo) VALUES (p_id_cliente, v_uid, 'passo')
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN v_repetido := true; END IF;
  END IF;

  IF NOT v_repetido THEN
    v_quando := LEAST(COALESCE(p_ocorrido_em, now()), now());
    v_dia := (v_quando AT TIME ZONE 'America/Sao_Paulo')::date;
    v_novo := CASE WHEN p_concluido THEN 'concluida'
                   WHEN a.status IN ('em_andamento', 'pausada') THEN 'em_andamento'
                   ELSE 'pendente' END;
    IF s.status IS DISTINCT FROM v_novo THEN
      UPDATE public.execucao_obras_etapas
         SET status = v_novo,
             progresso = CASE WHEN p_concluido THEN 100 ELSE 0 END,
             data_inicio_real = CASE WHEN v_novo IN ('em_andamento', 'concluida') THEN COALESCE(data_inicio_real, v_dia) ELSE data_inicio_real END,
             data_fim_real = CASE WHEN p_concluido THEN COALESCE(data_fim_real, v_dia) ELSE NULL END,
             updated_at = now()
       WHERE id = p_sub_etapa;
      INSERT INTO public.execucao_atividades_historico
        (atividade_id, usuario_id, tipo_acao, descricao, valor_anterior, valor_novo, created_at)
      VALUES (p_atividade, v_uid, 'passo',
              format('Passo "%s" %s', s.nome, CASE WHEN p_concluido THEN 'concluído' ELSE 'reaberto' END),
              s.status, v_novo, v_quando);
      PERFORM public.execucao_sincronizar_etapa_pai(p_sub_etapa);
      PERFORM public.execucao_recalcular_progresso_obra(s.obra_id);
    END IF;
  END IF;

  SELECT status, progresso INTO v_pai_status, v_pai_prog FROM public.execucao_obras_etapas WHERE id = s.etapa_pai_id;
  SELECT count(*), count(*) FILTER (WHERE status = 'concluida') INTO v_total, v_feitos
    FROM public.execucao_obras_etapas WHERE etapa_pai_id = s.etapa_pai_id AND status <> 'cancelada';
  SELECT * INTO s FROM public.execucao_obras_etapas WHERE id = p_sub_etapa;
  RETURN jsonb_build_object('sub_etapa_id', s.id, 'status', s.status, 'progresso', s.progresso,
                            'pai_id', s.etapa_pai_id, 'pai_status', v_pai_status, 'pai_progresso', v_pai_prog,
                            'passos_total', v_total, 'passos_feitos', v_feitos, 'repetido', v_repetido);
END $$;
REVOKE ALL ON FUNCTION public.execucao_marcar_passo(uuid, uuid, boolean, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_marcar_passo(uuid, uuid, boolean, uuid, timestamptz) TO authenticated;

-- ---------- 5. contexto do técnico com o id (e progresso) de cada passo ----------
CREATE OR REPLACE FUNCTION public.execucao_contexto_atividades(p_ids uuid[])
RETURNS TABLE (atividade_id uuid, obra_id uuid, nome_cliente text, endereco text, cidade text, contato_cliente text, sub_etapas jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, o.id, o.nome_cliente, o.endereco, o.cidade, o.contato_cliente,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'horas', s.horas_previstas,
                                                       'status', s.status, 'progresso', s.progresso)
                                    ORDER BY s.ordem, s.created_at)
                     FROM public.execucao_obras_etapas s WHERE s.etapa_pai_id = e.id), '[]'::jsonb)
    FROM public.execucao_atividades a
    JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
    JOIN public.execucao_obras o ON o.id = e.obra_id
   WHERE a.id = ANY (p_ids)
     AND (public.is_admin_execucao() OR a.tecnico_responsavel_id = public.current_usuario_id() OR public.execucao_participa(a.id));
$$;
REVOKE ALL ON FUNCTION public.execucao_contexto_atividades(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_contexto_atividades(uuid[]) TO authenticated;
