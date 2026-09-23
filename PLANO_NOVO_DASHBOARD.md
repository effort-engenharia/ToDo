# 🎨 Plano: Novo Dashboard Comercial (V2) — Effort Engenharia

> Documento vivo. Atualizado conforme execução.
> **Status:** ✅ Decisões confirmadas — aguardando ok final para iniciar Fase 1.

---

## 0. Decisões confirmadas

| Pergunta | Resposta |
|---|---|
| **Navegação** | ✅ Sidebar lateral |
| **Ranking** | ✅ Todos veem todos (igual pódio atual) |
| **Nome das medalhas** | ✅ Clássico: Bronze / Prata / Ouro / Diamante |
| **Toggle** | ✅ Só admin pode alterar o layout do sistema |
| **Métricas** | ✅ Foco em **ciclo semanal**, não diário |
| **Semanas coloridas** | ✅ 1ª verde → 2ª amarela → 3ª laranja → 4ª vermelha (pressão crescente) |

---


## 1. Objetivo

Criar uma **versão visual alternativa** do Dashboard Comercial, mantendo 100% das funcionalidades e dados atuais, com foco em:

- **UI/UX moderna** alinhada à identidade da Effort Engenharia
- **Responsividade** total (mobile-first)
- **Priorização de informação** para o dia-a-dia de vendas (menos rolagem, mais decisão)
- **Gamificação** para estimular competição saudável entre vendedores
- **Toggle** para o usuário escolher entre layout **Clássico** e **Novo (V2)**

**NADA será removido do dashboard atual.** O novo layout é uma segunda opção, coexistindo com o antigo.

---

## 2. Paleta Effort (extraída do site)

| Papel | Cor | Uso |
|---|---|---|
| **Primária (marca)** | `#F5B841` — amarelo dourado | Botões primários, destaques, medalhas, badges |
| **Neutra escura** | `#1F2937` (slate-800) | Header, sidebar, textos principais |
| **Neutra profunda** | `#111827` (slate-900) | Fundos escuros, cards premium |
| **Branco puro** | `#FFFFFF` | Fundos, cards, contraste |
| **Cinza claro** | `#F3F4F6` (gray-100) | Fundo geral da app |
| **Verde sucesso** | `#10B981` (emerald-500) | Metas atingidas, ganhos |
| **Vermelho alerta** | `#EF4444` (red-500) | Perdas, atrasos |
| **Azul info** | `#3B82F6` (blue-500) | Info secundária |
| **Cores por vendedor** | Mantém as atuais (Eduarda/Pamelli/Edgar/Vitor/Fábio) | Consistência visual |

**Tipografia:** Inter (já em uso).
**Acento visual:** amarelo Effort em detalhes (ícones ativos, bordas de item selecionado, progress bars).

---

## 3. Arquitetura de Arquivos

**Nenhum arquivo antigo será modificado ou apagado.** O novo layout vive em paralelo.

```
src/
├── features/
│   ├── dashboard/            ← V1 (atual) — INTOCADO
│   │   └── components/...
│   │
│   └── dashboard-v2/         ← NOVO
│       ├── DashboardV2.jsx           ← orquestrador
│       ├── components/
│       │   ├── HeaderV2.jsx           ← header escuro estilo Effort
│       │   ├── SidebarV2.jsx          ← navegação lateral (colapsável em mobile)
│       │   ├── BarraSemanas.jsx       ← barra 4 semanas coloridas (topo)
│       │   ├── SemanaAtualCard.jsx    ← card grande com semana + dias restantes
│       │   ├── KPISemana.jsx          ← Vendas semana, Meta semana, Streak
│       │   ├── MetaMesCard.jsx        ← progresso mensal + medalhas
│       │   ├── LeaderboardCard.jsx    ← ranking com medalhas
│       │   ├── VendasPorSemana.jsx    ← 4 semanas empilhadas (com cores)
│       │   ├── FunilCompact.jsx       ← funil compacto lateral
│       │   ├── AcoesRapidasPanel.jsx  ← esquecidos + próximos eventos unidos
│       │   ├── ClientesFechados.jsx   ← tabela com filtros (mesma lógica V1)
│       │   └── BadgesVendedor.jsx     ← conquistas do vendedor logado
│       └── hooks/
│           ├── useSemanaComercial.js  ← calcula semana atual, dias restantes, cor
│           └── useGamification.js     ← medalhas, streaks, comparativos
│
├── components/
│   └── LayoutSwitcher.jsx    ← modal admin-only para trocar entre V1/V2
│
├── contexts/
│   └── LayoutContext.jsx     ← preferência salva em localStorage
│
└── utils/
    ├── effortTheme.js        ← paleta e tokens (amarelo Effort, cores das semanas)
    └── semanasComercial.js   ← divide o mês comercial em 4 semanas
```

