import { useState, useEffect } from 'react';
import { apontamentosService } from '../services/supabaseService';
import { intervaloDoMesComercial } from '../utils/periodoComercial';

export const useGoogleSheetsData = (selectedMonth = null, selectedYear = null) => {
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null); // Armazena todos os dados sem filtro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Buscando dados do Supabase... (timestamp:', new Date().toLocaleTimeString(), ')');
      console.log('🚀 Force refresh:', forceRefresh);
      
      // Buscar todos os dados do Supabase com cache busting mais agressivo
      const response = await apontamentosService.buscarApontamentos({
        _t: Date.now(), // Cache busting parameter
        _r: Math.random(), // Random parameter para garantir nova requisição
        force: forceRefresh // Parâmetro de força
      });
      
      console.log('🔍 Resposta do Supabase recebida:', {
        dataType: typeof response,
        isArray: Array.isArray(response),
        dataLength: response?.length,
        timestamp: new Date().toLocaleTimeString(),
        firstItems: response?.slice(0, 3)?.map(item => ({
          nome: item.nome_cliente,
          fase: item.fase,
          valor_total: item.valor_total_servico,
          valor_entrada: item.valor_entrada_servico,
          created: item.created_at,
          proprietario: item.proprietario_relacionamento
        })),
        allFases: response ? [...new Set(response.map(item => item.fase))] : [],
        allProprietarios: response ? [...new Set(response.map(item => item.proprietario_relacionamento).filter(Boolean))] : []
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

        // intervaloDoMesComercial já aplica: regra antiga (mês calendário) para meses
        // anteriores a Ago/2026, e regra comercial (dia 23 do mês anterior ao dia 22)
        // a partir de Ago/2026.
        const { de: dataDe, ate: dataAte } = intervaloDoMesComercial(targetYear, targetMonth - 1);

        console.log('🎯 Target:', {
          targetMonth,
          targetYear,
          intervalo: `${dataDe.toISOString()} → ${dataAte.toISOString()}`
        });

        filteredData = response.filter((item, index) => {
          if (!item.created_at) {
            if (index < 3) console.log(`⚠️ Item ${index}: Sem created_at`);
            return false;
          }

          let dataContato;
          try {
            dataContato = new Date(item.created_at);
            if (isNaN(dataContato.getTime())) {
              if (index < 3) console.log(`⚠️ Item ${index}: Data inválida:`, item.created_at);
              return false;
            }
          } catch (error) {
            if (index < 3) console.log(`⚠️ Item ${index}: Erro ao processar data:`, item.created_at, error);
            return false;
          }

          // Filtro por intervalo comercial (ou calendário antes de Ago/2026)
          const isMatch = dataContato >= dataDe && dataContato <= dataAte;

          if (index < 5) {
            console.log(`📅 Item ${index}:`, {
              dataOriginal: item.created_at,
              match: isMatch
            });
          }

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
    refreshData: fetchData,
    forceRefresh: () => fetchData(true)
  };
};
