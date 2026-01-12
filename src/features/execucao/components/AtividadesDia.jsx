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
  FaEye
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

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [atividadesResult, statsResult] = await Promise.all([
        execucaoService.buscarAtividadesDoDia(),
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
    await execucaoService.alterarStatusAtividade(id, novoStatus, usuario.id);
    carregarDados();
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
                {items.map((atividade) => (
                  <div 
                    key={atividade.id} 
                    className="execucao-card cursor-pointer hover:border-blue-500/50"
                    onClick={() => setAtividadeSelecionada(atividade)}
                  >
                    <div className="flex items-start justify-between">
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
                        
                        <h4 className="text-slate-100 font-semibold mb-2">
                          {atividade.titulo}
                        </h4>
                        
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
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAtividadeSelecionada(atividade);
                          }}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          title="Ver detalhes"
                        >
                          <FaEye size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
                <div className="flex items-center gap-2">
                  <span className={`execucao-activity-status ${getStatusColor(atividadeSelecionada.status)}`}>
                    {getStatusLabel(atividadeSelecionada.status)}
                  </span>
                  <span className="text-sm text-slate-400">
                    {getTipoLabel(atividadeSelecionada.tipo_execucao)}
                  </span>
                </div>

                {atividadeSelecionada.descricao && (
                  <div>
                    <label className="text-sm text-slate-400">Descrição</label>
                    <p className="text-slate-200">{atividadeSelecionada.descricao}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">Horário</label>
                    <p className="text-slate-200">
                      {atividadeSelecionada.hora_inicio?.substring(0, 5) || '--:--'} - {atividadeSelecionada.hora_fim?.substring(0, 5) || '--:--'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Técnico</label>
                    <p className="text-slate-200">
                      {atividadeSelecionada.tecnico?.nome_completo || 'Não atribuído'}
                    </p>
                  </div>
                </div>

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

                {atividadeSelecionada.observacoes && (
                  <div>
                    <label className="text-sm text-slate-400">Observações</label>
                    <p className="text-slate-200">{atividadeSelecionada.observacoes}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button 
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setAtividadeSelecionada(null)}
              >
                Fechar
              </button>
              {atividadeSelecionada.status !== 'concluida' && (
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
    </div>
  );
};

export default AtividadesDia;
