import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FaCalendarDay,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaUser,
  FaMapMarkerAlt,
  FaCheck,
  FaPlay,
  FaEye,
  FaPause,
  FaTimes,
  FaHistory
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { dataLocalISO, parseDataLocal } from '../utils/datas';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import Modal from './ui/Modal';
import { Carregando, ErroCarregamento, EstadoVazio } from './ui/Estados';

const FORMATO_DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const FORMATO_DATA_LONGA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const FORMATO_CRIACAO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

const formatarCom = (formato, valor) => {
  const data = valor ? (String(valor).length <= 10 ? parseDataLocal(valor) : new Date(valor)) : null;
  return data && !Number.isNaN(data.getTime()) ? formato.format(data) : '—';
};

const TIPO_LABEL = { eletrica: 'Elétrica', civil: 'Civil', galpao: 'Galpão' };

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  transferida: 'Transferida',
  cancelada: 'Cancelada'
};

const STATUS_CLASSE = {
  pendente: 'pendente',
  em_andamento: 'em-andamento',
  concluida: 'concluida',
  pausada: 'pausada'
};

const ESTILO_PAUSA = { backgroundColor: '#f59e0b', color: '#000' };

const FILTROS_TIPO = [
  { valor: 'todos', rotulo: 'Todos', icone: null },
  { valor: 'eletrica', rotulo: 'Elétrica', icone: FaBolt },
  { valor: 'civil', rotulo: 'Civil', icone: FaHardHat },
  { valor: 'galpao', rotulo: 'Galpão', icone: FaWarehouse }
];

const getTipoIcon = (tipo) => {
  switch (tipo) {
    case 'eletrica': return <FaBolt className="text-yellow-400" aria-hidden="true" />;
    case 'civil': return <FaHardHat className="text-orange-400" aria-hidden="true" />;
    case 'galpao': return <FaWarehouse className="text-blue-400" aria-hidden="true" />;
    default: return <FaCalendarDay className="text-gray-400" aria-hidden="true" />;
  }
};

const STATS_VAZIAS = { total: 0, pendentes: 0, em_andamento: 0, concluidas: 0, urgentes: 0 };

const carregarDia = async () => {
  const [atividadesResult, statsResult] = await Promise.all([
    execucaoService.buscarAtividadesDoDiaComAtrasadas(),
    execucaoService.buscarEstatisticasDia()
  ]);
  if (!atividadesResult?.success) return atividadesResult;
  return {
    success: true,
    data: { atividades: atividadesResult.data, stats: statsResult?.success ? statsResult.data : null }
  };
};

