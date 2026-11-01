# Plano de Implementação: Melhorias do Dashboard Execução + Dashboard do Setor de Compras

> **Data:** 01/11/2026
> **Projeto:** Dashboard Comercial → Módulo Execução (+ nova página Compras)
> **Autor:** Arquiteto
> **Status:** 🟢 Front implementado; migrations 19–31 **APLICADAS** no banco em 01/11/2026 e testadas por fumaça em transação com ROLLBACK (ver *Status consolidado* e Anexo F.10)
> **Base investigada:** `src/features/execucao/**`, `src/services/supabase/execucao*.js`, `supabase/migrations/20261022_01` a `20261023_18`, `supabase/schema/*.sql`

---

## Status consolidado (atualizado em 2026-11-01)

**Pronto no front** (código no repositório; QA sem banco e sem aparelho, ver Anexo E):
- POPs formatadas na gestão e no técnico (F1).
- Pedido de material: cliente, quantidade inteira por unidade, histórico com diff, filtro de período e conversa com a Compras (F2–F5, F17).
- Dashboard de Compras: nível `COMPRAS`, página `execucao/compras`, serviço `execucaoCompras.js` (F14–F16, F18).
- Técnico: observação, horário e localização na conclusão (F8, F12); passos e sub-etapas (F9, F10); Meu Dia sem concluídas (F6); replanejamento sem notificação no app (F7); fallbacks de vídeo/áudio (F11).
- Planejamento Macro responsivo, fatias a–d (F13).

**Aplicado no banco (01/11/2026):** migrations `supabase/migrations/20261101_19` a `_31` (a 29 e a 19 pelo orquestrador; as demais pelo Backend via MCP). O script `corrigir_etapas_pai_concluidas.sql` **não precisou rodar** (B0: nenhuma etapa pai indevida). O `diagnostico_B0.sql` foi executado pelo orquestrador (Anexo A). Snapshot `supabase/schema/` regenerado e `npm run graph:update` rodado. Detalhes, testes de fumaça e advisors no Anexo F.10.

**Checklist do usuário (em ordem):**
- [x] Rodar `supabase/manutencao/diagnostico_B0.sql` no SQL Editor (só `SELECT`, bloco a bloco) e preencher o Anexo A. Anotar o `allowed_mime_types` do bucket `atividades-evidencias` e o limite global de upload no painel.
- [x] Aplicar as migrations na ordem: `29` → `19` → `20` (mesma janela; **não reaplicar a 19 depois da 20**) → `27` → `21` → `22` (só se o B0 indicar) → `23` → `24` → `25` → `26` → `28` → `30`. Depois, advisors de segurança e performance.
- [x] (dispensado: consultas 5b e 5c vazias) Dry-run da correção de etapas pai: rodar só o PASSO 1 de `corrigir_etapas_pai_concluidas.sql` (após a 19), levar a lista ao Negócio (N1-i) e só então o PASSO 3, fora do horário comercial.
- [x] Regenerar o snapshot `supabase/schema/` via MCP (procedimento em `supabase/schema/README.md`) e rodar `npm run graph:update`.
- [ ] QA manual do Anexo E.5 (blocos A a E).
- [ ] Validação visual do Planejamento Macro (Anexo C.5, Q4) em 360, 768, 1024 e 1440 px.
- [ ] Testes de vídeo e áudio em aparelhos reais: Android/Chrome, iOS/Safari e PWA instalado (Anexo B, R10).

**Pendências conhecidas:**
- **P8 (data necessária × previsão):** `data_material_disponivel` é a previsão de chegada; não existe coluna de data necessária. Decisão do Negócio pendente (F.2-11, F.6-1).
- **ACH-09:** o indicador `conclusoes_sem_localizacao` (migration 27) não aparece em nenhuma tela (E.4).
- **Carregamento para o técnico (R6/R2, Anexo G.3):** `useGoogleSheetsData()` roda em `src/App.jsx` para todos os perfis, e o precache do service worker inclui chunks do Comercial. Falta filtrar por perfil.
- Demais achados (ACH-01 a ACH-13) estão no Anexo E.4.

---

## 0. Como usar este documento

- Cada tarefa tem um **ID** (`N*` Negócio, `UX*` UI/UX, `B*` Backend, `F*` Frontend, `P*` Performance, `Q*` QA, `D*` Documentação), o **agente responsável**, os **arquivos/tabelas**, as **dependências** e os **critérios de aceite**.
- As tarefas estão agrupadas em **ondas**. Tarefas da mesma onda sem dependência entre si podem rodar **em paralelo** (ver §10).
- **Gates de Negócio:** onde houver `⛳ Gate N1`, o executor aplica o **default** descrito aqui, a menos que o Especialista Negócio tenha registrado outra decisão na §3.1 (preenchida por ele na Onda 0).
- Migrations novas seguem a numeração existente: `supabase/migrations/20261101_NN_<tema>.sql` (próximo número livre: **19**). Toda migration deve trazer no topo um bloco `-- ROLLBACK:` com o SQL de reversão.
- Depois de qualquer migration: rodar os advisors (security/performance) do Supabase, regenerar o snapshot `supabase/schema/*.sql` (procedimento em `supabase/schema/README.md`) e `npm run graph:update`.
- Contrato dos services: todo método novo retorna `{ success, data?, message? }` e passa em `npm run check:contract`.

---

## 1. Contexto e objetivo

O módulo Execução já cobre o ciclo de obra (planejamento macro → atividades → técnico em campo → evidências). A demanda junta **4 frentes**:

1. **POPs**: o texto aparece formatado na gestão e "corrido" na tela do técnico.
2. **Pedido de material**: melhorias no formulário, histórico detalhado, filtro de data, fluxo de **questionamento comprador ↔ criador da lista** e um **Dashboard do setor de Compras**.
3. **Planejamento Macro**: responsividade e usabilidade em mobile, tablet e desktop.
4. **Área do técnico**: vídeo/áudio com erro, observação + horário + geolocalização na conclusão, sem notificação de replanejamento, bug de sub-etapa concluindo a etapa pai, e "Meu Dia" sem concluídas.

**Objetivo:** entregar tudo em ondas pequenas e reversíveis, sem quebrar o fluxo offline do técnico (fila `outbox` + `id_cliente` idempotente) nem as RLS atuais.

---

## 2. Diagnóstico (achados no código real)

| # | Item | Evidência | Causa provável |
|---|------|-----------|----------------|
| 2.1 | POP sem formatação no técnico | `src/features/execucao/components/POPs.jsx` L474–478: a **Descrição** é renderizada em `<p className="text-slate-200">` **sem** `whitespace-pre-wrap`; o **Procedimento** (L481–487) tem `whitespace-pre-wrap`. O card (L385–386) usa `line-clamp-2`. A gestão "vê formatado" porque abre o modal de edição (`<textarea>`, L605–625), que preserva quebras. O técnico só tem o modal de visualização (`isAdmin=false`, rota `pops` em `ExecucaoDashboard.jsx` L115–116). | Renderização diferente para o mesmo texto; quebras de linha e listas são perdidas na Descrição. Não existe componente único de "texto rico simples". |
| 2.2 | Pedido sem cliente | `PedidoMaterial.jsx` L15–21 (`VALORES_VAZIOS`) e `FormularioPedido.jsx` `salvarPedido` (≈L143–150) não enviam `cliente_nome`. A coluna existe em `execucao_pedidos_material.cliente_nome`. | Campo nunca foi exposto no formulário de pedido avulso. |
| 2.3 | Incremento 1.1/1.01 em "un" | `FormularioPedido.jsx` L505–519 e `TemplatesMateriais.jsx` L428–437: `min="0.1" step="0.1"` fixos para qualquer unidade. `UNIDADES` em `pedido-material/utils.js` não tem metadado de "inteira". | `step` não depende da unidade. |
| 2.4 | Não dá para apagar o "1" | Mesmas linhas: `value={item.quantidade \|\| 1}` e `onChange={... parseFloat(v) \|\| 1}`. | Campo controlado força 1 em cada tecla; vazio vira 1 imediatamente. |
| 2.5 | Histórico sem detalhe de itens | `HistoricoPedido.jsx` L68–80 só mostra "Itens: N → M" e urgência. `dados_anteriores`/`dados_novos` (jsonb) **já guardam a lista completa de itens** (`FormularioPedido.jsx` ≈L155–180). Os itens **não têm id estável**: `_key` é só de UI e é removido em `itensSemKey`. | Falta um diff de itens; falta id persistido por item. |
| 2.6 | Sem filtro de data | `ListaPedidos.jsx` L51–65: só busca e status. `execucaoService.buscarPedidosMaterial` (`execucao.js` L469–493) carrega tudo (`fetchAll`). | Não implementado. |
| 2.7 | Questionamento/Compras | Não existe nível "COMPRAS", nem status de compra, nem tabela de conversa. RLS de `execucao_pedidos_material` e `execucao_historico_pedidos` = **somente** `is_admin_execucao()` (`supabase/schema/logic.sql` L108–109). Técnicos criam pedidos só via RPC `reportar_falta_material` (mig. 05 L457+). | Escopo novo. |
| 2.8 | Planejamento Macro pouco responsivo | `PlanejamentoMacro.jsx` (1.028 linhas) tem 1 classe responsiva; `planejamento/*.jsx` quase nenhuma; `GanttObra.jsx` L22: ações das etapas com `opacity-0 group-hover:opacity-100` (**invisíveis em toque**); `visao.css` usa `white-space: nowrap` em tabelas sem contêiner rolável; `execucao.css` tem só 2 `@media`. | Layout pensado para desktop. |
| 2.9 | Vídeo/áudio com erro | Bucket `atividades-evidencias` criado em mig. 05 L404–411 com `file_size_limit` 50 MB e **sem** `allowed_mime_types` na migration, mas `ON CONFLICT DO UPDATE` **preserva** um `allowed_mime_types` que já existisse (ex.: só `image/*` configurado no painel). Captura: `gravador.js` (`getUserMedia` + `MediaRecorder`), `GravadorVideo.jsx`, `useEvidencias.js` L169–190 (áudio **sem fallback** quando `navigator.mediaDevices`/`MediaRecorder` não existem: vira `TypeError`), `EvidenciasUploader.jsx` L73–77 (vídeo cai no `<input capture>` só se `suportaGravacao()` for falso; falha em tempo de execução não tem fallback). `gravador.js` é carregado por `import()` dinâmico (possível falha "Failed to fetch dynamically imported module" após deploy com SW). | Precisa diagnóstico em aparelho real (Onda 0). Hipóteses em ordem: (a) `allowed_mime_types` do bucket; (b) contexto/permissão (`NotAllowedError`, navegador embutido, PWA iOS antigo, `Permissions-Policy` do host); (c) `MediaRecorder` sem suporte ao mime; (d) chunk dinâmico velho; (e) limite global de upload do projeto (Free = 50 MB). |
| 2.10 | Conclusão sem observação/local/horário fixo | `ModalConcluir.jsx`: só "Horas realizadas" (editável, `CampoHoras`) + evidências. `acoesAtividade.js` L100–102 envia `{ status:'concluida', horasRealizadas }`. RPC `alterar_status_atividade` (mig. 16 L116–243) usa `v_quando := LEAST(COALESCE(p_ocorrido_em, now()), now())` (horário do **aparelho**). Já existe `obterLocalizacao()` em `tecnico/evidencias/carimbo.js` L32–59, com status `ok/negada/tempo_esgotado/indisponivel/nao_suportado`. | Não implementado. |
| 2.11 | Replanejamento notificando técnico | `deslocar_etapas` (versão vigente: mig. 14 L283+, insert em L313; mesma lógica na mig. 10 L32) insere `tipo='replanejamento'` com `destinatario_id` = cada membro da equipe. `MeuDia.jsx` L54 lista não lidas em "Pendências". | Regra explícita no RPC. |
| 2.12 | Sub-etapa concluída concluiu a etapa | 3 caminhos no banco: **(i)** mig. 16 L228–236: concluir a atividade da **etapa pai** conclui **todas** as sub-etapas em cascata; **(ii)** `execucao_sincronizar_etapa_pai` (mig. 14 L4–27) conclui o pai quando todas as sub-etapas não canceladas estão concluídas e **ignora a atividade própria do pai** (pai com 1 sub-etapa conclui junto); **(iii)** mig. 16 L197–204: atividade sem `etapa_id` é ligada por `e.nome = a.titulo AND o.nome_cliente = a.cliente_nome LIMIT 1` (pode cair na etapa errada, inclusive no pai). No front, `PlanejamentoMacro.jsx` L498–515 pré-preenche o responsável da sub-etapa com o do pai, e `sincronizarAtividadeDaEtapa` (L61–100) **cria atividade própria para a sub-etapa**, o que contraria o modelo da mig. 16 ("sub-etapas são passos"). Assim o técnico vê a sub-etapa como atividade separada e também como passo da atividade do pai. | Regra de agregação inconsistente + duplicidade de modelo. O caminho exato do caso relatado é confirmado na B0. |
| 2.13 | Concluídas no "Meu Dia" | `MeuDia.jsx` L104–105: `doDia` inclui concluídas (só ordena para o fim, L27–28) e L247–252 renderiza todas. | Filtro ausente. |

---

## 3. Requisitos e critérios de aceite

| ID | Requisito | Critério de aceite (verificável) |
|----|-----------|----------------------------------|
| R1 | POP com a mesma formatação em gestão e técnico | Um POP com quebras de linha, linhas iniciadas por `-`/`•`/`1.` e linha em branco entre parágrafos aparece com parágrafos, listas e quebras **idênticos** no modal da gestão e no do técnico (360 px e 1440 px). Nenhum HTML do usuário é interpretado (sem `dangerouslySetInnerHTML`). |
| R2 | Cliente no novo pedido | O modal "Novo pedido" tem o campo **Cliente** (com sugestões das obras); o valor é salvo em `cliente_nome` e aparece na lista, no detalhe e no Dashboard de Compras. Obrigatoriedade conforme ⛳ N1 (default: obrigatório para pedido novo). |
| R3 | Quantidade inteira por unidade | Com unidade `un` (e `cx`, `pct`, ⛳ N1), as setas/teclado sobem de **1 em 1** e não aceitam decimal. Ao trocar de `m` para `un`, 2,5 vira 3 (arredonda para cima, ⛳ N1) com aviso discreto. Para `m`, `m²`, `kg`, `L` o passo é 0,1 e aceita 2 casas. Vale para pedido **e** template. |
| R4 | Campo quantidade pode ficar vazio na edição | É possível apagar todo o conteúdo; o campo fica vazio enquanto tem foco. Ao salvar com item preenchido e quantidade vazia/≤0, aparece erro no item e o pedido não é salvo. |
| R5 | Histórico com itens detalhados | Cada edição no histórico mostra: **Adicionados** (nome, qtd, un), **Removidos** e **Alterados** (ex.: "Disjuntor 63A: 2 un → 3 un"; "Cabo 2,5mm → Cabo 4mm"). Funciona também para registros antigos (diff por nome quando não houver id). |
| R6 | Filtro de data do pedido | Lista de pedidos (gestão) e Dashboard de Compras com filtro por **data do pedido** (`created_at`): atalhos Hoje / 7 dias / 30 dias / Mês atual / Personalizado (de–até). Filtro aplicado no servidor. |
| R7 | Questionamento comprador ↔ criador | O comprador abre um questionamento sobre um item (tipos: substituição, quantidade, dúvida) com sugestão opcional (nome/qtd/un). O criador da lista (ou um admin de execução) recebe uma notificação em tempo real e **aprova** ou **reprova** com observação. Aprovar uma substituição/quantidade **altera o item** e grava no histórico. O pedido fica "Aguardando solicitante" enquanto houver questionamento aberto. |
| R8 | Dashboard de Compras | Nova página `#/execucao/compras` acessível aos níveis `ADMIN_EXECUCAO` e `COMPRAS` (o `Administrador` geral só acessa via impersonação), com KPIs, filas por status, lista filtrável, detalhe com itens/histórico/conversa e ações de status. Atualiza em tempo real. Técnico não acessa. |
| R9 | Planejamento Macro responsivo | Em 360, 768, 1024 e 1440 px: sem rolagem horizontal da página (só dentro de contêineres de Gantt/tabela), alvos de toque ≥ 44 px, ações visíveis sem hover, filtros acessíveis, modais em tela cheia no celular. Checklist da UX1 100% aprovado pelo QA. |
| R10 | Vídeo e áudio funcionando | Em Android/Chrome, iOS/Safari (≥ 15) e desktop/Chrome: gravar vídeo (até 60 s) e áudio (até 180 s), salvar na fila e enviar ao Storage com sucesso no plano gratuito. Erros mostram mensagem clara e acionável (permissão, aparelho sem suporte, arquivo grande demais). Com o gravador indisponível, há fallback pela câmera/gravador nativo. |
| R11 | Observação na conclusão | `ModalConcluir` tem "Observação (opcional)" (até 1.000 caracteres), salva em `execucao_atividades.observacao_conclusao`, no histórico e visível para a gestão. |
| R12 | Horário e local automáticos na conclusão | Não existe campo editável de horário. `fim_real_em` = `now()` do servidor quando a ação chega online; se veio da fila offline, usa o instante do clique do aparelho (limitado a ≤ now() e ≥ início). Lat/long/precisão/status da geolocalização do **momento do clique** gravados. Com permissão negada a conclusão **não é bloqueada** (⛳ N1) e fica registrada como `negada`, com aviso ao técnico. O campo "Horas realizadas" sai do modal e as horas passam a ser calculadas no servidor (⛳ N1). |
| R13 | Sem notificação de replanejamento para o técnico | Reprogramar etapas (`deslocar_etapas`) não cria notificação para técnicos. Notificações antigas desse tipo não aparecem no sino nem nas "Pendências" do Meu Dia. Admin continua vendo o que já via. |
| R14 | Etapa só conclui com todas as sub-etapas | Concluir uma sub-etapa (ou o passo de uma atividade) **nunca** conclui a etapa pai se houver outra sub-etapa não concluída e não cancelada, **nem** se a atividade própria do pai estiver aberta. A etapa pai conclui automaticamente quando a última pendência fecha e reabre (`em_andamento`) se algo for reaberto. Dados já afetados são corrigidos (⛳ N1). |
| R15 | Meu Dia sem concluídas | Atividades concluídas não aparecem nas listas "Atrasadas"/"Hoje". Ficam numa seção recolhida "Concluídas hoje (N)", fechada por padrão. O resumo "Concluídas: X de Y" continua. |

### 3.1 Decisões de Negócio (preenchidas pelo Especialista Negócio na N1)

> O executor usa o **default** se a linha estiver vazia.

| # | Pergunta | Default do Arquiteto | Decisão Negócio |
|---|----------|----------------------|-----------------|
| N1-a | Quais unidades são inteiras? | `un`, `cx`, `pct` | Usar default (`un`, `cx`, `pct`). A lista `UNIDADES` em `pedido-material/utils.js` tem `un, m, m², kg, l, cx, pct`, então a regra cobre tudo. `kg`, `L`, `m` e `m²` ficam decimais, porque há compra fracionada de cabo e de líquidos. |
| N1-b | Ao trocar decimal → inteira: arredondar para cima, para baixo ou pedir? | Para cima (`Math.ceil`) + aviso | Usar default (arredondar para cima + aviso). Arredondar para baixo vira falta de material, e a falta pausa a obra. Sobra de compra custa menos. O histórico deve registrar a quantidade original e a ajustada. |
| N1-c | "Cliente" obrigatório no pedido avulso? | Sim | Usar default (obrigatório), com uma exceção a confirmar: opção explícita "Sem cliente (estoque/uso interno)". Os pedidos de obra já nascem com `cliente_nome`. Os pedidos de falta de material herdam o cliente da atividade. Não exigir retroativamente nos pedidos antigos nem bloquear a fila de Compras por isso. Ver pergunta P5. |
| N1-d | Remover "Horas realizadas" do modal do técnico e calcular no servidor? | Sim. Horas = soma dos intervalos em andamento (início/retomada → pausa/conclusão) do histórico; sem início, usa as previstas. Admin ainda pode ajustar na gestão. | **Sim, remover do técnico, com ressalvas (§3.1.1 A).** Só começa depois de a regra de cálculo ser aprovada (P1 e P2). Resumo: o servidor calcula por intervalos de trabalho com teto pela jornada, e usa as previstas quando não houver intervalo. Ajuste do admin marca `horas_ajustadas` e fica registrado no histórico. Cada hora fica com a origem gravada (previstas, intervalos ou ajuste do admin). O histórico anterior não é comparável com o novo. |
| N1-e | Permissão de localização negada bloqueia a conclusão? | Não bloqueia; registra `negada` e mostra aviso | Usar default (não bloqueia, registra `negada` e avisa). Bloquear travaria a conclusão em obra sem sinal ou com permissão negada, e a fila offline não resolve isso. Incluir um indicador "conclusões sem localização" por técnico para a gestão. A localização é coletada só no instante da conclusão, e o técnico deve ser informado da finalidade (P9). |
| N1-f | Observação obrigatória em algum caso? | Não (opcional) | Usar default (opcional). Única exceção sugerida: pedir observação quando a conclusão tiver passos em aberto (N1-g), mas sem bloquear. |
| N1-g | Sub-etapas: o técnico marca cada passo? Concluir a atividade com passos em aberto: o que acontece? | Técnico marca passos no modal de conclusão. Com passos em aberto, a atividade conclui, mas a etapa pai fica `em_andamento` e aparece alerta "passos pendentes" no Planejamento. | **Aprovado com ressalvas (§3.1.1 B).** O técnico marca os passos. A atividade conclui mesmo com passos em aberto, mas **só depois de uma confirmação** ("há N passos não marcados, concluir mesmo assim?"), e o fato fica no histórico. A etapa pai fica `em_andamento` com alerta "passos pendentes". Não bloquear, porque há campo e offline. O Jev ficou abaixo do limiar nesta decisão (0,40 e 0,14), então a confirmação ao dono (P3) vale. |
| N1-h | Sub-etapa com responsável continua gerando atividade própria? | Não para novas (o modelo da mig. 16 vale: passos da atividade do pai). As existentes continuam válidas. | Usar default (novas sub-etapas são passos do pai, sem atividade própria). Ressalvas: (1) sub-etapa com responsável diferente do pai perde a atribuição própria (P10). (2) As existentes, que têm atividade própria, convivem com o modelo novo. A B0 deve verificar se `execucao_capacidade` conta duas vezes as horas do pai (que somam as sub-etapas, conforme `cadastroUtils.js` L177) mais as da atividade própria da sub-etapa. É hipótese, não confirmado. |
| N1-i | Corrigir etapas pai concluídas indevidamente (reabrir)? | Sim, reabrir para `em_andamento` as que têm sub-etapa não concluída, com lista prévia aprovada pelo Negócio | Usar default (reabrir só com lista prévia aprovada), com condições (§3.1.1 C): lista com obra/cliente, etapa, datas e quem concluiu, e simulação antes de aplicar. A obra já `concluida` ou entregue **não** é reaberta automaticamente (P4). Sem notificação a técnicos. |
| N1-j | Status de compra (fluxo) | `aguardando_compra` → `em_cotacao` → (`aguardando_solicitante` automático) → `comprado` → `entregue_parcial`/`entregue`; `cancelado` | **Usar default com ajustes e o diagrama da §3.1.2.** Ajustes: (1) `aguardando_solicitante` é automático e volta ao status anterior ao fechar o último questionamento. (2) Questionamento só até `em_cotacao` (depois de `comprado` não faz sentido). (3) `cancelado` exige motivo e não vale após `entregue`. (4) `entregue_parcial` exige observação do que falta. (5) Mapeamento do status legado na §3.1.2. |
| N1-k | Quem responde questionamento? | Solicitante do pedido **ou** qualquer ADMIN_EXECUCAO/Administrador. Se o solicitante for TECNICO, a notificação vai para os admins (o técnico não responde na v1). | Usar default. Ressalvas: (1) pedido de falta de material do técnico não tem itens (é texto livre, `reportar_falta_material`). Quem responde é o admin, que deve registrar "confirmado com o técnico". Na v2, deixar o técnico responder pelo Meu Dia. (2) Em substituição técnica (ex.: Disjuntor 63A por 50A), a aprovação deve ser de perfil técnico (`ADMIN_EXECUCAO`), não de qualquer solicitante. (3) Sem SLA na v1. Lembrete após 24 h fica para a v2. |
| N1-l | KPIs do Dashboard de Compras | Ver §4 D9 | **Usar default com ajustes (§3.1.3).** Remover `data_lista_pronta` do KPI "Atrasados". Medir tempos a partir de "entrou na fila", não de `created_at`. Adicionar "Urgentes em aberto" e "Obras paradas por falta de material". |
| N1-m | Comprador define a "data de disponibilidade" e isso cria a etapa "📦 Chegada dos Materiais" na obra? | Sim, pelo mesmo comportamento de hoje, só que no servidor | Usar default (criar a etapa pelo servidor), com ressalvas: (1) a data muda de dono, do planejador para o comprador, e hoje é o "prazo em que o material deve estar disponível" (`FormularioPedido.jsx` L569). Separar "data necessária" de "previsão de chegada" (P8). (2) A etapa é criada uma vez (`etapa_chegada_criada`). Mudanças posteriores de data **atualizam** a etapa existente, sem duplicar. (3) O comprador pode antecipar, mas hoje `AlertaEdicaoPedido.jsx` L22 só aceita postergar. (4) A data é obrigatória ao marcar `comprado`. (5) Sem `obra_id`, não cria etapa, como hoje. (6) O aviso "Material disponível" aos técnicos (`trg_avisar_material`) continua. |
| N1-n | Quem entra na fila de Compras? | Pedidos com ≥ 1 item preenchido e `status_compra` diferente de `cancelado` (listas de obra vazias ficam fora) | **Divergir do default.** Fila = pedidos com ≥ 1 item preenchido **ou** pedidos de falta de material reportados em campo (itens vazios, `atividade_id` preenchido, urgência alta), com selo "Sem lista de itens". Fora da fila: listas de obra vazias (status `concluido`, `atividade_id` nulo), `cancelado` e `recusado`. Motivo: o default esconderia faltas urgentes que já pausaram atividades. Pedidos de obra `cancelada` entram com selo "obra cancelada". Ver P6. |

### 3.1.1 Ressalvas de impacto (N1-d, N1-g, N1-i)

**A. N1-d: horas calculadas no servidor**

**Confirmado no código**
- Hoje `horas_realizadas = COALESCE(p_horas_realizadas, horas_previstas)` e `horas_ajustadas` só é verdadeiro se o técnico editar (migrations 05, 13, 14 e 16). O texto de `IndicadoresAcionaveis.jsx` L158 diz isso: "o desvio só aparece quando houve ajuste".
- Consumidores de `horas_realizadas`:
  - `execucao_indicadores.horas_por_tipo`.
  - `execucao_media_realizada_templates` (Calibrar templates).
  - `execucao_capacidade.realizado_min` (por técnico e dia, rateado pelas horas individuais da equipe).
  - `PrevistoRealizado` / `execucaoPlanejamento.js` L473–481.
  - Rótulos "ajustadas pelo técnico" em `DetalhesCompletosAtividade.jsx`.
- O progresso da obra pesa por `horas_previstas`, não pelas realizadas. N1-d **não** muda o progresso nem o "saúde".
- Premiação: não há ligação. `premiacao.js`, `utils/premiacao.js` e `config/premiacao.js` são só de vendas, e não encontrei nenhuma referência a `execucao` ou `horas` nesses arquivos.

**Ressalvas**
1. **Quebra de série.** O histórico anterior é "previsto, salvo ajuste". O novo seria "medido". Gravar a origem da hora e usar uma data de corte na calibração e no desvio. Se misturar, a média e o desvio perdem sentido.
2. **O "Iniciar" é opcional.** O técnico pode concluir direto (`SUGESTOES_MELHORIAS_EXECUCAO.md` L750). Sem intervalo, o servidor usa as previstas. Na prática, boa parte do realizado continuará igual ao previsto.
3. **Distorção do relógio.** Esquecer de pausar ou concluir, atividade que atravessa noite, almoço ou fim de semana, e relógio errado no aparelho (offline) inflam as horas. O Jev deu 0,85 de que, sem teto, a média de calibração se distorce. Recomendo contar só dentro da jornada líquida do técnico (`execucao_jornada_dia`) e limitar por dia (P1).
4. **Pausa.** Só conta o tempo em andamento, o que é coerente com "pausar = impedimento". Esquecer de retomar subconta.
5. **Admin.** Pode ajustar na gestão, mas deve marcar `horas_ajustadas = true` e registrar no histórico (o rótulo "horas realizadas" já existe em `rotulos.js`).
6. **Sensibilidade.** Horas medidas por relógio e localização viram dado de monitoramento do trabalhador. Evitar usar em ranking ou bônus (`SUGESTOES` L1070 já alerta que ranking premia volume). Comunicar a finalidade aos técnicos.
7. **Textos a atualizar:** `IndicadoresAcionaveis.jsx` L158 e o rótulo "ajustadas pelo técnico".

**B. N1-g: passos marcáveis (concluir com passos em aberto)**

**Impactos**
- **Pontualidade.** `execucao_indicadores.pontualidade` conta **atividades** concluídas no prazo. Uma atividade fechada com passos pendentes entraria como "no prazo" com trabalho incompleto. Decidir se a pontualidade passa a considerar a etapa.
- **Obra e Dashboard Comercial.** A obra só conclui quando todas as etapas concluem (`execucao_recalcular_progresso_obra`). Com passos pendentes, a obra fica "em andamento" e `status_execucao_contratos` exibe isso no Selo de Execução (atrasa `entregue_em` e pode afetar o "saúde"). É mais fiel à realidade, mas muda o que o Comercial vê.
- **Horas.** Os passos não têm horas realizadas próprias. As horas da atividade já foram fechadas na conclusão. Definir se passos marcados depois acrescentam horas (hipótese: não na v1).
- **Progresso da etapa pai.** Hoje é por atividades concluídas. Passar a ser por % de passos concluídos (hipótese, a validar na B0).
- **Auditoria.** Registrar quem marcou o passo, quando e a origem (offline ou servidor).

**C. N1-i: reabrir etapas pai concluídas indevidamente**
- **Confirmado:** `execucao_recalcular_progresso_obra` (mig. 05 L38–45) **nunca rebaixa** a obra de `concluida` e mantém `data_fim_real` ("sticky"). Reabrir só a etapa deixaria "obra concluída com etapa aberta", e o Comercial continuaria vendo "entregue" e `entregue_em`.
- Reabrir muda o progresso da obra (100% → menos), `obras_no_prazo` e a pontualidade das etapas do período. Premiação de vendas não é afetada.
- Cuidados:
  - Limpar a `data_fim_real` só da etapa reaberta.
  - Registrar no histórico "reaberta por correção".
  - Sem notificação a técnicos.
  - Simulação (dry-run) com lista para aprovação e backup para rollback.
  - Excluir da lista as obras `concluida` e as `cancelada`, até a resposta de P4.
- Conferir também que as sub-etapas "não concluídas" não sejam passos já fechados em cascata (mig. 16 L228–236), para a lista não gerar falso positivo.

### 3.1.2 Fluxo de status de compra (N1-j)

```
                       (lista com ≥1 item / falta de material em campo)
                                        │
                                        ▼
                               ┌──────────────────┐
              ┌───────────────►│ aguardando_compra│──────────────┐
              │                └────────┬─────────┘              │
              │                         │ assumir pedido         │
              │                         ▼                        │
              │                ┌──────────────────┐              │
              │   voltar ao    │   em_cotacao     │──────────────┤
              │   status       └────────┬─────────┘              │
              │   anterior              │ comprado (exige data   │
              │   (último               │ de disponibilidade)    │
              │   questionamento        ▼                        │
              │   resolvido)   ┌──────────────────┐              │
              │                │    comprado      │──────────────┤
              │                └────────┬─────────┘              │
   ┌──────────┴─────────┐               │                        │
   │aguardando_solicitante│      ┌──────┴────────┐               │
   │ (automático, só a    │      ▼               ▼               ▼
   │ partir de aguardando │ entregue_parcial → entregue      ┌──────────┐
   │ _compra/em_cotacao)  │ (obs. do que falta)  (terminal)  │cancelado │
   └──────────────────────┘                                  │(terminal,│
   abre questionamento → entra aqui                          │com motivo│
                                                             │ ≠entregue)│
                                                             └──────────┘
```

