import React from 'react';

const StatusFooter = ({ error, lastUpdated }) => (
  <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-600 space-y-2 sm:space-y-0">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${error ? 'bg-red-400' : 'bg-green-400'}`}></div>
        {error ? 'Erro na conexão' : 'Sistema online'}
      </div>
      <div>
        Última atualização: {lastUpdated ? lastUpdated.toLocaleString('pt-BR') : 'Agora'}
      </div>
    </div>
  </div>
);

export default StatusFooter;