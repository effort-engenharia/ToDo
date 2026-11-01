-- 22 (B4 · R10 · D13 · Anexo B causa #3): bucket 'atividades-evidencias' aceita vídeo/áudio.
--
-- Objetivo: remover qualquer restrição de mime do bucket (allowed_mime_types = NULL: o Storage não restringe por tipo;
-- evita 415 por variação de mime: video/webm, video/mp4, video/quicktime (.mov do iOS), audio/webm, audio/mp4,
-- audio/mpeg, audio/ogg, audio/aac, audio/x-m4a, imagens) e manter file_size_limit = 50 MiB (52428800 B).
-- A mig. 05 criou o bucket SEM allowed_mime_types, mas o ON CONFLICT DO UPDATE preserva um valor que já existisse
-- (ex.: só image/* definido no painel). Esta migration é a correção idempotente.
-- Se preferirem lista explícita no lugar de NULL, usar a alternativa comentada ao final.
--
-- ATENÇÃO (fora do SQL): o limite GLOBAL de upload do projeto (Dashboard > Storage > Settings; Free = 50 MiB) também
-- vale e não pode ser alterado por migration. Anotar o valor atual no Anexo A do plano.
-- ANTES DE APLICAR: anotar o valor atual para confirmar/descartar a causa #3 e para o rollback:
--   SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'atividades-evidencias';
--
-- ROLLBACK:
--   UPDATE storage.buckets SET allowed_mime_types = <valor anotado antes de aplicar (ex.: ARRAY['image/jpeg','image/png','image/webp'] ou NULL)>,
--                              file_size_limit = <valor anotado, 52428800 se não mudou>
--    WHERE id = 'atividades-evidencias';
--   (as políticas de storage.objects deste bucket não são alteradas por esta migration)

UPDATE storage.buckets
   SET allowed_mime_types = NULL,
       file_size_limit = 52428800
 WHERE id = 'atividades-evidencias';

-- Alternativa (lista explícita; NÃO ativa):
-- UPDATE storage.buckets
--    SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif',
--          'video/webm','video/mp4','video/quicktime','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a'],
--        file_size_limit = 52428800
--  WHERE id = 'atividades-evidencias';
