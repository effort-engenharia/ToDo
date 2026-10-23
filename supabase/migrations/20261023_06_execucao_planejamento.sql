-- 06: contratos pendentes, criar_obra_completa, deslocar_etapas, saúde/painel da carteira, indicadores, status p/ Comercial

-- ---------- Contratos do Comercial ainda sem obra ----------
CREATE OR REPLACE FUNCTION public.execucao_contratos_pendentes(p_incluir_planejados boolean DEFAULT false, p_busca text DEFAULT NULL)
RETURNS TABLE (id uuid, nome_cliente text, tipo_oportunidade text, tipo_servico_codigo text, tipo_servico_nome text,
               modalidade text, equipe_responsavel text, cronograma_data_inicio date, cronograma_data_termino date,
               valor_total_servico numeric, contato_cliente text, logradouro text, numero text, bairro text,
               cidade text, cidade_id uuid, obra_id uuid, ignorado boolean, motivo_ignorado text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.nome_cliente::text, a.tipo_oportunidade::text, ts.codigo, ts.nome, ts.modalidade,
         COALESCE(ts.equipe_responsavel, 'execucao'),
         a.cronograma_data_inicio, a.cronograma_data_termino, a.valor_total_servico,
         a.contato_cliente::text, a.logradouro::text, a.numero::text, a.bairro::text,
         cn.nome, c.id, o.id, (ig.apontamento_id IS NOT NULL), ig.motivo, a.created_at
    FROM public.apontamentos_comerciais a
    CROSS JOIN LATERAL (SELECT (CASE WHEN upper(COALESCE(a.cidade_atendimento, '')) = 'OUTRAS' THEN a.cidade_outras
                                     ELSE COALESCE(NULLIF(a.cidade_atendimento, ''), a.municipio) END)::text AS nome) cn
    LEFT JOIN public.execucao_tipos_servico ts ON public.execucao_norm(a.tipo_oportunidade) = ANY (ts.termos_comercial)
    LEFT JOIN public.execucao_cidades c ON c.nome_norm = public.execucao_norm(cn.nome)
    LEFT JOIN public.execucao_obras o ON o.apontamento_id = a.id
    LEFT JOIN public.execucao_contratos_ignorados ig ON ig.apontamento_id = a.id
   WHERE public.is_admin_execucao()
     AND a.fase = 'CONTRATO/VENDA' AND COALESCE(a.ativo, true) AND a.duplicado_de IS NULL
     AND COALESCE(ts.equipe_responsavel, 'execucao') <> 'orcamentos'
     AND (p_incluir_planejados OR (o.id IS NULL AND ig.apontamento_id IS NULL))
     AND (COALESCE(p_busca, '') = '' OR public.execucao_norm(a.nome_cliente) LIKE '%' || public.execucao_norm(p_busca) || '%')
   ORDER BY (o.id IS NOT NULL OR ig.apontamento_id IS NOT NULL), a.cronograma_data_inicio NULLS LAST, a.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.execucao_contar_contratos_pendentes() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.execucao_contratos_pendentes(false, NULL)
$$;

-- ---------- Criar obra + etapas + atividades + pedidos de estoque em UMA transação ----------
CREATE OR REPLACE FUNCTION public.criar_obra_completa(p_obra jsonb, p_etapas jsonb DEFAULT '[]', p_criar_atividades boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  o record; e record; v_obra uuid; v_etapa uuid; v_atv uuid; v_lider uuid; v_apoio uuid;
  v_n_et int := 0; v_n_atv int := 0; v_n_ped int := 0; v_tipo_exec text;
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
        data_inicio_real text, data_fim_real text, hora_inicio text, hora_fim text, cor text, prioridade text, observacoes text)
     ORDER BY COALESCE(x.ordem, t.ord::int), t.ord
  LOOP
    INSERT INTO public.execucao_obras_etapas
      (obra_id, nome, descricao, tipo, data_inicio, data_fim, ordem, responsavel_id, equipe_ids, horas_previstas,
       qtd_tecnicos, pop_id, status, progresso, data_inicio_real, data_fim_real, cor)
    VALUES (v_obra, e.nome, NULLIF(e.descricao, ''), COALESCE(NULLIF(e.tipo, ''), 'geral'),
            e.data_inicio::date, e.data_fim::date, COALESCE(e.ordem, e.ord::int),
            NULLIF(e.responsavel_id, '')::uuid,
            COALESCE((SELECT array_agg(v::uuid) FROM jsonb_array_elements_text(COALESCE(e.equipe_ids, '[]'::jsonb)) v), '{}'),
            NULLIF(e.horas_previstas, '')::numeric, COALESCE(e.qtd_tecnicos, 1), NULLIF(e.pop_id, '')::uuid,
            COALESCE(NULLIF(e.status, ''), 'pendente'), COALESCE(e.progresso, 0),
            NULLIF(e.data_inicio_real, '')::date, NULLIF(e.data_fim_real, '')::date, NULLIF(e.cor, ''))
    RETURNING id INTO v_etapa;
    v_n_et := v_n_et + 1;

    IF COALESCE(e.tipo, '') = 'estoque' THEN
      IF COALESCE(e.status, 'pendente') <> 'concluida' THEN
        INSERT INTO public.execucao_pedidos_material
          (solicitante_id, descricao, itens, urgencia, status, obra_id, etapa_id, cliente_nome, endereco_obra, data_lista_pronta, observacoes)
        VALUES (v_uid, 'Lista de Materiais - ' || btrim(o.nome_cliente), '[]'::jsonb, 'normal', 'concluido', v_obra, v_etapa,
                btrim(o.nome_cliente), COALESCE(o.endereco, ''), e.data_fim::date,
                '📦 Lista de materiais para a obra. Após preencher os itens e definir a data de disponibilidade, uma etapa "Chegada dos Materiais" será criada no cronograma.');
        v_n_ped := v_n_ped + 1;
      END IF;
    ELSIF p_criar_atividades AND COALESCE(e.status, 'pendente') NOT IN ('concluida', 'cancelada') THEN
      v_lider := COALESCE(NULLIF(e.responsavel_id, '')::uuid,
                          (SELECT v::uuid FROM jsonb_array_elements_text(COALESCE(e.equipe_ids, '[]'::jsonb)) v LIMIT 1));
      IF v_lider IS NOT NULL THEN
        v_tipo_exec := CASE WHEN e.tipo IN ('eletrica', 'civil', 'galpao', 'gestao') THEN e.tipo ELSE 'gestao' END;
        INSERT INTO public.execucao_atividades
          (titulo, descricao, tipo_execucao, data_programada, data_fim, hora_inicio, hora_fim, prioridade, tecnico_responsavel_id,
           cliente_nome, endereco, observacoes, etapa_id, created_by, horas_previstas)
        VALUES (e.nome, COALESCE(NULLIF(e.descricao, ''), 'Etapa da obra: ' || btrim(o.nome_cliente)), v_tipo_exec,
                e.data_inicio::date, CASE WHEN e.data_fim::date > e.data_inicio::date THEN e.data_fim::date END,
                COALESCE(NULLIF(e.hora_inicio, ''), '08:00')::time, COALESCE(NULLIF(e.hora_fim, ''), '17:00')::time,
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

-- ---------- Deslocar etapas seguintes (prévia com p_aplicar=false; aplica com true) ----------
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
         SET data_programada = r.ndi + (a.data_programada - r.di),
             data_fim = CASE WHEN a.data_fim IS NOT NULL THEN r.ndi + (a.data_fim - r.di) END,
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
END $$;

-- ---------- Saúde das obras (fonte única; regras do doc 2.3) ----------
CREATE OR REPLACE FUNCTION public.execucao_saude_core()
RETURNS TABLE (obra_id uuid, saude text, motivos text[], progresso_esperado int, progresso_real int, dias_atraso int,
               etapas_vencidas int, sem_responsavel int, material_pendente int, replanejamento int, pausadas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT o.id, o.cidade_id, o.data_inicio_prevista di, o.data_fim_prevista df, COALESCE(o.progresso_geral, 0) prog
      FROM public.execucao_obras o WHERE o.status NOT IN ('concluida', 'cancelada')
  ), calc AS (
    SELECT b.*,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.status NOT IN ('concluida', 'cancelada') AND COALESCE(e.progresso, 0) < 100
          AND public.execucao_add_dias_uteis(e.data_fim, 2, b.cidade_id) < current_date) vencidas,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.status NOT IN ('concluida', 'cancelada') AND e.tipo <> 'estoque'
          AND e.responsavel_id IS NULL AND cardinality(e.equipe_ids) = 0
          AND e.data_fim >= current_date AND e.data_inicio <= public.execucao_add_dias_uteis(current_date, 5, b.cidade_id)) semresp,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.tipo = 'estoque' AND e.status NOT IN ('concluida', 'cancelada')
          AND e.data_fim <= public.execucao_add_dias_uteis(current_date, 5, b.cidade_id)
          AND NOT EXISTS (SELECT 1 FROM public.execucao_pedidos_material p WHERE p.etapa_id = e.id AND p.data_material_disponivel IS NOT NULL)) mat,
      (SELECT count(*)::int FROM public.execucao_atividades a JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
        WHERE e.obra_id = b.id AND a.solicita_replanejamento AND a.status NOT IN ('concluida', 'cancelada')) repl,
      (SELECT count(*)::int FROM public.execucao_atividades a JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
        WHERE e.obra_id = b.id AND a.status = 'pausada'
          AND public.execucao_add_dias_uteis(a.updated_at::date, 1, b.cidade_id) < current_date) paus,
      CASE WHEN current_date >= b.di AND b.df > b.di
           THEN LEAST(100, round(100.0 * public.execucao_dias_uteis_entre(b.di, LEAST(current_date, b.df), b.cidade_id)
                                  / NULLIF(public.execucao_dias_uteis_entre(b.di, b.df, b.cidade_id), 0)))::int
           ELSE 0 END esperado
    FROM base b
  )
  SELECT c.id,
         CASE WHEN c.df < current_date OR c.vencidas > 0 THEN 'atrasada'
              WHEN (current_date >= c.di AND c.prog < c.esperado - 15) OR c.semresp > 0 OR c.mat > 0 THEN 'em_risco'
              WHEN c.repl > 0 OR c.paus > 0 THEN 'pendencia'
              ELSE 'no_prazo' END,
         array_remove(ARRAY[
           CASE WHEN c.df < current_date THEN 'Prazo final vencido' END,
           CASE WHEN c.vencidas > 0 THEN c.vencidas || ' etapa(s) vencida(s)' END,
           CASE WHEN current_date >= c.di AND c.prog < c.esperado - 15 THEN 'Progresso abaixo do esperado (' || c.prog || '% de ' || c.esperado || '%)' END,
           CASE WHEN c.semresp > 0 THEN c.semresp || ' etapa(s) próxima(s) sem responsável' END,
           CASE WHEN c.mat > 0 THEN 'Material sem data de disponibilidade' END,
           CASE WHEN c.repl > 0 THEN 'Replanejamento solicitado pelo técnico' END,
           CASE WHEN c.paus > 0 THEN c.paus || ' atividade(s) pausada(s) há mais de 1 dia útil' END], NULL),
         c.esperado, c.prog, GREATEST(0, current_date - c.df), c.vencidas, c.semresp, c.mat, c.repl, c.paus
    FROM calc c
