# Dashboard Comercial - Copilot Instructions

Este é um dashboard comercial interativo desenvolvido em React com Tailwind CSS para acompanhar métricas de vendas e engajar o time comercial através de gamificação.

## ✅ Status do Projeto: SISTEMA COMPLETO E PRODUTIVO

O dashboard evoluiu para um sistema comercial completo com múltiplas funcionalidades integradas e arquitetura modular otimizada!

## 🚀 Tecnologias Utilizadas
- **React 19** com Vite para desenvolvimento moderno
- **Supabase** para banco de dados e backend
- **Tailwind CSS** para estilização responsiva
- **ECharts** para visualizações de dados avançadas
- **React Icons** para ícones modernos
- **Axios** para requisições HTTP
- **Emoji Mart** para seleção de emojis
- **MCP browsermcp** para automação de browser e testes

## 📊 Funcionalidades do Sistema

### 🏠 Dashboard Principal
- Interface responsiva com layout adaptativo
- Header com navegação entre módulos
- Status de conexão em tempo real
- Métricas de negócio integradas
- Tratamento de erros elegante
- **Sistema de Navegação**: 3 módulos principais (Dashboard, Apontamentos, Arsenal)

### 📋 Módulo de Apontamentos Comerciais
- **Gestão Completa de Oportunidades**: Cadastro e acompanhamento
- **Campos Detalhados**: Cliente, valor, fase, origem, vendedor responsável
- **Tabela Dinâmica**: Busca, filtros e ordenação
- **Integração Supabase**: Persistência em tempo real
- **Interface Intuitiva**: Formulário expansível e validações

### ⚔️ Arsenal de Guerra
- **Gerenciamento de Links**: Recursos úteis para vendas
- **Tabela de Administradoras**: Dados estruturados
- **Upload/Download**: Importação e exportação de dados
- **Interface Modular**: Organizacao em abas e seções

### 📈 Métricas de Negócio (Dashboard)
- **Receitas**: Recebido, A Receber, Atrasadas
- **Despesas**: Pago, A Pagar, Atrasadas  
- **Saldos**: Máximo, Mínimo, Média
- **Clientes**: Total atendidos no período
- **Metas**: Sistema de acompanhamento editável

### 📊 Visualizações de Dados
- **Funil de Negociações** (Gráfico Donut)
- **Vendas por Vendedor** (Gráfico de Barras)
- **Origem dos Clientes** (Gráfico Donut)
- **Serviços Negociados** (Gráfico de Barras)
- **Relacionamento por Vendedor** (Gráfico Donut)
- **Vendas por Região** (Gráfico de Barras)
- **Clientes Atendidos** (Gráfico Temporal)
- **Ganhos e Perdas** (Métricas Comparativas)

### 🎨 Interface e UX
- Design moderno com glass effect
- Gradientes e cores vibrantes
- Emojis para tornar a interface divertida
- Animações suaves de entrada
- Hover effects em cartões
- Responsivo para mobile, tablet e desktop
- Navegação intuitiva entre módulos

### 🔄 Integração de Dados
- **Supabase** como backend principal
- **Google Sheets API** para dados complementares
- Persistência em tempo real
- Sincronização automática
- Dados de exemplo para desenvolvimento
- Formatação de números e moedas em pt-BR

### 🛠️ Módulo Execução e Compras (obras)
- **Planejamento Macro**: obras, etapas e sub-etapas; Gantt e visões (semana, mês, ano, linha do tempo, tabela). No celular, lista de etapas e filtros em gaveta.
- **Técnico (Meu Dia)**: atividades do dia, iniciar/pausar/concluir, falta de material, evidências (foto, vídeo e áudio) com fila offline.
- **Conclusão**: observação opcional, horário e localização registrados no momento da conclusão; passos da etapa marcáveis.
- **POPs**: descrição e procedimento formatados (parágrafos e listas) na gestão e no técnico (`src/components/ui/TextoFormatado.jsx`).
- **Pedido de material**: cliente, quantidade inteira para `un`/`cx`/`pct`, histórico com diff de itens, filtro de período e questionamentos da Compras.
- **Dashboard de Compras** (nível `COMPRAS`, página `execucao/compras`): fila por status de compra, indicadores e questionamentos.
- **Fornecedores, cotação e preços** (nível `COMPRAS` + Administrador, rota `compras`): cadastro de fornecedores, cotação com um link por fornecedor via WhatsApp (`wa.me`), comparativo com valor presente, compra dividida, histórico de preços e alterações da atendente nas listas (ciência ou aceite).
- **Página pública de cotação** (`cotacao/index.html` → `src/cotacao-publica/`): fornecedor responde sem login pelo link `/cotacao/#<token>`. Entrada MPA separada do app; `public/_headers` aplica noindex e CSP. Exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no build do Netlify.
- **Estado**: front pronto; migrations 19–31 **aplicadas** no Supabase de produção em 2026-11-01 (ver "Migrations 19–31" em *Banco de dados no grafo*). Cotação: migrations 33–40 **aplicadas** em 2026-11-02 (ver "Migrations 33–40" no mesmo bloco); falta regenerar o snapshot do schema e definir as variáveis do Netlify.

