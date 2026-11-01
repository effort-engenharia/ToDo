-- 23 (B5 · D2): id estável por item da lista de materiais (execucao_pedidos_material.itens[].id).
--
-- Objetivo: todo item da lista passa a ter "id" (uuid em texto), gerado pelo banco quando ausente, para o diff do
-- histórico (F3) e para os questionamentos de compra apontarem para um item (B7). Sem colunas novas.
--   * execucao_pedidos_itens_com_id(jsonb): adiciona id aos itens (objetos) que não têm, preservando ordem e ids existentes.
--   * trigger trg_pedidos_itens_id (BEFORE INSERT OR UPDATE OF itens) em execucao_pedidos_material.
--   * backfill dos pedidos existentes, em lotes de 1.000, com o trigger de auditoria (trg_auditar, mig. 07)
--     desativado só durante o backfill para não poluir execucao_auditoria. CONFERIR na B0 (diagnostico_B0.sql, item 3)
--     o nome real dos triggers de execucao_pedidos_material; se houver outro de auditoria/updated_at, desativar também.
--   O histórico antigo (execucao_historico_pedidos.dados_*) NÃO é reescrito: o diff usa fallback por nome+unidade.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_pedidos_itens_id ON public.execucao_pedidos_material;
--   DROP FUNCTION IF EXISTS public.execucao_pedidos_itens_trg();
--   DROP FUNCTION IF EXISTS public.execucao_pedidos_itens_com_id(jsonb);
--   (itens com "id" extra são inofensivos; não é preciso removê-los)

CREATE OR REPLACE FUNCTION public.execucao_pedidos_itens_com_id(p_itens jsonb) RETURNS jsonb
LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_itens) = 'array' THEN COALESCE((
      SELECT jsonb_agg(CASE WHEN jsonb_typeof(e.v) = 'object' AND COALESCE(e.v ->> 'id', '') = ''
                            THEN e.v || jsonb_build_object('id', gen_random_uuid()::text)
                            ELSE e.v END ORDER BY e.ord)
        FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS e(v, ord)), '[]'::jsonb)
    ELSE p_itens END
$$;

CREATE OR REPLACE FUNCTION public.execucao_pedidos_itens_trg() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.itens := public.execucao_pedidos_itens_com_id(NEW.itens);
  RETURN NEW;
END $$;
-- A função de itens é chamada pelo trigger (que roda como o usuário do DML): precisa de EXECUTE. A função do trigger em si não.
REVOKE ALL ON FUNCTION public.execucao_pedidos_itens_com_id(jsonb), public.execucao_pedidos_itens_trg() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execucao_pedidos_itens_trg() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execucao_pedidos_itens_com_id(jsonb) TO authenticated;

DROP TRIGGER IF EXISTS trg_pedidos_itens_id ON public.execucao_pedidos_material;
CREATE TRIGGER trg_pedidos_itens_id BEFORE INSERT OR UPDATE OF itens ON public.execucao_pedidos_material
  FOR EACH ROW EXECUTE FUNCTION public.execucao_pedidos_itens_trg();

-- Backfill (lotes de 1.000; auditoria desligada só aqui)
DO $$
DECLARE v_n int; v_aud boolean;
BEGIN
  v_aud := EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.execucao_pedidos_material'::regclass
                      AND tgname = 'trg_auditar' AND NOT tgisinternal);
  IF v_aud THEN ALTER TABLE public.execucao_pedidos_material DISABLE TRIGGER trg_auditar; END IF;
  LOOP
    UPDATE public.execucao_pedidos_material p
       SET itens = public.execucao_pedidos_itens_com_id(p.itens)
     WHERE p.id IN (
       SELECT x.id FROM public.execucao_pedidos_material x
        WHERE jsonb_typeof(x.itens) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(x.itens) e
                       WHERE jsonb_typeof(e) = 'object' AND COALESCE(e ->> 'id', '') = '')
        LIMIT 1000);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXIT WHEN v_n = 0;
  END LOOP;
  IF v_aud THEN ALTER TABLE public.execucao_pedidos_material ENABLE TRIGGER trg_auditar; END IF;
END $$;
