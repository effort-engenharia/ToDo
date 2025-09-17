import { useState, useEffect } from 'react';
import axios from 'axios';

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzD0ZEX7if_H3G2dfAVmwz5_4k0FaW1_ogJuTHZJrF2q3M_17VkVS3nXFlyfuvXfk9X/exec';

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
      
      console.log('🔍 Buscando dados da API...');
      
      // Sempre buscar todos os dados da API (sem filtros na URL)
      const response = await axios.get(GOOGLE_SHEETS_URL);
      
      console.log('🔍 Resposta da API recebida:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: response.data?.length,
        firstItem: response.data?.[0]
      });
      
      // Armazenar todos os dados
      setAllData(response.data);
      
      // Filtrar dados no lado cliente se necessário
      let filteredData = response.data;
      
      if (selectedMonth && selectedYear && Array.isArray(response.data)) {
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
        
        filteredData = response.data.filter((item, index) => {
          if (!item['Data de contato']) {
            if (index < 3) console.log(`⚠️ Item ${index}: Sem data de contato`);
            return false;
          }
          
          // Tentar diferentes formatos de data
          let dataContato;
          try {
            // Se a data estiver em formato ISO ou similar
            dataContato = new Date(item['Data de contato']);
            
            // Verificar se a data é válida
            if (isNaN(dataContato.getTime())) {
              if (index < 3) console.log(`⚠️ Item ${index}: Data inválida:`, item['Data de contato']);
              return false;
            }
          } catch (error) {
            if (index < 3) console.log(`⚠️ Item ${index}: Erro ao processar data:`, item['Data de contato'], error);
            return false;
          }
          
          const itemMonth = dataContato.getMonth() + 1; // JavaScript months are 0-based
          const itemYear = dataContato.getFullYear();
          
          // Log dos primeiros 5 itens para debug
          if (index < 5) {
            console.log(`📅 Item ${index}:`, {
              dataOriginal: item['Data de contato'],
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
          
          // CORREÇÃO: Filtrar apenas registros do ano E mês especificados
          const isMatch = itemMonth === targetMonth && itemYear === targetYear;
          
          return isMatch;
        });
        
        console.log('📊 Dados filtrados:', {
          filtrados: filteredData.length,
          total: response.data.length,
          porcentagem: ((filteredData.length / response.data.length) * 100).toFixed(1) + '%',
          periodo: `${selectedMonth}/${selectedYear}`
        });
        
        // Se não há dados para o período filtrado, avisar no console
        if (filteredData.length === 0) {
          console.warn('⚠️ Nenhum dado encontrado para o período:', selectedMonth, selectedYear);
          console.log('💡 Sugestão: Verifique se existem dados com "Data de contato" para este período');
        }
      }
      
      setData(filteredData);
      setLastUpdated(new Date());
      console.log('✅ Dados atualizados com sucesso:', filteredData?.length, 'itens');
    } catch (err) {
      setError('Erro ao carregar dados da planilha');
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