const AtividadesDia = ({ usuario }) => {
  const { toast } = useExecucaoUI();
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [alterandoId, setAlterandoId] = useState(null);
  // { atividade, motivo, erro, solicitar, etapa: 'form' | 'confirmacao', salvando }
  const [pausa, setPausa] = useState(null);
  const [historicoPausas, setHistoricoPausas] = useState({ itens: [], loading: false, error: null });
  const historicoReq = useRef(0);

  const { data, loading, error, reload } = useAsyncData(carregarDia, [], {
    initialData: { atividades: [], stats: null }
  });

  const atividades = data.atividades;
  const hojeISO = dataLocalISO();

  const stats = useMemo(() => {
    if (data.stats) return data.stats;
    const hoje = dataLocalISO();
    const base = { ...STATS_VAZIAS, total: atividades.length };
    atividades.forEach((a) => {
      if (a.status === 'pendente') base.pendentes += 1;
      if (a.status === 'em_andamento') base.em_andamento += 1;
      if (a.status === 'concluida') base.concluidas += 1;
      if (a.prioridade === 'urgente' || (a.data_programada < hoje && a.status !== 'concluida' && a.status !== 'cancelada')) {
        base.urgentes += 1;
      }
    });
    return base;
  }, [data.stats, atividades]);

  const atividadesFiltradas = useMemo(
    () => atividades.filter((a) => filtroTipo === 'todos' || a.tipo_execucao === filtroTipo),
    [atividades, filtroTipo]
  );

  const atividadesPorHorario = useMemo(() => {
    const grupos = new Map();
    atividadesFiltradas.forEach((atividade) => {
      const hora = atividade.hora_inicio?.substring(0, 2) || 'Sem horário';
      if (!grupos.has(hora)) grupos.set(hora, []);
      grupos.get(hora).push(atividade);
    });
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [atividadesFiltradas]);

  const estaAtrasada = (atividade) =>
    atividade.data_programada < hojeISO && atividade.status !== 'concluida' && atividade.status !== 'cancelada';

  const handleAlterarStatus = async (id, novoStatus) => {
    if (alterandoId) return false;
    setAlterandoId(id);
    try {
      const result = await execucaoService.alterarStatusAtividade(id, novoStatus, usuario?.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível alterar o status.');
        return false;
      }
      reload();
      return true;
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro inesperado ao alterar o status.');
      return false;
    } finally {
      setAlterandoId(null);
    }
  };

  const alterarStatusEFechar = async (id, novoStatus) => {
    if (await handleAlterarStatus(id, novoStatus)) setAtividadeSelecionada(null);
  };

  const handleAbrirPausaModal = (atividade, e) => {
    e?.stopPropagation();
    setAtividadeSelecionada(null);
    setPausa({ atividade, motivo: '', erro: '', solicitar: false, etapa: 'form', salvando: false });
  };

  // Esc/overlay: volta da confirmação para o formulário; senão fecha. Ignorado durante o salvamento.
  const fecharPausa = useCallback(() => {
    setPausa((p) => {
      if (!p || p.salvando) return p;
      return p.etapa === 'confirmacao' ? { ...p, etapa: 'form' } : null;
    });
  }, []);

  const executarPausa = async (atividade, motivo, comSolicitacao) => {
    setPausa((p) => (p ? { ...p, salvando: true, erro: '' } : p));
    try {
      let motivoCompleto = motivo.trim();
      if (comSolicitacao) {
        motivoCompleto += '\n\n⚠️ SOLICITAÇÃO: Atualizar data no planejamento.';
      }

      const result = await execucaoService.alterarStatusAtividade(atividade.id, 'pausada', usuario?.id, motivoCompleto);
      if (!result?.success) {
        const mensagem = result?.message || 'Erro ao pausar atividade.';
        setPausa((p) => (p ? { ...p, salvando: false, etapa: 'form', erro: mensagem } : p));
        toast.error(mensagem);
        return;
      }

      setPausa(null);
      toast.success('Atividade pausada.');
      reload();
    } catch (err) {
      console.error('Erro ao pausar atividade:', err);
      setPausa((p) => (p ? { ...p, salvando: false, etapa: 'form', erro: 'Erro ao pausar atividade. Tente novamente.' } : p));
    }
  };

  const handleConfirmarPausa = () => {
    if (!pausa || pausa.salvando) return;
    if (!pausa.motivo.trim()) {
      setPausa({ ...pausa, erro: 'Por favor, informe o motivo da pausa.' });
      return;
    }
    // Sem a solicitação marcada, pergunta antes de pausar
    if (!pausa.solicitar) {
      setPausa({ ...pausa, etapa: 'confirmacao' });
      return;
    }
    executarPausa(pausa.atividade, pausa.motivo, true);
  };

  const handleEscolherSolicitacao = (comSolicitacao) => {
    if (!pausa || pausa.salvando) return;
    executarPausa(pausa.atividade, pausa.motivo, comSolicitacao);
  };

  const handleAbrirDetalhes = async (atividade) => {
    const reqId = ++historicoReq.current;
    setAtividadeSelecionada(atividade);
    setHistoricoPausas({ itens: [], loading: true, error: null });
    try {
      const result = await execucaoService.buscarHistorico(atividade.id);
      if (reqId !== historicoReq.current) return;
      if (!result?.success) throw new Error(result?.message || 'Falha ao carregar o histórico');
      const itens = result.data.filter((h) => h.tipo_acao === 'pausa' || h.tipo_acao === 'retomada');
      setHistoricoPausas({ itens, loading: false, error: null });
    } catch (err) {
      console.error('Erro ao buscar histórico de pausas:', err);
      if (reqId === historicoReq.current) {
        setHistoricoPausas({ itens: [], loading: false, error: err.message });
      }
    }
  };

  const fecharDetalhes = useCallback(() => {
    historicoReq.current += 1;
    setAtividadeSelecionada(null);
  }, []);

  const botaoAcao = (atividade, { titulo, classe, estilo, icone, aoClicar }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        aoClicar(e);
      }}
      disabled={!!alterandoId}
      className={`execucao-btn ${classe} execucao-btn-sm`}
      style={estilo}
      title={titulo}
      aria-label={`${titulo}: ${atividade.titulo}`}
    >
      {icone}
    </button>
  );

  if (loading && !atividades.length) return <Carregando />;
  if (error && !atividades.length) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;

  const sel = atividadeSelecionada;

  return (
    <div className="execucao-animate-fade-in">
      {error && <ErroCarregamento mensagem={error} onTentarNovamente={reload} />}

      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue"><FaCalendarDay aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Hoje</div>
            <div className="execucao-stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow"><FaClock aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{stats.pendentes}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green"><FaCheckCircle aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{stats.concluidas}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon red"><FaExclamationTriangle aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Urgentes</div>
            <div className="execucao-stat-value">{stats.urgentes}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6" role="group" aria-label="Filtrar por tipo de execução">
        {FILTROS_TIPO.map((filtro) => {
          const Icon = filtro.icone;
          return (
            <button
              key={filtro.valor}
              type="button"
              aria-pressed={filtroTipo === filtro.valor}
              className={`execucao-btn ${filtroTipo === filtro.valor ? 'execucao-btn-primary' : 'execucao-btn-secondary'} execucao-btn-sm`}
              onClick={() => setFiltroTipo(filtro.valor)}
            >
              {Icon && <Icon aria-hidden="true" />} {filtro.rotulo}
            </button>
          );
        })}
      </div>

      {atividadesFiltradas.length === 0 ? (
        <EstadoVazio
          icone={<FaCalendarDay aria-hidden="true" />}
          titulo="Nenhuma atividade para hoje"
          texto="Não há atividades programadas para hoje."
        />
      ) : (
        <div className="space-y-4">
          {atividadesPorHorario.map(([hora, items]) => (
            <div key={hora} className="flex gap-4">
              <div className="w-20 flex-shrink-0 text-right">
                <span className="text-lg font-bold text-slate-400">
                  {hora === 'Sem horário' ? '--:--' : `${hora}:00`}
                </span>
              </div>

              <div className="relative" aria-hidden="true">
                <div className="absolute top-3 w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="absolute top-6 left-1.5 w-0.5 h-full bg-slate-700"></div>
              </div>

              <div className="flex-1 space-y-3 pb-6">
                {items.map((atividade) => {
                  const isAtrasada = estaAtrasada(atividade);

                  return (
                    <div
                      key={atividade.id}
                      className={`execucao-card cursor-pointer hover:border-blue-500/50 ${isAtrasada ? 'border-red-500/50 bg-red-500/5' : ''}`}
                      onClick={() => handleAbrirDetalhes(atividade)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getTipoIcon(atividade.tipo_execucao)}
                            <span className="text-xs text-slate-500 uppercase">
                              {TIPO_LABEL[atividade.tipo_execucao] || atividade.tipo_execucao}
                            </span>
                            <span className={`execucao-activity-status ${STATUS_CLASSE[atividade.status] || 'pendente'}`}>
                              {STATUS_LABEL[atividade.status] || atividade.status}
                            </span>
                            {isAtrasada && (
                              <span className="execucao-badge execucao-badge-red animate-pulse">
                                <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                                Atrasada
                              </span>
                            )}
                            {atividade.prioridade === 'urgente' && !isAtrasada && (
                              <span className="execucao-badge execucao-badge-red">
                                <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                                Urgente
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded ${isAtrasada ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                              <span aria-hidden="true">📅</span> {formatarCom(FORMATO_DATA_CURTA, atividade.data_programada)}
                            </span>
                          </div>

                          <h4 className="text-slate-100 font-semibold mb-1">
                            <button
                              type="button"
                              className="text-left"
                              aria-haspopup="dialog"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirDetalhes(atividade);
                              }}
                            >
                              {atividade.titulo}
                            </button>
                          </h4>

                          {atividade.cliente_nome && (
                            <p className="text-sm text-sky-400 mb-2">
                              <span aria-hidden="true">🏢</span> {atividade.cliente_nome}
                            </p>
                          )}

                          <div className="execucao-activity-meta">
                            {atividade.hora_inicio && atividade.hora_fim && (
                              <span className="execucao-activity-meta-item">
                                <FaClock size={12} aria-hidden="true" />
                                {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim.substring(0, 5)}
                              </span>
                            )}
                            {atividade.tecnico?.nome_completo && (
                              <span className="execucao-activity-meta-item">
                                <FaUser size={12} aria-hidden="true" />
                                {atividade.tecnico.nome_completo}
                              </span>
                            )}
                            {atividade.endereco && (
                              <span className="execucao-activity-meta-item">
                                <FaMapMarkerAlt size={12} aria-hidden="true" />
                                {atividade.endereco.length > 40 ? `${atividade.endereco.substring(0, 40)}...` : atividade.endereco}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {atividade.status === 'pendente' && botaoAcao(atividade, {
                            titulo: 'Iniciar',
                            classe: 'execucao-btn-secondary',
                            icone: <FaPlay size={10} aria-hidden="true" />,
                            aoClicar: () => handleAlterarStatus(atividade.id, 'em_andamento')
                          })}
                          {atividade.status === 'em_andamento' && (
                            <>
                              {botaoAcao(atividade, {
                                titulo: 'Pausar',
                                classe: '',
                                estilo: ESTILO_PAUSA,
                                icone: <FaPause size={10} aria-hidden="true" />,
                                aoClicar: (e) => handleAbrirPausaModal(atividade, e)
                              })}
                              {botaoAcao(atividade, {
                                titulo: 'Concluir',
                                classe: 'execucao-btn-success',
                                icone: <FaCheck size={10} aria-hidden="true" />,
                                aoClicar: () => handleAlterarStatus(atividade.id, 'concluida')
                              })}
                            </>
                          )}
                          {atividade.status === 'pausada' && botaoAcao(atividade, {
                            titulo: 'Retomar',
                            classe: 'execucao-btn-primary',
                            icone: <FaPlay size={10} aria-hidden="true" />,
                            aoClicar: () => handleAlterarStatus(atividade.id, 'em_andamento')
                          })}
                          {botaoAcao(atividade, {
                            titulo: 'Ver detalhes',
                            classe: 'execucao-btn-secondary',
                            icone: <FaEye size={10} aria-hidden="true" />,
                            aoClicar: () => handleAbrirDetalhes(atividade)
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <Modal
          onClose={fecharDetalhes}
          titulo={sel.titulo}
          cabecalho={
            <span className="flex items-center gap-2">
              {getTipoIcon(sel.tipo_execucao)}
              {sel.titulo}
            </span>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`execucao-activity-status ${STATUS_CLASSE[sel.status] || 'pendente'}`}>
                {STATUS_LABEL[sel.status] || sel.status}
              </span>
              <span className="text-sm text-slate-400 bg-slate-700 px-2 py-1 rounded">
                {TIPO_LABEL[sel.tipo_execucao] || sel.tipo_execucao}
              </span>
              {sel.prioridade === 'urgente' && (
                <span className="execucao-badge execucao-badge-red">
                  <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                  Urgente
                </span>
              )}
              {estaAtrasada(sel) && (
                <span className="execucao-badge execucao-badge-red animate-pulse">
                  <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                  Atrasada
                </span>
              )}
            </div>

            {sel.cliente_nome && (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 uppercase">Cliente</span>
                <p className="text-lg font-semibold text-sky-400">
                  <span aria-hidden="true">🏢</span> {sel.cliente_nome}
                </p>
              </div>
            )}

            {sel.descricao && (
              <div>
                <span className="text-xs text-slate-400 uppercase">Descrição</span>
                <p className="text-slate-200 mt-1">{sel.descricao}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-3 rounded-lg">
                <span className="text-xs text-slate-400 uppercase flex items-center gap-1">
                  <FaCalendarDay size={10} aria-hidden="true" /> Data Programada
                </span>
                <p className="text-slate-200 font-medium mt-1">{formatarCom(FORMATO_DATA_LONGA, sel.data_programada)}</p>
              </div>
              <div className="bg-slate-800/30 p-3 rounded-lg">
                <span className="text-xs text-slate-400 uppercase flex items-center gap-1">
                  <FaClock size={10} aria-hidden="true" /> Horário
                </span>
                <p className="text-slate-200 font-medium mt-1">
                  {sel.hora_inicio?.substring(0, 5) || '--:--'} - {sel.hora_fim?.substring(0, 5) || '--:--'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-3 rounded-lg">
                <span className="text-xs text-slate-400 uppercase flex items-center gap-1">
                  <FaUser size={10} aria-hidden="true" /> Técnico Responsável
                </span>
                <p className="text-slate-200 font-medium mt-1">{sel.tecnico?.nome_completo || 'Não atribuído'}</p>
              </div>
              <div className="bg-slate-800/30 p-3 rounded-lg">
                <span className="text-xs text-slate-400 uppercase">Prioridade</span>
                <p className={`font-medium mt-1 capitalize ${
                  sel.prioridade === 'urgente' ? 'text-red-400' :
                  sel.prioridade === 'alta' ? 'text-orange-400' :
                  sel.prioridade === 'media' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {sel.prioridade || 'Normal'}
                </p>
              </div>
            </div>

            {sel.endereco && (
              <div className="bg-slate-800/30 p-3 rounded-lg">
                <span className="text-xs text-slate-400 uppercase flex items-center gap-1">
                  <FaMapMarkerAlt size={10} aria-hidden="true" /> Endereço
                </span>
                <p className="text-slate-200 mt-1">{sel.endereco}</p>
              </div>
            )}

            {sel.observacoes && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
                <span className="text-xs text-yellow-400 uppercase">Observações</span>
                <p className="text-slate-200 mt-1 whitespace-pre-wrap">{sel.observacoes}</p>
              </div>
            )}

            {historicoPausas.error && (
              <p className="text-sm text-red-400" role="alert">
                Não foi possível carregar o histórico de pausas: {historicoPausas.error}
              </p>
            )}

            {(historicoPausas.itens.length > 0 || historicoPausas.loading) && (
              <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
                <span className="text-xs text-orange-400 uppercase flex items-center gap-2 mb-3">
                  <FaHistory size={10} aria-hidden="true" />
                  Histórico de Pausas
                  {historicoPausas.itens.length > 0 && (
                    <span className="bg-orange-500/30 px-1.5 py-0.5 rounded text-[10px]">
                      {historicoPausas.itens.length}
                    </span>
                  )}
                </span>

                {historicoPausas.loading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm" role="status">
                    <div className="animate-spin w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                    Carregando histórico...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historicoPausas.itens.map((registro) => (
                      <div
                        key={registro.id}
                        className={`p-3 rounded-lg ${
                          registro.tipo_acao === 'pausa'
                            ? 'bg-orange-500/10 border-l-2 border-orange-500'
                            : 'bg-green-500/10 border-l-2 border-green-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium uppercase ${
                            registro.tipo_acao === 'pausa' ? 'text-orange-400' : 'text-green-400'
                          }`}>
                            {registro.tipo_acao === 'pausa' ? '⏸️ Pausada' : '▶️ Retomada'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatarCom(FORMATO_DATA_HORA, registro.created_at)}
                          </span>
                        </div>
                        {registro.tipo_acao === 'pausa' && registro.descricao && (
                          <p className="text-sm text-slate-300 mt-1">
                            <strong className="text-orange-300">Motivo:</strong>{' '}
                            {registro.descricao.replace('Atividade pausada. Motivo: ', '')}
                          </p>
                        )}
                        {registro.usuario?.nome_completo && (
                          <p className="text-xs text-slate-500 mt-1">Por: {registro.usuario.nome_completo}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-slate-700 pt-3 mt-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Criado por: {sel.criador?.nome_completo || 'Sistema'}</span>
                <span>{sel.created_at && formatarCom(FORMATO_CRIACAO, sel.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="execucao-modal-footer">
            <button type="button" className="execucao-btn execucao-btn-secondary" onClick={fecharDetalhes}>
              Fechar
            </button>
            {(sel.status === 'pendente' || sel.status === 'pausada') && (
              <button
                type="button"
                className="execucao-btn execucao-btn-primary"
                disabled={!!alterandoId}
                onClick={() => alterarStatusEFechar(sel.id, 'em_andamento')}
              >
                <FaPlay size={10} aria-hidden="true" /> {sel.status === 'pendente' ? 'Iniciar' : 'Retomar'}
              </button>
            )}
            {sel.status === 'em_andamento' && (
              <button
                type="button"
                className="execucao-btn"
                style={ESTILO_PAUSA}
                disabled={!!alterandoId}
                onClick={() => handleAbrirPausaModal(sel)}
              >
                <FaPause size={10} aria-hidden="true" /> Pausar
              </button>
            )}
            {sel.status !== 'concluida' && sel.status !== 'cancelada' && (
              <button
                type="button"
                className="execucao-btn execucao-btn-success"
                disabled={!!alterandoId}
                onClick={() => alterarStatusEFechar(sel.id, 'concluida')}
              >
                <FaCheck aria-hidden="true" /> Concluir
              </button>
            )}
          </div>
        </Modal>
      )}

      {pausa && pausa.etapa === 'form' && (
        <Modal
          onClose={fecharPausa}
          tamanho="sm"
          titulo="Pausar Atividade"
          cabecalho={
            <span className="flex items-center gap-2">
              <FaPause className="text-yellow-400" aria-hidden="true" />
              Pausar Atividade
            </span>
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <p className="text-slate-200 font-medium">{pausa.atividade.titulo}</p>
              {pausa.atividade.cliente_nome && (
                <p className="text-sm text-sky-400 mt-1">
                  <span aria-hidden="true">🏢</span> {pausa.atividade.cliente_nome}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="pausa-motivo" className="block text-sm text-slate-300 mb-2">
                <span className="text-red-400" aria-hidden="true">*</span> Motivo da Pausa
              </label>
              <textarea
                id="pausa-motivo"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-200
                  focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none
                  placeholder:text-slate-500 resize-none"
                rows={4}
                required
                aria-invalid={!!pausa.erro}
                placeholder="Descreva o motivo pelo qual a atividade está sendo pausada..."
                value={pausa.motivo}
                onChange={(e) => setPausa((p) => ({ ...p, motivo: e.target.value, erro: '' }))}
              />
              {pausa.erro && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1" role="alert">
                  <FaExclamationTriangle size={12} aria-hidden="true" />
                  {pausa.erro}
                </p>
              )}
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pausa.solicitar}
                  onChange={(e) => setPausa((p) => ({ ...p, solicitar: e.target.checked }))}
                  className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500
                    focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <span className="text-sm text-slate-200 font-medium">Solicitar atualização no planejamento</span>
                  <p className="text-xs text-slate-400 mt-1">
                    Marque esta opção para solicitar ao administrador que atualize a data desta atividade no planejamento.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="execucao-modal-footer">
            <button
              type="button"
              className="execucao-btn execucao-btn-secondary"
              onClick={fecharPausa}
              disabled={pausa.salvando}
            >
              <FaTimes size={10} aria-hidden="true" /> Cancelar
            </button>
            <button
              type="button"
              className="execucao-btn"
              style={ESTILO_PAUSA}
              onClick={handleConfirmarPausa}
              disabled={pausa.salvando}
            >
              <FaPause size={10} aria-hidden="true" /> {pausa.salvando ? 'Pausando...' : 'Confirmar Pausa'}
            </button>
          </div>
        </Modal>
      )}

      {pausa && pausa.etapa === 'confirmacao' && (
        <Modal
          onClose={fecharPausa}
          tamanho="sm"
          titulo="Solicitar alteração de data?"
          cabecalho={
            <span className="flex items-center gap-2">
              <FaExclamationTriangle className="text-yellow-400" aria-hidden="true" />
              Solicitar alteração de data?
            </span>
          }
        >
          <div className="space-y-4">
            <p className="text-slate-300">Você não marcou a opção de solicitar atualização no planejamento.</p>
            <p className="text-slate-400 text-sm">
              Deseja solicitar ao administrador que atualize a data desta atividade no planejamento?
            </p>
          </div>
          <div className="execucao-modal-footer flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="execucao-btn w-full sm:w-auto flex items-center justify-center gap-2"
              style={{ backgroundColor: '#22c55e', color: '#fff' }}
              disabled={pausa.salvando}
              onClick={() => handleEscolherSolicitacao(true)}
            >
              <FaCheck size={12} aria-hidden="true" /> Quero solicitar a alteração
            </button>
            <button
              type="button"
              className="execucao-btn w-full sm:w-auto flex items-center justify-center gap-2"
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
              disabled={pausa.salvando}
              onClick={() => handleEscolherSolicitacao(false)}
            >
              <FaTimes size={12} aria-hidden="true" /> Não quero solicitar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AtividadesDia;
