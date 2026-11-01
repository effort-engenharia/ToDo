-- =====================================================================================================
-- DIAGNÓSTICO B0 (SOMENTE LEITURA): rodar no SQL Editor do Supabase (cada bloco separadamente).
-- Plano: PLANO_MELHORIAS_EXECUCAO_COMPRAS.md, Onda 0, B0 (itens 1 a 6) + conferências extras.
-- Só contém SELECT. Não altera nada. Anote os resultados no Anexo A do plano.
-- =====================================================================================================


-- ---------------------------------------------------------------------------------------------------
-- (1) Bucket de evidências (causa #3 do Anexo B: allowed_mime_types restrito → 415 em vídeo/áudio)
--     O limite GLOBAL de upload do projeto NÃO aparece em SQL: ver Dashboard > Storage > Settings (Free = 50 MB).
-- ---------------------------------------------------------------------------------------------------
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'atividades-evidencias';


-- ---------------------------------------------------------------------------------------------------
-- (2) Overloads de alterar_status_atividade (a mig. 20 faz DROP das assinaturas antigas e deixa só a de 13 parâmetros)
-- ---------------------------------------------------------------------------------------------------
select p.oid::regprocedure as assinatura, p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'alterar_status_atividade';


-- ---------------------------------------------------------------------------------------------------
-- (3) Triggers de execucao_pedidos_material (nome do trigger de auditoria usado no backfill das migs. 23/24)
-- ---------------------------------------------------------------------------------------------------
select tgname, tgenabled, pg_get_triggerdef(oid) as definicao
  from pg_trigger
 where tgrelid = 'public.execucao_pedidos_material'::regclass and not tgisinternal
 order by tgname;


-- ---------------------------------------------------------------------------------------------------
-- (4) Qual caminho (i / ii / iii da §2.12) concluiu etapas PAI nos últimos 30 dias.
--     Para cada pai concluído (UPDATE status→concluida em execucao_auditoria), olha o que mais aconteceu na MESMA transação
--     (a RPC alterar_status_atividade roda numa transação só, então `transacao` agrupa tudo o que ela mexeu):
--       (i)   a atividade do PRÓPRIO pai foi concluída (mig. 16: pai conclui pelas suas atividades e a cascata fecha as sub-etapas)
--       (ii)  a atividade de uma SUB-ETAPA foi concluída → execucao_sincronizar_etapa_pai fechou o pai (ignora a atividade do pai)
--       (iii) atividade sem etapa_id foi ligada por nome+cliente (LIMIT 1) na mesma transação (pode ter caído no pai/sub errada)
--     A auditoria guarda 365 dias (execucao_auditoria_limpar). Se vier vazio, ampliar o intervalo de 30 para 90 dias.
-- ---------------------------------------------------------------------------------------------------
with pai_conc as (
  select a.registro_id::uuid as pai_id, a.transacao, a.created_at as concluida_em, a.usuario_id, a.contexto
    from public.execucao_auditoria a
   where a.tabela = 'execucao_obras_etapas' and a.operacao = 'UPDATE'
     and a.created_at >= now() - interval '30 days'
     and a.depois ->> 'status' = 'concluida' and coalesce(a.antes ->> 'status', '') <> 'concluida'
     and a.depois ->> 'etapa_pai_id' is null
     and exists (select 1 from public.execucao_obras_etapas f where f.etapa_pai_id = a.registro_id::uuid)
), ev as (
  select pc.*,
    (select count(*) from public.execucao_auditoria s
      where s.transacao = pc.transacao and s.tabela = 'execucao_obras_etapas' and s.registro_id <> pc.pai_id::text
        and s.depois ->> 'etapa_pai_id' = pc.pai_id::text and s.depois ->> 'status' = 'concluida'
        and coalesce(s.antes ->> 'status', '') <> 'concluida') as subs_concluidas_na_tx,
    (select count(*) from public.execucao_auditoria x
      where x.transacao = pc.transacao and x.tabela = 'execucao_atividades' and x.depois ->> 'status' = 'concluida'
        and coalesce(x.antes ->> 'status', '') <> 'concluida' and x.depois ->> 'etapa_id' = pc.pai_id::text) as atv_do_pai_na_tx,
    (select count(*) from public.execucao_auditoria x
      where x.transacao = pc.transacao and x.tabela = 'execucao_atividades' and x.depois ->> 'status' = 'concluida'
        and coalesce(x.antes ->> 'status', '') <> 'concluida'
        and (x.depois ->> 'etapa_id')::uuid in (select e.id from public.execucao_obras_etapas e where e.etapa_pai_id = pc.pai_id)) as atv_de_sub_na_tx,
    (select count(*) from public.execucao_auditoria x
      where x.transacao = pc.transacao and x.tabela = 'execucao_atividades'
        and x.antes ->> 'etapa_id' is null and x.depois ->> 'etapa_id' is not null) as atv_vinculada_por_nome_na_tx
    from pai_conc pc
)
select o.nome_cliente, o.status as obra_status, o.id as obra_id,
       e.id as pai_id, e.nome as pai, e.status as pai_status_atual,
       ev.concluida_em, u.nome_completo as quem, ev.transacao,
       ev.atv_do_pai_na_tx, ev.subs_concluidas_na_tx, ev.atv_de_sub_na_tx, ev.atv_vinculada_por_nome_na_tx,
       (select count(*) from public.execucao_obras_etapas f where f.etapa_pai_id = e.id and f.status <> 'cancelada') as subs_total,
       (select count(*) from public.execucao_obras_etapas f where f.etapa_pai_id = e.id and f.status not in ('concluida', 'cancelada')) as subs_abertas_hoje,
       case when ev.atv_vinculada_por_nome_na_tx > 0 then '(iii) vínculo por nome/cliente'
            when ev.atv_do_pai_na_tx > 0 then '(i) atividade do próprio pai concluída (cascata nas sub-etapas)'
            when ev.atv_de_sub_na_tx > 0 then '(ii) atividade de sub-etapa concluída → sincronizar_etapa_pai'
            when ev.contexto is not null then 'outro: contexto = ' || ev.contexto
            else 'manual/UI (nenhuma atividade concluída na mesma transação)' end as caminho
  from ev
  join public.execucao_obras_etapas e on e.id = ev.pai_id
  join public.execucao_obras o on o.id = e.obra_id
  left join public.usuarios u on u.id = ev.usuario_id
 order by ev.concluida_em desc;

-- (4b) Evidência detalhada de UM caso: troque <TRANSACAO> pelo valor da coluna `transacao` acima.
-- select a.id, a.created_at, a.tabela, a.operacao, a.registro_id, a.campos_alterados,
--        a.antes ->> 'status' as status_antes, a.depois ->> 'status' as status_depois,
--        a.depois ->> 'nome' as nome, a.depois ->> 'titulo' as titulo, a.depois ->> 'etapa_id' as etapa_id,
--        a.depois ->> 'etapa_pai_id' as etapa_pai_id
--   from public.execucao_auditoria a where a.transacao = <TRANSACAO> order by a.id;

-- (4c) Histórico das atividades concluídas no instante da conclusão do pai (±2 min): troque <PAI_ID>.
-- select a.id as atividade_id, a.titulo, a.etapa_id, h.tipo_acao, h.descricao, h.valor_anterior, h.valor_novo, h.created_at, u.nome_completo
--   from public.execucao_atividades a
--   join public.execucao_atividades_historico h on h.atividade_id = a.id and h.tipo_acao = 'conclusao'
--   left join public.usuarios u on u.id = h.usuario_id
--  where a.etapa_id = '<PAI_ID>' or a.etapa_id in (select id from public.execucao_obras_etapas where etapa_pai_id = '<PAI_ID>')
--  order by h.created_at desc;


-- ---------------------------------------------------------------------------------------------------
-- (5) Pais `concluida` com sub-etapa não concluída (ignora canceladas): CONTAGEM + LISTA (obra/cliente) para a futura correção.
--     Complemento: pais concluídos com atividade própria ainda aberta (também indevido pelo R14).
--     A correção NÃO está aqui: ver supabase/manutencao/corrigir_etapas_pai_concluidas.sql.
-- ---------------------------------------------------------------------------------------------------
-- (5a) contagem por situação da obra
select o.status as obra_status,
       count(distinct p.id) as pais_com_sub_aberta,
       count(*) as subs_abertas
  from public.execucao_obras_etapas p
  join public.execucao_obras_etapas s on s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada')
  join public.execucao_obras o on o.id = p.obra_id
 where p.status = 'concluida' and p.etapa_pai_id is null
 group by o.status
 order by 1;

-- (5b) lista (ids/obras/clientes)
select o.id as obra_id, o.nome_cliente, o.status as obra_status,
       p.id as pai_id, p.nome as pai, p.data_inicio, p.data_fim, p.data_fim_real, p.progresso,
       count(*) as subs_abertas,
       string_agg(s.nome || ' [' || s.status || ']', ' | ' order by s.ordem) as subs
  from public.execucao_obras_etapas p
  join public.execucao_obras_etapas s on s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada')
  join public.execucao_obras o on o.id = p.obra_id
 where p.status = 'concluida' and p.etapa_pai_id is null
 group by o.id, o.nome_cliente, o.status, p.id, p.nome, p.data_inicio, p.data_fim, p.data_fim_real, p.progresso
 order by o.nome_cliente, p.ordem;

-- (5c) pais concluídos com atividade própria aberta (pendente/em_andamento/pausada)
select o.id as obra_id, o.nome_cliente, o.status as obra_status, p.id as pai_id, p.nome as pai,
       count(*) as atividades_abertas
  from public.execucao_obras_etapas p
  join public.execucao_atividades a on a.etapa_id = p.id and a.status in ('pendente', 'em_andamento', 'pausada')
  join public.execucao_obras o on o.id = p.obra_id
 where p.status = 'concluida'
 group by o.id, o.nome_cliente, o.status, p.id, p.nome
 order by o.nome_cliente;


-- ---------------------------------------------------------------------------------------------------
-- (6) Notificações de replanejamento: contagem e amostra com destinatário
-- ---------------------------------------------------------------------------------------------------
select count(*) as total,
       count(*) filter (where destinatario_id is not null) as com_destinatario,
       count(*) filter (where destinatario_id is not null and not lida) as com_destinatario_nao_lidas
  from public.execucao_notificacoes
 where tipo = 'replanejamento';

select n.id, n.created_at, n.lida, n.destinatario_id, u.nome_completo as destinatario, n.atividade_id, n.titulo, left(n.mensagem, 80) as mensagem
  from public.execucao_notificacoes n
  left join public.usuarios u on u.id = n.destinatario_id
 where n.tipo = 'replanejamento' and n.destinatario_id is not null
 order by n.created_at desc
 limit 20;


-- =====================================================================================================
-- CONFERÊNCIAS EXTRAS (úteis antes de aplicar as migrations 19–26)
-- =====================================================================================================

-- (7) CHECKs que as migrations 19 e 25 recriam (confirmar que a lista atual é subconjunto da nova)
select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid) as definicao
  from pg_constraint
 where conname in ('execucao_atividades_historico_tipo_acao_check', 'execucao_notificacoes_tipo_check',
                   'execucao_obras_etapas_status_check', 'execucao_atividades_status_check');

