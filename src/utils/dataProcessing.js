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
      funil: { qualificacao: 23, canceladoPerca: 4, negociacao: 18, contratoVenda: 16 },
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

const processRealData = (data, metaPersonalizada = 50000) => {
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
    origemClientes: result.origemClientes
  });
  
  return result;
};

// Funções auxiliares para extrair dados específicos
const extractReceitas = (data) => {
  console.log('💰 Extraindo receitas de', data.length, 'registros');
  
  const contratoVenda = data.filter(item => item.Fase === 'CONTRATO/VENDA');
  console.log('📋 Contratos/Vendas encontrados:', contratoVenda.length);
  
  // CORRIGIDO: Usar "Valor de Entrada" que é onde estão os valores reais
  const valorEntrada = contratoVenda.reduce((sum, item) => {
    const valor = parseFloat(item['Valor de Entrada']) || 0;
    return sum + valor;
  }, 0);
  
  const negociacao = data.filter(item => item.Fase === 'NEGOCIAÇÃO');
  console.log('🤝 Negociações encontradas:', negociacao.length);
  
  // Para negociações, também usar "Valor de Entrada"
  const aReceber = negociacao.reduce((sum, item) => {
    const valor = parseFloat(item['Valor de Entrada']) || 0;
    return sum + valor;
  }, 0);
  
  const result = { 
    recebido: valorEntrada, 
    aReceber: aReceber, 
    atrasadas: 0 
  };
  
  console.log('💰 Receitas calculadas:', result);
  return result;
};

const extractDespesas = (data) => {
  // Como não temos dados de despesa na planilha, retornar 0
  return { pago: 0, aPagar: 0, atrasadas: 0 };
};

const extractSaldos = (data) => {
  const valores = data
    .filter(item => item['Valor de Entrada'] && parseFloat(item['Valor de Entrada']) > 0)
    .map(item => parseFloat(item['Valor de Entrada']));
  
  if (valores.length === 0) return { maximo: 0, minimo: 0, media: 0 };
  
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const media = valores.reduce((sum, val) => sum + val, 0) / valores.length;
  
  return { maximo, minimo, media };
};

const extractVendedores = (data) => {
  console.log('👥 extractVendedores - Processando dados de vendedores:', data.length, 'registros');
  
  // Filtrar apenas dados com fase CONTRATO/VENDA para relatório de vendas
  const dadosVendas = data.filter(item => item['Fase'] === 'CONTRATO/VENDA');
  console.log('🎯 extractVendedores - Filtrados para CONTRATO/VENDA:', dadosVendas.length, 'de', data.length, 'registros');
  
  const vendedoresMap = {};
  
  dadosVendas.forEach((item, index) => {
    const vendedor = item['Proprietário do relacionamento'];
    if (!vendedor) return;
    
    // Log dos primeiros 3 itens para debug
    if (index < 3) {
      console.log(`👥 Item ${index}:`, {
        vendedor,
        valor: item['Valor '],
        valorEntrada: item['Valor de Entrada'],
        valorRaw: item.Valor,
        fase: item.Fase
      });
    }
    
    if (!vendedoresMap[vendedor]) {
      vendedoresMap[vendedor] = {
        vendedor: vendedor,
        vendas: 0,
        valor: 0,
        valorEntrada: 0,
        badge: ''
      };
    }
    
    // Tratar valores vazios, undefined ou NaN - usar 0 como fallback
    const valor = parseFloat(item['Valor ']) || 0;
    const valorEntrada = parseFloat(item['Valor de Entrada']) || 0;
    
    vendedoresMap[vendedor].vendas += 1;
    vendedoresMap[vendedor].valor += valor;
    vendedoresMap[vendedor].valorEntrada += valorEntrada;
  });
  
  // Converter para array e adicionar badges
  const vendedores = Object.values(vendedoresMap)
    .map(vendedor => ({
      ...vendedor,
      badge: vendedor.valor > 100000 ? '💰' : 
             vendedor.vendas > 10 ? '⭐' : 
             vendedor.vendas > 5 ? '🔥' : ''
    }))
    .sort((a, b) => b.valor - a.valor);
  
  console.log('👥 Vendedores processados:', vendedores);
  return vendedores;
};

