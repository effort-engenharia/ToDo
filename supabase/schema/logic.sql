-- Snapshot (views, funções, triggers, policies e índices) do schema public, gerado via MCP do Supabase para o graphify.
-- Regenerado em 2026-11-01, depois de aplicadas as migrations 20261101_19 a _31. Corpos das funções resumidos (completos em supabase/migrations/).
-- NÃO é migration: não executar.

CREATE OR REPLACE FUNCTION public.alterar_status_atividade(p_id uuid, p_status text, p_motivo text DEFAULT NULL::text, p_ocorrido_em timestamp with time zone DEFAULT NULL::timestamp with time zone, p_id_cliente uuid DEFAULT NULL::uuid, p_motivo_codigo text DEFAULT NULL::text, p_solicita_replanejamento boolean DEFAULT false, p_horas_realizadas numeric DEFAULT NULL::numeric, p_observacao text DEFAULT NULL::text, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_precisao_m numeric DEFAULT NULL::numeric, p_geo_status text DEFAULT NULL::text)
 RETURNS execucao_atividades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_abrir_questionamento(p_pedido uuid, p_item_id text, p_tipo text, p_pergunta text, p_sugestao jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_alterar_status(p_pedido uuid, p_status text, p_obs text DEFAULT NULL::text, p_data_disponibilidade date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_assumir_pedido(p_pedido uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_cancelar_questionamento(p_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_definir_disponibilidade(p_pedido uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_detalhe_pedido(p_pedido uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_indicadores(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_listar_pedidos(p_filtros jsonb DEFAULT '{}'::jsonb, p_limite integer DEFAULT 50, p_cursor jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, descricao text, urgencia text, status text, status_compra text, status_compra_em timestamp with time zone, comprado_em timestamp with time zone, fila_compras_em timestamp with time zone, observacoes text, cliente_nome text, endereco_obra text, obra_id uuid, obra_status text, obra_cancelada boolean, atividade_id uuid, atividade_titulo text, solicitante_id uuid, solicitante_nome text, comprador_id uuid, comprador_nome text, data_lista_pronta date, data_material_disponivel date, data_entrega timestamp with time zone, etapa_chegada_id uuid, itens jsonb, qtd_itens integer, qtd_questionamentos_abertos integer, sem_itens boolean, atrasado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_listar_questionamentos(p_pedido uuid DEFAULT NULL::uuid, p_status text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, pedido_id uuid, item_id text, item_snapshot jsonb, tipo text, pergunta text, sugestao jsonb, status text, resposta_observacao text, criado_por uuid, criador_nome text, respondido_por uuid, respondedor_nome text, respondido_em timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.compras_responder_questionamento(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.criar_obra_completa(p_obra jsonb, p_etapas jsonb DEFAULT '[]'::jsonb, p_criar_atividades boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.current_nivel()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.current_usuario_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.decidir_horas_extras(p_ids uuid[], p_aprovar boolean, p_justificativa text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.deslocar_etapas(p_obra_id uuid, p_a_partir_da_ordem integer, p_dias_uteis integer, p_aplicar boolean DEFAULT false)
 RETURNS TABLE(etapa_id uuid, nome text, ordem integer, data_inicio_antes date, data_fim_antes date, data_inicio_depois date, data_fim_depois date, atividades_afetadas integer, obra_fim_previsto date, obra_fim_depois date)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_add_dias_uteis(p_data date, p_n integer, p_cidade uuid DEFAULT NULL::uuid)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_atividades_agregado(p_inicio date, p_fim date, p_tecnico uuid DEFAULT NULL::uuid)
 RETURNS TABLE(data_programada date, tipo_execucao text, status text, tecnico_id uuid, total bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_auditar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_auditoria_limpar(p_dias integer DEFAULT 365)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_avisar_atribuicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_avisar_material()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_broadcast_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_capacidade(p_inicio date, p_fim date)
 RETURNS TABLE(usuario_id uuid, data date, disponivel_min integer, extra_max_min integer, previsto_min integer, realizado_min integer, atividades integer, dia_util boolean, feriado boolean, ausente boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_compras_aplicar_disponibilidade(p_pedido uuid, p_data date, p_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_compras_historico(p_pedido uuid, p_uid uuid, p_tipo text, p_desc text, p_ant jsonb DEFAULT NULL::jsonb, p_novo jsonb DEFAULT NULL::jsonb, p_motivo text DEFAULT NULL::text, p_dl_ant date DEFAULT NULL::date, p_dl_nova date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_compras_notificar_solicitante(p_pedido uuid, p_tipo text, p_titulo text, p_msg text, p_ref jsonb, p_origem uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_compras_restaurar_status(p_pedido uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_contar_contratos_pendentes()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_contexto_atividades(p_ids uuid[])
 RETURNS TABLE(atividade_id uuid, obra_id uuid, nome_cliente text, endereco text, cidade text, contato_cliente text, sub_etapas jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_contratos_pendentes(p_incluir_planejados boolean DEFAULT false, p_busca text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome_cliente text, tipo_oportunidade text, tipo_servico_codigo text, tipo_servico_nome text, modalidade text, equipe_responsavel text, cronograma_data_inicio date, cronograma_data_termino date, valor_total_servico numeric, contato_cliente text, logradouro text, numero text, bairro text, cidade text, cidade_id uuid, obra_id uuid, ignorado boolean, motivo_ignorado text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_definir_equipe(p_atividade uuid, p_lider uuid, p_apoios uuid[] DEFAULT '{}'::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_desfazer(p_transacao bigint, p_forcar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_dia_util(p_data date, p_cidade uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_dias_uteis_entre(p_inicio date, p_fim date, p_cidade uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_eh_feriado(p_data date, p_cidade uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_horas_data_corte()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_horas_efetivas(p_atividade uuid, p_fim timestamp with time zone DEFAULT now())
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_horas_efetivas_calc(p_atividade uuid, p_fim timestamp with time zone DEFAULT now())
 RETURNS TABLE(horas numeric, origem text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_horas_marcar_ajuste()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_indicadores(p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_jornada_dia(p_usuario uuid, p_data date)
 RETURNS TABLE(minutos_liquidos integer, extra_max_min integer, dia_util boolean, feriado boolean, ausente boolean, cidade_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_listar_historico(p_obra uuid DEFAULT NULL::uuid, p_usuario uuid DEFAULT NULL::uuid, p_tabela text DEFAULT NULL::text, p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(transacao bigint, quando timestamp with time zone, usuario_id uuid, usuario_nome text, tabelas text[], itens integer, obra_id uuid, obra_nome text, resumo text, desfeito boolean, desfazivel boolean, contexto text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_lixeira_confirmar(p_bucket text, p_caminhos text[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_lixeira_pendentes(p_dias integer DEFAULT 30)
 RETURNS TABLE(bucket text, caminho text, excluido_em timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_lixeira_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_marcar_passo(p_atividade uuid, p_sub_etapa uuid, p_concluido boolean, p_id_cliente uuid DEFAULT NULL::uuid, p_ocorrido_em timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_material_status(p_atividade_ids uuid[])
 RETURNS TABLE(atividade_id uuid, situacao text, data_disponivel date, pedidos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_media_realizada_templates()
 RETURNS TABLE(template_id uuid, item_id uuid, item_nome text, horas_previstas numeric, media_realizada numeric, execucoes integer, ajustes integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_min_dia(p_periodos jsonb, p_chave text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_painel_carteira()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_participa(p_atividade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_participa_path(p_nome text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pascoa(p_ano integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_passos_pendentes_por_etapa(p_obras uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(obra_id uuid, etapa_id uuid, passos_total integer, passos_concluidos integer, passos_abertos integer, atividades_total integer, atividades_concluidas integer, atividades_abertas integer, passos_pendentes integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedido_avisar_edicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedido_fechar_questionamentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedido_itens_sem_id(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedido_tem_itens(p_itens jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedidos_compras_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedidos_itens_com_id(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_pedidos_itens_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_recalcular_etapa_pai(p_pai uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_recalcular_progresso(p_obra uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_recalcular_progresso_obra(p_obra uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_resumo_linha(p_tabela text, p_op text, p_antes jsonb, p_depois jsonb, p_campos text[], p_itens integer, p_obra_nome text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_saude_core()
 RETURNS TABLE(obra_id uuid, saude text, motivos text[], progresso_esperado integer, progresso_real integer, dias_atraso integer, etapas_vencidas integer, sem_responsavel integer, material_pendente integer, replanejamento integer, pausadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_saude_obras()
 RETURNS TABLE(obra_id uuid, saude text, motivos text[], progresso_esperado integer, progresso_real integer, dias_atraso integer, etapas_vencidas integer, sem_responsavel integer, material_pendente integer, replanejamento integer, pausadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_sincronizar_etapa_pai(p_etapa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_sincronizar_subetapas_datas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.execucao_sync_lider()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.gerar_notificacoes_atraso()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.is_admin_execucao()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.is_compras()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.is_usuario_execucao()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.pode_ver_compras()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.reportar_falta_material(p_atividade_id uuid, p_descricao text, p_pausar boolean DEFAULT true, p_ocorrido_em timestamp with time zone DEFAULT NULL::timestamp with time zone, p_id_cliente uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.status_execucao_contratos(p_apontamento_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(apontamento_id uuid, status_execucao text, progresso integer, inicio_previsto date, entrega_prevista date, entregue_em date, saude text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  -- corpo completo em supabase/migrations/
$function$
;

CREATE TRIGGER update_administradoras_sindicos_updated_at BEFORE UPDATE ON public.administradoras_sindicos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apontamentos_comerciais_updated_at BEFORE UPDATE ON public.apontamentos_comerciais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apontamentos_updated_at BEFORE UPDATE ON public.apontamentos_comerciais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arsenal_links_updated_at BEFORE UPDATE ON public.arsenal_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_atividades FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_avisar_atribuicao AFTER INSERT OR UPDATE OF tecnico_responsavel_id ON public.execucao_atividades FOR EACH ROW EXECUTE FUNCTION execucao_avisar_atribuicao();
CREATE TRIGGER trg_horas_marcar_ajuste BEFORE UPDATE OF horas_realizadas ON public.execucao_atividades FOR EACH ROW EXECUTE FUNCTION execucao_horas_marcar_ajuste();
CREATE TRIGGER trg_sync_lider AFTER INSERT OR UPDATE OF tecnico_responsavel_id ON public.execucao_atividades FOR EACH ROW EXECUTE FUNCTION execucao_sync_lider();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_atividades_equipe FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_avisar_apoio AFTER INSERT ON public.execucao_atividades_equipe FOR EACH ROW EXECUTE FUNCTION execucao_avisar_atribuicao();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_atividades_evidencias FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_lixeira AFTER INSERT OR DELETE ON public.execucao_atividades_evidencias FOR EACH ROW EXECUTE FUNCTION execucao_lixeira_trg();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_ausencias FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_cidades FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_feriados FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_horas_extras FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_jornadas_modelo FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_obras FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_broadcast_status AFTER INSERT OR UPDATE ON public.execucao_obras FOR EACH ROW EXECUTE FUNCTION execucao_broadcast_status();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_obras_arquivos FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_lixeira AFTER INSERT OR DELETE ON public.execucao_obras_arquivos FOR EACH ROW EXECUTE FUNCTION execucao_lixeira_trg();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_obras_etapas FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_sync_subetapas_datas AFTER UPDATE OF data_inicio, data_fim ON public.execucao_obras_etapas FOR EACH ROW EXECUTE FUNCTION execucao_sincronizar_subetapas_datas();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_pedidos_material FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_avisar_material AFTER UPDATE ON public.execucao_pedidos_material FOR EACH ROW EXECUTE FUNCTION execucao_avisar_material();
CREATE TRIGGER trg_pedido_avisar_edicao AFTER UPDATE OF itens ON public.execucao_pedidos_material FOR EACH ROW EXECUTE FUNCTION execucao_pedido_avisar_edicao();
CREATE TRIGGER trg_pedido_fechar_questionamentos AFTER UPDATE OF status_compra ON public.execucao_pedidos_material FOR EACH ROW WHEN (((new.status_compra = ANY (ARRAY['comprado'::text, 'entregue_parcial'::text, 'entregue'::text, 'cancelado'::text])) AND (new.status_compra IS DISTINCT FROM old.status_compra))) EXECUTE FUNCTION execucao_pedido_fechar_questionamentos();
CREATE TRIGGER trg_pedidos_compras_sync BEFORE INSERT OR UPDATE OF status, itens, atividade_id, status_compra ON public.execucao_pedidos_material FOR EACH ROW EXECUTE FUNCTION execucao_pedidos_compras_sync();
CREATE TRIGGER trg_pedidos_itens_id BEFORE INSERT OR UPDATE OF itens ON public.execucao_pedidos_material FOR EACH ROW EXECUTE FUNCTION execucao_pedidos_itens_trg();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_planejamento_macro FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_pops FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_pops_arquivos FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_lixeira AFTER INSERT OR DELETE ON public.execucao_pops_arquivos FOR EACH ROW EXECUTE FUNCTION execucao_lixeira_trg();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_templates_etapas FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_templates_etapas_itens FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
CREATE TRIGGER trg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.execucao_templates_materiais FOR EACH ROW EXECUTE FUNCTION execucao_auditar();
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
CREATE POLICY atv_admin_all ON public.execucao_atividades AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY atv_tecnico_select ON public.execucao_atividades AS PERMISSIVE FOR SELECT TO authenticated USING (((tecnico_responsavel_id = ( SELECT current_usuario_id() AS current_usuario_id)) OR ( SELECT execucao_participa(execucao_atividades.id) AS execucao_participa)));
CREATE POLICY atv_tecnico_update ON public.execucao_atividades AS PERMISSIVE FOR UPDATE TO authenticated USING (((tecnico_responsavel_id = ( SELECT current_usuario_id() AS current_usuario_id)) OR ( SELECT execucao_participa(execucao_atividades.id) AS execucao_participa))) WITH CHECK (((tecnico_responsavel_id = ( SELECT current_usuario_id() AS current_usuario_id)) OR ( SELECT execucao_participa(execucao_atividades.id) AS execucao_participa)));
CREATE POLICY coment_admin_all ON public.execucao_atividades_comentarios AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY coment_tecnico_insert ON public.execucao_atividades_comentarios AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)) AND (EXISTS ( SELECT 1
   FROM execucao_atividades a
  WHERE (a.id = execucao_atividades_comentarios.atividade_id)))));
CREATE POLICY coment_tecnico_select ON public.execucao_atividades_comentarios AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM execucao_atividades a
  WHERE (a.id = execucao_atividades_comentarios.atividade_id))));
CREATE POLICY equipe_admin ON public.execucao_atividades_equipe AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY equipe_tecnico_select ON public.execucao_atividades_equipe AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT execucao_participa(execucao_atividades_equipe.atividade_id) AS execucao_participa));
CREATE POLICY ev_admin ON public.execucao_atividades_evidencias AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY ev_tecnico_insert ON public.execucao_atividades_evidencias AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((criado_por = ( SELECT current_usuario_id() AS current_usuario_id)) AND ( SELECT execucao_participa(execucao_atividades_evidencias.atividade_id) AS execucao_participa)));
CREATE POLICY ev_tecnico_select ON public.execucao_atividades_evidencias AS PERMISSIVE FOR SELECT TO authenticated USING (((excluido_em IS NULL) AND ( SELECT execucao_participa(execucao_atividades_evidencias.atividade_id) AS execucao_participa)));
CREATE POLICY hist_admin_all ON public.execucao_atividades_historico AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY hist_tecnico_insert ON public.execucao_atividades_historico AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)) AND (EXISTS ( SELECT 1
   FROM execucao_atividades a
  WHERE (a.id = execucao_atividades_historico.atividade_id)))));
CREATE POLICY hist_tecnico_select ON public.execucao_atividades_historico AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM execucao_atividades a
  WHERE (a.id = execucao_atividades_historico.atividade_id))));
CREATE POLICY aud_admin_select ON public.execucao_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY aus_admin ON public.execucao_ausencias AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY aus_self ON public.execucao_ausencias AS PERMISSIVE FOR SELECT TO authenticated USING ((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)));
CREATE POLICY cidades_admin ON public.execucao_cidades AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY cidades_read ON public.execucao_cidades AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_usuario_execucao() AS is_usuario_execucao));
CREATE POLICY ignorados_admin ON public.execucao_contratos_ignorados AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY feriados_admin ON public.execucao_feriados AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY feriados_read ON public.execucao_feriados AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_usuario_execucao() AS is_usuario_execucao));
CREATE POLICY historico_pedidos_admin_delete ON public.execucao_historico_pedidos AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY historico_pedidos_admin_insert ON public.execucao_historico_pedidos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY historico_pedidos_admin_update ON public.execucao_historico_pedidos AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY historico_pedidos_select ON public.execucao_historico_pedidos AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT is_admin_execucao() AS is_admin_execucao) OR ( SELECT is_compras() AS is_compras)));
CREATE POLICY he_admin ON public.execucao_horas_extras AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY he_self_insert ON public.execucao_horas_extras AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)) AND (registrado_por = ( SELECT current_usuario_id() AS current_usuario_id)) AND (status = 'pendente'::text)));
CREATE POLICY he_self_select ON public.execucao_horas_extras AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)) OR (registrado_por = ( SELECT current_usuario_id() AS current_usuario_id))));
CREATE POLICY jc_admin ON public.execucao_jornadas_colaborador AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY jc_self ON public.execucao_jornadas_colaborador AS PERMISSIVE FOR SELECT TO authenticated USING ((usuario_id = ( SELECT current_usuario_id() AS current_usuario_id)));
CREATE POLICY jm_admin ON public.execucao_jornadas_modelo AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY jm_read ON public.execucao_jornadas_modelo AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_usuario_execucao() AS is_usuario_execucao));
CREATE POLICY lixeira_admin ON public.execucao_lixeira_storage AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY execucao_notificacoes_admin_all ON public.execucao_notificacoes AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY notif_tecnico_select ON public.execucao_notificacoes AS PERMISSIVE FOR SELECT TO authenticated USING (((destinatario_id IS NOT NULL) AND (destinatario_id = ( SELECT current_usuario_id() AS current_usuario_id))));
CREATE POLICY notif_tecnico_update ON public.execucao_notificacoes AS PERMISSIVE FOR UPDATE TO authenticated USING (((destinatario_id IS NOT NULL) AND (destinatario_id = ( SELECT current_usuario_id() AS current_usuario_id)))) WITH CHECK (((destinatario_id IS NOT NULL) AND (destinatario_id = ( SELECT current_usuario_id() AS current_usuario_id))));
CREATE POLICY execucao_obras_admin_all ON public.execucao_obras AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY execucao_obras_arquivos_admin_all ON public.execucao_obras_arquivos AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY execucao_obras_etapas_admin_all ON public.execucao_obras_etapas AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pedidos_admin_delete ON public.execucao_pedidos_material AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pedidos_admin_insert ON public.execucao_pedidos_material AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pedidos_admin_update ON public.execucao_pedidos_material AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pedidos_select ON public.execucao_pedidos_material AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT is_admin_execucao() AS is_admin_execucao) OR ( SELECT is_compras() AS is_compras)));
CREATE POLICY quest_select ON public.execucao_pedidos_questionamentos AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT pode_ver_compras() AS pode_ver_compras));
CREATE POLICY execucao_planejamento_macro_admin_all ON public.execucao_planejamento_macro AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pops_admin_write ON public.execucao_pops AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pops_read ON public.execucao_pops AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT is_usuario_execucao() AS is_usuario_execucao) OR ( SELECT is_compras() AS is_compras)));
CREATE POLICY pops_arq_admin_write ON public.execucao_pops_arquivos AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY pops_arq_read ON public.execucao_pops_arquivos AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT is_usuario_execucao() AS is_usuario_execucao) OR ( SELECT is_compras() AS is_compras)));
CREATE POLICY execucao_templates_etapas_admin_all ON public.execucao_templates_etapas AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY execucao_templates_etapas_itens_admin_all ON public.execucao_templates_etapas_itens AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY execucao_templates_materiais_admin_all ON public.execucao_templates_materiais AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY tipos_admin ON public.execucao_tipos_servico AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin_execucao() AS is_admin_execucao)) WITH CHECK (( SELECT is_admin_execucao() AS is_admin_execucao));
CREATE POLICY tipos_read ON public.execucao_tipos_servico AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT is_usuario_execucao() AS is_usuario_execucao));
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
CREATE INDEX idx_atv_data_fim ON public.execucao_atividades USING btree (data_programada, data_fim);
CREATE INDEX idx_atv_status_data ON public.execucao_atividades USING btree (status, data_programada);
CREATE INDEX idx_atv_tecnico_data ON public.execucao_atividades USING btree (tecnico_responsavel_id, data_programada);
CREATE INDEX idx_atv_tipo_data ON public.execucao_atividades USING btree (tipo_execucao, data_programada);
CREATE INDEX idx_execucao_atividades_data ON public.execucao_atividades USING btree (data_programada);
CREATE INDEX idx_execucao_atividades_status ON public.execucao_atividades USING btree (status);
CREATE INDEX idx_execucao_atividades_tecnico ON public.execucao_atividades USING btree (tecnico_responsavel_id);
CREATE INDEX idx_execucao_atividades_tipo ON public.execucao_atividades USING btree (tipo_execucao);
CREATE INDEX idx_execucao_comentarios_atividade ON public.execucao_atividades_comentarios USING btree (atividade_id);
CREATE INDEX idx_execucao_comentarios_data ON public.execucao_atividades_comentarios USING btree (created_at);
CREATE INDEX idx_equipe_usuario ON public.execucao_atividades_equipe USING btree (usuario_id);
CREATE INDEX idx_evidencias_atividade ON public.execucao_atividades_evidencias USING btree (atividade_id, created_at DESC);
CREATE INDEX idx_execucao_historico_atividade ON public.execucao_atividades_historico USING btree (atividade_id);
CREATE INDEX idx_execucao_historico_data ON public.execucao_atividades_historico USING btree (created_at);
CREATE INDEX idx_execucao_historico_usuario ON public.execucao_atividades_historico USING btree (usuario_id);
CREATE INDEX idx_hist_atv_created ON public.execucao_atividades_historico USING btree (atividade_id, created_at DESC);
CREATE INDEX idx_aud_created ON public.execucao_auditoria USING btree (created_at DESC);
CREATE INDEX idx_aud_registro ON public.execucao_auditoria USING btree (tabela, registro_id, id DESC);
CREATE INDEX idx_aud_transacao ON public.execucao_auditoria USING btree (transacao);
CREATE INDEX idx_ausencias_usuario ON public.execucao_ausencias USING btree (usuario_id, data_inicio, data_fim);
CREATE UNIQUE INDEX execucao_cidades_nome_norm_uf_key ON public.execucao_cidades USING btree (nome_norm, uf);
CREATE INDEX idx_execucao_feriados_data ON public.execucao_feriados USING btree (data);
CREATE UNIQUE INDEX uq_execucao_feriado ON public.execucao_feriados USING btree (data, abrangencia, COALESCE((uf)::text, ''::text), COALESCE((cidade_id)::text, ''::text), descricao);
CREATE INDEX idx_historico_data ON public.execucao_historico_pedidos USING btree (data_alteracao DESC);
CREATE INDEX idx_historico_pedido_id ON public.execucao_historico_pedidos USING btree (pedido_id);
CREATE INDEX idx_horas_extras_status ON public.execucao_horas_extras USING btree (status, data);
CREATE INDEX idx_horas_extras_usuario ON public.execucao_horas_extras USING btree (usuario_id, data);
CREATE UNIQUE INDEX execucao_jornadas_modelo_nome_vigente_desde_key ON public.execucao_jornadas_modelo USING btree (nome, vigente_desde);
CREATE INDEX idx_notif_destinatario ON public.execucao_notificacoes USING btree (destinatario_id, lida, created_at DESC);
CREATE INDEX idx_notif_lida_created ON public.execucao_notificacoes USING btree (lida, created_at DESC);
CREATE INDEX idx_notificacoes_atividade ON public.execucao_notificacoes USING btree (atividade_id);
CREATE INDEX idx_notificacoes_created_at ON public.execucao_notificacoes USING btree (created_at DESC);
CREATE INDEX idx_notificacoes_lida ON public.execucao_notificacoes USING btree (lida);
CREATE INDEX idx_notificacoes_tipo ON public.execucao_notificacoes USING btree (tipo);
CREATE UNIQUE INDEX uq_notif_atraso_dia ON public.execucao_notificacoes USING btree (atividade_id, (((created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date)) WHERE ((tipo)::text = 'atraso'::text);
CREATE INDEX idx_obras_cidade ON public.execucao_obras USING btree (cidade_id);
CREATE INDEX idx_obras_datas ON public.execucao_obras USING btree (data_inicio_prevista, data_fim_prevista);
CREATE INDEX idx_obras_responsavel ON public.execucao_obras USING btree (responsavel_id);
CREATE INDEX idx_obras_status ON public.execucao_obras USING btree (status);
CREATE UNIQUE INDEX uq_obra_apontamento ON public.execucao_obras USING btree (apontamento_id) WHERE (apontamento_id IS NOT NULL);
CREATE INDEX idx_execucao_obras_arquivos_obra_id ON public.execucao_obras_arquivos USING btree (obra_id);
CREATE INDEX idx_etapas_datas ON public.execucao_obras_etapas USING btree (data_inicio, data_fim);
CREATE INDEX idx_etapas_obra ON public.execucao_obras_etapas USING btree (obra_id);
CREATE INDEX idx_etapas_pai ON public.execucao_obras_etapas USING btree (etapa_pai_id) WHERE (etapa_pai_id IS NOT NULL);
CREATE INDEX idx_etapas_tipo ON public.execucao_obras_etapas USING btree (tipo);
CREATE INDEX idx_execucao_pedidos_atividade ON public.execucao_pedidos_material USING btree (atividade_id);
CREATE INDEX idx_execucao_pedidos_data ON public.execucao_pedidos_material USING btree (created_at);
CREATE INDEX idx_execucao_pedidos_solicitante ON public.execucao_pedidos_material USING btree (solicitante_id);
CREATE INDEX idx_execucao_pedidos_status ON public.execucao_pedidos_material USING btree (status);
CREATE INDEX idx_pedidos_comprador ON public.execucao_pedidos_material USING btree (comprador_id) WHERE (comprador_id IS NOT NULL);
CREATE INDEX idx_pedidos_created_id ON public.execucao_pedidos_material USING btree (created_at DESC, id);
CREATE INDEX idx_pedidos_etapa_chegada ON public.execucao_pedidos_material USING btree (etapa_chegada_id) WHERE (etapa_chegada_id IS NOT NULL);
CREATE INDEX idx_pedidos_obra ON public.execucao_pedidos_material USING btree (obra_id);
CREATE INDEX idx_pedidos_status_compra_created ON public.execucao_pedidos_material USING btree (status_compra, created_at DESC);
CREATE INDEX idx_pedidos_status_created ON public.execucao_pedidos_material USING btree (status, created_at DESC);
CREATE INDEX idx_quest_criado_por ON public.execucao_pedidos_questionamentos USING btree (criado_por);
CREATE INDEX idx_quest_pedido_status ON public.execucao_pedidos_questionamentos USING btree (pedido_id, status);
CREATE INDEX idx_quest_respondido_por ON public.execucao_pedidos_questionamentos USING btree (respondido_por) WHERE (respondido_por IS NOT NULL);
CREATE INDEX idx_execucao_planejamento_datas ON public.execucao_planejamento_macro USING btree (data_inicio, data_fim);
CREATE INDEX idx_execucao_planejamento_responsavel ON public.execucao_planejamento_macro USING btree (responsavel_id);
CREATE INDEX idx_execucao_planejamento_status ON public.execucao_planejamento_macro USING btree (status);
CREATE INDEX idx_execucao_pops_ativo ON public.execucao_pops USING btree (ativo);
CREATE INDEX idx_execucao_pops_categoria ON public.execucao_pops USING btree (categoria);
CREATE INDEX idx_execucao_pops_ordem ON public.execucao_pops USING btree (ordem);
CREATE INDEX idx_pops_cat_ativo_ordem ON public.execucao_pops USING btree (categoria, ativo, ordem);
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
