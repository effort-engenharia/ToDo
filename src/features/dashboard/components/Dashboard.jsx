import React, { useState, useEffect } from 'react';
import { useGoogleSheetsData } from '../../../hooks/useGoogleSheetsData';
import { useDashboardData } from '../hooks/useDashboardData';
import { useMetaPersistence } from '../hooks/useMetaPersistence';
import { usePremiacao } from '../hooks/usePremiacao';
import { getMetaFromCode, updateMetaInCode, DEFAULT_METAS } from '../../../utils/codeUpdater';
import { getCurrentMetas, salvarMeta } from '../../../config/metas';
import { mesComercialAtual } from '../../../utils/periodoComercial';
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
import AvisosEsquecidos from './AvisosEsquecidos';
import ProximosEventos from './ProximosEventos';

const MESES_FILTRO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const Dashboard = ({ setCurrentPage }) => {
  // Retorna o nome do MÊS COMERCIAL vigente (regra de fechamento no dia 22 a
  // partir de 23/07/2026). Antes dessa data cai no mês calendário normal.
  const getCurrentMonth = () => {
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const { mes } = mesComercialAtual();
    return meses[mes];
  };

  // Ano correspondente ao mês comercial vigente (importante na virada dez→jan)
  const getCurrentYear = () => {
    const { ano } = mesComercialAtual();
    return ano.toString();
  };

  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
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
      if (forceRefresh) {
        forceRefresh();
      } else {
        refreshData();
      }
    };

    // Adicionar listener para evento customizado
    window.addEventListener('apontamento-created', handleDataUpdate);
    window.addEventListener('apontamento-updated', handleDataUpdate);
    
    return () => {
      window.removeEventListener('apontamento-created', handleDataUpdate);
      window.removeEventListener('apontamento-updated', handleDataUpdate);
    };
  }, [forceRefresh, refreshData]);
  
  // Processar dados do dashboard usando hook customizado
  const {
    dashboardData,
    totalClientesAtendidos,
    taxaDeSucesso,
    availableYears,
    availableMonths,
    vendasPorMes,
    clientesPorVendedor
  } = useDashboardData(data, allData, metaPersonalizada, selectedMonth, selectedYear);

  const premiacao = usePremiacao({
    data,
    ano: parseInt(selectedYear, 10),
    mes: MESES_FILTRO.indexOf(selectedMonth),
  });
  
  // Efeito para mostrar indicador visual quando dados mudarem
  useEffect(() => {
    setIsDataChanging(true);
    const timer = setTimeout(() => setIsDataChanging(false), 1000);
    return () => clearTimeout(timer);
  }, [selectedMonth, selectedYear]);
  
  // Validar e ajustar seleções quando dados mudarem
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
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
        {/* Próximos Eventos (retomadas agendadas) */}
        <ProximosEventos />

        {/* Avisos de Oportunidades Esquecidas */}
        <AvisosEsquecidos />

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
          vendasPorMes={vendasPorMes}
          clientesPorVendedor={clientesPorVendedor}
          premiacao={premiacao}
          anoPremiacao={parseInt(selectedYear, 10)}
          mesPremiacao={MESES_FILTRO.indexOf(selectedMonth)}
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