const extractRegioes = (data) => {
  console.log('🌍 extractRegioes - Processando dados de região:', data.length, 'registros');
  
  // Filtrar apenas dados com fase CONTRATO/VENDA para relatório de vendas
  const dadosVendas = data.filter(item => item['Fase'] === 'CONTRATO/VENDA');
  console.log('🎯 extractRegioes - Filtrados para CONTRATO/VENDA:', dadosVendas.length, 'de', data.length, 'registros');
  
  // Agrupar por vendedor E região (não apenas por região)
  const vendedorRegiaMap = {};
  
  dadosVendas.forEach((item, index) => {
    const regiao = item.Área;
    const proprietario = item['Proprietário do relacionamento'];
    
    // Log dos primeiros 3 itens para debug
    if (index < 3) {
      console.log(`🌍 Item ${index}:`, {
        regiao,
        proprietario,
        valor: item['Valor '],
        valorEntrada: item['Valor de Entrada'],
        campos: Object.keys(item)
      });
    }
    
    // Pular se não há região ou proprietário
    if (!regiao || !proprietario) return;
    
    // Criar chave única por vendedor + região
    const chave = `${proprietario.trim()}_${regiao.trim()}`;
    
    if (!vendedorRegiaMap[chave]) {
      vendedorRegiaMap[chave] = {
        proprietario: proprietario.trim(),
        regiao: regiao.trim(),
        valor: 0,
        vendas: 0
      };
    }
    
    // Tratar valores vazios ou undefined
    const valor = parseFloat(item['Valor ']) || 0;
    vendedorRegiaMap[chave].valor += valor;
    vendedorRegiaMap[chave].vendas += 1;
  });

  // Log detalhado do mapeamento vendedor+região
  console.log('🗺️ Mapeamento vendedor+região completo:');
  Object.entries(vendedorRegiaMap).forEach(([chave, dados]) => {
    console.log(`  � ${dados.proprietario} em ${dados.regiao}:`, {
      vendas: dados.vendas,
      valor: dados.valor
    });
  });

  // Converter para estrutura esperada pela SalesTable (por vendedor+região)
  const regioes = Object.entries(vendedorRegiaMap).map(([chave, dados], index) => {
    return {
      posicao: index + 1,
      proprietario: dados.proprietario,
      cidade: dados.regiao,
      vendas: dados.vendas,
      valor: dados.valor
    };
  }).sort((a, b) => b.valor - a.valor);
  
  // Reorderar posições após ordenação
  regioes.forEach((item, index) => {
    item.posicao = index + 1;
  });
  
  console.log('🌍 Regiões processadas (final):', regioes);
  console.log('🔍 Detalhes de cada região:');
  regioes.forEach((regiao, index) => {
    console.log(`  ${index + 1}. ${regiao.proprietario} em ${regiao.cidade} - ${regiao.vendas} vendas - ${formatCurrency(regiao.valor)}`);
  });
  return regioes;
};const extractServicos = (data) => {
  console.log('⚙️ extractServicos - Iniciando com:', data.length, 'registros');
  console.log('⚙️ extractServicos - Primeiro item exemplo:', data[0]);
  console.log('⚙️ extractServicos - Campos disponíveis:', data[0] ? Object.keys(data[0]) : 'sem dados');
  
  const servicosMap = {};
  
  data.forEach((item, index) => {
    const servico = item['Tipo de Oportunidade'];
    // CORRIGIDO: Usar "Valor " (com espaço) para cálculos gerais
    const valor = item['Valor '] || 0;
    
    // Log detalhado dos primeiros 3 itens
    if (index < 3) {
      console.log(`⚙️ Item ${index}:`, {
        servico,
        valorRaw: item['Valor '],
        valorEntrada: item['Valor de Entrada'],
        valorUsado: valor,
        valorParsed: parseFloat(valor),
        allFields: Object.keys(item)
      });
    }
    
    if (!servico) return;
    
    if (!servicosMap[servico]) {
      servicosMap[servico] = {
        nome: servico,
        valor: 0,
        quantidade: 0
      };
    }
    
    const valorNumerico = parseFloat(valor) || 0;
    servicosMap[servico].valor += valorNumerico;
    servicosMap[servico].quantidade += 1;
  });
  
  console.log('⚙️ extractServicos - Serviços processados:', {
    servicosMap,
    servicosCount: Object.keys(servicosMap).length,
    servicosArray: Object.values(servicosMap)
  });
  
  // Para compatibilidade com os gráficos, precisamos retornar objeto com quantidades
  const servicosQuantidade = {};
  
  Object.values(servicosMap).forEach(servico => {
    // Mapear nomes para chaves simplificadas
    let chave = servico.nome.toLowerCase();
    const originalChave = chave;
    
    if (chave.includes('adequação')) chave = 'adequacaoEletrica';
    else if (chave.includes('medição') || chave.includes('ôhmica')) chave = 'medicaoOhmica';
    else if (chave.includes('spda')) chave = 'spda';
    else if (chave.includes('quadros') || chave.includes('painel')) chave = 'quadrosDePainel';
    else if (chave.includes('projetos')) chave = 'projetosEletricos';
    else if (chave.includes('laudos')) chave = 'laudos';
    else if (chave.includes('cmi')) chave = 'cmi';
    else chave = 'outros';
    
    console.log(`🔄 Mapeamento: "${servico.nome}" -> "${originalChave}" -> "${chave}"`);
    
    // Acumular se a chave já existe (para casos de múltiplos mapeamentos)
    servicosQuantidade[chave] = (servicosQuantidade[chave] || 0) + servico.quantidade;
  });
  
  console.log('⚙️ extractServicos - Objeto quantidade:', servicosQuantidade);
  
  return { 
    array: Object.values(servicosMap).sort((a, b) => b.valor - a.valor),
    object: servicosQuantidade // Para ServicesChart (quantidades)
  };
};

