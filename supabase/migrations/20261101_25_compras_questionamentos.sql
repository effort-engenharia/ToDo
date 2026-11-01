-- 25 (B7 · R7 · D5/D6 · N1-j/N1-k/N1-m): questionamento comprador ↔ solicitante e ações de Compras (tudo via RPC).
--
-- Objetivo:
--   * Tabela execucao_pedidos_questionamentos (RLS: SELECT só para pode_ver_compras(); sem INSERT/UPDATE/DELETE direto).
--     Decisão: o ramo "solicitante vê" do plano (§5.4) NÃO foi criado na policy porque quem responde é admin (N1-k: técnico não
--     responde na v1) e o teste 7.3-2 exige que TECNICO veja 0 linhas; admins já passam por pode_ver_compras().
--   * Tipos de notificação novos: compra_questionamento, compra_resposta, compra_status.
--   * RPCs (SECURITY DEFINER, search_path fixo, papel validado dentro): compras_abrir_questionamento,
--     compras_responder_questionamento, compras_cancelar_questionamento, compras_assumir_pedido, compras_alterar_status,
--     compras_definir_disponibilidade. Histórico em execucao_historico_pedidos (tipo_alteracao 'questionamento' | 'compra_status'
--     | 'edicao' para datas) e notificações na mesma transação.
--   * Regras do Negócio: questionamento só até 'em_cotacao'; aguardando_solicitante é automático e volta ao status anterior ao
--     fechar o último questionamento aberto; substituição técnica só é aprovada por is_admin_execucao(); responder exige
--     observação ao reprovar, em 'duvida' e quando quem responde não é o solicitante; solicitante TECNICO → notificação vai
--     para os admins (destinatario_id NULL) e o admin responde; cancelado exige motivo e não vale após entregue; entregue_parcial
--     exige observação; comprado exige data de disponibilidade (N1-m.4); a etapa "📦 Chegada dos Materiais" é criada uma única
--     vez (etapa_chegada_id) e mudanças de data ATUALIZAM a etapa; não cria etapa sem obra_id ou com obra concluída/cancelada.
--   * Aprovar substituição/quantidade altera o item de mesmo id; histórico com dados_anteriores/dados_novos = {"itens": [...]}
--     (mesmo formato do histórico de 'edicao', que a F3 já lê). Unidades un/cx/pct arredondam a quantidade para cima (N1-a/N1-b).
--   * Dúvida respondida fica com status 'aprovado' (resposta em resposta_observacao).
--   * Realtime: execucao_pedidos_material e execucao_pedidos_questionamentos entram na publicação supabase_realtime
--     (eventos respeitam o RLS). Trigger avisa o comprador quando o solicitante edita os itens (N1 lacuna §3.1.2).
--
-- Depende da 20261101_24.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_definir_disponibilidade(uuid, date);
--   DROP FUNCTION IF EXISTS public.compras_alterar_status(uuid, text, text, date);
--   DROP FUNCTION IF EXISTS public.compras_assumir_pedido(uuid);
--   DROP FUNCTION IF EXISTS public.compras_cancelar_questionamento(uuid, text);
--   DROP FUNCTION IF EXISTS public.compras_responder_questionamento(uuid, boolean, text);
--   DROP FUNCTION IF EXISTS public.compras_abrir_questionamento(uuid, text, text, text, jsonb);
--   DROP FUNCTION IF EXISTS public.execucao_compras_restaurar_status(uuid), public.execucao_compras_aplicar_disponibilidade(uuid, date, uuid),
--     public.execucao_compras_notificar_solicitante(uuid, text, text, text, jsonb, uuid), public.execucao_compras_historico(uuid, uuid, text, text, jsonb, jsonb, text, date, date);
--   DROP TRIGGER IF EXISTS trg_pedido_avisar_edicao ON public.execucao_pedidos_material;
--   DROP TRIGGER IF EXISTS trg_pedido_fechar_questionamentos ON public.execucao_pedidos_material;
--   DROP FUNCTION IF EXISTS public.execucao_pedido_fechar_questionamentos();
--   DROP FUNCTION IF EXISTS public.execucao_pedido_avisar_edicao();
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.execucao_pedidos_questionamentos;   -- e, se quiser, public.execucao_pedidos_material
--   DROP TABLE IF EXISTS public.execucao_pedidos_questionamentos;   -- só após exportar os dados
--   Reaplicar o CHECK de notificações da mig. 15 (sem os 3 tipos compra_*; antes, DELETE/UPDATE das linhas com esses tipos).

