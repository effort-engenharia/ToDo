# 📊 Dashboard Comercial

Um dashboard interativo e moderno para acompanhar métricas comerciais em tempo real, desenvolvido com React, Tailwind CSS e integração com Google Sheets.

## ✨ Funcionalidades

- 📈 **Métricas em Tempo Real**: Acompanhe receitas, despesas, vendas e mais
- 🎮 **Sistema de Gamificação**: Ranking de vendedores com badges e conquistas
- 📊 **Gráficos Interativos**: Visualizações dinâmicas com Chart.js
- 🎨 **Animações Fluidas**: Efeitos suaves com Anime.js
- 😊 **Interface Divertida**: Emojis e design moderno
- 📱 **Responsivo**: Otimizado para desktop, tablet e mobile
- 🔄 **Atualização Automática**: Integração direta com Google Sheets
- ⚡ **Performance**: Construído com Vite para carregamento rápido
- ✏️ **Metas Editáveis**: Configure e ajuste metas personalizadas em tempo real

## 🚀 Tecnologias Utilizadas

- **React 19** - Framework principal
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Estilização moderna
- **Chart.js** - Gráficos interativos
- **Anime.js** - Animações fluidas
- **Axios** - Requisições HTTP
- **React Icons** - Ícones modernos
- **Google Sheets API** - Fonte de dados

## 📋 Métricas Disponíveis

1. **💰 Receitas e Despesas**
   - Valores recebidos e pendentes
   - Despesas pagas e a pagar
   - Saldos máximo, mínimo e médio

2. **🎯 Funil de Negociações**
   - Qualificação de leads
   - Negociações em andamento
   - Contratos fechados
   - Perdas e cancelamentos

3. **👥 Performance da Equipe**
   - Ranking de vendedores
   - Total de vendas por pessoa
   - Sistema de badges e conquistas
   - Metas e desafios mensais

4. **📍 Análise Geográfica**
   - Vendas por região
   - Áreas mais atendidas
   - Distribuição de clientes

5. **🔧 Serviços e Produtos**
   - Serviços mais negociados
   - Tipos de adequação
   - Volume por categoria

6. **📊 Origem dos Clientes**
   - Carteira própria
   - Indicações
   - Prospecção ativa
   - Marketing digital

## 🎮 Sistema de Gamificação

- 🏆 **Ranking Dinâmico**: Posicionamento em tempo real
- 🎖️ **Badges de Conquista**: 
  - 💰 Top Vendas (>R$ 100k)
  - 🔥 Vendedor Ativo (>5 vendas)
  - ⭐ Super Vendedor (>10 vendas)
- 🎯 **Desafios Mensais**: Metas de equipe
- 📈 **Barras de Progresso**: Visualização de metas

## ✏️ Metas Editáveis

O dashboard permite editar metas em tempo real para personalizar suas métricas de acompanhamento:

### 🎯 **Meta de Valor de Entrada**
- Clique no ícone de edição ✏️ no cartão "Meta de Entrada"
- Digite o novo valor da meta em milhares (ex: 50 para R$ 50.000)
- Pressione Enter ou clique em "Salvar"
- A meta é persistida no navegador entre sessões

### 👥 **Meta de Total de Clientes Atendidos**
- Clique no ícone de edição ✏️ ao lado do valor total (ex: "93 de 300")
- Digite o número desejado de clientes para a meta mensal
- Pressione Enter ou clique em "Salvar"
- As cores do gauge se ajustam automaticamente aos novos valores:
  - 🔴 **Vermelho**: 0-25% da meta
  - 🟡 **Amarelo**: 25-50% da meta  
  - 🔵 **Azul**: 50-75% da meta
  - 🟢 **Verde**: 75-100% da meta

### 💾 **Persistência de Dados**
- Todas as metas editadas são salvas automaticamente no navegador
- Os valores permanecem após recarregar a página
- Cada usuário pode ter suas próprias configurações personalizadas
- Configurações padrão ficam centralizadas no arquivo `src/config/metas.js`

### ⚙️ **Configuração de Metas Padrão**
Para alterar os valores padrão das metas, edite o arquivo:
```javascript
// src/config/metas.js
export const METAS_CONFIG = {
  clientesAtendidos: 300,    // Meta padrão de clientes
  valorEntrada: 50000,       // Meta padrão de valor (R$ 50.000)
  // Outras configurações...
};
```

## 🛠️ Como Executar

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure a URL do Google Sheets**:
   - Edite o arquivo `src/hooks/useGoogleSheetsData.js`
   - Substitua a URL pela sua planilha publicada

3. **Execute o projeto**:
   ```bash
   npm run dev
   ```

4. **Acesse no navegador**:
   ```
   http://localhost:5173
   ```

## 📱 Responsividade

O dashboard é totalmente responsivo e se adapta a diferentes tamanhos de tela:

- **Desktop**: Layout completo com sidebar e múltiplas colunas
- **Tablet**: Layout adaptado com 2 colunas
- **Mobile**: Layout em coluna única com navegação otimizada

## 🔄 Integração com Google Sheets

O dashboard se conecta automaticamente com sua planilha do Google Sheets:

1. Publique sua planilha como web app
2. Configure a URL no arquivo de hooks
3. Os dados são atualizados em tempo real
4. Botão de refresh manual disponível

**Desenvolvido com ❤️ para impulsionar vendas e engajar equipes comerciais!** 🚀+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
