# PLANO — Cotação com Fornecedores via WhatsApp, Comparativo e Histórico de Preços (módulo Compras)

> **Autor:** Arquiteto · **Data:** 2026-11-01 · **Estado:** ver *Status consolidado* abaixo. _(Texto original, obsoleto: "plano aprovado para execução. Nenhum código foi escrito.")_
> **Base:** parecer do Especialista Negócio (seções 0–11), `src/features/compras/*`, migrations 19–33, Anexo F do `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md`, `src/App.jsx`, `src/sw.js`, `vite.config.js`.
> **Convenção:** todo item marcado **[DEFAULT]** veio da seção 11 do parecer (perguntas 1–18) e foi adotado sem resposta do dono. Se o dono divergir, a seção 2 indica o que muda. Itens **[ARQ]** são decisões do Arquiteto.

---

## Status consolidado

> **Atualizado em 2026-11-02.** Resumo para o dono. Detalhes nas seções e itens do §14 citados.

**Pronto**
- Front das ondas 1 a 4 (F-01 a F-15): módulo Compras (fornecedores, cotação, comparativo, histórico de preços, alterações da atendente) e página pública `cotacao/index.html` → `src/cotacao-publica/`.
- Migrations 33 a 40 **aplicadas no Supabase de produção em 2026-11-02** (B-00 medido e B-08 executada via MCP; ver Anexo A e `supabase/migrations/README.md`). Testes de permissão e do link público passaram em transação com `ROLLBACK`; advisors sem ERRO novo do lote (avisos esperados descritos no Anexo A).
- Anexos B (UI/UX) e C (contrato final) preenchidos.
- `npm run test:unit`: 117 testes passando (2026-11-01).
- Documentação: `README.md`, `.github/copilot-instructions.md` e `supabase/migrations/README.md` atualizados.

**Pendente (técnico)**
- **B-08 (resto):** regenerar `supabase/schema/` (inclui as tabelas e RPCs de cotação) e rodar `npm run graph:update`.
- **Netlify:** definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no build (a página pública exige).
- **B-09 (opcional):** `pg_cron` **não está habilitado**; habilitar a extensão para agendar `compras_verificar_alertas()` (15 min) e `compras_limpeza_publica()`. Habilitar `pg_cron` **não agenda sozinho**: o bloco `DO` da migration 37 só roda na aplicação (e, naquela data, `pg_cron` não estava habilitado). O agendamento é manual (ver B-09).
- **Q-03:** executar §15.2 a §15.5 de ponta a ponta (o §15.6 é desempenho, coberto por P-01 e P-02) (com usuários reais e o front). Já foram verificados em SQL: grants de `anon`, RLS, papéis, kill switch, rate limit, resposta válida/inválida/versão errada e token inválido (ver o registro de aplicação em `supabase/migrations/README.md`).
- **P-01 e P-02:** parciais. Feitos sem banco: bundle e benchmark. Pendentes: Lighthouse (P-01) e `EXPLAIN ANALYZE` (P-02), agora possíveis após a B-08.
- **D-01:** parcial. Faltam a nota F.12 do `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md`, o guia da atendente (Anexo D) e o snapshot após B-08.

**Checklist do dono**
- [x] Aplicar as migrations 33→40 (feito em 2026-11-02).
- [x] Rodar o diagnóstico B-00; `cf-connecting-ip` chega na chamada anon (Anexo A).
- [ ] Netlify: definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de build antes do deploy. Sem elas, a página `/cotacao/` não consegue chamar o banco.
- [ ] Testes manuais: §15.2 (RLS e papéis), §15.3 (segurança do link, S-01 a S-18), §15.4 (fluxo ponta a ponta, celular e desktop) e §15.5 (regressão).

**Decisões pendentes do dono**
- [ ] **Taxa mensal** para comparar condições: manter 1,5% a.m. (D7) ou ajustar `compras_config.taxa_mensal` (§19.3).
- [ ] **Nome público** da empresa mostrado ao fornecedor (`nome_empresa_publico`) e **textos finais das mensagens** do WhatsApp (§19.2).
- [ ] **Justificativa na divisão mais barata:** confirmar se a escolha da divisão mais barata exige justificativa. A regra de justificativa (mín. 10 caracteres) está em RF-08 CA1 para o caso de fugir da recomendação; o caso da divisão não está fechado.
- [ ] **RPC para vincular material a uma linha da cotação:** não existe nas migrations 34 a 39. Decidir se entra antes da aplicação.
- [ ] **Texto "24 h úteis" fixo no SQL** de `compras_verificar_alertas` (mig. 36, D14): decidir se vira parâmetro em `compras_config` antes de aplicar.
- [ ] Validar os defaults D1–D18 e as decisões N1–N6 (§19.1). Alçada por valor (D17) fica para a v2.

---

## 1. Contexto e objetivo

Hoje o status `em_cotacao` é só um rótulo. Não existem dados de fornecedor, preço, pagamento nem cotação: o parecer §0 confirma isso e a migration 24 só tem o CHECK do status. O módulo Compras (rota de topo `compras`, `#/compras`, nível `COMPRAS` + `Administrador`) trata pedidos de `execucao_pedidos_material`. Os itens ficam em `itens jsonb`, com `id` estável por item (mig. 23). Questionamentos ficam em `execucao_pedidos_questionamentos` (mig. 25) e o histórico em `execucao_historico_pedidos`.

**Objetivo.** Entregar cinco capacidades:
1. **Cotação.** A atendente agrupa uma ou mais listas e envia **um link por fornecedor** pelo WhatsApp (`wa.me`). O fornecedor responde **sem login** com preço por item, se tem ou não o item, condição de pagamento e observações.
2. **Cadastro de fornecedores** (contato, empresa, WhatsApp).
3. **Comparativo.** O sistema calcula e sinaliza a melhor proposta, com valor presente, frete, propostas parciais, empate e compra dividida.
4. **Histórico de preços.** Catálogo leve de materiais com referência de preço e variação em R$ e %.
5. **Alterações nas listas pela atendente.** Ciência ou aceite do solicitante, sempre com registro no histórico.

**Fora do escopo (v2):** API oficial do WhatsApp (envio em massa, confirmação de entrega), item alternativo sugerido pelo fornecedor, pedido mínimo, alçada de aprovação por valor, entrega parcial por fornecedor, nota subjetiva de fornecedor, rateio de quantidade de um mesmo item entre fornecedores.

---

## 2. Decisões de negócio adotadas

### 2.1 Defaults do parecer (seção 11)

| # | Pergunta | Decisão adotada | Onde impacta se o dono divergir |
|---|----------|-----------------|---------------------------------|
| D1 | Envio por `wa.me`, sem API paga | **[DEFAULT]** Sim. O clique registra "enviado", sem confirmação de entrega. | Só o front do envio (§10.3) |
| D2 | Prazo padrão do link | **[DEFAULT]** 48 h, editável (24/48/72 h ou data/hora) e prorrogável | `compras_config.prazo_padrao_horas` |
| D3 | Somar itens iguais de listas diferentes | **[DEFAULT]** Sim, quando material e unidade forem os mesmos. A composição por pedido é guardada. | `compras_cotacao_criar` / montagem |
| D4 | Fornecedor edita até o prazo | **[DEFAULT]** Sim, e cada envio gera uma versão | `compras_cotacao_respostas.versao` |
| D5 | Prazo de entrega e frete | **[DEFAULT]** Os dois são obrigatórios na resposta | validação de `cotacao_publica_responder` |
| D6 | Duas condições (à vista + parcelado) | **[DEFAULT]** Sim, até 1 de cada tipo por resposta | `compras_cotacao_resposta_condicoes` |
| D7 | Taxa para comparar condições | **[DEFAULT]** 1,5% a.m., configurável (só Administrador) e gravada na cotação | `compras_config.taxa_mensal` |
| D8 | Dividir a compra | **[DEFAULT]** Sim. Mostra a economia já somando o frete de cada fornecedor. | algoritmo §8.5 |
| D9 | Proposta incompleta pode ganhar | **[DEFAULT]** Só se ninguém atender tudo, ou na divisão por item | ranking §8.4 |
| D10 | Empate | **[DEFAULT]** Diferença < 1% é empate técnico. Desempate pelo prazo de entrega e depois pelos demais critérios do §8.4. | `compras_config.empate_pct` |
| D11 | Referência do histórico | **[DEFAULT]** Média das compras dos últimos 6 meses. Também mostra a última e a menor. | `compras_precos_referencia` |
| D12 | Quem confirma que dois itens são o mesmo material | **[DEFAULT]** A atendente, com sugestão do sistema | montagem/decisão |
| D13 | Alterações que exigem aceite | **[DEFAULT]** Troca de item, aumento de quantidade e adição. O resto é só ciência. | `compras_alterar_itens` |
| D14 | Solicitante não responde | **[DEFAULT]** Alerta após 24 h úteis para a atendente e o gestor. Nunca aprova por silêncio. | `compras_verificar_alertas` |
| D15 | Obra/endereço para o fornecedor | **[DEFAULT]** Não. Mostra no máximo "cidade/bairro" para o frete. | `cotacao_publica_obter` |
| D16 | Quem vê histórico de preços e economia | **[DEFAULT]** Só COMPRAS e Administrador | RLS + RPCs `is_compras()` |
| D17 | Pedido mínimo / alçada | **[DEFAULT]** Não na v1 | — (v2) |
| D18 | Alerta de "caro demais" | **[DEFAULT]** +10% sobre a referência | `compras_config.alerta_pct` |

### 2.2 Decisões complementares de negócio (do parecer, sem pergunta explícita)

- Status da cotação: `rascunho → aberta → encerrada | cancelada`.
- Status do convite: `nao_enviado → enviado → visualizado → respondido | recusou`. O estado "expirou" é derivado: prazo vencido sem resposta.
- Um pedido participa de **no máximo uma cotação ativa** (`rascunho` ou `aberta`).
- Cotação cancelada devolve os pedidos para `aguardando_compra`.
- Itens de pedido em cotação **já enviada** ficam bloqueados para alteração, a não ser pela "Revisar cotação" (nova versão da lista, aviso aos fornecedores e prazo reaberto).
- Faixa neutra da variação de preço: ±2% (cinza).
- Desempate, nesta ordem: prazo de entrega, frete incluso (CIF), mais compras anteriores com o fornecedor e, por fim, quem respondeu primeiro.
- A sinalização do sistema é só recomendação. Quem decide é a atendente, e escolher fora da recomendação exige justificativa.

### 2.3 Decisões do Arquiteto que o Negócio deve validar depois (não bloqueiam)

- **[ARQ] N1. Frete.** Entra no valor presente como pago no instante zero (nominal).
- **[ARQ] N2. Valor da condição.** O preço unitário informado é o preço **base**. À vista aplica o desconto (% ou R$). Parcelado usa o total informado, ou a soma da base se o total ficar vazio. O preço por item em cada condição é proporcional: `preço × total_condição / base`.
- **[ARQ] N3. Desconto em R$ na divisão.** Na compra dividida, o desconto em R$ é convertido em % da base completa e vem com o aviso "desconto pode não valer em compra parcial".
- **[ARQ] N4. Item sem fornecedor.** Para decidir, todo item ativo da cotação precisa de um fornecedor vencedor. Se nenhum fornecedor tem o item, a atendente faz uma de duas coisas:
  - remove o item, com ciência e motivo "sem fornecedor";
  - tira o pedido da cotação.
- **[ARQ] N5. O que o solicitante vê no histórico do pedido.** Vê o nome da empresa vencedora (útil para receber a entrega), **sem preços** (D16).
- **[ARQ] N6. Item com quantidade disponível menor que a pedida.** Conta como "não atende" para completude e na divisão. A quantidade aparece na tela, e a atendente pode decidir no modo manual.

---

## 3. Requisitos e critérios de aceite

| ID | Requisito | Critérios de aceite (verificáveis) |
|----|-----------|------------------------------------|
| RF-01 | Cadastro de fornecedores | **CA1.** CRUD só para COMPRAS e Administrador. ADMIN_EXECUCAO, TECNICO e anon recebem 0 linhas ou erro de permissão. **CA2.** O WhatsApp é gravado normalizado (`55DDDNÚMERO`, 12–13 dígitos). Entrada inválida mostra erro claro. **CA3.** Mesmo WhatsApp com a mesma empresa (sem diferenciar maiúsculas) é bloqueado. **CA4.** Fornecedor com convite ou compra não pode ser excluído, só inativado. **CA5.** Administrador anonimiza (LGPD), e o histórico continua íntegro. |
| RF-02 | Criar cotação a partir de vários pedidos | **CA1.** A fila permite seleção múltipla de pedidos em `aguardando_compra`/`em_cotacao` sem cotação ativa. **CA2.** Pedidos em `aguardando_compra` passam a `em_cotacao` com `comprador_id` e linha no histórico. **CA3.** Pedido já em cotação ativa não pode ser selecionado e mostra o selo "Na cotação nº X". **CA4.** Itens de mesmo material e unidade são somados numa linha, com a composição por pedido visível. Unidade diferente gera linha separada. |
| RF-03 | Links por fornecedor | **CA1.** Cada convite tem um token aleatório de 256 bits. O banco guarda só o SHA-256. **CA2.** A URL é `https://<host>/cotacao/#<token>`, sem id de pedido ou de cotação. **CA3.** "Gerar novo link" e "Lembrete" revogam o token anterior, e o link antigo mostra "link substituído". |
| RF-04 | Envio via WhatsApp | **CA1.** O botão abre `https://wa.me/<num>?text=<msg>` em nova aba, com a mensagem padrão editável (saudação, nº da cotação, nº de itens, link e prazo). **CA2.** Cada clique grava `enviado` com data/hora e usuário, e soma `envios`. **CA3.** O "Copiar link" funciona e registra o canal `copia`. **CA4.** O lembrete fica registrado como evento. |
| RF-05 | Página pública do fornecedor | **CA1.** Abre sem login em celular (largura de 360 px) com carga inicial ≤ 120 kB gzip. **CA2.** Mostra só o permitido (§9.4) e nunca obra, cliente, endereço, solicitante, urgência ou outros fornecedores. **CA3.** Por item: tem/não tem, preço unitário (obrigatório se tem), quantidade disponível opcional e marca/observação opcional. **CA4.** Gerais: condição à vista e/ou parcelado, prazo de entrega (obrigatório), frete CIF ou valor (obrigatório) e observação. **CA5.** O fornecedor pode reenviar até o prazo, e cada envio gera uma nova versão. **CA6.** Depois do prazo, a resposta fica só leitura. Com a cotação encerrada ou cancelada, aparece só "Cotação encerrada". **CA7.** Token inválido mostra mensagem genérica. **CA8.** Cabeçalhos `noindex` e `no-referrer`. |
| RF-06 | Acompanhamento em tempo real | **CA1.** No detalhe da cotação, o status do convite (visualizado/respondido) e a proposta aparecem em ≤ 5 s sem recarregar (Realtime). **CA2.** O criador da cotação recebe a notificação `compra_cotacao` "Fornecedor X respondeu". |
| RF-07 | Comparativo e melhor proposta | **CA1.** Ranking global por valor presente total (itens + frete), com o selo "Melhor proposta", a diferença para a 2ª colocada e para a mais cara (R$ e %), e o prazo de entrega sempre visível. **CA2.** Propostas parciais aparecem com "cobre X de Y" e só ganham se não houver proposta completa. **CA3.** Diferença < 1% mostra "Empate técnico", com o critério de desempate aplicado. **CA4.** Matriz item × fornecedor com a célula mais barata destacada. **CA5.** "Melhor combinação dividida" com a economia em R$ e % sobre o melhor fornecedor único, já somando o frete de cada fornecedor. **CA6.** Os cálculos batem com as fixtures do §15.1 (testes unitários). |
| RF-08 | Decisão (vencedor) | **CA1.** A atendente escolhe entre fornecedor único, dividido ou manual. Fugir da recomendação exige justificativa (mín. 10 caracteres). **CA2.** Ao confirmar: os pedidos vão para `comprado` com a data de disponibilidade (sugerida pelo prazo de entrega), a etapa "📦 Chegada dos Materiais" é criada ou atualizada (regra existente), o histórico do pedido recebe "Cotação nº X decidida…", o solicitante é notificado (`compra_status`), a cotação fica `encerrada` e os preços vão para o histórico. **CA3.** A decisão fica bloqueada se a cotação exige revisão, se algum pedido não está em `em_cotacao`, ou se há item sem vencedor ou sem material confirmado. |
| RF-09 | Histórico de preços | **CA1.** Cada item da decisão grava o preço `comprado` (nominal e valor presente). Cada resposta final grava o preço `cotado`. **CA2.** Por material: última compra, média de 6 meses, menor preço, nº de compras e quantidade de referência. **CA3.** No comparativo, cada célula mostra "R$ x (+R$ y / +z% vs. média)": verde se mais barato, vermelho se mais caro, cinza dentro de ±2%. Material sem histórico mostra "primeiro registro". **CA4.** Acima de +10% aparece o alerta "renegociar". **CA5.** É possível mesclar materiais duplicados, e o histórico do material de origem passa para o de destino. |
| RF-10 | Catálogo/normalização | **CA1.** Nome normalizado (minúsculas, sem acento, espaços colapsados) + unidade normalizada formam a chave do material. **CA2.** Na montagem, o sistema sugere até 5 materiais parecidos. A atendente confirma ou cria um novo, e a escolha vira alias para as próximas vezes. **CA3.** O sistema nunca funde itens sozinho com base em semelhança de texto. |
| RF-11 | Alterações nas listas pela atendente | **CA1.** Permite reduzir ou aumentar quantidade, remover, corrigir grafia/unidade, substituir e adicionar item, sempre com motivo (≥ 5 caracteres). **CA2.** Redução, remoção e correção são aplicadas na hora e notificam o solicitante (`compra_alteracao`). **CA3.** Aumento, substituição e adição viram questionamento (aceite) e o pedido vai para `aguardando_solicitante`. Aceito, aplica a mudança. Recusado, nada muda. **CA4.** Tudo fica em `execucao_historico_pedidos` com `tipo_alteracao='alteracao_compras'`, diff de itens, motivo e resultado. **CA5.** Aceite pendente há mais de 24 h úteis gera alerta para a atendente e para os gestores. Nunca é aprovado automaticamente. **CA6.** Pedido em cotação já enviada só aceita alteração pelo fluxo "Aplicar e revisar cotação". Edição direta do solicitante é bloqueada com mensagem explicativa. |
| RF-12 | Revisão de cotação | **CA1.** "Revisar cotação" incrementa `versao_lista`, recompõe os itens, marca `precisa_reconfirmar` nos convites que já responderam, define um novo prazo e oferece a mensagem "lista alterada" por WhatsApp. **CA2.** A página pública avisa "A lista mudou; revise e reenvie". |
| RF-13 | KPIs novos | **CA1.** RPC `compras_indicadores_cotacao(de, ate)` com os 10 KPIs do §12. **CA2.** Abaixo do mínimo de dados (§12), mostra "dados insuficientes". |
| RNF-01 | Segurança do link público | Rate limit por token, por IP e global. Payload limitado. Erros genéricos. Nenhuma tabela nova legível por `anon`. Kill switch `link_publico_ativo`. O `EXECUTE` de `anon` existe **só** nas 2 RPCs públicas. |
| RNF-02 | Bundle | A página pública não importa `@supabase/supabase-js`, `AuthContext`, `App.jsx` nem `echarts`. As telas novas de Compras ficam em chunks lazy, e o chunk inicial de Compras cresce ≤ 10 kB gzip. |
| RNF-03 | Compatibilidade PWA | O SW não serve `/cotacao/` a partir do cache, e os assets da página pública ficam fora do precache. |
| RNF-04 | Custo zero | Funciona no plano gratuito do Supabase, sem Edge Function, sem pg_cron obrigatório e sem serviço pago. |

---

## 4. Decisões de arquitetura (e alternativas descartadas)

### A1. API pública do fornecedor: RPC `SECURITY DEFINER` chamada com a anon key **[ARQ]**

- **Escolhido:** duas funções Postgres, `cotacao_publica_obter(p_token)` e `cotacao_publica_responder(p_token, p_resposta)`.
  - `SECURITY DEFINER` e `search_path = public`.
  - `GRANT EXECUTE` a `anon, authenticated`. São as **únicas** funções novas com grant para `anon`.
  - Dentro de cada uma: formato do token, hash SHA-256, rate limit em tabela, validação estrita do payload, kill switch e projeção mínima de dados.
- **Por quê:**
  - Mesmo pipeline de deploy das migrations (MCP).
  - Transação atômica com as tabelas.
  - Zero infraestrutura nova no plano gratuito.
  - O volume é baixo (poucas cotações por dia, menos de 15 fornecedores por cotação).
  - O token tem 256 bits, então força bruta é inviável. O rate limit serve contra flood e abuso de escrita.
- **Descartado: Edge Function com service role.**
  - Traz um runtime novo, segredo da service role, cold start e outro deploy.
  - Também exigiria uma tabela para o rate limit (o Supabase não oferece KV gratuito).
  - Fica como **caminho de evolução** se surgir abuso: CAPTCHA (Turnstile) e WAF. A Edge Function chamaria as mesmas funções internas.
- **Consequência obrigatória:** as funções públicas **nunca usam `RAISE`** para erro de negócio. Elas devolvem `{ok:false, codigo}`, senão o `RAISE` desfaria (rollback) o contador do rate limit. `RAISE` só para bug interno.

### A2. Página pública: 2ª entrada HTML do Vite (`/cotacao/`) com o token no fragmento **[ARQ]**

- **Escolhido:**
  - Arquivo `cotacao/index.html` na raiz do repositório, entrada `cotacao` em `build.rollupOptions.input`, gerando `dist/cotacao/index.html`.
  - Código em `src/cotacao-publica/`. Usa `fetch` direto para `POST {VITE_SUPABASE_URL}/rest/v1/rpc/<fn>` com os cabeçalhos `apikey` e `Authorization: Bearer <anon>`. **Sem** `supabase-js`.
  - URL: `https://effort-dashboard.netlify.app/cotacao/#<token>`.
- **Por quê:**
  - O `App.jsx` decide tudo dentro de `AuthProvider` (o roteamento por hash `#/compras`, `#/execucao` e o pathname só para `/reset-password`). Uma rota dentro do App baixaria `AuthProvider`, `LayoutProvider`, `useGoogleSheetsData` e `supabase-js`.
  - Com uma entrada separada, nada do app autenticado é carregado. Só o chunk `react` é compartilhado (e fica em cache para quem já usa o sistema).
  - O Netlify serve `dist/cotacao/index.html` como arquivo estático, sem precisar de `_redirects` (o repositório não tem).
  - O token no **fragmento** (`#`) não vai ao servidor:
    - não aparece nos logs do Netlify;
    - não vai no `Referer`;
    - não é lido pelo robô de prévia de link do WhatsApp, então não gera "visualizado" falso nem vaza o token.
- **Divergência do pedido.** O orquestrador sugeriu `/cotacao/:token`. O token no path iria para logs e prévias, por isso foi trocado por `/cotacao/#token`.
- **Descartados:**
  - `#/cotacao/<token>` dentro do `index.html` do app: exigiria reescrever `main.jsx` para import dinâmico do App e misturaria com o roteamento por hash existente.
  - `/cotacao/<token>` dentro do App: exigiria regra SPA no Netlify e carregaria o bundle autenticado.

### A3. Comparativo calculado no front (helper puro testado); o banco recalcula o que é gravado **[ARQ]**

- **Escolhido:** `src/features/compras/utils/cotacao/comparacao.js`, com funções puras para valor presente, totais por condição, ranking, empate, combinação dividida e variação vs. referência. Testado por `npm run test:unit` (`node:test`, já existe).
  - O banco guarda os dados brutos. No envio, a resposta grava `total` e `valor_presente` de cada condição, calculados pela função SQL `compras_valor_presente(...)`.
  - Na decisão, o banco **recalcula** os preços gravados no histórico com a mesma função SQL.
  - O snapshot do ranking do front é guardado só como evidência (`recomendacao_snapshot`).
- **Por quê:**
  - O projeto não tem banco local para testar SQL e tem suíte unitária JS.
  - O Realtime pede recálculo instantâneo no navegador.
  - A combinação dividida (enumeração de subconjuntos) é mais simples de testar em JS.
- **Mitigação da divergência:** uma fixture de paridade (§15.1, caso VP-PAR). O QA roda a mesma entrada em `compras_valor_presente` (SQL via MCP) e em `valorPresente()` (JS), com tolerância de R$ 0,01.
- **Descartado:** tudo em SQL. É difícil de testar aqui, deixaria o realtime mais pesado e o front ainda teria que reformatar.

### A4. Token só como hash; reenvio = rotação **[ARQ]**

- `token = base64url(extensions.gen_random_bytes(32))`, com 43 caracteres. O banco guarda `sha256(convert_to(token,'UTF8'))` em `compras_cotacao_tokens`.
- O token em claro é devolvido **uma única vez** pela RPC de geração. O front o mantém em `sessionStorage`, na chave `cmp:tokens:<cotacao_id>`, para "Copiar" e "WhatsApp" durante a sessão. A chave é apagada no logout e ao encerrar a cotação.
- Lembrete, ou cópia sem token em memória: o sistema **gera um novo link**, revoga o anterior e registra o evento. O link antigo devolve `LINK_SUBSTITUIDO`.
- **Descartado:** guardar o token em claro ou cifrado, legível por COMPRAS. O parecer §6 pede apenas hash, e um vazamento da tabela exporia links vivos.

### A5. `em_cotacao` sincronizado (não derivado) **[ARQ]**

- O `status_compra` continua sendo a fonte da fila, para não quebrar `compras_listar_pedidos`, os KPIs e o quadro.
- A participação na cotação é guardada em `compras_cotacao_pedidos.ativa`, com índice único parcial `(pedido_id) WHERE ativa`.
- As RPCs de cotação fazem as transições:
  - criar: `aguardando_compra` vai para `em_cotacao`;
  - cancelar ou remover: o pedido volta para `aguardando_compra`;
  - decidir: o pedido vai para `comprado`.
- `compras_alterar_status` passa a recusar `em_cotacao → aguardando_compra` e `em_cotacao → comprado` em pedido com cotação ativa ("use a cotação"). Exceção: quando a chamada vem das RPCs de cotação (flag de sessão `compras.cotacao_rpc = '1'`).
- **Descartado:** status derivado por view. Exigiria reescrever o painel e os KPIs (migrations 26/33).

### A6. Catálogo leve separado do jsonb do pedido **[ARQ]**

- O `material_id` **não** é gravado dentro de `itens jsonb`. O front da Execução regrava o array (`atualizarPedidoMaterial`) e perderia chaves desconhecidas.
- O vínculo fica em:
  - `compras_cotacao_itens.material_id` (linha consolidada);
  - `compras_cotacao_item_origens` (pedido + `item_id` + quantidade);
  - `compras_materiais_aliases` (`nome_normalizado` + unidade → material), que alimenta a sugestão automática.
- Sugestão por semelhança: `pg_trgm.similarity` se a extensão estiver disponível (Supabase permite no plano gratuito). Senão, `ILIKE` por tokens (fallback no corpo da RPC).

### A7. Alterações com aceite reaproveitam questionamentos **[ARQ]**

- Aumento de quantidade vira o tipo `quantidade`. Substituição vira `substituicao` (aprovação por `is_admin_execucao()`, regra existente). Adição vira o tipo **novo** `adicao`. O status `aguardando_solicitante` e a restauração seguem o mecanismo atual da mig. 25.
- Colunas novas em `execucao_pedidos_questionamentos`: `origem`, `motivo_alteracao`, `prazo_resposta_em` e `alerta_enviado_em`.
- **Descartado:** uma tabela e uma tela de aceite novas. Duplicariam a conversa que o solicitante (ADMIN_EXECUCAO) já usa no Pedido de Material.

### A8. Alertas sem cron obrigatório **[ARQ]**

- `compras_verificar_alertas()` é idempotente. Ela trata aceites vencidos (24 h úteis), cotações vencendo em menos de 24 h sem resposta e prazos expirados.
- É chamada pelo front do módulo Compras ao abrir o painel e a cada 15 min enquanto ele estiver aberto. O throttle fica no banco, via `compras_config.alertas_ultima_execucao` (no máximo 1 execução a cada 10 min).
- Se `pg_cron` estiver habilitado, o Backend **pode** agendar a mesma função a cada 15 min (opcional, §14 B-10).

### A9. Escrita só via RPC; leitura simples via RLS **[ARQ]**

Segue o padrão da mig. 25:
- Tabelas novas com RLS ligada e `SELECT` para `is_compras()`.
- `INSERT/UPDATE/DELETE` revogados de `authenticated` e `anon`. Toda escrita passa por RPC `SECURITY DEFINER`, que valida o papel.
- Tabelas sensíveis (tokens, rate limit, segredo) ficam **sem nenhuma policy** e com `REVOKE ALL`.

### A10. Mensagens de notificação **[ARQ]**

- Dois tipos novos no CHECK de `execucao_notificacoes`:
  - `compra_cotacao`, para a atendente: resposta recebida, prazo vencendo, lista exige revisão;
  - `compra_alteracao`, para o solicitante: ciência de alteração.
- Alertas de aceite atrasado usam `compra_questionamento`, com `destinatario_id = NULL`. Assim chegam aos gestores (ADMIN_EXECUCAO), como já acontece hoje, e também ao comprador.

---

## 5. Modelo de dados (migrations 34–39)

