-- =====================================================================================================
-- DIAGNÓSTICO B-00 (SOMENTE LEITURA, exceto o item 4, que cria e remove uma função temporária).
-- Plano: PLANO_COTACAO_FORNECEDORES.md, Onda 0 / B-00. Rodar no SQL Editor do Supabase, um bloco por vez.
-- Anote os resultados no Anexo A do plano. NÃO cole tokens, chaves ou o conteúdo do .env aqui.
-- Depois do item 1, se a mig. 33 não estiver aplicada, aplique 20261101_33_compras_acesso_exclusivo.sql
-- (nome sugerido no MCP: execucao_33_compras_acesso_exclusivo) ANTES da B-08.
-- =====================================================================================================

-- (1) Migrations 32 e 33 aplicadas? (esperado: 2 linhas, versões que terminam em ..._32_... e ..._33_...)
select version, name
  from supabase_migrations.schema_migrations
 where name ilike '%32_compras_modulo_proprio%' or name ilike '%33_compras_acesso_exclusivo%'
    or version >= '20261101'
 order by version;

-- (1b) Confirmação pelo EFEITO da mig. 33 (independe do nome registrado):
--      compras_alterar_status deve usar is_compras() (e não pode_ver_compras()) e ADMIN_EXECUCAO não pode ter a página 'compras'.
select p.proname,
       position('IF NOT public.is_compras() THEN' in pg_get_functiondef(p.oid)) > 0       as gate_is_compras,
       position('IF NOT public.pode_ver_compras() THEN' in pg_get_functiondef(p.oid)) > 0 as gate_pode_ver
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname in ('compras_indicadores', 'compras_alterar_status', 'compras_definir_disponibilidade');

select n.nome as nivel, pg.rota
  from public.permissoes pm
  join public.niveis_acesso n on n.id = pm.nivel_acesso_id
  join public.paginas pg on pg.id = pm.pagina_id
 where pg.rota = 'compras'
 order by n.nome;   -- esperado: só COMPRAS e Administrador

-- (2) Extensões (esperado: pgcrypto e, se possível, pg_trgm no schema extensions; pg_cron é opcional)
select e.extname, e.extnamespace::regnamespace as schema, e.extversion
  from pg_extension e
 where e.extname in ('pgcrypto', 'pg_trgm', 'pg_cron');
select name, installed_version, default_version
  from pg_available_extensions
 where name in ('pgcrypto', 'pg_trgm', 'pg_cron');
-- as funções usadas pelas migrations 34–37 precisam existir:
select to_regprocedure('extensions.gen_random_bytes(integer)') as gen_random_bytes,
       to_regprocedure('sha256(bytea)')                         as sha256;

-- (3) Estado atual relevante para a 34–38
select pg_get_constraintdef(c.oid) as check_notificacoes_tipo
  from pg_constraint c where c.conname = 'execucao_notificacoes_tipo_check';
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'execucao_pedidos_questionamentos' order by ordinal_position;
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename like '%pedidos%';
select to_regclass('public.compras_config') as compras_config_ja_existe;   -- esperado NULL antes da B-08

-- (3b) Reconciliação da 36 (Q-02/B-08): compare estas definições de PRODUÇÃO com o "DIFF" no cabeçalho da 36.
--      Qualquer diferença além do diff documentado precisa ser reconciliada antes de aplicar.
select p.proname, pg_get_functiondef(p.oid) as definicao
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname in ('compras_alterar_status', 'compras_listar_pedidos', 'compras_detalhe_pedido');

-- (4) Cabeçalho que traz o IP do visitante em chamada ANON (confirma compras_request_ip)
--     4a. cria a função temporária (anon pode executar)
create or replace function public._tmp_b00_headers() returns text
language sql stable security invoker as $$ select current_setting('request.headers', true) $$;
grant execute on function public._tmp_b00_headers() to anon;
--     4b. chame-a como ANON, SEM login, pelo terminal (use a URL e a chave PÚBLICA publishable/anon do seu projeto; não é o service_role):
--         curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/_tmp_b00_headers" -H "apikey: $SUPABASE_ANON_KEY" \
--              -H "Content-Type: application/json" -d '{}'
--         Procure no JSON retornado: cf-connecting-ip, x-real-ip e x-forwarded-for (o 1º IP é o do visitante).
--     4c. REMOVA a função (obrigatório):
drop function if exists public._tmp_b00_headers();
