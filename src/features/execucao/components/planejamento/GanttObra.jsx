import React, { useMemo, useState } from 'react';
import {
  FaCalendarPlus,
  FaChevronDown,
  FaChevronRight,
  FaChevronUp,
  FaEdit,
  FaPlus,
  FaProjectDiagram,
  FaSearchMinus,
  FaSearchPlus,
  FaTrash
} from 'react-icons/fa';
import { formatarDataBR, parseDataLocal } from '../../utils/datas';
import { IconeTipoEtapa } from './icones';
import { etapaAtrasada, inicioDeHoje } from './utils';

const MS_DIA = 1000 * 60 * 60 * 24;
const ACOES_VISIVEIS = 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex gap-1';

const getStatusColor = (status, progresso) => {
  if (progresso >= 100) return 'bg-emerald-500';
  if (status === 'atrasada') return 'bg-red-500';
  if (status === 'em_andamento') return 'bg-sky-500';
  return 'bg-indigo-400';
};

const GanttObra = ({ obra, onEditEtapa, onDeleteEtapa, onAddAtividade, onAddSubEtapa }) => {
  const [expanded, setExpanded] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 = mais zoom out, 2 = mais zoom in
  const [subEtapasExpandidas, setSubEtapasExpandidas] = useState(new Set()); // IDs das etapas pai com sub-etapas visíveis

  // Organizar etapas em hierarquia (pais e filhos)
  const etapasOrganizadas = useMemo(() => {
    const etapas = obra.etapas || [];
    const etapasPai = etapas.filter(e => !e.etapa_pai_id);
    const subEtapasPorPai = {};

    etapas.filter(e => e.etapa_pai_id).forEach(sub => {
      if (!subEtapasPorPai[sub.etapa_pai_id]) subEtapasPorPai[sub.etapa_pai_id] = [];
      subEtapasPorPai[sub.etapa_pai_id].push(sub);
    });
    Object.values(subEtapasPorPai).forEach(lista => lista.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));

    return { etapasPai, subEtapasPorPai };
  }, [obra.etapas]);

  // Intervalo de datas do gráfico (com margem proporcional ao zoom) e meses do cabeçalho
  const escala = useMemo(() => {
    const datas = (obra.etapas || [])
      .flatMap(e => [parseDataLocal(e.data_inicio), parseDataLocal(e.data_fim)])
      .filter(Boolean);
    if (datas.length === 0) return null;

    const minDate = new Date(Math.min(...datas));
    const maxDate = new Date(Math.max(...datas));
    const marginDays = Math.round(7 / zoomLevel);
    minDate.setDate(minDate.getDate() - marginDays);
    maxDate.setDate(maxDate.getDate() + marginDays);

    const totalDays = Math.ceil((maxDate - minDate) / MS_DIA);

    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const hojePosition = ((hoje - minDate) / MS_DIA) / totalDays * 100;

    const meses = [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const mesAno = cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!meses.find(m => m.label === mesAno)) {
        meses.push({ label: mesAno, start: new Date(cursor) });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return {
      minDate,
      totalDays,
      hojePosition,
      hojeVisible: hojePosition >= 0 && hojePosition <= 100,
      meses
    };
  }, [obra.etapas, zoomLevel]);

  const toggleSubEtapas = (etapaId) => {
    setSubEtapasExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(etapaId)) novo.delete(etapaId);
      else novo.add(etapaId);
      return novo;
    });
  };

  if (!escala) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.
      </div>
    );
  }

  const { minDate, totalDays, hojePosition, hojeVisible, meses } = escala;
  const hoje = inicioDeHoje();

  const getBarPosition = (dataInicio, dataFim) => {
    const inicio = parseDataLocal(dataInicio);
    const fim = parseDataLocal(dataFim);
    if (!inicio || !fim) return { left: '0%', width: '0%' };
    const left = ((inicio - minDate) / MS_DIA) / totalDays * 100;
    const width = ((fim - inicio) / MS_DIA + 1) / totalDays * 100;
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
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
          <button
            type="button"
            className="text-slate-300"
            aria-expanded={expanded}
            aria-label={expanded ? 'Recolher cronograma de etapas' : 'Expandir cronograma de etapas'}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <FaChevronDown size={12} aria-hidden="true" /> : <FaChevronUp size={12} aria-hidden="true" />}
          </button>
          <FaProjectDiagram className="text-sky-400" aria-hidden="true" />
          <span className="font-medium text-white">Cronograma de Etapas</span>
          <span className="text-xs text-slate-300">({obra.etapas.length} etapas)</span>
        </div>

        {/* Controles de Zoom */}
        {expanded && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-slate-400">Zoom:</span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
            >
              <FaSearchMinus size={12} aria-hidden="true" />
            </button>
            <span className="text-xs text-slate-300 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
            >
              <FaSearchPlus size={12} aria-hidden="true" />
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
              {meses.map((mes) => (
                <div
                  key={mes.label}
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
              const atrasada = etapaAtrasada(etapa, hoje);
              const subEtapas = etapasOrganizadas.subEtapasPorPai[etapa.id] || [];
              const temSubEtapas = subEtapas.length > 0;
              const subEtapasVisiveis = subEtapasExpandidas.has(etapa.id);

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
                          type="button"
                          onClick={() => toggleSubEtapas(etapa.id)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          title={subEtapasVisiveis ? 'Ocultar sub-etapas' : 'Mostrar sub-etapas'}
                          aria-label={subEtapasVisiveis ? `Ocultar sub-etapas de ${etapa.nome}` : `Mostrar sub-etapas de ${etapa.nome}`}
                          aria-expanded={subEtapasVisiveis}
                        >
                          {subEtapasVisiveis ? <FaChevronDown size={10} aria-hidden="true" /> : <FaChevronRight size={10} aria-hidden="true" />}
                        </button>
                      ) : (
                        <div className="w-6" /> // Espaçador para alinhar
                      )}
                      <IconeTipoEtapa tipo={etapa.tipo} size={10} />
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
                      <div className={ACOES_VISIVEIS}>
                        <button
                          type="button"
                          onClick={() => onAddSubEtapa && onAddSubEtapa(etapa)}
                          className="p-1 text-purple-400 hover:bg-purple-500/20 rounded"
                          title="Adicionar sub-etapa"
                          aria-label={`Adicionar sub-etapa a ${etapa.nome}`}
                        >
                          <FaPlus size={10} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddAtividade(etapa)}
                          className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                          title="Criar atividade na agenda"
                          aria-label={`Criar atividade na agenda para ${etapa.nome}`}
                        >
                          <FaCalendarPlus size={12} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditEtapa(etapa)}
                          className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                          title="Editar etapa"
                          aria-label={`Editar etapa ${etapa.nome}`}
                        >
                          <FaEdit size={12} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEtapa(etapa.id)}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          title="Excluir etapa"
                          aria-label={`Excluir etapa ${etapa.nome}`}
                        >
                          <FaTrash size={12} aria-hidden="true" />
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
                    const subAtrasada = etapaAtrasada(subEtapa, hoje);

                    return (
                      <div
                        key={subEtapa.id}
                        className="flex border-b border-slate-700/30 hover:bg-slate-700/30 group bg-slate-900/40"
                        style={{ minWidth: `${chartMinWidth}px` }}
                      >
                        {/* Nome da sub-etapa (indentada) */}
                        <div className="w-72 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-900/50 pl-10">
                          <div className="w-1 h-6 bg-purple-500/50 rounded-full mr-1"></div>
                          <IconeTipoEtapa tipo={subEtapa.tipo} size={10} />
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
                          <div className={ACOES_VISIVEIS}>
                            <button
                              type="button"
                              onClick={() => onAddAtividade(subEtapa)}
                              className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                              title="Criar atividade na agenda"
                              aria-label={`Criar atividade na agenda para ${subEtapa.nome}`}
                            >
                              <FaCalendarPlus size={12} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditEtapa(subEtapa)}
                              className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                              title="Editar sub-etapa"
                              aria-label={`Editar sub-etapa ${subEtapa.nome}`}
                            >
                              <FaEdit size={12} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEtapa(subEtapa.id)}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                              title="Excluir sub-etapa"
                              aria-label={`Excluir sub-etapa ${subEtapa.nome}`}
                            >
                              <FaTrash size={12} aria-hidden="true" />
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

export default React.memo(GanttObra);