**Reutilização (sem duplicar código):**
- `useDashboardData` (hook) → reutilizado 100%
- `useMetaPersistence` → reutilizado 100%
- `apontamentosService` → reutilizado 100%
- Extractors (`extractVendasPorMes`, `extractClientesPorVendedor`, etc.) → reutilizados 100%
- `periodoComercial.js` (mês comercial) → reutilizado 100%
- **NOVO util `semanasComercial.js`** — divide o intervalo do mês comercial em 4 semanas, retorna qual é a semana atual e sua cor.

O V2 é **puramente uma nova camada de apresentação + hook de gamificação**.

---


## 4. Estrutura visual do V2 (wireframe conceitual)

```
┌─────────────────────────────────────────────────────────────────┐
│  🟨 EFFORT  |  Dashboard  Apontamentos  Arsenal  🔥 EDUARDA ▾  │  ← Header preto+amarelo com "fechador da semana"
├───────┬─────────────────────────────────────────────────────────┤
│ 📊    │                                                          │
│ Dash  │  Agosto 2026 (23/jul-22/ago) ▾   [🔄 Atualizar]         │
│       │                                                          │
│ 📝    │  ┌────── SEMANA 3 DE 4 ──────┐  ← cor 🟠 laranja (pressão)│
│ Apts  │  │ 🟢🟡🟠🔴  Vc está aqui →   │  ← barra 4 semanas coloridas │
│       │  │ Faltam 4 dias nesta semana  │                          │
│ ⚔️     │  └─────────────────────────────┘                          │
│ Arse  │                                                          │
│       │  ┌─── VENDAS SEMANA ───┬── META SEMANA ──┬──STREAK──┐   │
│ 👥    │  │ R$ 8.2k             │ 82% ▓▓▓▓▓░ 🥉  │ 🔥 3 sem │   │
│ Prof  │  │ +12% vs sem passada │ Faltam R$ 1.8k  │seguidas  │   │
│       │  └─────────────────────┴──────────────────┴──────────┘   │
│ ⚙️    │                                                          │
│ Admin │  ┌─── VENDAS DO MÊS ────────┐ ┌─ LEADERBOARD MÊS ──┐   │
│       │  │ R$ 34.2k / R$ 50k (68%)  │ │ 🥇 Eduarda   82k 💎│   │
│       │  │ ▓▓▓▓▓▓▓░░░              │ │ 🥈 Edgar     45k 🥇│   │
│       │  │ Faltam R$ 15.8k p/ Ouro🏆│ │ 🥉 Pamelli   38k 🥈│   │
│       │  │ ⚠️ Ritmo abaixo do ideal │ │    Vitor     22k 🥉│   │
│       │  └──────────────────────────┘ │    Fábio     18k   │   │
│       │                               └────────────────────┘   │
│       │                                                          │
│       │  ┌──── VENDAS POR SEMANA ────┐ ┌── FUNIL COMPACTO ──┐   │
│       │  │ Sem 1 🟢 R$ 12k ✓ Meta     │ │ Prospecção   ██████│   │
│       │  │ Sem 2 🟡 R$ 8k  ⚠️ 64%     │ │ Qualificação  ████ │   │
│       │  │ Sem 3 🟠 R$ 8.2k (atual)   │ │ Negociação     ██  │   │
│       │  │ Sem 4 🔴 --                │ │ Contrato/Venda ███ │   │
│       │  └────────────────────────────┘ └────────────────────┘   │
│       │                                                          │
│       │  ┌─── AÇÕES DA SEMANA (esquecidos + próximos) ────┐    │
│       │  │ 🔴 3 esquecidos    🟡 5 próximos eventos       │    │
│       │  └────────────────────────────────────────────────┘    │
│       │                                                          │
│       │  ┌─── MEUS CLIENTES FECHADOS ────────────────────┐    │
│       │  │ (tabela do V1, redesenhada com filtros)       │    │
│       │  └────────────────────────────────────────────────┘    │
└───────┴─────────────────────────────────────────────────────────┘
```

