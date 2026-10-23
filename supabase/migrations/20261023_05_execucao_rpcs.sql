-- 05: RPC de status v2, progresso ponderado, jornadas/capacidade, horas extras, evidências, material, notificações

-- ---------- Notificações: destinatário opcional e novos tipos ----------
ALTER TABLE public.execucao_notificacoes
  ADD COLUMN IF NOT EXISTS destinatario_id uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS referencia jsonb;
ALTER TABLE public.execucao_notificacoes DROP CONSTRAINT IF EXISTS execucao_notificacoes_tipo_check;
ALTER TABLE public.execucao_notificacoes ADD CONSTRAINT execucao_notificacoes_tipo_check
  CHECK (tipo IN ('pausa', 'conclusao', 'pendente', 'atraso', 'retomada', 'urgente',
                  'material', 'hora_extra', 'replanejamento', 'transferencia', 'pendencia'));
CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON public.execucao_notificacoes (destinatario_id, lida, created_at DESC);

CREATE POLICY notif_tecnico_select ON public.execucao_notificacoes FOR SELECT TO authenticated
  USING (destinatario_id IS NOT NULL AND destinatario_id = (SELECT public.current_usuario_id()));
CREATE POLICY notif_tecnico_update ON public.execucao_notificacoes FOR UPDATE TO authenticated
  USING (destinatario_id IS NOT NULL AND destinatario_id = (SELECT public.current_usuario_id()))
  WITH CHECK (destinatario_id IS NOT NULL AND destinatario_id = (SELECT public.current_usuario_id()));

-- ---------- Idempotência de ações vindas do celular (fila offline) ----------
CREATE TABLE IF NOT EXISTS public.execucao_acoes_cliente (
  id uuid PRIMARY KEY,
  usuario_id uuid,
  tipo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.execucao_acoes_cliente ENABLE ROW LEVEL SECURITY;  -- sem políticas: só funções SECURITY DEFINER

-- ---------- Progresso da obra ponderado (por horas previstas ou duração) ----------
CREATE OR REPLACE FUNCTION public.execucao_recalcular_progresso_obra(p_obra uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog int; v_total int; v_conc int;
BEGIN
  SELECT round(sum(COALESCE(s.progresso, 0) * s.w) / NULLIF(sum(s.w), 0))::int, count(*), count(*) FILTER (WHERE s.status = 'concluida')
    INTO v_prog, v_total, v_conc
    FROM (SELECT progresso, status,
                 GREATEST(COALESCE(NULLIF(horas_previstas, 0), (data_fim - data_inicio + 1))::numeric, 1) AS w
            FROM public.execucao_obras_etapas WHERE obra_id = p_obra AND status <> 'cancelada') s;
  IF COALESCE(v_total, 0) > 0 THEN
    UPDATE public.execucao_obras
       SET progresso_geral = LEAST(100, GREATEST(0, COALESCE(v_prog, 0))),
           data_fim_real = CASE WHEN v_conc = v_total THEN COALESCE(data_fim_real, current_date) ELSE data_fim_real END,
           status = CASE WHEN v_conc = v_total AND status <> 'cancelada' THEN 'concluida' ELSE status END,
           updated_at = now()
     WHERE id = p_obra;
  END IF;
END $$;

-- ---------- alterar_status_atividade v2 (compatível com a chamada antiga de 3 parâmetros) ----------
DROP FUNCTION IF EXISTS public.alterar_status_atividade(uuid, text, text);

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
  v_etapa uuid; v_obra uuid; v_quando timestamptz; v_dia date;
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
      UPDATE public.execucao_obras_etapas
         SET progresso = 100, status = 'concluida', data_fim_real = v_dia, updated_at = now()
       WHERE id = v_etapa;
    END IF;
    PERFORM public.execucao_recalcular_progresso_obra(v_obra);
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;

-- ---------- Jornadas, ausências e capacidade ----------
CREATE TABLE IF NOT EXISTS public.execucao_jornadas_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vigente_desde date NOT NULL,
  periodos jsonb NOT NULL,
  descontos jsonb NOT NULL DEFAULT '[]',
  horas_extra_max_dia numeric(4,2) NOT NULL DEFAULT 2,
  cidade_base_id uuid REFERENCES public.execucao_cidades(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (nome, vigente_desde)
);
INSERT INTO public.execucao_jornadas_modelo (nome, vigente_desde, periodos, descontos, horas_extra_max_dia)
VALUES ('Padrão Execução', DATE '2020-01-01',
  '{"seg":[["07:00","12:00"],["13:15","17:00"]],"ter":[["07:00","12:00"],["13:15","17:00"]],"qua":[["07:00","12:00"],["13:15","17:00"]],"qui":[["07:00","12:00"],["13:15","17:00"]],"sex":[["07:00","12:00"],["13:15","17:00"]],"sab":[],"dom":[]}'::jsonb,
  '[]'::jsonb, 2)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.execucao_jornadas_colaborador (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  vigente_desde date NOT NULL,
  modelo_nome text NOT NULL,
  ajuste_minutos_dia int NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, vigente_desde)
);

CREATE TABLE IF NOT EXISTS public.execucao_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ferias', 'atestado', 'treinamento', 'folga', 'outro')),
  horas_por_dia numeric(4,2),
  observacao text,
  created_at timestamptz DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);
