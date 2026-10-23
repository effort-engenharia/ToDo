-- RPCs atômicas, agregações e índices do módulo de execução

-- Altera status + histórico + notificação + etapa vinculada em uma única transação
CREATE OR REPLACE FUNCTION public.alterar_status_atividade(
  p_id uuid, p_status text, p_motivo text DEFAULT NULL
) RETURNS public.execucao_atividades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  a public.execucao_atividades;
  v_old text;
  v_tecnico text;
  v_tipo_acao text := 'status_alterado';
  v_desc text := 'Status alterado para ' || p_status;
  v_notif_tipo text; v_notif_titulo text; v_notif_msg text;
  v_etapa uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  IF NOT (public.is_admin_execucao() OR a.tecnico_responsavel_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta atividade';
  END IF;

  v_old := a.status;
  SELECT COALESCE(nome_completo, 'Técnico') INTO v_tecnico
    FROM public.usuarios WHERE id = a.tecnico_responsavel_id;
  v_tecnico := COALESCE(v_tecnico, 'Técnico');

  UPDATE public.execucao_atividades SET status = p_status, updated_at = now()
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
    v_notif_msg := format('%s pausou a atividade "%s"%s', v_tecnico, a.titulo,
                          CASE WHEN p_motivo IS NOT NULL THEN '. Motivo: ' || p_motivo ELSE '' END);
  ELSIF p_status = 'em_andamento' AND v_old = 'pausada' THEN
    v_tipo_acao := 'retomada'; v_desc := 'Atividade retomada';
    v_notif_tipo := 'retomada'; v_notif_titulo := '▶️ Atividade Retomada';
    v_notif_msg := format('%s retomou a atividade "%s"', v_tecnico, a.titulo);
  ELSIF p_status = 'pendente' THEN
    v_notif_tipo := 'pendente'; v_notif_titulo := '📋 Atividade Pendente';
    v_notif_msg := format('A atividade "%s" foi marcada como pendente', a.titulo);
  END IF;

  INSERT INTO public.execucao_atividades_historico
    (atividade_id, usuario_id, tipo_acao, descricao, valor_anterior, valor_novo)
  VALUES (p_id, v_uid, v_tipo_acao, v_desc, v_old, p_status);

  IF v_notif_tipo IS NOT NULL THEN
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, usuario_origem_id)
    VALUES (v_notif_tipo, v_notif_titulo, v_notif_msg, p_id, v_uid);
  END IF;

  IF p_status = 'concluida' THEN
    v_etapa := a.etapa_id;
    IF v_etapa IS NULL THEN
      -- Vínculo legado: etapa com mesmo nome na obra do mesmo cliente
      SELECT e.id INTO v_etapa
        FROM public.execucao_obras_etapas e
        JOIN public.execucao_obras o ON o.id = e.obra_id
       WHERE e.nome = a.titulo AND o.nome_cliente = a.cliente_nome
       LIMIT 1;
      IF v_etapa IS NOT NULL THEN
        UPDATE public.execucao_atividades SET etapa_id = v_etapa WHERE id = p_id;
      END IF;
    END IF;

    IF v_etapa IS NOT NULL THEN
      UPDATE public.execucao_obras_etapas
         SET progresso = 100, status = 'concluida', updated_at = now()
       WHERE id = v_etapa;
      UPDATE public.execucao_obras o
         SET progresso_geral = sub.media, updated_at = now()
        FROM (SELECT obra_id, round(avg(COALESCE(progresso, 0)))::int AS media
                FROM public.execucao_obras_etapas
               WHERE obra_id = (SELECT obra_id FROM public.execucao_obras_etapas WHERE id = v_etapa)
               GROUP BY obra_id) sub
       WHERE o.id = sub.obra_id;
    END IF;
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;

-- Notificações de atraso em lote (idempotente por atividade/dia)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_atraso_dia
  ON public.execucao_notificacoes (atividade_id, ((created_at AT TIME ZONE 'America/Sao_Paulo')::date))
  WHERE tipo = 'atraso';

CREATE OR REPLACE FUNCTION public.gerar_notificacoes_atraso()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_n integer;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  WITH ins AS (
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, usuario_origem_id)
    SELECT 'atraso', '⚠️ Atividade em Atraso',
           format('A atividade "%s" (%s) está atrasada desde %s', a.titulo,
                  COALESCE(u.nome_completo, 'Sem técnico'), to_char(a.data_programada, 'DD/MM/YYYY')),
           a.id, NULL
      FROM public.execucao_atividades a
      LEFT JOIN public.usuarios u ON u.id = a.tecnico_responsavel_id
     WHERE a.data_programada < v_hoje AND a.status IN ('pendente', 'em_andamento', 'pausada')
    ON CONFLICT DO NOTHING
    RETURNING 1)
  SELECT count(*) INTO v_n FROM ins;
  RETURN v_n;
END $$;

-- Agregação para desempenho (evita o limite de 1.000 linhas e reduz payload). SECURITY INVOKER: respeita RLS.
CREATE OR REPLACE FUNCTION public.execucao_atividades_agregado(
  p_inicio date, p_fim date, p_tecnico uuid DEFAULT NULL
) RETURNS TABLE (data_programada date, tipo_execucao text, status text, tecnico_id uuid, total bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT a.data_programada, a.tipo_execucao::text, a.status::text, a.tecnico_responsavel_id, count(*)
    FROM public.execucao_atividades a
   WHERE a.data_programada BETWEEN p_inicio AND p_fim
     AND (p_tecnico IS NULL OR a.tecnico_responsavel_id = p_tecnico)
   GROUP BY 1, 2, 3, 4
$$;

REVOKE ALL ON FUNCTION public.alterar_status_atividade(uuid, text, text),
  public.gerar_notificacoes_atraso(), public.execucao_atividades_agregado(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_status_atividade(uuid, text, text),
  public.gerar_notificacoes_atraso(), public.execucao_atividades_agregado(date, date, uuid) TO authenticated;

-- Índices compostos para os filtros mais usados
CREATE INDEX IF NOT EXISTS idx_atv_tecnico_data ON public.execucao_atividades (tecnico_responsavel_id, data_programada);
CREATE INDEX IF NOT EXISTS idx_atv_tipo_data ON public.execucao_atividades (tipo_execucao, data_programada);
CREATE INDEX IF NOT EXISTS idx_atv_status_data ON public.execucao_atividades (status, data_programada);
CREATE INDEX IF NOT EXISTS idx_hist_atv_created ON public.execucao_atividades_historico (atividade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_created ON public.execucao_pedidos_material (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_obra ON public.execucao_pedidos_material (obra_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida_created ON public.execucao_notificacoes (lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pops_cat_ativo_ordem ON public.execucao_pops (categoria, ativo, ordem);
