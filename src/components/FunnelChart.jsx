import React from 'react';
import ReactECharts from 'echarts-for-react';
import { FaChartLine } from 'react-icons/fa';

const FunnelChart = ({ data, title = "Funil de Negociações" }) => {
  // Log detalhado dos dados do funil
  console.log('🔧 FunnelChart - Dados recebidos:', {
    data,
    hasData: !!data,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
    title
  });

  // Dados padrão caso não sejam fornecidos
  const defaultData = {
    qualificacao: 13,
    canceladoPerca: 3,
    negociacao: 20,
    contratoVenda: 17
  };

  const funnelData = data || defaultData;

  console.log('📊 FunnelChart - Dados finais:', {
    funnelData,
    usingDefault: !data
  });

  // Transformar dados em array com ordem lógica do funil (do maior para menor)
  const chartData = Object.entries(funnelData)
    .map(([key, value]) => {
      let name;
      let color;
      let order; // Para ordenação lógica do funil
      
      // Processar dados tradicionais do funil
      switch(key) {
        case 'qualificacao':
          name = 'Qualificação';
          color = '#06b6d4'; // cyan-500
          order = 1;
          break;
        case 'negociacao':
          name = 'Negociação';
          color = '#f97316'; // orange-500
          order = 2;
          break;
        case 'contratoVenda':
          name = 'Contrato/Venda';
          color = '#22c55e'; // green-500
          order = 3;
          break;
        case 'canceladoPerca':
          name = 'Cancelado/Perda';
          color = '#ec4899'; // pink-500
          order = 4;
          break;
        default:
          name = key.charAt(0).toUpperCase() + key.slice(1);
          color = '#6b7280'; // gray-500
          order = 5;
      }
      
      return {
        name,
        value,
        order,
        itemStyle: {
          color
        }
      };
    })
    .sort((a, b) => b.value - a.value); // Ordenar do maior para o menor valor

  const getEChartsOption = () => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#fff',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        left: 'center',
        textStyle: {
          fontSize: 12
        }
      },
      series: [
        {
          name: title,
          type: 'funnel',
          left: '10%',
          top: '10%',
          width: '80%',
          height: '70%',
          orient: 'vertical',
          funnelAlign: 'center',
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}: {c}',
            fontSize: 12,
            fontWeight: 'bold',
            color: '#fff'
          },
          labelLine: {
            length: 10,
            lineStyle: {
              width: 1,
              type: 'solid'
            }
          },
          emphasis: {
            label: {
              fontSize: 16
            }
          },
          data: chartData
        }
      ],
      animation: true,
      animationDuration: 2000,
      animationEasing: 'cubicOut'
    };
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center justify-center text-center">
        <FaChartLine className="mr-2 sm:mr-3 text-blue-600 text-lg sm:text-xl" />
        {title}
      </h3>
      
      <div style={{ height: '350px' }} className="sm:h-[400px]">
        <ReactECharts 
          option={getEChartsOption()} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

export default FunnelChart;