> Convenções:
> - `uuid` PK `gen_random_uuid()`;
> - `created_at/updated_at timestamptz default now()`;
> - FK de usuário para `public.usuarios(id)`;
> - valores monetários em `numeric(14,4)` para preço unitário e `numeric(14,2)` para totais;
> - toda tabela com `ENABLE ROW LEVEL SECURITY`;
> - `REVOKE ALL ... FROM anon` e `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ... FROM authenticated`.

### 5.1 Configuração (mig. 34)

**`compras_config`**: linha única (`id smallint PK default 1 CHECK (id = 1)`).

| Coluna | Tipo | Default | Nota |
|---|---|---|---|
| taxa_mensal | numeric(6,4) | 0.0150 | D7, CHECK 0..0.2 |
| empate_pct | numeric(6,4) | 0.0100 | D10 |
| alerta_pct | numeric(6,4) | 0.1000 | D18 |
| faixa_neutra_pct | numeric(6,4) | 0.0200 | cinza |
| prazo_padrao_horas | int | 48 | D2, CHECK 1..720 |
| janela_referencia_meses | int | 6 | D11 |
| fallback_ultimas_compras | int | 5 | referência quando a janela está vazia |
| prazo_aceite_horas_uteis | int | 24 | D14 |
| nome_empresa_publico | text | 'Effort' | mostrado ao fornecedor (Administrador ajusta) |
| mensagem_padrao | text | ver §10.3 | placeholders `{contato} {empresa} {numero} {qtd_itens} {link} {prazo}` |
| mensagem_lembrete | text | ver §10.3 | |
| mensagem_revisao | text | ver §10.3 | |
| link_publico_ativo | boolean | true | **kill switch** das RPCs públicas |
| rl_token_obter_10min / rl_token_responder_10min | int | 60 / 10 | rate limit por token |
| rl_ip_obter_10min / rl_ip_responder_10min | int | 120 / 30 | por IP |
| rl_global_responder_hora | int | 600 | disjuntor global |
| alertas_ultima_execucao | timestamptz | null | throttle de A8 |
| updated_by | uuid | | |

**`compras_config_segredo`**: linha única, **sem policy**. Guarda `pepper_ip text`, gerado na migration com `encode(extensions.gen_random_bytes(32),'hex')` e usado no hash do IP. Ninguém lê fora das funções `SECURITY DEFINER`.

### 5.2 Fornecedores (mig. 34)

**`compras_fornecedores`**
- `id`, `nome_contato text NOT NULL` (2..120), `empresa text NOT NULL` (2..160).
- `whatsapp text NOT NULL CHECK (whatsapp ~ '^55[1-9][0-9]{9,10}$')`.
- `documento text NULL` (CPF/CNPJ só com dígitos, 11 ou 14), `email text NULL`, `categorias text[] NOT NULL DEFAULT '{}'`, `observacao text` (≤ 500).
- `ativo boolean NOT NULL DEFAULT true`, `anonimizado_em timestamptz`.
- `base_legal text NOT NULL DEFAULT 'procedimentos_preliminares_contrato'` (LGPD).
- `created_by`, `updated_by`, timestamps.
- Índice único: `(whatsapp, lower(empresa)) WHERE anonimizado_em IS NULL`. Índice: `(ativo, empresa)`.

### 5.3 Catálogo de materiais (mig. 34)

**`compras_materiais`**
- `id`, `nome text NOT NULL` (nome de exibição), `nome_normalizado text NOT NULL`, `unidade text NOT NULL` (normalizada), `categoria text`, `ativo boolean DEFAULT true`.
- `mesclado_em_id uuid REFERENCES compras_materiais(id)`, `created_by`, timestamps.
- Único: `(nome_normalizado, unidade) WHERE mesclado_em_id IS NULL`. GIN trigram em `nome_normalizado`, se `pg_trgm` existir.

**`compras_materiais_aliases`**
- `nome_normalizado text`, `unidade text`, `material_id uuid NOT NULL REFERENCES compras_materiais(id)`, `created_by`, `created_at`.
- PK `(nome_normalizado, unidade)`.

Funções `IMMUTABLE`, sem grant a anon:
- `compras_normalizar_nome(text)`: `lower`, `translate` dos acentos pt-BR, troca de `[^a-z0-9,.]` por espaço, espaços colapsados e `btrim`.
- `compras_normalizar_unidade(text)`: mapa `un|und|unid|unidade|pc|peca|peça → un`; `m|mt|metro|metros → m`; `cx|caixa → cx`; `pct|pacote → pct`; `kg`; `l|lt|litro → l`; `m2|m² → m2`; `m3|m³ → m3`; `rolo`; `barra`; `saco`; `galao`. Unidade desconhecida passa por `lower(btrim)`.
- O mesmo mapa é espelhado em `src/features/compras/utils/cotacao/normalizacao.js`, com teste de paridade por lista fixa (§15.1).

### 5.4 Cotações (mig. 35)

**`compras_cotacoes`**
- `id`, `numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE`.
- `status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberta','encerrada','cancelada'))`.
- `prazo_resposta timestamptz` (obrigatório ao abrir), `versao_lista int NOT NULL DEFAULT 1`, `requer_revisao boolean NOT NULL DEFAULT false`.
- `taxa_mensal numeric(6,4)` e `empate_pct numeric(6,4)`: snapshot da config ao abrir (D7).
- `observacao_publica text` (≤ 500), `regiao_entrega text` (≤ 80, "cidade/bairro", D15), `mensagem text` (template editado pela atendente).
- `criado_por`, `aberta_em`, `encerrada_em`, `encerrada_por`, `cancelada_em`, `cancelada_por`, `motivo_cancelamento`, timestamps.
- Índices: `(status, prazo_resposta)` e `(criado_por, created_at DESC)`.

**`compras_cotacao_pedidos`**
- `cotacao_id uuid REFERENCES compras_cotacoes ON DELETE CASCADE`.
- `pedido_id uuid REFERENCES execucao_pedidos_material ON DELETE CASCADE`.
- `ativa boolean NOT NULL DEFAULT true`, `incluido_por`, `incluido_em`, `removido_em`, `motivo_remocao`.
- PK `(cotacao_id, pedido_id)`. **Único parcial `(pedido_id) WHERE ativa`**: garante "1 cotação ativa por pedido".

**`compras_cotacao_itens`** (linha consolidada mostrada ao fornecedor)
- `id`, `cotacao_id`, `seq int`, `descricao text NOT NULL` (texto público, ≤ 200), `unidade text NOT NULL`, `quantidade numeric(14,3) NOT NULL CHECK (> 0)`.
- `material_id uuid NULL REFERENCES compras_materiais`, `chave_consolidacao text` (`nome_normalizado|unidade` ou `mat:<id>`), `observacao_publica text` (≤ 200).
- `ativo boolean DEFAULT true`, `versao_criada int`, `versao_alterada int`.
- Índice `(cotacao_id, ativo, seq)`.

**`compras_cotacao_item_origens`**
- `cotacao_item_id uuid REFERENCES compras_cotacao_itens ON DELETE CASCADE`, `pedido_id uuid`, `item_id text NOT NULL` (o `id` do item no jsonb), `quantidade numeric(14,3)`, `item_snapshot jsonb`.
- PK `(cotacao_item_id, pedido_id, item_id)`. Índice `(pedido_id)`.

### 5.5 Convites, tokens, respostas (mig. 35)

**`compras_cotacao_convites`**
- `id`, `cotacao_id`, `fornecedor_id REFERENCES compras_fornecedores`.
- `status text NOT NULL DEFAULT 'nao_enviado' CHECK (IN ('nao_enviado','enviado','visualizado','respondido','recusou'))`.
- `enviado_em`, `enviado_por`, `envios int DEFAULT 0`, `ultimo_canal text CHECK (IN ('whatsapp','copia'))`.
- `primeira_visualizacao_em`, `ultima_visualizacao_em`, `respondido_em`, `versao_lista_respondida int`, `precisa_reconfirmar boolean DEFAULT false`.
- Único `(cotacao_id, fornecedor_id)`. Índice `(cotacao_id, status)`.

**`compras_cotacao_tokens`** (**sem policy**, `REVOKE ALL` de anon e authenticated)
- `token_hash bytea PRIMARY KEY`, `convite_id uuid NOT NULL REFERENCES compras_cotacao_convites ON DELETE CASCADE`.
- `criado_em`, `criado_por`, `revogado_em timestamptz`, `motivo_revogacao text CHECK (IN ('lembrete','novo_link','cotacao_encerrada','cotacao_cancelada','anonimizacao'))`.
- Índice único parcial `(convite_id) WHERE revogado_em IS NULL`: no máximo 1 token vivo por convite.

**`compras_cotacao_respostas`** (versões)
- `id`, `convite_id`, `cotacao_id` (desnormalizado para filtrar o Realtime), `versao int NOT NULL`, `versao_lista int NOT NULL`, `atual boolean NOT NULL DEFAULT true`.
- `recusou boolean DEFAULT false`, `prazo_entrega_dias int CHECK (0..365)`, `frete_tipo text CHECK (IN ('cif','valor'))`, `frete_valor numeric(14,2) DEFAULT 0 CHECK (>= 0)`, `observacao text` (≤ 1000).
- `base_total numeric(14,2)` (Σ preço × quantidade atendida).
- `enviado_em timestamptz DEFAULT now()`, `ip_hash text`, `user_agent text` (≤ 200).
- Único `(convite_id, versao)`. Único parcial `(convite_id) WHERE atual`. Índice `(cotacao_id, atual)`.

**`compras_cotacao_resposta_condicoes`**
- `id`, `resposta_id ON DELETE CASCADE`, `tipo text CHECK (IN ('a_vista','parcelado'))`.
- `desconto_tipo text NULL CHECK (IN ('percentual','valor'))`, `desconto_valor numeric(14,4)`: só para à vista.
- `parcelas int CHECK (1..24)`, `entrada_valor numeric(14,2) DEFAULT 0`, `primeira_parcela_dias int DEFAULT 30 CHECK (0..180)`: só para parcelado.
- `total_informado numeric(14,2)` (parcelado opcional).
- `total_itens numeric(14,2)` (calculado), `valor_presente_itens numeric(14,2)` (calculado com a taxa da cotação).
- Único `(resposta_id, tipo)`.

**`compras_cotacao_resposta_itens`**
- `resposta_id ON DELETE CASCADE`, `cotacao_item_id`, `tem_item boolean NOT NULL`.
- `preco_unitario numeric(14,4) NULL CHECK (preco_unitario IS NULL OR preco_unitario > 0)`, `quantidade_disponivel numeric(14,3) NULL`, `observacao text` (≤ 200).
- PK `(resposta_id, cotacao_item_id)`. CHECK `(NOT tem_item OR preco_unitario IS NOT NULL)`.

### 5.6 Decisão e histórico de preços (mig. 35)

**`compras_cotacao_decisoes`**: 1 por cotação.
- `id`, `cotacao_id UNIQUE`, `modo text CHECK (IN ('unico','dividido','manual'))`, `segue_recomendacao boolean`, `justificativa text`.
- `total_nominal numeric(14,2)`, `total_vp numeric(14,2)`, `total_referencia numeric(14,2) NULL`, `recomendacao_snapshot jsonb`.
- `decidido_por`, `decidido_em`.

**`compras_cotacao_decisao_itens`**
- `decisao_id`, `cotacao_item_id`, `convite_id`, `condicao_id REFERENCES compras_cotacao_resposta_condicoes`, `fornecedor_id`.
- `quantidade`, `preco_unitario_base`, `preco_unitario_nominal`, `preco_unitario_vp`.
- PK `(decisao_id, cotacao_item_id)`.

**`compras_precos_historico`**
- `id`, `material_id NOT NULL`, `fornecedor_id`, `cotacao_id`, `cotacao_item_id`, `resposta_id`.
- `tipo text CHECK (IN ('cotado','comprado'))`, `condicao text CHECK (IN ('a_vista','parcelado'))`, `parcelas int`.
- `unidade text`, `quantidade numeric(14,3)`, `preco_unitario_nominal numeric(14,4)`, `preco_unitario_vp numeric(14,4)`.
- `pedido_ids uuid[]`, `registrado_em timestamptz DEFAULT now()`.
- Índices: `(material_id, tipo, registrado_em DESC)`, `(fornecedor_id, registrado_em DESC)` e `(cotacao_id)`.

### 5.7 Auditoria e rate limit (mig. 35)

**`compras_cotacao_eventos`**
- `id`, `cotacao_id`, `convite_id NULL`, `usuario_id NULL`, `ip text NULL` (IP bruto; retenção de 12 meses, LGPD), `ip_hash text`, `dados jsonb`, `created_at`.
- `tipo text CHECK (IN ('criada','pedido_incluido','pedido_removido','itens_montados','aberta','link_gerado','enviado','lembrete','visualizado','resposta_enviada','resposta_rejeitada','prorrogada','revisada','requer_revisao','decidida','encerrada','cancelada'))`.
- Índice `(cotacao_id, created_at DESC)`. O evento `visualizado` é gravado no máximo 1 vez por hora por convite.

**`compras_rate_limit`** (**sem policy**)
- `chave text`, `janela timestamptz`, `contador int`. PK `(chave, janela)`.
- A chave tem o formato `tk:obter:<hash>`, `ip:resp:<iphash>`, `gl:resp`, etc.
- Linhas com mais de 2 dias são apagadas por `compras_verificar_alertas()` e, a cada abertura de cotação, por `compras_cotacao_abrir`.

### 5.8 Alterações em questionamentos existentes (mig. 38)

`execucao_pedidos_questionamentos`:
- CHECK de `tipo` passa a aceitar `'adicao'`;
- `ADD COLUMN origem text NOT NULL DEFAULT 'questionamento' CHECK (origem IN ('questionamento','alteracao_compras'))`;
- `motivo_alteracao text`, `prazo_resposta_em timestamptz`, `alerta_enviado_em timestamptz`.

`execucao_notificacoes`: CHECK de `tipo` + `'compra_cotacao'`, `'compra_alteracao'` (mig. 34, refazendo o CHECK completo da mig. 25).

`execucao_historico_pedidos.tipo_alteracao` (sem CHECK): valores novos `cotacao` e `alteracao_compras`.

---

## 6. RLS e grants

| Tabela | anon | authenticated SELECT | Escrita |
|---|---|---|---|
| compras_config | REVOKE ALL | `is_compras()` | RPC `compras_config_salvar` (só `current_nivel()='Administrador'`) |
| compras_config_segredo, compras_cotacao_tokens, compras_rate_limit | REVOKE ALL | **sem policy** (REVOKE ALL também de authenticated) | só funções `SECURITY DEFINER` |
| compras_fornecedores, compras_materiais, compras_materiais_aliases | REVOKE ALL | `is_compras()` | RPCs |
| compras_cotacoes, _pedidos, _itens, _item_origens, _convites, _respostas, _resposta_condicoes, _resposta_itens, _decisoes, _decisao_itens, _eventos, compras_precos_historico | REVOKE ALL | `is_compras()` | RPCs |

Regras de policy:
- Toda policy usa `USING ((SELECT public.is_compras()))`, com o `SELECT` envolvendo a função, conforme o padrão anti-initplan do advisor.
- Uma policy só, `FOR SELECT TO authenticated`.
- ADMIN_EXECUCAO e TECNICO **não** leem nenhuma tabela nova (mig. 33 e D16).

Funções:
- Toda função nova recebe `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon`. **Isso é obrigatório:** o Postgres concede `EXECUTE` a `PUBLIC` por padrão.
- As RPCs autenticadas recebem `GRANT EXECUTE ... TO authenticated` e validam `is_compras()` dentro.
- Helpers internos não recebem grant nenhum.
- **Exceção única:** `cotacao_publica_obter(text)` e `cotacao_publica_responder(text, jsonb)` têm `GRANT EXECUTE TO anon, authenticated`.

Realtime: as tabelas `compras_cotacao_convites`, `compras_cotacao_respostas` e `compras_cotacoes` entram em `supabase_realtime` (mesmo bloco `DO $$` da mig. 25). Os eventos respeitam o RLS, então anon e ADMIN_EXECUCAO não recebem nada.

---

## 7. RPCs

> Todas são `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`. As autenticadas começam com `v_uid := current_usuario_id(); IF v_uid IS NULL ...; IF NOT is_compras() THEN RAISE 'Sem permissão'`. Erros de negócio usam `RAISE EXCEPTION` com mensagem pt-BR, mesmo padrão da mig. 25. O service do front devolve `{ success, data?, message? }`.

### 7.1 Configuração, fornecedores e catálogo (mig. 34)

| RPC | Parâmetros | Retorno | Regras |
|---|---|---|---|
| `compras_config_obter()` | — | jsonb (todas as colunas de `compras_config`) | `is_compras()` |
| `compras_config_salvar(p jsonb)` | chaves parciais | jsonb | Só Administrador. Valida faixas (CHECKs). Nunca toca o `pepper`. |
| `compras_normalizar_whatsapp(p text)` | — | text ou NULL | Interna e também exposta a authenticated (o front usa para pré-validar). Fica só com dígitos. Com 10–11 dígitos, prefixa `55`. Precisa casar com o CHECK. |
| `compras_fornecedor_salvar(p_id uuid, p_dados jsonb)` | `{nome_contato, empresa, whatsapp, documento?, email?, categorias?, observacao?}` | uuid | Normaliza o WhatsApp. Duplicidade gera "Já existe fornecedor com este WhatsApp nesta empresa". Fornecedor anonimizado não é editável. |
| `compras_fornecedor_definir_ativo(p_id uuid, p_ativo boolean)` | | void | Inativo não aparece para convite. Convites já feitos continuam. |
| `compras_fornecedor_excluir(p_id uuid)` | | void | Só se não houver convite. Caso contrário: "Inative o fornecedor". |
| `compras_fornecedor_anonimizar(p_id uuid, p_motivo text)` | | void | Só Administrador. Grava nome `'Fornecedor removido'`, empresa `'Removido #<4 primeiros do id>'`, `whatsapp='550000000000'` + sufixo único, e zera documento, email e observação. Também: `ativo=false`, `anonimizado_em=now()` e revoga os tokens vivos. |
| `compras_material_sugerir(p_nome text, p_unidade text, p_limite int default 5)` | | jsonb `[{id,nome,unidade,score,origem:'alias'|'exato'|'similar'}]` | Ordem de busca: 1) alias exato; 2) normalizado exato; 3) `similarity ≥ 0.35` com a mesma unidade (ou `ILIKE` se não houver `pg_trgm`). |
| `compras_material_salvar(p_id uuid, p_nome text, p_unidade text, p_categoria text)` | | uuid | Cria ou edita. Normaliza. Respeita o único `(nome_normalizado, unidade)`. |
| `compras_material_mesclar(p_origem uuid, p_destino uuid, p_motivo text)` | | jsonb `{historico_movido, aliases_movidos}` | Mesma unidade (senão erro). Move `aliases`, `precos_historico` e `cotacao_itens.material_id` para o destino. A origem recebe `mesclado_em_id` e `ativo=false`. |

### 7.2 Cotação (mig. 36)

| RPC | Parâmetros | Retorno | Regras |
|---|---|---|---|
| `compras_cotacao_criar(p_pedidos uuid[], p_observacao_publica text default null, p_regiao_entrega text default null)` | 1–30 pedidos | jsonb `{cotacao_id, numero, itens:[...]}` | Ver detalhamento 1 abaixo. |
| `compras_cotacao_montar_itens(p_cotacao uuid, p_itens jsonb)` | `[{id?, descricao, unidade, material_id?, observacao_publica?, origens:[{pedido_id,item_id,quantidade}]}]` | jsonb itens | Ver detalhamento 2 abaixo. |
| `compras_cotacao_incluir_pedidos(p_cotacao, p_pedidos uuid[])` / `compras_cotacao_remover_pedido(p_cotacao, p_pedido, p_motivo)` | | jsonb | Mesmas regras do `criar`. Remover: o vínculo fica `ativa=false`, as origens e linhas são recompostas, e o pedido volta para `aguardando_compra` se estiver em `em_cotacao`. Se estiver `aguardando_solicitante`, fica `status_compra_anterior='aguardando_compra'`. Cotação `aberta` com convite enviado ganha `requer_revisao=true`. |
| `compras_cotacao_definir_fornecedores(p_cotacao, p_fornecedores uuid[])` | 1–15 fornecedores ativos | jsonb convites | Cria convites que faltam. Remove só os que estão `nao_enviado`. |
| `compras_cotacao_abrir(p_cotacao, p_prazo timestamptz, p_mensagem text)` | | jsonb `{cotacao, links:[{convite_id, fornecedor_id, token}]}` | Ver detalhamento 3 abaixo. |
| `compras_cotacao_gerar_link(p_convite uuid, p_motivo text)` | `'novo_link'` ou `'lembrete'` | jsonb `{convite_id, token}` | Exige cotação `aberta` e fornecedor não anonimizado. Revoga o token vivo (`motivo_revogacao=p_motivo`), cria um novo e grava o evento. |
| `compras_cotacao_registrar_envio(p_convite uuid, p_canal text, p_lembrete boolean default false)` | | jsonb convite | `status`: `nao_enviado` passa a `enviado` (os demais estados ficam como estão). `envios += 1`, `enviado_em/por` (primeiro envio) e `ultimo_canal`. Evento `enviado` ou `lembrete`. |
| `compras_cotacao_prorrogar(p_cotacao, p_novo_prazo timestamptz, p_motivo text)` | | jsonb | Só se `aberta`. O novo prazo precisa ser `> now()` e `> prazo atual`. Evento. |
| `compras_cotacao_revisar(p_cotacao, p_motivo text, p_novo_prazo timestamptz)` | | jsonb `{versao_lista, convites_reconfirmar:[{convite_id, fornecedor_id}], itens}` | Ver detalhamento 4 abaixo. |
| `compras_cotacao_cancelar(p_cotacao, p_motivo text)` | motivo ≥ 5 | void | Status `cancelada`. Todos os vínculos ficam `ativa=false` e os pedidos voltam (regra do remover). Os tokens são revogados (`cotacao_cancelada`). Evento. |
| `compras_cotacao_listar(p_filtros jsonb, p_limite int default 30, p_cursor jsonb default null)` | `{status[], busca, de, ate, minhas}` | jsonb `{itens:[{id, numero, status, prazo_resposta, n_pedidos, n_itens, n_convites, n_enviados, n_respondidos, requer_revisao, criado_por_nome, created_at}], proximo_cursor}` | Paginação por keyset `(created_at, id)`. |
| `compras_cotacao_detalhe(p_cotacao uuid)` | | jsonb | Ver detalhamento 5 abaixo. |
| `compras_cotacao_respostas_versoes(p_convite uuid)` | | jsonb (todas as versões, cada uma com itens e condições) | Auditoria. |
| `compras_cotacao_decidir(p_cotacao uuid, p_decisao jsonb)` | `{modo, segue_recomendacao, justificativa?, itens:[{cotacao_item_id, convite_id, condicao_tipo}], datas_disponibilidade:{<pedido_id>: 'YYYY-MM-DD'}, recomendacao_snapshot}` | jsonb `{decisao_id, pedidos:[{pedido_id, status_compra, data_material_disponivel, etapa_chegada_id}]}` | Ver detalhamento 6 abaixo. |

**Detalhamento 1: `compras_cotacao_criar`.**
- Valida cada pedido:
  - `status_compra IN ('aguardando_compra','em_cotacao')`;
  - `execucao_pedido_tem_itens`;
  - sem vínculo `ativa`;
  - `FOR UPDATE`, em ordem de id para evitar deadlock.
- Muda `aguardando_compra` para `em_cotacao` (mesmos campos de `compras_assumir_pedido`) e grava histórico `compra_status`.
- **Consolidação automática.**
  - Agrupa cada item com nome não vazio por `chave = coalesce('mat:'||alias.material_id, nome_normalizado||'|'||unidade_normalizada)`.
  - `descricao` = nome do primeiro item do grupo (`btrim`, ≤ 200). `quantidade` = soma. `material_id` = alias, se houver.
- Grava o evento `criada`.

**Detalhamento 2: `compras_cotacao_montar_itens`.**
- Só com a cotação em `rascunho`, ou `aberta` com `requer_revisao` (via `revisar`).
- Validações:
  - cada `(pedido_id, item_id)` ativo da cotação aparece **exatamente uma vez**;
  - a quantidade de cada origem é igual à do item no pedido;
  - todas as origens de uma linha têm a mesma unidade normalizada.
- Linhas com `id` existente mantêm o `id`.
- Quando `material_id` é informado, faz upsert de alias `(nome_normalizado do item de origem, unidade) → material_id` (D12).

**Detalhamento 3: `compras_cotacao_abrir`.**
- Pré-condições: status `rascunho`, ≥ 1 linha ativa e ≥ 1 convite.
- `p_prazo` precisa estar entre `now()+1h` e `now()+30 dias`. Se for nulo, usa `now() + prazo_padrao_horas`.
- Grava `taxa_mensal` e `empate_pct` copiados da config, `aberta_em` e `versao_lista=1`.
- Gera um token por convite e devolve os tokens **em claro uma única vez**.
- Limpa o rate limit antigo. Evento `aberta`.

**Detalhamento 4: `compras_cotacao_revisar`.**
- Só com a cotação `aberta`.
- Recompõe as linhas a partir dos itens atuais dos pedidos ativos:
  - mesma origem (`pedido_id, item_id`) e mesma chave: mantém o id da linha e atualiza a quantidade;
  - linha sem origem: `ativo=false`;
  - origem nova: linha nova;
  - `versao_alterada = versao_lista + 1` nas linhas que mudaram.
- `versao_lista += 1`, `requer_revisao=false`, prazo = `p_novo_prazo` (obrigatório, `> now()+1h`).
- Convites com `status IN ('respondido','recusou')` ficam com `precisa_reconfirmar=true`.
- Evento `revisada` com o diff de linhas.

**Detalhamento 5: `compras_cotacao_detalhe`.** Devolve:
- `cotacao`, incluindo `taxa_mensal`, `empate_pct`, `versao_lista` e `requer_revisao`;
- `pedidos`: `[{id, descricao, cliente_nome, solicitante_nome, status_compra, urgencia}]` (dado interno, nunca vai ao fornecedor);
- `itens` com origens;
- `convites`, cada um com o fornecedor (`nome_contato, empresa, whatsapp`), `expirado` derivado e `compras_anteriores`, que é o nº de `decisao_itens` distintos por decisão com esse fornecedor (desempate);
- `respostas_atuais` com itens e condições, inclusive `total_itens` e `valor_presente_itens`;
- `referencias` = `compras_precos_referencia` dos `material_id` da cotação;
- `eventos` (últimos 100);
- `tem_token_vivo` por convite (boolean). O token nunca é devolvido aqui.

**Detalhamento 6: `compras_cotacao_decidir`.**
- Pré-condições:
  - a cotação está `aberta` (decidir antes ou depois do prazo é permitido);
  - `requer_revisao=false`;
  - todos os pedidos ativos estão em `em_cotacao`;
  - toda linha ativa tem `material_id` e aparece exatamente uma vez em `itens`;
  - cada escolha aponta para a **resposta atual** de um convite, com `tem_item` e quantidade disponível nula ou ≥ quantidade, e a condição existe nessa resposta.
- `justificativa` (≥ 10 caracteres) é obrigatória se `modo='manual'` ou `segue_recomendacao=false`.
- **Verificação no servidor:** se `modo='unico'`, todas as escolhas são do mesmo convite e da mesma condição. Se existir proposta completa com VP total menor que `VP_escolhido × (1 − empate_pct)` e a justificativa vier vazia, a RPC rejeita.
- Grava `decisoes` e `decisao_itens`, com preços recalculados por `compras_valor_presente`.
- Grava `precos_historico`:
  - `comprado`: 1 por linha decidida;
  - `cotado`: 1 por linha × resposta atual com `tem_item`, usando a condição de menor VP dessa resposta.
- Para cada pedido:
  - `set_config('compras.cotacao_rpc','1',true)`;
  - `PERFORM compras_alterar_status(pedido,'comprado', 'Cotação nº X', data)`. A data vem de `datas_disponibilidade[pedido]`, que é obrigatória, e a tela sugere `hoje + max(prazo_entrega_dias)` dos fornecedores do pedido;
  - histórico `tipo_alteracao='cotacao'` com `descricao` "Cotação nº X decidida: Empresa A (n itens), Empresa B (m itens)" e `dados_novos={cotacao_id, fornecedores:[{empresa, itens:[item_id...]}]}`, **sem preços** (N5).
- Cotação vai para `encerrada`, os vínculos ficam `ativa=false` e os tokens são revogados (`cotacao_encerrada`). Evento `decidida`.

**Preços e alertas (mig. 36):**

| RPC | Parâmetros | Retorno | Regras |
|---|---|---|---|
| `compras_precos_referencia(p_materiais uuid[])` | ≤ 500 | jsonb `{<material_id>: {ultimo:{preco_vp, preco_nominal, data, quantidade, fornecedor}, media_janela, n_janela, menor:{preco_vp, data}, fora_janela:boolean, n_total}}` | Usa só `tipo='comprado'`. A média é a média simples de `preco_unitario_vp` nos últimos `janela_referencia_meses`. Se `n_janela=0`, usa a média das últimas `fallback_ultimas_compras`, com `fora_janela=true`. |
| `compras_material_historico(p_material uuid, p_limite int default 50)` | | jsonb lista (comprado e cotado, com fornecedor e cotação) | |
| `compras_verificar_alertas()` | | jsonb `{aceites_alertados, cotacoes_vencendo, rate_limit_limpos}` | Ver detalhamento 7 abaixo. |

