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
    console.log('❌ Dados inválidos ou vazios - retornando dados de exemplo para desenvolvimento');
    // Retornar dados de exemplo para desenvolvimento
    return {
      receitas: { recebido: 156750, aReceber: 89320, atrasadas: 23100 },
      despesas: { pago: 45600, aPagar: 28900, atrasadas: 8750 },
      saldos: { maximo: 180000, minimo: 45000, media: 112500 },
      vendedores: [
        { vendedor: 'Pamelli', valor: 85600, valorEntrada: 45600, vendas: 8 },
        { vendedor: 'Edgar', valor: 72300, valorEntrada: 38200, vendas: 6 },
        { vendedor: 'Eduarda', valor: 98750, valorEntrada: 52100, vendas: 9 }
      ],
      regioes: [
        { posicao: 1, proprietario: 'Pamelli', cidade: 'Santos', vendas: 12, valor: 95000 },
        { posicao: 2, proprietario: 'Eduarda', cidade: 'São Vicente', vendas: 8, valor: 67500 },
        { posicao: 3, proprietario: 'Edgar', cidade: 'Cubatão', vendas: 6, valor: 52300 }
      ],
      servicos: [
        { nome: 'Adequação Elétrica', valor: 156000, quantidade: 18 },
        { nome: 'Medição Ôhmica', valor: 89500, quantidade: 14 },
        { nome: 'SPDA', valor: 67200, quantidade: 11 }
      ],
      servicosObject: {
        adequacaoEletrica: 18,
        medicaoOhmica: 14,
        spda: 11,
        quadrosDePainel: 6,
        outros: 3
      },
      funil: { prospeccao: 9, qualificacao: 23, canceladoPerca: 4, negociacao: 18, contratoVenda: 16 },
      relacionamento: { pamelli: 35, edgar: 28, eduarda: 31 },
      clientesAtendidos: { pamelli: 8, edgar: 6, eduarda: 9 },
      ganhosPerdas: {
        contratoVenda: { quantidade: 16, valor: 256800 },
        canceladoPerca: { quantidade: 4, valor: 89200 }
      },
      metaEntrada: { valor: 45600, meta: metaPersonalizada },
      origemClientes: {
        carteira: 12,
        adm: 8,
        indicacao: 6,
        prospeccao: 4,
        google: 3,
        outros: 2
      },
      servicosFechadosPorOrigem: {
        carteira: 7,
        adm: 4,
        indicacao: 3,
        prospeccao: 1,
        google: 1,
        outros: 0
      },
      timeline: [],
      distributionData: [
        { name: 'Qualificação', value: 23, color: '#3B82F6' },
        { name: 'Negociação', value: 18, color: '#10B981' },
        { name: 'Contratos/Vendas', value: 16, color: '#8B5CF6' },
        { name: 'Cancelados/Perdas', value: 4, color: '#EF4444' }
      ]
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