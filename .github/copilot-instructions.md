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
