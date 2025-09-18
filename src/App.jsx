import React, { useState, useMemo, useEffect } from 'react';
import { 
  FaChevronDown,
  FaCalendarAlt,
  FaChartLine,
  FaTrophy,
  FaUsers,
  FaMapMarkedAlt,
  FaBullseye,
  FaRocket,
  FaFire,
  FaStar
} from 'react-icons/fa';
import { useGoogleSheetsData } from './hooks/useGoogleSheetsData';
import { processSheetData, formatCurrency } from './utils/dataProcessing';
import ChartCard from './components/ChartCard';
import MetricCard from './components/MetricCard';
import FunnelChart from './components/FunnelChart';
import ServicesChart from './components/ServicesChart';
import OriginChart from './components/OriginChart';
import RegionSalesTable from './components/RegionSalesTable';
import VendorSalesTable from './components/VendorSalesTable';
import MultiTitleGauge from './components/MultiTitleGauge';
import EditableMetricCard from './components/EditableMetricCard';
import EditableGauge from './components/EditableGauge';
import { getMetaFromCode, updateMetaInCode, DEFAULT_METAS } from './utils/codeUpdater';
import MetasDebugPanel from './components/MetasDebugPanel';
import ApontamentosComercial from './components/ApontamentosComercial';

function App() {
  const [selectedMonth, setSelectedMonth] = useState('setembro');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [isDataChanging, setIsDataChanging] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' ou 'apontamentos'
  
  // Meta editável pelo usuário com persistência no localStorage
  const [metaPersonalizada, setMetaPersonalizada] = useState(() => {
    return getMetaFromCode('valorEntrada', DEFAULT_METAS.valorEntrada);
  });
  
  // Meta editável para clientes atendidos com persistência no localStorage  
  const [metaClientesAtendidos, setMetaClientesAtendidos] = useState(() => {
    return getMetaFromCode('clientesAtendidos', DEFAULT_METAS.clientesAtendidos);
  });

  // Salvar meta personalizada no localStorage sempre que mudar
  useEffect(() => {
    updateMetaInCode('valorEntrada', metaPersonalizada);
  }, [metaPersonalizada]);

  // Salvar meta de clientes atendidos no localStorage sempre que mudar
  useEffect(() => {
    updateMetaInCode('clientesAtendidos', metaClientesAtendidos);
  }, [metaClientesAtendidos]);
  
  const { data, allData, loading, error, lastUpdated, refreshData } = useGoogleSheetsData(selectedMonth, selectedYear);
  
  // Efeito para mostrar indicador visual quando dados mudarem
  useEffect(() => {
    setIsDataChanging(true);
    const timer = setTimeout(() => setIsDataChanging(false), 1000);
    return () => clearTimeout(timer);
  }, [selectedMonth, selectedYear]);
  
  // Processar dados da planilha
  const processedData = processSheetData(data, metaPersonalizada);
  
  // Processar dados completos
  const allProcessedData = processSheetData(allData, metaPersonalizada);
  
  console.log('🎯 App.jsx - Dados processados:', {
    dataFromHook: data?.length,
    allDataFromHook: allData?.length,
    processedData: processedData,
    allProcessedData: allProcessedData,
    distributionData: allProcessedData?.distributionData,
    receitas: processedData?.receitas,
    vendedores: processedData?.vendedores?.length
  });

  const {
    receitas,
    despesas,
    saldos,
    vendedores,
    regioes,
    servicos,
    servicosObject,
    funil,
    relacionamento,
    clientesAtendidos,
    ganhosPerdas,
    metaEntrada,
    origemClientes
  } = processedData;

  // Usar apenas dados reais da API - com fallback para dados completos
  const dashboardData = useMemo(() => {
    console.log('📈 Dashboard data sendo recalculado para:', selectedMonth, selectedYear);
    console.log('📊 Dados processados filtrados:', {
      processedDataLength: data?.length,
      allDataLength: allData?.length,
      hasProcessedRegioes: !!processedData?.regioes?.length,
      hasProcessedVendedores: !!processedData?.vendedores?.length,
      processedOrigemClientes: processedData?.origemClientes
    });
    
    // MELHORIA: Priorizar sempre dados filtrados se existirem, mesmo que poucos
    // Só usar fallback se realmente não há dados para o período
    const hasValidFilteredData = processedData && data && data.length > 0;
    
    if (!hasValidFilteredData && allProcessedData && allData && allData.length > 0) {
      console.log('🔄 Dados filtrados insuficientes, usando dados completos como fallback');
      console.log('📊 Motivo do fallback:', {
        temProcessedData: !!processedData,
        temData: !!data,
        lengthData: data?.length,
        temAllProcessedData: !!allProcessedData,
        temAllData: !!allData,
        lengthAllData: allData?.length
      });
      return allProcessedData;
    }
    
    console.log('✅ Usando dados filtrados para o período:', selectedMonth, selectedYear);
    console.log('📊 Dados que serão usados:', {
      regioes: processedData?.regioes?.length,
      regioesDetalhes: processedData?.regioes?.map(r => ({ proprietario: r.proprietario, cidade: r.cidade, vendas: r.vendas })),
      vendedores: processedData?.vendedores?.length,
      vendedoresDetalhes: processedData?.vendedores?.map(v => ({ vendedor: v.vendedor, valor: v.valor })),
      receitas: processedData?.receitas,
      origemClientes: processedData?.origemClientes
    });
    return processedData;
  }, [processedData, allProcessedData, selectedMonth, selectedYear, data, allData]);

  // Calcular total de clientes atendidos no mês
  const totalClientesAtendidos = useMemo(() => {
    if (!dashboardData?.clientesAtendidos) return 0;
    // Se for um número, usar diretamente; se for objeto, somar valores
    if (typeof dashboardData.clientesAtendidos === 'number') {
      return dashboardData.clientesAtendidos;
    }
    return Object.values(dashboardData.clientesAtendidos).reduce((sum, value) => sum + (value || 0), 0);
  }, [dashboardData?.clientesAtendidos]);

  // Calcular taxa de sucesso dinâmica
  const taxaDeSucesso = useMemo(() => {
    const totalClientes = totalClientesAtendidos;
    const totalContratos = dashboardData?.funil?.contratoVenda || 0;
    
    console.log('🎯 Taxa de Sucesso - Cálculo:', {
      totalClientes,
      totalContratos,
      dashboardDataFunil: dashboardData?.funil,
      selectedMonth,
      selectedYear
    });
    
    if (totalClientes === 0) return '0.0%';
    
    const taxa = (totalContratos / totalClientes) * 100;
    console.log('🎯 Taxa de Sucesso calculada:', `${taxa.toFixed(1)}%`);
    return `${taxa.toFixed(1)}%`;
  }, [totalClientesAtendidos, dashboardData?.funil?.contratoVenda, selectedMonth, selectedYear]);

  // Extrair anos e meses disponíveis dos dados reais
  const { availableYears, availableMonths } = useMemo(() => {
    if (!allData || !Array.isArray(allData)) {
      return {
        availableYears: ['2025'], // fallback
        availableMonths: ['setembro'] // fallback
      };
    }

    const yearsSet = new Set();
    const monthsSet = new Set();
    
    // Mapeamento de números de mês para nomes
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    allData.forEach(item => {
      if (item['Data de contato']) {
        try {
          const date = new Date(item['Data de contato']);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-based
            
            yearsSet.add(year.toString());
            monthsSet.add(monthNames[month]);
          }
        } catch (error) {
          // Ignorar datas inválidas
        }
      }
    });

    // Converter para arrays e ordenar
    const years = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a)); // Mais recente primeiro
    const months = Array.from(monthsSet).sort((a, b) => {
      return monthNames.indexOf(a) - monthNames.indexOf(b);
    });

    // Se não encontrou dados, usar fallbacks
    const finalYears = years.length > 0 ? years : ['2025'];
    const finalMonths = months.length > 0 ? months : ['setembro'];

    console.log('📅 Anos e meses disponíveis:', {
      years: finalYears,
      months: finalMonths,
      totalItems: allData.length
    });

    return {
      availableYears: finalYears,
      availableMonths: finalMonths
    };
  }, [allData]);

  // Validar e ajustar seleções quando dados mudarem (após declaração das variáveis)
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

  // Renderizar página de apontamentos se selecionada (APÓS todos os hooks)
  if (currentPage === 'apontamentos') {
    return <ApontamentosComercial onVoltar={() => setCurrentPage('dashboard')} />;
  }

  // Header moderno com gradiente
  const ModernHeader = () => (
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
        
        {/* Segunda linha: Botão APONTAMENTOS COMERCIAL alinhado à direita */}
        <div className="flex justify-end">
          <button 
            onClick={() => setCurrentPage('apontamentos')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base transform hover:-translate-y-1"
          >
            📝 APONTAMENTOS COMERCIAL
          </button>
        </div>
      </div>
    </div>
  );  // Card de métrica com design moderno
  const MetricCard = ({ title, value, subtitle, icon: Icon, color, gradient }) => (
    <div className={`${gradient} p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <Icon className="text-xl sm:text-2xl lg:text-3xl text-white/90" />
        <div className="text-right">
          <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-white leading-tight">{value}</div>
          <div className="text-white/80 text-xs sm:text-sm font-medium">{title}</div>
        </div>
      </div>
      {subtitle && (
        <div className="text-white/70 text-xs sm:text-sm">{subtitle}</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <ModernHeader />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Cards de métricas principais */}
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <MetricCard
            title="Clientes Atendidos"
            value={totalClientesAtendidos || 0}
            subtitle="Total contactados"
            icon={FaUsers}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <MetricCard
            title="Contratos/Vendas"
            value={dashboardData?.funil?.contratoVenda || 0}
            subtitle={formatCurrency(dashboardData?.receitas?.recebido || 0)}
            icon={FaTrophy}
            gradient="bg-gradient-to-br from-green-500 to-green-600"
          />
          {console.log('🔍 DEBUG - Valor Contratos/Vendas:', dashboardData?.funil?.contratoVenda, 'funil completo:', dashboardData?.funil)}
          <EditableMetricCard
            title="Meta de Entrada"
            value={dashboardData?.metaEntrada?.valor || 0}
            metaValue={metaPersonalizada}
            onMetaChange={setMetaPersonalizada}
            icon={FaBullseye}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <MetricCard
            title="Taxa de Sucesso"
            value={taxaDeSucesso}
            subtitle="Conversão geral"
            icon={FaStar}
            gradient="bg-gradient-to-br from-yellow-500 to-orange-500"
          />
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Funil de Negociações */}
          <FunnelChart data={dashboardData?.funil || {}} />

          {/* Relacionamento */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
            <ChartCard
              title="Quem está se relacionando mais?"
              type="doughnut"
              emoji="🔥"
              data={{
                labels: Object.keys(dashboardData?.relacionamento || {}).map(vendedor => vendedor.charAt(0).toUpperCase() + vendedor.slice(1)),
                values: Object.values(dashboardData?.relacionamento || {}),
                label: "Relacionamento"
              }}
              delay={400}
            />
          </div>

          {/* Clientes Atendidos por Vendedor */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
              <span className="text-xl sm:text-2xl">👥</span>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 text-center">Quantidade de Clientes Atendidos</h3>
            </div>
            
            <div className="min-h-[200px] sm:min-h-[250px]" style={{ height: '300px' }}>
              <ChartCard
                title=""
                type="bar"
                data={{
                  labels: Object.keys(dashboardData?.clientesAtendidos || {}).map(nome => nome.charAt(0).toUpperCase() + nome.slice(1)),
                  values: Object.values(dashboardData?.clientesAtendidos || {})
                }}
                height={300}
                delay={400}
              />
            </div>
          </div>
        </div>

        {/* Segunda linha de gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Editable Gauge - Total de Clientes Atendidos */}
          <EditableGauge
            title="Total de Clientes Atendidos"
            value={totalClientesAtendidos}
            maxValue={metaClientesAtendidos}
            onMaxValueChange={setMetaClientesAtendidos}
            emoji="👥"
            color="#10B981"
            labelSuffix=""
          />

          {/* Ganhos vs Perdas */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">Ganhos X Perdas</h3>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">CONTRATO/VENDA</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-600">{dashboardData?.ganhosPerdas?.contratoVenda?.quantidade || 0}</div>
                <div className="text-sm sm:text-lg font-medium text-gray-700 mt-2">
                  {formatCurrency(dashboardData?.ganhosPerdas?.contratoVenda?.valor || 0)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">CANCELADO/PERCA</div>
                <div className="text-2xl sm:text-3xl font-bold text-red-600">{dashboardData?.ganhosPerdas?.canceladoPerca?.quantidade || 0}</div>
                <div className="text-sm sm:text-lg font-medium text-gray-700 mt-2">
                  {formatCurrency(dashboardData?.ganhosPerdas?.canceladoPerca?.valor || 0)}
                </div>
              </div>
            </div>

            {/* Tabela de Serviços Perdidos - usando dados reais se disponíveis */}
            {dashboardData?.ganhosPerdas?.canceladoPerca?.quantidade > 0 && (
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
                        {dashboardData.ganhosPerdas.canceladoPerca.quantidade} serviços cancelados
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-bold text-red-600">
                        {formatCurrency(dashboardData.ganhosPerdas.canceladoPerca.valor)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabela Detalhada dos Serviços Perdidos */}
                {dashboardData.ganhosPerdas.canceladoPerca.detalhes && 
                 dashboardData.ganhosPerdas.canceladoPerca.detalhes.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h5 className="text-sm font-medium text-gray-900">Detalhes dos Serviços Perdidos</h5>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                      {dashboardData.ganhosPerdas.canceladoPerca.detalhes.map((item, index) => (
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

          {/* Multi Title Gauge - Valor de Entrada */}
          <MultiTitleGauge
            title="Meta Valor de Entrada"
            value={(dashboardData?.metaEntrada?.valor || 0) / 1000} // Converter valor para milhares
            maxValue={metaPersonalizada / 1000} // Converter meta para milhares
            unit="k"
            emoji="💰"
            color="#10B981"
            labelSuffix="k"
          />
        </div>

        {/* Terceira linha - Serviços e Origem */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Serviços Negociados */}
          <ServicesChart data={servicosObject} />

          {/* Origem dos Clientes */}
          <OriginChart data={dashboardData?.origemClientes || {}} />
        </div>

        {/* Quarta linha - Cliente fechando mais */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Qual cliente está fechando mais serviço */}
          <OriginChart 
            data={dashboardData?.servicosFechadosPorOrigem || {}}
            title="QUAL CLIENTE ESTÁ FECHANDO MAIS SERVIÇO?"
          />
        </div>

        {/* Quinta linha - Tabelas de vendas divididas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <RegionSalesTable 
            regionData={dashboardData?.regioes}
          />
          <VendorSalesTable 
            vendorData={dashboardData?.vendedores}
          />
        </div>

        {/* Status e última atualização */}
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
      </div>

      {/* Painel de Debug/Configurações (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && <MetasDebugPanel />}
    </div>
  );
}

export default App;
