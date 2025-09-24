import React from 'react';
import { FaChevronDown } from 'react-icons/fa';

const DashboardHeader = ({ 
  selectedMonth, 
  selectedYear, 
  availableMonths, 
  availableYears,
  lastUpdated,
  isDataChanging,
  loading,
  refreshData,
  setSelectedMonth,
  setSelectedYear,
  setCurrentPage
}) => (
  <div className="header-gradient shadow-xl">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Primeira linha: Título e controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-4">
        <div className="text-center lg:text-left">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight">
            Dashboard Comercial
          </h1>
          <p className="text-base sm:text-lg text-white/80 mt-1 sm:mt-2">
            📊 Monitore seu desempenho em tempo real - {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} {selectedYear}
          </p>
          {lastUpdated && (
            <p className="text-xs sm:text-sm text-white/70 mt-1">
              Última atualização: {lastUpdated.toLocaleString('pt-BR')} | 
              <span className={isDataChanging ? 'text-yellow-300 font-bold' : ''}>
                {isDataChanging ? ' Atualizando...' : ` Filtros: ${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} ${selectedYear}`}
              </span>
            </p>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white/20 backdrop-blur-sm text-white px-3 sm:px-4 py-2 sm:py-3 pr-8 sm:pr-10 rounded-lg sm:rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 font-medium text-sm sm:text-base w-full sm:w-auto"
            >
              {availableMonths.map((mes) => (
                <option key={mes} value={mes} className="text-gray-800 text-sm sm:text-base">
                  {mes.charAt(0).toUpperCase() + mes.slice(1)}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-white/70 text-sm" />
          </div>
          
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-white/20 backdrop-blur-sm text-white px-3 sm:px-4 py-2 sm:py-3 pr-8 sm:pr-10 rounded-lg sm:rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 font-medium text-sm sm:text-base w-full sm:w-auto"
            >
              {availableYears.map((ano) => (
                <option key={ano} value={ano} className="text-gray-800 text-sm sm:text-base">
                  {ano}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-white/70 text-sm" />
          </div>

          <button 
            onClick={refreshData}
            disabled={loading}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>
      
      {/* Segunda linha: Botões APONTAMENTOS COMERCIAL e ARSENAL DE GUERRA */}
      <div className="flex justify-end gap-4">
        <button 
          onClick={() => setCurrentPage('apontamentos')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base transform hover:-translate-y-1"
        >
          📝 APONTAMENTOS COMERCIAL
        </button>
        <button 
          onClick={() => setCurrentPage('arsenal')}
          className="arsenal-guerra-btn text-white font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base transform hover:-translate-y-1"
        >
          ⚔️ ARSENAL DE GUERRA
        </button>
      </div>
    </div>
  </div>
);

export default DashboardHeader;