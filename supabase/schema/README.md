# Snapshot do schema Supabase (para o graphify)

Os arquivos `.sql` desta pasta **não são migrations** e não devem ser executados. São um retrato do schema `public` do projeto Supabase `cadrulmppoxhsfjizcfy`, gerado via **MCP do Supabase**, para que o graphify mapeie o banco no mesmo grafo do código.

| Arquivo | Conteúdo |
| --- | --- |
| `tables.sql` | `CREATE TABLE` com colunas, PKs, UNIQUEs e FKs (CHECKs ficam como comentário após cada tabela, porque quebram o parser tree-sitter-sql) |
| `logic.sql` | Funções, triggers, policies RLS e índices |

No grafo, o script [`scripts/graph-link-db.mjs`](../../scripts/graph-link-db.mjs) adiciona arestas `uses` (`context: supabase.from`) / `calls` (`context: supabase.rpc`) de cada arquivo/função em `src/` que chama `supabase.from('<tabela>')` / `.rpc('<fn>')` até a tabela correspondente.

## Quando regenerar

Sempre que o schema mudar (nova tabela, coluna, FK, trigger etc.). O `graph-link-db` avisa quando o código usa uma tabela que não existe no snapshot.

## Como regenerar

Peça ao agente (Copilot com MCP do Supabase): _"Regenere o snapshot em supabase/schema seguindo o README"_. Ele deve:

1. Confirmar com `get_project_url` que o MCP aponta para `https://cadrulmppoxhsfjizcfy.supabase.co`.
2. Executar com `execute_sql` as consultas abaixo (somente leitura no catálogo).
3. Gravar o resultado com o cabeçalho de aviso, qualificar FKs sem schema (`REFERENCES x(` → `REFERENCES public.x(`) e mover as linhas `CONSTRAINT ... CHECK` para comentários após o `);` de cada tabela.
4. Rodar `npm run graph:rebuild`.

### tables.sql

```sql
with cols as (
  select c.table_name, string_agg(format('  %I %s%s%s', c.column_name,
    case when c.data_type='USER-DEFINED' then c.udt_name when c.data_type='ARRAY' then substr(c.udt_name,2)||'[]' else c.data_type end,
    case when c.is_nullable='NO' then ' NOT NULL' else '' end,
    case when c.column_default is not null then ' DEFAULT '||c.column_default else '' end), E',\n' order by c.ordinal_position) body
  from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
  where c.table_schema='public' group by c.table_name),
cons as (
  select cl.relname table_name, string_agg(format('  CONSTRAINT %I %s', co.conname, pg_get_constraintdef(co.oid)), E',\n' order by co.contype desc, co.conname) body
  from pg_constraint co join pg_class cl on cl.oid=co.conrelid join pg_namespace n on n.oid=cl.relnamespace
  where n.nspname='public' and co.contype in ('p','f','u','c') group by cl.relname)
select string_agg(
  coalesce('-- '||obj_description(format('public.%I',cols.table_name)::regclass,'pg_class')||E'\n','')||
  format(E'CREATE TABLE public.%I (\n%s%s\n);', cols.table_name, cols.body, coalesce(E',\n'||cons.body,'')), E'\n\n' order by cols.table_name) ddl
from cols left join cons using (table_name);
```

### logic.sql

```sql
select concat_ws(E'\n\n',
 (select string_agg(format(E'CREATE OR REPLACE VIEW public.%I AS\n%s', viewname, definition), E'\n\n' order by viewname) from pg_views where schemaname='public'),
 (select string_agg(pg_get_functiondef(p.oid)||';', E'\n\n' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind in ('f','p') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')),
 (select string_agg(pg_get_triggerdef(t.oid)||';', E'\n' order by c.relname, t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 (select string_agg(format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;', policyname, tablename, permissive, cmd, array_to_string(roles,', '),
   coalesce(' USING ('||qual||')',''), coalesce(' WITH CHECK ('||with_check||')','')), E'\n' order by tablename, policyname) from pg_policies where schemaname='public'),
 (select string_agg(indexdef||';', E'\n' order by tablename, indexname) from pg_indexes where schemaname='public' and indexname not like '%_pkey')
) ddl;
```