-- (8) Valores de tipo_acao já gravados no histórico (todos devem estar na lista nova da mig. 19)
select tipo_acao, count(*) from public.execucao_atividades_historico group by 1 order by 2 desc;

-- (9) Colunas das migrations novas já existentes? (detecta aplicação parcial)
select table_name, column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'execucao_atividades' and column_name in ('observacao_conclusao', 'conclusao_latitude', 'conclusao_longitude',
          'conclusao_precisao_m', 'conclusao_geo_status', 'conclusao_registrada_em', 'conclusao_origem_horario', 'horas_origem'))
     or (table_name = 'execucao_pedidos_material' and column_name in ('status_compra', 'comprador_id', 'status_compra_em', 'comprado_em',
          'status_compra_anterior', 'fila_compras_em', 'etapa_chegada_id')))
 order by 1, 2;

-- (10) Nível/página de Compras e permissões atuais (nomes reais em niveis_acesso/paginas)
select 'nivel' as tipo, nome, descricao from public.niveis_acesso order by nome;
select 'pagina' as tipo, nome, rota from public.paginas where rota like 'execucao%' order by rota;

-- (11) Policies de execucao_pedidos_material / execucao_historico_pedidos / execucao_notificacoes
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename in ('execucao_pedidos_material', 'execucao_historico_pedidos', 'execucao_notificacoes')
 order by tablename, policyname;

