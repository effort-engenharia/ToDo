# 📋 Plano de Implementação - Dashboard Execução

> **Data de Criação:** 11 de Janeiro de 2026  
> **Projeto:** Dashboard Comercial → Módulo Execução  
> **Status:** 🚧 Em Desenvolvimento

---

## 📊 ANÁLISE DO PROJETO ATUAL

### 1. Estrutura do Projeto
O projeto é um **Dashboard Comercial** desenvolvido em:
- **React 19** + **Vite 7**
- **Tailwind CSS 3.4**
- **Supabase** (Backend + Auth)
- **ECharts** (Gráficos)
- **React Icons** (Ícones)
- **Axios** (HTTP)

### 2. Arquitetura Atual
```
src/
├── App.jsx                    # Roteamento principal (dashboard, apontamentos, arsenal)
├── main.jsx                   # Entry point
├── index.css                  # Estilos globais (tema claro)
├── contexts/
│   └── AuthContext.jsx        # Context de autenticação
├── components/                # Componentes compartilhados
│   ├── AuthGuard.jsx         # Proteção de rotas autenticadas
│   ├── ProtectedRoute.jsx    # Verificação de permissões
│   ├── AdminPanel.jsx        # Painel de administração
│   ├── LoginModal.jsx        # Modal de login/registro
│   └── ...                   # Outros componentes
├── features/
│   └── dashboard/            # Feature do Dashboard Comercial
├── services/
│   └── supabase/             # Serviços do Supabase
│       ├── config.js         # Configuração Supabase
│       ├── auth.js           # Autenticação (authService, adminService)
│       └── ...               # Outros serviços
├── hooks/                    # Hooks customizados
└── utils/                    # Utilitários
```

### 3. Sistema de Autenticação Atual
- Usa **Supabase Auth** nativo
- Tabela `usuarios` para dados extras do usuário
- Tabela `niveis_acesso` para níveis (Administrador, Comercial, Orçamentista, Usuário)
- Tabela `paginas` para rotas (dashboard, apontamentos, arsenal)
- Tabela `permissoes` relaciona nivel_acesso → paginas

### 4. Níveis de Acesso Existentes no Supabase
| ID | Nome | Descrição |
|----|------|-----------|
| d011db6c-... | Administrador | Acesso completo ao sistema |
| c4e22877-... | COMERCIAL | Área exclusiva do time comercial |
| 1fddb2b7-... | ORÇAMENTISTA | Área de documentos e apontamentos |
| 29e6bc0d-... | Usuário | Acesso básico ao sistema |

### 5. Páginas Existentes no Supabase
| ID | Nome | Rota | Descrição |
|----|------|------|-----------|
| 5f6b5401-... | Dashboard | dashboard | Página principal com métricas |
| 483d9021-... | Apontamentos | apontamentos | Gestão de apontamentos comerciais |
| f5cdde11-... | Arsenal | arsenal | Arsenal de Guerra com recursos |

---

## 🎯 REQUISITOS DO NOVO MÓDULO - DASHBOARD EXECUÇÃO

### Funcionalidades Principais:
1. **Dashboard com menu lateral** (sidebar à esquerda + conteúdo à direita)
2. **Tema escuro** com layout moderno
3. **Dois perfis de usuários**: Administrador Execução e Técnico

### Menu Lateral - Administrador (Completo):
- [ ] 2.2.0 - Acompanhamento das Atividades do Dia
- [ ] 2.2.1 - Agenda de Execução Elétrica
- [ ] 2.2.2 - Agenda de Execução Civil
- [ ] 2.2.3 - Agenda de Execução Galpão
- [ ] 2.2.4 - Pedido de Material
- [ ] 2.2.5 - Relatório de Desempenho Individual
- [ ] 2.2.6 - Relatório de Desempenho do Time
- [ ] 2.2.7 - Visão do Planejamento Macro
- [ ] 2.2.8 - POP's (Procedimentos Operacionais Padrão)

### Menu Lateral - Técnico (Limitado):
- [ ] Minhas Atividades (agenda semanal, comentários, conclusão, transferência)
- [ ] POP's (visualização de documentos, fotos, vídeos)

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS (Supabase)

