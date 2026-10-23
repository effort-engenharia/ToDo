-- 09: correção — criar_obra_completa (SECURITY INVOKER) chamava execucao_recalcular_progresso_obra, que a 08 revogou de authenticated.
-- Passa a chamar execucao_recalcular_progresso (admin-only, SECURITY DEFINER). Único ajuste: a última chamada antes do RETURN.

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

REVOKE ALL ON FUNCTION public.criar_obra_completa(jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_obra_completa(jsonb, jsonb, boolean) TO authenticated;
