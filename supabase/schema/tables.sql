-- Snapshot do schema public (Supabase cadrulmppoxhsfjizcfy) gerado via MCP do Supabase para indexação pelo graphify.
-- NÃO é migration: não executar. Regenerar quando o schema mudar.

CREATE TABLE public.access_levels (
  id integer NOT NULL DEFAULT nextval('access_levels_id_seq'::regclass),
  name character varying NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_levels_name_key UNIQUE (name),
  CONSTRAINT access_levels_pkey PRIMARY KEY (id)
);

CREATE TABLE public.access_logs (
  id integer NOT NULL DEFAULT nextval('access_logs_id_seq'::regclass),
  user_id uuid,
  email character varying NOT NULL,
  action character varying NOT NULL,
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_logs_pkey PRIMARY KEY (id),
  CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE public.administradoras_sindicos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  endereco text,
  site text,
  telefone text,
  whatsapp text,
  contato_realizado boolean DEFAULT false,
  cidade text NOT NULL,
  latitude numeric,
  longitude numeric,
  place_id text,
  rating numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_google_sync timestamp with time zone,
  CONSTRAINT administradoras_sindicos_place_id_key UNIQUE (place_id),
  CONSTRAINT administradoras_sindicos_pkey PRIMARY KEY (id)
);
-- CONSTRAINT valid_rating CHECK (((rating IS NULL) OR ((rating >= (0)::numeric) AND (rating <= (5)::numeric))))

CREATE TABLE public.apontamentos_comerciais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo_oportunidade character varying NOT NULL,
  nome_cliente character varying NOT NULL,
  fase character varying NOT NULL,
  origem_cliente character varying NOT NULL,
  origem_outros character varying,
  proprietario_relacionamento character varying,
  valor_total_servico numeric DEFAULT 0.00,
  valor_entrada_servico numeric DEFAULT 0.00,
  quantidade_parcelas integer DEFAULT 1,
  cidade_atendimento character varying,
  cidade_outras character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ultimo_alinhamento_realizado timestamp with time zone,
  cnpj_cliente character varying,
  razao_social character varying,
  nome_fantasia character varying,
  logradouro character varying,
  bairro character varying,
  municipio character varying,
  uf character varying,
  cep character varying,
  cronograma_data_inicio date,
  cronograma_data_termino date,
  numero character varying,
  contato_cliente character varying NOT NULL DEFAULT ''::character varying,
  data_retomada_prevista date,
  observacao_retomada text,
  ativo boolean DEFAULT true,
  motivo_inativacao text,
  duplicado_de uuid,
  CONSTRAINT apontamentos_comerciais_pkey PRIMARY KEY (id),
  CONSTRAINT apontamentos_comerciais_duplicado_de_fkey FOREIGN KEY (duplicado_de) REFERENCES public.apontamentos_comerciais(id)
);

CREATE TABLE public.arsenal_arquivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  nome_arquivo_original character varying NOT NULL,
  tamanho_bytes bigint NOT NULL,
  tipo_arquivo character varying,
  caminho_storage text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arsenal_arquivos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.arsenal_financiamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  valor_total numeric NOT NULL,
  valor_entrada numeric NOT NULL,
  parcelas_entrada integer DEFAULT 1,
  entrada_com_juros boolean DEFAULT false,
  juros_entrada_ano numeric DEFAULT 0,
  valor_restante numeric NOT NULL,
  parcelas_restante integer NOT NULL,
  juros_restante_ano numeric NOT NULL,
  valor_total_final numeric NOT NULL,
  valor_juros_total numeric NOT NULL,
  resumo jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arsenal_financiamentos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.arsenal_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arsenal_links_pkey PRIMARY KEY (id)
);

-- Configurações globais key/value do sistema (ex.: dashboard_layout).
CREATE TABLE public.configuracoes_sistema (
  chave text NOT NULL,
  valor text NOT NULL,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_por text,
  CONSTRAINT configuracoes_sistema_pkey PRIMARY KEY (chave)
);

