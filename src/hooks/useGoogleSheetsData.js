import { useState, useEffect } from 'react';
import { apontamentosService } from '../services/supabaseService';

export const useGoogleSheetsData = (selectedMonth = null, selectedYear = null) => {
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null); // Armazena todos os dados sem filtro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Buscando dados do Supabase...');
      
      // Buscar todos os dados do Supabase
      const response = await apontamentosService.buscarApontamentos();
      
      console.log('🔍 Resposta do Supabase recebida:', {
        dataType: typeof response,
        isArray: Array.isArray(response),
        dataLength: response?.length,
        firstItem: response?.[0]
      });
      
      // Armazenar todos os dados
      setAllData(response);
      
      // Filtrar dados no lado cliente se necessário
      let filteredData = response;
      
      if (selectedMonth && selectedYear && Array.isArray(response)) {
        console.log('🎯 Filtrando dados para:', selectedMonth, selectedYear);
        
        // Mapeamento de meses
        const monthMap = {
          'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
          'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
          'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
        };
        
        const targetMonth = monthMap[selectedMonth.toLowerCase()];
        const targetYear = parseInt(selectedYear);
        
        console.log('🎯 Target:', { targetMonth, targetYear });
        
        filteredData = response.filter((item, index) => {
          if (!item.created_at) {
            if (index < 3) console.log(`⚠️ Item ${index}: Sem created_at`);
            return false;
          }
          
          // Tentar diferentes formatos de data
          let dataContato;
          try {
            // Se a data estiver em formato ISO ou similar
            dataContato = new Date(item.created_at);
            
            // Verificar se a data é válida
            if (isNaN(dataContato.getTime())) {
              if (index < 3) console.log(`⚠️ Item ${index}: Data inválida:`, item.created_at);
              return false;
            }
          } catch (error) {
            if (index < 3) console.log(`⚠️ Item ${index}: Erro ao processar data:`, item.created_at, error);
            return false;
          }
          
          const itemMonth = dataContato.getMonth() + 1; // JavaScript months are 0-based
          const itemYear = dataContato.getFullYear();
          
          // Log dos primeiros 5 itens para debug
          if (index < 5) {
            console.log(`📅 Item ${index}:`, {
              dataOriginal: item.created_at,
              dataConvertida: dataContato,
              itemMonth,
              itemYear,
              targetMonth,
              targetYear,
              match: itemMonth === targetMonth && itemYear === targetYear,
              isCurrentYear: itemYear === targetYear,
              isCurrentMonth: itemMonth === targetMonth
            });
          }
          
          // Filtrar apenas registros do ano E mês especificados
          const isMatch = itemMonth === targetMonth && itemYear === targetYear;
          
          return isMatch;
        });
        
        console.log('📊 Dados filtrados:', {
          filtrados: filteredData.length,
          total: response.length,
          porcentagem: ((filteredData.length / response.length) * 100).toFixed(1) + '%',
          periodo: `${selectedMonth}/${selectedYear}`
        });
        
        // Se não há dados para o período filtrado, avisar no console
        if (filteredData.length === 0) {
          console.warn('⚠️ Nenhum dado encontrado para o período:', selectedMonth, selectedYear);
          console.log('💡 Sugestão: Verifique se existem dados com "created_at" para este período');
        }
      }
      
      setData(filteredData);
      setLastUpdated(new Date());
      console.log('✅ Dados atualizados com sucesso:', filteredData?.length, 'itens');
    } catch (err) {
      setError('Erro ao carregar dados do Supabase');
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  return {
    data,
    allData,
    loading,
    error,
    lastUpdated,
    refreshData: fetchData
  };
};
