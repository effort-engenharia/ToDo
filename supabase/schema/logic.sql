-- Snapshot (views, funções, triggers, policies e índices) do schema public, gerado via MCP do Supabase para o graphify.
-- NÃO é migration: não executar.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE TRIGGER update_administradoras_sindicos_updated_at BEFORE UPDATE ON public.administradoras_sindicos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apontamentos_comerciais_updated_at BEFORE UPDATE ON public.apontamentos_comerciais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apontamentos_updated_at BEFORE UPDATE ON public.apontamentos_comerciais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arsenal_links_updated_at BEFORE UPDATE ON public.arsenal_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metas_comerciais_updated_at BEFORE UPDATE ON public.metas_comerciais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY access_levels_insert_policy ON public.access_levels AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));
CREATE POLICY access_levels_select_policy ON public.access_levels AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY access_logs_insert_policy ON public.access_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY access_logs_select_policy ON public.access_logs AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));
CREATE POLICY "Allow all operations for authenticated users" ON public.arsenal_financiamentos AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Historico pedidos insert policy" ON public.execucao_historico_pedidos AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Historico pedidos select policy" ON public.execucao_historico_pedidos AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Permitir acesso total a templates de materiais" ON public.execucao_templates_materiais AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY page_permissions_insert_policy ON public.page_permissions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));
CREATE POLICY page_permissions_select_policy ON public.page_permissions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY pages_insert_policy ON public.pages AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));
CREATE POLICY pages_select_policy ON public.pages AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY user_sessions_delete_policy ON public.user_sessions AS PERMISSIVE FOR DELETE TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));
CREATE POLICY user_sessions_select_policy ON public.user_sessions AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));
CREATE POLICY users_delete_policy ON public.users AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM auth.users users_1
  WHERE ((users_1.id = auth.uid()) AND ((users_1.raw_app_meta_data ->> 'is_admin'::text) = 'true'::text)))));
CREATE POLICY users_insert_policy ON public.users AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM auth.users users_1
  WHERE ((users_1.id = auth.uid()) AND ((users_1.raw_app_meta_data ->> 'is_admin'::text) = 'true'::text)))));
CREATE POLICY users_select_policy ON public.users AS PERMISSIVE FOR SELECT TO public USING (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM auth.users users_1
  WHERE ((users_1.id = auth.uid()) AND ((users_1.raw_app_meta_data ->> 'is_admin'::text) = 'true'::text))))));
CREATE POLICY users_update_policy ON public.users AS PERMISSIVE FOR UPDATE TO public USING (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM auth.users users_1
  WHERE ((users_1.id = auth.uid()) AND ((users_1.raw_app_meta_data ->> 'is_admin'::text) = 'true'::text))))));

