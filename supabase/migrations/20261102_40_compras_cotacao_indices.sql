-- 40 (P-02 · PLANO_COTACAO_FORNECEDORES §5/§12): índices de apoio aos filtros por período de compras_indicadores_cotacao (39).
--
-- Objetivo:
--   * compras_cotacoes (aberta_em): K-indicadores filtram `aberta_em >= v_ini AND aberta_em < v_fim` (primeira resposta, convites por fornecedor).
--   * compras_cotacao_decisoes (decidido_em): K-indicadores filtram `decidido_em >= v_ini AND decidido_em < v_fim` (decisões, gasto, VP × referência).
--   Revisão das migrations 34–39: todas as FKs já são cobertas por PK/UNIQUE/índice; estes são os únicos filtros por intervalo sem índice.
--
-- Dependências: 35 (tabelas). Idempotente (IF NOT EXISTS). Sem alteração de dados nem de funções. NÃO APLICADA (aguardando B-08/orquestrador).
-- Observação: volume inicial pequeno; o ganho aparece com histórico acumulado. Custo de escrita desprezível (poucas escritas por cotação).
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_compras_cotacoes_aberta_em;
--   DROP INDEX IF EXISTS public.idx_compras_decisoes_decidido_em;

CREATE INDEX IF NOT EXISTS idx_compras_cotacoes_aberta_em ON public.compras_cotacoes (aberta_em) WHERE aberta_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_decisoes_decidido_em ON public.compras_cotacao_decisoes (decidido_em);
