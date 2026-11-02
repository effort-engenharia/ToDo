# Dashboard Comercial

Dashboard comercial em React + Vite + Tailwind, com backend no Supabase. Inclui o módulo **Execução** (obras, equipe de campo, pedidos de material e Dashboard de Compras).

## 🚀 Como executar

```bash
npm install
npm run dev              # desenvolvimento
npm run build            # build de produção
npm run lint             # ESLint
npm run check:contract   # contrato entre services e componentes
npm run test:unit        # testes unitários dos helpers (node:test, sem dependência extra)
npm run graph:update     # atualiza o grafo do graphify e os vínculos com o banco
```

**Variáveis de ambiente (Vite):** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são **obrigatórias no build do Netlify**. A página pública de cotação (`/cotacao/`) chama o Supabase direto, sem o app autenticado; sem essas variáveis, o link do fornecedor não funciona. Não colocar `service_role` nem segredos em variáveis `VITE_*`, porque elas vão para o bundle.

## 📊 Módulos

| Módulo | Descrição |
|--------|-----------|
| Dashboard Comercial | Métricas, funil, metas e gráficos. Contexto em [`DASHBOARD_COMERCIAL_CONTEXTO.md`](DASHBOARD_COMERCIAL_CONTEXTO.md) |
| Apontamentos | Cadastro e acompanhamento de oportunidades |
| Arsenal de Guerra | Links úteis e tabela de administradoras |
| Execução | Planejamento de obras, técnico em campo, POPs, pedidos de material, Dashboard de Compras, fornecedores e cotação (esta última teve as migrations 33–40 aplicadas em 2026-11-02, UTC; noite de 2026-11-01 em Brasília; faltam snapshot e Netlify; _texto original, obsoleto: "aguarda as migrations 34–39"_). Perfis: `ADMIN_EXECUCAO`, `TECNICO` e `COMPRAS` |

## 🏗️ Execução

**Planejamento Macro:** obras, etapas e sub-etapas, Gantt e visões (semana, mês, ano, linha do tempo e tabela). No celular, as etapas aparecem em lista e os filtros ficam em uma gaveta.

**Técnico (Meu Dia):**
- Atividades do dia. As concluídas ficam recolhidas em "Concluídas hoje".
- Iniciar, pausar, concluir e registrar falta de material.
- Evidências por foto, vídeo (até 60 s) e áudio (até 180 s), com fila offline.
- Replanejamento não gera notificação para o técnico (após a migration 21).

**Conclusão de atividade:**
- Observação opcional (até 1.000 caracteres) e passos da etapa marcáveis.
- Horário e localização são registrados **no momento da conclusão**. Não há campo de horas: após a migration 20, as horas são calculadas pelo histórico.
- Se o técnico negar a localização, a conclusão segue e o status fica registrado.
- Etapa pai só conclui quando todas as sub-etapas e atividades próprias estão concluídas (após a migration 19).

**Privacidade da localização:** a localização é coletada só ao concluir a atividade, com tempo limite curto, e o técnico vê um aviso na tela. Finalidade e ciência do técnico dependem de decisão (pendência P9 do plano).

**POPs:** descrição e procedimento são formatados (parágrafos e listas), tanto na gestão quanto no técnico.

**Pedido de material:**
- Cliente informado no pedido e quantidade inteira para unidades como `un`, `cx` e `pct`.
- Histórico com diff dos itens (adicionados, removidos e alterados) e filtro de período.
- Questionamento da Compras: o solicitante aprova ou reprova a sugestão, com observação.

**Dashboard de Compras** (nível `COMPRAS`, página `execucao/compras`): fila por status de compra (kanban em telas largas, abas no celular), indicadores, questionamentos e detalhe do pedido. O perfil COMPRAS não lê obras, atividades nem agenda; os dados chegam por RPCs `compras_*`.

## 🛒 Compras: fornecedores e cotação

> **Estado:** front implementado. As RPCs de cotação existem no banco desde a aplicação das migrations **33 a 40**, em **2026-11-02** (UTC; noite de 2026-11-01 em Brasília). Pendentes: regenerar `supabase/schema/` e definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Netlify (a página pública exige). _(Texto original, obsoleto: "só existem no banco depois da aplicação das migrations **34 a 39**, que **ainda não foram aplicadas**.")_ Plano e pendências: [`PLANO_COTACAO_FORNECEDORES.md`](PLANO_COTACAO_FORNECEDORES.md) (*Status consolidado*).

- **Fornecedores** (perfis COMPRAS e Administrador): cadastro de empresa, contato e WhatsApp, gravado como `55DDDNÚMERO`. Mesmo WhatsApp com a mesma empresa é bloqueado. Fornecedor com convite ou compra só pode ser inativado. O Administrador anonimiza (LGPD) e o histórico continua íntegro.
- **Cotação:** a atendente seleciona um ou mais pedidos. Itens iguais de listas diferentes são somados, com a composição por pedido guardada. Escolhe os fornecedores e o prazo (padrão 48 h, prorrogável) e envia **um link por fornecedor** pelo WhatsApp (`wa.me`). O clique marca "enviado"; não há confirmação de entrega.
- **Página pública do fornecedor:** `/cotacao/#<token>` (ex.: `https://effort-dashboard.netlify.app/cotacao/#<token>`). Não exige login. O token fica só no fragmento da URL e no banco só o hash é gravado. O fornecedor informa preço por item (ou indisponibilidade), condições à vista e parcelada, frete, prazo de entrega e observações. Pode reenviar até o prazo; cada envio gera uma versão.
- **Comparativo e decisão:** valor presente (taxa configurável, 1,5% a.m. por padrão), frete, propostas parciais, empate técnico (diferença menor que 1%) e compra dividida com a economia. A recomendação é só sugestão. Escolher fora dela exige justificativa.
- **Histórico de preços:** catálogo de materiais com referência (média dos últimos 6 meses), última e menor compra, variação em R$ e %, e alerta acima de +10%. Visível só para COMPRAS e Administrador.
- **Alterações da atendente nas listas:** redução de quantidade e remoção pedem só ciência do solicitante. Aumento de quantidade, substituição e inclusão pedem aceite. Tudo fica registrado no histórico do pedido. O solicitante vê a empresa vencedora, nunca os preços.
- **Alerta de 24 h úteis** sem resposta do solicitante para a atendente e o gestor. Nunca aprova por silêncio.