**Sidebar:** ícones + labels (colapsável em mobile → drawer).
**Header:** logo Effort à esquerda + badges dinâmicos (Fechador da Semana) + perfil à direita.
**Mobile:** grid 4-colunas colapsa para 2×2 e depois 1 coluna; sidebar vira bottom-nav ou drawer.

---

## 5. Elementos de gamificação (novos)

Calculados no hook `useGamification.js` a partir dos mesmos dados:

| Elemento | Regra | Onde aparece |
|---|---|---|
| **Progresso da meta semanal** | `vendido_semana / meta_semanal * 100` | Card MetaSemanaCard (destaque) |
| **Progresso da meta mensal** | `vendido_mes / meta_mes * 100` | Card MetaMesCard |
| **Medalhas (Clássico)** | 🥉 Bronze (50%+), 🥈 Prata (75%+), 🥇 Ouro (100%+), 💎 Diamante (150%+) | Ao lado do nome no leaderboard e no card do vendedor |
| **Streak semanal** | Semanas consecutivas atingindo a meta semanal | Card do vendedor logado |
| **"Faltam R$ X para próxima medalha"** | `meta * (proximo_nivel) - vendido` | Card MetaMesCard |
| **Ranking com pódio (top 3)** | Ouro/prata/bronze destacados. Todos os vendedores visíveis abaixo | LeaderboardCard |
| **"Você subiu N posições esta semana"** | Compara ranking atual vs semana anterior | Toast/badge no card do vendedor |
| **Badge "Fechador da semana"** | Vendedor com mais vendas na semana atual | Ícone dinâmico no header |
| **Badge "Maior ticket da semana"** | Vendedor com maior valor único fechado na semana | Card BadgesVendedor |
| **Melhor dia da semana** | Dia da semana em que o vendedor mais fecha | Info curiosa no card do vendedor |

**Nenhum dado novo precisa ser salvo no banco** — tudo derivado de `apontamentos_comerciais`.

---

## 5.1. Semanas comerciais coloridas (mecanismo central de gamificação)

**Divisão do mês comercial em 4 semanas** (dia 23 do mês anterior → dia 22 do mês corrente):

| Semana | Dias aprox. (Ago/2026 ex.) | Cor | Emoji | Mensagem/Tom |
|---|---|---|---|---|
| **Semana 1** | 23-29/jul | 🟢 Verde (`#10B981`) | 🌱 | "Início do ciclo — plante bem" |
| **Semana 2** | 30/jul-05/ago | 🟡 Amarelo (`#F5B841`) | 📈 | "Ritmo em construção" |
| **Semana 3** | 06-12/ago | 🟠 Laranja (`#F97316`) | 🔥 | "Pressão sobe — hora de fechar" |
| **Semana 4** | 13-22/ago | 🔴 Vermelho (`#EF4444`) | 🚨 | "Sprint final! Última semana" |

**Como a cor aparece na UI:**

1. **Barra de progresso do mês no topo do dashboard**
   - 4 segmentos preenchidos conforme avanço
   - Segmento da semana atual pulsa suavemente
   - Segmentos passados: cor completa. Segmento atual: cor + brilho. Futuros: cinza claro.

2. **Card "SEMANA X DE 4"** grande, com a cor da semana atual
   - Mostra dias restantes: "Ainda faltam 3 dias nesta semana"
   - "Vendido esta semana: R$ 12.5k / Meta semanal: R$ 12.5k ✅" (bordinha verde se bateu)

3. **Meta mensal muda de cor conforme a semana + progresso:**
   - Semana 1 com 20% de meta batida → verde (dentro do esperado)
   - Semana 4 com 50% de meta batida → vermelho pulsante (alerta)

4. **Timeline visual do mês** (opcional, componente pequeno)
   - Régua horizontal com as 4 semanas coloridas
   - Marcador "você está aqui" na semana corrente

**Cálculo das semanas (implementação):**
- Usa `intervaloDoMesComercial(ano, mes)` (já existe em `periodoComercial.js`)
- Divide o range em 4 partes iguais (arredondadas para dias inteiros)
- Semana atual = semana onde `hoje` cai