-- Atividades de execução (elétrica, civil, galpão)
CREATE TABLE public.execucao_atividades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo character varying NOT NULL,
  descricao text,
  tipo_execucao character varying NOT NULL,
  data_programada date NOT NULL,
  hora_inicio time without time zone,
  hora_fim time without time zone,
  status character varying DEFAULT 'pendente'::character varying,
  prioridade character varying DEFAULT 'normal'::character varying,
  tecnico_responsavel_id uuid,
  cliente_nome character varying,
  endereco text,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  etapa_id uuid,
  CONSTRAINT execucao_atividades_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_atividades_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id),
  CONSTRAINT execucao_atividades_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.execucao_obras_etapas(id) ON DELETE SET NULL,
  CONSTRAINT execucao_atividades_tecnico_responsavel_id_fkey FOREIGN KEY (tecnico_responsavel_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_atividades_prioridade_check CHECK (((prioridade)::text = ANY ((ARRAY['baixa'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[])))
-- CONSTRAINT execucao_atividades_status_check CHECK (((status)::text = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluida'::text, 'transferida'::text, 'cancelada'::text, 'pausada'::text])))
-- CONSTRAINT execucao_atividades_tipo_execucao_check CHECK (((tipo_execucao)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'gestao'::character varying, 'estoque'::character varying])::text[])))

-- Comentários dos técnicos e administradores nas atividades
CREATE TABLE public.execucao_atividades_comentarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  atividade_id uuid,
  usuario_id uuid,
  comentario text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_atividades_comentarios_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_atividades_comentarios_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
  CONSTRAINT execucao_atividades_comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);

-- Histórico de todas as ações realizadas nas atividades
CREATE TABLE public.execucao_atividades_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  atividade_id uuid,
  usuario_id uuid,
  tipo_acao character varying NOT NULL,
  descricao text,
  valor_anterior text,
  valor_novo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_atividades_historico_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_atividades_historico_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
  CONSTRAINT execucao_atividades_historico_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_atividades_historico_tipo_acao_check CHECK (((tipo_acao)::text = ANY (ARRAY['criacao'::text, 'comentario'::text, 'status_alterado'::text, 'transferencia'::text, 'conclusao'::text, 'edicao'::text, 'cancelamento'::text, 'pausa'::text, 'retomada'::text])))

CREATE TABLE public.execucao_historico_pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  usuario_id uuid,
  usuario_nome character varying,
  data_alteracao timestamp with time zone NOT NULL DEFAULT now(),
  tipo_alteracao character varying NOT NULL,
  descricao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  data_limite_anterior date,
  data_limite_nova date,
  motivo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_historico_pedidos_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_historico_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.execucao_pedidos_material(id) ON DELETE CASCADE,
  CONSTRAINT execucao_historico_pedidos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);

-- Notificações para administradores sobre mudanças de status das atividades
CREATE TABLE public.execucao_notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo character varying NOT NULL,
  titulo character varying NOT NULL,
  mensagem text NOT NULL,
  atividade_id uuid,
  usuario_origem_id uuid,
  lida boolean DEFAULT false,
  lida_em timestamp with time zone,
  lida_por uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_notificacoes_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_notificacoes_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
  CONSTRAINT execucao_notificacoes_lida_por_fkey FOREIGN KEY (lida_por) REFERENCES public.usuarios(id),
  CONSTRAINT execucao_notificacoes_usuario_origem_id_fkey FOREIGN KEY (usuario_origem_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_notificacoes_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['pausa'::character varying, 'conclusao'::character varying, 'pendente'::character varying, 'atraso'::character varying, 'retomada'::character varying, 'urgente'::character varying])::text[])))