const extractFunil = (data) => {
  const funil = {
    qualificacao: 0,
    canceladoPerca: 0,
    negociacao: 0,
    contratoVenda: 0
  };
  
  data.forEach(item => {
    const fase = item.Fase;
    switch(fase) {
      case 'QUALIFICAÇÃO':
        funil.qualificacao += 1;
        break;
      case 'CANCELADO/PERCA':
        funil.canceladoPerca += 1;
        break;
      case 'NEGOCIAÇÃO':
        funil.negociacao += 1;
        break;
      case 'CONTRATO/VENDA':
        funil.contratoVenda += 1;
        break;
    }
  });
  
  return funil;
};

const extractRelacionamento = (data) => {
  const relacionamentoMap = {};
  
  data.forEach(item => {
    const vendedor = item['Proprietário do relacionamento'];
    if (!vendedor) return;
    
    if (!relacionamentoMap[vendedor]) {
      relacionamentoMap[vendedor] = 0;
    }
    relacionamentoMap[vendedor] += 1;
  });
  
  return relacionamentoMap;
};

const extractClientesAtendidos = (data) => {
  const clientesPorVendedor = {};
  
  data.forEach(item => {
    const vendedor = item['Proprietário do relacionamento'];
    const cliente = item['Nome Cliente'];
    
    if (!vendedor || !cliente || !cliente.trim()) return;
    
    if (!clientesPorVendedor[vendedor]) {
      clientesPorVendedor[vendedor] = new Set();
    }
    
    clientesPorVendedor[vendedor].add(cliente.trim());
  });
  
  // Converter Sets para números
  const resultado = {};
  Object.keys(clientesPorVendedor).forEach(vendedor => {
    resultado[vendedor] = clientesPorVendedor[vendedor].size;
  });
  
  return resultado;
};

const extractGanhosPerdas = (data) => {
  console.log('🎯 extractGanhosPerdas iniciado com', data.length, 'registros');
  
  const contratoVenda = data.filter(item => item.Fase === 'CONTRATO/VENDA');
  const canceladoPerca = data.filter(item => item.Fase === 'CANCELADO/PERCA');
  
  console.log('📋 Filtros aplicados:', {
    contratoVenda: contratoVenda.length,
    canceladoPerca: canceladoPerca.length,
    exemplosContratoVenda: contratoVenda.slice(0, 2).map(item => ({ 
      Fase: item.Fase, 
      Valor: item.Valor,
      Cliente: item['Nome Cliente'] 
    })),
    exemplosCancelado: canceladoPerca.slice(0, 2).map(item => ({ 
      Fase: item.Fase, 
      Valor: item.Valor,
      Cliente: item['Nome Cliente'] 
    }))
  });
  
  // CORRIGIDO: Usar "Valor " (com espaço) em vez de "Valor de Entrada" para Ganhos vs Perdas
  const valorContratoVenda = contratoVenda.reduce((sum, item) => {
    const valor = parseFloat(item['Valor ']) || 0;
    return sum + valor;
  }, 0);
  
  const valorCanceladoPerca = canceladoPerca.reduce((sum, item) => {
    const valor = parseFloat(item['Valor ']) || 0;
    return sum + valor;
  }, 0);

  // Extrair detalhes dos serviços perdidos para tabela
  const servicosPerdidosDetalhes = canceladoPerca.map(item => ({
    cliente: item['Nome Cliente'] || 'Cliente não informado',
    valor: parseFloat(item['Valor ']) || 0,
    servico: item['Tipo de Oportunidade'] || 'Serviço não informado'
  })); // Incluir TODOS os itens cancelados, mesmo com valor 0

  const resultado = {
    contratoVenda: { quantidade: contratoVenda.length, valor: valorContratoVenda },
    canceladoPerca: { 
      quantidade: canceladoPerca.length, 
      valor: valorCanceladoPerca,
      detalhes: servicosPerdidosDetalhes
    }
  };

  console.log('🏆 Ganhos vs Perdas processados:', resultado);
  
  return resultado;
};

const extractMetaEntrada = (data, metaPersonalizada = 50000) => {
  const valorEntrada = data.reduce((sum, item) => {
    const valor = parseFloat(item['Valor de Entrada']) || 0;
    return sum + valor;
  }, 0);
  
  // Usar meta personalizada passada como parâmetro
  return { valor: valorEntrada, meta: metaPersonalizada };
};

