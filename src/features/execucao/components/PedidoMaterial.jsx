import React, { useState, useEffect } from 'react';
import { 
  FaPlus, 
  FaSearch, 
  FaBox, 
  FaTrash,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaTruck,
  FaEdit,
  FaEye,
  FaFilter
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

const PedidoMaterial = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [formData, setFormData] = useState({
    descricao: '',
    urgencia: 'normal',
    itens: [{ nome: '', quantidade: 1, unidade: 'un' }],
    observacoes: ''
  });

  useEffect(() => {
    carregarPedidos();
  }, []);

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const result = await execucaoService.listarPedidosMaterial();
      if (result.success) {
        setPedidos(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const dados = {
      ...formData,
      solicitante_id: usuario.id
    };

    let result;
    if (pedidoSelecionado) {
      result = await execucaoService.atualizarPedidoMaterial(pedidoSelecionado.id, dados);
    } else {
      result = await execucaoService.criarPedidoMaterial(dados);
    }

    if (result.success) {
      setShowModal(false);
      setPedidoSelecionado(null);
      resetForm();
      carregarPedidos();
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    const result = await execucaoService.alterarStatusPedido(id, novoStatus, usuario.id);
    if (result.success) {
      carregarPedidos();
    }
  };

  const handleExcluir = async (id) => {
    if (confirm('Deseja realmente excluir este pedido?')) {
      const result = await execucaoService.excluirPedidoMaterial(id);
      if (result.success) {
        carregarPedidos();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      urgencia: 'normal',
      itens: [{ nome: '', quantidade: 1, unidade: 'un' }],
      observacoes: ''
    });
  };

  const handleEditar = (pedido) => {
    setPedidoSelecionado(pedido);
    setFormData({
      descricao: pedido.descricao || '',
      urgencia: pedido.urgencia || 'normal',
      itens: pedido.itens || [{ nome: '', quantidade: 1, unidade: 'un' }],
      observacoes: pedido.observacoes || ''
    });
    setShowModal(true);
  };

  const adicionarItem = () => {
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, { nome: '', quantidade: 1, unidade: 'un' }]
    }));
  };

  const removerItem = (index) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const atualizarItem = (index, campo, valor) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.map((item, i) => 
        i === index ? { ...item, [campo]: valor } : item
      )
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pendente': return <FaClock className="text-yellow-400" />;
      case 'aprovado': return <FaCheckCircle className="text-green-400" />;
      case 'recusado': return <FaTimesCircle className="text-red-400" />;
      case 'entregue': return <FaTruck className="text-blue-400" />;
      default: return <FaClock className="text-gray-400" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'aprovado': return 'Aprovado';
      case 'recusado': return 'Recusado';
      case 'entregue': return 'Entregue';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente': return 'yellow';
      case 'aprovado': return 'green';
      case 'recusado': return 'red';
      case 'entregue': return 'blue';
      default: return 'gray';
    }
  };

  const getUrgenciaColor = (urgencia) => {
    switch (urgencia) {
      case 'baixa': return 'blue';
      case 'normal': return 'gray';
      case 'alta': return 'orange';
      case 'urgente': return 'red';
      default: return 'gray';
    }
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(p => {
    const matchBusca = p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
                       p.solicitante?.nome_completo?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
    return matchBusca && matchStatus;
  });

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
        <div className="flex-1 flex gap-4">
          <div className="execucao-search flex-1 max-w-md">
            <FaSearch className="execucao-search-icon" />
            <input
              type="text"
              placeholder="Buscar pedidos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="execucao-search-input"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="execucao-form-select text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="recusado">Recusados</option>
              <option value="entregue">Entregues</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setPedidoSelecionado(null);
            setShowModal(true);
          }}
          className="execucao-btn execucao-btn-primary"
        >
          <FaPlus /> Novo Pedido
        </button>
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaBox />
            </div>
            <div className="execucao-empty-title">Nenhum pedido encontrado</div>
            <div className="execucao-empty-text">
              {busca ? 'Tente ajustar sua busca.' : 'Clique em "Novo Pedido" para solicitar materiais.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => (
            <div key={pedido.id} className="execucao-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(pedido.status)}
                    <h4 className="text-slate-100 font-semibold">
                      {pedido.descricao || 'Pedido de Material'}
                    </h4>
                    <span className={`execucao-badge execucao-badge-${getStatusColor(pedido.status)}`}>
                      {getStatusLabel(pedido.status)}
                    </span>
                    <span className={`execucao-badge execucao-badge-${getUrgenciaColor(pedido.urgencia)}`}>
                      {pedido.urgencia}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>
                      Solicitante: {pedido.solicitante?.nome_completo || 'N/A'}
                    </span>
                    <span>
                      Data: {new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR')}
                    </span>
                    <span>
                      Itens: {pedido.itens?.length || 0}
                    </span>
                  </div>

                  {pedido.itens && pedido.itens.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pedido.itens.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                          {item.quantidade} {item.unidade} - {item.nome}
                        </span>
                      ))}
                      {pedido.itens.length > 3 && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">
                          +{pedido.itens.length - 3} itens
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditar(pedido)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Editar"
                  >
                    <FaEdit />
                  </button>
                  
                  {pedido.status === 'pendente' && (
                    <>
                      <button
                        onClick={() => handleAlterarStatus(pedido.id, 'aprovado')}
                        className="execucao-btn execucao-btn-success execucao-btn-sm"
                        title="Aprovar"
                      >
                        <FaCheckCircle />
                      </button>
                      <button
                        onClick={() => handleAlterarStatus(pedido.id, 'recusado')}
                        className="execucao-btn execucao-btn-danger execucao-btn-sm"
                        title="Recusar"
                      >
                        <FaTimesCircle />
                      </button>
                    </>
                  )}

                  {pedido.status === 'aprovado' && (
                    <button
                      onClick={() => handleAlterarStatus(pedido.id, 'entregue')}
                      className="execucao-btn execucao-btn-primary execucao-btn-sm"
                      title="Marcar como Entregue"
                    >
                      <FaTruck />
                    </button>
                  )}

                  <button
                    onClick={() => handleExcluir(pedido.id)}
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
      )}

      {/* Modal de Novo/Editar Pedido */}
      {showModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaBox className="text-blue-400" />
                {pedidoSelecionado ? 'Editar Pedido' : 'Novo Pedido de Material'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Descrição</label>
                      <input
                        type="text"
                        className="execucao-form-input"
                        placeholder="Descrição do pedido"
                        value={formData.descricao}
                        onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Urgência</label>
                      <select
                        className="execucao-form-select"
                        value={formData.urgencia}
                        onChange={(e) => setFormData(prev => ({ ...prev, urgencia: e.target.value }))}
                      >
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div className="execucao-form-group">
                    <div className="flex items-center justify-between mb-2">
                      <label className="execucao-form-label">Itens</label>
                      <button
                        type="button"
                        onClick={adicionarItem}
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                      >
                        <FaPlus size={10} /> Adicionar
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formData.itens.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="execucao-form-input flex-1"
                            placeholder="Nome do item"
                            value={item.nome}
                            onChange={(e) => atualizarItem(index, 'nome', e.target.value)}
                            required
                          />
                          <input
                            type="number"
                            className="execucao-form-input w-20"
                            placeholder="Qtd"
                            min="1"
                            value={item.quantidade}
                            onChange={(e) => atualizarItem(index, 'quantidade', parseInt(e.target.value))}
                            required
                          />
                          <select
                            className="execucao-form-select w-24"
                            value={item.unidade}
                            onChange={(e) => atualizarItem(index, 'unidade', e.target.value)}
                          >
                            <option value="un">un</option>
                            <option value="m">m</option>
                            <option value="m²">m²</option>
                            <option value="kg">kg</option>
                            <option value="l">L</option>
                            <option value="cx">cx</option>
                            <option value="pct">pct</option>
                          </select>
                          {formData.itens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removerItem(index)}
                              className="execucao-btn execucao-btn-danger execucao-btn-sm"
                            >
                              <FaTrash size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Observações</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="3"
                      placeholder="Observações adicionais..."
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    ></textarea>
                  </div>
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
                  {pedidoSelecionado ? 'Salvar Alterações' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidoMaterial;
