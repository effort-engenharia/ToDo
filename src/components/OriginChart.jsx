import React from 'react';
import { FaUserTie, FaAd, FaHandshake, FaSearch, FaGoogle, FaEllipsisH } from 'react-icons/fa';

const OriginChart = ({ data, title = "POR ONDE NOSSO CLIENTE ESTÁ CHEGANDO" }) => {
  // Log detalhado dos dados de origem
  console.log('🎯 OriginChart - Dados recebidos:', {
    title,
    hasData: !!data,
    specificValues: data ? {
      carteira: data.carteira,
      adm: data.adm,
      indicacao: data.indicacao,
      prospeccao: data.prospeccao,
      google: data.google,
      outros: data.outros
    } : null
  });

  // Verificar se há dados disponíveis COM pelo menos um valor > 0
  if (!data || Object.keys(data).length === 0 || !Object.values(data).some(val => val > 0)) {
    console.warn('⚠️ OriginChart - Sem dados disponíveis ou todos os valores são zero');
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
          {title}
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FaUserTie className="mx-auto text-4xl text-gray-400 mb-4" />
            <p className="text-gray-500">Dados de origem de clientes não disponíveis</p>
          </div>
        </div>
      </div>
    );
  }

  const origins = data;
  const total = Object.values(origins).reduce((sum, val) => sum + (val || 0), 0);
  
  console.log('📊 OriginChart - Dados processados:', {
    origins,
    total,
    validEntries: Object.entries(origins).filter(([key, value]) => (value || 0) > 0)
  });
  
  const originsList = [
    { 
      name: 'CARTEIRA', 
      value: origins.carteira || 0, 
      color: 'bg-green-500',
      icon: FaUserTie,
      percentage: total > 0 ? (((origins.carteira || 0) / total) * 100).toFixed(0) : '0'
    },
    { 
      name: 'ADM', 
      value: origins.adm || 0, 
      color: 'bg-orange-500',
      icon: FaAd,
      percentage: total > 0 ? (((origins.adm || 0) / total) * 100).toFixed(0) : '0'
    },
    { 
      name: 'INDICAÇÃO', 
      value: origins.indicacao || 0, 
      color: 'bg-orange-400',
      icon: FaHandshake,
      percentage: total > 0 ? (((origins.indicacao || 0) / total) * 100).toFixed(0) : '0'
    },
    { 
      name: 'PROSPECÇÃO', 
      value: origins.prospeccao || 0, 
      color: 'bg-orange-600',
      icon: FaSearch,
      percentage: total > 0 ? (((origins.prospeccao || 0) / total) * 100).toFixed(0) : '0'
    },
    { 
      name: 'GOOGLE', 
      value: origins.google || 0, 
      color: 'bg-red-500',
      icon: FaGoogle,
      percentage: total > 0 ? (((origins.google || 0) / total) * 100).toFixed(0) : '0'
    },
    { 
      name: 'OUTROS', 
      value: origins.outros || 0, 
      color: 'bg-red-400',
      icon: FaEllipsisH,
      percentage: total > 0 ? (((origins.outros || 0) / total) * 100).toFixed(0) : '0'
    }
  ];

  // Determinar tamanho baseado na porcentagem
  const getGridClass = (percentage) => {
    const percent = parseInt(percentage);
    if (percent >= 60) return 'col-span-8 row-span-6';
    if (percent >= 15) return 'col-span-3 row-span-3';
    if (percent >= 10) return 'col-span-3 row-span-2';
    if (percent >= 5) return 'col-span-2 row-span-2';
    return 'col-span-2 row-span-1';
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl">
      <h3 className="text-lg font-bold text-gray-800 mb-6 text-center">
        {title}
      </h3>
      
      {/* Treemap Grid */}
      <div className="grid grid-cols-8 grid-rows-6 gap-1 h-64">
        {originsList.map((origin, index) => {
          const Icon = origin.icon;
          const gridClass = getGridClass(origin.percentage);
          
          return (
            <div
              key={index}
              className={`${origin.color} ${gridClass} rounded-md p-2 flex flex-col justify-center items-center text-white relative overflow-hidden hover:opacity-90 transition-all cursor-pointer group`}
              title={`${origin.name}: ${origin.value} clientes (${origin.percentage}%)`}
            >
              {/* Conteúdo principal */}
              <div className="text-center flex flex-col items-center justify-center h-full">
                {/* Ícone - mostrar apenas em blocos maiores */}
                {parseInt(origin.percentage) >= 10 && (
                  <Icon className="text-white/90 mb-1 text-lg" />
                )}
                
                {/* Nome */}
                <div className={`font-bold text-center leading-tight ${parseInt(origin.percentage) >= 15 ? 'text-sm' : 'text-xs'}`}>
                  {origin.name}
                </div>
                
                {/* Porcentagem */}
                <div className={`font-bold ${parseInt(origin.percentage) >= 15 ? 'text-lg' : 'text-sm'}`}>
                  {origin.percentage}%
                </div>
              </div>
              
              {/* Tooltip hover */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-center text-white text-xs">
                  <div className="font-bold">{origin.name}</div>
                  <div>{origin.value} clientes</div>
                  <div>{origin.percentage}% do total</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OriginChart;
