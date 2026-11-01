-- 24 (B6 · R8 · D4/D6 · N1-j/N1-n): base do módulo de Compras.
--
-- Objetivo:
--   * Novo nível de acesso COMPRAS e página 'execucao/compras' + permissões (COMPRAS: 'execucao' e 'execucao/compras';
--     ADMIN_EXECUCAO e Administrador: 'execucao/compras'). Linhas só são criadas se ainda não existirem.
--   * Funções is_compras() (COMPRAS ou Administrador) e pode_ver_compras() (is_compras() OU is_admin_execucao()).
--     is_usuario_execucao() NÃO muda: COMPRAS não lê obras/atividades/POPs.
--   * execucao_pedidos_material: status_compra (separado do status legado, D6), comprador_id, status_compra_em, comprado_em,
--     + status_compra_anterior (para voltar ao status anterior ao fechar o último questionamento, N1-j.1),
--       fila_compras_em (instante em que entrou na fila de Compras: base dos tempos médios, N1-l),
--       etapa_chegada_id (etapa "📦 Chegada dos Materiais" criada para o pedido: mudanças de data ATUALIZAM, não duplicam, N1-m.2).
--   * Backfill de status_compra (N1-j §3.1.2): entregue→entregue; cancelado/recusado→cancelado; demais (inclui aprovado,
--     concluido, solicitado e pendente de falta de material)→aguardando_compra. Fila (N1-n) = status_compra <> 'cancelado'
--     E (≥1 item preenchido OU atividade_id preenchido [falta de material em campo]).
--   * Triggers: (1) sincroniza status legado → status_compra (entregue / cancelado / recusado) e marca fila_compras_em;
--     (2) bloqueia edição de itens depois de 'comprado' (lacuna do §3.1.2).
--   * RLS: + SELECT para is_compras() (COMPRAS/Administrador; o admin de execução já tem *_admin_all) em execucao_pedidos_material
--     e execucao_historico_pedidos. Escrita de COMPRAS só via RPC (mig. 25).
--
-- Depende da 20261101_23 (itens[].id). Aplicar antes da 25.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS pedidos_compras_select ON public.execucao_pedidos_material;
--   DROP POLICY IF EXISTS historico_pedidos_compras_select ON public.execucao_historico_pedidos;
--   DROP TRIGGER IF EXISTS trg_pedidos_compras_sync ON public.execucao_pedidos_material;
--   DROP FUNCTION IF EXISTS public.execucao_pedidos_compras_sync();
--   DROP FUNCTION IF EXISTS public.execucao_pedido_tem_itens(jsonb), public.execucao_pedido_itens_sem_id(jsonb);
--   DROP FUNCTION IF EXISTS public.pode_ver_compras();  DROP FUNCTION IF EXISTS public.is_compras();
--   ALTER TABLE public.execucao_pedidos_material DROP COLUMN IF EXISTS status_compra, DROP COLUMN IF EXISTS comprador_id,
--     DROP COLUMN IF EXISTS status_compra_em, DROP COLUMN IF EXISTS comprado_em, DROP COLUMN IF EXISTS status_compra_anterior,
--     DROP COLUMN IF EXISTS fila_compras_em, DROP COLUMN IF EXISTS etapa_chegada_id;   -- só após exportar os dados
--   DELETE FROM public.permissoes WHERE pagina_id IN (SELECT id FROM public.paginas WHERE rota = 'execucao/compras');
--   DELETE FROM public.paginas WHERE rota = 'execucao/compras';
--   (desativar o nível: mover usuários COMPRAS para outro nível antes de DELETE FROM public.niveis_acesso WHERE nome = 'COMPRAS')

-- ---------- Nível, página e permissões ----------
INSERT INTO public.niveis_acesso (nome, descricao)
VALUES ('COMPRAS', 'Setor de Compras: acompanha e trata os pedidos de material da Execução')
ON CONFLICT DO NOTHING;

INSERT INTO public.paginas (nome, rota, descricao)
VALUES ('Compras (Execução)', 'execucao/compras', 'Dashboard do setor de Compras: fila de pedidos de material, questionamentos e indicadores')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
SELECT n.id, p.id
  FROM public.niveis_acesso n JOIN public.paginas p ON p.rota IN ('execucao', 'execucao/compras')
 WHERE n.nome = 'COMPRAS'
