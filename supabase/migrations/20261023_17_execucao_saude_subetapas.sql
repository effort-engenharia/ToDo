-- 17: (1) a saúde da obra olha só as etapas principais (sub-etapas são passos dentro da etapa principal e não podem
-- deixar a obra "atrasada" sozinhas); (2) sub-etapas que espelham as datas da etapa principal acompanham quando ela muda;
-- (3) corrige sub-etapas que ficaram fora do intervalo da etapa principal.
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
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.status NOT IN ('concluida', 'cancelada') AND COALESCE(e.progresso, 0) < 100
          AND public.execucao_add_dias_uteis(e.data_fim, 2, b.cidade_id) < current_date) vencidas,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.status NOT IN ('concluida', 'cancelada') AND e.tipo <> 'estoque'
          AND e.responsavel_id IS NULL AND cardinality(e.equipe_ids) = 0
          AND e.data_fim >= current_date AND e.data_inicio <= public.execucao_add_dias_uteis(current_date, 5, b.cidade_id)) semresp,
      (SELECT count(*)::int FROM public.execucao_obras_etapas e
        WHERE e.obra_id = b.id AND e.etapa_pai_id IS NULL AND e.tipo = 'estoque' AND e.status NOT IN ('concluida', 'cancelada')
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

CREATE OR REPLACE FUNCTION public.execucao_sincronizar_subetapas_datas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.etapa_pai_id IS NULL AND (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim) THEN
    -- Só as que espelhavam exatamente as datas antigas da etapa principal; sub-etapas com datas próprias não mudam
    UPDATE public.execucao_obras_etapas s
       SET data_inicio = NEW.data_inicio, data_fim = NEW.data_fim, updated_at = now()
     WHERE s.etapa_pai_id = NEW.id AND s.data_inicio = OLD.data_inicio AND s.data_fim = OLD.data_fim;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_sincronizar_subetapas_datas() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_subetapas_datas ON public.execucao_obras_etapas;
CREATE TRIGGER trg_sync_subetapas_datas AFTER UPDATE OF data_inicio, data_fim ON public.execucao_obras_etapas
  FOR EACH ROW EXECUTE FUNCTION public.execucao_sincronizar_subetapas_datas();

UPDATE public.execucao_obras_etapas s
   SET data_inicio = p.data_inicio, data_fim = p.data_fim, updated_at = now()
  FROM public.execucao_obras_etapas p
 WHERE s.etapa_pai_id = p.id AND (s.data_fim < p.data_inicio OR s.data_inicio > p.data_fim);