CREATE INDEX IF NOT EXISTS idx_ausencias_usuario ON public.execucao_ausencias (usuario_id, data_inicio, data_fim);

CREATE OR REPLACE FUNCTION public.execucao_min_dia(p_periodos jsonb, p_chave text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(sum(EXTRACT(EPOCH FROM ((e->>1)::time - (e->>0)::time)) / 60), 0)::int
    FROM jsonb_array_elements(COALESCE(p_periodos -> p_chave, '[]'::jsonb)) e
$$;

CREATE OR REPLACE FUNCTION public.execucao_jornada_dia(p_usuario uuid, p_data date)
RETURNS TABLE (minutos_liquidos int, extra_max_min int, dia_util boolean, feriado boolean, ausente boolean, cidade_id uuid)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_modelo text; v_ajuste int; m public.execucao_jornadas_modelo; v_chave text;
  v_bruto int; v_desc int; v_liq int; v_fer boolean; v_aus boolean := false; v_horas_aus numeric;
BEGIN
  SELECT c.modelo_nome, c.ajuste_minutos_dia INTO v_modelo, v_ajuste
    FROM public.execucao_jornadas_colaborador c
   WHERE c.usuario_id = p_usuario AND c.vigente_desde <= p_data ORDER BY c.vigente_desde DESC LIMIT 1;
  v_modelo := COALESCE(v_modelo, 'Padrão Execução'); v_ajuste := COALESCE(v_ajuste, 0);

  SELECT * INTO m FROM public.execucao_jornadas_modelo
   WHERE nome = v_modelo AND vigente_desde <= p_data ORDER BY vigente_desde DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, false, false, false, NULL::uuid; RETURN;
  END IF;

  v_chave := (ARRAY['seg','ter','qua','qui','sex','sab','dom'])[EXTRACT(ISODOW FROM p_data)::int];
  v_bruto := public.execucao_min_dia(m.periodos, v_chave);
  SELECT COALESCE(sum((d->>'minutos')::int), 0) INTO v_desc FROM jsonb_array_elements(m.descontos) d;
  v_liq := CASE WHEN v_bruto > 0 THEN GREATEST(0, v_bruto - v_desc + v_ajuste) ELSE 0 END;
  v_fer := public.execucao_eh_feriado(p_data, m.cidade_base_id);
  IF v_fer THEN v_liq := 0; END IF;

  IF EXISTS (SELECT 1 FROM public.execucao_ausencias a
              WHERE a.usuario_id = p_usuario AND p_data BETWEEN a.data_inicio AND a.data_fim AND a.horas_por_dia IS NULL) THEN
    v_aus := true; v_liq := 0;
  ELSE
    SELECT COALESCE(sum(a.horas_por_dia), 0) INTO v_horas_aus FROM public.execucao_ausencias a
     WHERE a.usuario_id = p_usuario AND p_data BETWEEN a.data_inicio AND a.data_fim;
    v_liq := GREATEST(0, v_liq - (v_horas_aus * 60)::int);
  END IF;

  RETURN QUERY SELECT v_liq,
    CASE WHEN v_bruto > 0 AND NOT v_fer THEN (m.horas_extra_max_dia * 60)::int ELSE 0 END,
    (v_bruto > 0 AND NOT v_fer), v_fer, v_aus, m.cidade_base_id;
END $$;

-- Capacidade x demanda por colaborador e dia (usuario_id NULL = atividades sem técnico)
CREATE OR REPLACE FUNCTION public.execucao_capacidade(p_inicio date, p_fim date)
RETURNS TABLE (usuario_id uuid, data date, disponivel_min int, extra_max_min int, previsto_min int, realizado_min int,
               atividades int, dia_util boolean, feriado boolean, ausente boolean)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH atv AS (
    SELECT a.id, a.data_programada d1, COALESCE(a.data_fim, a.data_programada) d2,
           COALESCE(a.horas_previstas, 0) h, a.status, a.horas_realizadas hr
      FROM public.execucao_atividades a
     WHERE a.status <> 'cancelada' AND a.data_programada <= p_fim AND COALESCE(a.data_fim, a.data_programada) >= p_inicio
  ),
  atv_dias AS (
    SELECT a.id, g::date d, a.h, a.d1, a.status, a.hr
      FROM atv a, generate_series(a.d1, a.d2, interval '1 day') g
  ),
  atv_util AS (SELECT id, count(*) FILTER (WHERE public.execucao_dia_util(d)) k FROM atv_dias GROUP BY id),
  atv_alloc AS (
    SELECT ad.id, ad.d, ad.status, ad.h, ad.hr,
           CASE WHEN u.k > 0 THEN CASE WHEN public.execucao_dia_util(ad.d) THEN ad.h * 60.0 / u.k ELSE 0 END
                ELSE CASE WHEN ad.d = ad.d1 THEN ad.h * 60.0 ELSE 0 END END AS minutos
      FROM atv_dias ad JOIN atv_util u USING (id)
     WHERE ad.d BETWEEN p_inicio AND p_fim
  ),
  part AS (
    SELECT a.id, e.usuario_id, count(*) OVER (PARTITION BY a.id) n, e.horas_previstas h_ind, a.h
      FROM atv a LEFT JOIN public.execucao_atividades_equipe e ON e.atividade_id = a.id
  ),
  por_user AS (
    SELECT p.usuario_id, aa.d,
           sum(aa.minutos * COALESCE(p.h_ind / NULLIF(p.h, 0), 1.0 / p.n)) AS previsto,
           sum(CASE WHEN aa.status = 'concluida'
                    THEN aa.minutos * COALESCE(aa.hr / NULLIF(aa.h, 0), 1.0) * COALESCE(p.h_ind / NULLIF(p.h, 0), 1.0 / p.n)
                    ELSE 0 END) AS realizado,
           count(DISTINCT aa.id) AS qtd
      FROM atv_alloc aa JOIN part p ON p.id = aa.id
     GROUP BY p.usuario_id, aa.d
  ),
  usuarios_base AS (
    SELECT u.id FROM public.usuarios u
      JOIN public.niveis_acesso na ON na.id = u.nivel_acesso_id
     WHERE u.ativo AND na.nome = 'TECNICO'
    UNION SELECT pu.usuario_id FROM por_user pu WHERE pu.usuario_id IS NOT NULL
  ),
  dias AS (SELECT g::date d FROM generate_series(p_inicio, p_fim, interval '1 day') g)
  SELECT ub.id, dias.d, j.minutos_liquidos, j.extra_max_min,
         COALESCE(pu.previsto, 0)::int, COALESCE(pu.realizado, 0)::int, COALESCE(pu.qtd, 0)::int,
         j.dia_util, j.feriado, j.ausente
    FROM usuarios_base ub CROSS JOIN dias
    CROSS JOIN LATERAL public.execucao_jornada_dia(ub.id, dias.d) j
    LEFT JOIN por_user pu ON pu.usuario_id = ub.id AND pu.d = dias.d
  UNION ALL
  SELECT NULL::uuid, pu.d, 0, 0, pu.previsto::int, pu.realizado::int, pu.qtd::int,
         public.execucao_dia_util(pu.d), public.execucao_eh_feriado(pu.d), false
    FROM por_user pu WHERE pu.usuario_id IS NULL
$$;

-- ---------- Horas extras e emergências ----------
CREATE TABLE IF NOT EXISTS public.execucao_horas_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  atividade_id uuid REFERENCES public.execucao_atividades(id) ON DELETE SET NULL,
  data date NOT NULL,
  horas numeric(5,2) NOT NULL CHECK (horas > 0),
  tipo text NOT NULL CHECK (tipo IN ('extra_planejada', 'extra_realizada', 'emergencia')),
  justificativa text NOT NULL CHECK (length(btrim(justificativa)) >= 5),
  registrado_por uuid NOT NULL REFERENCES public.usuarios(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'cancelada')),
  justificativa_decisao text,
  decidido_por uuid REFERENCES public.usuarios(id),
  decidido_em timestamptz,
  autoaprovado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'pendente' OR (decidido_por IS NOT NULL AND length(btrim(COALESCE(justificativa_decisao, ''))) >= 5))
);
CREATE INDEX IF NOT EXISTS idx_horas_extras_status ON public.execucao_horas_extras (status, data);
CREATE INDEX IF NOT EXISTS idx_horas_extras_usuario ON public.execucao_horas_extras (usuario_id, data);

