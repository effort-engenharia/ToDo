import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaPlus, 
  FaSearch, 
  FaCalendarAlt,
  FaEdit,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaFlag,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaBuilding,
  FaEye,
  FaProjectDiagram,
  FaCalendarPlus,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaTimes,
  FaChevronDown,
  FaChevronUp,
  FaFilter,
  FaListAlt,
  FaUsers,
  FaCalendarWeek
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

// =====================================================
// FUNÇÃO AUXILIAR PARA CORRIGIR TIMEZONE
// =====================================================
// Quando uma data string "2026-01-26" é convertida para Date, 
// JS interpreta como UTC. No Brasil (UTC-3), isso mostra o dia anterior.
// Esta função corrige adicionando o offset do timezone.
const parseDataLocal = (dataString) => {
  if (!dataString) return null;
  // Se já é um objeto Date, retorna
  if (dataString instanceof Date) return dataString;
  // Adiciona T12:00:00 para evitar problemas de timezone
  const data = new Date(dataString + 'T12:00:00');
  return data;
};

const formatarDataBR = (dataString) => {
  if (!dataString) return '';
  const data = parseDataLocal(dataString);
  return data.toLocaleDateString('pt-BR');
};

const formatarDataCurta = (dataString) => {
  if (!dataString) return '';
  const data = parseDataLocal(dataString);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// =====================================================
// COMPONENTE DE GRÁFICO GANTT
// =====================================================
const GanttChart = ({ obra, onEditEtapa, onDeleteEtapa, onAddAtividade }) => {
  const [expanded, setExpanded] = useState(true);
  
  if (!obra.etapas || obra.etapas.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.
      </div>
    );
  }

  // Calcular range de datas
  const allDates = obra.etapas.flatMap(e => [parseDataLocal(e.data_inicio), parseDataLocal(e.data_fim)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  
  // Adicionar margem
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  
  // Gerar meses para o header
  const meses = [];
  let currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    const mesAno = currentDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (!meses.find(m => m.label === mesAno)) {
      meses.push({ 
        label: mesAno, 
        start: new Date(currentDate)
      });
    }
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const getBarPosition = (dataInicio, dataFim) => {
    const inicio = parseDataLocal(dataInicio);
    const fim = parseDataLocal(dataFim);
    const left = ((inicio - minDate) / (1000 * 60 * 60 * 24)) / totalDays * 100;
    const width = ((fim - inicio) / (1000 * 60 * 60 * 24) + 1) / totalDays * 100;
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
  };

  const getStatusColor = (status, progresso) => {
    if (progresso >= 100) return 'bg-emerald-500';
    if (status === 'atrasada') return 'bg-red-500';
    if (status === 'em_andamento') return 'bg-sky-500';
    return 'bg-indigo-400';
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" size={10} />;
      case 'civil': return <FaHardHat className="text-orange-400" size={10} />;
      case 'galpao': return <FaWarehouse className="text-purple-400" size={10} />;
      default: return <FaTasks className="text-blue-400" size={10} />;
    }
  };

  return (
    <div className="execucao-card mt-4">
      <div 
        className="flex items-center justify-between cursor-pointer p-3 hover:bg-slate-700/50 rounded-lg bg-slate-800/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <FaChevronDown size={12} className="text-slate-300" /> : <FaChevronUp size={12} className="text-slate-300" />}
          <FaProjectDiagram className="text-sky-400" />
          <span className="font-medium text-white">Cronograma de Etapas</span>
          <span className="text-xs text-slate-300">({obra.etapas.length} etapas)</span>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          {/* Header com meses */}
          <div className="flex border-b border-slate-600 min-w-[800px]">
            <div className="w-64 flex-shrink-0 p-2 bg-slate-700/70 font-medium text-sm text-white">
              Etapa
            </div>
            <div className="flex-1 flex">
              {meses.map((mes, i) => (
                <div 
                  key={i} 
                  className="flex-1 p-2 text-center text-xs text-slate-200 border-l border-slate-600 bg-slate-700/50"
                >
                  {mes.label}
                </div>
              ))}
            </div>
          </div>

          {/* Etapas */}
          {obra.etapas.map((etapa) => {
            const pos = getBarPosition(etapa.data_inicio, etapa.data_fim);
            const hoje = new Date();
            const fimEtapa = new Date(etapa.data_fim);
            const atrasada = fimEtapa < hoje && etapa.progresso < 100;

            return (
              <div 
                key={etapa.id} 
                className="flex border-b border-slate-700/50 hover:bg-slate-800/30 min-w-[800px] group"
              >
                {/* Nome da etapa */}
                <div className="w-72 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-800/40">
                  {getTipoIcon(etapa.tipo)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-white">{etapa.nome}</div>
                    <div className="text-xs text-slate-300">
                      {formatarDataBR(etapa.data_inicio)} - {formatarDataBR(etapa.data_fim)}
                    </div>
                    {etapa.responsavel?.nome_completo && (
                      <div className="text-xs text-sky-400 truncate">
                        👤 {etapa.responsavel.nome_completo}
                      </div>
                    )}
                  </div>
                  {/* Ações */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      onClick={() => onAddAtividade(etapa)}
                      className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                      title="Criar atividade na agenda"
                    >
                      <FaCalendarPlus size={12} />
                    </button>
                    <button
                      onClick={() => onEditEtapa(etapa)}
                      className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                      title="Editar etapa"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteEtapa(etapa.id)}
                      className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                      title="Excluir etapa"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>

                {/* Barra do Gantt */}
                <div className="flex-1 relative h-12 flex items-center bg-slate-800/20">
                  <div 
                    className={`absolute h-7 rounded-md shadow-lg ${getStatusColor(etapa.status, etapa.progresso)} ${atrasada ? 'animate-pulse' : ''}`}
                    style={{ left: pos.left, width: pos.width, minWidth: '60px' }}
                  >
                    {/* Barra de progresso interna */}
                    <div 
                      className="h-full bg-white/30 rounded-l-md"
                      style={{ width: `${etapa.progresso}%` }}
                    />
                    {/* Label de progresso */}
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                      {etapa.progresso}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =====================================================
// COMPONENTE DE RESUMO DE ETAPAS POR PERÍODO
// =====================================================
const ResumoEtapas = ({ obras, filtroPeriodo, onAddAtividade }) => {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('data'); // data, cliente, equipe
  const [modoVisualizacao, setModoVisualizacao] = useState('tabela'); // tabela, agenda
  const [semanaOffset, setSemanaOffset] = useState(0); // Para navegar entre semanas na agenda
  
  // Extrair TODAS as etapas de TODAS as obras em uma lista única
  const todasEtapas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Calcular range de datas baseado no filtro
    let dataInicio, dataFim;
    
    switch (filtroPeriodo) {
      case 'semana':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - hoje.getDay());
        dataFim = new Date(dataInicio);
        dataFim.setDate(dataInicio.getDate() + 6);
        break;
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'trimestre':
        const trimestre = Math.floor(hoje.getMonth() / 3);
        dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
        dataFim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 0);
        break;
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = new Date(hoje.getFullYear(), 11, 31);
        break;
      default:
        dataInicio = null;
        dataFim = null;
    }
    
    const etapas = [];
    
    obras.forEach(obra => {
      if (!obra.etapas || obra.etapas.length === 0) return;
      
      obra.etapas.forEach(etapa => {
        // Filtrar por período
        if (dataInicio && dataFim) {
          const etapaInicio = new Date(etapa.data_inicio);
          const etapaFim = new Date(etapa.data_fim);
          if (!(etapaInicio <= dataFim && etapaFim >= dataInicio)) return;
        }
        
        // Filtrar por tipo
        if (filtroTipo !== 'todos' && etapa.tipo !== filtroTipo) return;
        
        etapas.push({
          ...etapa,
          cliente: obra.nome_cliente,
          cidade: obra.cidade,
          obra_id: obra.id
        });
      });
    });
    
    // Ordenar
    switch (ordenacao) {
      case 'cliente':
        etapas.sort((a, b) => a.cliente.localeCompare(b.cliente) || new Date(a.data_inicio) - new Date(b.data_inicio));
        break;
      case 'equipe':
        etapas.sort((a, b) => (a.tipo || '').localeCompare(b.tipo || '') || new Date(a.data_inicio) - new Date(b.data_inicio));
        break;
      default: // data
        etapas.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));
    }
    
    return etapas;
  }, [obras, filtroPeriodo, filtroTipo, ordenacao]);
  
  // Calcular dados para visualização de agenda (semana)
  const agendaData = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Calcular início da semana atual + offset
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay() + (semanaOffset * 7));
    
    // Gerar array de 7 dias
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + i);
      dias.push({
        data: dia,
        diaSemana: dia.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', ''),
        diaNumero: dia.getDate(),
        isHoje: dia.toDateString() === new Date().toDateString(),
        etapas: []
      });
    }
    
    // Distribuir etapas nos dias
    todasEtapas.forEach(etapa => {
      const etapaInicio = new Date(etapa.data_inicio);
      const etapaFim = new Date(etapa.data_fim);
      
      dias.forEach(dia => {
        // Se a etapa está ativa neste dia
        if (dia.data >= etapaInicio && dia.data <= etapaFim) {
          dia.etapas.push({
            ...etapa,
            isPrimeiroDia: dia.data.toDateString() === etapaInicio.toDateString(),
            isUltimoDia: dia.data.toDateString() === etapaFim.toDateString()
          });
        }
      });
    });
    
    return {
      dias,
      inicioSemana,
      fimSemana: dias[6].data,
      mesAno: inicioSemana.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    };
  }, [todasEtapas, semanaOffset]);
  
  // Estatísticas
  const stats = useMemo(() => {
    const hoje = new Date();
    const clientes = new Set(todasEtapas.map(e => e.cliente));
    const porTipo = { eletrica: 0, civil: 0, galpao: 0, geral: 0, administrativo: 0 };
    let atrasadas = 0;
    
    todasEtapas.forEach(e => {
      porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
      if (new Date(e.data_fim) < hoje && e.progresso < 100) atrasadas++;
    });
    
    return { 
      totalEtapas: todasEtapas.length, 
      porTipo, 
      atrasadas, 
      totalClientes: clientes.size 
    };
  }, [todasEtapas]);
  
  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-purple-400" />;
      case 'administrativo': return <FaTasks className="text-green-400" />;
      default: return <FaTasks className="text-blue-400" />;
    }
  };
  
  const getTipoBadgeColor = (tipo) => {
    switch (tipo) {
      case 'eletrica': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'civil': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'galpao': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'administrativo': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };
  
  // Cores para etapas na agenda (baseado no tipo)
  const getTipoCorAgenda = (tipo) => {
    switch (tipo) {
      case 'eletrica': return 'bg-yellow-500 border-yellow-400';
      case 'civil': return 'bg-orange-500 border-orange-400';
      case 'galpao': return 'bg-purple-500 border-purple-400';
      case 'administrativo': return 'bg-green-500 border-green-400';
      default: return 'bg-blue-500 border-blue-400';
    }
  };
  
  const formatarData = (data) => {
    return formatarDataCurta(data);
  };
  
  const getPeriodoLabel = () => {
    const hoje = new Date();
    switch (filtroPeriodo) {
      case 'semana': return 'Esta Semana';
      case 'mes': return hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      case 'trimestre': return `${Math.floor(hoje.getMonth() / 3) + 1}º Trimestre ${hoje.getFullYear()}`;
      case 'ano': return `Ano ${hoje.getFullYear()}`;
      default: return 'Todos os Períodos';
    }
  };

  // Agrupar por cliente para visualização com cores alternadas
  let ultimoCliente = '';
  let corAlternada = false;

  return (
    <div className="execucao-animate-fade-in">
      {/* Header do Resumo */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaCalendarWeek className="text-sky-400" />
            Resumo de Etapas - {getPeriodoLabel()}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {stats.totalEtapas} etapas em {stats.totalClientes} clientes
          </p>
        </div>
        
        {/* Modo de Visualização + Filtros */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Toggle Tabela/Agenda */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setModoVisualizacao('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                modoVisualizacao === 'tabela' 
                  ? 'bg-sky-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FaListAlt size={12} />
              Tabela
            </button>
            <button
              onClick={() => setModoVisualizacao('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                modoVisualizacao === 'agenda' 
                  ? 'bg-sky-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FaCalendarAlt size={12} />
              Agenda
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Equipe:</span>
            <select
              className="execucao-form-select text-sm py-1"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todas</option>
              <option value="eletrica">⚡ Elétrica</option>
              <option value="civil">🏗️ Civil</option>
              <option value="galpao">🏭 Galpão</option>
              <option value="geral">📋 Geral</option>
              <option value="administrativo">📊 Adm</option>
            </select>
          </div>
          
          {modoVisualizacao === 'tabela' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Ordenar:</span>
              <select
                className="execucao-form-select text-sm py-1"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
              >
                <option value="data">📅 Por Data</option>
                <option value="cliente">👤 Por Cliente</option>
                <option value="equipe">👷 Por Equipe</option>
              </select>
            </div>
          )}
        </div>
      </div>
      
      {/* Navegação da Agenda (só aparece no modo agenda) */}
      {modoVisualizacao === 'agenda' && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <button
            onClick={() => setSemanaOffset(prev => prev - 1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronLeft /> Semana Anterior
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-white capitalize">{agendaData.mesAno}</div>
            <div className="text-sm text-slate-400">
              {formatarData(agendaData.inicioSemana)} - {formatarData(agendaData.fimSemana)}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSemanaOffset(0)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Hoje
            </button>
            <button
              onClick={() => setSemanaOffset(prev => prev + 1)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Próxima Semana <FaChevronRight />
            </button>
          </div>
        </div>
      )}
      
      {/* Cards de Estatísticas Compactos */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
          <FaUsers className="text-sky-400" />
          <span className="text-slate-400 text-sm">Clientes:</span>
          <span className="text-white font-bold">{stats.totalClientes}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
          <FaTasks className="text-yellow-400" />
          <span className="text-slate-400 text-sm">Etapas:</span>
          <span className="text-white font-bold">{stats.totalEtapas}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
          <span>⚡</span>
          <span className="text-yellow-300 font-medium">{stats.porTipo.eletrica || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/30">
          <span>🏗️</span>
          <span className="text-orange-300 font-medium">{stats.porTipo.civil || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <span>🏭</span>
          <span className="text-purple-300 font-medium">{stats.porTipo.galpao || 0}</span>
        </div>
        {stats.atrasadas > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/30 animate-pulse">
            <FaExclamationCircle className="text-red-400" />
            <span className="text-red-300 font-medium">{stats.atrasadas} atrasadas</span>
          </div>
        )}
      </div>
      
      {/* Conteúdo baseado no modo de visualização */}
      {todasEtapas.length === 0 ? (
        <div className="execucao-card text-center py-12">
          <FaCalendarAlt className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Nenhuma etapa no período</h3>
          <p className="text-slate-500">Não há etapas programadas para {getPeriodoLabel().toLowerCase()}</p>
        </div>
      ) : modoVisualizacao === 'agenda' ? (
        /* ===== VISUALIZAÇÃO DE AGENDA ===== */
        <div className="execucao-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {/* Grid da Agenda */}
            <div className="min-w-[900px]">
              {/* Header com dias da semana */}
              <div className="grid grid-cols-7 border-b border-slate-700">
                {agendaData.dias.map((dia, index) => (
                  <div 
                    key={index} 
                    className={`p-3 text-center border-r border-slate-700 last:border-r-0 ${
                      dia.isHoje ? 'bg-sky-500/20' : 'bg-slate-800/50'
                    }`}
                  >
                    <div className={`text-xs font-medium ${dia.isHoje ? 'text-sky-400' : 'text-slate-400'}`}>
                      {dia.diaSemana}
                    </div>
                    <div className={`text-2xl font-bold ${dia.isHoje ? 'text-sky-400' : 'text-white'} ${
                      dia.isHoje ? 'bg-sky-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto' : ''
                    }`}>
                      {dia.diaNumero}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Corpo da agenda com etapas */}
              <div className="grid grid-cols-7 min-h-[500px]">
                {agendaData.dias.map((dia, diaIndex) => (
                  <div 
                    key={diaIndex} 
                    className={`border-r border-slate-700 last:border-r-0 p-2 ${
                      dia.isHoje ? 'bg-sky-500/5' : ''
                    }`}
                  >
                    {dia.etapas.length === 0 ? (
                      <div className="text-center text-slate-600 text-xs py-4">
                        Sem etapas
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dia.etapas.map((etapa, etapaIndex) => (
                          <div
                            key={`${etapa.id}-${etapaIndex}`}
                            onClick={() => onAddAtividade(etapa)}
                            className={`p-2 rounded-md cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-l-4 ${getTipoCorAgenda(etapa.tipo)}`}
                            title={`${etapa.cliente} - ${etapa.nome}\n${formatarData(etapa.data_inicio)} - ${formatarData(etapa.data_fim)}\nClique para agendar atividade`}
                          >
                            <div className="text-xs font-bold text-white truncate">
                              {etapa.cliente.substring(0, 15)}{etapa.cliente.length > 15 ? '...' : ''}
                            </div>
                            <div className="text-[10px] text-white/80 truncate">
                              {etapa.nome}
                            </div>
                            <div className="text-[9px] text-white/60 mt-1">
                              {etapa.progresso || 0}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Legenda */}
          <div className="p-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs">
            <span className="text-slate-400">Legenda:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-slate-300">Elétrica</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span className="text-slate-300">Civil</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span className="text-slate-300">Galpão</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-slate-300">Geral</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-slate-300">Administrativo</span>
            </div>
          </div>
        </div>
      ) : (
        /* ===== VISUALIZAÇÃO DE TABELA ===== */
        <div className="execucao-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-800/70">
                  <th className="sticky left-0 bg-slate-800 z-10 text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold border-r border-slate-700 min-w-[200px]">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                    Equipe
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[200px]">
                    Etapa
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[130px]">
                    Período
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[120px]">
                    Progresso
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {todasEtapas.map((etapa, index) => {
                  const hoje = new Date();
                  const fimEtapa = new Date(etapa.data_fim);
                  const atrasada = fimEtapa < hoje && etapa.progresso < 100;
                  
                  // Alternar cor quando mudar de cliente
                  if (etapa.cliente !== ultimoCliente) {
                    corAlternada = !corAlternada;
                    ultimoCliente = etapa.cliente;
                  }
                  
                  const bgColor = corAlternada ? 'bg-slate-800/30' : 'bg-slate-800/10';
                  const isNovoCliente = index === 0 || todasEtapas[index - 1].cliente !== etapa.cliente;
                  
                  return (
                    <tr 
                      key={etapa.id} 
                      className={`${bgColor} hover:bg-slate-700/40 border-b border-slate-700/30 ${atrasada ? '!bg-red-500/10' : ''}`}
                    >
                      {/* Cliente - Fixo à esquerda */}
                      <td className={`sticky left-0 z-10 px-4 py-3 border-r border-slate-700 ${corAlternada ? 'bg-slate-800' : 'bg-slate-900'} ${atrasada ? '!bg-red-900/50' : ''}`}>
                        {isNovoCliente ? (
                          <div>
                            <div className="font-semibold text-white">{etapa.cliente}</div>
                            {etapa.cidade && (
                              <div className="text-xs text-slate-400">{etapa.cidade}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500 text-sm italic">↳ mesmo cliente</div>
                        )}
                      </td>
                      
                      {/* Equipe */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${getTipoBadgeColor(etapa.tipo)}`}>
                          {getTipoIcon(etapa.tipo)}
                          <span className="capitalize">{etapa.tipo}</span>
                        </span>
                      </td>
                      
                      {/* Etapa */}
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{etapa.nome}</div>
                        {etapa.descricao && (
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">{etapa.descricao}</div>
                        )}
                      </td>
                      
                      {/* Período */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">
                          {formatarData(etapa.data_inicio)} → {formatarData(etapa.data_fim)}
                        </div>
                      </td>
                      
                      {/* Progresso */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 h-2.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                etapa.progresso >= 100 ? 'bg-emerald-500' :
                                atrasada ? 'bg-red-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${etapa.progresso || 0}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium w-10 ${
                            etapa.progresso >= 100 ? 'text-emerald-400' :
                            atrasada ? 'text-red-400' : 'text-slate-300'
                          }`}>
                            {etapa.progresso || 0}%
                          </span>
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {atrasada ? (
                          <span className="execucao-badge execucao-badge-red animate-pulse">Atrasada</span>
                        ) : etapa.progresso >= 100 ? (
                          <span className="execucao-badge execucao-badge-green">Concluída</span>
                        ) : etapa.status === 'em_andamento' ? (
                          <span className="execucao-badge execucao-badge-blue">Em Andamento</span>
                        ) : (
                          <span className="execucao-badge execucao-badge-gray">Pendente</span>
                        )}
                      </td>
                      
                      {/* Ação */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onAddAtividade(etapa)}
                          className="execucao-btn execucao-btn-success execucao-btn-sm"
                          title="Criar atividade na agenda"
                        >
                          <FaCalendarPlus size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
const PlanejamentoMacro = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [obras, setObras] = useState([]);
  const [showObraModal, setShowObraModal] = useState(false);
  const [showEtapaModal, setShowEtapaModal] = useState(false);
  const [showAtividadeModal, setShowAtividadeModal] = useState(false);
  const [obraSelecionada, setObraSelecionada] = useState(null);
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('obras'); // obras, resumo
  const [tecnicos, setTecnicos] = useState([]);
  const [obraExpandida, setObraExpandida] = useState(null);

  // Form states
  const [formObra, setFormObra] = useState({
    nome_cliente: '',
    endereco: '',
    cidade: '',
    contrato_numero: '',
    data_contrato: '',
    data_inicio_prevista: '',
    data_fim_prevista: '',
    tipo_obra: 'misto',
    prioridade: 'media',
    responsavel_id: '',
    valor_contrato: '',
    observacoes: ''
  });

  const [formEtapa, setFormEtapa] = useState({
    nome: '',
    descricao: '',
    tipo: 'geral',
    data_inicio: '',
    data_fim: '',
    responsavel_id: '',
    ordem: 0
  });

  const [formAtividade, setFormAtividade] = useState({
    titulo: '',
    descricao: '',
    data_programada: '',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    prioridade: 'normal',
    tecnico_responsavel_id: '',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
    carregarTecnicos();
  }, [filtroPeriodo, filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      let result;
      if (filtroPeriodo === 'todos') {
        result = await execucaoService.buscarObras(
          filtroStatus !== 'todos' ? { status: filtroStatus } : {}
        );
      } else {
        result = await execucaoService.buscarObrasPorPeriodo(filtroPeriodo);
        if (result.success && filtroStatus !== 'todos') {
          result.data = result.data.filter(o => o.status === filtroStatus);
        }
      }

      if (result.success) {
        setObras(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar obras:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTecnicos = async () => {
    const result = await execucaoService.buscarTecnicos();
    if (result.success) {
      setTecnicos(result.data);
    }
  };

  // Filtrar obras por busca
  const obrasFiltradas = useMemo(() => {
    if (!busca) return obras;
    const termoBusca = busca.toLowerCase();
    return obras.filter(o => 
      o.nome_cliente?.toLowerCase().includes(termoBusca) ||
      o.endereco?.toLowerCase().includes(termoBusca) ||
      o.cidade?.toLowerCase().includes(termoBusca)
    );
  }, [obras, busca]);

  // Estatísticas - calcula status real baseado no progresso
  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const getStatus = (o) => {
      const progresso = o.progresso_geral || 0;
      if (o.status === 'cancelada' || o.status === 'pausada') return o.status;
      if (progresso >= 100) return 'concluida';
      if (progresso > 0) return 'em_andamento';
      return 'planejada';
    };
    
    // Verifica se a obra tem alguma etapa atrasada
    const temEtapaAtrasada = (o) => {
      if (!o.etapas || o.etapas.length === 0) {
        // Se não tem etapas, verifica a data fim da obra
        const fimPrevisto = parseDataLocal(o.data_fim_prevista);
        return fimPrevisto < hoje && getStatus(o) !== 'concluida';
      }
      // Verifica se alguma etapa está atrasada (data fim passou e progresso < 100)
      return o.etapas.some(etapa => {
        const fimEtapa = parseDataLocal(etapa.data_fim);
        const progresso = etapa.progresso || 0;
        return fimEtapa < hoje && progresso < 100;
      });
    };
    
    return {
      total: obras.length,
      planejadas: obras.filter(o => getStatus(o) === 'planejada').length,
      emAndamento: obras.filter(o => getStatus(o) === 'em_andamento').length,
      concluidas: obras.filter(o => getStatus(o) === 'concluida').length,
      atrasadas: obras.filter(o => getStatus(o) !== 'concluida' && temEtapaAtrasada(o)).length
    };
  }, [obras]);

  // Handlers de Obra
  const handleSalvarObra = async (e) => {
    e.preventDefault();
    try {
      let result;
      if (obraSelecionada) {
        result = await execucaoService.atualizarObra(obraSelecionada.id, formObra);
      } else {
        result = await execucaoService.criarObra(formObra);
      }

      if (result.success) {
        setShowObraModal(false);
        resetFormObra();
        carregarDados();
      }
    } catch (error) {
      console.error('Erro ao salvar obra:', error);
    }
  };

  const handleEditarObra = (obra) => {
    setObraSelecionada(obra);
    setFormObra({
      nome_cliente: obra.nome_cliente || '',
      endereco: obra.endereco || '',
      cidade: obra.cidade || '',
      contrato_numero: obra.contrato_numero || '',
      data_contrato: obra.data_contrato || '',
      data_inicio_prevista: obra.data_inicio_prevista || '',
      data_fim_prevista: obra.data_fim_prevista || '',
      tipo_obra: obra.tipo_obra || 'misto',
      prioridade: obra.prioridade || 'media',
      responsavel_id: obra.responsavel_id || '',
      valor_contrato: obra.valor_contrato || '',
      observacoes: obra.observacoes || ''
    });
    setShowObraModal(true);
  };

  const handleExcluirObra = async (id) => {
    if (confirm('Deseja realmente excluir esta obra e todas as suas etapas?')) {
      const result = await execucaoService.excluirObra(id);
      if (result.success) {
        carregarDados();
      }
    }
  };

  const resetFormObra = () => {
    setObraSelecionada(null);
    setFormObra({
      nome_cliente: '',
      endereco: '',
      cidade: '',
      contrato_numero: '',
      data_contrato: '',
      data_inicio_prevista: '',
      data_fim_prevista: '',
      tipo_obra: 'misto',
      prioridade: 'media',
      responsavel_id: '',
      valor_contrato: '',
      observacoes: ''
    });
  };

  // Handlers de Etapa
  const handleAbrirEtapaModal = (obra, etapa = null) => {
    setObraSelecionada(obra);
    if (etapa) {
      setEtapaSelecionada(etapa);
      setFormEtapa({
        nome: etapa.nome || '',
        descricao: etapa.descricao || '',
        tipo: etapa.tipo || 'geral',
        data_inicio: etapa.data_inicio || '',
        data_fim: etapa.data_fim || '',
        responsavel_id: etapa.responsavel_id || '',
        ordem: etapa.ordem || 0,
        progresso: etapa.progresso || 0,
        status: etapa.status || 'pendente'
      });
    } else {
      setEtapaSelecionada(null);
      setFormEtapa({
        nome: '',
        descricao: '',
        tipo: 'geral',
        data_inicio: obra.data_inicio_prevista || '',
        data_fim: '',
        responsavel_id: '',
        ordem: (obra.etapas?.length || 0) + 1
      });
    }
    setShowEtapaModal(true);
  };

  const handleSalvarEtapa = async (e) => {
    e.preventDefault();
    try {
      let result;
      if (etapaSelecionada) {
        result = await execucaoService.atualizarEtapa(etapaSelecionada.id, formEtapa);
      } else {
        result = await execucaoService.criarEtapa({
          ...formEtapa,
          obra_id: obraSelecionada.id
        });
      }

      if (result.success) {
        setShowEtapaModal(false);
        carregarDados();
      }
    } catch (error) {
      console.error('Erro ao salvar etapa:', error);
    }
  };

  const handleExcluirEtapa = async (id) => {
    if (confirm('Deseja realmente excluir esta etapa?')) {
      const result = await execucaoService.excluirEtapa(id);
      if (result.success) {
        carregarDados();
      }
    }
  };

  // Handler para criar atividade a partir de etapa
  const handleAbrirAtividadeModal = (etapa) => {
    setEtapaSelecionada(etapa);
    setFormAtividade({
      titulo: etapa.nome,
      descricao: etapa.descricao || '',
      data_programada: etapa.data_inicio,
      hora_inicio: '08:00',
      hora_fim: '17:00',
      prioridade: 'normal',
      tecnico_responsavel_id: etapa.responsavel_id || '',
      observacoes: ''
    });
    setShowAtividadeModal(true);
  };

  const handleCriarAtividade = async (e) => {
    e.preventDefault();
    try {
      const result = await execucaoService.criarAtividadeDeEtapa(
        etapaSelecionada.id,
        formAtividade,
        usuario?.id
      );

      if (result.success) {
        setShowAtividadeModal(false);
        alert('Atividade criada com sucesso! Verifique na agenda correspondente.');
      }
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
    }
  };

  // Helpers de visualização
  
  // Determina o status real da obra baseado no progresso (automático)
  const getStatusReal = (obra) => {
    const progresso = obra.progresso_geral || 0;
    // Se foi cancelada ou pausada manualmente, manter
    if (obra.status === 'cancelada' || obra.status === 'pausada') {
      return obra.status;
    }
    // Determinar automaticamente pelo progresso
    if (progresso >= 100) {
      return 'concluida';
    } else if (progresso > 0) {
      return 'em_andamento';
    } else {
      return 'planejada';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planejada': return 'blue';
      case 'em_andamento': return 'yellow';
      case 'concluida': return 'green';
      case 'pausada': return 'orange';
      case 'cancelada': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'planejada': return 'Planejada';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'pausada': return 'Pausada';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'baixa': return 'text-blue-400';
      case 'media': return 'text-yellow-400';
      case 'alta': return 'text-orange-400';
      case 'urgente': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTipoObraIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-purple-400" />;
      default: return <FaBuilding className="text-blue-400" />;
    }
  };

  const calcularDuracaoObra = (dataInicio, dataFim) => {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const dias = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
    if (dias < 30) return `${dias} dias`;
    if (dias < 365) return `${Math.round(dias / 30)} meses`;
    return `${(dias / 365).toFixed(1)} anos`;
  };

  if (loading) {
    return (
      <div className="execucao-loading">
        <div className="execucao-spinner"></div>
      </div>
    );
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Abas de Navegação */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-700 pb-4">
        <button
          onClick={() => setAbaAtiva('obras')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            abaAtiva === 'obras' 
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FaBuilding size={14} />
          Obras
        </button>
        <button
          onClick={() => setAbaAtiva('resumo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            abaAtiva === 'resumo' 
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FaListAlt size={14} />
          Resumo de Etapas
        </button>
      </div>

      {/* Aba de Resumo de Etapas */}
      {abaAtiva === 'resumo' ? (
        <>
          {/* Filtro de Período para Resumo */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FaFilter className="text-slate-400" size={12} />
              <span className="text-slate-400 text-sm">Período:</span>
              <select
                className="execucao-form-select text-sm py-1 min-w-[150px]"
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value)}
              >
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mês</option>
                <option value="trimestre">Este Trimestre</option>
                <option value="ano">Este Ano</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </div>
          
          <ResumoEtapas 
            obras={obras} 
            filtroPeriodo={filtroPeriodo}
            onAddAtividade={handleAbrirAtividadeModal}
          />
        </>
      ) : (
        <>
          {/* Header da aba Obras */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              {/* Filtro de Período */}
              <div className="flex items-center gap-2">
                <FaFilter className="text-slate-400" size={12} />
                <select
                  className="execucao-form-select text-sm py-1 min-w-[140px]"
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                >
                  <option value="semana">Semana</option>
                  <option value="mes">Mês</option>
                  <option value="trimestre">Trimestre</option>
                  <option value="ano">Ano</option>
                  <option value="todos">Todas</option>
                </select>
              </div>

              {/* Filtro de Status */}
              <select
                className="execucao-form-select text-sm py-1"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="todos">Todos os Status</option>
                <option value="planejada">Planejadas</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluídas</option>
                <option value="pausada">Pausadas</option>
              </select>
            </div>

        {/* Busca e Ações */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <FaSearch className="absolute left-3 text-slate-400 pointer-events-none z-10" size={12} style={{ top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="execucao-form-input text-sm !py-2 !pl-9 !pr-3 w-48"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          
          <button
            onClick={() => { resetFormObra(); setShowObraModal(true); }}
            className="execucao-btn execucao-btn-primary"
          >
            <FaPlus /> Nova Obra
          </button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaBuilding />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total de Obras</div>
            <div className="execucao-stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Em Andamento</div>
            <div className="execucao-stat-value">{stats.emAndamento}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{stats.concluidas}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon red">
            <FaExclamationCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Atrasadas</div>
            <div className="execucao-stat-value">{stats.atrasadas}</div>
          </div>
        </div>
      </div>

      {/* Lista de Obras */}
      {obrasFiltradas.length === 0 ? (
        <div className="execucao-card text-center py-12">
          <FaBuilding className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Nenhuma obra encontrada</h3>
          <p className="text-slate-500 mb-4">Clique em "Nova Obra" para cadastrar um cronograma</p>
        </div>
      ) : (
        <div className="space-y-4">
          {obrasFiltradas.map((obra) => {
            const isExpanded = obraExpandida === obra.id;
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            // Verifica se a obra tem alguma etapa atrasada
            const temEtapaAtrasada = obra.etapas && obra.etapas.some(etapa => {
              const fimEtapa = parseDataLocal(etapa.data_fim);
              return fimEtapa < hoje && (etapa.progresso || 0) < 100;
            });
            
            // Também verifica se a data da obra já passou
            const fimObra = parseDataLocal(obra.data_fim_prevista);
            const obraPassouData = fimObra < hoje;
            
            // Atrasada se: tem etapa atrasada OU a obra passou da data (e não está concluída)
            const atrasada = (temEtapaAtrasada || obraPassouData) && (obra.progresso_geral || 0) < 100;

            return (
              <div key={obra.id} className="execucao-card">
                {/* Header da Obra */}
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setObraExpandida(isExpanded ? null : obra.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-slate-800`}>
                      {getTipoObraIcon(obra.tipo_obra)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg text-white">{obra.nome_cliente}</h3>
                        <FaFlag className={getPrioridadeColor(obra.prioridade)} size={12} />
                        <span className={`execucao-badge execucao-badge-${getStatusColor(getStatusReal(obra))}`}>
                          {getStatusLabel(getStatusReal(obra))}
                        </span>
                        {atrasada && (
                          <span className="execucao-badge execucao-badge-red animate-pulse">
                            Atrasada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-300 mt-1">
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt size={10} />
                          {formatarDataBR(obra.data_inicio_prevista)} - {formatarDataBR(obra.data_fim_prevista)}
                        </span>
                        <span className="text-slate-200">({calcularDuracaoObra(obra.data_inicio_prevista, obra.data_fim_prevista)})</span>
                        {obra.cidade && (
                          <span className="text-slate-200">{obra.cidade}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progresso */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-100">{obra.progresso_geral || 0}%</div>
                      <div className="text-xs text-slate-500">Progresso</div>
                    </div>
                    
                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditarObra(obra); }}
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        title="Editar obra"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExcluirObra(obra.id); }}
                        className="execucao-btn execucao-btn-danger execucao-btn-sm"
                        title="Excluir obra"
                      >
                        <FaTrash size={12} />
                      </button>
                      <div className="text-slate-500">
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mt-4">
                  <div className="execucao-progress">
                    <div 
                      className={`execucao-progress-bar ${atrasada ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${obra.progresso_geral || 0}%` }}
                    />
                  </div>
                </div>

                {/* Conteúdo Expandido */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    {/* Botão para adicionar etapa */}
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => handleAbrirEtapaModal(obra)}
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                      >
                        <FaPlus size={10} /> Adicionar Etapa
                      </button>
                    </div>

                    {/* Gráfico Gantt */}
                    <GanttChart 
                      obra={obra}
                      onEditEtapa={(etapa) => handleAbrirEtapaModal(obra, etapa)}
                      onDeleteEtapa={handleExcluirEtapa}
                      onAddAtividade={handleAbrirAtividadeModal}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Modal de Obra */}
      {showObraModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowObraModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaBuilding className="text-blue-400" />
                {obraSelecionada ? 'Editar Obra' : 'Nova Obra'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowObraModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSalvarObra}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  {/* Cliente */}
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Nome do Cliente *</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      value={formObra.nome_cliente}
                      onChange={(e) => setFormObra(prev => ({ ...prev, nome_cliente: e.target.value }))}
                      placeholder="Nome do cliente/condomínio"
                      required
                    />
                  </div>

                  {/* Endereço e Cidade */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Endereço</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formObra.endereco}
                        onChange={(e) => setFormObra(prev => ({ ...prev, endereco: e.target.value }))}
                        placeholder="Endereço da obra"
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Cidade</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formObra.cidade}
                        onChange={(e) => setFormObra(prev => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Cidade"
                      />
                    </div>
                  </div>

                  {/* Contrato */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Nº do Contrato</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formObra.contrato_numero}
                        onChange={(e) => setFormObra(prev => ({ ...prev, contrato_numero: e.target.value }))}
                        placeholder="Número do contrato"
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data do Contrato</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formObra.data_contrato}
                        onChange={(e) => setFormObra(prev => ({ ...prev, data_contrato: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Datas Previstas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Início Previsto *</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formObra.data_inicio_prevista}
                        onChange={(e) => setFormObra(prev => ({ ...prev, data_inicio_prevista: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Término Previsto *</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formObra.data_fim_prevista}
                        onChange={(e) => setFormObra(prev => ({ ...prev, data_fim_prevista: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Tipo, Prioridade e Responsável */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Tipo de Obra</label>
                      <select
                        className="execucao-form-select"
                        value={formObra.tipo_obra}
                        onChange={(e) => setFormObra(prev => ({ ...prev, tipo_obra: e.target.value }))}
                      >
                        <option value="eletrica">Elétrica</option>
                        <option value="civil">Civil</option>
                        <option value="galpao">Galpão</option>
                        <option value="misto">Misto</option>
                      </select>
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Prioridade</label>
                      <select
                        className="execucao-form-select"
                        value={formObra.prioridade}
                        onChange={(e) => setFormObra(prev => ({ ...prev, prioridade: e.target.value }))}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Responsável</label>
                      <select
                        className="execucao-form-select"
                        value={formObra.responsavel_id}
                        onChange={(e) => setFormObra(prev => ({ ...prev, responsavel_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome_completo}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Valor e Observações */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Valor do Contrato</label>
                      <input
                        type="number"
                        step="0.01"
                        className="execucao-form-input"
                        value={formObra.valor_contrato}
                        onChange={(e) => setFormObra(prev => ({ ...prev, valor_contrato: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Observações</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formObra.observacoes}
                        onChange={(e) => setFormObra(prev => ({ ...prev, observacoes: e.target.value }))}
                        placeholder="Observações gerais"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowObraModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn execucao-btn-primary">
                  {obraSelecionada ? 'Salvar Alterações' : 'Cadastrar Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Etapa */}
      {showEtapaModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowEtapaModal(false)}>
          <div className="execucao-modal" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaProjectDiagram className="text-green-400" />
                {etapaSelecionada ? 'Editar Etapa' : 'Nova Etapa'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowEtapaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSalvarEtapa}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Nome da Etapa *</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      value={formEtapa.nome}
                      onChange={(e) => setFormEtapa(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Instalação de quadros elétricos"
                      required
                    />
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Descrição</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="2"
                      value={formEtapa.descricao}
                      onChange={(e) => setFormEtapa(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Detalhes da etapa..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Tipo da Etapa</label>
                      <select
                        className="execucao-form-select"
                        value={formEtapa.tipo}
                        onChange={(e) => setFormEtapa(prev => ({ ...prev, tipo: e.target.value }))}
                      >
                        <option value="eletrica">Elétrica</option>
                        <option value="civil">Civil</option>
                        <option value="galpao">Galpão</option>
                        <option value="geral">Geral</option>
                        <option value="administrativo">Administrativo</option>
                      </select>
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Responsável</label>
                      <select
                        className="execucao-form-select"
                        value={formEtapa.responsavel_id}
                        onChange={(e) => setFormEtapa(prev => ({ ...prev, responsavel_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome_completo}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data Início *</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formEtapa.data_inicio}
                        onChange={(e) => setFormEtapa(prev => ({ ...prev, data_inicio: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data Fim *</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formEtapa.data_fim}
                        onChange={(e) => setFormEtapa(prev => ({ ...prev, data_fim: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {etapaSelecionada && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="execucao-form-group">
                        <label className="execucao-form-label">Status</label>
                        <select
                          className="execucao-form-select"
                          value={formEtapa.status}
                          onChange={(e) => setFormEtapa(prev => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluida">Concluída</option>
                          <option value="atrasada">Atrasada</option>
                        </select>
                      </div>
                      <div className="execucao-form-group">
                        <label className="execucao-form-label">Progresso: {formEtapa.progresso || 0}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={formEtapa.progresso || 0}
                          onChange={(e) => setFormEtapa(prev => ({ ...prev, progresso: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowEtapaModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn execucao-btn-primary">
                  {etapaSelecionada ? 'Salvar' : 'Adicionar Etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Criar Atividade a partir de Etapa */}
      {showAtividadeModal && etapaSelecionada && (
        <div className="execucao-modal-overlay" onClick={() => setShowAtividadeModal(false)}>
          <div className="execucao-modal" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaCalendarPlus className="text-green-400" />
                Criar Atividade na Agenda
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowAtividadeModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCriarAtividade}>
              <div className="execucao-modal-body">
                <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-400">Criando atividade a partir da etapa:</p>
                  <p className="font-medium">{etapaSelecionada.nome}</p>
                </div>

                <div className="space-y-4">
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Título da Atividade</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      value={formAtividade.titulo}
                      onChange={(e) => setFormAtividade(prev => ({ ...prev, titulo: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data *</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formAtividade.data_programada}
                        onChange={(e) => setFormAtividade(prev => ({ ...prev, data_programada: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Hora Início</label>
                      <input
                        type="time"
                        className="execucao-form-input"
                        value={formAtividade.hora_inicio}
                        onChange={(e) => setFormAtividade(prev => ({ ...prev, hora_inicio: e.target.value }))}
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Hora Fim</label>
                      <input
                        type="time"
                        className="execucao-form-input"
                        value={formAtividade.hora_fim}
                        onChange={(e) => setFormAtividade(prev => ({ ...prev, hora_fim: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Técnico Responsável</label>
                      <select
                        className="execucao-form-select"
                        value={formAtividade.tecnico_responsavel_id}
                        onChange={(e) => setFormAtividade(prev => ({ ...prev, tecnico_responsavel_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome_completo}</option>
                        ))}
                      </select>
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Prioridade</label>
                      <select
                        className="execucao-form-select"
                        value={formAtividade.prioridade}
                        onChange={(e) => setFormAtividade(prev => ({ ...prev, prioridade: e.target.value }))}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Observações</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="2"
                      value={formAtividade.observacoes}
                      onChange={(e) => setFormAtividade(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Instruções adicionais..."
                    />
                  </div>
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowAtividadeModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn execucao-btn-primary">
                  <FaCalendarPlus /> Criar Atividade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanejamentoMacro;
