# Graph Report - ToDo  (2026-10-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 687 nodes · 1741 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c8e5ba7b`
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
- public.execucao_notificacoes
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
- public.execucao_pedidos_material
- public.execucao_pops
- Como regenerar

## God Nodes (most connected - your core abstractions)
1. `react` - 88 edges
2. `react-icons` - 55 edges
3. `useAuth()` - 49 edges
4. `DashboardV2()` - 28 edges
5. `formatCurrency()` - 28 edges
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
- `3. Arquitetura de Arquivos` --references--> `useMetaPersistence()`  [INFERRED]
  PLANO_NOVO_DASHBOARD.md → src/features/dashboard/hooks/useMetaPersistence.js
- `Metas — 3 camadas de persistência` --references--> `getCurrentMetas()`  [INFERRED]
  DASHBOARD_COMERCIAL_CONTEXTO.md → src/config/metas.js

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "DashboardV2.jsx"
Cohesion: 0.10
Nodes (40): DashboardHeader(), MESES_INDICE, AcoesRapidasPanel(), BadgesVendedor(), BarraSemanas(), ClientesFechados(), FunilCompact(), getSaudacao() (+32 more)

### Community 1 - "useAuth"
Cohesion: 0.06
Nodes (64): App(), AppContent(), DashboardSelector(), AdminButton(), AdministradorasTable(), AdminPanel(), AlinhamentoModal(), ATALHOS_DIAS (+56 more)

### Community 2 - "react"
Cohesion: 0.08
Nodes (38): Metas — 3 camadas de persistência, echarts-for-react, ChartCard(), EditableGauge(), EditableMetricCard(), FunnelChart(), MetasDebugPanel(), MetricCard() (+30 more)

### Community 3 - "Dashboard.jsx"
Cohesion: 0.14
Nodes (26): echarts, react, react-icons, OriginChart(), ServicesChart(), ChartsThirdRow(), AgendaBase(), AgendaCivil() (+18 more)

### Community 4 - "VendorSalesTable.jsx"
Cohesion: 0.15
Nodes (15): react-dom, FitText(), PodiumCard(), RegionSalesTable(), SalesPodium(), EmptyState(), getRankingBadge(), getVendorColor() (+7 more)

### Community 5 - "✅ CHECKLIST DE IMPLEMENTAÇÃO"
Cohesion: 0.05
Nodes (38): 1. Estrutura do Projeto, 1. `execucao_atividades`, 2. Arquitetura Atual, 2. `execucao_atividades_historico`, 3. `execucao_atividades_comentarios`, 3. Sistema de Autenticação Atual, 4. `execucao_pedidos_material`, 4. Níveis de Acesso Existentes no Supabase (+30 more)

### Community 6 - "public.usuarios"
Cohesion: 0.20
Nodes (28): `fase` — case-sensitive UPPERCASE, 3. Arquitetura de Arquivos, useDashboardData(), extractClientesAtendidos(), extractClientesPorVendedor(), extractDespesas(), extractDistributionData(), extractFunil() (+20 more)

### Community 7 - "dataProcessing.js"
Cohesion: 0.11
Nodes (28): administradoras_sindicos_place_id_key, idx_administradoras_sindicos_cidade, idx_administradoras_sindicos_contato_realizado, idx_administradoras_sindicos_last_sync, idx_administradoras_sindicos_place_id, idx_apontamentos_created_at, idx_apontamentos_data_retomada, idx_apontamentos_fase (+20 more)

### Community 8 - "Dashboard Comercial — Contexto para Alterações Seguras"
Cohesion: 0.09
Nodes (16): codeNodesByFile, dbNodes, definedByLabel, GRAPH, lineOf(), missing, ownerNode(), ROOT (+8 more)

### Community 9 - "graph-link-db.mjs"
Cohesion: 0.08
Nodes (24): 1. Infra e conexão, 2.1 `apontamentos_comerciais` — 1.419 linhas (1.027 ativas, 392 inativas), 2.2 `metas_comerciais` — 22 linhas, 2.3 `vendedores` — 8 linhas, 2.4 `historico_alteracoes_apontamentos` — 5.271 linhas, 2. Tabelas do Dashboard Comercial, 3. Enums / valores esperados pelo código, 4. Arquitetura do frontend (+16 more)