ON CONFLICT DO NOTHING;

INSERT INTO public.permissoes (nivel_acesso_id, pagina_id)
SELECT n.id, p.id
  FROM public.niveis_acesso n JOIN public.paginas p ON p.rota = 'execucao/compras'
 WHERE n.nome IN ('ADMIN_EXECUCAO', 'Administrador')
ON CONFLICT DO NOTHING;

-- ---------- Funções de papel ----------
CREATE OR REPLACE FUNCTION public.is_compras() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_nivel() IN ('COMPRAS', 'Administrador'), false)
$$;
CREATE OR REPLACE FUNCTION public.pode_ver_compras() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_compras() OR public.is_admin_execucao()
$$;
REVOKE ALL ON FUNCTION public.is_compras(), public.pode_ver_compras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_compras(), public.pode_ver_compras() TO authenticated;

-- Lista com ≥ 1 item preenchido (nome não vazio)
CREATE OR REPLACE FUNCTION public.execucao_pedido_tem_itens(p_itens jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_itens) = 'array' THEN p_itens ELSE '[]'::jsonb END) e
     WHERE jsonb_typeof(e) = 'object' AND btrim(COALESCE(e ->> 'nome', '')) <> '')
$$;
REVOKE ALL ON FUNCTION public.execucao_pedido_tem_itens(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_pedido_tem_itens(jsonb) TO authenticated;

-- ---------- Colunas ----------
ALTER TABLE public.execucao_pedidos_material
  ADD COLUMN IF NOT EXISTS status_compra text NOT NULL DEFAULT 'aguardando_compra',
  ADD COLUMN IF NOT EXISTS comprador_id uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS status_compra_em timestamptz,
  ADD COLUMN IF NOT EXISTS comprado_em timestamptz,
  ADD COLUMN IF NOT EXISTS status_compra_anterior text,
  ADD COLUMN IF NOT EXISTS fila_compras_em timestamptz,
  ADD COLUMN IF NOT EXISTS etapa_chegada_id uuid REFERENCES public.execucao_obras_etapas(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execucao_pedidos_material_status_compra_check') THEN
    ALTER TABLE public.execucao_pedidos_material ADD CONSTRAINT execucao_pedidos_material_status_compra_check
      CHECK (status_compra IN ('aguardando_compra', 'em_cotacao', 'aguardando_solicitante', 'comprado',
                               'entregue_parcial', 'entregue', 'cancelado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execucao_pedidos_material_status_compra_anterior_check') THEN
    ALTER TABLE public.execucao_pedidos_material ADD CONSTRAINT execucao_pedidos_material_status_compra_anterior_check
      CHECK (status_compra_anterior IS NULL OR status_compra_anterior IN ('aguardando_compra', 'em_cotacao'));
  END IF;
END $$;

-- ---------- Backfill (auditoria desligada só aqui, para não poluir execucao_auditoria) ----------
DO $$
DECLARE v_aud boolean;
BEGIN
  v_aud := EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.execucao_pedidos_material'::regclass
                      AND tgname = 'trg_auditar' AND NOT tgisinternal);
  IF v_aud THEN ALTER TABLE public.execucao_pedidos_material DISABLE TRIGGER trg_auditar; END IF;

  UPDATE public.execucao_pedidos_material
     SET status_compra = CASE WHEN status = 'entregue' THEN 'entregue' ELSE 'cancelado' END,
         status_compra_em = COALESCE(data_entrega, updated_at, created_at)
   WHERE status IN ('entregue', 'cancelado', 'recusado') AND status_compra = 'aguardando_compra';

  -- faltas de material reportadas em campo já nasceram "na fila" no instante do reporte
  UPDATE public.execucao_pedidos_material
     SET fila_compras_em = created_at
   WHERE fila_compras_em IS NULL AND atividade_id IS NOT NULL AND status_compra <> 'cancelado';

  IF v_aud THEN ALTER TABLE public.execucao_pedidos_material ENABLE TRIGGER trg_auditar; END IF;
END $$;

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS idx_pedidos_status_compra_created ON public.execucao_pedidos_material (status_compra, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_comprador ON public.execucao_pedidos_material (comprador_id) WHERE comprador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_etapa_chegada ON public.execucao_pedidos_material (etapa_chegada_id) WHERE etapa_chegada_id IS NOT NULL;

-- ---------- Triggers ----------
-- Itens sem a chave "id" (para comparar listas ignorando ids gerados pelo trigger da mig. 23)
CREATE OR REPLACE FUNCTION public.execucao_pedido_itens_sem_id(p_itens jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_itens) = 'array'
              THEN COALESCE((SELECT jsonb_agg(CASE WHEN jsonb_typeof(e.v) = 'object' THEN e.v - 'id' ELSE e.v END ORDER BY e.ord)
                               FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS e(v, ord)), '[]'::jsonb)
              ELSE p_itens END
$$;
REVOKE ALL ON FUNCTION public.execucao_pedido_itens_sem_id(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_pedido_itens_sem_id(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.execucao_pedidos_compras_sync() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Itens não mudam depois de comprado (mudança só antes, via questionamento aprovado ou edição do solicitante).
    -- Compara sem os ids: um UPDATE que só "perde" os ids (front antigo) é regravado pelo trigger de ids e não é edição.
    IF OLD.status_compra IN ('comprado', 'entregue_parcial', 'entregue')
       AND public.execucao_pedido_itens_sem_id(NEW.itens) IS DISTINCT FROM public.execucao_pedido_itens_sem_id(OLD.itens) THEN
      RAISE EXCEPTION 'Os itens não podem ser alterados depois que o pedido foi comprado (status: %)', OLD.status_compra;
    END IF;
    -- Status legado → status_compra (o legado continua valendo para as telas antigas)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'entregue' AND NEW.status_compra NOT IN ('entregue', 'cancelado') THEN
        NEW.status_compra := 'entregue'; NEW.status_compra_anterior := NULL; NEW.status_compra_em := now();
      ELSIF NEW.status IN ('cancelado', 'recusado') AND NEW.status_compra NOT IN ('entregue', 'cancelado') THEN
        NEW.status_compra := 'cancelado'; NEW.status_compra_anterior := NULL; NEW.status_compra_em := now();
      END IF;
    END IF;
  ELSE  -- INSERT
    IF NEW.status = 'entregue' AND NEW.status_compra NOT IN ('entregue', 'cancelado') THEN
      NEW.status_compra := 'entregue'; NEW.status_compra_em := now();
    ELSIF NEW.status IN ('cancelado', 'recusado') AND NEW.status_compra NOT IN ('entregue', 'cancelado') THEN
      NEW.status_compra := 'cancelado'; NEW.status_compra_em := now();
    END IF;
  END IF;

  -- Entrou na fila de Compras (N1-n): ≥ 1 item preenchido OU pedido de falta de material (atividade_id)
  IF NEW.fila_compras_em IS NULL AND NEW.status_compra <> 'cancelado'
     AND (public.execucao_pedido_tem_itens(NEW.itens) OR NEW.atividade_id IS NOT NULL) THEN
    NEW.fila_compras_em := now();
  END IF;
  RETURN NEW;
END $$;
-- Função de trigger: não precisa de EXECUTE para o usuário (só as funções que ela chama)
REVOKE ALL ON FUNCTION public.execucao_pedidos_compras_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pedidos_compras_sync ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedidos_compras_sync BEFORE INSERT OR UPDATE OF status, itens, atividade_id, status_compra ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_pedidos_compras_sync();

-- ---------- RLS: leitura para Compras (escrita só via RPC) ----------
-- (usa is_compras() e não pode_ver_compras(): o admin já tem *_admin_all; evita policy permissiva duplicada no advisor)
DROP POLICY IF EXISTS pedidos_compras_select ON public.execucao_pedidos_material;
CREATE POLICY pedidos_compras_select ON public.execucao_pedidos_material FOR SELECT TO authenticated
  USING ((SELECT public.is_compras()));

DROP POLICY IF EXISTS historico_pedidos_compras_select ON public.execucao_historico_pedidos;
CREATE POLICY historico_pedidos_compras_select ON public.execucao_historico_pedidos FOR SELECT TO authenticated
  USING ((SELECT public.is_compras()));