**Detalhamento 7: `compras_verificar_alertas`.**
- Throttle de 10 min via `alertas_ultima_execucao` (se rodou há pouco, devolve zeros).
- **(a) Aceites vencidos:** questionamentos `origem='alteracao_compras'`, `status='aberto'`, `prazo_resposta_em < now()` e `alerta_enviado_em IS NULL`. Gera notificação `compra_questionamento` para o `criado_por` e outra com `destinatario_id NULL` (gestores). Depois grava `alerta_enviado_em`.
- **(b) Cotações vencendo:** cotações `aberta` com prazo em menos de 24 h e 0 respostas. Gera `compra_cotacao` para o `criado_por`, uma vez por cotação (controle pelo evento `requer_revisao` ou por uma flag em `dados`).
- **(c)** Apaga `compras_rate_limit` com mais de 2 dias.
- **(d)** Apaga `ip` de `compras_cotacao_eventos` com mais de 12 meses (LGPD).

**Mudanças em RPCs existentes (mig. 36).** Reescrever a partir de `pg_get_functiondef` **de produção**, preservando o que a mig. 33 trocou:
- `compras_alterar_status`:
  - com vínculo `ativa` e sem a flag `compras.cotacao_rpc='1'`, bloqueia `em_cotacao → aguardando_compra` com "Pedido está na cotação nº X: remova-o da cotação" e `em_cotacao → comprado` com "Decida pela cotação nº X";
  - `→ cancelado` continua permitido e também remove o pedido da cotação (vínculo `ativa=false`; `requer_revisao=true` se houve envio).
- `compras_listar_pedidos`: inclui `cotacao_ativa: {id, numero, status}` em cada pedido (campo novo, compatível) e um filtro opcional `p_filtros.sem_cotacao boolean`.
- `compras_detalhe_pedido`: inclui `cotacoes: [{id, numero, status, ativa}]`.

### 7.3 Triggers novos em `execucao_pedidos_material` (mig. 35)

1. **`trg_pedido_guarda_cotacao`**: `BEFORE UPDATE OF itens`. Só age se `execucao_pedido_itens_sem_id(NEW.itens) IS DISTINCT FROM ...(OLD.itens)` e existe vínculo `ativa`.
   - Cotação `aberta` com algum convite `status <> 'nao_enviado'`:
     - sem as flags de sessão `execucao.compras_rpc` e `compras.cotacao_rpc` (edição direta do solicitante): `RAISE 'Este pedido está na cotação nº X, já enviada a fornecedores. Para alterar itens, fale com a Compras (questionamento).'`;
     - com `execucao.compras_rpc='1'` (aprovação de questionamento): permite, grava `requer_revisao=true` e o evento `requer_revisao`, e notifica o comprador com `compra_cotacao` "Lista alterada: revise a cotação nº X".
   - Cotação em `rascunho` ou `aberta` sem envio: permite e grava `requer_revisao=true`.
2. **`trg_pedido_guarda_cotacao_delete`**: `BEFORE DELETE`. Se o pedido tem vínculo `ativa` com cotação `aberta` e algum envio, `RAISE 'Pedido em cotação enviada: remova-o da cotação antes de excluir'`. Nos outros casos, permite: o CASCADE remove o vínculo e as origens, e a RPC seguinte recompõe.

### 7.4 RPCs públicas (mig. 37)

**Helpers internos** (sem grant):
- `compras_token_hash(p text) → bytea`: `sha256(convert_to(p,'UTF8'))`.
- `compras_request_ip() → text`: lê `current_setting('request.headers', true)::json` e usa, nesta ordem, `cf-connecting-ip`, `x-real-ip` e o 1º de `x-forwarded-for`. Devolve NULL se não houver.
- `compras_rl_consumir(p_chave text, p_limite int, p_janela interval) → boolean`: faz `INSERT ... ON CONFLICT DO UPDATE SET contador = contador + 1 RETURNING contador`, com janela = `date_trunc` em blocos de 10 min ou de 1 h. Devolve `contador <= p_limite`.
- `compras_valor_presente(p_total numeric, p_tipo text, p_parcelas int, p_entrada numeric, p_primeira_dias int, p_taxa numeric) → numeric(14,2)`: fórmula do §8.1. É `IMMUTABLE` e tem `GRANT` a authenticated (o QA usa no teste de paridade).

**`cotacao_publica_obter(p_token text) → jsonb`**

1. Se `link_publico_ativo=false`, devolve `{ok:false, codigo:'INDISPONIVEL'}`.
2. Se `p_token !~ '^[A-Za-z0-9_-]{43}$'`, devolve `{ok:false, codigo:'LINK_INVALIDO'}` (consome o rate limit de IP antes).
3. Rate limit: `ip:obter:<iphash>` (`rl_ip_obter_10min`) e `tk:obter:<hash>` (`rl_token_obter_10min`). Estourou: `{ok:false, codigo:'MUITAS_TENTATIVAS'}`.
4. Busca o token pelo hash:
   - não existe: `LINK_INVALIDO`;
   - `revogado_em` com motivo `lembrete` ou `novo_link`: `LINK_SUBSTITUIDO`;
   - motivo `cotacao_encerrada`, `cotacao_cancelada` ou `anonimizacao`: `{ok:true, estado:'encerrada', empresa_contratante}`, sem mais nenhum dado.
5. Se a cotação está `cancelada` ou `encerrada`, devolve como no caso anterior (`estado:'encerrada'`).
6. Marca a visualização. Na primeira vez, `nao_enviado` ou `enviado` passam a `visualizado`. Sempre atualiza `ultima_visualizacao_em`. Grava o evento `visualizado` com IP no máximo 1 vez por hora.
7. Devolve **apenas**:

```json
{
  "ok": true,
  "estado": "aberta | prazo_encerrado",
  "empresa_contratante": "Effort",
  "cotacao": { "numero": 123, "prazo_resposta": "2026-11-03T18:00:00-03:00", "versao_lista": 2,
               "observacao": "texto público", "regiao_entrega": "Curitiba / Batel" },
  "fornecedor": { "nome_contato": "João", "empresa": "Elétrica X" },
  "itens": [ { "id": "uuid-linha", "seq": 1, "descricao": "Cabo flexível 2,5 mm", "unidade": "m",
               "quantidade": 300, "observacao": null, "alterado_na_versao": 2 } ],
  "precisa_reconfirmar": true,
  "resposta": null
}
```

   - `resposta`, quando existir, é a **própria** resposta atual do fornecedor, no formato de entrada do `responder`, mais `versao` e `enviado_em`.
   - Nunca devolve: ids de pedido, cliente, obra, endereço, solicitante, urgência, outros convites ou respostas, preços de referência, o `taxa_mensal` nem o `whatsapp` do próprio fornecedor.

**`cotacao_publica_responder(p_token text, p_resposta jsonb) → jsonb`**

1. Passos 1, 2 e 4 do `obter`. Rate limit `ip:resp`, `tk:resp` e `gl:resp` (por hora).
2. Se `now() > prazo_resposta`, devolve `{ok:false, codigo:'PRAZO_ENCERRADO'}`. Se a cotação não está `aberta`, devolve `COTACAO_ENCERRADA`.
3. `pg_column_size(p_resposta) > 200000` devolve `PAYLOAD_GRANDE`.
4. `(p_resposta->>'versao_lista')::int <> versao_lista` devolve `{ok:false, codigo:'LISTA_ALTERADA'}` (o front recarrega).
5. Limite de 20 versões por convite: `LIMITE_VERSOES`.
6. **Validação estrita.** Qualquer falha devolve `{ok:false, codigo:'DADOS_INVALIDOS', campo:'<caminho>', mensagem:'<pt-BR curto>'}` e grava o evento `resposta_rejeitada`. Regras:
   - `recusou` é boolean. Com `recusou=true`, ignora itens e condições, `status` vai para `recusou`, e o resto é opcional.
   - `itens` é um array com **exatamente** as linhas ativas da cotação (por `id`). Cada linha tem `tem_item` (boolean) e, quando `tem_item`, `preco_unitario` numérico `> 0` e `≤ 1e9` com até 4 casas.
   - `quantidade_disponivel`, se vier, fica `> 0` e `≤ 1e7`. `observacao` tem até 200 caracteres.
   - Pelo menos 1 linha com `tem_item=true` (senão a resposta precisa vir com `recusou`).
   - `condicoes` é um array com 1–2 condições de tipos distintos:
     - `a_vista`: `desconto_tipo` null, `percentual` (0..50) ou `valor` (0..base);
     - `parcelado`: `parcelas` 1..24, `entrada_valor` 0..total, `primeira_parcela_dias` 0..180 (default 30) e `total` opcional entre `base×0.5` e `base×3`.
   - `prazo_entrega_dias` é inteiro 0..365 (obrigatório, D5).
   - `frete.tipo` é `cif` ou `valor`. Com `valor`, `frete.valor` vai de 0 a 1e7 (obrigatório, D5).
   - `observacao` tem até 1000 caracteres. Qualquer texto passa por `btrim`, e caracteres de controle são removidos.
7. Calcula `base_total = Σ preco × min(quantidade, coalesce(qtd_disp, quantidade))` nas linhas com `tem_item`. Para cada condição, grava `total_itens` e `valor_presente_itens` com a `taxa_mensal` da cotação.
8. A versão anterior fica `atual=false`. Insere a nova versão (`versao = max+1`), com IP (hash) e user agent.
9. Atualiza o convite: `status='respondido'` (ou `recusou`), `respondido_em`, `versao_lista_respondida` e `precisa_reconfirmar=false`.
10. Notifica `compra_cotacao` ao `criado_por` da cotação: "📨 <empresa> respondeu a cotação nº X". Uma por versão, com no máximo 1 notificação a cada 10 min por convite.
11. Grava o evento `resposta_enviada` e devolve `{ok:true, versao, enviado_em}`.

Códigos de erro (o front mapeia para texto):
- `INDISPONIVEL`, `LINK_INVALIDO`, `LINK_SUBSTITUIDO`, `MUITAS_TENTATIVAS`;
- `PRAZO_ENCERRADO`, `COTACAO_ENCERRADA`, `LISTA_ALTERADA`;
- `PAYLOAD_GRANDE`, `LIMITE_VERSOES`, `DADOS_INVALIDOS`.

### 7.5 Alterações da atendente (mig. 38)

**`compras_alterar_itens(p_pedido uuid, p_alteracoes jsonb, p_motivo text, p_revisar_cotacao jsonb default null) → jsonb`**

- **Entrada.**
  - `p_alteracoes`: `[{acao:'quantidade'|'remover'|'corrigir'|'substituir'|'adicionar', item_id?, quantidade?, nome?, unidade?}]`, com 1–50 itens.
  - `p_motivo`: obrigatório, ≥ 5 caracteres.
  - `p_revisar_cotacao`: `{novo_prazo}`.
- **Pré-condições:**
  - `is_compras()`;
  - status em `aguardando_compra`, `em_cotacao` ou `aguardando_solicitante`;
  - o pedido está `FOR UPDATE`.
- **Classificação (D13):**
  - `quantidade` menor: ciência. `quantidade` maior: aceite (questionamento `quantidade`).
  - `remover`: ciência.
  - `corrigir` (nome e/ou unidade): ciência **só se** `compras_normalizar_nome(novo)` for igual ao antigo, ou `similarity ≥ 0.6`, ou só a unidade mudou entre sinônimos de `compras_normalizar_unidade`. Caso contrário, a RPC rejeita com "Use Substituir".
  - `substituir`: aceite (questionamento `substituicao`, `sugestao{nome, unidade?, quantidade?}`).
  - `adicionar`: aceite (questionamento `adicao`, `sugestao{nome, quantidade, unidade}`).
- **Pedido em cotação já enviada** (vínculo `ativa` + cotação `aberta` + algum envio):
  - sem `p_revisar_cotacao`: `RAISE 'Pedido em cotação enviada: use "Aplicar e revisar cotação"'`;
  - com `p_revisar_cotacao`: aplica as ciências e chama `compras_cotacao_revisar` na mesma transação. As alterações de aceite geram questionamento (a revisão das linhas acontece quando o aceite for aprovado, via `requer_revisao`).
- **Aplicação das ciências:**
  - `set_config('execucao.compras_rpc','1',true)` para não disparar o aviso "pedido editado";
  - `UPDATE itens` (unidades `un/cx/pct` com `ceil`, como hoje);
  - histórico `tipo_alteracao='alteracao_compras'` com `dados_anteriores={itens}`, `dados_novos={itens}`, `motivo` e `descricao` "Compras alterou a lista (ciência): …";
  - notificação `compra_alteracao` ao solicitante, usando `execucao_compras_notificar_solicitante` (TECNICO vai para os admins, regra existente).
- **Aceites:** chama o corpo interno do `compras_abrir_questionamento`, refatorado em `execucao_compras_abrir_questionamento_interno(..., p_origem, p_motivo)`, com:
  - `origem='alteracao_compras'`;
  - `motivo_alteracao`;
  - `prazo_resposta_em = compras_somar_horas_uteis(now(), prazo_aceite_horas_uteis)`.
- **Retorno:** `{aplicadas:[...], pendentes_aceite:[{questionamento_id, acao, item_id}], status_compra, cotacao:{id, versao_lista}?}`.

**`compras_somar_horas_uteis(p_inicio timestamptz, p_horas int) → timestamptz`** (interna)
- Conta só segunda a sexta, em America/Sao_Paulo.
- Pula `execucao_feriados` com `considerar_feriado = true` e `abrangencia = 'nacional'` (recorrentes pelo dia/mês).
- Conta 24 h corridas por dia útil (sem horário comercial; a aproximação está documentada).

**Mudanças em funções existentes (mig. 38):**
- `compras_abrir_questionamento`: aceita `p_tipo='adicao'` com `p_item_id` NULL e `sugestao{nome, quantidade>0, unidade}` obrigatória. A assinatura não muda.
- `compras_responder_questionamento`:
  - aprovar `adicao` faz append de `{nome, quantidade, unidade}` em `itens`, e o `id` vem do trigger da mig. 23;
  - o histórico ganha `tipo_alteracao='alteracao_compras'` quando `origem='alteracao_compras'`;
  - a resposta notifica `compra_resposta` ao criador (já existe).
  - A regra de permissão continua a mesma: `substituicao` só por `is_admin_execucao()`, e `adicao` segue a regra de `quantidade` (solicitante não TECNICO ou admin).

### 7.6 KPIs (mig. 39)

**`compras_indicadores_cotacao(p_de date, p_ate date) → jsonb`**: `is_compras()`, definições no §12.

---

## 8. Regras de cálculo (fonte: `src/features/compras/utils/cotacao/comparacao.js`)

### 8.1 Valor presente

- `i` = `taxa_mensal` da cotação e `fd(d) = (1 + i)^(d / 30)`.
- **À vista.** `T = base` com desconto aplicado:
  - percentual: `base × (1 − p/100)`;
  - valor: `max(base − v, 0)`.
  - `VP_itens = T` (pagamento no dia 0).
- **Parcelado.** `T = total_informado ?? base`, `E = entrada`, `P = (T − E)/n` e `d_k = primeira_parcela_dias + 30·(k−1)`.
  - `VP_itens = E + Σ_{k=1..n} P / fd(d_k)`.
- **Frete.** `F = frete_tipo='cif' ? 0 : frete_valor`. Pago no dia 0 (N1).
- `VP_total = VP_itens + F` e `Nominal_total = T + F`.
- **Arredondamento.** Os cálculos internos não arredondam. A exibição e a gravação usam 2 casas para totais e 4 para unitários, sempre com arredondamento "half-up" (`Math.round` sobre centavos e `round(x, 2)` no SQL).
- **Fator da condição** (N2): `fc = T / base`, `fvp = VP_itens / base`.
  - `preco_nominal = preco × fc`.
  - `preco_vp = preco × fvp`.

### 8.2 Cobertura

- Linha **atendida integralmente**: `tem_item` e (`quantidade_disponivel` nulo ou ≥ `quantidade`).
- Linha **parcial**: `tem_item` e quantidade disponível menor que a pedida. Para efeito de completude, conta como **não atendida** (N6).
- Resposta **completa**: atende integralmente todas as linhas ativas da `versao_lista` atual.
- Resposta com `versao_lista_respondida < versao_lista`:
  - linhas com `versao_alterada > versao_lista_respondida` contam como **não cotadas**;
  - a proposta ganha o selo "baseada na lista v{n}".

### 8.3 Candidatos

Cada par `(resposta atual não recusada, condição)` é um candidato. O padrão da tela é mostrar, por fornecedor, a condição de menor `VP_total`. A outra condição aparece expandível.

### 8.4 Ranking global e empate (D9, D10)

1. Separar os candidatos completos. **Se houver ≥ 1:** ordenar por `VP_total` crescente. Os parciais aparecem depois, com o selo "cobre X de Y" e sem chance de vencer no modo único.
2. **Se não houver nenhum completo:** ordenar os parciais por `linhas_atendidas` decrescente e depois por `VP_total` crescente. O melhor recebe o selo "Melhor parcial", e a recomendação passa a ser a combinação dividida, se ela cobrir tudo.
3. **Empate técnico.** Todo candidato com `(VP_total − VP_1º)/VP_1º < empate_pct` está empatado com o 1º. O desempate ordena por:
   1. menor `prazo_entrega_dias`;
   2. `frete_tipo='cif'` primeiro;
   3. maior `compras_anteriores`;
   4. menor `respondido_em`.
   A tela mostra "Empate técnico (desempate: prazo de entrega)", indicando o critério que decidiu.
4. **Selo "Melhor proposta"** no 1º após o desempate. Ao lado aparecem:
   - `Δ` para o 2º: R$ e %;
   - `Δ` para a mais cara: R$ e %;
   - o prazo de entrega, sempre.

### 8.5 Combinação dividida (D8)

1. Para cada fornecedor `s`, escolher a condição com o menor `fvp_s`. Em empate, à vista.
2. Seja `R` o conjunto de fornecedores com resposta válida, com `|R| = M`.
   - **Se M ≤ 12:** enumerar os subconjuntos não vazios `S ⊆ R` (até 4.095). Para cada `S`:
     - cada linha recebe o `s ∈ S` que a atende integralmente com menor `preco × fvp_s`. Em empate, ganha o menor prazo;
     - se alguma linha ficar sem fornecedor, o `S` é inválido;
     - `custo(S) = Σ linhas (preco_vp × quantidade) + Σ frete dos fornecedores que receberam ≥ 1 linha`.
   - **Se M > 12:** usar a heurística gulosa. Começa pelo melhor fornecedor único completo, ou pelo de maior cobertura, e repete "adicionar o fornecedor que mais reduz o custo" até não haver mais redução.
3. Mostrar a combinação só se ela usar ≥ 2 fornecedores e `economia = VP_unico − custo > 0`. A tela mostra a economia em R$ e % sobre o melhor único completo. Se não houver único completo, mostra a combinação como "única forma de cobrir tudo".
4. Se algum fornecedor usado tem desconto em R$, aparece o aviso N3.
5. **Meta de desempenho:** M=12 e 200 linhas em menos de 150 ms num celular médio. A Performance mede no §14 (P-02).

### 8.6 Variação vs. referência (D11, D18)

- `ref = referencias[material_id].media_janela`. Se `n_janela = 0`, usa a média com `fora_janela` e o selo "referência antiga".
- `Δ = preco_vp − ref` e `Δ% = Δ / ref`.
- Cor:
  - `|Δ%| ≤ faixa_neutra_pct`: cinza;
  - `Δ < 0`: verde;
  - `Δ > 0`: vermelho.
- Se `Δ% > alerta_pct`, mostra o alerta "⚠️ renegociar".
- O texto segue o formato: `R$ 12,50 (+R$ 1,30 / +11,6% vs. média)`. O detalhe (tooltip ou expansão) mostra a última compra, a menor e a **quantidade da compra de referência**.
- Material sem histórico: "primeiro registro".
- Material sem `material_id`: "confirme o material para comparar".
- **Por cotação:** `Σ (ref × quantidade)` nas linhas com referência, comparado com o total da decisão nessas mesmas linhas. A tela mostra "economia de R$ x (−y%)" ou "acima da referência em R$ x (+y%)".

---

## 9. Página pública do fornecedor

### 9.1 Build e roteamento

**Arquivos novos:**
- `cotacao/index.html`, que precisa conter:
  - `<meta name="robots" content="noindex,nofollow">`;
  - `<meta name="referrer" content="no-referrer">`;
  - `<meta name="viewport" ...>` igual ao do `index.html`;
  - `lang="pt-BR"` e `<title>Cotação</title>`;
  - `<script type="module" src="/src/cotacao-publica/main.jsx">`.
- `src/cotacao-publica/`: `main.jsx`, `CotacaoPublica.jsx`, `api.js`, `componentes/*.jsx` e `cotacao-publica.css`.

**`vite.config.js`:**
- `build.rollupOptions.input = { main: resolve(__dirname,'index.html'), cotacao: resolve(__dirname,'cotacao/index.html') }`, importando `resolve` de `node:path` e `__dirname` via `fileURLToPath`;
- `manualChunks` continua igual. O chunk `supabase` **não** pode aparecer no grafo da entrada `cotacao` (verificar com `npx vite-bundle-visualizer` ou no manifest);
- `injectManifest.globIgnores` + `'cotacao/**'` e `'**/cotacao-*.js'`. O hash da entrada sai como `assets/cotacao-<hash>.js`; a Performance confirma o nome.

**`src/sw.js`:** `denylist: [/^\/reset-password/, /^\/test-supabase\.html/, /^\/cotacao/]`. Motivo: num aparelho da equipe com o SW registrado, a navegação para `/cotacao/` nunca pode cair no `index.html` do app.

**Rota no `App.jsx`:** nenhuma. O App nunca vê `/cotacao/`, e o `hashEhCompras` não casa com `#<token>`, porque o fragmento é só o token, sem `/`.

**`public/_headers`** (novo; o Netlify copia de `dist/`):

```
/cotacao/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Cache-Control: no-cache
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

**`public/robots.txt`** (novo): `User-agent: *` / `Disallow: /cotacao/`.

**Manifest do PWA.** Conferir se o VitePWA injeta `<link rel="manifest">` em `cotacao/index.html`. Se injetar, não tem problema (a página não registra SW). O Frontend registra o resultado no PR.

### 9.2 Cliente HTTP (`src/cotacao-publica/api.js`)

```
const URL_BASE = import.meta.env.VITE_SUPABASE_URL; const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
async function chamar(fn, corpo) → fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method:'POST',
  headers:{ apikey:ANON, Authorization:`Bearer ${ANON}`, 'Content-Type':'application/json' }, body: JSON.stringify(corpo),
  referrerPolicy:'no-referrer', cache:'no-store' })
