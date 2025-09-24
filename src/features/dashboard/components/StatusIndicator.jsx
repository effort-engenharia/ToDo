import React from 'react';

const StatusIndicator = ({ 
  isDataChanging, 
  totalClientesAtendidos,
  selectedMonth,
  selectedYear 
}) => (
  <div className="mb-4 text-center">
    <div className={`inline-flex items-center text-sm font-medium px-3 py-2 rounded-full transition-all duration-500 ${
      isDataChanging 
        ? 'bg-green-100 text-green-800 shadow-lg scale-105' 
        : 'bg-blue-100 text-blue-800'
    }`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${
        isDataChanging ? 'bg-green-500 animate-ping' : 'bg-blue-500 animate-pulse'
      }`}></span>
      {isDataChanging ? 'Atualizando dados...' : 'Dados filtrados'} para {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} {selectedYear}
      <span className="ml-2 text-xs bg-white/50 px-2 py-1 rounded">
        Clientes: {totalClientesAtendidos || 0}
      </span>
    </div>
  </div>
);

export default StatusIndicator;