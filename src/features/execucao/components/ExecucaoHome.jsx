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

const ExecucaoHome = ({ usuario, isAdmin, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    em_andamento: 0,
    concluidas: 0,
    urgentes: 0,
    pausadas: 0
  });
  const [atividadesHoje, setAtividadesHoje] = useState([]);
  const [atividadesPausadas, setAtividadesPausadas] = useState([]);
  const [pedidosEstoquePendentes, setPedidosEstoquePendentes] = useState([]);
  const [pedidosConcluidos, setPedidosConcluidos] = useState([]);
  
  // Estado para edição de data
  const [editandoData, setEditandoData] = useState(null); // ID da atividade sendo editada
  const [novaData, setNovaData] = useState('');
  
  // Estado para modal de detalhes
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [historicoPausas, setHistoricoPausas] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  // Buscar histórico de pausas quando uma atividade é selecionada
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

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar estatísticas do dia
      const statsResult = await execucaoService.buscarEstatisticasDia();
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      // Carregar atividades do dia (incluindo atrasadas)
      const atividadesResult = await execucaoService.buscarAtividadesDoDiaComAtrasadas();
      if (atividadesResult.success) {
        setAtividadesHoje(atividadesResult.data.slice(0, 5)); // Apenas 5 primeiras
      }

      // Carregar atividades pausadas (apenas para admin)
      if (isAdmin) {
        const pausadasResult = await execucaoService.buscarAtividadesPausadas();
        if (pausadasResult.success) {
          setAtividadesPausadas(pausadasResult.data);
        }

        // Carregar pedidos de estoque pendentes (vinculados a obras)
        const pedidosResult = await execucaoService.buscarPedidosMaterial();
        if (pedidosResult.success) {
          // Filtrar pedidos de obras que ainda não têm lista preenchida (status concluido mas sem itens)
          const pendentes = pedidosResult.data.filter(p => 
            p.obra_id && 
            p.status === 'concluido' &&
            (!p.itens || p.itens.length === 0 || p.itens.every(i => !i.nome))
          );
          setPedidosEstoquePendentes(pendentes);
          
          // Filtrar pedidos concluídos com itens preenchidos (atualizados hoje)
          const hoje = new Date().toISOString().split('T')[0];
          const concluidos = pedidosResult.data.filter(p => 
            p.obra_id && 
            p.status === 'concluido' &&
            p.itens && p.itens.length > 0 && p.itens.some(i => i.nome) &&
            p.updated_at && p.updated_at.startsWith(hoje)
          );
          setPedidosConcluidos(concluidos);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetomarAtividade = async (atividadeId) => {
    try {
      await execucaoService.alterarStatusAtividade(atividadeId, 'em_andamento', usuario?.id);
      carregarDados();
    } catch (error) {
      console.error('Erro ao retomar atividade:', error);
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
    if (!novaData) return;
    
    try {
      const result = await execucaoService.atualizarAtividade(atividadeId, {
        data_programada: novaData
      }, usuario?.id);
      
      if (result.success) {
        setEditandoData(null);
        setNovaData('');
        carregarDados();
      }
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
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
      case 'pausada': return 'pausada';
      default: return 'pendente';
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

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-blue-400" />;
      default: return <FaCalendarCheck className="text-gray-400" />;
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
      <div className="execucao-grid execucao-grid-5 mb-8">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaCalendarCheck />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Hoje</div>
            <div className="execucao-stat-value">{stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{stats.pendentes + pedidosEstoquePendentes.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
            <FaPause />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pausadas</div>
            <div className="execucao-stat-value">{stats.pausadas || 0}</div>
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

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{stats.concluidas + pedidosConcluidos.length}</div>
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
                <div 
                  key={atividade.id} 
                  className="execucao-activity-card cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => handleAbrirDetalhes(atividade)}
                >
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
                    {atividade.status === 'concluida' ? (
                      <>
                        <span className="execucao-activity-meta-item text-slate-500">
                          <FaCalendarDay size={12} />
                          Prevista: {new Date(atividade.data_programada + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className="execucao-activity-meta-item text-green-400">
                          <FaCheckCircle size={12} />
                          Concluída: {new Date(atividade.updated_at).toLocaleString('pt-BR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: '2-digit',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </>
                    ) : atividade.data_programada < new Date().toISOString().split('T')[0] ? (
                      <>
                        <span className="execucao-activity-meta-item text-red-400 font-medium">
                          <FaCalendarDay size={12} />
                          Prevista: {new Date(atividade.data_programada + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className="execucao-activity-meta-item text-red-400 font-medium animate-pulse">
                          <FaExclamationTriangle size={12} />
                          {(() => {
                            const hoje = new Date();
                            const prevista = new Date(atividade.data_programada + 'T12:00:00');
                            const diffDias = Math.floor((hoje - prevista) / (1000 * 60 * 60 * 24));
                            return `${diffDias} dia${diffDias > 1 ? 's' : ''} em atraso`;
                          })()}
                        </span>
                        {atividade.tecnico?.nome_completo && (
                          <span className="execucao-activity-meta-item">
                            <FaUsers size={12} />
                            {atividade.tecnico.nome_completo.split(' ')[0]}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
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
                      </>
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

      {/* Card de Pedidos de Estoque Pendentes - Apenas para Admin */}
      {isAdmin && pedidosEstoquePendentes.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaBox className="text-amber-400" />
              📦 Listas de Materiais Pendentes
              <span className="text-sm bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                {pedidosEstoquePendentes.length}
              </span>
            </h3>
            <button 
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate('pedido-material')}
            >
              Ver todos <FaArrowRight size={12} />
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Listas de obras aguardando preenchimento. Acesse "Pedido de Material" para incluir os itens.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosEstoquePendentes.slice(0, 4).map((pedido) => {
              const hoje = new Date().toISOString().split('T')[0];
              const atrasada = pedido.data_lista_pronta && pedido.data_lista_pronta < hoje;
              
              return (
                <div 
                  key={pedido.id} 
                  className={`rounded-xl p-4 border-2 ${
                    atrasada 
                      ? 'bg-red-900/20 border-red-500/50' 
                      : 'bg-amber-900/20 border-amber-500/30'
                  }`}
                >
                  {/* Nome do Cliente */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      atrasada ? 'bg-red-500/20' : 'bg-amber-500/20'
                    }`}>
                      <FaClipboardList className={atrasada ? 'text-red-400' : 'text-amber-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-slate-100 font-bold truncate">
                        {pedido.cliente_nome || 'Cliente não definido'}
                      </h4>
                      {pedido.endereco_obra && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                          <FaMapMarkerAlt size={8} />
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

                  {/* Data Limite */}
                  <div className={`flex items-center gap-2 p-2 rounded-lg mb-3 ${
                    atrasada ? 'bg-red-500/10' : 'bg-slate-700/50'
                  }`}>
                    <FaCalendarAlt className={atrasada ? 'text-red-400' : 'text-amber-400'} size={12} />
                    <span className="text-xs text-slate-400">Lista até:</span>
                    <span className={`text-sm font-semibold ${atrasada ? 'text-red-400' : 'text-slate-100'}`}>
                      {pedido.data_lista_pronta 
                        ? new Date(pedido.data_lista_pronta + 'T12:00:00').toLocaleDateString('pt-BR')
                        : 'Não definida'
                      }
                    </span>
                  </div>

                  {/* Botão de Ação */}
                  <button
                    onClick={() => onNavigate('pedido-material')}
                    className={`w-full py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      atrasada
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    <FaClipboardList size={12} />
                    Preencher Lista
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card de Listas de Materiais Concluídas Hoje */}
      {pedidosConcluidos.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaCheckCircle className="text-green-400" />
              ✅ Listas de Materiais Concluídas Hoje
              <span className="text-sm bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {pedidosConcluidos.length}
              </span>
            </h3>
            <button 
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              onClick={() => onNavigate('pedido-material')}
            >
              Ver todos <FaArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosConcluidos.slice(0, 4).map((pedido) => (
              <div 
                key={pedido.id} 
                className="rounded-xl p-4 border-2 bg-green-900/20 border-green-500/30"
              >
                {/* Nome do Cliente */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/20">
                    <FaCheckCircle className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-slate-100 font-bold truncate">
                      {pedido.cliente_nome || 'Cliente não definido'}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {pedido.itens?.filter(i => i.nome).length || 0} itens na lista
                    </p>
                  </div>
                  <span className="text-xs bg-green-500/30 text-green-400 px-2 py-1 rounded-full font-semibold">
                    Concluída
                  </span>
                </div>

                {/* Data Limite de Materiais */}
                {pedido.data_material_disponivel && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50">
                    <FaCalendarAlt className="text-green-400" size={12} />
                    <span className="text-xs text-slate-400">Materiais até:</span>
                    <span className="text-sm font-semibold text-slate-100">
                      {new Date(pedido.data_material_disponivel + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progresso do Dia */}
      <div className="execucao-card mt-6">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">
            Progresso do Dia
          </h3>
          <span className="text-sm text-slate-400">
            {(stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length) > 0 
              ? Math.round(((stats.concluidas + pedidosConcluidos.length) / (stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length)) * 100) 
              : 0}% concluído
          </span>
        </div>

        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ 
              width: `${(stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length) > 0 
                ? ((stats.concluidas + pedidosConcluidos.length) / (stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length)) * 100 
                : 0}%` 
            }}
          />
        </div>

        <div className="flex justify-between mt-3 text-sm">
          <span className="text-slate-400">
            {stats.concluidas + pedidosConcluidos.length} de {stats.total + pedidosConcluidos.length + pedidosEstoquePendentes.length} atividades
          </span>
          <span className="text-slate-400">
            {(stats.total - stats.concluidas) + pedidosEstoquePendentes.length} restantes
          </span>
        </div>
      </div>

      {/* Card de Tarefas Pausadas - Apenas para Admin */}
      {isAdmin && atividadesPausadas.length > 0 && (
        <div className="execucao-card mt-6">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title flex items-center gap-2">
              <FaPause className="text-orange-400" />
              Tarefas Pausadas
              <span className="text-sm bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                {atividadesPausadas.length}
              </span>
            </h3>
          </div>

          <div className="space-y-4">
            {atividadesPausadas.map((atividade) => (
              <div 
                key={atividade.id} 
                className="bg-slate-800/50 border border-orange-500/30 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getTipoIcon(atividade.tipo_execucao)}
                      <span className="text-slate-100 font-semibold">{atividade.titulo}</span>
                      <span className="execucao-activity-status pausada">Pausada</span>
                    </div>
                    {atividade.cliente_nome && (
                      <p className="text-sm text-sky-400">🏢 {atividade.cliente_nome}</p>
                    )}
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex items-center gap-2">
                    {editandoData === atividade.id ? (
                      <>
                        <input
                          type="date"
                          value={novaData}
                          onChange={(e) => setNovaData(e.target.value)}
                          className="bg-slate-700 border border-orange-500 rounded px-2 py-1.5 text-sm text-slate-200 
                            focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <button
                          onClick={() => handleSalvarNovaData(atividade.id)}
                          className="execucao-btn execucao-btn-sm"
                          style={{ backgroundColor: '#22c55e', color: '#fff' }}
                          title="Confirmar nova data"
                        >
                          <FaCheck size={10} /> Salvar
                        </button>
                        <button
                          onClick={handleCancelarEdicaoData}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          title="Cancelar"
                        >
                          <FaTimes size={10} />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Mostrar botão Alterar Data apenas se o técnico solicitou */}
                        {atividade.pausa_info?.descricao?.includes('SOLICITAÇÃO: Atualizar data no planejamento') && (
                          <button
                            onClick={() => handleIniciarEdicaoData(atividade)}
                            className="execucao-btn execucao-btn-sm"
                            style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.5)' }}
                            title="Alterar data da atividade (solicitado pelo técnico)"
                          >
                            <FaCalendarAlt size={10} /> Alterar Data
                          </button>
                        )}
                        <button
                          onClick={() => handleRetomarAtividade(atividade.id)}
                          className="execucao-btn execucao-btn-primary execucao-btn-sm"
                          title="Retomar atividade"
                        >
                          <FaPlay size={10} /> Retomar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Informações do técnico e data */}
                <div className="flex gap-4 text-xs text-slate-400 mb-3 items-center flex-wrap">
                  {atividade.tecnico?.nome_completo && (
                    <span className="flex items-center gap-1">
                      <FaUsers size={10} />
                      {atividade.tecnico.nome_completo}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FaCalendarAlt size={10} />
                    {new Date(atividade.data_programada + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {/* Justificativa da pausa */}
                {atividade.pausa_info && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FaExclamationTriangle size={12} className="text-orange-400" />
                      <span className="text-xs text-orange-400 font-medium uppercase">
                        Motivo da Pausa
                      </span>
                      <span className="text-xs text-slate-500">
                        - {new Date(atividade.pausa_info.created_at).toLocaleString('pt-BR')}
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
            ))}
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Atividade */}
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
                      <div className="space-y-3 max-h-48 overflow-y-auto">
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
                            {registro.descricao && (
                              <p className="text-sm text-slate-300">
                                {registro.descricao.replace('Atividade pausada. Motivo: ', '').replace('Atividade retomada', 'Retomada')}
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
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button 
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setAtividadeSelecionada(null)}
              >
                Fechar
              </button>
              <button 
                className="execucao-btn"
                onClick={() => {
                  setAtividadeSelecionada(null);
                  onNavigate(isAdmin ? 'atividades-dia' : 'minhas-atividades');
                }}
              >
                Ver em Atividades <FaArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecucaoHome;
