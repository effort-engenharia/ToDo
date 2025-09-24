import React from 'react';
import FunnelChart from '../../../components/FunnelChart';
import RelacionamentoChart from './RelacionamentoChart';
import ClientesAtendidosChart from './ClientesAtendidosChart';

const ChartsFirstRow = ({ 
  funil, 
  totalClientesAtendidos, 
  clientesAtendidos 
}) => {
  // Log detalhado dos dados recebidos
  console.log('📊 ChartsFirstRow - Props recebidas:', {
    funil: funil,
    totalClientesAtendidos: totalClientesAtendidos,
    clientesAtendidos: clientesAtendidos,
    timestamp: new Date().toLocaleTimeString()
  });
  // Ajustar apenas a fase de negociação proporcionalmente ao total de clientes atendidos
  const adjustedFunnelData = (() => {
    console.log('🔧 ChartsFirstRow - Processando funil:', { funil, totalClientesAtendidos });
    
    // Usar dados do funil original
    const funnelOriginal = funil || {};
    const originalData = { ...funnelOriginal };
    
    console.log('🔧 ChartsFirstRow - Funil original:', funnelOriginal);
    
    if (totalClientesAtendidos > 0 && funnelOriginal.negociacao) {
      // Calcular ajuste apenas para negociação baseado no total de clientes atendidos
      const totalFunnelOriginal = Object.values(funnelOriginal).reduce((sum, val) => sum + (val || 0), 0);
      
      if (totalFunnelOriginal > 0) {
        // Aplicar ajuste apenas na negociação
        const fatorAjuste = totalClientesAtendidos / totalFunnelOriginal;
        originalData.negociacao = Math.round(funnelOriginal.negociacao * fatorAjuste);
        
        console.log('🔧 ChartsFirstRow - Ajuste aplicado apenas na negociação:', {
          negociacaoOriginal: funnelOriginal.negociacao,
          negociacaoAjustada: originalData.negociacao,
          fatorAjuste: fatorAjuste
        });
      }
    }
    
    console.log('✅ ChartsFirstRow - Funil final:', originalData);
    return originalData;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {/* Funil de Negociações */}
      <FunnelChart data={adjustedFunnelData} />

      {/* Relacionamento */}
      <RelacionamentoChart clientesAtendidos={clientesAtendidos} />

      {/* Clientes Atendidos por Vendedor */}
      <ClientesAtendidosChart clientesAtendidos={clientesAtendidos} />
    </div>
  );
};

export default ChartsFirstRow;