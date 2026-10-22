import React, { useState, useEffect, useMemo } from 'react';
import { useGoogleSheetsData } from '../../hooks/useGoogleSheetsData';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { useMetaPersistence } from '../dashboard/hooks/useMetaPersistence';
import { usePremiacao } from '../dashboard/hooks/usePremiacao';
import { getCurrentMetas, salvarMeta } from '../../config/metas';
import { DEFAULT_METAS, updateMetaInCode, getMetaFromCode } from '../../utils/codeUpdater';
import { mesComercialAtual } from '../../utils/periodoComercial';
import { semanasDoMesComercial, semanaAtualDoMesComercial } from '../../utils/semanasComercial';

import SidebarV2 from './components/SidebarV2';
import HeaderV2 from './components/HeaderV2';
import SemanaAtualCard from './components/SemanaAtualCard';
import KPISemana from './components/KPISemana';
import MetaMesCard from './components/MetaMesCard';
import LeaderboardCard from './components/LeaderboardCard';
import MetaIndividualCard from './components/MetaIndividualCard';
import BarraSemanas from './components/BarraSemanas';
import VendasPorSemana from './components/VendasPorSemana';
import FunilCompact from './components/FunilCompact';
import AcoesRapidasPanel from './components/AcoesRapidasPanel';
import ClientesFechados from './components/ClientesFechados';
import BadgesVendedor from './components/BadgesVendedor';
import ProximosEventos from '../dashboard/components/ProximosEventos';
import AvisosEsquecidos from '../dashboard/components/AvisosEsquecidos';
import PremiacaoTimeCard from '../../components/premiacao/PremiacaoTimeCard';
import ComissaoPJCard from '../../components/premiacao/ComissaoPJCard';
import './styles/dashboardV2.css';

/**
 * Dashboard V2 — layout Effort moderno com foco em ciclo semanal.
 */