-- Obras/Projetos com cronogramas de execução
CREATE TABLE public.execucao_obras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_cliente character varying NOT NULL,
  endereco text,
  cidade character varying,
  contrato_numero character varying,
  data_contrato date,
  data_inicio_prevista date NOT NULL,
  data_fim_prevista date NOT NULL,
  data_inicio_real date,
  data_fim_real date,
  tipo_obra character varying DEFAULT 'misto'::character varying,
  status character varying DEFAULT 'planejada'::character varying,
  prioridade character varying DEFAULT 'media'::character varying,
  progresso_geral integer DEFAULT 0,
  responsavel_id uuid,
  valor_contrato numeric,
  observacoes text,
  cor character varying DEFAULT '#3b82f6'::character varying,
  apontamento_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  contato_cliente character varying,
  template_id uuid,
  CONSTRAINT execucao_obras_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_obras_apontamento_id_fkey FOREIGN KEY (apontamento_id) REFERENCES public.apontamentos_comerciais(id) ON DELETE SET NULL,
  CONSTRAINT execucao_obras_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id),
  CONSTRAINT execucao_obras_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.execucao_templates_etapas(id) ON DELETE SET NULL
);
-- CONSTRAINT execucao_obras_prioridade_check CHECK (((prioridade)::text = ANY ((ARRAY['baixa'::character varying, 'media'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[])))
-- CONSTRAINT execucao_obras_progresso_geral_check CHECK (((progresso_geral >= 0) AND (progresso_geral <= 100)))
-- CONSTRAINT execucao_obras_status_check CHECK (((status)::text = ANY ((ARRAY['planejada'::character varying, 'em_andamento'::character varying, 'pausada'::character varying, 'concluida'::character varying, 'cancelada'::character varying])::text[])))
-- CONSTRAINT execucao_obras_tipo_obra_check CHECK (((tipo_obra)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'misto'::character varying])::text[])))

-- Arquivos PDF anexados às obras
CREATE TABLE public.execucao_obras_arquivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  nome character varying NOT NULL,
  nome_arquivo_original character varying NOT NULL,
  caminho_storage text NOT NULL,
  tamanho_bytes bigint,
  mime_type character varying DEFAULT 'application/pdf'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_obras_arquivos_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_obras_arquivos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.execucao_obras(id) ON DELETE CASCADE
);

-- Etapas das obras para visualização Gantt e integração com agendas
CREATE TABLE public.execucao_obras_etapas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  nome character varying NOT NULL,
  descricao text,
  tipo character varying DEFAULT 'geral'::character varying,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ordem integer DEFAULT 0,
  etapa_pai_id uuid,
  progresso integer DEFAULT 0,
  status character varying DEFAULT 'pendente'::character varying,
  responsavel_id uuid,
  cor character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_obras_etapas_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_obras_etapas_etapa_pai_id_fkey FOREIGN KEY (etapa_pai_id) REFERENCES public.execucao_obras_etapas(id) ON DELETE SET NULL,
  CONSTRAINT execucao_obras_etapas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.execucao_obras(id) ON DELETE CASCADE,
  CONSTRAINT execucao_obras_etapas_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_obras_etapas_progresso_check CHECK (((progresso >= 0) AND (progresso <= 100)))
-- CONSTRAINT execucao_obras_etapas_status_check CHECK (((status)::text = ANY ((ARRAY['pendente'::character varying, 'em_andamento'::character varying, 'concluida'::character varying, 'atrasada'::character varying, 'cancelada'::character varying])::text[])))
-- CONSTRAINT execucao_obras_etapas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'geral'::character varying, 'administrativo'::character varying, 'gestao'::character varying, 'estoque'::character varying])::text[])))

