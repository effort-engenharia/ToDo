# Dashboard Comercial — Contexto para Alterações Seguras

> **Status:** produção. Toda alteração deve ser conservadora, reversível e testada com dados reais.
> **Data da análise:** 2026-07-25
> **Escopo desta sessão:** Dashboard Comercial (NÃO o módulo Execução).

---

## 1. Infra e conexão

| Item | Valor |
|---|---|
| Projeto Supabase | `cadrulmppoxhsfjizcfy` (dashboard-effort, região `sa-east-1`, `ACTIVE_HEALTHY`) |
| URL | `https://cadrulmppoxhsfjizcfy.supabase.co` |
| Anon key (frontend) | hardcoded em [src/services/supabase/config.js](src/services/supabase/config.js#L5) |
| MCP no editor | `npx @supabase/mcp-server-supabase@latest --read-only --project-ref=cadrulmppoxhsfjizcfy` |
| Postgres | 17.6 |
| Frontend | React 19 + Vite 7 + Tailwind 3 + ECharts 5 |
| Sem edge functions | (`list_edge_functions` = 0) |

⚠️ **RLS DESABILITADO em 25 tabelas** (incluindo todas do Dashboard Comercial). Não vamos mexer nisso agora, mas fica registrado. Ver `remediation_sql` do advisor `get_advisors('security')`.

---

## 2. Tabelas do Dashboard Comercial

### 2.1 `apontamentos_comerciais` — 1.419 linhas (1.027 ativas, 392 inativas)

Registro central de oportunidades comerciais. Uma linha = uma oportunidade.

| Coluna | Tipo | NN | Default | Usada por |
|---|---|---|---|---|
| `id` | uuid | ✅ | `gen_random_uuid()` | PK |
| `tipo_oportunidade` | varchar | ✅ | — | Gráfico Serviços |
| `nome_cliente` | varchar | ✅ | — | Tabelas, filtros |
| `fase` | varchar | ✅ | — | Funil, ganhos/perdas |
| `origem_cliente` | varchar | ✅ | — | Origem, serviços por origem |
| `origem_outros` | varchar |   | — | Texto livre quando `origem_cliente='OUTROS'` |
| `proprietario_relacionamento` | varchar |   | — | Podium, vendedores, regiões |
| `valor_total_servico` | numeric |   | `0.00` | Receita, ganhos/perdas |
| `valor_entrada_servico` | numeric |   | `0.00` | Meta de entrada |
| `quantidade_parcelas` | int |   | `1` | — |
| `cidade_atendimento` | varchar |   | — | Ranking regiões |
| `cidade_outras` | varchar |   | — | Texto livre |
| `created_at` | timestamptz |   | `now()` | **filtro de mês/ano do dashboard** |
| `updated_at` | timestamptz |   | `now()` | AvisosEsquecidos |
| `ultimo_alinhamento_realizado` | timestamptz |   | — | Alinhamento diário |
| `cnpj_cliente`, `razao_social`, `nome_fantasia` | varchar |   | — | Cadastro |
| `logradouro`, `numero`, `bairro`, `municipio`, `uf`, `cep` | varchar |   | — | Endereço |
| `cronograma_data_inicio`, `cronograma_data_termino` | date |   | — | Cronograma |
| `contato_cliente` | varchar | ✅ | `''` | ⚠️ NOT NULL — inserts devem passar string vazia se ausente |
| `data_retomada_prevista` | date |   | — | **ProximosEventos** |
| `observacao_retomada` | text |   | — | ProximosEventos |
| `ativo` | boolean |   | `true` | Soft-delete |
| `motivo_inativacao` | text |   | — | Preenchido ao inativar |
| `duplicado_de` | uuid |   | — | Registro considerado duplicata |

**Índices existentes:**
- `idx_apontamentos_tipo_oportunidade`, `idx_apontamentos_fase`, `idx_apontamentos_proprietario`, `idx_apontamentos_created_at`
- `idx_apontamentos_data_retomada` (parcial: `WHERE data_retomada_prevista IS NOT NULL`)

### 2.2 `metas_comerciais` — 22 linhas

Metas mensais persistentes. Uma linha por `(tipo_meta, mes, ano)` ativa.

| Coluna | Tipo | NN | Default | Notas |
|---|---|---|---|---|
| `id` | int | ✅ | seq | PK |
| `tipo_meta` | varchar | ✅ | — | Enum: `valor_entrada` \| `clientes_atendidos` |
| `valor_meta` | numeric | ✅ | — | R$ ou nº de clientes |
| `mes` | int | ✅ | — | 1..12 |
| `ano` | int | ✅ | — | YYYY |
| `ativo` | bool |   | `true` | Marcar `false` desativa |
| `observacoes` | text |   | — | Auditoria |
| `created_at`, `updated_at` | timestamptz |   | `CURRENT_TIMESTAMP` | |

**Unique:** `unique_meta_ativa (tipo_meta, mes, ano, ativo)` — permite uma ativa e várias desativadas.

### 2.3 `vendedores` — 8 linhas

⚠️ **Contém dados mock** (`João Silva`, `Maria Santos`, `Pedro Costa`) misturados com os 5 vendedores reais (`EDGAR`, `EDUARDA`, `FÁBIO`, `PAMELLI`, `VITOR`). Usada apenas em [src/components/SalesPodium.jsx](src/components/SalesPodium.jsx) para persistir foto/comissão/posição, sincronizando com dados vindos dos apontamentos. **NÃO é usada nas métricas** (essas vêm do `proprietario_relacionamento` em `apontamentos_comerciais`).

| Coluna | Tipo | Notas |
|---|---|---|
| `id`, `nome`, `email` (unique), `foto_url`, `ativo` | — | Cadastro |
| `total_vendas_mes`, `comissao_mes` | numeric | Sincronizado do dashboard |
| `posicao_ranking` | int | Sincronizado |

### 2.4 `historico_alteracoes_apontamentos` — 5.271 linhas

Auditoria de alterações em `apontamentos_comerciais`. Escrito em cada `atualizarApontamento`, `registrarAlinhamento` e afins.

| Coluna | Tipo | Notas |
|---|---|---|
| `id`, `apontamento_id` (FK lógica), `campo_alterado`, `valor_anterior`, `valor_novo` (text), `data_alteracao`, `created_at` | — | Não há FK real, só índice em `apontamento_id` |

---

## 3. Enums / valores esperados pelo código

### `fase` — case-sensitive UPPERCASE

`PROSPECÇÃO` · `QUALIFICAÇÃO` · `NEGOCIAÇÃO` · `CONTRATO/VENDA` · `CANCELADO/PERCA`

✅ **100% dos registros no banco estão dentro desse enum** (query auditou). Alterar esses strings quebra:
- [src/utils/extractors.js](src/utils/extractors.js) — `switch(fase)` em `extractFunil`, `extractReceitas`, `extractGanhosPerdas`, `extractMetaEntrada`, `extractVendedores`, `extractRegioes`.

### `origem_cliente` — case-insensitive, matching fuzzy

`CARTEIRA` · `ADM` · `INDICAÇÃO` · `PROSPECÇÃO` · `GOOGLE` · `OUTROS`

Buckets no frontend: `carteira / adm / indicacao / prospeccao / google / outros` (substring match após `lowercase().trim()`).

✅ **100% dos registros mapeiam corretamente** para um bucket.

### `proprietario_relacionamento` — UPPERCASE

`EDGAR` · `EDUARDA` · `FÁBIO` · `PAMELLI` · `VITOR`

### `tipo_oportunidade` — ⚠️ **DUPLICIDADE CASE-SENSITIVE NO BANCO**

15 pares de duplicidade (registros antigos importados via chunks vs. registros novos criados via app):

| Canônico (UPPER) | Variantes no banco | Linhas |
|---|---|---|
| `ADEQUAÇÃO ELÉTRICA` | `Adequação elétrica`, `ADEQUAÇÃO ELÉTRICA` | 438 |
| `MEDIÇÃO OHMICA` | `Medição Ohmica`, `MEDIÇÃO OHMICA` | 282 |
| `CIVIL` | `Civil`, `CIVIL` | 37 |
| `LAUDOS` | `Laudos`, `LAUDOS` | 37 |
| `ESTAÇÃO DE RECARGA` | `Estação de recarga`, `ESTAÇÃO DE RECARGA` | 36 |
| `QUADROS DE BOMBA` | `Quadros de Bomba`, `QUADROS DE BOMBA` | 35 |
| `PROJETOS ELÉTRICOS` | `Projetos Elétricos`, `PROJETOS ELÉTRICOS` | 33 |
| `PRUMADAS` | `Prumadas`, `PRUMADAS` | 25 |
| … | … | … |

**Impacto:** o gráfico de Serviços mostra "Civil" e "CIVIL" como categorias separadas.
**Mitigação sugerida** (para discutir antes de aplicar):
1. Normalizar no processamento (apenas leitura, sem tocar no banco) — mais seguro
2. Rodar `UPDATE apontamentos_comerciais SET tipo_oportunidade = UPPER(tipo_oportunidade)` — resolve raiz mas exige tirar `--read-only` do MCP e escrever histórico. Discutir antes.

### `tipo_meta`

`valor_entrada` · `clientes_atendidos`. Valor atual (07/2026): 120.000 e 250 respectivamente.

---

## 4. Arquitetura do frontend

### Árvore de composição

```
App.jsx
 └─ Dashboard.jsx (src/features/dashboard/components)
     ├─ DashboardHeader          filtros mês/ano
     ├─ ProximosEventos          lê data_retomada_prevista >= today
     ├─ AvisosEsquecidos         lê updated_at + data_retomada_prevista
     ├─ StatusIndicator
     ├─ MainMetrics              4 cards: clientes, contratos, meta entrada, taxa
     ├─ ChartsFirstRow           FunnelChart, RelacionamentoChart, ClientesAtendidosChart
     ├─ ChartsSecondRow          Gauge clientes, GanhosPerdas, Gauge valor entrada
     ├─ ChartsThirdRow           ServicesChart, OriginChart, servicos fechados por origem
     ├─ SalesTables              RegionSalesTable, VendorSalesTable, SalesPodium
     └─ StatusFooter
```

### Pipeline de dados (fonte → tela)

```
Supabase (apontamentos_comerciais)
   │  supabase.from('apontamentos_comerciais').select('*').eq('ativo', true).order('created_at desc')
   ▼
apontamentosService.buscarApontamentos   [src/services/supabase/apontamentos.js:62]
   ▼
useGoogleSheetsData(month, year)         [src/hooks/useGoogleSheetsData.js]   ⚠️ nome legado; a fonte é Supabase
   │  filtra client-side por created_at (getMonth+1 == monthMap[selectedMonth])
   ▼
data (do período) + allData (total)
   ▼
useDashboardData                          [src/features/dashboard/hooks/useDashboardData.js]
   │  chama processSheetData(data, metaPersonalizada)
   ▼
processSheetData → extractors             [src/utils/processors.js, src/utils/extractors.js]
   ▼
dashboardData { funil, receitas, metaEntrada, clientesAtendidos, ganhosPerdas,
                servicosObject, origemClientes, servicosFechadosPorOrigem, regioes, vendedores }
   ▼
Componentes filhos
```

### Metas — 3 camadas de persistência

```
getCurrentMetas()  → busca Supabase (metas_comerciais, mes/ano atual, ativo=true)
       ↓ (fallback se falhar)
localStorage       → 'meta_valorEntrada', 'meta_clientesAtendidos'
       ↓ (fallback final)
METAS_CONFIG (src/config/metas.js) → valorEntrada=50000, clientesAtendidos=300
```

O hook `useMetaPersistence` grava simultaneamente no Supabase (`metasService.salvarMeta`) e localStorage a cada mudança. Tipos mapeados:
- App: `valorEntrada` ↔ DB: `valor_entrada`
- App: `clientesAtendidos` ↔ DB: `clientes_atendidos`

⚠️ Note que o Dashboard usa a meta do **mês corrente do relógio** (não do mês selecionado no filtro) por causa de `getCurrentMetas()`. Isso é intencional? — perguntar antes de mexer.

---

## 5. Riscos conhecidos (baseline antes de alterações)

| ID | Severidade | Descrição | Onde |
|---|---|---|---|
| R1 | 🔴 Alta | `tipo_oportunidade` duplicado (Civil/CIVIL etc) — gráfico de Serviços fica bagunçado | banco |
| R2 | 🟡 Média | Filtro do dashboard usa **apenas `created_at`** — retomadas fora do mês de criação são invisíveis no card principal | [useGoogleSheetsData.js](src/hooks/useGoogleSheetsData.js) |
| R3 | 🟡 Média | Sem paginação — `buscarApontamentos` retorna tudo (1.019 linhas hoje, cresce ~50/mês) | [apontamentos.js:62](src/services/supabase/apontamentos.js#L62) |
| R4 | 🟡 Média | 980 registros com `valor_entrada_servico=0`, 221 com `valor_total_servico=0`. Provavelmente normal em fases não-fechadas, mas confirmar. | banco |
| R5 | 🟡 Média | `vendedores` tem 3 registros mock (`João Silva`, `Maria Santos`, `Pedro Costa`). SalesPodium pode ler eles. | banco + [SalesPodium.jsx](src/components/SalesPodium.jsx) |
| R6 | 🟠 Baixa | Race condition em `refreshData` disparado por eventos `window` | [Dashboard.jsx:70](src/features/dashboard/components/Dashboard.jsx#L70) |
| R7 | 🟠 Baixa | Múltiplos `console.log` com dados de clientes e valores em produção | vários |
| R8 | 🟠 Baixa | MCP `--read-only` protege este editor, mas o app usa a `anon key` sem RLS — qualquer um com a key lê/escreve | banco |
| R9 | 🟠 Baixa | Meta lida sempre do mês **atual do relógio**, ignorando filtro de período | [Dashboard.jsx:53](src/features/dashboard/components/Dashboard.jsx#L53) |

---

## 6. Checklist obrigatório antes de cada alteração

Antes de qualquer PR/commit nesta sessão:

- [ ] Alteração é **backward compatible**? Se remover coluna/campo, existe consumidor?
- [ ] Se mudar UM `case`/enum, buscar TODAS as ocorrências no código (`fase`, `tipo_meta`, `origem_cliente`, `proprietario_relacionamento`)
- [ ] `contato_cliente` é NOT NULL — não permitir insert com `null`
- [ ] `tipo_meta` unique é `(tipo_meta, mes, ano, ativo)` — não fazer upsert manual
- [ ] Se alterar `useGoogleSheetsData` ou extractors, testar com **período vazio**, **período com só CANCELADO/PERCA**, e **mês atual**
- [ ] Manter dispatch de `apontamento-created` / `apontamento-updated` / `apontamento-alignment` — o Dashboard depende deles
- [ ] Não quebrar o dual mapping camelCase (frontend) ↔ snake_case (banco) em [apontamentos.js](src/services/supabase/apontamentos.js)
- [ ] Alterações no schema: **discutir antes** de tirar `--read-only` do MCP; rodar em migração numerada
- [ ] Testar `npm run build` e `npm run lint` local antes de push

---

## 7. Arquivos-chave do Dashboard Comercial

### Componentes
- [src/features/dashboard/components/Dashboard.jsx](src/features/dashboard/components/Dashboard.jsx) — orquestrador
- [src/features/dashboard/components/MainMetrics.jsx](src/features/dashboard/components/MainMetrics.jsx)
- [src/features/dashboard/components/ChartsFirstRow.jsx](src/features/dashboard/components/ChartsFirstRow.jsx)
- [src/features/dashboard/components/ChartsSecondRow.jsx](src/features/dashboard/components/ChartsSecondRow.jsx)
- [src/features/dashboard/components/ChartsThirdRow.jsx](src/features/dashboard/components/ChartsThirdRow.jsx)
- [src/features/dashboard/components/SalesTables.jsx](src/features/dashboard/components/SalesTables.jsx)
- [src/features/dashboard/components/ProximosEventos.jsx](src/features/dashboard/components/ProximosEventos.jsx)
- [src/features/dashboard/components/AvisosEsquecidos.jsx](src/features/dashboard/components/AvisosEsquecidos.jsx)
- [src/features/dashboard/components/GanhosPerdas.jsx](src/features/dashboard/components/GanhosPerdas.jsx)
- [src/components/SalesPodium.jsx](src/components/SalesPodium.jsx) — sincroniza tabela `vendedores`

### Hooks
- [src/hooks/useGoogleSheetsData.js](src/hooks/useGoogleSheetsData.js) — fonte de dados (nome enganoso, lê Supabase)
- [src/features/dashboard/hooks/useDashboardData.js](src/features/dashboard/hooks/useDashboardData.js)
- [src/features/dashboard/hooks/useMetaPersistence.js](src/features/dashboard/hooks/useMetaPersistence.js)

### Processamento
- [src/utils/dataProcessing.js](src/utils/dataProcessing.js) — entry
- [src/utils/processors.js](src/utils/processors.js) — orquestra extractors
- [src/utils/extractors.js](src/utils/extractors.js) — lógica de agregação por fase

### Serviços Supabase
- [src/services/supabase/config.js](src/services/supabase/config.js) — client
- [src/services/supabase/apontamentos.js](src/services/supabase/apontamentos.js) — CRUD apontamentos + histórico
- [src/services/supabase/metas.js](src/services/supabase/metas.js) — CRUD metas

### Config
- [src/config/metas.js](src/config/metas.js) — defaults + wrapper de meta
- [src/utils/codeUpdater.js](src/utils/codeUpdater.js) — localStorage helpers

---

## 8. Números atuais (baseline — 07/2026)

- Apontamentos ativos: **1.027**
- Apontamentos inativos (soft-delete): **392**
- CONTRATO/VENDA no mês corrente: **25**, R$ 739.843,50 (entrada R$ 104.329,66)
- Meta mês corrente: entrada R$ 120.000, clientes 250
- Vendedores reais: 5

Guardar isso para comparar depois de qualquer refactor: se número quebrar, algo está errado.