obter(token) → chamar('cotacao_publica_obter', { p_token: token })
responder(token, resposta) → chamar('cotacao_publica_responder', { p_token: token, p_resposta: resposta })
```

- O Frontend confirma os nomes reais das variáveis em `src/services/supabase/config.js` (usar os mesmos).
- Timeout de 15 s com `AbortController`. Erro de rede aparece como "Sem conexão. Seus dados continuam preenchidos; tente enviar de novo."
- **Token.**
  - `const token = location.hash.slice(1)`.
  - **Não** limpar o fragmento com `history.replaceState`: o fornecedor precisa recarregar e voltar ao link.
  - O token nunca vai para `console.log`, para analytics nem em claro no `localStorage`.

### 9.3 UX (mobile-first, tema claro, sem o design system da Execução)

1. **Cabeçalho:** "{empresa_contratante} · Cotação nº {numero}", "Olá, {nome_contato} ({empresa})" e o prazo em contagem regressiva ("responda até qui 03/11 18:00").
2. **Aviso amarelo** se `precisa_reconfirmar`: "A lista foi alterada. Confira os itens marcados como 'alterado' e envie de novo."
3. **Lista de itens em cartões** (1 por linha), com a descrição, a quantidade e a unidade em destaque e o selo "alterado" quando cabe. Controles:
   - segmentado "Tenho / Não tenho";
   - preço unitário: `inputmode="decimal"`, máscara pt-BR, aceita vírgula;
   - subtotal calculado ao vivo;
   - "Tenho só parte" abre o campo de quantidade disponível;
   - "Marca / observação" (≤ 200).
4. **Bloco "Condições".**
   - Checkbox "À vista", com o desconto em % ou R$ (opcional).
   - Checkbox "Parcelado", com nº de parcelas (1–24), entrada (R$, opcional), dias até a 1ª parcela (padrão 30) e total parcelado (padrão = soma; editável, com a dica "se houver juros, informe o total").
   - Pelo menos uma condição é obrigatória.
5. **Bloco "Entrega":** prazo em dias (obrigatório), frete com rádio "Incluso (CIF)" ou "Valor R$" (obrigatório) e "Região de entrega: {regiao_entrega}" (só leitura).
6. **Observação geral** (≤ 1000).
7. **Resumo fixo no rodapé:** total à vista e/ou parcelado (nominal, sem VP) e o botão "Enviar proposta". Validação local com os mesmos limites do §7.4: o primeiro campo inválido recebe foco e fica com borda vermelha e mensagem.
8. **Link discreto** "Não vou cotar": confirmação, depois `recusou=true`.
9. **Pós-envio:** "✅ Proposta enviada às hh:mm (versão n). Você pode alterar até {prazo}." A resposta enviada aparece preenchida.
10. **Rascunho:** salvar no `localStorage`, na chave `cot:rasc:<sha256(token) 16 hex>` (sem o token em claro), a cada mudança com debounce de 500 ms. Ao enviar com sucesso, apagar.
11. **Estados:**
    - carregando: skeleton;
    - `LINK_INVALIDO`: "Link inválido. Peça um novo link a quem enviou.";
    - `LINK_SUBSTITUIDO`: "Este link foi substituído. Use o link mais recente enviado por WhatsApp.";
    - `encerrada`: "Cotação encerrada. Obrigado!";
    - `prazo_encerrado`: tudo só leitura, com o aviso "Prazo encerrado";
    - `MUITAS_TENTATIVAS`: "Muitas tentativas. Aguarde alguns minutos.";
    - `INDISPONIVEL`: "Cotação temporariamente indisponível.";
    - `LISTA_ALTERADA`: recarregar os itens, manter os preços das linhas com o mesmo `id` e avisar.
12. **Acessibilidade:** rótulos visíveis, alvos de toque com 44 px ou mais, contraste AA, sem depender só de cor, `aria-live` nas mensagens de envio.
13. **Orçamento de bundle:** entrada própria ≤ 25 kB gzip (sem React), CSS ≤ 12 kB gzip e total da primeira carga ≤ 120 kB gzip (com o chunk `react`). **Proibido** importar:
    - `src/services/**`;
    - `src/contexts/**`;
    - `src/features/execucao/**`;
    - `src/features/compras/components/**`;
    - `react-icons` (usar emoji/SVG inline).
    Pode importar `src/features/compras/utils/cotacao/moeda.js`, que é puro.

### 9.4 Dados que o fornecedor vê (D15)

- **Pode ver:** nome público da contratante, nº da cotação, prazo, a própria identificação (contato e empresa), as linhas (descrição pública, unidade, quantidade, observação pública), a região de entrega e a observação pública da cotação.
- **Nunca vê:** cliente, obra, endereço, solicitante, equipe, urgência, ids internos de pedido, outros fornecedores, preços de terceiros, histórico ou referência de preços, taxa e regras de decisão, nem o próprio WhatsApp.

---

## 10. Fluxo da atendente (módulo Compras)

### 10.1 Navegação

- `ComprasHeader` ganha as seções:
  - **Pedidos** (`#/compras`, como hoje);
  - **Cotações** (`#/compras/cotacoes`, detalhe em `#/compras/cotacoes?id=<uuid>`);
  - **Fornecedores** (`#/compras/fornecedores`);
  - **Preços** (`#/compras/precos`);
  - **Configurações** (`#/compras/config`, só para Administrador).
- `navegacaoCompras.js` recebe:
  - `secaoDoHash()`, que devolve `'pedidos'|'cotacoes'|'fornecedores'|'precos'|'config'`;
  - `cotacaoDoHash()`;
  - `hashDaCotacao(id)`.
- O `hashEhCompras` atual já casa com `#/compras/...` e não muda.
- O `ComprasModulo.jsx` troca o conteúdo pela seção, cada uma em `lazy()`:
  - `CotacoesPagina`;
  - `FornecedoresPagina`;
  - `PrecosPagina`;
  - `ConfigComprasPagina`.

### 10.2 Seleção múltipla e criação

1. Em `FilaCompras` e `CartaoPedidoCompras`, nos pedidos com `status_compra` em `aguardando_compra` ou `em_cotacao` e `cotacao_ativa == null`:
   - aparece uma checkbox "Selecionar";
   - quando o pedido já tem cotação ativa, o lugar da checkbox mostra o selo "🧾 Cotação nº X" (link para a cotação).
2. Barra de ação fixa: "Criar cotação com N pedidos" e "Limpar". Limite de 30 pedidos.
3. O **assistente `NovaCotacao`** (modal em tela cheia no celular) tem 4 passos:
   1. **Pedidos:** lista dos selecionados, com cliente, descrição e solicitante (interno), e a opção de remover.
   2. **Itens consolidados:** tabela de linhas com descrição pública (editável), unidade, quantidade somada, composição expandível ("Pedido A: 100 m · Pedido B: 200 m"), observação pública e material.
      - O seletor de material usa `compras_material_sugerir`, com a opção "Criar novo".
      - Ações: "Separar linha" (tira uma origem para uma linha nova) e "Juntar com…" (só com a mesma unidade normalizada).
      - Campo "Região de entrega (cidade/bairro)", com a dica "não informe endereço".
      - Ao avançar, `compras_cotacao_montar_itens`.
   3. **Fornecedores:** busca e filtro por categoria, multi-seleção (1–15 ativos) e "Cadastrar fornecedor" inline (modal reaproveitado da página Fornecedores). Ao avançar, `compras_cotacao_definir_fornecedores`.
   4. **Prazo e mensagem:** prazo com chips 24h / 48h (padrão) / 72h ou data/hora; textarea com a mensagem padrão (placeholders), pré-visualização para o 1º fornecedor e o botão "Abrir cotação e gerar links". Ao confirmar, `compras_cotacao_abrir`, os tokens vão para o `sessionStorage` e a tela segue para o painel de envio.
4. O `compras_cotacao_criar` é chamado ao sair do passo 1. A cotação fica em `rascunho` e os pedidos passam a `em_cotacao`. Fechar o assistente pergunta "Manter rascunho / Descartar". Descartar chama `compras_cotacao_cancelar`, com motivo automático "Rascunho descartado".

### 10.3 Envio por WhatsApp

- **Painel de envio** (topo do detalhe da cotação): uma linha por convite, com:
  - empresa e contato;
  - WhatsApp formatado;
  - chip de status (`nao_enviado` ⚪, `enviado` 📤, `visualizado` 👀, `respondido` ✅, `recusou` 🚫, expirado ⏰);
  - nº de envios e o último envio;
  - os botões descritos abaixo.
- **Botões:**
  - **"Enviar WhatsApp"**: só ativo com o token no `sessionStorage`. No **mesmo handler de clique**, sem `await` antes:
    - `window.open('https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener')`;
    - depois, `compras_cotacao_registrar_envio(convite,'whatsapp')`.
  - **"Copiar link"**: `navigator.clipboard.writeText(url)` e depois `registrar_envio(convite,'copia')`.
  - **"Lembrete" / "Gerar novo link"**: em **duas etapas** (não dá para abrir o `wa.me` depois de um `await` sem o popup ser bloqueado):
    1. `compras_cotacao_gerar_link(convite,'lembrete')`, que guarda o token;
    2. o botão vira "Enviar lembrete pelo WhatsApp" e funciona como o envio, com `p_lembrete=true` e a mensagem de lembrete.
  - Sem token em memória (outra sessão), "Enviar WhatsApp" vira "Gerar link para enviar", com o mesmo fluxo de duas etapas e motivo `novo_link`.
- **URL:** `${window.location.origin}/cotacao/#${token}`.
- **Mensagens padrão (`compras_config`):**
  - padrão: "Olá {contato}, tudo bem? Aqui é da {empresa_publica}. Segue a cotação nº {numero} com {qtd_itens} itens. Para informar preços e condições, acesse: {link} . Prazo para resposta: {prazo}. Obrigado!";
  - lembrete: "Olá {contato}, lembrando da cotação nº {numero} da {empresa_publica}. Prazo: {prazo}. Link atualizado: {link}";
  - revisão: "Olá {contato}, a lista da cotação nº {numero} foi atualizada. Por favor, confira e reenvie sua proposta até {prazo}: {link}".
  - O `{link}` fica cercado de espaços, para o WhatsApp não colar pontuação na URL.

### 10.4 Acompanhamento em tempo real

- `DetalheCotacao` usa `useAtualizacaoTabelas(['compras_cotacao_convites','compras_cotacao_respostas','compras_cotacoes'])`, o hook existente.
- No callback, só recarrega se `payload.new?.cotacao_id === id` (ou `id === id` para `compras_cotacoes`). Debounce de 800 ms e depois `compras_cotacao_detalhe`.
- O destaque de 3 s na linha alterada segue o padrão `destaques` do `DashboardCompras`.
- A cada 15 min com o módulo aberto, e ao montar `ComprasModulo`: `compras_verificar_alertas()`.
- A notificação `compra_cotacao` no sino abre `#/compras/cotacoes?id=<cotacao_id>`. Para isso:
  - `TIPOS_NOTIFICACAO_COMPRAS` recebe `compra_cotacao` e `compra_alteracao`;
  - `destinoComprasDaNotificacao` trata `referencia.cotacao_id`.

### 10.5 Comparativo e decisão

- **Aviso de bloqueio:** se `requer_revisao`, uma faixa vermelha "Lista alterada após o envio: revise a cotação antes de decidir", com o botão "Revisar cotação".
- **Cartões de ranking** (§8.4): "🏆 Melhor proposta", "Empate técnico" e "cobre X de Y". Cada cartão mostra:
  - VP total e nominal;
  - condição (à vista / 3x, com entrada);
  - frete;
  - prazo de entrega;
  - Δ para a 2ª e para a mais cara;
  - a versão ("v3 · 14:02") e o link "ver versões anteriores", que mostra o diff de preço entre versões.
- **Cartão "Melhor combinação dividida"** (§8.5): economia em R$ e % e a lista de qual fornecedor fica com quais itens.
- **Matriz itens × fornecedores:**
  - cada célula mostra preço VP e nominal, um selo de variação vs. referência (§8.6) e "não tem", "parcial (x)" ou "não cotado";
  - a célula mais barata da linha fica destacada (borda verde + "menor");
  - no celular, a matriz vira lista por item com as ofertas ordenadas.
- **Rodapé por cotação:** "vs. referência: economia de R$ x (−y%)".
- **Botão "Decidir"** abre o `ModalDecisao`:
  - modo: único (pré-selecionado com o recomendado), dividido ou manual. No manual, a atendente escolhe o fornecedor por linha;
  - confirmação de material nas linhas sem `material_id`;
  - data de disponibilidade por pedido, sugerida como `hoje + max(prazo_entrega_dias)`;
  - justificativa obrigatória quando foge da recomendação;
  - resumo final.
  - Ao confirmar, `compras_cotacao_decidir`.
- **Ações extras:**
  - "Prorrogar prazo";
  - "Revisar cotação" (abre a revisão: diff das linhas e novo prazo; depois oferece "Enviar aviso por WhatsApp" a quem precisa reconfirmar, em duas etapas por convite: gerar link e enviar);
  - "Incluir pedido";
  - "Remover pedido";
  - "Cancelar cotação".

### 10.6 Fornecedores, Preços e Configurações

- **FornecedoresPagina:**
  - tabela/lista com busca, filtro por ativo e categoria;
  - modal de criar/editar (nome do contato, empresa, WhatsApp com máscara, documento, e-mail, categorias como chips livres, observação);
  - inativar/ativar, excluir (quando permitido) e anonimizar (só Administrador, com confirmação dupla);
  - colunas de desempenho: taxa de resposta e nº de vitórias (a partir de `compras_indicadores_cotacao.por_fornecedor`).
- **PrecosPagina:**
  - busca de material com tabela (nome, unidade, última compra, média 6m, menor, nº de compras);
  - detalhe com o histórico (`compras_material_historico`) e um sparkline em SVG puro, **sem echarts**;
  - "Mesclar com…", com seletor e confirmação.
- **ConfigComprasPagina** (Administrador):
  - os campos de `compras_config`, com explicação de cada um (ex.: "1,5% a.m.: parcelas futuras valem menos que pagamento hoje");
  - o kill switch "Link público ativo", com aviso.

---

## 11. Alterações da atendente nas listas (demanda 5)

**Tela (Compras):** `DetalhePedidoCompras` ganha o botão "✏️ Alterar itens", visível se `status_compra ∈ {aguardando_compra, em_cotacao, aguardando_solicitante}`. Ele abre o `ModalAlterarItens`:

- **Por item:**
  - campo de quantidade (com `CampoQuantidade`, reaproveitado de `pedido-material/`);
  - "Corrigir nome/unidade";
  - "Substituir por…";
  - "Remover".
- **Ao final:** "+ Adicionar item".
- **Motivo:** obrigatório, com chips rápidos: "já temos em estoque", "duplicado", "correção de grafia/unidade", "sem fornecedor", "equivalente disponível" e "outro".
- **Pré-visualização:** duas listas, "Aplicado agora (ciência do solicitante)" e "Aguardará aceite do solicitante". É a mesma classificação do servidor, espelhada em `classificarAlteracao()` em `src/features/compras/utils/alteracoesLista.js`, com teste unitário.
- **Pedido em cotação enviada:** faixa "Este pedido está na cotação nº X, já enviada a N fornecedores". O botão principal vira "Aplicar e revisar cotação" e pede o novo prazo. Depois do sucesso, a tela navega para o detalhe da cotação, já no passo "avisar fornecedores".
- **Resultado:** toast com o resumo. Se houve aceite, o pedido mostra o selo "❓ Aguardando solicitante" e a conversa exibe os questionamentos criados, com o selo "Alteração da Compras" e o motivo.

**Lado do solicitante (Execução, ADMIN_EXECUCAO):**

- `QuestionamentosPedido.jsx` e `ModalConversaPedido.jsx` renderizam o tipo `adicao` ("➕ Adição de item: nome, qtd, un") e o selo `origem='alteracao_compras'`. Os botões Aprovar e Reprovar são os mesmos.
- `ListaHistorico.jsx` / `DetalheAlteracao.jsx` ganham rótulos para `alteracao_compras` ("✏️ Alteração da Compras") e `cotacao` ("🧾 Cotação"), com o diff de itens já existente.
- **Edição direta bloqueada:** o `PedidoMaterial` mostra a mensagem do trigger. O service já devolve `message`. Antes de abrir o formulário de edição, o front confere `cotacao_ativa` + envio:
  - `compras_detalhe_pedido.cotacoes` serve para ADMIN_EXECUCAO;
  - se o pedido estiver em cotação enviada, aparece "Em cotação com fornecedores: peça a alteração à Compras".
- **Notificação `compra_alteracao`:** abre o pedido na conversa. `destinoComprasDaNotificacao` com `isAdmin` usa `pagina:'pedido-material'`, `aba:'itens'`.

`statusCompra.js`: em `TIPOS_QUESTIONAMENTO`, adicionar `adicao: { rotulo: 'Adição', emoji: '➕' }`.

---

## 12. KPIs novos (`compras_indicadores_cotacao`)

| # | KPI | Definição (período = `decidido_em` ou `aberta_em` em [de, ate]) | Mínimo de dados |
|---|-----|------------------------------------------------------------------|-----------------|
| K1 | Economia obtida | `Σ (ref × qtd) − Σ (preco_vp × qtd)` nas linhas decididas com referência. Em R$ e em % sobre o total da referência. | ≥ 5 linhas com referência |
| K2 | Variação vs. referência | % das linhas decididas acima, abaixo e neutras (faixa neutra) | ≥ 5 linhas |
| K3 | Taxa de resposta | respondidos ÷ enviados (global, e por fornecedor em `por_fornecedor[]`) | ≥ 1 convite enviado |
| K4 | Ciclo da cotação | mediana de `aberta_em → 1ª resposta` e de `aberta_em → decidido_em`, em horas | ≥ 3 cotações |
| K5 | Abertas e vencendo | contagem de `aberta`, de prazo < 24 h e de 0 respostas (sem filtro de período) | — |
| K6 | Gasto por fornecedor e categoria | `Σ preco_nominal × qtd` por fornecedor e pela `categoria` do material. Concentração = % do maior fornecedor. | ≥ 1 decisão |
| K7 | Competitividade | por fornecedor: % das cotações em que foi o 1º do ranking (o `recomendacao_snapshot` guarda `vencedor_recomendado_fornecedor_id`) | ≥ 3 cotações |
| K8 | Alterações em listas | nº de questionamentos `origem='alteracao_compras'` e de históricos `alteracao_compras` por atendente; mediana do tempo até o aceite | ≥ 1 |
| K9 | Parcelado × à vista | % do gasto (nominal) por condição | ≥ 1 decisão |
| K10 | Itens mais caros | top 5 materiais com maior `Δ%` positivo vs. referência no período | ≥ 5 linhas |

Formato de retorno: `{k1:{valor, pct, suficiente}, ..., por_fornecedor:[{fornecedor_id, empresa, enviados, respondidos, taxa, vitorias, gasto}]}`.

Front: um componente novo, `IndicadoresCotacao.jsx`, renderizado abaixo de `IndicadoresCompras`, em lazy e só para quem acessa o módulo. Quando `suficiente=false`, mostra "dados insuficientes".

---

## 13. Impacto

### 13.1 Banco

| Objeto | Mudança | Migration |
|---|---|---|
| `execucao_notificacoes` CHECK tipo | + `compra_cotacao`, `compra_alteracao` | 34 |
| tabelas `compras_*` novas (§5) | criar + RLS + grants | 34, 35 |
| `execucao_pedidos_material` | triggers `trg_pedido_guarda_cotacao` e `..._delete` (sem coluna nova) | 35 |
| `compras_alterar_status` | bloqueios com cotação ativa + remoção ao cancelar | 36 |
| `compras_listar_pedidos`, `compras_detalhe_pedido` | campos `cotacao_ativa` / `cotacoes` e filtro `sem_cotacao` | 36 |
| `execucao_pedidos_questionamentos` | tipo `adicao` + 4 colunas | 38 |
| `compras_abrir_questionamento`, `compras_responder_questionamento` | `adicao` e origem | 38 |
| publicação `supabase_realtime` | + 3 tabelas | 35 |
| extensões | `pg_trgm` (se ausente, `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions`). `pgcrypto` precisa existir em `extensions` (padrão do Supabase) por causa de `gen_random_bytes`. | 34 |

**Pré-requisito:** migrations 32 e 33 aplicadas. _(Texto original, obsoleto: "A 33 consta como "não aplicada" no PLANO_MELHORIAS F.11".)_ A 33 foi aplicada em 2026-11-02 (Anexo A). As RPCs reescritas aqui partem da definição pós-33.

### 13.2 Front

| Área | Arquivos |
|---|---|
| Build/PWA/hosting | `vite.config.js`, `src/sw.js`, `cotacao/index.html` (novo), `public/_headers` (novo), `public/robots.txt` (novo) |
| Página pública | `src/cotacao-publica/**` (novo) |
| Helpers puros | `src/features/compras/utils/cotacao/{comparacao,moeda,normalizacao,mensagemWhatsapp,validacaoResposta}.js` (novos), `src/features/compras/utils/alteracoesLista.js` (novo) |
| Services | `src/services/supabase/comprasCotacao.js` (novo; mesmo padrão de `execucaoCompras.js`, com `wrapServiceWithImpersonationGuard`), `execucaoCompras.js` (+ `alterarItens`, `verificarAlertas`, `indicadoresCotacao`) |
| Módulo Compras | `ComprasModulo.jsx`, `ComprasHeader.jsx`, `navegacaoCompras.js`, `statusCompra.js`, `FilaCompras.jsx`, `CartaoPedidoCompras.jsx`, `DashboardCompras.jsx` (barra de seleção), `DetalhePedidoCompras.jsx` (+ alterar itens e cotações), `IndicadoresCompras.jsx` (inclui `IndicadoresCotacao`); novos: `components/cotacao/{CotacoesPagina,ListaCotacoes,NovaCotacao,PassoItens,PassoFornecedores,PassoPrazoMensagem,DetalheCotacao,PainelEnvio,RankingPropostas,MatrizComparativa,CombinacaoDividida,ModalDecisao,ModalRevisao,VersoesResposta}.jsx`, `components/fornecedores/{FornecedoresPagina,ModalFornecedor}.jsx`, `components/precos/{PrecosPagina,DetalheMaterial,SeletorMaterial,Sparkline}.jsx`, `components/config/ConfigComprasPagina.jsx`, `components/ModalAlterarItens.jsx`, `components/IndicadoresCotacao.jsx`, `hooks/useCotacao.js`, `hooks/useTokensSessao.js` |
| Execução (solicitante) | `pedido-material/QuestionamentosPedido.jsx`, `ModalConversaPedido.jsx`, `ListaHistorico.jsx`, `historico/DetalheAlteracao.jsx`, `PedidoMaterial.jsx` (aviso de bloqueio), `NotificacoesDropdown.jsx` (tipos novos) |
| Logout | `AuthContext.jsx`: no `logout`, limpar as chaves `sessionStorage` com prefixo `cmp:tokens:` |
| Testes | `scripts/testes-unitarios.mjs` (novos casos §15.1) |
| Contrato | `scripts/check-service-contract.mjs`: incluir o service novo, se o script exigir lista explícita |

---

## 14. Passo a passo (checklist)

> Formato: **ID · Agente**, seguido de arquivos, descrição e dependências (**Dep.**). Cada migration nova traz cabeçalho com objetivo, dependências e bloco `-- ROLLBACK:`, seguindo o padrão de `supabase/migrations/README.md`. É aplicada via MCP com o nome `execucao_<NN>_<tema>`.

### Onda 0: pré-requisitos

- [x] **B-00 · Backend.** _(medido em 2026-11-02 via MCP; resultado no Anexo A)_ Arquivos: `supabase/migrations/README.md`, `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md` (F.11).
  - Confirmar com `list_migrations` que a 32 e a 33 estão aplicadas. Se a 33 faltar, aplicá-la e registrar.
  - Rodar e anotar no Anexo A deste plano:
    - `SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname IN ('pgcrypto','pg_trgm','pg_cron')`;
    - `SELECT current_setting('request.headers', true)` numa chamada RPC de teste com anon. Basta uma função temporária que devolva o valor, removida em seguida. Objetivo: confirmar qual cabeçalho traz o IP.
  - **Dep.:** nenhuma.
- [ ] **N-00 · Negócio/Orquestrador.** Levar os defaults D1–D18 e as decisões N1–N6 ao dono. Divergências entram como ajustes na seção 2, sem bloquear as ondas 1–2. **Dep.:** nenhuma.

### Onda 1: banco base + helpers puros + especificação visual (em paralelo)

- [x] **B-01 · Backend.** _(arquivo escrito; estado anterior a 2026-11-02: NÃO aplicado; B-08 aplicou)_ Arquivo: `supabase/migrations/20261102_34_compras_fornecedores_catalogo.sql`.
  - Conteúdo:
    - `compras_config` (com seed da linha 1 e das mensagens do §10.3);
    - `compras_config_segredo` (com o pepper);
    - `compras_fornecedores`, `compras_materiais`, `compras_materiais_aliases`;
    - `compras_normalizar_nome`, `compras_normalizar_unidade`, `compras_normalizar_whatsapp`;
    - as RPCs do §7.1;
    - o CHECK de notificações;
    - `pg_trgm`, se disponível (bloco `DO` com `EXCEPTION` para não falhar).
  - RLS e grants conforme o §6.
  - **Dep.:** B-00.
- [x] **B-02 · Backend.** _(arquivo escrito; estado anterior a 2026-11-02: NÃO aplicado)_ Arquivo: `supabase/migrations/20261102_35_compras_cotacoes_base.sql`.
  - Conteúdo:
    - todas as tabelas dos §5.4–5.7;
    - os índices;
    - RLS e grants;
    - os triggers do §7.3;
    - a função `compras_valor_presente`;
    - a publicação Realtime.
  - **Dep.:** B-01.
- [x] **B-03 · Backend.** _(arquivo escrito; estado anterior a 2026-11-02: NÃO aplicado; reescritas a partir dos arquivos 25/26/28 + gate da 33, sem confronto com produção)_ Arquivo: `supabase/migrations/20261102_36_compras_cotacoes_rpcs.sql`.
  - Conteúdo:
    - as RPCs do §7.2;
    - `compras_precos_referencia`, `compras_material_historico`, `compras_verificar_alertas`;
    - a reescrita de `compras_alterar_status`, `compras_listar_pedidos` e `compras_detalhe_pedido`, partindo do `pg_get_functiondef` de produção.
  - Registrar no cabeçalho o diff em relação à definição anterior.
  - **Dep.:** B-02.
- [x] **B-04 · Backend.** _(arquivo escrito; estado anterior a 2026-11-02: NÃO aplicado)_ Arquivo: `supabase/migrations/20261102_37_compras_cotacao_publica.sql`.
  - Conteúdo:
    - os helpers do §7.4;
    - `cotacao_publica_obter` e `cotacao_publica_responder`;
    - `GRANT EXECUTE TO anon, authenticated` **só** para essas duas funções.
  - Incluir no topo do arquivo o bloco "**KILL SWITCH**": `REVOKE EXECUTE ON FUNCTION public.cotacao_publica_obter(text), public.cotacao_publica_responder(text, jsonb) FROM anon;`.
  - **Dep.:** B-03.
- [x] **B-05 · Backend.** _(Anexo C escrito; cobre 34–37)_ Escrever o **Anexo C (contrato final)** neste arquivo: assinaturas reais, formatos de retorno, códigos de erro e qualquer divergência em relação aos §5–7. **Dep.:** B-01..B-04.
- [x] **F-01 · Frontend.** Arquivos: `src/features/compras/utils/cotacao/comparacao.js`, `moeda.js`, `normalizacao.js`, `mensagemWhatsapp.js`, `validacaoResposta.js`.
  - Funções puras, sem import de React nem de Supabase:
    - `valorPresente`;
    - `totaisCondicao`;
    - `coberturaResposta`;
    - `rankingGlobal`;
    - `aplicarEmpate`;
    - `combinacaoDividida`;
    - `variacaoReferencia`;
    - `formatarBRL` / `parseBRL`;
    - `normalizarNome` / `normalizarUnidade`;
    - `montarMensagem(template, vars)`;
    - `urlWhatsapp(numero, texto)`;
    - `validarResposta(itens, resposta)`, que devolve `{ok, erros:[{campo, mensagem}]}` com os limites do §7.4.
  - Regras do §8.
  - **Dep.:** nenhuma (pode começar já).
- [x] **Q-01 · QA.** _(2026-11-01: `npm run test:unit` com 117 testes passando; conferir a cobertura completa do §15.1)_ Arquivo: `scripts/testes-unitarios.mjs`. Casos do §15.1 para os helpers do F-01. **Dep.:** F-01 (pode escrever os testes antes, em TDD).
- [x] **U-01 · UI/UX.** Escrever o **Anexo B** deste plano com:
  - a especificação visual da página pública (estados do §9.3, wireframe em texto, tokens de cor do tema claro, textos finais);
  - o assistente de nova cotação;
  - o painel de envio;
  - o comparativo (desktop e mobile);
  - o `ModalDecisao`;
  - o `ModalAlterarItens`.
  - Revisar os textos ao fornecedor (tom e clareza), sem expor dados internos.
  - **Dep.:** nenhuma.
- [x] **F-02 · Frontend.** Arquivos: `vite.config.js`, `src/sw.js`, `cotacao/index.html`, `public/_headers`, `public/robots.txt`, `src/cotacao-publica/main.jsx` (placeholder "Carregando cotação…").
  - Montar a entrada MPA (§9.1).
  - Rodar `npm run build` e confirmar:
    - `dist/cotacao/index.html` existe;
    - o grafo da entrada não importa `supabase`;
    - os assets de `cotacao` ficam fora de `sw.js` (`grep cotacao dist/sw.js` vazio).
  - **Dep.:** nenhuma.

### Onda 2: serviços + telas independentes

- [x] **F-03 · Frontend.** Arquivos: `src/services/supabase/comprasCotacao.js` (novo) e `execucaoCompras.js`.
  - Um método por RPC dos §7.1–7.6, no padrão `rpc(nome, params, rotulo)` do `execucaoCompras.js`. Envolver com `wrapServiceWithImpersonationGuard`. As leituras via tabela (fornecedores, materiais) usam `supabase.from(...).select()`.
  - Rodar `npm run check:contract`.
  - **Dep.:** B-05 (o front pode começar pelos §5–7 e ajustar ao Anexo C).
- [x] **F-04 · Frontend.** Arquivos: `src/cotacao-publica/{CotacaoPublica,api}.jsx|js` e `componentes/{CartaoItem,BlocoCondicoes,BlocoEntrega,RodapeResumo,EstadoMensagem}.jsx`, `cotacao-publica.css`.
  - Página pública completa, conforme o §9 e o Anexo B. Usa `validacaoResposta.js` e `moeda.js`.
  - Rascunho no `localStorage`, gravado só com o hash do token (`crypto.subtle.digest`).
  - **Dep.:** F-01, F-02, U-01, B-04 (para teste real; desenvolvimento com mock de `api.js`).
- [x] **F-05 · Frontend.** Arquivos: `ComprasModulo.jsx`, `ComprasHeader.jsx` e `navegacaoCompras.js` (§10.1). Seções em `lazy()`. A seção `config` só aparece para `isAdministrador(usuario)`. **Dep.:** nenhuma de banco.
- [x] **F-06 · Frontend.** Arquivos: `components/fornecedores/*` e `components/config/ConfigComprasPagina.jsx` (§10.6). **Dep.:** F-03, F-05, U-01.

### Onda 3: fluxo de cotação

- [x] **F-07 · Frontend.** Arquivos: `FilaCompras.jsx`, `CartaoPedidoCompras.jsx` e `DashboardCompras.jsx`.
  - Seleção múltipla, selo "Cotação nº X" e barra "Criar cotação" (§10.2, itens 1–2).
  - Usa `cotacao_ativa` de `compras_listar_pedidos`.
  - **Dep.:** B-03, F-03.
- [x] **F-08 · Frontend.** Arquivos: `components/cotacao/{NovaCotacao,PassoItens,PassoFornecedores,PassoPrazoMensagem}.jsx`, `components/precos/SeletorMaterial.jsx` e `hooks/useTokensSessao.js`. Assistente do §10.2. **Dep.:** F-06, F-07.
- [x] **F-09 · Frontend.** Arquivos: `components/cotacao/{CotacoesPagina,ListaCotacoes,DetalheCotacao,PainelEnvio,VersoesResposta,ModalRevisao}.jsx` e `hooks/useCotacao.js`.
  - Lista, detalhe com Realtime e envio WhatsApp (§10.3–10.4).
  - Prorrogar, revisar, incluir/remover pedido, cancelar.
  - **Dep.:** F-08.
- [x] **F-10 · Frontend.** Arquivos: `components/cotacao/{RankingPropostas,MatrizComparativa,CombinacaoDividida,ModalDecisao}.jsx` (§10.5). Usa os helpers do F-01. **Dep.:** F-09, Q-01 verde.
- [x] **F-11 · Frontend.** Arquivos: `navegacaoCompras.js`, `NotificacoesDropdown.jsx` e `AuthContext.jsx` (logout).
  - Tipos de notificação novos e destino `cotacao_id` (§10.4).
  - Limpeza de `cmp:tokens:*` no logout.
  - **Dep.:** F-09.

### Onda 4: alterações de lista, preços, KPIs

- [x] **B-06 · Backend.** _(escrita; aplicação na B-08)_ Arquivo: `supabase/migrations/20261102_38_compras_alteracoes_lista.sql`.
  - Conteúdo:
    - as colunas e o CHECK do §5.8;
    - `compras_somar_horas_uteis`;
    - a refatoração `execucao_compras_abrir_questionamento_interno`;
    - `compras_alterar_itens`;
    - a reescrita de `compras_abrir_questionamento` e de `compras_responder_questionamento` (com `adicao` e origem).
  - Atualizar o Anexo C.
  - **Dep.:** B-03.
- [x] **B-07 · Backend.** _(escrita; aplicação na B-08)_ Arquivo: `supabase/migrations/20261102_39_compras_indicadores_cotacao.sql`. `compras_indicadores_cotacao` (§12). Atualizar o Anexo C. **Dep.:** B-03.
- [x] **F-12 · Frontend.** Arquivos: `components/ModalAlterarItens.jsx`, `utils/alteracoesLista.js` e `DetalhePedidoCompras.jsx` (§11, lado Compras). **Dep.:** B-06, F-03, U-01.
- [x] **F-13 · Frontend.** Arquivos: `QuestionamentosPedido.jsx`, `ModalConversaPedido.jsx`, `ListaHistorico.jsx`, `DetalheAlteracao.jsx`, `PedidoMaterial.jsx` e `statusCompra.js` (§11, lado Execução). **Dep.:** B-06.
- [x] **F-14 · Frontend.** Arquivos: `components/precos/{PrecosPagina,DetalheMaterial,Sparkline}.jsx`. **Dep.:** F-03, B-03.
- [x] **F-15 · Frontend.** Arquivos: `components/IndicadoresCotacao.jsx` e `IndicadoresCompras.jsx`. **Dep.:** B-07, F-03.
- [~] **B-08 · Backend.** _(migrations 33–40 aplicadas em 2026-11-02, UTC; noite de 2026-11-01 em Brasília, via MCP. Pendentes: regenerar `supabase/schema/` e rodar `npm run graph:update`; definir `VITE_SUPABASE_*` no Netlify, ver *Status consolidado*)_ Aplicar 34→35→36→37 numa janela, depois 38 e 39 (ou as seis juntas, se o front das ondas 3–4 estiver pronto).
  - Rodar os advisors de segurança e performance via MCP e corrigir os achados.
  - Regenerar `supabase/schema/` (conforme `supabase/schema/README.md`) e rodar `npm run graph:update`.
  - Registrar a ordem real em `supabase/migrations/README.md`.
  - **Dep.:** B-01..B-07 revisados por QA (Q-02).
- [ ] **B-09 · Backend (opcional).** Se `pg_cron` existir: `SELECT cron.schedule('compras-alertas','*/15 * * * *', $$SELECT public.compras_verificar_alertas()$$)`. A chamada pelo front continua (idempotente). Habilitar `pg_cron` **não agenda sozinho**: o bloco `DO` da migration 37 só roda na aplicação e não é reexecutado. Em 2026-11-02 `pg_cron` não estava habilitado, então nada foi agendado. O agendamento é manual: o comando acima para `compras_verificar_alertas()` e, para a limpeza, `cron.schedule('compras-limpeza-publica', '30 6 * * *', 'SELECT public.compras_limpeza_publica()')` (horário definido na migration 37). **Dep.:** B-08.

