-- 34 (B-01 · PLANO_COTACAO_FORNECEDORES §5.1–5.3, §6, §7.1): configuração, fornecedores e catálogo de materiais do módulo Compras.
--
-- Q-02 (revisão QA, 2026-11-02): corrigido compras_fornecedor_anonimizar — o WhatsApp '550000000000' violava o CHECK
--   ^55[1-9][0-9]{9,10}$ (dígito após 55 não pode ser 0), então a anonimização sempre falharia; agora '551100000000'.
-- Q-02b (pendências baixas): (a) compras_material_salvar não troca a unidade de material que já tem histórico de preço em
--   compras_precos_historico ("crie outro material"); (b) compras_fornecedor_anonimizar também zera o texto livre digitado pelo
--   fornecedor (compras_cotacao_respostas.observacao e compras_cotacao_resposta_itens.observacao) das respostas dele.
--
-- Objetivo:
--   * compras_config (linha única, kill switch do link público, taxa, limites de rate limit, mensagens de WhatsApp);
--     compras_config_segredo (pepper do hash de IP; SEM policy e SEM grant).
--   * compras_fornecedores, compras_materiais, compras_materiais_aliases (RLS: SELECT só is_compras(); escrita só via RPC).
--   * Funções puras: compras_normalizar_nome / _unidade / _whatsapp; helper compras_similaridade (pg_trgm opcional).
--   * RPCs (SECURITY DEFINER, search_path fixo, papel validado dentro): compras_config_obter, compras_config_salvar,
--     compras_fornecedor_salvar / _definir_ativo / _excluir / _anonimizar, compras_material_sugerir / _salvar / _mesclar.
--   * CHECK de execucao_notificacoes: + 'compra_cotacao', 'compra_alteracao' (refaz o CHECK completo da mig. 25).
--   * pg_trgm (schema extensions) criado num bloco DO com EXCEPTION: se não for possível, as RPCs usam ILIKE por tokens.
--
-- Dependências: migrations 24, 25, 32 e 33 aplicadas (is_compras(), current_usuario_id(), current_nivel()).
-- ATENÇÃO: aplicar 34 → 35 → 36 → 37 em sequência (B-08). compras_fornecedor_excluir/_anonimizar e compras_material_mesclar
--   referenciam tabelas criadas na 35; plpgsql só resolve nomes em tempo de execução, então a criação não falha, mas essas
--   três RPCs só funcionam depois da 35.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_material_mesclar(uuid, uuid, text), public.compras_material_salvar(uuid, text, text, text),
--     public.compras_material_sugerir(text, text, int), public.compras_fornecedor_anonimizar(uuid, text),
--     public.compras_fornecedor_excluir(uuid), public.compras_fornecedor_definir_ativo(uuid, boolean),
--     public.compras_fornecedor_salvar(uuid, jsonb), public.compras_config_salvar(jsonb), public.compras_config_obter(),
--     public.compras_similaridade(text, text), public.compras_normalizar_whatsapp(text), public.compras_normalizar_unidade(text),
--     public.compras_normalizar_nome(text);
--   DROP TABLE IF EXISTS public.compras_materiais_aliases, public.compras_materiais, public.compras_fornecedores,
--     public.compras_config_segredo, public.compras_config;     -- só após exportar os dados
--   Reaplicar o CHECK de notificações da mig. 25 (sem compra_cotacao/compra_alteracao; antes, apagar/atualizar linhas desses tipos).

-- ---------- Notificações: tipos novos ----------
ALTER TABLE public.execucao_notificacoes DROP CONSTRAINT IF EXISTS execucao_notificacoes_tipo_check;
ALTER TABLE public.execucao_notificacoes ADD CONSTRAINT execucao_notificacoes_tipo_check
  CHECK (tipo IN ('pausa', 'conclusao', 'pendente', 'atraso', 'retomada', 'urgente',
                  'material', 'hora_extra', 'replanejamento', 'transferencia', 'pendencia', 'nova_atividade',
                  'compra_questionamento', 'compra_resposta', 'compra_status',
                  'compra_cotacao', 'compra_alteracao'));

-- ---------- pg_trgm (opcional) ----------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm indisponível (%): sugestão de materiais usará ILIKE por tokens', SQLERRM;
END $$;