-- ---------- Notificações: tipos novos ----------
ALTER TABLE public.execucao_notificacoes DROP CONSTRAINT IF EXISTS execucao_notificacoes_tipo_check;
ALTER TABLE public.execucao_notificacoes ADD CONSTRAINT execucao_notificacoes_tipo_check
  CHECK (tipo IN ('pausa', 'conclusao', 'pendente', 'atraso', 'retomada', 'urgente',
                  'material', 'hora_extra', 'replanejamento', 'transferencia', 'pendencia', 'nova_atividade',
                  'compra_questionamento', 'compra_resposta', 'compra_status'));

-- ---------- Tabela de questionamentos ----------
CREATE TABLE IF NOT EXISTS public.execucao_pedidos_questionamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.execucao_pedidos_material(id) ON DELETE CASCADE,
  item_id text,
  item_snapshot jsonb,
  tipo text NOT NULL CHECK (tipo IN ('substituicao', 'quantidade', 'duvida')),
  pergunta text NOT NULL CHECK (length(btrim(pergunta)) >= 3),
  sugestao jsonb,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'aprovado', 'reprovado', 'cancelado')),
  resposta_observacao text,
  criado_por uuid REFERENCES public.usuarios(id),
  respondido_por uuid REFERENCES public.usuarios(id),
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quest_pedido_status ON public.execucao_pedidos_questionamentos (pedido_id, status);
-- (S9 Performance: o parcial "WHERE status = 'aberto'" foi removido; (pedido_id, status) já atende as buscas por questionamento aberto)
CREATE INDEX IF NOT EXISTS idx_quest_criado_por ON public.execucao_pedidos_questionamentos (criado_por);
CREATE INDEX IF NOT EXISTS idx_quest_respondido_por ON public.execucao_pedidos_questionamentos (respondido_por) WHERE respondido_por IS NOT NULL;

ALTER TABLE public.execucao_pedidos_questionamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quest_select ON public.execucao_pedidos_questionamentos;
CREATE POLICY quest_select ON public.execucao_pedidos_questionamentos FOR SELECT TO authenticated
  USING ((SELECT public.pode_ver_compras()));
REVOKE ALL ON TABLE public.execucao_pedidos_questionamentos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.execucao_pedidos_questionamentos FROM authenticated;