**Mapeamento do legado (backfill):**
- `concluido` (lista de obra) e `solicitado` → `aguardando_compra`, desde que haja itens (N1-n).
- `pendente` (falta de material) → `aguardando_compra` com selo "sem itens".
- `entregue` → `entregue`, preservando `data_entrega`.
- `cancelado` e `recusado` → `cancelado`.
- `aprovado` → `aguardando_compra`. Hoje `atualizarStatusPedido` (`execucao.js` L517) é o único código que grava `aprovado` e `recusado`, e nenhuma tela o chama (grep sem usos). Não há aprovação de pedido na UI atual (P7).

**Lacunas do plano:** a edição de itens depois de `comprado` deve ser bloqueada (ou só via questionamento). A edição pelo solicitante em `aguardando_compra` ou `em_cotacao` notifica o comprador e vai ao histórico.

### 3.1.3 Validação dos KPIs do Dashboard de Compras (D9, N1-l)

| KPI (D9) | Parecer |
|---|---|
| Aguardando compra, Em cotação | OK (contagem em estoque, sem período). |
| Aguardando solicitante | OK. Mostrar também "há mais de X dias" do mais antigo. |
| **Atrasados** | **Ajustar.** `data_lista_pronta` é prazo de quem monta a lista (planejador), não do comprador. Fica fora do KPI (já existe em `ExecucaoHome.jsx` L484 e `ListasObrasPendentes`). Usar `data_material_disponivel < hoje` com status ≠ `entregue`/`cancelado`. |
| Comprados / Entregues no período | OK, mas pelo **instante do evento** (comprado/entregue), não por `created_at`. |
| **Tempo médio pedido→comprado** | **Ajustar.** `created_at` das listas de obra é a criação do cronograma (semanas antes), então a média vira ruído. Medir a partir de "entrou na fila" (primeira vez com item preenchido ou em `aguardando_compra`). Mostrar mediana junto da média. |
| Tempo médio de resposta a questionamento | OK, medir só os respondidos e listar os abertos à parte. Não usar como avaliação do comprador, porque quem responde é o solicitante ou o admin. |
| **Novo:** Urgentes em aberto | Alto valor, esforço baixo (urgência `alta`/`urgente` e status não terminal). |
| **Novo:** Obras paradas por falta de material | Atividades pausadas com `motivo_codigo='falta_material'`, que o `reportar_falta_material` já grava. |

Ressalvas gerais:
- O filtro de data do R6 (`created_at`) tem o mesmo problema nas listas de obra. No Dashboard de Compras, oferecer "data do pedido" e "data do evento".
- Os RPCs de Compras **não** devem expor valor de contrato nem dados comerciais.

### 3.2 Divergências e perguntas em aberto

**Divergências e lacunas**
1. N1-n do plano esconde faltas de material em campo (confirmado em `reportar_falta_material` L487–489: `itens = '[]'`, urgência `alta`).
2. `PedidoMaterial.jsx` L69–70 classifica essas faltas (quando têm `obra_id`) como "Lista de obra pendente", o que já é um erro hoje.
3. `data_material_disponivel` mistura "prazo necessário" e "previsão de chegada".
4. `recalcular_progresso_obra` nunca reabre obra concluída, o que afeta N1-i.
5. D9 "Atrasados" e "tempo pedido→comprado" medem a coisa errada nas listas de obra.
6. O fluxo legado `aprovado`/`recusado` existe na tela de lista (`ListaPedidos.jsx`), mas não há código que o altere.

**Perguntas ao usuário** (todas *pendentes de resposta do usuário*)
- **P1.** Horas calculadas: descontar almoço e fora da jornada e limitar ao máximo diário da jornada? Aceita começar medição com data de corte (histórico antigo separado)? *(pendente de resposta do usuário)*
- **P2.** Concluir sem "Iniciar": usar as horas previstas é aceitável? *(pendente de resposta do usuário)*
- **P3.** Concluir com passos em aberto: só confirmação (recomendado) ou bloquear? Quem pode marcar o passo depois? *(pendente de resposta do usuário)*
- **P4.** Etapa reaberta em obra já `concluida`: a obra reabre (some "entregue" no Dashboard Comercial) ou só a etapa? Obra já entregue ao cliente fica fora da lista? *(pendente de resposta do usuário)*
- **P5.** Existe pedido sem cliente (estoque ou uso interno)? Se sim, vale a opção "Sem cliente"? *(pendente de resposta do usuário)*
- **P6.** Faltas de material do técnico (sem itens) entram na fila de Compras com selo? (recomendado: sim) *(pendente de resposta do usuário)*
- **P7.** O fluxo `aprovado`/`recusado` ainda é usado? Pode mapear `recusado` para `cancelado`? *(pendente de resposta do usuário)*
- **P8.** `data_material_disponivel` é o prazo exigido pela obra ou a previsão do comprador? O comprador pode antecipar? *(pendente de resposta do usuário)*
- **P9.** Quem informa os técnicos sobre a coleta de localização (finalidade e ciência)? RH ou gestão precisa aprovar? *(pendente de resposta do usuário)*
- **P10.** Sub-etapa com responsável diferente do pai: como fica quem marca o passo? *(pendente de resposta do usuário)*

---

## 4. Decisões de arquitetura

| # | Decisão | Alternativas descartadas e por quê |
|---|---------|------------------------------------|
| D1 | **Componente único `TextoFormatado`** (`src/features/execucao/components/ui/TextoFormatado.jsx`) que transforma texto puro em parágrafos, listas (`-`, `•`, `*`, `1.`, `1)`) e quebras, gerando elementos React. Usado na Descrição e no Procedimento do POP (e disponível para observações). | Markdown completo (dependência nova, risco de XSS com HTML); só adicionar `whitespace-pre-wrap` na Descrição (resolve as quebras, mas não alinha listas/parágrafos e deixa a lógica duplicada). |
| D2 | **Id estável por item** (`itens[].id` uuid) garantido por **trigger BEFORE INSERT/UPDATE** em `execucao_pedidos_material` + backfill. O front mantém `id` (deixa de ser removido por `itensSemKey`). | Diff só por nome (falha em renomeações e itens repetidos); tabela normalizada de itens (refatoração grande de todos os writers: `criar_obra_completa`, `reportar_falta_material`, templates). |
| D3 | **Diff de itens calculado no front** (`diffItens()` puro em `pedido-material/utils.js`) a partir de `dados_anteriores`/`dados_novos` já gravados, com fallback por nome normalizado + unidade. Funciona para o histórico antigo. RPCs de compras gravam o histórico com o mesmo formato. | Calcular e persistir o diff no banco (não cobre registros antigos e duplica lógica). |
| D4 | **Compras como página do módulo Execução** (`#/execucao/compras`) + novo nível `COMPRAS` + função `is_compras()`. Reaproveita `ExecucaoDashboard`, `ExecucaoUI`, sino de notificações, Realtime e helpers de RLS. *(Jev: escolheu esta opção com confiança 0,58; adotada pelo reuso e pelo menor risco.)* | Módulo novo no topo de `App.jsx` com layout próprio: duplica sidebar, header, notificações e roteamento por hash. |
| D5 | **Questionamentos em tabela dedicada** `execucao_pedidos_questionamentos` + coluna `status_compra` em `execucao_pedidos_material`. Todas as escritas via **RPC SECURITY DEFINER** (validação de papel, transição de status, histórico e notificação na mesma transação). SELECT direto liberado por RLS só para quem pode ver (necessário para o Realtime). *(Jev: confiança 1,0.)* | jsonb de mensagens dentro do pedido (sem RLS por linha, conflito de escrita concorrente); reusar `execucao_atividades_comentarios` (FK de atividade, semântica errada). |
| D6 | **`status_compra` separado do `status` legado.** O `status` atual (`concluido`/`entregue`/...) e o trigger `trg_avisar_material` continuam iguais. A RPC `compras_alterar_status` sincroniza `status='entregue'` + `data_entrega` quando `status_compra='entregue'`. | Reaproveitar `status` (quebra `trg_avisar_material`, `ListasObrasPendentes`, filtros existentes e `reportar_falta_material`). |
| D7 | **Leitura do Dashboard de Compras via RPC** `compras_listar_pedidos(filtros, limite, cursor)` e `compras_indicadores(de, ate)`, SECURITY DEFINER, devolvendo nomes já resolvidos (evita abrir RLS de `usuarios`/`execucao_obras` para COMPRAS). Paginação por keyset (`created_at`, `id`). | `select` direto com joins (exigiria policies novas em `usuarios`/`obras` e N round trips). |
| D8 | **Sub-etapas: uma única função de agregação** `execucao_recalcular_etapa_pai(p_pai)`: o pai conclui **somente** se (todas as sub-etapas não canceladas estão concluídas) **e** (todas as atividades não canceladas ligadas ao pai estão concluídas); senão fica `em_andamento` (reabrindo se estava concluída). Fim da cascata pai→filhos. Passos marcáveis pela nova RPC `execucao_marcar_passo` (idempotente, aceita fila offline). Fallback por nome restrito a etapas **folha** com uma única correspondência na mesma data. *(Jev: escolheu "passos marcáveis" com confiança 0,40; abaixo do limiar, por isso está sob ⛳ N1-g.)* | Manter a cascata (é a origem do bug); só remover a cascata sem passos marcáveis (as sub-etapas nunca concluiriam). |
| D9 | **Escopo do Dashboard de Compras (v1):** KPIs: *Aguardando compra*, *Em cotação*, *Aguardando solicitante* (questionamentos abertos), *Atrasados* (`data_lista_pronta`/`data_material_disponivel` < hoje e não entregue), *Comprados no período*, *Entregues no período*, *Tempo médio pedido→comprado*, *Tempo médio de resposta a questionamento*. Filas em abas por `status_compra` (kanban em desktop ≥ 1280 px, abas no mobile), lista com filtros (período, status, urgência, cliente/obra, solicitante, "só com questionamento aberto", busca), detalhe lateral (drawer) com itens, conversa, histórico e ações (assumir pedido, mudar status, definir data de disponibilidade, abrir questionamento). Exportação CSV fica fora da v1. | Dashboard com gráficos ECharts na v1 (mais custo e pouco valor operacional; fica para a v2). |
| D10 | **Conclusão do técnico**: novas colunas em `execucao_atividades` (não em tabela separada) + **novos parâmetros** em `alterar_status_atividade`. Para evitar ambiguidade de overload no PostgREST, a migration faz `DROP FUNCTION` das assinaturas antigas (`(uuid,text,text)` do snapshot e `(uuid,text,text,timestamptz,uuid,text,boolean,numeric)`) e recria com uma só assinatura. Payload antigo da fila offline continua válido (parâmetros novos com DEFAULT NULL). | Tabela `execucao_atividades_conclusoes` (mais joins; 1:1 com a atividade); manter overloads (erro "could not choose the best candidate function"). |
| D11 | **Horário**: `fim_real_em = now()` se `p_ocorrido_em` é nulo ou está a ≤ 5 min de `now()`; senão (fila offline) usa `p_ocorrido_em` limitado a `[inicio_real_em, now()]`. Sempre grava `conclusao_registrada_em = now()` e `conclusao_origem_horario` (`servidor`/`dispositivo`). *(Jev: remover a edição de horas e calcular no servidor teve confiança 0,89.)* | Sempre `now()` (registraria a hora da sincronização, não a do trabalho, quando offline); sempre o horário do aparelho (relógio pode estar errado). |
| D12 | **Replanejamento**: remover o `INSERT` de notificação para técnicos em `deslocar_etapas`, marcar como lidas as já existentes e filtrar no service do técnico (defesa em profundidade). | Só filtrar no front (o banco continuaria gerando lixo e o Realtime dispararia recargas à toa). |
| D13 | **Evidências**: corrigir pela causa raiz encontrada na B0/F0 e sempre: (1) bucket com `allowed_mime_types` explícito incluindo vídeo/áudio (ou `NULL`); (2) fallback nativo (`<input accept="video/*|audio/*" capture>`) quando `getUserMedia`/`MediaRecorder` falham em tempo de execução; (3) mensagens por tipo de erro (`NotAllowedError`, `NotSupportedError`, 413/415 do Storage); (4) `import()` do gravador com retry e recarga em caso de chunk velho; (5) limites atuais mantidos (vídeo 60 s ~1,2 Mbps ≈ 9 MB; áudio 180 s 32 kbps ≈ 0,7 MB; ambos bem abaixo de 50 MB). | Transcodificar no servidor/Edge Function (custo e limites do plano gratuito); biblioteca de gravação (peso no bundle). |
| D14 | **Planejamento Macro**: a UX1 produz a especificação (breakpoints, padrões); o front aplica em fatias por componente. No celular (< 640 px), o Gantt vira uma **lista de etapas** (alternativa ao gráfico); a partir de 768 px, Gantt com rolagem horizontal, primeira coluna fixa e zoom semana/mês. | Reescrever o Planejamento do zero (risco alto, 1.028 linhas + 20 componentes). |

---

## 5. Impacto

### 5.1 Banco (migrations novas)

| Migration | Conteúdo |
|-----------|----------|
| `20261101_19_execucao_subetapas_conclusao.sql` | `execucao_recalcular_etapa_pai(uuid)`; `execucao_sincronizar_etapa_pai(uuid)` passa a resolver o pai e delegar; `alterar_status_atividade` sem cascata e com fallback restrito; RPC `execucao_marcar_passo(p_atividade uuid, p_sub_etapa uuid, p_concluido boolean, p_id_cliente uuid, p_ocorrido_em timestamptz)`; `execucao_contexto_atividades` devolve também `id` de cada sub-etapa; script de correção de dados (bloco separado, executado após o OK da N1-i). |
| `20261101_20_execucao_conclusao_tecnico.sql` | `ALTER TABLE execucao_atividades ADD COLUMN observacao_conclusao text, conclusao_latitude numeric(9,6), conclusao_longitude numeric(9,6), conclusao_precisao_m numeric(7,1), conclusao_geo_status text CHECK (... IN ('ok','negada','indisponivel','tempo_esgotado','nao_suportado')), conclusao_registrada_em timestamptz, conclusao_origem_horario text CHECK (... IN ('servidor','dispositivo'))`; função `execucao_horas_efetivas(p_atividade uuid) RETURNS numeric`; `DROP FUNCTION` das assinaturas antigas e `CREATE` de `alterar_status_atividade(..., p_observacao text DEFAULT NULL, p_latitude numeric DEFAULT NULL, p_longitude numeric DEFAULT NULL, p_precisao_m numeric DEFAULT NULL, p_geo_status text DEFAULT NULL)`; GRANT/REVOKE iguais aos atuais. |
| `20261101_21_execucao_sem_notif_replanejamento.sql` | Recria `deslocar_etapas` (a partir da versão da mig. 14) **sem** o `INSERT ... 'replanejamento'`; `UPDATE execucao_notificacoes SET lida=true, lida_em=now() WHERE tipo='replanejamento' AND destinatario_id IS NOT NULL AND lida=false`. |
| `20261101_22_execucao_evidencias_midia.sql` *(condicional à B0)* | `UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/webm','video/mp4','video/quicktime','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a'], file_size_limit = 52428800 WHERE id='atividades-evidencias'`. |
| `20261101_23_pedidos_itens_id.sql` | Função + trigger `trg_pedidos_itens_id` (BEFORE INSERT OR UPDATE OF itens) que adiciona `id` (uuid texto) a cada item sem id; backfill com o trigger de auditoria desativado temporariamente (nome levantado na B0). Sem colunas novas. |
| `20261101_24_compras_base.sql` | `INSERT` do nível `COMPRAS` em `niveis_acesso`; página `execucao/compras` em `paginas`; `permissoes` para COMPRAS (`execucao`, `execucao/compras`) e para ADMIN_EXECUCAO/Administrador (`execucao/compras`); funções `is_compras()` (`current_nivel() IN ('COMPRAS','Administrador')`) e `pode_ver_compras()` (`is_compras() OR is_admin_execucao()`); colunas `status_compra text DEFAULT 'aguardando_compra' CHECK (...)`, `comprador_id uuid REFERENCES usuarios(id)`, `status_compra_em timestamptz`, `comprado_em timestamptz`; backfill de `status_compra` (`entregue` → `entregue`, `cancelado`/`recusado` → `cancelado`, demais → `aguardando_compra`); policies `SELECT` para `pode_ver_compras()` em `execucao_pedidos_material` e `execucao_historico_pedidos`; índices `(status_compra, created_at DESC)`, `(comprador_id)`. |
| `20261101_25_compras_questionamentos.sql` | Tabela `execucao_pedidos_questionamentos` (id, pedido_id FK CASCADE, item_id text, item_snapshot jsonb, tipo text CHECK in ('substituicao','quantidade','duvida'), pergunta text NOT NULL, sugestao jsonb, status text CHECK in ('aberto','aprovado','reprovado','cancelado') DEFAULT 'aberto', resposta_observacao text, criado_por uuid, respondido_por uuid, respondido_em timestamptz, created_at, updated_at); RLS: SELECT para `pode_ver_compras()` ou solicitante do pedido; sem INSERT/UPDATE/DELETE direto; tipos de notificação novos (`compra_questionamento`, `compra_resposta`, `compra_status`) no CHECK de `execucao_notificacoes`; RPCs `compras_abrir_questionamento`, `compras_responder_questionamento`, `compras_cancelar_questionamento`, `compras_alterar_status`, `compras_assumir_pedido`, `compras_definir_disponibilidade` (cria a etapa "📦 Chegada dos Materiais" se `obra_id` e `etapa_chegada_criada=false`); `execucao_pedidos_material` e `execucao_pedidos_questionamentos` no `supabase_realtime` (mesmo padrão da mig. 15 L65+); índices `(pedido_id, status)` e parcial `WHERE status='aberto'`. |
| `20261101_26_compras_painel.sql` | RPCs `compras_listar_pedidos(p_filtros jsonb, p_limite int, p_cursor jsonb)` e `compras_indicadores(p_de date, p_ate date)` (STABLE, SECURITY DEFINER, `pode_ver_compras()` obrigatório). |

**Tabelas afetadas:** `execucao_atividades`, `execucao_obras_etapas` (dados), `execucao_notificacoes`, `execucao_pedidos_material`, `execucao_historico_pedidos` (RLS), `niveis_acesso`, `paginas`, `permissoes`, `storage.buckets`, nova `execucao_pedidos_questionamentos`.

### 5.2 Services

- `src/services/supabase/execucao.js`: `alterarStatusAtividade` (novos `extras`: `observacao`, `latitude`, `longitude`, `precisaoM`, `geoStatus`), `buscarPedidosMaterial` (filtros `de`, `ate`, `comQuestionamento`), `criarPedidoMaterial`/`atualizarPedidoMaterial` (enviar `cliente_nome`), `buscarQuestionamentosPedido`, `responderQuestionamento`.
- `src/services/supabase/execucaoTecnico.js`: `buscarNotificacoesUsuario`/`contarNotificacoesUsuario` com `.neq('tipo','replanejamento')` quando `!isAdmin`; `marcarPasso`.
- `execucaoService.buscarPassosPendentesPorEtapa(obraIds)` (RPC `execucao_passos_pendentes_por_etapa`, migration 30; F.9): `{ success, data: linhas }`.
- **Novo** `src/services/supabase/execucaoCompras.js` (+ export em `src/services/index.js`): `listarPedidos`, `indicadores`, `abrirQuestionamento`, `cancelarQuestionamento`, `alterarStatus`, `assumirPedido`, `definirDisponibilidade`, `buscarDetalhe`.
- `src/services/supabase/execucaoEvidencias.js`: classificar 413/415 e devolver mensagem amigável.

### 5.3 Front-end

| Área | Arquivos |
|------|----------|
| POPs | `components/POPs.jsx`, **novo** `components/ui/TextoFormatado.jsx` |
| Pedido de material | `PedidoMaterial.jsx`, `pedido-material/FormularioPedido.jsx`, `pedido-material/TemplatesMateriais.jsx`, `pedido-material/utils.js`, `pedido-material/HistoricoPedido.jsx`, `pedido-material/ListaPedidos.jsx`, **novos** `pedido-material/CampoQuantidade.jsx`, `pedido-material/DiffItens.jsx`, `pedido-material/QuestionamentosPedido.jsx`, `pedido-material/FiltroPeriodo.jsx` |
| Compras | **novos** `components/compras/DashboardCompras.jsx`, `compras/IndicadoresCompras.jsx`, `compras/FilaCompras.jsx`, `compras/DetalhePedidoCompras.jsx`, `compras/ModalQuestionamento.jsx`, `compras/compras.css`, `compras/statusCompra.js`; `ExecucaoDashboard.jsx`, `ExecucaoSidebar.jsx`, `utils/permissoes.js`, `hooks/useBadgesMenu.js`, `tecnico/navegacaoNotificacao.js`, `NotificacoesDropdown.jsx`, `src/contexts/AuthContext.jsx` (L177–196), `src/App.jsx` (L65–75) |
| Planejamento Macro | `PlanejamentoMacro.jsx`, `planejamento/*.jsx`, `planejamento/visao/*.jsx`, `planejamento/visao/visao.css`, `planejamento/cadastro/cadastro.css`, `styles/execucao.css`, `ui/Modal.jsx` (se necessário), **novo** `planejamento/ListaEtapasMobile.jsx` |
| Técnico | `tecnico/ModalConcluir.jsx`, `tecnico/acoesAtividade.js`, `tecnico/useAcoesAtividade.jsx`, `tecnico/PassosAtividade.jsx`, `tecnico/MeuDia.jsx`, `tecnico/tecnico.css`, `tecnico/evidencias/{EvidenciasUploader.jsx,useEvidencias.js,gravador.js,GravadorVideo.jsx,filaUpload.js}`, `offline/sincronizador.js` (executor `passo`), `DetalhesCompletosAtividade.jsx`, `AtividadesDia.jsx` (L553: exibir observação/local da conclusão), `ExecucaoHome.jsx` (L846) |
| Planejamento ↔ sub-etapas | `PlanejamentoMacro.jsx` L61–100 e L498–515 (não criar atividade para sub-etapa nova), `planejamento/AlertasEtapasAtrasadas.jsx` (alerta "passos pendentes") |

### 5.4 RLS (resumo)

| Tabela | Antes | Depois |
|--------|-------|--------|
| `execucao_pedidos_material` | ALL só admin execução | + SELECT para `pode_ver_compras()`; escrita de COMPRAS **só via RPC** |
| `execucao_historico_pedidos` | ALL só admin | + SELECT para `pode_ver_compras()` |
| `execucao_pedidos_questionamentos` | (nova) | SELECT: `pode_ver_compras()` OU `solicitante_id = current_usuario_id()` do pedido; escrita só via RPC |
| `execucao_notificacoes` | técnico vê `destinatario_id = self` | igual (COMPRAS usa a mesma policy) |
| `storage.objects` (`atividades-evidencias`) | sem mudança | sem mudança (só o bucket) |

---

## 6. Passo a passo

> Formato: `- [ ] **ID** · Agente · Arquivos · Descrição · Dependências · Aceite`

### Onda 0: Descoberta, decisões e desenho (tudo em paralelo)

- [x] **N1** · Especialista Negocio · `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md` §3.1 · Preencher a coluna "Decisão Negócio" (N1-a a N1-n), validar os KPIs da D9 e o fluxo de status da N1-j (diagrama simples de estados no próprio plano, §3.1). · Dep.: nenhuma · Aceite: todas as linhas preenchidas ou marcadas "usar default".
- [x] **B0** *(executado pelo orquestrador em 01/11/2026; resultados no Anexo A)* · Especialista Backend · leitura no Supabase (somente SELECT/catálogo) · Levantar e registrar no fim deste plano (Anexo A): (1) `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='atividades-evidencias'`; (2) `select oid::regprocedure from pg_proc where proname='alterar_status_atividade'` (overloads); (3) nomes dos triggers de `execucao_pedidos_material` (`select tgname from pg_trigger where tgrelid='public.execucao_pedidos_material'::regclass and not tgisinternal`); (4) para a obra do bug relatado (pedir o cliente ao orquestrador), `execucao_atividades_historico` + `execucao_auditoria` das etapas pai/sub-etapa no dia, para identificar qual caminho (i/ii/iii da §2.12) concluiu o pai; (5) contagem de pais `concluida` com sub-etapa não concluída; (6) amostra de `execucao_notificacoes` `tipo='replanejamento'` com destinatário. · Dep.: nenhuma · Aceite: Anexo A preenchido com resultados e o caminho do bug identificado.
- [ ] **F0** · Especialista Frontend · `tecnico/evidencias/*` (somente leitura e logs locais) · Reproduzir o erro de vídeo/áudio em Android/Chrome, iOS/Safari e no PWA instalado; anotar `err.name`/`err.message`, `MediaRecorder.isTypeSupported` para cada mime de `gravador.js`, `window.isSecureContext`, o header `Permissions-Policy` da produção (`curl -sI <url-prod>`) e o resultado do upload (status HTTP). · Dep.: nenhuma · Aceite: Anexo B preenchido com causa raiz por plataforma.
- [x] **UX1** · Especialista UI/UX · novo `docs` dentro deste plano (Anexo C) · Auditoria do Planejamento Macro em 360/768/1024/1440 px (header + abas, filtros, cards de stats, `ObraCard`, `GanttObra`, `ResumoEtapas`, visões Semana/Mês/Ano/Linha do tempo/Tabela, `PainelCarteira`, modais `ObraFormModal`/`EtapaFormModal`/`TemplateFormModal`/`ReprogramarModal`/`ServicoRapidoModal`). Entregar a especificação: breakpoints, grid por faixa, comportamento do Gantt (lista no mobile, rolagem + coluna fixa no tablet/desktop), barra de filtros (gaveta "Filtros" no mobile), ações sempre visíveis em toque, tamanho mínimo de toque, modais em tela cheia < 640 px, tipografia e espaçamentos. · Dep.: nenhuma · Aceite: Anexo C com checklist por componente (usado pelo QA na Q4).
- [x] **UX2** · Especialista UI/UX · Anexo D · Wireframes do Dashboard de Compras (desktop kanban + drawer de detalhe; mobile abas + tela de detalhe), do modal de questionamento, da conversa dentro de `PedidoMaterial` (gestão) e do bloco de passos/observação/localização no `ModalConcluir`. · Dep.: N1 (pode começar em paralelo com os defaults) · Aceite: Anexo D aprovado pelo Negócio.
- [ ] **Q0** · Especialista QA · roteiro em Anexo E · Registrar baseline com prints/gravações: POP (gestão × técnico), quantidade no pedido, Meu Dia com concluídas, notificação de replanejamento, bug de sub-etapa (reproduzir em obra de teste com pai + 1 e + 2 sub-etapas). · Dep.: nenhuma · Aceite: baseline anexada para comparação.

### Onda 1: Quick wins só de front-end (paralelo; não dependem de banco)

- [x] **F1** · (front concluído; `TextoFormatado` está em `src/components/ui/`) · Especialista Frontend · `components/ui/TextoFormatado.jsx` (novo), `components/POPs.jsx` L385–386, L474–487 · Criar `TextoFormatado({ texto, className, compacto })`: separa blocos por linha em branco; linhas começando com `-`, `•`, `*` viram `<ul><li>`; `\d+[.)]` viram `<ol><li>`; demais linhas com `<br/>`; sem HTML. Usar na Descrição e no Procedimento do modal de visualização. No card, usar `compacto` (preserva quebras com `line-clamp-3`). · Dep.: nenhuma · Aceite: R1.
- [x] **F2** · Especialista Frontend · `pedido-material/utils.js`, `pedido-material/CampoQuantidade.jsx` (novo), `FormularioPedido.jsx` L505–519, `TemplatesMateriais.jsx` L428–437 · `UNIDADES` ganha `inteira: boolean` (N1-a). Helpers `passoDaUnidade(u)`, `normalizarQuantidade(valor, unidade)`, `quantidadeValida(q)`. `CampoQuantidade`: `type="text" inputMode={inteira ? 'numeric' : 'decimal'}`, estado local em string (permite vazio), botões −/+ de 1 (inteira) ou 0,1, setas do teclado respeitam o passo, aceita vírgula, valida no blur. Ao trocar a unidade para inteira, aplica N1-b e mostra aviso. `salvarPedido` e salvar template bloqueiam itens preenchidos com quantidade vazia/≤0 (erro no item, foco no campo). · Dep.: nenhuma (usa defaults da N1) · Aceite: R3, R4.
- [x] **F3** · Especialista Frontend · `pedido-material/utils.js` (`diffItens`), `pedido-material/DiffItens.jsx` (novo), `HistoricoPedido.jsx` L68–80 · `diffItens(antes, depois)` → `{ adicionados, removidos, alterados:[{ item, mudancas:[{campo,de,para}] }] }`, casando por `id` e, sem id, por `nome` normalizado (minúsculas, sem acento, trim) + `unidade`. Renderizar com cores (verde/vermelho/âmbar) para `edicao`, `criacao` (lista inicial) e os novos tipos `questionamento`/`compra_status`. Manter "Urgência" e datas. Ampliar `TIPOS` com `questionamento` e `compra_status`. · Dep.: nenhuma · Aceite: R5 (inclusive com registros antigos).
- [x] **F4** · Especialista Frontend · `pedido-material/FiltroPeriodo.jsx` (novo), `ListaPedidos.jsx` L51–90, `PedidoMaterial.jsx` L41–46, `services/supabase/execucao.js` `buscarPedidosMaterial` · Filtro de período com atalhos (R6), estado no componente pai e repassado ao service (`gte('created_at', de)`/`lt('created_at', ate+1d)`, fuso America/Sao_Paulo via `utils/datas.js`). Mostrar a data do pedido no item da lista. `FiltroPeriodo` é reutilizado pela F14. · Dep.: nenhuma · Aceite: R6 na tela de gestão.
- [x] **F5** · Especialista Frontend · `PedidoMaterial.jsx` L15–33, `FormularioPedido.jsx` (≈L143–150 e bloco de campos ≈L260–280), `ListaPedidos.jsx` · Campo "Cliente" (`cliente_nome`) com `<datalist>` de `nome_cliente` das obras não concluídas (reusar o service de obras do Planejamento); obrigatório conforme N1-c; incluído em `dados`, `dadosAnteriores` e no histórico; exibido na lista. Pedidos de obra (lista automática) mostram o cliente só leitura. · Dep.: nenhuma · Aceite: R2.
- [x] **F6** · Especialista Frontend · `tecnico/MeuDia.jsx` L104–113, L137, L230–252 · `abertasDoDia = doDia.filter(a => a.status !== 'concluida')`; listas "Atrasadas"/"Hoje" usam só abertas; nova seção recolhida "Concluídas hoje (N)" (mesmo padrão do botão "amanhã", L255+), fechada por padrão, com cards compactos sem ações; estado vazio "Tudo concluído por hoje 🎉" quando há só concluídas. O resumo continua usando `doDia`. · Dep.: nenhuma · Aceite: R15.
- [x] **F7** · Especialista Frontend · `services/supabase/execucaoTecnico.js` L218–252, `MeuDia.jsx` L54 · Para `!isAdmin`, excluir `tipo='replanejamento'` na busca e na contagem; filtrar também no `carregarDia` (pendências). · Dep.: nenhuma · Aceite: parte front da R13.

### Onda 2: Backend da Execução (B1–B4 paralelos entre si; B5 independente)