CREATE OR REPLACE FUNCTION public.decidir_horas_extras(p_ids uuid[], p_aprovar boolean, p_justificativa text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id(); v_n int;
BEGIN
  IF NOT public.is_admin_execucao() OR v_uid IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF length(btrim(COALESCE(p_justificativa, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa da decisão'; END IF;

  WITH upd AS (
    UPDATE public.execucao_horas_extras h
       SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'cancelada' END,
           justificativa_decisao = btrim(p_justificativa), decidido_por = v_uid, decidido_em = now(),
           autoaprovado = (h.registrado_por = v_uid)
     WHERE h.id = ANY (p_ids) AND h.status = 'pendente'
     RETURNING h.id, h.registrado_por, h.data, h.horas, h.tipo
  ), nt AS (
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, destinatario_id, usuario_origem_id, referencia)
    SELECT 'hora_extra',
           CASE WHEN p_aprovar THEN '✅ Hora extra aprovada' ELSE '❌ Hora extra cancelada' END,
           format('%s de %sh em %s: %s', CASE u.tipo WHEN 'emergencia' THEN 'Emergência' ELSE 'Hora extra' END, u.horas,
                  to_char(u.data, 'DD/MM/YYYY'), btrim(p_justificativa)),
           u.registrado_por, v_uid, jsonb_build_object('horas_extra_id', u.id)
      FROM upd u WHERE u.registrado_por <> v_uid
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM upd;
  RETURN v_n;
END $$;

-- ---------- Evidências (foto/vídeo/áudio/checklist) ----------
CREATE TABLE IF NOT EXISTS public.execucao_atividades_evidencias (
  id uuid PRIMARY KEY,
  atividade_id uuid NOT NULL REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('foto', 'video', 'audio', 'checklist', 'observacao')),
  caminho_storage text,
  caminho_miniatura text,
  mime_type text,
  tamanho_original_bytes bigint,
  tamanho_bytes bigint,
  duracao_segundos int,
  comprimido boolean NOT NULL DEFAULT false,
  conteudo jsonb,
  capturado_em timestamptz,
  latitude numeric(9,6),
  longitude numeric(9,6),
  precisao_metros numeric(7,1),
  criado_por uuid REFERENCES public.usuarios(id),
  excluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidencias_atividade ON public.execucao_atividades_evidencias (atividade_id, created_at DESC);

ALTER TABLE public.execucao_jornadas_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucao_jornadas_colaborador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucao_ausencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucao_horas_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucao_atividades_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY jm_read ON public.execucao_jornadas_modelo FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY jm_admin ON public.execucao_jornadas_modelo FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY jc_admin ON public.execucao_jornadas_colaborador FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY jc_self ON public.execucao_jornadas_colaborador FOR SELECT TO authenticated
  USING (usuario_id = (SELECT public.current_usuario_id()));
CREATE POLICY aus_admin ON public.execucao_ausencias FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY aus_self ON public.execucao_ausencias FOR SELECT TO authenticated
  USING (usuario_id = (SELECT public.current_usuario_id()));
CREATE POLICY he_admin ON public.execucao_horas_extras FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY he_self_select ON public.execucao_horas_extras FOR SELECT TO authenticated
  USING (usuario_id = (SELECT public.current_usuario_id()) OR registrado_por = (SELECT public.current_usuario_id()));
CREATE POLICY he_self_insert ON public.execucao_horas_extras FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT public.current_usuario_id()) AND registrado_por = (SELECT public.current_usuario_id())
              AND status = 'pendente');
CREATE POLICY ev_admin ON public.execucao_atividades_evidencias FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY ev_tecnico_select ON public.execucao_atividades_evidencias FOR SELECT TO authenticated
  USING (excluido_em IS NULL AND (SELECT public.execucao_participa(atividade_id)));
CREATE POLICY ev_tecnico_insert ON public.execucao_atividades_evidencias FOR INSERT TO authenticated
  WITH CHECK (criado_por = (SELECT public.current_usuario_id()) AND (SELECT public.execucao_participa(atividade_id)));

-- Bucket privado das evidências (limite de 50 MB do plano gratuito) e políticas de Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('atividades-evidencias', 'atividades-evidencias', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

CREATE OR REPLACE FUNCTION public.execucao_participa_path(p_nome text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.execucao_participa(split_part(p_nome, '/', 1)::uuid);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;

CREATE POLICY evid_admin_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'atividades-evidencias' AND (SELECT public.is_admin_execucao()))
  WITH CHECK (bucket_id = 'atividades-evidencias' AND (SELECT public.is_admin_execucao()));
CREATE POLICY evid_tecnico_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'atividades-evidencias' AND (SELECT public.execucao_participa_path(name)));
CREATE POLICY evid_tecnico_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atividades-evidencias' AND (SELECT public.execucao_participa_path(name)));

-- ---------- Material: situação para o técnico, falta de material, aviso de chegada ----------
CREATE OR REPLACE FUNCTION public.execucao_material_status(p_atividade_ids uuid[])
RETURNS TABLE (atividade_id uuid, situacao text, data_disponivel date, pedidos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT a.id, e.obra_id
      FROM public.execucao_atividades a
      LEFT JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
     WHERE a.id = ANY (p_atividade_ids)
       AND (public.is_admin_execucao() OR a.tecnico_responsavel_id = public.current_usuario_id() OR public.execucao_participa(a.id))
  ), ped AS (
    SELECT b.id AS atividade_id, p.status, p.data_material_disponivel
      FROM base b
      JOIN public.execucao_pedidos_material p
        ON (b.obra_id IS NOT NULL AND p.obra_id = b.obra_id) OR p.atividade_id = b.id
     WHERE p.status NOT IN ('cancelado', 'recusado')
  )
  SELECT b.id,
         CASE WHEN count(p.atividade_id) = 0 THEN 'sem_pedido'
              WHEN bool_or(p.status = 'entregue' OR (p.data_material_disponivel IS NOT NULL AND p.data_material_disponivel <= current_date)) THEN 'disponivel'
              WHEN bool_or(p.data_material_disponivel IS NOT NULL) THEN 'previsto'
              ELSE 'pendente' END,
         min(p.data_material_disponivel) FILTER (WHERE p.data_material_disponivel > current_date),
         count(p.atividade_id)::int
    FROM base b LEFT JOIN ped p ON p.atividade_id = b.id
   GROUP BY b.id
$$;

CREATE OR REPLACE FUNCTION public.reportar_falta_material(
  p_atividade_id uuid, p_descricao text, p_pausar boolean DEFAULT true,
  p_ocorrido_em timestamptz DEFAULT NULL, p_id_cliente uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); a public.execucao_atividades; v_obra uuid; v_pedido uuid;
  v_nome text; v_cliente text; v_end text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF length(btrim(COALESCE(p_descricao, ''))) < 3 THEN RAISE EXCEPTION 'Descreva o material que falta'; END IF;
  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_atividade_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  IF NOT (public.is_admin_execucao() OR a.tecnico_responsavel_id = v_uid OR public.execucao_participa(p_atividade_id)) THEN
    RAISE EXCEPTION 'Sem permissão para esta atividade';
  END IF;

  IF p_id_cliente IS NOT NULL THEN
    INSERT INTO public.execucao_acoes_cliente (id, usuario_id, tipo) VALUES (p_id_cliente, v_uid, 'falta_material')
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      SELECT p.id INTO v_pedido FROM public.execucao_pedidos_material p
       WHERE p.atividade_id = p_atividade_id AND p.solicitante_id = v_uid ORDER BY p.created_at DESC LIMIT 1;
      RETURN v_pedido;
    END IF;
  END IF;

  SELECT e.obra_id INTO v_obra FROM public.execucao_obras_etapas e WHERE e.id = a.etapa_id;
  SELECT COALESCE(nome_completo, 'Técnico') INTO v_nome FROM public.usuarios WHERE id = v_uid;
  v_cliente := a.cliente_nome; v_end := a.endereco;

  INSERT INTO public.execucao_pedidos_material
    (atividade_id, solicitante_id, descricao, itens, status, urgencia, observacoes, obra_id, etapa_id, cliente_nome, endereco_obra)
  VALUES (p_atividade_id, v_uid, format('Falta de material - %s', a.titulo), '[]'::jsonb, 'pendente', 'alta',
          format('Reportado em campo por %s: %s', v_nome, btrim(p_descricao)), v_obra, a.etapa_id, v_cliente, v_end)
  RETURNING id INTO v_pedido;

  INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, usuario_origem_id, referencia)
  VALUES ('material', '📦 Falta de material', format('%s: "%s" — %s', v_nome, a.titulo, btrim(p_descricao)),
          p_atividade_id, v_uid, jsonb_build_object('pedido_id', v_pedido));

  IF p_pausar AND a.status IN ('pendente', 'em_andamento') THEN
    PERFORM public.alterar_status_atividade(p_atividade_id, 'pausada', 'Falta de material: ' || btrim(p_descricao),
                                            p_ocorrido_em, NULL, 'falta_material', false, NULL);
  END IF;
  RETURN v_pedido;
END $$;

-- Avisa os técnicos quando o material de uma obra fica disponível (nunca bloqueia a gravação do pedido)
CREATE OR REPLACE FUNCTION public.execucao_avisar_material() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.obra_id IS NOT NULL AND (
         (NEW.data_material_disponivel IS NOT NULL AND NEW.data_material_disponivel IS DISTINCT FROM OLD.data_material_disponivel)
      OR (NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue')) THEN
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, referencia)
      SELECT DISTINCT 'material', '📦 Material disponível',
             format('Material da obra %s: %s', COALESCE(NEW.cliente_nome, ''),
                    CASE WHEN NEW.status = 'entregue' THEN 'entregue' ELSE 'previsto para ' || to_char(NEW.data_material_disponivel, 'DD/MM') END),
             at.id, eq.usuario_id, jsonb_build_object('pedido_id', NEW.id)
        FROM public.execucao_atividades at
        JOIN public.execucao_obras_etapas et ON et.id = at.etapa_id
        JOIN public.execucao_atividades_equipe eq ON eq.atividade_id = at.id
       WHERE et.obra_id = NEW.obra_id AND at.status IN ('pendente', 'em_andamento', 'pausada');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_avisar_material ON public.execucao_pedidos_material;
CREATE TRIGGER trg_avisar_material AFTER UPDATE ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_avisar_material();

-- ---------- Permissões das funções ----------
REVOKE ALL ON FUNCTION public.execucao_recalcular_progresso_obra(uuid),
  public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric),
  public.execucao_min_dia(jsonb, text), public.execucao_jornada_dia(uuid, date),
  public.execucao_capacidade(date, date), public.decidir_horas_extras(uuid[], boolean, text),
  public.execucao_participa_path(text), public.execucao_material_status(uuid[]),
  public.reportar_falta_material(uuid, text, boolean, timestamptz, uuid), public.execucao_avisar_material() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric),
  public.execucao_min_dia(jsonb, text), public.execucao_jornada_dia(uuid, date),
  public.execucao_capacidade(date, date), public.decidir_horas_extras(uuid[], boolean, text),
  public.execucao_participa_path(text), public.execucao_material_status(uuid[]),
  public.reportar_falta_material(uuid, text, boolean, timestamptz, uuid),
  public.execucao_recalcular_progresso_obra(uuid) TO authenticated;