### Novas Tabelas a Criar:

#### 1. `execucao_atividades`
```sql
CREATE TABLE execucao_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo_execucao VARCHAR(50) NOT NULL, -- 'eletrica', 'civil', 'galpao'
  data_programada DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluida', 'transferida', 'cancelada'
  prioridade VARCHAR(20) DEFAULT 'normal', -- 'baixa', 'normal', 'alta', 'urgente'
  tecnico_responsavel_id UUID REFERENCES usuarios(id),
  cliente_nome VARCHAR(255),
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES usuarios(id)
);
```

#### 2. `execucao_atividades_historico`
```sql
CREATE TABLE execucao_atividades_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID REFERENCES execucao_atividades(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id),
  tipo_acao VARCHAR(50) NOT NULL, -- 'comentario', 'status_alterado', 'transferencia', 'conclusao'
  descricao TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `execucao_atividades_comentarios`
```sql
CREATE TABLE execucao_atividades_comentarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID REFERENCES execucao_atividades(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id),
  comentario TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. `execucao_pedidos_material`
```sql
CREATE TABLE execucao_pedidos_material (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID REFERENCES execucao_atividades(id),
  solicitante_id UUID REFERENCES usuarios(id),
  descricao TEXT NOT NULL,
  itens JSONB NOT NULL, -- [{nome, quantidade, unidade}]
  status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'aprovado', 'recusado', 'entregue'
  urgencia VARCHAR(20) DEFAULT 'normal',
  observacoes TEXT,
  aprovado_por UUID REFERENCES usuarios(id),
  data_aprovacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. `execucao_pops`
```sql
CREATE TABLE execucao_pops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100), -- 'eletrica', 'civil', 'galpao', 'seguranca', 'geral'
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. `execucao_pops_arquivos`
```sql
CREATE TABLE execucao_pops_arquivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pop_id UUID REFERENCES execucao_pops(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL, -- 'foto', 'video', 'documento'
  nome VARCHAR(255) NOT NULL,
  nome_arquivo_original VARCHAR(255),
  caminho_storage TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type VARCHAR(100),
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. `execucao_planejamento_macro`
```sql
CREATE TABLE execucao_planejamento_macro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  status VARCHAR(50) DEFAULT 'planejado',
  tipo_projeto VARCHAR(50),
  responsavel_id UUID REFERENCES usuarios(id),
  progresso INT DEFAULT 0, -- 0-100%
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Atualização de Tabelas Existentes:

#### Adicionar novos níveis de acesso:
```sql
INSERT INTO niveis_acesso (nome, descricao) VALUES
  ('ADMIN_EXECUCAO', 'Administrador da área de Execução'),
  ('TECNICO', 'Técnico de campo da área de Execução');
```

#### Adicionar novas páginas:
```sql
INSERT INTO paginas (nome, rota, descricao) VALUES
  ('Dashboard Execução', 'execucao', 'Dashboard principal da área de Execução'),
  ('Atividades do Dia', 'execucao/atividades-dia', 'Acompanhamento das atividades do dia'),
  ('Agenda Elétrica', 'execucao/agenda-eletrica', 'Agenda de Execução Elétrica'),
  ('Agenda Civil', 'execucao/agenda-civil', 'Agenda de Execução Civil'),
  ('Agenda Galpão', 'execucao/agenda-galpao', 'Agenda de Execução Galpão'),
  ('Pedido Material', 'execucao/pedido-material', 'Pedidos de Material'),
  ('Desempenho Individual', 'execucao/desempenho-individual', 'Relatório de Desempenho Individual'),
  ('Desempenho Time', 'execucao/desempenho-time', 'Relatório de Desempenho do Time'),
  ('Planejamento Macro', 'execucao/planejamento-macro', 'Visão do Planejamento Macro'),
  ('POPs', 'execucao/pops', 'Procedimentos Operacionais Padrão'),
  ('Minhas Atividades', 'execucao/minhas-atividades', 'Atividades do Técnico');
```

---

## 📁 ESTRUTURA DE ARQUIVOS A CRIAR

