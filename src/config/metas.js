// Configurações globais do Dashboard Comercial
// Este arquivo contém os valores padrão das metas que podem ser editadas

export const METAS_CONFIG = {
  // Meta total de clientes a serem atendidos por mês
  clientesAtendidos: 300,
  
  // Meta de valor de entrada em reais (50000 = R$ 50.000)
  valorEntrada: 50000,
  
  // Outras configurações que podem ser adicionadas
  outros: {
    // Meta de conversão em percentual
    taxaConversao: 85,
    
    // Meta de vendas por vendedor
    vendasPorVendedor: 10
  }
};

// Função para obter a configuração atual das metas
export const getCurrentMetas = () => {
  const clientesAtendidos = parseInt(localStorage.getItem('meta_clientesAtendidos')) || METAS_CONFIG.clientesAtendidos;
  const valorEntrada = parseInt(localStorage.getItem('meta_valorEntrada')) || METAS_CONFIG.valorEntrada;
  
  return {
    clientesAtendidos,
    valorEntrada
  };
};

// Função para resetar todas as metas para os valores padrão
export const resetMetasToDefault = () => {
  localStorage.setItem('meta_clientesAtendidos', METAS_CONFIG.clientesAtendidos.toString());
  localStorage.setItem('meta_valorEntrada', METAS_CONFIG.valorEntrada.toString());
  
  console.log('🔄 Metas resetadas para valores padrão:', METAS_CONFIG);
  return METAS_CONFIG;
};

export default METAS_CONFIG;
