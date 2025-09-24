import React from 'react';
import ChartCard from '../../../components/ChartCard';

const ClientesAtendidosChart = ({ clientesAtendidos }) => {
  if (!clientesAtendidos) return null;
  
  // Criar array de pares [nome, valor] e ordenar por valor (maior para menor)
  const sortedEntries = Object.entries(clientesAtendidos)
    .sort(([,a], [,b]) => b - a);
  
  const chartData = {
    labels: sortedEntries.map(([nome]) => nome.charAt(0).toUpperCase() + nome.slice(1)),
    values: sortedEntries.map(([,valor]) => valor)
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
        <span className="text-xl sm:text-2xl">👥</span>
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 text-center">Quantidade de Clientes Atendidos</h3>
      </div>
      
      <div className="min-h-[200px] sm:min-h-[250px]" style={{ height: '300px' }}>
        <ChartCard
          title=""
          type="bar"
          data={chartData}
          height={300}
          delay={400}
        />
      </div>
    </div>
  );
};

export default ClientesAtendidosChart;