import React, { useMemo } from 'react';
import ChartCard from '../../../components/ChartCard';
import { formatCurrency } from '../../../utils/dataProcessing';

const GanhosPerdas = ({ ganhosPerdas }) => {
  if (!ganhosPerdas) return null;
  
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">Ganhos X Perdas</h3>
      
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="text-center">
          <div className="text-xs sm:text-sm text-gray-600 mb-2">CONTRATO/VENDA</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{ganhosPerdas?.contratoVenda?.quantidade || 0}</div>
          <div className="text-sm sm:text-lg font-medium text-gray-700 mt-2">
            {formatCurrency(ganhosPerdas?.contratoVenda?.valor || 0)}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs sm:text-sm text-gray-600 mb-2">CANCELADO/PERCA</div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{ganhosPerdas?.canceladoPerca?.quantidade || 0}</div>
          <div className="text-sm sm:text-lg font-medium text-gray-700 mt-2">
            {formatCurrency(ganhosPerdas?.canceladoPerca?.valor || 0)}
          </div>
        </div>
      </div>

      {/* Tabela de Serviços Perdidos - usando dados reais se disponíveis */}
      {ganhosPerdas?.canceladoPerca?.quantidade > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm sm:text-base font-semibold text-gray-800 mb-4 text-center">Serviços Perdidos</h4>
          
          {/* Resumo Total */}
          <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  Total de Serviços Perdidos
                </span>
                <p className="text-xs text-gray-500">
                  {ganhosPerdas.canceladoPerca.quantidade} serviços cancelados
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm sm:text-base font-bold text-red-600">
                  {formatCurrency(ganhosPerdas.canceladoPerca.valor)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabela Detalhada dos Serviços Perdidos */}
          {ganhosPerdas.canceladoPerca.detalhes && 
            ganhosPerdas.canceladoPerca.detalhes.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h5 className="text-sm font-medium text-gray-900">Detalhes dos Serviços Perdidos</h5>
              </div>
              <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {ganhosPerdas.canceladoPerca.detalhes.map((item, index) => (
                  <div key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.cliente}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.servico}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-sm font-semibold text-red-600">
                          {formatCurrency(item.valor)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GanhosPerdas;