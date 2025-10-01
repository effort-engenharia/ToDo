// Funções principais de processamento de dados
import {
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

// Função para filtrar dados por mês e ano
export const filterDataByPeriod = (data, selectedMonth, selectedYear) => {
  if (!data || !Array.isArray(data) || !selectedMonth || !selectedYear) {
    return data;
  }

  // Mapeamento de meses para números
  const monthMap = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
    'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
  };

  const targetMonth = monthMap[selectedMonth.toLowerCase()];
  const targetYear = parseInt(selectedYear);

  // Filtrar dados baseado em campo de data (assumindo que existe um campo 'data' ou similar)
  return data.filter(item => {
    if (!item.data) return true; // Se não há campo de data, incluir o item
    
    const itemDate = new Date(item.data);
    return itemDate.getMonth() + 1 === targetMonth && itemDate.getFullYear() === targetYear;
  });
};

// Função para processar dados do Google Sheets
export const processSheetData = (rawData, metaPersonalizada = 50000) => {
  console.log('🔄 Iniciando processamento dos dados:', {
    rawData: rawData,
    type: typeof rawData,
    isArray: Array.isArray(rawData),
    length: rawData?.length
  });

  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    console.log('❌ Dados inválidos ou vazios - retornando estrutura vazia respeitando filtro por período');
    // Retornar estrutura vazia quando não há dados para o período selecionado
    // Isso garante que o dashboard mostre "sem dados" em vez de dados fictícios
    return {
      receitas: { recebido: 0, aReceber: 0, atrasadas: 0 },
      despesas: { pago: 0, aPagar: 0, atrasadas: 0 },
      saldos: { maximo: 0, minimo: 0, media: 0 },
      vendedores: [], // Array vazio para não mostrar vendedores fictícios
      regioes: [], // Array vazio para não mostrar regiões fictícias
      servicos: [], // Array vazio
      servicosObject: {
        adequacaoEletrica: 0,
        medicaoOhmica: 0,
        spda: 0,
        quadrosDePainel: 0,
        outros: 0
      },
      funil: { prospeccao: 0, qualificacao: 0, canceladoPerca: 0, negociacao: 0, contratoVenda: 0 },
      relacionamento: {},
      clientesAtendidos: {},
      ganhosPerdas: {
        contratoVenda: { quantidade: 0, valor: 0 },
        canceladoPerca: { quantidade: 0, valor: 0 }
      },
      metaEntrada: { valor: 0, meta: metaPersonalizada },
      origemClientes: {
        carteira: 0,
        adm: 0,
        indicacao: 0,
        prospeccao: 0,
        google: 0,
        outros: 0
      },
      servicosFechadosPorOrigem: {
        carteira: 0,
        adm: 0,
        indicacao: 0,
        prospeccao: 0,
        google: 0,
        outros: 0
      },
      timeline: [],
      distributionData: []
    };
  }
  
  console.log('✅ Dados válidos - processando dados reais...');
  // Processar dados reais do Google Sheets
  return processRealData(rawData, metaPersonalizada);
};

export const processRealData = (data, metaPersonalizada = 50000) => {
  console.log('🔧 processRealData - Processando dados reais:', data.length, 'registros');
  console.log('🔧 processRealData - Primeiros 2 itens:', data.slice(0, 2));
  
  // Implementar processamento dos dados reais aqui
  const servicosResult = extractServicos(data);
  const regioesResult = extractRegioes(data);
  const vendedoresResult = extractVendedores(data);
  
  console.log('🔧 processRealData - Resultados das extrações:', {
    servicosArray: servicosResult.array?.length,
    regioes: regioesResult?.length,
    vendedores: vendedoresResult?.length
  });
  
  const result = {
    receitas: extractReceitas(data),
    despesas: extractDespesas(data),
    saldos: extractSaldos(data),
    vendedores: vendedoresResult,
    regioes: regioesResult,
    servicos: servicosResult.array,  // Array para SalesTable
    servicosObject: servicosResult.object, // Object com quantidades para ServicesChart
    funil: extractFunil(data),
    relacionamento: extractRelacionamento(data),
    clientesAtendidos: extractClientesAtendidos(data),
    ganhosPerdas: extractGanhosPerdas(data),
    metaEntrada: extractMetaEntrada(data, metaPersonalizada),
    origemClientes: extractOrigemClientes(data),
    servicosFechadosPorOrigem: extractServicosFechadosPorOrigem(data),
    timeline: extractTimeline(data),
    distributionData: extractDistributionData(data)
  };
  
  console.log('📊 processRealData - Resultado final:', {
    receitas: result.receitas,
    vendedores: result.vendedores?.length,
    regioes: result.regioes?.length,
    servicos: result.servicos?.length,
    servicosObject: result.servicosObject,
    funil: result.funil,
    clientesAtendidos: result.clientesAtendidos,
    origemClientes: result.origemClientes,
    servicosFechadosPorOrigem: result.servicosFechadosPorOrigem
  });
  
  return result;
};