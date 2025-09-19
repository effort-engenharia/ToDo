import React from 'react';
import ReactECharts from 'echarts-for-react';

const MultiTitleGauge = ({ 
  title, 
  value, 
  maxValue = 300, 
  unit = "",
  emoji = "📊",
  color = "#3B82F6",
  labelSuffix = "" // Para adicionar 'k' ou 'mil' nas legendas
}) => {
  // Log detalhado dos dados do gauge
  console.log(`📊 MultiTitleGauge [${title}]:`, {
    value,
    maxValue,
    unit,
    emoji,
    color,
    labelSuffix,
    percentage: ((value / maxValue) * 100).toFixed(2) + '%',
    valueRaw: value,
    maxValueRaw: maxValue
  });

  const percentage = (value / maxValue) * 100;

  // Determinar a cor baseada na porcentagem
  const getColorByPercentage = (percent) => {
    if (percent < 25) return '#ef4444'; // Vermelho
    if (percent < 50) return '#f59e0b'; // Amarelo
    if (percent < 75) return '#3b82f6'; // Azul (era verde)
    return '#10b981'; // Verde (era azul)
  };

  const currentColor = getColorByPercentage(percentage);

  const getEChartsOption = () => {
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '75%'],
          radius: '90%',
          min: 0,
          max: maxValue,
          splitNumber: 4,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.25, '#ef4444'], // Vermelho para 0-25%
                [0.5, '#f59e0b'],  // Amarelo para 25-50%
                [0.75, '#3b82f6'], // Azul para 50-75% (era verde)
                [1, '#10b981']     // Verde para 75-100% (era azul)
              ]
            }
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: '#666'
            }
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2
            }
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5
            }
          },
          axisLabel: {
            color: '#464646',
            fontSize: 12,
            distance: -60,
            rotate: 'tangential',
            formatter: function (value) {
              const percent = (value / maxValue) * 100;
              return percent + '%';
            }
          },
          title: {
            offsetCenter: [0, '-10%'],
            fontSize: 16,
            color: '#666'
          },
          detail: {
            fontSize: 30,
            offsetCenter: [0, '-35%'],
            valueAnimation: true,
            formatter: function (value) {
              return value.toFixed(3) + unit;
            },
            color: currentColor
          },
          data: [
            {
              value: value,
              name: title.includes('Cliente') ? 'Clientes\nAtendidos' : 'Valor\nEntrada'
            }
          ]
        }
      ],
      animation: true,
      animationDuration: 2000,
      animationEasing: 'cubicOut'
    };
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
        <span className="text-xl sm:text-2xl">{emoji}</span>
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 text-center">{title}</h3>
      </div>
      
      <div style={{ height: '300px' }} className="relative">
        <ReactECharts 
          option={getEChartsOption()} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Legendas das marcações */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-center">
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mb-1"></div>
          <span className="text-gray-600">0-25%</span>
          <span className="font-medium">0-{Math.round(maxValue * 0.25)}{labelSuffix}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded-full mb-1"></div>
          <span className="text-gray-600">25-50%</span>
          <span className="font-medium">{Math.round(maxValue * 0.25)}-{Math.round(maxValue * 0.5)}{labelSuffix}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mb-1"></div>
          <span className="text-gray-600">50-75%</span>
          <span className="font-medium">{Math.round(maxValue * 0.5)}-{Math.round(maxValue * 0.75)}{labelSuffix}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mb-1"></div>
          <span className="text-gray-600">75-100%</span>
          <span className="font-medium">{Math.round(maxValue * 0.75)}-{maxValue}{labelSuffix}</span>
        </div>
      </div>

      {/* Informação adicional */}
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: currentColor }}>
          {value.toFixed(3)}{unit} de {maxValue}{unit}
        </div>
        <div className="text-sm text-gray-500">
          {percentage.toFixed(1)}% da meta mensal
        </div>
      </div>
    </div>
  );
};

export default MultiTitleGauge;