### Community 10 - "tables.sql"
Cohesion: 0.10
Nodes (22): name, private, type, version, autoprefixer, axios, @emoji-mart/data, @emoji-mart/react (+14 more)

### Community 11 - "🎨 Plano: Novo Dashboard Comercial (V2) — Effort Engenharia"
Cohesion: 0.09
Nodes (22): 0. Decisões confirmadas, 10. O que NÃO vai mudar, 11. Backups e segurança, 12. Checkpoints de aprovação, 13. Perguntas antes de iniciar, 1. Objetivo, 2. Paleta Effort (extraída do site), 4. Estrutura visual do V2 (wireframe conceitual) (+14 more)

### Community 12 - "supabaseService.js"
Cohesion: 0.10
Nodes (23): access_levels_name_key, idx_arsenal_arquivos_created_at, idx_arsenal_financiamentos_created_at, idx_arsenal_financiamentos_nome, idx_arsenal_links_created_at, niveis_acesso_nome_key, page_permissions_access_level_id_page_id_key, pages_name_key (+15 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (21): 🏗️ Arquitetura do Projeto (Setembro 2025), ⚔️ Arsenal de Guerra, Banco de dados no grafo, 🚀 Como Executar, Dashboard Comercial - Copilot Instructions, 🏠 Dashboard Principal, 📁 Estrutura Modular Organizada, 📊 Funcionalidades do Sistema (+13 more)

### Community 14 - "public.execucao_notificacoes"
Cohesion: 0.13
Nodes (13): idx_execucao_comentarios_atividade, idx_execucao_comentarios_data, idx_execucao_planejamento_datas, idx_execucao_planejamento_responsavel, idx_execucao_planejamento_status, idx_templates_materiais_ativo, idx_templates_materiais_tipo, idx_usuarios_auth_user_id (+5 more)

### Community 15 - "public.usuarios"
Cohesion: 0.20
Nodes (10): idx_etapas_datas, idx_etapas_obra, idx_etapas_tipo, idx_execucao_obras_arquivos_obra_id, idx_obras_datas, idx_obras_responsavel, idx_obras_status, public.execucao_obras (+2 more)

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
Cohesion: 0.13
Nodes (15): idx_atividades_etapa_id, idx_execucao_atividades_data, idx_execucao_atividades_status, idx_execucao_atividades_tecnico, idx_execucao_atividades_tipo, idx_execucao_historico_atividade, idx_execucao_historico_data, idx_execucao_historico_usuario (+7 more)

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

### Community 28 - "public.execucao_pedidos_material"
Cohesion: 0.25
Nodes (8): idx_execucao_pedidos_atividade, idx_execucao_pedidos_data, idx_execucao_pedidos_solicitante, idx_execucao_pedidos_status, idx_historico_data, idx_historico_pedido_id, public.execucao_historico_pedidos, public.execucao_pedidos_material

### Community 33 - "Como regenerar"
Cohesion: 0.33
Nodes (5): Como regenerar, logic.sql, Quando regenerar, Snapshot do schema Supabase (para o graphify), tables.sql

## Knowledge Gaps
- **9 isolated node(s):** `autoprefixer`, `axios`, `@emoji-mart/data`, `@emoji-mart/react`, `postcss` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 205 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Dashboard.jsx` to `DashboardV2.jsx`, `useAuth`, `react`, `VendorSalesTable.jsx`, `public.usuarios`, `tables.sql`, `PlanejamentoMacro.jsx`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `DashboardV2()` (e.g. with `salvarMeta()` and `updateMetaInCode()`) actually correct?**
  _`DashboardV2()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `autoprefixer`, `axios`, `@emoji-mart/data` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardV2.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10491803278688525 - nodes in this community are weakly interconnected._
- **Why does `react-icons` connect `Dashboard.jsx` to `DashboardV2.jsx`, `useAuth`, `react`, `VendorSalesTable.jsx`, `tables.sql`, `PlanejamentoMacro.jsx`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.05648625429553265 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.07932310946589106 - nodes in this community are weakly interconnected._