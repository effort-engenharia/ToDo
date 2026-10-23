import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FaCalendarCheck,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaUsers,
  FaPause,
  FaPlay,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaUser,
  FaMapMarkerAlt,
  FaCalendarDay,
  FaHistory,
  FaBox,
  FaClipboardList
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { dataLocalISO, parseDataLocal, formatarDataBR } from '../utils/datas';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import Modal from './ui/Modal';
import { Carregando, ErroCarregamento } from './ui/Estados';

const FORMATO_DATA_LONGA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const FORMATO_CONCLUSAO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

const formatarInstante = (formato, valor) => {
  const data = valor ? new Date(valor) : null;
  return data && !Number.isNaN(data.getTime()) ? formato.format(data) : '—';
};

const MS_DIA = 24 * 60 * 60 * 1000;
const MARCADOR_SOLICITACAO = 'SOLICITAÇÃO: Atualizar data no planejamento';

const STATS_VAZIAS = { total: 0, pendentes: 0, em_andamento: 0, concluidas: 0, urgentes: 0, pausadas: 0 };

const STATUS_CLASSE = {
  pendente: 'pendente',
  em_andamento: 'em-andamento',
  concluida: 'concluida',
  pausada: 'pausada'
};

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  transferida: 'Transferida',
  cancelada: 'Cancelada'
};

const TIPO_LABEL = { eletrica: 'Elétrica', civil: 'Civil', galpao: 'Galpão' };

