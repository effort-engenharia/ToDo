# Dashboard Comercial - Copilot Instructions

Este é um dashboard comercial interativo desenvolvido em React com Tailwind CSS para acompanhar métricas de vendas e engajar o time comercial através de gamificação.

## ✅ Status do Projeto: CONCLUÍDO E OTIMIZADO

O dashboard foi desenvolvido com sucesso, está totalmente funcional e passou por uma limpeza completa removendo arquivos desnecessários!

## 🚀 Tecnologias Utilizadas
- React 19 com Vite
- Tailwind CSS para estilização
- Chart.js para gráficos interativos
- Animações CSS nativas (substituindo Anime.js para compatibilidade)
- React Icons para ícones modernos
- Axios para requisições HTTP
- Google Sheets API para integração de dados
- **MCP browsermcp**: Model Context Protocol para automação de browser e testes de interface

## 📊 Funcionalidades Implementadas

### 🏠 Dashboard Principal
- Interface responsiva com layout adaptativo
- Header com botão de atualização em tempo real
- Status de conexão e última atualização
- Tratamento de erros elegante

### 📈 Métricas de Negócio
- **Receitas**: Recebido, A Receber, Atrasadas
- **Despesas**: Pago, A Pagar, Atrasadas  
- **Saldos**: Máximo, Mínimo, Média
- **Clientes**: Total atendidos no período
- **Metas**: Valor de entrada vs meta mensal

### 🎮 Sistema de Gamificação
- Ranking dinâmico de vendedores
- Badges de conquista automáticas:
  - 💰 Top Vendas (>R$ 100k)
  - 🔥 Vendedor Ativo (>5 vendas)
  - ⭐ Super Vendedor (>10 vendas)
- Desafios mensais de equipe
- Barras de progresso visuais
- Cores diferentes por posição no ranking

### 📊 Visualizações de Dados
- **Funil de Negociações** (Gráfico Donut)
- **Vendas por Vendedor** (Gráfico de Barras)
- **Origem dos Clientes** (Gráfico Donut)
- **Serviços Negociados** (Gráfico de Barras)
- **Relacionamento por Vendedor** (Gráfico Donut)
- **Vendas por Região** (Gráfico de Barras)

### 🎨 Interface e UX
- Design moderno com glass effect
- Gradientes e cores vibrantes
- Emojis para tornar a interface divertida
- Animações suaves de entrada
- Hover effects em cartões
- Responsivo para mobile, tablet e desktop

### 🔄 Integração de Dados
- Conexão direta com Google Sheets via API
- Botão de atualização manual
- Dados de exemplo quando API não disponível
- Processamento automático dos dados
- Formatação de números e moedas em pt-BR

## 🏗️ Estrutura do Projeto (Atualizada - Setembro 2025)
```
src/
├── App.jsx                     # Componente principal
├── main.jsx                    # Entry point React
├── index.css                   # Estilos globais com Tailwind
├── components/                 # 11 componentes utilizados
│   ├── ChartCard.jsx          # Gráficos com Chart.js
│   ├── EditableGauge.jsx      # Gauge editável para metas
│   ├── EditableMetricCard.jsx # Cartões de métricas editáveis
│   ├── FunnelChart.jsx        # Funil de negociações
│   ├── LTVChart.jsx           # Gráfico de LTV
│   ├── MetasDebugPanel.jsx    # Panel debug para metas
│   ├── MetricCard.jsx         # Cartões de métricas
│   ├── MultiTitleGauge.jsx    # Gauge com múltiplos títulos
│   ├── OriginChart.jsx        # Origem dos clientes
│   ├── SalesTable.jsx         # Tabela de vendas
│   └── ServicesChart.jsx      # Gráfico de serviços
├── hooks/                     # 2 hooks utilizados
│   ├── useGoogleSheetsData.js # Hook para dados do Sheets
│   └── useAnimations.js       # Hook para animações CSS
├── utils/                     # 2 utils utilizados
│   ├── codeUpdater.js         # Atualização de código/metas
│   └── dataProcessing.js      # Processamento de dados
└── config/                    # Configurações
    └── metas.js               # Configuração de metas
```

## 🧹 Limpeza Realizada (Setembro 2025)
- ❌ Removidos 19 arquivos desnecessários (backups, testes, duplicatas)
- ✅ Mantidos apenas arquivos efetivamente utilizados
- ✅ Estrutura otimizada e organizada

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

## 🎯 Próximos Passos (Opcionais)
- Integrar com dados reais do Google Sheets
- Adicionar filtros por período
- Implementar notificações push
- Criar dashboard mobile dedicado
- Adicionar exportação para PDF/Excel