## 🏗️ Arquitetura do Projeto (Setembro 2025)

### 📁 Estrutura Modular Organizada
```
src/
├── App.jsx                      # Componente raiz com navegação
├── main.jsx                     # Entry point React
├── index.css                    # Estilos globais Tailwind
├── assets/                      # Recursos estáticos
│   └── react.svg               # Logo React
├── components/                  # 17 componentes base
│   ├── AdministradorasTable.jsx     # Tabela de administradoras
│   ├── ApontamentosComercial.jsx    # Módulo principal apontamentos
│   ├── ApontamentosTable.jsx        # Tabela de apontamentos
│   ├── ArsenalDeGuerra.jsx          # Módulo arsenal de guerra
│   ├── ChartCard.jsx                # Wrapper de gráficos
│   ├── EditableGauge.jsx            # Gauge editável
│   ├── EditableMetricCard.jsx       # Cartões editáveis
│   ├── FunnelChart.jsx              # Gráfico funil
│   ├── MetasDebugPanel.jsx          # Debug de metas
│   ├── MetricCard.jsx               # Cartões de métrica
│   ├── MultiTitleGauge.jsx          # Gauge multi-título
│   ├── OriginChart.jsx              # Gráfico origem
│   ├── PodiumCard.jsx               # Pódio de vendedores
│   ├── RegionSalesTable.jsx         # Tabela vendas região
│   ├── SalesPodium.jsx              # Pódio de vendas
│   ├── ServicesChart.jsx            # Gráfico serviços
│   └── VendorSalesTable.jsx         # Tabela vendedores
├── features/                    # Módulos por funcionalidade
│   └── dashboard/               # Feature Dashboard
│       ├── components/          # 13 componentes dashboard
│       │   ├── ChartsFirstRow.jsx       # Primeira linha gráficos
│       │   ├── ChartsSecondRow.jsx      # Segunda linha gráficos
│       │   ├── ChartsThirdRow.jsx       # Terceira linha gráficos
│       │   ├── ClientesAtendidosChart.jsx # Gráfico clientes
│       │   ├── Dashboard.jsx            # Dashboard principal
│       │   ├── DashboardHeader.jsx      # Cabeçalho dashboard
│       │   ├── GanhosPerdas.jsx         # Métricas ganhos/perdas
│       │   ├── MainMetrics.jsx          # Métricas principais
│       │   ├── ModernMetricCard.jsx     # Cartão métrica moderno
│       │   ├── RelacionamentoChart.jsx  # Gráfico relacionamento
│       │   ├── SalesTables.jsx          # Tabelas de vendas
│       │   ├── StatusFooter.jsx         # Rodapé status
│       │   └── StatusIndicator.jsx      # Indicador de status
│       └── hooks/               # 2 hooks específicos
│           ├── useDashboardData.js      # Hook dados dashboard
│           └── useMetaPersistence.js    # Hook persistência metas
├── hooks/                       # 2 hooks globais
│   ├── useAnimations.js         # Hook animações CSS
│   └── useGoogleSheetsData.js   # Hook Google Sheets
├── layouts/                     # Layouts (vazio - para expansão)
├── services/                    # Camada de serviços
│   ├── index.js                 # Exportações principais
│   ├── supabaseService.js       # Compatibilidade (legacy)
│   └── supabase/                # Serviços modulares
│       ├── administradoras.js   # Serviços administradoras
│       ├── apontamentos.js      # Serviços apontamentos
│       ├── arsenal.js           # Serviços arsenal
│       ├── config.js            # Configuração Supabase
│       └── metas.js             # Serviços metas
├── utils/                       # 5 utilitários
│   ├── codeUpdater.js           # Atualizador de código
│   ├── dataProcessing.js        # Processamento dados
│   ├── extractors.js            # Extratores dados
│   ├── formatters.js            # Formatadores
│   └── processors.js            # Processadores
└── config/                      # Configurações
    └── metas.js                 # Configuração metas
```