### Onda 5: qualidade, desempenho e documentação

- [ ] **Q-02 · QA.** Revisão das migrations antes de aplicar:
  - `REVOKE ... FROM PUBLIC, anon` presente em **toda** função nova;
  - nenhuma policy para anon;
  - as funções públicas não usam `RAISE` em erro de negócio;
  - todo bloco `ROLLBACK` está completo.
  - **Dep.:** B-01..B-07.
  - **Resultado Q-02 (migrations 34–37, revisão estática, 2026-11-02; sem banco; 38 e 39 fora do escopo):** veredito **APROVADO COM RESSALVAS** (podem ir para B-08 depois dos itens "antes de aplicar").
    - **Método:** leitura integral dos 4 arquivos + comparação com 24/25/26/28/33; parser real do PostgreSQL (`pglast`/libpg_query, venv em /tmp) em todas as instruções e em todos os corpos plpgsql; reimplementação de `compras_valor_presente`/`compras_condicao_totais` em `Decimal` contra `valorPresente()` (JS). Parser valida **sintaxe**, não nomes de coluna nem comportamento: B-08 ainda precisa de smoke test real.
    - **Corrigido nos arquivos (comentado no cabeçalho de cada um):**
      1. 🔴 **37:** 4× `IF CASE WHEN … THEN … END … THEN` (3 em `compras_cotacao_validar_resposta`, 1 em `cotacao_publica_responder`). O plpgsql fecha a condição no 1º `THEN`, então a 37 falharia com "syntax error at end of input" e **nenhuma** RPC pública seria criada. Resolvido com parênteses (parser confirma).
      2. 🔴 **34:** `compras_fornecedor_anonimizar` gravava `whatsapp = '550000000000'`, que viola o CHECK `^55[1-9][0-9]{9,10}$`; a anonimização (LGPD, CA5) sempre falharia. Agora `'551100000000'`.
      3. 🟠 **37:** `cotacao_publica_obter/responder` sem `EXCEPTION`: erro inesperado (ex.: estouro `numeric(14,2)`, unique de versão concorrente) desfazia a transação **inteira, inclusive os contadores de rate limit** (sondagem grátis), e devolvia a mensagem SQL ao anon. Agora o corpo pós-rate-limit é um sub-bloco com `EXCEPTION WHEN OTHERS` → `{ok:false, codigo:'ERRO_INTERNO'}` + `RAISE LOG`. **Contrato novo: o front público deve mapear `ERRO_INTERNO` (texto genérico "tente novamente").**
      4. 🟠 **37:** `responder` travava convite (FOR UPDATE) e só depois lia a cotação sem lock: risco de deadlock com `revisar` (cotação→convite) e de resposta gravada durante `decidir`/`cancelar`. Agora cotação `FOR SHARE` → convite `FOR UPDATE`.
      5. 🟡 **37:** `validar_resposta` sem teto de total (preço ≤ 1e9 × qtd até 1e11 estourava `numeric(14,2)`); incluído teto de R$ 1.000.000.000 com `DADOS_INVALIDOS`.
    - **Checklist do Q-02:** `REVOKE … FROM PUBLIC, anon` em **toda** função nova: ✅ (34: 13; 35: 3; 36: 32 funções incl. helpers revogados também de `authenticated`; 37: helpers revogados de anon/authenticated). Única exceção com `GRANT … TO anon`: `cotacao_publica_obter(text)` e `cotacao_publica_responder(text, jsonb)` ✅. Nenhuma policy `TO anon`/`PUBLIC` ✅ (todas `FOR SELECT TO authenticated USING ((SELECT is_compras()))`; `compras_cotacao_tokens`, `compras_rate_limit`, `compras_config_segredo` com RLS ligada, **sem policy** e `REVOKE ALL` de anon/authenticated ✅). Funções públicas não usam `RAISE` em erro de negócio ✅ (só `ERRO_INTERNO` inesperado, agora também sem `RAISE`). Blocos `ROLLBACK` completos ✅ (35 e 36 conferidos função a função; 36 exige reaplicar 25+33/26/28).
    - **Segurança do link público (§15.2):** token 256 bits (`gen_random_bytes(32)`, 43 chars base64url), só o `sha256` é gravado; lookup por PK do hash (sem comparação do segredo em claro; timing inócuo) ✅; 1 token vivo por convite (índice parcial) ✅; revogação em lembrete/novo link/encerrar/cancelar/anonimizar ✅; `LINK_INVALIDO`/`LINK_SUBSTITUIDO`/encerrada só aparecem para hash existente (sem enumeração) ✅; rate limit por IP (hash com pepper), por token e global, contadores commitam porque erros de negócio retornam `jsonb` ✅ (e agora também em exceção); expiração: `prazo_encerrado` no `obter`, `PRAZO_ENCERRADO` no `responder` ✅; payload ≤ 200 KB, observações 1000/200, preço ≤4 casas, qtd ≤3, frete/prazo/parcelas/entrada/desconto validados, itens = exatamente as linhas ativas, UUID por regex ✅; reenvio gera `versao` nova (limite 20) com `atual` único ✅; `LISTA_ALTERADA` se `versao_lista` difere ✅; após `encerrada/cancelada` token revogado + checagem de status ✅. **Dados expostos ao anon:** número da cotação, prazo, observação pública/região, `nome_empresa_publico`, nome/empresa do próprio fornecedor, linhas (descrição, unidade, qtd, observação pública) e a própria resposta. Nada de pedido/obra/cliente/endereço/solicitante/urgência/WhatsApp/taxa/referência de preço ✅.
    - **RLS/papéis:** 0 linhas para ADMIN_EXECUCAO/TECNICO/anon em todas as tabelas novas; RPCs de cotação exigem `is_compras()` (COMPRAS e Administrador); `compras_config_salvar` e `compras_fornecedor_anonimizar` só Administrador ✅. Realtime: 3 tabelas na publicação, eventos respeitam RLS ✅ (linhas de `respostas` trazem `ip_hash`/`user_agent`, só para COMPRAS).
    - **Reescritas (25/26/28/33 × 36):** `compras_alterar_status` = 25 + gate `is_compras()` (33) + bloqueios por cotação + remoção ao cancelar; nenhuma outra linha mudou ✅. `compras_listar_pedidos` = 26 + `cotacao_ativa` + filtro `sem_cotacao`; gate `pode_ver_compras()` mantido; `DROP`+`CREATE`+`GRANT` presentes; nada depende do tipo (o front usa só via RPC) ✅. `compras_detalhe_pedido` = 28 + chave `cotacoes`; continua chamando `compras_listar_pedidos` (ADMIN_EXECUCAO passa em `pode_ver_compras()`), então o PedidoMaterial **não quebra** (só ganham as chaves novas `cotacao_ativa` e `cotacoes`). Triggers de guarda: aceitam `execucao.compras_rpc` (25/38) e `compras.cotacao_rpc`; ignoram diferença só de `id` dos itens; em cotação enviada sem flag → exceção com a mensagem do §7.3; em rascunho marcam `requer_revisao` ✅.
    - **VP-PAR (SQL × JS):** 9 casos (VP-01..04, total informado + entrada + 1ª em 45 d, à vista por valor, 7,333 %, 24× com 1ª em 180 d, 1ª parcela default) → |Δ| = 0,00 em todos (tolerância 0,01). Valores: VP-02 = 970,73; VP-03 = 993,35. Diferenças de implementação (sem efeito prático): SQL arredonda `T` a 2 casas **antes** do VP e `entrada` é limitada a `[0, T]` (JS não); `taxa` nula = 0 nos dois. **Pendente B-08:** rodar a mesma entrada em `compras_valor_presente` real via MCP (script: `/tmp/qa_vp_par.mjs`; fixture é o VP-02).
    - **Pendências (não corrigidas), por severidade:**
      - 🟠 **Média — IP spoofável:** `compras_request_ip` cai em `x-real-ip`/`x-forwarded-for` (1º valor) se `cf-connecting-ip` faltar. Atrás do Cloudflare do Supabase é seguro; confirmar em B-08 que o header chega, senão o limite por IP é contornável (ficam token e global).
      - 🟠 **Média — disjuntor global consumível por anônimo:** `gl:resp` (600/h) e `tk:*` são consumidos **antes** de validar o token; quem enviar 600 requisições (30/10 min por IP, ilimitado se o IP for forjado) bloqueia todos os fornecedores por 1 h, e cada token inventado cria uma linha em `compras_rate_limit`. Sugestão (B-08/B-06): consumir `gl:resp` e `tk:*` só depois do lookup do hash (token existente); manter IP antes. A limpeza (2 dias) só roda em `compras_verificar_alertas`/`abrir` — agendar pg_cron (B-09).
      - 🟡 **Baixa — `compras_material_salvar`** permite trocar a unidade de material com histórico de preço (corrompe a média); bloquear se houver `compras_precos_historico`.
      - 🟡 **Baixa — `compras_cotacao_origens_atuais`** lê quantidade como número com ponto decimal; texto pt-BR "1.000" viraria 1 (hoje o front grava número JSON, então sem efeito).
      - 🟡 **Baixa — exposição a ADMIN_EXECUCAO:** `cotacao_ativa`/`cotacoes` mostram id, número e status da cotação (previsto no plano §963–968; nenhum preço/fornecedor).
      - 🟡 **Baixa — fornecedor inativado** depois de convidado ainda responde (intencional); respostas livres (`observacao`) não são limpas na anonimização.
      - ℹ️ `compras_cotacao_abrir` não revalida que os fornecedores ainda estão ativos; `compras_cotacao_montar_itens` devolve erro cru (`22P02`) para UUID malformado (só COMPRAS).
    - **Antes de aplicar (B-08):** (a) aplicar 34→37 em sequência; (b) `extensions.gen_random_bytes` precisa existir (B-00); (c) comparar `pg_get_functiondef` de produção de `compras_alterar_status`/`compras_listar_pedidos`/`compras_detalhe_pedido` com 25/26/28+33; (d) rodar `get_advisors`, `has_function_privilege('anon', …)` (esperado `true` só para as 2 públicas) e o VP-PAR real; (e) avisar o Frontend do código `ERRO_INTERNO`; (f) smoke test de `obter`/`responder` com token válido e inválido, e a anonimização (para fechar o que o parser não cobre).
  - **Resultado Q-02 parte 2 (Q-02b + migrations 38 e 39; revisão estática, 2026-11-02, sem banco):** veredito **APROVADO COM RESSALVAS** para a B-08 (lote 34→39 completo, nessa ordem; ver "Antes de aplicar" abaixo).
    - **Método:** leitura integral dos trechos Q-02b (34/36/37) e de 38 e 39; comparação linha a linha com 25 (abrir/responder), 28 (listar_questionamentos), 33 e 36; conferência de colunas/CHECKs contra 25/34/35; `pglast` (venv /tmp) em 34–39: sintaxe SQL e plpgsql OK (as 2 funções de trigger da 35 falham em **qualquer** trigger plpgsql no `parse_plpgsql` do pglast, inclusive um `BEGIN RETURN NEW; END` mínimo: limitação da ferramenta, não da migration).
    - **Q-02b (34/36/37) — aprovado:** rate limit `tk:*`/`gl:resp` só depois de achar o hash (token inventado só consome o limite por IP e não cria linha) ✅; `compras_limpeza_publica()` sem grant + `DO` condicional por `pg_extension` com `EXCEPTION` (não quebra sem `pg_cron`; `cron.schedule` com mesmo nome é idempotente) ✅; troca de unidade bloqueada com histórico de preço (`FOR UPDATE`, exceção fora do handler `unique_violation`) ✅; anonimização zera `observacao` de respostas/itens (sem trigger que bloqueie; `ip_hash`/`user_agent` das respostas e `ip` dos eventos continuam, sai em 12 meses) ✅; `abrir` revalida fornecedores ativos/não anonimizados antes do `UPDATE` ✅; `montar_itens` valida UUID/quantidade antes dos casts (regex de quantidade = `compras_parse_quantidade`) ✅.
    - **38/39 — grants/RLS:** `compras_alterar_itens` (`compras_exigir_compras`) e `compras_indicadores_cotacao` (idem) só COMPRAS/Administrador; `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated` para as 4 funções públicas da 38 e para a 39; helpers (`compras_somar_horas_uteis`, `compras_parse_quantidade`, `…_interno`) revogados de todos ✅. `compras_listar_questionamentos` = 28 + 3 colunas no fim, com `DROP`+`CREATE`+`GRANT` (gate `pode_ver_compras()` mantido) ✅; `compras_responder_questionamento` = 25 + ramo `adicao` + tipo de histórico por origem (regra do solicitante/`is_admin_execucao()` idêntica; **ADMIN_EXECUCAO continua respondendo**; sem gate novo) ✅; `compras_abrir_questionamento` mantém assinatura/`is_compras()` e delega ao `_interno` ✅. O front lê por nome de campo (`execucaoCompras.js`) e `compras_detalhe_pedido` usa `to_jsonb(q)`: colunas novas só somam ✅. RLS de `execucao_pedidos_questionamentos` inalterada (`pode_ver_compras()`).
    - **38 — regras:** ciência × aceite igual ao D13/§7.5 (qtd ↓, remover, corrigir ≈ → ciência; qtd ↑, substituir, adicionar → aceite; corrigir com nome/unidade diferente rejeita) ✅; item com questionamento aberto e item repetido na chamada rejeitados ✅; lista vazia rejeitada ✅; cotação enviada exige `novo_prazo` e chama `compras_cotacao_revisar` só se houve ciência (aceite liga `requer_revisao` ao aprovar) ✅; flag `execucao.compras_rpc` evita o bloqueio do trigger da 35 e o aviso "pedido editado" ✅; histórico `alteracao_compras` + notificações `compra_alteracao` (ciência), `compra_questionamento` (aceite) e `compra_resposta` (ao atendente, na resposta) ✅; CHECK de notificações tem os tipos novos (34) e `execucao_historico_pedidos.tipo_alteracao` não tem CHECK ✅; `compras_somar_horas_uteis` (24 h = 1 dia útil seg–sex, pula feriado nacional, fuso America/Sao_Paulo, sem DST hoje; resto < 24 h em horas corridas) ✅.
    - **39 — KPIs:** todo divisor protegido (`CASE WHEN … > 0`, `ref > 0`, `HAVING` garante `tot_ref`/`qtd` > 0 em K10); sem dados → `valor 0`/`pct null`/`suficiente false`; colunas/CHECKs referenciados existem (35/34/38); período em fuso de São Paulo, máx. 5 anos ✅.
    - **Corrigido nos arquivos (comentado no cabeçalho):** 🟡 **38:** `compras_alterar_itens` (redução de quantidade em un/cx/pct): o `ceil()` podia igualar a quantidade antiga e gravar uma "ciência" 5 → 5 (histórico + notificação sem mudança); agora rejeita ("já é …: informe um valor menor").
    - **Pendências (não corrigidas), por severidade:**
      - 🟠 **Média — K7 depende de chave que ninguém grava:** a 39 lê `recomendacao_snapshot->>'vencedor_recomendado_fornecedor_id'`, mas `compras_cotacao_decidir` só repassa o `recomendacao_snapshot` enviado pelo front (`comprasCotacao.js`) e nenhum código atual produz essa chave → vitórias/`taxa_vitoria` ficariam 0 (e `k7.suficiente=false`). **Frontend (F-xx da decisão)** deve incluir `vencedor_recomendado_fornecedor_id` no snapshot, ou K7 passa a ser derivado no banco.
      - 🟠 **Média — fallback de IP (37):** `compras_request_ip` usa o **último** item de `x-forwarded-for` quando falta `cf-connecting-ip`; se a cadeia terminar num IP de infraestrutura, todos os fornecedores caem no mesmo balde (30/10 min) e passam a receber `MUITAS_TENTATIVAS` (Jev: 0,88 de probabilidade). **B-08:** rodar o diagnóstico B-00 e confirmar que `cf-connecting-ip` chega ao PostgREST; senão ajustar o N-ésimo item.
      - 🟠 **Média — Frontend/notificações:** `TIPOS_NOTIFICACAO_COMPRAS` (`navegacaoCompras.js`) e o `NotificacoesDropdown` não conhecem `compra_alteracao`/`compra_cotacao` (ícone/rota ausentes); `ListaHistorico.jsx` não tem rótulo para `alteracao_compras` (não quebra: renderiza sem badge e sem diff de itens, pois `TIPOS_COM_ITENS` não o inclui). Direcionar ao Frontend.
      - 🟡 **Baixa:** `compras_verificar_alertas` escreve "24 h úteis" fixo na mensagem do alerta (o prazo é configurável); `compras_somar_horas_uteis` com prazo < 24 h não pula fim de semana/feriado; aumento de quantidade em un/cx/pct com valor fracionário mostra "de 4 para 4,5" mas a aprovação arredonda para 5; `p_revisar_cotacao.novo_prazo` é exigido mesmo quando só há alterações de aceite; K7 não lista fornecedor que só participou (sem convite no período e sem vitória); `alteracao_compras` aprovado pelo solicitante também grava histórico desse tipo (K8 já filtra pela descrição); anonimização não limpa `ip_hash`/`user_agent` das respostas.
    - **Antes de aplicar (B-08) — acréscimos:** (a) ordem **34→35→36→37→38→39** (36 chama `compras_cotacao_revisar` só a partir da 38; `compras_verificar_alertas` já ignora as colunas da 38 se ausentes); (b) comparar `pg_get_functiondef` de produção de `compras_abrir_questionamento`, `compras_responder_questionamento` e `compras_listar_questionamentos` com 25/28+33 (a 38 não foi comparada com produção); (c) smoke test como ADMIN_EXECUCAO: `compras_responder_questionamento` OK, `compras_listar_questionamentos` OK, `compras_alterar_itens` e `compras_indicadores_cotacao` → "Sem permissão"; (d) testar `alterar_itens` em pedido com cotação rascunho/enviada, e aprovação de `adicao` pelo solicitante; (e) `has_function_privilege('anon', …)` falso para as funções da 38/39; (f) conferir `SELECT cron.job` após a 37.
- [ ] **Q-03 · QA.** Executar o §15.2 a §15.5 em produção (o §15.6 é desempenho, coberto por P-01 e P-02) (com dados de teste marcados `[TESTE]`) e/ou num branch do Supabase, se disponível. **Dep.:** B-08, F-04..F-15.
- [~] **P-01 · Performance.** *(medição sem banco feita em 2026-11-02; Lighthouse pendente)*
  - **Resultado (`npm run build`, gzip -9):** entrada pública `cotacao` = JS 11,0 kB + `react` 58,6 + `moeda` 0,6 + `adaptadores` 0,75 + polyfill 0,4 + CSS 2,0 ≈ **73 kB** (orçamento ≤ 120 kB ✔). Sem `supabase-js` (chunk `supabase` 34,4 kB não é referenciado em `dist/cotacao/index.html`; a API pública usa `fetch` direto) e sem app logado.
  - **Lazy ✔:** `ComprasModulo` (App.jsx, 4,15 kB gz) → `DashboardCompras` 19,2, `CotacoesPagina`, `FornecedoresPagina` 3,6, `PrecosPagina` 4,4, `ConfigComprasPagina` 3,5, `NovaCotacao` 7,5, `IndicadoresCotacao` 2,0, modais de decisão/revisão. Chunk inicial `main` (65,9 kB gz): 0 ocorrências de `compras_cotacao`/`compras_precos`/`CombinacaoDividida` → nada novo no inicial. `echarts`/`zrender` ausentes dos chunks de Compras ✔.
  - **Sem baseline:** não foi gerado build do commit anterior; o acréscimo de ≤ 10 kB do chunk inicial de Compras não é comparável (o chunk `ComprasModulo` inteiro tem 4,15 kB gz).
  - **Pendente:** Lighthouse mobile (LCP/CLS) da página pública.
- [~] **P-02 · Performance.** *(parte sem banco feita em 2026-11-02; EXPLAIN após B-08 pendente)*
  - **Benchmark `combinacaoDividida`** (Node, esbuild do `comparacao.js`, dados sintéticos, mediana de 7 execuções após aquecimento): M=4/N=50 0,1 ms; M=8/N=200 1,6 ms; M=10/N=200 5,1 ms; **M=12/N=200 5,8 ms (máx. 19 ms)**; M=12/N=500 15 ms; M=13/N=200 guloso 0,7 ms; M=20/N=200 guloso 1,6 ms. Meta < 150 ms ✔ (folga ≈ 25×; mesmo 4× pior caso de cobertura esparsa fica < 100 ms em N=200). Celular médio ≈ 4–6× mais lento que o Node de desenvolvimento → ≈ 35 ms.
  - **Realtime (revisão):** 1 canal por detalhe (`useAtualizacaoTabelas`, 3 tabelas, sem filtro por `cotacao_id`; o filtro é no cliente em `aoEvento`); debounce 500 ms com espera máx. 3 s; polling de reforço (30 s) só com Realtime desconectado e aba visível/online; cleanup completo (canal, listener de auth, timers). `assinarCotacao` em `comprasCotacao.js` não tem uso (código morto, 1 canal extra se usado) — manter fora das telas. Alertas: `compras_verificar_alertas` ao montar + a cada 15 min só com `visibilityState !== 'hidden'`, com cleanup ✔. `calcularComparativo` já em `useMemo`. Nenhuma correção no front foi necessária.
  - **Índices 34–39 (revisão):** todas as FKs estão cobertas por PK/UNIQUE/índice; consultas principais (`cotacao_ativa` via `uq_compras_cotacao_pedidos_ativa`, detalhe por `cotacao_id`, preços por `(material_id,tipo,registrado_em DESC)`, trigram em materiais, tokens por PK `token_hash`) OK. Faltavam só os filtros de período do K-indicadores (39): criada **`20261102_40_compras_cotacao_indices.sql`** (`compras_cotacoes(aberta_em)` parcial e `compras_cotacao_decisoes(decidido_em)`), pglast OK; _(texto original, obsoleto: "**não aplicada** (B-08/orquestrador)")_ **aplicada em 2026-11-02**, no lote 33–40.
  - **Pendente:** `EXPLAIN ANALYZE` de `compras_cotacao_detalhe`, `compras_precos_referencia` (500 materiais), `compras_listar_pedidos`, `compras_indicadores_cotacao` após B-08.
- [ ] **D-01 · Documentação.** Itens do §17. **Dep.:** Q-03. _(Parcial, 2026-11-01: `README.md`, `.github/copilot-instructions.md` e `supabase/migrations/README.md` atualizados. Pendentes: nota F.12, Anexo D e snapshot após B-08.)_

---

## 15. Plano de testes (QA)

### 15.1 Unitários (`npm run test:unit`)

| ID | Caso | Esperado |
|---|---|---|
| VP-01 | à vista 1.000, desconto 5% | VP = 950,00 |
| VP-02 | parcelado 3x 1.000, sem entrada, 1ª em 30 d, i=1,5% | VP = 333,33/1,015 + 333,33/1,015² + 333,34/1,015³ ≈ 970,73 (tolerância 0,01) |
| VP-03 | parcelado com entrada 100, 2x, 1ª em 0 d | entrada + parcela em d0 + parcela em d30 |
| VP-04 | taxa 0 | VP = nominal |
| VP-PAR | mesma entrada do VP-02 em `compras_valor_presente` (SQL) | igual ao JS ± 0,01 (QA executa via MCP) |
| RK-01 | 3 completas: 1000, 1005, 1100, empate 1% | 1º e 2º em empate técnico; desempate pelo prazo |
| RK-02 | completa 1200 × parcial 900 | completa vence; parcial com "cobre X de Y" |
| RK-03 | só parciais | "Melhor parcial" = maior cobertura |
| RK-04 | desempate em cascata (mesmo prazo → CIF → compras anteriores → `respondido_em`) | ordem correta |
| DV-01 | A barato no item 1, B barato no item 2, fretes 0 | divisão A+B, economia > 0 |
| DV-02 | igual ao DV-01, mas com frete de B maior que o ganho | divisão não mostrada (único melhor) |
| DV-03 | nenhum único completo, A∪B cobre tudo | mostra "única forma de cobrir tudo" |
| DV-04 | M=13 | usa a heurística gulosa sem estourar o tempo |
| CB-01 | `quantidade_disponivel` < pedida | linha não atendida para completude |
| CB-02 | resposta na lista v1, linha alterada na v2 | linha "não cotada" e selo "lista v1" |
| VR-01 | ref 10,00, preço 11,30 | +1,30 / +13,0%, vermelho, alerta (> 10%) |
| VR-02 | ref 10,00, preço 10,15 | cinza (dentro de ±2%) |
| VR-03 | sem referência | "primeiro registro" |
| NM-01 | "Cabo  Flexível 2,5mm" / "cabo flexivel 2,5mm" | mesmo normalizado; tabela de unidades igual ao SQL (lista fixa) |
| MS-01 | `montarMensagem` com todos os placeholders; `urlWhatsapp` codifica `#`, `&` e acentos | URL válida |
| VL-01..10 | `validarResposta`: preço 0, negativo, 5 casas, vazio com "tenho", sem condição, 2 condições do mesmo tipo, parcelas 25, prazo ausente, frete ausente, observação com 1001 caracteres | erro no campo certo |
| AL-01 | `classificarAlteracao`: qtd ↓ ciência, qtd ↑ aceite, remover ciência, substituir aceite, adicionar aceite, corrigir com nome muito diferente → rejeitar | conforme D13 |

### 15.2 Banco e RLS (SQL via MCP, com papéis simulados por `set_config('request.jwt.claims', ...)` ou com usuários de teste reais)

1. **anon:**
   - `SELECT` em cada tabela `compras_*` responde permissão negada ou 0 linhas;
   - `POST /rest/v1/rpc/compras_cotacao_detalhe` sem JWT responde 401/permissão negada;
   - o mesmo para **todas** as RPCs não públicas. Gerar a lista com `SELECT proname FROM pg_proc WHERE proname LIKE 'compras_%' AND has_function_privilege('anon', oid, 'EXECUTE')`, que precisa voltar **só** com as duas públicas (que começam por `cotacao_publica_`).
2. **TECNICO e ADMIN_EXECUCAO:** 0 linhas em todas as tabelas novas e "Sem permissão" nas RPCs de cotação.
3. **COMPRAS:** CRUD de fornecedor, criação de cotação e as demais RPCs funcionam. `compras_config_salvar` responde "Sem permissão".
4. **Administrador:** tudo, inclusive config e anonimização.
5. **Unicidade:** o mesmo pedido em duas cotações ativas falha pelo índice único parcial.
6. **`compras_alterar_status`** em pedido com cotação ativa: `em_cotacao → comprado` é bloqueado, `→ cancelado` passa e remove o pedido da cotação.
7. **Trigger de guarda:** edição direta de itens (como ADMIN_EXECUCAO, via `atualizarPedidoMaterial`) em cotação enviada é bloqueada com a mensagem. Em `rascunho`, passa e marca `requer_revisao`.
8. **`tokens` / `rate_limit` / `config_segredo`:** sem leitura nem por COMPRAS.

### 15.3 Segurança do link público (obrigatório antes de liberar)

| ID | Teste | Esperado |
|---|---|---|
| S-01 | Token com formato errado (42 caracteres, caractere `+`, vazio, 10 KB) | `LINK_INVALIDO`, sem erro 500 e sem stack |
| S-02 | Token válido no formato, mas inexistente | `LINK_INVALIDO` (mesma resposta do S-01, sem dizer qual parte falhou) |
| S-03 | 130 chamadas de `obter` em 10 min do mesmo IP | a partir da 121ª, `MUITAS_TENTATIVAS`, e o contador persiste (não foi desfeito) |
| S-04 | 11 respostas em 10 min com o mesmo token | a 11ª devolve `MUITAS_TENTATIVAS` |
| S-05 | Token do fornecedor A tentando gravar `itens[].id` de outra cotação | `DADOS_INVALIDOS`, sem gravar nada |
| S-06 | Resposta depois do prazo | `PRAZO_ENCERRADO`; `obter` devolve estado `prazo_encerrado` só leitura |
| S-07 | Depois de decidir ou cancelar | `obter` devolve `{estado:'encerrada'}` **sem** itens |
| S-08 | Token antigo depois do lembrete | `LINK_SUBSTITUIDO`; o novo funciona |
| S-09 | Resposta de `obter` (inspecionar o JSON) | nenhuma chave com cliente, obra, endereço, solicitante, urgência, `pedido_id`, outro fornecedor, preço de referência ou WhatsApp |
| S-10 | XSS: observação e marca com `<img src=x onerror=alert(1)>` | aparece como texto na página pública e no módulo; nenhum `dangerouslySetInnerHTML` (grep) |
| S-11 | Injeção: `preco_unitario: "1; DROP TABLE"`, `itens` como objeto, `condicoes` com 50 itens, jsonb de 300 KB | `DADOS_INVALIDOS` / `PAYLOAD_GRANDE` |
| S-12 | `curl -I https://.../cotacao/` | `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, CSP presente |
| S-13 | Logs do Netlify / aba Rede | o token não aparece em nenhuma URL requisitada (só no corpo do POST para o Supabase) |
| S-14 | Colar o link no WhatsApp (prévia) | a prévia não contém dados da cotação, e o convite **não** muda para `visualizado` por causa da prévia |
| S-15 | Kill switch `link_publico_ativo=false` | `INDISPONIVEL` nas duas funções, e o módulo autenticado continua funcionando |
| S-16 | Banco: `compras_cotacao_tokens` | só `token_hash` (bytea); nenhum token em claro em nenhuma tabela, evento ou log (`grep` nos eventos) |
| S-17 | Realtime anon | inscrição em `compras_cotacao_respostas` com a anon key não recebe eventos |
| S-18 | Navegador da equipe com SW registrado (abriu Execução antes) abre `/cotacao/#...` offline | não serve o app autenticado; mostra o erro de rede do navegador ou a página de erro da cotação |

