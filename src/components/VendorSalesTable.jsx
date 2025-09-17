import React from 'react';
import { FaUsers, FaTrophy } from 'react-icons/fa';
import { formatCurrency } from '../utils/dataProcessing';

const VendorSalesTable = ({ vendorData }) => {
  // Log detalhado dos dados da tabela de vendas por vendedor
  console.log('👥 VendorSalesTable - Dados recebidos:', {
    vendorData,
    hasVendorData: !!vendorData,
    vendorDataLength: vendorData?.length
  });

  // Verificar se há dados disponíveis
  if (!vendorData || vendorData.length === 0) {
    console.warn('⚠️ VendorSalesTable - Sem dados de vendas por vendedor disponíveis');
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center text-center w-full">
            <FaUsers className="mr-2 sm:mr-3 text-lg sm:text-xl" />
            Vendas por Vendedor
          </h3>
        </div>
        <div className="p-4 sm:p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <FaTrophy className="mx-auto text-4xl text-gray-400 mb-4" />
            <p className="text-gray-500">Dados de vendas por vendedor não disponíveis</p>
          </div>
        </div>
      </div>
    );
  }

  const vendors = vendorData || [];

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

  const getRankingBadge = (index) => {
    if (index === 0) return 'bg-yellow-500 text-white';
    if (index === 1) return 'bg-gray-400 text-white';
    if (index === 2) return 'bg-orange-600 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center text-center w-full">
          <FaUsers className="mr-2 sm:mr-3 text-lg sm:text-xl" />
          Vendas por Vendedor
        </h3>
      </div>

      {/* Tabela */}
      <div className="p-4 sm:p-6">
        <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center justify-center text-center">
          <FaTrophy className="mr-2 text-yellow-600 text-sm sm:text-base" />
          <span className="hidden sm:inline">TOTAL DE VENDAS POR VENDEDOR</span>
          <span className="sm:hidden">VENDAS POR VENDEDOR</span>
        </h4>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-2 text-gray-600 font-medium text-sm">#</th>
                <th className="text-left py-3 px-2 text-gray-600 font-medium text-sm">Proprietário do relacionamento</th>
                <th className="text-right py-3 px-2 text-gray-600 font-medium text-sm">Valor de Entrada</th>
                <th className="text-right py-3 px-2 text-gray-600 font-medium text-sm">Valor</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-2">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRankingBadge(index)}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <div className={`text-lg font-bold px-3 py-2 rounded-lg ${getVendorColor(item.vendedor)}`}>
                      {item.vendedor}
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-lg font-medium text-blue-600">
                      {formatCurrency(item.valorEntrada)}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(item.valor)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Estatísticas resumidas */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {vendors.length}
              </div>
              <div className="text-purple-600 text-sm font-medium">
                Vendedores Ativos
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(vendors.reduce((sum, item) => sum + item.valorEntrada, 0))}
              </div>
              <div className="text-blue-600 text-sm font-medium">Total Valor Entrada</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(vendors.reduce((sum, item) => sum + item.valor, 0))}
              </div>
              <div className="text-green-600 text-sm font-medium">Valor Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorSalesTable;