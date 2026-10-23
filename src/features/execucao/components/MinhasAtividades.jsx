import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FaCalendarDay,
  FaClock,
  FaCheckCircle,
  FaPlay,
  FaCheck,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaClipboardList,
  FaHistory,
  FaComments,
  FaPaperPlane
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { formatarDataBR } from '../utils/datas';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import Modal from './ui/Modal';
import { Carregando, ErroCarregamento, EstadoVazio } from './ui/Estados';

const formatarDataHora = (valor) => (valor ? new Date(valor).toLocaleString('pt-BR') : '—');

const TIPO_LABEL = { eletrica: 'Elétrica', civil: 'Civil', galpao: 'Galpão' };

const STATUS_CLASSE = { pendente: 'pendente', em_andamento: 'em-andamento', concluida: 'concluida' };

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  transferida: 'Transferida',
  cancelada: 'Cancelada'
};

const getTipoIcon = (tipo) => {
  switch (tipo) {
    case 'eletrica': return <FaBolt className="text-yellow-400" aria-hidden="true" />;
    case 'civil': return <FaHardHat className="text-orange-400" aria-hidden="true" />;
    case 'galpao': return <FaWarehouse className="text-blue-400" aria-hidden="true" />;
    default: return <FaCalendarDay className="text-gray-400" aria-hidden="true" />;
  }
};

const FILTROS_RESUMO = [
  { valor: 'todas', rotulo: 'Total', chave: 'total', icone: FaClipboardList, cor: 'blue', borda: 'border-blue-500' },
  { valor: 'pendente', rotulo: 'Pendentes', chave: 'pendentes', icone: FaClock, cor: 'yellow', borda: 'border-yellow-500' },
  { valor: 'em_andamento', rotulo: 'Em Andamento', chave: 'em_andamento', icone: FaPlay, cor: 'purple', borda: 'border-blue-500' },
  { valor: 'concluida', rotulo: 'Concluídas', chave: 'concluidas', icone: FaCheckCircle, cor: 'green', borda: 'border-green-500' }
];