```
src/
├── features/
│   └── execucao/                          # Nova feature
│       ├── components/
│       │   ├── ExecucaoDashboard.jsx      # Dashboard principal com sidebar
│       │   ├── ExecucaoSidebar.jsx        # Menu lateral
│       │   ├── ExecucaoHeader.jsx         # Header do dashboard
│       │   │
│       │   ├── AtividadesDia.jsx          # 2.2.0 - Acompanhamento atividades
│       │   ├── AgendaEletrica.jsx         # 2.2.1 - Agenda elétrica
│       │   ├── AgendaCivil.jsx            # 2.2.2 - Agenda civil
│       │   ├── AgendaGalpao.jsx           # 2.2.3 - Agenda galpão
│       │   ├── PedidoMaterial.jsx         # 2.2.4 - Pedidos de material
│       │   ├── DesempenhoIndividual.jsx   # 2.2.5 - Relatório individual
│       │   ├── DesempenhoTime.jsx         # 2.2.6 - Relatório do time
│       │   ├── PlanejamentoMacro.jsx      # 2.2.7 - Visão macro
│       │   ├── POPs.jsx                   # 2.2.8 - POPs admin
│       │   ├── POPsViewer.jsx             # POPs para técnicos
│       │   ├── MinhasAtividades.jsx       # Atividades do técnico
│       │   │
│       │   ├── cards/
│       │   │   ├── AtividadeCard.jsx      # Card de atividade
│       │   │   ├── StatCard.jsx           # Card de estatística
│       │   │   └── POPCard.jsx            # Card de POP
│       │   │
│       │   └── modals/
│       │       ├── AtividadeModal.jsx     # Modal criar/editar atividade
│       │       ├── ComentarioModal.jsx    # Modal de comentário
│       │       ├── TransferenciaModal.jsx # Modal transferir atividade
│       │       ├── PedidoMaterialModal.jsx# Modal pedido material
│       │       └── POPModal.jsx           # Modal criar/editar POP
│       │
│       ├── hooks/
│       │   ├── useExecucaoData.js         # Hook para dados gerais
│       │   ├── useAtividades.js           # Hook para atividades
│       │   ├── usePedidosMaterial.js      # Hook para pedidos
│       │   └── usePOPs.js                 # Hook para POPs
│       │
│       └── styles/
│           └── execucao.css               # Estilos específicos (tema escuro)
│
├── services/
│   └── supabase/
│       └── execucao.js                    # Serviços do módulo execução
│
└── (alterações em arquivos existentes)
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: Preparação do Banco de Dados
- [x] 1.1 Criar tabela `execucao_atividades`
- [x] 1.2 Criar tabela `execucao_atividades_historico`
- [x] 1.3 Criar tabela `execucao_atividades_comentarios`
- [x] 1.4 Criar tabela `execucao_pedidos_material`
- [x] 1.5 Criar tabela `execucao_pops`
- [x] 1.6 Criar tabela `execucao_pops_arquivos`
- [x] 1.7 Criar tabela `execucao_planejamento_macro`
- [x] 1.8 Adicionar níveis de acesso (ADMIN_EXECUCAO, TECNICO)
- [x] 1.9 Adicionar páginas do módulo execução
- [x] 1.10 Configurar permissões para os níveis
- [ ] 1.11 Criar bucket de storage para POPs

### FASE 2: Estrutura Base do Frontend
- [x] 2.1 Criar pasta `src/features/execucao/`
- [x] 2.2 Criar arquivo de estilos `execucao.css` (tema escuro)
- [x] 2.3 Criar componente `ExecucaoSidebar.jsx`
- [x] 2.4 Criar componente `ExecucaoHeader.jsx`
- [x] 2.5 Criar componente `ExecucaoDashboard.jsx` (layout principal)
- [x] 2.6 Criar serviço `services/supabase/execucao.js`
- [x] 2.7 Atualizar `services/index.js` com novo serviço

### FASE 3: Integração com Sistema de Autenticação
- [x] 3.1 Usar detecção de área no App.jsx (comercial/execução)
- [x] 3.2 Reutilizar AuthGuard existente
- [x] 3.3 Reutilizar ProtectedRoute existente
- [x] 3.4 Atualizar `App.jsx` para rotear para execução

### FASE 4: Páginas do Módulo (Administrador)
- [x] 4.1 Criar `AtividadesDia.jsx` - Acompanhamento do dia
- [x] 4.2 Criar `AgendaEletrica.jsx` - Agenda elétrica
- [x] 4.3 Criar `AgendaCivil.jsx` - Agenda civil
- [x] 4.4 Criar `AgendaGalpao.jsx` - Agenda galpão
- [x] 4.5 Criar `PedidoMaterial.jsx` - Gestão de pedidos
- [x] 4.6 Criar `DesempenhoIndividual.jsx` - Relatório individual
- [x] 4.7 Criar `DesempenhoTime.jsx` - Relatório do time
- [x] 4.8 Criar `PlanejamentoMacro.jsx` - Visão macro
- [x] 4.9 Criar `POPs.jsx` - Gestão de POPs

### FASE 5: Páginas do Técnico
- [x] 5.1 Criar `MinhasAtividades.jsx` - Atividades do técnico
- [x] 5.2 Implementar comentários em atividades
- [x] 5.3 Implementar conclusão de atividades
- [x] 5.4 Implementar transferência de atividades
- [x] 5.5 Usar `POPs.jsx` com isAdmin=false para visualização

### FASE 6: Componentes Auxiliares
- [x] 6.1 Criar `AgendaBase.jsx` - Componente reutilizável
- [x] 6.2 Criar `ExecucaoHome.jsx` - Página inicial
- [x] 6.3 Modais integrados nos componentes principais
- [x] 6.4 Cards de estatísticas integrados

### FASE 7: Hooks e Serviços
- [x] 7.1 Implementar métodos do serviço execução
- [ ] 7.2 Criar hook `useAtividades.js` (opcional)
- [ ] 7.3 Criar hook `usePedidosMaterial.js` (opcional)
- [ ] 7.4 Criar hook `usePOPs.js` (opcional)

### FASE 8: Finalização e Ajustes
- [ ] 8.1 Testar fluxo de login/redirecionamento
- [ ] 8.2 Testar permissões admin vs técnico
- [ ] 8.3 Testar CRUD de atividades
- [ ] 8.4 Testar upload de arquivos nos POPs
- [ ] 8.5 Ajustes de responsividade
- [ ] 8.6 Ajustes visuais do tema escuro

---

## 🎨 DESIGN DO TEMA ESCURO

### Paleta de Cores
```css
:root {
  /* Backgrounds */
  --bg-primary: #0f172a;      /* slate-900 */
  --bg-secondary: #1e293b;    /* slate-800 */
  --bg-tertiary: #334155;     /* slate-700 */
  
  /* Text */
  --text-primary: #f8fafc;    /* slate-50 */
  --text-secondary: #94a3b8;  /* slate-400 */
  --text-muted: #64748b;      /* slate-500 */
  
  /* Accent */
  --accent-blue: #3b82f6;     /* blue-500 */
  --accent-green: #22c55e;    /* green-500 */
  --accent-yellow: #eab308;   /* yellow-500 */
  --accent-red: #ef4444;      /* red-500 */
  --accent-purple: #a855f7;   /* purple-500 */
  
  /* Border */
  --border-color: #334155;    /* slate-700 */
}
```

### Layout
- Sidebar fixa à esquerda (280px)
- Conteúdo principal à direita
- Header com informações do usuário
- Cards com bordas arredondadas e sombras sutis
- Animações suaves de transição

---

## ⚠️ PONTOS DE ATENÇÃO

1. **NÃO ALTERAR** código do Dashboard Comercial existente
2. **MANTER** compatibilidade com sistema de auth atual
3. **DESACOPLAR** completamente os módulos
4. **PRESERVAR** dados existentes no Supabase
5. **USAR** mesmo padrão de código do projeto
6. **EVITAR** novas dependências

---

## 📝 NOTAS

- Projeto ID Supabase: `cadrulmppoxhsfjizcfy`
- Organização: Effort
- Região: sa-east-1 (São Paulo)
- Email Admin: effort.engenharia.eletrica@gmail.com

---

> **Última Atualização:** 11/01/2026
