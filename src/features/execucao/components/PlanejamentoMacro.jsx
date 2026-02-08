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
  FaCalendarWeek,
  FaFilePdf,
  FaUpload,
  FaFileExcel,
  FaDownload,
  FaBell,
  FaMagic,
  FaSearchMinus,
  FaSearchPlus,
  FaWrench,
  FaCopy
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// =====================================================
// TEMPLATES_ETAPAS agora são carregados do banco de dados via execucaoService.buscarTemplates()
// A constante abaixo serve apenas como fallback caso o banco esteja vazio
const TEMPLATES_ETAPAS_FALLBACK = {
  eletrica: { nome: 'Obra Elétrica Padrão', etapas: [] },
  civil: { nome: 'Obra Civil Padrão', etapas: [] },
  galpao: { nome: 'Galpão Industrial', etapas: [] },
  spda: { nome: 'SPDA (Para-raios)', etapas: [] },
  manutencao: { nome: 'Manutenção Predial', etapas: [] }
};

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
// COMPONENTE DE ALERTAS DE ETAPAS ATRASADAS
// =====================================================
const AlertasEtapasAtrasadas = ({ obras, onVerEtapa }) => {
  const etapasAtrasadas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const atrasadas = [];
    obras.forEach(obra => {
      if (!obra.etapas) return;
      obra.etapas.forEach(etapa => {
        const fimEtapa = parseDataLocal(etapa.data_fim);
        if (fimEtapa < hoje && (etapa.progresso || 0) < 100) {
          const diasAtraso = Math.ceil((hoje - fimEtapa) / (1000 * 60 * 60 * 24));
          atrasadas.push({
            ...etapa,
            cliente: obra.nome_cliente,
            cidade: obra.cidade,
            obra_id: obra.id,
            diasAtraso
          });
        }
      });
    });
    
    // Ordenar por dias de atraso (mais atrasadas primeiro)
    return atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [obras]);
  
  if (etapasAtrasadas.length === 0) return null;
  
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="mb-6 execucao-animate-fade-in">
      <div 
        className={`rounded-lg border-2 ${expanded ? 'border-red-500/50 bg-red-500/10' : 'border-red-500/30 bg-red-500/5'} overflow-hidden`}
      >
        {/* Header do Alerta */}
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-500/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg animate-pulse">
              <FaBell className="text-red-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-red-400 flex items-center gap-2">
                ⚠️ Etapas Atrasadas
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {etapasAtrasadas.length}
                </span>
              </h3>
              <p className="text-sm text-slate-400">
                {etapasAtrasadas.length} etapa{etapasAtrasadas.length > 1 ? 's' : ''} precisam de atenção imediata
              </p>
            </div>
          </div>
          <div className="text-slate-400">
            {expanded ? <FaChevronUp /> : <FaChevronDown />}
          </div>
        </div>
        
        {/* Lista de Etapas Atrasadas */}
        {expanded && (
          <div className="border-t border-red-500/30 max-h-64 overflow-y-auto">
            {etapasAtrasadas.map((etapa, index) => (
              <div 
                key={etapa.id}
                className={`flex items-center justify-between p-3 hover:bg-red-500/10 transition-colors ${
                  index < etapasAtrasadas.length - 1 ? 'border-b border-red-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    etapa.diasAtraso > 7 ? 'bg-red-500' : 
                    etapa.diasAtraso > 3 ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <div className="font-medium text-white">{etapa.nome}</div>
                    <div className="text-xs text-slate-400">
                      {etapa.cliente} • {etapa.cidade}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      etapa.diasAtraso > 7 ? 'text-red-400' : 
                      etapa.diasAtraso > 3 ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {etapa.diasAtraso} dia{etapa.diasAtraso > 1 ? 's' : ''} de atraso
                    </div>
                    <div className="text-xs text-slate-500">
                      Prazo: {formatarDataBR(etapa.data_fim)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {etapa.progresso || 0}%
                  </div>
                  <button
                    onClick={() => onVerEtapa(etapa)}
                    className="p-2 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors"
                    title="Criar atividade para esta etapa"
                  >
                    <FaCalendarPlus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// COMPONENTE DE GRÁFICO GANTT MELHORADO
// =====================================================
const GanttChart = ({ obra, onEditEtapa, onDeleteEtapa, onAddAtividade, onAddSubEtapa }) => {
  const [expanded, setExpanded] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 = mais zoom out, 2 = mais zoom in
  const [subEtapasExpandidas, setSubEtapasExpandidas] = useState(new Set()); // IDs das etapas pai com sub-etapas visíveis
  
  // Organizar etapas em hierarquia (pais e filhos)
  const etapasOrganizadas = useMemo(() => {
    if (!obra.etapas) return [];
    
    // Separar etapas pai (sem etapa_pai_id) e sub-etapas (com etapa_pai_id)
    const etapasPai = obra.etapas.filter(e => !e.etapa_pai_id);
    const subEtapas = obra.etapas.filter(e => e.etapa_pai_id);
    
    // Agrupar sub-etapas por pai
    const subEtapasPorPai = {};
    subEtapas.forEach(sub => {
      if (!subEtapasPorPai[sub.etapa_pai_id]) {
        subEtapasPorPai[sub.etapa_pai_id] = [];
      }
      subEtapasPorPai[sub.etapa_pai_id].push(sub);
    });
    
    // Ordenar sub-etapas por ordem
    Object.keys(subEtapasPorPai).forEach(paiId => {
      subEtapasPorPai[paiId].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });
    
    return { etapasPai, subEtapasPorPai };
  }, [obra.etapas]);
  
  const toggleSubEtapas = (etapaId) => {
    setSubEtapasExpandidas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(etapaId)) {
        newSet.delete(etapaId);
      } else {
        newSet.add(etapaId);
      }
      return newSet;
    });
  };
  
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
  
  // Adicionar margem proporcional ao zoom
  const marginDays = Math.round(7 / zoomLevel);
  minDate.setDate(minDate.getDate() - marginDays);
  maxDate.setDate(maxDate.getDate() + marginDays);
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  
  // Linha de hoje
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const hojePosition = ((hoje - minDate) / (1000 * 60 * 60 * 24)) / totalDays * 100;
  const hojeVisible = hojePosition >= 0 && hojePosition <= 100;
  
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
  
  // Largura mínima do gráfico baseada no zoom
  const chartMinWidth = Math.max(800, 800 * zoomLevel);

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
        
        {/* Controles de Zoom */}
        {expanded && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-slate-400">Zoom:</span>
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Diminuir zoom"
            >
              <FaSearchMinus size={12} />
            </button>
            <span className="text-xs text-slate-300 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Aumentar zoom"
            >
              <FaSearchPlus size={12} />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          {/* Header com meses */}
          <div className="flex border-b border-slate-600" style={{ minWidth: `${chartMinWidth}px` }}>
            <div className="w-64 flex-shrink-0 p-2 bg-slate-700/70 font-medium text-sm text-white">
              Etapa
            </div>
            <div className="flex-1 flex relative">
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
          <div className="relative">
            {etapasOrganizadas.etapasPai.map((etapa) => {
              const pos = getBarPosition(etapa.data_inicio, etapa.data_fim);
              const hoje2 = new Date();
              const fimEtapa = new Date(etapa.data_fim);
              const atrasada = fimEtapa < hoje2 && etapa.progresso < 100;
              const temSubEtapas = etapasOrganizadas.subEtapasPorPai[etapa.id]?.length > 0;
              const subEtapasVisiveis = subEtapasExpandidas.has(etapa.id);
              const subEtapas = etapasOrganizadas.subEtapasPorPai[etapa.id] || [];

              return (
                <React.Fragment key={etapa.id}>
                  <div 
                    className="flex border-b border-slate-700/50 hover:bg-slate-800/30 group"
                    style={{ minWidth: `${chartMinWidth}px` }}
                  >
                    {/* Nome da etapa */}
                    <div className="w-72 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-800/40">
                      {/* Botão expandir sub-etapas */}
                      {temSubEtapas ? (
                        <button
                          onClick={() => toggleSubEtapas(etapa.id)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          title={subEtapasVisiveis ? 'Ocultar sub-etapas' : 'Mostrar sub-etapas'}
                        >
                          {subEtapasVisiveis ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                        </button>
                      ) : (
                        <div className="w-6" /> // Espaçador para alinhar
                      )}
                      {getTipoIcon(etapa.tipo)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-white flex items-center gap-1">
                          {etapa.nome}
                          {temSubEtapas && (
                            <span className="text-[10px] text-slate-400 bg-slate-700 px-1 rounded">
                              {subEtapas.length} sub
                            </span>
                          )}
                        </div>
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
                          onClick={() => onAddSubEtapa && onAddSubEtapa(etapa)}
                          className="p-1 text-purple-400 hover:bg-purple-500/20 rounded"
                          title="Adicionar sub-etapa"
                        >
                          <FaPlus size={10} />
                        </button>
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
                    {/* Linha de HOJE */}
                    {hojeVisible && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: `${hojePosition}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded whitespace-nowrap">
                          HOJE
                        </div>
                      </div>
                    )}
                    
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
                
                {/* Sub-etapas (renderizadas quando expandidas) */}
                {subEtapasVisiveis && subEtapas.map((subEtapa) => {
                  const subPos = getBarPosition(subEtapa.data_inicio, subEtapa.data_fim);
                  const fimSubEtapa = new Date(subEtapa.data_fim);
                  const subAtrasada = fimSubEtapa < hoje2 && subEtapa.progresso < 100;
                  
                  return (
                    <div 
                      key={subEtapa.id}
                      className="flex border-b border-slate-700/30 hover:bg-slate-700/30 group bg-slate-900/40"
                      style={{ minWidth: `${chartMinWidth}px` }}
                    >
                      {/* Nome da sub-etapa (indentada) */}
                      <div className="w-72 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-900/50 pl-10">
                        <div className="w-1 h-6 bg-purple-500/50 rounded-full mr-1"></div>
                        {getTipoIcon(subEtapa.tipo)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate text-slate-200">
                            ↳ {subEtapa.nome}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatarDataBR(subEtapa.data_inicio)} - {formatarDataBR(subEtapa.data_fim)}
                          </div>
                          {subEtapa.responsavel?.nome_completo && (
                            <div className="text-xs text-sky-400 truncate">
                              👤 {subEtapa.responsavel.nome_completo}
                            </div>
                          )}
                        </div>
                        {/* Ações */}
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <button
                            onClick={() => onAddAtividade(subEtapa)}
                            className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                            title="Criar atividade na agenda"
                          >
                            <FaCalendarPlus size={12} />
                          </button>
                          <button
                            onClick={() => onEditEtapa(subEtapa)}
                            className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                            title="Editar sub-etapa"
                          >
                            <FaEdit size={12} />
                          </button>
                          <button
                            onClick={() => onDeleteEtapa(subEtapa.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                            title="Excluir sub-etapa"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Barra do Gantt da sub-etapa */}
                      <div className="flex-1 relative h-10 flex items-center bg-slate-900/30">
                        <div 
                          className={`absolute h-5 rounded-md shadow-lg ${getStatusColor(subEtapa.status, subEtapa.progresso)} opacity-80 ${subAtrasada ? 'animate-pulse' : ''}`}
                          style={{ left: subPos.left, width: subPos.width, minWidth: '40px' }}
                        >
                          <div 
                            className="h-full bg-white/30 rounded-l-md"
                            style={{ width: `${subEtapa.progresso}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                            {subEtapa.progresso}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
            
            {/* Linha vertical de HOJE no container geral (para visualização contínua) */}
            {hojeVisible && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/30 z-10 pointer-events-none"
                style={{ left: `calc(288px + ${hojePosition}% * (100% - 288px) / 100)` }}
              />
            )}
          </div>
          
          {/* Legenda */}
          <div className="flex items-center gap-4 p-3 border-t border-slate-700 text-xs">
            <span className="text-slate-400">Legenda:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-indigo-400"></div>
              <span className="text-slate-300">Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-sky-500"></div>
              <span className="text-slate-300">Em Andamento</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className="text-slate-300">Concluída</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-slate-300">Atrasada</span>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <div className="w-3 h-0.5 bg-red-500"></div>
              <span className="text-slate-300">Hoje</span>
            </div>
          </div>
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
  const [modoVisualizacao, setModoVisualizacao] = useState('tabela'); // tabela, agenda, mensal, anual
  const [semanaOffset, setSemanaOffset] = useState(0); // Para navegar entre semanas na agenda
  const [mesOffset, setMesOffset] = useState(0); // Para navegar entre meses
  const [anoOffset, setAnoOffset] = useState(0); // Para navegar entre anos
  
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
    
    // Distribuir etapas nos dias (buscar de TODAS as obras, não só filtradas)
    obras.forEach(obra => {
      if (!obra.etapas) return;
      obra.etapas.forEach(etapa => {
        if (filtroTipo !== 'todos' && etapa.tipo !== filtroTipo) return;
        
        const etapaInicio = parseDataLocal(etapa.data_inicio);
        const etapaFim = parseDataLocal(etapa.data_fim);
        
        dias.forEach(dia => {
          if (dia.data >= etapaInicio && dia.data <= etapaFim) {
            dia.etapas.push({
              ...etapa,
              cliente: obra.nome_cliente,
              cidade: obra.cidade,
              obra_id: obra.id,
              isPrimeiroDia: dia.data.toDateString() === etapaInicio.toDateString(),
              isUltimoDia: dia.data.toDateString() === etapaFim.toDateString()
            });
          }
        });
      });
    });
    
    return {
      dias,
      inicioSemana,
      fimSemana: dias[6].data,
      mesAno: inicioSemana.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    };
  }, [obras, semanaOffset, filtroTipo]);
  
  // Calcular dados para visualização MENSAL
  const mensalData = useMemo(() => {
    const hoje = new Date();
    const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
    const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
    const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
    
    // Calcular início da grade (domingo anterior ao primeiro dia)
    const inicioGrade = new Date(primeiroDia);
    inicioGrade.setDate(primeiroDia.getDate() - primeiroDia.getDay());
    
    // Gerar 6 semanas (42 dias) para cobrir qualquer mês
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const dia = new Date(inicioGrade);
      dia.setDate(inicioGrade.getDate() + i);
      dias.push({
        data: dia,
        diaNumero: dia.getDate(),
        isMesAtual: dia.getMonth() === mesAtual.getMonth(),
        isHoje: dia.toDateString() === new Date().toDateString(),
        etapas: []
      });
    }
    
    // Distribuir etapas
    obras.forEach(obra => {
      if (!obra.etapas) return;
      obra.etapas.forEach(etapa => {
        if (filtroTipo !== 'todos' && etapa.tipo !== filtroTipo) return;
        
        const etapaInicio = parseDataLocal(etapa.data_inicio);
        const etapaFim = parseDataLocal(etapa.data_fim);
        
        dias.forEach(dia => {
          if (dia.data >= etapaInicio && dia.data <= etapaFim) {
            dia.etapas.push({
              ...etapa,
              cliente: obra.nome_cliente,
              cidade: obra.cidade,
              obra_id: obra.id
            });
          }
        });
      });
    });
    
    // Agrupar em semanas
    const semanas = [];
    for (let i = 0; i < 6; i++) {
      semanas.push(dias.slice(i * 7, (i + 1) * 7));
    }
    
    return {
      semanas,
      mesAno: mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      mesAtual
    };
  }, [obras, mesOffset, filtroTipo]);
  
  // Calcular dados para visualização ANUAL
  const anualData = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear() + anoOffset;
    
    const meses = [];
    for (let m = 0; m < 12; m++) {
      const primeiroDia = new Date(anoAtual, m, 1);
      const ultimoDia = new Date(anoAtual, m + 1, 0);
      
      const etapasDoMes = [];
      obras.forEach(obra => {
        if (!obra.etapas) return;
        obra.etapas.forEach(etapa => {
          if (filtroTipo !== 'todos' && etapa.tipo !== filtroTipo) return;
          
          const etapaInicio = parseDataLocal(etapa.data_inicio);
          const etapaFim = parseDataLocal(etapa.data_fim);
          
          // Se a etapa intersecta o mês
          if (etapaInicio <= ultimoDia && etapaFim >= primeiroDia) {
            etapasDoMes.push({
              ...etapa,
              cliente: obra.nome_cliente,
              obra_id: obra.id
            });
          }
        });
      });
      
      meses.push({
        mes: m,
        nome: primeiroDia.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
        nomeLongo: primeiroDia.toLocaleDateString('pt-BR', { month: 'long' }),
        etapas: etapasDoMes,
        isAtual: m === hoje.getMonth() && anoOffset === 0
      });
    }
    
    return { meses, ano: anoAtual };
  }, [obras, anoOffset, filtroTipo]);
  
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
  
  // =====================================================
  // FUNÇÕES DE EXPORTAÇÃO
  // =====================================================
  const exportarExcel = () => {
    const dados = todasEtapas.map(e => ({
      'Cliente': e.cliente,
      'Cidade': e.cidade || '',
      'Etapa': e.nome,
      'Tipo': e.tipo,
      'Data Início': formatarDataBR(e.data_inicio),
      'Data Fim': formatarDataBR(e.data_fim),
      'Progresso (%)': e.progresso || 0,
      'Status': e.status || 'pendente'
    }));
    
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Etapas');
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `planejamento_etapas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  const exportarPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    
    // Título
    doc.setFontSize(16);
    doc.setTextColor(51, 51, 51);
    doc.text('Relatório de Planejamento - Etapas', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);
    doc.text(`Período: ${getPeriodoLabel()}`, 14, 27);
    
    // Tabela
    const dados = todasEtapas.map(e => [
      e.cliente?.substring(0, 25) || '',
      e.nome?.substring(0, 30) || '',
      e.tipo || '',
      formatarDataBR(e.data_inicio),
      formatarDataBR(e.data_fim),
      `${e.progresso || 0}%`,
      e.status || 'pendente'
    ]);
    
    autoTable(doc, {
      startY: 32,
      head: [['Cliente', 'Etapa', 'Tipo', 'Início', 'Fim', 'Progresso', 'Status']],
      body: dados,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 25 }
      }
    });
    
    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`planejamento_etapas_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
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
          {/* Botões de Exportação */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportarExcel}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm flex items-center gap-1.5"
              title="Exportar para Excel"
            >
              <FaFileExcel className="text-green-400" size={14} />
              Excel
            </button>
            <button
              onClick={exportarPDF}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm flex items-center gap-1.5"
              title="Exportar para PDF"
            >
              <FaFilePdf className="text-red-400" size={14} />
              PDF
            </button>
          </div>
          
          {/* Toggle Visualizações */}
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
              title="Visualização semanal"
            >
              <FaCalendarAlt size={12} />
              Semana
            </button>
            <button
              onClick={() => setModoVisualizacao('mensal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                modoVisualizacao === 'mensal' 
                  ? 'bg-sky-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização mensal"
            >
              <FaCalendarAlt size={12} />
              Mês
            </button>
            <button
              onClick={() => setModoVisualizacao('anual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                modoVisualizacao === 'anual' 
                  ? 'bg-sky-500 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização anual"
            >
              <FaCalendarAlt size={12} />
              Ano
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
      
      {/* Navegação da Agenda SEMANAL */}
      {modoVisualizacao === 'agenda' && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <button
            onClick={() => setSemanaOffset(prev => prev - 1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronLeft /> Anterior
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
              Próxima <FaChevronRight />
            </button>
          </div>
        </div>
      )}
      
      {/* Navegação MENSAL */}
      {modoVisualizacao === 'mensal' && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <button
            onClick={() => setMesOffset(prev => prev - 1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronLeft /> Mês Anterior
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-white capitalize">{mensalData.mesAno}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMesOffset(0)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Mês Atual
            </button>
            <button
              onClick={() => setMesOffset(prev => prev + 1)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Próximo Mês <FaChevronRight />
            </button>
          </div>
        </div>
      )}
      
      {/* Navegação ANUAL */}
      {modoVisualizacao === 'anual' && (
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <button
            onClick={() => setAnoOffset(prev => prev - 1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronLeft /> Ano Anterior
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-white">{anualData.ano}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnoOffset(0)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Ano Atual
            </button>
            <button
              onClick={() => setAnoOffset(prev => prev + 1)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              Próximo Ano <FaChevronRight />
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
      ) : modoVisualizacao === 'mensal' ? (
        /* ===== VISUALIZAÇÃO MENSAL ===== */
        <div className="execucao-card p-0 overflow-hidden">
          {/* Header com dias da semana */}
          <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-800/70">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((dia, i) => (
              <div key={i} className="p-2 text-center text-xs font-semibold text-slate-400 border-r border-slate-700 last:border-r-0">
                {dia}
              </div>
            ))}
          </div>
          
          {/* Grid do mês */}
          {mensalData.semanas.map((semana, semanaIndex) => (
            <div key={semanaIndex} className="grid grid-cols-7 border-b border-slate-700 last:border-b-0">
              {semana.map((dia, diaIndex) => (
                <div 
                  key={diaIndex}
                  className={`min-h-[100px] p-1 border-r border-slate-700 last:border-r-0 ${
                    !dia.isMesAtual ? 'bg-slate-900/50' : 
                    dia.isHoje ? 'bg-sky-500/10' : 'bg-slate-800/30'
                  }`}
                >
                  {/* Número do dia */}
                  <div className={`text-right text-sm font-medium mb-1 ${
                    !dia.isMesAtual ? 'text-slate-600' :
                    dia.isHoje ? 'text-sky-400' : 'text-slate-400'
                  }`}>
                    {dia.isHoje ? (
                      <span className="bg-sky-500 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                        {dia.diaNumero}
                      </span>
                    ) : dia.diaNumero}
                  </div>
                  
                  {/* Etapas do dia */}
                  <div className="space-y-0.5 overflow-y-auto max-h-[80px]">
                    {dia.etapas.slice(0, 3).map((etapa, i) => (
                      <div
                        key={`${etapa.id}-${i}`}
                        onClick={() => onAddAtividade(etapa)}
                        className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${getTipoCorAgenda(etapa.tipo)}`}
                        title={`${etapa.cliente}\n${etapa.nome}`}
                      >
                        {etapa.cliente?.substring(0, 10)}
                      </div>
                    ))}
                    {dia.etapas.length > 3 && (
                      <div className="text-[9px] text-slate-500 text-center">
                        +{dia.etapas.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          
          {/* Legenda */}
          <div className="p-3 border-t border-slate-700 flex flex-wrap gap-4 text-xs">
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
      ) : modoVisualizacao === 'anual' ? (
        /* ===== VISUALIZAÇÃO ANUAL ===== */
        <div className="execucao-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {anualData.meses.map((mes) => (
              <div 
                key={mes.mes}
                className={`rounded-lg border p-3 ${
                  mes.isAtual 
                    ? 'border-sky-500/50 bg-sky-500/10' 
                    : 'border-slate-700 bg-slate-800/30'
                }`}
              >
                {/* Nome do mês */}
                <div className={`text-sm font-bold mb-2 ${mes.isAtual ? 'text-sky-400' : 'text-white'}`}>
                  {mes.nomeLongo.toUpperCase()}
                </div>
                
                {/* Contagem de etapas */}
                <div className="text-2xl font-bold text-white mb-2">
                  {mes.etapas.length}
                  <span className="text-xs font-normal text-slate-400 ml-1">etapas</span>
                </div>
                
                {/* Breakdown por tipo */}
                <div className="flex flex-wrap gap-1">
                  {mes.etapas.filter(e => e.tipo === 'eletrica').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                      ⚡ {mes.etapas.filter(e => e.tipo === 'eletrica').length}
                    </span>
                  )}
                  {mes.etapas.filter(e => e.tipo === 'civil').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                      🏗️ {mes.etapas.filter(e => e.tipo === 'civil').length}
                    </span>
                  )}
                  {mes.etapas.filter(e => e.tipo === 'galpao').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      🏭 {mes.etapas.filter(e => e.tipo === 'galpao').length}
                    </span>
                  )}
                  {mes.etapas.filter(e => e.tipo === 'geral').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      📋 {mes.etapas.filter(e => e.tipo === 'geral').length}
                    </span>
                  )}
                  {mes.etapas.filter(e => e.tipo === 'administrativo').length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">
                      📊 {mes.etapas.filter(e => e.tipo === 'administrativo').length}
                    </span>
                  )}
                </div>
                
                {/* Lista de clientes únicos */}
                {mes.etapas.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <div className="text-[10px] text-slate-500 mb-1">Clientes:</div>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(mes.etapas.map(e => e.cliente))].slice(0, 3).map((cliente, i) => (
                        <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300 truncate max-w-[80px]">
                          {cliente}
                        </span>
                      ))}
                      {[...new Set(mes.etapas.map(e => e.cliente))].length > 3 && (
                        <span className="text-[9px] text-slate-500">
                          +{[...new Set(mes.etapas.map(e => e.cliente))].length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Resumo anual */}
          <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-slate-400 text-sm">Total {anualData.ano}:</div>
              <div className="text-white font-bold">
                {anualData.meses.reduce((acc, m) => acc + m.etapas.length, 0)} etapas
              </div>
              <div className="text-slate-400">em</div>
              <div className="text-white font-bold">
                {new Set(anualData.meses.flatMap(m => m.etapas.map(e => e.cliente))).size} clientes
              </div>
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
  const [showTemplateModal, setShowTemplateModal] = useState(false); // Modal de gerenciamento de templates
  const [obraSelecionada, setObraSelecionada] = useState(null);
  const [etapaSelecionada, setEtapaSelecionada] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('obras'); // obras, resumo, templates
  const [tecnicos, setTecnicos] = useState([]);
  const [obraExpandida, setObraExpandida] = useState(null);

  // Estados para templates do banco
  const [templates, setTemplates] = useState([]);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [formTemplate, setFormTemplate] = useState({
    nome: '',
    descricao: '',
    tipo_obra: 'eletrica',
    icone: 'FaBolt',
    cor: '#eab308',
    itens: []
  });

  // Estados para busca de apontamentos no modal de obra
  const [apontamentosDisponiveis, setApontamentosDisponiveis] = useState([]);
  const [buscaApontamento, setBuscaApontamento] = useState('');
  const [apontamentosFiltrados, setApontamentosFiltrados] = useState([]);

  // Form states
  const [formObra, setFormObra] = useState({
    nome_cliente: '',
    endereco: '',
    cidade: '',
    data_inicio_prevista: '',
    data_fim_prevista: '',
    tipo_obra: 'misto',
    prioridade: 'media',
    responsavel_id: '',
    observacoes: '',
    contato_cliente: '',
    apontamento_id: '',
    arquivos_pdf: []
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
    carregarTemplates();
  }, [filtroPeriodo, filtroStatus]);

  // Carregar templates do banco
  const carregarTemplates = async () => {
    const result = await execucaoService.buscarTemplates(false); // false = incluir inativos
    if (result.success) {
      setTemplates(result.data);
    }
  };

  // Carregar apontamentos quando o modal de obra abrir
  useEffect(() => {
    if (showObraModal) {
      carregarApontamentosDisponiveis();
    }
  }, [showObraModal]);

  // Filtrar apontamentos quando digitar na busca
  useEffect(() => {
    if (buscaApontamento.trim() === '') {
      setApontamentosFiltrados(apontamentosDisponiveis);
    } else {
      const termo = buscaApontamento.toLowerCase();
      const filtrados = apontamentosDisponiveis.filter(a => 
        a.nome_cliente?.toLowerCase().includes(termo)
      );
      setApontamentosFiltrados(filtrados);
    }
  }, [buscaApontamento, apontamentosDisponiveis]);

  const carregarApontamentosDisponiveis = async () => {
    const result = await execucaoService.buscarApontamentosParaObra();
    if (result.success) {
      setApontamentosDisponiveis(result.data);
      setApontamentosFiltrados(result.data);
    }
  };

  const handleSelecionarApontamento = (apontamento) => {
    if (!apontamento) {
      // Limpar os campos se nenhum apontamento selecionado
      return;
    }

    // Montar endereço completo
    const partes = [];
    if (apontamento.logradouro) partes.push(apontamento.logradouro);
    if (apontamento.numero) partes.push(apontamento.numero);
    if (apontamento.bairro) partes.push(apontamento.bairro);
    const endereco = partes.join(', ');

    // Cidade pode vir de cidade_atendimento, cidade_outras ou municipio
    const cidade = apontamento.cidade_atendimento === 'OUTRAS' 
      ? apontamento.cidade_outras 
      : apontamento.cidade_atendimento || apontamento.municipio || '';

    setFormObra(prev => ({
      ...prev,
      nome_cliente: apontamento.nome_cliente || '',
      endereco: endereco,
      cidade: cidade,
      data_inicio_prevista: apontamento.cronograma_data_inicio || '',
      data_fim_prevista: apontamento.cronograma_data_termino || '',
      contato_cliente: apontamento.contato_cliente || '',
      apontamento_id: apontamento.id || ''
    }));
  };

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
        
        // Se um template foi selecionado, criar etapas automaticamente
        if (result.success && formObra.template_id) {
          // Buscar template do banco
          const templateSelecionado = templates.find(t => t.id === formObra.template_id);
          if (templateSelecionado && templateSelecionado.itens) {
            const dataInicio = new Date(formObra.data_inicio_prevista);
            let dataAtual = new Date(dataInicio);
            
            for (let i = 0; i < templateSelecionado.itens.length; i++) {
              const etapaTemplate = templateSelecionado.itens[i];
              const dataInicioEtapa = new Date(dataAtual);
              const dataFimEtapa = new Date(dataAtual);
              dataFimEtapa.setDate(dataFimEtapa.getDate() + (etapaTemplate.duracao_dias || 3));
              
              await execucaoService.criarEtapa({
                obra_id: result.data.id,
                nome: etapaTemplate.nome,
                descricao: etapaTemplate.descricao,
                tipo: etapaTemplate.tipo,
                data_inicio: dataInicioEtapa.toISOString().split('T')[0],
                data_fim: dataFimEtapa.toISOString().split('T')[0],
                ordem: i + 1,
                status: 'pendente',
                progresso: 0
              });
              
              // Próxima etapa começa após o fim da atual
              dataAtual = new Date(dataFimEtapa);
              dataAtual.setDate(dataAtual.getDate() + 1);
            }
          }
        }
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
      data_inicio_prevista: obra.data_inicio_prevista || '',
      data_fim_prevista: obra.data_fim_prevista || '',
      tipo_obra: obra.tipo_obra || 'misto',
      prioridade: obra.prioridade || 'media',
      responsavel_id: obra.responsavel_id || '',
      observacoes: obra.observacoes || '',
      contato_cliente: obra.contato_cliente || '',
      apontamento_id: obra.apontamento_id || '',
      arquivos_pdf: []
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
    setBuscaApontamento('');
    setFormObra({
      nome_cliente: '',
      endereco: '',
      cidade: '',
      data_inicio_prevista: '',
      data_fim_prevista: '',
      tipo_obra: 'misto',
      prioridade: 'media',
      responsavel_id: '',
      observacoes: '',
      contato_cliente: '',
      apontamento_id: '',
      arquivos_pdf: [],
      template_id: ''
    });
  };

  // Handlers de Templates
  const handleNovoTemplate = () => {
    setTemplateSelecionado(null);
    setFormTemplate({
      nome: '',
      descricao: '',
      tipo_obra: 'eletrica',
      icone: 'FaBolt',
      cor: '#eab308',
      itens: []
    });
    setShowTemplateModal(true);
  };

  const handleEditarTemplate = (template) => {
    setTemplateSelecionado(template);
    setFormTemplate({
      nome: template.nome || '',
      descricao: template.descricao || '',
      tipo_obra: template.tipo_obra || 'eletrica',
      icone: template.icone || 'FaBolt',
      cor: template.cor || '#eab308',
      ativo: template.ativo !== false,
      itens: template.itens || []
    });
    setShowTemplateModal(true);
  };

  const handleSalvarTemplate = async (e) => {
    e?.preventDefault();
    try {
      let result;
      if (templateSelecionado) {
        result = await execucaoService.atualizarTemplate(templateSelecionado.id, formTemplate);
      } else {
        result = await execucaoService.criarTemplate(formTemplate);
      }

      if (result.success) {
        setShowTemplateModal(false);
        setTemplateSelecionado(null);
        carregarTemplates();
      } else {
        alert('Erro ao salvar template: ' + (result.message || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar template: ' + error.message);
    }
  };

  const handleExcluirTemplate = async (templateId) => {
    if (confirm('Deseja realmente excluir este template?')) {
      const result = await execucaoService.excluirTemplate(templateId);
      if (result.success) {
        carregarTemplates();
      }
    }
  };

  const handleDuplicarTemplate = async (templateId, nome) => {
    const result = await execucaoService.duplicarTemplate(templateId, nome + ' (Cópia)');
    if (result.success) {
      carregarTemplates();
    }
  };

  const handleAdicionarItemTemplate = () => {
    setFormTemplate(prev => ({
      ...prev,
      itens: [
        ...prev.itens,
        { nome: '', descricao: '', tipo: 'geral', duracao_dias: 3, ordem: prev.itens.length + 1 }
      ]
    }));
  };

  const handleRemoverItemTemplate = (index) => {
    setFormTemplate(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const handleAtualizarItemTemplate = (index, campo, valor) => {
    setFormTemplate(prev => ({
      ...prev,
      itens: prev.itens.map((item, i) => 
        i === index ? { ...item, [campo]: valor } : item
      )
    }));
  };

  // Handlers de Etapa
  const handleAbrirEtapaModal = (obra, etapa = null) => {
    setObraSelecionada(obra);
    if (etapa) {
      setEtapaSelecionada(etapa);
      // Buscar nome da etapa pai se existir
      const etapaPai = etapa.etapa_pai_id 
        ? obra.etapas?.find(e => e.id === etapa.etapa_pai_id) 
        : null;
      setFormEtapa({
        nome: etapa.nome || '',
        descricao: etapa.descricao || '',
        tipo: etapa.tipo || 'geral',
        data_inicio: etapa.data_inicio || '',
        data_fim: etapa.data_fim || '',
        responsavel_id: etapa.responsavel_id || '',
        ordem: etapa.ordem || 0,
        progresso: etapa.progresso || 0,
        status: etapa.status || 'pendente',
        etapa_pai_id: etapa.etapa_pai_id || null,
        etapa_pai_nome: etapaPai?.nome || null
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
        ordem: (obra.etapas?.length || 0) + 1,
        etapa_pai_id: null
      });
    }
    setShowEtapaModal(true);
  };

  // Handler para abrir modal de sub-etapa
  const handleAbrirSubEtapaModal = (obra, etapaPai) => {
    setObraSelecionada(obra);
    setEtapaSelecionada(null);
    
    // Contar sub-etapas existentes para determinar ordem
    const subEtapasExistentes = obra.etapas?.filter(e => e.etapa_pai_id === etapaPai.id) || [];
    
    setFormEtapa({
      nome: '',
      descricao: '',
      tipo: etapaPai.tipo || 'geral', // Herda o tipo da etapa pai
      data_inicio: etapaPai.data_inicio || '',
      data_fim: etapaPai.data_fim || '',
      responsavel_id: etapaPai.responsavel_id || '',
      ordem: subEtapasExistentes.length + 1,
      etapa_pai_id: etapaPai.id,
      etapa_pai_nome: etapaPai.nome // Para exibição no modal
    });
    setShowEtapaModal(true);
  };

  const handleSalvarEtapa = async (e) => {
    e.preventDefault();
    try {
      // Remover campos auxiliares que não existem no banco
      const { etapa_pai_nome, ...dadosParaSalvar } = formEtapa;
      
      let result;
      if (etapaSelecionada) {
        result = await execucaoService.atualizarEtapa(etapaSelecionada.id, dadosParaSalvar);
        
        // Se responsável foi definido/atualizado, atualizar ou criar atividade na agenda
        if (result.success && formEtapa.responsavel_id) {
          await criarOuAtualizarAtividadeAutomatica(result.data || { id: etapaSelecionada.id, ...dadosParaSalvar });
        }
      } else {
        result = await execucaoService.criarEtapa({
          ...dadosParaSalvar,
          obra_id: obraSelecionada.id
        });
        
        // Se responsável foi definido, criar atividade automaticamente na agenda
        if (result.success && formEtapa.responsavel_id) {
          await criarOuAtualizarAtividadeAutomatica(result.data);
        }
      }

      if (result.success) {
        setShowEtapaModal(false);
        carregarDados();
      }
    } catch (error) {
      console.error('Erro ao salvar etapa:', error);
    }
  };

  // Função para criar ou atualizar atividade automaticamente quando etapa tem responsável
  // Para etapas do tipo 'estoque', cria APENAS pedido de material (NÃO cria atividade em agenda)
  const criarOuAtualizarAtividadeAutomatica = async (etapa) => {
    try {
      // Buscar dados da obra para incluir informações do cliente
      const obra = obras.find(o => o.id === (etapa.obra_id || obraSelecionada?.id));
      
      // Se for etapa de estoque/compras, criar APENAS pedido de material (sem atividade na agenda)
      if (etapa.tipo === 'estoque') {
        // Criar pedido de material vinculado à obra e etapa
        // Este pedido aparecerá na Visão Geral e no Pedido de Material como card
        const dadosPedido = {
          descricao: `Lista de Materiais - ${obra?.nome_cliente || 'N/A'}`,
          itens: [],
          urgencia: 'normal',
          status: 'concluido',
          obra_id: obra?.id,
          etapa_id: etapa.id,
          cliente_nome: obra?.nome_cliente || '',
          endereco_obra: obra?.endereco || '',
          data_lista_pronta: etapa.data_fim, // Data limite para montar a lista
          observacoes: `📦 Lista de materiais para a obra.\n\n🏢 Cliente: ${obra?.nome_cliente || 'N/A'}\n📍 Endereço: ${obra?.endereco || 'N/A'}\n📅 Data limite para lista pronta: ${etapa.data_fim}\n\n⚠️ Após preencher os itens e definir a data de disponibilidade, uma etapa "Chegada dos Materiais" será criada automaticamente no cronograma.`
        };

        await execucaoService.criarPedidoMaterial(dadosPedido, usuario?.id);
        console.log('📦 Pedido de material criado automaticamente (aparecerá na Visão Geral e Pedido de Material)');
        return;
      }
      
      // Para outros tipos, criar atividade na agenda correspondente
      const dadosAtividade = {
        titulo: etapa.nome,
        descricao: etapa.descricao || `Etapa da obra: ${obra?.nome_cliente || 'N/A'}`,
        data_programada: etapa.data_inicio,
        hora_inicio: '08:00',
        hora_fim: '17:00',
        prioridade: 'normal',
        tecnico_responsavel_id: etapa.responsavel_id,
        cliente_nome: obra?.nome_cliente || '',
        endereco: obra?.endereco || '',
        observacoes: `Etapa automática - Obra: ${obra?.nome_cliente || 'N/A'}\nPeríodo: ${etapa.data_inicio} a ${etapa.data_fim}`
      };

      await execucaoService.criarAtividadeDeEtapa(
        etapa.id,
        dadosAtividade,
        usuario?.id
      );
      
      console.log('✅ Atividade criada automaticamente na agenda');
    } catch (error) {
      console.error('Erro ao criar atividade/pedido automático:', error);
      // Não interrompe o fluxo se falhar a criação
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
      {/* Alertas de Etapas Atrasadas */}
      <AlertasEtapasAtrasadas 
        obras={obras} 
        onVerEtapa={(etapa) => {
          const obra = obras.find(o => o.id === etapa.obra_id);
          if (obra) {
            handleAbrirEtapaModal(obra, etapa);
          }
        }}
      />

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
        <button
          onClick={() => setAbaAtiva('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            abaAtiva === 'templates' 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FaMagic size={14} />
          Templates
          <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
            {templates.length}
          </span>
        </button>
      </div>

      {/* Aba de Resumo de Etapas */}
      {abaAtiva === 'resumo' && (
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
      )}

      {/* Aba de Templates */}
      {abaAtiva === 'templates' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FaMagic className="text-purple-400" />
                Templates de Etapas
              </h3>
              <p className="text-sm text-slate-400">
                Gerencie modelos de etapas pré-definidos para usar ao criar novas obras
              </p>
            </div>
            <button
              onClick={handleNovoTemplate}
              className="execucao-btn-primary flex items-center gap-2"
            >
              <FaPlus size={12} />
              Novo Template
            </button>
          </div>

          {/* Lista de Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => {
              const getIcone = (icone) => {
                switch(icone) {
                  case 'FaBolt': return <FaBolt size={24} />;
                  case 'FaHardHat': return <FaHardHat size={24} />;
                  case 'FaWarehouse': return <FaWarehouse size={24} />;
                  case 'FaWrench': return <FaWrench size={24} />;
                  default: return <FaTasks size={24} />;
                }
              };
              
              return (
                <div 
                  key={template.id}
                  className={`p-4 rounded-xl border transition-all ${
                    template.ativo 
                      ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-900/50 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${template.cor}20`, color: template.cor }}
                    >
                      {getIcone(template.icone)}
                    </div>
                    <div className="flex items-center gap-1">
                      {!template.ativo && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                      <button
                        onClick={() => handleEditarTemplate(template)}
                        className="p-1.5 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                        title="Editar template"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => handleDuplicarTemplate(template.id, template.nome)}
                        className="p-1.5 rounded text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                        title="Duplicar template"
                      >
                        <FaCopy size={12} />
                      </button>
                      <button
                        onClick={() => handleExcluirTemplate(template.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Excluir template"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <h4 className="font-semibold text-white mb-1">{template.nome}</h4>
                  {template.descricao && (
                    <p className="text-xs text-slate-400 mb-3">{template.descricao}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {template.tipo_obra || 'Geral'}
                    </span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {template.itens?.length || 0} etapas
                    </span>
                  </div>
                  
                  {/* Lista de etapas do template */}
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {template.itens?.slice(0, 5).map((etapa, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between text-xs p-1.5 bg-slate-900/50 rounded"
                      >
                        <span className="text-slate-300 truncate">{idx + 1}. {etapa.nome}</span>
                        <span className="text-slate-500 shrink-0 ml-2">{etapa.duracao_dias}d</span>
                      </div>
                    ))}
                    {template.itens?.length > 5 && (
                      <div className="text-center text-[10px] text-slate-500 py-1">
                        +{template.itens.length - 5} mais etapas...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FaMagic size={48} className="mx-auto mb-4 opacity-30" />
              <p>Nenhum template cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo Template" para criar o primeiro</p>
            </div>
          )}
        </div>
      )}

      {/* Aba de Obras */}
      {abaAtiva === 'obras' && (
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
                      onAddSubEtapa={(etapaPai) => handleAbrirSubEtapaModal(obra, etapaPai)}
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

      {/* Modal de Template */}
      {showTemplateModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaMagic className="text-purple-400" />
                {templateSelecionado ? 'Editar Template' : 'Novo Template'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowTemplateModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSalvarTemplate}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  {/* Dados básicos do template */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Nome do Template *</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formTemplate.nome}
                        onChange={(e) => setFormTemplate(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Template Elétrica Industrial"
                        required
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Tipo de Obra</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        value={formTemplate.tipo_obra}
                        onChange={(e) => setFormTemplate(prev => ({ ...prev, tipo_obra: e.target.value }))}
                        placeholder="Ex: Elétrica, Civil, Galpão..."
                      />
                    </div>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Descrição</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="2"
                      value={formTemplate.descricao}
                      onChange={(e) => setFormTemplate(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descreva quando usar este template..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Ícone</label>
                      <select
                        className="execucao-form-select"
                        value={formTemplate.icone}
                        onChange={(e) => setFormTemplate(prev => ({ ...prev, icone: e.target.value }))}
                      >
                        <option value="FaTasks">📋 Tarefas</option>
                        <option value="FaBolt">⚡ Elétrica</option>
                        <option value="FaHardHat">👷 Civil</option>
                        <option value="FaWarehouse">🏭 Galpão</option>
                        <option value="FaWrench">🔧 Manutenção</option>
                      </select>
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Cor</label>
                      <input
                        type="color"
                        className="execucao-form-input h-10 p-1 cursor-pointer"
                        value={formTemplate.cor}
                        onChange={(e) => setFormTemplate(prev => ({ ...prev, cor: e.target.value }))}
                      />
                    </div>
                    <div className="execucao-form-group">
                      <label className="execucao-form-label flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formTemplate.ativo}
                          onChange={(e) => setFormTemplate(prev => ({ ...prev, ativo: e.target.checked }))}
                          className="w-4 h-4"
                        />
                        Template Ativo
                      </label>
                    </div>
                  </div>

                  {/* Etapas do Template */}
                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-purple-400">
                        Etapas do Template ({formTemplate.itens?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={handleAdicionarItemTemplate}
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
                      >
                        <FaPlus size={10} />
                        Adicionar Etapa
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {formTemplate.itens?.map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700"
                        >
                          <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
                          <input
                            type="text"
                            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none"
                            value={item.nome}
                            onChange={(e) => handleAtualizarItemTemplate(index, 'nome', e.target.value)}
                            placeholder="Nome da etapa"
                          />
                          <input
                            type="number"
                            className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-center"
                            value={item.duracao_dias}
                            onChange={(e) => handleAtualizarItemTemplate(index, 'duracao_dias', parseInt(e.target.value) || 1)}
                            min="1"
                            title="Duração em dias"
                          />
                          <span className="text-xs text-slate-500">dias</span>
                          <select
                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                            value={item.tipo || 'etapa'}
                            onChange={(e) => handleAtualizarItemTemplate(index, 'tipo', e.target.value)}
                            title="Tipo"
                          >
                            <option value="etapa">Etapa</option>
                            <option value="marco">Marco</option>
                            <option value="fase">Fase</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoverItemTemplate(index)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                            title="Remover etapa"
                          >
                            <FaTrash size={10} />
                          </button>
                        </div>
                      ))}
                      {(!formTemplate.itens || formTemplate.itens.length === 0) && (
                        <div className="text-center py-4 text-slate-500 text-sm">
                          Nenhuma etapa adicionada. Clique em "Adicionar Etapa" para começar.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn bg-purple-600 hover:bg-purple-700">
                  {templateSelecionado ? 'Salvar Alterações' : 'Criar Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                  {/* Seção de busca de apontamento - só mostra para nova obra */}
                  {!obraSelecionada && (
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                      <label className="text-sm font-medium text-sky-400 flex items-center gap-2">
                        <FaSearch size={12} />
                        Buscar Cliente (Contrato/Venda)
                      </label>
                      
                      {/* Campo de busca */}
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={12} />
                        <input
                          type="text"
                          className="execucao-form-input !pl-9"
                          value={buscaApontamento}
                          onChange={(e) => setBuscaApontamento(e.target.value)}
                          placeholder="Digite o nome do cliente para buscar..."
                        />
                      </div>

                      {/* Combobox com todos os clientes */}
                      <div className="execucao-form-group !mb-0">
                        <label className="execucao-form-label">Ou selecione da lista</label>
                        <select
                          className="execucao-form-select"
                          value={formObra.apontamento_id}
                          onChange={(e) => {
                            const apontamento = apontamentosDisponiveis.find(a => a.id === e.target.value);
                            handleSelecionarApontamento(apontamento);
                          }}
                        >
                          <option value="">Selecione um cliente...</option>
                          {apontamentosFiltrados.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.nome_cliente} {a.cidade_atendimento ? `- ${a.cidade_atendimento}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {apontamentosDisponiveis.length === 0 && (
                        <p className="text-xs text-slate-500">Nenhum cliente com fase CONTRATO/VENDA encontrado.</p>
                      )}
                    </div>
                  )}

                  {/* Seção de Templates - só mostra para nova obra */}
                  {!obraSelecionada && templates.length > 0 && (
                    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-sky-500/10 rounded-lg border border-purple-500/30 space-y-3">
                      <label className="text-sm font-medium text-purple-400 flex items-center gap-2">
                        <FaMagic size={12} />
                        Usar Template de Etapas
                      </label>
                      <p className="text-xs text-slate-400">
                        Ao salvar a obra, as etapas do template selecionado serão criadas automaticamente.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {templates.filter(t => t.ativo).map(template => {
                          const isSelected = formObra.template_id === template.id;
                          const getIcone = (icone) => {
                            switch(icone) {
                              case 'FaBolt': return <FaBolt size={16} />;
                              case 'FaHardHat': return <FaHardHat size={16} />;
                              case 'FaWarehouse': return <FaWarehouse size={16} />;
                              case 'FaWrench': return <FaWrench size={16} />;
                              default: return <FaTasks size={16} />;
                            }
                          };
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => setFormObra(prev => ({ 
                                ...prev, 
                                template_id: prev.template_id === template.id ? '' : template.id 
                              }))}
                              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                                isSelected
                                  ? `bg-opacity-20 border-opacity-50`
                                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                              }`}
                              style={isSelected ? { 
                                backgroundColor: `${template.cor}20`, 
                                borderColor: `${template.cor}80`,
                                color: template.cor
                              } : {}}
                            >
                              {getIcone(template.icone)}
                              <span className="text-xs font-medium">{template.nome?.split(' ')[0] || 'Template'}</span>
                              <span className="text-[10px] opacity-60">{template.itens?.length || 0} etapas</span>
                            </button>
                          );
                        })}
                      </div>
                      {formObra.template_id && (
                        <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs text-slate-300">
                          <strong className="text-white">Etapas que serão criadas:</strong>
                          <ul className="mt-1 list-disc list-inside space-y-0.5">
                            {templates.find(t => t.id === formObra.template_id)?.itens?.map((etapa, i) => (
                              <li key={i}>{etapa.nome} <span className="text-slate-500">({etapa.duracao_dias} dias)</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Contato do Cliente */}
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Contato do Cliente</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      value={formObra.contato_cliente}
                      onChange={(e) => setFormObra(prev => ({ ...prev, contato_cliente: e.target.value }))}
                      placeholder="Telefone/WhatsApp do cliente"
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

                  {/* Observações */}
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Observações</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="2"
                      value={formObra.observacoes}
                      onChange={(e) => setFormObra(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações gerais"
                    />
                  </div>

                  {/* Upload de Arquivos PDF */}
                  <div className="execucao-form-group">
                    <label className="execucao-form-label flex items-center gap-2">
                      <FaFilePdf className="text-red-400" />
                      Anexar Arquivos (PDF)
                    </label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 hover:border-sky-500 transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        id="upload-pdf-obra"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setFormObra(prev => ({ 
                            ...prev, 
                            arquivos_pdf: [...(prev.arquivos_pdf || []), ...files] 
                          }));
                        }}
                      />
                      <label 
                        htmlFor="upload-pdf-obra" 
                        className="flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <FaUpload className="text-slate-400" size={24} />
                        <span className="text-sm text-slate-400">Clique para selecionar arquivos PDF</span>
                      </label>
                    </div>
                    {/* Lista de arquivos selecionados */}
                    {formObra.arquivos_pdf && formObra.arquivos_pdf.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {formObra.arquivos_pdf.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                            <span className="text-sm text-slate-300 flex items-center gap-2">
                              <FaFilePdf className="text-red-400" size={12} />
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormObra(prev => ({
                                  ...prev,
                                  arquivos_pdf: prev.arquivos_pdf.filter((_, i) => i !== index)
                                }));
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <FaTimes size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                <FaProjectDiagram className={formEtapa.etapa_pai_id ? "text-purple-400" : "text-green-400"} />
                {etapaSelecionada 
                  ? (etapaSelecionada.etapa_pai_id ? 'Editar Sub-etapa' : 'Editar Etapa')
                  : (formEtapa.etapa_pai_id ? 'Nova Sub-etapa' : 'Nova Etapa')
                }
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowEtapaModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSalvarEtapa}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  {/* Indicador de etapa pai (quando é sub-etapa) */}
                  {formEtapa.etapa_pai_id && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-purple-400 text-sm">
                        <FaProjectDiagram size={12} />
                        <span className="font-medium">Sub-etapa de:</span>
                        <span className="text-white">{formEtapa.etapa_pai_nome || 'Etapa pai'}</span>
                      </div>
                    </div>
                  )}

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">
                      {formEtapa.etapa_pai_id ? 'Nome da Sub-etapa *' : 'Nome da Etapa *'}
                    </label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      value={formEtapa.nome}
                      onChange={(e) => setFormEtapa(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder={formEtapa.etapa_pai_id ? "Ex: Passagem de cabos - Bloco A" : "Ex: Instalação de quadros elétricos"}
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
                        <option value="gestao">🎯 Gestão/Liderança</option>
                        <option value="eletrica">⚡ Elétrica</option>
                        <option value="civil">🏗️ Civil</option>
                        <option value="galpao">🏭 Galpão</option>
                        <option value="estoque">📦 Estoque/Compras</option>
                        <option value="administrativo">📋 Administrativo</option>
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
                <button type="submit" className={`execucao-btn ${formEtapa.etapa_pai_id ? 'bg-purple-600 hover:bg-purple-700' : 'execucao-btn-primary'}`}>
                  {etapaSelecionada 
                    ? 'Salvar' 
                    : (formEtapa.etapa_pai_id ? 'Adicionar Sub-etapa' : 'Adicionar Etapa')
                  }
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
