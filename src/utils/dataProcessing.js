// Índice principal para processamento de dados - exporta funcionalidades de módulos especializados

// Importar funções de formatação
export {
  formatCurrency,
  formatNumber,
  formatPercentage,
  generateColors,
  getPerformanceColor
} from './formatters.js';

// Importar funções de processamento principal
export {
  filterDataByPeriod,
  processSheetData,
  processRealData
} from './processors.js';

// Importar funções de extração (para casos onde precisem ser usadas diretamente)
export {
  extractReceitas,
  extractDespesas,
  extractSaldos,
  extractVendedores,
  extractRegioes,
  extractServicos,
  extractFunil,
  extractRelacionamento,
  extractClientesAtendidos,
  extractGanhosPerdas,
  extractMetaEntrada,
  extractOrigemClientes,
  extractServicosFechadosPorOrigem,
  extractTimeline,
  extractDistributionData
} from './extractors.js';
