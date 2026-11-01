-- 28 (ajustes pedidos pelo front de Compras): POPs legíveis para COMPRAS + nomes resolvidos no servidor.
--
-- Objetivo:
--   1. COMPRAS passa a LER POPs (execucao_pops, execucao_pops_arquivos e os arquivos do bucket 'pops-arquivos'), sem escrita:
--      as policies de leitura pops_read, pops_arq_read e pops_arquivos_read ganham "OR is_compras()". As policies de escrita
--      (pops_admin_write, pops_arq_admin_write, pops_arquivos_admin_write) NÃO mudam. is_usuario_execucao() NÃO muda
--      (COMPRAS continua sem ler obras, atividades e agenda).
--   2. COMPRAS vê nomes (solicitante, comprador, quem abriu/respondeu o questionamento) SEM SELECT em public.usuarios:
--        * compras_listar_pedidos (mig. 26) já devolve solicitante_nome e comprador_nome;
--        * compras_listar_questionamentos(p_pedido, p_status): questionamentos com criador_nome e respondedor_nome;
--        * compras_detalhe_pedido(p_pedido): pedido (mesmas colunas da lista) + histórico (usuario_nome resolvido) + questionamentos
--          (com nomes), numa chamada só.
--
-- Depende das 20261101_24, _25 e _26. Pode ser aplicada logo depois da 26.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.compras_detalhe_pedido(uuid);
--   DROP FUNCTION IF EXISTS public.compras_listar_questionamentos(uuid, text[]);
--   Policies de POPs: recriar as originais (mig. 20261022_01 L70, L74 e mig. 20261022_02 L27):
--     DROP POLICY IF EXISTS pops_read ON public.execucao_pops;
--     CREATE POLICY pops_read ON public.execucao_pops FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
--     DROP POLICY IF EXISTS pops_arq_read ON public.execucao_pops_arquivos;
--     CREATE POLICY pops_arq_read ON public.execucao_pops_arquivos FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
--     DROP POLICY IF EXISTS pops_arquivos_read ON storage.objects;
--     CREATE POLICY pops_arquivos_read ON storage.objects FOR SELECT TO authenticated
--       USING (bucket_id = 'pops-arquivos' AND (SELECT public.is_usuario_execucao()));

-- ---------- 1. POPs: leitura para COMPRAS ----------
DROP POLICY IF EXISTS pops_read ON public.execucao_pops;
CREATE POLICY pops_read ON public.execucao_pops FOR SELECT TO authenticated
  USING ((SELECT public.is_usuario_execucao()) OR (SELECT public.is_compras()));

DROP POLICY IF EXISTS pops_arq_read ON public.execucao_pops_arquivos;
CREATE POLICY pops_arq_read ON public.execucao_pops_arquivos FOR SELECT TO authenticated
  USING ((SELECT public.is_usuario_execucao()) OR (SELECT public.is_compras()));

DROP POLICY IF EXISTS pops_arquivos_read ON storage.objects;
CREATE POLICY pops_arquivos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pops-arquivos' AND ((SELECT public.is_usuario_execucao()) OR (SELECT public.is_compras())));

-- ---------- 2. Questionamentos com nomes ----------
CREATE OR REPLACE FUNCTION public.compras_listar_questionamentos(p_pedido uuid DEFAULT NULL, p_status text[] DEFAULT NULL)
RETURNS TABLE (
  id uuid, pedido_id uuid, item_id text, item_snapshot jsonb, tipo text, pergunta text, sugestao jsonb, status text,
  resposta_observacao text, criado_por uuid, criador_nome text, respondido_por uuid, respondedor_nome text,
  respondido_em timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT q.id, q.pedido_id, q.item_id, q.item_snapshot, q.tipo, q.pergunta, q.sugestao, q.status,
         q.resposta_observacao, q.criado_por, uc.nome_completo::text, q.respondido_por, ur.nome_completo::text,
         q.respondido_em, q.created_at, q.updated_at
    FROM public.execucao_pedidos_questionamentos q
    LEFT JOIN public.usuarios uc ON uc.id = q.criado_por
    LEFT JOIN public.usuarios ur ON ur.id = q.respondido_por
   WHERE (p_pedido IS NULL OR q.pedido_id = p_pedido)
     AND (p_status IS NULL OR cardinality(p_status) = 0 OR q.status = ANY (p_status))
   ORDER BY q.created_at ASC, q.id ASC
   LIMIT 500;
END $$;

-- ---------- 3. Detalhe do pedido numa chamada ----------
-- Retorno: jsonb { pedido: {linha de compras_listar_pedidos}, historico: [...], questionamentos: [...] }
CREATE OR REPLACE FUNCTION public.compras_detalhe_pedido(p_pedido uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pedido jsonb; v_hist jsonb; v_quest jsonb;
BEGIN
  IF NOT public.pode_ver_compras() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT to_jsonb(r) INTO v_pedido
    FROM public.compras_listar_pedidos(
           jsonb_build_object('pedido_id', p_pedido,
                              'status_compra', jsonb_build_array('aguardando_compra', 'em_cotacao', 'aguardando_solicitante',
                                                                  'comprado', 'entregue_parcial', 'entregue', 'cancelado')),
           1, NULL) r;
  IF v_pedido IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado ou fora da fila de Compras'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', h.id, 'tipo_alteracao', h.tipo_alteracao, 'descricao', h.descricao,
           'usuario_id', h.usuario_id, 'usuario_nome', COALESCE(h.usuario_nome, u.nome_completo),
           'data_alteracao', h.data_alteracao, 'dados_anteriores', h.dados_anteriores, 'dados_novos', h.dados_novos,
           'data_limite_anterior', h.data_limite_anterior, 'data_limite_nova', h.data_limite_nova, 'motivo', h.motivo)
         ORDER BY h.data_alteracao DESC, h.id), '[]'::jsonb)
    INTO v_hist
    FROM public.execucao_historico_pedidos h LEFT JOIN public.usuarios u ON u.id = h.usuario_id
   WHERE h.pedido_id = p_pedido;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at, q.id), '[]'::jsonb)
    INTO v_quest FROM public.compras_listar_questionamentos(p_pedido, NULL) q;

  RETURN jsonb_build_object('pedido', v_pedido, 'historico', v_hist, 'questionamentos', v_quest);
END $$;

REVOKE ALL ON FUNCTION public.compras_listar_questionamentos(uuid, text[]), public.compras_detalhe_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compras_listar_questionamentos(uuid, text[]), public.compras_detalhe_pedido(uuid) TO authenticated;
