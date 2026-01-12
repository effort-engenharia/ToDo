import React, { useState, useEffect } from 'react';
import { 
  FaCalendarCheck, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaArrowRight,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaUsers
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

const ExecucaoHome = ({ usuario, isAdmin, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    em_andamento: 0,
    concluidas: 0,
    urgentes: 0
  });
  const [atividadesHoje, setAtividadesHoje] = useState([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar estatísticas do dia
      const statsResult = await execucaoService.buscarEstatisticasDia();
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      // Carregar atividades do dia
      const atividadesResult = await execucaoService.buscarAtividadesDoDia();
      if (atividadesResult.success) {
        setAtividadesHoje(atividadesResult.data.slice(0, 5)); // Apenas 5 primeiras
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
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

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-blue-400" />;
      default: return <FaCalendarCheck className="text-gray-400" />;
    }
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
      {/* Saudação */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-1">
          {getGreeting()}, {usuario?.nome_completo?.split(' ')[0] || 'Usuário'}! 👋
        </h2>
        <p className="text-slate-400">
          {isAdmin 
            ? 'Aqui está o resumo das atividades de hoje da equipe de execução.'
            : 'Confira suas atividades programadas para hoje.'
          }
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="execucao-grid execucao-grid-4 mb-8">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaCalendarCheck />
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

      {/* Grid de conteúdo */}
      <div className="execucao-grid execucao-grid-2 gap-6">
        {/* Atividades de Hoje */}
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaCalendarCheck className="execucao-card-icon" />
              Atividades de Hoje
            </h3>
            <button 
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate(isAdmin ? 'atividades-dia' : 'minhas-atividades')}
            >
              Ver todas <FaArrowRight size={12} />
            </button>
          </div>

          {atividadesHoje.length === 0 ? (
            <div className="execucao-empty-state">
              <div className="execucao-empty-icon">
                <FaCalendarCheck />
              </div>
              <div className="execucao-empty-title">Nenhuma atividade</div>
              <div className="execucao-empty-text">
                Não há atividades programadas para hoje.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {atividadesHoje.map((atividade) => (
                <div key={atividade.id} className="execucao-activity-card">
                  <div className="execucao-activity-header">
                    <div className="flex items-center gap-2">
                      {getTipoIcon(atividade.tipo_execucao)}
                      <span className="execucao-activity-title">{atividade.titulo}</span>
                    </div>
                    <span className={`execucao-activity-status ${getStatusColor(atividade.status)}`}>
                      {getStatusLabel(atividade.status)}
                    </span>
                  </div>
                  <div className="execucao-activity-meta">
                    {atividade.hora_inicio && (
                      <span className="execucao-activity-meta-item">
                        <FaClock size={12} />
                        {atividade.hora_inicio.substring(0, 5)}
                      </span>
                    )}
                    {atividade.tecnico?.nome_completo && (
                      <span className="execucao-activity-meta-item">
                        <FaUsers size={12} />
                        {atividade.tecnico.nome_completo.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos Rápidos */}
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              Acesso Rápido
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isAdmin ? (
              <>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white"
                  onClick={() => onNavigate('agenda-eletrica')}
                >
                  <FaBolt size={24} className="text-yellow-400" />
                  <span className="text-sm font-medium">Agenda Elétrica</span>
                </button>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white"
                  onClick={() => onNavigate('agenda-civil')}
                >
                  <FaHardHat size={24} className="text-orange-400" />
                  <span className="text-sm font-medium">Agenda Civil</span>
                </button>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white"
                  onClick={() => onNavigate('agenda-galpao')}
                >
                  <FaWarehouse size={24} className="text-blue-400" />
                  <span className="text-sm font-medium">Agenda Galpão</span>
                </button>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white"
                  onClick={() => onNavigate('pops')}
                >
                  <FaCalendarCheck size={24} className="text-purple-400" />
                  <span className="text-sm font-medium">POPs</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white col-span-2"
                  onClick={() => onNavigate('minhas-atividades')}
                >
                  <FaCalendarCheck size={24} className="text-blue-400" />
                  <span className="text-sm font-medium">Minhas Atividades</span>
                </button>
                <button 
                  className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-all flex flex-col items-center gap-2 text-slate-300 hover:text-white col-span-2"
                  onClick={() => onNavigate('pops')}
                >
                  <FaCalendarCheck size={24} className="text-purple-400" />
                  <span className="text-sm font-medium">Procedimentos (POPs)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progresso do Dia */}
      <div className="execucao-card mt-6">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">
            Progresso do Dia
          </h3>
          <span className="text-sm text-slate-400">
            {stats.total > 0 ? Math.round((stats.concluidas / stats.total) * 100) : 0}% concluído
          </span>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ 
              width: `${stats.total > 0 ? (stats.concluidas / stats.total) * 100 : 0}%` 
            }}
          />
        </div>

        <div className="flex justify-between mt-3 text-sm">
          <span className="text-slate-400">
            {stats.concluidas} de {stats.total} atividades
          </span>
          <span className="text-slate-400">
            {stats.pendentes + stats.em_andamento} restantes
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExecucaoHome;
