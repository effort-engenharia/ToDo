-- 15: o técnico recebe notificação quando uma atividade é atribuída a ele (nova, como apoio ou transferida)
-- e as tabelas da agenda entram no Realtime (a tela "Meu Dia" atualiza sozinha).
ALTER TABLE public.execucao_notificacoes DROP CONSTRAINT IF EXISTS execucao_notificacoes_tipo_check;
ALTER TABLE public.execucao_notificacoes ADD CONSTRAINT execucao_notificacoes_tipo_check
  CHECK (tipo IN ('pausa', 'conclusao', 'pendente', 'atraso', 'retomada', 'urgente',
                  'material', 'hora_extra', 'replanejamento', 'transferencia', 'pendencia', 'nova_atividade'));

CREATE OR REPLACE FUNCTION public.execucao_avisar_atribuicao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ator uuid := public.current_usuario_id();
  v_dest uuid;
  v_atv public.execucao_atividades;
  v_transferida boolean := false;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- Aviso nunca pode impedir o cadastro da atividade
  BEGIN
    IF TG_TABLE_NAME = 'execucao_atividades' THEN
      v_atv := NEW;
      v_dest := NEW.tecnico_responsavel_id;
      IF TG_OP = 'UPDATE' THEN
        IF NEW.tecnico_responsavel_id IS NOT DISTINCT FROM OLD.tecnico_responsavel_id THEN RETURN NEW; END IF;
        v_transferida := true;
      END IF;
    ELSE
      IF NEW.papel <> 'apoio' THEN RETURN NEW; END IF;
      SELECT * INTO v_atv FROM public.execucao_atividades WHERE id = NEW.atividade_id;
      v_dest := NEW.usuario_id;
    END IF;

    IF v_dest IS NULL OR v_atv.id IS NULL OR v_dest IS NOT DISTINCT FROM v_ator THEN RETURN NEW; END IF;
    IF v_atv.status IN ('concluida', 'cancelada') THEN RETURN NEW; END IF;
    -- Só o que é para agora ou para os próximos dias; cronogramas longos não geram uma notificação por etapa
    IF v_atv.data_programada < v_hoje - 1 OR v_atv.data_programada > v_hoje + 14 THEN RETURN NEW; END IF;

    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id)
    VALUES (
      CASE WHEN v_transferida THEN 'transferencia' ELSE 'nova_atividade' END,
      CASE WHEN v_transferida THEN '🔁 Atividade atribuída a você' ELSE '📋 Nova atividade' END,
      format('"%s"%s — %s%s', v_atv.titulo,
             CASE WHEN COALESCE(v_atv.cliente_nome, '') <> '' THEN ' · ' || v_atv.cliente_nome ELSE '' END,
             to_char(v_atv.data_programada, 'DD/MM'),
             CASE WHEN v_atv.hora_inicio IS NOT NULL THEN ' às ' || to_char(v_atv.hora_inicio, 'HH24:MI') ELSE '' END),
      v_atv.id, v_dest, v_ator);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_avisar_atribuicao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_avisar_atribuicao ON public.execucao_atividades;
CREATE TRIGGER trg_avisar_atribuicao AFTER INSERT OR UPDATE OF tecnico_responsavel_id ON public.execucao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.execucao_avisar_atribuicao();

DROP TRIGGER IF EXISTS trg_avisar_apoio ON public.execucao_atividades_equipe;
CREATE TRIGGER trg_avisar_apoio AFTER INSERT ON public.execucao_atividades_equipe
  FOR EACH ROW EXECUTE FUNCTION public.execucao_avisar_atribuicao();

-- Realtime: eventos respeitam o RLS (cada técnico só recebe o que pode ver)
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['execucao_atividades', 'execucao_atividades_equipe', 'execucao_notificacoes'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