-- ---------- 5.1 Configuração ----------
CREATE TABLE IF NOT EXISTS public.compras_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  taxa_mensal numeric(6,4) NOT NULL DEFAULT 0.0150 CHECK (taxa_mensal >= 0 AND taxa_mensal <= 0.2),
  empate_pct numeric(6,4) NOT NULL DEFAULT 0.0100 CHECK (empate_pct >= 0 AND empate_pct <= 0.2),
  alerta_pct numeric(6,4) NOT NULL DEFAULT 0.1000 CHECK (alerta_pct >= 0 AND alerta_pct <= 5),
  faixa_neutra_pct numeric(6,4) NOT NULL DEFAULT 0.0200 CHECK (faixa_neutra_pct >= 0 AND faixa_neutra_pct <= 1),
  prazo_padrao_horas int NOT NULL DEFAULT 48 CHECK (prazo_padrao_horas BETWEEN 1 AND 720),
  janela_referencia_meses int NOT NULL DEFAULT 6 CHECK (janela_referencia_meses BETWEEN 1 AND 60),
  fallback_ultimas_compras int NOT NULL DEFAULT 5 CHECK (fallback_ultimas_compras BETWEEN 1 AND 50),
  prazo_aceite_horas_uteis int NOT NULL DEFAULT 24 CHECK (prazo_aceite_horas_uteis BETWEEN 1 AND 720),
  nome_empresa_publico text NOT NULL DEFAULT 'Effort' CHECK (length(btrim(nome_empresa_publico)) BETWEEN 2 AND 80),
  mensagem_padrao text NOT NULL DEFAULT 'Olá {contato}, tudo bem? Aqui é da {empresa_publica}. Segue a cotação nº {numero} com {qtd_itens} itens. Para informar preços e condições, acesse: {link} . Prazo para resposta: {prazo}. Obrigado!'
    CHECK (length(mensagem_padrao) BETWEEN 10 AND 1000),
  mensagem_lembrete text NOT NULL DEFAULT 'Olá {contato}, lembrando da cotação nº {numero} da {empresa_publica}. Prazo: {prazo}. Link atualizado: {link}'
    CHECK (length(mensagem_lembrete) BETWEEN 10 AND 1000),
  mensagem_revisao text NOT NULL DEFAULT 'Olá {contato}, a lista da cotação nº {numero} foi atualizada. Por favor, confira e reenvie sua proposta até {prazo}: {link}'
    CHECK (length(mensagem_revisao) BETWEEN 10 AND 1000),
  link_publico_ativo boolean NOT NULL DEFAULT true,
  rl_token_obter_10min int NOT NULL DEFAULT 60 CHECK (rl_token_obter_10min BETWEEN 1 AND 10000),
  rl_token_responder_10min int NOT NULL DEFAULT 10 CHECK (rl_token_responder_10min BETWEEN 1 AND 10000),
  rl_ip_obter_10min int NOT NULL DEFAULT 120 CHECK (rl_ip_obter_10min BETWEEN 1 AND 10000),
  rl_ip_responder_10min int NOT NULL DEFAULT 30 CHECK (rl_ip_responder_10min BETWEEN 1 AND 10000),
  rl_global_responder_hora int NOT NULL DEFAULT 600 CHECK (rl_global_responder_hora BETWEEN 1 AND 100000),
  alertas_ultima_execucao timestamptz,
  updated_by uuid REFERENCES public.usuarios(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.compras_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_compras_config_updated_by ON public.compras_config (updated_by) WHERE updated_by IS NOT NULL;

-- Segredo: sem policy, sem grant (só funções SECURITY DEFINER leem).
-- Pepper gerado só com gen_random_uuid() (CSPRNG do core), sem depender de pgcrypto.
CREATE TABLE IF NOT EXISTS public.compras_config_segredo (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pepper_ip text NOT NULL
);
INSERT INTO public.compras_config_segredo (id, pepper_ip)
VALUES (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

-- ---------- 5.2 Fornecedores ----------
CREATE TABLE IF NOT EXISTS public.compras_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_contato text NOT NULL CHECK (length(nome_contato) BETWEEN 2 AND 120),
  empresa text NOT NULL CHECK (length(empresa) BETWEEN 2 AND 160),
  whatsapp text NOT NULL CHECK (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  documento text CHECK (documento IS NULL OR documento ~ '^([0-9]{11}|[0-9]{14})$'),
  email text CHECK (email IS NULL OR length(email) <= 200),
  categorias text[] NOT NULL DEFAULT '{}',
  observacao text CHECK (observacao IS NULL OR length(observacao) <= 500),
  ativo boolean NOT NULL DEFAULT true,
  anonimizado_em timestamptz,
  base_legal text NOT NULL DEFAULT 'procedimentos_preliminares_contrato',
  created_by uuid REFERENCES public.usuarios(id),
  updated_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_fornecedores_whatsapp_empresa
  ON public.compras_fornecedores (whatsapp, lower(empresa)) WHERE anonimizado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_compras_fornecedores_ativo_empresa ON public.compras_fornecedores (ativo, empresa);
CREATE INDEX IF NOT EXISTS idx_compras_fornecedores_created_by ON public.compras_fornecedores (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_fornecedores_updated_by ON public.compras_fornecedores (updated_by) WHERE updated_by IS NOT NULL;

-- ---------- 5.3 Catálogo de materiais ----------
CREATE TABLE IF NOT EXISTS public.compras_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(nome) BETWEEN 2 AND 200),
  nome_normalizado text NOT NULL,
  unidade text NOT NULL,
  categoria text CHECK (categoria IS NULL OR length(categoria) <= 80),
  ativo boolean NOT NULL DEFAULT true,
  mesclado_em_id uuid REFERENCES public.compras_materiais(id),
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_materiais_nome_unidade
  ON public.compras_materiais (nome_normalizado, unidade) WHERE mesclado_em_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_compras_materiais_mesclado ON public.compras_materiais (mesclado_em_id) WHERE mesclado_em_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_materiais_created_by ON public.compras_materiais (created_by) WHERE created_by IS NOT NULL;

DO $$
DECLARE v_s text;
BEGIN
  SELECT n.nspname INTO v_s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF v_s IS NOT NULL THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_compras_materiais_trgm ON public.compras_materiais USING gin (nome_normalizado %I.gin_trgm_ops)', v_s);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'índice trigram não criado: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS public.compras_materiais_aliases (
  nome_normalizado text NOT NULL,
  unidade text NOT NULL,
  material_id uuid NOT NULL REFERENCES public.compras_materiais(id),
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nome_normalizado, unidade)
);
CREATE INDEX IF NOT EXISTS idx_compras_aliases_material ON public.compras_materiais_aliases (material_id);
CREATE INDEX IF NOT EXISTS idx_compras_aliases_created_by ON public.compras_materiais_aliases (created_by) WHERE created_by IS NOT NULL;

-- ---------- RLS e grants (§6) ----------
ALTER TABLE public.compras_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_config_segredo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_materiais_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compras_config_select ON public.compras_config;
CREATE POLICY compras_config_select ON public.compras_config FOR SELECT TO authenticated USING ((SELECT public.is_compras()));
DROP POLICY IF EXISTS compras_fornecedores_select ON public.compras_fornecedores;
CREATE POLICY compras_fornecedores_select ON public.compras_fornecedores FOR SELECT TO authenticated USING ((SELECT public.is_compras()));
DROP POLICY IF EXISTS compras_materiais_select ON public.compras_materiais;
CREATE POLICY compras_materiais_select ON public.compras_materiais FOR SELECT TO authenticated USING ((SELECT public.is_compras()));
DROP POLICY IF EXISTS compras_materiais_aliases_select ON public.compras_materiais_aliases;
CREATE POLICY compras_materiais_aliases_select ON public.compras_materiais_aliases FOR SELECT TO authenticated USING ((SELECT public.is_compras()));

REVOKE ALL ON TABLE public.compras_config, public.compras_fornecedores, public.compras_materiais, public.compras_materiais_aliases FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.compras_config, public.compras_fornecedores, public.compras_materiais,
  public.compras_materiais_aliases FROM authenticated;
REVOKE ALL ON TABLE public.compras_config_segredo FROM anon, authenticated;

-- ---------- Funções puras de normalização ----------
CREATE OR REPLACE FUNCTION public.compras_normalizar_nome(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(
             translate(lower(COALESCE(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
             '[^a-z0-9,.]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.compras_normalizar_unidade(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE x.u
           WHEN 'un' THEN 'un' WHEN 'und' THEN 'un' WHEN 'unid' THEN 'un' WHEN 'unidade' THEN 'un' WHEN 'unidades' THEN 'un'
           WHEN 'pc' THEN 'un' WHEN 'peca' THEN 'un' WHEN 'peça' THEN 'un' WHEN 'pecas' THEN 'un' WHEN 'peças' THEN 'un'
           WHEN 'm' THEN 'm' WHEN 'mt' THEN 'm' WHEN 'metro' THEN 'm' WHEN 'metros' THEN 'm'
           WHEN 'cx' THEN 'cx' WHEN 'caixa' THEN 'cx' WHEN 'caixas' THEN 'cx'
           WHEN 'pct' THEN 'pct' WHEN 'pacote' THEN 'pct' WHEN 'pacotes' THEN 'pct'
           WHEN 'kg' THEN 'kg'
           WHEN 'l' THEN 'l' WHEN 'lt' THEN 'l' WHEN 'litro' THEN 'l' WHEN 'litros' THEN 'l'
           WHEN 'm2' THEN 'm2' WHEN 'm²' THEN 'm2'
           WHEN 'm3' THEN 'm3' WHEN 'm³' THEN 'm3'
           WHEN 'rolo' THEN 'rolo' WHEN 'rolos' THEN 'rolo'
           WHEN 'barra' THEN 'barra' WHEN 'barras' THEN 'barra'
           WHEN 'saco' THEN 'saco' WHEN 'sacos' THEN 'saco'
           WHEN 'galao' THEN 'galao' WHEN 'galão' THEN 'galao' WHEN 'galoes' THEN 'galao' WHEN 'galões' THEN 'galao'
           ELSE x.u END
    FROM (SELECT lower(btrim(replace(COALESCE(p, ''), '.', ''))) AS u) x
$$;

-- Só dígitos; 10–11 dígitos ganha o prefixo 55; devolve NULL se não casar com o CHECK de compras_fornecedores.whatsapp
CREATE OR REPLACE FUNCTION public.compras_normalizar_whatsapp(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN x.d ~ '^55[1-9][0-9]{9,10}$' THEN x.d END
    FROM (SELECT CASE WHEN length(y.d) IN (10, 11) THEN '55' || y.d ELSE y.d END AS d
            FROM (SELECT regexp_replace(regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g'), '^0+', '') AS d) y) x
$$;

-- Similaridade trigram qualificada pelo schema real da extensão; NULL quando pg_trgm não existe
CREATE OR REPLACE FUNCTION public.compras_similaridade(a text, b text) RETURNS real
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_s text; r real;
BEGIN
  SELECT n.nspname INTO v_s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF v_s IS NULL THEN RETURN NULL; END IF;
  EXECUTE format('SELECT %I.similarity($1, $2)', v_s) INTO r USING a, b;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.compras_normalizar_nome(text), public.compras_normalizar_unidade(text),
  public.compras_normalizar_whatsapp(text), public.compras_similaridade(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_normalizar_nome(text), public.compras_normalizar_unidade(text),
  public.compras_normalizar_whatsapp(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.compras_similaridade(text, text) FROM authenticated;

-- ---------- RPCs: configuração ----------
CREATE OR REPLACE FUNCTION public.compras_config_obter() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF public.current_usuario_id() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT to_jsonb(c) INTO v FROM public.compras_config c WHERE c.id = 1;
  RETURN v;
END $$;

-- p: chaves parciais; só Administrador; nunca toca o pepper
CREATE OR REPLACE FUNCTION public.compras_config_salvar(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id(); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF public.current_nivel() IS DISTINCT FROM 'Administrador' THEN RAISE EXCEPTION 'Sem permissão: apenas o Administrador altera as configurações de Compras'; END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RAISE EXCEPTION 'Informe as configurações a salvar'; END IF;
  BEGIN
    UPDATE public.compras_config SET
      taxa_mensal = COALESCE((p ->> 'taxa_mensal')::numeric, taxa_mensal),
      empate_pct = COALESCE((p ->> 'empate_pct')::numeric, empate_pct),
      alerta_pct = COALESCE((p ->> 'alerta_pct')::numeric, alerta_pct),
      faixa_neutra_pct = COALESCE((p ->> 'faixa_neutra_pct')::numeric, faixa_neutra_pct),
      prazo_padrao_horas = COALESCE((p ->> 'prazo_padrao_horas')::int, prazo_padrao_horas),
      janela_referencia_meses = COALESCE((p ->> 'janela_referencia_meses')::int, janela_referencia_meses),
      fallback_ultimas_compras = COALESCE((p ->> 'fallback_ultimas_compras')::int, fallback_ultimas_compras),
      prazo_aceite_horas_uteis = COALESCE((p ->> 'prazo_aceite_horas_uteis')::int, prazo_aceite_horas_uteis),
      nome_empresa_publico = COALESCE(NULLIF(btrim(p ->> 'nome_empresa_publico'), ''), nome_empresa_publico),
      mensagem_padrao = COALESCE(NULLIF(btrim(p ->> 'mensagem_padrao'), ''), mensagem_padrao),
      mensagem_lembrete = COALESCE(NULLIF(btrim(p ->> 'mensagem_lembrete'), ''), mensagem_lembrete),
      mensagem_revisao = COALESCE(NULLIF(btrim(p ->> 'mensagem_revisao'), ''), mensagem_revisao),
      link_publico_ativo = COALESCE((p ->> 'link_publico_ativo')::boolean, link_publico_ativo),
      rl_token_obter_10min = COALESCE((p ->> 'rl_token_obter_10min')::int, rl_token_obter_10min),
      rl_token_responder_10min = COALESCE((p ->> 'rl_token_responder_10min')::int, rl_token_responder_10min),
      rl_ip_obter_10min = COALESCE((p ->> 'rl_ip_obter_10min')::int, rl_ip_obter_10min),
      rl_ip_responder_10min = COALESCE((p ->> 'rl_ip_responder_10min')::int, rl_ip_responder_10min),
      rl_global_responder_hora = COALESCE((p ->> 'rl_global_responder_hora')::int, rl_global_responder_hora),
      updated_by = v_uid, updated_at = now()
    WHERE id = 1;
  EXCEPTION
    WHEN check_violation THEN RAISE EXCEPTION 'Valor fora da faixa permitida em alguma configuração';
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Valor inválido em alguma configuração';
  END;
  SELECT to_jsonb(c) INTO v FROM public.compras_config c WHERE c.id = 1;
  RETURN v;
END $$;

-- ---------- RPCs: fornecedores ----------
-- p_dados: {nome_contato, empresa, whatsapp, documento?, email?, categorias?, observacao?}. Retorno: uuid do fornecedor
CREATE OR REPLACE FUNCTION public.compras_fornecedor_salvar(p_id uuid, p_dados jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  v_nome text := btrim(COALESCE(p_dados ->> 'nome_contato', ''));
  v_emp text := btrim(COALESCE(p_dados ->> 'empresa', ''));
  v_wa text := public.compras_normalizar_whatsapp(p_dados ->> 'whatsapp');
  v_doc text := NULLIF(regexp_replace(COALESCE(p_dados ->> 'documento', ''), '[^0-9]', '', 'g'), '');
  v_email text := NULLIF(btrim(COALESCE(p_dados ->> 'email', '')), '');
  v_obs text := NULLIF(btrim(COALESCE(p_dados ->> 'observacao', '')), '');
  v_cat text[] := '{}'; v_anon timestamptz; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN RAISE EXCEPTION 'Informe os dados do fornecedor'; END IF;
  IF length(v_nome) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Informe o nome do contato (2 a 120 caracteres)'; END IF;
  IF length(v_emp) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe a empresa (2 a 160 caracteres)'; END IF;
  IF v_wa IS NULL THEN RAISE EXCEPTION 'WhatsApp inválido: informe DDD + número (ex.: 41 99999-9999)'; END IF;
  IF v_doc IS NOT NULL AND length(v_doc) NOT IN (11, 14) THEN RAISE EXCEPTION 'Documento inválido: informe CPF (11 dígitos) ou CNPJ (14 dígitos)'; END IF;
  IF v_email IS NOT NULL AND (length(v_email) > 200 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  IF v_obs IS NOT NULL AND length(v_obs) > 500 THEN RAISE EXCEPTION 'A observação pode ter no máximo 500 caracteres'; END IF;
  IF jsonb_typeof(p_dados -> 'categorias') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT left(btrim(c), 60)), '{}') INTO v_cat
      FROM jsonb_array_elements_text(p_dados -> 'categorias') c WHERE btrim(c) <> '';
    IF cardinality(v_cat) > 20 THEN RAISE EXCEPTION 'No máximo 20 categorias'; END IF;
  END IF;

  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.compras_fornecedores (nome_contato, empresa, whatsapp, documento, email, categorias, observacao, created_by, updated_by)
      VALUES (v_nome, v_emp, v_wa, v_doc, v_email, v_cat, v_obs, v_uid, v_uid) RETURNING id INTO v_id;
    ELSE
      SELECT anonimizado_em INTO v_anon FROM public.compras_fornecedores WHERE id = p_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor não encontrado'; END IF;
      IF v_anon IS NOT NULL THEN RAISE EXCEPTION 'Fornecedor anonimizado não pode ser editado'; END IF;
      UPDATE public.compras_fornecedores
         SET nome_contato = v_nome, empresa = v_emp, whatsapp = v_wa, documento = v_doc, email = v_email,
             categorias = CASE WHEN jsonb_typeof(p_dados -> 'categorias') = 'array' THEN v_cat ELSE categorias END,
             observacao = v_obs, updated_by = v_uid, updated_at = now()
       WHERE id = p_id;
      v_id := p_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe fornecedor com este WhatsApp nesta empresa';
  END;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.compras_fornecedor_definir_ativo(p_id uuid, p_ativo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_ativo IS NULL THEN RAISE EXCEPTION 'Informe ativo ou inativo'; END IF;
  IF p_ativo AND EXISTS (SELECT 1 FROM public.compras_fornecedores WHERE id = p_id AND anonimizado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Fornecedor anonimizado não pode ser reativado';
  END IF;
  UPDATE public.compras_fornecedores SET ativo = p_ativo, updated_by = v_uid, updated_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.compras_fornecedor_excluir(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_usuario_id() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.compras_fornecedores WHERE id = p_id) THEN RAISE EXCEPTION 'Fornecedor não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE fornecedor_id = p_id)
     OR EXISTS (SELECT 1 FROM public.compras_precos_historico WHERE fornecedor_id = p_id) THEN
    RAISE EXCEPTION 'Inative o fornecedor: ele já participou de cotações';
  END IF;
  DELETE FROM public.compras_fornecedores WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.compras_fornecedor_anonimizar(p_id uuid, p_motivo text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id(); v_f public.compras_fornecedores;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() OR public.current_nivel() IS DISTINCT FROM 'Administrador' THEN
    RAISE EXCEPTION 'Sem permissão: apenas o Administrador anonimiza fornecedores';
  END IF;
  SELECT * INTO v_f FROM public.compras_fornecedores WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor não encontrado'; END IF;
  IF v_f.anonimizado_em IS NOT NULL THEN RAISE EXCEPTION 'Fornecedor já anonimizado'; END IF;
  IF length(btrim(COALESCE(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da anonimização (mínimo 5 caracteres)'; END IF;

  -- revoga os links vivos (a tabela de tokens é criada na 35)
  UPDATE public.compras_cotacao_tokens t SET revogado_em = now(), motivo_revogacao = 'anonimizacao'
    FROM public.compras_cotacao_convites c
   WHERE t.convite_id = c.id AND c.fornecedor_id = p_id AND t.revogado_em IS NULL;

  -- texto livre do fornecedor nas respostas (pode conter dados pessoais); preços e quantidades ficam (histórico de compras)
  UPDATE public.compras_cotacao_resposta_itens ri SET observacao = NULL
   WHERE ri.observacao IS NOT NULL AND ri.resposta_id IN (
     SELECT r.id FROM public.compras_cotacao_respostas r JOIN public.compras_cotacao_convites c ON c.id = r.convite_id WHERE c.fornecedor_id = p_id);
  UPDATE public.compras_cotacao_respostas r SET observacao = NULL
   WHERE r.observacao IS NOT NULL AND r.convite_id IN (SELECT c.id FROM public.compras_cotacao_convites c WHERE c.fornecedor_id = p_id);

  UPDATE public.compras_fornecedores
     SET nome_contato = 'Fornecedor removido', empresa = 'Removido #' || left(replace(id::text, '-', ''), 4),
         whatsapp = '551100000000', documento = NULL, email = NULL, observacao = NULL, categorias = '{}',
         ativo = false, anonimizado_em = now(), updated_by = v_uid, updated_at = now()
   WHERE id = p_id;
END $$;

-- ---------- RPCs: catálogo de materiais ----------
-- Retorno: jsonb [{id, nome, unidade, score, origem: 'alias'|'exato'|'similar'}]
CREATE OR REPLACE FUNCTION public.compras_material_sugerir(p_nome text, p_unidade text, p_limite int DEFAULT 5) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n text := public.compras_normalizar_nome(p_nome); v_u text := public.compras_normalizar_unidade(p_unidade);
  v_lim int := LEAST(GREATEST(COALESCE(p_limite, 5), 1), 20);
  v_res jsonb := '[]'::jsonb; v_s text; v_tok text; v_pat text;
BEGIN
  IF public.current_usuario_id() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_n = '' OR v_u = '' THEN RETURN v_res; END IF;

  -- 1) alias exato
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'unidade', m.unidade, 'score', 1, 'origem', 'alias')), '[]'::jsonb)
    INTO v_res
    FROM public.compras_materiais_aliases a JOIN public.compras_materiais m ON m.id = a.material_id AND m.ativo AND m.mesclado_em_id IS NULL
   WHERE a.nome_normalizado = v_n AND a.unidade = v_u;
  IF jsonb_array_length(v_res) > 0 THEN RETURN v_res; END IF;

  -- 2) normalizado exato
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'unidade', m.unidade, 'score', 1, 'origem', 'exato')), '[]'::jsonb)
    INTO v_res
    FROM public.compras_materiais m
   WHERE m.nome_normalizado = v_n AND m.unidade = v_u AND m.ativo AND m.mesclado_em_id IS NULL;
  IF jsonb_array_length(v_res) > 0 THEN RETURN v_res; END IF;

  -- 3) similar: pg_trgm (similarity >= 0.35, mesma unidade) ou ILIKE por tokens
  SELECT n.nspname INTO v_s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF v_s IS NOT NULL THEN
    EXECUTE format($q$
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'unidade', t.unidade, 'score', round(t.sc::numeric, 3), 'origem', 'similar') ORDER BY t.sc DESC), '[]'::jsonb)
        FROM (SELECT m.id, m.nome, m.unidade, %I.similarity(m.nome_normalizado, $1) AS sc
                FROM public.compras_materiais m
               WHERE m.unidade = $2 AND m.ativo AND m.mesclado_em_id IS NULL AND %I.similarity(m.nome_normalizado, $1) >= 0.35
               ORDER BY 4 DESC LIMIT $3) t$q$, v_s, v_s, v_s)
      INTO v_res USING v_n, v_u, v_lim;
  ELSE
    v_pat := '%';
    FOREACH v_tok IN ARRAY string_to_array(v_n, ' ') LOOP
      IF length(v_tok) >= 3 THEN v_pat := v_pat || replace(replace(replace(v_tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
    END LOOP;
    IF v_pat <> '%' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'unidade', t.unidade, 'score', 0.4, 'origem', 'similar')), '[]'::jsonb)
        INTO v_res
        FROM (SELECT m.id, m.nome, m.unidade FROM public.compras_materiais m
               WHERE m.unidade = v_u AND m.ativo AND m.mesclado_em_id IS NULL AND m.nome_normalizado ILIKE v_pat
               ORDER BY m.nome LIMIT v_lim) t;
    END IF;
  END IF;
  RETURN v_res;
END $$;

-- Cria (p_id NULL) ou edita. Retorno: uuid
CREATE OR REPLACE FUNCTION public.compras_material_salvar(p_id uuid, p_nome text, p_unidade text, p_categoria text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); v_nome text := btrim(COALESCE(p_nome, ''));
  v_n text := public.compras_normalizar_nome(p_nome); v_u text := public.compras_normalizar_unidade(p_unidade);
  v_cat text := NULLIF(btrim(COALESCE(p_categoria, '')), ''); v_id uuid; v_un_atual text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF length(v_nome) NOT BETWEEN 2 AND 200 OR v_n = '' THEN RAISE EXCEPTION 'Informe o nome do material (2 a 200 caracteres)'; END IF;
  IF v_u = '' OR length(v_u) > 20 THEN RAISE EXCEPTION 'Informe a unidade do material'; END IF;
  IF v_cat IS NOT NULL AND length(v_cat) > 80 THEN RAISE EXCEPTION 'A categoria pode ter no máximo 80 caracteres'; END IF;
  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.compras_materiais (nome, nome_normalizado, unidade, categoria, created_by)
      VALUES (v_nome, v_n, v_u, v_cat, v_uid) RETURNING id INTO v_id;
    ELSE
      SELECT unidade INTO v_un_atual FROM public.compras_materiais WHERE id = p_id AND mesclado_em_id IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado (ou já mesclado em outro)'; END IF;
      IF v_un_atual IS DISTINCT FROM v_u AND EXISTS (SELECT 1 FROM public.compras_precos_historico WHERE material_id = p_id) THEN
        RAISE EXCEPTION 'Este material já tem histórico de preços: não é possível trocar a unidade (crie outro material)';
      END IF;
      UPDATE public.compras_materiais
         SET nome = v_nome, nome_normalizado = v_n, unidade = v_u, categoria = v_cat, updated_at = now()
       WHERE id = p_id;
      v_id := p_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um material com este nome e unidade';
  END;
  RETURN v_id;
END $$;

-- Mescla origem → destino (mesma unidade). Retorno: {historico_movido, aliases_movidos}
CREATE OR REPLACE FUNCTION public.compras_material_mesclar(p_origem uuid, p_destino uuid, p_motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); o public.compras_materiais; d public.compras_materiais; v_h int; v_a int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_origem IS NULL OR p_destino IS NULL OR p_origem = p_destino THEN RAISE EXCEPTION 'Escolha dois materiais diferentes'; END IF;
  -- ordem fixa de lock (menor id primeiro) para evitar deadlock
  PERFORM 1 FROM public.compras_materiais WHERE id IN (p_origem, p_destino) ORDER BY id FOR UPDATE;
  SELECT * INTO o FROM public.compras_materiais WHERE id = p_origem;
  SELECT * INTO d FROM public.compras_materiais WHERE id = p_destino;
  IF o.id IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'Material não encontrado'; END IF;
  IF o.mesclado_em_id IS NOT NULL OR d.mesclado_em_id IS NOT NULL THEN RAISE EXCEPTION 'Material já foi mesclado em outro'; END IF;
  IF o.unidade <> d.unidade THEN RAISE EXCEPTION 'Só é possível mesclar materiais da mesma unidade (% × %)', o.unidade, d.unidade; END IF;

  -- alias do próprio nome da origem passa a apontar para o destino (preserva a sugestão automática)
  INSERT INTO public.compras_materiais_aliases (nome_normalizado, unidade, material_id, created_by)
  VALUES (o.nome_normalizado, o.unidade, p_destino, v_uid)
  ON CONFLICT (nome_normalizado, unidade) DO UPDATE SET material_id = EXCLUDED.material_id;
  UPDATE public.compras_materiais_aliases SET material_id = p_destino WHERE material_id = p_origem;
  GET DIAGNOSTICS v_a = ROW_COUNT;
  UPDATE public.compras_precos_historico SET material_id = p_destino WHERE material_id = p_origem;
  GET DIAGNOSTICS v_h = ROW_COUNT;
  UPDATE public.compras_cotacao_itens SET material_id = p_destino WHERE material_id = p_origem;
  UPDATE public.compras_materiais SET mesclado_em_id = p_destino, ativo = false, updated_at = now() WHERE id = p_origem;
  RETURN jsonb_build_object('historico_movido', v_h, 'aliases_movidos', v_a);
END $$;

-- ---------- Permissões das RPCs ----------
REVOKE ALL ON FUNCTION public.compras_config_obter(), public.compras_config_salvar(jsonb),
  public.compras_fornecedor_salvar(uuid, jsonb), public.compras_fornecedor_definir_ativo(uuid, boolean),
  public.compras_fornecedor_excluir(uuid), public.compras_fornecedor_anonimizar(uuid, text),
  public.compras_material_sugerir(text, text, int), public.compras_material_salvar(uuid, text, text, text),
  public.compras_material_mesclar(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_config_obter(), public.compras_config_salvar(jsonb),
  public.compras_fornecedor_salvar(uuid, jsonb), public.compras_fornecedor_definir_ativo(uuid, boolean),
  public.compras_fornecedor_excluir(uuid), public.compras_fornecedor_anonimizar(uuid, text),
  public.compras_material_sugerir(text, text, int), public.compras_material_salvar(uuid, text, text, text),
  public.compras_material_mesclar(uuid, uuid, text) TO authenticated;
