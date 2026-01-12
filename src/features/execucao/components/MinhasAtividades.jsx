import React, { useState, useEffect } from 'react';
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

const MinhasAtividades = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [atividades, setAtividades] = useState([]);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [comentario, setComentario] = useState('');
  const [historico, setHistorico] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [tab, setTab] = useState('hoje');

  useEffect(() => {
    carregarAtividades();
  }, [tab]);

  const carregarAtividades = async () => {
    setLoading(true);
    try {
      let result;
      if (tab === 'hoje') {
        result = await execucaoService.buscarAtividadesTecnico(usuario.id, 'hoje');
      } else if (tab === 'semana') {
        result = await execucaoService.buscarAtividadesTecnico(usuario.id, 'semana');
      } else {
        result = await execucaoService.buscarAtividadesTecnico(usuario.id, 'todas');
      }

      if (result.success) {
        setAtividades(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDetalhes = async (atividade) => {
    setAtividadeSelecionada(atividade);
    setShowDetalhes(true);
    
    // Carregar histórico e comentários
    const [historicoResult, comentariosResult] = await Promise.all([
      execucaoService.buscarHistoricoAtividade(atividade.id),
      execucaoService.buscarComentariosAtividade(atividade.id)
    ]);

    if (historicoResult.success) {
      setHistorico(historicoResult.data);
    }
    if (comentariosResult.success) {
      setComentarios(comentariosResult.data);
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    const result = await execucaoService.alterarStatusAtividade(id, novoStatus, usuario.id);
    if (result.success) {
      carregarAtividades();
      if (atividadeSelecionada?.id === id) {
        setAtividadeSelecionada(prev => ({ ...prev, status: novoStatus }));
        const historicoResult = await execucaoService.buscarHistoricoAtividade(id);
        if (historicoResult.success) {
          setHistorico(historicoResult.data);
        }
      }
    }
  };

  const handleEnviarComentario = async () => {
    if (!comentario.trim() || !atividadeSelecionada) return;

    const result = await execucaoService.adicionarComentario(
      atividadeSelecionada.id,
      usuario.id,
      comentario
    );

    if (result.success) {
      setComentario('');
      const comentariosResult = await execucaoService.buscarComentariosAtividade(atividadeSelecionada.id);
      if (comentariosResult.success) {
        setComentarios(comentariosResult.data);
      }
    }
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente': return 'pendente';
      case 'em_andamento': return 'em-andamento';
      case 'concluida': return 'concluida';
      default: return 'pendente';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'transferida': return 'Transferida';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  // Filtrar atividades
  const atividadesFiltradas = atividades.filter(a => 
    filtroStatus === 'todas' || a.status === filtroStatus
  );

  // Estatísticas
  const stats = {
    total: atividades.length,
    pendentes: atividades.filter(a => a.status === 'pendente').length,
    em_andamento: atividades.filter(a => a.status === 'em_andamento').length,
    concluidas: atividades.filter(a => a.status === 'concluida').length
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
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          className={`execucao-btn ${tab === 'hoje' ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
          onClick={() => setTab('hoje')}
        >
          <FaCalendarDay /> Hoje
        </button>
        <button
          className={`execucao-btn ${tab === 'semana' ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
          onClick={() => setTab('semana')}
        >
          <FaClock /> Esta Semana
        </button>
        <button
          className={`execucao-btn ${tab === 'todas' ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
          onClick={() => setTab('todas')}
        >
          <FaClipboardList /> Todas
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div 
          className={`execucao-stat-card cursor-pointer ${filtroStatus === 'todas' ? 'border-blue-500' : ''}`}
          onClick={() => setFiltroStatus('todas')}
        >
          <div className="execucao-stat-icon blue">
            <FaClipboardList />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total</div>
            <div className="execucao-stat-value">{stats.total}</div>
          </div>
        </div>

        <div 
          className={`execucao-stat-card cursor-pointer ${filtroStatus === 'pendente' ? 'border-yellow-500' : ''}`}
          onClick={() => setFiltroStatus('pendente')}
        >
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{stats.pendentes}</div>
          </div>
        </div>

        <div 
          className={`execucao-stat-card cursor-pointer ${filtroStatus === 'em_andamento' ? 'border-blue-500' : ''}`}
          onClick={() => setFiltroStatus('em_andamento')}
        >
          <div className="execucao-stat-icon purple">
            <FaPlay />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Em Andamento</div>
            <div className="execucao-stat-value">{stats.em_andamento}</div>
          </div>
        </div>

        <div 
          className={`execucao-stat-card cursor-pointer ${filtroStatus === 'concluida' ? 'border-green-500' : ''}`}
          onClick={() => setFiltroStatus('concluida')}
        >
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{stats.concluidas}</div>
          </div>
        </div>
      </div>

      {/* Lista de atividades */}
      {atividadesFiltradas.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaClipboardList />
            </div>
            <div className="execucao-empty-title">Nenhuma atividade encontrada</div>
            <div className="execucao-empty-text">
              {tab === 'hoje' 
                ? 'Você não tem atividades programadas para hoje.' 
                : 'Não há atividades para exibir com o filtro selecionado.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {atividadesFiltradas.map((atividade) => (
            <div 
              key={atividade.id} 
              className="execucao-card cursor-pointer hover:border-blue-500/50"
              onClick={() => carregarDetalhes(atividade)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTipoIcon(atividade.tipo_execucao)}
                    <span className="text-xs text-slate-500 uppercase">
                      {getTipoLabel(atividade.tipo_execucao)}
                    </span>
                    <span className={`execucao-activity-status ${getStatusColor(atividade.status)}`}>
                      {getStatusLabel(atividade.status)}
                    </span>
                    {atividade.prioridade === 'urgente' && (
                      <span className="execucao-badge execucao-badge-red">
                        <FaExclamationTriangle size={10} className="mr-1" />
                        Urgente
                      </span>
                    )}
                  </div>
                  
                  <h4 className="text-lg font-semibold text-slate-100 mb-2">
                    {atividade.titulo}
                  </h4>
                  
                  <div className="execucao-activity-meta">
                    <span className="execucao-activity-meta-item">
                      <FaCalendarDay size={12} />
                      {new Date(atividade.data).toLocaleDateString('pt-BR')}
                    </span>
                    {atividade.hora_inicio && atividade.hora_fim && (
                      <span className="execucao-activity-meta-item">
                        <FaClock size={12} />
                        {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim.substring(0, 5)}
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
                      className="execucao-btn execucao-btn-primary"
                    >
                      <FaPlay size={12} /> Iniciar
                    </button>
                  )}
                  {atividade.status === 'em_andamento' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlterarStatus(atividade.id, 'concluida');
                      }}
                      className="execucao-btn execucao-btn-success"
                    >
                      <FaCheck size={12} /> Concluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      {showDetalhes && atividadeSelecionada && (
        <div className="execucao-modal-overlay" onClick={() => setShowDetalhes(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                {getTipoIcon(atividadeSelecionada.tipo_execucao)}
                {atividadeSelecionada.titulo}
              </h3>
              <button 
                className="execucao-modal-close"
                onClick={() => setShowDetalhes(false)}
              >
                ×
              </button>
            </div>
            <div className="execucao-modal-body max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Status e ações */}
                <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`execucao-activity-status ${getStatusColor(atividadeSelecionada.status)}`}>
                      {getStatusLabel(atividadeSelecionada.status)}
                    </span>
                    <span className="text-sm text-slate-400">
                      {getTipoLabel(atividadeSelecionada.tipo_execucao)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {atividadeSelecionada.status === 'pendente' && (
                      <button
                        onClick={() => handleAlterarStatus(atividadeSelecionada.id, 'em_andamento')}
                        className="execucao-btn execucao-btn-primary execucao-btn-sm"
                      >
                        <FaPlay size={10} /> Iniciar
                      </button>
                    )}
                    {atividadeSelecionada.status === 'em_andamento' && (
                      <button
                        onClick={() => handleAlterarStatus(atividadeSelecionada.id, 'concluida')}
                        className="execucao-btn execucao-btn-success execucao-btn-sm"
                      >
                        <FaCheck size={10} /> Concluir
                      </button>
                    )}
                  </div>
                </div>

                {/* Informações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Data</label>
                    <p className="text-slate-200">
                      {new Date(atividadeSelecionada.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Horário</label>
                    <p className="text-slate-200">
                      {atividadeSelecionada.hora_inicio?.substring(0, 5) || '--:--'} - {atividadeSelecionada.hora_fim?.substring(0, 5) || '--:--'}
                    </p>
                  </div>
                </div>

                {atividadeSelecionada.descricao && (
                  <div>
                    <label className="text-sm text-slate-400">Descrição</label>
                    <p className="text-slate-200">{atividadeSelecionada.descricao}</p>
                  </div>
                )}

                {atividadeSelecionada.cliente_nome && (
                  <div>
                    <label className="text-sm text-slate-400">Cliente</label>
                    <p className="text-slate-200">{atividadeSelecionada.cliente_nome}</p>
                  </div>
                )}

                {atividadeSelecionada.endereco && (
                  <div>
                    <label className="text-sm text-slate-400">Endereço</label>
                    <p className="text-slate-200">{atividadeSelecionada.endereco}</p>
                  </div>
                )}

                {/* Histórico */}
                <div>
                  <h4 className="flex items-center gap-2 text-slate-100 font-semibold mb-3">
                    <FaHistory className="text-blue-400" />
                    Histórico
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {historico.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum histórico disponível.</p>
                    ) : (
                      historico.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 bg-slate-800 rounded">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-200">{item.descricao}</p>
                            <p className="text-xs text-slate-500">
                              {item.usuario?.nome_completo} - {new Date(item.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Comentários */}
                <div>
                  <h4 className="flex items-center gap-2 text-slate-100 font-semibold mb-3">
                    <FaComments className="text-green-400" />
                    Comentários
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                    {comentarios.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum comentário.</p>
                    ) : (
                      comentarios.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-800 rounded">
                          <p className="text-sm text-slate-200">{item.comentario}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.usuario?.nome_completo} - {new Date(item.created_at).toLocaleString('pt-BR')}
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
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleEnviarComentario()}
                    />
                    <button
                      onClick={handleEnviarComentario}
                      className="execucao-btn execucao-btn-primary"
                      disabled={!comentario.trim()}
                    >
                      <FaPaperPlane />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button 
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setShowDetalhes(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinhasAtividades;
