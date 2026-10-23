-- POPs: colunas usadas pelo formulário e ausentes no banco; categoria passa a ser texto livre
ALTER TABLE public.execucao_pops
  ADD COLUMN IF NOT EXISTS tipo_execucao varchar,
  ADD COLUMN IF NOT EXISTS conteudo text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.execucao_pops DROP CONSTRAINT IF EXISTS execucao_pops_categoria_check;
ALTER TABLE public.execucao_pops DROP CONSTRAINT IF EXISTS execucao_pops_tipo_execucao_check;
ALTER TABLE public.execucao_pops ADD CONSTRAINT execucao_pops_tipo_execucao_check
  CHECK (tipo_execucao IS NULL OR tipo_execucao IN ('eletrica', 'civil', 'galpao', 'gestao', 'estoque'));

-- Buckets privados (URLs assinadas) + políticas de Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pops-arquivos', 'pops-arquivos', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets SET public = false WHERE id = 'obras-arquivos';

DROP POLICY IF EXISTS "Acesso público para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Deletar para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Upload para autenticados" ON storage.objects;

CREATE POLICY obras_arquivos_admin_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'obras-arquivos' AND (SELECT public.is_admin_execucao()))
  WITH CHECK (bucket_id = 'obras-arquivos' AND (SELECT public.is_admin_execucao()));

CREATE POLICY pops_arquivos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pops-arquivos' AND (SELECT public.is_usuario_execucao()));
CREATE POLICY pops_arquivos_admin_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'pops-arquivos' AND (SELECT public.is_admin_execucao()))
  WITH CHECK (bucket_id = 'pops-arquivos' AND (SELECT public.is_admin_execucao()));
