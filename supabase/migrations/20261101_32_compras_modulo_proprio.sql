-- 32: Compras como DASHBOARD/MÓDULO PRÓPRIO e exclusivo (rota 'compras', fora de 'execucao/...').
--   * A página criada na mig. 24 ('execucao/compras') é renomeada in-place para nome 'Compras' / rota 'compras'
--     (mantém o id e as permissões já concedidas). Se 'compras' já existir, apenas garante a linha.
--   * Nível COMPRAS: fica SOMENTE com a página 'compras' (remove 'execucao', 'execucao/compras', 'execucao/pops' etc.).
--   * Administrador e ADMIN_EXECUCAO: recebem a página 'compras' (continuam com o resto).
--   * Não mexe em is_compras()/pode_ver_compras()/RLS/RPCs de dados (baseados em current_nivel(), não em permissoes).
--   * Não altera usuarios (ativo/auth_user_id): ver diagnóstico no PLANO F.11.
-- ROLLBACK:
--   UPDATE public.paginas SET nome = 'Compras (Execução)', rota = 'execucao/compras' WHERE rota = 'compras';
--   INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
--     SELECT n.id, p.id FROM public.niveis_acesso n JOIN public.paginas p ON p.rota IN ('execucao', 'execucao/compras')
--      WHERE n.nome = 'COMPRAS' ON CONFLICT DO NOTHING;
--   (permissões de COMPRAS a 'execucao/pops' nunca existiram por migration; eram só do front)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.paginas WHERE rota = 'compras') THEN
    IF EXISTS (SELECT 1 FROM public.paginas WHERE rota = 'execucao/compras') THEN
      UPDATE public.paginas
         SET nome = 'Compras',
             rota = 'compras',
             descricao = 'Dashboard exclusivo do setor de Compras: fila de pedidos de material, questionamentos e indicadores'
       WHERE rota = 'execucao/compras';
    ELSE
      INSERT INTO public.paginas (nome, rota, descricao)
      VALUES ('Compras', 'compras', 'Dashboard exclusivo do setor de Compras: fila de pedidos de material, questionamentos e indicadores');
    END IF;
  END IF;
END $$;

-- Garante o nível COMPRAS (nome é UNIQUE)
INSERT INTO public.niveis_acesso (nome, descricao)
VALUES ('COMPRAS', 'Setor de Compras: acompanha e trata os pedidos de material da Execução')
ON CONFLICT (nome) DO NOTHING;

-- COMPRAS: remove qualquer página que não seja 'compras'
DELETE FROM public.permissoes pm
 USING public.niveis_acesso n, public.paginas p
 WHERE pm.nivel_acesso_id = n.id AND pm.pagina_id = p.id
   AND n.nome = 'COMPRAS' AND p.rota <> 'compras';

-- Concede 'compras' a COMPRAS, Administrador e ADMIN_EXECUCAO
INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
SELECT n.id, p.id
  FROM public.niveis_acesso n JOIN public.paginas p ON p.rota = 'compras'
 WHERE n.nome IN ('COMPRAS', 'ADMIN_EXECUCAO', 'Administrador')
ON CONFLICT (nivel_acesso_id, pagina_id) DO NOTHING;