const extractOrigemClientes = (data) => {
  console.log('🎯 extractOrigemClientes iniciado com', data.length, 'registros');
  
  const origemMap = {
    carteira: 0,
    adm: 0,
    indicacao: 0,
    prospeccao: 0,
    google: 0,
    outros: 0
  };
  
  // Contar todas as origens únicas primeiro para debugging
  const origensUnicas = new Set();
  
  data.forEach((item, index) => {
    const origem = item['O Cliente Chegou por:'];
    
    if (!origem) {
      console.log(`⚠️ Item ${index}: Origem vazia ou undefined`);
      return;
    }
    
    origensUnicas.add(origem);
    
    // Mapear origem real para categoria esperada
    const origemLower = origem.toLowerCase().trim();
    
    if (origemLower.includes('carteira') || origemLower.includes('própria')) {
      origemMap.carteira += 1;
    } else if (origemLower.includes('adm') || origemLower.includes('administrativo')) {
      origemMap.adm += 1;
    } else if (origemLower.includes('indicação') || origemLower.includes('indicacao')) {
      origemMap.indicacao += 1;
    } else if (origemLower.includes('prospecção') || origemLower.includes('prospeccao') || origemLower.includes('prospectar')) {
      origemMap.prospeccao += 1;
    } else if (origemLower.includes('google') || origemLower.includes('ads') || origemLower.includes('search')) {
      origemMap.google += 1;
    } else {
      origemMap.outros += 1;
    }
  });
  
  console.log('🎯 Origens únicas encontradas na planilha:', Array.from(origensUnicas));
  console.log('🎯 Mapeamento final de origens:', origemMap);
  
  return origemMap;
};

const extractTimeline = (data) => {
  // Agrupar por mês/ano
  const timelineMap = {};
  
  data.forEach(item => {
    const dataContato = item['Data de contato'];
    if (!dataContato) return;
    
    const date = new Date(dataContato);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!timelineMap[monthYear]) {
      timelineMap[monthYear] = {
        receitas: 0,
        despesas: 0
      };
    }
    
    const valor = parseFloat(item.Valor) || 0;
    if (item.Fase === 'CONTRATO/VENDA') {
      timelineMap[monthYear].receitas += valor;
    }
  });
  
  return Object.entries(timelineMap)
    .map(([period, data]) => ({ period, ...data }))
    .sort((a, b) => a.period.localeCompare(b.period));
};

const extractDistributionData = (data) => {
  console.log('📊 extractDistributionData iniciado');
  
  // Se não há dados reais, retornar dados de exemplo para o gráfico de distribuição
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('⚠️ Sem dados válidos - usando dados de exemplo');
    return [
      { name: 'Leads Qualificados', value: 45, color: '#3B82F6' },
      { name: 'Em Negociação', value: 30, color: '#10B981' },
      { name: 'Propostas Enviadas', value: 15, color: '#F59E0B' },
      { name: 'Contratos Fechados', value: 10, color: '#8B5CF6' }
    ];
  }
  
  console.log(`🔧 Processando ${data.length} registros para distribuição de clientes`);
  
  try {
    // Contar clientes únicos por fase
    const clientesPorFase = new Map();
    const clientesUnicos = new Set();
    
    data.forEach(item => {
      const cliente = item['Nome Cliente'];
      const fase = item['Fase'];
      
      if (cliente && fase) {
        clientesUnicos.add(cliente);
        
        if (!clientesPorFase.has(fase)) {
          clientesPorFase.set(fase, new Set());
        }
        clientesPorFase.get(fase).add(cliente);
      }
    });
    
    // Mapear para cores e nomes amigáveis
    const faseMapping = {
      'QUALIFICAÇÃO': { name: 'Qualificação', color: '#3B82F6' },
      'NEGOCIAÇÃO': { name: 'Negociação', color: '#10B981' },
      'CONTRATO/VENDA': { name: 'Contratos/Vendas', color: '#8B5CF6' },
      'CANCELADO/PERCA': { name: 'Cancelados/Perdas', color: '#EF4444' }
    };
    
    const result = Array.from(clientesPorFase.entries()).map(([fase, clientes]) => {
      const mapping = faseMapping[fase] || { name: fase, color: '#6B7280' };
      return {
        name: mapping.name,
        value: clientes.size,
        color: mapping.color,
        originalFase: fase
      };
    });
    
    console.log('✅ Distribuição de clientes calculada:', {
      totalClientes: clientesUnicos.size,
      fases: result.length,
      distribuicao: result.map(r => `${r.name}: ${r.value}`).join(', ')
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Erro em extractDistributionData:', error);
    return [
      { name: 'Erro nos Dados', value: 1, color: '#EF4444' }
    ];
  }
};
