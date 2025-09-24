// Funções de extração de dados específicos do Google Sheets
import { formatCurrency } from './formatters.js';

export const extractReceitas = (data) => {
  console.log('💰 Extraindo receitas de', data.length, 'registros');
  
  const contratoVenda = data.filter(item => item.fase === 'CONTRATO/VENDA');
  console.log('📋 Contratos/Vendas encontrados:', contratoVenda.length);
  
  // CORRIGIDO: Usar valor_total_servico para valor total dos contratos/vendas
  const valorTotal = contratoVenda.reduce((sum, item) => {
    const valor = parseFloat(item.valor_total_servico) || 0;
    console.log(`💰 Contrato ${item.nome_cliente}: valor_total_servico = ${valor}`);
    return sum + valor;
  }, 0);
  
  // Para valor de entrada, usar valor_entrada_servico
  const valorEntrada = contratoVenda.reduce((sum, item) => {
    const valor = parseFloat(item.valor_entrada_servico) || 0;
    return sum + valor;
  }, 0);
  
  const negociacao = data.filter(item => item.fase === 'NEGOCIAÇÃO');
  console.log('🤝 Negociações encontradas:', negociacao.length);
  
  // Para negociações, usar valor_total_servico como valor em negociação
  const aReceber = negociacao.reduce((sum, item) => {
    const valor = parseFloat(item.valor_total_servico) || 0;
    return sum + valor;
  }, 0);
  
  const result = { 
    recebido: valorTotal, // Valor total dos contratos fechados
    aReceber: aReceber,   // Valor total em negociação
    atrasadas: 0,
    valorEntrada: valorEntrada // Valor de entrada específico dos contratos
  };
  
  console.log('💰 Receitas calculadas:', result);
  return result;
};

export const extractDespesas = (data) => {
  // Como não temos dados de despesa na planilha, retornar 0
  return { pago: 0, aPagar: 0, atrasadas: 0 };
};

export const extractSaldos = (data) => {
  const valores = data
    .filter(item => item.valor_entrada_servico && parseFloat(item.valor_entrada_servico) > 0)
    .map(item => parseFloat(item.valor_entrada_servico));
  
  if (valores.length === 0) return { maximo: 0, minimo: 0, media: 0 };
  
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const media = valores.reduce((sum, val) => sum + val, 0) / valores.length;
  
  return { maximo, minimo, media };
};

