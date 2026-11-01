-- 35 (B-02 · PLANO_COTACAO_FORNECEDORES §5.4–5.7, §6, §7.3): cotações, convites, tokens, respostas, decisão, histórico de preços,
-- auditoria, rate limit, triggers de guarda em execucao_pedidos_material, compras_valor_presente e publicação Realtime.
--
-- Objetivo:
--   * Tabelas: compras_cotacoes, _pedidos, _itens, _item_origens, _convites, _tokens (sem policy), _respostas, _resposta_condicoes,
--     _resposta_itens, _decisoes, _decisao_itens, compras_precos_historico, compras_cotacao_eventos, compras_rate_limit (sem policy).
--   * RLS: 1 policy FOR SELECT TO authenticated USING ((SELECT is_compras())) por tabela de leitura; escrita só via RPC (A9);
--     tokens e rate limit com REVOKE ALL de anon e authenticated.
--   * Triggers: trg_pedido_guarda_cotacao (BEFORE UPDATE OF itens) e trg_pedido_guarda_cotacao_delete (BEFORE DELETE) em
--     execucao_pedidos_material.
--   * compras_valor_presente(...) IMMUTABLE (fórmula do §8.1; frete NÃO entra: é somado pelo chamador).
--   * Realtime: compras_cotacoes, compras_cotacao_convites, compras_cotacao_respostas (eventos respeitam o RLS).
--
-- Divergências em relação ao plano (documentadas no Anexo C):
--   * compras_cotacao_eventos.tipo aceita também 'alerta_vencendo' (controle de "1 alerta por cotação" de compras_verificar_alertas).
--
-- Dependências: 34 (compras_materiais, compras_fornecedores, compras_config).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_pedido_guarda_cotacao ON public.execucao_pedidos_material;
--   DROP TRIGGER IF EXISTS trg_pedido_guarda_cotacao_delete ON public.execucao_pedidos_material;
--   DROP FUNCTION IF EXISTS public.execucao_pedido_guarda_cotacao(), public.execucao_pedido_guarda_cotacao_delete(),
--     public.compras_valor_presente(numeric, text, int, numeric, int, numeric);
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.compras_cotacoes, public.compras_cotacao_convites, public.compras_cotacao_respostas;
--   DROP TABLE IF EXISTS public.compras_rate_limit, public.compras_cotacao_eventos, public.compras_precos_historico,
--     public.compras_cotacao_decisao_itens, public.compras_cotacao_decisoes, public.compras_cotacao_resposta_itens,
--     public.compras_cotacao_resposta_condicoes, public.compras_cotacao_respostas, public.compras_cotacao_tokens,
--     public.compras_cotacao_convites, public.compras_cotacao_item_origens, public.compras_cotacao_itens,
--     public.compras_cotacao_pedidos, public.compras_cotacoes;     -- só após exportar os dados; as funções da 36/37 dependem delas