**Meta semanal:**
- Default: `meta_mensal / 4` (distribuição uniforme)
- Configurável (opcional): admin pode definir pesos diferentes (ex: 15% / 25% / 30% / 30% se quiser pressão maior no fim do mês)
- Por enquanto: mantém uniforme para simplificar. Configuração fica como feature futura.

---


## 6. Toggle Clássico ↔ Novo

**Regra de acesso:** apenas **admin** pode alterar. Usuários comuns veem o layout definido pelo admin — global, persistente no banco.

**Onde fica:**
- **Nova aba "Aparência"** dentro do `AdminPanel.jsx` (modal da engrenagem)
- Aba visível junto de Usuários / Permissões / Logs
- Ícone: `FaPalette` ou `FaEye`

**Conteúdo da aba:**
- Título "Aparência do Dashboard Comercial"
- 2 cards clicáveis lado-a-lado com preview de cada layout:
  - Card "Clássico" (V1) — visual atual
  - Card "Moderno" (V2) — novo layout Effort
- Radio/indicador de qual está ativo
- Botão "Salvar" (opcional — pode ser click-to-save)
- Aviso: "Esta preferência será aplicada para todos os usuários."
- Mostra "Última alteração: 26/07/2026 por Edgar" (data + nome do admin)

**Persistência — Supabase (migration já aplicada ✅):**

```sql
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por TEXT
);
INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('dashboard_layout', 'classico') ON CONFLICT DO NOTHING;
```

Migration `create_configuracoes_sistema_table` aplicada em 26/07/2026. Estado atual da linha: `chave='dashboard_layout' valor='classico'`.

**Fluxo técnico:**
1. Novo serviço `src/services/supabase/configuracoes.js`:
   - `obterConfiguracao(chave)` → SELECT
   - `salvarConfiguracao(chave, valor, atualizadoPor)` → UPSERT
2. `src/contexts/LayoutContext.jsx` provê `{ layout, setLayout, canSwitch, loading }`
   - No mount: SELECT no Supabase → seta layout
   - Subscribe via `postgres_changes` (realtime) para propagação instantânea entre usuários (opcional — se complicar, cai pra refresh manual)
   - Fallback local: `localStorage` como cache (evita flash na inicialização)
3. `App.jsx` decide: `layout === 'moderno' ? <DashboardV2 /> : <Dashboard />`
4. `canSwitch = isAdmin()` — só admin vê a aba "Aparência" no AdminPanel

**Default inicial:** `'classico'` — nenhum usuário existente é impactado sem ação explícita do admin.

**Realtime (opcional na Fase 1):** o Supabase JS suporta `.channel().on('postgres_changes', ...)` para escutar mudanças na tabela. Se implementado, quando o admin trocar o layout, todos os usuários logados recebem a mudança em ~1 segundo sem precisar recarregar. Se decidirmos não usar realtime na Fase 1, cada usuário verá a mudança no próximo F5.

---


## 7. Responsividade

Breakpoints (Tailwind padrão):
- **`< 640px` (mobile)**: 1 coluna, sidebar vira drawer, KPIs em 2×2, gráficos empilhados
- **`640-1024px` (tablet)**: 2 colunas, sidebar colapsada, KPIs em 4×1
- **`≥ 1024px` (desktop)**: layout completo, sidebar expandida
- **`≥ 1536px` (wide)**: aproveita largura extra em grids 3-4 colunas

Testado em:
- iPhone 14 Pro (390×844)
- iPad (768×1024)
- Desktop 1440×900
- Desktop widescreen 1920×1080

---

## 8. Acessibilidade e UX

- Contraste AA em todos os textos sobre fundos escuros/amarelos
- Ícones sempre acompanhados de texto (nunca só ícone)
- Focus states visíveis (`focus:ring-2 focus:ring-yellow-400`)
- Loading states em cards individuais (skeleton, não blank)
- Estados vazios com CTA claro ("Nenhuma venda hoje — que tal fazer um follow-up?")
- Motion: animações sutis (300ms), respeita `prefers-reduced-motion`

---

## 9. Plano de execução (passo a passo)

