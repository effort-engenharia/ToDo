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

  // Decidir quais dados usar (sempre respeitar filtro por período)
  const dashboardData = useMemo(() => {
    // CORREÇÃO: Sempre usar dados filtrados, mesmo que vazios
    // Não fazer fallback para dados completos quando um período específico foi selecionado
    // Isso garante que o dashboard mostre "sem dados" quando não há dados para o período
    console.log('🎯 useDashboardData - Decidindo dados a usar:', {
      processedDataLength: processedData?.vendedores?.length || 0,
      dataLength: data?.length || 0,
      allDataLength: allData?.length || 0,
      selectedMonth,
      selectedYear
    });
    
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
    // Função para obter mês atual
    const getCurrentMonthFallback = () => {
      const monthNames = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      return monthNames[new Date().getMonth()];
    };

    if (!allData || !Array.isArray(allData)) {
      return {
        availableYears: ['2025'], // fallback
        availableMonths: [getCurrentMonthFallback()] // fallback com mês atual
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
    let finalMonths = months.length > 0 ? months : [getCurrentMonthFallback()];
    
    // Sempre incluir o mês atual na lista se não estiver presente
    const getCurrentMonth = () => {
      const agora = new Date();
      return monthNames[agora.getMonth()];
    };
    
    const currentMonth = getCurrentMonth();
    
    if (!finalMonths.includes(currentMonth)) {
      finalMonths = [...finalMonths, currentMonth].sort((a, b) => {
        return monthNames.indexOf(a) - monthNames.indexOf(b);
      });
    }

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