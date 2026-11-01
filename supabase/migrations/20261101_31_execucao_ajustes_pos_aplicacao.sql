-- 31 (pós-aplicação das migrations 19–30): correções achadas nos testes de fumaça e nos advisors.
--
-- 1. execucao_horas_efetivas_calc: o teto diário passa a ser SÓ a jornada líquida (execucao_jornada_dia.minutos_liquidos);
--    dia sem jornada (fim de semana, feriado, ausência) vale 0. Antes: minutos_liquidos + extra_max_min e, se zero, 480 min,
--    o que contava sábado/domingo e horas extras não aprovadas para atividade esquecida "em andamento" (teste real: 52,49 h
--    numa atividade iniciada na terça e aberta até domingo). Se nada for mensurável (< 1 min), continua usando as horas previstas.
--    (o arquivo da migration 20 foi atualizado para o mesmo corpo.)
-- 2. Advisor "multiple_permissive_policies" introduzido pela 24: em execucao_pedidos_material e execucao_historico_pedidos a policy
--    FOR ALL de admin + a policy SELECT de COMPRAS geravam 2 policies permissivas de SELECT. Troca por UMA policy de SELECT
--    (admin OU compras) e policies de INSERT/UPDATE/DELETE só do admin: semântica idêntica, sem duplicidade.
--
-- ROLLBACK:
--   1) Reaplicar o corpo antigo de execucao_horas_efetivas_calc (cap = CASE WHEN j.minutos_liquidos + j.extra_max_min > 0 THEN
--      j.minutos_liquidos + j.extra_max_min ELSE 480 END) a partir do histórico git da migration 20.
--   2) Policies: DROP POLICY pedidos_select/pedidos_admin_insert/pedidos_admin_update/pedidos_admin_delete (e as 4 equivalentes
--      historico_pedidos_*) e recriar execucao_pedidos_material_admin_all / execucao_historico_pedidos_admin_all
--      (FOR ALL ... USING/WITH CHECK (SELECT public.is_admin_execucao())) + pedidos_compras_select / historico_pedidos_compras_select
--      (FOR SELECT ... USING (SELECT public.is_compras())).

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
  ), iv AS (  -- intervalos em andamento; o último vai até p_fim. Cada intervalo vale no máximo 60 dias
    SELECT t AS ini, LEAST(COALESCE(prox, p_fim), t + interval '60 days') AS fim
      FROM ev WHERE st = 'em_andamento' AND COALESCE(prox, p_fim) > t
  ), dias AS (  -- só os dias realmente cobertos por algum intervalo
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

-- ---------- policies sem duplicidade de SELECT ----------
DROP POLICY IF EXISTS execucao_pedidos_material_admin_all ON public.execucao_pedidos_material;
DROP POLICY IF EXISTS pedidos_compras_select ON public.execucao_pedidos_material;
DROP POLICY IF EXISTS pedidos_select ON public.execucao_pedidos_material;
DROP POLICY IF EXISTS pedidos_admin_insert ON public.execucao_pedidos_material;
DROP POLICY IF EXISTS pedidos_admin_update ON public.execucao_pedidos_material;
DROP POLICY IF EXISTS pedidos_admin_delete ON public.execucao_pedidos_material;
CREATE POLICY pedidos_select ON public.execucao_pedidos_material FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_execucao()) OR (SELECT public.is_compras()));
CREATE POLICY pedidos_admin_insert ON public.execucao_pedidos_material FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY pedidos_admin_update ON public.execucao_pedidos_material FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY pedidos_admin_delete ON public.execucao_pedidos_material FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_execucao()));

DROP POLICY IF EXISTS execucao_historico_pedidos_admin_all ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS historico_pedidos_compras_select ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS historico_pedidos_select ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS historico_pedidos_admin_insert ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS historico_pedidos_admin_update ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS historico_pedidos_admin_delete ON public.execucao_historico_pedidos;
CREATE POLICY historico_pedidos_select ON public.execucao_historico_pedidos FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_execucao()) OR (SELECT public.is_compras()));
CREATE POLICY historico_pedidos_admin_insert ON public.execucao_historico_pedidos FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY historico_pedidos_admin_update ON public.execucao_historico_pedidos FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY historico_pedidos_admin_delete ON public.execucao_historico_pedidos FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_execucao()));