$$;

CREATE OR REPLACE FUNCTION public.execucao_saude_obras()
RETURNS TABLE (obra_id uuid, saude text, motivos text[], progresso_esperado int, progresso_real int, dias_atraso int,
               etapas_vencidas int, sem_responsavel int, material_pendente int, replanejamento int, pausadas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.execucao_saude_core() WHERE public.is_admin_execucao()
$$;

-- ---------- Painel da carteira ----------
CREATE OR REPLACE FUNCTION public.execucao_painel_carteira() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; v_horas_rest numeric; v_horas_sem numeric;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT COALESCE(sum(e.horas_previstas * (100 - COALESCE(e.progresso, 0)) / 100.0), 0) INTO v_horas_rest
    FROM public.execucao_obras_etapas e JOIN public.execucao_obras o ON o.id = e.obra_id
   WHERE o.status NOT IN ('concluida', 'cancelada') AND e.status NOT IN ('concluida', 'cancelada');
  SELECT COALESCE(sum(c.disponivel_min) / 60.0, 0) INTO v_horas_sem
    FROM public.execucao_capacidade(current_date, current_date + 6) c WHERE c.usuario_id IS NOT NULL;

  WITH s AS (SELECT * FROM public.execucao_saude_core()),
       o AS (SELECT ob.*, s.saude, s.sem_responsavel, s.material_pendente, s.replanejamento, s.pausadas
               FROM public.execucao_obras ob LEFT JOIN s ON s.obra_id = ob.id)
  SELECT jsonb_build_object(
    'em_execucao', count(*) FILTER (WHERE o.status = 'em_andamento'),
    'comecam_15d', count(*) FILTER (WHERE o.status = 'planejada' AND o.data_inicio_prevista BETWEEN current_date AND current_date + 15),
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

-- ---------- Indicadores (4.2) e calibração de templates (4.3) ----------
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
    'horas_por_tipo', COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', t.tipo, 'previstas', t.prev, 'realizadas', t.real, 'ajustadas', t.aj, 'atividades', t.n))
       FROM (SELECT a.tipo_execucao tipo, sum(a.horas_previstas) prev, sum(a.horas_realizadas) real,
                    count(*) FILTER (WHERE a.horas_ajustadas) aj, count(*) n
               FROM public.execucao_atividades a
              WHERE a.status = 'concluida' AND a.horas_previstas IS NOT NULL
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
       FROM public.execucao_horas_extras h WHERE h.data BETWEEN p_inicio AND p_fim)
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
    CROSS JOIN LATERAL (SELECT sum(a.horas_realizadas) horas, bool_or(a.horas_ajustadas) ajustou
                          FROM public.execucao_atividades a WHERE a.etapa_id = e.id AND a.horas_realizadas IS NOT NULL) x
   WHERE public.is_admin_execucao() AND x.horas IS NOT NULL
   GROUP BY i.template_id, i.id, i.nome, i.horas_previstas
$$;

-- ---------- Status da execução para o dashboard Comercial (somente status/progresso/datas) ----------
CREATE OR REPLACE FUNCTION public.status_execucao_contratos(p_apontamento_ids uuid[] DEFAULT NULL)
RETURNS TABLE (apontamento_id uuid, status_execucao text, progresso int, inicio_previsto date, entrega_prevista date,
               entregue_em date, saude text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id,
         CASE WHEN o.id IS NOT NULL THEN o.status
              WHEN ig.apontamento_id IS NOT NULL THEN 'nao_planejado'
              WHEN ts.equipe_responsavel = 'orcamentos' THEN 'outra_equipe'
              ELSE 'aguardando_planejamento' END,
         o.progresso_geral, COALESCE(o.data_inicio_prevista, a.cronograma_data_inicio),
         COALESCE(o.data_fim_prevista, a.cronograma_data_termino), o.data_fim_real, s.saude
    FROM public.apontamentos_comerciais a
    LEFT JOIN public.execucao_tipos_servico ts ON public.execucao_norm(a.tipo_oportunidade) = ANY (ts.termos_comercial)
    LEFT JOIN public.execucao_obras o ON o.apontamento_id = a.id
    LEFT JOIN public.execucao_contratos_ignorados ig ON ig.apontamento_id = a.id
    LEFT JOIN public.execucao_saude_core() s ON s.obra_id = o.id
   WHERE public.current_usuario_id() IS NOT NULL
     AND a.fase = 'CONTRATO/VENDA'
     AND (p_apontamento_ids IS NULL OR a.id = ANY (p_apontamento_ids))
$$;

-- ---------- Permissões ----------
REVOKE ALL ON FUNCTION public.execucao_contratos_pendentes(boolean, text), public.execucao_contar_contratos_pendentes(),
  public.criar_obra_completa(jsonb, jsonb, boolean), public.deslocar_etapas(uuid, int, int, boolean),
  public.execucao_saude_core(), public.execucao_saude_obras(), public.execucao_painel_carteira(),
  public.execucao_indicadores(date, date), public.execucao_media_realizada_templates(),
  public.status_execucao_contratos(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execucao_contratos_pendentes(boolean, text), public.execucao_contar_contratos_pendentes(),
  public.criar_obra_completa(jsonb, jsonb, boolean), public.deslocar_etapas(uuid, int, int, boolean),
  public.execucao_saude_obras(), public.execucao_painel_carteira(),
  public.execucao_indicadores(date, date), public.execucao_media_realizada_templates(),
  public.status_execucao_contratos(uuid[]) TO authenticated;
