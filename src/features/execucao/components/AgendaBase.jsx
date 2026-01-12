import React, { useState, useEffect } from 'react';
import { 
  FaPlus, 
  FaCalendarAlt, 
  FaClock, 
  FaMapMarkerAlt,
  FaUser,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaFilter,
  FaSearch
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

const AgendaBase = ({ 
  usuario, 
  tipoExecucao, 
  titulo, 
  iconColor = 'text-blue-400' 
}) => {
  const [loading, setLoading] = useState(true);
  const [atividades, setAtividades] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_programada: new Date().toISOString().split('T')[0],
    hora_inicio: '08:00',
    hora_fim: '17:00',
    prioridade: 'normal',
    tecnico_responsavel_id: '',
    cliente_nome: '',
    endereco: '',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
    carregarTecnicos();
  }, [filtroStatus, filtroPeriodo]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const filtros = { tipo_execucao: tipoExecucao };
      
      if (filtroStatus !== 'todos') {
        filtros.status = filtroStatus;
      }

      // Calcular datas baseado no período
      const hoje = new Date();
      if (filtroPeriodo === 'hoje') {
        filtros.data_programada = hoje.toISOString().split('T')[0];
      } else if (filtroPeriodo === 'semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);
        filtros.data_inicio = inicioSemana.toISOString().split('T')[0];
        filtros.data_fim = fimSemana.toISOString().split('T')[0];
      } else if (filtroPeriodo === 'mes') {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        filtros.data_inicio = inicioMes.toISOString().split('T')[0];
        filtros.data_fim = fimMes.toISOString().split('T')[0];
      }

      const result = await execucaoService.buscarAtividades(filtros);
      if (result.success) {
        setAtividades(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTecnicos = async () => {
    const result = await execucaoService.buscarTecnicos();
    if (result.success) {
      setTecnicos(result.data);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dados = {
        ...formData,
        tipo_execucao: tipoExecucao
      };

      if (atividadeEditando) {
        await execucaoService.atualizarAtividade(atividadeEditando.id, dados, usuario.id);
      } else {
        await execucaoService.criarAtividade(dados, usuario.id);
      }

      setShowModal(false);
      resetForm();
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar atividade:', error);
    }
  };

  const handleEditar = (atividade) => {
    setAtividadeEditando(atividade);
    setFormData({
      titulo: atividade.titulo || '',
      descricao: atividade.descricao || '',
      data_programada: atividade.data_programada || new Date().toISOString().split('T')[0],
      hora_inicio: atividade.hora_inicio?.substring(0, 5) || '08:00',
      hora_fim: atividade.hora_fim?.substring(0, 5) || '17:00',
      prioridade: atividade.prioridade || 'normal',
      tecnico_responsavel_id: atividade.tecnico_responsavel_id || '',
      cliente_nome: atividade.cliente_nome || '',
      endereco: atividade.endereco || '',
      observacoes: atividade.observacoes || ''
    });
    setShowModal(true);
  };

  const handleExcluir = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta atividade?')) {
      await execucaoService.excluirAtividade(id);
      carregarDados();
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    await execucaoService.alterarStatusAtividade(id, novoStatus, usuario.id);
    carregarDados();
  };

  const resetForm = () => {
    setAtividadeEditando(null);
    setFormData({
      titulo: '',
      descricao: '',
      data_programada: new Date().toISOString().split('T')[0],
      hora_inicio: '08:00',
      hora_fim: '17:00',
      prioridade: 'normal',
      tecnico_responsavel_id: '',
      cliente_nome: '',
      endereco: '',
      observacoes: ''
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente': return 'pendente';
      case 'em_andamento': return 'em-andamento';
      case 'concluida': return 'concluida';
      case 'urgente': return 'urgente';
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

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'baixa': return 'text-slate-400';
      case 'normal': return 'text-blue-400';
      case 'alta': return 'text-orange-400';
      case 'urgente': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  // Filtrar por busca
  const atividadesFiltradas = atividades.filter(a => 
    a.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    a.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    a.tecnico?.nome_completo?.toLowerCase().includes(busca.toLowerCase())
  );

  // Agrupar por data
  const atividadesAgrupadas = atividadesFiltradas.reduce((acc, atividade) => {
    const data = atividade.data_programada;
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(atividade);
    return acc;
  }, {});

  const formatarData = (dataStr) => {
    const data = new Date(dataStr + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    if (data.toDateString() === hoje.toDateString()) {
      return 'Hoje';
    }
    if (data.toDateString() === amanha.toDateString()) {
      return 'Amanhã';
    }
    return data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="execucao-animate-fade-in">
      {/* Header com filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {/* Filtro de período */}
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="execucao-select"
            style={{ width: 'auto' }}
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="todos">Todos</option>
          </select>

          {/* Filtro de status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="execucao-select"
            style={{ width: 'auto' }}
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>

        <div className="flex gap-2">
          {/* Busca */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
            <FaSearch className="text-slate-500" size={14} />
            <input 
              type="text"
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-300 text-sm w-40 placeholder-slate-500"
            />
          </div>

          {/* Botão adicionar */}
          <button 
            className="execucao-btn execucao-btn-primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <FaPlus /> Nova Atividade
          </button>
        </div>
      </div>

      {/* Lista de atividades */}
      {loading ? (
        <div className="execucao-loading">
          <div className="execucao-spinner"></div>
        </div>
      ) : Object.keys(atividadesAgrupadas).length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaCalendarAlt />
            </div>
            <div className="execucao-empty-title">Nenhuma atividade encontrada</div>
            <div className="execucao-empty-text">
              Não há atividades para o período selecionado.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(atividadesAgrupadas).sort().map(([data, items]) => (
            <div key={data}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">
                {formatarData(data)}
              </h3>
              <div className="space-y-3">
                {items.map((atividade) => (
                  <div key={atividade.id} className="execucao-activity-card">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                          {atividade.hora_inicio && (
                            <span className="execucao-activity-meta-item">
                              <FaClock size={12} />
                              {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim?.substring(0, 5) || ''}
                            </span>
                          )}
                          {atividade.cliente_nome && (
                            <span className="execucao-activity-meta-item">
                              <FaUser size={12} />
                              {atividade.cliente_nome}
                            </span>
                          )}
                          {atividade.endereco && (
                            <span className="execucao-activity-meta-item">
                              <FaMapMarkerAlt size={12} />
                              {atividade.endereco.substring(0, 30)}...
                            </span>
                          )}
                          {atividade.tecnico?.nome_completo && (
                            <span className="execucao-activity-meta-item">
                              <FaUser size={12} />
                              {atividade.tecnico.nome_completo}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {atividade.status !== 'concluida' && (
                          <button
                            onClick={() => handleAlterarStatus(atividade.id, 'concluida')}
                            className="execucao-btn execucao-btn-success execucao-btn-sm"
                            title="Concluir"
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditar(atividade)}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleExcluir(atividade.id)}
                          className="execucao-btn execucao-btn-danger execucao-btn-sm"
                          title="Excluir"
                        >
                          <FaTrash />
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

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="execucao-modal" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                {atividadeEditando ? 'Editar Atividade' : 'Nova Atividade'}
              </h3>
              <button 
                className="execucao-modal-close"
                onClick={() => setShowModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="execucao-modal-body space-y-4">
                <div>
                  <label className="execucao-label">Título *</label>
                  <input
                    type="text"
                    className="execucao-input"
                    value={formData.titulo}
                    onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="execucao-label">Data *</label>
                    <input
                      type="date"
                      className="execucao-input"
                      value={formData.data_programada}
                      onChange={(e) => setFormData({...formData, data_programada: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="execucao-label">Prioridade</label>
                    <select
                      className="execucao-select"
                      value={formData.prioridade}
                      onChange={(e) => setFormData({...formData, prioridade: e.target.value})}
                    >
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="execucao-label">Hora Início</label>
                    <input
                      type="time"
                      className="execucao-input"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="execucao-label">Hora Fim</label>
                    <input
                      type="time"
                      className="execucao-input"
                      value={formData.hora_fim}
                      onChange={(e) => setFormData({...formData, hora_fim: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="execucao-label">Técnico Responsável</label>
                  <select
                    className="execucao-select"
                    value={formData.tecnico_responsavel_id}
                    onChange={(e) => setFormData({...formData, tecnico_responsavel_id: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {tecnicos.map(t => (
                      <option key={t.id} value={t.id}>{t.nome_completo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="execucao-label">Cliente</label>
                  <input
                    type="text"
                    className="execucao-input"
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData({...formData, cliente_nome: e.target.value})}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <label className="execucao-label">Endereço</label>
                  <input
                    type="text"
                    className="execucao-input"
                    value={formData.endereco}
                    onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                    placeholder="Endereço completo"
                  />
                </div>

                <div>
                  <label className="execucao-label">Descrição</label>
                  <textarea
                    className="execucao-input"
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Descrição da atividade"
                  />
                </div>

                <div>
                  <label className="execucao-label">Observações</label>
                  <textarea
                    className="execucao-input"
                    rows={2}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    placeholder="Observações adicionais"
                  />
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button 
                  type="button" 
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn execucao-btn-primary">
                  {atividadeEditando ? 'Salvar' : 'Criar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaBase;
