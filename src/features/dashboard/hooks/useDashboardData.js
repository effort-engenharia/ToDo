import { useMemo } from 'react';
import { processSheetData } from '../../../utils/dataProcessing';

/**
 * Hook para processar e preparar dados do dashboard
 * @param {Object} data - Dados do período selecionado
 * @param {Object} allData - Todos os dados disponíveis
 * @param {Number} metaPersonalizada - Meta personalizada definida pelo usuário
 * @param {String} selectedMonth - Mês selecionado
 * @param {String} selectedYear - Ano selecionado
 */
export const useDashboardData = (data, allData, metaPersonalizada, selectedMonth, selectedYear) => {
  // Processar dados da planilha para o período selecionado
  const processedData = useMemo(() => {
    return processSheetData(data, metaPersonalizada);
  }, [data, metaPersonalizada]);
  
  // Processar dados completos (para fallback)
  const allProcessedData = useMemo(() => {
    return processSheetData(allData, metaPersonalizada);
  }, [allData, metaPersonalizada]);

  // Decidir quais dados usar (filtrados ou completos)
  const dashboardData = useMemo(() => {
    console.log('📈 Dashboard data sendo recalculado para:', selectedMonth, selectedYear);
    console.log('📊 Dados processados filtrados:', {
      processedDataLength: data?.length,
      allDataLength: allData?.length,
      hasProcessedRegioes: !!processedData?.regioes?.length,
      hasProcessedVendedores: !!processedData?.vendedores?.length,
      processedOrigemClientes: processedData?.origemClientes,
      processedFunil: processedData?.funil,
      processedClientesAtendidos: processedData?.clientesAtendidos,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // MELHORIA: Priorizar sempre dados filtrados se existirem, mesmo que poucos
    // Só usar fallback se realmente não há dados para o período
    const hasValidFilteredData = processedData && data && data.length > 0;
    
    if (!hasValidFilteredData && allProcessedData && allData && allData.length > 0) {
      console.log('🔄 Dados filtrados insuficientes, usando dados completos como fallback');
      return allProcessedData;
    }
    
    console.log('✅ Usando dados filtrados para o período:', selectedMonth, selectedYear);
    console.log('🎯 Funil final que será usado:', processedData?.funil);
    return processedData;
  }, [processedData, allProcessedData, selectedMonth, selectedYear, data, allData]);

  // Calcular total de clientes atendidos no mês
  const totalClientesAtendidos = useMemo(() => {
    if (!dashboardData?.clientesAtendidos) return 0;
    // Se for um número, usar diretamente; se for objeto, somar valores
    if (typeof dashboardData.clientesAtendidos === 'number') {
      return dashboardData.clientesAtendidos;
    }
    return Object.values(dashboardData.clientesAtendidos).reduce((sum, value) => sum + (value || 0), 0);
  }, [dashboardData?.clientesAtendidos]);

  // Calcular taxa de sucesso dinâmica
  const taxaDeSucesso = useMemo(() => {
    const totalClientes = totalClientesAtendidos;
    const totalContratos = dashboardData?.funil?.contratoVenda || 0;
    
    if (totalClientes === 0) return '0.0%';
    
    const taxa = (totalContratos / totalClientes) * 100;
    return `${taxa.toFixed(1)}%`;
  }, [totalClientesAtendidos, dashboardData?.funil?.contratoVenda]);
  
  // Extrair anos e meses disponíveis dos dados
  const { availableYears, availableMonths } = useMemo(() => {
    if (!allData || !Array.isArray(allData)) {
      return {
        availableYears: ['2025'], // fallback
        availableMonths: ['setembro'] // fallback
      };
    }

    const yearsSet = new Set();
    const monthsSet = new Set();
    
    // Mapeamento de números de mês para nomes
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    allData.forEach(item => {
      if (item.created_at) {
        try {
          const date = new Date(item.created_at);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-based
            
            yearsSet.add(year.toString());
            monthsSet.add(monthNames[month]);
          }
        } catch (error) {
          // Ignorar datas inválidas
        }
      }
    });

    // Converter para arrays e ordenar
    const years = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a)); // Mais recente primeiro
    const months = Array.from(monthsSet).sort((a, b) => {
      return monthNames.indexOf(a) - monthNames.indexOf(b);
    });

    // Se não encontrou dados, usar fallbacks
    const finalYears = years.length > 0 ? years : ['2025'];
    const finalMonths = months.length > 0 ? months : ['setembro'];

    return {
      availableYears: finalYears,
      availableMonths: finalMonths
    };
  }, [allData]);

  return {
    dashboardData,
    totalClientesAtendidos,
    taxaDeSucesso,
    availableYears,
    availableMonths
  };
};