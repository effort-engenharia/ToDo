import React, { useState, useEffect } from 'react';
import { 
  FaPlus, 
  FaSearch, 
  FaCalendarAlt,
  FaEdit,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaFlag,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

const PlanejamentoMacro = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [planejamentos, setPlanejamentos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [planejamentoSelecionado, setPlanejamentoSelecionado] = useState(null);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [visualizacao, setVisualizacao] = useState('kanban'); // kanban, timeline, lista

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    responsavel_id: '',
    tipo_projeto: 'eletrica',
    prioridade: 'media',
    progresso: 0,
    status: 'planejado'
  });

  const [tecnicos, setTecnicos] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [mesAtual]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [planejamentosResult, tecnicosResult] = await Promise.all([
        execucaoService.listarPlanejamentoMacro(mesAtual.getFullYear(), mesAtual.getMonth() + 1),
        execucaoService.listarTecnicos()
      ]);

      if (planejamentosResult.success) {
        setPlanejamentos(planejamentosResult.data);
      }
      if (tecnicosResult.success) {
        setTecnicos(tecnicosResult.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let result;
    if (planejamentoSelecionado) {
      result = await execucaoService.atualizarPlanejamentoMacro(planejamentoSelecionado.id, formData);
    } else {
      result = await execucaoService.criarPlanejamentoMacro(formData);
    }

    if (result.success) {
      setShowModal(false);
      setPlanejamentoSelecionado(null);
      resetForm();
      carregarDados();
    }
  };

  const handleExcluir = async (id) => {
    if (confirm('Deseja realmente excluir este planejamento?')) {
      const result = await execucaoService.excluirPlanejamentoMacro(id);
      if (result.success) {
        carregarDados();
      }
    }
  };

  const handleEditar = (planejamento) => {
    setPlanejamentoSelecionado(planejamento);
    setFormData({
      titulo: planejamento.titulo || '',
      descricao: planejamento.descricao || '',
      data_inicio: planejamento.data_inicio || '',
      data_fim: planejamento.data_fim || '',
      responsavel_id: planejamento.responsavel_id || '',
      tipo_projeto: planejamento.tipo_projeto || 'eletrica',
      prioridade: planejamento.prioridade || 'media',
      progresso: planejamento.progresso || 0,
      status: planejamento.status || 'planejado'
    });
    setShowModal(true);
  };

  const handleAtualizarProgresso = async (id, novoProgresso) => {
    const result = await execucaoService.atualizarPlanejamentoMacro(id, { 
      progresso: novoProgresso,
      status: novoProgresso >= 100 ? 'concluido' : 'em_andamento'
    });
    if (result.success) {
      carregarDados();
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      data_inicio: '',
      data_fim: '',
      responsavel_id: '',
      tipo_projeto: 'eletrica',
      prioridade: 'media',
      progresso: 0,
      status: 'planejado'
    });
  };

  const navegarMes = (direcao) => {
    setMesAtual(prev => {
      const novaData = new Date(prev);
      novaData.setMonth(novaData.getMonth() + direcao);
      return novaData;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planejado': return 'blue';
      case 'em_andamento': return 'yellow';
      case 'concluido': return 'green';
      case 'atrasado': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'planejado': return 'Planejado';
      case 'em_andamento': return 'Em Andamento';
      case 'concluido': return 'Concluído';
      case 'atrasado': return 'Atrasado';
      default: return status;
    }
  };

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'baixa': return 'text-blue-400';
      case 'media': return 'text-yellow-400';
      case 'alta': return 'text-orange-400';
      case 'urgente': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Agrupar por status para Kanban
  const planejamentosPorStatus = {
    planejado: planejamentos.filter(p => p.status === 'planejado'),
    em_andamento: planejamentos.filter(p => p.status === 'em_andamento'),
    concluido: planejamentos.filter(p => p.status === 'concluido'),
    atrasado: planejamentos.filter(p => p.status === 'atrasado')
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {/* Navegação de mês */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navegarMes(-1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronLeft />
          </button>
          <div className="text-lg font-semibold text-slate-100">
            {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => navegarMes(1)}
            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
          >
            <FaChevronRight />
          </button>
        </div>

        {/* Controles */}
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              className={`px-3 py-2 text-sm ${visualizacao === 'kanban' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              onClick={() => setVisualizacao('kanban')}
            >
              Kanban
            </button>
            <button
              className={`px-3 py-2 text-sm ${visualizacao === 'lista' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              onClick={() => setVisualizacao('lista')}
            >
              Lista
            </button>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setPlanejamentoSelecionado(null);
              setShowModal(true);
            }}
            className="execucao-btn execucao-btn-primary"
          >
            <FaPlus /> Nova Meta
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaTasks />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total</div>
            <div className="execucao-stat-value">{planejamentos.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Em Andamento</div>
            <div className="execucao-stat-value">{planejamentosPorStatus.em_andamento.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídos</div>
            <div className="execucao-stat-value">{planejamentosPorStatus.concluido.length}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon red">
            <FaExclamationCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Atrasados</div>
            <div className="execucao-stat-value">{planejamentosPorStatus.atrasado.length}</div>
          </div>
        </div>
      </div>

      {/* Visualização Kanban */}
      {visualizacao === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(planejamentosPorStatus).map(([status, items]) => (
            <div key={status} className="execucao-card">
              <div className="execucao-card-header mb-4">
                <h3 className={`execucao-card-title text-sm`}>
                  <span className={`w-2 h-2 rounded-full bg-${getStatusColor(status)}-500`}></span>
                  {getStatusLabel(status)}
                  <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded-full text-xs">
                    {items.length}
                  </span>
                </h3>
              </div>
              
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 hover:border-blue-500/50 cursor-pointer"
                    onClick={() => handleEditar(item)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-100 line-clamp-2">
                        {item.titulo}
                      </h4>
                      <FaFlag className={getPrioridadeColor(item.prioridade)} size={10} />
                    </div>
                    
                    {item.responsavel && (
                      <div className="text-xs text-slate-400 mb-2">
                        {item.responsavel.nome_completo}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Progresso</span>
                        <span>{item.progresso}%</span>
                      </div>
                      <div className="execucao-progress h-1.5">
                        <div 
                          className={`execucao-progress-bar bg-${getStatusColor(status)}-500`}
                          style={{ width: `${item.progresso}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                      <span>
                        {item.data_fim ? new Date(item.data_fim).toLocaleDateString('pt-BR') : 'Sem prazo'}
                      </span>
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Nenhum item
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visualização Lista */}
      {visualizacao === 'lista' && (
        <div className="execucao-card">
          <div className="overflow-x-auto">
            <table className="execucao-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Responsável</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {planejamentos.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FaFlag className={getPrioridadeColor(item.prioridade)} size={10} />
                        <span className="text-slate-100">{item.titulo}</span>
                      </div>
                    </td>
                    <td>{item.responsavel?.nome_completo || '-'}</td>
                    <td>{item.data_inicio ? new Date(item.data_inicio).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>{item.data_fim ? new Date(item.data_fim).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>
                      <span className={`execucao-badge execucao-badge-${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="execucao-progress w-20">
                          <div 
                            className={`execucao-progress-bar bg-${getStatusColor(item.status)}-500`}
                            style={{ width: `${item.progresso}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-slate-400">{item.progresso}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditar(item)}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        >
                          <FaEdit size={10} />
                        </button>
                        <button
                          onClick={() => handleExcluir(item.id)}
                          className="execucao-btn execucao-btn-danger execucao-btn-sm"
                        >
                          <FaTrash size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Novo/Editar */}
      {showModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaCalendarAlt className="text-blue-400" />
                {planejamentoSelecionado ? 'Editar Meta' : 'Nova Meta de Planejamento'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Título</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      placeholder="Título da meta"
                      value={formData.titulo}
                      onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Descrição</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="3"
                      placeholder="Descrição detalhada..."
                      value={formData.descricao}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data Início</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Data Fim</label>
                      <input
                        type="date"
                        className="execucao-form-input"
                        value={formData.data_fim}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Responsável</label>
                      <select
                        className="execucao-form-select"
                        value={formData.responsavel_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, responsavel_id: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome_completo}</option>
                        ))}
                      </select>
                    </div>

                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Tipo de Projeto</label>
                      <select
                        className="execucao-form-select"
                        value={formData.tipo_projeto}
                        onChange={(e) => setFormData(prev => ({ ...prev, tipo_projeto: e.target.value }))}
                      >
                        <option value="eletrica">Elétrica</option>
                        <option value="civil">Civil</option>
                        <option value="galpao">Galpão</option>
                        <option value="misto">Misto</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Prioridade</label>
                      <select
                        className="execucao-form-select"
                        value={formData.prioridade}
                        onChange={(e) => setFormData(prev => ({ ...prev, prioridade: e.target.value }))}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>

                    {planejamentoSelecionado && (
                      <div className="execucao-form-group">
                        <label className="execucao-form-label">Status</label>
                        <select
                          className="execucao-form-select"
                          value={formData.status}
                          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="planejado">Planejado</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluido">Concluído</option>
                          <option value="atrasado">Atrasado</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {planejamentoSelecionado && (
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Progresso: {formData.progresso}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={formData.progresso}
                        onChange={(e) => setFormData(prev => ({ ...prev, progresso: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  )}
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
                  {planejamentoSelecionado ? 'Salvar Alterações' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanejamentoMacro;
