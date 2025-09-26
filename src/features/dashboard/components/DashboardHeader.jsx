import React, { useState, useEffect } from 'react';
import { FaChevronDown, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../../../contexts/AuthContext';

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
}) => {
  const { usuario, logout, temPermissao } = useAuth();
  const [permissoes, setPermissoes] = useState({
    apontamentos: false,
    arsenal: false
  });

  // Verificar permissões quando o usuário muda
  useEffect(() => {
    const verificarPermissoes = async () => {
      if (!usuario?.id) return;

      // Administradores têm acesso total
      if (usuario.nivel_acesso?.nome === 'Administrador') {
        setPermissoes({
          apontamentos: true,
          arsenal: true
        });
        return;
      }

      // Verificar permissões específicas para usuários normais
      try {
        const [apontamentosPermitido, arsenalPermitido] = await Promise.all([
          temPermissao('apontamentos'),
          temPermissao('arsenal')
        ]);

        setPermissoes({
          apontamentos: apontamentosPermitido,
          arsenal: arsenalPermitido
        });
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setPermissoes({
          apontamentos: false,
          arsenal: false
        });
      }
    };

    verificarPermissoes();
  }, [usuario, temPermissao]);

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair do sistema?')) {
      await logout();
    }
  };

  return (
    <div className="header-gradient shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Primeira linha: Título e informações do usuário */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0 mb-4">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-4 mb-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white leading-tight">
                Dashboard Comercial
              </h1>
            </div>
            
            <p className="text-sm sm:text-base text-white/80 mt-1 sm:mt-2">
              📊 Monitore seu desempenho em tempo real - {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} {selectedYear}
            </p>
            {lastUpdated && (
              <p className="text-xs text-white/70 mt-1">
                Última atualização: {lastUpdated.toLocaleString('pt-BR')} | 
                <span className={isDataChanging ? 'text-yellow-300 font-bold' : ''}>
                  {isDataChanging ? ' Atualizando...' : ` Filtros: ${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} ${selectedYear}`}
                </span>
              </p>
            )}
          </div>

          {/* Painel do usuário e controles */}
          <div className="flex flex-col items-center lg:items-end space-y-3">
            {/* Informações do usuário logado - sempre no topo direito */}
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-md px-3 py-1.5 border border-white/20">
              <FaUserCircle className="text-white/80 w-5 h-5" />
              <div className="text-left">
                <p className="text-white font-medium text-xs">
                  {usuario?.nome_completo}
                </p>
                <p className="text-white/70 text-xs">
                  {usuario?.nivel_acesso?.nome}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-white/70 hover:text-white transition-colors p-1"
                title="Sair do sistema"
              >
                <FaSignOutAlt className="w-3 h-3" />
              </button>
            </div>

            {/* Controles de filtro */}
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-white/20 backdrop-blur-sm text-white px-3 py-2 pr-7 rounded-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 font-medium text-xs sm:text-sm w-full sm:w-auto"
                >
                  {availableMonths.map((mes) => (
                    <option key={mes} value={mes} className="text-gray-800 text-xs sm:text-sm">
                      {mes.charAt(0).toUpperCase() + mes.slice(1)}
                    </option>
                  ))}
                </select>
                <FaChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 text-xs" />
              </div>
              
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none bg-white/20 backdrop-blur-sm text-white px-3 py-2 pr-7 rounded-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 font-medium text-xs sm:text-sm w-full sm:w-auto"
                >
                  {availableYears.map((ano) => (
                    <option key={ano} value={ano} className="text-gray-800 text-xs sm:text-sm">
                      {ano}
                    </option>
                  ))}
                </select>
                <FaChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 text-xs" />
              </div>

              <button 
                onClick={refreshData}
                disabled={loading}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold px-4 py-2 rounded-md transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 text-xs sm:text-sm w-full sm:w-auto"
              >
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Segunda linha: Botões APONTAMENTOS COMERCIAL e ARSENAL DE GUERRA (apenas se tiver permissão) */}
        {(permissoes.apontamentos || permissoes.arsenal) && (
          <div className="flex justify-end gap-3">
            {permissoes.apontamentos && (
              <button 
                onClick={() => setCurrentPage('apontamentos')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-md transition-all duration-300 shadow-lg hover:shadow-xl text-xs sm:text-sm transform hover:-translate-y-1"
              >
                📝 APONTAMENTOS COMERCIAL
              </button>
            )}
            {permissoes.arsenal && (
              <button 
                onClick={() => setCurrentPage('arsenal')}
                className="arsenal-guerra-btn text-white font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-md transition-all duration-300 shadow-lg hover:shadow-xl text-xs sm:text-sm transform hover:-translate-y-1"
              >
                ⚔️ ARSENAL DE GUERRA
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;