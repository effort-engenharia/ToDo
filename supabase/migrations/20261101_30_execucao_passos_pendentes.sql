-- 30 (R3 Performance · F10): contador leve de "passos pendentes" por etapa pai.
--
-- Objetivo: o Planejamento Macro hoje embute execucao_atividades(id,status) em TODAS as etapas de TODAS as obras só para
-- calcular o alerta "passos pendentes" (passosPendentesDaEtapa). Esta RPC devolve só os contadores por etapa pai, no mesmo
-- critério do front: o pai (não concluído/cancelado) tem ≥ 1 atividade própria (não cancelada), TODAS concluídas, e ainda há
-- sub-etapas (passos) não concluídas/canceladas.
--
-- execucao_passos_pendentes_por_etapa(p_obras uuid[] DEFAULT NULL)
--   p_obras: ids das obras; NULL = todas as obras não concluídas/canceladas.
--   Retorna 1 linha por etapa PAI (etapa_pai_id nulo, com ao menos 1 sub-etapa não cancelada, status ≠ concluida/cancelada):
--     obra_id, etapa_id,
--     passos_total, passos_concluidos, passos_abertos         (sub-etapas não canceladas)
--     atividades_total, atividades_concluidas, atividades_abertas  (atividades próprias não canceladas da etapa pai)
--     passos_pendentes  = passos_abertos quando atividades_total > 0 E atividades_abertas = 0; senão 0   ← o número do alerta
--   Só admin de execução (INVOKER + RLS; erro explícito para os demais). Não escreve nada.
--
-- Não precisa de coluna nova (funciona antes ou depois da 19; o significado de "pai concluído" só fica correto depois da 19).
-- Usa idx_etapas_pai (mig. 29) e idx_atividades_etapa_id.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.execucao_passos_pendentes_por_etapa(uuid[]);

CREATE OR REPLACE FUNCTION public.execucao_passos_pendentes_por_etapa(p_obras uuid[] DEFAULT NULL)
RETURNS TABLE (
  obra_id uuid, etapa_id uuid,
  passos_total int, passos_concluidos int, passos_abertos int,
  atividades_total int, atividades_concluidas int, atividades_abertas int,
  passos_pendentes int
)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT e.obra_id, e.id,
         s.total, s.concluidos, s.total - s.concluidos,
         a.total, a.concluidas, a.total - a.concluidas,
         CASE WHEN a.total > 0 AND a.total = a.concluidas THEN s.total - s.concluidos ELSE 0 END
    FROM public.execucao_obras_etapas e
    JOIN public.execucao_obras o ON o.id = e.obra_id
    CROSS JOIN LATERAL (SELECT count(*)::int AS total, (count(*) FILTER (WHERE f.status = 'concluida'))::int AS concluidos
                          FROM public.execucao_obras_etapas f
                         WHERE f.etapa_pai_id = e.id AND f.status <> 'cancelada') s
    CROSS JOIN LATERAL (SELECT count(*)::int AS total, (count(*) FILTER (WHERE x.status = 'concluida'))::int AS concluidas
                          FROM public.execucao_atividades x
                         WHERE x.etapa_id = e.id AND x.status <> 'cancelada') a
   WHERE e.etapa_pai_id IS NULL AND e.status NOT IN ('concluida', 'cancelada') AND s.total > 0
     AND ((p_obras IS NOT NULL AND e.obra_id = ANY (p_obras))
          OR (p_obras IS NULL AND o.status NOT IN ('concluida', 'cancelada')))
   ORDER BY e.obra_id, e.ordem, e.id;
END $$;

REVOKE ALL ON FUNCTION public.execucao_passos_pendentes_por_etapa(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_passos_pendentes_por_etapa(uuid[]) TO authenticated;