### 15.4 Fluxo ponta a ponta (manual, celular + desktop)

1. **Criação:** criar 2 fornecedores de teste (os próprios WhatsApps da equipe). Selecionar 2 pedidos `[TESTE]` com um item repetido (mesmo nome e unidade). A cotação deve aparecer com o item somado e a composição correta. Os pedidos devem estar em `em_cotacao`, com histórico.
2. **Envio:** abrir a cotação (48 h) e enviar pelo WhatsApp a partir do desktop e do celular:
   - a mensagem chega com o link clicável, inclusive o `#`;
   - o status fica `enviado`.
3. **Resposta do fornecedor A:** abrir no celular. O status vira `visualizado` no painel em ≤ 5 s. Responder com à vista + parcelado 3x, frete CIF e prazo de 2 dias. O painel atualiza em ≤ 5 s e chega a notificação `compra_cotacao`.
4. **Resposta do fornecedor B:** "não tenho" em 1 item e preço menor nos demais. O comparativo deve mostrar:
   - A como melhor completo;
   - B com "cobre X de Y";
   - a divisão com a economia, se houver.
5. **Nova versão:** o fornecedor A reenvia com preço menor. A versão 2 aparece em "ver versões", com o diff de preço.
6. **Lembrete:** enviar lembrete para B. O link antigo dá "substituído" e o novo funciona.
7. **Revisão:** o solicitante (ADMIN_EXECUCAO) tenta editar itens do pedido e é bloqueado. A Compras usa "Alterar itens → reduzir qtd → Aplicar e revisar cotação". Resultado esperado:
   - `versao_lista=2`;
   - A e B com "precisa reconfirmar";
   - a página pública mostra o aviso e o selo "alterado";
   - a decisão fica bloqueada até que `requer_revisao` seja falso (já é falso depois da revisão, só há o aviso das reconfirmações).
8. **Decisão:** decidir pelo modo "dividido". Conferir:
   - pedidos em `comprado`;
   - etapa "📦 Chegada dos Materiais" criada;
   - histórico "Cotação nº X decidida" **sem preço**;
   - notificação ao solicitante;
   - `compras_precos_historico` com as linhas `comprado` e `cotado`;
   - links das duas empresas em "encerrada".
9. **Referência de preços:** criar uma 2ª cotação com o mesmo material. O comparativo mostra a variação vs. a média e o alerta, se for > 10%.
10. **Alteração com aceite:** adicionar item. O questionamento `adicao` é criado e o pedido fica `aguardando_solicitante`. O solicitante aprova, o item entra na lista e o histórico registra `alteracao_compras`.
11. **Aceite atrasado:** ajustar `prazo_resposta_em` para o passado via SQL e abrir o módulo. A notificação de alerta chega uma única vez para a atendente e os gestores. O questionamento continua `aberto` (não foi aprovado).
12. **Cancelamento:** cancelar uma cotação. Os pedidos voltam para `aguardando_compra` e os links ficam "encerrada".
13. **Fornecedores:** excluir fornecedor com convite é bloqueado; inativar funciona. A anonimização (Administrador) mantém o histórico e o link desse fornecedor dá "encerrada".

### 15.5 Regressão

- `npm run lint`, `npm run build`, `npm run test:unit` e `npm run check:contract` passam.
- O fluxo antigo continua funcionando:
  - assumir pedido;
  - questionamento de dúvida, quantidade e substituição;
  - `comprado` manual em pedido **sem** cotação;
  - entrega parcial e total;
  - KPIs antigos.
- Login, `/reset-password`, Dashboard Comercial e Execução (Meu Dia offline, PWA instalado) sem mudança. O SW novo é publicado e o app continua abrindo offline.
- Perfil COMPRAS continua preso ao módulo Compras (`App.jsx`). `#/compras/cotacoes` digitado por ADMIN_EXECUCAO volta para `#/execucao`.

### 15.6 Desempenho

Ver P-01 e P-02 (as metas estão no §14).

---

## 16. Riscos e rollback

| Risco | Prob. | Impacto | Mitigação | Rollback |
|---|---|---|---|---|
| Função nova esquecida com `EXECUTE` para `PUBLIC`/anon | média | alto | checklist do Q-02 + consulta `has_function_privilege` (§15.2-1) | `REVOKE` imediato |
| Abuso ou flood do link público | baixa | médio | rate limit em 3 níveis, limite de versões, kill switch | `link_publico_ativo=false`. Em último caso, `REVOKE EXECUTE ... FROM anon` (bloco no topo da mig. 37) |
| Divergência entre o cálculo JS e o SQL | média | médio | caso VP-PAR; o banco recalcula o que é gravado; o snapshot fica só como evidência | corrigir o helper e redeploy do front (dados gravados pelo SQL continuam íntegros) |
| Trigger de guarda quebra a edição do solicitante fora da cotação | baixa | alto | a guarda só age com vínculo `ativa`; teste 15.2-7 | `DROP TRIGGER trg_pedido_guarda_cotacao` (o resto continua) |
| Reescrita de `compras_alterar_status`/`listar_pedidos` perde ajustes da mig. 33 | média | alto | partir do `pg_get_functiondef` de produção e registrar o diff no cabeçalho | reaplicar a definição anterior (guardada no cabeçalho do arquivo, no bloco ROLLBACK) |
| `wa.me` com `#` mal linkado em algum cliente WhatsApp | baixa | médio | espaços em volta de `{link}`; teste 15.4-2 em Android, iOS e WhatsApp Web | fallback "Copiar link"; trocar para `/cotacao/?t=` exigiria rever o S-13 |
| Popup bloqueado ao abrir `wa.me` | média | baixo | `window.open` síncrono no clique; fluxo de 2 etapas no lembrete | — |
| Catálogo poluído com duplicatas | alta no início | médio | sugestão por trigram + alias + mesclagem | `compras_material_mesclar` |
| Supabase gratuito: Realtime ou limites | baixa | baixo | 1 canal por detalhe; volume baixo | polling manual (botão "Atualizar") |
| `request.headers` sem IP | média | baixo | rate limit por token e global continua | — |
| LGPD (IP e dados de fornecedor) | baixa | médio | base legal gravada, anonimização, retenção de 12 meses do IP, acesso só COMPRAS/Admin | — |
| Atendente decide com fornecedor que não reconfirmou a lista nova | média | médio | selo "lista v{n}"; linhas alteradas "não cotadas" bloqueiam o modo único | — |

**Rollback geral (ordem inversa):**
1. Front: reverter o deploy no Netlify (deploy anterior), ou esconder as seções com a verificação `compras_config` ausente.
2. Mig. 39, depois 38 (reaplicar as versões anteriores das RPCs de questionamento e remover `adicao`, só depois de converter ou cancelar os questionamentos `adicao`).
3. Mig. 37 (`DROP` das duas públicas), depois 36 (reaplicar as definições anteriores das 3 RPCs existentes), depois 35 (`DROP TRIGGER`s, `ALTER PUBLICATION ... DROP TABLE`, `DROP TABLE` com exportação prévia), depois 34.
4. Pedidos que ficaram `em_cotacao` continuam válidos (é um status já existente).

Cada arquivo traz o seu bloco `-- ROLLBACK:` com os comandos exatos.

---

## 17. Documentação a atualizar (D-01 · Documentação)

- **`.github/copilot-instructions.md`**, seção "Módulo Execução e Compras":
  - cotação, fornecedores, preços, página pública `/cotacao/#token`;
  - o service `comprasCotacao.js`;
  - migrations 34–39 e o estado delas.
- **`supabase/migrations/README.md`:** ordem e registro de aplicação das migrations 34–39, o kill switch e o aviso "toda função nova: `REVOKE ... FROM PUBLIC, anon`".
- **`supabase/schema/`:** regenerado (B-08).
- **`PLANO_MELHORIAS_EXECUCAO_COMPRAS.md`:** no Anexo F, uma nota F.12 "Cotação com fornecedores → ver `PLANO_COTACAO_FORNECEDORES.md`", com as mudanças em `compras_alterar_status`, `compras_listar_pedidos`, `compras_detalhe_pedido` e nos questionamentos (`adicao`).
- **`README.md`:** módulo Compras (cotações) e a página pública.
- **`DASHBOARD_COMERCIAL_CONTEXTO.md`:** só se ele listar os módulos (conferir).
- **Este plano:** os Anexos A (pré-requisitos medidos), B (UI/UX) e C (contrato final) preenchidos, e o checklist do §14 marcado.
- **Guia curto para a atendente:** criar a seção "Como usar" no Anexo D deste plano, com os passos do §10 em linguagem simples.

---

## 18. Ondas de delegação

| Onda | Backend | Frontend | UI/UX | QA | Performance | Documentação | Dependências / paralelismo |
|---|---|---|---|---|---|---|---|
| 0 | B-00 (migrations 32/33, extensões, cabeçalho de IP) | — | — | — | — | — | N-00 em paralelo (dono) |
| 1 | B-01 → B-02 → B-03 → B-04 → B-05 (sequenciais) | F-01 (helpers), F-02 (MPA/SW/headers) | U-01 (Anexo B) | Q-01 (unit, TDD) | — | — | Backend ∥ Frontend ∥ UI/UX ∥ QA, sem dependência cruzada |
| 2 | (correções do contrato) | F-03 (services), F-04 (página pública), F-05 (navegação), F-06 (fornecedores/config) | revisão visual de F-04/F-06 | — | — | — | F-03 depende de B-05; F-04 depende de F-01, F-02 e U-01 (mock até B-04); F-05 é independente |
| 3 | — | F-07 → F-08 → F-09 → F-10; F-11 | revisão do comparativo e da decisão | Q-02 (revisão das migrations 34–37) | — | — | F-07 depende de B-03; Q-02 roda em paralelo com F-07..F-10 |
| 4 | B-06, B-07 (paralelos); B-08 (aplicação + advisors + snapshot); B-09 opcional | F-12, F-13, F-14, F-15 (paralelos entre si) | revisão de F-12 | Q-02 (38–39) | P-02 (EXPLAIN depois de B-08) | — | F-12/F-13 dependem de B-06; F-15 depende de B-07; B-08 exige Q-02 aprovado |
| 5 | correções | correções | — | Q-03 (§15.2–15.6) | P-01, P-02 (bundle, benchmark) | D-01 | D-01 depois de Q-03; P-01 pode começar ao fim da Onda 3 |

**Deploy.** O front das Ondas 2–3 só vai para produção depois da B-08 (pelo menos as migrations 34–37 aplicadas). As Ondas 1–2 do front podem ir antes **sem** os itens de menu, que ficam atrás da verificação `compras_config_obter` com sucesso. O front da Onda 4 vai depois das migrations 38–39.

---

## 19. Pendências para o dono (não bloqueiam)

1. Validar os defaults D1–D18 (§2.1) e as decisões N1–N6 (§2.3).
2. Nome público da empresa mostrado ao fornecedor (`nome_empresa_publico`) e o texto final das mensagens.
3. Taxa mensal oficial do financeiro, se for diferente de 1,5%.
4. Existe alçada de aprovação por valor hoje? (D17: fora da v1.)

---

## Anexo A: pré-requisitos medidos (B-00)

> **Estado (B-00): MEDIDO em 2026-11-02**, via MCP do Supabase, imediatamente antes da B-08. Consultas em `supabase/manutencao/diagnostico_cotacao_B00.sql`. Nenhuma chave foi impressa; a função temporária do item 4 foi removida.

- **Migrations 32/33:** a 32 estava aplicada (`20261101200000`). A **33 NÃO estava** (as 3 RPCs ainda usavam `pode_ver_compras()` e `ADMIN_EXECUCAO` ainda tinha a página `compras`). Foi aplicada antes da 34 (`20261102002917 execucao_33_compras_acesso_exclusivo`); depois, só COMPRAS e Administrador têm a página.
- **Extensões:** `pgcrypto` 1.3 no schema `extensions` (`gen_random_bytes(integer)` e `sha256(bytea)` existem). `pg_trgm` não existia; a 34 o criou no schema `extensions` e o índice trigram `idx_compras_materiais_trgm` foi criado. **`pg_cron` não está habilitado:** `compras_limpeza_publica()` e `compras_verificar_alertas()` não estão agendadas (B-09 segue opcional/pendente).
- **Cabeçalho de IP em chamada anon real** (função temporária + `curl` com a chave anon): chegam `cf-connecting-ip` (IP do visitante), `x-forwarded-for` (um único IP, o mesmo) e `x-forwarded-proto: https`; `x-real-ip` **não** chega. `compras_request_ip()` funciona como projetada (usa `cf-connecting-ip`), então o limite por IP está ativo.
- **Reconciliação das RPCs reescritas pela 36:** as migrations 27–32 não tocam `compras_alterar_status`, `compras_listar_pedidos` nem `compras_detalhe_pedido`; a produção era exatamente 25/26/28 + gate da 33, como o DIFF do cabeçalho da 36 assume. Nenhuma divergência. O mesmo vale para `compras_abrir_questionamento`, `compras_responder_questionamento` e `compras_listar_questionamentos` (38).
- **Estado do CHECK de `execucao_notificacoes`** antes da 34: já com `compra_questionamento/resposta/status` (mig. 25); a 34 acrescentou `compra_cotacao` e `compra_alteracao`.
- **Advisors após aplicar (2026-11-02):** segurança sem ERRO novo do lote. Esperados e intencionais: 2× `anon_security_definer_function_executable` (as RPCs públicas), 3× `rls_enabled_no_policy` (INFO: `compras_config_segredo`, `compras_cotacao_tokens`, `compras_rate_limit`, de propósito sem policy) e as RPCs `SECURITY DEFINER` para `authenticated` (padrão do projeto, com gate `is_compras()` dentro). Os 13 `rls_disabled_in_public` (ERROR), `function_search_path_mutable` e `auth_leaked_password_protection` **não são do lote** (pré-existentes). Desempenho: nenhum alerta de FK sem índice nem de policy do lote; os `unused_index` dos índices novos são esperados (tabelas vazias).

## Anexo B: especificação visual (U-01, concluído)

### B.0 Princípios e convenções

- **Duas superfícies, dois temas.**
  - **Página pública** (`/cotacao/`): tema **claro**, mobile-first, CSS próprio (`cotacao-publica.css`, prefixo `cp-`). Não usa Tailwind do app, nem classes `execucao-*`, nem `react-icons` (§9.3).
  - **Módulo Compras:** tema escuro atual. Usa as classes `cmp-*` e `execucao-btn*`, as variáveis `--bg-*`, `--text-*`, `--accent-*` e a cor de marca `--compras-brand` (teal).
  - Novos componentes do Compras entram em `compras.css`, com prefixo `cmp-`.
- **Padrões reaproveitados** (não criar paralelos):
  - **Botões:** `execucao-btn execucao-btn-primary|secondary [execucao-btn-sm] cmp-btn-toque`. Ícone sozinho usa `cmp-btn-icone` com `aria-label`.
  - **Modais:** `.cmp-janela`; drawer em tela cheia no celular com `cmp-janela-drawer`. O rodapé usa `execucao-modal-footer !px-0 !pb-0`.
  - **Selos:** `.cmp-selo` + classe de tom. **Avisos:** `.cmp-aviso` (amarelo) e `.cmp-aviso-erro` (vermelho). **Abas:** `.cmp-abas` / `.cmp-aba`.
  - **Tabela:** `.cmp-tabela-rolagem` / `.cmp-tabela`, com cabeçalho sticky. **Skeleton:** `.cmp-skeleton`. **Destaque de 3 s:** `.cmp-destaque`.
  - **Barra de ação fixa:** `.cmp-barra-acao`. **Foco:** `outline: 2px solid #60a5fa`, já definido.
- **Regras globais de acessibilidade (WCAG 2.1 AA):**
  - Alvo de toque ≥ 44 px (`cmp-btn-toque` já aplica em `pointer: coarse` e em ≤ 767 px).
  - Estado nunca só por cor: sempre emoji ou texto junto ao selo.
  - Foco visível em tudo.
  - Mensagens dinâmicas em `aria-live="polite"` (erros bloqueantes em `role="alert"`).
  - `prefers-reduced-motion`: sem animação além do skeleton estático.
  - Rótulos visíveis acima do campo; placeholder nunca substitui o rótulo.
- **Formatação pt-BR (sempre via `moeda.js`):**
  - Moeda `R$ 1.234,56`; unitário com até 4 casas, só se necessário (`R$ 12,5000` vira `R$ 12,50`, `R$ 0,0375` fica como está).
  - Percentual `11,6%` com sinal explícito nas variações (`+11,6%` / `−2,0%`; usar o sinal de menos U+2212).
  - Datas `qui 03/11 18:00`.
  - Quantidade com `toLocaleString('pt-BR')`.
- **Texto ao fornecedor:** tom cordial e direto, tratamento "você", sem jargão interno. Nunca citar cliente, obra, endereço, solicitante, urgência, outros fornecedores, referência de preço, taxa ou "valor presente" (§9.4).

---

### B.1 Página pública do fornecedor (prioridade: ALTA)

#### B.1.1 Tokens de cor (tema claro, contraste calculado sobre o fundo indicado)

| Token CSS | Hex | Uso | Contraste |
|---|---|---|---|
| `--cp-bg` | `#f8fafc` | fundo da página | — |
| `--cp-card` | `#ffffff` | cartões e campos | — |
| `--cp-borda` | `#94a3b8` | borda de campo (slate-400) | 3,0:1 sobre branco (limite WCAG 1.4.11 para componentes) |
| `--cp-borda-suave` | `#e2e8f0` | divisórias não essenciais | decorativo |
| `--cp-texto` | `#0f172a` | texto principal | 17:1 |
| `--cp-texto-2` | `#475569` | texto secundário e dicas | 7,6:1 |
| `--cp-placeholder` | `#64748b` | placeholder | 4,8:1 |
| `--cp-primario` | `#1d4ed8` (primary-700) | botão principal, foco, "Tenho" ativo | 6,7:1 com texto branco |
| `--cp-primario-hover` | `#1e3a8a` (primary-900) | hover | — |
| `--cp-sucesso-fundo` / `-texto` | `#f0fdf4` / `#15803d` | enviado e subtotal | 5,0:1 |
| `--cp-aviso-fundo` / `-borda` / `-texto` | `#fffbeb` / `#f59e0b` / `#92400e` | lista alterada, prazo próximo | 7,1:1 |
| `--cp-erro-fundo` / `-texto` / `-borda` | `#fef2f2` / `#b91c1c` / `#dc2626` | erros de campo e de página | 6,5:1 |
| `--cp-foco` | `#1d4ed8`, `outline: 3px solid; offset 2px` | foco | 6,7:1 |

- Não usar `slate-400` para texto.
- "Não tenho" ativo usa fundo `#475569` com texto branco, não vermelho: a ausência do item não é erro.

#### B.1.2 Tipografia e espaçamento

- **Fonte:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (sem webfont, por causa do orçamento de bundle).
- **Tamanhos:**

| Elemento | Tamanho | Peso |
|---|---|---|
| título da cotação | 18 px | 700 |
| descrição do item | 16 px | 600 |
| quantidade e unidade | 20 px | 700 |
| campos | 16 px (evita zoom automático no iOS) | 400 |
| rótulos | 14 px | 600 |
| dicas | 13 px | 400 |

- **Layout:**
  - Coluna única, `max-width: 640px`, centralizada, `padding: 16px`.
  - Cartões com `border-radius: 12px`, `padding: 16px`, `gap: 12px`.
  - Em ≥ 768 px, só aumenta a margem lateral. O formulário continua em coluna única.
- **Rodapé fixo:** `padding-bottom: env(safe-area-inset-bottom)`. O conteúdo ganha `padding-bottom` igual à altura do rodapé, para o último campo não ficar escondido.

#### B.1.3 Wireframe (estado `aberta`, 360 px)

```
┌──────────────────────────────────────┐
│ Effort · Cotação nº 123              │  <h1>
│ Olá, João (Elétrica X)               │
│ ⏰ Responda até qui 03/11 18:00      │  contagem: "faltam 1 dia e 4 h"
│ 📍 Entrega: Curitiba / Batel         │
│ [obs. pública da cotação, se houver] │
├──────────────────────────────────────┤
│ ⚠ A lista foi alterada. Confira os   │  só se precisa_reconfirmar
│   itens marcados "alterado" e envie  │  (fundo aviso, role="status")
│   de novo.                           │
├──────────────────────────────────────┤
│ Itens (3)    Respondidos 1 de 3      │  <h2> + contador
│ ┌──────────────────────────────────┐ │
│ │ 1  Cabo flexível 2,5 mm          │ │
│ │ [alterado]                       │ │
│ │ Quantidade: 300 m                │ │
│ │ ┌─────────────┬────────────────┐ │ │
│ │ │ ✓ Tenho     │  Não tenho     │ │ │  radiogroup, 48 px de altura
│ │ └─────────────┴────────────────┘ │ │
│ │ Preço unitário (R$ por m)        │ │
│ │ [ R$ 4,35                      ] │ │  inputmode="decimal"
│ │ Subtotal: R$ 1.305,00            │ │  aria-live="polite"
│ │ ▸ Tenho só parte da quantidade   │ │  disclosure
│ │   Quantidade disponível (m)      │ │
│ │   [ 120 ]  "Faltam 180 m"        │ │
│ │ ▸ Marca / observação (opcional)  │ │
│ └──────────────────────────────────┘ │
│  … demais itens …                    │
├──────────────────────────────────────┤
│ Condições de pagamento               │
│ Informe pelo menos uma.              │
│ ☑ À vista                            │
│    Desconto (opcional)               │
│    (•) %  ( ) R$   [ 3,00 ]          │
│ ☑ Parcelado                          │
│    Parcelas [ 3 ]  Entrada R$ [    ] │
│    1ª parcela em (dias) [ 30 ]       │
│    Total parcelado [ R$ 1.305,00 ]   │
│    Dica: se houver juros, informe    │
│    o total com juros.                │
├──────────────────────────────────────┤
│ Entrega                              │
│ Prazo de entrega (dias) *  [   ]     │
│ Frete *                              │
│ (•) Incluso (CIF)  ( ) Valor R$ [  ] │
│ Região de entrega: Curitiba / Batel  │
├──────────────────────────────────────┤
│ Observações gerais (opcional)        │
│ [ textarea, contador 0/1000 ]        │
│                                      │
│  Não vou cotar                       │  botão-link, 44 px
├══════════════════════════════════════╡
│ À vista R$ 1.266,00 · 3x R$ 435,00   │  rodapé fixo, aria-live polite
│ [        Enviar proposta           ] │
└──────────────────────────────────────┘
```

- **Controle "Tenho / Não tenho":**
  - `role="radiogroup"` com `aria-labelledby` (descrição do item). São dois botões com texto, lado a lado, 50% cada, altura mínima 48 px.
  - Ativo: fundo cheio + ícone ✓ (o ✓ só no "Tenho").
  - Setas do teclado alternam entre as opções.
  - Sem seleção: nenhum ativo, e o envio dá erro no item ("Informe se você tem este item").
  - "Não tenho" esconde preço, parcial e subtotal, e mostra o cartão com a borda neutra e a etiqueta "Sem este item".
- **Preço:**
  - Prefixo "R$" visível fora do `input`. Aceita vírgula e ponto. Máscara pt-BR aplicada ao sair do campo (`onBlur`), sem reformatar a cada tecla.
  - `autocomplete="off"`. Hint abaixo: "por {unidade}".
  - Subtotal = preço × min(quantidade, disponível).
- **Quantidade parcial** (N6: o plano prevê `quantidade_disponivel`):
  - Disclosure "Tenho só parte da quantidade", fechado por padrão, `aria-expanded`.
  - Campo numérico > 0. Se for ≥ quantidade pedida, mostra a dica "Isso cobre o pedido todo" e ignora o valor ao enviar.
  - Se for menor, mostra "Faltam X {un}" e o subtotal usa a quantidade disponível.
  - Não prometer ao fornecedor que a proposta parcial será aceita.
- **Condições:**
  - Cada condição é um `<fieldset>` com `<legend>` e os campos dependentes aparecem só quando marcada.
  - Se nenhuma estiver marcada, o erro aparece no `<legend>` do grupo: "Escolha ao menos uma condição de pagamento".
  - Parcelado: o "Total parcelado" começa preenchido com a soma dos itens, mas sem sobrescrever o que o fornecedor editou.
- **Rodapé fixo:**
  - Mostra o total nominal das condições marcadas. Nunca mostra VP.
  - Se faltar preencher itens, o botão continua habilitado (para o fornecedor ver os erros). Durante o envio fica `aria-busy` e desabilitado, com o texto "Enviando…".
  - **Rolagem para o erro:** ao enviar com erro, foca o primeiro campo inválido (`scrollIntoView({block:'center'})`) e mostra uma faixa no topo do formulário: "Corrija 2 campos para enviar".
- **Erros por campo:** abaixo do campo, texto `--cp-erro-texto` com o prefixo "⚠", `id` ligado por `aria-describedby`, e `aria-invalid="true"`. A borda vira `--cp-erro-borda` com 2 px. Valide ao sair do campo, e depois a cada alteração.

#### B.1.4 Textos finais (pt-BR)

| Situação | Texto |
|---|---|
| Título | "{empresa_contratante} · Cotação nº {numero}" |
| Saudação | "Olá, {nome_contato} ({empresa})" |
| Prazo | "Responda até {qui 03/11 18:00}" + "(faltam {x})". Em menos de 2 h, o aviso vira âmbar. |
| Aviso de lista alterada | "A lista foi alterada. Confira os itens marcados como "alterado" e envie sua proposta de novo." |
| Rótulo de tipo | "Tenho" / "Não tenho" |
| Erro de preço vazio | "Informe o preço unitário" |
| Erro de preço inválido | "Informe um valor maior que zero" |
| Erro de condição | "Escolha ao menos uma condição de pagamento" |
| Erro de prazo | "Informe o prazo de entrega em dias (0 a 365)" |
| Erro de frete | "Informe se o frete está incluso ou o valor" |
| Erro de quantidade | "Informe uma quantidade maior que zero" |
| Linha sem resposta | "Informe se você tem este item" |
| Ninguém tem nada | "Marque ao menos um item que você tem ou use "Não vou cotar"" |
| Botão principal | "Enviar proposta" / "Enviar nova versão" (quando já há resposta) / "Enviando…" |
| Confirmar recusa | Título "Não vai cotar desta vez?" · corpo "Vamos avisar a {empresa_contratante} que você não vai participar." · botões "Voltar" e "Sim, não vou cotar" |
| Sucesso | "✅ Proposta enviada às {hh:mm} (versão {n})." · "Você pode alterar até {prazo}." |
| Sucesso (recusa) | "✅ Recebemos sua resposta. Obrigado por avisar." |
| Rascunho restaurado | "Recuperamos o que você já tinha preenchido." |

- O rótulo do botão de envio muda para "Enviar nova versão" quando `resposta` existe. O texto "enviar proposta" já cobre o caso de primeira vez.

#### B.1.5 Estados (prioridade: ALTA)

Todos usam o componente `EstadoMensagem`: ícone SVG inline ou emoji grande com `aria-hidden`, `<h1>` curto, parágrafo de apoio e, quando cabe, um botão. O foco vai para o `<h1>` ao entrar no estado, e o container tem `role="status"`.

| Estado (código) | Título | Apoio | Ação |
|---|---|---|---|
| Carregando | skeleton do cabeçalho + 3 cartões, `aria-busy="true"`, texto oculto "Carregando cotação…" | — | — |
| Válido (`aberta`) | formulário completo | — | — |
| `prazo_encerrado` | "⏰ O prazo desta cotação terminou" | "Você ainda pode ver o que enviou, mas não é mais possível alterar." | formulário em modo leitura: campos `readonly`, rodapé sem botão, faixa "Prazo encerrado" fixa no topo |
| `encerrada` | "Cotação encerrada" | "Obrigado pela participação!" | — |
| `LINK_INVALIDO` | "Link inválido" | "Confira se o endereço está completo ou peça um novo link a quem enviou." | — |
| `LINK_SUBSTITUIDO` | "Este link foi substituído" | "Use o link mais recente que você recebeu pelo WhatsApp." | — |
| `MUITAS_TENTATIVAS` | "Muitas tentativas" | "Aguarde alguns minutos e tente de novo." | "Tentar de novo" (desabilitado por 30 s com contagem) |
| `INDISPONIVEL` | "Cotação temporariamente indisponível" | "Tente novamente mais tarde." | — |
| Enviado | cartão verde no topo: "✅ Proposta enviada às {hh:mm} (versão {n})" | formulário continua visível e preenchido, editável até o prazo | rodapé com "Enviar nova versão" |
| Erro de rede ou 5xx ao enviar | faixa vermelha `role="alert"` sobre o rodapé: "Não conseguimos enviar. Seus dados continuam aqui, tente de novo." | rascunho mantido | "Tentar novamente" |
| `LISTA_ALTERADA` | faixa âmbar: "A lista foi atualizada enquanto você preenchia. Mantivemos os preços dos itens que não mudaram; confira os itens marcados." | recarrega os itens por `id` | rola até o primeiro item "alterado" |
| `PRAZO_ENCERRADO` ao enviar | vira o estado "prazo encerrado" acima, preservando a tela | — | — |
| `DADOS_INVALIDOS` do servidor | mensagem do campo (`campo`, `mensagem`) no campo correspondente, com foco | — | — |
| `PAYLOAD_GRANDE` / `LIMITE_VERSOES` | "Você atingiu o limite de alterações. Fale com a {empresa_contratante}." | — | — |
| Sem JavaScript | `<noscript>`: "Para responder esta cotação, ative o JavaScript no navegador." | — | — |