### 🎯 Padrões Arquiteturais
- **Separação por Features**: Dashboard modularizado
- **Hooks Customizados**: Reutilização de lógica
- **Serviços Modulares**: Supabase organizado por domínio
- **Utils Especializados**: Processamento e formatação
- **Componentes Reutilizáveis**: DRY principle

### 🛠️ Módulo `src/features/execucao/`
```
src/features/execucao/
├── components/                  # Telas do módulo (ExecucaoDashboard, PlanejamentoMacro, POPs, PedidoMaterial...)
│   ├── compras/                 # Dashboard de Compras (fila, indicadores, detalhe, questionamento)
│   ├── planejamento/            # Planejamento Macro (Gantt, visões, cadastro, ListaEtapasMobile)
│   ├── pedido-material/         # Pedido de material (formulário, CampoQuantidade, DiffItens, FiltroPeriodo)
│   ├── tecnico/                 # Meu Dia, ModalConcluir, PassosAtividade, evidencias/ (foto, vídeo, áudio)
│   ├── capacidade/              # Capacidade da equipe e horas extras
│   ├── desempenho/              # Indicadores e gráficos
│   ├── historico/               # Histórico e auditoria de alterações
│   ├── config/                  # Configurações (jornadas, colaboradores, calendário, templates)
│   └── ui/                      # Modal, Estados, ErrorBoundary, ExecucaoUI
├── hooks/                       # useAtualizacaoTabelas, useMediaQuery, useAsyncData...
├── offline/                     # Fila de ações (outbox), sincronizador e cache de leitura
├── utils/                       # permissoes, conclusao, datas, formatos
└── styles/execucao.css
```
Serviços: `src/services/supabase/execucao*.js` (`execucaoCompras.js` chama as RPCs `compras_*`).

### 🛒 Módulo `src/features/compras/` e página pública `src/cotacao-publica/`
```
src/features/compras/            # Módulo Compras (nível COMPRAS + Administrador)
├── ComprasModulo.jsx            # Entrada do módulo (seções carregadas com lazy())
├── components/                  # Fila, cartões, detalhe do pedido, indicadores, alterar itens
│   ├── cotacao/                 # Assistente de nova cotação, lista/detalhe, envio, comparativo, decisão
│   ├── fornecedores/            # Cadastro, anonimização, formatos
│   ├── precos/                  # Histórico de preços, material, sparkline
│   └── config/                  # Configurações do módulo (só Administrador)
├── hooks/                       # useComprasPainel, useCotacao, useCotacaoDisponivel, useTokensSessao
├── utils/                       # navegacaoCompras, statusCompra, alteracoesLista
│   └── cotacao/                 # comparacao, comparativo, envio, historicoPrecos, mensagemWhatsapp, moeda, montagem, normalizacao, validacaoResposta, tokensSessao, adaptadores
└── styles/compras.css

src/cotacao-publica/             # Página pública do fornecedor (sem supabase-js; fetch direto nas RPCs públicas)
├── CotacaoPublica.jsx, main.jsx, api.js, formulario.js, cotacao-publica.css
└── componentes/                 # CartaoItem, BlocoCondicoes, BlocoEntrega, RodapeResumo, CampoErro, EstadoMensagem

cotacao/index.html               # Entrada HTML da página pública (declarada em vite.config.js; fora do SW)
```
Serviço: `src/services/supabase/comprasCotacao.js` (uma função por RPC de fornecedores e cotação, com `wrapServiceWithImpersonationGuard`).