-- ---------- Realtime ----------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['execucao_pedidos_material', 'execucao_pedidos_questionamentos'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ---------- Helpers internos (sem GRANT) ----------
CREATE OR REPLACE FUNCTION public.execucao_compras_historico(
  p_pedido uuid, p_uid uuid, p_tipo text, p_desc text, p_ant jsonb DEFAULT NULL, p_novo jsonb DEFAULT NULL,
  p_motivo text DEFAULT NULL, p_dl_ant date DEFAULT NULL, p_dl_nova date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.execucao_historico_pedidos
    (pedido_id, usuario_id, usuario_nome, tipo_alteracao, descricao, dados_anteriores, dados_novos, motivo, data_limite_anterior, data_limite_nova)
  VALUES (p_pedido, p_uid, (SELECT nome_completo FROM public.usuarios WHERE id = p_uid), p_tipo, p_desc, p_ant, p_novo,
          NULLIF(btrim(COALESCE(p_motivo, '')), ''), p_dl_ant, p_dl_nova);
END $$;

-- Notifica o solicitante; se for TECNICO (ou não existir), vai para os admins (destinatario_id NULL)
CREATE OR REPLACE FUNCTION public.execucao_compras_notificar_solicitante(
  p_pedido uuid, p_tipo text, p_titulo text, p_msg text, p_ref jsonb, p_origem uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol uuid; v_nivel text; v_atv uuid; v_dest uuid;
BEGIN
  SELECT solicitante_id, atividade_id INTO v_sol, v_atv FROM public.execucao_pedidos_material WHERE id = p_pedido;
  IF v_sol IS NOT NULL THEN
    SELECT na.nome INTO v_nivel FROM public.usuarios u JOIN public.niveis_acesso na ON na.id = u.nivel_acesso_id WHERE u.id = v_sol;
    IF COALESCE(v_nivel, 'TECNICO') <> 'TECNICO' THEN v_dest := v_sol; END IF;
  END IF;
  INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
  VALUES (p_tipo, p_titulo, left(p_msg, 500), v_atv, v_dest, p_origem, p_ref);
END $$;

-- Se não restar questionamento aberto, o pedido volta ao status anterior (N1-j.1)
CREATE OR REPLACE FUNCTION public.execucao_compras_restaurar_status(p_pedido uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.execucao_pedidos_questionamentos WHERE pedido_id = p_pedido AND status = 'aberto') THEN
    UPDATE public.execucao_pedidos_material
       SET status_compra = COALESCE(status_compra_anterior, 'aguardando_compra'), status_compra_anterior = NULL,
           status_compra_em = now(), updated_at = now()
     WHERE id = p_pedido AND status_compra = 'aguardando_solicitante';
  END IF;
END $$;

-- Data de disponibilidade + etapa "📦 Chegada dos Materiais" (criada 1 vez; depois só atualiza a data)
CREATE OR REPLACE FUNCTION public.execucao_compras_aplicar_disponibilidade(p_pedido uuid, p_data date, p_uid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.execucao_pedidos_material; v_obra_status text; v_etapa uuid; v_criada boolean := false;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF v_p.data_material_disponivel IS DISTINCT FROM p_data THEN
    UPDATE public.execucao_pedidos_material SET data_material_disponivel = p_data, updated_at = now() WHERE id = p_pedido;
    PERFORM public.execucao_compras_historico(p_pedido, p_uid, 'edicao', 'Previsão de chegada definida pela Compras',
      NULL, NULL, NULL, v_p.data_material_disponivel, p_data);
  END IF;
  v_etapa := v_p.etapa_chegada_id;

  IF v_p.obra_id IS NOT NULL THEN
    SELECT status INTO v_obra_status FROM public.execucao_obras WHERE id = v_p.obra_id;
    IF v_obra_status IS NOT NULL AND v_obra_status NOT IN ('concluida', 'cancelada') THEN
      IF v_p.etapa_chegada_id IS NOT NULL THEN
        UPDATE public.execucao_obras_etapas
           SET data_fim = GREATEST(p_data, data_inicio), updated_at = now()
         WHERE id = v_p.etapa_chegada_id AND status NOT IN ('concluida', 'cancelada');
        PERFORM public.execucao_recalcular_progresso_obra(v_p.obra_id);
      ELSIF NOT COALESCE(v_p.etapa_chegada_criada, false) THEN
        INSERT INTO public.execucao_obras_etapas (obra_id, nome, descricao, tipo, data_inicio, data_fim, status, progresso)
        VALUES (v_p.obra_id, '📦 Chegada dos Materiais',
                format(E'Materiais solicitados: %s\n\n🏢 Cliente: %s\n📍 Endereço: %s\n\n📋 Lista concluída em: %s\n📅 Data limite disponibilidade: %s\n\n⚠️ Verificar se todos os itens foram entregues/separados.',
                       COALESCE(NULLIF(v_p.descricao, ''), 'Lista de materiais'), COALESCE(v_p.cliente_nome, 'N/A'),
                       COALESCE(v_p.endereco_obra, 'N/A'), to_char(v_hoje, 'DD/MM/YYYY'), to_char(p_data, 'DD/MM/YYYY')),
                'estoque', LEAST(v_hoje, p_data), p_data, 'pendente', 0)
        RETURNING id INTO v_etapa;
        UPDATE public.execucao_pedidos_material SET etapa_chegada_id = v_etapa, etapa_chegada_criada = true WHERE id = p_pedido;
        PERFORM public.execucao_recalcular_progresso_obra(v_p.obra_id);
        v_criada := true;
      END IF;
      -- etapa_chegada_criada = true sem etapa_chegada_id (legado): não mexe em etapa (não há como saber qual é)
    END IF;
  END IF;
  RETURN jsonb_build_object('data_material_disponivel', p_data, 'etapa_chegada_id', v_etapa, 'etapa_criada', v_criada);
END $$;

REVOKE ALL ON FUNCTION public.execucao_compras_historico(uuid, uuid, text, text, jsonb, jsonb, text, date, date),
  public.execucao_compras_notificar_solicitante(uuid, text, text, text, jsonb, uuid),
  public.execucao_compras_restaurar_status(uuid),
  public.execucao_compras_aplicar_disponibilidade(uuid, date, uuid) FROM PUBLIC, anon, authenticated;

-- ---------- Abrir questionamento (Compras) ----------
CREATE OR REPLACE FUNCTION public.compras_abrir_questionamento(
  p_pedido uuid, p_item_id text, p_tipo text, p_pergunta text, p_sugestao jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  v_p public.execucao_pedidos_material; v_item jsonb; v_sug jsonb := NULL; v_id uuid; v_nome text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão: apenas o setor de Compras abre questionamentos'; END IF;
  IF p_tipo NOT IN ('substituicao', 'quantidade', 'duvida') THEN RAISE EXCEPTION 'Tipo de questionamento inválido'; END IF;
  IF length(btrim(COALESCE(p_pergunta, ''))) < 3 THEN RAISE EXCEPTION 'Descreva o questionamento'; END IF;
  IF length(p_pergunta) > 1000 THEN RAISE EXCEPTION 'O questionamento pode ter no máximo 1.000 caracteres'; END IF;

  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra NOT IN ('aguardando_compra', 'em_cotacao', 'aguardando_solicitante') THEN
    RAISE EXCEPTION 'Questionamentos só podem ser abertos até a cotação (status atual: %)', v_p.status_compra;
  END IF;

  IF p_item_id IS NOT NULL AND btrim(p_item_id) <> '' THEN
    SELECT x.value INTO v_item FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_p.itens) = 'array' THEN v_p.itens ELSE '[]'::jsonb END) x
     WHERE x.value ->> 'id' = p_item_id LIMIT 1;
    IF v_item IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;
  ELSIF p_tipo <> 'duvida' THEN
    RAISE EXCEPTION 'Informe o item do questionamento';
  END IF;

  IF p_tipo = 'substituicao' THEN
    v_nome := btrim(COALESCE(p_sugestao ->> 'nome', ''));
    IF v_nome = '' THEN RAISE EXCEPTION 'Informe o item sugerido para a substituição'; END IF;
    v_sug := jsonb_build_object('nome', v_nome);
  ELSIF p_tipo = 'quantidade' THEN
    IF COALESCE((p_sugestao ->> 'quantidade')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Informe a quantidade sugerida (maior que zero)'; END IF;
    v_sug := jsonb_build_object('quantidade', (p_sugestao ->> 'quantidade')::numeric);
  ELSIF p_sugestao IS NOT NULL AND jsonb_typeof(p_sugestao) = 'object' THEN
    v_sug := NULLIF(jsonb_strip_nulls(jsonb_build_object('nome', NULLIF(btrim(COALESCE(p_sugestao ->> 'nome', '')), ''),
                                                          'quantidade', (p_sugestao ->> 'quantidade')::numeric)), '{}'::jsonb);
  END IF;
  IF v_sug IS NOT NULL AND NULLIF(btrim(COALESCE(p_sugestao ->> 'unidade', '')), '') IS NOT NULL THEN
    v_sug := v_sug || jsonb_build_object('unidade', btrim(p_sugestao ->> 'unidade'));
  END IF;
  IF v_sug IS NOT NULL AND p_tipo = 'substituicao' AND (p_sugestao ->> 'quantidade') IS NOT NULL THEN
    IF (p_sugestao ->> 'quantidade')::numeric <= 0 THEN RAISE EXCEPTION 'Quantidade sugerida inválida'; END IF;
    v_sug := v_sug || jsonb_build_object('quantidade', (p_sugestao ->> 'quantidade')::numeric);
  END IF;

  INSERT INTO public.execucao_pedidos_questionamentos (pedido_id, item_id, item_snapshot, tipo, pergunta, sugestao, criado_por)
  VALUES (p_pedido, NULLIF(btrim(COALESCE(p_item_id, '')), ''), v_item, p_tipo, btrim(p_pergunta), v_sug, v_uid)
  RETURNING id INTO v_id;

  IF v_p.status_compra IN ('aguardando_compra', 'em_cotacao') THEN
    UPDATE public.execucao_pedidos_material
       SET status_compra_anterior = v_p.status_compra, status_compra = 'aguardando_solicitante', status_compra_em = now(),
           comprador_id = COALESCE(comprador_id, v_uid), fila_compras_em = COALESCE(fila_compras_em, now()), updated_at = now()
     WHERE id = p_pedido;
  END IF;

  PERFORM public.execucao_compras_historico(p_pedido, v_uid, 'questionamento',
    format('Questionamento aberto (%s)%s', p_tipo, CASE WHEN v_item IS NOT NULL THEN ': ' || COALESCE(v_item ->> 'nome', '') ELSE '' END),
    NULL, NULL, btrim(p_pergunta));
  PERFORM public.execucao_compras_notificar_solicitante(p_pedido, 'compra_questionamento', '❓ Questionamento da Compras',
    format('%s: %s%s', COALESCE((SELECT nome_completo FROM public.usuarios WHERE id = v_uid), 'Compras'),
           COALESCE(v_p.cliente_nome || ' — ', ''), btrim(p_pergunta)),
    jsonb_build_object('pedido_id', p_pedido, 'questionamento_id', v_id), v_uid);
  RETURN v_id;
END $$;

-- ---------- Responder questionamento (solicitante não-técnico ou admin) ----------
-- Retorno: jsonb { questionamento_id, status, status_compra, item_alterado }
CREATE OR REPLACE FUNCTION public.compras_responder_questionamento(p_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  q public.execucao_pedidos_questionamentos; v_p public.execucao_pedidos_material;
  v_obs text := NULLIF(btrim(COALESCE(p_observacao, '')), '');
  v_nivel_sol text; v_ok boolean; v_alterou boolean := false; v_ant jsonb; v_novo jsonb; v_patch jsonb := '{}'::jsonb;
  v_unid text; v_qtd numeric; v_novo_status text; v_desc text; v_nome_ant text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_aprovar IS NULL THEN RAISE EXCEPTION 'Informe aprovar ou reprovar'; END IF;

  SELECT * INTO q FROM public.execucao_pedidos_questionamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionamento não encontrado'; END IF;
  IF q.status <> 'aberto' THEN RAISE EXCEPTION 'Este questionamento já foi encerrado (%)', q.status; END IF;
  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = q.pedido_id FOR UPDATE;

  SELECT na.nome INTO v_nivel_sol FROM public.usuarios u JOIN public.niveis_acesso na ON na.id = u.nivel_acesso_id WHERE u.id = v_p.solicitante_id;
  v_ok := public.is_admin_execucao()
          OR (q.tipo <> 'substituicao' AND v_p.solicitante_id = v_uid AND COALESCE(v_nivel_sol, 'TECNICO') <> 'TECNICO');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Sem permissão para responder este questionamento%',
      CASE WHEN q.tipo = 'substituicao' THEN ' (substituição técnica exige o administrador de execução)' ELSE '' END;
  END IF;
  IF (NOT p_aprovar OR q.tipo = 'duvida' OR v_p.solicitante_id IS DISTINCT FROM v_uid) AND (v_obs IS NULL OR length(v_obs) < 3) THEN
    RAISE EXCEPTION 'Informe a observação da resposta%',
      CASE WHEN v_p.solicitante_id IS DISTINCT FROM v_uid THEN ' (ex.: confirmado com o solicitante/técnico)' ELSE '' END;
  END IF;

  IF p_aprovar AND q.tipo IN ('substituicao', 'quantidade') AND q.sugestao IS NOT NULL THEN
    v_ant := jsonb_build_object('itens', v_p.itens);
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id) THEN
      RAISE EXCEPTION 'O item do questionamento não existe mais no pedido';
    END IF;
    SELECT x.value ->> 'nome' INTO v_nome_ant FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id;
    IF NULLIF(btrim(COALESCE(q.sugestao ->> 'nome', '')), '') IS NOT NULL THEN
      v_patch := v_patch || jsonb_build_object('nome', btrim(q.sugestao ->> 'nome'));
    END IF;
    IF NULLIF(q.sugestao ->> 'unidade', '') IS NOT NULL THEN v_patch := v_patch || jsonb_build_object('unidade', q.sugestao ->> 'unidade'); END IF;
    IF (q.sugestao ->> 'quantidade') IS NOT NULL THEN
      v_qtd := (q.sugestao ->> 'quantidade')::numeric;
      v_unid := COALESCE(q.sugestao ->> 'unidade',
                         (SELECT x.value ->> 'unidade' FROM jsonb_array_elements(v_p.itens) x WHERE x.value ->> 'id' = q.item_id));
      IF lower(COALESCE(v_unid, '')) IN ('un', 'cx', 'pct') THEN v_qtd := ceil(v_qtd); END IF;  -- N1-a/N1-b
      v_patch := v_patch || jsonb_build_object('quantidade', v_qtd);
    END IF;
    PERFORM set_config('execucao.compras_rpc', '1', true);
    UPDATE public.execucao_pedidos_material
       SET itens = (SELECT jsonb_agg(CASE WHEN e.v ->> 'id' = q.item_id THEN e.v || v_patch ELSE e.v END ORDER BY e.ord)
                      FROM jsonb_array_elements(v_p.itens) WITH ORDINALITY AS e(v, ord)),
           updated_at = now()
     WHERE id = v_p.id
    RETURNING jsonb_build_object('itens', itens) INTO v_novo;
    PERFORM set_config('execucao.compras_rpc', '', true);
    v_alterou := true;
  END IF;

  v_novo_status := CASE WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END;
  UPDATE public.execucao_pedidos_questionamentos
     SET status = v_novo_status, resposta_observacao = v_obs, respondido_por = v_uid, respondido_em = now(), updated_at = now()
   WHERE id = p_id;

  v_desc := format('Questionamento %s (%s)%s', CASE WHEN p_aprovar AND q.tipo = 'duvida' THEN 'respondido' WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END,
                   q.tipo, CASE WHEN v_alterou THEN ': ' || COALESCE(v_nome_ant, '') ELSE '' END);
  PERFORM public.execucao_compras_historico(v_p.id, v_uid, 'questionamento', v_desc, v_ant, v_novo, v_obs);

  PERFORM public.execucao_compras_restaurar_status(v_p.id);

  IF q.criado_por IS NOT NULL THEN
    INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
    VALUES ('compra_resposta', CASE WHEN p_aprovar THEN '✅ Questionamento respondido' ELSE '🚫 Questionamento reprovado' END,
            left(format('%s%s%s', COALESCE(v_p.cliente_nome || ' — ', ''), v_desc, CASE WHEN v_obs IS NOT NULL THEN ': ' || v_obs ELSE '' END), 500),
            v_p.atividade_id, q.criado_por, v_uid, jsonb_build_object('pedido_id', v_p.id, 'questionamento_id', p_id));
  END IF;

  RETURN jsonb_build_object('questionamento_id', p_id, 'status', v_novo_status,
                            'status_compra', (SELECT status_compra FROM public.execucao_pedidos_material WHERE id = v_p.id),
                            'item_alterado', v_alterou);
END $$;

-- ---------- Cancelar questionamento (autor ou admin) ----------
CREATE OR REPLACE FUNCTION public.compras_cancelar_questionamento(p_id uuid, p_motivo text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); q public.execucao_pedidos_questionamentos; v_p public.execucao_pedidos_material;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO q FROM public.execucao_pedidos_questionamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questionamento não encontrado'; END IF;
  IF NOT (q.criado_por = v_uid OR public.is_admin_execucao()) THEN RAISE EXCEPTION 'Sem permissão para cancelar este questionamento'; END IF;
  IF q.status <> 'aberto' THEN RAISE EXCEPTION 'Este questionamento já foi encerrado (%)', q.status; END IF;
  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = q.pedido_id FOR UPDATE;

  UPDATE public.execucao_pedidos_questionamentos
     SET status = 'cancelado', resposta_observacao = NULLIF(btrim(COALESCE(p_motivo, '')), ''), respondido_por = v_uid,
         respondido_em = now(), updated_at = now()
   WHERE id = p_id;
  PERFORM public.execucao_compras_historico(v_p.id, v_uid, 'questionamento', format('Questionamento cancelado (%s)', q.tipo), NULL, NULL, p_motivo);
  PERFORM public.execucao_compras_restaurar_status(v_p.id);
  PERFORM public.execucao_compras_notificar_solicitante(v_p.id, 'compra_questionamento', '↩️ Questionamento cancelado',
    format('%s%s', COALESCE(v_p.cliente_nome || ' — ', ''), 'A Compras cancelou o questionamento: ' || left(q.pergunta, 200)),
    jsonb_build_object('pedido_id', v_p.id, 'questionamento_id', p_id), v_uid);
END $$;

-- ---------- Assumir pedido (aguardando_compra → em_cotacao) ----------
CREATE OR REPLACE FUNCTION public.compras_assumir_pedido(p_pedido uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); v_p public.execucao_pedidos_material; v_outro text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_compras() THEN RAISE EXCEPTION 'Sem permissão: apenas o setor de Compras assume pedidos'; END IF;
  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra = 'em_cotacao' AND v_p.comprador_id = v_uid THEN
    RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', v_p.status_compra, 'comprador_id', v_p.comprador_id);
  END IF;
  IF v_p.status_compra <> 'aguardando_compra' THEN
    IF v_p.comprador_id IS NOT NULL AND v_p.comprador_id <> v_uid THEN
      SELECT nome_completo INTO v_outro FROM public.usuarios WHERE id = v_p.comprador_id;
      RAISE EXCEPTION 'O pedido já está com %', COALESCE(v_outro, 'outro comprador');
    END IF;
    RAISE EXCEPTION 'Só é possível assumir pedidos aguardando compra (status atual: %)', v_p.status_compra;
  END IF;
  IF NOT (public.execucao_pedido_tem_itens(v_p.itens) OR v_p.atividade_id IS NOT NULL) THEN
    RAISE EXCEPTION 'O pedido ainda não tem itens preenchidos';
  END IF;

  UPDATE public.execucao_pedidos_material
     SET status_compra = 'em_cotacao', comprador_id = v_uid, status_compra_em = now(),
         fila_compras_em = COALESCE(fila_compras_em, now()), updated_at = now()
   WHERE id = p_pedido;
  PERFORM public.execucao_compras_historico(p_pedido, v_uid, 'compra_status', 'Pedido assumido pela Compras (em cotação)',
    jsonb_build_object('status_compra', 'aguardando_compra'), jsonb_build_object('status_compra', 'em_cotacao', 'comprador_id', v_uid));
  RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', 'em_cotacao', 'comprador_id', v_uid);
END $$;

-- ---------- Alterar status de compra ----------
-- Retorno: jsonb { pedido_id, status_compra, data_material_disponivel, etapa_chegada_id, etapa_criada }
CREATE OR REPLACE FUNCTION public.compras_alterar_status(p_pedido uuid, p_status text, p_obs text DEFAULT NULL, p_data_disponibilidade date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id(); v_p public.execucao_pedidos_material;
  v_obs text := NULLIF(btrim(COALESCE(p_obs, '')), ''); v_ok boolean; v_data date; v_disp jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_status NOT IN ('aguardando_compra', 'em_cotacao', 'comprado', 'entregue_parcial', 'entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Status inválido (aguardando_solicitante é automático e não pode ser definido manualmente)';
  END IF;

  SELECT * INTO v_p FROM public.execucao_pedidos_material WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_p.status_compra = p_status THEN
    RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', v_p.status_compra, 'data_material_disponivel', v_p.data_material_disponivel);
  END IF;

  v_ok := CASE v_p.status_compra
            WHEN 'aguardando_compra' THEN p_status IN ('em_cotacao', 'cancelado')
            WHEN 'em_cotacao' THEN p_status IN ('aguardando_compra', 'comprado', 'cancelado')
            WHEN 'aguardando_solicitante' THEN p_status IN ('cancelado')
            WHEN 'comprado' THEN p_status IN ('entregue_parcial', 'entregue', 'cancelado')
            WHEN 'entregue_parcial' THEN p_status IN ('entregue', 'cancelado')
            ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transição não permitida: % → %', v_p.status_compra, p_status; END IF;

  IF p_status = 'cancelado' AND (v_obs IS NULL OR length(v_obs) < 3) THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  IF p_status = 'entregue_parcial' AND (v_obs IS NULL OR length(v_obs) < 3) THEN RAISE EXCEPTION 'Informe o que ainda falta entregar'; END IF;
  IF p_status = 'em_cotacao' AND v_p.status_compra = 'aguardando_compra'
     AND NOT (public.execucao_pedido_tem_itens(v_p.itens) OR v_p.atividade_id IS NOT NULL) THEN
    RAISE EXCEPTION 'O pedido ainda não tem itens preenchidos';
  END IF;
  IF p_status = 'comprado' THEN
    v_data := COALESCE(p_data_disponibilidade, v_p.data_material_disponivel);
    IF v_data IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade para marcar como comprado'; END IF;
  END IF;

  IF p_status = 'cancelado' THEN  -- fecha questionamentos abertos
    UPDATE public.execucao_pedidos_questionamentos
       SET status = 'cancelado', resposta_observacao = 'Pedido cancelado', respondido_por = v_uid, respondido_em = now(), updated_at = now()
     WHERE pedido_id = p_pedido AND status = 'aberto';
  END IF;

  UPDATE public.execucao_pedidos_material SET
    status_compra = p_status, status_compra_anterior = NULL, status_compra_em = now(), updated_at = now(),
    comprador_id = CASE WHEN p_status IN ('em_cotacao', 'comprado') THEN COALESCE(comprador_id, v_uid) ELSE comprador_id END,
    fila_compras_em = CASE WHEN p_status <> 'cancelado' THEN COALESCE(fila_compras_em, now()) ELSE fila_compras_em END,
    comprado_em = CASE WHEN p_status = 'comprado' THEN now() ELSE comprado_em END,
    -- D6: o status legado acompanha entregue/cancelado (trg_avisar_material continua avisando os técnicos)
    status = CASE WHEN p_status = 'entregue' THEN 'entregue' WHEN p_status = 'cancelado' THEN 'cancelado' ELSE status END,
    data_entrega = CASE WHEN p_status = 'entregue' THEN COALESCE(data_entrega, now()) ELSE data_entrega END
  WHERE id = p_pedido;

  IF p_status = 'comprado' THEN v_disp := public.execucao_compras_aplicar_disponibilidade(p_pedido, v_data, v_uid); END IF;

  PERFORM public.execucao_compras_historico(p_pedido, v_uid, 'compra_status',
    format('Status de compra: %s → %s', v_p.status_compra, p_status),
    jsonb_build_object('status_compra', v_p.status_compra), jsonb_build_object('status_compra', p_status), v_obs);

  IF p_status IN ('comprado', 'entregue_parcial', 'entregue', 'cancelado') THEN
    PERFORM public.execucao_compras_notificar_solicitante(p_pedido, 'compra_status',
      CASE p_status WHEN 'comprado' THEN '🛒 Pedido comprado' WHEN 'entregue_parcial' THEN '📦 Entrega parcial'
                    WHEN 'entregue' THEN '✅ Pedido entregue' ELSE '🚫 Pedido cancelado' END,
      format('%s%s%s', COALESCE(v_p.cliente_nome || ' — ', ''), COALESCE(v_p.descricao, 'Pedido de material'),
             CASE WHEN v_obs IS NOT NULL THEN ' · ' || v_obs ELSE '' END),
      jsonb_build_object('pedido_id', p_pedido), v_uid);
  END IF;

  RETURN jsonb_build_object('pedido_id', p_pedido, 'status_compra', p_status,
                            'data_material_disponivel', COALESCE(v_data, v_p.data_material_disponivel)) || v_disp;
END $$;

-- ---------- Definir previsão de chegada / disponibilidade ----------
CREATE OR REPLACE FUNCTION public.compras_definir_disponibilidade(p_pedido uuid, p_data date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_usuario_id(); v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade'; END IF;
  SELECT status_compra INTO v_status FROM public.execucao_pedidos_material WHERE id = p_pedido;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_status IN ('cancelado', 'entregue') THEN RAISE EXCEPTION 'Pedido encerrado (%): a data não pode mais ser alterada', v_status; END IF;
  RETURN public.execucao_compras_aplicar_disponibilidade(p_pedido, p_data, v_uid);
END $$;

-- ---------- Avisa o comprador quando o solicitante edita os itens (nunca bloqueia a gravação) ----------
CREATE OR REPLACE FUNCTION public.execucao_pedido_avisar_edicao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.itens IS DISTINCT FROM OLD.itens AND NEW.comprador_id IS NOT NULL
       AND NEW.status_compra IN ('aguardando_compra', 'em_cotacao', 'aguardando_solicitante')
       AND COALESCE(current_setting('execucao.compras_rpc', true), '') <> '1'
       AND public.current_usuario_id() IS DISTINCT FROM NEW.comprador_id THEN
      INSERT INTO public.execucao_notificacoes (tipo, titulo, mensagem, atividade_id, destinatario_id, usuario_origem_id, referencia)
      VALUES ('compra_status', '✏️ Pedido editado',
              left(format('%s%s: a lista de itens foi alterada pelo solicitante', COALESCE(NEW.cliente_nome || ' — ', ''), COALESCE(NEW.descricao, 'Pedido')), 500),
              NEW.atividade_id, NEW.comprador_id, public.current_usuario_id(), jsonb_build_object('pedido_id', NEW.id));
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_pedido_avisar_edicao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pedido_avisar_edicao ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedido_avisar_edicao AFTER UPDATE OF itens ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_pedido_avisar_edicao();

-- Pedido que sai da fila (comprado, entregue_parcial, entregue, cancelado, inclusive por edição do status legado) não pode
-- ficar com questionamento aberto: fecha os abertos (nunca bloqueia a gravação)
CREATE OR REPLACE FUNCTION public.execucao_pedido_fechar_questionamentos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    UPDATE public.execucao_pedidos_questionamentos
       SET status = 'cancelado', resposta_observacao = COALESCE(resposta_observacao, 'Pedido encerrado/avançou de etapa'), updated_at = now()
     WHERE pedido_id = NEW.id AND status = 'aberto';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.execucao_pedido_fechar_questionamentos() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pedido_fechar_questionamentos ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedido_fechar_questionamentos AFTER UPDATE OF status_compra ON public.execucao_pedidos_material
  FOR EACH ROW WHEN (NEW.status_compra IN ('comprado', 'entregue_parcial', 'entregue', 'cancelado')
                     AND NEW.status_compra IS DISTINCT FROM OLD.status_compra)
  EXECUTE FUNCTION public.execucao_pedido_fechar_questionamentos();

-- ---------- Permissões das RPCs ----------
REVOKE ALL ON FUNCTION public.compras_abrir_questionamento(uuid, text, text, text, jsonb),
  public.compras_responder_questionamento(uuid, boolean, text), public.compras_cancelar_questionamento(uuid, text),
  public.compras_assumir_pedido(uuid), public.compras_alterar_status(uuid, text, text, date),
  public.compras_definir_disponibilidade(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_abrir_questionamento(uuid, text, text, text, jsonb),
  public.compras_responder_questionamento(uuid, boolean, text), public.compras_cancelar_questionamento(uuid, text),
  public.compras_assumir_pedido(uuid), public.compras_alterar_status(uuid, text, text, date),
  public.compras_definir_disponibilidade(uuid, date) TO authenticated;