-- ---------- 5.4 Cotações ----------
CREATE TABLE IF NOT EXISTS public.compras_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aberta', 'encerrada', 'cancelada')),
  prazo_resposta timestamptz,
  versao_lista int NOT NULL DEFAULT 1,
  requer_revisao boolean NOT NULL DEFAULT false,
  taxa_mensal numeric(6,4),
  empate_pct numeric(6,4),
  observacao_publica text CHECK (observacao_publica IS NULL OR length(observacao_publica) <= 500),
  regiao_entrega text CHECK (regiao_entrega IS NULL OR length(regiao_entrega) <= 80),
  mensagem text CHECK (mensagem IS NULL OR length(mensagem) <= 1000),
  criado_por uuid REFERENCES public.usuarios(id),
  aberta_em timestamptz,
  encerrada_em timestamptz,
  encerrada_por uuid REFERENCES public.usuarios(id),
  cancelada_em timestamptz,
  cancelada_por uuid REFERENCES public.usuarios(id),
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_cotacoes_status_prazo ON public.compras_cotacoes (status, prazo_resposta);
CREATE INDEX IF NOT EXISTS idx_compras_cotacoes_criado_por ON public.compras_cotacoes (criado_por, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compras_cotacoes_encerrada_por ON public.compras_cotacoes (encerrada_por) WHERE encerrada_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_cotacoes_cancelada_por ON public.compras_cotacoes (cancelada_por) WHERE cancelada_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_pedidos (
  cotacao_id uuid NOT NULL REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.execucao_pedidos_material(id) ON DELETE CASCADE,
  ativa boolean NOT NULL DEFAULT true,
  incluido_por uuid REFERENCES public.usuarios(id),
  incluido_em timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz,
  motivo_remocao text,
  PRIMARY KEY (cotacao_id, pedido_id)
);
-- 1 cotação ativa por pedido
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_cotacao_pedidos_ativa ON public.compras_cotacao_pedidos (pedido_id) WHERE ativa;
CREATE INDEX IF NOT EXISTS idx_compras_cotacao_pedidos_pedido ON public.compras_cotacao_pedidos (pedido_id);
CREATE INDEX IF NOT EXISTS idx_compras_cotacao_pedidos_incluido_por ON public.compras_cotacao_pedidos (incluido_por) WHERE incluido_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,
  seq int NOT NULL,
  descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 200),
  unidade text NOT NULL,
  quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
  material_id uuid REFERENCES public.compras_materiais(id),
  chave_consolidacao text,
  observacao_publica text CHECK (observacao_publica IS NULL OR length(observacao_publica) <= 200),
  ativo boolean NOT NULL DEFAULT true,
  versao_criada int NOT NULL DEFAULT 1,
  versao_alterada int
);
CREATE INDEX IF NOT EXISTS idx_compras_cotacao_itens_cot ON public.compras_cotacao_itens (cotacao_id, ativo, seq);
CREATE INDEX IF NOT EXISTS idx_compras_cotacao_itens_material ON public.compras_cotacao_itens (material_id) WHERE material_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_item_origens (
  cotacao_item_id uuid NOT NULL REFERENCES public.compras_cotacao_itens(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.execucao_pedidos_material(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  quantidade numeric(14,3),
  item_snapshot jsonb,
  PRIMARY KEY (cotacao_item_id, pedido_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_compras_item_origens_pedido ON public.compras_cotacao_item_origens (pedido_id);

-- ---------- 5.5 Convites, tokens, respostas ----------
CREATE TABLE IF NOT EXISTS public.compras_cotacao_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.compras_fornecedores(id),
  status text NOT NULL DEFAULT 'nao_enviado' CHECK (status IN ('nao_enviado', 'enviado', 'visualizado', 'respondido', 'recusou')),
  enviado_em timestamptz,
  enviado_por uuid REFERENCES public.usuarios(id),
  envios int NOT NULL DEFAULT 0,
  ultimo_canal text CHECK (ultimo_canal IS NULL OR ultimo_canal IN ('whatsapp', 'copia')),
  primeira_visualizacao_em timestamptz,
  ultima_visualizacao_em timestamptz,
  respondido_em timestamptz,
  versao_lista_respondida int,
  precisa_reconfirmar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cotacao_id, fornecedor_id)
);
CREATE INDEX IF NOT EXISTS idx_compras_convites_cot_status ON public.compras_cotacao_convites (cotacao_id, status);
CREATE INDEX IF NOT EXISTS idx_compras_convites_fornecedor ON public.compras_cotacao_convites (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_convites_enviado_por ON public.compras_cotacao_convites (enviado_por) WHERE enviado_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_tokens (
  token_hash bytea PRIMARY KEY,
  convite_id uuid NOT NULL REFERENCES public.compras_cotacao_convites(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.usuarios(id),
  revogado_em timestamptz,
  motivo_revogacao text CHECK (motivo_revogacao IS NULL OR motivo_revogacao IN
    ('lembrete', 'novo_link', 'cotacao_encerrada', 'cotacao_cancelada', 'anonimizacao'))
);
-- no máximo 1 token vivo por convite
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_tokens_vivo ON public.compras_cotacao_tokens (convite_id) WHERE revogado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_compras_tokens_convite ON public.compras_cotacao_tokens (convite_id);
CREATE INDEX IF NOT EXISTS idx_compras_tokens_criado_por ON public.compras_cotacao_tokens (criado_por) WHERE criado_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id uuid NOT NULL REFERENCES public.compras_cotacao_convites(id) ON DELETE CASCADE,
  cotacao_id uuid NOT NULL REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,   -- desnormalizado: filtro do Realtime
  versao int NOT NULL,
  versao_lista int NOT NULL,
  atual boolean NOT NULL DEFAULT true,
  recusou boolean NOT NULL DEFAULT false,
  prazo_entrega_dias int CHECK (prazo_entrega_dias IS NULL OR prazo_entrega_dias BETWEEN 0 AND 365),
  frete_tipo text CHECK (frete_tipo IS NULL OR frete_tipo IN ('cif', 'valor')),
  frete_valor numeric(14,2) NOT NULL DEFAULT 0 CHECK (frete_valor >= 0),
  observacao text CHECK (observacao IS NULL OR length(observacao) <= 1000),
  base_total numeric(14,2),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 200),
  UNIQUE (convite_id, versao)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_respostas_atual ON public.compras_cotacao_respostas (convite_id) WHERE atual;
CREATE INDEX IF NOT EXISTS idx_compras_respostas_cot_atual ON public.compras_cotacao_respostas (cotacao_id, atual);

CREATE TABLE IF NOT EXISTS public.compras_cotacao_resposta_condicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.compras_cotacao_respostas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('a_vista', 'parcelado')),
  desconto_tipo text CHECK (desconto_tipo IS NULL OR desconto_tipo IN ('percentual', 'valor')),
  desconto_valor numeric(14,4) CHECK (desconto_valor IS NULL OR desconto_valor >= 0),
  parcelas int CHECK (parcelas IS NULL OR parcelas BETWEEN 1 AND 24),
  entrada_valor numeric(14,2) NOT NULL DEFAULT 0 CHECK (entrada_valor >= 0),
  primeira_parcela_dias int NOT NULL DEFAULT 30 CHECK (primeira_parcela_dias BETWEEN 0 AND 180),
  total_informado numeric(14,2) CHECK (total_informado IS NULL OR total_informado >= 0),
  total_itens numeric(14,2),
  valor_presente_itens numeric(14,2),
  UNIQUE (resposta_id, tipo)
);

CREATE TABLE IF NOT EXISTS public.compras_cotacao_resposta_itens (
  resposta_id uuid NOT NULL REFERENCES public.compras_cotacao_respostas(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.compras_cotacao_itens(id) ON DELETE CASCADE,
  tem_item boolean NOT NULL,
  preco_unitario numeric(14,4) CHECK (preco_unitario IS NULL OR preco_unitario > 0),
  quantidade_disponivel numeric(14,3) CHECK (quantidade_disponivel IS NULL OR quantidade_disponivel > 0),
  observacao text CHECK (observacao IS NULL OR length(observacao) <= 200),
  PRIMARY KEY (resposta_id, cotacao_item_id),
  CHECK (NOT tem_item OR preco_unitario IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_compras_resposta_itens_item ON public.compras_cotacao_resposta_itens (cotacao_item_id);

-- ---------- 5.6 Decisão e histórico de preços ----------
CREATE TABLE IF NOT EXISTS public.compras_cotacao_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL UNIQUE REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,
  modo text NOT NULL CHECK (modo IN ('unico', 'dividido', 'manual')),
  segue_recomendacao boolean NOT NULL DEFAULT true,
  justificativa text,
  total_nominal numeric(14,2),
  total_vp numeric(14,2),
  total_referencia numeric(14,2),
  recomendacao_snapshot jsonb,
  decidido_por uuid REFERENCES public.usuarios(id),
  decidido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_decisoes_decidido_por ON public.compras_cotacao_decisoes (decidido_por) WHERE decidido_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_cotacao_decisao_itens (
  decisao_id uuid NOT NULL REFERENCES public.compras_cotacao_decisoes(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.compras_cotacao_itens(id) ON DELETE CASCADE,
  convite_id uuid NOT NULL REFERENCES public.compras_cotacao_convites(id),
  condicao_id uuid NOT NULL REFERENCES public.compras_cotacao_resposta_condicoes(id),
  fornecedor_id uuid NOT NULL REFERENCES public.compras_fornecedores(id),
  quantidade numeric(14,3) NOT NULL,
  preco_unitario_base numeric(14,4) NOT NULL,
  preco_unitario_nominal numeric(14,4) NOT NULL,
  preco_unitario_vp numeric(14,4) NOT NULL,
  PRIMARY KEY (decisao_id, cotacao_item_id)
);
CREATE INDEX IF NOT EXISTS idx_compras_decisao_itens_item ON public.compras_cotacao_decisao_itens (cotacao_item_id);
CREATE INDEX IF NOT EXISTS idx_compras_decisao_itens_convite ON public.compras_cotacao_decisao_itens (convite_id);
CREATE INDEX IF NOT EXISTS idx_compras_decisao_itens_condicao ON public.compras_cotacao_decisao_itens (condicao_id);
CREATE INDEX IF NOT EXISTS idx_compras_decisao_itens_fornecedor ON public.compras_cotacao_decisao_itens (fornecedor_id);

CREATE TABLE IF NOT EXISTS public.compras_precos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.compras_materiais(id),
  fornecedor_id uuid REFERENCES public.compras_fornecedores(id),
  cotacao_id uuid REFERENCES public.compras_cotacoes(id) ON DELETE SET NULL,
  cotacao_item_id uuid REFERENCES public.compras_cotacao_itens(id) ON DELETE SET NULL,
  resposta_id uuid REFERENCES public.compras_cotacao_respostas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('cotado', 'comprado')),
  condicao text CHECK (condicao IS NULL OR condicao IN ('a_vista', 'parcelado')),
  parcelas int,
  unidade text,
  quantidade numeric(14,3),
  preco_unitario_nominal numeric(14,4),
  preco_unitario_vp numeric(14,4),
  pedido_ids uuid[],
  registrado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_precos_material ON public.compras_precos_historico (material_id, tipo, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_compras_precos_fornecedor ON public.compras_precos_historico (fornecedor_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_compras_precos_cotacao ON public.compras_precos_historico (cotacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_precos_cotacao_item ON public.compras_precos_historico (cotacao_item_id) WHERE cotacao_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_precos_resposta ON public.compras_precos_historico (resposta_id) WHERE resposta_id IS NOT NULL;

-- ---------- 5.7 Auditoria e rate limit ----------
CREATE TABLE IF NOT EXISTS public.compras_cotacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.compras_cotacoes(id) ON DELETE CASCADE,
  convite_id uuid REFERENCES public.compras_cotacao_convites(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id),
  tipo text NOT NULL CHECK (tipo IN ('criada', 'pedido_incluido', 'pedido_removido', 'itens_montados', 'aberta', 'link_gerado',
    'enviado', 'lembrete', 'visualizado', 'resposta_enviada', 'resposta_rejeitada', 'prorrogada', 'revisada', 'requer_revisao',
    'decidida', 'encerrada', 'cancelada', 'alerta_vencendo')),
  ip text,            -- IP bruto; retenção de 12 meses (LGPD), apagado por compras_verificar_alertas()
  ip_hash text,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_eventos_cot ON public.compras_cotacao_eventos (cotacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compras_eventos_convite ON public.compras_cotacao_eventos (convite_id, tipo, created_at DESC) WHERE convite_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_eventos_usuario ON public.compras_cotacao_eventos (usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.compras_rate_limit (
  chave text NOT NULL,
  janela timestamptz NOT NULL,
  contador int NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela)
);
CREATE INDEX IF NOT EXISTS idx_compras_rate_limit_janela ON public.compras_rate_limit (janela);

-- ---------- RLS e grants (§6) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['compras_cotacoes', 'compras_cotacao_pedidos', 'compras_cotacao_itens', 'compras_cotacao_item_origens',
    'compras_cotacao_convites', 'compras_cotacao_respostas', 'compras_cotacao_resposta_condicoes', 'compras_cotacao_resposta_itens',
    'compras_cotacao_decisoes', 'compras_cotacao_decisao_itens', 'compras_precos_historico', 'compras_cotacao_eventos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_compras()))', t || '_select', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated', t);
  END LOOP;
  -- sem policy e sem grant: só funções SECURITY DEFINER
  FOREACH t IN ARRAY ARRAY['compras_cotacao_tokens', 'compras_rate_limit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ---------- Realtime ----------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['compras_cotacoes', 'compras_cotacao_convites', 'compras_cotacao_respostas'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ---------- Valor presente (§8.1) ----------
-- Devolve o VP dos ITENS (sem frete). p_total = T (já com desconto, no à vista; total informado ou base, no parcelado).
--   à vista:  VP = T (dia 0)
--   parcelado: VP = E + Σ_{k=1..n} ((T − E)/n) / (1+i)^(d_k/30),  d_k = primeira_dias + 30·(k−1)
CREATE OR REPLACE FUNCTION public.compras_valor_presente(
  p_total numeric, p_tipo text, p_parcelas int, p_entrada numeric, p_primeira_dias int, p_taxa numeric
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_n int; v_e numeric; v_p numeric; v_vp numeric; k int; v_i numeric := COALESCE(p_taxa, 0);
BEGIN
  IF p_total IS NULL THEN RETURN NULL; END IF;
  IF p_tipo = 'a_vista' THEN RETURN round(p_total, 2); END IF;
  v_n := GREATEST(COALESCE(p_parcelas, 1), 1);
  v_e := LEAST(GREATEST(COALESCE(p_entrada, 0), 0), p_total);
  v_p := (p_total - v_e) / v_n;
  v_vp := v_e;
  FOR k IN 1..v_n LOOP
    v_vp := v_vp + v_p / power(1 + v_i, (COALESCE(p_primeira_dias, 30) + 30 * (k - 1))::numeric / 30);
  END LOOP;
  RETURN round(v_vp, 2);
END $$;
REVOKE ALL ON FUNCTION public.compras_valor_presente(numeric, text, int, numeric, int, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_valor_presente(numeric, text, int, numeric, int, numeric) TO authenticated;

-- ---------- 7.3 Triggers de guarda em execucao_pedidos_material ----------
CREATE OR REPLACE FUNCTION public.execucao_pedido_guarda_cotacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c public.compras_cotacoes; v_enviado boolean; v_flag boolean;
BEGIN
  IF public.execucao_pedido_itens_sem_id(NEW.itens) IS NOT DISTINCT FROM public.execucao_pedido_itens_sem_id(OLD.itens) THEN
    RETURN NEW;
  END IF;
  SELECT c.* INTO v_c
    FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
   WHERE cp.pedido_id = NEW.id AND cp.ativa LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_enviado := v_c.status = 'aberta' AND EXISTS (SELECT 1 FROM public.compras_cotacao_convites WHERE cotacao_id = v_c.id AND status <> 'nao_enviado');
  v_flag := COALESCE(current_setting('execucao.compras_rpc', true), '') = '1'
         OR COALESCE(current_setting('compras.cotacao_rpc', true), '') = '1';

  IF v_enviado AND NOT v_flag THEN
    RAISE EXCEPTION 'Este pedido está na cotação nº %, já enviada a fornecedores. Para alterar itens, fale com a Compras (questionamento).', v_c.numero;
  END IF;

  IF NOT v_c.requer_revisao THEN
    UPDATE public.compras_cotacoes SET requer_revisao = true, updated_at = now() WHERE id = v_c.id;
    INSERT INTO public.compras_cotacao_eventos (cotacao_id, usuario_id, tipo, dados)
    VALUES (v_c.id, public.current_usuario_id(), 'requer_revisao', jsonb_build_object('pedido_id', NEW.id));
    IF v_enviado AND v_c.criado_por IS NOT NULL THEN
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
      VALUES ('compra_cotacao', '⚠️ Lista alterada: revise a cotação',
              left(format('Lista alterada: revise a cotação nº %s', v_c.numero), 500),
              NULL, v_c.criado_por, public.current_usuario_id(), jsonb_build_object('cotacao_id', v_c.id, 'pedido_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_pedido_guarda_cotacao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pedido_guarda_cotacao ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedido_guarda_cotacao BEFORE UPDATE OF itens ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_pedido_guarda_cotacao();

CREATE OR REPLACE FUNCTION public.execucao_pedido_guarda_cotacao_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.compras_cotacao_pedidos cp JOIN public.compras_cotacoes c ON c.id = cp.cotacao_id
              WHERE cp.pedido_id = OLD.id AND cp.ativa AND c.status = 'aberta'
                AND EXISTS (SELECT 1 FROM public.compras_cotacao_convites cv WHERE cv.cotacao_id = c.id AND cv.status <> 'nao_enviado')) THEN
    RAISE EXCEPTION 'Pedido em cotação enviada: remova-o da cotação antes de excluir';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.execucao_pedido_guarda_cotacao_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pedido_guarda_cotacao_delete ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedido_guarda_cotacao_delete BEFORE DELETE ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_pedido_guarda_cotacao_delete();
