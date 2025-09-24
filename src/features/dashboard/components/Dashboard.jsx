import React, { useState, useEffect } from 'react';
import { useGoogleSheetsData } from '../../../hooks/useGoogleSheetsData';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMetaPersistence } from '../hooks/useMetaPersistence';
import { getMetaFromCode, updateMetaInCode, DEFAULT_METAS } from '../../../utils/codeUpdater';
import { getCurrentMetas, salvarMeta } from '../../../config/metas';
import MetasDebugPanel from '../../../components/MetasDebugPanel';

// Componentes do Dashboard
import DashboardHeader from './DashboardHeader';
import StatusIndicator from './StatusIndicator';
import MainMetrics from './MainMetrics';
import ChartsFirstRow from './ChartsFirstRow';
import ChartsSecondRow from './ChartsSecondRow';
import ChartsThirdRow from './ChartsThirdRow';
import SalesTables from './SalesTables';
import StatusFooter from './StatusFooter';

const Dashboard = ({ setCurrentPage }) => {
  const [selectedMonth, setSelectedMonth] = useState('setembro');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [isDataChanging, setIsDataChanging] = useState(false);
  
  // Meta editável pelo usuário com persistência no localStorage
  const [metaPersonalizada, setMetaPersonalizada] = useState(() => {
    return getMetaFromCode('valorEntrada', DEFAULT_METAS.valorEntrada);
  });
  
  // Meta editável para clientes atendidos com carregamento inicial do Supabase
  const [metaClientesAtendidos, setMetaClientesAtendidos] = useState(() => {
    return getMetaFromCode('clientesAtendidos', DEFAULT_METAS.clientesAtendidos);
  });

  // Carregar metas do Supabase na inicialização
  useEffect(() => {
    const loadInitialMetas = async () => {
      try {
        const metas = await getCurrentMetas();
        setMetaPersonalizada(metas.valorEntrada);
        setMetaClientesAtendidos(metas.clientesAtendidos);
      } catch (error) {
        console.error('Erro ao carregar metas iniciais do Supabase:', error);
      }
    };
    
    loadInitialMetas();
  }, []);

  // Persistência de metas usando o hook customizado
  useMetaPersistence(
    metaPersonalizada, 
    metaClientesAtendidos,
    DEFAULT_METAS, 
    salvarMeta,
    updateMetaInCode
  );
  
  // Carregar dados do Google Sheets
  const { data, allData, loading, error, lastUpdated, refreshData, forceRefresh } = useGoogleSheetsData(selectedMonth, selectedYear);
  
  // Listener para eventos de atualização de dados
  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('🔄 Evento de atualização de dados recebido, forçando refresh...');
      if (forceRefresh) {
        forceRefresh();
      } else {
        refreshData();
      }
    };

    // Adicionar listener para evento customizado
    window.addEventListener('apontamento-created', handleDataUpdate);
    window.addEventListener('apontamento-updated', handleDataUpdate);
    
    // Auto-refresh a cada 30 segundos para garantir dados atualizados
    const autoRefreshInterval = setInterval(() => {
      console.log('⏰ Auto-refresh executado');
      if (forceRefresh) {
        forceRefresh();
      }
    }, 30000);
    
    return () => {
      window.removeEventListener('apontamento-created', handleDataUpdate);
      window.removeEventListener('apontamento-updated', handleDataUpdate);
      clearInterval(autoRefreshInterval);
    };
  }, [forceRefresh, refreshData]);
  
  // Processar dados do dashboard usando hook customizado
  const {
    dashboardData,
    totalClientesAtendidos,
    taxaDeSucesso,
    availableYears,
    availableMonths
  } = useDashboardData(data, allData, metaPersonalizada, selectedMonth, selectedYear);
  
  // Efeito para mostrar indicador visual quando dados mudarem
  useEffect(() => {
    setIsDataChanging(true);
    const timer = setTimeout(() => setIsDataChanging(false), 1000);
    return () => clearTimeout(timer);
  }, [selectedMonth, selectedYear]);
  
  // Validar e ajustar seleções quando dados mudarem
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      console.log('🔄 Ajustando ano selecionado para o mais recente disponível:', availableYears[0]);
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      console.log('🔄 Ajustando mês selecionado para o primeiro disponível:', availableMonths[0]);
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <DashboardHeader 
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        availableMonths={availableMonths}
        availableYears={availableYears}
        lastUpdated={lastUpdated}
        isDataChanging={isDataChanging}
        loading={loading}
        refreshData={refreshData}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        setCurrentPage={setCurrentPage}
      />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Status Indicator */}
        <StatusIndicator 
          isDataChanging={isDataChanging}
          totalClientesAtendidos={totalClientesAtendidos}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
        
        {/* Main Metrics */}
        <MainMetrics 
          totalClientesAtendidos={totalClientesAtendidos}
          funil={dashboardData?.funil}
          receitas={dashboardData?.receitas}
          metaEntrada={dashboardData?.metaEntrada}
          metaPersonalizada={metaPersonalizada}
          setMetaPersonalizada={setMetaPersonalizada}
          taxaDeSucesso={taxaDeSucesso}
        />

        {/* Charts First Row */}
        <ChartsFirstRow 
          funil={dashboardData?.funil}
          totalClientesAtendidos={totalClientesAtendidos}
          clientesAtendidos={dashboardData?.clientesAtendidos}
        />

        {/* Charts Second Row */}
        <ChartsSecondRow 
          totalClientesAtendidos={totalClientesAtendidos}
          metaClientesAtendidos={metaClientesAtendidos}
          setMetaClientesAtendidos={setMetaClientesAtendidos}
          metaEntrada={dashboardData?.metaEntrada}
          metaPersonalizada={metaPersonalizada}
          ganhosPerdas={dashboardData?.ganhosPerdas}
        />

        {/* Charts Third Row - Serviços e Origem */}
        <ChartsThirdRow 
          servicosObject={dashboardData?.servicosObject}
          origemClientes={dashboardData?.origemClientes}
          servicosFechadosPorOrigem={dashboardData?.servicosFechadosPorOrigem}
        />

        {/* Sales Tables */}
        <SalesTables 
          regioes={dashboardData?.regioes}
          vendedores={dashboardData?.vendedores}
        />

        {/* Status e última atualização */}
        <StatusFooter 
          error={error}
          lastUpdated={lastUpdated}
        />
      </div>

      {/* Painel de Debug/Configurações (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && <MetasDebugPanel />}
    </div>
  );
};

export default Dashboard;