import React, { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaCalendarPlus,
  FaChevronDown,
  FaChevronRight,
  FaChevronUp,
  FaEdit,
  FaEllipsisH,
  FaForward,
  FaPlus,
  FaProjectDiagram,
  FaSearchMinus,
  FaSearchPlus,
  FaTrash
} from 'react-icons/fa';
import { CONSULTA_ACIMA_LG, useMediaQuery } from '../../hooks/useMediaQuery';
import { dataLocalISO, formatarDataBR, parseDataLocal } from '../../utils/datas';
import { estadoEtapa, passosPendentesDaEtapa } from './estadoEtapa';
import SeloPassosPendentes from './SeloPassosPendentes';
import { IconeTipoEtapa } from './icones';
import { etapaAtrasada, inicioDeHoje } from './utils';
import { desvioEmDiasUteis, textoDesvio } from './visao/datasPrevistoRealizado';
import { formatarHoras } from '../../utils/formatos';

const MS_DIA = 1000 * 60 * 60 * 24;

// Largura da coluna do nome e trilha mínima por faixa (M: 640–1023, L: ≥1024); px por dia nas escalas Semana/Mês
const LARGURAS = {
  medio: { nome: 224, trilha: 640, trilhaMinima: 560 },
  largo: { nome: 288, trilha: 800, trilhaMinima: 720 }
};
const PX_POR_DIA = { semana: 22, mes: 5 };

// Tons 600/700: texto branco com contraste ≥4,5:1
const getStatusColor = (status, progresso) => {
  if (progresso >= 100) return 'bg-emerald-700';
  if (status === 'atrasada') return 'bg-red-700';
  if (status === 'em_andamento') return 'bg-sky-700';
  return 'bg-indigo-600';
};

// Menu "⋯ Ações" (abaixo de 1024px): itens de 44px em popup fixo, para não ser cortado pela rolagem do Gantt
const MenuAcoes = ({ rotulo, acoes }) => {
  const [aberto, setAberto] = useState(null); // { top, left } | null
  const botaoRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = () => setAberto(null);
    const aoTeclar = (e) => {
      if (e.key === 'Escape') { setAberto(null); botaoRef.current?.focus(); }
    };
    const aoClicarFora = (e) => {
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) setAberto(null);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoClicarFora);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoClicarFora);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto]);

  const alternar = () => {
    if (aberto) { setAberto(null); return; }
    const r = botaoRef.current.getBoundingClientRect();
    const larguraMenu = 224;
    const alturaMenu = acoes.length * 44 + 8;
    const left = Math.max(8, Math.min(r.right - larguraMenu, window.innerWidth - larguraMenu - 8));
    const top = r.bottom + alturaMenu > window.innerHeight ? Math.max(8, r.top - alturaMenu) : r.bottom + 4;
    setAberto({ top, left });
  };

  const aoTeclarNoMenu = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const atual = itens.indexOf(document.activeElement);
    const proximo = e.key === 'ArrowDown' ? (atual + 1) % itens.length : (atual - 1 + itens.length) % itens.length;
    itens[proximo]?.focus();
  };

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="plan-toque shrink-0 rounded text-slate-200 hover:bg-slate-700"
        aria-haspopup="menu"
        aria-expanded={Boolean(aberto)}
        aria-label={`Ações de ${rotulo}`}
        onClick={alternar}
      >
        <FaEllipsisH size={14} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Ações de ${rotulo}`}
          className="fixed z-50 w-56 rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl"
          style={{ top: aberto.top, left: aberto.left }}
          onKeyDown={aoTeclarNoMenu}
        >
          {acoes.map(({ id, texto, icone, cor, onClick }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-sm hover:bg-slate-700 ${cor}`}
              onClick={() => { setAberto(null); onClick(); }}
            >
              {createElement(icone, { size: 13, 'aria-hidden': true })} {texto}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

