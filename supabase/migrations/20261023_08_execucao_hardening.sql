-- 08: endurecimento de segurança e broadcast em tempo real do status das obras (para o dashboard Comercial)

-- search_path fixo nas funções puras
ALTER FUNCTION public.execucao_norm(text) SET search_path = public;
ALTER FUNCTION public.execucao_pascoa(int) SET search_path = public;
ALTER FUNCTION public.execucao_min_dia(jsonb, text) SET search_path = public;
ALTER FUNCTION public.execucao_resumo_linha(text, text, jsonb, jsonb, text[], int, text) SET search_path = public;

-- Funções de gatilho/internas não devem ser chamáveis como RPC
REVOKE ALL ON FUNCTION public.execucao_avisar_material() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execucao_recalcular_progresso_obra(uuid) FROM PUBLIC, anon, authenticated;

-- Versão pública (somente admin) para o app recalcular o progresso manualmente
CREATE OR REPLACE FUNCTION public.execucao_recalcular_progresso(p_obra uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  PERFORM public.execucao_recalcular_progresso_obra(p_obra);
END $$;
REVOKE ALL ON FUNCTION public.execucao_recalcular_progresso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_recalcular_progresso(uuid) TO authenticated;

-- Broadcast (canal privado) quando o status/progresso de uma obra muda; nunca bloqueia a gravação
CREATE OR REPLACE FUNCTION public.execucao_broadcast_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.apontamento_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status
                                           OR NEW.progresso_geral IS DISTINCT FROM OLD.progresso_geral) THEN
      PERFORM realtime.send(jsonb_build_object('apontamento_id', NEW.apontamento_id, 'status', NEW.status,
                                               'progresso', NEW.progresso_geral), 'status', 'execucao-status', true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_broadcast_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_status ON public.execucao_obras;
CREATE TRIGGER trg_broadcast_status AFTER INSERT OR UPDATE ON public.execucao_obras
  FOR EACH ROW EXECUTE FUNCTION public.execucao_broadcast_status();

-- Política de escuta do canal (se não for possível criar, o app usa atualização periódica)
DO $$
BEGIN
  EXECUTE $p$CREATE POLICY execucao_status_listen ON realtime.messages FOR SELECT TO authenticated
              USING (realtime.topic() = 'execucao-status' AND public.current_usuario_id() IS NOT NULL)$p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Política de realtime não criada: %', SQLERRM;
END $$;
