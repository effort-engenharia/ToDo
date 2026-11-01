-- 20 (B2 · R11/R12 · D10/D11 · N1-d/N1-e/N1-f/N1-g): conclusão do técnico no servidor.
--
-- Objetivo:
--   * Observação de conclusão (opcional, até 1.000 caracteres), horário da conclusão decidido no servidor (D11) e
--     geolocalização do instante do clique (nunca bloqueia: 'negada' fica registrada).
--   * Horas realizadas CALCULADAS NO SERVIDOR (N1-d): soma dos intervalos em andamento (início/retomada → pausa/conclusão)
--     do histórico, recortados por dia (fuso America/Sao_Paulo) e com TETO DIÁRIO pela jornada líquida do técnico
--     (execucao_jornada_dia: minutos_liquidos; dia sem jornada = 0; CORRIGIDO na mig. 31, o 1º teste real mostrou que somar o extra e o fallback de 480 min
--     contava fins de semana). Cada intervalo em andamento conta
--     no máximo 60 dias e só os dias cobertos entram na conta (proteção contra atividade esquecida em andamento / relógio errado). Concluir sem "Iniciar"
--     (nenhum intervalo) usa as horas PREVISTAS (P2). Ajuste da gestão (p_horas_realizadas ou UPDATE direto de admin)
--     marca horas_ajustadas e fica registrado no histórico.
--   * DATA DE CORTE (quebra de série, N1-d ressalva 1): execucao_atividades.horas_origem ∈ previstas | intervalos |
--     ajuste_admin | ajuste_tecnico. Conclusões anteriores a esta migration ficam com horas_origem NULL (histórico antigo,
--     "previsto salvo ajuste"); execucao_horas_data_corte() devolve o instante da 1ª conclusão com origem gravada.
--     Calibração/desvio devem filtrar por horas_origem IS NOT NULL para não misturar as duas séries.
--   * alterar_status_atividade: DROP das assinaturas antigas e CREATE com UMA assinatura (13 parâmetros; os novos têm
--     DEFAULT NULL, então o payload antigo da fila offline continua válido). Parte da versão da mig. 19 (sem cascata).
--   * Concluir com passos em aberto NÃO bloqueia (N1-g): o histórico registra "com N passo(s) em aberto"; a confirmação é do front.
--
-- Depende da 20261101_19 (aplicar logo depois, na mesma janela).
--
-- ROLLBACK:
--   -- 1) Reaplicar a função da mig. 19 (versão de 8 parâmetros):
--   --    DROP FUNCTION IF EXISTS public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric, text, numeric, numeric, numeric, text);
--   --    e rodar o bloco "3. alterar_status_atividade" de supabase/migrations/20261101_19_execucao_subetapas_conclusao.sql
--   --    (inclui REVOKE/GRANT). Fazer isto ANTES de remover colunas.
--   -- 2) DROP TRIGGER IF EXISTS trg_horas_marcar_ajuste ON public.execucao_atividades;
--   --    DROP FUNCTION IF EXISTS public.execucao_horas_marcar_ajuste();
--   --    DROP FUNCTION IF EXISTS public.execucao_horas_data_corte();
--   --    DROP FUNCTION IF EXISTS public.execucao_horas_efetivas(uuid, timestamptz);
--   --    DROP FUNCTION IF EXISTS public.execucao_horas_efetivas_calc(uuid, timestamptz);
--   -- 3) SÓ DEPOIS de exportar os dados (observação, geolocalização e origem das horas):
--   --    ALTER TABLE public.execucao_atividades DROP COLUMN IF EXISTS observacao_conclusao, DROP COLUMN IF EXISTS conclusao_latitude,
--   --      DROP COLUMN IF EXISTS conclusao_longitude, DROP COLUMN IF EXISTS conclusao_precisao_m, DROP COLUMN IF EXISTS conclusao_geo_status,
--   --      DROP COLUMN IF EXISTS conclusao_registrada_em, DROP COLUMN IF EXISTS conclusao_origem_horario, DROP COLUMN IF EXISTS horas_origem;