-- Pedidos de material para as atividades de execução
CREATE TABLE public.execucao_pedidos_material (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  atividade_id uuid,
  solicitante_id uuid,
  descricao text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  status character varying DEFAULT 'concluido'::character varying,
  urgencia character varying DEFAULT 'normal'::character varying,
  observacoes text,
  aprovado_por uuid,
  data_aprovacao timestamp with time zone,
  data_entrega timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  obra_id uuid,
  etapa_id uuid,
  data_lista_pronta date,
  data_material_disponivel date,
  cliente_nome character varying,
  endereco_obra text,
  etapa_chegada_criada boolean DEFAULT false,
  CONSTRAINT execucao_pedidos_material_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_pedidos_material_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES public.usuarios(id),
  CONSTRAINT execucao_pedidos_material_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.execucao_atividades(id),
  CONSTRAINT execucao_pedidos_material_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.execucao_obras_etapas(id) ON DELETE SET NULL,
  CONSTRAINT execucao_pedidos_material_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.execucao_obras(id) ON DELETE CASCADE,
  CONSTRAINT execucao_pedidos_material_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_pedidos_material_status_check CHECK (((status)::text = ANY ((ARRAY['pendente'::character varying, 'aprovado'::character varying, 'recusado'::character varying, 'entregue'::character varying, 'cancelado'::character varying, 'concluido'::character varying, 'solicitado'::character varying])::text[])))
-- CONSTRAINT execucao_pedidos_material_urgencia_check CHECK (((urgencia)::text = ANY ((ARRAY['baixa'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[])))

-- Planejamento macro de projetos de execução
CREATE TABLE public.execucao_planejamento_macro (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo character varying NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date,
  status character varying DEFAULT 'planejado'::character varying,
  tipo_projeto character varying,
  responsavel_id uuid,
  progresso integer DEFAULT 0,
  cor character varying DEFAULT '#3b82f6'::character varying,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  prioridade character varying DEFAULT 'media'::character varying,
  CONSTRAINT execucao_planejamento_macro_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_planejamento_macro_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_planejamento_macro_prioridade_check CHECK (((prioridade)::text = ANY ((ARRAY['baixa'::character varying, 'media'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[])))
-- CONSTRAINT execucao_planejamento_macro_progresso_check CHECK (((progresso >= 0) AND (progresso <= 100)))
-- CONSTRAINT execucao_planejamento_macro_status_check CHECK (((status)::text = ANY ((ARRAY['planejado'::character varying, 'em_andamento'::character varying, 'concluido'::character varying, 'atrasado'::character varying, 'cancelado'::character varying])::text[])))
-- CONSTRAINT execucao_planejamento_macro_tipo_projeto_check CHECK (((tipo_projeto)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'misto'::character varying])::text[])))

-- Procedimentos Operacionais Padrão para os técnicos
CREATE TABLE public.execucao_pops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo character varying NOT NULL,
  descricao text,
  categoria character varying,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_pops_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_pops_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_pops_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'seguranca'::character varying, 'geral'::character varying, 'gestao'::character varying])::text[])))

-- Arquivos (fotos, vídeos, documentos) anexados aos POPs
CREATE TABLE public.execucao_pops_arquivos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pop_id uuid,
  tipo character varying NOT NULL,
  nome character varying NOT NULL,
  nome_arquivo_original character varying,
  caminho_storage text NOT NULL,
  tamanho_bytes bigint,
  mime_type character varying,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_pops_arquivos_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_pops_arquivos_pop_id_fkey FOREIGN KEY (pop_id) REFERENCES public.execucao_pops(id) ON DELETE CASCADE
);
-- CONSTRAINT execucao_pops_arquivos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['foto'::character varying, 'video'::character varying, 'documento'::character varying])::text[])))

-- Templates de etapas para criação rápida de obras
CREATE TABLE public.execucao_templates_etapas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  descricao text,
  tipo_obra character varying,
  icone character varying DEFAULT 'FaTasks'::character varying,
  cor character varying DEFAULT '#3b82f6'::character varying,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_templates_etapas_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_templates_etapas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id)
);
-- CONSTRAINT execucao_templates_etapas_tipo_obra_check CHECK (((tipo_obra)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'misto'::character varying, 'spda'::character varying, 'manutencao'::character varying])::text[])))

-- Itens (etapas) que compõem cada template
CREATE TABLE public.execucao_templates_etapas_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  nome character varying NOT NULL,
  descricao text,
  tipo character varying DEFAULT 'geral'::character varying,
  duracao_dias integer DEFAULT 3,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT execucao_templates_etapas_itens_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_templates_etapas_itens_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.execucao_templates_etapas(id) ON DELETE CASCADE
);
-- CONSTRAINT execucao_templates_etapas_itens_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['eletrica'::character varying, 'civil'::character varying, 'galpao'::character varying, 'geral'::character varying, 'administrativo'::character varying, 'gestao'::character varying, 'estoque'::character varying])::text[])))

CREATE TABLE public.execucao_templates_materiais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  descricao text,
  tipo_servico character varying,
  itens jsonb DEFAULT '[]'::jsonb,
  ativo boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  icone text DEFAULT 'FaTasks'::text,
  cor text DEFAULT '#8b5cf6'::text,
  listas jsonb,
  CONSTRAINT execucao_templates_materiais_pkey PRIMARY KEY (id),
  CONSTRAINT execucao_templates_materiais_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id)
);

