-- 33: Módulo/página 'compras' acessível SOMENTE por COMPRAS e Administrador.
--   * Remove a permissão de página 'compras' de ADMIN_EXECUCAO e de qualquer nível diferente de COMPRAS/Administrador;
--     garante a linha para COMPRAS e Administrador.
--   * RPCs exclusivas do painel de Compras passam a exigir is_compras() (COMPRAS/Administrador) em vez de pode_ver_compras()
--     (que inclui ADMIN_EXECUCAO): compras_indicadores, compras_alterar_status, compras_definir_disponibilidade.
--     (compras_assumir_pedido e compras_abrir_questionamento já usavam is_compras().)
--   * MANTIDAS com pode_ver_compras() (ADMIN_EXECUCAO continua usando via PedidoMaterial da Execução):
--     compras_detalhe_pedido, compras_listar_questionamentos, compras_responder_questionamento, compras_cancelar_questionamento
--     e compras_listar_pedidos (esta última é chamada INTERNAMENTE por compras_detalhe_pedido, que é SECURITY DEFINER mas
--     avalia current_nivel() do chamador; restringi-la quebraria o detalhe/conversa do pedido para ADMIN_EXECUCAO).
--   * RLS de execucao_pedidos_material / execucao_historico_pedidos / execucao_pedidos_questionamentos: inalterada.
--   * Idempotente: o REPLACE só atua se a definição ainda contiver pode_ver_compras(); permissões via DELETE/INSERT ON CONFLICT.
--   * As RPCs são reescritas a partir de pg_get_functiondef (preserva corpo, SECURITY DEFINER, search_path e GRANTs).
-- ROLLBACK:
--   INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
--     SELECT n.id, p.id FROM public.niveis_acesso n JOIN public.paginas p ON p.rota = 'compras'
--      WHERE n.nome = 'ADMIN_EXECUCAO' ON CONFLICT (nivel_acesso_id, pagina_id) DO NOTHING;
--   DO $$ DECLARE f regprocedure; d text; BEGIN
--     FOREACH f IN ARRAY ARRAY['public.compras_indicadores(date,date)'::regprocedure,
--       'public.compras_alterar_status(uuid,text,text,date)'::regprocedure,
--       'public.compras_definir_disponibilidade(uuid,date)'::regprocedure] LOOP
--       d := pg_get_functiondef(f);
--       EXECUTE replace(d, 'IF NOT public.is_compras() THEN', 'IF NOT public.pode_ver_compras() THEN');
--     END LOOP; END $$;

-- 1. Permissões da página 'compras'
DELETE FROM public.permissoes pm
 USING public.niveis_acesso n, public.paginas p
 WHERE pm.nivel_acesso_id = n.id AND pm.pagina_id = p.id
   AND p.rota = 'compras'
   AND n.nome NOT IN ('COMPRAS', 'Administrador');

INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
SELECT n.id, p.id
  FROM public.niveis_acesso n JOIN public.paginas p ON p.rota = 'compras'
 WHERE n.nome IN ('COMPRAS', 'Administrador')
ON CONFLICT (nivel_acesso_id, pagina_id) DO NOTHING;

-- 2. RPCs exclusivas do painel: gate is_compras()
DO $$
DECLARE
  f regprocedure;
  d text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.compras_indicadores(date,date)'::regprocedure,
    'public.compras_alterar_status(uuid,text,text,date)'::regprocedure,
    'public.compras_definir_disponibilidade(uuid,date)'::regprocedure
  ] LOOP
    d := pg_get_functiondef(f);
    IF position('IF NOT public.pode_ver_compras() THEN' IN d) > 0 THEN
      EXECUTE replace(d, 'IF NOT public.pode_ver_compras() THEN', 'IF NOT public.is_compras() THEN');
    END IF;
  END LOOP;
END $$;