const MinhasAtividades = ({ usuario }) => {
  const { toast } = useExecucaoUI();
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [comentario, setComentario] = useState('');
  const [tab, setTab] = useState('hoje');
  const [detalhes, setDetalhes] = useState({ historico: [], comentarios: [], loading: false, error: null });
  const [alterandoId, setAlterandoId] = useState(null);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const detalhesReq = useRef(0);

  const { data: atividades, loading, error, reload } = useAsyncData(
    () => execucaoService.buscarAtividadesTecnico(usuario.id, tab),
    [usuario.id, tab],
    { initialData: [] }
  );

  // A resposta mais antiga nunca sobrescreve a de uma atividade aberta depois
  const carregarDetalhes = useCallback(async (id, { silencioso = false } = {}) => {
    const reqId = ++detalhesReq.current;
    if (!silencioso) setDetalhes({ historico: [], comentarios: [], loading: true, error: null });
    try {
      const [historicoResult, comentariosResult] = await Promise.all([
        execucaoService.buscarHistoricoAtividade(id),
        execucaoService.buscarComentariosAtividade(id)
      ]);
      if (reqId !== detalhesReq.current) return;
      const falha = [historicoResult, comentariosResult].find((r) => !r?.success);
      setDetalhes((d) => ({
        historico: historicoResult?.success ? historicoResult.data : d.historico,
        comentarios: comentariosResult?.success ? comentariosResult.data : d.comentarios,
        loading: false,
        error: falha ? falha.message || 'Falha ao carregar detalhes' : null
      }));
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      if (reqId === detalhesReq.current) {
        setDetalhes((d) => ({ ...d, loading: false, error: err.message || 'Falha ao carregar detalhes' }));
      }
    }
  }, []);

  const abrirDetalhes = (atividade) => {
    setAtividadeSelecionada(atividade);
    setComentario('');
    carregarDetalhes(atividade.id);
  };

  const fecharDetalhes = useCallback(() => {
    detalhesReq.current += 1;
    setAtividadeSelecionada(null);
  }, []);

  const handleAlterarStatus = async (id, novoStatus) => {
    if (alterandoId) return;
    setAlterandoId(id);
    try {
      const result = await execucaoService.alterarStatusAtividade(id, novoStatus, usuario.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível alterar o status.');
        return;
      }
      toast.success(novoStatus === 'concluida' ? 'Atividade concluída.' : 'Atividade iniciada.');
      reload();
      setAtividadeSelecionada((atual) => (atual?.id === id ? { ...atual, status: novoStatus } : atual));
      if (atividadeSelecionada?.id === id) carregarDetalhes(id, { silencioso: true });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro inesperado ao alterar o status.');
    } finally {
      setAlterandoId(null);
    }
  };

  const handleEnviarComentario = async () => {
    if (!comentario.trim() || !atividadeSelecionada || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const result = await execucaoService.adicionarComentario(atividadeSelecionada.id, usuario.id, comentario.trim());
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível enviar o comentário.');
        return;
      }
      setComentario('');
      carregarDetalhes(atividadeSelecionada.id, { silencioso: true });
    } catch (err) {
      console.error('Erro ao enviar comentário:', err);
      toast.error('Erro inesperado ao enviar o comentário.');
    } finally {
      setEnviandoComentario(false);
    }
  };

  const atividadesFiltradas = useMemo(
    () => atividades.filter((a) => filtroStatus === 'todas' || a.status === filtroStatus),
    [atividades, filtroStatus]
  );

  const stats = useMemo(() => ({
    total: atividades.length,
    pendentes: atividades.filter((a) => a.status === 'pendente').length,
    em_andamento: atividades.filter((a) => a.status === 'em_andamento').length,
    concluidas: atividades.filter((a) => a.status === 'concluida').length
  }), [atividades]);

  const abas = [
    { valor: 'hoje', rotulo: 'Hoje', icone: FaCalendarDay },
    { valor: 'semana', rotulo: 'Esta Semana', icone: FaClock },
    { valor: 'todas', rotulo: 'Todas', icone: FaClipboardList }
  ];

  const botaoStatus = (atividade, classe, tamanhoIcone, aoClicar) => {
    if (atividade.status !== 'pendente' && atividade.status !== 'em_andamento') return null;
    const iniciar = atividade.status === 'pendente';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          aoClicar(atividade.id, iniciar ? 'em_andamento' : 'concluida');
        }}
        disabled={!!alterandoId}
        className={`execucao-btn ${iniciar ? 'execucao-btn-primary' : 'execucao-btn-success'} ${classe}`}
      >
        {iniciar ? <FaPlay size={tamanhoIcone} aria-hidden="true" /> : <FaCheck size={tamanhoIcone} aria-hidden="true" />}
        {iniciar ? ' Iniciar' : ' Concluir'}
      </button>
    );
  };

  return (
    <div className="execucao-animate-fade-in">
      <div className="flex gap-2 mb-6" role="group" aria-label="Período das atividades">
        {abas.map(({ valor, rotulo, icone }) => {
          const Icon = icone;
          return (
          <button
            key={valor}
            type="button"
            aria-pressed={tab === valor}
            className={`execucao-btn ${tab === valor ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
            onClick={() => setTab(valor)}
          >
            <Icon aria-hidden="true" /> {rotulo}
          </button>
          );
        })}
      </div>

      <div className="execucao-grid execucao-grid-4 mb-6">
        {FILTROS_RESUMO.map(({ valor, rotulo, chave, icone, cor, borda }) => {
          const Icon = icone;
          return (
          <button
            key={valor}
            type="button"
            aria-pressed={filtroStatus === valor}
            className={`execucao-stat-card cursor-pointer text-left w-full ${filtroStatus === valor ? borda : ''}`}
            onClick={() => setFiltroStatus(valor)}
          >
            <div className={`execucao-stat-icon ${cor}`}>
              <Icon aria-hidden="true" />
            </div>
            <div className="execucao-stat-content">
              <div className="execucao-stat-label">{rotulo}</div>
              <div className="execucao-stat-value">{stats[chave]}</div>
            </div>
          </button>
          );
        })}
      </div>

      {loading ? (
        <Carregando />
      ) : error ? (
        <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
      ) : atividadesFiltradas.length === 0 ? (
        <EstadoVazio
          icone={<FaClipboardList aria-hidden="true" />}
          titulo="Nenhuma atividade encontrada"
          texto={tab === 'hoje'
            ? 'Você não tem atividades programadas para hoje.'
            : 'Não há atividades para exibir com o filtro selecionado.'}
        />
      ) : (
        <div className="space-y-4">
          {atividadesFiltradas.map((atividade) => (
            <div
              key={atividade.id}
              className="execucao-card cursor-pointer hover:border-blue-500/50"
              onClick={() => abrirDetalhes(atividade)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTipoIcon(atividade.tipo_execucao)}
                    <span className="text-xs text-slate-500 uppercase">
                      {TIPO_LABEL[atividade.tipo_execucao] || atividade.tipo_execucao}
                    </span>
                    <span className={`execucao-activity-status ${STATUS_CLASSE[atividade.status] || 'pendente'}`}>
                      {STATUS_LABEL[atividade.status] || atividade.status}
                    </span>
                    {atividade.prioridade === 'urgente' && (
                      <span className="execucao-badge execucao-badge-red">
                        <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                        Urgente
                      </span>
                    )}
                  </div>

                  <h4 className="text-lg font-semibold text-slate-100 mb-2">
                    <button
                      type="button"
                      className="text-left"
                      aria-haspopup="dialog"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirDetalhes(atividade);
                      }}
                    >
                      {atividade.titulo}
                    </button>
                  </h4>

                  <div className="execucao-activity-meta">
                    <span className="execucao-activity-meta-item">
                      <FaCalendarDay size={12} aria-hidden="true" />
                      {formatarDataBR(atividade.data_programada)}
                    </span>
                    {atividade.hora_inicio && atividade.hora_fim && (
                      <span className="execucao-activity-meta-item">
                        <FaClock size={12} aria-hidden="true" />
                        {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim.substring(0, 5)}
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
                  {botaoStatus(atividade, '', 12, handleAlterarStatus)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {atividadeSelecionada && (
        <Modal
          onClose={fecharDetalhes}
          tamanho="lg"
          titulo={atividadeSelecionada.titulo}
          cabecalho={
            <span className="flex items-center gap-2">
              {getTipoIcon(atividadeSelecionada.tipo_execucao)}
              {atividadeSelecionada.titulo}
            </span>
          }
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`execucao-activity-status ${STATUS_CLASSE[atividadeSelecionada.status] || 'pendente'}`}>
                    {STATUS_LABEL[atividadeSelecionada.status] || atividadeSelecionada.status}
                  </span>
                  <span className="text-sm text-slate-400">
                    {TIPO_LABEL[atividadeSelecionada.tipo_execucao] || atividadeSelecionada.tipo_execucao}
                  </span>
                </div>
                <div className="flex gap-2">
                  {botaoStatus(atividadeSelecionada, 'execucao-btn-sm', 10, handleAlterarStatus)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-400">Data</span>
                  <p className="text-slate-200">{formatarDataBR(atividadeSelecionada.data_programada)}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-400">Horário</span>
                  <p className="text-slate-200">
                    {atividadeSelecionada.hora_inicio?.substring(0, 5) || '--:--'} - {atividadeSelecionada.hora_fim?.substring(0, 5) || '--:--'}
                  </p>
                </div>
              </div>

              {atividadeSelecionada.descricao && (
                <div>
                  <span className="text-sm text-slate-400">Descrição</span>
                  <p className="text-slate-200">{atividadeSelecionada.descricao}</p>
                </div>
              )}

              {atividadeSelecionada.cliente_nome && (
                <div>
                  <span className="text-sm text-slate-400">Cliente</span>
                  <p className="text-slate-200">{atividadeSelecionada.cliente_nome}</p>
                </div>
              )}

              {atividadeSelecionada.endereco && (
                <div>
                  <span className="text-sm text-slate-400">Endereço</span>
                  <p className="text-slate-200">{atividadeSelecionada.endereco}</p>
                </div>
              )}

              {detalhes.error && (
                <div className="text-sm text-red-400" role="alert">
                  Não foi possível carregar parte dos detalhes: {detalhes.error}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => carregarDetalhes(atividadeSelecionada.id)}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              <div>
                <h4 className="flex items-center gap-2 text-slate-100 font-semibold mb-3">
                  <FaHistory className="text-blue-400" aria-hidden="true" />
                  Histórico
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detalhes.loading ? (
                    <Carregando />
                  ) : detalhes.historico.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum histórico disponível.</p>
                  ) : (
                    detalhes.historico.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-2 bg-slate-800 rounded">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" aria-hidden="true"></div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{item.descricao}</p>
                          <p className="text-xs text-slate-500">
                            {item.usuario?.nome_completo} - {formatarDataHora(item.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-slate-100 font-semibold mb-3">
                  <FaComments className="text-green-400" aria-hidden="true" />
                  Comentários
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                  {detalhes.loading ? (
                    <Carregando />
                  ) : detalhes.comentarios.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum comentário.</p>
                  ) : (
                    detalhes.comentarios.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-800 rounded">
                        <p className="text-sm text-slate-200">{item.comentario}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.usuario?.nome_completo} - {formatarDataHora(item.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    className="execucao-form-input flex-1"
                    placeholder="Adicionar comentário..."
                    aria-label="Adicionar comentário"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEnviarComentario()}
                    disabled={enviandoComentario}
                  />
                  <button
                    type="button"
                    onClick={handleEnviarComentario}
                    className="execucao-btn execucao-btn-primary"
                    disabled={!comentario.trim() || enviandoComentario}
                    aria-label="Enviar comentário"
                  >
                    <FaPaperPlane aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="execucao-modal-footer">
            <button type="button" className="execucao-btn execucao-btn-secondary" onClick={fecharDetalhes}>
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MinhasAtividades;