- **Mapeamento:** o `api.js` devolve o código e `CotacaoPublica` escolhe o estado. A mensagem do servidor só é exibida para `DADOS_INVALIDOS`, e mesmo assim passando pelo texto do campo.
- **Modo leitura em `prazo_encerrado`:** `<fieldset disabled>` em todo o formulário e `aria-disabled` nos controles. Sem rodapé fixo.
- **Aviso de saída:** com alterações não enviadas, não usar `beforeunload` (atrapalha no celular). O rascunho no `localStorage` (§9.3 item 10) já cobre a recuperação.

#### B.1.6 Acessibilidade e desempenho da página pública

- `<html lang="pt-BR">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` **sem** `maximum-scale`.
- Ordem de foco segue a ordem visual. Há um `<main>` e uma hierarquia `h1` > `h2` (itens, condições, entrega). Cada cartão de item é um `<section aria-labelledby>`.
- Teclados: `inputmode="decimal"` para preços e `inputmode="numeric"` para parcelas, prazo e dias.
- Contraste do foco ≥ 3:1 contra o fundo vizinho (já calculado).
- A mensagem de sucesso e as de erro ficam numa região `aria-live` que existe desde o início da renderização.
- Sem imagens e sem fontes externas. Sem `react-icons`. Ícones são SVG inline ou emoji com `aria-hidden`.
- `<meta name="robots" content="noindex,nofollow">` e `referrer` = `no-referrer` (o token está no fragmento, mas o fragmento não deve ir em nenhum link).

---

### B.2 Navegação do módulo Compras (prioridade: ALTA)

- `ComprasHeader` já usa `.cmp-topbar-nav` e `.cmp-topbar-link`. Acrescentar os links **Pedidos** (renomeia "Fila de Compras"), **Cotações**, **Fornecedores**, **Preços** e **Configurações** (só Administrador), com `aria-current="page"` no ativo, e o mesmo padrão do botão atual (ícone `aria-hidden` + `<span>`).
- Nos celulares, o `.cmp-topbar-nav` já quebra linha (`flex-wrap`). Com 5 links isso ocupa 2 linhas, o que é aceitável. Se passar disso, trocar por rolagem horizontal (`overflow-x:auto; flex-wrap:nowrap`) com `scroll-snap`, sem esconder o link ativo (`scrollIntoView` ao montar).
- O badge numérico do `execucao-nav-badge` migra para **Cotações**, com o total de respostas novas. Texto de apoio: `aria-label="{n} resposta(s) não lida(s)"` (como já é hoje).
- Em Pedidos, mostrar um selo `🧾 Cotação nº X` nos cartões em cotação (`.cmp-selo`, tom azul), como link para `#/compras/cotacoes?id=…`.

---

### B.3 Assistente "Nova cotação" (prioridade: ALTA)

#### B.3.1 Seleção múltipla na fila

- **Checkbox "Selecionar"** no canto superior esquerdo do `CartaoPedidoCompras`, com o rótulo visível em ≥ 768 px e só o ícone ☐/☑ no celular, mas sempre com `aria-label="Selecionar pedido {título}"`. Área de toque de 44 × 44 px (padding, não aumentando o ícone).
- Cartão selecionado: borda `--compras-brand` com 2 px e fundo `--compras-brand-soft`. Não só a cor: a checkbox marcada indica.
- Cartão já em cotação: a checkbox some e aparece o selo "🧾 Cotação nº X". Se o pedido não pode ser selecionado por outro motivo (por exemplo, outro status), fica sem checkbox e sem selo, sem explicação extra.
- **Barra de ação fixa** (`.cmp-barra-acao`), com `role="region"` e `aria-label="Ações da seleção"`:
  - Texto "3 pedidos selecionados" em `aria-live="polite"`.
  - Botões "Limpar" (secondary) e "Criar cotação com 3 pedidos" (primary).
  - No 31º pedido: o checkbox falha com a mensagem "Limite de 30 pedidos por cotação" no `aria-live`.
- Teclado: `Espaço` marca; `Esc` limpa a seleção (apenas quando o foco está na barra).

#### B.3.2 Estrutura do assistente

Modal `.cmp-janela cmp-janela-drawer` (tela cheia no celular).

```
┌ Nova cotação                                   [×] ┐
│ ① Pedidos ─ ② Itens ─ ③ Fornecedores ─ ④ Envio     │  stepper
├────────────────────────────────────────────────────┤
│ (conteúdo do passo)                                │
├────────────────────────────────────────────────────┤
│ [Voltar]                [Salvar rascunho] [Avançar]│
└────────────────────────────────────────────────────┘
```

- **Stepper:** `<ol>` com `aria-current="step"` no atual. Em ≤ 639 px mostra só "Passo 2 de 4 · Itens" (texto, sem os 4 círculos). Passos concluídos são clicáveis para voltar (nunca para pular adiante).
- **Fechar (×) ou Esc:** abre confirmação "Manter rascunho" / "Descartar" / "Continuar editando" (§10.2). O foco volta ao botão que abriu o assistente.
- **Rodapé:** "Avançar" fica desabilitado enquanto o passo for inválido, com texto explicando o motivo logo acima (`aria-describedby`), não só desabilitado.

**Passo 1, Pedidos.** Lista dos selecionados em `<ul>`; cada linha mostra cliente/descrição, solicitante (informação interna, tom discreto `--text-muted`), qtd de itens e o botão "Remover" (`cmp-btn-icone`, `aria-label="Remover pedido {título} da cotação"`). Mínimo de 1 pedido. Se removeu todos, o botão "Avançar" some e aparece "Fechar".

**Passo 2, Itens consolidados.**
- **Desktop:** `.cmp-tabela` com as colunas Descrição pública (editável), Unid., Qtd, Material, Observação pública e uma coluna "composição" expansível. **Mobile:** cartão por linha com os mesmos campos empilhados.
- **Composição:** `<button aria-expanded>` "3 pedidos ▾" abre "Pedido A: 100 m · Pedido B: 200 m". As origens ficam em lista.
- **Descrição pública:**
  - Campo com o aviso fixo "Esta descrição será vista pelo fornecedor. Não inclua cliente, obra ou endereço." (`.cmp-aviso`, só na primeira vez, dispensável).
  - Contador visível próximo ao limite de caracteres.
- **Material:** seletor `combobox` (ARIA 1.2) com sugestões do `compras_material_sugerir`, a opção "Criar novo material" e o selo "Sugerido" nas sugestões automáticas. Linha sem material mostra "⚠ Confirme o material" (necessário depois, na decisão). Não bloqueia o avanço.
- **Ações por linha:** "Separar linha" e "Juntar com…" (só linhas com a mesma unidade normalizada; o seletor lista as elegíveis). A ação abre um popover simples, com foco preso e `Esc` fecha.
- **Região de entrega:** campo com dica "Cidade/bairro. Não informe o endereço." e validação que rejeita padrões óbvios de endereço (números longos ou "Rua/Av."), com aviso (não bloqueia).
- Itens somados de pedidos diferentes recebem o selo "somado (3 pedidos)".

**Passo 3, Fornecedores.**
- Busca por nome/empresa e filtro por categoria (chips, `aria-pressed`). Lista com checkbox por fornecedor: empresa (forte), contato, WhatsApp formatado `(41) 99999-9999`, categorias, e "📨 taxa de resposta 80%" se houver.
- Contador "N de 15 selecionados" em `aria-live`. Mínimo 1, máximo 15.
- Fornecedor inativo: não aparece. Fornecedor sem WhatsApp válido: não selecionável, com o texto "WhatsApp inválido" e o link "Corrigir".
- Botão "＋ Cadastrar fornecedor" abre o modal de fornecedor (B.6) por cima, e o recém-cadastrado vem selecionado.
- Estado vazio: "Nenhum fornecedor cadastrado" + botão "Cadastrar fornecedor".

**Passo 4, Prazo e mensagem.**
- **Prazo:** chips em `radiogroup` "24 h", "48 h (padrão)", "72 h", "Data e hora" (abre `input datetime-local`). Mostra a data resultante ("Prazo: qui 03/11, 18:00"). Data no passado: erro "Escolha um horário futuro".
- **Mensagem:** `<textarea>` com a mensagem padrão (placeholders `{contato}`, `{empresa_publica}`, `{numero}`, `{qtd_itens}`, `{link}`, `{prazo}`) e lista dos placeholders disponíveis. A pré-visualização para o 1º fornecedor aparece em bloco "balão" (`.cmp-sugestao`), com `{link}` mostrado como `https://…/cotacao/#••••`.
- **Resumo antes de confirmar** (`.cmp-aviso`, tom neutro): "Você vai abrir a cotação com {n} itens e {m} fornecedores. Depois de enviar, as listas só podem ser alteradas com "Revisar cotação"."
- **Botão final:** "Abrir cotação e gerar links". Em ação: `aria-busy`, texto "Gerando links…". Sucesso: segue para o painel de envio (B.4), com foco no `<h2>` "Enviar aos fornecedores".
- **Erros:** o assistente mostra a falha em `.cmp-aviso-erro role="alert"` no próprio passo, mantendo os dados.

**Prioridades do assistente:** alta (passos 1, 3 e 4), média (juntar/separar linha, composição).

---

### B.4 Painel de envio e acompanhamento (prioridade: ALTA)

Topo do detalhe da cotação (`#/compras/cotacoes?id=…`).

```
┌ Cotação nº 123  [Aberta]  Prazo qui 03/11 18:00 (faltam 1 d 4 h) ┐
│ 3 pedidos · 12 itens · 5 fornecedores   [Prorrogar] [Mais ▾]     │
├───────────────────────────────────────────────────────────────────┤
│ Enviar aos fornecedores        Enviados 2 de 5 · Respostas 1 de 5 │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Elétrica X · João · (41) 99999-9999                           ││
│ │ [⚪ Não enviado]  0 envios                                    ││
│ │ [Enviar WhatsApp] [Copiar link]                               ││
│ ├───────────────────────────────────────────────────────────────┤│
│ │ Casa Y · Maria · (41) 98888-7777                              ││
│ │ [✅ Respondido v2 · 14:02]  2 envios · último 10/11 09:12     ││
│ │ [Ver proposta] [Lembrete]                                     ││
│ └───────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

- **Cada convite é um `<li>` de uma `<ul>`** (cartão no celular e linha de tabela em ≥ 1024 px). Todo chip de status leva emoji + texto:

| Status | Chip | Tom |
|---|---|---|
| `nao_enviado` | ⚪ Não enviado | cinza |
| `enviado` | 📤 Enviado | azul |
| `visualizado` | 👀 Visualizou | ciano |
| `respondido` | ✅ Respondido · v{n} | verde |
| `recusou` | 🚫 Não vai cotar | cinza escuro |
| expirado (derivado) | ⏰ Prazo vencido sem resposta | âmbar |
| `precisa_reconfirmar` | 🔄 Reconfirmar (lista v{n}) | roxo (`cmp-tom-roxo`) |

- **Envio um a um** (regra do §10.3: o `window.open` no mesmo clique, sem `await` antes):
  - O botão "Enviar WhatsApp" muda para "Enviado ✓" por 3 s, e o status vira `enviado` (atualização otimista) com o aviso `aria-live` "Envio registrado para Elétrica X".
  - O botão **continua disponível** depois do envio, com o texto "Reenviar". A atendente pode ter fechado o WhatsApp sem enviar. O sistema só sabe que o link foi aberto, não que a mensagem foi enviada. Por isso o texto explica: dica fixa "O envio é confirmado por você no WhatsApp."
  - Se o popup for bloqueado, aparece `.cmp-aviso`: "O navegador bloqueou o WhatsApp. Permita pop-ups ou use Copiar link." (detecta `window.open` retornando `null`).
  - O botão que abre o próximo fornecedor não existe: a atendente avança por conta própria, mantendo o controle. Em vez disso, o primeiro convite "não enviado" recebe o destaque visual de "Próximo" (`.cmp-destaque` + selo "Próximo a enviar"), e o contador "Enviados 2 de 5" fica no topo.
  - **Sem token em memória** (outra sessão): o botão vira "Gerar link para enviar", com a dica "O link antigo deixa de funcionar" (confirmação em linha, uma vez), fluxo em duas etapas do §10.3.
- **Lembrete / novo link** (duas etapas):
  1. Clique em "Lembrete": mostra "Gerando link…" e depois troca o botão por "Enviar lembrete pelo WhatsApp" com foco nele (`focus()` programático, anunciado).
  2. Segundo clique abre o `wa.me`.
  - A dica ao lado explica: "O link anterior deixa de funcionar." É importante: sem isso a atendente pode se assustar com um fornecedor reclamando de "link substituído".
- **Copiar link:** botão "Copiar link" altera o texto para "Link copiado ✓" por 3 s e anuncia no `aria-live`. Em caso de falha do clipboard, mostra o link num campo `readonly` selecionado.
- **Acompanhamento:** a linha da resposta recebida usa `.cmp-destaque` por 3 s e um toast. O sino notifica. O contador "Respostas 3 de 5" é um `aria-live="polite"` (fora do foco, sem roubar a leitura).
- **Estados da tela:**
  - **Carregando:** `.cmp-skeleton` com 3 cartões.
  - **Vazia** (sem convites): "Nenhum fornecedor nesta cotação. Volte ao rascunho para escolher." + botão.
  - **Erro:** `.cmp-aviso-erro` com "Tentar novamente".
  - **Realtime falhou:** discreto, "Atualização automática indisponível. Atualizar" (botão).
  - **Cotação encerrada/cancelada:** todos os botões de envio desabilitados, com o texto do motivo em cima.

---

### B.5 Comparativo e decisão (prioridade: ALTA)

#### B.5.1 Estrutura (desktop ≥ 1024 px)

```
┌ Comparativo ──────────────────────────────────────────────────────┐
│ [faixa vermelha, se requer_revisão] Lista alterada após o envio:  │
│  revise a cotação antes de decidir.            [Revisar cotação]  │
├───────────────────────────────────────────────────────────────────┤
│ 🏆 Melhor proposta    │ Empate técnico   │ Cobre 8 de 12          │
│ Elétrica X            │ Casa Y           │ Loja Z                 │
│ R$ 12.340,00 (VP)     │ R$ 12.410,00     │ R$ 7.100,00            │
│ Nominal R$ 12.600,00  │ −                │                        │
│ 3x, entrada R$ 1.000  │ À vista (−3%)    │                        │
│ Frete: CIF · 5 dias   │ Frete R$ 120     │                        │
│ +R$ 70 (+0,6%) p/ 2ª  │                  │                        │
│ −R$ 1.900 (−13,3%)    │                  │                        │
│   vs. mais cara       │                  │                        │
│ v3 · 14:02 [versões]  │                  │                        │
├───────────────────────────────────────────────────────────────────┤
│ 💡 Melhor combinação dividida: economia de R$ 820 (−6,6%)         │
│    Elétrica X: itens 1, 2, 5 · Casa Y: itens 3, 4                 │
│    ⚠ desconto em R$ pode não valer em compra parcial              │
├───────────────────────────────────────────────────────────────────┤
│ Matriz itens × fornecedores                                       │
│ Item          │ Qtd   │ Elétrica X │ Casa Y    │ Loja Z           │
│ Cabo 2,5 mm   │ 300 m │ R$ 4,35 ★  │ R$ 4,60   │ não tem          │
│ …                                                                 │
├───────────────────────────────────────────────────────────────────┤
│ vs. referência: economia de R$ 900 (−6,8%)           [Decidir]    │
└───────────────────────────────────────────────────────────────────┘
```

#### B.5.2 Cartões de ranking

- **Ordem:** a do §8.4. Candidatos completos primeiro, depois os parciais com o selo "Cobre X de Y".
- **Selo do primeiro:** "🏆 Melhor proposta" (`.cmp-selo`, tom verde). **Empate técnico:** "⚖️ Empate técnico" (tom âmbar), com o texto "Desempate: prazo de entrega" indicando o critério (`§8.4`). Quando a 2ª colocada empata com a 1ª, **os dois cartões ganham o selo de empate**, e só o que ganhou o desempate leva o 🏆.
- **Nunca só a cor:** os selos têm sempre emoji e rótulo.
- **Hierarquia do cartão (cima para baixo):** empresa; valor em destaque (VP, 24 px/700); "Nominal R$ …" em `--text-muted`; condição; frete; prazo de entrega (sempre visível, §8.4); Δ para a 2ª e para a mais cara em R$ e %; versão.
- **Rótulo de VP:** "Valor comparável" com ⓘ (`<button aria-label="O que é valor comparável?">`). O tooltip/popover explica: "Considera o prazo de pagamento e a taxa de {1,5}% a.m. Parcelas futuras valem menos que pagar hoje." Ele não depende de hover (abre com clique/Enter e fecha com Esc).
- **Outra condição** (à vista × parcelado): expansível "Ver outra condição".
- **Versões:** link "ver versões anteriores" (disclosure) mostra o diff de preço por item entre versões, ex.: "Cabo 2,5 mm: R$ 4,60 → R$ 4,35 (−5,4%)".
- **Parciais:** selo "Cobre X de Y" + lista "Faltam: …" (expansível). Sem 🏆, a não ser quando ninguém cobre tudo ("Melhor parcial").
- **Proposta baseada em lista antiga:** selo "baseada na lista v{n}" (roxo).

#### B.5.3 Matriz itens × fornecedores

- **Desktop:** `.cmp-tabela-rolagem` + `.cmp-tabela`, cabeçalho sticky, **primeira coluna sticky** (`position: sticky; left: 0`) com a descrição e a quantidade, para a rolagem horizontal não perder o contexto (até 15 fornecedores).
  - `<table>` com `<caption class="sr-only">`, `<th scope="col">` por fornecedor e `<th scope="row">` por item.
  - Cada célula (nesta ordem): preço VP; "nominal R$ …" menor; selo de variação vs. referência; estado ("não tem", "parcial (x)", "não cotado").
- **Melhor da linha (acessível, Jev q3):** borda de 2 px verde + o texto "menor" (sem depender só da cor) + o `★`. A célula vencedora da **decisão** tem outra marca: fundo `--compras-brand-soft` + "✔ escolhido".
- **Variação vs. referência** (§8.6): formato `R$ 12,50 (+R$ 1,30 / +11,6% vs. média)`.
  - Neutra (≤ ±2%): cinza, texto "≈ média".
  - Mais barato: verde, sinal "−". Mais caro: vermelho, sinal "+".
  - Passou de +10%: "⚠️ renegociar".
  - Sem histórico: "primeiro registro". Sem material: "confirme o material para comparar".
  - Detalhe (última, menor e a quantidade de referência): popover acionado por botão ("detalhes") e não por hover.
- **Estados da célula:**
  - "não tem": traço cinza + texto.
  - "parcial (120 de 300 m)": âmbar + texto.
  - "não cotado": itálico cinza, quando a proposta é de lista anterior ou não respondeu.
  - Fornecedor que ainda não respondeu: coluna esmaecida com o selo do status do convite no cabeçalho.
- **Cores com contraste no tema escuro:** texto verde `#86efac`, vermelho `#fca5a5`, âmbar `#fde68a` (já usados em `compras.css`) sobre `--bg-card`, ≥ 4,5:1.

#### B.5.4 Mobile (< 768 px): lista por item (§10.5)

- Cada item é um cartão (`.cmp-cartao`): descrição e quantidade no topo; abaixo, as ofertas em `<ol>` **ordenadas da mais barata para a mais cara**, uma linha por fornecedor: empresa · preço · selo (🥇 "menor", "não tem", "parcial (x)").
- Mostrar só as 3 melhores ofertas e "Ver todas (N)" (`aria-expanded`).
- Os cartões de ranking viram um carrossel **não**: viram uma lista vertical, com o 1º expandido e os demais recolhidos (`<details>`).
- O botão **"Decidir"** fica fixo no rodapé (`.cmp-barra-acao`), com o resumo "Melhor: Elétrica X · R$ 12.340,00".
- Alternar a visualização "Por item | Por fornecedor" é desnecessário no celular. Fica só "por item".

#### B.5.5 Estados do comparativo

| Estado | Tratamento |
|---|---|
| Sem respostas | "Ainda não há propostas. Quando um fornecedor responder, ela aparece aqui." + botão "Ir para envio" |
| Só 1 resposta | mostra o cartão sem "empate" nem "divisão", com a dica "Aguarde mais propostas ou decida com esta." |
| Carregando | `.cmp-skeleton` nos cartões e na matriz |
| Erro | `.cmp-aviso-erro` + "Tentar novamente" |
| Atualização em tempo real | linha/cartão alterado com `.cmp-destaque` por 3 s, mensagem `aria-live`: "Casa Y enviou a versão 2" |
| `requer_revisao` | faixa vermelha (`.cmp-aviso-erro`) e o botão "Decidir" desabilitado com a razão em texto |

#### B.5.6 `ModalDecisao` (prioridade: ALTA)

Modal `.cmp-janela` (tela cheia no celular). Seções, de cima para baixo:

1. **Modo** (`radiogroup`, cartões `.cmp-opcao`):
   - "Um fornecedor" (pré-selecionado com o recomendado);
   - "Dividir por item (economia R$ X)": só aparece se houver combinação;
   - "Escolher manualmente".
2. **Fornecedor por item** (no modo manual): `<select>` por linha, com o preço ao lado. Linha sem fornecedor válido mostra o erro: "Nenhum fornecedor cobre este item. Remova o item ou tire o pedido da cotação." (N4).
3. **Material:** linhas sem `material_id` pedem confirmação (combobox, mesma do passo 2 do assistente). Obrigatório para decidir.
4. **Data de disponibilidade por pedido:** `input type="date"` para cada pedido, sugerida como `hoje + max(prazo_entrega_dias)` com o texto "Sugerida pelo prazo do fornecedor". Não aceita data passada.
5. **Justificativa:** `textarea` **obrigatório** só se a escolha foge da recomendação (mínimo de 10 caracteres). Mostra `.cmp-aviso`: "Você escolheu uma opção diferente da recomendada (+R$ 320, +2,6%). Explique o motivo." com a diferença calculada.
6. **Resumo:** total (VP e nominal), fornecedores, por fornecedor a lista de itens e o frete, e "vs. referência". Em compra dividida: o aviso N3 (desconto em R$ pode não valer).
7. **Rodapé:** "Cancelar" (secondary), "Confirmar decisão" (primary). Ao confirmar, `aria-busy`, texto "Registrando…". Sucesso: fecha, toast e `.cmp-destaque`.
- **Foco:** abre com o foco no título; foco preso; `Esc` fecha (pede confirmação se houve edição). Erros por campo, como na B.0.
- **Texto de confirmação:** "Confirmar decisão" e, no resultado, "Decisão registrada. Os pedidos seguem para a compra." Não dizer "pedido feito ao fornecedor", porque o sistema não envia o pedido.

#### B.5.7 Ações extras da cotação

No menu "Mais ▾" (`<button aria-haspopup="menu">`), com os itens: "Prorrogar prazo", "Revisar cotação", "Incluir pedido", "Remover pedido" e "Cancelar cotação" (último, separado e em vermelho, com ícone e texto). No celular, o menu vira lista no `.cmp-menu-mais` (cada botão com 44 px, largura total).

- **Prorrogar:** chips +24 h / +48 h / data. Resultado: toast e o prazo do cabeçalho atualizado.
- **Revisar cotação:** passos "Alterações da lista (diff)" → "Novo prazo" → "Avisar fornecedores" (lista dos convites `precisa_reconfirmar`, com o envio em duas etapas por convite, como na B.4).
- **Cancelar:** diálogo com motivo obrigatório. O texto avisa "Os fornecedores com link verão "Cotação encerrada". Os pedidos voltam para "aguardando compra"."

---

### B.6 Cadastro de fornecedores (prioridade: ALTA)

**`FornecedoresPagina`** (`#/compras/fornecedores`).

- **Cabeçalho:** `<h2>Fornecedores</h2>`, busca (`type="search"`, rótulo visível), filtro Ativos/Inativos/Todos, filtro por categoria e o botão "＋ Novo fornecedor".
- **Lista:**
  - **Desktop:** `.cmp-tabela` com Empresa, Contato, WhatsApp, Categorias, Taxa de resposta, Vitórias, Situação (selo ✅ Ativo / ⏸ Inativo) e Ações.
  - **Mobile:** cartões (`.cmp-cartao`), com o WhatsApp como link `tel:`/`wa.me` em área de toque de 44 px.
  - "Taxa de resposta" e "Vitórias" ficam como `—` quando não há dados.
- **Ações por linha:** Editar, Inativar/Ativar, Excluir (só se permitido, CA4) e Anonimizar (só Administrador).
  - Ações com ícone sozinho têm `aria-label` com o nome da empresa, por exemplo "Editar Elétrica X".
  - O "Excluir" desabilitado mostra o motivo no texto: "Tem cotações ou compras. Use Inativar."

**Modal de criar/editar** (`.cmp-janela`):

| Campo | Regras e texto |
|---|---|
| Nome do contato * | rótulo visível; erro "Informe o nome do contato" |
| Empresa * | erro "Informe a empresa" |
| WhatsApp * | `inputmode="tel"`, máscara `(41) 99999-9999`; aceita colar `+55 41…`; dica "Com DDD. Ex.: (41) 99999-9999"; erro "Número inválido. Use DDD + número (10 ou 11 dígitos)" |
| Documento (CNPJ/CPF) | opcional; valida só o formato, sem bloquear |
| E-mail | opcional, `type="email"` |
| Categorias | chips livres: `Enter` adiciona, `Backspace` remove o último; cada chip tem botão "Remover categoria {x}" |
| Observação | opcional, até 500 caracteres |

- **Duplicado** (CA3): erro de campo "Este WhatsApp já está cadastrado para esta empresa" e link "Ver cadastro existente".
- **Fluxo curto:** "Salvar" fecha o modal e mostra o toast "Fornecedor salvo". O modo inline (no assistente) devolve o fornecedor já selecionado.
- **Anonimizar (LGPD):** confirmação dupla.
  1. Diálogo explica: "Os dados pessoais serão apagados e isto não pode ser desfeito. O histórico de cotações é mantido."
  2. O botão final só habilita depois de digitar o nome da empresa.
- **Estados:** carregando (`.cmp-skeleton`), vazio ("Nenhum fornecedor ainda. Cadastre o primeiro para enviar cotações." + botão), busca sem resultado ("Nada encontrado. Limpar busca"), erro (`.cmp-aviso-erro` + "Tentar novamente").
- **Permissão:** só COMPRAS e Administrador veem a página.

---

### B.7 Histórico de preços (prioridade: MÉDIA)

**`PrecosPagina`** (`#/compras/precos`).

- **Lista:** busca de material + `.cmp-tabela` com Material, Unid., Última compra (R$ e data), Média 6 m, **Menor** (R$ e data), **Maior**, Nº de compras e a variação da última vs. média.
  - Mobile: cartões com as mesmas informações.
- **"Mais barato / mais caro":**
  - Dois blocos lado a lado, ícones 🟢 e 🔴 com texto: "Mais barato: R$ 4,10 · Casa Y · 12/05" e "Mais caro: R$ 5,60 · Loja Z · 03/09".
  - Mostra a diferença: "Diferença: R$ 1,50 (+36,6% sobre o mais barato)".
  - Base do %: o preço do mais barato. Declarar a base no texto para evitar ambiguidades.
- **Detalhe do material** (drawer):
  - Histórico (`compras_material_historico`) em tabela (data, fornecedor, quantidade, preço unitário, variação vs. compra anterior em R$ e %, cotação).
  - **Sparkline SVG** (sem echarts): linha única, pontos clicáveis desnecessários. Obrigatório: `role="img"` com `aria-label` descrevendo ("Preço de R$ 4,10 a R$ 5,60 nos últimos 6 meses, último R$ 4,80"), a **tabela é a alternativa acessível** (sempre disponível logo abaixo), cor azul `--accent-blue` com mínimo e máximo marcados por ponto + rótulo de texto (verde e vermelho **mais** o texto "menor"/"maior").
  - Linha de referência tracejada com a média, rotulada.
  - Para poucos pontos (< 3): sem sparkline, só a tabela, com "Poucos dados para gráfico".
- **Mesclar com…** (D12): seletor com busca, resumo do efeito ("As compras de "Cabo 2,5mm" passam para "Cabo flexível 2,5 mm". Isso não pode ser desfeito.") e confirmação.
- **Estados:** carregando (`.cmp-skeleton`), vazio ("O histórico começa na primeira cotação decidida."), sem resultado, erro.
- **Permissão** (D16): só COMPRAS e Administrador.

---

### B.8 `ModalAlterarItens` e aviso ao solicitante (prioridade: ALTA)

Abre em `DetalhePedidoCompras` pelo botão "✏️ Alterar itens" (visível nos status do §11). Modal `.cmp-janela` (tela cheia no celular).

