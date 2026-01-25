import React, { useState, useEffect } from 'react';
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

const AtividadesDia = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [atividades, setAtividades] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    em_andamento: 0,
    concluidas: 0,
    urgentes: 0
  });
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  
  // Estado para modal de pausa
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [atividadeParaPausar, setAtividadeParaPausar] = useState(null);
  const [motivoPausa, setMotivoPausa] = useState('');
  const [erroPausa, setErroPausa] = useState('');
  const [solicitarAtualizacaoPlanejamento, setSolicitarAtualizacaoPlanejamento] = useState(false);
  const [showConfirmacaoSolicitacao, setShowConfirmacaoSolicitacao] = useState(false);
  
  // Estado para histórico de pausas da atividade selecionada
  const [historicoPausas, setHistoricoPausas] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [atividadesResult, statsResult] = await Promise.all([
        execucaoService.buscarAtividadesDoDiaComAtrasadas(),
        execucaoService.buscarEstatisticasDia()
      ]);

      if (atividadesResult.success) {
        setAtividades(atividadesResult.data);
      }
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    await execucaoService.alterarStatusAtividade(id, novoStatus, usuario?.id);
    carregarDados();
  };

  // Funções para pausar atividade
  const handleAbrirPausaModal = (atividade, e) => {
    if (e) e.stopPropagation();
    setAtividadeParaPausar(atividade);
    setMotivoPausa('');
    setErroPausa('');
    setShowPausaModal(true);
  };

  const handleConfirmarPausa = async () => {
    if (!motivoPausa.trim()) {
      setErroPausa('Por favor, informe o motivo da pausa.');
      return;
    }
    
    // Se não marcou a solicitação de atualização, mostrar modal de confirmação
    if (!solicitarAtualizacaoPlanejamento) {
      setShowConfirmacaoSolicitacao(true);
      return;
    }
    
    await executarPausa(true);
  };

  const executarPausa = async (comSolicitacao) => {
    try {
      // Montar motivo com solicitação de atualização se marcado
      let motivoCompleto = motivoPausa.trim();
      if (comSolicitacao) {
        motivoCompleto += '\n\n⚠️ SOLICITAÇÃO: Atualizar data no planejamento.';
      }
      
      const result = await execucaoService.alterarStatusAtividade(
        atividadeParaPausar.id, 
        'pausada', 
        usuario?.id,
        motivoCompleto
      );
      
      if (!result.success) {
        setErroPausa(result.message || 'Erro ao pausar atividade.');
        return;
      }
      
      setShowPausaModal(false);
      setShowConfirmacaoSolicitacao(false);
      setAtividadeParaPausar(null);
      setMotivoPausa('');
      setSolicitarAtualizacaoPlanejamento(false);
      setAtividadeSelecionada(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao pausar atividade:', error);
      setErroPausa('Erro ao pausar atividade. Tente novamente.');
    }
  };

  const handleConfirmarComSolicitacao = async () => {
    setSolicitarAtualizacaoPlanejamento(true);
    setShowConfirmacaoSolicitacao(false);
    await executarPausa(true);
  };

  const handleConfirmarSemSolicitacao = async () => {
    setShowConfirmacaoSolicitacao(false);
    await executarPausa(false);
  };

  const handleFecharPausaModal = () => {
    setShowPausaModal(false);
    setAtividadeParaPausar(null);
    setMotivoPausa('');
    setErroPausa('');
    setSolicitarAtualizacaoPlanejamento(false);
  };

  // Buscar histórico de pausas de uma atividade
  const buscarHistoricoPausas = async (atividadeId) => {
    setLoadingHistorico(true);
    try {
      const result = await execucaoService.buscarHistorico(atividadeId);
      if (result.success) {
        // Filtrar apenas registros de pausa e retomada
        const pausas = result.data.filter(h => 
          h.tipo_acao === 'pausa' || h.tipo_acao === 'retomada'
        );
        setHistoricoPausas(pausas);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico de pausas:', error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Abrir modal de detalhes e buscar histórico
  const handleAbrirDetalhes = async (atividade) => {
    setAtividadeSelecionada(atividade);
    setHistoricoPausas([]);
    await buscarHistoricoPausas(atividade.id);
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-blue-400" />;
      default: return <FaCalendarDay className="text-gray-400" />;
    }
  };

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'eletrica': return 'Elétrica';
      case 'civil': return 'Civil';
      case 'galpao': return 'Galpão';
      default: return tipo;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'pausada': return 'Pausada';
      case 'transferida': return 'Transferida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente': return 'pendente';
      case 'em_andamento': return 'em-andamento';
      case 'concluida': return 'concluida';
      case 'pausada': return 'pausada';
      default: return 'pendente';
    }
  };

  // Filtrar atividades
  const atividadesFiltradas = atividades.filter(a => 
    filtroTipo === 'todos' || a.tipo_execucao === filtroTipo
  );

  // Agrupar por horário
  const atividadesPorHorario = atividadesFiltradas.reduce((acc, atividade) => {
    const hora = atividade.hora_inicio?.substring(0, 2) || 'Sem horário';
    if (!acc[hora]) {
      acc[hora] = [];
    }
    acc[hora].push(atividade);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="execucao-loading">
        <div className="execucao-spinner"></div>
      </div>
    );
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Cards de resumo */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaCalendarDay />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Hoje</div>
            <div className="execucao-stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{stats.pendentes}</div>
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
            <FaExclamationTriangle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Urgentes</div>
            <div className="execucao-stat-value">{stats.urgentes}</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <button
          className={`execucao-btn ${filtroTipo === 'todos' ? 'execucao-btn-primary' : 'execucao-btn-secondary'} execucao-btn-sm`}
          onClick={() => setFiltroTipo('todos')}
        >
          Todos
        </button>
        <button
          className={`execucao-btn ${filtroTipo === 'eletrica' ? 'execucao-btn-primary' : 'execucao-btn-secondary'} execucao-btn-sm`}
          onClick={() => setFiltroTipo('eletrica')}
        >
          <FaBolt /> Elétrica
        </button>
        <button
          className={`execucao-btn ${filtroTipo === 'civil' ? 'execucao-btn-primary' : 'execucao-btn-secondary'} execucao-btn-sm`}
          onClick={() => setFiltroTipo('civil')}
        >
          <FaHardHat /> Civil
        </button>
        <button
          className={`execucao-btn ${filtroTipo === 'galpao' ? 'execucao-btn-primary' : 'execucao-btn-secondary'} execucao-btn-sm`}
          onClick={() => setFiltroTipo('galpao')}
        >
          <FaWarehouse /> Galpão
        </button>
      </div>

      {/* Timeline de atividades */}
      {atividadesFiltradas.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaCalendarDay />
            </div>
            <div className="execucao-empty-title">Nenhuma atividade para hoje</div>
            <div className="execucao-empty-text">
              Não há atividades programadas para hoje.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(atividadesPorHorario).sort().map(([hora, items]) => (
            <div key={hora} className="flex gap-4">
              {/* Coluna de horário */}
              <div className="w-20 flex-shrink-0 text-right">
                <span className="text-lg font-bold text-slate-400">
                  {hora === 'Sem horário' ? '--:--' : `${hora}:00`}
                </span>
              </div>

              {/* Linha vertical */}
              <div className="relative">
                <div className="absolute top-3 w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="absolute top-6 left-1.5 w-0.5 h-full bg-slate-700"></div>
              </div>

              {/* Atividades */}
              <div className="flex-1 space-y-3 pb-6">
                {items.map((atividade) => {
                  // Verificar se está atrasada (data anterior a hoje e não concluída)
                  const hoje = new Date().toISOString().split('T')[0];
                  const isAtrasada = atividade.data_programada < hoje && 
                    atividade.status !== 'concluida' && 
                    atividade.status !== 'cancelada';
                  
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
                            {getTipoLabel(atividade.tipo_execucao)}
                          </span>
                          <span className={`execucao-activity-status ${getStatusColor(atividade.status)}`}>
                            {getStatusLabel(atividade.status)}
                          </span>
                          {isAtrasada && (
                            <span className="execucao-badge execucao-badge-red animate-pulse">
                              <FaExclamationTriangle size={10} className="mr-1" />
                              Atrasada
                            </span>
                          )}
                          {atividade.prioridade === 'urgente' && !isAtrasada && (
                            <span className="execucao-badge execucao-badge-red">
                              <FaExclamationTriangle size={10} className="mr-1" />
                              Urgente
                            </span>
                          )}
                          {/* Data da atividade */}
                          <span className={`text-xs px-2 py-0.5 rounded ${isAtrasada ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                            📅 {new Date(atividade.data_programada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        
                        <h4 className="text-slate-100 font-semibold mb-1">
                          {atividade.titulo}
                        </h4>
                        
                        {/* Nome do cliente */}
                        {atividade.cliente_nome && (
                          <p className="text-sm text-sky-400 mb-2">
                            🏢 {atividade.cliente_nome}
                          </p>
                        )}
                        
                        <div className="execucao-activity-meta">
                          {atividade.hora_inicio && atividade.hora_fim && (
                            <span className="execucao-activity-meta-item">
                              <FaClock size={12} />
                              {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim.substring(0, 5)}
                            </span>
                          )}
                          {atividade.tecnico?.nome_completo && (
                            <span className="execucao-activity-meta-item">
                              <FaUser size={12} />
                              {atividade.tecnico.nome_completo}
                            </span>
                          )}
                          {atividade.endereco && (
                            <span className="execucao-activity-meta-item">
                              <FaMapMarkerAlt size={12} />
                              {atividade.endereco.substring(0, 40)}...
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {atividade.status === 'pendente' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAlterarStatus(atividade.id, 'em_andamento');
                            }}
                            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                            title="Iniciar"
                          >
                            <FaPlay size={10} />
                          </button>
                        )}
                        {atividade.status === 'em_andamento' && (
                          <>
                            <button
                              onClick={(e) => handleAbrirPausaModal(atividade, e)}
                              className="execucao-btn execucao-btn-sm"
                              style={{ backgroundColor: '#f59e0b', color: '#000' }}
                              title="Pausar"
                            >
                              <FaPause size={10} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAlterarStatus(atividade.id, 'concluida');
                              }}
                              className="execucao-btn execucao-btn-success execucao-btn-sm"
                              title="Concluir"
                            >
                              <FaCheck size={10} />
                            </button>
                          </>
                        )}
                        {atividade.status === 'pausada' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAlterarStatus(atividade.id, 'em_andamento');
                            }}
                            className="execucao-btn execucao-btn-primary execucao-btn-sm"
                            title="Retomar"
                          >
                            <FaPlay size={10} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirDetalhes(atividade);
                          }}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          title="Ver detalhes"
                        >
                          <FaEye size={10} />
                        </button>
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

      {/* Modal de detalhes */}
      {atividadeSelecionada && (
        <div className="execucao-modal-overlay" onClick={() => setAtividadeSelecionada(null)}>
          <div className="execucao-modal" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                {getTipoIcon(atividadeSelecionada.tipo_execucao)}
                {atividadeSelecionada.titulo}
              </h3>
              <button 
                className="execucao-modal-close"
                onClick={() => setAtividadeSelecionada(null)}
              >
                ×
              </button>
            </div>
            <div className="execucao-modal-body">
              <div className="space-y-4">
                {/* Status e badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`execucao-activity-status ${getStatusColor(atividadeSelecionada.status)}`}>
                    {getStatusLabel(atividadeSelecionada.status)}
                  </span>
                  <span className="text-sm text-slate-400 bg-slate-700 px-2 py-1 rounded">
                    {getTipoLabel(atividadeSelecionada.tipo_execucao)}
                  </span>
                  {atividadeSelecionada.prioridade === 'urgente' && (
                    <span className="execucao-badge execucao-badge-red">
                      <FaExclamationTriangle size={10} className="mr-1" />
                      Urgente
                    </span>
                  )}
                  {atividadeSelecionada.data_programada < new Date().toISOString().split('T')[0] && 
                   atividadeSelecionada.status !== 'concluida' && (
                    <span className="execucao-badge execucao-badge-red animate-pulse">
                      <FaExclamationTriangle size={10} className="mr-1" />
                      Atrasada
                    </span>
                  )}
                </div>

                {/* Cliente */}
                {atividadeSelecionada.cliente_nome && (
                  <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-400 uppercase">Cliente</label>
                    <p className="text-lg font-semibold text-sky-400">
                      🏢 {atividadeSelecionada.cliente_nome}
                    </p>
                  </div>
                )}

                {/* Descrição */}
                {atividadeSelecionada.descricao && (
                  <div>
                    <label className="text-xs text-slate-400 uppercase">Descrição</label>
                    <p className="text-slate-200 mt-1">{atividadeSelecionada.descricao}</p>
                  </div>
                )}

                {/* Data e Horário */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 p-3 rounded-lg">
                    <label className="text-xs text-slate-400 uppercase flex items-center gap-1">
                      <FaCalendarDay size={10} /> Data Programada
                    </label>
                    <p className="text-slate-200 font-medium mt-1">
                      {new Date(atividadeSelecionada.data_programada + 'T12:00:00').toLocaleDateString('pt-BR', { 
                        weekday: 'long', 
                        day: '2-digit', 
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 p-3 rounded-lg">
                    <label className="text-xs text-slate-400 uppercase flex items-center gap-1">
                      <FaClock size={10} /> Horário
                    </label>
                    <p className="text-slate-200 font-medium mt-1">
                      {atividadeSelecionada.hora_inicio?.substring(0, 5) || '--:--'} - {atividadeSelecionada.hora_fim?.substring(0, 5) || '--:--'}
                    </p>
                  </div>
                </div>

                {/* Técnico e Prioridade */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 p-3 rounded-lg">
                    <label className="text-xs text-slate-400 uppercase flex items-center gap-1">
                      <FaUser size={10} /> Técnico Responsável
                    </label>
                    <p className="text-slate-200 font-medium mt-1">
                      {atividadeSelecionada.tecnico?.nome_completo || 'Não atribuído'}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 p-3 rounded-lg">
                    <label className="text-xs text-slate-400 uppercase">Prioridade</label>
                    <p className={`font-medium mt-1 capitalize ${
                      atividadeSelecionada.prioridade === 'urgente' ? 'text-red-400' :
                      atividadeSelecionada.prioridade === 'alta' ? 'text-orange-400' :
                      atividadeSelecionada.prioridade === 'media' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {atividadeSelecionada.prioridade || 'Normal'}
                    </p>
                  </div>
                </div>

                {/* Endereço */}
                {atividadeSelecionada.endereco && (
                  <div className="bg-slate-800/30 p-3 rounded-lg">
                    <label className="text-xs text-slate-400 uppercase flex items-center gap-1">
                      <FaMapMarkerAlt size={10} /> Endereço
                    </label>
                    <p className="text-slate-200 mt-1">{atividadeSelecionada.endereco}</p>
                  </div>
                )}

                {/* Observações */}
                {atividadeSelecionada.observacoes && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
                    <label className="text-xs text-yellow-400 uppercase">Observações</label>
                    <p className="text-slate-200 mt-1 whitespace-pre-wrap">{atividadeSelecionada.observacoes}</p>
                  </div>
                )}

                {/* Histórico de Pausas */}
                {(historicoPausas.length > 0 || loadingHistorico) && (
                  <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
                    <label className="text-xs text-orange-400 uppercase flex items-center gap-2 mb-3">
                      <FaHistory size={10} />
                      Histórico de Pausas
                      {historicoPausas.length > 0 && (
                        <span className="bg-orange-500/30 px-1.5 py-0.5 rounded text-[10px]">
                          {historicoPausas.length}
                        </span>
                      )}
                    </label>
                    
                    {loadingHistorico ? (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <div className="animate-spin w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                        Carregando histórico...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {historicoPausas.map((registro, index) => (
                          <div 
                            key={registro.id || index} 
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
                                {new Date(registro.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            {registro.tipo_acao === 'pausa' && registro.descricao && (
                              <p className="text-sm text-slate-300 mt-1">
                                <strong className="text-orange-300">Motivo:</strong>{' '}
                                {registro.descricao.replace('Atividade pausada. Motivo: ', '')}
                              </p>
                            )}
                            {registro.usuario?.nome_completo && (
                              <p className="text-xs text-slate-500 mt-1">
                                Por: {registro.usuario.nome_completo}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Informações de criação */}
                <div className="border-t border-slate-700 pt-3 mt-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      Criado por: {atividadeSelecionada.criador?.nome_completo || 'Sistema'}
                    </span>
                    <span>
                      {atividadeSelecionada.created_at && 
                        new Date(atividadeSelecionada.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button 
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setAtividadeSelecionada(null)}
              >
                Fechar
              </button>
              {atividadeSelecionada.status === 'pendente' && (
                <button 
                  className="execucao-btn execucao-btn-primary"
                  onClick={() => {
                    handleAlterarStatus(atividadeSelecionada.id, 'em_andamento');
                    setAtividadeSelecionada(null);
                  }}
                >
                  <FaPlay size={10} /> Iniciar
                </button>
              )}
              {atividadeSelecionada.status === 'pausada' && (
                <button 
                  className="execucao-btn execucao-btn-primary"
                  onClick={() => {
                    handleAlterarStatus(atividadeSelecionada.id, 'em_andamento');
                    setAtividadeSelecionada(null);
                  }}
                >
                  <FaPlay size={10} /> Retomar
                </button>
              )}
              {atividadeSelecionada.status === 'em_andamento' && (
                <button 
                  className="execucao-btn"
                  style={{ backgroundColor: '#f59e0b', color: '#000' }}
                  onClick={() => handleAbrirPausaModal(atividadeSelecionada)}
                >
                  <FaPause size={10} /> Pausar
                </button>
              )}
              {atividadeSelecionada.status !== 'concluida' && atividadeSelecionada.status !== 'cancelada' && (
                <button 
                  className="execucao-btn execucao-btn-success"
                  onClick={() => {
                    handleAlterarStatus(atividadeSelecionada.id, 'concluida');
                    setAtividadeSelecionada(null);
                  }}
                >
                  <FaCheck /> Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pausa */}
      {showPausaModal && atividadeParaPausar && (
        <div className="execucao-modal-overlay" onClick={handleFecharPausaModal}>
          <div className="execucao-modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                <FaPause className="text-yellow-400" />
                Pausar Atividade
              </h3>
              <button 
                className="execucao-modal-close"
                onClick={handleFecharPausaModal}
              >
                ×
              </button>
            </div>
            <div className="execucao-modal-body">
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                  <p className="text-slate-200 font-medium">
                    {atividadeParaPausar.titulo}
                  </p>
                  {atividadeParaPausar.cliente_nome && (
                    <p className="text-sm text-sky-400 mt-1">
                      🏢 {atividadeParaPausar.cliente_nome}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    <span className="text-red-400">*</span> Motivo da Pausa
                  </label>
                  <textarea
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-200 
                      focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none
                      placeholder:text-slate-500 resize-none"
                    rows={4}
                    placeholder="Descreva o motivo pelo qual a atividade está sendo pausada..."
                    value={motivoPausa}
                    onChange={(e) => {
                      setMotivoPausa(e.target.value);
                      if (erroPausa) setErroPausa('');
                    }}
                  />
                  {erroPausa && (
                    <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                      <FaExclamationTriangle size={12} />
                      {erroPausa}
                    </p>
                  )}
                </div>

                {/* Solicitação de atualização no planejamento */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={solicitarAtualizacaoPlanejamento}
                      onChange={(e) => setSolicitarAtualizacaoPlanejamento(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 
                        focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-sm text-slate-200 font-medium">
                        Solicitar atualização no planejamento
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        Marque esta opção para solicitar ao administrador que atualize a data desta atividade no planejamento.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button 
                className="execucao-btn execucao-btn-secondary"
                onClick={handleFecharPausaModal}
              >
                <FaTimes size={10} /> Cancelar
              </button>
              <button 
                className="execucao-btn"
                style={{ backgroundColor: '#f59e0b', color: '#000' }}
                onClick={handleConfirmarPausa}
              >
                <FaPause size={10} /> Confirmar Pausa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de solicitação de alteração */}
      {showConfirmacaoSolicitacao && (
        <div className="execucao-modal-overlay" style={{ zIndex: 60 }}>
          <div className="execucao-modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                <FaExclamationTriangle className="text-yellow-400" />
                Solicitar alteração de data?
              </h3>
            </div>
            <div className="execucao-modal-body">
              <div className="space-y-4">
                <p className="text-slate-300">
                  Você não marcou a opção de solicitar atualização no planejamento.
                </p>
                <p className="text-slate-400 text-sm">
                  Deseja solicitar ao administrador que atualize a data desta atividade no planejamento?
                </p>
              </div>
            </div>
            <div className="execucao-modal-footer flex-col gap-3 sm:flex-row">
              <button 
                className="execucao-btn w-full sm:w-auto flex items-center justify-center gap-2"
                style={{ backgroundColor: '#22c55e', color: '#fff' }}
                onClick={handleConfirmarComSolicitacao}
              >
                <FaCheck size={12} /> Quero solicitar a alteração
              </button>
              <button 
                className="execucao-btn w-full sm:w-auto flex items-center justify-center gap-2"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
                onClick={handleConfirmarSemSolicitacao}
              >
                <FaTimes size={12} /> Não quero solicitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtividadesDia;