CREATE UNIQUE INDEX access_levels_name_key ON public.access_levels USING btree (name);
CREATE INDEX idx_logs_created_at ON public.access_logs USING btree (created_at);
CREATE INDEX idx_logs_user_id ON public.access_logs USING btree (user_id);
CREATE UNIQUE INDEX administradoras_sindicos_place_id_key ON public.administradoras_sindicos USING btree (place_id);
CREATE INDEX idx_administradoras_sindicos_cidade ON public.administradoras_sindicos USING btree (cidade);
CREATE INDEX idx_administradoras_sindicos_contato_realizado ON public.administradoras_sindicos USING btree (contato_realizado);
CREATE INDEX idx_administradoras_sindicos_last_sync ON public.administradoras_sindicos USING btree (last_google_sync);
CREATE INDEX idx_administradoras_sindicos_place_id ON public.administradoras_sindicos USING btree (place_id);
CREATE INDEX idx_apontamentos_created_at ON public.apontamentos_comerciais USING btree (created_at);
CREATE INDEX idx_apontamentos_data_retomada ON public.apontamentos_comerciais USING btree (data_retomada_prevista) WHERE (data_retomada_prevista IS NOT NULL);
CREATE INDEX idx_apontamentos_fase ON public.apontamentos_comerciais USING btree (fase);
CREATE INDEX idx_apontamentos_proprietario ON public.apontamentos_comerciais USING btree (proprietario_relacionamento);
CREATE INDEX idx_apontamentos_tipo_oportunidade ON public.apontamentos_comerciais USING btree (tipo_oportunidade);
CREATE INDEX idx_arsenal_arquivos_created_at ON public.arsenal_arquivos USING btree (created_at DESC);
CREATE INDEX idx_arsenal_financiamentos_created_at ON public.arsenal_financiamentos USING btree (created_at DESC);
CREATE INDEX idx_arsenal_financiamentos_nome ON public.arsenal_financiamentos USING btree (nome);
CREATE INDEX idx_arsenal_links_created_at ON public.arsenal_links USING btree (created_at DESC);
CREATE INDEX idx_atividades_etapa_id ON public.execucao_atividades USING btree (etapa_id);
CREATE INDEX idx_execucao_atividades_data ON public.execucao_atividades USING btree (data_programada);
CREATE INDEX idx_execucao_atividades_status ON public.execucao_atividades USING btree (status);
CREATE INDEX idx_execucao_atividades_tecnico ON public.execucao_atividades USING btree (tecnico_responsavel_id);
CREATE INDEX idx_execucao_atividades_tipo ON public.execucao_atividades USING btree (tipo_execucao);
CREATE INDEX idx_execucao_comentarios_atividade ON public.execucao_atividades_comentarios USING btree (atividade_id);
CREATE INDEX idx_execucao_comentarios_data ON public.execucao_atividades_comentarios USING btree (created_at);
CREATE INDEX idx_execucao_historico_atividade ON public.execucao_atividades_historico USING btree (atividade_id);
CREATE INDEX idx_execucao_historico_data ON public.execucao_atividades_historico USING btree (created_at);
CREATE INDEX idx_execucao_historico_usuario ON public.execucao_atividades_historico USING btree (usuario_id);
CREATE INDEX idx_historico_data ON public.execucao_historico_pedidos USING btree (data_alteracao DESC);
CREATE INDEX idx_historico_pedido_id ON public.execucao_historico_pedidos USING btree (pedido_id);
CREATE INDEX idx_notificacoes_atividade ON public.execucao_notificacoes USING btree (atividade_id);
CREATE INDEX idx_notificacoes_created_at ON public.execucao_notificacoes USING btree (created_at DESC);
CREATE INDEX idx_notificacoes_lida ON public.execucao_notificacoes USING btree (lida);
CREATE INDEX idx_notificacoes_tipo ON public.execucao_notificacoes USING btree (tipo);
CREATE INDEX idx_obras_datas ON public.execucao_obras USING btree (data_inicio_prevista, data_fim_prevista);
CREATE INDEX idx_obras_responsavel ON public.execucao_obras USING btree (responsavel_id);
CREATE INDEX idx_obras_status ON public.execucao_obras USING btree (status);
CREATE INDEX idx_execucao_obras_arquivos_obra_id ON public.execucao_obras_arquivos USING btree (obra_id);
CREATE INDEX idx_etapas_datas ON public.execucao_obras_etapas USING btree (data_inicio, data_fim);
CREATE INDEX idx_etapas_obra ON public.execucao_obras_etapas USING btree (obra_id);
CREATE INDEX idx_etapas_tipo ON public.execucao_obras_etapas USING btree (tipo);
CREATE INDEX idx_execucao_pedidos_atividade ON public.execucao_pedidos_material USING btree (atividade_id);
CREATE INDEX idx_execucao_pedidos_data ON public.execucao_pedidos_material USING btree (created_at);
CREATE INDEX idx_execucao_pedidos_solicitante ON public.execucao_pedidos_material USING btree (solicitante_id);
CREATE INDEX idx_execucao_pedidos_status ON public.execucao_pedidos_material USING btree (status);
CREATE INDEX idx_execucao_planejamento_datas ON public.execucao_planejamento_macro USING btree (data_inicio, data_fim);
CREATE INDEX idx_execucao_planejamento_responsavel ON public.execucao_planejamento_macro USING btree (responsavel_id);
CREATE INDEX idx_execucao_planejamento_status ON public.execucao_planejamento_macro USING btree (status);
CREATE INDEX idx_execucao_pops_ativo ON public.execucao_pops USING btree (ativo);
CREATE INDEX idx_execucao_pops_categoria ON public.execucao_pops USING btree (categoria);
CREATE INDEX idx_execucao_pops_ordem ON public.execucao_pops USING btree (ordem);
CREATE INDEX idx_execucao_pops_arquivos_pop ON public.execucao_pops_arquivos USING btree (pop_id);
CREATE INDEX idx_execucao_pops_arquivos_tipo ON public.execucao_pops_arquivos USING btree (tipo);
CREATE INDEX idx_templates_etapas_ativo ON public.execucao_templates_etapas USING btree (ativo);
CREATE INDEX idx_templates_etapas_tipo_obra ON public.execucao_templates_etapas USING btree (tipo_obra);
CREATE INDEX idx_templates_etapas_itens_template ON public.execucao_templates_etapas_itens USING btree (template_id);
CREATE INDEX idx_templates_materiais_ativo ON public.execucao_templates_materiais USING btree (ativo);
CREATE INDEX idx_templates_materiais_tipo ON public.execucao_templates_materiais USING btree (tipo_servico);
CREATE INDEX idx_historico_apontamento_id ON public.historico_alteracoes_apontamentos USING btree (apontamento_id);
CREATE INDEX idx_historico_data_alteracao ON public.historico_alteracoes_apontamentos USING btree (data_alteracao);
CREATE INDEX idx_metas_ativo ON public.metas_comerciais USING btree (ativo);
CREATE INDEX idx_metas_tipo_mes_ano ON public.metas_comerciais USING btree (tipo_meta, mes, ano);
CREATE UNIQUE INDEX unique_meta_ativa ON public.metas_comerciais USING btree (tipo_meta, mes, ano, ativo);
CREATE UNIQUE INDEX niveis_acesso_nome_key ON public.niveis_acesso USING btree (nome);
CREATE UNIQUE INDEX page_permissions_access_level_id_page_id_key ON public.page_permissions USING btree (access_level_id, page_id);
CREATE UNIQUE INDEX pages_name_key ON public.pages USING btree (name);
CREATE UNIQUE INDEX paginas_nome_key ON public.paginas USING btree (nome);
CREATE UNIQUE INDEX paginas_rota_key ON public.paginas USING btree (rota);
CREATE UNIQUE INDEX permissoes_nivel_acesso_id_pagina_id_key ON public.permissoes USING btree (nivel_acesso_id, pagina_id);
CREATE INDEX idx_sessions_expires ON public.user_sessions USING btree (expires_at);
CREATE INDEX idx_sessions_token ON public.user_sessions USING btree (token);
CREATE UNIQUE INDEX user_sessions_token_key ON public.user_sessions USING btree (token);
CREATE INDEX idx_users_active ON public.users USING btree (is_active);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_usuarios_auth_user_id ON public.usuarios USING btree (auth_user_id);
CREATE UNIQUE INDEX usuarios_email_key ON public.usuarios USING btree (email);
CREATE INDEX idx_vendedores_posicao ON public.vendedores USING btree (posicao_ranking);
CREATE INDEX idx_vendedores_total_vendas ON public.vendedores USING btree (total_vendas_mes DESC);
CREATE UNIQUE INDEX vendedores_email_key ON public.vendedores USING btree (email);