### **Fase 1: Fundação (não visível ainda)**
1. Criar `src/utils/effortTheme.js` com paleta e tokens
2. Criar `src/contexts/LayoutContext.jsx` (provider + hook)
3. Envolver `App.jsx` com `<LayoutProvider>`
4. Criar `src/components/LayoutSwitcher.jsx` (modal)
5. Adicionar botão no `ProfileButton.jsx` que abre o modal
6. **Não** trocar renderização ainda — só infra pronta

**Validação:** modal abre, preferência salva no localStorage, sem visual quebrado.

### **Fase 2: Estrutura do V2**
7. Criar `src/features/dashboard-v2/DashboardV2.jsx` (renderizando um placeholder simples)
8. `App.jsx` passa a rotear: se `layout==='moderno'` → `<DashboardV2 />`
9. Criar `HeaderV2.jsx` (versão preta/amarela da Effort) e `SidebarV2.jsx`
10. Layout shell completo (sem widgets ainda)

**Validação:** trocar de layout no modal mostra o shell V2; voltar ao V1 funciona.

### **Fase 3: Widgets principais**
11. `KPIStrip.jsx` — 4 KPIs no topo (reusando dados do `useDashboardData`)
12. `MetaProgressCard.jsx` — barra de progresso + gamificação básica
13. `LeaderboardCard.jsx` — ranking com medalhas
14. Ligar filtros (mês/ano) do header V2 aos hooks existentes

### **Fase 4: Gráficos e detalhes**
15. `VendasChart.jsx` (gráfico principal — linha/área)
16. `FunilCompact.jsx` (funil vertical compacto)
17. `AcoesRapidasPanel.jsx` (unifica esquecidos + próximos eventos)
18. `ClientesRecentes.jsx` (últimas 10 vendas)

### **Fase 5: Gamificação avançada**
19. Criar `hooks/useGamification.js`
20. `BadgesVendedor.jsx` (medalhas e conquistas)
21. Streaks, "faltam X para próxima medalha"
22. Badge dinâmico "Fechador do dia" no header

### **Fase 6: Refinamento**
23. Ajustes de responsividade (testes em breakpoints)
24. Loading states + skeletons
25. Estados vazios com CTAs
26. Micro-animações
27. Build + testes finais

### **Fase 7: Validação final**
28. Você abre no browser, alterna entre V1/V2, testa em mobile
29. Confirma → removo backups .old se houver
30. Atualizo `README.md` e memória de repo com a nova feature

---

## 10. O que NÃO vai mudar

- ✅ Regras de mês comercial (já implementadas)
- ✅ Autenticação e permissões
- ✅ CRUD de apontamentos
- ✅ Módulo Execução
- ✅ Módulo Arsenal de Guerra
- ✅ Banco de dados (zero migrations)
- ✅ Hooks e serviços existentes
- ✅ Dashboard V1 (fica igualzinho)

---

## 11. Backups e segurança

**Sistema em PRODUÇÃO.** Cada arquivo existente modificado ganha um `.old` de backup antes. Só removo o `.old` após você confirmar que está tudo funcionando.

**Arquivos existentes que serão tocados neste plano:**
1. `src/App.jsx` — adicionar `LayoutProvider` no root + roteamento condicional V1/V2
2. `src/components/AdminPanel.jsx` — adicionar nova aba "Aparência" (Users/Permissões/Logs/**Aparência**)

Só esses dois. Todo o resto é criação de arquivos novos.

**Banco de dados:**
- ✅ Migration `create_configuracoes_sistema_table` já aplicada em 26/07/2026 (idempotente, `IF NOT EXISTS` + `ON CONFLICT DO NOTHING`)
- ✅ Zero risco de perder dado existente — só criação de tabela nova
- ✅ Zero alteração em tabelas existentes
- ⚠️ RLS desabilitado nesta nova tabela (consistente com o padrão do resto do projeto — sistema usa auth próprio)

---

## 12. Checkpoints de aprovação

Após cada fase, pauso e você confirma antes de seguir:
- ✅ Fase 1 concluída → validar? [aguarda]
- ✅ Fase 2 concluída → validar? [aguarda]
- ... e assim por diante

Isso evita "arrependimento" tardio e mantém você no controle.

---

## 13. Perguntas antes de iniciar

Todas respondidas na Seção 0. ✅
Migration aplicada com sucesso. Tabela `configuracoes_sistema` disponível.

**Aguardando seu "vai" para iniciar a Fase 1.**

---