const getTipoIcon = (tipo) => {
  switch (tipo) {
    case 'eletrica': return <FaBolt className="text-yellow-400" aria-hidden="true" />;
    case 'civil': return <FaHardHat className="text-orange-400" aria-hidden="true" />;
    case 'galpao': return <FaWarehouse className="text-blue-400" aria-hidden="true" />;
    default: return <FaCalendarCheck className="text-gray-400" aria-hidden="true" />;
  }
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const ATALHOS_ADMIN = [
  { rota: 'agenda-eletrica', rotulo: 'Agenda Elétrica', icone: FaBolt, cor: 'text-yellow-400' },
  { rota: 'agenda-civil', rotulo: 'Agenda Civil', icone: FaHardHat, cor: 'text-orange-400' },
  { rota: 'agenda-galpao', rotulo: 'Agenda Galpão', icone: FaWarehouse, cor: 'text-blue-400' },
  { rota: 'pops', rotulo: 'POPs', icone: FaCalendarCheck, cor: 'text-purple-400' }
];

const ATALHOS_TECNICO = [
  { rota: 'minhas-atividades', rotulo: 'Minhas Atividades', icone: FaCalendarCheck, cor: 'text-blue-400', largo: true },
  { rota: 'pops', rotulo: 'Procedimentos (POPs)', icone: FaCalendarCheck, cor: 'text-purple-400', largo: true }
];

const falhaDe = (rotulo, result) => (result?.success ? null : `${rotulo}: ${result?.message || 'falha na consulta'}`);

const carregarHome = async (isAdmin) => {
  const hojeISO = dataLocalISO();
  const [statsResult, atividadesResult, pausadasResult, pedidosResult] = await Promise.all([
    execucaoService.buscarEstatisticasDia(),
    execucaoService.buscarAtividadesDoDiaComAtrasadas(),
    isAdmin ? execucaoService.buscarAtividadesPausadas() : null,
    isAdmin ? execucaoService.buscarPedidosMaterial() : null
  ]);

  const falhaPrincipal = falhaDe('Atividades', atividadesResult) || falhaDe('Estatísticas', statsResult);
  if (falhaPrincipal) return { success: false, message: falhaPrincipal };

  const avisos = [];
  let atividadesPausadas = [];
  let pedidosPendentes = [];
  let pedidosConcluidos = [];

  if (isAdmin) {
    if (pausadasResult?.success) atividadesPausadas = pausadasResult.data;
    else avisos.push(falhaDe('Tarefas pausadas', pausadasResult));

    if (pedidosResult?.success) {
      // Pedidos de obra concluídos sem lista de itens preenchida
      pedidosPendentes = pedidosResult.data.filter((p) =>
        p.obra_id &&
        p.status === 'concluido' &&
        (!p.itens || p.itens.length === 0 || p.itens.every((i) => !i.nome))
      );
      // Concluídos com itens, atualizados desde o início do dia local
      const inicioHoje = parseDataLocal(hojeISO);
      pedidosConcluidos = pedidosResult.data.filter((p) =>
        p.obra_id &&
        p.status === 'concluido' &&
        p.itens && p.itens.length > 0 && p.itens.some((i) => i.nome) &&
        p.updated_at && new Date(p.updated_at) >= inicioHoje
      );
    } else {
      avisos.push(falhaDe('Pedidos de material', pedidosResult));
    }
  }

  return {
    success: true,
    data: {
      stats: { ...STATS_VAZIAS, ...statsResult.data },
      atividadesHoje: atividadesResult.data.slice(0, 5),
      atividadesPausadas,
      pedidosPendentes,
      pedidosConcluidos,
      avisos
    }
  };
};

const DADOS_INICIAIS = {
  stats: STATS_VAZIAS,
  atividadesHoje: [],
  atividadesPausadas: [],
  pedidosPendentes: [],
  pedidosConcluidos: [],
  avisos: []
};

const ExecucaoHome = ({ usuario, isAdmin, onNavigate }) => {
  const { toast } = useExecucaoUI();
  const [editandoData, setEditandoData] = useState(null);
  const [novaData, setNovaData] = useState('');
  const [acaoId, setAcaoId] = useState(null);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [historicoPausas, setHistoricoPausas] = useState({ itens: [], loading: false, error: null });
  const historicoReq = useRef(0);

  const { data, loading, error, reload } = useAsyncData(() => carregarHome(isAdmin), [isAdmin], {
    initialData: DADOS_INICIAIS
  });
  const { stats, atividadesHoje, atividadesPausadas, pedidosPendentes, pedidosConcluidos, avisos } = data;

  const hojeISO = dataLocalISO();

  const progresso = useMemo(() => {
    const total = stats.total + pedidosConcluidos.length + pedidosPendentes.length;
    const concluidas = stats.concluidas + pedidosConcluidos.length;
    return {
      total,
      concluidas,
      restantes: (stats.total - stats.concluidas) + pedidosPendentes.length,
      percentual: total > 0 ? (concluidas / total) * 100 : 0
    };
  }, [stats, pedidosConcluidos, pedidosPendentes]);

  const diasEmAtraso = (dataProgramada) => {
    const prevista = parseDataLocal(dataProgramada);
    const hoje = parseDataLocal(hojeISO);
    return prevista ? Math.max(0, Math.round((hoje - prevista) / MS_DIA)) : 0;
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

  const handleRetomarAtividade = async (atividadeId) => {
    if (acaoId) return;
    setAcaoId(atividadeId);
    try {
      const result = await execucaoService.alterarStatusAtividade(atividadeId, 'em_andamento', usuario?.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível retomar a atividade.');
        return;
      }
      toast.success('Atividade retomada.');
      reload();
    } catch (err) {
      console.error('Erro ao retomar atividade:', err);
      toast.error('Erro inesperado ao retomar a atividade.');
    } finally {
      setAcaoId(null);
    }
  };

  const handleIniciarEdicaoData = (atividade) => {
    setEditandoData(atividade.id);
    setNovaData(atividade.data_programada);
  };

  const handleCancelarEdicaoData = () => {
    setEditandoData(null);
    setNovaData('');
  };

  const handleSalvarNovaData = async (atividadeId) => {
    if (!novaData || acaoId) return;
    setAcaoId(atividadeId);
    try {
      const result = await execucaoService.atualizarAtividade(atividadeId, { data_programada: novaData }, usuario?.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível alterar a data.');
        return;
      }
      toast.success('Data atualizada.');
      setEditandoData(null);
      setNovaData('');
      reload();
    } catch (err) {
      console.error('Erro ao atualizar data:', err);
      toast.error('Erro inesperado ao atualizar a data.');
    } finally {
      setAcaoId(null);
    }
  };

  const estaAtrasada = (atividade) => atividade.status !== 'concluida' && atividade.data_programada < hojeISO;

  // Sem nenhum carregamento concluído ainda: `data` continua sendo o valor inicial
  if (loading && data === DADOS_INICIAIS) return <Carregando />;
  if (error && data === DADOS_INICIAIS) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;

  const sel = atividadeSelecionada;
  const atalhos = isAdmin ? ATALHOS_ADMIN : ATALHOS_TECNICO;
  const destinoAtividades = isAdmin ? 'atividades-dia' : 'minhas-atividades';

  return (
    <div className="execucao-animate-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-1">
          {getGreeting()}, {usuario?.nome_completo?.split(' ')[0] || 'Usuário'}! <span aria-hidden="true">👋</span>
        </h2>
        <p className="text-slate-400">
          {isAdmin
            ? 'Aqui está o resumo das atividades de hoje da equipe de execução.'
            : 'Confira suas atividades programadas para hoje.'}
        </p>
      </div>

      {(error || avisos.length > 0) && (
        <div className="execucao-card mb-6" role="alert">
          <p className="text-sm text-orange-400">
            Alguns dados podem estar desatualizados: {[error, ...avisos].filter(Boolean).join(' · ')}{' '}
            <button type="button" className="underline" onClick={reload}>Tentar novamente</button>
          </p>
        </div>
      )}

      <div className="execucao-grid execucao-grid-5 mb-8">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue"><FaCalendarCheck aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Hoje</div>
            <div className="execucao-stat-value">{progresso.total}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow"><FaClock aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{stats.pendentes + pedidosPendentes.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
            <FaPause aria-hidden="true" />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pausadas</div>
            <div className="execucao-stat-value">{stats.pausadas || 0}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon red"><FaExclamationTriangle aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Urgentes</div>
            <div className="execucao-stat-value">{stats.urgentes}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green"><FaCheckCircle aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{progresso.concluidas}</div>
          </div>
        </div>
      </div>

      <div className="execucao-grid execucao-grid-2 gap-6">
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaCalendarCheck className="execucao-card-icon" aria-hidden="true" />
              Atividades de Hoje
            </h3>
            <button
              type="button"
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate(destinoAtividades)}
            >
              Ver todas <FaArrowRight size={12} aria-hidden="true" />
            </button>
          </div>

          {atividadesHoje.length === 0 ? (
            <div className="execucao-empty-state">
              <div className="execucao-empty-icon"><FaCalendarCheck aria-hidden="true" /></div>
              <div className="execucao-empty-title">Nenhuma atividade</div>
              <div className="execucao-empty-text">Não há atividades programadas para hoje.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {atividadesHoje.map((atividade) => {
                const atrasada = estaAtrasada(atividade);
                const dias = atrasada ? diasEmAtraso(atividade.data_programada) : 0;
                return (
                  <button
                    type="button"
                    key={atividade.id}
                    className="execucao-activity-card w-full text-left cursor-pointer hover:bg-slate-700/50 transition-colors"
                    aria-haspopup="dialog"
                    onClick={() => handleAbrirDetalhes(atividade)}
                  >
                    <div className="execucao-activity-header">
                      <div className="flex items-center gap-2">
                        {getTipoIcon(atividade.tipo_execucao)}
                        <span className="execucao-activity-title">{atividade.titulo}</span>
                      </div>
                      <span className={`execucao-activity-status ${STATUS_CLASSE[atividade.status] || 'pendente'}`}>
                        {STATUS_LABEL[atividade.status] || atividade.status}
                      </span>
                    </div>
                    <div className="execucao-activity-meta">
                      {atividade.status === 'concluida' ? (
                        <>
                          <span className="execucao-activity-meta-item text-slate-500">
                            <FaCalendarDay size={12} aria-hidden="true" />
                            Prevista: {formatarDataBR(atividade.data_programada)}
                          </span>
                          <span className="execucao-activity-meta-item text-green-400">
                            <FaCheckCircle size={12} aria-hidden="true" />
                            Concluída: {formatarInstante(FORMATO_CONCLUSAO, atividade.updated_at)}
                          </span>
                        </>
                      ) : atrasada ? (
                        <>
                          <span className="execucao-activity-meta-item text-red-400 font-medium">
                            <FaCalendarDay size={12} aria-hidden="true" />
                            Prevista: {formatarDataBR(atividade.data_programada)}
                          </span>
                          <span className="execucao-activity-meta-item text-red-400 font-medium animate-pulse">
                            <FaExclamationTriangle size={12} aria-hidden="true" />
                            {`${dias} dia${dias > 1 ? 's' : ''} em atraso`}
                          </span>
                          {atividade.tecnico?.nome_completo && (
                            <span className="execucao-activity-meta-item">
                              <FaUsers size={12} aria-hidden="true" />
                              {atividade.tecnico.nome_completo.split(' ')[0]}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {atividade.hora_inicio && (
                            <span className="execucao-activity-meta-item">
                              <FaClock size={12} aria-hidden="true" />
                              {atividade.hora_inicio.substring(0, 5)}
                            </span>
                          )}
                          {atividade.tecnico?.nome_completo && (
                            <span className="execucao-activity-meta-item">
                              <FaUsers size={12} aria-hidden="true" />
                              {atividade.tecnico.nome_completo.split(' ')[0]}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">Acesso Rápido</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {atalhos.map((atalho) => {
              const Icon = atalho.icone;
              return (
                <button
                  type="button"
                  key={atalho.rota}
                  className={`p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white ${atalho.largo ? 'col-span-2' : ''}`}
                  onClick={() => onNavigate(atalho.rota)}
                >
                  <Icon size={24} className={atalho.cor} aria-hidden="true" />
                  <span className="text-sm font-medium">{atalho.rotulo}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isAdmin && pedidosPendentes.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaBox className="text-amber-400" aria-hidden="true" />
              <span aria-hidden="true">📦</span> Listas de Materiais Pendentes
              <span className="text-sm bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                {pedidosPendentes.length}
              </span>
            </h3>
            <button
              type="button"
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate('pedido-material')}
            >
              Ver todos <FaArrowRight size={12} aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Listas de obras aguardando preenchimento. Acesse "Pedido de Material" para incluir os itens.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosPendentes.slice(0, 4).map((pedido) => {
              const atrasada = pedido.data_lista_pronta && pedido.data_lista_pronta < hojeISO;

              return (
                <div
                  key={pedido.id}
                  className={`rounded-xl p-4 border-2 ${
                    atrasada ? 'bg-red-900/20 border-red-500/50' : 'bg-amber-900/20 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${atrasada ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      <FaClipboardList className={atrasada ? 'text-red-400' : 'text-amber-400'} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-100 font-bold truncate">
                        {pedido.cliente_nome || 'Cliente não definido'}
                      </h4>
                      {pedido.endereco_obra && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                          <FaMapMarkerAlt size={8} aria-hidden="true" />
                          {pedido.endereco_obra}
                        </p>
                      )}
                    </div>
                    {atrasada && (
                      <span className="text-xs bg-red-500/30 text-red-400 px-2 py-1 rounded-full font-semibold animate-pulse">
                        Atrasada!
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded-lg mb-3 ${atrasada ? 'bg-red-500/10' : 'bg-slate-700/50'}`}>
                    <FaCalendarAlt className={atrasada ? 'text-red-400' : 'text-amber-400'} size={12} aria-hidden="true" />
                    <span className="text-xs text-slate-400">Lista até:</span>
                    <span className={`text-sm font-semibold ${atrasada ? 'text-red-400' : 'text-slate-100'}`}>
                      {pedido.data_lista_pronta ? formatarDataBR(pedido.data_lista_pronta) : 'Não definida'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('pedido-material')}
                    className={`w-full py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      atrasada ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    <FaClipboardList size={12} aria-hidden="true" />
                    Preencher Lista
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pedidosConcluidos.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaCheckCircle className="text-green-400" aria-hidden="true" />
              <span aria-hidden="true">✅</span> Listas de Materiais Concluídas Hoje
              <span className="text-sm bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {pedidosConcluidos.length}
              </span>
            </h3>
            <button
              type="button"
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate('pedido-material')}
            >
              Ver todos <FaArrowRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosConcluidos.slice(0, 4).map((pedido) => (
              <div key={pedido.id} className="rounded-xl p-4 border-2 bg-green-900/20 border-green-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/20">
                    <FaCheckCircle className="text-green-400" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-slate-100 font-bold truncate">
                      {pedido.cliente_nome || 'Cliente não definido'}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {pedido.itens?.filter((i) => i.nome).length || 0} itens na lista
                    </p>
                  </div>
                  <span className="text-xs bg-green-500/30 text-green-400 px-2 py-1 rounded-full font-semibold">
                    Concluída
                  </span>
                </div>

                {pedido.data_material_disponivel && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50">
                    <FaCalendarAlt className="text-green-400" size={12} aria-hidden="true" />
                    <span className="text-xs text-slate-400">Materiais até:</span>
                    <span className="text-sm font-semibold text-slate-100">
                      {formatarDataBR(pedido.data_material_disponivel)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="execucao-card mt-6">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">Progresso do Dia</h3>
          <span className="text-sm text-slate-400">{Math.round(progresso.percentual)}% concluído</span>
        </div>

        <div
          className="w-full bg-slate-700 rounded-full h-3 overflow-hidden"
          role="progressbar"
          aria-label="Progresso do dia"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso.percentual)}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progresso.percentual}%` }}
          />
        </div>

        <div className="flex justify-between mt-3 text-sm">
          <span className="text-slate-400">{progresso.concluidas} de {progresso.total} atividades</span>
          <span className="text-slate-400">{progresso.restantes} restantes</span>
        </div>
      </div>

      {isAdmin && atividadesPausadas.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaPause className="text-orange-400" aria-hidden="true" />
              Tarefas Pausadas
              <span className="text-sm bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                {atividadesPausadas.length}
              </span>
            </h3>
          </div>

          <div className="space-y-4">
            {atividadesPausadas.map((atividade) => {
              const ocupada = acaoId === atividade.id;
              return (
                <div key={atividade.id} className="bg-slate-800/50 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTipoIcon(atividade.tipo_execucao)}
                        <span className="text-slate-100 font-semibold">{atividade.titulo}</span>
                        <span className="execucao-activity-status pausada">Pausada</span>
                      </div>
                      {atividade.cliente_nome && (
                        <p className="text-sm text-sky-400"><span aria-hidden="true">🏢</span> {atividade.cliente_nome}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editandoData === atividade.id ? (
                        <>
                          <input
                            type="date"
                            value={novaData}
                            aria-label="Nova data da atividade"
                            onChange={(e) => setNovaData(e.target.value)}
                            className="bg-slate-700 border border-orange-500 rounded px-2 py-1.5 text-sm text-slate-200
                              focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSalvarNovaData(atividade.id)}
                            disabled={!novaData || !!acaoId}
                            className="execucao-btn execucao-btn-sm"
                            style={{ backgroundColor: '#22c55e', color: '#fff' }}
                            title="Confirmar nova data"
                          >
                            <FaCheck size={10} aria-hidden="true" /> {ocupada ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelarEdicaoData}
                            disabled={!!acaoId}
                            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                            title="Cancelar"
                            aria-label="Cancelar edição da data"
                          >
                            <FaTimes size={10} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          {atividade.pausa_info?.descricao?.includes(MARCADOR_SOLICITACAO) && (
                            <button
                              type="button"
                              onClick={() => handleIniciarEdicaoData(atividade)}
                              disabled={!!acaoId}
                              className="execucao-btn execucao-btn-sm"
                              style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.5)' }}
                              title="Alterar data da atividade (solicitado pelo técnico)"
                            >
                              <FaCalendarAlt size={10} aria-hidden="true" /> Alterar Data
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRetomarAtividade(atividade.id)}
                            disabled={!!acaoId}
                            className="execucao-btn execucao-btn-primary execucao-btn-sm"
                            title="Retomar atividade"
                          >
                            <FaPlay size={10} aria-hidden="true" /> {ocupada ? 'Retomando...' : 'Retomar'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-slate-400 mb-3 items-center flex-wrap">
                    {atividade.tecnico?.nome_completo && (
                      <span className="flex items-center gap-1">
                        <FaUsers size={10} aria-hidden="true" />
                        {atividade.tecnico.nome_completo}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FaCalendarAlt size={10} aria-hidden="true" />
                      {formatarDataBR(atividade.data_programada)}
                    </span>
                  </div>

                  {atividade.pausa_info && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FaExclamationTriangle size={12} className="text-orange-400" aria-hidden="true" />
                        <span className="text-xs text-orange-400 font-medium uppercase">Motivo da Pausa</span>
                        <span className="text-xs text-slate-500">
                          - {formatarInstante(FORMATO_DATA_HORA, atividade.pausa_info.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">
                        {atividade.pausa_info.descricao?.replace('Atividade pausada. Motivo: ', '') || 'Sem justificativa registrada'}
                      </p>
                      {atividade.pausa_info.usuario?.nome_completo && (
                        <p className="text-xs text-slate-500 mt-2">
                          Pausado por: {atividade.pausa_info.usuario.nome_completo}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
              {sel.data_programada < hojeISO && sel.status !== 'concluida' && (
                <span className="execucao-badge execucao-badge-red animate-pulse">
                  <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                  Atrasada
                </span>
              )}
            </div>

            {sel.cliente_nome && (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 uppercase">Cliente</span>
                <p className="text-lg font-semibold text-sky-400"><span aria-hidden="true">🏢</span> {sel.cliente_nome}</p>
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
                <p className="text-slate-200 font-medium mt-1">
                  {parseDataLocal(sel.data_programada) ? FORMATO_DATA_LONGA.format(parseDataLocal(sel.data_programada)) : '—'}
                </p>
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
                  <div className="space-y-3 max-h-48 overflow-y-auto">
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
                            {formatarInstante(FORMATO_DATA_HORA, registro.created_at)}
                          </span>
                        </div>
                        {registro.descricao && (
                          <p className="text-sm text-slate-300">
                            {registro.descricao.replace('Atividade pausada. Motivo: ', '').replace('Atividade retomada', 'Retomada')}
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
          </div>

          <div className="execucao-modal-footer">
            <button type="button" className="execucao-btn execucao-btn-secondary" onClick={fecharDetalhes}>
              Fechar
            </button>
            <button
              type="button"
              className="execucao-btn"
              onClick={() => {
                fecharDetalhes();
                onNavigate(destinoAtividades);
              }}
            >
              Ver em Atividades <FaArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExecucaoHome;
