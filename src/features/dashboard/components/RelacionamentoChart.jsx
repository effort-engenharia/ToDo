import React, { useMemo } from 'react';
import ChartCard from '../../../components/ChartCard';

const RelacionamentoChart = ({ clientesAtendidos }) => {
  const chartData = useMemo(() => {
    if (!clientesAtendidos) return { labels: [], values: [] };
    
    // Criar array de pares [nome, valor] e ordenar por valor (maior para menor)
    const sortedEntries = Object.entries(clientesAtendidos)
      .sort(([,a], [,b]) => b - a);
    
    return {
      labels: sortedEntries.map(([nome]) => nome.charAt(0).toUpperCase() + nome.slice(1)),
      values: sortedEntries.map(([,valor]) => valor),
      label: "Relacionamento"
    };
  }, [clientesAtendidos]);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <ChartCard
        title="Quem está se relacionando mais?"
        type="doughnut"
        emoji="🔥"
        data={chartData}
        delay={400}
      />
    </div>
  );
};

export default RelacionamentoChart;