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
    }
  ];

  // Adicionar dinamicamente outros serviços que não estão na lista fixa
  const fixedServiceKeys = ['adequacaoEletrica', 'medicaoOhmica', 'spda', 'quadrosDePainel', 'projetosEletricos', 'laudos', 'cmi'];
  const dynamicColors = ['bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500', 'bg-rose-500'];
  let colorIndex = 0;

  Object.entries(services).forEach(([key, value]) => {
    if (!fixedServiceKeys.includes(key) && value > 0) {
      // Converter chave para nome legível com mapeamento específico
      let serviceName;
      
      // Mapeamento específico para nomes conhecidos
      const serviceNameMap = {
        'sistemaDeIluminacao': 'Sistema de Iluminação',
        'avcb': 'AVCB',
        'civil': 'Civil',
        'estacaoDeRecarga': 'Estação de Recarga',
        'prumadas': 'Prumadas',
        'manutencaoEletricas': 'Manutenção Elétricas',
        'cabinePrimaria': 'Cabine Primária',
        'sistaMadeIncendio': 'Sistema de Incêndio',
        'quadroElevador': 'Quadro Elevador'
      };
      
      if (serviceNameMap[key]) {
        serviceName = serviceNameMap[key];
      } else {
        // Conversão genérica para outros nomes
        serviceName = key
          .replace(/([A-Z])/g, ' $1') // Adicionar espaço antes de maiúsculas
          .replace(/^./, str => str.toUpperCase()) // Primeira letra maiúscula
          .trim();
      }

      servicesList.push({
        name: serviceName,
        value: value,
        color: dynamicColors[colorIndex % dynamicColors.length],
        icon: FaClipboardList
      });
      colorIndex++;
    }
  });

  // Filtrar apenas serviços com valores válidos
  const filteredServicesList = servicesList.filter(service => service.value > 0);
  
  console.log('📊 ServicesChart - Lista de serviços processados:', {
    filteredServicesList,
    filteredCount: filteredServicesList.length,
    totalServices: Object.keys(services).length,
    servicesWithZero: Object.entries(services).filter(([key, value]) => value === 0)
  });

  // Organizar em grid responsivo baseado nos valores
  const getGridSize = (value, total) => {
    const percentage = (value / total) * 100;
    if (percentage > 20) return 'col-span-6 row-span-2'; // Muito grande
    if (percentage > 15) return 'col-span-4 row-span-2'; // Grande
    if (percentage > 10) return 'col-span-3 row-span-2'; // Médio-grande
    if (percentage > 5) return 'col-span-2 row-span-2';  // Médio
    if (percentage > 2) return 'col-span-2 row-span-1';  // Pequeno
    return 'col-span-1 row-span-1';                      // Muito pequeno
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
        SERVIÇOS NEGOCIADOS
      </h3>
      
      {/* Grid de Serviços */}
      <div className="grid grid-cols-6 gap-3 auto-rows-min min-h-[20rem]">
        {filteredServicesList.map((service, index) => {
          const Icon = service.icon;
          const gridSize = getGridSize(service.value, total);
          
          return (
            <div
              key={index}
              className={`${service.color} ${gridSize} rounded-xl p-4 flex flex-col justify-center items-center text-white relative overflow-hidden hover:opacity-90 transition-all cursor-pointer group min-h-[4rem]`}
              title={`${service.name}: ${service.value} serviços`}
            >
              {/* Conteúdo principal */}
              <div className="text-center flex flex-col items-center justify-center h-full">
                {/* Ícone - mostrar apenas em blocos maiores */}
                {service.value > 10 && (
                  <Icon className="text-white/90 mb-2 text-lg" />
                )}
                
                {/* Nome - sempre completo e legível */}
                <div className={`font-bold text-center leading-tight ${
                  service.value > 20 ? 'text-base' : 
                  service.value > 10 ? 'text-sm' : 
                  service.value > 5 ? 'text-sm' : 'text-xs'
                }`} style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                  {service.name}
                </div>
                
                {/* Valor */}
                <div className={`font-bold mt-1 ${
                  service.value > 20 ? 'text-2xl' : 
                  service.value > 10 ? 'text-xl' : 
                  service.value > 5 ? 'text-lg' : 'text-base'
                }`}>
                  {service.value}
                </div>
              </div>
              
              {/* Tooltip hover - simplificado */}
              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <div className="text-center text-white p-2">
                  <div className="font-bold text-sm break-words">{service.name}</div>
                  <div className="text-xs opacity-90">{service.value} serviços ({((service.value / total) * 100).toFixed(1)}%)</div>
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
