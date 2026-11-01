-- =====================================================================================================
-- CORREÇÃO DE DADOS (N1-i · R14): reabrir etapas PAI concluídas indevidamente.
-- NÃO é migration. Rodar manualmente no SQL Editor, FORA do horário comercial, DEPOIS de:
--   (a) aplicar 20261101_19_execucao_subetapas_conclusao.sql (usa execucao_recalcular_etapa_pai);
--   (b) o Negócio aprovar a lista do PASSO 1 (obra/cliente, etapa, datas e quem concluiu).
-- Regras (Negócio, §3.1.1 C):
--   * só reabre PAI (etapa_pai_id nulo) com status 'concluida' e sub-etapa NÃO concluída/cancelada (motivo 'sub_etapa_pendente'),
--     ou com atividade PRÓPRIA aberta (motivo 'atividade_propria_aberta', também indevido pelo R14);
--   * NUNCA reabre se a obra estiver 'concluida' ou 'cancelada' (essas ficam só no relatório do PASSO 2);
--   * limpa data_fim_real só da etapa reaberta (execucao_recalcular_etapa_pai: status 'em_andamento', progresso ≤ 99);
--   * não notifica técnicos (não escreve em execucao_notificacoes);
--   * registra "Etapa reaberta por correção" no histórico das atividades da etapa e deixa execucao_auditoria marcada com
--     contexto 'correcao-etapas-pai-N1-i' (execucao.contexto), o que permite desfazer (PASSO 5).
-- Falso positivo: sub-etapas fechadas em cascata pela mig. 16 ficam 'concluida' e NÃO entram na lista (só entram as realmente abertas).
-- =====================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- PASSO 1 (DRY-RUN, só SELECT): candidatos a reabrir, com obra/cliente, datas e quem concluiu o pai
-- ---------------------------------------------------------------------------------------------------
with cand as (
  select p.id as pai_id, 'sub_etapa_pendente'::text as motivo
    from public.execucao_obras_etapas p
   where p.status = 'concluida' and p.etapa_pai_id is null
     and exists (select 1 from public.execucao_obras_etapas s
                  where s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada'))
  union
  select p.id, 'atividade_propria_aberta'
    from public.execucao_obras_etapas p
   where p.status = 'concluida' and p.etapa_pai_id is null
     and exists (select 1 from public.execucao_atividades a
                  where a.etapa_id = p.id and a.status in ('pendente', 'em_andamento', 'pausada'))
), quem as (  -- último UPDATE que levou o pai a 'concluida' (auditoria guarda 365 dias)
  select distinct on (a.registro_id) a.registro_id::uuid as pai_id, a.created_at as concluida_em, a.usuario_id
    from public.execucao_auditoria a
   where a.tabela = 'execucao_obras_etapas' and a.operacao = 'UPDATE'
     and a.depois ->> 'status' = 'concluida' and coalesce(a.antes ->> 'status', '') <> 'concluida'
   order by a.registro_id, a.id desc
)
select o.id as obra_id, o.nome_cliente, o.status as obra_status,
       case when o.status in ('concluida', 'cancelada') then 'FORA (obra ' || o.status || ')' else 'REABRIR' end as acao,
       p.id as pai_id, p.nome as pai, p.data_inicio, p.data_fim, p.data_fim_real, p.progresso,
       string_agg(distinct c.motivo, ', ') as motivos,
       (select string_agg(s.nome || ' [' || s.status || ']', ' | ' order by s.ordem)
          from public.execucao_obras_etapas s where s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada')) as subs_abertas,
       (select count(*) from public.execucao_atividades a where a.etapa_id = p.id and a.status in ('pendente', 'em_andamento', 'pausada')) as atividades_proprias_abertas,
       q.concluida_em, u.nome_completo as concluida_por
  from cand c
  join public.execucao_obras_etapas p on p.id = c.pai_id
  join public.execucao_obras o on o.id = p.obra_id
  left join quem q on q.pai_id = p.id
  left join public.usuarios u on u.id = q.usuario_id
 group by o.id, o.nome_cliente, o.status, p.id, p.nome, p.data_inicio, p.data_fim, p.data_fim_real, p.progresso, q.concluida_em, u.nome_completo
 order by (o.status in ('concluida', 'cancelada')), o.nome_cliente, p.ordem;

-- ---------------------------------------------------------------------------------------------------
-- PASSO 2 (resumo do que NÃO será tocado): pais indevidos em obras concluídas/canceladas → decisão P4 do Negócio
-- ---------------------------------------------------------------------------------------------------
select o.status as obra_status, count(distinct p.id) as pais_nao_corrigidos
  from public.execucao_obras_etapas p
  join public.execucao_obras o on o.id = p.obra_id
 where p.status = 'concluida' and p.etapa_pai_id is null and o.status in ('concluida', 'cancelada')
   and (exists (select 1 from public.execucao_obras_etapas s where s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada'))
     or exists (select 1 from public.execucao_atividades a where a.etapa_id = p.id and a.status in ('pendente', 'em_andamento', 'pausada')))
 group by 1;

-- ---------------------------------------------------------------------------------------------------
-- PASSO 3 (APLICAÇÃO): descomentar o bloco, conferir a contagem do RETURNING e só então trocar ROLLBACK por COMMIT.
--   Reexecutar o PASSO 1 antes (a lista pode ter mudado desde a aprovação). Para restringir a ids aprovados, edite `aprovados`.
-- ---------------------------------------------------------------------------------------------------
-- BEGIN;
-- select set_config('execucao.contexto', 'correcao-etapas-pai-N1-i', true);   -- marca a auditoria (desfazer pelo PASSO 5)
--
-- create temp table _alvo on commit drop as
-- select p.id as pai_id, p.obra_id
--   from public.execucao_obras_etapas p
--   join public.execucao_obras o on o.id = p.obra_id
--  where p.status = 'concluida' and p.etapa_pai_id is null
--    and o.status not in ('concluida', 'cancelada')                       -- NUNCA obra concluída/cancelada
--    and (exists (select 1 from public.execucao_obras_etapas s where s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada'))
--      or exists (select 1 from public.execucao_atividades a where a.etapa_id = p.id and a.status in ('pendente', 'em_andamento', 'pausada')))
--    -- and p.id in ('<pai_id aprovado 1>', '<pai_id aprovado 2>')         -- opcional: só os ids aprovados
-- ;
--
-- select count(*) as pais_a_reabrir from _alvo;                          -- conferir contra o PASSO 1
--
-- -- registra no histórico das atividades da etapa (sem notificação)
-- insert into public.execucao_atividades_historico (atividade_id, usuario_id, tipo_acao, descricao)
-- select a.id, null, 'reabertura', 'Etapa reaberta por correção (sub-etapa ou atividade própria ainda aberta)'
--   from _alvo t join public.execucao_atividades a on a.etapa_id = t.pai_id;
--
-- -- reabre: a função recalcula status (em_andamento), progresso (≤ 99) e limpa data_fim_real SÓ da etapa reaberta
-- select public.execucao_recalcular_etapa_pai(pai_id) from _alvo;
--
-- -- confere o resultado antes de confirmar
-- select p.id, p.nome, p.status, p.progresso, p.data_fim_real
--   from public.execucao_obras_etapas p join _alvo t on t.pai_id = p.id order by p.nome;
--
-- ROLLBACK;   -- trocar por COMMIT; depois de conferir
--
-- A obra NÃO é reaberta nem rebaixada (execucao_recalcular_progresso_obra é "sticky"); o progresso da obra só é recalculado
-- na próxima ação normal. Se quiser recalcular já: select public.execucao_recalcular_progresso_obra(obra_id) from _alvo;  (antes do COMMIT)

-- ---------------------------------------------------------------------------------------------------
-- PASSO 4 (conferência pós-correção): não deve restar candidato em obra aberta
-- ---------------------------------------------------------------------------------------------------
-- select count(*) from public.execucao_obras_etapas p join public.execucao_obras o on o.id = p.obra_id
--  where p.status = 'concluida' and p.etapa_pai_id is null and o.status not in ('concluida', 'cancelada')
--    and exists (select 1 from public.execucao_obras_etapas s where s.etapa_pai_id = p.id and s.status not in ('concluida', 'cancelada'));

-- ---------------------------------------------------------------------------------------------------
-- PASSO 5 (ROLLBACK DOS DADOS): estado anterior de cada etapa reaberta, salvo na auditoria com o contexto acima.
--   Prévia (SELECT):
-- select a.registro_id as etapa_id, a.antes ->> 'status' as status_antes, a.antes ->> 'progresso' as progresso_antes,
--        a.antes ->> 'data_fim_real' as data_fim_real_antes, a.created_at
--   from public.execucao_auditoria a
--  where a.tabela = 'execucao_obras_etapas' and a.contexto = 'correcao-etapas-pai-N1-i' and a.operacao = 'UPDATE' and a.desfeito_em is null
--  order by a.id;
--   Reversão por etapa (sem notificar): UPDATE public.execucao_obras_etapas SET status = '<status_antes>',
--     progresso = <progresso_antes>, data_fim_real = '<data_fim_real_antes>' WHERE id = '<etapa_id>';
--   Ou pelo app (Histórico de alterações → desfazer), que usa execucao_desfazer (mig. 07).