### Como aplicar o lote 33–40 (concluído em 2026-11-02, UTC; noite de 2026-11-01 em Brasília; mantido como referência para outros ambientes)

_A 33 foi aplicada antes da 34 e a 40 por último. Registro de versões em [`supabase/migrations/README.md`](supabase/migrations/README.md). Títulos e passos abaixo são o roteiro original._

1. Confirmar que as migrations 32 e 33 estão aplicadas.
2. Rodar [`supabase/manutencao/diagnostico_cotacao_B00.sql`](supabase/manutencao/diagnostico_cotacao_B00.sql) bloco a bloco no SQL Editor. É só leitura, exceto o item 4, que cria e remove uma função temporária. Registrar o resultado no Anexo A do plano. O item 4 confirma se `cf-connecting-ip` chega na chamada anon.
3. Aplicar nesta ordem: `20261102_34`, `_35`, `_36`, `_37`; depois `_38` e `_39`. Dependências e rollback em [`supabase/migrations/README.md`](supabase/migrations/README.md).
4. Depois: advisors de segurança e performance; regenerar `supabase/schema/`; `npm run graph:update`; `npm run check:contract`; `npm run lint`.
5. Testes do §15 do plano antes de liberar o link ao fornecedor.

## 🗄️ Banco: migrations e manutenção

As migrations ficam em `supabase/migrations/` e são aplicadas em ordem numérica, pelo SQL Editor do Supabase (ou pelo MCP, se disponível). Cada arquivo traz `-- ROLLBACK:` no topo.

> **Estado atual (2026-11-01):** as migrations `20261101_19` a `_31` estão **aplicadas** no Supabase (a 29 e a 19 pelo orquestrador; as demais pelo Backend, via MCP) e o snapshot `supabase/schema/` foi regenerado. Resultados e testes de fumaça no Anexo A e na seção F.10 do plano.
>
> **Lote `20261102` (33 a 40): aplicado em 2026-11-02** (UTC; noite de 2026-11-01 em Brasília) no Supabase de produção (via MCP), com testes de permissão e do link público e advisors sem ERRO novo (avisos esperados descritos no Anexo A do [`PLANO_COTACAO_FORNECEDORES.md`](PLANO_COTACAO_FORNECEDORES.md)). Falta regenerar `supabase/schema/` e definir `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no Netlify. Ordem, versões gravadas e dependências em [`supabase/migrations/README.md`](supabase/migrations/README.md) e na seção Compras acima.

### Como aplicar o lote 19–31 (já aplicado; mantido como referência para outros ambientes)

Ordem que respeita as dependências (detalhes em [`supabase/migrations/README.md`](supabase/migrations/README.md)):

1. `supabase/manutencao/diagnostico_B0.sql` (só leitura; registrar no Anexo A do plano).
2. `20261101_29_execucao_indice_etapa_pai.sql`
3. `20261101_19_execucao_subetapas_conclusao.sql`
4. `20261101_20_execucao_conclusao_tecnico.sql` (mesma janela da 19)
5. `20261101_27_execucao_indicadores_horas_corte.sql`
6. `20261101_21_execucao_sem_notif_replanejamento.sql`
7. `20261101_22_execucao_evidencias_midia.sql` (só se o B0 indicar)
8. `20261101_23_pedidos_itens_id.sql`
9. `20261101_24_compras_base.sql`
10. `20261101_25_compras_questionamentos.sql`
11. `20261101_26_compras_painel.sql`
12. `20261101_28_compras_pops_nomes.sql`
13. `20261101_30_execucao_passos_pendentes.sql`

**Não reaplicar a 19 depois da 20.** Depois de aplicar: advisors de segurança e performance; regenerar o snapshot (ver [`supabase/schema/README.md`](supabase/schema/README.md)); `npm run graph:update`; `npm run check:contract`.

### Scripts em `supabase/manutencao/`

Não são migrations.

- **`diagnostico_B0.sql`**: somente `SELECT`. Rodar bloco a bloco no SQL Editor.
- **`diagnostico_cotacao_B00.sql`**: diagnóstico do lote 33–40 (só leitura, exceto o item 4, que cria e remove uma função temporária). Ver a seção Compras acima.
- **`corrigir_etapas_pai_concluidas.sql`**: correção de dados que reabre etapas pai concluídas indevidamente. Só depois da migration 19 e da aprovação do Negócio, fora do horário comercial. Ordem: PASSO 1 (dry-run, só `SELECT`) → aprovação → PASSO 3 (`UPDATE` com `ROLLBACK` até conferir a contagem) → PASSO 4 (conferência) → PASSO 5 (reversão, se preciso).

## 📚 Documentação

- [`PLANO_MELHORIAS_EXECUCAO_COMPRAS.md`](PLANO_MELHORIAS_EXECUCAO_COMPRAS.md): plano, status consolidado e checklist.
- [`supabase/migrations/README.md`](supabase/migrations/README.md): ordem e dependências das migrations.
- [`supabase/schema/README.md`](supabase/schema/README.md): snapshot do schema e como regenerar.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md): estrutura do projeto e convenções.
