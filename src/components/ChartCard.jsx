import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAnimations } from '../hooks/useAnimations';
import { generateColors } from '../utils/dataProcessing';

const ChartCard = ({ 
  title, 
  type = 'bar', 
  data, 
  emoji, 
  height = 300,
  delay = 0 
}) => {
  const chartRef = useRef(null);
  const { animateIn } = useAnimations();

  // Log detalhado dos dados recebidos
  console.log(`📊 ChartCard [${title}]:`, {
    type,
    hasData: !!data,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
    dataValues: data,
    height,
    delay
  });

  useEffect(() => {
    if (chartRef.current) {
      animateIn(chartRef.current, delay);
    }
  }, [delay]);

  const getEChartsOption = () => {
    if (!data || !data.labels || !data.values) {
      console.warn(`⚠️ ChartCard [${title}] - Dados inválidos:`, {
        hasData: !!data,
        hasLabels: data?.labels,
        hasValues: data?.values,
        data
      });
      return {
        title: {
          text: 'Sem dados disponíveis',
          left: 'center',
          top: 'center'
        }
      };
    }

    console.log(`✅ ChartCard [${title}] - Dados válidos:`, {
      labels: data.labels,
      values: data.values,
      labelsCount: data.labels?.length,
      valuesCount: data.values?.length
    });

    const colors = generateColors(data.values.length);
    
    const baseOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: type === 'doughnut' ? 'item' : 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#fff',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        }
      },
      animation: true,
      animationDuration: 2000,
      animationEasing: 'cubicOut'
    };

    if (type === 'doughnut') {
      return {
        ...baseOption,
        legend: {
          orient: 'horizontal',
          bottom: '0%',
          left: 'center'
        },
        series: [
          {
            name: data.label || title,
            type: 'pie',
            radius: ['30%', '80%'],
            center: ['50%', '42%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: {
              show: true,
              position: 'inside',
              formatter: '{d}%',
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 16,
                fontWeight: 'bold',
                color: '#fff'
              }
            },
            labelLine: {
              show: false
            },
            data: data.labels.map((label, index) => ({
              value: data.values[index],
              name: label,
              itemStyle: {
                color: colors[index]
              }
            }))
          }
        ]
      };
    }

    if (type === 'line') {
      return {
        ...baseOption,
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: data.labels,
          axisLine: {
            lineStyle: {
              color: 'rgba(0, 0, 0, 0.2)'
            }
          }
        },
        yAxis: {
          type: 'value',
          splitLine: {
            lineStyle: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        series: [
          {
            name: data.label || title,
            type: 'line',
            smooth: true,
            lineStyle: {
              width: 3
            },
            data: data.values,
            itemStyle: {
              color: colors[0]
            },
            areaStyle: {
              opacity: 0.3,
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                  offset: 0, color: colors[0] + '40'
                }, {
                  offset: 1, color: colors[0] + '10'
                }]
              }
            }
          }
        ]
      };
    }

    // Default: bar chart
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.2)'
          }
        },
        axisLabel: {
          color: '#374151',
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      series: [
        {
          name: data.label || title,
          type: 'bar',
          data: data.values.map((value, index) => ({
            value,
            itemStyle: {
              color: colors[index],
              borderRadius: [4, 4, 0, 0]
            }
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'inside',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#fff',
            formatter: '{c}'
          }
        }
      ]
    };
  };

  return (
    <div
      ref={chartRef}
      className="chart-container opacity-0"
    >
      {title && (
        <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
          {emoji && <span className="text-xl sm:text-2xl">{emoji}</span>}
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 text-center">{title}</h3>
        </div>
      )}
      
      <div style={{ height: `${height}px` }} className="min-h-[200px] sm:min-h-[250px]">
        <ReactECharts 
          option={getEChartsOption()} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

export default ChartCard;