## 🚀 Como Executar
1. `npm install` - Instalar dependências
2. `npm run dev` - Executar em desenvolvimento
3. `npm run build` - Build para produção
4. `npm run lint` - ESLint
5. `npm run check:contract` - Contrato entre services e componentes
6. `npm run test:unit` - Testes unitários dos helpers (`node:test`, sem dependência extra; script em `scripts/testes-unitarios.mjs`)
7. `npm run graph:update` - Atualiza o grafo do graphify e os vínculos com o banco

## 💻 Instruções para Desenvolvimento
- **Terminal**: Sempre utilize `bash` para comandos do terminal
- **Ambiente**: Windows com Git Bash configurado
- **Comandos**: Use sintaxe Unix/Linux (rm, ls, find, etc.)
- **Debugging Browser**: Usar console.log() e verificar via get_console_logs - NÃO screenshots automáticos
- **Prints Manuais**: Quando necessário visualizar interface, SEMPRE solicitar print manual ao usuário

## 🌐 Servidor de Desenvolvimento
- **URL Local**: http://localhost:5174
- **Hot Reload**: Ativo
- **Build Otimizado**: Pronto para produção

## 🎯 Próximos Passos (Roadmap)
- **Execução e Compras** (checklist completo no *Status consolidado* de `PLANO_MELHORIAS_EXECUCAO_COMPRAS.md`):
  - Cotação com fornecedores (`PLANO_COTACAO_FORNECEDORES.md`, *Status consolidado*): regenerar o snapshot `supabase/schema/`, definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Netlify e rodar os testes do §15 _(Texto original, obsoleto: "aplicar migrations 34–39 (B-08)" e "rodar o diagnóstico B-00", concluídos em 2026-11-02)_
  - Migrations 19–31 aplicadas em 2026-11-01 e snapshot `supabase/schema/` regenerado; dry-run de `corrigir_etapas_pai_concluidas.sql` dispensado (B0 sem etapas pai indevidas)
  - QA manual (Anexo E.5), validação visual do Planejamento (Q4) e testes de vídeo/áudio em aparelhos
  - Decidir P8 (data necessária × previsão de chegada) e exibir o indicador de conclusões sem localização (ACH-09)
  - Carregar `useGoogleSheetsData` só nas páginas do Comercial (hoje roda para todos os perfis)
- **Filtros Temporais**: Implementar filtros por período no dashboard
- **Notificações Push**: Sistema de alertas em tempo real
- **Dashboard Mobile**: Versão otimizada para dispositivos móveis
- **Exportação Avançada**: PDF/Excel com relatórios customizados
- **Analytics Avançados**: KPIs e insights automáticos
- **Integração CRM**: Conexão com sistemas externos

## graphify

For any question about this repo's architecture, structure, components, or how to add/modify/find
code, your first action should be `graphify query "<question>"` when `graphify-out/graph.json`
exists. Use `graphify path "<A>" "<B>"` for relationship questions and `graphify explain "<concept>"`
for focused-concept questions. These return a scoped subgraph, usually much smaller than the full
report or raw grep output.

Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
"explain the architecture", or anything that depends on how files or classes relate.