-- ---------- Colunas novas (todas opcionais) ----------
ALTER TABLE public.execucao_atividades
  ADD COLUMN IF NOT EXISTS observacao_conclusao text,
  ADD COLUMN IF NOT EXISTS conclusao_latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS conclusao_longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS conclusao_precisao_m numeric(7,1),
  ADD COLUMN IF NOT EXISTS conclusao_geo_status text,
  ADD COLUMN IF NOT EXISTS conclusao_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS conclusao_origem_horario text,
  ADD COLUMN IF NOT EXISTS horas_origem text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execucao_atividades_conclusao_geo_status_check') THEN
    ALTER TABLE public.execucao_atividades ADD CONSTRAINT execucao_atividades_conclusao_geo_status_check
      CHECK (conclusao_geo_status IS NULL OR conclusao_geo_status IN ('ok', 'negada', 'indisponivel', 'tempo_esgotado', 'nao_suportado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execucao_atividades_conclusao_origem_horario_check') THEN
    ALTER TABLE public.execucao_atividades ADD CONSTRAINT execucao_atividades_conclusao_origem_horario_check
      CHECK (conclusao_origem_horario IS NULL OR conclusao_origem_horario IN ('servidor', 'dispositivo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execucao_atividades_horas_origem_check') THEN
    ALTER TABLE public.execucao_atividades ADD CONSTRAINT execucao_atividades_horas_origem_check
      CHECK (horas_origem IS NULL OR horas_origem IN ('previstas', 'intervalos', 'ajuste_admin', 'ajuste_tecnico'));
  END IF;
END $$;

-- ---------- Horas efetivas (intervalos em andamento, teto diário pela jornada) ----------
CREATE OR REPLACE FUNCTION public.execucao_horas_efetivas_calc(p_atividade uuid, p_fim timestamptz DEFAULT now())
RETURNS TABLE (horas numeric, origem text)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_tec uuid; v_prev numeric; v_tem boolean; v_min numeric;
BEGIN
  SELECT a.tecnico_responsavel_id, a.horas_previstas INTO v_tec, v_prev FROM public.execucao_atividades a WHERE a.id = p_atividade;
  IF NOT FOUND THEN horas := NULL; origem := NULL; RETURN NEXT; RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM public.execucao_atividades_historico h
                  WHERE h.atividade_id = p_atividade AND h.valor_novo = 'em_andamento'
                    AND h.tipo_acao IN ('status_alterado', 'retomada') AND h.created_at <= p_fim)
    INTO v_tem;
  IF NOT v_tem THEN  -- concluiu sem "Iniciar": usa as previstas
    horas := v_prev; origem := 'previstas'; RETURN NEXT; RETURN;
  END IF;

  WITH ev AS (
    SELECT h.created_at t, h.valor_novo st,
           lead(h.created_at) OVER (ORDER BY h.created_at, h.id) prox
      FROM public.execucao_atividades_historico h
     WHERE h.atividade_id = p_atividade AND h.created_at <= p_fim
       AND h.tipo_acao IN ('status_alterado', 'retomada', 'pausa', 'conclusao', 'cancelamento')
       AND h.valor_novo IN ('em_andamento', 'pausada', 'pendente', 'concluida', 'cancelada')
  ), iv AS (  -- intervalos em andamento; o último vai até p_fim. Cada intervalo vale no máximo 60 dias (atividade esquecida
             -- "em andamento" ou relógio do aparelho errado não pode gerar centenas de dias a processar; o teto diário já limita as horas)
    SELECT t AS ini, LEAST(COALESCE(prox, p_fim), t + interval '60 days') AS fim
      FROM ev WHERE st = 'em_andamento' AND COALESCE(prox, p_fim) > t
  ), dias AS (  -- só os dias realmente cobertos por algum intervalo (nada de série contínua entre o 1º início e o último fim)
    SELECT DISTINCT g::date AS d
      FROM iv CROSS JOIN LATERAL generate_series((iv.ini AT TIME ZONE 'America/Sao_Paulo')::date,
                                                  (iv.fim AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') g
  ), por_dia AS (
    SELECT d.d,
           sum(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(i.fim, ((d.d + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
                                               - GREATEST(i.ini, (d.d::timestamp AT TIME ZONE 'America/Sao_Paulo')))) / 60.0)) AS min_dia
      FROM dias d CROSS JOIN iv i GROUP BY d.d
  )
  SELECT COALESCE(sum(LEAST(p.min_dia, j.minutos_liquidos)), 0)
    INTO v_min
    FROM por_dia p CROSS JOIN LATERAL public.execucao_jornada_dia(v_tec, p.d) j;

  IF v_min IS NULL OR v_min < 1 THEN  -- nada mensurável (ex.: iniciou e concluiu no mesmo minuto): usa as previstas
    horas := v_prev; origem := 'previstas';
  ELSE
    horas := round(v_min / 60.0, 2); origem := 'intervalos';
  END IF;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.execucao_horas_efetivas(p_atividade uuid, p_fim timestamptz DEFAULT now()) RETURNS numeric
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.horas FROM public.execucao_horas_efetivas_calc(p_atividade, p_fim) c
$$;

-- Instante da 1ª conclusão com horas medidas (a partir dele a série "nova" começa; antes disso horas_origem é NULL)
CREATE OR REPLACE FUNCTION public.execucao_horas_data_corte() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT min(fim_real_em) FROM public.execucao_atividades WHERE horas_origem IS NOT NULL
$$;

-- Ajuste direto da gestão (UPDATE em horas_realizadas fora desta RPC) marca horas_ajustadas e registra no histórico
CREATE OR REPLACE FUNCTION public.execucao_horas_marcar_ajuste() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.horas_realizadas IS DISTINCT FROM OLD.horas_realizadas
     AND COALESCE(current_setting('execucao.horas_via_rpc', true), '') <> '1'
     AND public.is_admin_execucao() THEN
    NEW.horas_ajustadas := true;
    NEW.horas_origem := 'ajuste_admin';
    BEGIN
      INSERT INTO public.execucao_atividades_historico (atividade_id, usuario_id, tipo_acao, descricao, valor_anterior, valor_novo)
      VALUES (NEW.id, public.current_usuario_id(), 'horas_ajustadas',
              format('Horas realizadas ajustadas pela gestão: %s → %s', COALESCE(OLD.horas_realizadas::text, '—'), COALESCE(NEW.horas_realizadas::text, '—')),
              OLD.horas_realizadas::text, NEW.horas_realizadas::text);
    EXCEPTION WHEN OTHERS THEN NULL;  -- o histórico nunca bloqueia a gravação
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_horas_marcar_ajuste() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_horas_marcar_ajuste ON public.execucao_atividades;
CREATE TRIGGER trg_horas_marcar_ajuste BEFORE UPDATE OF horas_realizadas ON public.execucao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.execucao_horas_marcar_ajuste();

-- ---------- alterar_status_atividade: uma única assinatura ----------
DROP FUNCTION IF EXISTS public.alterar_status_atividade(uuid, text, text);
DROP FUNCTION IF EXISTS public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric);

CREATE OR REPLACE FUNCTION public.alterar_status_atividade(
  p_id uuid, p_status text, p_motivo text DEFAULT NULL,
  p_ocorrido_em timestamptz DEFAULT NULL, p_id_cliente uuid DEFAULT NULL,
  p_motivo_codigo text DEFAULT NULL, p_solicita_replanejamento boolean DEFAULT false,
  p_horas_realizadas numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL, p_latitude numeric DEFAULT NULL, p_longitude numeric DEFAULT NULL,
  p_precisao_m numeric DEFAULT NULL, p_geo_status text DEFAULT NULL
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
  v_agora timestamptz := now();
  v_origem_horario text; v_obs text; v_geo text; v_lat numeric; v_lon numeric; v_prec numeric;
  v_horas numeric; v_horas_origem text; v_ajustadas boolean := false; v_passos_abertos int := 0;
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

  IF p_geo_status IS NOT NULL AND p_geo_status NOT IN ('ok', 'negada', 'indisponivel', 'tempo_esgotado', 'nao_suportado') THEN
    RAISE EXCEPTION 'Status de geolocalização inválido: %', p_geo_status;
  END IF;
  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN RAISE EXCEPTION 'Latitude inválida'; END IF;
  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN RAISE EXCEPTION 'Longitude inválida'; END IF;
  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN RAISE EXCEPTION 'Informe latitude e longitude juntas'; END IF;

  -- D11: conclusão = now() do servidor; vinda da fila offline (clique há mais de 5 min), usa o instante do aparelho
  -- limitado a [início real, agora]. Demais status mantêm o instante informado (limitado a agora).
  IF p_status = 'concluida' THEN
    IF p_ocorrido_em IS NULL OR p_ocorrido_em >= v_agora - interval '5 minutes' THEN
      v_quando := v_agora; v_origem_horario := 'servidor';
    ELSE
      v_quando := LEAST(GREATEST(p_ocorrido_em, COALESCE(a.inicio_real_em, p_ocorrido_em)), v_agora); v_origem_horario := 'dispositivo';
    END IF;
  ELSE
    v_quando := LEAST(COALESCE(p_ocorrido_em, v_agora), v_agora);
  END IF;
  v_dia := (v_quando AT TIME ZONE 'America/Sao_Paulo')::date;
  v_old := a.status;
  SELECT COALESCE(nome_completo, 'Técnico') INTO v_tecnico FROM public.usuarios WHERE id = v_uid;
  v_tecnico := COALESCE(v_tecnico, 'Técnico');

  IF p_status = 'concluida' THEN
    v_obs := left(NULLIF(btrim(COALESCE(p_observacao, '')), ''), 1000);
    v_geo := p_geo_status;
    IF p_latitude IS NOT NULL AND COALESCE(v_geo, 'ok') = 'ok' THEN
      v_lat := p_latitude; v_lon := p_longitude; v_geo := 'ok';
      v_prec := CASE WHEN p_precisao_m IS NULL THEN NULL ELSE least(greatest(p_precisao_m, 0), 99999.9) END;
    END IF;
    -- Horas (N1-d): ajuste explícito (gestão ou fila antiga) ou calculadas pelo servidor
    IF p_horas_realizadas IS NOT NULL THEN
      v_horas := p_horas_realizadas;
      v_horas_origem := CASE WHEN public.is_admin_execucao() THEN 'ajuste_admin' ELSE 'ajuste_tecnico' END;
      v_ajustadas := p_horas_realizadas IS DISTINCT FROM a.horas_previstas;
    ELSE
      SELECT c.horas, c.origem INTO v_horas, v_horas_origem FROM public.execucao_horas_efetivas_calc(p_id, v_quando) c;
    END IF;
    IF a.etapa_id IS NOT NULL THEN
      SELECT count(*) INTO v_passos_abertos FROM public.execucao_obras_etapas
       WHERE etapa_pai_id = a.etapa_id AND status NOT IN ('concluida', 'cancelada');
    END IF;
  END IF;

  PERFORM set_config('execucao.horas_via_rpc', '1', true);  -- evita o trigger de "ajuste da gestão"
  UPDATE public.execucao_atividades SET
    status = p_status,
    updated_at = now(),
    inicio_real_em = CASE WHEN p_status IN ('em_andamento', 'concluida') THEN COALESCE(inicio_real_em, v_quando) ELSE inicio_real_em END,
    fim_real_em = CASE WHEN p_status = 'concluida' THEN v_quando
                       WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE fim_real_em END,
    solicita_replanejamento = CASE WHEN p_status = 'pausada' THEN (solicita_replanejamento OR COALESCE(p_solicita_replanejamento, false))
                                   ELSE solicita_replanejamento END,
    horas_realizadas = CASE WHEN p_status = 'concluida' THEN COALESCE(v_horas, horas_previstas) ELSE horas_realizadas END,
    horas_ajustadas = CASE WHEN p_status = 'concluida' THEN v_ajustadas ELSE horas_ajustadas END,
    horas_origem = CASE WHEN p_status = 'concluida' THEN v_horas_origem ELSE horas_origem END,
    observacao_conclusao = CASE WHEN p_status = 'concluida' THEN v_obs
                                WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE observacao_conclusao END,
    conclusao_latitude = CASE WHEN p_status = 'concluida' THEN v_lat
                              WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_latitude END,
    conclusao_longitude = CASE WHEN p_status = 'concluida' THEN v_lon
                               WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_longitude END,
    conclusao_precisao_m = CASE WHEN p_status = 'concluida' THEN v_prec
                                WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_precisao_m END,
    conclusao_geo_status = CASE WHEN p_status = 'concluida' THEN v_geo
                                WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_geo_status END,
    conclusao_registrada_em = CASE WHEN p_status = 'concluida' THEN v_agora
                                   WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_registrada_em END,
    conclusao_origem_horario = CASE WHEN p_status = 'concluida' THEN v_origem_horario
                                    WHEN p_status IN ('pendente', 'em_andamento', 'pausada') THEN NULL ELSE conclusao_origem_horario END
   WHERE id = p_id RETURNING * INTO a;
  PERFORM set_config('execucao.horas_via_rpc', '', true);

  IF p_status = 'concluida' THEN
    v_tipo_acao := 'conclusao';
    v_desc := 'Atividade concluída'
              || CASE WHEN v_passos_abertos > 0 THEN format(' · com %s passo(s) em aberto', v_passos_abertos) ELSE '' END
              || CASE WHEN v_obs IS NOT NULL THEN ' · Obs: ' || v_obs ELSE '' END;
    v_notif_tipo := 'conclusao'; v_notif_titulo := '✅ Atividade Concluída';
    v_notif_msg := format('%s concluiu a atividade "%s"', v_tecnico, a.titulo)
                   || CASE WHEN v_passos_abertos > 0 THEN format(' (%s passo(s) em aberto)', v_passos_abertos) ELSE '' END
                   || CASE WHEN v_obs IS NOT NULL THEN ' — Obs: ' || left(v_obs, 140) || CASE WHEN length(v_obs) > 140 THEN '…' ELSE '' END ELSE '' END;
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

  -- Etapa/obra vinculadas: datas reais, status e progresso (mesma lógica da mig. 19, sem cascata)
  v_etapa := a.etapa_id;
  IF v_etapa IS NULL AND p_status = 'concluida' THEN
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
      SELECT count(*), count(*) FILTER (WHERE status = 'concluida') INTO v_total, v_feitas
        FROM public.execucao_atividades WHERE etapa_id = v_etapa AND status <> 'cancelada';
      UPDATE public.execucao_obras_etapas
         SET progresso = CASE WHEN v_feitas >= v_total THEN 100 ELSE GREATEST(COALESCE(progresso, 0), round(100.0 * v_feitas / v_total)::int) END,
             status = CASE WHEN v_feitas >= v_total THEN 'concluida' ELSE status END,
             data_fim_real = CASE WHEN v_feitas >= v_total THEN v_dia ELSE data_fim_real END,
             updated_at = now()
       WHERE id = v_etapa;
    ELSIF p_status = 'em_andamento' AND v_tem_filhos THEN
      UPDATE public.execucao_obras_etapas
         SET status = 'em_andamento', data_inicio_real = COALESCE(data_inicio_real, v_dia), updated_at = now()
       WHERE etapa_pai_id = v_etapa AND status = 'pendente';
    END IF;
    PERFORM public.execucao_sincronizar_etapa_pai(v_etapa);
    PERFORM public.execucao_recalcular_progresso_obra(v_obra);
  END IF;

  SELECT * INTO a FROM public.execucao_atividades WHERE id = p_id;
  RETURN a;
END $$;

REVOKE ALL ON FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric, text, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric, text, numeric, numeric, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.execucao_horas_efetivas_calc(uuid, timestamptz), public.execucao_horas_efetivas(uuid, timestamptz),
  public.execucao_horas_data_corte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_horas_efetivas_calc(uuid, timestamptz), public.execucao_horas_efetivas(uuid, timestamptz),
  public.execucao_horas_data_corte() TO authenticated;
