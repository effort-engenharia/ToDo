-- Execução: funções auxiliares de permissão + RLS nas tabelas execucao_*
-- usuarios.id != auth.uid(); o vínculo é usuarios.auth_user_id.

CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid() AND ativo LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_nivel()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT na.nome FROM public.usuarios u
  JOIN public.niveis_acesso na ON na.id = u.nivel_acesso_id
  WHERE u.auth_user_id = auth.uid() AND u.ativo LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_execucao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_nivel() IN ('ADMIN_EXECUCAO', 'Administrador'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_usuario_execucao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_nivel() IN ('ADMIN_EXECUCAO', 'Administrador', 'TECNICO'), false)
$$;

REVOKE ALL ON FUNCTION public.current_usuario_id(), public.current_nivel(),
  public.is_admin_execucao(), public.is_usuario_execucao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usuario_id(), public.current_nivel(),
  public.is_admin_execucao(), public.is_usuario_execucao() TO authenticated;

-- Habilitar RLS em todas as tabelas execucao_*
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'execucao\_%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Remover políticas abertas (TO public USING (true))
DROP POLICY IF EXISTS "Historico pedidos insert policy" ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS "Historico pedidos select policy" ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS "Permitir acesso total a templates de materiais" ON public.execucao_templates_materiais;

-- Atividades: admin tudo; técnico lê e atualiza apenas as próprias
CREATE POLICY atv_admin_all ON public.execucao_atividades FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY atv_tecnico_select ON public.execucao_atividades FOR SELECT TO authenticated
  USING (tecnico_responsavel_id = (SELECT public.current_usuario_id()));
CREATE POLICY atv_tecnico_update ON public.execucao_atividades FOR UPDATE TO authenticated
  USING (tecnico_responsavel_id = (SELECT public.current_usuario_id()))
  WITH CHECK (tecnico_responsavel_id = (SELECT public.current_usuario_id()));

-- Histórico e comentários: quem enxerga a atividade lê e insere
CREATE POLICY hist_admin_all ON public.execucao_atividades_historico FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY hist_tecnico_select ON public.execucao_atividades_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.execucao_atividades a WHERE a.id = atividade_id));
CREATE POLICY hist_tecnico_insert ON public.execucao_atividades_historico FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT public.current_usuario_id())
              AND EXISTS (SELECT 1 FROM public.execucao_atividades a WHERE a.id = atividade_id));

CREATE POLICY coment_admin_all ON public.execucao_atividades_comentarios FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY coment_tecnico_select ON public.execucao_atividades_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.execucao_atividades a WHERE a.id = atividade_id));
CREATE POLICY coment_tecnico_insert ON public.execucao_atividades_comentarios FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT public.current_usuario_id())
              AND EXISTS (SELECT 1 FROM public.execucao_atividades a WHERE a.id = atividade_id));

-- POPs: todo o módulo lê; só admin escreve
CREATE POLICY pops_read ON public.execucao_pops FOR SELECT TO authenticated
  USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY pops_admin_write ON public.execucao_pops FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY pops_arq_read ON public.execucao_pops_arquivos FOR SELECT TO authenticated
  USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY pops_arq_admin_write ON public.execucao_pops_arquivos FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));

-- Demais tabelas: somente admin
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'execucao_obras', 'execucao_obras_etapas', 'execucao_obras_arquivos',
    'execucao_pedidos_material', 'execucao_historico_pedidos', 'execucao_planejamento_macro',
    'execucao_templates_etapas', 'execucao_templates_etapas_itens', 'execucao_templates_materiais',
    'execucao_notificacoes'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()))',
      t || '_admin_all', t);
  END LOOP;
END $$;
