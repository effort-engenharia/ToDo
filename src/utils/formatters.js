// Funções de formatação para números, moedas e cores

// Função para formatar números em moeda brasileira
export const formatCurrency = (value) => {
  // Tratar valores inválidos, NaN, null, undefined
  if (value === null || value === undefined || isNaN(value) || value === '') {
    return 'R$ 0,00';
  }
  
  // Converter para número se for string
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Se ainda for NaN após conversão, retornar 0
  if (isNaN(numericValue)) {
    return 'R$ 0,00';
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numericValue);
};

// Função para formatar números grandes
export const formatNumber = (value) => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toLocaleString('pt-BR');
};

// Função para formatar porcentagem
export const formatPercentage = (value) => {
  return `${value.toFixed(1)}%`;
};

// Função para gerar cores para gráficos
export const generateColors = (count) => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
  ];
  
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

// Função para calcular cores baseadas em performance
export const getPerformanceColor = (current, target) => {
  const percentage = (current / target) * 100;
  
  if (percentage >= 100) return '#10B981'; // Verde
  if (percentage >= 80) return '#F59E0B';  // Amarelo
  if (percentage >= 60) return '#F97316';  // Laranja
  return '#EF4444'; // Vermelho
};