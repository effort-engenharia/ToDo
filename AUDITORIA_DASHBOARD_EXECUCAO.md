# Auditoria — Dashboard de Execução

> **STATUS (22/10/2026): implementada** na branch `fix/auditoria-execucao` (sem commit) e no banco Supabase. Veja a seção [Status da implementação](#status-da-implementação) logo abaixo; o restante do documento é o plano original.

## Status da implementação

| Fase | Situação | Observações |
|---|---|---|
| 0 Preparação | ✅ | Branch criada |
| 1 Bugs críticos | ✅ | 9 métodos criados/aliasados no serviço; `useState` condicional corrigido; `App.jsx`; datas de Minhas Atividades; ECharts via `useEChart`; lint do módulo em 0 |
| 2 Segurança | ✅ | RLS em 15 tabelas `execucao_*`; buckets `obras-arquivos` e `pops-arquivos` privados com URL assinada; `buscarTecnicos` sem UUIDs fixos; permissões centralizadas |
| 3 Integridade | ✅ | `excluirObra`/`excluirEtapa` por FK; RPC `alterar_status_atividade` (atômica); `gerar_notificacoes_atraso` (lote + índice único); uploads sem colisão e sem falha silenciosa; template com insert-antes-de-delete |
| 4 Datas | ✅ | `utils/datas.js` usado em todo o módulo; semana segunda→domingo na agenda |
| 5 Robustez | ✅ | `useAsyncData`, toasts/confirmação acessíveis, estados de erro/vazio, polling sequencial pausado em aba oculta |
| 6 Performance | ✅ | Lazy loading por página, `jspdf`/`xlsx` por `import()`, ECharts com tree-shaking, paginação (`fetchAll`), RPC de agregação, índices compostos. Chunk principal 2,87 MB → 1,79 MB |
| 7 Manutenção/UX/A11y | ✅ | `PlanejamentoMacro` 3.588 → 732 linhas (+18 módulos), `PedidoMaterial` 1.822 → 221 linhas, agendas por mapa, sidebar com `<button>`, header sem controles falsos, rota por hash |
| 8 Validação | ⚠️ parcial | `eslint` (módulo) 0 erros, `check:contract` OK, `vite build` OK, políticas testadas no banco com JWT simulado. **Falta o roteiro manual 8.2 no navegador** |

### Correções ao plano original
- **3.3 (atividade duplicada):** `criarAtividadeDeEtapa` já tinha deduplicação; foi apenas refinada (busca por `etapa_id` primeiro). Não foi criado índice único.
- **2.1:** o RLS **não** foi aplicado "para `Administrador` ficar de fora": na impersonação o token Supabase continua sendo do Administrador, então `is_admin_execucao()` inclui `Administrador`.
- **Técnico pode `UPDATE` nas próprias atividades** (`atv_tecnico_update`), além da RPC, porque `ExecucaoHome` edita atividade diretamente.
- **Realtime (5.3 opção B)** não foi adotado; usou-se a opção A (polling sequencial).
- **TanStack Query (6.3)** não foi adotado; usou-se `useAsyncData`.

### Achados novos (não estavam no plano original)
- `execucao_pops` não tinha as colunas `tipo_execucao`, `conteudo`, `tags` usadas pelo formulário → **todo salvamento falhava**. Colunas criadas e `categoria` virou texto livre (a UI usa "Instalação", "Manutenção"... e violava o CHECK).
- `DesempenhoTime` lia campos que o serviço nunca devolveu (`por_tipo.*_percentual`, `ranking.pendentes`); agora são calculados no cliente.
- `buscarEstatisticasDia` comparava `updated_at` (UTC) com a data local.
- `criarObra` descartava falhas de upload de PDF; agora devolve `warning`.
- `PedidoMaterial` criava um pedido duplicado a cada edição de etapa de estoque (corrigido pelo agente) e enviava `solicitante_id` na edição.

### Arquivos
- **Migrações aplicadas:** `supabase/migrations/20261022_01_execucao_rls.sql`, `_02_execucao_pops_storage.sql`, `_03_execucao_rpcs_indices.sql`.
- **Contrato:** `npm run check:contract`.
- **Removidos:** `AgendaCivil/Eletrica/Galpao/Gestao.jsx` e o barrel `components/index.js` (não era importado).

### Pendências conhecidas
1. Executar o roteiro manual da Fase 8.2 no navegador (técnico e admin), especialmente: criar obra com template, exportar PDF/Excel, upload de POP, pausar/concluir como técnico.
2. **Fora do módulo Execução (não alterado):** `usuarios`, `niveis_acesso`, `permissoes`, `paginas`, `logs_acesso`, `apontamentos_comerciais`, `metas_comerciais`, `vendedores`, `arsenal_*`, `administradoras_sindicos`, `configuracoes_sistema` seguem **sem RLS** (aviso `rls_disabled_in_public` do Supabase). `usuarios` expõe e-mails e níveis de acesso com a chave anon. Ligar RLS nelas exige revisar login e Comercial. Também ativar "leaked password protection" no Auth.
3. `src/services/supabase/auth.js:593` usa `supabase.auth.admin` no cliente (item 2.5).
4. Buckets `arsenal-arquivos` e `vendedores-fotos` continuam públicos com políticas abertas.
5. Remover `ModalLargo` (PedidoMaterial) se `Modal` ganhar o tamanho `xl`.
6. `DesempenhoIndividual/Time`: opção "Em Andamento" do gráfico exigiria `buscarRankingTecnicos` devolver `em_andamento`.
7. O `eslint .` global ainda tem 49 erros fora do módulo Execução.

---
> **Escopo:** `src/features/execucao/**` (≈ 12,9 mil linhas), `src/services/supabase/execucao.js` (2.190 linhas), pontos de entrada (`App.jsx`, `ProtectedRoute.jsx`, `AuthContext.jsx`) e o snapshot de schema em `supabase/schema/`.
> **Data:** 22/10/2026
> **Como foi feita:** leitura integral do código, `eslint`, `vite build` e verificação cruzada entre o que os componentes chamam e o que o serviço implementa.

---

## Sumário executivo

| Área | Resultado |
|---|---|
| **Funcionalidades quebradas** | **4 telas falham em runtime**: *Minhas Atividades* (a tela principal do técnico), *POPs*, *Desempenho Individual* e *Desempenho do Time*. Elas chamam **9 métodos que não existem** em `execucaoService`. |
| **Lint** | 33 problemas (24 erros, 9 warnings), incluindo **1 violação de Rules of Hooks** (`useState` condicional). |
| **Build** | OK, mas gera **um único chunk JS de 2,87 MB** (855 KB gzip). Nada é carregado sob demanda. |
| **Segurança** | O snapshot não mostra RLS habilitado nas tabelas `execucao_*`. As políticas que existem são `TO public USING (true)`. O controle de acesso é feito só no cliente. |
| **Integridade de dados** | `excluirObra` apaga atividades **pelo nome do cliente** e pedidos **por `ILIKE` na descrição**, o que pode apagar dados de outras obras. Várias operações com mais de uma etapa não são atômicas. |
| **Datas** | `toISOString()` e `new Date('YYYY-MM-DD')` aparecem em mais de 15 pontos. Em UTC-3, entre 21h e 0h, "hoje" vira o dia seguinte. |
| **Vazamentos** | Os gráficos ECharts nunca são descartados: a função de cleanup é retornada, mas ninguém a usa. |

### Ordem recomendada de execução

| Fase | Tema | Esforço | Risco se não fizer |
|---|---|---|---|
| 0 | Preparação | 15 min | — |
| 1 | **Bugs críticos (telas quebradas)** | 3–4 h | Técnicos sem acesso às próprias atividades |
| 2 | **Segurança (RLS / Storage / permissões)** | 4–6 h | Leitura e escrita de qualquer dado com a chave anon |
| 3 | Integridade de dados | 3–5 h | Exclusões indevidas e dados parciais |
| 4 | Datas e fuso horário | 2 h | Atividades no dia errado |
| 5 | Robustez assíncrona e estados de erro | 3–4 h | Dados de filtro antigo, telas vazias sem explicação |
| 6 | Performance | 4–6 h | Primeira carga lenta, consultas pesadas |
| 7 | Manutenibilidade, UX e acessibilidade | contínuo | Custo de evolução alto |
| 8 | Validação final | 1 h | — |

---

## Fase 0 — Preparação

1. Crie uma branch:
   ```bash
   cd ToDo
   git checkout -b fix/auditoria-execucao
   ```
2. Registre a linha de base:
   ```bash
   npx eslint src/features/execucao src/services/supabase/execucao.js   # esperado hoje: 33 problemas
   npm run build                                                        # anote o tamanho do chunk index-*.js (~2,87 MB)
   ```
3. **Antes de mexer em RLS (Fase 2),** faça backup do banco (Supabase → Database → Backups) ou use uma *branch* do Supabase.

---

## Fase 1 — Bugs críticos (funcionalidades quebradas)

### 1.1 Métodos inexistentes em `execucaoService` — 🔴 Crítico

`execucaoService` é um `Proxy` (`wrapServiceWithImpersonationGuard`) que devolve `undefined` para propriedades que não existem. Toda chamada abaixo lança `TypeError: execucaoService.X is not a function`.

| Componente | Linha | Chamada inexistente | Efeito |
|---|---|---|---|
| `MinhasAtividades.jsx` | 40-44 | `buscarAtividadesTecnico` | **O técnico nunca vê suas atividades** (o erro cai no `catch` e a lista fica vazia) |
| `MinhasAtividades.jsx` | 63, 81 | `buscarHistoricoAtividade` | Abrir os detalhes gera uma *unhandled rejection* (não há `try`) |
| `MinhasAtividades.jsx` | 64, 100 | `buscarComentariosAtividade` | Idem; o comentário é salvo, mas a lista não atualiza |
| `POPs.jsx` | 60 | `listarPOPs` | A tela de POPs não carrega nada |
| `POPs.jsx` | 91 | `uploadArquivoPOP` | O POP é criado, mas o upload falha |
| `DesempenhoIndividual.jsx` | 64 | `buscarDesempenhoIndividual` | Tela sempre vazia |
| `DesempenhoTime.jsx` | 46-47 | `buscarDesempenhoTime`, `buscarRankingTecnicos` | Tela sempre vazia |
| `PedidoMaterial.jsx` | 348 | `alterarStatusPedido` | Código morto (o handler não é usado), mas quebraria se fosse ligado |

#### Passo 1.1.a — Criar o utilitário de datas (usado também na Fase 4)

Crie `src/features/execucao/utils/datas.js`:

```js
// Datas civis (YYYY-MM-DD) sempre no fuso local do navegador.
export const dataLocalISO = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseDataLocal = (valor) => {
  if (!valor) return null;
  const [y, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatarDataBR = (valor) =>
  parseDataLocal(valor)?.toLocaleDateString('pt-BR') ?? '—';

export const addDias = (date, n) => {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
};

// Semana de segunda a domingo (padrão BR)
export const intervaloSemana = (ref = new Date()) => {
  const dia = ref.getDay();
  const inicio = addDias(ref, dia === 0 ? -6 : 1 - dia);
  return { inicio: dataLocalISO(inicio), fim: dataLocalISO(addDias(inicio, 6)) };
};

export const intervaloPeriodo = (periodo, ref = new Date()) => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  switch (periodo) {
    case 'semana':
      return intervaloSemana(ref);
    case 'trimestre': {
      const q = Math.floor(m / 3) * 3;
      return { inicio: dataLocalISO(new Date(y, q, 1)), fim: dataLocalISO(new Date(y, q + 3, 0)) };
    }
    case 'ano':
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
    case 'mes':
    default:
      return { inicio: dataLocalISO(new Date(y, m, 1)), fim: dataLocalISO(new Date(y, m + 1, 0)) };
  }
};

// Mesmo intervalo, deslocado para o período imediatamente anterior
export const intervaloPeriodoAnterior = (periodo, ref = new Date()) => {
  const r = new Date(ref);
  if (periodo === 'semana') r.setDate(r.getDate() - 7);
  else if (periodo === 'trimestre') r.setMonth(r.getMonth() - 3);
  else if (periodo === 'ano') r.setFullYear(r.getFullYear() - 1);
  else r.setMonth(r.getMonth() - 1);
  return intervaloPeriodo(periodo, r);
};
```

#### Passo 1.1.b — Adicionar os métodos ao serviço

Em `src/services/supabase/execucao.js`, importe o utilitário no topo:

```js
import { dataLocalISO, intervaloSemana, intervaloPeriodo, intervaloPeriodoAnterior } from '../../features/execucao/utils/datas.js';
```

Adicione dentro de `_execucaoService`, na seção **ATIVIDADES**:

```js
  async buscarAtividadesTecnico(tecnicoId, periodo = 'hoje') {
    try {
      let query = supabase
        .from('execucao_atividades')
        .select(`id, titulo, descricao, tipo_execucao, data_programada, hora_inicio, hora_fim,
                 status, prioridade, cliente_nome, endereco, observacoes, etapa_id`)
        .eq('tecnico_responsavel_id', tecnicoId)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true, nullsFirst: false });

      if (periodo === 'hoje') {
        query = query.eq('data_programada', dataLocalISO());
      } else if (periodo === 'semana') {
        const { inicio, fim } = intervaloSemana();
        query = query.gte('data_programada', inicio).lte('data_programada', fim);
      } else {
        query = query.limit(500); // "todas": limite defensivo; paginar na Fase 6
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao buscar atividades do técnico:', error);
      return { success: false, message: error.message, data: [] };
    }
  },

  // Aliases para os nomes usados pelos componentes
  async buscarHistoricoAtividade(atividadeId) {
    return this.buscarHistorico(atividadeId);
  },

  async buscarComentariosAtividade(atividadeId) {
    return this.buscarComentarios(atividadeId);
  },
```

Na seção **POPs**:

```js
  async listarPOPs(filtros = {}) {
    return this.buscarPOPs(filtros);
  },

  async uploadArquivoPOP(popId, file) {
    const caminho = `${popId}/${crypto.randomUUID()}-${file.name}`;
    try {
      const { error: upErr } = await supabase.storage
        .from('pops-arquivos')               // ⚠️ crie o bucket (privado) se não existir
        .upload(caminho, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const tipo = file.type.startsWith('image/') ? 'foto'
                 : file.type.startsWith('video/') ? 'video'
                 : 'documento';

      const result = await this.adicionarArquivoPOP(popId, {
        tipo,
        nome: file.name,
        nome_arquivo_original: file.name,
        caminho_storage: caminho,
        tamanho_bytes: file.size,
        mime_type: file.type,
      });
      if (!result.success) {
        await supabase.storage.from('pops-arquivos').remove([caminho]); // evita arquivo órfão
        throw new Error(result.message);
      }
      return result;
    } catch (error) {
      console.error('Erro no upload do arquivo do POP:', error);
      return { success: false, message: error.message };
    }
  },
```

> ⚠️ `uploadArquivoPOP` começa com `upload`, então já fica bloqueado durante a impersonação. `listarPOPs`/`buscar*` não ficam, o que é o comportamento correto.

Na seção **ESTATÍSTICAS**, adicione as três funções de desempenho. Elas devolvem exatamente o formato que os componentes leem:

```js
  async _atividadesNoPeriodo(inicio, fim, tecnicoId = null) {
    let q = supabase
      .from('execucao_atividades')
      .select('id, status, tipo_execucao, data_programada, tecnico_responsavel_id')
      .gte('data_programada', inicio)
      .lte('data_programada', fim);
    if (tecnicoId) q = q.eq('tecnico_responsavel_id', tecnicoId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  _porTipo(lista) {
    return lista.reduce((acc, a) => {
      acc[a.tipo_execucao] = (acc[a.tipo_execucao] || 0) + 1;
      return acc;
    }, { eletrica: 0, civil: 0, galpao: 0, gestao: 0 });
  },

  async buscarRankingTecnicos(periodo = 'mes') {
    try {
      const { inicio, fim } = intervaloPeriodo(periodo);
      const [atividades, tecnicosRes] = await Promise.all([
        this._atividadesNoPeriodo(inicio, fim),
        this.buscarTecnicos(),
      ]);
      const tecnicos = (tecnicosRes.data ?? []).filter(t => t.nivel_acesso?.nome === 'TECNICO');

      const ranking = tecnicos.map(t => {
        const doTec = atividades.filter(a => a.tecnico_responsavel_id === t.id);
        const concluidas = doTec.filter(a => a.status === 'concluida').length;
        return {
          id: t.id,
          nome: t.nome_completo,
          total: doTec.length,
          concluidas,
          taxa_conclusao: doTec.length ? Math.round((concluidas / doTec.length) * 100) : 0,
        };
      }).sort((a, b) => b.concluidas - a.concluidas || b.taxa_conclusao - a.taxa_conclusao);

      return { success: true, data: ranking };
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      return { success: false, message: error.message, data: [] };
    }
  },

  async buscarDesempenhoIndividual(tecnicoId, periodo = 'mes') {
    try {
      const { inicio, fim } = intervaloPeriodo(periodo);
      const [lista, rankingRes] = await Promise.all([
        this._atividadesNoPeriodo(inicio, fim, tecnicoId),
        this.buscarRankingTecnicos(periodo),
      ]);

      const porDia = {};
      for (const a of lista) {
        porDia[a.data_programada] ??= { data: a.data_programada, total: 0, concluidas: 0 };
        porDia[a.data_programada].total++;
        if (a.status === 'concluida') porDia[a.data_programada].concluidas++;
      }
      const pos = (rankingRes.data ?? []).findIndex(r => r.id === tecnicoId);

      return {
        success: true,
        data: {
          total: lista.length,
          concluidas: lista.filter(a => a.status === 'concluida').length,
          pendentes: lista.filter(a => ['pendente', 'em_andamento', 'pausada'].includes(a.status)).length,
          por_tipo: this._porTipo(lista),
          historico: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)),
          ranking: pos >= 0 ? pos + 1 : null,
        },
      };
    } catch (error) {
      console.error('Erro ao buscar desempenho individual:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarDesempenhoTime(periodo = 'mes') {
    try {
      const atual = intervaloPeriodo(periodo);
      const anterior = intervaloPeriodoAnterior(periodo);
      const [lista, listaAnt, tecnicosRes] = await Promise.all([
        this._atividadesNoPeriodo(atual.inicio, atual.fim),
        this._atividadesNoPeriodo(anterior.inicio, anterior.fim),
        this.buscarTecnicos(),
      ]);
      const totalTecnicos = (tecnicosRes.data ?? []).filter(t => t.nivel_acesso?.nome === 'TECNICO').length;
      const concluidas = lista.filter(a => a.status === 'concluida').length;

      const porDia = {};
      for (const a of lista) {
        porDia[a.data_programada] ??= { data: a.data_programada, eletrica: 0, civil: 0, galpao: 0, gestao: 0 };
        if (a.tipo_execucao in porDia[a.data_programada]) porDia[a.data_programada][a.tipo_execucao]++;
      }

      return {
        success: true,
        data: {
          total_tecnicos: totalTecnicos,
          total_atividades: lista.length,
          taxa_conclusao: lista.length ? Math.round((concluidas / lista.length) * 100) : 0,
          media_por_tecnico: totalTecnicos ? Math.round(lista.length / totalTecnicos) : 0,
          variacao_total: listaAnt.length
            ? Math.round(((lista.length - listaAnt.length) / listaAnt.length) * 100)
            : 0,
          por_tipo: this._porTipo(lista),
          evolucao: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)),
        },
      };
    } catch (error) {
      console.error('Erro ao buscar desempenho do time:', error);
      return { success: false, message: error.message };
    }
  },
```

> 💡 Na Fase 6 (6.4), troque essas agregações em JavaScript por uma RPC SQL (`GROUP BY`), para não depender do limite de 1.000 linhas do PostgREST.

#### Passo 1.1.c — Ajustar os chamadores

- **`POPs.jsx:84`**: a assinatura é `criarPOP(pop, usuarioId)`, mas `usuarioId` não é passado e `created_by` fica `undefined`:
  ```js
  const { criado_por, ...dadosPOP } = dados; // remova o campo que não existe na tabela
  result = await execucaoService.criarPOP(dadosPOP, usuario?.id);
  ```
- **`PedidoMaterial.jsx:347-358`**: remova `handleAlterarStatus` e `handleExcluir`, que não são usados. Se for usá-los, troque `alterarStatusPedido` por `atualizarStatusPedido`.

#### Passo 1.1.d — Evitar que isso volte a acontecer

Adicione um teste de contrato simples em `scripts/check-service-contract.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs';
const svc = readFileSync('src/services/supabase/execucao.js', 'utf8');
const definidos = new Set([...svc.matchAll(/^\s{2}async\s+(\w+)\s*\(/gm)].map(m => m[1]));
const dir = 'src/features/execucao/components';
let falhas = 0;
for (const f of readdirSync(dir)) {
  const src = readFileSync(`${dir}/${f}`, 'utf8');
  for (const [, nome] of src.matchAll(/execucaoService\.(\w+)/g)) {
    if (!definidos.has(nome)) { console.error(`✗ ${f}: execucaoService.${nome} não existe`); falhas++; }
  }
}
process.exit(falhas ? 1 : 0);
```

Inclua no `package.json`: `"check:contract": "node scripts/check-service-contract.mjs"`.

---

### 1.2 `useState` chamado condicionalmente — 🔴 Crítico

**`PlanejamentoMacro.jsx:113-115`** (componente `AlertasEtapasAtrasadas`):

```js
if (etapasAtrasadas.length === 0) return null;
const [expanded, setExpanded] = useState(true);   // ❌ hook depois de um return condicional
```

Quando a lista passa de vazia para não vazia, ou o contrário, o React lança *"Rendered more hooks than during the previous render"* e a tela de Planejamento cai.

**Correção:**
```js
const [expanded, setExpanded] = useState(true);
// ... useMemo de etapasAtrasadas ...
if (etapasAtrasadas.length === 0) return null;
```

### 1.3 Hooks antes do `return` em `App.jsx` — 🟠 Alto (ponto de entrada do módulo)

**`App.jsx:19-27`**: `AppContent` faz `return <ResetPasswordPage/>` **antes** de `useState`/`useEffect`. Isso viola as Rules of Hooks. Hoje não quebra porque o pathname não muda sem recarregar a página, mas é frágil.

**Correção:** extraia a decisão para um componente acima:
```jsx
function App() {
  return (
    <AuthProvider>
      <LayoutProvider>
        <ImpersonationBar />
        {window.location.pathname === '/reset-password' ? <ResetPasswordPage /> : <AppContent />}
      </LayoutProvider>
    </AuthProvider>
  );
}
```
Depois, remova o `if (isResetPasswordPage)` de dentro de `AppContent`.

### 1.4 Data inválida em Minhas Atividades — 🟠 Alto

**`MinhasAtividades.jsx:293` e `:393`** usam `atividade.data`, mas a coluna é `data_programada`. O resultado é **"Invalid Date"** em todos os cards.

```jsx
import { formatarDataBR } from '../utils/datas';
// ...
{formatarDataBR(atividade.data_programada)}
{formatarDataBR(atividadeSelecionada.data_programada)}
```

### 1.5 Gráficos ECharts nunca são descartados — 🟠 Alto (vazamento de memória)

**`DesempenhoIndividual.jsx:38-45, 75-143, 145-193`** e **`DesempenhoTime.jsx:36-40, 63-137, 139-216`**:
`renderizarGrafico*()` devolve `() => { removeEventListener; chart.dispose() }`, mas o `useEffect` descarta esse retorno. A cada troca de período, um novo `echarts.init` roda no mesmo DOM (com warning *"There is a chart instance already initialized"*) e mais um listener de `resize` é acumulado.

**Correção:** crie um hook reutilizável `src/features/execucao/hooks/useEChart.js`:

```js
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export function useEChart(option) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    if (chartRef.current && option) chartRef.current.setOption(option, true);
  }, [option]);

  return ref;
}
```

Uso:
```jsx
const lineOption = useMemo(() => desempenho && ({ /* option atual de renderizarGraficoLinha */ }), [desempenho]);
const chartRef = useEChart(lineOption);
// <div ref={chartRef} style={{ height: 300 }} />
```

Depois, remova `renderizarGrafico*` e os `useEffect` antigos. O *tree-shaking* do `echarts/core` também reduz o bundle (Fase 6).

### 1.6 Erros de lint que escondem bugs

Corrija os 24 erros do `eslint`. Os mais relevantes:

| Arquivo:linha | Problema | Ação |
|---|---|---|
| `PlanejamentoMacro.jsx:630`, `execucao.js:943` | `no-case-declarations` | Envolva o `case` em `{ }` |
| `POPs.jsx:42` | `uploadingArquivo` nunca é usado | Use-o para desabilitar o botão de salvar durante o upload (ver 5.4) |
| `PedidoMaterial.jsx:67` | `showSeletorTemplate` não é usado | Remova ou ligue ao UI |
| `ExecucaoDashboard.jsx:36` | `temPermissao` não é usado | Remova |
| `AgendaBase.jsx:21-22,185`, `DesempenhoTime.jsx:220`, demais | Variáveis mortas | Remova |
| `execucao.js:1057,1204,1815,2146` | Desestruturações não usadas | Use `_` como prefixo ou remova |

---

## Fase 2 — Segurança

### 2.1 RLS ausente ou permissivo nas tabelas `execucao_*` — 🔴 Crítico

O cliente usa a chave **anon**, e todo o controle de "admin x técnico" está no React (`ExecucaoDashboard`, `ProtectedRoute`). Qualquer pessoa com a chave anon (que vai pública no bundle) consegue ler e alterar atividades, obras e pedidos via REST.

O snapshot `supabase/schema/logic.sql` tem:
- `execucao_historico_pedidos` → `INSERT/SELECT TO public ... (true)`
- `execucao_templates_materiais` → `FOR ALL TO public USING (true) WITH CHECK (true)`
- **nenhum `ENABLE ROW LEVEL SECURITY`** para `execucao_atividades`, `execucao_obras`, `execucao_obras_etapas`, `execucao_pedidos_material`, `execucao_pops`, `execucao_notificacoes` etc.

**Passo 2.1.a — Confirme o estado real em produção** (SQL Editor):
```sql
SELECT c.relname, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS n_policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'execucao_%'
ORDER BY 1;
```

**Passo 2.1.b — Crie as funções auxiliares.** Importante: `usuarios.id` **não é** `auth.uid()`; o vínculo é `usuarios.auth_user_id`.

```sql
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuarios WHERE auth_user_id = auth.uid() AND ativo
$$;

CREATE OR REPLACE FUNCTION public.current_nivel()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT na.nome FROM usuarios u JOIN niveis_acesso na ON na.id = u.nivel_acesso_id
  WHERE u.auth_user_id = auth.uid() AND u.ativo
$$;

CREATE OR REPLACE FUNCTION public.is_admin_execucao()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.current_nivel() IN ('ADMIN_EXECUCAO', 'Administrador')
$$;

CREATE OR REPLACE FUNCTION public.is_usuario_execucao()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.current_nivel() IN ('ADMIN_EXECUCAO', 'Administrador', 'TECNICO')
$$;
```

**Passo 2.1.c — Habilite o RLS e crie as políticas** (migração `supabase/migrations/<data>_rls_execucao.sql`):

```sql
-- 1) Habilitar em todas
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'execucao_%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2) Remover políticas abertas
DROP POLICY IF EXISTS "Historico pedidos insert policy" ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS "Historico pedidos select policy" ON public.execucao_historico_pedidos;
DROP POLICY IF EXISTS "Permitir acesso total a templates de materiais" ON public.execucao_templates_materiais;

-- 3) Atividades: admin tudo; técnico lê e atualiza as próprias
CREATE POLICY atv_admin_all ON public.execucao_atividades FOR ALL TO authenticated
  USING (public.is_admin_execucao()) WITH CHECK (public.is_admin_execucao());
CREATE POLICY atv_tecnico_select ON public.execucao_atividades FOR SELECT TO authenticated
  USING (tecnico_responsavel_id = public.current_usuario_id());
CREATE POLICY atv_tecnico_update ON public.execucao_atividades FOR UPDATE TO authenticated
  USING (tecnico_responsavel_id = public.current_usuario_id())
  WITH CHECK (tecnico_responsavel_id = public.current_usuario_id());

-- 4) Histórico e comentários: quem vê a atividade pode ler/inserir
CREATE POLICY hist_rw ON public.execucao_atividades_historico FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM execucao_atividades a WHERE a.id = atividade_id))
  WITH CHECK (usuario_id = public.current_usuario_id());
CREATE POLICY coment_rw ON public.execucao_atividades_comentarios FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM execucao_atividades a WHERE a.id = atividade_id))
  WITH CHECK (usuario_id = public.current_usuario_id());

-- 5) POPs: todos do módulo leem; só admin escreve
CREATE POLICY pops_read  ON public.execucao_pops FOR SELECT TO authenticated USING (public.is_usuario_execucao());
CREATE POLICY pops_write ON public.execucao_pops FOR ALL    TO authenticated
  USING (public.is_admin_execucao()) WITH CHECK (public.is_admin_execucao());
CREATE POLICY popsarq_read  ON public.execucao_pops_arquivos FOR SELECT TO authenticated USING (public.is_usuario_execucao());
CREATE POLICY popsarq_write ON public.execucao_pops_arquivos FOR ALL    TO authenticated
  USING (public.is_admin_execucao()) WITH CHECK (public.is_admin_execucao());

-- 6) Demais tabelas (obras, etapas, arquivos de obra, pedidos, histórico de pedidos,
--    planejamento, templates, notificações): somente admin
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'execucao_obras','execucao_obras_etapas','execucao_obras_arquivos',
    'execucao_pedidos_material','execucao_historico_pedidos','execucao_planejamento_macro',
    'execucao_templates_etapas','execucao_templates_etapas_itens','execucao_templates_materiais',
    'execucao_notificacoes'] LOOP
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (public.is_admin_execucao()) WITH CHECK (public.is_admin_execucao())$p$,
                   t || '_admin_all', t);
  END LOOP;
END $$;
```

> ⚠️ **Notificações geradas pelo técnico:** ao pausar ou concluir, `alterarStatusAtividade` chama `criarNotificacao`. Com a política acima, o INSERT do técnico seria negado. Adicione:
> ```sql
> CREATE POLICY notif_insert_execucao ON public.execucao_notificacoes FOR INSERT TO authenticated
>   WITH CHECK (public.is_usuario_execucao() AND usuario_origem_id = public.current_usuario_id());
> ```
> Se o técnico também atualiza `execucao_obras_etapas` via `atualizarEtapaVinculada`, mova essa lógica para uma *trigger* `SECURITY DEFINER` (ver 3.2).

**Passo 2.1.d — Teste** com um usuário TECNICO real: Minhas Atividades, pausar/concluir, comentar, ler POPs. E confirme que `GET /rest/v1/execucao_obras` com o token dele retorna `[]`.

### 2.2 Storage com URL pública — 🟠 Alto

**`execucao.js:1874-1885`** usa `getPublicUrl()` para PDFs de obras (contratos e projetos).

1. No Supabase, deixe o bucket `obras-arquivos` (e `pops-arquivos`) como **privado**.
2. Troque por URL assinada:
   ```js
   async obterUrlArquivo(caminhoStorage, expiraEmSeg = 300) {
     const { data, error } = await supabase.storage.from('obras-arquivos').createSignedUrl(caminhoStorage, expiraEmSeg);
     if (error) return { success: false, message: error.message };
     return { success: true, url: data.signedUrl };
   }
   ```
3. Crie políticas de Storage (`storage.objects`) restringindo `bucket_id = 'obras-arquivos'` a `public.is_admin_execucao()`.

### 2.3 `excluirArquivoObra` confia no caminho enviado pelo cliente — 🟡 Médio

**`execucao.js:1888`** recebe `caminhoStorage` como parâmetro. Busque o caminho no banco a partir do `arquivoId`:
```js
async excluirArquivoObra(arquivoId) {
  const { data: arq, error } = await supabase.from('execucao_obras_arquivos')
    .select('caminho_storage').eq('id', arquivoId).single();
  if (error) return { success: false, message: error.message };
  await supabase.storage.from('obras-arquivos').remove([arq.caminho_storage]);
  const { error: delErr } = await supabase.from('execucao_obras_arquivos').delete().eq('id', arquivoId);
  return delErr ? { success: false, message: delErr.message } : { success: true };
}
```
Atualize quem chama em `PlanejamentoMacro.jsx` para passar apenas o `id`.

### 2.4 Regras de permissão inconsistentes — 🟡 Médio

| Local | Regra atual |
|---|---|
| `ProtectedRoute.jsx:20-28` | `Administrador` → **negado** em `execucao*` |
| `ExecucaoDashboard.jsx:40-41`, `ExecucaoSidebar.jsx:83` | `Administrador` → tratado como **admin de execução** |
| `execucao.js:1592` (`buscarTecnicos`) | Inclui `Administrador` na lista de técnicos |
| `AuthContext.jsx:173-176` | Lista de páginas de execução **sem** `execucao/agenda-gestao` |

**Passos:**
1. Decida a regra de negócio. Por exemplo: "Administrador acessa execução?".
2. Centralize em `src/config/permissoes.js`:
   ```js
   export const NIVEIS = { ADMIN: 'Administrador', ADMIN_EXEC: 'ADMIN_EXECUCAO', TECNICO: 'TECNICO' };
   export const isAdminExecucao = (u) => [NIVEIS.ADMIN_EXEC, NIVEIS.ADMIN].includes(u?.nivel_acesso?.nome);
   export const PAGINAS_TECNICO = ['home', 'minhas-atividades', 'pops'];
   ```
3. Use `isAdminExecucao` em `ExecucaoDashboard`, `ExecucaoSidebar`, `ProtectedRoute` e `AuthContext`. Faça a mesma regra existir no SQL (`is_admin_execucao`, Fase 2.1).
4. Em `buscarTecnicos`, **não use UUIDs fixos** (linhas 1589-1592). Filtre pelo nome do nível com um join (`niveis_acesso!inner(nome)` + `.in('niveis_acesso.nome', [...])`). Hoje, se os IDs mudarem entre ambientes, a lista fica vazia.

### 2.5 Uso de `supabase.auth.admin` no cliente — ⚪ Informativo (fora do módulo)

`src/services/supabase/auth.js:593` chama `supabase.auth.admin`, que **exige a service-role key**. Com a chave anon, a chamada falha. Se estiver funcionando, a service-role key está no bundle, o que é crítico. Verifique e mova para uma Edge Function.

---

## Fase 3 — Integridade de dados

### 3.1 `excluirObra` apaga dados de outras obras — 🔴 Crítico

**`execucao.js:1081-1104`:**
```js
.from('execucao_atividades').delete().eq('cliente_nome', obra.nome_cliente);      // ❌ por nome
.from('execucao_pedidos_material').delete().ilike('descricao', `%${obra.nome_cliente}%`); // ❌ por texto
```
Dois clientes chamados "João" significa que todas as atividades dos dois são apagadas. Um cliente "Ana" apaga qualquer pedido com "ana" na descrição ("bANAna", "semANA"…).

**Correção imediata (sem migração):** as atividades criadas a partir de etapas já têm `etapa_id`. Use essa relação:
```js
async excluirObra(id) {
  try {
    const { data: etapas, error: e1 } = await supabase
      .from('execucao_obras_etapas').select('id').eq('obra_id', id);
    if (e1) throw e1;
    const etapaIds = etapas.map(e => e.id);
    if (etapaIds.length) {
      const { error: e2 } = await supabase.from('execucao_atividades').delete().in('etapa_id', etapaIds);
      if (e2) throw e2;
    }
    const { error } = await supabase.from('execucao_obras').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir obra:', error);
    return { success: false, message: error.message };
  }
}
```

**Correção definitiva (migração):** crie FKs explícitas e deixe o banco cuidar das exclusões:
```sql
ALTER TABLE public.execucao_atividades       ADD COLUMN obra_id uuid REFERENCES public.execucao_obras(id) ON DELETE CASCADE;
ALTER TABLE public.execucao_pedidos_material ADD COLUMN obra_id uuid REFERENCES public.execucao_obras(id) ON DELETE SET NULL;
CREATE INDEX ON public.execucao_atividades (obra_id);
CREATE INDEX ON public.execucao_pedidos_material (obra_id);

-- backfill a partir das etapas
UPDATE public.execucao_atividades a SET obra_id = e.obra_id
FROM public.execucao_obras_etapas e WHERE a.etapa_id = e.id AND a.obra_id IS NULL;
```
Revise também **`excluirEtapa` (`execucao.js:1186-1240`)**, que usa o mesmo padrão de exclusão por texto.

### 3.2 Operações com mais de uma etapa sem atomicidade — 🟠 Alto

| Fluxo | Arquivo | Sequência |
|---|---|---|
| Alterar status | `execucao.js:219-299` | update → histórico → notificação → etapa vinculada |
| Criar obra + etapas do template | `PlanejamentoMacro.jsx:1887-1925` | obra → N × `criarEtapa` sequencial (retorno não checado) |
| Atualizar template | `execucao.js:2012-2060` | update → delete itens → insert itens |
| Salvar pedido | `PedidoMaterial.jsx:256-290` | update → histórico → etapa → update flag |

**Passo a passo (exemplo: status da atividade):**
1. Crie a RPC:
   ```sql
   CREATE OR REPLACE FUNCTION public.alterar_status_atividade(p_id uuid, p_status text, p_motivo text DEFAULT NULL)
   RETURNS public.execucao_atividades
   LANGUAGE plpgsql SECURITY INVOKER AS $$
   DECLARE v public.execucao_atividades; v_old text; v_uid uuid := public.current_usuario_id();
   BEGIN
     SELECT status INTO v_old FROM execucao_atividades WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;

     UPDATE execucao_atividades SET status = p_status, updated_at = now()
      WHERE id = p_id RETURNING * INTO v;

     INSERT INTO execucao_atividades_historico (atividade_id, usuario_id, tipo_acao, descricao, valor_anterior, valor_novo)
     VALUES (p_id, v_uid, 'status_alterado', p_motivo, v_old, p_status);

     IF p_status IN ('pausada','concluida') THEN
       INSERT INTO execucao_notificacoes (tipo, titulo, mensagem, atividade_id, usuario_origem_id)
       VALUES (CASE p_status WHEN 'pausada' THEN 'pausa' ELSE 'conclusao' END,
               'Atividade ' || p_status, coalesce(p_motivo, v.titulo), p_id, v_uid);
     END IF;
     RETURN v;
   END $$;
   ```
   Confira os nomes das colunas de `execucao_atividades_historico` em `tables.sql:174` antes de aplicar.
2. Mova a atualização da etapa vinculada para uma *trigger* `AFTER UPDATE OF status ON execucao_atividades` (`SECURITY DEFINER`), para que o técnico não precise de permissão em `execucao_obras_etapas`.
3. No serviço:
   ```js
   async alterarStatusAtividade(id, novoStatus, _usuarioId, motivo = null) {
     const { data, error } = await supabase.rpc('alterar_status_atividade', { p_id: id, p_status: novoStatus, p_motivo: motivo });
     return error ? { success: false, message: error.message } : { success: true, data };
   }
   ```
4. Faça o mesmo para `criar_obra_com_etapas(p_obra jsonb, p_etapas jsonb)` e `salvar_template(p_template jsonb, p_itens jsonb)`.

**Paliativo, enquanto as RPCs não existem:**
- `registrarHistorico` (`execucao.js:423-438`) **ignora o `error`**. Faça `const { error } = await ...; if (error) throw error;`.
- Em `PlanejamentoMacro.jsx:1901-1924`, monte o array de etapas e faça **um único** `insert([...])`. Se falhar, chame `excluirObra(obra.id)`.
- Em `PedidoMaterial.jsx:256-290`, verifique `result.success` de cada passo e mostre o erro.

### 3.3 Atividades duplicadas ao editar uma etapa — 🟡 Médio

**`PlanejamentoMacro.jsx:2145-2162`**: o comentário diz "criar **ou atualizar**", mas sempre chama `criarAtividadeDeEtapa`. Confira o corpo do serviço em `execucao.js:1303`. Se não houver deduplicação, implemente o upsert:
```js
const { data: existente } = await supabase.from('execucao_atividades')
  .select('id').eq('etapa_id', etapaId).maybeSingle();
return existente
  ? this.atualizarAtividade(existente.id, dadosAtividade, usuarioId)
  : this.criarAtividadeDeEtapa(etapaId, dadosAtividade, usuarioId);
```
Garantia no banco: `CREATE UNIQUE INDEX ON execucao_atividades (etapa_id) WHERE etapa_id IS NOT NULL;` (depois de limpar as duplicatas existentes).

### 3.4 Upload de arquivos de obra — 🟡 Médio

**`execucao.js:1805-1854`:**
- O nome `${obraId}/${Date.now()}_${arquivo.name}` pode colidir. Use `crypto.randomUUID()`.
- `if (uploadError) continue;` engole a falha e a função retorna `success: true`. Acumule as falhas e devolva `{ success: falhas.length === 0, falhas }`.
- Se o insert no banco falhar após o upload, chame `storage.remove([nomeArquivo])`.

### 3.5 Notificações de atraso duplicadas e N+1 — 🟡 Médio

**`execucao.js:1712-1760`** faz SELECT + INSERT por atividade, e roda a cada abertura do dropdown em **todas as abas abertas por admins**.
1. Garantia no banco:
   ```sql
   CREATE UNIQUE INDEX uq_notif_atraso_dia ON public.execucao_notificacoes (atividade_id, ((created_at AT TIME ZONE 'America/Sao_Paulo')::date))
   WHERE tipo = 'atraso';
   ```
2. Ideal: mova para um **cron** (`pg_cron`, 1x/hora) chamando uma função SQL `gerar_notificacoes_atraso()` com `INSERT ... SELECT ... ON CONFLICT DO NOTHING`. Depois, remova a chamada de `NotificacoesDropdown.jsx:50`.

---

## Fase 4 — Datas e fuso horário

`new Date().toISOString().split('T')[0]` devolve a data em **UTC**. No Brasil (UTC-3), das 21h00 às 23h59, "hoje" vira **amanhã**. Já `new Date('2026-10-22')` é interpretado como UTC 00:00, ou seja, **21/10 às 21h** no horário local.

**Passo 4.1:** use `dataLocalISO`, `parseDataLocal` e `formatarDataBR` (criados no Passo 1.1.a) e substitua em todos os pontos:

| Arquivo | Linhas |
|---|---|
| `services/supabase/execucao.js` | 56, 106-107, 1471-1472, 1508, 1714 |
| `AgendaBase.jsx` | 37, 64, 71, 76, 124, 153 |
| `ExecucaoHome.jsx` | 114, 353, 485, 805 |
| `AtividadesDia.jsx` | 348, 520 |
| `PedidoMaterial.jsx` | 306, 512, 519-523 |
| `PlanejamentoMacro.jsx` | 1895-1910 (criação de etapas a partir do template) |
| `MinhasAtividades.jsx` | 293, 393 (ver 1.4) |

Para localizar outros casos:
```bash
grep -rnE "toISOString\(\)\.(split|slice|substring)|new Date\([a-zA-Z_.]+\)" src/features/execucao src/services/supabase/execucao.js
```

**Passo 4.2:** em `AgendaBase.jsx:67-71`, a semana começa no **domingo** (`getDay()`). Troque por `intervaloSemana()` (segunda a domingo).

**Passo 4.3:** em `PlanejamentoMacro.jsx:95-101` e `1848-1864`, `parseDataLocal(null) < hoje` dá `true`, e etapas **sem data** aparecem como atrasadas. Adicione a guarda `fimEtapa && fimEtapa < hoje`.

**Passo 4.4:** remova a `parseDataLocal` local de `PlanejamentoMacro.jsx` e importe a do utilitário. Assim fica uma única fonte de verdade.

---

## Fase 5 — Robustez assíncrona, erros e estados de UI

### 5.1 Condições de corrida em carregamentos — 🟠 Alto

Ao trocar filtro, período ou aba rapidamente, uma resposta antiga pode chegar depois e sobrescrever a mais recente:
`AgendaBase.jsx:47-50`, `MinhasAtividades.jsx:31-33`, `PlanejamentoMacro.jsx:1729-1734`, `DesempenhoIndividual.jsx:32-36`, `DesempenhoTime.jsx:29-31`, e os detalhes em `ExecucaoHome.jsx:57-74`, `AtividadesDia.jsx:147-168`, `MinhasAtividades.jsx:57-73`.

**Passo 5.1.a:** crie `src/features/execucao/hooks/useAsyncData.js`:
```js
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncData(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetcher();
      if (id !== reqId.current) return;                // resposta obsoleta
      if (r && r.success === false) throw new Error(r.message || 'Falha ao carregar');
      setState({ data: r?.data ?? r, loading: false, error: null });
    } catch (e) {
      if (id === reqId.current) setState(s => ({ ...s, loading: false, error: e.message }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); return () => { reqId.current++; }; }, [load]);
  return { ...state, reload: load };
}
```

**Passo 5.1.b:** aplique o hook. Exemplo em `MinhasAtividades`:
```js
const { data: atividades = [], loading, error, reload } = useAsyncData(
  () => execucaoService.buscarAtividadesTecnico(usuario.id, tab),
  [usuario?.id, tab]
);
```
Isso também resolve os 9 warnings de `react-hooks/exhaustive-deps`.

**Passo 5.1.c:** em `AgendaBase.jsx:47-50`, separe `carregarTecnicos()` em um `useEffect(..., [])` próprio, porque não depende dos filtros.

### 5.2 Erro não é mostrado, só vai para o console — 🟡 Médio

Os componentes fazem apenas `console.error`, e o usuário vê a mesma tela para "sem dados" e para "falhou". Também há chamadas de mutação sem `try` (`AgendaBase.jsx:143`, `AtividadesDia.jsx:70`, `MinhasAtividades.jsx:76`, `PlanejamentoMacro.jsx:1953-2049`, `PedidoMaterial.jsx:233-301`).

1. Crie `components/EstadoCarregamento.jsx` com três estados (carregando / erro com botão "Tentar novamente" / vazio), usando `role="alert"` no erro.
2. Crie um *toast* simples (`ToastContext`) e troque os 22 `alert()` e `confirm()` por toast e um `ConfirmDialog` acessível.
3. Padronize os handlers de mutação:
   ```js
   const [salvando, setSalvando] = useState(false);
   const salvar = async () => {
     if (salvando) return;
     setSalvando(true);
     try {
       const r = await execucaoService.x(...);
       if (!r.success) throw new Error(r.message);
       toast.success('Salvo');
       reload();
     } catch (e) { toast.error(e.message); }
     finally { setSalvando(false); }
   };
   ```
   Use `disabled={salvando}` nos botões de submit para evitar envio duplo.

### 5.3 Polling de notificações — 🟡 Médio

**`NotificacoesDropdown.jsx:48-61`:**
- `verificarECriarNotificacoesAtraso()` roda sem `await` e sem `catch` (*unhandled rejection*).
- `setInterval(30s)` pode sobrepor requisições e continua rodando com a aba em segundo plano.

**Opção A (simples):** troque por `setTimeout` encadeado, pause com `document.visibilityState === 'hidden'` e use uma flag `ativo` no cleanup.

**Opção B (recomendada):** use **Supabase Realtime** e elimine o polling:
```js
useEffect(() => {
  if (!isAdmin) return;
  carregarNotificacoes();
  const ch = supabase.channel('notif-execucao')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'execucao_notificacoes' }, carregarNotificacoes)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [isAdmin]);
```
(Habilite a publicação `supabase_realtime` para a tabela.)

### 5.4 POPs: validação de upload — 🟡 Médio

**`POPs.jsx:88-94, 111-115`:**
- Valide o tipo e o tamanho (por exemplo, 20 MB) antes de adicionar ao estado. Limpe `e.target.value`.
- Faça o upload em paralelo (`Promise.allSettled`) e informe quais arquivos falharam.
- Use o estado `uploadingArquivo`, que já existe, para mostrar progresso e desabilitar o botão de salvar.
- Normalize `tags` e `arquivos` ao carregar (`Array.isArray(...) ? ... : []`), porque `POPs.jsx:379` acessa `popSelecionado.tags.map` sem proteção.

### 5.5 Pausa com estado obsoleto — ⚪ Baixo

**`AtividadesDia.jsx:133-151`**: `executarPausa` lê `atividadeParaPausar` e `motivoPausa` do *closure*. Passe esses valores como parâmetros explícitos.

---

## Fase 6 — Performance

### 6.1 Code-splitting do módulo — 🟠 Alto (maior ganho)

Hoje o bundle é **um único `index-*.js` de 2,87 MB** (855 KB gzip). Ele inclui ECharts completo, jsPDF, xlsx e os 12 painéis, mesmo para o técnico, que usa só 3 telas.

**Passo 6.1.a — Lazy-load das páginas** em `ExecucaoDashboard.jsx`:
```jsx
import React, { lazy, Suspense, useState, useEffect } from 'react';
const ExecucaoHome         = lazy(() => import('./ExecucaoHome'));
const AtividadesDia        = lazy(() => import('./AtividadesDia'));
const AgendaBase           = lazy(() => import('./AgendaBase'));
const PedidoMaterial       = lazy(() => import('./PedidoMaterial'));
const DesempenhoIndividual = lazy(() => import('./DesempenhoIndividual'));
const DesempenhoTime       = lazy(() => import('./DesempenhoTime'));
const PlanejamentoMacro    = lazy(() => import('./PlanejamentoMacro'));
const POPs                 = lazy(() => import('./POPs'));
const MinhasAtividades     = lazy(() => import('./MinhasAtividades'));
// ...
<div className="execucao-content">
  <Suspense fallback={<div className="execucao-loading">Carregando…</div>}>
    {renderPage()}
  </Suspense>
</div>
```

**Passo 6.1.b — Lazy-load dos módulos** em `App.jsx`:
```jsx
const ExecucaoDashboard = lazy(() => import('./features/execucao/components/ExecucaoDashboard'));
const DashboardV2       = lazy(() => import('./features/dashboard-v2/DashboardV2'));
// envolver os retornos em <Suspense>
```

**Passo 6.1.c — Import dinâmico de jsPDF e xlsx** em `PlanejamentoMacro.jsx:41-43`. Remova os imports estáticos e carregue dentro dos handlers de exportação:
```js
const exportarExcel = async () => {
  const XLSX = await import('xlsx');
  // ...
};
const exportarPDF = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // ...
};
```

**Passo 6.1.d — ECharts com tree-shaking:** já resolvido pelo `useEChart` (Passo 1.5), que usa `echarts/core`.

**Passo 6.1.e — Chunks de vendor** em `vite.config.js`:
```js
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
```

**Meta:** chunk inicial < 500 KB, com o ECharts/PDF/XLSX carregado só quando necessário. Valide com `npm run build`.

### 6.2 Consultas e payload

| # | Problema | Local | Ação |
|---|---|---|---|
| a | `select('*')` com relações em listagens | `execucao.js:15, 65, 108, 513, 764, 885, 987, 1631...` | Selecione só as colunas exibidas |
| b | **N+1** ao buscar a justificativa de pausa | `execucao.js:77-96` | Uma consulta `historico.in('atividade_id', ids).eq('tipo_acao','status_alterado').order('created_at', {ascending:false})`, agrupada em JS; ou uma view `ultima_pausa` com `DISTINCT ON (atividade_id)` |
| c | **N+1** nas notificações de atraso | `execucao.js:1728-1759` | Ver 3.5 |
| d | `contarNotificacoesNaoLidas` usa `select('*', {head:true})` | `execucao.js:1656` | `select('id', { count: 'exact', head: true })` |
| e | Filtro mensal com dois `.or()` errados + filtro em JS | `execucao.js:1471-1502` | `.lte('data_inicio', ultimoDia).or(\`data_fim.is.null,data_fim.gte.${primeiroDia}\`)` |
| f | Sem paginação: o PostgREST corta em **1.000 linhas** sem avisar | `buscarAtividades`, `buscarObras`, `buscarPOPs`, `buscarPedidosMaterial` | `.range(from, to)` + `{ count: 'exact' }` e UI "Carregar mais" |
| g | Criação sequencial de etapas | `PlanejamentoMacro.jsx:1901-1924` | Insert em lote (ver 3.2) |
| h | Técnicos rebuscados a cada filtro | `AgendaBase.jsx:47-50` | Ver 5.1.c; ideal: cache compartilhado (6.3) |

### 6.3 Cache e compartilhamento de dados

`buscarTecnicos`, `buscarTemplates` e as estatísticas do dia são buscados de novo em cada tela, e cada mutação recarrega a lista inteira (`carregarDados()` após salvar).

- **Leve:** um `ExecucaoDataContext` com `tecnicos` e `templates` carregados uma vez no `ExecucaoDashboard`.
- **Recomendado:** adotar **TanStack Query** (`@tanstack/react-query`), que dá cache, deduplicação, `staleTime`, *invalidation* após mutação e cancelamento de requisições obsoletas (substitui o `useAsyncData` da Fase 5).
- Depois de mutações, atualize o estado local com o registro retornado em vez de recarregar tudo:
  ```js
  setObras(prev => prev.map(o => o.id === atualizada.id ? { ...o, ...atualizada } : o));
  ```

### 6.4 Agregações no banco

Mova `buscarEstatisticasDia`, `buscarDesempenhoTime`, `buscarDesempenhoIndividual` e `buscarRankingTecnicos` para RPCs SQL (`GROUP BY tipo_execucao, status, data_programada`). Isso elimina o limite de 1.000 linhas e reduz o payload.

### 6.5 Índices faltando

O snapshot já tem índices simples. Adicione os compostos para os filtros mais usados:
```sql
CREATE INDEX IF NOT EXISTS idx_atv_tecnico_data ON public.execucao_atividades (tecnico_responsavel_id, data_programada);
CREATE INDEX IF NOT EXISTS idx_atv_tipo_data    ON public.execucao_atividades (tipo_execucao, data_programada);
CREATE INDEX IF NOT EXISTS idx_atv_status_data  ON public.execucao_atividades (status, data_programada);
CREATE INDEX IF NOT EXISTS idx_hist_atv_created ON public.execucao_atividades_historico (atividade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_created ON public.execucao_pedidos_material (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_lida_created ON public.execucao_notificacoes (lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pops_cat_ativo_ordem ON public.execucao_pops (categoria, ativo, ordem);
```
Depois rode o **Performance Advisor** do Supabase e remova os índices simples que ficarem redundantes.

### 6.6 Renderização

- `useMemo` nos filtros e agrupamentos: `AgendaBase.jsx:188-207`, `POPs.jsx:144-155`, `PedidoMaterial.jsx:1018-1044`, estatísticas de `PlanejamentoMacro.jsx:1848-1864`.
- *Debounce* (250 ms) nos campos de busca.
- `PlanejamentoMacro`: só **uma obra expandida** por vez (o Gantt é pesado); `React.memo` em `ObraCard`. Use paginação ou virtualização (`react-virtuoso`) acima de cerca de 50 obras.
- `ExecucaoHeader.jsx:16`: `toLocaleDateString` roda a cada render. Mova para `useMemo` ou constante de módulo.

---

## Fase 7 — Manutenibilidade, UX e acessibilidade

### 7.1 Quebrar `PlanejamentoMacro.jsx` (3.588 linhas)

Estrutura sugerida (mova sem alterar comportamento, um bloco por commit):
```
features/execucao/components/planejamento/
  PlanejamentoMacroPage.jsx      # orquestra filtros e estado
  AlertasEtapasAtrasadas.jsx
  ObrasList.jsx / ObraCard.jsx
  GanttObra.jsx
  modals/ObraFormModal.jsx, EtapaFormModal.jsx, AtividadeEtapaModal.jsx, TemplatesModal.jsx
  export/exportarExcel.js, exportarPDF.js   # com import() dinâmico
  hooks/usePlanejamento.js
```
Faça o mesmo com `PedidoMaterial.jsx` (1.822 linhas): lista, formulário, templates e histórico.

### 7.2 Eliminar duplicação

- **Agendas:** os 4 wrappers (`AgendaCivil/Eletrica/Galpao/Gestao.jsx`) viram um mapa de configuração. Os props `titulo`/`iconColor`, hoje ignorados pelo `AgendaBase` (lint 21-22), devem ser usados ou removidos.
  ```jsx
  const AGENDAS = {
    'agenda-eletrica': { tipo: 'eletrica', titulo: 'Agenda Elétrica' },
    'agenda-civil':    { tipo: 'civil',    titulo: 'Agenda Civil' },
    'agenda-galpao':   { tipo: 'galpao',   titulo: 'Agenda Galpão' },
    'agenda-gestao':   { tipo: 'gestao',   titulo: 'Agenda Gestão' },
  };
  // em renderPage: if (AGENDAS[currentPage]) return <AgendaBase usuario={usuario} {...AGENDAS[currentPage]} />;
  ```
- **Gráficos:** `useEChart` (1.5) para Desempenho Individual e Time.
- **Helpers repetidos** (`getStatusColor`, `getTipoIcon`, `getPrioridadeColor`, labels de status) → `features/execucao/constants.js`.

### 7.3 Navegação e estado

- `currentPage` vive só em memória: ao recarregar, o usuário volta à "Visão Geral". Sincronize com `location.hash` (`#/execucao/pedido-material`) ou adote `react-router`. Isso também permite links diretos e o botão "voltar" do navegador.
- `ExecucaoDashboard.jsx:45-49` (`useEffect` que redireciona o técnico) é redundante com a checagem em `renderPage`. Mantenha só uma.

### 7.4 Header com elementos falsos

`ExecucaoHeader.jsx`:
- O campo **"Buscar..."** não tem estado nem handler. Remova ou implemente a busca global.
- O botão **⚙ Configurações** não faz nada. Remova ou ligue a uma ação.
- O botão de menu mobile não tem `aria-label`.

### 7.5 Acessibilidade

- `ExecucaoSidebar.jsx:134`: os itens de menu são `<div onClick>`, sem foco por teclado. Troque por `<button type="button" aria-current={isActive ? 'page' : undefined}>`.
- Botões só com ícone (POPs, Planejamento, Agenda, Notificações, logout): adicione `aria-label` e `aria-hidden` no ícone.
- Modais: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, fechar com `Esc`, foco inicial e retorno de foco. Faça um `Modal` base reutilizável.
- Dropdown de notificações: `aria-expanded`, `aria-controls` e fechar com `Esc`.
- Listas com `key={index}` em itens editáveis (`PlanejamentoMacro.jsx:3086, 3257`, `MinhasAtividades.jsx:435, 460`, `AtividadesDia.jsx:633`): use `id`.

### 7.6 Higiene

- **111 `console.log/error`** no módulo. Crie um `logger` que só emite em `import.meta.env.DEV` e remova os logs com emoji do fluxo normal.
- `execucao.css` tem 24 `!important` e é importado em 3 arquivos. Importe uma vez só (no `ExecucaoDashboard`).
- Adicione `npm run lint` e `npm run check:contract` a um *pre-commit* ou à CI (`.github/workflows`).
- Considere migrar gradualmente para TypeScript, ou pelo menos JSDoc com `// @ts-check` no `execucao.js`. Os 9 métodos inexistentes seriam pegos em tempo de compilação.

---

## Fase 8 — Validação final

### 8.1 Automatizada
```bash
npx eslint src/features/execucao src/services/supabase/execucao.js   # meta: 0 erros
npm run check:contract                                                # meta: 0 falhas
npm run build                                                         # meta: chunk inicial < 500 KB
```

### 8.2 Roteiro manual

**Como TÉCNICO:**
- [ ] Minhas Atividades → abas Hoje, Semana e Todas carregam e mostram datas corretas (sem "Invalid Date")
- [ ] Abrir detalhes → histórico e comentários aparecem; enviar comentário atualiza a lista
- [ ] Iniciar, pausar (com motivo) e concluir → status muda, histórico registra, admin recebe notificação
- [ ] POPs → lista carrega, busca funciona, abrir POP mostra tags e arquivos
- [ ] Via DevTools/REST com o token do técnico: `execucao_obras` retorna `[]` e update em atividade alheia falha

**Como ADMIN_EXECUCAO:**
- [ ] Desempenho Individual e do Time → números e gráficos aparecem; trocar o período 10 vezes não gera warnings "already initialized" no console
- [ ] Planejamento → criar obra com template (etapas com datas corretas, sem −1 dia); editar etapa duas vezes não duplica a atividade
- [ ] Excluir obra **A** com cliente "Maria" → atividades da obra **B**, também de "Maria", continuam existindo
- [ ] Criar POP com 2 arquivos → os dois aparecem; abrir o arquivo usa URL assinada
- [ ] Pedido de material → salvar com erro de rede mostra mensagem e não fecha o modal
- [ ] Às **22h** (ou com o fuso do SO em UTC-3 e relógio adiantado), "Atividades do Dia" mostra o dia correto
- [ ] Notificações → nova pausa aparece sem recarregar (Realtime) e o contador bate

### 8.3 Checklist de entrega

- [ ] Fase 1 concluída (telas funcionando, 0 erros de lint)
- [ ] Migrações SQL (RLS, FKs, índices, RPCs) versionadas em `supabase/migrations/` e `supabase/schema/` atualizado (`npm run graph:update`)
- [ ] Buckets de Storage privados com políticas
- [ ] Bundle dividido
- [ ] Datas centralizadas em `utils/datas.js`
- [ ] Testes manuais 8.2 executados com os dois perfis

---

## Anexo A — Inventário de achados por severidade

| # | Sev. | Arquivo:linha | Achado | Fase |
|---|---|---|---|---|
| 1 | 🔴 | `MinhasAtividades.jsx:40-100` | 3 métodos inexistentes → tela do técnico quebrada | 1.1 |
| 2 | 🔴 | `POPs.jsx:60,91` | `listarPOPs`/`uploadArquivoPOP` inexistentes | 1.1 |
| 3 | 🔴 | `Desempenho*.jsx` | 3 métodos inexistentes → telas vazias | 1.1 |
| 4 | 🔴 | `PlanejamentoMacro.jsx:115` | `useState` condicional | 1.2 |
| 5 | 🔴 | `supabase/schema/logic.sql` | RLS ausente ou `USING (true)` em `execucao_*` | 2.1 |
| 6 | 🔴 | `execucao.js:1092-1100` | `excluirObra` apaga por nome/ILIKE | 3.1 |
| 7 | 🟠 | `Desempenho*.jsx` | ECharts sem `dispose` (vazamento) | 1.5 |
| 8 | 🟠 | `MinhasAtividades.jsx:293,393` | `atividade.data` → Invalid Date | 1.4 |
| 9 | 🟠 | `App.jsx:19-27` | Hooks após `return` condicional | 1.3 |
| 10 | 🟠 | `execucao.js:1874` | `getPublicUrl` para documentos | 2.2 |
| 11 | 🟠 | `execucao.js:219-299` e outros | Operações não atômicas | 3.2 |
| 12 | 🟠 | `execucao.js:423-438` | `registrarHistorico` ignora erro | 3.2 |
| 13 | 🟠 | 15+ locais | Datas em UTC | 4 |
| 14 | 🟠 | 8 componentes | Corridas de carregamento | 5.1 |
| 15 | 🟠 | build | Chunk único de 2,87 MB | 6.1 |
| 16 | 🟡 | `ProtectedRoute`/`ExecucaoDashboard`/`AuthContext` | Regras de permissão divergentes | 2.4 |
| 17 | 🟡 | `execucao.js:1589` | UUIDs fixos de nível de acesso | 2.4 |
| 18 | 🟡 | `execucao.js:1888` | Exclusão de arquivo confia no caminho do cliente | 2.3 |
| 19 | 🟡 | `PlanejamentoMacro.jsx:2145` | Atividade duplicada ao editar etapa | 3.3 |
| 20 | 🟡 | `execucao.js:1805-1854` | Upload com colisão e falha silenciosa | 3.4 |
| 21 | 🟡 | `execucao.js:1712-1760` | Notificações de atraso N+1 e duplicadas | 3.5 |
| 22 | 🟡 | `AgendaBase.jsx:67` | Semana começa no domingo | 4.2 |
| 23 | 🟡 | `PlanejamentoMacro.jsx:95` | Etapa sem data marcada como atrasada | 4.3 |
| 24 | 🟡 | todos | Erro mostrado como "lista vazia"; `alert`/`confirm` | 5.2 |
| 25 | 🟡 | `NotificacoesDropdown.jsx:48-61` | Polling sobreposto + promise sem tratamento | 5.3 |
| 26 | 🟡 | `POPs.jsx:84` | `criarPOP` sem `usuarioId` | 1.1.c |
| 27 | 🟡 | `execucao.js:77-96` | N+1 em atividades pausadas | 6.2 |
| 28 | 🟡 | `execucao.js:1471` | Filtro mensal incorreto | 6.2 |
| 29 | 🟡 | serviço | Sem paginação (corte silencioso em 1.000) | 6.2 |
| 30 | ⚪ | `ExecucaoHeader.jsx` | Busca e botão de configurações sem função | 7.4 |
| 31 | ⚪ | `ExecucaoSidebar.jsx:134` | Menu com `<div onClick>` | 7.5 |
| 32 | ⚪ | 3.588 / 1.822 linhas | Componentes monolíticos | 7.1 |
| 33 | ⚪ | 4 wrappers de agenda | Duplicação | 7.2 |
| 34 | ⚪ | módulo | 111 `console.*`, 24 `!important` | 7.6 |
| 35 | ⚪ | `auth.js:593` | `supabase.auth.admin` no cliente (verificar) | 2.5 |