-- (12) Itens de pedidos sem id (antes da mig. 23) e distribuição de status legado (base do backfill da mig. 24)
select count(*) filter (where exists (select 1 from jsonb_array_elements(itens) e where jsonb_typeof(e) = 'object' and coalesce(e ->> 'id', '') = '')) as pedidos_com_item_sem_id,
       count(*) as total
  from public.execucao_pedidos_material where jsonb_typeof(itens) = 'array';
select status, count(*) as pedidos,
       count(*) filter (where atividade_id is not null) as com_atividade,
       count(*) filter (where jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) > 0) as com_itens
  from public.execucao_pedidos_material group by 1 order by 2 desc;

-- (13) Hipótese N1-h: sub-etapas que têm atividade PRÓPRIA (convivem com o modelo novo; podem contar horas em duplicidade na capacidade)
select count(distinct s.id) as subetapas_com_atividade_propria, count(a.id) as atividades
  from public.execucao_obras_etapas s
  join public.execucao_atividades a on a.etapa_id = s.id
 where s.etapa_pai_id is not null and a.status <> 'cancelada';

-- (14) Policies de public.usuarios (COMPRAS não deve depender delas: nomes vêm das RPCs; mas o sino de notificações embute
--      usuario_origem:usuarios!usuario_origem_id(...); se o RLS bloquear, o nome de origem vem nulo para COMPRAS)
select policyname, cmd, roles, qual from pg_policies where schemaname = 'public' and tablename = 'usuarios' order by policyname;

-- (15) Advisors não são SQL: rodar no painel (Database > Advisors) ou via MCP get_advisors depois de aplicar as migrations.