- [x] **B1** *(aplicada em 01/11/2026; a correção de dados não foi necessária)* · Especialista Backend · `supabase/migrations/20261101_19_execucao_subetapas_conclusao.sql` · (1) `execucao_recalcular_etapa_pai(p_pai)`: calcula `v_subs_total/feitas/iniciadas` (sub-etapas ≠ cancelada) e `v_atv_total/feitas` (atividades ≠ cancelada com `etapa_id = p_pai`); conclui só se `subs_feitas = subs_total AND atv_feitas = atv_total`; senão `status = 'em_andamento'` se algo iniciou (reabre `concluida` → `em_andamento`, zera `data_fim_real`), progresso ponderado ≤ 99. (2) `execucao_sincronizar_etapa_pai(p_etapa)`: resolve `v_pai := COALESCE(etapa_pai_id, CASE WHEN EXISTS(filhos) THEN p_etapa END)` e chama (1). (3) Recriar `alterar_status_atividade` a partir da mig. 16 L116–243, **removendo** o bloco L228–236 (cascata) e trocando o fallback L197–204 por: só etapas com `etapa_pai_id IS NULL AND NOT EXISTS (filhos)` ou sub-etapas folha, mesma obra/cliente, `data_inicio = a.data_programada`, e somente se houver **exatamente 1** correspondência. Quando a etapa da atividade tem filhos, não forçar `concluida` direto: delegar a (1). (4) RPC `execucao_marcar_passo(...)`: valida `execucao_participa(p_atividade)` ou admin, `sub.etapa_pai_id = atividade.etapa_id`; idempotência via `execucao_acoes_cliente` (tipo `'passo'`); grava `status`/`progresso`/datas reais da sub-etapa, histórico da atividade (`tipo_acao='passo'`) e chama (1). (5) `execucao_contexto_atividades`: incluir `'id', s.id` em cada sub-etapa. (6) **Bloco de correção de dados** separado no fim, **comentado**, com SELECT de prévia e UPDATE de reabertura (rodar só após N1-i). Nota: a B2 recria `alterar_status_atividade` partindo do texto desta migration; qualquer ajuste aqui tem de ser levado para a 20. · Dep.: B0 · Aceite: R14 em SQL (cenários do §7.2 rodando em transação com ROLLBACK).
- [x] **B2** *(aplicada em 01/11/2026; teto diário de horas corrigido na 31)* · Especialista Backend · `supabase/migrations/20261101_20_execucao_conclusao_tecnico.sql` · Colunas novas (§5.1); `execucao_horas_efetivas(p_atividade)` (soma dos intervalos em andamento a partir de `execucao_atividades_historico`: `inicio`/`retomada` → `pausa`/`conclusao`; limite de 16 h por dia corrido; sem início → `horas_previstas`); `DROP FUNCTION IF EXISTS` das assinaturas listadas na B0 e `CREATE` de `alterar_status_atividade` **partindo da versão da B1** + parâmetros novos. Para `p_status='concluida'`: horário pela D11; `horas_realizadas = COALESCE(p_horas_realizadas, execucao_horas_efetivas(p_id))` (aceita `p_horas_realizadas` para a fila antiga e para a gestão); grava observação/geo/origem; histórico com `descricao = 'Atividade concluída' || ' · Obs: ' || obs` e `valor_novo`; mensagem da notificação inclui a observação (até 140 caracteres). Validar `p_geo_status` e lat/long (−90..90/−180..180). GRANT/REVOKE como mig. 05. · Dep.: B1 (mesma função; aplicar depois) · Aceite: R11, R12 em SQL; `npm run check:contract` ok.
- [x] **B3** *(aplicada em 01/11/2026)* · Especialista Backend · `supabase/migrations/20261101_21_execucao_sem_notif_replanejamento.sql` · Recriar `deslocar_etapas` copiando a versão da mig. 14 L283+ sem o `INSERT` de L313–316; `UPDATE` de limpeza (§5.1). · Dep.: B0 · Aceite: R13 (`deslocar_etapas(..., true)` não cria linhas em `execucao_notificacoes`).
- [x] **B4** *(aplicada em 01/11/2026; o bucket já estava com `allowed_mime_types = NULL` e 50 MiB, a migration só garante o estado)* · Especialista Backend · `supabase/migrations/20261101_22_execucao_evidencias_midia.sql` *(só se B0/F0 apontarem bucket/mime/limite)* · Ajustar `allowed_mime_types`/`file_size_limit` (§5.1). Conferir no painel o limite global de upload do projeto (Free: 50 MB) e registrar no Anexo A. · Dep.: B0, F0 · Aceite: upload manual de `.webm`/`.mp4`/`.m4a` de 5 MB com usuário técnico participante retorna 200.
- [x] **B5** *(aplicada em 01/11/2026; 3 pedidos tiveram ids de itens gerados)* · Especialista Backend · `supabase/migrations/20261101_23_pedidos_itens_id.sql` · Função `execucao_pedidos_itens_com_id(jsonb) RETURNS jsonb` (adiciona `id` = `gen_random_uuid()::text` a cada item sem `id`, preservando a ordem) + trigger BEFORE INSERT OR UPDATE OF itens; backfill com o trigger de auditoria desativado (`ALTER TABLE ... DISABLE TRIGGER <nome da B0>` / `ENABLE`) para não poluir `execucao_auditoria`. · Dep.: B0 · Aceite: todos os pedidos com itens têm `id` em cada item; inserir itens sem id pelo SQL gera ids.
- [~] **P1** · Performance · revisão das migrations 19–21 · (REVISÃO ESTÁTICA FEITA em 2026-11-01, ver Anexo G; EXPLAIN pendente de banco; mig. 29 criada com o índice que faltava) · `EXPLAIN` de `execucao_recalcular_etapa_pai` e `execucao_horas_efetivas` em obra grande; confirmar índices `execucao_obras_etapas(etapa_pai_id)`, `execucao_atividades(etapa_id)`, `execucao_atividades_historico(atividade_id, created_at)`; criar os que faltarem na própria migration. · Dep.: B1, B2 · Aceite: p95 < 50 ms por chamada em obra com 200 etapas.

### Onda 3: Front-end do técnico e do planejamento (paralelo, conforme dependências)

- [x] **F8** · (front concluído; depende de aplicar migrations 19–20; falta teste em aparelho) · Especialista Frontend · `tecnico/ModalConcluir.jsx`, `tecnico/acoesAtividade.js` L100–102 e L23–30, `services/supabase/execucao.js` `alterarStatusAtividade` · Remover `CampoHoras` (N1-d); adicionar `<textarea>` "Observação (opcional)" (`maxLength=1000`, contador); ao abrir o modal chamar `aquecerLocalizacao()`; no clique de **Concluir**, capturar `obterLocalizacao({ timeoutMs: 6000, maxIdadeMs: 30000 })` em paralelo com `evidencias.liberar()` e enviar `{ observacao, latitude, longitude, precisaoM, geoStatus }` no payload; o executor `status` repassa para o service. Texto informativo: "Horário e localização são registrados automaticamente no momento da conclusão." Se `geoStatus='negada'`: aviso não bloqueante com instrução para liberar (N1-e). Mostrar o horário do clique só como leitura. · Dep.: B2 (pode codar em paralelo e integrar após B2) · Aceite: R11, R12 (UI); fila offline: concluir sem rede e sincronizar grava `conclusao_origem_horario='dispositivo'`.
- [x] **F9** · (front concluído; depende de aplicar migration 19; falta teste offline em aparelho) · Especialista Frontend · `tecnico/ModalConcluir.jsx`, `tecnico/PassosAtividade.jsx`, `tecnico/acoesAtividade.js` (executor e ação `passo`), `offline/sincronizador.js`, `services/supabase/execucaoTecnico.js` (`marcarPasso`), `offline/cacheLeitura.js` · Lista de passos pendentes com checkbox no modal de conclusão (marcados por padrão os já concluídos); ao confirmar, enfileirar uma ação `passo` por passo marcado **antes** da ação `status` (mesma ordem na fila); se ficar passo em aberto, mostrar "A etapa seguirá em andamento no planejamento até todos os passos serem concluídos" (N1-g). `PassosAtividade` deixa de marcar tudo como feito só porque a atividade está concluída (L10, L18) e usa o status real do passo. · Dep.: B1 · Aceite: R14 pelo fluxo do técnico (online e offline).
- [x] **F10** · (front concluído; depende de aplicar migration 19) · Especialista Frontend · `PlanejamentoMacro.jsx` L61–100, L498–515, `planejamento/AlertasEtapasAtrasadas.jsx`, `planejamento/GanttObra.jsx` · Para sub-etapa **nova** (`etapa_pai_id` preenchido), `sincronizarAtividadeDaEtapa` não cria atividade (N1-h); garante a atividade do pai. No Gantt/alertas, pai com passos pendentes e atividade concluída mostra o selo "Passos pendentes". · Dep.: B1, N1 · Aceite: criar sub-etapa com responsável não gera nova linha em `execucao_atividades`; selo visível.
- [x] **F11** · (front concluído; falta confirmar em aparelho/bucket) · Especialista Frontend · `tecnico/evidencias/EvidenciasUploader.jsx`, `useEvidencias.js` L138–190, `gravador.js`, `GravadorVideo.jsx`, `filaUpload.js`, `services/supabase/execucaoEvidencias.js` · Corrigir a causa raiz do Anexo B e, em todos os casos: (1) `importarGravador()` com 1 retry e, se falhar com erro de chunk, mensagem "Atualize o app" + `location.reload()` sob confirmação; (2) checar `navigator.mediaDevices?.getUserMedia` e `window.MediaRecorder` antes de usar; (3) fallback nativo em falha de execução: vídeo usa o `<input accept="video/*" capture>` já existente; áudio ganha `<input accept="audio/*" capture>` + `capturarAudioArquivo` (limite `CFG.audio.maxBytes`, duração lida por `<audio>`); (4) `mensagemErroMidia` cobre `NotSupportedError`/`TypeError` ("Este navegador não grava vídeo/áudio pelo app; vamos abrir a câmera/gravador do aparelho"); (5) `filaUpload` classifica 413 ("arquivo maior que o limite de 50 MB") e 415 ("formato não aceito") como erro permanente com mensagem clara; (6) se o mime gravado não estiver na lista do bucket (B4), converter só o rótulo (`video/mp4`/`audio/mp4`) quando for compatível, sem recodificar. · Dep.: F0 (e B4, se aplicável) · Aceite: R10 nas 3 plataformas.
- [x] **F12** · (front concluído; depende de aplicar migration 20) · Especialista Frontend · `DetalhesCompletosAtividade.jsx` L78–115, `AtividadesDia.jsx` ≈L553, `ExecucaoHome.jsx` ≈L846 · Exibir para a gestão: observação da conclusão, horário (com selo "horário do aparelho (offline)" quando `origem='dispositivo'`), localização com link `https://maps.google.com/?q=lat,lng` e precisão, ou o status (`negada`, `indisponível`...). · Dep.: B2 · Aceite: dados da R11/R12 visíveis no detalhe da atividade.
- [x] **F13** · ✅ Front concluído em 2026-11-01 (faltam validação visual do Q4/usuário em 360/768/1024/1440 px e testes em dispositivo real; ver "Fora de escopo" na mesma linha) · Especialista Frontend (com revisão do UI/UX) · `PlanejamentoMacro.jsx`, `planejamento/*.jsx`, `planejamento/visao/*`, CSS do módulo, **novo** `planejamento/ListaEtapasMobile.jsx` · Aplicar o Anexo C em fatias com um PR por fatia: (a) header/abas/filtros/stats; (b) `ObraCard` + `GanttObra` (ações sempre visíveis em toque: trocar `ACOES_VISIVEIS` L22 por classes que aparecem em `@media (hover: none)`; rolagem horizontal com coluna fixa; `ListaEtapasMobile` < 640 px); (c) visões Semana/Mês/Ano/Linha do tempo/Tabela (contêiner `overflow-x-auto`, primeira coluna `sticky`); (d) modais em tela cheia < 640 px e formulários em 1 coluna. · Dep.: UX1 · Aceite: R9 (checklist do Anexo C). · **Entregue:** fatias a–d implementadas (abas com roving tabindex, gaveta de filtros `FiltrosObras`, `ObraCard` empilhado, `GanttObra` com coluna `sticky`/alinhamento corrigido/menu "⋯ Ações", `ListaEtapasMobile`, visões Semana/Mês com lista por dia e painel do dia, Linha do tempo com rótulo responsivo, modais em tela cheia via prop opt-in `telaCheia` do `Modal`). Novos: `hooks/useMediaQuery.js`, `AbasPlanejamento.jsx`, `FiltrosObras.jsx`, `filtrosObrasUtils.js`, `ListaEtapasMobile.jsx`, `estadoEtapa.js`, `ResumoDiaEtapas.jsx`. **Fora de escopo (pendente):** tokens globais P4/P6 em `execucao.css` (afetam técnico/Pedido; aplicados só dentro de `.plan-escopo` em `visao.css`), `COR_SEM_SAUDE`, Q4.

### Onda 4: Backend de Compras

- [x] **B6** *(aplicada em 01/11/2026)* · Especialista Backend · `supabase/migrations/20261101_24_compras_base.sql` · Itens da §5.1 (nível, página, permissões, funções, colunas, backfill, policies, índices). Atualizar `is_usuario_execucao()`? **Não** (COMPRAS não deve ler obras/atividades). · Dep.: N1 (N1-j, N1-n), B5 · Aceite: usuário COMPRAS lê pedidos e histórico, não consegue `update`/`delete` direto (erro de RLS); técnico não lê pedidos.
- [x] **B7** *(aplicada em 01/11/2026)* · Especialista Backend · `supabase/migrations/20261101_25_compras_questionamentos.sql` · Tabela, RLS, CHECK de notificações e RPCs (§5.1) com estas regras: `compras_abrir_questionamento(p_pedido, p_item_id, p_tipo, p_pergunta, p_sugestao jsonb)` exige `is_compras()`; grava `item_snapshot`; muda `status_compra` para `aguardando_solicitante` (guardando o anterior em `referencia` do histórico); notifica o solicitante (`destinatario_id`) ou, se ele for TECNICO, os admins (`destinatario_id NULL`), N1-k; `referencia = {pedido_id, questionamento_id}`. `compras_responder_questionamento(p_id, p_aprovar boolean, p_observacao text)` exige solicitante ou `is_admin_execucao()` e status `aberto`; se aprovar com `sugestao`, aplica no item de mesmo `id` (nome/quantidade/unidade) e grava histórico `tipo_alteracao='questionamento'` com `dados_anteriores`/`dados_novos` = listas de itens (compatível com a F3); notifica quem abriu; quando não restar questionamento aberto, `status_compra` volta ao anterior. `compras_cancelar_questionamento` (autor ou admin). `compras_alterar_status(p_pedido, p_status, p_obs)` valida transições da N1-j, preenche `comprado_em`/`status_compra_em`, sincroniza `status='entregue'` + `data_entrega` (D6) e grava histórico `compra_status`. `compras_assumir_pedido` define `comprador_id`. `compras_definir_disponibilidade(p_pedido, p_data)` atualiza `data_material_disponivel` e cria a etapa de chegada como `criarEtapaChegadaMateriais` (`FormularioPedido.jsx` L19–38), marcando `etapa_chegada_criada`. Realtime das duas tabelas. · Dep.: B6 · Aceite: R7 em SQL (cenários do §7.3).
- [x] **B8** *(aplicada em 01/11/2026)* · Especialista Backend · `supabase/migrations/20261101_26_compras_painel.sql` · `compras_listar_pedidos(p_filtros jsonb, p_limite int DEFAULT 50, p_cursor jsonb DEFAULT NULL)`: filtros `de`, `ate`, `status_compra[]`, `urgencia[]`, `busca` (descrição/cliente/item), `solicitante_id`, `comprador_id`, `com_questionamento_aberto`; retorna pedido + `solicitante_nome`, `comprador_nome`, `qtd_itens`, `qtd_questionamentos_abertos`, `atrasado boolean`; keyset por `(created_at DESC, id)`. `compras_indicadores(p_de, p_ate)`: KPIs da D9 num único `jsonb`. · Dep.: B7 · Aceite: retorno validado contra contagens manuais (Q3).
- [~] **P2** · Performance · migrations 24–26 · (REVISÃO ESTÁTICA FEITA, ver Anexo G; `EXPLAIN ANALYZE` com 5 mil pedidos e advisors pendentes de banco) · `EXPLAIN ANALYZE` das RPCs com 5 mil pedidos sintéticos (em transação com ROLLBACK); avaliar índice GIN `jsonb_path_ops` em `itens` só se a busca por item passar de 200 ms; advisors sem alertas novos. · Dep.: B8 · Aceite: `compras_listar_pedidos` p95 < 150 ms; `compras_indicadores` < 300 ms.

### Onda 5: Front-end de Compras