// Ações de uma etapa/sub-etapa (ícones em ≥1024px, menu abaixo disso)
const montarAcoes = (etapa, sub, { onReprogramar, onAddSubEtapa, onAddAtividade, onEditEtapa, onDeleteEtapa }) => {
  const tipo = sub ? 'sub-etapa' : 'etapa';
  return [
    !sub && onReprogramar && etapa.status !== 'concluida' && {
      id: 'empurrar', texto: 'Empurrar etapas seguintes', icone: FaForward, cor: 'text-amber-300 hover:bg-amber-500/20',
      titulo: 'Empurrar as etapas seguintes em N dias úteis (com prévia)', aria: `Empurrar etapas seguintes a ${etapa.nome}`,
      onClick: () => onReprogramar(etapa)
    },
    !sub && {
      id: 'sub', texto: 'Adicionar sub-etapa', icone: FaPlus, cor: 'text-purple-300 hover:bg-purple-500/20',
      titulo: 'Adicionar sub-etapa', aria: `Adicionar sub-etapa a ${etapa.nome}`,
      onClick: () => onAddSubEtapa && onAddSubEtapa(etapa)
    },
    {
      id: 'atividade', texto: 'Criar atividade na agenda', icone: FaCalendarPlus, cor: 'text-green-300 hover:bg-green-500/20',
      titulo: 'Criar atividade na agenda', aria: `Criar atividade na agenda para ${etapa.nome}`,
      onClick: () => onAddAtividade(etapa)
    },
    {
      id: 'editar', texto: `Editar ${tipo}`, icone: FaEdit, cor: 'text-blue-300 hover:bg-blue-500/20',
      titulo: `Editar ${tipo}`, aria: `Editar ${tipo} ${etapa.nome}`,
      onClick: () => onEditEtapa(etapa)
    },
    {
      id: 'excluir', texto: `Excluir ${tipo}`, icone: FaTrash, cor: 'text-red-300 hover:bg-red-500/20',
      titulo: `Excluir ${tipo}`, aria: `Excluir ${tipo} ${etapa.nome}`,
      onClick: () => onDeleteEtapa(etapa.id)
    }
  ].filter(Boolean);
};

const AcoesEtapa = ({ etapa, sub = false, largo, handlers }) => {
  const acoes = montarAcoes(etapa, sub, handlers);
  if (!largo) return <MenuAcoes rotulo={etapa.nome} acoes={acoes} />;
  return (
    <div className="plan-acoes">
      {acoes.map(({ id, icone, cor, titulo, aria, onClick }) => (
        <button
          key={id}
          type="button"
          onClick={onClick}
          className={`plan-toque rounded ${cor}`}
          title={titulo}
          aria-label={aria}
        >
          {createElement(icone, { size: 12, 'aria-hidden': true })}
        </button>
      ))}
    </div>
  );
};

// Barra fina do realizado: do início real até o fim real (ou hoje, se a etapa ainda está em curso)
const trechoRealizado = (etapa, hoje) => {
  const inicio = etapa.data_inicio_real;
  if (!inicio) return null;
  const fim = etapa.data_fim_real || (etapa.status === 'concluida' ? inicio : dataLocalISO(hoje));
  return { inicio, fim: fim < inicio ? inicio : fim, emCurso: !etapa.data_fim_real };
};