CREATE TABLE public.historico_alteracoes_apontamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  apontamento_id uuid NOT NULL,
  campo_alterado character varying NOT NULL,
  valor_anterior text,
  valor_novo text,
  data_alteracao timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT historico_alteracoes_apontamentos_pkey PRIMARY KEY (id),
  CONSTRAINT historico_alteracoes_apontamentos_apontamento_id_fkey FOREIGN KEY (apontamento_id) REFERENCES public.apontamentos_comerciais(id) ON DELETE CASCADE
);

CREATE TABLE public.logs_acesso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_email character varying NOT NULL,
  ip_address inet,
  data_acesso timestamp without time zone DEFAULT now(),
  acao character varying NOT NULL,
  detalhes jsonb,
  CONSTRAINT logs_acesso_pkey PRIMARY KEY (id)
);

CREATE TABLE public.metas_comerciais (
  id integer NOT NULL DEFAULT nextval('metas_comerciais_id_seq'::regclass),
  tipo_meta character varying NOT NULL,
  valor_meta numeric NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_meta_ativa UNIQUE (tipo_meta, mes, ano, ativo) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT metas_comerciais_pkey PRIMARY KEY (id)
);

CREATE TABLE public.niveis_acesso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  descricao text,
  criado_em timestamp without time zone DEFAULT now(),
  CONSTRAINT niveis_acesso_nome_key UNIQUE (nome),
  CONSTRAINT niveis_acesso_pkey PRIMARY KEY (id)
);

CREATE TABLE public.page_permissions (
  id integer NOT NULL DEFAULT nextval('page_permissions_id_seq'::regclass),
  access_level_id integer,
  page_id integer,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT page_permissions_access_level_id_page_id_key UNIQUE (access_level_id, page_id),
  CONSTRAINT page_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT page_permissions_access_level_id_fkey FOREIGN KEY (access_level_id) REFERENCES public.access_levels(id) ON DELETE CASCADE,
  CONSTRAINT page_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE
);

CREATE TABLE public.pages (
  id integer NOT NULL DEFAULT nextval('pages_id_seq'::regclass),
  name character varying NOT NULL,
  path character varying NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pages_name_key UNIQUE (name),
  CONSTRAINT pages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.paginas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  rota character varying NOT NULL,
  descricao text,
  criado_em timestamp without time zone DEFAULT now(),
  CONSTRAINT paginas_nome_key UNIQUE (nome),
  CONSTRAINT paginas_rota_key UNIQUE (rota),
  CONSTRAINT paginas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.permissoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nivel_acesso_id uuid,
  pagina_id uuid,
  criado_em timestamp without time zone DEFAULT now(),
  CONSTRAINT permissoes_nivel_acesso_id_pagina_id_key UNIQUE (nivel_acesso_id, pagina_id),
  CONSTRAINT permissoes_pkey PRIMARY KEY (id),
  CONSTRAINT permissoes_nivel_acesso_id_fkey FOREIGN KEY (nivel_acesso_id) REFERENCES public.niveis_acesso(id) ON DELETE CASCADE,
  CONSTRAINT permissoes_pagina_id_fkey FOREIGN KEY (pagina_id) REFERENCES public.paginas(id) ON DELETE CASCADE
);

CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  token text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_sessions_token_key UNIQUE (token),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  password_hash text NOT NULL,
  full_name character varying NOT NULL,
  is_active boolean DEFAULT true,
  is_admin boolean DEFAULT false,
  access_level_id integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  nome_completo character varying,
  ativo boolean DEFAULT false,
  nivel_acesso_id uuid,
  criado_em timestamp without time zone DEFAULT now(),
  atualizado_em timestamp without time zone DEFAULT now(),
  auth_user_id uuid,
  nome_vendedor_comercial character varying DEFAULT NULL::character varying,
  CONSTRAINT usuarios_email_key UNIQUE (email),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT usuarios_nivel_acesso_id_fkey FOREIGN KEY (nivel_acesso_id) REFERENCES public.niveis_acesso(id)
);

CREATE TABLE public.vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  email character varying,
  foto_url text,
  total_vendas_mes numeric DEFAULT 0.00,
  comissao_mes numeric DEFAULT 0.00,
  posicao_ranking integer,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendedores_email_key UNIQUE (email),
  CONSTRAINT vendedores_pkey PRIMARY KEY (id)
);