- [x] **F14** *(front concluído; depende de aplicar migrations 24–26)* · Especialista Frontend · `utils/permissoes.js`, `src/contexts/AuthContext.jsx` L177–196, `src/App.jsx` L65–75, `ExecucaoDashboard.jsx` (PAGINAS_VALIDAS, `currentPage` L75, `renderPage`), `ExecucaoSidebar.jsx` · `NIVEIS.COMPRAS='COMPRAS'`, `isCompras()`, `podeVerCompras()`, `PAGINAS_COMPRAS=['compras','pops']`; `paginaInicial` → `compras` para COMPRAS; guarda de página por perfil (admin, compras, técnico); `menuItemsCompras`; item "Compras" na seção Gestão dos admins; AuthContext devolve `['execucao','execucao/compras','execucao/pops']` para COMPRAS e inclui `execucao/compras` em `paginasExecucao`. · Dep.: B6 · Aceite: COMPRAS cai direto em Compras; técnico recebe "minhas-atividades" se tentar `#/execucao/compras`.
- [x] **F15** *(front concluído; depende de aplicar migrations 24–26)* · Especialista Frontend · `services/supabase/execucaoCompras.js` (novo), `services/index.js` · Wrappers das RPCs da B7/B8 seguindo o contrato `{ success, data, message }`. · Dep.: B7, B8 · Aceite: `npm run check:contract` ok.
- [x] **F16** *(front concluído; depende de aplicar migrations 24–26)* · Especialista Frontend (com UI/UX) · `components/compras/*` (novos), `ExecucaoDashboard.jsx` (lazy `DashboardCompras`) · Implementar o Anexo D: `IndicadoresCompras` (cards), `FilaCompras` (kanban ≥ 1280 px, abas abaixo disso), lista com `FiltroPeriodo` (F4) e filtros da B8, paginação "Carregar mais", `DetalhePedidoCompras` (drawer/tela cheia no mobile) com itens (destaque do item questionado), `HistoricoPedido` reutilizado (com F3), conversa e ações; `ModalQuestionamento` (tipo, pergunta, sugestão nome/qtd/un usando `CampoQuantidade` da F2). Realtime: canal `postgres_changes` em `execucao_pedidos_material` e `execucao_pedidos_questionamentos` com debounce de 500 ms → `refresh()` (padrão de `useAtualizacaoAoVivo.js`). · Dep.: F14, F15, F2, F3, F4, UX2 · Aceite: R8.
- [x] **F17** *(front concluído; depende de aplicar migrations 24–26)* · Especialista Frontend · `pedido-material/QuestionamentosPedido.jsx` (novo), `PedidoMaterial.jsx`, `ListaPedidos.jsx`, `FormularioPedido.jsx` · Na gestão: selo "❓ N questionamentos" e filtro "Com questionamento pendente" na lista; no pedido, a conversa com botões **Aprovar sugestão**/**Reprovar** + observação (obrigatória ao reprovar); depois de responder, recarregar itens e histórico; mostrar `status_compra` como badge. · Dep.: B7, F15 · Aceite: R7 pelo lado do solicitante.
- [x] **F18** *(front concluído; depende de aplicar migrations 24–26; destino da notificação em `compras/navegacaoCompras.js`, pois `tecnico/navegacaoNotificacao.js` está fora do escopo desta instância)* · Especialista Frontend · `tecnico/navegacaoNotificacao.js` L9–40, `NotificacoesDropdown.jsx` L28–50, `hooks/useBadgesMenu.js` · Ícones/cores para `compra_questionamento`, `compra_resposta`, `compra_status`; `destinoDaNotificacao` com `ref.pedido_id` → `compras` (COMPRAS) ou `pedido-material` (admin), abrindo o pedido (guardar `pedidoId` em `sessionStorage`, como faz com `atividadeId`); badge no menu "Compras" (questionamentos respondidos não lidos) e "Pedido de Material" (questionamentos abertos para mim). · Dep.: F14, B7 · Aceite: clicar na notificação abre o pedido certo.

### Onda 6: Qualidade, performance e documentação

- [ ] **Q1** · Especialista QA · §7.1 · POPs, pedido (cliente, quantidade, histórico, filtro). · Dep.: F1–F5 · Aceite: todos os casos ✅.
- [ ] **Q2** · Especialista QA · §7.2 · Técnico: conclusão (obs/hora/geo, online/offline, permissão negada), passos/sub-etapas, Meu Dia, notificações, vídeo/áudio nas 3 plataformas. · Dep.: F6–F12, B1–B4 · Aceite: todos ✅ + Anexo B atualizado.
- [ ] **Q3** · Especialista QA · §7.3 · Compras ponta a ponta com 3 usuários (COMPRAS, ADMIN_EXECUCAO, TECNICO), RLS negativa, Realtime em 2 abas. · Dep.: F14–F18 · Aceite: todos ✅.
- [ ] **Q4** · Especialista QA · Anexo C · Responsividade do Planejamento em 360/768/1024/1440 px (Chrome DevTools + 1 Android + 1 iPad, se disponível) · Dep.: F13 · Aceite: checklist 100%.
- [~] **P3** · Performance · build · (FEITO em 2026-11-01, ver Anexo G: `DashboardCompras` e `TextoFormatado` fora do chunk inicial ✅; Lighthouse mobile pendente) · `npm run build`: comparar tamanho dos chunks; `DashboardCompras` e `TextoFormatado` não podem entrar no chunk inicial do técnico; Lighthouse mobile do Meu Dia sem regressão > 5 pontos. · Dep.: Ondas 3 e 5 · Aceite: relatório anexado.
- [ ] **D1** · Documentacao · ver §9 · Atualizar docs, snapshot do schema e grafo. · Dep.: todas · Aceite: §9 concluída.

---

## 7. Plano de testes (QA)

> Ambiente: projeto Supabase de homologação ou transação com `ROLLBACK` para cenários SQL. Antes de cada rodada: `npm run lint`, `npm run build`, `npm run check:contract`.

### 7.1 POPs e Pedido de material
1. POP com descrição de 3 parágrafos + lista `-` + lista `1.`: gestão × técnico em 360 px e 1440 px → idênticos; texto `<b>x</b>` aparece literal.
2. Novo pedido sem cliente → bloqueado (se N1-c = obrigatório); com cliente → aparece na lista e no histórico ("Criação").
3. Unidade `un`: seta ↑ 1→2→3; digitar `2,5` → erro/normaliza conforme N1-b; trocar `m` 2,5 → `un` = 3 com aviso; `m`: seta 1→1,1.
4. Apagar a quantidade inteira → campo vazio; salvar → erro no item; digitar 4 → salva 4.
5. Editar pedido: adicionar 1 item, remover 1, trocar a qtd de outro → histórico mostra os 3 grupos corretamente; abrir histórico de pedido antigo (antes da B5) → diff por nome funciona.
6. Filtro "7 dias" e personalizado nas bordas (pedido criado 23:30 do último dia aparece; fuso SP).
7. Template: mesmos testes 3–4.

### 7.2 Técnico, sub-etapas e notificações
1. **Sub-etapas (SQL e UI):** obra de teste com Pai A (atividade própria) + subs A1, A2: (a) marcar A1 → A1 concluída, A **em_andamento**; (b) concluir a atividade de A com A2 aberta → A **em_andamento** + selo "Passos pendentes"; (c) marcar A2 → A **concluida**; (d) reabrir A2 (admin) → A volta para **em_andamento**. Pai B com **uma** sub B1 com atividade própria antiga: concluir B1 → B só conclui se a atividade de B também estiver concluída. Sub cancelada não conta.
2. Fallback por nome: atividade sem `etapa_id` com título igual ao de 2 etapas → não vincula; com 1 etapa folha na mesma data → vincula.
3. Conclusão online: sem campo de horas/horário; `fim_real_em` ≈ `now()` (±5 s); `conclusao_origem_horario='servidor'`; lat/long preenchidas; observação no histórico e na notificação do admin.
4. Conclusão offline (modo avião): concluir 10:00, sincronizar 10:30 → `fim_real_em` = 10:00, origem `dispositivo`, `conclusao_registrada_em` = 10:30.
5. Permissão de localização negada → conclui com aviso; `conclusao_geo_status='negada'`. Tempo esgotado (GPS desligado) → `tempo_esgotado` em ≤ 8 s.
6. Fila antiga: item de outbox com payload sem os campos novos (simular via IndexedDB) → sincroniza sem erro.
7. `horas_realizadas` = soma dos intervalos (iniciar 08:00, pausar 10:00, retomar 13:00, concluir 15:00 → 4 h).
8. Meu Dia: concluir uma atividade → some de "Hoje", aparece em "Concluídas hoje (1)" recolhida; contador "Concluídas: 1 de N" correto; todas concluídas → estado vazio de sucesso.
9. Reprogramar etapas (admin, `ReprogramarModal`) → técnico não recebe notificação (sino, Pendências, Realtime). Notificações antigas de replanejamento não aparecem.
10. **Vídeo/áudio** (Android Chrome, iOS Safari ≥ 15, PWA instalado, desktop Chrome): gravar vídeo 10 s e 60 s (corte automático), áudio 30 s; enviar; ver na gestão. Negar câmera/microfone → mensagem de permissão. Forçar ausência de `MediaRecorder` (DevTools: `delete window.MediaRecorder`) → fallback nativo. Arquivo nativo > 45 MB → mensagem de limite. Deploy novo com app aberto → gravador carrega ou pede atualização.
11. Regressão: iniciar/pausar/retomar, falta de material, evidência de foto, horas extras.

### 7.3 Compras
1. Usuário COMPRAS: login → cai em Compras; menu só com Compras/POPs; `#/execucao/planejamento-macro` → redireciona.
2. RLS negativa (via `supabase-js` no console com o token): COMPRAS `update`/`delete` em `execucao_pedidos_material` → negado; TECNICO `select` em pedidos/questionamentos → 0 linhas; COMPRAS `select` em `execucao_obras` → 0 linhas.
3. Fluxo: comprador assume o pedido → `em_cotacao` → abre questionamento "Disjuntor 63A → sugestão 50A, 2 un" → solicitante (admin) recebe a notificação em tempo real → aprova com observação → item vira "Disjuntor 50A", histórico `questionamento` com diff, comprador é notificado, status volta para `em_cotacao`. Repetir com **reprovar** (observação obrigatória) → item inalterado.
4. Dois questionamentos abertos: responder 1 → continua `aguardando_solicitante`; responder o 2º → volta ao status anterior.
5. Solicitante TECNICO (pedido de falta de material) → notificação vai para os admins; admin responde.
6. `compras_definir_disponibilidade` em pedido com obra → etapa "📦 Chegada dos Materiais" criada uma única vez; técnicos da obra recebem "Material disponível" (trigger atual).
7. `entregue` → `status` legado = `entregue`, `data_entrega` preenchida; não aparece mais em "Listas de obras pendentes".
8. KPIs conferidos com SQL manual para o período; filtros combinados; "Carregar mais" sem duplicar.
9. Realtime: 2 abas (comprador e admin) → mudanças aparecem em ≤ 3 s sem F5.
10. Mobile 360 px: abas, detalhe em tela cheia, modal de questionamento usável.

---

## 8. Riscos e rollback

| Risco | Prob./Impacto | Mitigação | Rollback |
|-------|---------------|-----------|----------|
| Mudar `alterar_status_atividade` (assinatura + regras) quebra a fila offline ou outras telas | Média/Alta | Parâmetros novos com DEFAULT; `DROP` só das assinaturas listadas na B0; teste 7.2-6; B1 e B2 aplicadas em sequência na mesma janela | Reaplicar a função da mig. 16 (cópia literal no bloco `-- ROLLBACK:` da mig. 20) e remover as colunas novas só depois de exportar os dados |
| Reabrir etapas pai altera o progresso das obras e indicadores | Média/Média | Prévia com SELECT aprovada pela N1-i; executar fora do horário comercial; `execucao_auditoria` registra antes/depois | `execucao_desfazer` (mig. 07) por registro de auditoria, ou UPDATE inverso a partir da prévia salva |
| Remover a cascata deixa sub-etapas antigas eternamente abertas | Média/Média | Passos marcáveis (F9) + selo "Passos pendentes" (F10); admin pode concluir sub-etapa no Planejamento | Reintroduzir a cascata opcional por flag em `configuracoes_sistema` |
| Remover "Horas realizadas" distorce desempenho/risco de horas | Média/Média | ⛳ N1-d; cálculo por histórico com teto diário; gestão pode ajustar | Voltar o `CampoHoras` no modal (o RPC continua aceitando `p_horas_realizadas`) |
| Geolocalização: LGPD/privacidade e atraso no clique | Baixa/Média | Coleta só no clique, texto informativo, timeout 6 s, aquecimento ao abrir o modal, nunca bloqueia | Enviar `geoStatus='nao_suportado'` por flag no front |
| Backfill de `itens.id` grande ou poluindo a auditoria | Baixa/Média | Trigger de auditoria desativado só durante o backfill; UPDATE em lotes de 1.000 | Itens com `id` extra são inofensivos; dropar o trigger |
| Novo nível COMPRAS com acesso indevido | Baixa/Alta | Escrita só por RPC, `is_usuario_execucao()` inalterada, testes de RLS negativos (7.3-2), advisors | `DROP POLICY` das novas policies + desativar o nível (`niveis_acesso`) |
| Realtime com RLS em mais tabelas aumenta a carga (plano gratuito) | Baixa/Média | Canais filtrados, debounce, só na página de Compras/Pedidos | Remover as tabelas da publicação `supabase_realtime` |
| Evidências: causa diferente por plataforma | Alta/Média | F0 com aparelhos reais; fallback nativo sempre disponível | Esconder botões Vídeo/Áudio por flag e manter foto |
| Responsividade quebra o layout desktop | Média/Média | Um PR por fatia (F13 a–d), prints antes/depois do Q0 | Reverter o PR da fatia |
| Divergência entre o snapshot do schema e o banco | Média/Baixa | D1 regenera o snapshot e o grafo ao fim de cada onda de backend | n/a |

**Ordem segura de deploy:** migrations 19 → 20 → 21 → (22) → 23 junto com o front das Ondas 1 e 3; depois 24 → 25 → 26 junto com o front da Onda 5. O front da Onda 1 pode ir antes de qualquer migration (não depende do banco), exceto a parte "Cliente" da F5, que já usa uma coluna existente.

---

## 9. Documentação a atualizar (D1)

- `README.md` (seção Execução): nível **COMPRAS**, página Compras, fluxo de questionamento, regra de conclusão de sub-etapas, dados capturados na conclusão (hora/local/observação) e aviso de privacidade.
- `.github/copilot-instructions.md`: módulo Execução → página Compras, novas RPCs e o service `execucaoCompras.js`.
- `IMPLEMENTACAO_MELHORIAS_EXECUCAO.md`: nova seção "Nov/2026: Melhorias Execução + Compras" com o que foi feito e as decisões da §3.1.
- `AUDITORIA_DASHBOARD_EXECUCAO.md`: marcar como resolvidos o bug de sub-etapas, a notificação de replanejamento e vídeo/áudio.
- `supabase/schema/tables.sql` e `logic.sql`: regenerar pelo procedimento do `supabase/schema/README.md` e rodar `npm run graph:update`.
- Comentário de cabeçalho em cada migration nova (objetivo + `-- ROLLBACK:`).
- Guia rápido do comprador (seção no README ou `docs/compras.md`, se a pasta existir): como assumir pedido, questionar e acompanhar.

---

## 10. Ordem de execução e ondas de delegação

| Onda | Tarefas (paralelas dentro da onda) | Agentes | Depende de | Libera |
|------|------------------------------------|---------|------------|--------|
| **0: Descoberta** | N1, B0, F0, UX1, UX2, Q0 | Negocio, Backend, Frontend, UI/UX, QA | — | Todas as demais |
| **1: Quick wins front** | F1, F2, F3, F4, F5, F6, F7 | Frontend (até 3 instâncias em paralelo: POP / Pedido / Técnico) | nenhuma (defaults da N1) | Q1; F2–F4 são base da F16 |
| **2: Backend Execução** | B1 → B2 (sequenciais, mesma função); B3, B4*, B5 em paralelo; P1 depois de B1/B2 | Backend, Performance | B0 (B4 também F0) | Onda 3; B5 libera B6 |
| **3: Front técnico + Planejamento** | F8 (após B2), F9 (após B1), F10 (após B1+N1), F11 (após F0/B4), F12 (após B2), F13 (após UX1, **pode começar já na Onda 1**) | Frontend, UI/UX (revisão F13) | Onda 2 / UX1 | Q2, Q4 |
| **4: Backend Compras** | B6 → B7 → B8 (sequenciais); P2 | Backend, Performance | N1, B5 | Onda 5 |
| **5: Front Compras** | F14 e F15 em paralelo → F16, F17, F18 em paralelo | Frontend, UI/UX (revisão F16) | Onda 4, F2–F4, UX2 | Q3 |
| **6: Qualidade e docs** | Q1 (já após a Onda 1), Q2, Q3, Q4, P3, D1 | QA, Performance, Documentacao | ondas anteriores | Release |

\* B4 só se o diagnóstico B0/F0 apontar bucket/mime/limite.

**Caminho crítico:** N1/B0 → B1 → B2 → F8/F9 → Q2 · e em paralelo · B5 → B6 → B7 → B8 → F15 → F16 → Q3.

---

## 11. Fora do escopo (v2)

- Resposta do técnico a questionamentos pelo app de campo.
- Exportação CSV/PDF e gráficos (ECharts) no Dashboard de Compras; cotações com fornecedores e valores.
- Vínculo do pedido avulso a uma obra (`obra_id`) pelo formulário (hoje só `cliente_nome`).
- Mapa com a trilha de localização das conclusões.

---

## Anexo A: Resultados do diagnóstico de banco (B0, executada em 01/11/2026)

> **B0 concluída** pelo orquestrador (via MCP do Supabase, somente leitura) com as consultas de `supabase/manutencao/diagnostico_B0.sql`. A coluna "Esperado" da versão anterior foi substituída pelos resultados reais.

| Item | Resultado |
|------|-----------|
| Bucket `atividades-evidencias` (public, limit, mimes) | `public = false`, `file_size_limit = 52428800` (50 MiB), `allowed_mime_types = NULL`. **A causa #3 do Anexo B (415 por mime restrito) está descartada.** A migration 22 foi aplicada só para garantir o estado. |
| Limite global de upload do projeto | Não consultável por SQL (Dashboard > Storage > Settings); a conferir pelo dono. |
| Assinaturas de `alterar_status_atividade` | Só existia **1** assinatura, a de 8 parâmetros. Depois da migration 20: **1** assinatura, a de **13** parâmetros (conferido em `pg_proc`, 01/11/2026). |
| Triggers de `execucao_pedidos_material` | `trg_auditar` (auditoria) e `trg_avisar_material`. Depois das migrations: + `trg_pedidos_itens_id`, `trg_pedidos_compras_sync`, `trg_pedido_avisar_edicao`, `trg_pedido_fechar_questionamentos`. |
| Caminho do bug de sub-etapa (i/ii/iii) e evidência | **Caminho (ii)** confirmado na obra **ED SAINT JEAN**, etapa pai "Inspeção Técnica Inicial" (24/10): a atividade da sub-etapa foi concluída e `execucao_sincronizar_etapa_pai` fechou o pai, ignorando a atividade própria do pai. Hoje o dado está coerente. A migration 19 corrige a regra. Reproduzido o cenário correto no teste de fumaça (F.10). |
| Qtde. de pais concluídos com sub-etapa aberta | **0.** As consultas 5b e 5c (pais com sub-etapa aberta; pais com atividade própria aberta) vieram vazias: **nenhuma etapa pai indevida**, então o script `corrigir_etapas_pai_concluidas.sql` **não precisou rodar**. |
| Qtde. de notificações `replanejamento` com destinatário | **3** não lidas com destinatário; a migration 21 as marcou como lidas. |
| Pedidos de material | 5 pedidos: 4 `concluido` e 1 `pendente` (falta de material); 3 tinham item sem `id` (a migration 23 gerou os ids). |
| Níveis de acesso existentes antes da 24 | Administrador, Usuário, COMERCIAL, ORÇAMENTISTA, ADMIN_EXECUCAO, TECNICO, Arsenal de Guerra (a 24 criou COMPRAS). |
| Tipos de `tipo_acao` do histórico | Todos dentro da lista nova da migration 19. |

### Consultas prontas (somente SELECT) para a reexecução da B0

> **Versão completa e atualizada: `supabase/manutencao/diagnostico_B0.sql`** (o item 4 passou a usar `execucao_auditoria` por transação para classificar o caminho i/ii/iii; os itens 5 e 6 trazem lista e contagem; há conferências extras). O bloco abaixo é a versão simplificada original.

```sql
-- (1)
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='atividades-evidencias';
-- (2)
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='alterar_status_atividade';
-- (3)
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid='public.execucao_pedidos_material'::regclass and not tgisinternal;
-- (5) pais concluídos com sub-etapa não concluída (ignora canceladas) + lista para a correção
select p.id as pai_id, p.nome as pai, o.id as obra_id, o.nome_cliente,
       s.id as sub_id, s.nome as sub, s.status as sub_status, p.updated_at as pai_concluido_em
  from public.execucao_obras_etapas p
  join public.execucao_obras_etapas s on s.etapa_pai_id = p.id
  join public.execucao_obras o on o.id = p.obra_id
 where p.status = 'concluida' and s.status not in ('concluida','cancelada')
 order by p.updated_at desc;
-- (4) pais concluídos nos últimos 30 dias dentro de 5 s da conclusão de uma sub-etapa/atividade dela
--     (a coluna de data/ator de execucao_auditoria deve ser confirmada via list_tables antes)
select p.id as pai_id, p.nome as pai, o.nome_cliente, s.nome as sub, s.updated_at as sub_em, p.updated_at as pai_em,
       (select count(*) from public.execucao_obras_etapas x where x.etapa_pai_id=p.id and x.status<>'cancelada') as n_subs
  from public.execucao_obras_etapas p
  join public.execucao_obras o on o.id=p.obra_id
  join public.execucao_obras_etapas s on s.etapa_pai_id=p.id and s.status='concluida'
 where p.status='concluida' and p.updated_at > now() - interval '30 days'
   and abs(extract(epoch from (p.updated_at - s.updated_at))) <= 5;
-- (6)
select id, created_at, destinatario_id, atividade_id, titulo
  from public.execucao_notificacoes where tipo='replanejamento' order by created_at desc limit 20;
select count(*) filter (where destinatario_id is not null) as com_dest, count(*) as total
  from public.execucao_notificacoes where tipo='replanejamento';
```

Para classificar o caminho no item (4): (i) o histórico mostra a atividade do pai concluída e todas as sub-etapas concluídas no mesmo instante; (ii) o pai concluído logo após a última sub-etapa, sem conclusão da atividade própria do pai; (iii) a atividade concluída tem `etapa_id` nulo antes da mig. 16 ou `execucao_atividades.etapa_id` do pai com título igual ao da sub-etapa.

## Anexo B: Diagnóstico de vídeo/áudio (preencher na F0)

> **F0 (análise estática, 2026-11-01).** Não houve reprodução em aparelho, `curl -sI` da produção (URL de produção não consta no repo) nem consulta ao bucket via MCP do Supabase (sem MCP disponível nesta sessão). As colunas abaixo são **previsões a partir do código**; o QA/dono confirma nos aparelhos (roteiro em "Pendências de confirmação"). Caminhos relativos a `src/features/execucao/components/tecnico/evidencias/` (`ev/`). Probabilidades = Jev (`noul`), apenas orientativas.

### B.1 Causas prováveis (ranqueadas)

| # | Causa | Prob. | Afeta | Evidência (arquivo:linha) |
|---|-------|-------|-------|---------------------------|
| 1 | **Áudio sem checagem de suporte e sem fallback**: o botão Áudio só é desabilitado por `bloquearNovos`, nunca por `gravadorSuportado`. Sem `navigator.mediaDevices` (contexto não seguro, WebView/PWA, Safari antigo) vira `TypeError: Cannot read properties of undefined (reading 'getUserMedia')`; sem `window.MediaRecorder` (iOS < 14.3) `escolherMime()` lança `TypeError`. A tela mostra `err.message` cru; não existe `<input accept="audio/*" capture>`. | 0,84 | iOS/Safari antigo, PWA/WebView, HTTP | `ev/EvidenciasUploader.jsx:66,110` (`gravadorSuportado` só é usado em `tocarVideo`, L78-82; o botão Áudio não); `ev/useEvidencias.js:169-187` (`iniciarAudio` não chama `suportaGravacao`); `ev/gravador.js:9` (`window.MediaRecorder.isTypeSupported` sem guarda) e `:25-26` (`default: return err?.message`); `ev/config.js:92-93` (`suportaGravacao`) |
| 2 | **Vídeo sem fallback quando a gravação falha em tempo de execução**: `tocarVideo` só usa o `<input capture>` se `suportaGravacao()` for falso. Se `getUserMedia` existir mas falhar (`NotAllowedError` no PWA iOS/Android, `NotFoundError`, `NotReadableError`) o usuário fica numa tela cheia com a mensagem e só pode cancelar; o input nativo não é acionado. | alta (0,7–0,8, estimativa) | PWA instalado, permissão negada/bloqueada, iOS | `ev/EvidenciasUploader.jsx:78-82` (`tocarVideo`); `ev/GravadorVideo.jsx:37-39` (`catch` só `setErro`); `ev/gravador.js:30-42` (`abrirMidia`) |
| 3 | **Bucket com `allowed_mime_types` restrito fora das migrations** → Storage responde `415 mime type … is not supported`. A migration cria o bucket **sem** `allowed_mime_types` (NULL = tudo permitido) e o `ON CONFLICT DO UPDATE` só ajusta `public`/`file_size_limit`; se o bucket já existia ou foi editado no painel (ex.: só `image/*`), a restrição persiste. Foto passa (webp/jpeg); vídeo/áudio falham **no envio após a conclusão**, aparecendo como "Erro no envio" com texto cru em inglês (o 415 não tem mensagem própria; só cai em permanente via regex `mime type`). Sintoma coerente com "só foto funciona". | 0,58 (depende do painel) | Todas | `supabase/migrations/20261023_05_execucao_rpcs.sql:409-411` (sem `allowed_mime_types`); `ev/filaUpload.js:113-119` (`ehPermanente`), `:121-130` (`mensagemAmigavel` só 413/401/403); `src/services/supabase/execucaoEvidencias.js:21-27` |
| 4 | **`import('./gravador.js')` fora de `try`/sem retry** → após novo deploy com PWA/SW (`registerType: 'autoUpdate'`, shell em precache) o chunk antigo some; o `import()` rejeita (`Failed to fetch dynamically imported module`/MIME html do fallback SPA). No áudio é *unhandled rejection* e o botão "não faz nada"; no vídeo a tela fica em "Abrindo a câmera…" para sempre (fase `abrindo`, sem erro). | 0,46 | PWA instalado / aba aberta há dias | `ev/useEvidencias.js:173`; `ev/GravadorVideo.jsx:27` (`await import` fora do `try` que começa na L28; `catch` L39); `vite.config.js:15-43` |
| 5 | **Headers de hospedagem (`Permissions-Policy: microphone=()/camera=()`)**: não há `vercel.json`, `netlify.toml`, `public/_headers`, `<meta http-equiv>` nem iframe no repo, e o SW não intercepta Supabase (`src/sw.js:3`). Só seria causa se a hospedagem aplicar o header por padrão/painel; **não verificável sem a URL de produção**. Sintoma seria `NotAllowedError` imediato sem prompt. | 0,2–0,48 (baixa-média; não verificado) | Todas | ausência dos arquivos (`glob`); `index.html` sem `Permissions-Policy` |
| 6 | **Limite de tamanho**: os perfis do app ficam muito abaixo de 50 MB (vídeo 60 s ≈ 9,5 MB; áudio 180 s ≈ 0,7 MB). Só o vídeo nativo longo pode estourar (`> 45 MB` é barrado no cliente com mensagem). Bucket = 52428800 B (50 MiB). | 0,23 (improvável) | Vídeo nativo | `ev/config.js:22-35`; `ev/useEvidencias.js:141-144`; `ev/filaUpload.js:31-33`; migration `:409-411` |

Riscos secundários (não causam o erro principal, mas afetam F11/B4):
- **Mime/extensão**: gravador devolve `video/webm` (Chrome/Android), `video/mp4` (Safari), `audio/webm`/`audio/mp4`; nativo iOS devolve `video/quicktime` (`.mov`) (`ev/gravador.js:5-6,71`; `ev/config.js:78-89`; `ev/useEvidencias.js:152`). Se B4 listar só webm/mp4, `.mov` dá 415. O `Content-Type` enviado vem do `blob.type` (o `contentType` do `upload()` é ignorado quando o corpo é `Blob`: `@supabase/storage-js` 2.12.1 `StorageFileApi.js:58-64` usa `FormData`); o `mimeBase()` já remove `;codecs=` (OK). Se `isTypeSupported` for falso para todos os mimes, o `MediaRecorder` é criado sem `mimeType` e o rótulo cai em `video/webm`/`audio/webm` (`ev/gravador.js:71-72`: o `Blob` recebe esse tipo), o que pode divergir do conteúdo real (ex.: MP4 rotulado `webm`) → rótulo/extensão errados e reprodução quebrada; F11 deve usar `gravador.mimeType`/`partes[0].type` e, se vazio, `video/mp4` no Safari.
- **Reprodução**: `.webm` gravado no Android não toca em iOS/Safari < 18.4 (visualização por supervisor); `autoPlay` com áudio sem `muted` é bloqueado no iOS (`ev/EvidenciasLista.jsx:52-53`). Não bloqueia o envio; tratar em F11 com link "Baixar".
- `filaUpload` só classifica 413 por código; 415 depende da regex de texto e a mensagem exibida é a crua do Storage (`ev/filaUpload.js:113-130`).
- Foto funciona porque não depende de `getUserMedia`/`MediaRecorder` (usa `<input capture>` + canvas, `ev/EvidenciasUploader.jsx:116`) e gera `image/webp|jpeg`.

### B.2 Tabela por plataforma (previsão estática)

| Plataforma | `isSecureContext` | `getUserMedia` | Mime escolhido | Erro (`name`/`message`) | Upload HTTP | Causa raiz (provável) |
|------------|-------------------|----------------|----------------|-------------------------|-------------|------------|
| Android/Chrome | `true` (HTTPS) | existe | vídeo `video/webm;codecs=vp8,opus` → `video/webm`; áudio `audio/webm;codecs=opus` → `audio/webm` | gravação OK; se bucket restrito, erro só no envio | `415` se #3 (confirmar no painel); `200` caso contrário | #3 (bucket/mime) → #4 (chunk) |
| iOS/Safari (aba) | `true` | existe (≥ 11); `MediaRecorder` só ≥ 14.3 | vídeo/áudio `video/mp4`/`audio/mp4` (webm só ≥ 18.4) | < 14.3: `TypeError` (áudio, causa #1); permissão: `NotAllowedError` (#2) | `415` se #3 (`mp4`/`m4a`, `.mov` no nativo) | #1 (áudio), #2 (vídeo), #3 |
| PWA instalado | `true` | pode existir mas prompt/permissão instável, ou `undefined` em WebView | igual à plataforma base | `NotAllowedError`/`TypeError`; `import()` quebrado após deploy (#4) | idem | #2, #4, #1 |
| Desktop/Chrome | `true` (HTTPS) / `true` (localhost) | existe | `video/webm`, `audio/webm` | `NotFoundError` sem câmera/microfone | idem | #3 |

### B.3 Conserto proposto para F11 / B4

**B4 (Backend, `20261101_22_execucao_evidencias_midia.sql`)**
1. `UPDATE storage.buckets SET allowed_mime_types = NULL, file_size_limit = 52428800 WHERE id = 'atividades-evidencias';` (mais simples e robusto; evita `415` por variação de mime). Se preferirem lista explícita: `image/jpeg, image/png, image/webp, video/webm, video/mp4, video/quicktime, audio/webm, audio/mp4, audio/mpeg, audio/ogg, audio/x-m4a, audio/aac`. Lembrar que mimes com `;codecs=` não são enviados (já removidos).
2. Conferir no painel o limite global de upload (Free = 50 MB) e registrar no Anexo A; **antes** de aplicar, anotar o `allowed_mime_types` atual (confirma/descarta a causa #3).
3. Aceite: upload manual de `.webm`/`.mp4`/`.m4a`/`.mov` de 5 MB por técnico participante = 200.

**F11 (Frontend)**
1. `config.js`: `suportaGravacao()` devolver também `window.isSecureContext` e `typeof MediaRecorder.isTypeSupported`; criar `suportaGravacaoTipo(tipo)` (`escolherMime` ≠ `''` ou `MediaRecorder` presente).
2. `gravador.js`: `escolherMime` com guarda (`window.MediaRecorder?.isTypeSupported?.`); em `onstop`, se o blob vier sem `type`, `new Blob(partes, { type: mime })` já cobre (manter), e para `mime` vazio com Safari usar `video/mp4`/`audio/mp4` conforme `navigator.vendor` apenas como rótulo; `mensagemErroMidia` ganha `NotSupportedError`/`TypeError` ("Este navegador não grava vídeo/áudio pelo app; vamos abrir a câmera/gravador do aparelho").
3. `useEvidencias.js`: `importarGravador()` com 1 retry; falha de chunk → mensagem "Atualize o app" e `location.reload()` sob confirmação; mover o `import()` para dentro do `try`. `iniciarAudio`: se `!suportaGravacaoTipo('audio')` ou falhar com `NotAllowedError`/`NotSupportedError`/`TypeError`/`NotFoundError` → `setErro(msg)` + abrir `inputAudio.click()`. Nova `capturarAudioArquivo(arquivo)` (limite `CFG.audio.maxBytes` = 10 MB, duração via `<audio preload=metadata>`, `origem: 'gravador_nativo'`, sem recompressão), espelhando `capturarVideoArquivo` (`:138-170`).
4. `EvidenciasUploader.jsx`: novo `<input ref={inputAudio} type="file" accept="audio/*" capture hidden>` (em Android `capture` abre o gravador de voz; no iOS cai no seletor/Memos). Em `tocarVideo`, quando `GravadorVideo` falhar (erro de abertura/`NotAllowedError`/`NotSupportedError`) chamar `onFallback` → fechar o gravador e `inputVideo.current.click()` (já existe, `:117`), mantendo a mensagem. Exibir aviso persistente "Câmera/microfone bloqueado: use o botão do aparelho" quando `!isSecureContext`.
5. `GravadorVideo.jsx`: tirar `await import()` de fora do `try` (`:27`), adicionar `fase: 'erro'` com botões **"Usar câmera do aparelho"** e **"Fechar"**; timeout de 10 s em `abrindo` → erro.
6. `filaUpload.js`: `ehPermanente`/`mensagemAmigavel` tratam `415` ("Formato não aceito pelo servidor; o time já foi avisado" + manter "Tentar de novo") e `413` ("Arquivo maior que o limite de 50 MB"); traduzir `mime type … not supported`. Se o item falhar com 415 e o mime for `video/quicktime`/`audio/x-m4a`, opção de reenviar com rótulo `video/mp4`/`audio/mp4` (sem recodificar) — só se B4 optar por lista explícita.
7. Limites/mensagens para o plano gratuito (50 MB/arquivo, 1 GB total): manter vídeo app 60 s ≈ 9,5 MB, áudio 180 s ≈ 0,7 MB; nativo `video` ≤ 45 MB (já), nativo `audio` ≤ 10 MB; mensagem de limite deve dizer o tamanho enviado, o limite e a ação ("grave um vídeo mais curto ou reduza a qualidade da câmera nas configurações"). Avisar quando o contador de armazenamento (a coletar em B0/Anexo A) passar de ~80 % de 1 GB.

### B.4 Pendências de confirmação (roteiro curto para F0/Q2)
1. Painel Supabase → Storage → `atividades-evidencias` → anotar `allowed_mime_types`, `file_size_limit`, *public* (ou `select id, allowed_mime_types, file_size_limit from storage.buckets;` na B0).
2. No aparelho com erro: abrir `chrome://inspect`/Web Inspector e registrar `window.isSecureContext`, `!!navigator.mediaDevices?.getUserMedia`, `!!window.MediaRecorder`, `isTypeSupported` de cada mime em `ev/gravador.js:5-6`, e o `err.name/message` mostrado; na aba Rede, status do `POST /storage/v1/object/atividades-evidencias/...` (`415`/`413`/`403`/`200`).
3. `curl -sI <url-prod>` para `Permissions-Policy`, e se `Content-Type` do chunk `gravador-*.js` retorna `text/javascript` (e não `text/html`).

| Plataforma | `isSecureContext` | `getUserMedia` | Mime escolhido | Erro (`name`/`message`) | Upload HTTP | Causa raiz (confirmada) |
|------------|-------------------|----------------|----------------|-------------------------|-------------|------------|
| Android/Chrome | | | | | | |
| iOS/Safari | | | | | | |
| PWA instalado | | | | | | |
| Desktop/Chrome | | | | | | |

## Anexo C: Especificação de responsividade do Planejamento Macro (preenchido pela UX1)

### C.1 Achados confirmados no código

| ID | Onde | Problema | Gravidade |
|---|---|---|---|
| A1 | `PlanejamentoMacro.jsx` L626–660 | Abas sem `flex-wrap` nem rolagem: ≈350 px contra 328 px úteis em 360. Altura de ≈38 px. | Alta |
| A2 | `PlanejamentoMacro.jsx` L715–770 | 4 selects com `text-sm` (14 px, o iOS dá zoom) e `py-1` (≈30 px). Busca com `w-48` fixo e 3–4 botões em fila. | Alta |
| A3 | `PlanejamentoMacro.jsx` L668–690; `PautaSemanalBotao.jsx` | Select de período e botão da pauta sem largura fluida e sem altura mínima. | Média |
| A4 | `ObraCard.jsx` L45–140 | Cabeçalho em **uma linha só**; estoura a página em 360 px (viola R9). Botões `-sm` de ≈32 px e chevron sem área de toque. | **Crítica** |
| A5 | `GanttObra.jsx` L22 | `opacity-0 group-hover:opacity-100`: ações invisíveis em toque. Botões `p-1` de ≈24 px. | **Crítica** |
| A6 | `GanttObra.jsx` L181 (`w-64`) × L216/L365 (`w-72`) × L439 (`288px`) | **Bug:** o cabeçalho de meses fica 32 px desalinhado das barras. | Alta |
| A7 | `GanttObra.jsx` L216/L365 | Coluna do nome não é `sticky` e tem fundo translúcido. | Alta |
| A8 | `GanttObra.jsx` L127, L157–167 | `chartMinWidth` inclui os 288 px do rótulo, então a trilha útil em 768 px é ≈512 px. Zoom com `p-1.5` ≈ 24 px. | Média |
| A9 | `GanttObra.jsx` L21–26, L329 | Branco sobre `sky-500` = 2,77, `emerald-500` = 2,54, `indigo-400` = 2,98, `red-500` = 3,76. "HOJE" em 8 px. `animate-pulse` sem `motion-reduce`. | Alta |
| A10 | `ResumoEtapas.jsx` L229–300 | O toggle de 5 visões não cabe em 360 px. A visão ativa `bg-sky-500` tem 2,77. | Alta |
| A11 | `ResumoVisaoSemana.jsx` L10 | `min-w-[900px]` em contêiner rolável (ok), mas com texto de 9–10 px. | Média |
| A12 | `ResumoVisaoMes.jsx` | `grid-cols-7` sem mínimo: ≈46 px por dia, botões de 9 px e alvo de ≈14 px. | Alta |
| A13 | `ResumoVisaoLinhaDoTempo.jsx` L10 | Rótulo fixo de 270 px deixa ≈58 px de trilha em 360. | Alta |
| A14 | `ResumoVisaoTabela.jsx` | `min-w-[900px]` com 1ª coluna `sticky`: **já correto**, serve de modelo. | — |
| A15 | `PainelCarteira.jsx`; `visao.css` | Grade `auto-fit minmax(10.5rem)` vira 1 coluna × 7 cartões em 360. | Média |
| A16 | `visao.css`; `execucao.css` | `visao.css` tem zero `@media`; `execucao.css` tem só 2. | Média |
| A17 | `Modal.jsx`; `execucao.css` L936+ | `90vh` (iOS), sem tela cheia, fechar de 32 px, rodapé rola junto. Grids com `md:` já estão ok; `TemplateFormModal` L345 e `ObraFormModal` L264 usam `grid-cols-2`. | Alta |
| A18 | `ObraCard.jsx` L66; `AlertasEtapasAtrasadas.jsx` L48 | `animate-pulse` sem `motion-reduce`. | Baixa |
| A19 | `execucao.css` L611, L698 | Input com `outline:none` e anel a 20%; borda azul sobre `#334155` = 2,82. | Média |
| A20 | `execucao.css` L771–815 | Badges: blue 3,29, red 3,40, purple 3,12, orange 4,27. | Alta |
| A21 | `execucao.css` L492, L513 | `btn-success` = **2,28**; `btn-primary` = 3,68/3,96. | Alta |
| A22 | `ObraCard.jsx`; `AlertasEtapasAtrasadas.jsx` | Cabeçalhos são `<div onClick>`. | Média |

### C.2 Breakpoints e grid por faixa

Os breakpoints seguem o Tailwind do projeto: sm 640, md 768, lg 1024, xl 1280.

| Faixa | Viewport | Alvo de teste | Sidebar | Largura útil | Layout |
|---|---|---|---|---|---|
| XS | <480 | **360** | gaveta | 328 | 1 coluna; KPI em 2 |
| S | 480–639 | — | gaveta | 448–608 | 1 coluna; KPI em 2 |
| M | 640–1023 | **768** | gaveta | 592–975 | 2 colunas em forms; KPI em 3–4 |
| L | 1024–1279 | **1024 e 1025** | 1024: gaveta; ≥1025: fixa (280) | 976 / 745–999 | 2–3 colunas; Gantt com rolagem |
| XL | ≥1280 | **1440** | fixa | 1.112 em 1440 | 3–4 colunas |

O CSS do módulo usa `max-width:1024px` e o Tailwind `lg:` usa `min-width:1024px`, então os dois valem juntos em 1024 exato. Por isso o QA testa 1024 e 1025.

A página nunca rola na horizontal (R9). Só rolam o Gantt, as visões Semana, Tabela e Linha do tempo, e a tabela do `ReprogramarModal`.

### C.3 Padrões transversais

**P1 · Toque ≥ 44 px.** Aplicar a todo botão, aba, ícone e checkbox do Planejamento.
```css
.plan-toque{min-height:44px;min-width:44px}
@media (hover:hover) and (pointer:fine){.plan-toque{min-height:32px;min-width:32px}}
```

**P2 · Ações visíveis em toque.** Substitui `ACOES_VISIVEIS`.
```css
.plan-acoes{display:flex;gap:.25rem;opacity:1}
@media (hover:hover) and (pointer:fine) and (min-width:1024px){
  .plan-acoes{opacity:0;transition:opacity .15s}
  .group:hover .plan-acoes,.plan-acoes:focus-within,.group:focus-within .plan-acoes{opacity:1}
}
```
O iPad em paisagem (pointer coarse) mantém as ações visíveis.

**P3 · Campos.** Abaixo de `lg`: `text-base min-h-[44px] w-full`, sem `style={{width:'auto'}}`. Em `lg`: `lg:text-sm lg:min-h-0 lg:w-auto`.

**P4 · Foco.** Em `.execucao-theme`, usar `:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}`. O `#60a5fa` tem 5,75:1 sobre `#1e293b` e 4,07:1 sobre `#334155`. Nos inputs, trocar a borda de foco para `#60a5fa`.

**P5 · Tipografia e espaçamento.**

| Uso | XS/S | M | L/XL |
|---|---|---|---|
| Título de seção | `text-lg` | `text-xl` | `text-xl` |
| Nome da obra | `text-base` | `text-lg` | `text-lg` |
| Texto informativo | mín. `text-xs` (12 px) | `text-sm` | `text-sm` |
| Rótulo decorativo | mín. 10 px | idem | idem |
| Card | `p-4` | `p-5` | `p-6` |
| Gap | `gap-3` | `gap-4` | `gap-4` / `gap-6` |

Não usar texto de 8–9 px em informação.

**P6 · Contraste (valores calculados).**

| Onde | Hoje | Passar para | Contraste |
|---|---|---|---|
| Barra em andamento | `sky-500` | `sky-700` | 5,93 |
| Barra concluída | `emerald-500` | `emerald-700` | 5,48 |
| Barra planejada | `indigo-400` | `indigo-600` | 6,29 |
| Barra atrasada | `red-500` | `red-700` | 6,47 |
| Preenchimento do progresso | `bg-white/30` | `bg-black/30` (padrão de `.visao-timeline-progresso`) | ≥4,5 |
| Visão ativa / hoje | `sky-500` | `sky-700` | 5,93 |
| Texto de badge | cor "cheia" | blue `#93c5fd` 6,72; red `#fca5a5` 6,75; purple `#d8b4fe` 6,98; orange `#fdba74` 7,10; green `#86efac` 8,02; yellow `#fde047` 8,23; gray `#cbd5e1` 8,46 | ≥6,7 |
| `btn-success` | `#22c55e` | `#15803d` (hover `#166534`) | 5,02 / 7,13 |
| `btn-primary` | `#3b82f6→#a855f7` | `#2563eb→#9333ea` | 5,17 / 5,38 |
| Texto auxiliar | `slate-500` (3,07) / `slate-600` (1,93) | `slate-400` | 5,71 |

A matiz e o gradiente ficam iguais; só o tom escurece para atingir 4,5:1. O estado nunca aparece só por cor: sempre há texto ou emoji com `aria-label`.

**P7 · Modais em tela cheia abaixo de 640 px.**
```css
@media (max-width:639px){
  .execucao-modal-overlay{padding:0;align-items:stretch}
  .execucao-modal:not(.execucao-modal-sm){max-width:none;width:100%;height:100dvh;max-height:100dvh;border-radius:0;display:flex;flex-direction:column;overflow:hidden}
  .execucao-modal:not(.execucao-modal-sm) .execucao-modal-header{flex:none;padding:.75rem 1rem;padding-top:max(.75rem,env(safe-area-inset-top))}
  .execucao-modal:not(.execucao-modal-sm) .execucao-modal-body{flex:1;overflow-y:auto;padding:1rem;padding-bottom:max(1rem,env(safe-area-inset-bottom));overscroll-behavior:contain}
  .execucao-modal-close{width:44px;height:44px}
}
```
- O rodapé fica em `.plan-rodape` com `position:sticky;bottom:0` e fundo `--bg-secondary`. Abaixo de 480 px usa `column-reverse` com botões `w-full`, como o `.tec-rodape-modal`.
- O `Modal.jsx` não muda, exceto `90vh` → `90dvh`.
- O confirm (`execucao-modal-sm`) continua centralizado.
- A mudança também afeta `ModalConcluir` e os modais de Pedido, então Q2 e Q3 revalidam.

**P8 · Contêiner rolável.** Usar `role="region"`, `aria-label`, `tabIndex={0}`, `overscroll-behavior-x:contain` e uma sombra de 16 px na borda. A 1ª coluna `sticky` precisa de fundo opaco e `z-10`.

**P9 · Movimento.** Acrescentar `motion-reduce:animate-none` e `motion-reduce:transition-none`.

**P10 · Estados.** Reaproveitar os componentes existentes:
- **Carregando:** `Carregando` com `aria-busy` e `opacity-60`.
- **Erro:** `ErroCarregamento` com `role="alert"`.
- **Vazio:** `.execucao-empty-state`.
- **Sucesso:** `toast.success`.

### C.4 Especificação por componente

Prioridade: A bloqueia R9, M importante, B acabamento. As fatias a–d são as da F13.

**C-01 · Abas (fatia a, A)**
- Contêiner: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3`.
- Tablist: `flex w-full sm:w-auto overflow-x-auto`. Cada aba: `plan-toque shrink-0 px-3 sm:px-4`.
- Em XS, "Resumo de Etapas" mostra "Resumo", com `aria-label` completo.
- Adicionar `aria-controls`, `role="tabpanel"` e setas ←/→ (roving tabindex).
- Em 360 as 3 abas somam ≈284 px e cabem.

**C-02 · Pauta da semana (fatia a, M)**
- Linha inteira em XS: `grid grid-cols-[1fr_auto] gap-2 w-full sm:flex sm:w-auto`.
- Select com `text-base min-h-[44px]`; botão com `plan-toque`.
- "Gerando…" com `aria-busy` e `disabled`.

**C-03 · Alertas de atrasadas (fatia a, M)**
- O título vira `<button aria-expanded aria-controls>` com `w-full plan-toque`.
- Linha da etapa: `flex-col gap-2 sm:flex-row`; botão "ver" com `w-full sm:w-auto`.
- Usar `max-h-[50dvh] sm:max-h-64`, sino com `motion-reduce` e o dia de atraso em texto ("7 d de atraso").

**C-04 · Filtros da aba Obras (fatia a, A; Jev: gaveta, 0,98)**
- **≥1024:** inline, como hoje, com P3.
- **640–1023:** `grid grid-cols-2 gap-3`, busca em `col-span-2`.
- **<640**, em 3 níveis:
  1. Busca `w-full` + botão **🔎 Filtros (n)**, com `aria-haspopup="dialog"` e `aria-label="Filtros, 2 ativos"`.
  2. **➕ Nova Obra** primário em `w-full`.
  3. `grid-cols-2`: ⚡ Serviço rápido e 📋 Revisar pendentes (n). Sem pendentes, o Serviço rápido ocupa as 2 colunas.
- **Gaveta** (`FiltrosObrasGaveta`, reaproveita o `Modal` em tela cheia):
  - Campos empilhados: Período, Status, Situação, Ordenar e ☑ Ocultar serviços rápidos (`.tec-check` de 44 px).
  - Os filtros aplicam na hora. O rodapé tem `[Limpar filtros]` e `[Ver N obras]`, este com `aria-live="polite"`.
- Chips removíveis dos filtros ativos usam `.visao-filtro-ativo`, com ✕ de 44 px e `aria-label` (M).
- ⚖️ A Pauta da semana fica fora da gaveta, porque gera PDF e não é filtro.

**C-05 · Resumo de Etapas (fatia a, A)**
- **≥768:** grupo de botões com `aria-pressed`; o ativo usa `bg-sky-700`.
- **<768:** `<select aria-label="Visualização">` `w-full text-base min-h-[44px]`. ⚖️ A alternativa de rolar o grupo foi descartada porque esconde opções.
- Equipe e Ordenar: `grid-cols-2` em XS/S.
- Exportar: `grid-cols-2 w-full sm:w-auto`.
- Totais: `grid-cols-2 sm:flex-wrap`.
- Navegação: `grid-cols-[44px_1fr_44px]`, "Hoje" em segunda linha, com `aria-label` ("Semana anterior" etc.).

**C-06 · Painel da carteira (fatia a, M)**
- Grade: XS/S 2 colunas, M 3, L/XL mantém `auto-fit`. Cartões "Pendências" e "Horas a executar" em `grid-column:1/-1` em XS/S. Valor de 1,5 rem em XS.
- O cartão ativo ganha ✓ e `font-semibold`, além do anel.
- Carga da equipe: em coluna em XS/S; ações em `grid-template-columns:1fr 44px`.
- O fallback `.execucao-grid-4` usa 2 colunas em XS/S.

**C-07 · Pendências de replanejamento (fatia a, B)**
- Em coluna em XS.
- Remover `min-width:14rem` em XS.
- Ações em `grid-cols-2` com `plan-toque`.

**C-08 · Cabeçalho do `ObraCard` (fatia b, A crítico)**

Abaixo de 640 px o cabeçalho empilha em 5 linhas:
```
[🏢] Cond. Bela Vista            [⌄]  ← nome quebra linha + chevron 44px
⚑ Alta [Em andamento] [Em risco]      ← badges com flex-wrap
📅 12/03/2026 – 30/04/2026 · 7 sem · SP
▓▓▓▓▓▓░░░░ 62%                        ← barra + % lado a lado
[⏩ Reprogramar][✏️ Editar][🗑 Excluir] ← grid-cols-3, 44px, com aria-label
```
- **M:** 2 linhas; ações só com ícones e `plan-toque`.
- **≥1024:** 1 linha, como hoje.
- **Todas as faixas:** `min-w-0 break-words` no nome. A área do título vira `<button aria-expanded aria-controls>`. O selo "Atrasada" ganha `motion-reduce`. "Adicionar Etapa" fica `w-full sm:w-auto`.

**C-09 · `GanttObra` a partir de 640 px (fatia b, A)**
- Contêiner em região rolável (P8).
- **A6:** uma só largura de nome, `w-56` em M e `w-72` em L/XL. A linha de HOJE usa `--plan-nome-w` no lugar do `288px` fixo.
- 1ª coluna `sticky left-0 z-10` com fundo opaco (`bg-slate-800`; sub-etapas `bg-slate-900`).
- Trilha: `max(560, 640·zoom)` em M e `max(720, 800·zoom)` em L/XL.
- Zoom com `plan-toque`, mais o alternador **Semana | Mês** (22 px/dia e 5 px/dia).
- Ações com `.plan-acoes`. ⚖️ Em M, usar menu "⋯ Ações" (`aria-haspopup="menu"`, itens de 44 px), porque 5 ícones × 44 px = 220 px não cabem ao lado do nome.
- Barras com os tokens do P6, `%` em `text-xs font-bold`, e status em texto na coluna do nome. "HOJE" com 10 px mínimo e `bg-red-700`.
- Vazio: mensagem atual mais um botão "Adicionar Etapa".

**C-10 · `ListaEtapasMobile.jsx` (novo; fatia b, A; D14)**

O `ObraCard` renderiza este componente abaixo de 640 px e o Gantt a partir daí (via `matchMedia`, nunca os dois).
```
🗂 Cronograma · 8 etapas
[Todas][Em andamento][Atrasadas 2]       ← chips 44px, aria-pressed
⚡ Instalação elétrica          ▸ 3 sub
📅 12/03–20/03 · 👤 Carlos
[🔴 Atrasada · 3 d] ▓▓▓▓▓░░ 60%
⏱ 12 h/20 h · início real 14/03 (+2 d)
[ Ações ▾ ]  → [➕ Sub-etapa][📅 Atividade][✏️ Editar]
               [⏩ Empurrar][🗑 Excluir]
 ↳ Passagem de cabos (sub-etapa, border-l-4 purple)
```
- `<ol aria-label>` com `<li>` em card `rounded-xl border-slate-700 bg-slate-800/60 p-3`.
- Progresso com `role="progressbar"` e `aria-valuenow`.
- Estado em texto com emoji: 🔵 Em andamento, ✅ Concluída, 🔴 Atrasada · N d, ⚪ Planejada, 🟠 Pausada.
- Ações em disclosure de 44 px, em 2 colunas. "Excluir" por último e com a confirmação existente.
- Ordenar por `ordem`/data. Vazio com "Adicionar Etapa" `w-full`. Mais de 30 etapas mostram "Mostrar mais".

**C-11 · Visão Semana (fatia c, M)**
- **≥768:** 7 colunas em contêiner rolável com cabeçalho `sticky`; texto de 12 px; hoje em `sky-700`.
- **<768:** lista por dia. O dia de hoje fica aberto; os outros são `<details>` de 44 px ("Seg 04/05 · 3 etapas"). Cada etapa é um botão `plan-toque` que abre o `AtividadeEtapaModal`.

**C-12 · Visão Mês (fatia c, A)**
- **≥768:** grade de 7 colunas, texto de 12 px, "+N mais" como botão.
- **<768:** grade compacta com o número do dia (44 px) e até 3 pontos coloridos com contador (`aria-label="Dia 12: 3 etapas"`). Tocar abre abaixo o painel "Etapas de 12/03" (mesmo componente de C-11), com `aria-pressed` e setas entre dias (M). Legenda com texto.

**C-13 · Visão Ano (fatia c, B)**
- Manter o grid atual.
- Em XS: `grid-cols-1 min-[420px]:grid-cols-2`.
- Chips de 12 px.

**C-14 · Linha do tempo (fatia c, A)**
- `LARGURA_ROTULO` responsivo: 148 px em XS/S, 220 em M, 270 em L/XL.
- Rótulo com `line-clamp-2`, região rolável focável, escala padrão **Mês** em XS.
- `.visao-timeline-pct` de 0,6 rem passa para 0,75 rem.
- Cores de saúde com ≥3:1 e sempre acompanhadas de texto.

**C-15 · Tabela (fatia c, B)**
- Já está bom. Acrescentar `role="region"` com `tabIndex=0`, `scope="col"`, `caption` `sr-only` e ações `plan-toque`.

**C-16 · Templates (fatia a, B)**
- Ações `plan-toque` e visíveis em toque.
- "Novo template" `w-full sm:w-auto`.
- Sem rolagem aninhada em XS (usar "Ver mais").

**C-17 · Modais (fatia d, A; P7)**

| Modal | Ajuste |
|---|---|
| `ObraFormModal` | L264 vira `grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3`. Listas de `SeletorContrato`/`SeletorEquipe` com `max-h-[40dvh]` e itens `plan-toque`. `PreviaEtapas` vira lista empilhada em XS. |
| `EtapaFormModal` | Só P3 e P7. |
| `TemplateFormModal` | L345 vira `grid-cols-1 pl-0` em XS e `sm:grid-cols-2 md:grid-cols-4/5`. Sem `max-h-[26rem]` em XS. Botões de reordenar/remover `plan-toque`. |
| `ReprogramarModal` | Em XS, a prévia vira cartões "Etapa · 12/03 → 14/03 (+2 d úteis)", sem rolagem interna. Campos de 3 colunas passam para 1. |
| `ServicoRapidoModal` | Só P3 e P7. |
| `RevisarContratosPendentes` | Busca `min-w-0 w-full`. Cartões com ações em `grid-cols-2 plan-toque`. |
| `AtividadeEtapaModal` | Só P3 e P7. |

**C-18 · Estados globais (fatia a, M)**
- Vazio com ícone de 40 px em XS e "Limpar filtros" quando houver filtro.
- "Mostrar mais" com `w-full sm:w-auto plan-toque`.

### C.5 Checklist de aceite (Q4)

R9 só passa com 100% ✅. "Sem rolagem da página" significa `scrollWidth <= clientWidth`. Marque ✅/❌ em cada largura: 360, 768, 1024, 1440.

| ID | Critério |
|---|---|
| G-01 | Sem rolagem horizontal da **página** em todas as abas, visões e modais. |
| G-02 | Alvos ≥44×44 px em toque e ≥32 px com mouse. |
| G-03 | Ações visíveis sem hover em toque; em 1440 com mouse aparecem em hover e foco. |
| G-04 | Campos com fonte ≥16 px abaixo de 1024. |
| G-05 | Contraste de texto ≥4,5:1 e de ícones/bordas ≥3:1, incluindo badges, barras, botão Concluir/primário e visão ativa. |
| G-06 | Foco por teclado visível, ordem de Tab lógica, Esc fecha modais e o foco volta ao gatilho. |
| G-07 | O estado nunca é só por cor. |
| G-08 | `prefers-reduced-motion` desliga o pulso. |
| G-09 | Zoom do navegador a 200% sem perda de conteúdo (1024 e 1440). |
| C-01 | 3 abas sem rolar em 360; roving com ←/→. |
| C-02 | Pauta em linha cheia e operável com o polegar. |
| C-03 | Alerta: cabeçalho é botão com `aria-expanded`; linhas empilham em XS. |
| C-04 | Gaveta com contador (<640), grade 2 colunas (M) e inline (≥1024). "Ver N obras" correto; chips removíveis. |
| C-05 | Seletor de visão vira `<select>` abaixo de 768; navegação com 44 px. |
| C-06 | Painel em 2 colunas em 360; carga da equipe empilhada. |
| C-07 | Ações de replanejamento com 44 px, sem estourar. |
| C-08 | `ObraCard` empilhado <640, em 2 linhas no M e 1 linha ≥1024. Sem estouro com nome de 60 caracteres e 3 badges. |
| C-09 | Cabeçalho de meses alinhado às barras (A6); 1ª coluna fixa e opaca; zoom e Semana/Mês funcionam; barras ≥4,5:1. |
| C-10 | `ListaEtapasMobile` com tudo acessível, progressbar ARIA e estado em texto; o Gantt não renderiza <640. |
| C-11 | Semana em lista por dia (<768) e em 7 colunas focáveis (≥768). |
| C-12 | Mês compacto com painel do dia (<768); alvos ≥44 px; sem texto informativo <12 px. |
| C-13 | Ano com 1–2 colunas em 360 e 3–4 em ≥768. |
| C-14 | Linha do tempo com rótulo de 148 px em 360 (trilha ≥170 px) e escala Mês. |
| C-15 | Tabela com 1ª coluna fixa, região rolável e `scope`/`caption`. |
| C-16 | Templates com ações de 44 px e sem rolagem aninhada em XS. |
| C-17a | 7 modais em tela cheia <640 (`100dvh`), cabeçalho e rodapé fixos, fechar de 44 px, foco preso e devolvido; o confirm segue centralizado. |
| C-17b | Formulários em 1 coluna <768, sem campos <140 px. |
| C-17c | `ReprogramarModal` em XS com cartões e sem rolagem lateral. |
| C-18 | Estados sem estourar; "Mostrar mais" com 44 px. |
| X-01 | iPad real (768 retrato / 1024 paisagem): ações visíveis; sem rolagem fantasma da página. |
| X-02 | Android real: o teclado virtual não cobre o botão primário do modal. |

### C.6 Ordem para a F13

| Fatia | Itens | Pré-requisito | Prioridade |
|---|---|---|---|
| (a) header/abas/filtros/stats | C-01…C-07, C-16, C-18, P1, P3, P4, P6 | Classes `.plan-toque`, `.plan-acoes` e a grade do painel em `visao.css` | A |
| (b) Obra + Gantt | C-08, C-09, C-10, P2, P6, P8, P9 | Hook `useMediaQuery` e correção da A6 | A |
| (c) Visões | C-11…C-15 | Fatia (a) | M |
| (d) Modais | C-17, P7 | CSS global do P7 | A |

Os tokens globais (P4 e P6) afetam todo o módulo e as telas do técnico. Entregar em um PR separado ("tokens de acessibilidade"), antes da fatia (a), com regressão visual em `MeuDia`, `Atividades` e `Pedido de material`.

## Anexo D: Wireframes Compras / Questionamento / Conclusão (preenchido pela UX2)

### D.0 Premissas e decisões

| Decisão | Resultado |
|---|---|
| Kanban a partir de 1280 px; abaixo, chips de status + lista | Conforme o plano (D9/F16). |
| Detalhe do pedido: drawer em desktop, tela cheia no mobile, **mesmo componente**, com abas Itens · Conversa · Histórico | ⚖️ decisão UX. |
| Conversa como linha do tempo de **cartões** com ações no cartão aberto | ⚖️ Jev preferiu "chat", mas com confiança 0,18. Cartões reaproveitam o visual do `HistoricoPedido` e as ações Aprovar/Reprovar ficam no próprio cartão. |
| Modal de questionamento em tela cheia no mobile | ⚖️ Jev escolheu "bottom sheet" com confiança 0,18. Adotei tela cheia por consistência com C-17/P7 (nenhum padrão novo). |
| KPIs mobile: 4 prioritários em 2×2 mais "Mais indicadores" | ⚖️ Jev 0,11, mas coerente com a redução de cliques: o comprador precisa das filas, não dos tempos médios. |
| **Sem arrastar e soltar** no kanban | Arrastar não é acessível. A mudança de status é por botão no cartão e no drawer. |
| Passos pendentes em lista de checkboxes de 44 px | Jev 0,96. |

### D.1 Tokens e vocabulário

**Status de compra** (texto + emoji; badge `bg-{cor}-500/15 text-{cor}-300 border border-{cor}-500/40`, todos ≥6,2:1):

| `status_compra` | Rótulo | Cor |
|---|---|---|
| `aguardando_compra` | 🛒 Aguardando compra | yellow-300 |
| `em_cotacao` | 🧾 Em cotação | blue-300 |
| `aguardando_solicitante` | ❓ Aguardando solicitante | purple-300 |
| `comprado` | 🛍️ Comprado | cyan-300 |
| `entregue_parcial` | 🚚 Entregue parcial | orange-300 |
| `entregue` | 📦 Entregue | green-300 |
| `cancelado` | 🚫 Cancelado | slate-300 |

**Urgência:** reaproveitar `URGENCIA_COR` (baixa/normal/alta/urgente) com texto capitalizado.

**Tipos de questionamento:** 🔄 Substituição, 🔢 Quantidade, ❓ Dúvida.

**Estados do questionamento:** 🟣 Aberto, ✅ Aprovado, ❌ Reprovado, ⚪ Cancelado.

**Formatação pt-BR:**
- Datas `dd/mm/aaaa` (`formatarDataBR`), data e hora `dd/mm/aaaa HH:mm`; relativo "há 2 h" com a data completa no `title`/`<time dateTime>`.
- Números com `toLocaleString('pt-BR')`, quantidades com vírgula (2,5).
- Durações: <1 h "45 min"; <48 h "5 h 30 min"; ≥48 h "2,5 dias".

### D.2 Desktop ≥1280 px: Dashboard de Compras

```
┌─ 🛒 Compras ─────────────────────────────── Atualizado agora ● [🔔] ─┐
│ KPIs: 8 cartões em 4 colunas × 2 linhas (padrão Cartao/visao-cartao) │
│ ┌────────────┐┌────────────┐┌────────────┐┌────────────┐            │
│ │🛒 Aguard.  ││🧾 Em       ││❓ Aguard.  ││⚠️ Atrasados│  ← clicáveis│
│ │ compra  12 ││cotação   5 ││solicit.  3 ││        2   │  (filtram)  │
│ └────────────┘└────────────┘└────────────┘└────────────┘            │
│ ┌ Comprados ┐┌ Entregues ┐┌ Tempo médio  ┐┌ Tempo médio resp. ┐     │
│ │ no período││ no período││ pedido→compra││ a questionamento  │     │
│ │    18     ││    14     ││   1,5 dias   ││     3 h 20 min    │     │
│ └───────────┘└───────────┘└──────────────┘└───────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│ Período: (Hoje)(7 dias)(●30 dias)(Mês atual)(Personalizado)          │
│ [🔎 Buscar pedido/cliente/item] [Urgência ▾] [Solicitante ▾]         │
│ [👤 Meus pedidos] [☐ Só com questionamento aberto]  [▦ Quadro|≣ Lista]│
├──────────────────────────────────────────────────────────────────────┤
│ 🛒 Aguardando (12) │ 🧾 Cotação (5) │ ❓ Aguard. sol. (3)│🛍️ Comprado │ 📦 Entregue│
│ ┌────────────────┐ │ ┌────────────┐ │                   │            │            │
│ │ Cond. Bela V.  │ │ │ ...        │ │                   │            │            │
│ │ Cabos e disj…  │ │ └────────────┘ │                   │            │            │
│ │ 🔴 Urgente     │ │                │                   │            │            │
│ │ 5 itens · 📅 limite 04/11 · ⚠️ 2 d atrasado           │            │            │
│ │ Solic.: Ana · 👤 sem comprador                        │            │            │
│ │ ❓ 1 questionamento aberto                            │            │            │
│ │ [ Assumir ]                          (ação da coluna) │            │            │
│ └────────────────┘ │                │                   │            │            │
│ [Carregar mais]    │                │                   │            │            │
└──────────────────────────────────────────────────────────────────────┘
```

**KPIs**
- Os 4 primeiros são clicáveis, usam `aria-pressed` e filtram; os 4 últimos são estáticos.
- Ordem: Aguardando compra, Em cotação, Aguardando solicitante, Atrasados / Comprados, Entregues, Tempo pedido→comprado, Tempo de resposta.
- Grade: `grid grid-cols-2 md:grid-cols-4 gap-3`. Reaproveita `.visao-cartao`.

**Quadro (kanban)**
- `grid grid-flow-col auto-cols-[minmax(216px,1fr)] gap-3 overflow-x-auto` em `role="region" aria-label="Fila de compras" tabIndex=0`. A largura útil é de 952 px em 1280 e 1.112 px em 1440.
- Cada coluna é `<section aria-labelledby>` com título, contagem e fundo `bg-slate-800/40 rounded-xl p-2`. Altura máxima `max-h-[calc(100dvh-20rem)] overflow-y-auto` por coluna.
- Cada cartão é `<article>` com um botão do título que abre o drawer. Nome acessível: "Pedido Cond. Bela Vista, urgente, 5 itens, 2 dias atrasado, 1 questionamento aberto".
- A **ação rápida** do cartão muda conforme a coluna e usa `execucao-btn-secondary`, 44 px em toque:

| Coluna | Ação rápida |
|---|---|
| Aguardando compra | **Assumir** |
| Em cotação | **Marcar como comprado** |
| Comprado | **Registrar entrega** |

- "Marcar como comprado" abre um `Modal sm` com: "Quando os materiais ficam disponíveis?" (`input type=date`, opcional, ligado à N1-m), observação e [Cancelar]/[Confirmar]. Falta de definição pendente para o Negócio (D.9).
- Cartões com questionamento aberto ganham `border-l-4 border-purple-400` e o selo ❓.
- Atrasado mostra "⚠️ 2 d atrasado" em texto, em `amber-300` (10,15).
- A coluna "Aguardando solicitante" é automática. Não tem ação rápida; o cartão mostra "Aguardando {nome}".

**Lista (alternativa)**
- Tabela `execucao-table` com as colunas: Pedido, Cliente, Solicitante, Itens, Urgência, Status, Data do pedido, Data limite, Comprador.
- Cabeçalho `sticky`, 1ª coluna com o botão que abre o drawer, e `role="region"` rolável.
- Paginação: `[Carregar mais]` com "Mostrando 50 de 183" (`aria-live="polite"`).

**Filtros**
- **Período:** `FiltroPeriodo` (F4) em `role="radiogroup"`; o personalizado mostra De/Até (`type=date`).
- Os demais filtros ficam inline em ≥1280. **👤 Meus pedidos** é um toggle pensado para quem compra.
- Filtros (menos o de status) valem no quadro e na lista; no quadro, o status são as colunas.

**Drawer de detalhe (≥768)**
- `role="dialog" aria-modal`, `fixed right-0 inset-y-0 w-full max-w-[520px]` sobre scrim, com foco preso e Esc fecha. Reaproveita o `Modal`, variante "drawer".
- A URL vai para `#/execucao/compras?pedido=ID`, para que o botão Voltar feche o drawer e o deep link da notificação (F18) funcione.
```
┌─────────────────────────────────────────┐
│ ✕  Cabos e disjuntores — Cond. Bela Vista│
│ 🧾 Em cotação  🔴 Urgente  ❓ 1 aberto   │
│ Solicitante: Ana · Comprador: Você       │
│ Pedido: 01/11/2026 · Limite: 04/11/2026  │
│ [Assumir] [Status: Em cotação ▾]         │
│ [📅 Disponibilidade] [❓ Questionar]      │
├─────────────────────────────────────────┤
│ [Itens 5] [Conversa 2] [Histórico]       │  ← tablist (padrão mobile = desktop)
│ ▌Disjuntor 63A · 2 un     ❓ Questionado │  ← border-l-4 purple + texto
│  Cabo 2,5 mm · 100 m                [❓]  │  ← [❓] por item (44px, aria-label)
│ ...                                      │
└─────────────────────────────────────────┘
```
- A aba padrão é **Conversa** se houver questionamento aberto, senão **Itens**.
- O item questionado é destacado com `border-l-4 border-purple-400 bg-purple-500/10`, selo "❓ Questionado" e texto `sr-only`.
- Histórico: o `HistoricoPedido` precisa de uma versão embutida (lista sem `Modal`); a F3/F16 extrai `ListaHistorico`.

**Estados**
- **Carregando:** esqueletos (`animate-pulse motion-reduce:animate-none`) de 8 KPIs e 3 cartões por coluna, com `aria-busy`.
- **Recarga:** `opacity-60`.
- **Vazio:**
  - por coluna: "Nenhum pedido aqui" com 🛒;
  - geral: "Nenhum pedido com esses filtros" + [Limpar filtros].
- **Erro:** `ErroCarregamento` com [Tentar novamente]. Erro parcial de KPIs usa o padrão `visao-painel-erro`.
- **Sucesso:** `toast.success` ("Pedido assumido").
- **Tempo real:** um cartão alterado recebe `ring-2 ring-sky-400/60` por 2 s (`motion-safe`). O texto "Atualizado agora" fica em `aria-live="off"`, para não narrar cada evento. Se um questionamento chegar, `toast.info` curto.

### D.3 Mobile e tablet <1280 px

```
┌───────────────────────────────┐ 360
│ ☰ 🛒 Compras             🔔   │
│ ┌───────────┐┌───────────┐    │  4 KPIs prioritários, 2×2
│ │🛒 Aguard. ││🧾 Cotação │    │
│ │ compra 12 ││        5  │    │
│ ├───────────┤├───────────┤    │
│ │❓ Aguard. ││⚠️ Atrasados│    │
│ │ solic.  3 ││        2  │    │
│ └───────────┘└───────────┘    │
│ [ Mais indicadores ▾ ]        │  disclosure 44px (os outros 4)
│ [🔎 Buscar…        ][⚙ Filtros]│  gaveta (mesmo padrão de C-04)
│ (30 dias ▾) (👤 Meus pedidos)  │  chips
│ ‹ 🛒 12 │ 🧾 5 │ ❓ 3 │ 🛍️ 18 │ 📦 14 ›│  abas por status (rolável, 44px)
│ ┌───────────────────────────┐ │
│ │ Cond. Bela Vista    🔴 Urg│ │  cartão (toque abre detalhe)
│ │ Cabos e disjuntores       │ │
│ │ 5 itens · limite 04/11    │ │
│ │ ⚠️ 2 d atrasado · ❓ 1     │ │
│ │ [ Assumir ]               │ │  ação rápida 44px, largura total
│ └───────────────────────────┘ │
│ [   Carregar mais (50/183)  ] │
└───────────────────────────────┘
```
- **Abas de status:** `role="tablist"` com contagem em cada aba, setas ←/→ e `aria-controls` no painel. Padrão: a primeira aba com pedidos; para o comprador, "Aguardando compra".
- **Tablet (768–1279):** KPIs em 4 colunas, filtros inline, lista em 2 colunas de cartões; o drawer vale a partir de 768, tela cheia abaixo disso.
- **Tela de detalhe (<768):** `fixed inset-0 bg-slate-900`.
```
┌───────────────────────────────┐
│ ←  Pedido · Cond. Bela Vista  │  header sticky (← 44px; fecha e volta à lista)
│ 🧾 Em cotação 🔴 Urgente      │
│ Solic.: Ana · 04/11/2026      │
│ [Itens 5][Conversa 2][Histórico]│ tablist sticky
│  (conteúdo da aba)            │
├───────────────────────────────┤
│ [ ❓ Questionar ] [ Comprado ✓]│  barra de ação sticky (safe-area), ação principal à direita
└───────────────────────────────┘
```
- O botão Voltar do sistema fecha o detalhe (histórico via `?pedido=ID`).
- A barra de ação muda conforme o status (Assumir / Marcar como comprado / Registrar entrega) e tem [❓ Questionar] sempre.
- Ações secundárias (disponibilidade, mudar status, cancelar) ficam em "⋯ Mais" (menu com itens de 44 px).

### D.4 Modal de questionamento (`ModalQuestionamento`, comprador)

```
┌───────────────────────────────────────────┐ desktop: Modal md (600px)
│ ❓ Questionar item                    [✕] │ mobile (<640): tela cheia,
│ Pedido: Cabos e disjuntores — Cond. B. V. │ rodapé fixo
│ Item: Disjuntor 63A · 2 un     [trocar ▾] │ item readonly (select se abriu pelo pedido)
│                                           │
│ Tipo *                                    │ radiogroup, 3 opções, 44px
│ (●) 🔄 Substituição  ( ) 🔢 Quantidade  ( ) ❓ Dúvida
│                                           │
│ Pergunta ou motivo *                      │ textarea, 3 linhas, maxLength 500
│ [____________________________________]    │
│ 0/500                                     │
│                                           │
│ Sugestão (opcional)           ← só Substituição/Quantidade
│ Nome [Disjuntor 63A curva C ]             │ só em Substituição
│ Qtd  [ 3 ] Unidade [un ▾]                 │ CampoQuantidade (F2), regras de unidade
│ Prévia: Disjuntor 63A · 2 un → … · 3 un   │
│                                           │
│ ℹ️ O pedido ficará "Aguardando solicitante" │
│ até a resposta. Ana será notificada.      │
│        [ Cancelar ]  [ ❓ Enviar questionamento ] │
└───────────────────────────────────────────┘
```
- **Campos e validação:**
  - Tipo obrigatório, padrão **Dúvida**.
  - Pergunta obrigatória (≥5 caracteres).
  - Sugestão: em Substituição é obrigatório o nome e a quantidade/unidade são opcionais; em Quantidade é obrigatória a quantidade (>0). A quantidade segue R3 e R4.
  - Erro inline em `text-red-300` (7,71:1 sobre card) com `aria-invalid`, `aria-describedby` e `role="alert"` ao enviar.
- **Item questionado:** se já houver questionamento **aberto** no mesmo item, não permitir um segundo. Mostrar o aviso "Este item já tem um questionamento aberto" + link [Ver conversa].
- **Enviar:** o botão vira "Enviando…" com `aria-busy` e `disabled`; o rodapé não fecha em erro.
  - **Erro de rede ou RLS:** `tec-erro` em `role="alert"` com [Tentar novamente]; os dados digitados são mantidos.
  - **Sucesso:** o modal fecha, `toast.success("Questionamento enviado a Ana. O pedido aguarda o solicitante.")`, e o drawer atualiza e foca a aba Conversa.
- **Foco:** vai para o primeiro radio (o `Modal` já foca o primeiro campo). Ao fechar, volta ao botão que abriu.

### D.5 Conversa no `PedidoMaterial` (gestão / solicitante)

**Onde aparece**
- **`ListaPedidos` (cartão):**
  - ao lado do badge de status, aparecem o badge de `status_compra` e o selo **❓ N questionamentos**;
  - novo botão **💬 Conversa** (texto + ícone, 44 px, `aria-label` com o nome do pedido), ao lado de Editar e Histórico;
  - filtro novo "☐ Com questionamento pendente" junto da busca.
- **`FormularioPedido`** (editar pedido com questionamento aberto): faixa no topo "❓ Há 1 questionamento aguardando sua resposta [Ver conversa]", e os itens questionados são marcados.
- **`ModalConversaPedido`** (novo, `Modal lg`; tela cheia no mobile), com o componente `QuestionamentosPedido`.

```
┌─ 💬 Conversa do pedido ───────────────────────────── [✕] ┐
│ Cabos e disjuntores · 🧾 Em cotação · Cond. Bela Vista    │
│ ┌ ❓ Aberto ──────────────────────────────────────────┐   │
│ │ 🔄 Substituição · Carlos (Compras) · há 2 h          │   │
│ │ Item: Disjuntor 63A · 2 un                           │   │
│ │ "Sem estoque na curva B. Pode ser a curva C?"        │   │
│ │ Sugestão: Disjuntor 63A curva C · 2 un               │   │
│ │ [ ✅ Aprovar sugestão ]  [ ❌ Reprovar ]             │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌ ✅ Aprovado ─────────────────────────────────────────┐   │
│ │ 🔢 Quantidade · Carlos · 30/10 14:10                 │   │
│ │ Item: Cabo 2,5 mm · 100 m → 120 m                    │   │
│ │ ✅ Aprovado por Ana · 30/10 15:02 · "Pode comprar"   │   │
│ └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

**Anatomia do cartão**
- Cabeçalho: tipo (emoji + texto), autor com papel, data relativa (`<time>`), badge do estado.
- Corpo: item (nome, quantidade, unidade vindos do snapshot), pergunta, sugestão como "De → Para" com `→` e texto.
- Resposta (se houver): quem, quando e observação.
- Linha do tempo em ordem cronológica **decrescente**; abertos no topo.

**Ações no cartão aberto** (só para o solicitante ou admin):
- **✅ Aprovar sugestão**
  - Mostra a prévia "Será aplicado: Disjuntor 63A curva C · 2 un" e pede confirmação via `confirmar()`.
  - Observação opcional.
- **❌ Reprovar**
  - Revela inline um `textarea` com **observação obrigatória** (`aria-required`, `maxLength 500`).
  - Botões [Confirmar reprovação]/[Voltar].
- Ambas ficam `disabled` + `aria-busy` durante o envio.
- **Dúvida:** sem sugestão, o botão é **💬 Responder**, com observação obrigatória (envia como "aprovado" sem alterar itens). Pendência P-D1 para o Negócio/Backend.
- **Pós-resposta:**
  - `toast.success`;
  - o pedido, os itens e o histórico recarregam;
  - o foco vai para o cartão respondido, com uma região `aria-live="polite"` anunciando "Questionamento aprovado. Item atualizado.".

**Quem não pode responder**
- O TECNICO solicitante (v1) e perfis sem permissão veem o texto "Aguardando resposta de {nome}", sem botões.
- O comprador vê [Cancelar questionamento] apenas nos seus abertos.
- A mesma conversa é reaproveitada na aba **Conversa** do drawer de Compras (com [Abrir questionamento] para o comprador).

**Estados**
- **Vazio:** "Nenhum questionamento neste pedido" + (Compras) [❓ Abrir questionamento].
- **Carregando:** esqueleto de 2 cartões.
- **Erro de carga:** `ErroCarregamento`.
- **Erro de resposta:** `tec-erro` em `role="alert"` no cartão, mantendo o rascunho.
- **Conflito** (questionamento já respondido ou cancelado por outra pessoa): "Este questionamento já foi respondido" e recarrega.

### D.6 Notificações e badges (apoio à F18)
- Ícones no `NotificacoesDropdown`: ❓ `compra_questionamento` (purple), ✅/❌ `compra_resposta` (green/red) e 🛒 `compra_status` (blue).
- Badge no menu "Compras" (respostas não lidas) e em "Pedido de Material" (questionamentos abertos para mim): usar `execucao-nav-badge`, com `aria-label="3 questionamentos abertos"`.
- Clique na notificação: abre o pedido via `?pedido=ID` e foca a aba Conversa.

### D.7 Bloco passos / observação / localização no `ModalConcluir` (técnico, 360 px)

Remover o `CampoHoras`. Ordem (o mais frequente primeiro, sem rolar para o essencial):
```
┌ Concluir atividade ──────────────── [✕] ┐   tela cheia <640, rodapé fixo
│ Instalação de quadro — Cond. Bela Vista  │
│                                          │
│ ┌ Passos (2 de 4 concluídos) ──────────┐ │   só se houver passos
│ │ [Marcar todos]                       │ │   botão 44px
│ │ ☑ Entrada no condomínio · 20 min     │ │   .tec-check, 44px, 22px
│ │ ☑ Passagem de cabos · 1 h            │ │
│ │ ☐ Montagem do quadro · 2 h           │ │
│ │ ☐ Testes e entrega · 30 min          │ │
│ └──────────────────────────────────────┘ │
│ ⚠️ A etapa seguirá em andamento no       │   callout (role="status") só com passo aberto
│    planejamento até todos os passos      │
│    serem concluídos.                     │
│                                          │
│ Observação (opcional)                    │
│ [______________________________]         │   textarea 4 linhas, 16px
│                                  0/1000  │
│                                          │
│ Evidências  📷 Foto  🎥 Vídeo  🎤 Áudio  │   EvidenciasUploader (inalterado)
│                                          │
│ 🕒 Horário e localização são registrados │   bloco informativo
│    automaticamente ao concluir.          │
│ 🕒 Agora: 01/11/2026 14:37               │   só leitura
│ 📍 Localização: buscando…                │   estados abaixo
├──────────────────────────────────────────┤
│ [ Cancelar ]     [ ✅ Concluir ]         │   rodapé fixo, Concluir à direita
└──────────────────────────────────────────┘
```

**Passos**
- É `<fieldset>` com `<legend>` ("Passos da atividade, 2 de 4 concluídos"), atualizado ao marcar.
- Cada passo usa `.tec-check` (rótulo clicável de 44 px, checkbox de 22 px). Nome do passo + horas ("1 h") alinhadas à direita.
- Passos já concluídos vêm marcados e continuam editáveis.
- [Marcar todos] alterna para [Desmarcar todos]; botão de 44 px com `aria-pressed`.
- O callout âmbar usa `amber-300` (10,15:1) com ⚠️, em `role="status"` e só aparece com algum passo em aberto.
- Ordem na fila offline: ações `passo` antes da ação `status` (F9).
- Sem passos, o fieldset e o callout não aparecem.

**Observação**
- `execucao-form-textarea tec-input`, `rows={4}`, `maxLength={1000}`.
- Contador "0/1000" visível, ligado por `aria-describedby`. Só é anunciado a partir de 900 caracteres, para não narrar cada tecla.
- Quebras de linha preservadas; `enterKeyHint="enter"`.

**Horário e localização**
- O texto fixo é "Horário e localização são registrados automaticamente no momento da conclusão." (N1/F8). O horário é só leitura, em `<time>`, capturado ao abrir e sem relógio rodando.
- A localização mostra estado em texto, com ícone, em `aria-live="polite"`:

| Estado | Texto | Estilo |
|---|---|---|
| Buscando | "📍 Buscando localização…" | neutro |
| Capturada | "📍 Localização capturada (±12 m)" | `green-300` |
| Negada | "📍 Localização bloqueada. Para registrar, libere em Configurações do navegador → Permissões → Localização e toque em Concluir de novo. Você também pode concluir sem localização." | callout âmbar, **não bloqueante** |
| Indisponível, tempo esgotado ou não suportado | "📍 Não foi possível obter a localização agora. A conclusão segue normalmente." | callout âmbar |

- O status real só é conhecido no clique de Concluir (F8, `obterLocalizacao`). Antes do clique:
  - se `navigator.permissions.query({name:'geolocation'})` existir e retornar `denied`, mostrar já o aviso de "negada";
  - senão, texto neutro "A localização será pedida ao concluir.".
- Depois do clique, o resultado (negada, etc.) vira aviso no `toast.info` e no registro.
- **Offline:** se `navigator.onLine` for falso, mostrar "📶 Sem conexão: a conclusão será enviada quando a rede voltar, com o horário deste aparelho.".

**Botão Concluir**
- Rótulo "✅ Concluir", usando `.tec-btn` com variante verde `#15803d`, texto branco (5,02:1).
- Em ação, vira "Concluindo…" com `aria-busy` (até 6 s, junto da captura de geolocalização) e uma linha `aria-live` "Registrando horário e localização…".
- [Concluir] fica `disabled` enquanto houver gravação ou otimização de evidência (como hoje).

**Foco**
- Sem passos, o `Modal` foca o `<textarea>` primeiro e o teclado virtual abriria, escondendo o conteúdo.
- Propor que o `Modal.jsx` aceite `[data-autofocus]`, e o `ModalConcluir` marque o título da atividade com `tabIndex={-1} data-autofocus` (M).
- Esc fecha, com a regra atual de bloquear enquanto `evidencias.ocupado`.

### D.8 Critérios de aceite de acessibilidade (todos)
- Contraste ≥4,5:1 no texto e ≥3:1 em ícones/bordas de controles (tokens do Anexo C.3 P6).
- Foco visível `#60a5fa`; ordem de Tab lógica; Esc fecha diálogos e o foco volta ao gatilho.
- Alvos ≥44 px em toque; campos com 16 px no mobile.
- Estado nunca só por cor (emoji + texto). `aria-live="polite"` em contadores, resultados de ação e estado de localização.
- Kanban sem arrastar e soltar; ações por botões. Tablists com setas; drawer e modais com `role="dialog" aria-modal` e foco preso.
- Mensagens de erro em `role="alert"`, ligadas ao campo.
- `prefers-reduced-motion` respeitado em skeleton, realce e pulso.

### D.9 Pendências para aprovação do Negócio

| # | Pergunta | Default adotado |
|---|---|---|
| P-D1 | Questionamento de tipo **Dúvida**: responder usa "Responder" (observação obrigatória, `p_aprovar=true`) ou Aprovar/Reprovar? | "Responder". |
| P-D2 | "Marcar como comprado" pede a data de disponibilidade (N1-m) ou ela é opcional? | Opcional. |
| P-D3 | KPIs no mobile: 4 prioritários mais "Mais indicadores". | Aprovado salvo veto. |
| P-D4 | Conversa em cartões e não em bolhas de chat. | Aprovado salvo veto. |
| P-D5 | Modal de questionamento em tela cheia no mobile. | Aprovado salvo veto. |
| P-D6 | "Meus pedidos" (comprador) como filtro de 1 toque. | Incluído. |

## Anexo F: Contrato final do banco (Backend, Ondas 2 e 4) para o Frontend das Ondas 3 e 5

> **Estado (atualizado em 01/11/2026): migrations 19–31 APLICADAS.** (texto original: arquivos escritos, NÃO aplicados.) As migrations abaixo estão em `supabase/migrations/`, com `-- ROLLBACK:` no topo; os scripts de manutenção estão em `supabase/manutencao/`. Nada foi executado no banco (MCP do Supabase indisponível; só foi feita checagem de sintaxe local). O Frontend pode implementar contra este contrato; antes do deploy do front de cada onda, a migration correspondente precisa estar aplicada (ver F.1).

### F.1 Ordem de aplicação

| # | Arquivo | O que faz | Depende de | Observação |
|---|---------|-----------|------------|------------|
| 0 | `supabase/manutencao/diagnostico_B0.sql` | Só SELECT: itens 1–6 da B0 + conferências (CHECKs, policies, colunas, status legado) | nada | Rodar **antes** e registrar no Anexo A. Anotar `allowed_mime_types` do bucket antes da 22. |
| 1 | `20261101_19_execucao_subetapas_conclusao.sql` | `execucao_recalcular_etapa_pai`, `execucao_sincronizar_etapa_pai`, `alterar_status_atividade` (8 params, sem cascata), `execucao_marcar_passo`, `execucao_contexto_atividades` com `id`; CHECK de `tipo_acao` ganha `passo`/`reabertura`/`horas_ajustadas` | B0 (item 2) | Aplicar **junto** com a 20. |
| 2 | `20261101_20_execucao_conclusao_tecnico.sql` | Colunas de conclusão, horas calculadas no servidor, `alterar_status_atividade` com 13 params (DROP das antigas) | 19 | Mesma janela da 19. Testar a fila offline antiga (cenário 7.2-6). |
| 3 | `20261101_21_execucao_sem_notif_replanejamento.sql` | `deslocar_etapas` sem notificação; marca como lidas as antigas | nada | Independente. |
| 4 | `20261101_22_execucao_evidencias_midia.sql` | Bucket `atividades-evidencias`: `allowed_mime_types = NULL`, 50 MiB | B0 item 1 | Conferir também o limite global no painel (Free = 50 MB). |
| 5 | `20261101_23_pedidos_itens_id.sql` | `itens[].id` por trigger + backfill (auditoria desativada só no backfill) | B0 item 3 | Independente. |
| 6 | `20261101_24_compras_base.sql` | Nível `COMPRAS`, página, permissões, `is_compras()`, `pode_ver_compras()`, colunas de compra, backfill de `status_compra`, triggers, RLS de leitura | 23 | Backfill com auditoria desativada. |
| 7 | `20261101_25_compras_questionamentos.sql` | Tabela de questionamentos, RPCs de Compras, notificações novas, Realtime | 24 | |
| 8 | `20261101_26_compras_painel.sql` | `compras_listar_pedidos`, `compras_indicadores` | 25 | |
| 8b | `20261101_27_execucao_indicadores_horas_corte.sql` | `execucao_indicadores` e `execucao_media_realizada_templates` só com `horas_origem IS NOT NULL`; chave nova `conclusoes_sem_localizacao` (F.7) | 20 | **Aplicada em 01/11/2026.** Pode ir junto da 20 ou depois; nunca antes. |
| 8c | `20261101_28_compras_pops_nomes.sql` | COMPRAS lê POPs (sem escrita); `compras_listar_questionamentos` e `compras_detalhe_pedido` com nomes resolvidos (F.8) | 24, 25, 26 | **Aplicada em 01/11/2026.** |
| 8d | `20261101_29_execucao_indice_etapa_pai.sql` | Índice parcial `execucao_obras_etapas(etapa_pai_id)` (P1/Performance) | nada | **Aplicada em 01/11/2026.** Sem dependência; ideal **antes ou junto da 19** (as consultas da 19/20 filtram por essa coluna). |
| 8e | `20261101_30_execucao_passos_pendentes.sql` | RPC `execucao_passos_pendentes_por_etapa` (F.9) | nada técnico (usa o índice da 29) | **Aplicada em 01/11/2026.** Só faz sentido depois da 19. |
| 8f | `20261101_31_execucao_ajustes_pos_aplicacao.sql` | Teto diário das horas = só a jornada líquida; policies de pedidos/histórico sem SELECT duplicado (F.10) | 20, 24 | **Aplicada em 01/11/2026.** Criada depois dos testes de fumaça. |
| 9 | `supabase/manutencao/corrigir_etapas_pai_concluidas.sql` | Correção de dados (dry-run + UPDATE comentado) | 19 + aprovação do Negócio | **Não é migration.** Fora do horário comercial. |

Depois de aplicar: advisors de segurança e performance, regenerar o snapshot `supabase/schema/` e rodar `npm run graph:update`. Deploy do front: 19→20→21→(22)→23 com as Ondas 1 e 3; 24→25→26 com a Onda 5 (ver §8).

### F.2 Decisões tomadas na escrita (divergências ou detalhes em relação ao plano)

1. **Horas (N1-d).** `execucao_horas_efetivas_calc(p_atividade, p_fim) → (horas, origem)`: soma os intervalos "em andamento" do histórico, recortados por dia (America/Sao_Paulo), com **teto diário = jornada líquida do técnico** (`execucao_jornada_dia.minutos_liquidos`); dia sem jornada (fim de semana, feriado, ausência) = 0. *(Corrigido na migration 31: a versão original somava o extra e usava 480 min em dia sem jornada, e contava fins de semana.)* Sem nenhum "Iniciar" (ou soma < 1 min) usa as **horas previstas** (P2). O desconto de almoço vem da jornada líquida (aproximação; não olha a faixa horária). Nova coluna `horas_origem` ∈ `previstas | intervalos | ajuste_admin | ajuste_tecnico`. **Data de corte:** conclusões anteriores à migration ficam com `horas_origem NULL`; `execucao_horas_data_corte()` devolve a 1ª conclusão com origem. Calibração/desvio (`execucao_media_realizada_templates`, `execucao_indicadores.horas_por_tipo`) passam a filtrar `horas_origem IS NOT NULL` na **migration 27** (F.7); `PrevistoRealizado` (`execucaoPlanejamento.js`) **não** foi tratado no banco e o texto de `IndicadoresAcionaveis.jsx` L158 ("só aparece quando houve ajuste") precisa ser atualizado no front.
2. **Ajuste da gestão.** Um `UPDATE` de `horas_realizadas` feito por admin fora da RPC dispara `trg_horas_marcar_ajuste`: `horas_ajustadas = true`, `horas_origem = 'ajuste_admin'` e uma linha no histórico (`tipo_acao = 'horas_ajustadas'`). Via RPC, `p_horas_realizadas` não nulo grava `ajuste_admin` (se o chamador é admin) ou `ajuste_tecnico` (payload antigo da fila).
3. **Horário (D11).** Conclusão: `fim_real_em = now()` do servidor se `p_ocorrido_em` é nulo ou tem ≤ 5 min; senão, o instante do aparelho limitado a `[inicio_real_em, now()]`. Sempre grava `conclusao_registrada_em = now()` e `conclusao_origem_horario` (`servidor` | `dispositivo`). Os demais status (pausa etc.) continuam usando `p_ocorrido_em` limitado a `now()`.
4. **Passos em aberto (N1-g).** Concluir com passos abertos **não bloqueia**: o histórico recebe "· com N passo(s) em aberto" e a notificação ao admin também. A confirmação ("há N passos não marcados, concluir mesmo assim?") é do front. A etapa pai fica `em_andamento`, com progresso ≤ 99.
5. **Geolocalização (N1-e).** Não bloqueia. `p_geo_status` ∈ `ok | negada | indisponivel | tempo_esgotado | nao_suportado`; latitude/longitude só são gravadas com status `ok` (ou nulo); fora de faixa lança erro. Ao reabrir a atividade (`pendente`/`em_andamento`/`pausada`) os campos de conclusão são limpos.
6. **Cascata e vínculo por nome (R14).** Sem cascata pai → sub-etapas. Fallback por nome só vincula a etapa **folha**, na mesma obra/cliente, com `data_inicio = data_programada` e **exatamente 1** correspondência. Sub-etapa marcada em cascata pela mig. 16 continua `concluida` (não gera falso positivo na correção de dados).
7. **Itens do pedido.** `itens[].id` (uuid texto) é gerado pelo trigger. O histórico antigo não foi reescrito (o diff usa fallback por nome+unidade). Bloqueio novo: **não se edita `itens` depois de `comprado`** (`comprado`, `entregue_parcial`, `entregue`): erro "Os itens não podem ser alterados depois que o pedido foi comprado".
8. **Colunas extras em `execucao_pedidos_material`** (além das do plano): `status_compra_anterior` (volta ao status anterior ao fechar o último questionamento; o plano previa guardar em `referencia` do histórico, que não existe), `fila_compras_em` (entrada na fila, base dos tempos médios; N1-l), `etapa_chegada_id` (etapa de chegada: a mudança de data **atualiza** a etapa, N1-m.2).
9. **RLS de questionamentos.** Só `pode_ver_compras()` lê. O ramo "solicitante lê" do §5.4 não foi criado: quem responde é admin (N1-k) e o teste 7.3-2 exige 0 linhas para TECNICO. As policies novas de `execucao_pedidos_material` e `execucao_historico_pedidos` usam `is_compras()` (o admin já tem `*_admin_all`; evita policy permissiva duplicada).
10. **Dúvida respondida** fica com `status = 'aprovado'` e a resposta em `resposta_observacao`. Reprovar, responder a dúvida e responder em nome de outra pessoa exigem observação (≥ 3 caracteres).
11. **`data_material_disponivel` é a previsão de chegada** (definida pela Compras). **Não foi criada a coluna "data necessária"** (P8 do §3.2 sem resposta): fica como pendência de Negócio/Front. O KPI "Atrasados" usa `data_material_disponivel < hoje`.
12. **Questionamento só abre até `em_cotacao`** e vira `aguardando_solicitante` automaticamente; abrir questionamento também define `comprador_id` se vazio.
13. `compras_alterar_status` sincroniza o status legado em `entregue` **e em `cancelado`** (além do `entregue` da D6) para o pedido sair de "Listas de obras pendentes". `trg_pedidos_compras_sync` faz o caminho inverso (legado `entregue`/`cancelado`/`recusado` → `status_compra`).

### F.3 Colunas e tabelas novas

| Tabela | Coluna / objeto | Tipo / valores | Quem preenche |
|--------|-----------------|----------------|---------------|
| `execucao_atividades` | `observacao_conclusao` | text (≤ 1.000, o servidor corta) | `alterar_status_atividade` (`concluida`) |
| | `conclusao_latitude`, `conclusao_longitude` | numeric(9,6) | idem (só com `geo_status = 'ok'`) |
| | `conclusao_precisao_m` | numeric(7,1) | idem |
| | `conclusao_geo_status` | `ok \| negada \| indisponivel \| tempo_esgotado \| nao_suportado` | idem |
| | `conclusao_registrada_em` | timestamptz (now() do servidor) | idem |
| | `conclusao_origem_horario` | `servidor \| dispositivo` | idem |
| | `horas_origem` | `previstas \| intervalos \| ajuste_admin \| ajuste_tecnico` (NULL = histórico antigo) | RPC / trigger de ajuste |
| `execucao_atividades_historico` | `tipo_acao` | + `passo`, `reabertura`, `horas_ajustadas` | RPCs / script de correção |
| `execucao_pedidos_material` | `status_compra` | `aguardando_compra \| em_cotacao \| aguardando_solicitante \| comprado \| entregue_parcial \| entregue \| cancelado` (default `aguardando_compra`) | RPCs / trigger |
| | `comprador_id` (FK `usuarios`), `status_compra_em`, `comprado_em` | uuid / timestamptz | RPCs |
| | `status_compra_anterior` | `aguardando_compra \| em_cotacao` | RPCs |
| | `fila_compras_em` | timestamptz | trigger / RPCs |
| | `etapa_chegada_id` | uuid (FK `execucao_obras_etapas`, `ON DELETE SET NULL`) | `execucao_compras_aplicar_disponibilidade` |
| `execucao_pedidos_questionamentos` (nova) | `id, pedido_id, item_id (text), item_snapshot (jsonb), tipo (substituicao\|quantidade\|duvida), pergunta, sugestao (jsonb {nome?, quantidade?, unidade?}), status (aberto\|aprovado\|reprovado\|cancelado), resposta_observacao, criado_por, respondido_por, respondido_em, created_at, updated_at` | | só por RPC |
| `execucao_notificacoes.tipo` | + `compra_questionamento`, `compra_resposta`, `compra_status` | | RPCs / trigger |
| `niveis_acesso` / `paginas` / `permissoes` | nível `COMPRAS`; página `execucao/compras` | | mig. 24 |
| `storage.buckets` | `atividades-evidencias`: `allowed_mime_types = NULL`, `file_size_limit = 52428800` | | mig. 22 |

### F.4 RPCs (todas `SECURITY DEFINER`, `search_path = public`, `EXECUTE` só para `authenticated`)

Erros chegam como `error.message` do PostgREST (texto em português, pronto para exibir).

**Técnico / Execução**

| RPC | Parâmetros (nome → tipo; * = obrigatório) | Retorno | Quem pode |
|-----|-------------------------------------------|---------|-----------|
| `alterar_status_atividade` | `p_id*` uuid, `p_status*` text, `p_motivo` text, `p_ocorrido_em` timestamptz, `p_id_cliente` uuid, `p_motivo_codigo` text, `p_solicita_replanejamento` bool, `p_horas_realizadas` numeric, **novos:** `p_observacao` text, `p_latitude` numeric, `p_longitude` numeric, `p_precisao_m` numeric, `p_geo_status` text | linha de `execucao_atividades` (já com os campos de conclusão) | admin, responsável ou participante da equipe |
| `execucao_marcar_passo` | `p_atividade*` uuid, `p_sub_etapa*` uuid, `p_concluido*` bool, `p_id_cliente` uuid, `p_ocorrido_em` timestamptz | jsonb `{ sub_etapa_id, status, progresso, pai_id, pai_status, pai_progresso, passos_total, passos_feitos, repetido }` | admin, responsável ou participante. A sub-etapa tem de ser filha da etapa da atividade. Reenvio com o mesmo `p_id_cliente` devolve `repetido: true`. |
| `execucao_contexto_atividades` | `p_ids*` uuid[] | linhas `{ atividade_id, obra_id, nome_cliente, endereco, cidade, contato_cliente, sub_etapas }`; cada item de `sub_etapas` = `{ id, nome, horas, status, progresso }` | admin, responsável ou participante |
| `execucao_horas_efetivas(p_atividade, p_fim)` / `execucao_horas_efetivas_calc(...)` / `execucao_horas_data_corte()` | | numeric / `(horas, origem)` / timestamptz | autenticados (consulta) |
| `deslocar_etapas` | inalterada (assinatura e retorno iguais) | | admin; **não** notifica mais técnicos |

**Compras**

| RPC | Parâmetros | Retorno | Quem pode / regras |
|-----|------------|---------|--------------------|
| `compras_listar_pedidos` | `p_filtros` jsonb `{ de, ate, campo_data ('pedido'\|'evento'), status_compra[], urgencia[], busca, solicitante_id, comprador_id, pedido_id, com_questionamento_aberto }`, `p_limite` int (1–200, padrão 50), `p_cursor` jsonb `{ created_at, id }` | linhas: `id, created_at, updated_at, descricao, urgencia, status, status_compra, status_compra_em, comprado_em, fila_compras_em, observacoes, cliente_nome, endereco_obra, obra_id, obra_status, obra_cancelada, atividade_id, atividade_titulo, solicitante_id, solicitante_nome, comprador_id, comprador_nome, data_lista_pronta, data_material_disponivel, data_entrega, etapa_chegada_id, itens, qtd_itens, qtd_questionamentos_abertos, sem_itens, atrasado`. Ordem `created_at DESC, id ASC`. Sem filtro de status, `cancelado` não aparece. Listas de obra vazias ficam fora (N1-n). Selos: `sem_itens`, `obra_cancelada`, `atrasado`. | `pode_ver_compras()` |
| `compras_indicadores` | `p_de` date, `p_ate` date (padrão: últimos 30 dias) | jsonb `{ periodo{de,ate}, por_status{...}, aguardando_compra, em_cotacao, aguardando_solicitante{pedidos, questionamentos_abertos, mais_antigo_dias}, atrasados, urgentes_em_aberto, obras_paradas_falta_material{atividades, obras}, comprados_periodo, entregues_periodo, tempo_fila_ate_comprado_dias{media, mediana, amostra}, tempo_resposta_questionamento_horas{media, mediana, amostra} }` | `pode_ver_compras()` |
| `compras_assumir_pedido` | `p_pedido*` uuid | jsonb `{ pedido_id, status_compra, comprador_id }` | `is_compras()`; `aguardando_compra → em_cotacao` |
| `compras_alterar_status` | `p_pedido*` uuid, `p_status*` text, `p_obs` text, `p_data_disponibilidade` date | jsonb `{ pedido_id, status_compra, data_material_disponivel, etapa_chegada_id?, etapa_criada? }` | `pode_ver_compras()`. Transições: `aguardando_compra → em_cotacao/cancelado`; `em_cotacao → aguardando_compra/comprado/cancelado`; `aguardando_solicitante → cancelado`; `comprado → entregue_parcial/entregue/cancelado`; `entregue_parcial → entregue/cancelado`. `cancelado` e `entregue_parcial` exigem `p_obs`; `comprado` exige data (parâmetro ou já gravada). |
| `compras_definir_disponibilidade` | `p_pedido*` uuid, `p_data*` date | jsonb `{ data_material_disponivel, etapa_chegada_id, etapa_criada }` | `pode_ver_compras()`; não vale em pedido `cancelado`/`entregue`; cria a etapa "📦 Chegada dos Materiais" 1 vez (só com `obra_id` e obra não concluída/cancelada), depois só atualiza `data_fim` |
| `compras_abrir_questionamento` | `p_pedido*` uuid, `p_item_id` text (obrigatório para `substituicao`/`quantidade`), `p_tipo*` text, `p_pergunta*` text (3–1.000), `p_sugestao` jsonb `{nome?, quantidade?, unidade?}` (substituição exige `nome`; quantidade exige `quantidade > 0`) | uuid do questionamento | `is_compras()`; status do pedido ≤ `em_cotacao` |
| `compras_responder_questionamento` | `p_id*` uuid, `p_aprovar*` bool, `p_observacao` text | jsonb `{ questionamento_id, status, status_compra, item_alterado }` | admin de execução, ou o solicitante **não técnico** (exceto `substituicao`, só admin). Aprovar altera o item (un/cx/pct arredondam para cima) e grava histórico `questionamento` com `dados_anteriores`/`dados_novos` = `{ "itens": [...] }` |
| `compras_cancelar_questionamento` | `p_id*` uuid, `p_motivo` text | void | autor ou admin |

**Histórico** (`execucao_historico_pedidos.tipo_alteracao`): `questionamento` (abertura/resposta/cancelamento; texto da pergunta ou resposta em `motivo`), `compra_status` (`dados_anteriores`/`dados_novos` = `{ status_compra }`), `edicao` (previsão de chegada, com `data_limite_anterior`/`data_limite_nova`).

**Notificações:** `compra_questionamento` (para o solicitante; se for técnico, `destinatario_id NULL` = admins), `compra_resposta` (para quem abriu), `compra_status` (comprado/entrega parcial/entregue/cancelado, ao solicitante; "Pedido editado" ao comprador). `referencia = { pedido_id, questionamento_id? }`. Realtime: `execucao_pedidos_material` e `execucao_pedidos_questionamentos` na publicação (eventos respeitam o RLS).

### F.5 Services (contrato `{ success, data?, message? }`)

- `execucaoService.alterarStatusAtividade(id, status, _u, motivo, extras)`: `extras` aceita `observacao`, `latitude`, `longitude`, `precisaoM`, `geoStatus` (além dos anteriores). Os parâmetros novos **só são enviados quando preenchidos**, então a chamada vale antes e depois da migration 20.
- `execucaoTecnicoService.marcarPasso(atividadeId, subEtapaId, concluido, { idCliente, ocorridoEm })`.
- **Novo** `src/services/supabase/execucaoCompras.js` (`execucaoComprasService`, exportado em `src/services/index.js`): `listarPedidos(filtros, { limite, cursor })`, `indicadores(de, ate)`, `buscarDetalhe(pedidoId)` (RPC `compras_detalhe_pedido`: `{ pedido, historico, questionamentos }` com nomes resolvidos), `buscarQuestionamentosPedido(pedidoId?, status?)` (RPC `compras_listar_questionamentos`), `abrirQuestionamento(pedidoId, { itemId, tipo, pergunta, sugestao })`, `responderQuestionamento(id, aprovar, observacao)`, `cancelarQuestionamento(id, motivo)`, `assumirPedido`, `alterarStatus(pedidoId, status, obs, dataDisponibilidade)`, `definirDisponibilidade(pedidoId, data)`.
- Ainda **não** feitos (filtros e escritas diretas, sem RPC; dependem das Ondas 1/3/5): `criarPedidoMaterial`/`atualizarPedidoMaterial` enviando `cliente_nome` e `buscarPedidosMaterial` com `comQuestionamento` (ver §5.2).

### F.6 Pendências e riscos para o Negócio/Front

1. **P8 (data necessária × previsão de chegada)** sem decisão: a coluna "data necessária" não existe.
2. **Horas (N1-d):** com a nova regra, `horas_ajustadas` deixa de significar "o técnico mexeu" e as horas medidas por intervalos não são comparáveis com o histórico antigo. Textos e relatórios do front devem usar `horas_origem`.
3. **Sub-etapa com responsável diferente do pai (P10)** continua sem atribuição própria: `execucao_marcar_passo` aceita quem é responsável/participante da atividade do **pai**.
4. **Bloqueio de edição de `itens` após `comprado`** é novo: o front de pedidos deve esconder/desabilitar a edição e mostrar a mensagem.
5. O CHECK de `execucao_atividades_historico.tipo_acao` é criado `NOT VALID` (só linhas novas), por segurança; rodar `VALIDATE CONSTRAINT` depois do diagnóstico (B0, item 8) se quiser.
6. Capacidade (`execucao_capacidade`): a hipótese de contagem dupla das horas do pai com as da sub-etapa (N1-h) continua **não verificada** (consulta 13 do diagnóstico).

### F.7 Corte de horas, indicador de localização e passos do técnico (migration 27 · aplicada em 01/11/2026)

**Corte de horas.** `20261101_27_execucao_indicadores_horas_corte.sql` (depende da 20) recria, com contrato de retorno idêntico:
- `execucao_indicadores(p_inicio, p_fim)`: `horas_por_tipo` (`tipo, previstas, realizadas, ajustadas, atividades`) só soma atividades com `horas_origem IS NOT NULL`. `pontualidade`, `pausas_por_motivo`, `obras_no_prazo`, `lead_time_dias` e `horas_extras` não mudam.
- `execucao_media_realizada_templates()` (`template_id, item_id, item_nome, horas_previstas, media_realizada, execucoes, ajustes`): a média só usa atividades com `horas_origem IS NOT NULL`.
- Efeito: logo após aplicar, `horas_por_tipo` e a calibração ficam **vazios** até haver conclusões novas (a série recomeça na data de corte, `execucao_horas_data_corte()`). O front deve tratar lista vazia com mensagem do tipo "Sem dados desde a nova regra de horas".
- `horas_origem NOT NULL` inclui a origem `previstas` (concluída sem "Iniciar"), que entra com realizadas = previstas. Se o Negócio quiser só o tempo medido, trocar o filtro por `horas_origem IN ('intervalos','ajuste_admin','ajuste_tecnico')` (comentado no cabeçalho da migration).

**Indicador "conclusões sem localização"** (chave nova e aditiva em `execucao_indicadores`, só admin):
```
conclusoes_sem_localizacao: [
  { usuario_id, nome, concluidas, sem_localizacao, negada, indisponivel, tempo_esgotado, nao_suportado, sem_dado }
]   // ordenado por sem_localizacao desc, depois nome; [] se não houver
```
- Período: `fim_real_em` entre `p_inicio` e `p_fim`; técnico = `tecnico_responsavel_id` ("Sem técnico" se nulo).
- `concluidas` = conclusões do período **registradas pela mig. 20** (`conclusao_registrada_em IS NOT NULL`); conclusões antigas não entram.
- `sem_localizacao` = `conclusao_geo_status <> 'ok'` ou nulo; `sem_dado` = nulo (app antigo, sem o campo).
- Uso: acompanhar a cobertura da coleta. **Não usar em ranking, bônus ou avaliação individual** (N1-e e N1-d.6).

**Passos no modal do técnico (confirmado no SQL).** `execucao_contexto_atividades(p_ids)` **na migration 19** devolve em `sub_etapas`, para cada passo, `{ id, nome, horas, status, progresso }`, ordenados por `ordem, created_at`. Com a mig. 16 (a que está no banco hoje) o item só tem `{ nome, horas, status }`, **sem `id`**: o modal só consegue marcar passos depois da 19. O `id` é o `p_sub_etapa` de `execucao_marcar_passo`, e `status` ∈ `pendente | em_andamento | concluida | atrasada` (canceladas também vêm; o front deve ocultar `cancelada`).

### F.8 POPs e nomes para COMPRAS (migration 28 · aplicada em 01/11/2026) e revisão cética das migrations 19–28

**POPs.** `pops_read`, `pops_arq_read` e `pops_arquivos_read` (bucket `pops-arquivos`) passam a aceitar `is_compras()` além de `is_usuario_execucao()`. Escrita de POPs continua só do admin. COMPRAS segue sem ler obras, atividades e agenda (`is_usuario_execucao()` inalterada).

**Nomes (COMPRAS não precisa de SELECT em `usuarios`).** Campos que o front deve usar:

| Onde | Campo | Significado |
|------|-------|-------------|
| `compras_listar_pedidos` (linha) e `compras_detalhe_pedido().pedido` | `solicitante_nome` | quem criou a lista/pedido (o "criador"); `solicitante_id` é o id |
| idem | `comprador_nome` | comprador responsável (`comprador_id`) |
| `compras_detalhe_pedido().historico[]` | `usuario_nome` | quem fez a alteração (nome gravado, ou o do usuário se o registro antigo não tinha) |
| `compras_listar_questionamentos` / `compras_detalhe_pedido().questionamentos[]` | `criador_nome` | quem abriu o questionamento (`criado_por`) |
| idem | `respondedor_nome` | quem respondeu ou cancelou (`respondido_por`); nulo se aberto |

- `compras_listar_questionamentos(p_pedido uuid DEFAULT NULL, p_status text[] DEFAULT NULL)`: colunas `id, pedido_id, item_id, item_snapshot, tipo, pergunta, sugestao, status, resposta_observacao, criado_por, criador_nome, respondido_por, respondedor_nome, respondido_em, created_at, updated_at`; ordem `created_at ASC`; máximo 500; `pode_ver_compras()`.
- `compras_detalhe_pedido(p_pedido uuid)` → jsonb `{ pedido, historico[], questionamentos[] }`. `historico[]`: `id, tipo_alteracao, descricao, usuario_id, usuario_nome, data_alteracao, dados_anteriores, dados_novos, data_limite_anterior, data_limite_nova, motivo`. Erro "Pedido não encontrado ou fora da fila de Compras" se o pedido não tem itens nem atividade (lista de obra vazia).
- **Realtime** entrega a linha crua da tabela (sem nomes): ao receber um evento, o front deve **refazer** `buscarDetalhe`/`listarPedidos` em vez de montar a linha pelo payload.
- **Sino de notificações:** `NotificacoesDropdown` embute `usuario_origem:usuarios!usuario_origem_id(...)`. Se o RLS de `usuarios` bloquear COMPRAS, o nome de origem vem nulo (verificar com a consulta 14 do `diagnostico_B0.sql`); o front deve tratar nulo ("Sistema"/"Compras").

**Revisão cética (achados e correções feitos nos arquivos).**

| # | Achado | Gravidade | Correção |
|---|--------|-----------|----------|
| 1 | Trigger de itens (24) comparava `itens` com ids: um UPDATE de front antigo que só "perde" os ids em pedido `comprado/entregue` geraria erro falso (o trigger de ids da 23 roda depois, em ordem alfabética) | média | 24: compara sem os ids (`execucao_pedido_itens_sem_id`) |
| 2 | Trigger de status (24) usava `TG_OP = 'INSERT' OR ... OLD.status`: depende de curto-circuito do `OR` | baixa | 24: ramos `IF TG_OP = 'UPDATE' ... ELSE` separados (sem tocar `OLD` no INSERT) |
| 3 | Funções de trigger com `GRANT EXECUTE ... TO authenticated` (23 e 24): desnecessário e amplia superfície | baixa | 23 e 24: `REVOKE` de `authenticated` nas funções de trigger (só `execucao_pedidos_itens_com_id`, chamada pelo trigger como o usuário do DML, mantém o GRANT) |
| 4 | Legado `entregue`/`cancelado` (ou avanço para `comprado`) com questionamento `aberto` deixaria a fila inconsistente | média | 25: trigger `trg_pedido_fechar_questionamentos` fecha os abertos |
| 5 | `execucao_marcar_passo` aceitava atividade `cancelada` | baixa | 19: erro "Atividade cancelada" |
| 6 | **Reaplicar a 19 depois da 20 recria a função de 8 parâmetros** e o PostgREST passa a acusar overload ambíguo | alta (operacional) | Documentado no README: **não reaplicar a 19 depois da 20**; se acontecer, rodar o `DROP FUNCTION` da 8-args (primeira linha do ROLLBACK da 20, invertida) |
| 7 | COMPRAS não lia POPs (a navegação do front a oferece) | média | 28 |
| 8 | COMPRAS dependia de `usuarios` para nomes (pode ser bloqueado por RLS) | média | 28 |

Conferido sem pendências: (a) **ordem/dependências** 19→20→27, 23→24→25→26→28, 21 e 22 independentes; (b) **SECURITY DEFINER** sempre com `SET search_path = public`; as funções de leitura (`execucao_horas_*`, `execucao_pedido_*`) são INVOKER de propósito; (c) **GRANT/REVOKE**: toda função nova tem `REVOKE ... FROM PUBLIC, anon`; as internas e de trigger também de `authenticated`; (d) **RLS negativa**: `execucao_pedidos_material`/`execucao_historico_pedidos` só têm `*_admin_all` e `*_compras_select`; `execucao_pedidos_questionamentos` só `pode_ver_compras()` e sem INSERT/UPDATE/DELETE para `authenticated` — TECNICO lê 0 linhas e só chega a pedido por `reportar_falta_material`; (e) **idempotência**: `CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP ... IF EXISTS`, constraints guardadas por `pg_constraint`; backfills só tocam linhas ainda não tratadas; (f) **rollback** presente no topo de todas, com a ressalva de que a 22 precisa do valor anterior do bucket e a 21 não reverte a limpeza de notificações.

Riscos **ainda abertos** (não corrigíveis só em arquivo): nenhuma migration foi executada; `execucao_horas_efetivas_calc` não foi testada com dados reais (cenário 7.2-7); o nome do trigger de auditoria (`trg_auditar`) é assumido nas migrations 23 e 24 (se diferir, o backfill só gera linhas extras na auditoria); o snapshot `supabase/schema/` está defasado.

### F.9 Achados da Performance incorporados nos arquivos (migrations 19, 20, 25, 26, 29 e 30 · aplicadas em 01/11/2026)

| Achado (Anexo G) | O que foi feito |
|------------------|-----------------|
| **S2** `execucao_recalcular_etapa_pai` gravava `updated_at = now()` mesmo sem mudança | Mig. 19: o novo estado (status, progresso, datas reais) é calculado em variáveis e o `UPDATE` só roda com `(progresso, status, data_inicio_real, data_fim_real) IS DISTINCT FROM (novos)`. Sem escrita inútil, sem evento Realtime e sem linha de auditoria quando nada muda. |
| **S3** `generate_series` ilimitado em `execucao_horas_efetivas_calc` | Mig. 20: cada intervalo em andamento vale no máximo **60 dias** (`LEAST(fim, ini + 60 dias)`) e a série de dias é gerada **por intervalo** (só dias cobertos, com `DISTINCT`), não contínua entre o 1º início e o último fim. O teto diário da jornada continua valendo; uma atividade esquecida em andamento por meses conta no máximo 60 dias. |
| **S9** índices redundantes | Mig. 25: removido o parcial `idx_quest_abertos` (`(pedido_id, status)` já atende as buscas por questionamento aberto). Mig. 26: `idx_pedidos_created_id (created_at DESC, id)` é necessário para o keyset; o antigo `idx_execucao_pedidos_data (created_at)` fica coberto, mas **não foi removido** (decidir depois de `pg_stat_user_indexes` mostrar `idx_scan = 0`; o `DROP` está comentado na mig. 26). |
| **Mig. 29** (índice da Performance) | Revisada: coerente com a 19/20 (as consultas por `etapa_pai_id` usam igualdade, que implica `NOT NULL`, então o índice parcial é elegível), sem dependências e sem conflito de nome (`idx_etapas_pai` não existe antes). Entrou no README e em F.1 como 8d, recomendada **antes ou junto da 19**. |
| **R3** `buscarObras` embute atividades de todas as etapas só para o alerta | Mig. 30 e service novo, abaixo. |

**RPC `execucao_passos_pendentes_por_etapa(p_obras uuid[] DEFAULT NULL)`** (migration 30; STABLE, INVOKER, só `is_admin_execucao()`; `EXECUTE` para `authenticated`, não para `anon`).
- `p_obras`: ids das obras; `NULL` = todas as obras não concluídas/canceladas. Com ids, devolve também de obras concluídas.
- Retorna **1 linha por etapa pai** (sem `etapa_pai_id`, com ≥ 1 sub-etapa não cancelada e status ≠ `concluida`/`cancelada`): `obra_id, etapa_id, passos_total, passos_concluidos, passos_abertos, atividades_total, atividades_concluidas, atividades_abertas, passos_pendentes`.
- `passos_pendentes` é o número do alerta: igual a `passos_abertos` quando o pai tem ≥ 1 atividade própria (não cancelada) e **todas** estão concluídas; senão 0. É o mesmo critério de `passosPendentesDaEtapa` (`estadoEtapa.js`).
- Etapas pai fora da resposta = sem alerta (0). O front pode mapear por `etapa_id` e **parar de embutir** `execucao_atividades(id,status)` em `buscarObras({ comAtividades: true })`.
- Service: `execucaoService.buscarPassosPendentesPorEtapa(obraIds)` → `{ success, data }` (linhas acima).

### F.10 Aplicação no banco e testes de fumaça (01/11/2026)

**Aplicação.** Via `apply_migration`: `29` e `19` (orquestrador); depois `20`, `27`, `21`, `22`, `23`, `24`, `25`, `26`, `30`, `28` e `31` (Backend). Antes de aplicar, conferi com `pg_get_function_result` que os retornos de `deslocar_etapas`, `execucao_indicadores`, `execucao_media_realizada_templates`, `alterar_status_atividade` e `execucao_contexto_atividades` batiam com o atual (nenhum `DROP` extra foi preciso). Uma tentativa de aplicar `28` e `30` em paralelo colidiu na versão da `schema_migrations`; o banco desfez a 28 (transação atômica) e ela foi reaplicada em seguida. As versões gravadas no banco não têm o bloco de comentários de cabeçalho (objetivo e `-- ROLLBACK:`); os arquivos em `supabase/migrations/` são a fonte. Verificado: `alterar_status_atividade` com **1** assinatura (13 parâmetros); nenhuma função nova executável por `anon`; todas as `SECURITY DEFINER` com `search_path = public`; funções internas e de trigger sem `EXECUTE` para `authenticated`.

**Testes de fumaça** (blocos `DO` que terminam em `RAISE EXCEPTION`, ou seja, tudo revertido; papéis simulados com `set local role authenticated` e `request.jwt.claims` de usuários reais):

| Cenário | Resultado |
|---------|-----------|
| TECNICO marca os 4 passos de "MEDIÇÃO OHMICA" (Ed Mares dos Sul), com a atividade do pai aberta | Pai fica `em_andamento`, progresso 99, `passos_feitos 4/4`: **a sub-etapa não conclui o pai** (R14). |
| TECNICO conclui a atividade do pai (com observação e `geo_status = 'ok'`) | Pai `concluida` (100%, `data_fim_real` preenchida); `horas_origem = 'intervalos'`, `conclusao_origem_horario = 'servidor'`, `conclusao_geo_status = 'ok'`, observação gravada. |
| TECNICO reabre um passo | Pai volta a `em_andamento` (67%), `data_fim_real` limpa. |
| RLS negativa (TECNICO) | 0 pedidos, 0 histórico de pedidos, 0 questionamentos; `compras_listar_pedidos`, `compras_indicadores`, `compras_assumir_pedido` e `execucao_passos_pendentes_por_etapa` negados ("Sem permissão"); `INSERT` direto em questionamentos: "permission denied"; `UPDATE` em pedidos: 0 linhas. |
| ADMIN_EXECUCAO | `compras_listar_pedidos` 4 linhas (5 pedidos, menos a lista de obra vazia), `compras_indicadores` ok (4 em `aguardando_compra`, 1 urgente em aberto), `execucao_passos_pendentes_por_etapa` ok, `execucao_indicadores` com `conclusoes_sem_localizacao = []` e `horas_por_tipo = []` (série nova ainda vazia). Não abre questionamento (só Compras). |
| COMPRAS (simulado: um técnico promovido ao nível COMPRAS dentro da transação) | `is_compras = true`, `is_admin_execucao = false`; lê pedidos (5) e histórico (5); `UPDATE`/`DELETE` direto: 0 linhas; obras: 0; **lê POPs (1) mas não consegue inserir** ("violates row-level security"); RPCs de lista e indicadores funcionam. |
| Fluxo de compra (pedido de 4 itens) | assumir → `em_cotacao`; questionamento de quantidade (2,5 un) → `aguardando_solicitante` (anterior `em_cotacao`); o admin aprova → item vira **3 un** (arredondou para cima), `id` do item preservado, status volta a `em_cotacao`; substituição reprovada sem observação → erro, com observação → `reprovado`; `comprado` sem data → erro, com data → ok; editar `itens` depois de comprado → erro; `entregue` → `status` legado `entregue` + `data_entrega`; `compras_detalhe_pedido` devolve `solicitante_nome`, `comprador_nome`, `usuario_nome` do histórico e `criador_nome`/`respondedor_nome`. |
| Etapa de chegada | Pedido de obra em andamento: 1ª data cria 1 etapa "📦 Chegada dos Materiais" (`etapa_criada: true`); 2ª data só atualiza `data_fim` (1 etapa, sem duplicar). Pedido de obra `concluida` não cria etapa. |

**Achado nos testes (corrigido na migration 31).** O teto diário das horas somava o extra de jornada e usava 480 min em dia sem jornada: uma atividade iniciada na terça e esquecida aberta até domingo deu 52,49 h. Com o teto só na jornada líquida passou a 30,49 h (terça à tarde + quarta a sexta; sábado e domingo valem 0). Continua sendo um limite superior para atividade esquecida em andamento: o aviso do §3.1.1 A (esquecer de pausar) segue valendo.

**Advisors** (security e performance, depois das migrations):
- *Novo e corrigido:* `multiple_permissive_policies` em `execucao_pedidos_material` e `execucao_historico_pedidos` (introduzido pela 24); a 31 troca por 1 policy de `SELECT` (admin ou COMPRAS) e policies de escrita só do admin. As demais ocorrências (21) já existiam ou seguem o mesmo padrão das tabelas da Execução.
- *Esperado, sem ação:* `authenticated_security_definer_function_executable` para as RPCs novas (`compras_*`, `execucao_marcar_passo`, `alterar_status_atividade`, `is_compras`, `pode_ver_compras`): o papel é validado dentro de cada função, e o padrão é o mesmo de `is_admin_execucao`.
- *Esperado:* `unused_index` para os índices novos (`idx_etapas_pai`, `idx_pedidos_*`, `idx_quest_*`): ainda sem tráfego; reavaliar com `pg_stat_user_indexes` depois de algumas semanas (o `DROP` de `idx_execucao_pedidos_data` segue comentado na 26).
- *Já existia, não é das migrations 19–31:* `rls_disabled_in_public` em `permissoes`, `niveis_acesso` e `paginas` (ERROR; a 24 só inseriu linhas nelas; **recomendo ao dono revisar**, porque RLS desligado nessas tabelas expõe os níveis e as permissões à API), `rls_enabled_no_policy` em `execucao_acoes_cliente` (intencional: só funções DEFINER escrevem), `function_search_path_mutable` em `update_updated_at_column`, `auth_leaked_password_protection`, `auth_rls_initplan` (tabelas do Comercial) e `unindexed_foreign_keys` (as FKs novas têm índice).

**Snapshot.** `supabase/schema/tables.sql` (49 tabelas) e `logic.sql` (80 funções com corpo resumido, triggers, policies e índices) foram regenerados pelo procedimento do README do schema, o aviso "DEFASADO" saiu e o grafo foi atualizado (`npm run graph:update`).

### F.11 Compras como módulo próprio (migration 32 · `20261101_32_compras_modulo_proprio.sql`)

- **Página:** nome `Compras`, rota **`compras`** (a antiga `execucao/compras` é renomeada in-place; deixa de existir).
- **Permissões (`permissoes`):** nível `COMPRAS` → **só** `compras`. `Administrador` e `ADMIN_EXECUCAO` → `compras` além do que já tinham. Nenhuma permissão de COMPRAS a `execucao`, `execucao/pops`, `dashboard`, `apontamentos`, `arsenal`.
- **Detecção no front:** `usuario.nivel_acesso.nome === 'COMPRAS'` (mesma fonte do login). Página inicial desse nível: `/compras`; qualquer outra rota protegida → redirecionar para `/compras`. Admins abrem `/compras` via `verificarPermissao(usuario.id, 'compras')`; a lista fixa do front deve trocar `execucao/compras` por `compras`.
- **Dados:** inalterados. RLS/RPCs de Compras usam `current_nivel()` (`is_compras()`/`pode_ver_compras()`), não `permissoes`.
- **Diagnóstico (sem acesso ao MCP; por código):** `paginas`/`permissoes`/`niveis_acesso` têm RLS desligado (legíveis). O front hardcoda COMPRAS em `execucao`, `execucao/compras`, `execucao/pops`, e a página/nível ficava no módulo Execução. Causas prováveis no usuário criado: (1) `usuarios.ativo = false` (cadastro pelo fluxo padrão nasce inativo, auth.js ~L224); (2) `auth_user_id` nulo/não vinculado (então `current_nivel()` devolve NULL e RLS nega tudo). Conferir: `SELECT u.email,u.ativo,u.auth_user_id,n.nome FROM usuarios u JOIN niveis_acesso n ON n.id=u.nivel_acesso_id WHERE n.nome='COMPRAS';`
- **Rollback:** bloco `-- ROLLBACK:` da migration.

## Anexo G: Relatório de Performance P1–P3 (Especialista de Performance, 2026-11-01)

> **Método e limite.** Sem banco: nada foi medido em Postgres (sem `EXPLAIN ANALYZE`, sem advisors). Os achados de SQL vêm da leitura das definições (EXPLAIN mental) e são **hipóteses a confirmar** com as consultas da seção G.4. As métricas de front são **medidas** com `npm run build` (Vite 7), antes e depois. Premissa de escala: tabelas de milhares de linhas, não milhões.

### G.1 Front: medições (`npm run build`)

| Chunk | Antes (kB / gzip) | Depois (kB / gzip) | Mudança aplicada |
|-------|------------------:|-------------------:|------------------|
| `index` (carga inicial de TODOS os perfis) | 1.816,71 / 549,82 | **399,00 / 119,13** | `Dashboard`, `DashboardV2`, `ApontamentosComercial`, `ArsenalDeGuerra` em `React.lazy` (App.jsx) + barrel `services/index.js` sem `execucaoService`/`execucaoComprasService` |
| `Dashboard` (comercial V1, novo chunk) | (dentro do index) | 589,62 / 189,11 | só quem abre o Dashboard Comercial |
| `install` (echarts, novo chunk) | (dentro do index) | 539,09 / 182,61 | idem |
| `DashboardV2` / `ArsenalDeGuerra` / `ApontamentosComercial` | (dentro do index) | 59,94 / 60,77 / 71,15 | idem |
| `PlanejamentoMacro` | 216,27 / 59,11 | **144,54 / 40,45** | 7 modais em `React.lazy` (+ `Suspense fallback={null}`) |
| Modais (7 chunks novos) | (dentro do Planejamento) | 4,2 + 5,0 + 7,0 + 7,1 + 10,5 + 11,6 + 19,9 = 65,3 | carregam ao abrir o modal |
| `ExecucaoDashboard` | 38,16 / 11,95 | 78,37 / 19,44 | recebe o serviço `execucao.js` (~40 kB), que antes ia no `index`; sai de quem só usa o Comercial |
| `DashboardCompras` | 44,62 / 13,08 | 45,03 / 13,25 | +0,4 kB (memo + helper de referências) |
| `PedidoMaterial` | 50,31 / 13,12 | 50,32 / 13,13 | sem mudança |

- **Perfil técnico/Compras (Execução):** o JS bloqueante da 1ª tela caiu de ~550 kB gzip para ~119 kB gzip (+ ~19 kB do chunk da Execução, que já carregava). O Dashboard Comercial (~190 kB gzip) e o echarts (~183 kB gzip) deixaram de ser baixados por quem não os usa.
- **Perfil comercial:** passa a ter um 2º request (Dashboard + echarts, ~370 kB gzip) após o `index`; o fallback é a tela de carregando já existente. Total baixado praticamente igual, mas paralelizável e com cache por chunk.
- **P3 (aceite):** `DashboardCompras` só é referenciado por `import()` dinâmico em `ExecucaoDashboard` (0 referências no `index`); `TextoFormatado` só existe no chunk de `POPs`. Nenhum dos dois entra no chunk inicial do técnico ✅. Lighthouse mobile do Meu Dia: **não medido** (sem navegador).
- **Precache do SW:** 58 entradas / 2.768,79 KiB → 78 entradas / 2.780,39 KiB (neutro). Ver recomendação G.3-R2.
- Aviso do Vite "chunk > 500 kB" persiste (agora em `Dashboard` e `install`, antes só no `index`).

### G.2 Front: mudanças aplicadas (sem alterar comportamento ou contrato dos services)

1. `App.jsx`: `React.lazy` + `Suspense` (fallback `TelaCarregando`) para as 4 páginas do Comercial. `AdminPanel` continua estático (é montado em todas as ramificações com `isOpen`; mexer exigiria mudar a semântica de montagem).
2. `services/index.js`: removidos `execucaoService` e `execucaoComprasService` do barrel (nenhum consumidor os importava por ele; o módulo Execução importa direto de `supabase/execucao*.js`). Era o que arrastava `execucao.js` (~74 kB de fonte) para o bundle do Comercial.
3. `PlanejamentoMacro.jsx`: `ObraFormModal`, `TemplateFormModal`, `EtapaFormModal`, `AtividadeEtapaModal`, `ServicoRapidoModal`, `RevisarContratosPendentes` e `ReprogramarModal` em `React.lazy` dentro de um `Suspense fallback={null}` (todos já eram renderizados só sob condição; nenhum outro arquivo os importava).
4. `FormularioPedido.jsx` + `execucao.js`: sugestão de clientes não chama mais `buscarObras()` (obras × etapas × usuários, `select *`, até 20 páginas). Novo método aditivo `buscarClientesDeObras()` com `select id, nome_cliente, status`; o filtro por status continua no cliente (mesmo resultado, inclusive para `status` nulo). `npm run check:contract` ✅.
5. `compras/useComprasPainel.js`: o refresh silencioso (Realtime com debounce de 500 ms + reforço de 60 s) agora reaproveita as referências dos pedidos que não mudaram (`reaproveitarGrupo`) e mantém o objeto `grupos` quando nada mudou. Simulação com 6 colunas × 200 pedidos × 12 itens: sem mudança → 6/6 grupos reaproveitados, 0 referências novas (antes: 1.200 objetos novos por refresh), custo 3,5 ms; 1 pedido alterado → 1 de 200 referências novas.
6. `compras/CartaoPedidoCompras.jsx` em `React.memo`; `DashboardCompras.jsx`: `aoAcaoRapida` em `useCallback` e `onAbrir={abrirDetalhe}` (callbacks estáveis; sem isso o memo não valeria). Efeito: digitar na busca ou chegar um evento Realtime não re-renderiza os cartões inalterados. Nº de renders por cartão **não** foi medido no navegador (sem React Profiler); o ganho acima é por identidade de referência.
7. Lint dos arquivos tocados: sem erros. O `npm run lint` global continua com 49 erros/18 avisos **preexistentes** em outros arquivos (67 problemas; o total não mudou entre as medições feitas após as primeiras e as últimas edições; não medi antes da 1ª edição).

### G.3 Recomendações pendentes (front)

| # | Achado | Impacto | Esforço | Evidência |
|---|--------|---------|---------|-----------|
| R1 | `useComprasPainel` faz **1 RPC por coluna** (6) a cada refresh, mais `compras_indicadores`, a cada evento Realtime (após 500 ms) e a cada 60 s, por usuário aberto. Realtime é redundante com o polling de 60 s. | Alto (carga no banco cresce com nº de usuários × eventos) | Médio | `useComprasPainel.carregar`, `DashboardCompras.aoMudar`, `useAtualizacaoTabelas` |
| R2 | PWA: `globIgnores` do SW não exclui os novos chunks do Comercial (`Dashboard-*`, `install-*`, `DashboardV2-*`, `ArsenalDeGuerra-*`, `ApontamentosComercial-*`); o SW só é registrado na Execução, então o técnico pré-baixa ~1,1 MB de JS que nunca usa. Cuidado: `install-*` (echarts) também é usado por páginas de gráficos da Execução; validar offline antes de excluir. | Médio (1ª instalação em 4G) | Baixo | `vite.config.js` `globIgnores`; precache 2,78 MiB |
| R3 | `buscarObras({ comAtividades: true })` do Planejamento embute `execucao_atividades(id,status)` por etapa para TODAS as obras, só para o alerta "passos pendentes" (`passosPendentesDaEtapa`, que só olha etapas pai). Payload ∝ obras × etapas × atividades, com `select *` nas etapas. Sugestão: RPC/view que devolva só o contador (`total`, `concluidas`) por etapa pai, ou buscar as atividades apenas da obra expandida. | Alto quando houver centenas de obras | Médio | `execucao.js` `selectObrasComEtapas`, `estadoEtapa.js` |
| R4 | Após `reload()`, `obras` é um array novo e todo `ObraCard` (já em `React.memo`) re-renderiza; só uma obra fica expandida (Gantt/`ListaEtapasMobile` só montam expandidos, `useMemo` presentes). Reaproveitar referências como em G.2-5 se o Profiler mostrar lentidão com 60+ obras. | Baixo | Baixo | `PlanejamentoMacro` `limiteObras = 60` já limita a lista |
| R5 | `useAtualizacaoTabelas`: sem vazamento de canal (cleanup remove canal, listener e timers; checagem `vivo` entre os `await`). Pontos de atenção: cada hook abre um canal e um `onAuthStateChange` próprios (PedidoMaterial + `ModalConversaPedido` abertos juntos = 2 canais com a mesma tabela); sem `maxWait` no debounce (rajadas contínuas adiam o refresh); `useBadgesMenu` continua consultando a cada 2 min com a aba oculta. | Baixo | Baixo | `useAtualizacaoTabelas.js`, `useBadgesMenu.js` |
| R6 | `index` ainda tem ~399 kB (119 kB gzip): `useGoogleSheetsData()` é chamado em `AppContent` para todos os perfis (busca de planilha mesmo para o técnico). Avaliar mover para dentro das páginas do Comercial. | Médio | Baixo | `App.jsx` |
| R7 | Upload de vídeo/áudio (`EvidenciasUploader`, `filaUpload`, `gravador`): **não revisado a fundo**; confirmar compressão/limite de tamanho antes do upload e envio em fila com retry. Ver Anexo B. | A confirmar | — | — |

### G.4 SQL: achados (EXPLAIN mental; confirmar no banco)

| # | Objeto | Achado | Impacto | Esforço | Ação |
|---|--------|--------|---------|---------|------|
| S1 | `execucao_obras_etapas.etapa_pai_id` | **Sem índice** (nenhuma migration/schema cria). Usado em `execucao_recalcular_etapa_pai` (2 consultas + `FOR UPDATE`), `execucao_sincronizar_etapa_pai`, `NOT EXISTS`/`EXISTS` de filhos em `alterar_status_atividade` (mig. 19/20) e `deslocar_etapas`. Cada mudança de status de atividade dispara 2–4 varreduras. | Alto | Baixo | **Criado**: `20261101_29_execucao_indice_etapa_pai.sql` (parcial, `WHERE etapa_pai_id IS NOT NULL`). Aplicado em 01/11/2026 (versão `execucao_29_indice_etapa_pai`). |
| S2 | `execucao_recalcular_etapa_pai` (mig. 19) | O `UPDATE` final roda sempre e faz `updated_at = now()` mesmo quando status/progresso/datas não mudam: escrita inútil, evento Realtime em `execucao_obras_etapas` e linha de auditoria a cada chamada. Sugestão: `WHERE id = p_pai AND (progresso, status, data_inicio_real, data_fim_real) IS DISTINCT FROM (novos valores)`. | Médio | Baixo | **Backend** incorporar na própria mig. 19 antes de aplicar (não criei a 29 duplicando a função para não divergir da 19). |
| S3 | `execucao_horas_efetivas_calc` (mig. 20) | `generate_series` de dias entre o 1º início e o último fim × `CROSS JOIN LATERAL execucao_jornada_dia` por dia: se a atividade ficar "em andamento" por meses (esquecimento) ou o relógio do aparelho estiver errado, são centenas/milhares de chamadas por conclusão. O índice `idx_hist_atv_created (atividade_id, created_at)` cobre as leituras do histórico. | Médio | Baixo | **Backend**: limitar a série (ex.: `LEAST(fim, ini + 60 dias)`), alinhado ao teto de jornada do plano (risco 3 do §3.1). |
| S4 | `compras_listar_pedidos` (mig. 26) | `STABLE` ✅ (só leitura). `idx_pedidos_created_id (created_at DESC, id)` casa com `ORDER BY created_at DESC, id ASC LIMIT`. Subselects correlacionados usam `idx_quest_abertos` (parcial) ✅; joins por PK ✅. Pontos fracos: (a) `execucao_pedido_tem_itens(p.itens)` é chamada 2× por linha (WHERE e SELECT) e não é indexável; (b) cursor `created_at < x OR (= AND id > y)` não vira condição de índice (a página N percorre N−1 páginas filtrando); (c) `p.itens::text ILIKE '%…%'` é seq scan; (d) filtros "catch-all" `(v IS NULL OR …)` em PL/pgSQL podem virar plano genérico após 5 chamadas. | Baixo até ~10 mil pedidos | Baixo | Sem mudança agora. Reavaliar no `EXPLAIN ANALYZE` com 5 mil pedidos (meta p95 < 150 ms). Se passar: `AND p.created_at <= v_cur_t` redundante (sargável), `RETURN QUERY EXECUTE` só com filtros presentes e/ou coluna `na_fila boolean` mantida por trigger + índice parcial. GIN `jsonb_path_ops` não serve a `ILIKE`; para busca livre usar `pg_trgm` só se passar de 200 ms. |
| S5 | `compras_indicadores` (mig. 26) | `STABLE` ✅. A CTE `fila` é lida por ~10 subselects (o Postgres materializa uma vez), mas varre **toda** a tabela de pedidos a cada chamada e é chamada a cada evento Realtime + 60 s por usuário. Os filtros de período por `comprado_em`/`respondido_em` não têm índice. "Obras paradas": subselect por atividade pausada usa `idx_atv_status_data` e `idx_hist_atv_created` ✅. | Médio (cresce com histórico e usuários) | Baixo | Front: não refazer indicadores a cada evento (throttle ≥ 15–30 s). Banco: só se > 300 ms, índices parciais em `comprado_em` e `(respondido_em) WHERE status IN ('aprovado','reprovado')`. |
| S6 | `execucao_indicadores` (mig. 27) | `STABLE` sem `SECURITY DEFINER` ✅ (RLS valida o chamador). Predicados `(fim_real_em AT TIME ZONE …)::date BETWEEN` e `h.created_at::date BETWEEN` não usam índice. Pausas: o `::date` de `timestamptz` usa o fuso da sessão (pode divergir de São Paulo; é correção, não performance). | Baixo (tabelas pequenas) | Baixo | **Não criei** índice por expressão (Jev: 0,34 de ser compensador abaixo de ~10 mil linhas). Reescrever como faixa `>= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo') AND < …` (sargável, equivalente) se o p95 passar de 300 ms. |
| S7 | Policies (mig. 24/25/28) | Nenhum `auth.uid()` direto nas migrations 19–28: o padrão é `(SELECT public.is_compras())` / `(SELECT public.pode_ver_compras())` com subselect (avaliado uma vez por consulta) ✅. As funções de papel são `STABLE SECURITY DEFINER` com `search_path` ✅; `execucao_pedido_tem_itens` é `IMMUTABLE` ✅ (usável em índice parcial). | — | — | Nada a fazer. |
| S8 | Backfill (mig. 23, 24) | 24: `ADD COLUMN … NOT NULL DEFAULT 'constante'` é só metadado (PG ≥ 11) ✅, auditoria desligada só no backfill ✅, UPDATEs em lote único (tabela pequena). `CHECK` sem `NOT VALID` faz varredura sob lock exclusivo (milissegundos nesta escala). 23: laço de 1.000 linhas, mas **dentro de um único `DO`** = uma transação (os "lotes" não reduzem lock nem WAL) e cada volta reavalia o `EXISTS` sobre a tabela toda (O(N²/1000)); termina porque `execucao_pedidos_itens_com_id` preenche os ids. | Baixo | Baixo | Aceitável para milhares de pedidos; se passar de ~50 mil, rodar o backfill fora da migration, em lotes com `COMMIT`. |
| S9 | Índices redundantes | `idx_execucao_pedidos_data (created_at)` (schema/logic.sql) fica coberto por `idx_pedidos_created_id` (mig. 26); `idx_quest_pedido_status (pedido_id, status)` e o parcial `idx_quest_abertos` se sobrepõem para `status='aberto'`. | Baixo (custo de escrita) | Baixo | **Backend** decide, após `pg_stat_user_indexes` mostrar `idx_scan = 0`. |
| S10 | Realtime (mig. 25) | `execucao_pedidos_material` e `execucao_pedidos_questionamentos` entram na publicação; com RLS, cada evento é autorizado por inscrito. `execucao_pedidos_material` guarda `itens` jsonb grande no payload (replica identity não verificada). | Médio com muitos usuários | Médio | Ver R1. Se o payload pesar, avaliar mover a conversa/itens para consulta sob demanda. |

**Consultas para fechar P1/P2 (somente leitura / transação com ROLLBACK):** `EXPLAIN (ANALYZE, BUFFERS)` de `select execucao_recalcular_etapa_pai(<pai com ~200 etapas>)` e de `select * from compras_listar_pedidos('{}', 50, null)`, `... '{"busca":"cabo"}'`, `select compras_indicadores()` com 5 mil pedidos sintéticos inseridos dentro de `BEGIN … ROLLBACK`; `get_advisors` (performance) e `select relname, idx_scan from pg_stat_user_indexes where relname like 'execucao_%'`.

### G.5 Uso de ferramentas

graphify: 3 consultas (localizar páginas/Realtime e `buscarObras`). Jev: 1 chamada com 5 perguntas (índice de `etapa_pai_id` 0,76; índice por expressão em `fim_real_em` 0,34; troca no `FormularioPedido` 0,62; lazy dos modais 0,54; onde registrar S2 `choice` 0,06). Todas abaixo do limiar de 0,8; cada uma foi decidida por verificação no código/build (ausência do índice confirmada por busca em `supabase/`; modais sem outros importadores; barrel sem consumidores de `execucao`/`compras`; build limpo).

## Anexo E: Resultado do QA (Q1–Q4 sem banco) e roteiro manual pós-migrations

> **Escopo desta rodada:** QA possível **sem banco, sem navegador autenticado e sem aparelho**: verificações automatizadas, testes unitários dos helpers puros e revisão de código orientada a regressão (Ondas 1, 3 e 5). **Nenhuma migration foi aplicada** e nenhum dado do Supabase foi lido ou alterado. A Q0 (baseline com prints/gravações da versão anterior) **não foi feita** (exige app rodando com login). Itens que dependem de banco/aparelho aparecem como NÃO TESTÁVEL, com o passo do roteiro E.5 que os fecha.

### E.1 Comandos executados

| Comando | Resultado |
|---|---|
| `npm run build` | ✅ passou (≈3 s). `DashboardCompras` saiu em chunk próprio (≈45 kB) e **não** está no `index-*.js` inicial; `POPs` também em chunk próprio. Aviso de chunk > 500 kB é anterior a esta entrega. |
| `npm run check:contract` | ✅ `Contrato componentes ↔ serviço OK` (rodado 3×, também depois de o service de Compras passar a usar as RPCs da migration 28) |
| `npm run lint` (`eslint .`) | ⚠️ 49 erros + 18 avisos, **todos em arquivos não alterados** (`components/*`, `auth.js`, `extractors.js`, `dashboard*`, etc. = baseline). **0 problemas** em `features/execucao/**`, `components/ui/**`, `services/supabase/execucao*.js`, `services/index.js`, `App.jsx`, `ProtectedRoute.jsx`. O único erro em arquivo alterado (`AuthContext.jsx` L7 `react-refresh/only-export-components`) existe idêntico no `HEAD` (conferido com `git show HEAD:... | eslint --stdin`). Não é regressão. |
| `node scripts/testes-unitarios.mjs` | ✅ 59 testes: **57 passam, 0 falham, 2 `todo`** (bugs conhecidos BUG-QA-02/03, ver E.3). *Rerun em 2026-11-01: 58 testes, 58 passam, 0 `todo`; conferir ACH-04/ACH-05.* |

### E.2 Testes automatizados novos

O repositório **não tem runner** (sem Vitest/Jest) e **nenhuma dependência foi adicionada**. O script `scripts/testes-unitarios.mjs` usa só `node:test` (embutido) e o `esbuild` que já vem junto do Vite (transitivo; os bundles temporários ficam em `node_modules/.cache/qa-testes`, ignorado pelo git) para carregar módulos do `src/` com imports sem extensão e JSX. Execução: `node scripts/testes-unitarios.mjs` (registrado no `package.json` como `npm run test:unit`). Fuso fixado em `America/Sao_Paulo` dentro do script.

| Módulo | Casos |
|---|---|
| `pedido-material/utils` · `passoDaUnidade`, `normalizarQuantidade`, `quantidadeValida`, `formatarQuantidade`, `atualizarCampoItem`, `marcarItensInvalidos`, `itensSemKey` | un/cx/pct passo 1; m/m²/kg/l passo 0,1; 2,5→3 (teto, tolerância 1e-9); vírgula; 2 casas; vazio/NaN/Infinity→null; m→un com aviso; vazio preservado na edição; erro só em item preenchido |
| `pedido-material/utils` · `diffItens` | add/remove/alterado por id (inclui renomear); registros antigos sem id (nome sem acento/caixa + unidade); unidade trocada; ids diferentes = itens distintos; antes com id × depois sem id; nulos/JSON inválido/linha em branco; criação; `2` × `"2"` |
| `pedido-material/periodo` | atalhos hoje/7/30/mês/personalizado/todos; início 00:00 SP (03:00Z), fim exclusivo; borda 23:30 SP; virada de mês/ano/bissexto; só um lado |
| `ui/TextoFormatado` (via `renderToStaticMarkup`) | parágrafos, `<br/>`, listas `-`/`•`/`*`/`1.`/`1)`, grupos mistos, **HTML escapado** (`<b>`, `<img onerror>`), CRLF/CR, vazio, `compacto`, ausência de `dangerouslySetInnerHTML` |
| `planejamento/estadoEtapa` | `estadoEtapa` (concluída, atrasada com dias, fim hoje, `atrasada` sem data, em andamento/pausada/planejada); `passosPendentesDaEtapa` (todas as atividades do pai concluídas + subs abertas; cancelada não conta; atividade aberta → 0; sub-etapa/pai concluído/cancelado/sem dados → 0) |
| `utils/conclusao` | `rotuloOrigemHoras` (4 origens, nulo, legado), `linkMapa` |
| `compras/statusCompra` | integridade colunas/transições × `STATUS_COMPRA`; transições = Anexo F.4; ação rápida; rótulos; durações pt-BR; `tempoRelativo`; `diasDeAtraso`; `rotuloItem`/`montarPrevia`; descrição acessível |

### E.3 Resultado por critério (R1–R15)

Legenda: **PASSOU** = verificado (unit/revisão de código) e sem pendência de banco · **PASSOU (parcial)** = front verificado, falta a metade que depende de banco/aparelho · **FALHOU** · **NÃO TESTÁVEL** = precisa de banco aplicado e/ou aparelho (passo em E.5).

| ID | Resultado | Evidência / pendência |
|----|-----------|-----------------------|
| R1 POP igual em gestão e técnico | **PASSOU (parcial)** | `TextoFormatado` testado (listas, parágrafos, `<br/>`, HTML literal, sem `dangerouslySetInnerHTML`); a gestão e o técnico usam o mesmo `POPs.jsx` (L386, L476, L484). **Falta** conferência visual em 360/1440 px (E.5-A1). |
| R2 Cliente no novo pedido | **PASSOU (parcial)** | Campo + `<datalist>` das obras não encerradas, obrigatório só no pedido novo avulso, gravado em `dados`/`dadosAnteriores`/histórico (`FormularioPedido` L188–200, L267). Aparece no Dashboard de Compras via `compras_listar_pedidos.cliente_nome`. Falta ver na UI com dados (E.5-A2). |
| R3 Quantidade inteira por unidade | **PASSOU** | Unit (passo, teto 2,5→3, m→un com aviso, 2 casas, vírgula) e `CampoQuantidade` revisado (setas, −/+, `inputMode`, blur). Template usa o mesmo componente e `atualizarCampoItem`. |
| R4 Quantidade pode ficar vazia | **PASSOU** | Unit (`''` preservado; `marcarItensInvalidos` só em item preenchido, devolve a 1ª key para foco). |
| R5 Histórico com itens detalhados | **PASSOU (ressalva)** | Unit de `diffItens` OK, incluindo registro antigo sem id. Ressalvas: BUG-QA-02 (item sem quantidade acusa alteração falsa) e, **sem id**, "Cabo 2,5mm → Cabo 4mm" aparece como remover+adicionar (só vira "alterado" com id, o que passa a valer após a migration 23). |
| R6 Filtro de data do pedido | **PASSOU (parcial)** | Unit de intervalos/bordas SP OK; service envia `gte`/`lt` em `created_at`; SQL de `compras_listar_pedidos` usa `America/Sao_Paulo` e fim exclusivo. Falta rodar contra dados (E.5-A5). Obs.: o filtro do Pedido de Material calcula o início do dia no fuso **do navegador**, o RPC no de SP (diverge só com aparelho em outro fuso). |
| R7 Questionamento comprador ↔ criador | **NÃO TESTÁVEL** | Contrato RPC ↔ service conferido (nomes e parâmetros de `compras_abrir/responder/cancelar_questionamento`, `compras_assumir_pedido`, `compras_alterar_status`, `compras_definir_disponibilidade`, `compras_listar_pedidos`, `compras_indicadores`, `compras_detalhe_pedido`, `compras_listar_questionamentos`: **sem divergências**). Fluxo ponta a ponta exige banco (E.5-C). |
| R8 Dashboard de Compras | **PASSOU (parcial)** + **ressalva de negócio** | Rotas/permissões: `permissoes.js`, `AuthContext`, `ProtectedRoute`, `ExecucaoDashboard` (guarda por perfil, `paginaDeSeguranca`), `Sidebar` coerentes; técnico cai em `minhas-atividades`, COMPRAS em `compras`. **Ressalva:** o perfil `Administrador` (geral) não entra no módulo Execução pela UI (`ProtectedRoute` e `obterPaginasPermitidas` já faziam isso antes); o critério "acessível a `Administrador`" só vale por RPC/impersonação. Decisão do Negócio (ACH-02). Realtime e KPIs: NÃO TESTÁVEL (E.5-C). |
| R9 Planejamento responsivo | **NÃO TESTÁVEL** | Sem navegador/aparelho nesta rodada. Revisão estática OK: abas com roving tabindex e `aria-controls`/`tabpanel`, `useMediaQuery`, filtros/Lista mobile, selo de passos. Executar o checklist do Anexo C.5 (E.5-D). |
| R10 Vídeo e áudio | **NÃO TESTÁVEL** | Requer Android/Chrome, iOS/Safari, PWA. Revisão de código OK: timeouts de carga/permissão, câmera solta se abrir tarde, erro → fallback nativo, mensagens de limite/MIME, 415/413 permanentes. Migration 22 aplicada em 01/11/2026 (E.5-E); falta o teste em aparelho. |
| R11 Observação na conclusão | **PASSOU (parcial)** | `textarea` ≤ 1.000, corte no `acoesAtividade`, `p_observacao` só enviado se preenchido; exibido em `ConclusaoAtividade`. Persistência e histórico: NÃO TESTÁVEL (mig. 20). |
| R12 Horário e local automáticos | **PASSOU (parcial)** | Sem campo de horário/horas; instante do clique (`cliqueEm`) vai em `ocorridoEm`; `obterLocalizacao` nunca rejeita; permissão negada **não bloqueia** e gera aviso; `geoStatus` ∈ valores do CHECK; lat/long só com `ok`; payload offline guarda tudo; item antigo da fila continua válido. Servidor (`fim_real_em`, ≤ now, `dispositivo`) e GPS real: NÃO TESTÁVEL (E.5-B). |
| R13 Sem notificação de replanejamento p/ técnico | **PASSOU (parcial)** | Front: `neq('tipo','replanejamento')` na busca **e** na contagem (`tipo` é NOT NULL, sem risco de excluir NULL) e filtro no Meu Dia, inclusive no cache offline. Parte do banco (mig. 21) NÃO TESTÁVEL. |
| R14 Etapa só conclui com todas as sub-etapas | **NÃO TESTÁVEL** (banco) / front **PASSOU** | Regra é do servidor (mig. 19). Front: `passosPendentesDaEtapa` testado, selo "Passos pendentes", modal só lista passos com `id`, confirmação "concluir mesmo assim" sem bloquear, passos entram na fila antes do status e a falha de um passo não impede a conclusão. Cenários 7.2-1 e 7.2-2 no banco: E.5-B. |
| R15 Meu Dia sem concluídas | **PASSOU** | `abertasDoDia`/`concluidasDoDia`; seção recolhida por padrão (`aria-expanded`); resumo continua com `doDia`; `estaAtrasada` só considera status abertos; estado vazio de sucesso. |

### E.4 Achados (por severidade)

Nenhum bug **crítico** ou **alto** encontrado. Conforme as restrições do QA, **não alterei código de produção**; os itens abaixo têm a correção sugerida.

| ID | Sev. | Área | Achado | Reprodução / evidência | Correção sugerida |
|----|------|------|--------|------------------------|-------------------|
| ACH-01 | **Média** | Frontend | O front **não impede editar itens de pedido já `comprado`/`entregue_parcial`/`entregue`** (Anexo F.6-4). `STATUS_ITENS_TRAVADOS` existe em `compras/statusCompra.js` mas não é usado. Após a migration 24 o banco recusa ("Os itens não podem ser alterados depois que o pedido foi comprado") e o usuário só descobre ao salvar. | `grep STATUS_ITENS_TRAVADOS src` → só a definição. `PedidoMaterial.handleEditar`/`FormularioPedido` não consultam `status_compra`. | Em `handleEditar`/`ListaPedidos`: se `STATUS_ITENS_TRAVADOS.includes(pedido.status_compra)`, abrir o formulário com os itens somente leitura (ou ocultar "Editar" itens) e exibir o aviso. |
| ACH-02 | **Média** (decisão de Negócio) | Auth/Rotas | R8 diz que `Administrador` acessa o Dashboard de Compras, mas `ProtectedRoute` devolve `false` para `execucao*` ao `Administrador` e `obterPaginasPermitidas` só lhe dá páginas comerciais (comportamento anterior). `isCompras()` incluir `Administrador` só vale no RPC/impersonação. | Ler `ProtectedRoute.jsx` L28–36 e `AuthContext.jsx` L186–188. | Negócio decide: manter (acesso por `ADMIN_EXECUCAO`/impersonação) e corrigir o texto do R8, ou liberar `execucao/compras` ao `Administrador`. |
| ACH-03 | Baixa | Frontend | Conflito ao responder questionamento já encerrado não é detectado: a regex de `QuestionamentosPedido.enviar` procura "respondid/cancelad/não está aberto", mas o banco diz **"Este questionamento já foi encerrado (aprovado)"** (mig. 25, L263). A mensagem aparece, mas a conversa não recarrega (`onConflito` não dispara). | Responder em duas abas; a 2ª tenta responder depois da 1ª. | Incluir `encerrad` na regex. |
| ACH-04 | Baixa | Frontend | `formatarDuracaoHoras` arredonda para `60 min`: `1.9999 → "1 h 60 min"`, `0.9999 → "60 min"`, `47.9999 → "47 h 60 min"`. | `scripts/testes-unitarios.mjs` (todo BUG-QA-03). | Somar o minuto ao arredondar (`totalMin = Math.round(h*60)`; `h = floor(totalMin/60)`, `min = totalMin % 60`). |
| ACH-05 | Baixa | Frontend | `diffItens`: dois itens **sem quantidade** (`undefined`) idênticos acusam "alteração" (`Number(undefined) !== Number(undefined)` é `NaN !== NaN`). | todo BUG-QA-02 no script. | Em `mudancasDoItem`, comparar com `Object.is`/tratar `NaN`. |
| ACH-06 | Baixa | Frontend | `DetalhesCompletosAtividade` lista passos `cancelada` (e os conta no denominador "x/y"); o `ModalConcluir` já os oculta (F.7 pede ocultar). | Contexto da mig. 19 devolve canceladas. | `passos.filter(p => p.status !== 'cancelada')`. |
| ACH-07 | Baixa | Frontend/offline | Os passos e o status da conclusão entram na fila com `criadoEm: Date.now()` e a fila ordena só por `criadoEm`; empate no mesmo milissegundo deixa a ordem indefinida. O estado final do pai converge de qualquer forma (o servidor recalcula nas duas ações), mas o texto do histórico ("com N passo(s) em aberto") pode divergir. | `offline/outbox.js` `listarOutbox`. | Desempate por um contador monotônico (ex.: `seq`) ao enfileirar. |
| ACH-08 | Baixa | Frontend | `useComprasPainel`: um `refresh()` silencioso (Realtime/60 s) descarta um "Carregar mais" em andamento sem aviso e, com > 200 itens carregados em uma coluna, volta a 200. | Carregar > 200 pedidos numa coluna e esperar o reforço. | Ignorar `refresh` enquanto `carregandoMais`; ou refazer só a 1ª página e mesclar. |
| ACH-09 | Baixa | Frontend | O indicador **"conclusões sem localização"** (F.7, chave `conclusoes_sem_localizacao`) não é exibido em nenhuma tela. | `grep conclusoes_sem_localizacao src` → vazio. | Item do Backlog (Desempenho/Indicadores), se o Negócio ainda quiser. |
| ACH-10 | Baixa | Rollout | Se o front for publicado **antes da migration 25**, o canal Realtime de `PedidoMaterial`/`DashboardCompras` assina `execucao_pedidos_questionamentos` (tabela inexistente) e a assinatura falha para as duas tabelas. A tela segue pelo reforço de 60 s, sem erro visível. | `useAtualizacaoTabelas` L47–50. | Respeitar a ordem do Anexo F.1 (24→25→26→28 junto com a Onda 5). |
| ACH-11 | Baixa | Frontend | `periodoAtivo(undefined)` devolve `true` (por `undefined !== 'todos'`). Hoje sempre recebe objeto, então sem efeito. | Unit. | `periodo?.atalho && periodo.atalho !== 'todos'`. |
| ACH-12 | Info | Frontend | Em `ModalConcluir` o rótulo "🕒 Agora: …" fica congelado na hora de abertura (o instante real é o do clique). | Leitura do código. | Trocar por "Aberto às …". |
| ACH-13 | Info | Frontend | `rotuloPeriodo` mostra "últimos 30 dias" com período "Todos" porque o RPC `compras_indicadores` assume 30 dias sem datas; a lista, porém, não filtra. Coerente com o banco, mas pode confundir. | `DashboardCompras.jsx` L26–30. | Opcional: rótulo "KPIs: últimos 30 dias". |

**Verificado e sem divergência:** nomes/parâmetros das RPCs × migrations 19, 20, 24–26 e 28 (incluindo os 13 parâmetros de `alterar_status_atividade`, enviados só quando preenchidos); CHECK de `execucao_notificacoes.tipo` na 25 contém todos os tipos anteriores (incl. `nova_atividade`) + 3 novos; `etapa_chegada_criada` é marcada pela RPC de Compras (sem duplicar a etapa criada pelo front); `etapa_chegada_criada = true` **sem** `etapa_chegada_id` (criada pelo fluxo antigo) não é atualizada pela Compras (comportamento documentado na 25 L168); guarda de impersonation presente em todas as escritas novas (prefixo `alterar`/`cancelar` pelo wrapper; demais com `assertNotImpersonating`); sem `dangerouslySetInnerHTML`; efeitos com cleanup (Realtime, timers de destaque, `popstate`, `online`).
> Observação de processo: durante a revisão o service de Compras passou a usar `compras_detalhe_pedido` e `compras_listar_questionamentos` (migration 28). Antes disso, `QuestionamentosPedido` lia `criador_nome`/`respondedor_nome` mas o service devolvia `criador.nome_completo` (nome nunca apareceria). Reverifiquei: **resolvido** com a 28.

### E.5 Roteiro manual pós-aplicação das migrations

**Pré-requisitos.** Homologação (ou transação com `ROLLBACK` para SQL). Aplicar na ordem do Anexo F.1: `diagnostico_B0.sql` → 29 → 19 → 20 (juntas) → 27 → 21 → 22 → 23 → 24 → 25 → 26 → 28 → 30; **não reaplicar a 19 depois da 20**. Usuários de teste: `COMPRAS`, `ADMIN_EXECUCAO`, `TECNICO` (membro da atividade), `TECNICO` (**não** membro), obra de teste com Pai A (atividade própria) + subs A1/A2 e Pai B com 1 sub. Depois: advisors de segurança/performance, regenerar `supabase/schema/`, `npm run graph:update`. Rodar antes: `npm run lint`, `npm run build`, `npm run check:contract`, `node scripts/testes-unitarios.mjs`.

**A. POPs e Pedido (Q1)** — §7.1 itens 1–7, mais:
1. A1 POP com 3 parágrafos + lista `-` + lista `1.` + `<b>x</b>`: gestão × técnico em 360 e 1440 px idênticos; HTML literal.
2. A2 Novo pedido sem cliente bloqueia; com cliente aparece na lista, no histórico ("Criação") e no Dashboard de Compras.
3. A3 Histórico de pedido **antigo** (antes da 23) e de pedido **novo** (com ids): renomear item mostra "Cabo 2,5mm → Cabo 4mm" só no novo.
4. A4 Pedido `comprado`: tentar editar itens → mensagem do banco (e conferir ACH-01).
5. A5 Filtro "7 dias" e personalizado: pedido criado às 23:30 de São Paulo no último dia aparece; conferir o mesmo recorte no Pedido de Material **e** no Dashboard de Compras (mesma contagem).

**B. Técnico, sub-etapas e notificações (Q2)** — §7.2 itens 1–11, mais:
1. **SQL (transação + ROLLBACK):** cenários 7.2-1(a–d) e o fallback por nome 7.2-2; conferir pai `em_andamento` com selo "Passos pendentes" no Planejamento; sub cancelada não conta; rodar `corrigir_etapas_pai_concluidas.sql` só em **dry-run** primeiro.
2. Conclusão online (aparelho real, GPS ligado): `fim_real_em ≈ now()`, `conclusao_origem_horario='servidor'`, lat/long/precisão, observação no histórico e na notificação; **sem** campo de horas/horário no modal.
3. Modo avião: concluir às 10:00, sincronizar 10:30 → `fim_real_em` = 10:00, origem `dispositivo`, `conclusao_registrada_em` = 10:30; marcar um passo offline → o cartão já mostra o passo marcado; ao sincronizar, o passo é aplicado **antes** do status.
4. Permissão de localização negada (e GPS desligado) → conclui com aviso; `conclusao_geo_status` = `negada` / `tempo_esgotado` em ≤ ~8 s.
5. Fila antiga (item de `outbox` sem campos novos, via IndexedDB) sincroniza sem erro. Reenvio do mesmo `id_cliente` não duplica.
6. `horas_realizadas` (08:00→10:00, pausa, 13:00→15:00 = 4 h) e `horas_origem` (`intervalos`/`previstas`); ajuste da gestão grava `ajuste_admin`.
7. Replanejamento: `ReprogramarModal` → técnico sem notificação nova no sino, nas Pendências e em Realtime; notificações antigas do tipo ocultas (cache offline incluído).
8. Meu Dia: concluir → sai de "Hoje", aparece em "Concluídas hoje (1)" recolhida; "Concluídas: 1 de N"; tudo concluído → estado de sucesso.
9. Gestão: `DetalhesCompletosAtividade` mostra observação, horário, "horário do aparelho (offline)", link do mapa, origem das horas e passos sem os cancelados (ACH-06).
10. Migration 27: `horas_por_tipo` e calibração vazias logo após aplicar (mensagem apropriada); depois de novas conclusões, a série recomeça.

**C. Compras ponta a ponta + RLS negativa (Q3)** — §7.3 itens 1–10, mais **os testes negativos abaixo**. Para SQL, em transação descartável, simulando o usuário (`<AUTH_UID>` = `auth.users.id` do usuário de teste):
```sql
begin;
  select set_config('request.jwt.claims', json_build_object('sub','<AUTH_UID_COMPRAS>','role','authenticated')::text, true);
  set local role authenticated;
  -- COMPRAS: leitura de pedidos permitida; escrita direta negada
  select count(*) from public.execucao_pedidos_material;                 -- esperado: > 0
  update public.execucao_pedidos_material set urgencia = urgencia;       -- esperado: 0 linhas (RLS filtra) ou erro 42501
  delete from public.execucao_pedidos_material where false;             -- idem; tente com um id real: 0 linhas
  insert into public.execucao_pedidos_questionamentos (pedido_id, tipo, pergunta) values ('<PEDIDO>', 'duvida', 'teste');  -- esperado: 42501
  select count(*) from public.execucao_obras;                            -- esperado: 0
  select count(*) from public.execucao_atividades;                       -- esperado: 0
  select count(*) from public.usuarios;                                  -- registre o resultado (ver ACH da 28: nomes vêm das RPCs)
  select * from public.compras_listar_pedidos('{}'::jsonb, 5, null);     -- esperado: ok
rollback;
```
| # | Perfil | Operação | Esperado |
|---|--------|----------|----------|
| N1 | COMPRAS | `update`/`delete` direto em `execucao_pedidos_material` e `execucao_historico_pedidos` | 0 linhas afetadas / 42501 |
| N2 | COMPRAS | `insert`/`update`/`delete` direto em `execucao_pedidos_questionamentos` | 42501 (só por RPC) |
| N3 | COMPRAS | `select` em `execucao_obras`, `execucao_atividades`, `execucao_obras_etapas`, `execucao_horas_extras` | 0 linhas |
| N4 | COMPRAS | `rpc('compras_responder_questionamento')` | erro "Sem permissão para responder…" |
| N5 | COMPRAS | `rpc('alterar_status_atividade')` / `execucao_marcar_passo` | erro de permissão (não é membro) |
| N6 | COMPRAS | `storage` POPs: ler = ok; **upload/remoção** em `pops-arquivos` = negado | |
| N7 | TECNICO | `select` em `execucao_pedidos_material`, `execucao_pedidos_questionamentos`, `execucao_historico_pedidos` | 0 linhas |
| N8 | TECNICO | `rpc('compras_listar_pedidos' / 'compras_indicadores' / 'compras_detalhe_pedido' / 'compras_listar_questionamentos')` | erro "Sem permissão" |
| N9 | TECNICO | `rpc('compras_assumir_pedido' / 'compras_alterar_status' / 'compras_abrir_questionamento' / 'compras_definir_disponibilidade')` | erro "Sem permissão…" |
| N10 | TECNICO (não membro) | `rpc('alterar_status_atividade')` e `execucao_marcar_passo` em atividade alheia | erro de permissão |
| N11 | TECNICO | `execucao_marcar_passo` com sub-etapa que **não** é filha da etapa da atividade; atividade `cancelada` | erro |
| N12 | anon (sem login) | qualquer RPC `compras_*`, `execucao_marcar_passo`, `select` nas tabelas novas | negado (sem `EXECUTE` para `anon`) |
| N13 | ADMIN_EXECUCAO | `compras_abrir_questionamento` (só `is_compras`) | erro; `compras_responder_questionamento` ok |
| N14 | COMPRAS | `compras_alterar_status` com transição inválida (`entregue → em_cotacao`), `cancelado` sem `p_obs`, `comprado` sem data | erro de regra |
| N15 | qualquer | `update` de `itens` em pedido `comprado` (admin) | erro "Os itens não podem ser alterados…" |
| N16 | COMPRAS | Realtime: conectado como COMPRAS, mudar um pedido → evento chega; como TECNICO não chega nada | |
| N17 | impersonation (admin "entrando como" COMPRAS/TECNICO) | assumir, alterar status, abrir/responder questionamento, marcar passo, concluir | bloqueado com a mensagem de impersonation |

Passo a passo do fluxo (3 usuários, 2 abas — §7.3 3–9): COMPRAS assume → `em_cotacao` → abre questionamento "Disjuntor 63A → 50A, 2 un" → admin (aba 2) recebe em ≤ 3 s sem F5, **aprova** → item vira "Disjuntor 50A", histórico `questionamento` com diff, comprador notificado, volta a `em_cotacao`; repetir com **reprovar** (observação obrigatória) → item inalterado; dois questionamentos abertos (responder 1 mantém `aguardando_solicitante`); pedido de falta de material criado por TECNICO notifica os admins; `compras_definir_disponibilidade` cria **uma** etapa "📦 Chegada dos Materiais" e atualiza `data_fim` nas mudanças seguintes; `entregue` → status legado `entregue` + `data_entrega`, some de "Listas de obras pendentes"; KPIs conferidos contra SQL manual do período; "Carregar mais" sem duplicar; clicar numa notificação abre o pedido certo (COMPRAS → drawer; admin → conversa em Pedido de Material ou Compras); badge do menu zera ao ler. 360 px: abas, detalhe em tela cheia, modal de questionamento usável.

**D. Planejamento responsivo (Q4)** — Anexo C.5 em 360, 768, 1024 e 1440 px (DevTools + 1 Android + 1 iPad): sem rolagem horizontal da página, alvos ≥ 44 px, ações visíveis sem hover, filtros em gaveta no mobile, modais em tela cheia < 640 px, abas por teclado (←/→/Home/End), selo "Passos pendentes".

**E. Vídeo e áudio** — §7.2-10 em Android Chrome, iOS Safari ≥ 15, PWA instalado e desktop Chrome; migration 22 conferida (`allowed_mime_types = NULL`, limite 50 MiB e limite global do painel); `delete window.MediaRecorder` → fallback nativo; arquivo > 45 MB → mensagem com o limite; negar câmera/microfone → mensagem acionável; app aberto durante deploy → "Atualizar app".

### E.6 Veredito

**Aprovado com ressalvas (parcial).** O que foi possível verificar sem banco passou: build, contrato, lint sem regressão, 57/57 testes unitários (2 `todo` de severidade baixa) e revisão de código sem divergência de RPC/parâmetro/coluna contra as migrations. **Não** é uma aprovação de release: R7, R14 e as metades de banco de R11–R13 estão NÃO TESTÁVEIS; R9 e R10 dependem de navegador/aparelho; a Q0 (baseline) não foi feita. Antes do deploy: tratar ACH-01 (Frontend) e decidir ACH-02 (Negócio); ACH-03 a ACH-13 podem entrar no backlog. Depois de aplicar as migrations, executar o roteiro E.5 (principalmente a RLS negativa N1–N17) e só então marcar Q1–Q4 como ✅.

*Uso de graphify/Jev: 1 consulta graphify (+ 1 `graphify affected`), 1 consulta Jev (4 scores; confiança 0,53–0,67, abaixo de 0,8, então a severidade foi decidida pela revisão de código).*