const GanttObra = ({ obra, onEditEtapa, onDeleteEtapa, onAddAtividade, onAddSubEtapa, onReprogramar, onAdicionarEtapa, horasPorEtapa, passosPorEtapa }) => {
  const [expanded, setExpanded] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 = mais zoom out, 2 = mais zoom in
  const [escalaDias, setEscalaDias] = useState(null); // null (ajustar à largura) | 'semana' | 'mes'
  const [subEtapasExpandidas, setSubEtapasExpandidas] = useState(new Set()); // IDs das etapas pai com sub-etapas visíveis
  const largo = useMediaQuery(CONSULTA_ACIMA_LG);
  const handlers = { onReprogramar, onAddSubEtapa, onAddAtividade, onEditEtapa, onDeleteEtapa };

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
      .flatMap(e => [parseDataLocal(e.data_inicio), parseDataLocal(e.data_fim), parseDataLocal(e.data_inicio_real), parseDataLocal(e.data_fim_real)])
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
      <div className="text-center py-4 text-slate-300 text-sm">
        <p>Nenhuma etapa cadastrada. Clique em "Adicionar Etapa" para começar.</p>
        {onAdicionarEtapa && (
          <button type="button" className="execucao-btn execucao-btn-secondary plan-toque mt-3" onClick={() => onAdicionarEtapa(obra)}>
            <FaPlus size={10} aria-hidden="true" /> Adicionar Etapa
          </button>
        )}
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

  // Uma só largura para o nome (cabeçalho, linhas e linha de HOJE) e trilha mínima por faixa
  const medidas = largo ? LARGURAS.largo : LARGURAS.medio;
  const trilhaMin = escalaDias
    ? Math.max(medidas.trilhaMinima, totalDays * PX_POR_DIA[escalaDias])
    : Math.max(medidas.trilhaMinima, medidas.trilha * zoomLevel);
  const chartMinWidth = medidas.nome + trilhaMin;
  const larguraNome = { width: `${medidas.nome}px` };
  const BOTAO_ZOOM = 'plan-toque text-slate-200 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const botaoEscala = (id, rotulo) => (
    <button
      type="button"
      aria-pressed={escalaDias === id}
      onClick={() => setEscalaDias((atual) => (atual === id ? null : id))}
      className={`plan-toque rounded px-2 text-xs ${escalaDias === id ? 'bg-sky-700 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
      title={id === 'semana' ? 'Escala de semana (22 px por dia)' : 'Escala de mês (5 px por dia)'}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="execucao-card mt-4 !p-3 sm:!p-4">
      <div
        className="flex flex-wrap items-center justify-between gap-2 cursor-pointer p-3 hover:bg-slate-700/50 rounded-lg bg-slate-800/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="plan-toque text-slate-200"
            aria-expanded={expanded}
            aria-label={expanded ? 'Recolher cronograma de etapas' : 'Expandir cronograma de etapas'}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <FaChevronDown size={12} aria-hidden="true" /> : <FaChevronUp size={12} aria-hidden="true" />}
          </button>
          <FaProjectDiagram className="text-sky-300" aria-hidden="true" />
          <span className="font-medium text-white">Cronograma de Etapas</span>
          <span className="text-xs text-slate-300">({obra.etapas.length} etapas)</span>
        </div>

        {/* Controles de escala e zoom */}
        {expanded && (
          <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <div role="group" aria-label="Escala do cronograma" className="flex items-center gap-1 mr-2">
              {botaoEscala('semana', 'Semana')}
              {botaoEscala('mes', 'Mês')}
            </div>
            <span className="text-xs text-slate-300">Zoom:</span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className={BOTAO_ZOOM}
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
              disabled={escalaDias !== null}
            >
              <FaSearchMinus size={12} aria-hidden="true" />
            </button>
            <span className="text-xs text-slate-200 w-10 text-center" aria-live="polite">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
              className={BOTAO_ZOOM}
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
              disabled={escalaDias !== null}
            >
              <FaSearchPlus size={12} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <>
        <div
          className="plan-rolagem"
          role="region"
          aria-label={`Cronograma de etapas de ${obra.nome_cliente}, role na horizontal para ver todas as datas`}
          tabIndex={0}
        >
          {/* Header com meses (mesma largura de nome das linhas: A6) */}
          <div className="flex border-b border-slate-600" style={{ minWidth: `${chartMinWidth}px` }}>
            <div className="sticky left-0 z-10 flex-shrink-0 p-2 bg-slate-700 font-medium text-sm text-white" style={larguraNome}>
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
          <div className="relative" style={{ minWidth: `${chartMinWidth}px` }}>
            {etapasOrganizadas.etapasPai.map((etapa) => {
              const pos = getBarPosition(etapa.data_inicio, etapa.data_fim);
              const realizado = trechoRealizado(etapa, hoje);
              const realizadoPos = realizado ? getBarPosition(realizado.inicio, realizado.fim) : null;
              const horasEtapa = horasPorEtapa?.[etapa.id];
              const desvioInicio = etapa.data_inicio_real ? desvioEmDiasUteis(etapa.data_inicio, etapa.data_inicio_real) : null;
              const atrasada = etapaAtrasada(etapa, hoje);
              const estado = estadoEtapa(etapa, hoje);
              const subEtapas = etapasOrganizadas.subEtapasPorPai[etapa.id] || [];
              const temSubEtapas = subEtapas.length > 0;
              const subEtapasVisiveis = subEtapasExpandidas.has(etapa.id);

              return (
                <React.Fragment key={etapa.id}>
                  <div
                    className="flex border-b border-slate-700/50 hover:bg-slate-800/30 group"
                    style={{ minWidth: `${chartMinWidth}px` }}
                  >
                    {/* Nome da etapa: coluna fixa (sticky) com fundo opaco */}
                    <div className="sticky left-0 z-10 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-800" style={larguraNome}>
                      {/* Botão expandir sub-etapas */}
                      {temSubEtapas ? (
                        <button
                          type="button"
                          onClick={() => toggleSubEtapas(etapa.id)}
                          className="plan-toque shrink-0 text-slate-200 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          title={subEtapasVisiveis ? 'Ocultar sub-etapas' : 'Mostrar sub-etapas'}
                          aria-label={subEtapasVisiveis ? `Ocultar sub-etapas de ${etapa.nome}` : `Mostrar sub-etapas de ${etapa.nome}`}
                          aria-expanded={subEtapasVisiveis}
                        >
                          {subEtapasVisiveis ? <FaChevronDown size={10} aria-hidden="true" /> : <FaChevronRight size={10} aria-hidden="true" />}
                        </button>
                      ) : (
                        <div className="w-6 shrink-0" /> // Espaçador para alinhar
                      )}
                      <IconeTipoEtapa tipo={etapa.tipo} size={10} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-white flex items-center gap-1" title={etapa.nome}>
                          {etapa.nome}
                          {temSubEtapas && (
                            <span className="text-xs text-slate-200 bg-slate-700 px-1 rounded shrink-0">
                              {subEtapas.length} sub
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300">
                          {formatarDataBR(etapa.data_inicio)} - {formatarDataBR(etapa.data_fim)}
                        </div>
                        <div className="text-xs font-medium text-slate-100">{estado.emoji} {estado.rotulo}</div>
                        <SeloPassosPendentes quantidade={passosPendentesDaEtapa(passosPorEtapa, etapa.id)} className="mt-0.5" />
                        {(etapa.data_inicio_real || horasEtapa?.previstas > 0) && (
                          <div className="text-xs text-slate-300 truncate">
                            {etapa.data_inicio_real && (
                              <span>início real {formatarDataBR(etapa.data_inicio_real)} ({textoDesvio(desvioInicio)})</span>
                            )}
                            {etapa.data_inicio_real && horasEtapa?.previstas > 0 ? ' · ' : ''}
                            {horasEtapa?.previstas > 0 && (
                              <span>⏱ {formatarHoras(horasEtapa.realizadas)}/{formatarHoras(horasEtapa.previstas)}</span>
                            )}
                          </div>
                        )}
                        {etapa.responsavel?.nome_completo && (
                          <div className="text-xs text-sky-300 truncate">
                            👤 {etapa.responsavel.nome_completo}
                          </div>
                        )}
                      </div>
                      {/* Ações */}
                      <AcoesEtapa etapa={etapa} largo={largo} handlers={handlers} />
                    </div>

                    {/* Barra do Gantt */}
                    <div className="flex-1 relative min-h-[3rem] flex items-center bg-slate-800/20">
                      {/* Linha de HOJE */}
                      {hojeVisible && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-20"
                          style={{ left: `${hojePosition}%` }}
                        >
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-red-700 text-white text-[10px] leading-4 px-1 rounded whitespace-nowrap">
                            HOJE
                          </div>
                        </div>
                      )}

                      <div
                        className={`absolute h-7 rounded-md shadow-lg ${getStatusColor(etapa.status, etapa.progresso)} ${atrasada ? 'animate-pulse motion-reduce:animate-none' : ''} ${realizado ? 'visao-previsto-fantasma' : ''}`}
                        style={{ left: pos.left, width: pos.width, minWidth: '60px' }}
                        title={realizado ? 'Previsto (barra clara); a barra fina abaixo é o realizado' : undefined}
                      >
                        {/* Barra de progresso interna */}
                        <div
                          className="h-full bg-black/30 rounded-l-md"
                          style={{ width: `${etapa.progresso}%` }}
                        />
                        {/* Label de progresso */}
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                          {etapa.progresso}%
                        </div>
                      </div>
                      {realizado && (
                        <div
                          className={`absolute bottom-1 h-1.5 rounded-full ${realizado.emCurso ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ left: realizadoPos.left, width: realizadoPos.width, minWidth: '6px' }}
                          title={`Realizado: ${formatarDataBR(realizado.inicio)} – ${realizado.emCurso ? 'em andamento' : formatarDataBR(realizado.fim)}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Sub-etapas (renderizadas quando expandidas) */}
                  {subEtapasVisiveis && subEtapas.map((subEtapa) => {
                    const subPos = getBarPosition(subEtapa.data_inicio, subEtapa.data_fim);
                    const subAtrasada = etapaAtrasada(subEtapa, hoje);
                    const subEstado = estadoEtapa(subEtapa, hoje);

                    return (
                      <div
                        key={subEtapa.id}
                        className="flex border-b border-slate-700/30 hover:bg-slate-700/30 group bg-slate-900"
                        style={{ minWidth: `${chartMinWidth}px` }}
                      >
                        {/* Nome da sub-etapa (indentada) */}
                        <div className="sticky left-0 z-10 flex-shrink-0 p-2 flex items-center gap-2 bg-slate-900 pl-6" style={larguraNome}>
                          <div className="w-1 h-6 shrink-0 bg-purple-500/70 rounded-full mr-1"></div>
                          <IconeTipoEtapa tipo={subEtapa.tipo} size={10} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-slate-100" title={subEtapa.nome}>
                              ↳ {subEtapa.nome}
                            </div>
                            <div className="text-xs text-slate-300">
                              {formatarDataBR(subEtapa.data_inicio)} - {formatarDataBR(subEtapa.data_fim)}
                            </div>
                            <div className="text-xs font-medium text-slate-100">{subEstado.emoji} {subEstado.rotulo}</div>
                            {subEtapa.responsavel?.nome_completo && (
                              <div className="text-xs text-sky-300 truncate">
                                👤 {subEtapa.responsavel.nome_completo}
                              </div>
                            )}
                          </div>
                          {/* Ações */}
                          <AcoesEtapa etapa={subEtapa} sub largo={largo} handlers={handlers} />
                        </div>

                        {/* Barra do Gantt da sub-etapa */}
                        <div className="flex-1 relative min-h-[2.5rem] flex items-center bg-slate-900/30">
                          <div
                            className={`absolute h-5 rounded-md shadow-lg ${getStatusColor(subEtapa.status, subEtapa.progresso)} opacity-90 ${subAtrasada ? 'animate-pulse motion-reduce:animate-none' : ''}`}
                            style={{ left: subPos.left, width: subPos.width, minWidth: '40px' }}
                          >
                            <div
                              className="h-full bg-black/30 rounded-l-md"
                              style={{ width: `${subEtapa.progresso}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
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
                className="absolute top-0 bottom-0 w-0.5 bg-red-600/40 z-10 pointer-events-none"
                style={{ left: `calc(${medidas.nome}px + (100% - ${medidas.nome}px) * ${hojePosition / 100})` }}
              />
            )}
          </div>
        </div>

        {/* Legenda (fora da rolagem: sempre visível e quebra em linhas) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-t border-slate-700 text-xs">
          <span className="text-slate-300">Legenda:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-600"></div>
            <span className="text-slate-200">Pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-sky-700"></div>
            <span className="text-slate-200">Em Andamento</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-700"></div>
            <span className="text-slate-200">Concluída</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-700"></div>
            <span className="text-slate-200">Atrasada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-600"></div>
            <span className="text-slate-200">Hoje</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-1.5 rounded-full bg-emerald-400"></div>
            <span className="text-slate-200">Realizado (âmbar = em curso)</span>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default React.memo(GanttObra);
