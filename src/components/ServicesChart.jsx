import React from 'react';
import { FaCog, FaLightbulb, FaShieldAlt, FaClipboardList } from 'react-icons/fa';

const ServicesChart = ({ data }) => {
  // Log detalhado dos dados de serviços
  console.log('⚙️ ServicesChart - Dados recebidos:', {
    data,
    hasData: !!data,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
    dataValues: data ? Object.values(data) : null,
    isEmpty: !data || Object.keys(data).length === 0,
    totalServices: data ? Object.values(data).reduce((sum, val) => sum + (val || 0), 0) : 0
  });

  // Verificar se há dados disponíveis
  if (!data || Object.keys(data).length === 0) {
    console.warn('⚠️ ServicesChart - Sem dados disponíveis');
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
          SERVIÇOS NEGOCIADOS
        </h3>
        <div className="flex items-center justify-center h-64 sm:h-80">
          <div className="text-center">
            <FaCog className="mx-auto text-4xl text-gray-400 mb-4" />
            <p className="text-gray-500">Dados de serviços não disponíveis</p>
          </div>
        </div>
      </div>
    );
  }

  const services = data;
  
  // Calcular total e percentuais
  const total = Object.values(services).reduce((sum, val) => sum + val, 0);
  
  console.log('📊 ServicesChart - Dados processados:', {
    services,
    total,
    validServices: Object.entries(services).filter(([key, value]) => value > 0)
  });
  
  const servicesList = [
    { 
      name: 'Adequação Elétrica', 
      value: services.adequacaoEletrica || 0, 
      color: 'bg-green-500',
      icon: FaLightbulb 
    },
    { 
      name: 'Medição Ôhmica', 
      value: services.medicaoOhmica || 0, 
      color: 'bg-green-400',
      icon: FaCog 
    },
    { 
      name: 'SPDA', 
      value: services.spda || 0, 
      color: 'bg-green-600',
      icon: FaShieldAlt 
    },
    { 
      name: 'Quadros de Painel', 
      value: services.quadrosDePainel || 0, 
      color: 'bg-orange-500',
      icon: FaClipboardList 
    },
    { 
      name: 'Projetos Elétricos', 
      value: services.projetosEletricos || 0, 
      color: 'bg-red-500',
      icon: FaCog 
    },
    { 
      name: 'Laudos', 
      value: services.laudos || 0, 
      color: 'bg-red-400',
      icon: FaClipboardList 
    },
    { 
      name: 'CMI', 
      value: services.cmi || 0, 
      color: 'bg-red-600',
      icon: FaCog 
    },
    { 
      name: 'Outros', 
      value: services.outros || 0, 
      color: 'bg-red-300',
      icon: FaClipboardList 
    }
  ].filter(service => service.value > 0); // Filtrar apenas serviços com valores válidos
  
  console.log('📊 ServicesChart - Lista de serviços processados:', {
    servicesList,
    filteredCount: servicesList.length,
    totalBeforeFilter: 8,
    servicesWithZero: [
      { name: 'Adequação Elétrica', value: services.adequacaoEletrica || 0 },
      { name: 'Medição Ôhmica', value: services.medicaoOhmica || 0 },
      { name: 'SPDA', value: services.spda || 0 },
      { name: 'Quadros de Painel', value: services.quadrosDePainel || 0 },
      { name: 'Projetos Elétricos', value: services.projetosEletricos || 0 },
      { name: 'Laudos', value: services.laudos || 0 },
      { name: 'CMI', value: services.cmi || 0 },
      { name: 'Outros', value: services.outros || 0 }
    ]
  });

  // Organizar em grid como treemap
  const getGridSize = (value, total) => {
    const percentage = (value / total) * 100;
    if (percentage > 25) return 'col-span-4 row-span-4';
    if (percentage > 15) return 'col-span-3 row-span-3';
    if (percentage > 8) return 'col-span-2 row-span-3';
    if (percentage > 5) return 'col-span-2 row-span-2';
    if (percentage > 2) return 'col-span-2 row-span-1';
    return 'col-span-1 row-span-1';
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
        SERVIÇOS NEGOCIADOS
      </h3>
      
      {/* Treemap Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 grid-rows-6 sm:grid-rows-8 gap-1 sm:gap-2 h-80 sm:h-96">
        {servicesList.map((service, index) => {
          const Icon = service.icon;
          const gridSize = getGridSize(service.value, total);
          
          return (
            <div
              key={index}
              className={`${service.color} ${gridSize} rounded-lg p-2 sm:p-3 flex flex-col justify-center items-center text-white relative overflow-hidden hover:opacity-90 transition-all cursor-pointer group`}
              title={`${service.name}: ${service.value} serviços`}
            >
              {/* Conteúdo principal */}
              <div className="text-center flex flex-col items-center justify-center h-full">
                {/* Ícone - mostrar apenas em blocos maiores */}
                {service.value > 10 && (
                  <Icon className="text-white/90 mb-1 text-lg" />
                )}
                
                {/* Nome */}
                <div className={`font-bold text-center leading-tight ${service.value > 15 ? 'text-sm' : 'text-xs'}`}>
                  {service.name}
                </div>
                
                {/* Valor */}
                <div className={`font-bold ${service.value > 15 ? 'text-lg' : 'text-sm'}`}>
                  {service.value}
                </div>
              </div>
              
              {/* Tooltip hover */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-center text-white text-xs">
                  <div className="font-bold">{service.name}</div>
                  <div>{service.value} serviços</div>
                  <div>
                    {((service.value / total) * 100).toFixed(1)}% do total
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServicesChart;