const DashboardV2 = ({ setCurrentPage }) => {
  const { ano: anoAtual, mes: mesAtual } = mesComercialAtual();
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  const [selectedMonth, setSelectedMonth] = useState(() => monthNames[mesAtual]);
  const [selectedYear, setSelectedYear] = useState(() => anoAtual.toString());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [metaPersonalizada, setMetaPersonalizada] = useState(() =>
    getMetaFromCode('valorEntrada', DEFAULT_METAS.valorEntrada)
  );
  const [metaClientesAtendidos, setMetaClientesAtendidos] = useState(() =>
    getMetaFromCode('clientesAtendidos', DEFAULT_METAS.clientesAtendidos)
  );

  useEffect(() => {
    (async () => {
      try {
        const metas = await getCurrentMetas();
        setMetaPersonalizada(metas.valorEntrada);
        setMetaClientesAtendidos(metas.clientesAtendidos);
      } catch (err) {
        console.error('[DashboardV2] Erro ao carregar metas:', err);
      }
    })();
  }, []);

  // Persistência de metas (Supabase + fallback localStorage)
  useMetaPersistence(
    metaPersonalizada,
    metaClientesAtendidos,
    DEFAULT_METAS,
    salvarMeta,
    updateMetaInCode
  );

  const { data, allData, loading, refreshData, forceRefresh } = useGoogleSheetsData(
    selectedMonth,
    selectedYear
  );

  const {
    dashboardData,
    totalClientesAtendidos,
    availableYears,
    availableMonths,
  } = useDashboardData(
    data,
    allData,
    metaPersonalizada,
    selectedMonth,
    selectedYear
  );

  // Ajustar filtros se as opções mudarem
  useEffect(() => {
    if (availableYears?.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (availableMonths?.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Mês/ano numéricos derivados do filtro selecionado
  const mesSel = useMemo(() => {
    const idx = monthNames.indexOf(selectedMonth);
    return idx >= 0 ? idx : mesAtual;
  }, [selectedMonth, mesAtual]);
  const anoSel = useMemo(() => parseInt(selectedYear, 10) || anoAtual, [selectedYear, anoAtual]);

  const premiacao = usePremiacao({ data, ano: anoSel, mes: mesSel });

  const semanas = useMemo(
    () => semanasDoMesComercial(anoSel, mesSel),
    [anoSel, mesSel]
  );
  const semanaAtual = useMemo(
    () => semanaAtualDoMesComercial(anoSel, mesSel),
    [anoSel, mesSel]
  );

  const handleRefresh = () => {
    if (forceRefresh) forceRefresh();
    else refreshData?.();
  };

  const semDadosNoMes = Array.isArray(data) && data.length === 0 && !loading;

  return (
    <div
      className="min-h-screen flex bg-gray-50"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <SidebarV2
        currentPage="dashboard"
        setCurrentPage={setCurrentPage}
        onOpenAdmin={() => window.dispatchEvent(new CustomEvent('effort:open-admin'))}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderV2
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onRefresh={handleRefresh}
          ano={anoSel}
          mes={mesSel}
          semanaAtual={semanaAtual}
          loading={loading}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          availableMonths={availableMonths}
          availableYears={availableYears}
          setSelectedMonth={setSelectedMonth}
          setSelectedYear={setSelectedYear}
        />

        <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden v2-scroll">
          <div className="v2-card">
            <BarraSemanas semanas={semanas} semanaAtual={semanaAtual} />
          </div>

          {semDadosNoMes && (
            <div className="v2-card bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-4 flex items-center gap-3">
              <div className="text-2xl">📋</div>
              <div className="flex-1">
                <div className="font-semibold text-yellow-800">Ainda sem dados neste mês comercial</div>
                <div className="text-sm text-yellow-700">
                  Os widgets vão se preencher conforme apontamentos forem registrados.
                </div>
              </div>
            </div>
          )}

          {/* Alertas de acompanhamento — Próximos eventos + Oportunidades esquecidas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <div className="v2-card v2-card-delay-1">
              <ProximosEventos />
            </div>
            <div className="v2-card v2-card-delay-2">
              <AvisosEsquecidos />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            <div className="lg:col-span-4 v2-card v2-card-delay-1">
              <SemanaAtualCard
                semanaAtual={semanaAtual}
                ano={anoSel}
                mes={mesSel}
                dashboardData={dashboardData}
                allData={allData}
              />
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="v2-card v2-card-delay-2">
                <KPISemana allData={allData} semanaAtual={semanaAtual} metric="vendas" />
              </div>
              <div className="v2-card v2-card-delay-3">
                <KPISemana allData={allData} semanaAtual={semanaAtual} metric="clientes" />
              </div>
              <div className="v2-card v2-card-delay-4">
                <KPISemana allData={allData} semanaAtual={semanaAtual} metric="ticket" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            <div className="lg:col-span-5 v2-card v2-card-delay-2">
              <MetaMesCard
                dashboardData={dashboardData}
                metaPersonalizada={metaPersonalizada}
                onMetaChange={setMetaPersonalizada}
                ano={anoSel}
                mes={mesSel}
                allData={allData}
              />
            </div>
            <div className="lg:col-span-7 v2-card v2-card-delay-3">
              <LeaderboardCard
                dashboardData={dashboardData}
                metaPersonalizada={metaPersonalizada}
                allData={allData}
                premiacao={premiacao}
              />
            </div>
          </div>

          {/* Metas individuais (admin vê todos, vendedor vê só a sua) */}
          <div className="v2-card v2-card-delay-2">
            <MetaIndividualCard
              dashboardData={dashboardData}
              metaPersonalizada={metaPersonalizada}
              ano={anoSel}
              mes={mesSel}
              premiacao={premiacao}
            />
          </div>

          {premiacao.ativo && premiacao.resultado && (
            <div className="v2-card v2-card-delay-2">
              <PremiacaoTimeCard premiacao={premiacao} ano={anoSel} mes={mesSel} />
            </div>
          )}

          {premiacao.ativo && premiacao.resultado?.pjs.some((p) => premiacao.podeVer(p.nome)) && (
            <div className="v2-card v2-card-delay-3">
              <ComissaoPJCard premiacao={premiacao} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            <div className="lg:col-span-8 v2-card v2-card-delay-2">
              <VendasPorSemana
                allData={allData}
                ano={anoSel}
                mes={mesSel}
                semanas={semanas}
              />
            </div>
            <div className="lg:col-span-4 v2-card v2-card-delay-3">
              <FunilCompact
                dashboardData={dashboardData}
                totalClientesAtendidos={totalClientesAtendidos}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            <div className="lg:col-span-4 v2-card v2-card-delay-2">
              <AcoesRapidasPanel setCurrentPage={setCurrentPage} allData={allData} />
            </div>
            <div className="lg:col-span-4 v2-card v2-card-delay-3">
              <ClientesFechados allData={allData} ano={anoSel} mes={mesSel} />
            </div>
            <div className="lg:col-span-4 v2-card v2-card-delay-4">
              <BadgesVendedor
                dashboardData={dashboardData}
                metaPersonalizada={metaPersonalizada}
                allData={allData}
                premiacao={premiacao}
              />
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 py-4">
            Dashboard Effort V2 · Ciclo semanal · Beta
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardV2;