```
┌ Alterar itens · {título do pedido}                  [×] ┐
│ [faixa âmbar se em cotação enviada]                     │
│ Este pedido está na cotação nº 123, já enviada a 4      │
│ fornecedores. Ao aplicar, a cotação será revisada.      │
├─────────────────────────────────────────────────────────┤
│ 1 Cabo flexível 2,5 mm — 300 m                          │
│   Quantidade [ − 300 + ]  [Corrigir nome/un.]           │
│   [Substituir por…]  [Remover]                          │
│   → "Aumento de quantidade: pede aceite do solicitante" │
│ …                                                       │
│ [＋ Adicionar item]                                     │
├─────────────────────────────────────────────────────────┤
│ Motivo *  [chips] já temos em estoque · duplicado ·     │
│   correção de grafia/unidade · sem fornecedor ·         │
│   equivalente disponível · outro                        │
│   [ textarea, mín. 5 caracteres ]                       │
├─────────────────────────────────────────────────────────┤
│ Pré-visualização                                        │
│  ✅ Aplicado agora (ciência do solicitante)             │
│     • Cabo 2,5 mm: 300 → 250 m                          │
│  ❓ Aguardará aceite do solicitante                     │
│     • Adicionar: Fita isolante · 5 un                   │
├─────────────────────────────────────────────────────────┤
│ [Cancelar]                       [Aplicar alterações]   │
└─────────────────────────────────────────────────────────┘
```

- **Por item:** quantidade com `CampoQuantidade` (reaproveitado). As quatro ações são botões de texto (secondary, `execucao-btn-sm cmp-btn-toque`); item removido fica riscado **e** com o selo "Será removido" (não só o risco).
- **Classificação ao vivo** (`classificarAlteracao()`, mesma do servidor): cada alteração mostra uma etiqueta ao lado do item, ✅ "Ciência" ou ❓ "Pede aceite", e as duas listas da pré-visualização atualizam em `aria-live="polite"` (sem anunciar a cada tecla: debounce de 500 ms).
- **"Corrigir nome/unidade":** se o servidor rejeitar ("Use Substituir"), mostra o erro no item e a sugestão "Trocar por outro material? Use Substituir por…" (com botão que converte a ação).
- **Motivo:** chips são `radiogroup`; "outro" exige o texto. O motivo é copiado para o histórico e para o solicitante, por isso o texto de apoio é: "O solicitante verá este motivo."
- **Botão principal:**
  - Texto padrão: "Aplicar alterações". Se houver só aceites: "Enviar para aceite do solicitante". Se o pedido estiver em cotação enviada: "Aplicar e revisar cotação" e pede o **novo prazo** (chips, como em B.3.2).
  - Desabilitado (com o motivo em texto) enquanto não houver ao menos 1 alteração e o motivo.
  - Antes de aplicar, se houver remoção de todos os itens: aviso "Isto deixa o pedido sem itens" e confirmação extra.
- **Sucesso:** toast "3 alterações aplicadas. 1 aguarda aceite de {solicitante}." O pedido mostra o selo "❓ Aguardando solicitante" e a conversa exibe os questionamentos com o selo "Alteração da Compras" e o motivo. Para pedido em cotação enviada, navega para o detalhe da cotação, no passo "Avisar fornecedores".
- **Erros:** `.cmp-aviso-erro role="alert"` no topo do modal, mantendo o formulário.

#### B.8.1 Aviso ao solicitante (Execução)

Textos de notificação e de histórico, tom claro e sem jargão de compras:

| Caso | Notificação (sino) | Texto no histórico/conversa |
|---|---|---|
| Ciência (qtd menor, remoção, correção) | "✏️ A Compras alterou a lista do pedido de {cliente}" | "Compras alterou a lista (ciência): Cabo 2,5 mm de 300 m para 250 m. Motivo: {motivo}" |
| Aceite: aumento de quantidade | "❓ A Compras pede sua confirmação no pedido de {cliente}" | "Aumento de quantidade: de 300 para 400 m. Motivo: …" + botões "Aprovar" / "Reprovar" |
| Aceite: substituição | idem | "➕/🔁 Substituir "{A}" por "{B}". Motivo: …" |
| Aceite: adição | idem | "➕ Adição de item: {nome}, {qtd} {un}. Motivo: …" |
| Alerta de 24 h úteis sem resposta (D14) | "⏳ Aguardando sua resposta há 1 dia útil" | — |

- Selos fixos nos itens do histórico: "✏️ Alteração da Compras" e "🧾 Cotação".
- **Edição direta bloqueada** (pedido em cotação enviada): mensagem no `PedidoMaterial`, em `.cmp-aviso` ou equivalente da Execução: "Este pedido está em cotação com fornecedores. Peça a alteração à Compras." Nunca expõe fornecedor, preço ou número de fornecedores ao solicitante (N5).
- O solicitante **nunca vê preços** (D16). Ao decidir, o histórico mostra só "Fornecedor escolhido: {empresa}" (N5).
- **Acessibilidade:** botões Aprovar/Reprovar com rótulo textual e `aria-describedby` apontando para a descrição do questionamento. As notificações usam o mesmo componente do sino (`NotificacoesDropdown`).

---

### B.9 Estados globais do módulo Compras (referência para F-05/F-06)

| Estado | Padrão visual |
|---|---|
| Carregando | `.cmp-skeleton`, `aria-busy="true"` no container, sem spinner extra |
| Vazio | frase direta + 1 ação primária (nunca tela em branco) |
| Erro | `.cmp-aviso-erro role="alert"` + "Tentar novamente" (`execucao-btn-secondary`) |
| Sucesso | toast via `ExecucaoUIProvider` (já usado no módulo) com texto específico ("Fornecedor salvo"); nunca só um "OK" |
| Ação em andamento | botão com `aria-busy` + texto de gerúndio ("Salvando…"), desabilitado |
| Sem permissão | "Esta área é restrita à equipe de Compras." |

---

### B.10 Critérios de aceite de UI/UX (para revisão de F-04, F-06 e demais telas)

1. Em 360 px de largura não há rolagem horizontal na página pública.
2. Todos os alvos de toque têm ≥ 44 × 44 px (medir com as ferramentas do navegador).
3. Contraste ≥ 4,5:1 para texto e ≥ 3:1 para bordas de campo, foco e ícones essenciais, nos dois temas.
4. Navegação completa só por teclado: formulário público, assistente, painel de envio, `ModalDecisao`, `ModalAlterarItens`. Foco visível, sem armadilhas (exceto os modais, com foco preso e `Esc`).
5. Leitor de tela: todos os campos têm rótulo; erros e mudanças de estado são anunciados (`aria-live`/`role="alert"`); a matriz tem `caption` e escopos; o sparkline tem alternativa em tabela.
6. Nenhum significado depende só de cor (selos sempre com emoji + texto; melhor preço com borda + "menor").
7. Todos os valores em pt-BR via `moeda.js` (R$, vírgula decimal, `dd/MM`, sinais `+` e `−` nas variações).
8. A página pública não exibe nenhum dos dados proibidos do §9.4 em nenhum estado, nem em mensagens de erro.
9. Os 8 estados do §B.1.5 (carregando, válido, prazo encerrado, encerrada, link inválido, link substituído, muitas tentativas, indisponível) mais enviado e erro de envio têm tela própria e foram verificados no celular real.
10. `prefers-reduced-motion` respeitado; sem animações essenciais.

### B.11 Pontos para o Frontend confirmar e pendências

- **Botão primário no Compras:** `--compras-brand` (`#14b8a6`) com texto branco dá ~2,5:1. Se `execucao-btn-primary` usar essa cor com texto branco, **falha o AA**. Verificar o estilo real e, se confirmado, usar texto `#0f172a` sobre o teal, ou escurecer o fundo para `#0d9488` com texto de 700 (ainda 3,7:1, só serve para texto grande). Recomendo texto escuro sobre `#14b8a6` (7:1). Prioridade: média, e só no que for novo; não alterar o que já existe sem validar com o dono.
- **`quantidade_disponivel`:** o plano prevê o campo; o front deve tratá-lo como opcional e nunca exibir "parcial" ao fornecedor como compromisso de compra.
- **Realtime:** o destaque de 3 s do `DashboardCompras` deve ser reaproveitado via a mesma lógica `destaques`, sem duplicar.
- **Não validado visualmente:** os layouts acima são especificação. Rever com screenshots em 360, 768 e 1280 px depois da F-04 e da F-06.

### Pendências de UX

- Layouts (wireframes e tokens) são especificação: o agente de UX não executou o app nem validou no navegador. Confirmar visualmente após F-04 e F-06 (ver B.11).
- Tokens de contraste da célula (matriz): adotados na consulta de UX (confiança 0,94).
- Lista por item no celular (B.5.4): mantida como definida no §10.5, sem consenso confirmado (confiança 0,56). Validar com o dono se a lista substitui a matriz no celular.
- "Tenho / Não tenho" (B.1.3): mantido como segmentado (`radiogroup`), conforme §9.3, e não como checkbox (confiança 0,16 para a alternativa).
- Estilo do botão primário no Compras (B.11): depende de validar com o dono antes de alterar o que já existe.

## Anexo C: contrato final do banco (migrations 34–37 por B-05; 38 e 39 por B-06/B-07; escritas e _NÃO aplicadas até 2026-11-02_, aplicadas depois)

> **Estado anterior a 2026-11-02** _(texto original, obsoleto)_: as migrations 34–37 estão **escritas como arquivos e NÃO aplicadas** (a aplicação é a B-08, depois da revisão Q-02). Não houve execução de SQL, então **nada foi testado contra um banco**: a sintaxe plpgsql não foi validada por parser. O Q-02 deve revisar e a B-08 deve rodar `get_advisors` (security/performance) e o teste de paridade VP-PAR. Ordem obrigatória: 34 → 35 → 36 → 37 (34 e 36 referenciam tabelas/colunas criadas depois; só funcionam com o lote completo aplicado).
>
> **Estado atual (2026-11-02):** migrations 33–40 aplicadas no Supabase de produção (B-08); ver *Status consolidado* e Anexo A.
>
> **Convenções.** Todas as RPCs autenticadas: `SECURITY DEFINER`, `search_path = public`, `REVOKE ... FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`, validam `is_compras()` (COMPRAS e Administrador) dentro. Erros de negócio = `RAISE EXCEPTION` em pt-BR (o service devolve `{ success:false, message }`). Helpers internos não têm grant. As únicas funções com `GRANT` para `anon` são `cotacao_publica_obter` e `cotacao_publica_responder`.

### C.1 Tabelas (todas com RLS; policy única `FOR SELECT TO authenticated USING ((SELECT is_compras()))`; anon sem acesso; escrita só por RPC)

| Tabela | Migration | Observação |
|---|---|---|
| `compras_config` | 34 | Linha única (`id=1`). Colunas do §5.1. Mensagens usam os placeholders `{contato} {empresa_publica} {numero} {qtd_itens} {link} {prazo}` (**`{empresa_publica}`**, e não `{empresa}` como na tabela do §5.1). |
| `compras_config_segredo` | 34 | **Sem policy e sem grant** (`pepper_ip`, gerado por `gen_random_uuid()`, sem depender de pgcrypto). |
| `compras_fornecedores`, `compras_materiais`, `compras_materiais_aliases` | 34 | §5.2–5.3. |
| `compras_cotacoes`, `_pedidos`, `_itens`, `_item_origens`, `_convites`, `_respostas`, `_resposta_condicoes`, `_resposta_itens`, `_decisoes`, `_decisao_itens`, `compras_precos_historico`, `compras_cotacao_eventos` | 35 | §5.4–5.7. `compras_cotacao_eventos.ip` (IP bruto) é legível por COMPRAS; é zerado após 12 meses por `compras_verificar_alertas`. |
| `compras_cotacao_tokens`, `compras_rate_limit` | 35 | **Sem policy; `REVOKE ALL` de anon e authenticated.** |
| Realtime (`supabase_realtime`) | 35 | `compras_cotacoes`, `compras_cotacao_convites`, `compras_cotacao_respostas`. |

Triggers em `execucao_pedidos_material` (35): `trg_pedido_guarda_cotacao` (BEFORE UPDATE OF itens) e `trg_pedido_guarda_cotacao_delete`. Regras do §7.3, com a leitura: a edição direta sem as flags `execucao.compras_rpc`/`compras.cotacao_rpc` é bloqueada só quando a cotação está `aberta` com algum convite fora de `nao_enviado`; nos demais casos de cotação ativa o trigger apenas liga `requer_revisao`.

`execucao_notificacoes.tipo` (34): aceita também `compra_cotacao` e `compra_alteracao`.

### C.2 RPCs autenticadas (assinatura real → retorno)

**Configuração, fornecedores e catálogo (34)**

| RPC | Retorno | Notas |
|---|---|---|
| `compras_config_obter()` | jsonb (linha de `compras_config`) | |
| `compras_config_salvar(p jsonb)` | jsonb (linha atualizada) | Só `Administrador`. Chaves parciais; valor fora da faixa → "Valor fora da faixa permitida…". |
| `compras_normalizar_whatsapp(p text)` | text \| null | `IMMUTABLE`, grant authenticated. Também `compras_normalizar_nome(text)` e `compras_normalizar_unidade(text)`. |
| `compras_fornecedor_salvar(p_id uuid, p_dados jsonb)` | uuid | `p_id` null cria. Duplicidade: "Já existe fornecedor com este WhatsApp nesta empresa". |
| `compras_fornecedor_definir_ativo(p_id, p_ativo)` | void | |
| `compras_fornecedor_excluir(p_id)` | void | Bloqueia se houve convite ou histórico: "Inative o fornecedor…". |
| `compras_fornecedor_anonimizar(p_id, p_motivo text)` | void | Só Administrador; motivo ≥ 5; revoga tokens vivos (`anonimizacao`). |
| `compras_material_sugerir(p_nome, p_unidade, p_limite int = 5)` | jsonb `[{id,nome,unidade,score,origem}]` | `origem`: `alias` \| `exato` \| `similar`. |
| `compras_material_salvar(p_id, p_nome, p_unidade, p_categoria = null)` | uuid | |
| `compras_material_mesclar(p_origem, p_destino, p_motivo = null)` | jsonb `{historico_movido, aliases_movidos}` | Mesma unidade. |

**Cotação (36)**

| RPC | Parâmetros | Retorno |
|---|---|---|
| `compras_cotacao_criar` | `p_pedidos uuid[]` (1–30), `p_observacao_publica`, `p_regiao_entrega` | `{cotacao_id, numero, itens}` |
| `compras_cotacao_montar_itens` | `p_cotacao`, `p_itens jsonb` (**null = recomposição automática**) | `itens` ativos |
| `compras_cotacao_incluir_pedidos` | `p_cotacao`, `p_pedidos uuid[]` | `{cotacao_id, itens, requer_revisao}` |
| `compras_cotacao_remover_pedido` | `p_cotacao`, `p_pedido`, `p_motivo` (≥ 3) | `{cotacao_id, itens, requer_revisao}` |
| `compras_cotacao_definir_fornecedores` | `p_cotacao`, `p_fornecedores uuid[]` (1–15) | `[{convite_id, fornecedor_id, status}]` |
| `compras_cotacao_abrir` | `p_cotacao`, `p_prazo timestamptz = null`, `p_mensagem = null` | `{cotacao:{id,numero,status,prazo_resposta,versao_lista}, links:[{convite_id,fornecedor_id,token}]}` (**token em claro só aqui**) |
| `compras_cotacao_gerar_link` | `p_convite`, `p_motivo = 'novo_link'` (`'lembrete'`) | `{convite_id, token}` |
| `compras_cotacao_registrar_envio` | `p_convite`, `p_canal` (`whatsapp`\|`copia`), `p_lembrete = false` | linha do convite (jsonb) |
| `compras_cotacao_prorrogar` | `p_cotacao`, `p_novo_prazo`, `p_motivo = null` | `{cotacao_id, prazo_resposta}` |
| `compras_cotacao_revisar` | `p_cotacao`, `p_motivo`, `p_novo_prazo` | `{versao_lista, convites_reconfirmar, itens}` |
| `compras_cotacao_cancelar` | `p_cotacao`, `p_motivo` (≥ 5) | void |
| `compras_cotacao_listar` | `p_filtros {status[],busca,de,ate,minhas}`, `p_limite` (1–100, 30), `p_cursor {created_at,id}` | `{itens:[{id,numero,status,prazo_resposta,requer_revisao,created_at,n_pedidos,n_itens,n_convites,n_enviados,n_respondidos,criado_por_nome}], proximo_cursor}` |
| `compras_cotacao_detalhe` | `p_cotacao` | `{cotacao, pedidos[+ativa], itens (inclui inativos), convites, respostas_atuais, referencias, eventos (100, sem IP), decisao?}` |
| `compras_cotacao_respostas_versoes` | `p_convite` | jsonb com todas as versões (itens e condições) |
| `compras_cotacao_decidir` | `p_cotacao`, `p_decisao jsonb` (ver `comprasCotacao.js`) | `{decisao_id, pedidos:[{pedido_id,status_compra,data_material_disponivel,etapa_chegada_id}]}` |
| `compras_precos_referencia` | `p_materiais uuid[]` (≤ 500) | `{<material_id>:{ultimo,media_janela,n_janela,menor,fora_janela,n_total}}` (só `comprado`; `menor` = menor VP de todo o histórico) |
| `compras_material_historico` | `p_material`, `p_limite = 50` | lista de `{id,tipo,condicao,parcelas,unidade,quantidade,preco_unitario_nominal,preco_unitario_vp,registrado_em,fornecedor_id,fornecedor,cotacao_id,cotacao_numero}` |
| `compras_verificar_alertas()` | — | `{aceites_alertados, cotacoes_vencendo, rate_limit_limpos}`. Throttle de 10 min. Aceites vencidos só são tratados quando a mig. 38 existir. Chamável por pg_cron (sessão `postgres`). |
| `compras_condicao_totais(...)` / `compras_valor_presente(total, tipo, parcelas, entrada, primeira_dias, taxa)` | puros (grant authenticated) | `compras_valor_presente` devolve o VP **dos itens, sem frete**; o frete é somado pelo chamador (N1). Usar ambos no teste VP-PAR. |

**Reescritas (36).** `compras_alterar_status(uuid,text,text,date)`: bloqueia `em_cotacao → aguardando_compra` ("Pedido está na cotação nº X: remova-o da cotação") e `em_cotacao → comprado` ("Decida pela cotação nº X") com cotação ativa, salvo a flag `compras.cotacao_rpc='1'`; cancelar remove o pedido da cotação. `compras_listar_pedidos`: nova coluna `cotacao_ativa {id,numero,status}` e filtro `sem_cotacao`; **o tipo de retorno mudou** (DROP + CREATE + GRANT; só afeta quem usa `select *` posicional). `compras_detalhe_pedido`: nova chave `cotacoes [{id,numero,status,ativa}]`.

### C.3 RPCs públicas (anon + authenticated; mig. 37)

`cotacao_publica_obter(p_token text) → jsonb` e `cotacao_publica_responder(p_token text, p_resposta jsonb) → jsonb`. Nunca lançam exceção de negócio: devolvem `{ok:false, codigo, ...}` (para o rate limit persistir). Token: 43 caracteres base64url, guardado só como `sha256`.

- `obter` (ok): `{ok:true, estado:'aberta'|'prazo_encerrado', empresa_contratante, cotacao:{numero,prazo_resposta,versao_lista,observacao,regiao_entrega}, fornecedor:{nome_contato,empresa}, itens:[{id,seq,descricao,unidade,quantidade,observacao,alterado_na_versao}], precisa_reconfirmar, resposta|null}`. Cotação encerrada/cancelada ou link revogado por encerramento/anonimização: `{ok:true, estado:'encerrada', empresa_contratante}`.
- Entrada do `responder` (e formato de `obter().resposta`, mais `versao` e `enviado_em`): `{versao_lista, recusou?, prazo_entrega_dias, frete:{tipo:'cif'|'valor', valor?}, observacao?, itens:[{id, tem_item, preco_unitario?, quantidade_disponivel?, observacao?}], condicoes:[{tipo:'a_vista', desconto_tipo?, desconto_valor?} | {tipo:'parcelado', parcelas, entrada_valor?, primeira_parcela_dias?, total?}]}`. Em `obter().resposta.itens[].id` é o id da linha da cotação.
- `responder` (ok): `{ok:true, versao, enviado_em}`.
- Códigos: `INDISPONIVEL`, `LINK_INVALIDO`, `LINK_SUBSTITUIDO`, `MUITAS_TENTATIVAS`, `PRAZO_ENCERRADO`, `COTACAO_ENCERRADA`, `LISTA_ALTERADA`, `PAYLOAD_GRANDE`, `LIMITE_VERSOES`, `DADOS_INVALIDOS` (com `campo` no formato `itens[2].preco_unitario` e `mensagem` em pt-BR).
- Limites padrão (configuráveis): token 60 leituras / 10 respostas por 10 min; IP 120 / 30 por 10 min; global 600 respostas por hora. Sem IP em `request.headers`, valem só token e global.
- **Kill switch:** `compras_config.link_publico_ativo=false` (devolve `INDISPONIVEL`) ou `REVOKE EXECUTE ON FUNCTION public.cotacao_publica_obter(text), public.cotacao_publica_responder(text, jsonb) FROM anon;`.

### C.4 Divergências em relação aos §5–7

1. `compras_token_hash` fica na 36 (usada por `compras_cotacao_abrir`), não na 37.
2. `compras_cotacao_eventos.tipo` aceita também `alerta_vencendo`.
3. `compras_cotacao_montar_itens(p, null)` recompõe automaticamente; `compras_cotacao_detalhe` também devolve `decisao` e `pedidos[].ativa`; `itens` inclui as linhas inativas.
4. Placeholder de mensagem `{empresa_publica}` (§10.3), não `{empresa}`.
5. Item de pedido sem quantidade numérica > 0 conta como quantidade 1 na consolidação.
6. Migrations 38/39 (B-06/B-07): ver C.6 e C.7. Divergências: (a) `compras_listar_questionamentos` também mudou de tipo de retorno (3 colunas no fim: `origem`, `motivo_alteracao`, `prazo_resposta_em`) → DROP + CREATE; (b) `compras_alterar_itens` rejeita ações em item que tenha questionamento aberto e rejeita lista que ficaria vazia; (c) `compras_cotacao_revisar` só é chamada quando houve alguma ciência aplicada (só aceites: a revisão ocorre quando o aceite for aprovado, via `requer_revisao` do trigger da 35).

### C.5 Riscos e rollback

- **Risco principal:** a 36 reescreve 3 RPCs a partir dos arquivos 25/26/28 + gate da 33, sem confronto com `pg_get_functiondef` de produção (sem acesso). Conferir pela consulta (3b) antes de aplicar.
- Temp tables `_cmp_cur` (`ON COMMIT DROP`) em `compras_cotacao_recompor`: precisam do privilégio TEMP do dono da função (padrão do Supabase).
- Rollback: cada migration traz o bloco `-- ROLLBACK:` no cabeçalho (ordem inversa 37 → 34). Tabelas só devem ser dropadas após exportar os dados.
- Serviço: `src/services/supabase/comprasCotacao.js` (novo) e `execucaoCompras.js` (`verificarAlertas`, filtro `semCotacao`). Sem alteração de componentes React.

### C.6 Migration 38: alterações da atendente (escrita; _estado anterior a 2026-11-02: NÃO aplicada_; sintaxe SQL e plpgsql validadas só por parser, sem banco)

**Tabela `execucao_pedidos_questionamentos`:** CHECK `tipo` aceita `'adicao'`; colunas `origem text NOT NULL DEFAULT 'questionamento'` (`'questionamento'|'alteracao_compras'`), `motivo_alteracao text` (≤ 500), `prazo_resposta_em timestamptz`, `alerta_enviado_em timestamptz`; índice parcial `idx_quest_aceite_vencendo`. RLS inalterada. `compras_verificar_alertas` (36) passa a tratar aceites vencidos assim que as colunas existirem.

| RPC | Gate | Retorno / regra |
|---|---|---|
| `compras_alterar_itens(p_pedido uuid, p_alteracoes jsonb, p_motivo text, p_revisar_cotacao jsonb = null)` | `is_compras()` | `{aplicadas:[{acao,item_id,resumo}], pendentes_aceite:[{questionamento_id,acao,item_id}], status_compra, cotacao?:{id,numero,versao_lista,revisada}}` (chaves nulas omitidas). Alterações 1–50; motivo 5–500. Status do pedido ∈ aguardando_compra, em_cotacao, aguardando_solicitante. **Ciência (aplicada na hora):** `quantidade` menor (un/cx/pct com `ceil`), `remover`, `corrigir` (nome igual após normalização, ou `similarity ≥ 0.6`, e unidade igual ou sinônima; senão erro "use Substituir"). **Aceite (questionamento `origem='alteracao_compras'`, prazo = `compras_somar_horas_uteis(now(), prazo_aceite_horas_uteis)`):** `quantidade` maior → tipo `quantidade`; `substituir` → `substituicao` (sugestao `{nome, unidade?, quantidade?}`); `adicionar` → `adicao` (sugestao `{nome, quantidade, unidade}`, todos obrigatórios). Ciências geram 1 histórico `alteracao_compras` (`dados_anteriores/novos = {itens}`, motivo) e 1 notificação `compra_alteracao` ao solicitante (TECNICO → admins). Em cotação `aberta` já enviada, sem `p_revisar_cotacao {novo_prazo}` → erro `Pedido em cotação enviada: use "Aplicar e revisar cotação"`; com ele e ao menos 1 ciência, chama `compras_cotacao_revisar` na mesma transação. Erros extras: item com questionamento aberto, item repetido na chamada, ação inválida, lista ficaria sem itens. Tudo ou nada (uma transação). |
| `compras_abrir_questionamento(uuid, text, text, text, jsonb)` | `is_compras()` | Assinatura e retorno (uuid) inalterados. Agora aceita `p_tipo='adicao'` (`p_item_id` ignorado/NULL; `sugestao{nome, quantidade>0, unidade}` obrigatória). Corpo em `execucao_compras_abrir_questionamento_interno(p_uid, p_pedido, p_item_id, p_tipo, p_pergunta, p_sugestao, p_origem, p_motivo, p_prazo)` (sem grant). |
| `compras_responder_questionamento(uuid, boolean, text)` | solicitante não TECNICO ou `is_admin_execucao()`; `substituicao` só admin | Retorno inalterado `{questionamento_id, status, status_compra, item_alterado}`. Aprovar `adicao` faz append `{nome, quantidade, unidade}` em `itens` (id pelo trigger da 23; `ceil` para un/cx/pct). Histórico com `tipo_alteracao='alteracao_compras'` quando `origem='alteracao_compras'`, senão `questionamento`. Em cotação ativa, o trigger da 35 liga `requer_revisao`. |
| `compras_listar_questionamentos(p_pedido = null, p_status = null)` | `pode_ver_compras()` | Mesmas colunas + `origem`, `motivo_alteracao`, `prazo_resposta_em`. `compras_detalhe_pedido().questionamentos` herda as chaves. |
| `compras_somar_horas_uteis(timestamptz, int)`, `compras_parse_quantidade(text)` | internas (sem grant) | Horas úteis: cada 24 h = 1 dia útil seg–sex (America/Sao_Paulo, mantém o horário), pulando feriado nacional `considerar_feriado` (recorrente por dia/mês); resto < 24 h em horas corridas. |

Notificações/tipos usados: `compra_alteracao` (ciência), `compra_questionamento` (aceite pendente, título "✏️ Alteração da Compras aguarda seu aceite"), `compra_resposta` (resposta). Histórico `alteracao_compras`.

Service: `execucaoComprasService.alterarItens(pedidoId, alteracoes, motivo, revisarCotacao?)` (`alteracoes[].itemId` → `item_id`; `revisarCotacao = { novoPrazo }`). `buscarQuestionamentosPedido` já devolve as colunas novas.

### C.7 Migration 39: KPIs (escrita; _estado anterior a 2026-11-02: NÃO aplicada_)

`compras_indicadores_cotacao(p_de date = null, p_ate date = null) → jsonb` (`is_compras()`; STABLE; padrão últimos 90 dias; máx. 5 anos). Retorno: `{periodo:{de,ate}, k1..k10, por_fornecedor:[...]}`; cada `kN` tem `suficiente` (limites do §12).
- `k1 {valor, pct, total_referencia, n_linhas}`; `k2 {acima, abaixo, neutras, acima_pct, abaixo_pct, neutras_pct, n_linhas}` (faixa = `faixa_neutra_pct`); `k3 {enviados, respondidos, recusaram, taxa}`; `k4 {primeira_resposta_horas, decisao_horas, n_primeira_resposta, n_decisao}` (medianas); `k5 {abertas, vencendo_24h, prazo_vencido, sem_respostas}`; `k6 {total, concentracao_pct, fornecedor_top, por_categoria[{categoria, valor}]}`; `k7 {cotacoes_com_ranking}`; `k8 {questionamentos, aprovados, reprovados, abertos, historicos, mediana_aceite_horas, por_atendente[{usuario_id, nome, questionamentos, historicos}]}`; `k9 {a_vista, parcelado, a_vista_pct, parcelado_pct}`; `k10 {itens[{material_id, nome, unidade, n_linhas, delta_pct, ref_medio, vp_medio}]}`.
- `por_fornecedor[{fornecedor_id, empresa, enviados, respondidos, recusaram, taxa, vitorias, participacoes, taxa_vitoria, gasto}]`.
- **Referência por linha (K1/K2/K10)** recalculada no momento da decisão (média do VP de compras anteriores de outras cotações, janela de `janela_referencia_meses`, fallback `fallback_ultimas_compras`), porque `compras_cotacao_decisao_itens` não grava a referência. Percentuais em pontos percentuais. K6/K9 usam valor nominal sem frete. K7: vitória = `recomendacao_snapshot.vencedor_recomendado_fornecedor_id` (decisões sem o campo ficam fora); `taxa_vitoria` = vitórias ÷ participações. K8 históricos: só os de `compras_alterar_itens` (`descricao 'Compras alterou a lista%'`).
- Service: `comprasCotacaoService.indicadoresCotacao(de, ate)` (já existia; comentário de contrato atualizado).

## Anexo D: guia rápido da atendente (preencher em D-01)

_pendente_

