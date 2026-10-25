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

## 🚀 Como Executar
1. `npm install` - Instalar dependências
2. `npm run dev` - Executar em desenvolvimento
3. `npm run build` - Build para produção

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
