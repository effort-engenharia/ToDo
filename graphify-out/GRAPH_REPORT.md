# Graph Report - ToDo  (2026-10-22)

## Corpus Check
- 129 files · ~121,475 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .css 3, .example 1)

## Summary
- 685 nodes · 1733 edges · 36 communities (30 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1406ad8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardV2.jsx
- useAuth
- react
- Dashboard.jsx
- VendorSalesTable.jsx
- ✅ CHECKLIST DE IMPLEMENTAÇÃO
- public.usuarios
- dataProcessing.js
- Dashboard Comercial — Contexto para Alterações Seguras
- graph-link-db.mjs
- tables.sql
- 🎨 Plano: Novo Dashboard Comercial (V2) — Effort Engenharia
- supabaseService.js
- package.json
- public.usuarios
- public.usuarios
- dependencies
- devDependencies
- public.users
- ProximoEventoModal.jsx
- tables.sql
- public.execucao_pops_arquivos
- public.execucao_templates_etapas
- PlanejamentoMacro.jsx
- PlanejamentoMacro.jsx
- public.execucao_notificacoes
- public.vendedores
- public.execucao_atividades
- supabaseService.js
- public.execucao_pops
- Como regenerar
- public.metas_comerciais
- public.execucao_planejamento_macro

## God Nodes (most connected - your core abstractions)
1. `react` - 88 edges
2. `react-icons` - 55 edges
3. `useAuth()` - 49 edges
4. `DashboardV2()` - 28 edges
5. `formatCurrency()` - 24 edges
6. `public.usuarios` - 23 edges
7. `Dashboard()` - 22 edges
8. `ExecucaoDashboard()` - 18 edges
9. `processRealData()` - 18 edges
10. `intervaloDoMesComercial()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `6. Checklist obrigatório antes de cada alteração` --references--> `useGoogleSheetsData()`  [INFERRED]
  DASHBOARD_COMERCIAL_CONTEXTO.md → src/hooks/useGoogleSheetsData.js
- `11. Backups e segurança` --references--> `LayoutProvider()`  [INFERRED]
  PLANO_NOVO_DASHBOARD.md → src/contexts/LayoutContext.jsx
- `**Fase 3: Widgets principais**` --references--> `useDashboardData()`  [INFERRED]
  PLANO_NOVO_DASHBOARD.md → src/features/dashboard/hooks/useDashboardData.js
- `Metas — 3 camadas de persistência` --references--> `getCurrentMetas()`  [INFERRED]
  DASHBOARD_COMERCIAL_CONTEXTO.md → src/config/metas.js
- `Metas — 3 camadas de persistência` --references--> `useMetaPersistence()`  [INFERRED]
  DASHBOARD_COMERCIAL_CONTEXTO.md → src/features/dashboard/hooks/useMetaPersistence.js

## Import Cycles
- None detected.

## Communities (36 total, 6 thin omitted)

### Community 0 - "DashboardV2.jsx"
Cohesion: 0.10
Nodes (45): 3. Arquitetura de Arquivos, useDashboardData(), useMetaPersistence(), AcoesRapidasPanel(), BadgesVendedor(), BarraSemanas(), ClientesFechados(), FunilCompact() (+37 more)

### Community 1 - "useAuth"
Cohesion: 0.09
Nodes (40): react-dom, App(), AppContent(), DashboardSelector(), AdminButton(), AdministradorasTable(), AdminPanel(), AparenciaTab() (+32 more)

### Community 2 - "react"
Cohesion: 0.10
Nodes (30): echarts-for-react, ChartCard(), EditableGauge(), EditableMetricCard(), FunnelChart(), MetasDebugPanel(), MetricCard(), MultiTitleGauge() (+22 more)

### Community 3 - "Dashboard.jsx"
Cohesion: 0.14
Nodes (26): echarts, react, react-icons, OriginChart(), ServicesChart(), ChartsThirdRow(), AgendaBase(), AgendaCivil() (+18 more)

### Community 4 - "VendorSalesTable.jsx"
Cohesion: 0.23
Nodes (11): FitText(), PodiumCard(), RegionSalesTable(), SalesPodium(), EmptyState(), getRankingBadge(), getVendorColor(), MESES_CURTOS (+3 more)

### Community 5 - "✅ CHECKLIST DE IMPLEMENTAÇÃO"
Cohesion: 0.05
Nodes (38): 1. Estrutura do Projeto, 1. `execucao_atividades`, 2. Arquitetura Atual, 2. `execucao_atividades_historico`, 3. `execucao_atividades_comentarios`, 3. Sistema de Autenticação Atual, 4. `execucao_pedidos_material`, 4. Níveis de Acesso Existentes no Supabase (+30 more)

### Community 6 - "public.usuarios"
Cohesion: 0.26
Nodes (22): `fase` — case-sensitive UPPERCASE, extractClientesAtendidos(), extractDespesas(), extractDistributionData(), extractFunil(), extractGanhosPerdas(), extractMetaEntrada(), extractOrigemClientes() (+14 more)

### Community 7 - "dataProcessing.js"
Cohesion: 0.12
Nodes (25): administradoras_sindicos_place_id_key, idx_administradoras_sindicos_cidade, idx_administradoras_sindicos_contato_realizado, idx_administradoras_sindicos_last_sync, idx_administradoras_sindicos_place_id, idx_apontamentos_created_at, idx_apontamentos_data_retomada, idx_apontamentos_fase (+17 more)

### Community 8 - "Dashboard Comercial — Contexto para Alterações Seguras"
Cohesion: 0.09
Nodes (16): codeNodesByFile, dbNodes, definedByLabel, GRAPH, lineOf(), missing, ownerNode(), ROOT (+8 more)

### Community 9 - "graph-link-db.mjs"
Cohesion: 0.08
Nodes (25): 1. Infra e conexão, 2.1 `apontamentos_comerciais` — 1.419 linhas (1.027 ativas, 392 inativas), 2.2 `metas_comerciais` — 22 linhas, 2.3 `vendedores` — 8 linhas, 2.4 `historico_alteracoes_apontamentos` — 5.271 linhas, 2. Tabelas do Dashboard Comercial, 3. Enums / valores esperados pelo código, 4. Arquitetura do frontend (+17 more)

### Community 10 - "tables.sql"
Cohesion: 0.10
Nodes (22): name, private, type, version, autoprefixer, axios, @emoji-mart/data, @emoji-mart/react (+14 more)

### Community 11 - "🎨 Plano: Novo Dashboard Comercial (V2) — Effort Engenharia"
Cohesion: 0.09
Nodes (22): 0. Decisões confirmadas, 10. O que NÃO vai mudar, 11. Backups e segurança, 12. Checkpoints de aprovação, 13. Perguntas antes de iniciar, 1. Objetivo, 2. Paleta Effort (extraída do site), 4. Estrutura visual do V2 (wireframe conceitual) (+14 more)

### Community 12 - "supabaseService.js"
Cohesion: 0.12
Nodes (18): access_levels_name_key, idx_arsenal_arquivos_created_at, idx_arsenal_financiamentos_created_at, idx_arsenal_financiamentos_nome, idx_arsenal_links_created_at, page_permissions_access_level_id_page_id_key, pages_name_key, paginas_nome_key (+10 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (21): 🏗️ Arquitetura do Projeto (Setembro 2025), ⚔️ Arsenal de Guerra, Banco de dados no grafo, 🚀 Como Executar, Dashboard Comercial - Copilot Instructions, 🏠 Dashboard Principal, 📁 Estrutura Modular Organizada, 📊 Funcionalidades do Sistema (+13 more)

### Community 14 - "public.usuarios"
Cohesion: 0.12
Nodes (14): idx_historico_data, idx_historico_pedido_id, idx_notificacoes_atividade, idx_notificacoes_created_at, idx_notificacoes_lida, idx_notificacoes_tipo, idx_templates_materiais_ativo, idx_templates_materiais_tipo (+6 more)

### Community 15 - "public.usuarios"
Cohesion: 0.14
Nodes (15): idx_etapas_datas, idx_etapas_obra, idx_etapas_tipo, idx_execucao_obras_arquivos_obra_id, idx_execucao_pedidos_atividade, idx_execucao_pedidos_data, idx_execucao_pedidos_solicitante, idx_execucao_pedidos_status (+7 more)

### Community 16 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, axios, echarts, echarts-for-react, @emoji-mart/data, @emoji-mart/react, jspdf, jspdf-autotable (+6 more)

### Community 17 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+5 more)

### Community 18 - "public.users"
Cohesion: 0.15
Nodes (12): idx_logs_created_at, idx_logs_user_id, idx_sessions_expires, idx_sessions_token, idx_users_active, idx_users_email, update_users_updated_at, user_sessions_token_key (+4 more)

### Community 19 - "ProximoEventoModal.jsx"
Cohesion: 0.15
Nodes (13): idx_atividades_etapa_id, idx_execucao_atividades_data, idx_execucao_atividades_status, idx_execucao_atividades_tecnico, idx_execucao_atividades_tipo, idx_execucao_comentarios_atividade, idx_execucao_comentarios_data, idx_execucao_historico_atividade (+5 more)

### Community 20 - "tables.sql"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph:hooks, graph:rebuild, graph:update, jev, lint (+1 more)

### Community 21 - "public.execucao_pops_arquivos"
Cohesion: 0.29
Nodes (7): idx_execucao_pops_arquivos_pop, idx_execucao_pops_arquivos_tipo, idx_execucao_pops_ativo, idx_execucao_pops_categoria, idx_execucao_pops_ordem, public.execucao_pops, public.execucao_pops_arquivos

### Community 22 - "public.execucao_templates_etapas"
Cohesion: 0.33
Nodes (5): Build with TypeSafe, Compose and verify, Design the judgments, Find the useful shape, Read the live docs

### Community 23 - "PlanejamentoMacro.jsx"
Cohesion: 0.40
Nodes (4): Etapa 1 – Ícone e Login, Etapa 2 – Área de Administrador, Etapa 3 – Persistência e Logs, Resumo

### Community 24 - "PlanejamentoMacro.jsx"
Cohesion: 0.61
Nodes (8): AlertasEtapasAtrasadas(), formatarDataBR(), formatarDataCurta(), GanttChart(), parseDataLocal(), PlanejamentoMacro(), ResumoEtapas(), TEMPLATES_ETAPAS_FALLBACK

### Community 25 - "public.execucao_notificacoes"
Cohesion: 0.40
Nodes (5): idx_templates_etapas_ativo, idx_templates_etapas_itens_template, idx_templates_etapas_tipo_obra, public.execucao_templates_etapas, public.execucao_templates_etapas_itens

### Community 28 - "supabaseService.js"
Cohesion: 0.08
Nodes (37): AlinhamentoModal(), ATALHOS_DIAS, ApontamentosTable(), CRITERIOS_DISPONIVEIS, GerenciarDuplicadosModal(), LoginModal(), ATALHOS_DIAS, formatBR() (+29 more)

### Community 33 - "Como regenerar"
Cohesion: 0.33
Nodes (5): Como regenerar, logic.sql, Quando regenerar, Snapshot do schema Supabase (para o graphify), tables.sql

### Community 34 - "public.metas_comerciais"
Cohesion: 0.40
Nodes (5): idx_metas_ativo, idx_metas_tipo_mes_ano, unique_meta_ativa, update_metas_comerciais_updated_at, public.metas_comerciais

### Community 35 - "public.execucao_planejamento_macro"
Cohesion: 0.50
Nodes (4): idx_execucao_planejamento_datas, idx_execucao_planejamento_responsavel, idx_execucao_planejamento_status, public.execucao_planejamento_macro

## Knowledge Gaps
- **9 isolated node(s):** `@emoji-mart/data`, `@emoji-mart/react`, `@tailwindcss/typography`, `axios`, `@types/react` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 204 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Dashboard.jsx` to `DashboardV2.jsx`, `useAuth`, `react`, `VendorSalesTable.jsx`, `tables.sql`, `PlanejamentoMacro.jsx`, `supabaseService.js`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardV2()` (e.g. with `salvarMeta()` and `updateMetaInCode()`) actually correct?**
  _`DashboardV2()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@emoji-mart/data`, `@emoji-mart/react`, `@tailwindcss/typography` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardV2.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09814563545906829 - nodes in this community are weakly interconnected._
- **Why does `react-icons` connect `Dashboard.jsx` to `DashboardV2.jsx`, `useAuth`, `react`, `VendorSalesTable.jsx`, `tables.sql`, `PlanejamentoMacro.jsx`, `supabaseService.js`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.09085213032581453 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.09653092006033183 - nodes in this community are weakly interconnected._