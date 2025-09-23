import React, { useState } from 'react';
import { FaCrown, FaMedal, FaTrophy, FaCamera } from 'react-icons/fa';
import { formatCurrency } from '../utils/dataProcessing';

const PodiumCard = ({ 
  vendedor, 
  posicao, 
  onFotoUpload
}) => {
  // Configurações por posição
  const configuracoesPosicao = {
    1: {
      cor: 'from-yellow-400 to-amber-500',
      corTexto: 'text-yellow-600',
      icone: <FaCrown className="text-yellow-500 text-2xl" />,
      posicaoText: '1º Lugar',
      bgGradient: 'bg-gradient-to-br from-yellow-50 to-amber-50',
      borderColor: 'border-yellow-400',
      shadowColor: 'shadow-yellow-200',
      borderWidth: 'border-4', // Borda mais grossa para o primeiro lugar
      padding: 'p-6 sm:p-8', // Padding maior para o primeiro lugar
      width: 'w-full max-w-lg' // Largura ainda maior para o primeiro lugar
    },
    2: {
      cor: 'from-gray-400 to-slate-500',
      corTexto: 'text-gray-600',
      icone: <FaMedal className="text-gray-500 text-2xl" />,
      posicaoText: '2º Lugar',
      bgGradient: 'bg-gradient-to-br from-gray-50 to-slate-50',
      borderColor: 'border-gray-400',
      shadowColor: 'shadow-gray-200',
      borderWidth: 'border-2',
      padding: 'p-4 sm:p-6',
      width: 'w-full max-w-sm'
    },
    3: {
      cor: 'from-amber-600 to-orange-700',
      corTexto: 'text-amber-700',
      icone: <FaTrophy className="text-amber-600 text-2xl" />,
      posicaoText: '3º Lugar',
      bgGradient: 'bg-gradient-to-br from-amber-50 to-orange-50',
      borderColor: 'border-amber-500',
      shadowColor: 'shadow-amber-200',
      borderWidth: 'border-2',
      padding: 'p-4 sm:p-6',
      width: 'w-full max-w-sm'
    }
  };

  const config = configuracoesPosicao[posicao] || configuracoesPosicao[3];
  const comissao = (vendedor.total_vendas_mes || 0) * 0.01;

  const handleFotoChange = (event) => {
    const file = event.target.files[0];
    if (file && onFotoUpload) {
      onFotoUpload(vendedor.id, file);
    }
  };

  return (
    <div className={`
      relative ${config.padding} rounded-2xl ${config.borderWidth} ${config.borderColor} ${config.bgGradient} 
      ${config.shadowColor} shadow-lg transform transition-all duration-300 
      hover:scale-105 hover:shadow-xl ${config.width} mx-auto
    `}>
      {/* Ícone da posição */}
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-2 shadow-md z-10">
        {config.icone}
      </div>

      {/* Foto do vendedor */}
      <div className="flex flex-col items-center mb-4 mt-6">
        <div className="relative">
          <div className={`${posicao === 1 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16 sm:w-20 sm:h-20'} rounded-full overflow-hidden border-4 border-white shadow-lg`}>
            {vendedor.foto_url ? (
              <img 
                src={vendedor.foto_url} 
                alt={vendedor.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <FaCamera className={`text-gray-400 ${posicao === 1 ? 'text-xl' : 'text-lg'}`} />
              </div>
            )}
          </div>
          
          {/* Upload de foto */}
          <label className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1 cursor-pointer hover:bg-blue-600 transition-colors shadow-md">
            <FaCamera className="text-xs" />
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Nome do vendedor */}
      <div className="text-center mb-4">
        <h3 className={`font-bold ${posicao === 1 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} text-gray-800`}>
          {vendedor.nome || 'Vendedor'}
        </h3>
        <p className={`text-sm font-semibold ${config.corTexto}`}>
          {config.posicaoText}
        </p>
      </div>

      {/* Métricas */}
      <div className="space-y-3">
        {/* Total de vendas */}
        <div className="bg-white/70 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1 text-center">Total de Vendas</p>
          <p className={`font-bold ${posicao === 1 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} text-gray-800 text-center`}>
            {formatCurrency(vendedor.total_vendas_mes || 0)}
          </p>
        </div>

        {/* Comissão */}
        <div className="bg-white/70 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1 text-center">Comissão</p>
          <p className={`font-bold ${posicao === 1 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} text-green-600 text-center`}>
            {formatCurrency(comissao)}
          </p>
        </div>
      </div>

      {/* Badge da posição */}
      <div className={`
        mt-4 text-center py-2 rounded-lg 
        bg-gradient-to-r ${config.cor} text-white font-bold ${posicao === 1 ? 'text-base' : 'text-sm'} shadow-md
      `}>
        🏆 {config.posicaoText}
      </div>
    </div>
  );
};

export default PodiumCard;