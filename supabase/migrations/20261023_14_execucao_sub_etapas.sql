-- 14: sub-etapas em templates e obras (pai_ordem), etapa pai sem atividade própria, progresso por etapas principais
ALTER TABLE public.execucao_templates_etapas_itens ADD COLUMN IF NOT EXISTS pai_ordem int;

CREATE OR REPLACE FUNCTION public.execucao_sincronizar_etapa_pai(p_etapa uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pai uuid; v_total int; v_feitas int; v_iniciadas int; v_prog int;
  v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT etapa_pai_id INTO v_pai FROM public.execucao_obras_etapas WHERE id = p_etapa;
  IF v_pai IS NULL THEN RETURN; END IF;
  SELECT count(*), count(*) FILTER (WHERE s.status = 'concluida'), count(*) FILTER (WHERE s.status IN ('em_andamento', 'concluida')),
         round(sum(COALESCE(s.progresso, 0) * s.w) / NULLIF(sum(s.w), 0))::int
    INTO v_total, v_feitas, v_iniciadas, v_prog
    FROM (SELECT status, progresso, GREATEST(COALESCE(NULLIF(horas_previstas, 0), 1)::numeric, 0.01) AS w
            FROM public.execucao_obras_etapas WHERE etapa_pai_id = v_pai AND status <> 'cancelada') s;
  IF COALESCE(v_total, 0) = 0 THEN RETURN; END IF;
  UPDATE public.execucao_obras_etapas
     SET progresso = CASE WHEN v_feitas = v_total THEN 100 ELSE LEAST(99, GREATEST(0, COALESCE(v_prog, 0))) END,
         status = CASE WHEN v_feitas = v_total THEN 'concluida'
                       WHEN v_iniciadas > 0 AND status = 'pendente' THEN 'em_andamento' ELSE status END,
         data_inicio_real = CASE WHEN v_iniciadas > 0 THEN COALESCE(data_inicio_real, v_dia) ELSE data_inicio_real END,
         data_fim_real = CASE WHEN v_feitas = v_total THEN COALESCE(data_fim_real, v_dia) ELSE data_fim_real END,
         updated_at = now()
   WHERE id = v_pai;
END $$;
REVOKE ALL ON FUNCTION public.execucao_sincronizar_etapa_pai(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.execucao_recalcular_progresso_obra(p_obra uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog int; v_total int; v_conc int;
BEGIN
  SELECT round(sum(COALESCE(s.progresso, 0) * s.w) / NULLIF(sum(s.w), 0))::int, count(*), count(*) FILTER (WHERE s.status = 'concluida')
    INTO v_prog, v_total, v_conc
    FROM (SELECT progresso, status,
                 GREATEST(COALESCE(NULLIF(horas_previstas, 0), (data_fim - data_inicio + 1))::numeric, 1) AS w
            FROM public.execucao_obras_etapas WHERE obra_id = p_obra AND etapa_pai_id IS NULL AND status <> 'cancelada') s;
  IF COALESCE(v_total, 0) > 0 THEN
    UPDATE public.execucao_obras
       SET progresso_geral = LEAST(100, GREATEST(0, COALESCE(v_prog, 0))),
           data_fim_real = CASE WHEN v_conc = v_total THEN COALESCE(data_fim_real, current_date) ELSE data_fim_real END,
           status = CASE WHEN v_conc = v_total AND status <> 'cancelada' THEN 'concluida' ELSE status END,
           updated_at = now()
     WHERE id = p_obra;
  END IF;
END $$;

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
    PERFORM public.execucao_sincronizar_etapa_pai(v_etapa);
    PERFORM public.execucao_recalcular_progresso_obra(v_obra);
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.criar_obra_completa(p_obra jsonb, p_etapas jsonb DEFAULT '[]', p_criar_atividades boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  o record; e record; v_obra uuid; v_etapa uuid; v_atv uuid; v_lider uuid; v_apoio uuid;
  v_n_et int := 0; v_n_atv int := 0; v_n_ped int := 0; v_tipo_exec text;
  v_map jsonb := '{}'::jsonb; v_pai uuid; v_ord int; v_tem_subs boolean; v_ini date; v_fim date;
BEGIN
  IF NOT public.is_admin_execucao() OR v_uid IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO o FROM jsonb_to_record(p_obra) AS x(
    nome_cliente text, endereco text, cidade text, cidade_id text, contrato_numero text,
    data_inicio_prevista text, data_fim_prevista text, tipo_obra text, prioridade text, responsavel_id text,
    observacoes text, contato_cliente text, apontamento_id text, template_id text, valor_contrato text,
    tipo_servico_codigo text, rapido boolean, status text, data_inicio_real text);

  IF COALESCE(btrim(o.nome_cliente), '') = '' THEN RAISE EXCEPTION 'Informe o cliente'; END IF;

  INSERT INTO public.execucao_obras
    (nome_cliente, endereco, cidade, cidade_id, contrato_numero, data_inicio_prevista, data_fim_prevista, tipo_obra, prioridade,
     responsavel_id, observacoes, contato_cliente, apontamento_id, template_id, valor_contrato, tipo_servico_codigo, rapido,
     status, data_inicio_real)
  VALUES (btrim(o.nome_cliente), NULLIF(o.endereco, ''), NULLIF(o.cidade, ''), NULLIF(o.cidade_id, '')::uuid, NULLIF(o.contrato_numero, ''),
          NULLIF(o.data_inicio_prevista, '')::date, NULLIF(o.data_fim_prevista, '')::date,
          COALESCE(NULLIF(o.tipo_obra, ''), 'misto'), COALESCE(NULLIF(o.prioridade, ''), 'media'),
          NULLIF(o.responsavel_id, '')::uuid, NULLIF(o.observacoes, ''), NULLIF(o.contato_cliente, ''),
          NULLIF(o.apontamento_id, '')::uuid, NULLIF(o.template_id, '')::uuid, NULLIF(o.valor_contrato, '')::numeric,
          NULLIF(o.tipo_servico_codigo, ''), COALESCE(o.rapido, false),
          COALESCE(NULLIF(o.status, ''), 'planejada'), NULLIF(o.data_inicio_real, '')::date)
  RETURNING id INTO v_obra;

  FOR e IN
    SELECT x.*, t.ord
      FROM jsonb_array_elements(COALESCE(p_etapas, '[]'::jsonb)) WITH ORDINALITY AS t(el, ord)
      CROSS JOIN LATERAL jsonb_to_record(t.el) AS x(
        nome text, descricao text, tipo text, data_inicio text, data_fim text, ordem int, responsavel_id text,
        equipe_ids jsonb, horas_previstas text, qtd_tecnicos int, pop_id text, status text, progresso int,
        data_inicio_real text, data_fim_real text, hora_inicio text, hora_fim text, cor text, prioridade text, observacoes text,
        etapa_pai_ordem int)
     ORDER BY COALESCE(x.ordem, t.ord::int), t.ord
  LOOP
    v_ord := COALESCE(e.ordem, e.ord::int);
    v_pai := NULL;
    v_ini := NULLIF(e.data_inicio, '')::date;
    v_fim := NULLIF(e.data_fim, '')::date;
    IF e.etapa_pai_ordem IS NOT NULL THEN
      -- Sub-etapa: fica dentro da etapa pai (mesmas datas, sem duração própria em dias)
      v_pai := (v_map ->> e.etapa_pai_ordem::text)::uuid;
      IF v_pai IS NULL THEN RAISE EXCEPTION 'Sub-etapa "%" sem etapa pai', e.nome; END IF;
      SELECT COALESCE(v_ini, p.data_inicio), COALESCE(v_fim, p.data_fim) INTO v_ini, v_fim
        FROM public.execucao_obras_etapas p WHERE p.id = v_pai;
    END IF;
    v_tem_subs := EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_etapas, '[]'::jsonb)) x
                           WHERE (x ->> 'etapa_pai_ordem') = v_ord::text);

    INSERT INTO public.execucao_obras_etapas
      (obra_id, nome, descricao, tipo, data_inicio, data_fim, ordem, etapa_pai_id, responsavel_id, equipe_ids, horas_previstas,
       qtd_tecnicos, pop_id, status, progresso, data_inicio_real, data_fim_real, cor)
    VALUES (v_obra, e.nome, NULLIF(e.descricao, ''), COALESCE(NULLIF(e.tipo, ''), 'geral'),
            v_ini, v_fim, v_ord, v_pai,
            NULLIF(e.responsavel_id, '')::uuid,
            COALESCE((SELECT array_agg(v::uuid) FROM jsonb_array_elements_text(COALESCE(e.equipe_ids, '[]'::jsonb)) v), '{}'),
            NULLIF(e.horas_previstas, '')::numeric, COALESCE(e.qtd_tecnicos, 1), NULLIF(e.pop_id, '')::uuid,
            COALESCE(NULLIF(e.status, ''), 'pendente'), COALESCE(e.progresso, 0),
            NULLIF(e.data_inicio_real, '')::date, NULLIF(e.data_fim_real, '')::date, NULLIF(e.cor, ''))
    RETURNING id INTO v_etapa;
    v_map := v_map || jsonb_build_object(v_ord::text, v_etapa);
    v_n_et := v_n_et + 1;

    IF COALESCE(e.tipo, '') = 'estoque' THEN
      IF COALESCE(e.status, 'pendente') <> 'concluida' THEN
        INSERT INTO public.execucao_pedidos_material
          (solicitante_id, descricao, itens, urgencia, status, obra_id, etapa_id, cliente_nome, endereco_obra, data_lista_pronta, observacoes)
        VALUES (v_uid, 'Lista de Materiais - ' || btrim(o.nome_cliente), '[]'::jsonb, 'normal', 'concluido', v_obra, v_etapa,
                btrim(o.nome_cliente), COALESCE(o.endereco, ''), v_fim,
                '📦 Lista de materiais para a obra. Após preencher os itens e definir a data de disponibilidade, uma etapa "Chegada dos Materiais" será criada no cronograma.');
        v_n_ped := v_n_ped + 1;
      END IF;
    -- A etapa pai de sub-etapas não gera atividade: quem vai para a agenda são as sub-etapas
    ELSIF p_criar_atividades AND NOT v_tem_subs AND COALESCE(e.status, 'pendente') NOT IN ('concluida', 'cancelada') THEN
      v_lider := COALESCE(NULLIF(e.responsavel_id, '')::uuid,
                          (SELECT v::uuid FROM jsonb_array_elements_text(COALESCE(e.equipe_ids, '[]'::jsonb)) v LIMIT 1));
      IF v_lider IS NOT NULL THEN
        v_tipo_exec := CASE WHEN e.tipo IN ('eletrica', 'civil', 'galpao', 'gestao') THEN e.tipo ELSE 'gestao' END;
        INSERT INTO public.execucao_atividades
          (titulo, descricao, tipo_execucao, data_programada, data_fim, hora_inicio, hora_fim, prioridade, tecnico_responsavel_id,
           cliente_nome, endereco, observacoes, etapa_id, created_by, horas_previstas)
        VALUES (e.nome, COALESCE(NULLIF(e.descricao, ''), 'Etapa da obra: ' || btrim(o.nome_cliente)), v_tipo_exec,
                v_ini, CASE WHEN v_pai IS NULL AND v_fim > v_ini THEN v_fim END,
                COALESCE(NULLIF(e.hora_inicio, ''), CASE WHEN v_pai IS NULL THEN '08:00' END)::time,
                COALESCE(NULLIF(e.hora_fim, ''), CASE WHEN v_pai IS NULL THEN '17:00' END)::time,
                COALESCE(NULLIF(e.prioridade, ''), 'normal'), v_lider, btrim(o.nome_cliente), NULLIF(o.endereco, ''),
                COALESCE(NULLIF(e.observacoes, ''), 'Etapa automática - Obra: ' || btrim(o.nome_cliente)), v_etapa, v_uid,
                NULLIF(e.horas_previstas, '')::numeric)
        RETURNING id INTO v_atv;
        INSERT INTO public.execucao_atividades_historico (atividade_id, usuario_id, tipo_acao, descricao)
        VALUES (v_atv, v_uid, 'criacao', 'Atividade criada');
        FOR v_apoio IN SELECT v::uuid FROM jsonb_array_elements_text(COALESCE(e.equipe_ids, '[]'::jsonb)) v LOOP
          IF v_apoio <> v_lider THEN
            INSERT INTO public.execucao_atividades_equipe (atividade_id, usuario_id, papel)
            VALUES (v_atv, v_apoio, 'apoio') ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
        v_n_atv := v_n_atv + 1;
      END IF;
    END IF;
  END LOOP;

  PERFORM public.execucao_recalcular_progresso(v_obra);
  RETURN jsonb_build_object('obra_id', v_obra, 'etapas', v_n_et, 'atividades', v_n_atv, 'pedidos', v_n_ped);
END $$;
REVOKE ALL ON FUNCTION public.criar_obra_completa(jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_obra_completa(jsonb, jsonb, boolean) TO authenticated;

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
     WHERE e.obra_id = p_obra_id AND COALESCE((SELECT pp.ordem FROM public.execucao_obras_etapas pp WHERE pp.id = e.etapa_pai_id), e.ordem, 0) >= p_a_partir_da_ordem AND e.status NOT IN ('concluida', 'cancelada')
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