export const extractVendedores = (data) => {
  console.log('👥 extractVendedores - Processando dados de vendedores:', data.length, 'registros');
  
  // Filtrar apenas dados com fase CONTRATO/VENDA para relatório de vendas
  const dadosVendas = data.filter(item => item.fase === 'CONTRATO/VENDA');
  console.log('🎯 extractVendedores - Filtrados para CONTRATO/VENDA:', dadosVendas.length, 'de', data.length, 'registros');
  
  const vendedoresMap = {};
  
  dadosVendas.forEach((item, index) => {
    const vendedor = item.proprietario_relacionamento;
    if (!vendedor) return;
    
    // Log dos primeiros 3 itens para debug
    if (index < 3) {
      console.log(`👥 Item ${index}:`, {
        vendedor,
        valor: item.valor_total_servico,
        valorEntrada: item.valor_entrada_servico,
        fase: item.fase
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
    const valor = parseFloat(item.valor_total_servico) || 0;
    const valorEntrada = parseFloat(item.valor_entrada_servico) || 0;
    
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

export const extractRegioes = (data) => {
  console.log('🌍 extractRegioes - Processando dados de região:', data.length, 'registros');
  
  // Filtrar apenas dados com fase CONTRATO/VENDA para relatório de vendas
  const dadosVendas = data.filter(item => item.fase === 'CONTRATO/VENDA');
  console.log('🎯 extractRegioes - Filtrados para CONTRATO/VENDA:', dadosVendas.length, 'de', data.length, 'registros');
  
  // Agrupar por vendedor E região (não apenas por região)
  const vendedorRegiaMap = {};
  
  dadosVendas.forEach((item, index) => {
    const regiao = item.cidade_atendimento;
    const proprietario = item.proprietario_relacionamento;
    
    // Log dos primeiros 3 itens para debug
    if (index < 3) {
      console.log(`🌍 Item ${index}:`, {
        regiao,
        proprietario,
        valor: item.valor_total_servico,
        valorEntrada: item.valor_entrada_servico,
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
    const valor = parseFloat(item.valor_total_servico) || 0;
    vendedorRegiaMap[chave].valor += valor;
    vendedorRegiaMap[chave].vendas += 1;
  });

  // Log detalhado do mapeamento vendedor+região
  console.log('🗺️ Mapeamento vendedor+região completo:');
  Object.entries(vendedorRegiaMap).forEach(([chave, dados]) => {
    console.log(`  📍 ${dados.proprietario} em ${dados.regiao}:`, {
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
};

export const extractServicos = (data) => {
  console.log('⚙️ extractServicos - Iniciando com:', data.length, 'registros');
  console.log('⚙️ extractServicos - Primeiro item exemplo:', data[0]);
  console.log('⚙️ extractServicos - Campos disponíveis:', data[0] ? Object.keys(data[0]) : 'sem dados');
  
  const servicosMap = {};
  
  data.forEach((item, index) => {
    const servico = item.tipo_oportunidade;
    const valor = item.valor_total_servico || 0;
    
    // Log detalhado dos primeiros 3 itens
    if (index < 3) {
      console.log(`⚙️ Item ${index}:`, {
        servico,
        valorRaw: item.valor_total_servico,
        valorEntrada: item.valor_entrada_servico,
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
    // Mapear nomes para chaves simplificadas, mantendo serviços individuais
    let chave = servico.nome.toLowerCase();
    const originalChave = chave;
    
    if (chave.includes('adequação')) chave = 'adequacaoEletrica';
    else if (chave.includes('medição') || chave.includes('ôhmica')) chave = 'medicaoOhmica';
    else if (chave.includes('spda')) chave = 'spda';
    else if (chave.includes('quadros') || chave.includes('painel')) chave = 'quadrosDePainel';
    else if (chave.includes('projetos')) chave = 'projetosEletricos';
    else if (chave.includes('laudos')) chave = 'laudos';
    else if (chave.includes('cmi')) chave = 'cmi';
    else {
      // Em vez de agrupar como "outros", manter o nome original do serviço
      // Converter para chave válida (remover espaços, caracteres especiais)
      chave = servico.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, ''); // Remove espaços
      
      // Se a chave ficar vazia, usar um nome genérico
      if (!chave) chave = `servico${Object.keys(servicosQuantidade).length + 1}`;
    }
    
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

export const extractFunil = (data) => {
  const funil = {
    qualificacao: 0,
    canceladoPerca: 0,
    negociacao: 0,
    contratoVenda: 0
  };
  
  data.forEach(item => {
    const fase = item.fase;
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

export const extractRelacionamento = (data) => {
  const relacionamentoMap = {};
  
  data.forEach(item => {
    const vendedor = item.proprietario_relacionamento;
    if (!vendedor) return;
    
    if (!relacionamentoMap[vendedor]) {
      relacionamentoMap[vendedor] = 0;
    }
    relacionamentoMap[vendedor] += 1;
  });
  
  return relacionamentoMap;
};

export const extractClientesAtendidos = (data) => {
  const clientesPorVendedor = {};
  
  data.forEach(item => {
    const vendedor = item.proprietario_relacionamento;
    const cliente = item.nome_cliente;
    
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

export const extractGanhosPerdas = (data) => {
  console.log('🎯 extractGanhosPerdas iniciado com', data.length, 'registros');
  
  const contratoVenda = data.filter(item => item.fase === 'CONTRATO/VENDA');
  const canceladoPerca = data.filter(item => item.fase === 'CANCELADO/PERCA');
  
  console.log('📋 Filtros aplicados:', {
    contratoVenda: contratoVenda.length,
    canceladoPerca: canceladoPerca.length,
    exemplosContratoVenda: contratoVenda.slice(0, 2).map(item => ({ 
      Fase: item.fase, 
      Valor: item.valor_total_servico,
      Cliente: item.nome_cliente 
    })),
    exemplosCancelado: canceladoPerca.slice(0, 2).map(item => ({ 
      Fase: item.fase, 
      Valor: item.valor_total_servico,
      Cliente: item.nome_cliente 
    }))
  });
  
  // Usar valor_total_servico para Ganhos vs Perdas
  const valorContratoVenda = contratoVenda.reduce((sum, item) => {
    const valor = parseFloat(item.valor_total_servico) || 0;
    return sum + valor;
  }, 0);
  
  const valorCanceladoPerca = canceladoPerca.reduce((sum, item) => {
    const valor = parseFloat(item.valor_total_servico) || 0;
    return sum + valor;
  }, 0);

  // Extrair detalhes dos serviços perdidos para tabela
  const servicosPerdidosDetalhes = canceladoPerca.map(item => ({
    cliente: item.nome_cliente || 'Cliente não informado',
    valor: parseFloat(item.valor_total_servico) || 0,
    servico: item.tipo_oportunidade || 'Serviço não informado'
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

export const extractMetaEntrada = (data, metaPersonalizada = 50000) => {
  console.log('🎯 extractMetaEntrada - Calculando valor de entrada total');
  
  // Filtrar apenas contratos fechados (CONTRATO/VENDA) para valor de entrada
  const contratosFechados = data.filter(item => item.fase === 'CONTRATO/VENDA');
  console.log(`📋 Contratos fechados encontrados: ${contratosFechados.length}`);
  
  // Usar valor_entrada_servico para entrada efetiva dos contratos fechados
  const valorEntrada = contratosFechados.reduce((sum, item) => {
    const valorEntradaServico = parseFloat(item.valor_entrada_servico) || 0;
    const valorTotalServico = parseFloat(item.valor_total_servico) || 0;
    
    // Se há valor de entrada específico, usar ele; senão usar o valor total como entrada
    const valorUsado = valorEntradaServico > 0 ? valorEntradaServico : valorTotalServico;
    
    console.log(`💰 ${item.nome_cliente}: entrada=${valorEntradaServico}, total=${valorTotalServico}, usado=${valorUsado}`);
    return sum + valorUsado;
  }, 0);
  
  console.log(`🎯 Meta de Entrada calculada: ${valorEntrada} de ${metaPersonalizada}`);
  
  // Usar meta personalizada passada como parâmetro
  return { valor: valorEntrada, meta: metaPersonalizada };
};

export const extractOrigemClientes = (data) => {
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
    const origem = item.origem_cliente;
    
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

export const extractServicosFechadosPorOrigem = (data) => {
  console.log('🎯 extractServicosFechadosPorOrigem iniciado com', data.length, 'registros');
  
  // Filtrar apenas registros com Fase = "CONTRATO/VENDA"
  const servicosFechados = data.filter(item => {
    const fase = item.fase;
    return fase === 'CONTRATO/VENDA';
  });
  
  console.log('💼 Serviços com CONTRATO/VENDA encontrados:', servicosFechados.length);
  
  const origemMap = {
    carteira: 0,
    adm: 0,
    indicacao: 0,
    prospeccao: 0,
    google: 0,
    outros: 0
  };
  
  // Contar quantidade de serviços fechados por origem
  servicosFechados.forEach((item, index) => {
    const origem = item.origem_cliente;
    
    if (!origem) {
      console.log(`⚠️ Item ${index}: Origem vazia ou undefined`);
      return;
    }
    
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
  
  console.log('💼 Serviços fechados por origem:', origemMap);
  
  return origemMap;
};

export const extractTimeline = (data) => {
  // Agrupar por mês/ano
  const timelineMap = {};
  
  data.forEach(item => {
    const dataContato = item.created_at;
    if (!dataContato) return;
    
    const date = new Date(dataContato);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!timelineMap[monthYear]) {
      timelineMap[monthYear] = {
        receitas: 0,
        despesas: 0
      };
    }
    
    const valor = parseFloat(item.valor_total_servico) || 0;
    if (item.fase === 'CONTRATO/VENDA') {
      timelineMap[monthYear].receitas += valor;
    }
  });
  
  return Object.entries(timelineMap)
    .map(([period, data]) => ({ period, ...data }))
    .sort((a, b) => a.period.localeCompare(b.period));
};

export const extractDistributionData = (data) => {
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