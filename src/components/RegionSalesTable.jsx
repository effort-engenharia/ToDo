import React from 'react';
import { FaMapMarkerAlt, FaTrophy } from 'react-icons/fa';
import { formatCurrency } from '../utils/dataProcessing';

const RegionSalesTable = ({ regionData }) => {
  // Log detalhado dos dados da tabela de vendas por região
  console.log('🗺️ RegionSalesTable - Dados recebidos:', {
    regionData,
    hasRegionData: !!regionData,
    regionDataLength: regionData?.length
  });

  // Verificar se há dados disponíveis
  if (!regionData || regionData.length === 0) {
    console.warn('⚠️ RegionSalesTable - Sem dados de vendas por região disponíveis');
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center text-center w-full">
            <FaMapMarkerAlt className="mr-2 sm:mr-3 text-lg sm:text-xl" />
            Vendas por Região
          </h3>
        </div>
        <div className="p-4 sm:p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <FaMapMarkerAlt className="mx-auto text-4xl text-gray-400 mb-4" />
            <p className="text-gray-500">Dados de vendas por região não disponíveis</p>
          </div>
        </div>
      </div>
    );
  }

  const regions = regionData || [];

  const getPositionBadge = (position) => {
    if (position === 1) return 'bg-yellow-500 text-white';
    if (position === 2) return 'bg-gray-400 text-white';
    if (position === 3) return 'bg-orange-600 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  const getVendorColor = (vendedor) => {
    if (!vendedor || typeof vendedor !== 'string') {
      return 'text-gray-600 bg-gray-50';
    }
    switch (vendedor.toUpperCase()) {
      case 'EDUARDA': return 'text-blue-600 bg-blue-50';
      case 'PAMELLI': return 'text-green-600 bg-green-50';
      case 'EDGAR': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center text-center w-full">
          <FaMapMarkerAlt className="mr-2 sm:mr-3 text-lg sm:text-xl" />
          Vendas por Região
        </h3>
      </div>

      {/* Tabela */}
      <div className="p-4 sm:p-6">
        <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center justify-center text-center">
          <FaMapMarkerAlt className="mr-2 text-blue-600 text-sm sm:text-base" />
          <span className="hidden lg:inline">QUANTIDADE DE VENDAS E VALOR TOTAL VENDIDO POR REGIÃO</span>
          <span className="lg:hidden">VENDAS POR REGIÃO</span>
        </h4>
        
        <div className="overflow-x-auto">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-2 sm:py-3 px-1 sm:px-2 text-gray-600 font-medium text-xs sm:text-sm">#</th>
                  <th className="text-left py-2 sm:py-3 px-1 sm:px-2 text-gray-600 font-medium text-xs sm:text-sm">
                    <span className="hidden sm:inline">Proprietário de relacionamento</span>
                    <span className="sm:hidden">Proprietário</span>
                  </th>
                  <th className="text-left py-2 sm:py-3 px-1 sm:px-2 text-gray-600 font-medium text-xs sm:text-sm">
                    <span className="hidden sm:inline">Quantidade de vendas</span>
                    <span className="sm:hidden">Vendas</span>
                  </th>
                  <th className="text-right py-2 sm:py-3 px-1 sm:px-2 text-gray-600 font-medium text-xs sm:text-sm">Valor</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2 sm:py-3 px-1 sm:px-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold ${getPositionBadge(item.posicao)}`}>
                        {item.posicao}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-1 sm:px-2">
                      <div>
                        <div className="font-medium text-gray-800 text-xs sm:text-sm">{item.proprietario}</div>
                        <div className={`text-xs px-1 sm:px-2 py-1 rounded-full inline-block font-medium ${getVendorColor(item.cidade)}`}>
                          {item.cidade}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-1 sm:px-2">
                      <span className="text-base sm:text-lg font-bold text-gray-800">{item.vendas}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-1 sm:px-2 text-right">
                      <span className="text-sm sm:text-lg font-bold text-green-600">
                        {formatCurrency(item.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estatísticas resumidas */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {new Set(regions.map(item => (item.cidade || item.regiao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).size}
              </div>
              <div className="text-blue-600 text-sm font-medium">
                Regiões Ativas
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {regions.reduce((sum, item) => sum + item.vendas, 0)}
              </div>
              <div className="text-green-600 text-sm font-medium">Total de Vendas</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(regions.reduce((sum, item) => sum + item.valor, 0))}
              </div>
              <div className="text-yellow-600 text-sm font-medium">Valor Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionSalesTable;