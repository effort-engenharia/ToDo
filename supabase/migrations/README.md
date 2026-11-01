# Migrations do módulo Execução

Arquivos `YYYYMMDD_NN_tema.sql`, aplicados **em ordem numérica**. Cada migration traz no topo o objetivo, as dependências e um bloco `-- ROLLBACK:`.
Detalhes e contratos: `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md` (Anexo F).

## Lote 20261101 (19 a 31): **APLICADO em 2026-11-01** (via MCP do Supabase)

| Ordem | Arquivo | Resumo |
|------:|---------|--------|
| 0 | `../manutencao/diagnostico_B0.sql` | Só SELECT. Rodar antes e registrar no Anexo A do plano. Anotar o `allowed_mime_types` do bucket. |
| 1 | `20261101_19_execucao_subetapas_conclusao.sql` | Etapa pai só conclui com todas as sub-etapas e atividades próprias; passos marcáveis (`execucao_marcar_passo`). |
| 2 | `20261101_20_execucao_conclusao_tecnico.sql` | Observação, horário no servidor, geolocalização, horas calculadas. **Aplicar logo após a 19 (mesma janela).** |
| 3 | `20261101_21_execucao_sem_notif_replanejamento.sql` | `deslocar_etapas` não notifica técnicos. |
| 4 | `20261101_22_execucao_evidencias_midia.sql` | Bucket `atividades-evidencias` aceita vídeo/áudio. |
| 5 | `20261101_23_pedidos_itens_id.sql` | `id` estável por item do pedido. |
| 6 | `20261101_24_compras_base.sql` | Nível `COMPRAS`, `status_compra`, RLS de leitura. |
| 7 | `20261101_25_compras_questionamentos.sql` | Questionamentos e RPCs de Compras. |
| 8 | `20261101_26_compras_painel.sql` | `compras_listar_pedidos` e `compras_indicadores`. |
| 8b | `20261101_27_execucao_indicadores_horas_corte.sql` | Indicadores e calibração de horas só com `horas_origem IS NOT NULL` (data de corte); chave nova `conclusoes_sem_localizacao`. **Depende da 20; pode ir junto dela ou depois, nunca antes.** |
| 8c | `20261101_28_compras_pops_nomes.sql` | COMPRAS lê POPs (sem escrita); RPCs `compras_listar_questionamentos` e `compras_detalhe_pedido` com nomes resolvidos. Depende da 24, 25 e 26. |
| 8d | `20261101_29_execucao_indice_etapa_pai.sql` | Índice parcial `execucao_obras_etapas(etapa_pai_id)` (P1). Independente; pode ir antes ou junto da 19. |
| 8e | `20261101_30_execucao_passos_pendentes.sql` | RPC leve `execucao_passos_pendentes_por_etapa(p_obras)`: contadores de passos/atividades abertas por etapa pai (alerta "passos pendentes" do Planejamento sem embutir atividades). Sem coluna nova; só faz sentido depois da 19. Usa o índice da 29. |
| 8f | `20261101_31_execucao_ajustes_pos_aplicacao.sql` | Correções pós-aplicação: teto diário das horas = só a jornada líquida; policies de pedidos/histórico sem duplicidade de SELECT. Depende da 20 e da 24. |
| 9 | `../manutencao/corrigir_etapas_pai_concluidas.sql` | **Não é migration.** Reabre etapas pai indevidas (dry-run → aprovação → UPDATE manual). |

Dependências: 31 → 20 e 24; 20 → 19; 27 → 20; 24 → 23; 25 → 24; 26 → 25; 28 → 24, 25 e 26; 30 → (sem dependência técnica; recomendada após 19 e 29). As migrations 21, 22 e 23 são independentes das demais.

**Atenção: não reaplicar a 19 depois da 20.** A 19 recria `alterar_status_atividade` com 8 parâmetros; com a 20 já aplicada isso cria um segundo overload e o PostgREST passa a acusar chamada ambígua. Se acontecer, remover a versão antiga: `DROP FUNCTION public.alterar_status_atividade(uuid, text, text, timestamptz, uuid, text, boolean, numeric);`

## Registro de aplicação (2026-11-01)

Versões em `supabase_migrations.schema_migrations` (nomes gravados pelo `apply_migration`): `execucao_29_indice_etapa_pai`, `execucao_19_subetapas_conclusao` (orquestrador), `execucao_20_conclusao_tecnico`, `execucao_27_indicadores_horas_corte`, `execucao_21_sem_notif_replanejamento`, `execucao_22_evidencias_midia`, `execucao_23_pedidos_itens_id`, `execucao_24_compras_base`, `execucao_25_compras_questionamentos`, `execucao_26_compras_painel`, `execucao_30_passos_pendentes`, `execucao_28_compras_pops_nomes`, `execucao_31_ajustes_pos_aplicacao`. Nas versões gravadas no banco os cabeçalhos de comentário (objetivo e `-- ROLLBACK:`) foram omitidos; **os arquivos deste diretório são a fonte** e têm o cabeçalho completo. A correção de dados (`../manutencao/corrigir_etapas_pai_concluidas.sql`) **não precisou rodar** (B0: nenhuma etapa pai indevida). A migration 28 foi aplicada depois da 30 (uma tentativa em paralelo colidiu na versão e foi desfeita pelo banco).

## Depois de aplicar (feito em 2026-11-01)

1. Advisors do Supabase (security e performance) e correção dos alertas relevantes.
2. Regenerar o snapshot `supabase/schema/` (procedimento em `supabase/schema/README.md`) e `npm run graph:update`.
3. `npm run check:contract` e `npm run lint`.
4. Cenários do §7.2 (técnico) e §7.3 (Compras) do plano, sempre em transação com `ROLLBACK` quando forem só de SQL.

## Observações

- As migrations usam `CREATE OR REPLACE`, `IF NOT EXISTS` e `DROP ... IF EXISTS`, então reaplicar é seguro, com duas exceções: o `UPDATE` de limpeza da 21 e o backfill da 24 só alteram linhas ainda não tratadas.
- O CHECK de `execucao_atividades_historico.tipo_acao` (19) é criado `NOT VALID`.
- A numeração 19–31 segue o plano; as anteriores (`20261022_*`, `20261023_01` a `_18`) devem estar aplicadas (conferir com `list_migrations` ou no painel antes de começar em outro ambiente).