If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md`
only for broad architecture review or when query/path/explain do not surface enough context. Only read
source files when (a) modifying/debugging specific code, (b) the graph lacks the needed detail, or
(c) the graph is missing or stale.

Type `/graphify` in Copilot Chat to build or update the graph.

Atualização local sem LLM: `npm run graph:update` (os git hooks do graphify já reconstroem o grafo após commit/checkout/merge). Reconstrução completa: `npm run graph:rebuild`. Reinstalar hooks: `npm run graph:hooks`.

### Banco de dados no grafo

O grafo também cobre o schema Supabase: `supabase/schema/*.sql` é um snapshot (gerado via MCP do Supabase; não é migration) com tabelas, FKs, triggers, policies e índices, e `scripts/graph-link-db.mjs` liga cada arquivo/função de `src/` às tabelas que usa (arestas `uses` com `context: supabase.from`). Exemplos:

- `graphify explain "public.apontamentos_comerciais"` — quem usa a tabela, FKs, índices, triggers.
- `graphify path "ApontamentosComercial()" "public.historico_alteracoes_apontamentos"` — do componente até a tabela.
- `graphify affected "public.execucao_obras"` — impacto de mudar a tabela.

Ao alterar o schema (migrations via MCP), regenere o snapshot conforme `supabase/schema/README.md`.

#### Migrations 19–31 (lote 20261101): **aplicadas em 2026-11-01**
- Arquivos `supabase/migrations/20261101_19_*` a `20261101_31_*`, cada um com `-- ROLLBACK:` no topo. Ordem, dependências e registro de aplicação: `supabase/migrations/README.md`.
- Ordem real de aplicação: 29, 19, 20, 27, 21, 22, 23, 24, 25, 26, 30, 28, 31.
- **Não reaplicar a 19 depois da 20** (cria overload de `alterar_status_atividade`).
- `supabase/manutencao/` tem scripts de diagnóstico e correção de dados. **Não são migrations.**
- O snapshot `supabase/schema/` já foi regenerado após a aplicação do lote 19–31 (o snapshot do lote 33–40 segue pendente) e contém as RPCs `compras_*`, `execucao_marcar_passo` e `execucao_passos_pendentes_por_etapa`.

#### Migrations 33–40 (lote 20261102): **aplicadas em 2026-11-02**
- Arquivos `supabase/migrations/20261101_33_*` e `20261102_34_*` a `20261102_40_*`. Ordem, registro de versões e rollback: `supabase/migrations/README.md`; plano e Anexo A: `PLANO_COTACAO_FORNECEDORES.md`.
- A 33 estava pendente em produção e foi aplicada antes da 34. A 40 só cria dois índices (`aberta_em`, `decidido_em`).
- **Não reaplicar 25, 26 ou 28 depois da 36** (a 36 reescreve `compras_alterar_status`, `compras_listar_pedidos` e `compras_detalhe_pedido`). Tampouco reaplicar a 38 sem necessidade (reescreve `compras_*questionamento`).
- Só `cotacao_publica_obter` e `cotacao_publica_responder` são executáveis por `anon`. Kill switch: `compras_config.link_publico_ativo = false`.
- `pg_cron` não está habilitado: `compras_verificar_alertas()` e `compras_limpeza_publica()` não estão agendadas.
- O snapshot `supabase/schema/` ainda não contém as tabelas e RPCs de cotação; regenerar (`supabase/schema/README.md`) e rodar `npm run graph:update`.

## Jev (TypeSafe AI) — decisões rápidas e economia de tokens

Uso restrito ao fluxo de desenvolvimento (não integrar no app/bundle Vite). A chave fica em `API_JEV_AI` no `.env`.

Quando uma decisão for um julgamento curto e bem delimitado (escolher entre opções conhecidas, pontuar em uma escala, verificar se uma afirmação é verdadeira), prefira consultar o Jev em vez de raciocinar longamente:

```bash
npm run jev -- --state "<contexto curto ou @arquivo>" --questions '<json>'
```

- `choice`: escolher uma opção (ex.: qual camada/arquivo/abordagem). Retorna `choice` + `confidence`.
- `score`: posicionar em níveis ordenados (ex.: risco, complexidade). Retorna `score` (0..n-1) + `confidence`.
- `noul`: probabilidade (0–1) de uma afirmação ser verdadeira (ex.: "a mudança quebra a API pública").
- Faça várias perguntas independentes numa única chamada; cada pergunta deve ser atômica e o `state` deve conter o contexto necessário (combine com a saída de `graphify query`).
- `--questions` é um objeto indexado por id, não array: `'{"q1":{"type":"noul","instructions":"A mudança quebra a API pública"}}'`. `choice` exige `criteria` como objeto; `score` exige `criteria` como array de níveis; `noul` não usa `criteria`. A saída traz `answers` com os mesmos ids.
- Aja automaticamente só com confiança alta (choice/score ≥ 0.8, noul ≥ 0.8 ou ≤ 0.2); caso contrário, investigue no código ou pergunte ao usuário.
- Para detalhes da API e padrões, use a skill `typesafe-ai` em `.agents/skills/typesafe-ai/`.

**Registro de uso (medição):** cada agente em `.github/agents/` informa no fim do relatório `Uso de graphify/Jev: N consultas graphify, N consultas Jev`, e o orquestrador consolida esses totais no resumo final. Isso permite medir se graphify e Jev reduzem o consumo de tokens sem perda de qualidade. Como subagentes não têm memória, o orquestrador deve incluir essa instrução em todo prompt de delegação.
