import React from 'react';
import FunnelChart from '../../../components/FunnelChart';
import RelacionamentoChart from './RelacionamentoChart';
import ClientesAtendidosChart from './ClientesAtendidosChart';

const ChartsFirstRow = ({ 
  funil, 
  totalClientesAtendidos, 
  clientesAtendidos 
}) => {
  // Ajusta o funil proporcionalmente ao total de clientes atendidos
  const adjustedFunnelData = (() => {
    // Usar dados do funil original, mas ajustar proporcionalmente ao total de clientes atendidos
    const funnelOriginal = funil || {};
    const totalFunnelOriginal = Object.values(funnelOriginal).reduce((sum, val) => sum + (val || 0), 0);
    
    if (totalFunnelOriginal === 0) {
      return funnelOriginal; // Retornar dados originais se não há dados
    }
    
    // Calcular fator de ajuste baseado no total de clientes atendidos
    const fatorAjuste = totalClientesAtendidos / totalFunnelOriginal;
    
    // Ajustar cada fase proporcionalmente, mas garantir que a soma seja exata
    const fases = Object.keys(funnelOriginal);
    const funnelAjustado = {};
    let somaAjustada = 0;
    
    // Primeiro, calcular valores ajustados (sem arredondar ainda)
    const valoresAjustados = {};
    fases.forEach((fase) => {
      valoresAjustados[fase] = (funnelOriginal[fase] || 0) * fatorAjuste;
    });
    
    // Aplicar arredondamento inteligente para garantir soma exata
    fases.forEach((fase, index) => {
      if (index === fases.length - 1) {
        // Última fase: ajustar para garantir soma exata
        funnelAjustado[fase] = totalClientesAtendidos - somaAjustada;
      } else {
        // Demais fases: arredondar normalmente
        funnelAjustado[fase] = Math.round(valoresAjustados[fase]);
        somaAjustada += funnelAjustado[fase];
      }
    });
    
    return funnelAjustado;
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