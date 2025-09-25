import React, { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { useAnimations } from '../hooks/useAnimations';
import { updateMetaInCode } from '../utils/codeUpdater';
import { salvarMeta } from '../config/metas';
import { useAuth } from '../contexts/AuthContext';

const EditableGauge = ({ 
  title, 
  value, 
  maxValue = 300, 
  onMaxValueChange,
  unit = "",
  emoji = "📊",
  color = "#3B82F6",
  labelSuffix = ""
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempMeta, setTempMeta] = useState(maxValue);
  const cardRef = useRef(null);
  const { animateIn } = useAnimations();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (cardRef.current) {
      animateIn(cardRef.current, 200);
    }
  }, []);

  useEffect(() => {
    setTempMeta(maxValue);
  }, [maxValue]);

  const handleEdit = () => {
    setIsEditing(true);
    setTempMeta(maxValue);
  };

  const handleSave = async () => {
    const newMeta = parseInt(tempMeta);
    if (!isNaN(newMeta) && newMeta > 0) {
      try {
        // Salvar no Supabase
        await salvarMeta('clientes_atendidos', newMeta, `Meta atualizada via EditableGauge em ${new Date().toLocaleString('pt-BR')}`);
        
        // Fallback para localStorage
        await updateMetaInCode('clientesAtendidos', newMeta);
        
        // Atualizar o estado local
        onMaxValueChange(newMeta);
        setIsEditing(false);
        
        console.log(`✅ Meta de clientes atendidos atualizada para: ${newMeta}`);
      } catch (error) {
        console.error('Erro ao salvar meta:', error);
        alert('Erro ao salvar meta. Verifique o console para mais detalhes.');
      }
    }
  };

  const handleCancel = () => {
    setTempMeta(maxValue);
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Log detalhado dos dados do gauge
  console.log(`📊 EditableGauge [${title}]:`, {
    value,
    maxValue,
    unit,
    emoji,
    color,
    labelSuffix,
    percentage: ((value / maxValue) * 100).toFixed(2) + '%'
  });

  const percentage = (value / maxValue) * 100;

  // Determinar a cor baseada na porcentagem
  const getColorByPercentage = (percent) => {
    if (percent < 25) return '#ef4444'; // Vermelho
    if (percent < 50) return '#f59e0b'; // Amarelo
    if (percent < 75) return '#3b82f6'; // Azul
    return '#10b981'; // Verde
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
                [0.75, '#3b82f6'], // Azul para 50-75%
                [1, '#10b981']     // Verde para 75-100%
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
              return Math.round(value) + unit;
            },
            color: currentColor
          },
          data: [
            {
              value: value,
              name: title.includes('Cliente') ? 'Clientes\nAtendidos' : 'Meta\nPersonalizada'
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
    <div ref={cardRef} className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl" style={{ opacity: 0 }}>
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

      {/* Informação adicional com campo editável para a meta */}
      <div className="mt-4 text-center">
        {!isEditing ? (
          <div>
            <div className="flex items-center justify-center space-x-2">
              <div className="text-2xl font-bold" style={{ color: currentColor }}>
                {value}{unit} de {maxValue}{unit}
              </div>
              {isAdmin() && (
                <button
                  onClick={handleEdit}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200 group"
                  title="Clique para editar a meta (Apenas Administradores)"
                >
                  <FaEdit className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors" />
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {percentage.toFixed(1)}% da meta mensal
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-600 mb-2">Editar Meta Mensal:</div>
            <div className="flex items-center justify-center space-x-2">
              <input
                type="number"
                value={tempMeta}
                onChange={(e) => setTempMeta(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="300"
                autoFocus
                min="1"
                max="9999"
              />
              <span className="text-sm text-gray-600">clientes</span>
              <div className="flex space-x-1 ml-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 rounded bg-green-500 hover:bg-green-600 text-white transition-colors text-sm font-medium"
                  title="Salvar"
                >
                  <FaCheck className="text-xs mr-1" />
                  Salvar
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 rounded bg-gray-500 hover:bg-gray-600 text-white transition-colors text-sm font-medium"
                  title="Cancelar"
                >
                  <FaTimes className="text-xs mr-1" />
                  Cancelar
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Pressione Enter para salvar ou Esc para cancelar
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableGauge;
