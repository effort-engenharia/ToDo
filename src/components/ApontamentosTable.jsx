import React, { useState, useEffect } from 'react';
import { 
  FaEdit, 
  FaSave, 
  FaTimes, 
  FaEye, 
  FaTrash,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaHistory,
  FaSpinner
} from 'react-icons/fa';
import { apontamentosService } from '../services/supabaseService';

const ApontamentosTable = ({ reloadTrigger, searchTerm }) => {
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [showHistorico, setShowHistorico] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  
  // Estados dos filtros
  const [filtros, setFiltros] = useState({
    cidade: '',
    dataInicio: '',
    dataFim: '',
    proprietario: '',
    origem: '',
    fase: ''
  });

  // Opções dos comboboxes (mesmas do formulário)
  const tiposOportunidade = [
    'MEDIÇÃO OHMICA', 'SPDA', 'ENTRADA DE ENERGIA', 'CENTRO DE MEDIÇÃO', 'PRUMADAS',
    'ESTAÇÃO DE RECARGA', 'CABINE PRIMÁRIA', 'QUADROS DE BOMBA', 'PROJETOS ELÉTRICOS',
    'QUADROS ADMINISTRATIVOS', 'SISTEMA DE ILUMINAÇÃO', 'RESIDÊNCIAL', 'QUADRO DE ELEVADOR',
    'ADEQUAÇÃO ELÉTRICA', 'QUADRO DE DISJUNTORES', 'MANUTENÇÃO ELÉTRICA', 'CIVIL',
    'LAUDOS', 'POSTE DE ENTRADA', 'AVCB E SISTEMA DE INCÊNDIO'
  ];

  const fases = ['PROSPECÇÃO', 'NEGOCIAÇÃO', 'CONTRATO/VENDA', 'CANCELADO/PERCA'];
  const origensCliente = ['PROSPECÇÃO', 'INDICAÇÃO', 'GOOGLE', 'CARTEIRA', 'ADM', 'OUTROS'];
  const proprietarios = ['PAMELLI', 'EDUARDA', 'FÁBIO', 'EDGAR'];
  const cidades = ['GUARUJÁ', 'BERTIOGA', 'SANTOS', 'SÃO VICENTE', 'PRAIA GRANDE', 'CUBATÃO', 'SÃO SEBASTIÃO', 'OUTRAS'];

  // Gerar opções de parcelas
  const parcelas = Array.from({ length: 100 }, (_, i) => {
    const num = i + 1;
    if (num === 1) return { value: '1', label: '1x (À Vista)' };
    return { value: num.toString(), label: `${num}x` };
  });

  // Carregar apontamentos
  const carregarApontamentos = async () => {
    setLoading(true);
    try {
      const filtros = searchTerm ? { pesquisa: searchTerm } : {};
      const data = await apontamentosService.buscarApontamentos(filtros);
      setApontamentos(data);
    } catch (error) {
      console.error('Erro ao carregar apontamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarApontamentos();
  }, [reloadTrigger, searchTerm]);

  // Função para ordenação
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Aplicar ordenação
  const sortedApontamentos = [...apontamentos].sort((a, b) => {
    if (sortConfig.key) {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });

  // Aplicar filtros
  const filteredApontamentos = sortedApontamentos.filter(apontamento => {
    // Filtro por cidade
    if (filtros.cidade && apontamento.cidade_atendimento !== filtros.cidade) {
      return false;
    }
    
    // Filtro por data
    if (filtros.dataInicio || filtros.dataFim) {
      const dataApontamento = new Date(apontamento.created_at);
      if (filtros.dataInicio && dataApontamento < new Date(filtros.dataInicio)) {
        return false;
      }
      if (filtros.dataFim && dataApontamento > new Date(filtros.dataFim + 'T23:59:59')) {
        return false;
      }
    }
    
    // Filtro por proprietário
    if (filtros.proprietario && apontamento.proprietario_relacionamento !== filtros.proprietario) {
      return false;
    }
    
    // Filtro por origem
    if (filtros.origem && apontamento.origem_cliente !== filtros.origem) {
      return false;
    }
    
    // Filtro por fase
    if (filtros.fase && apontamento.fase !== filtros.fase) {
      return false;
    }
    
    return true;
  });

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({
      cidade: '',
      dataInicio: '',
      dataFim: '',
      proprietario: '',
      origem: '',
      fase: ''
    });
  };

  // Função para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  // Função para formatar moeda
  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Iniciar edição
  const startEdit = (apontamento) => {
    setEditingId(apontamento.id);
    setEditData({
      tipoOportunidade: apontamento.tipo_oportunidade,
      nomeCliente: apontamento.nome_cliente,
      fase: apontamento.fase,
      origemCliente: apontamento.origem_cliente,
      origemOutros: apontamento.origem_outros || '',
      proprietarioRelacionamento: apontamento.proprietario_relacionamento || '',
      valorTotalServico: apontamento.valor_total_servico || 0,
      valorEntradaServico: apontamento.valor_entrada_servico || 0,
      quantidadeParcelas: apontamento.quantidade_parcelas?.toString() || '1',
      cidadeAtendimento: apontamento.cidade_atendimento || '',
      cidadeOutras: apontamento.cidade_outras || ''
    });
  };

  // Cancelar edição
  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Salvar edição
  const saveEdit = async () => {
    try {
      await apontamentosService.atualizarApontamento(editingId, editData);
      setEditingId(null);
      setEditData({});
      carregarApontamentos();
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      alert('Erro ao salvar alterações');
    }
  };

  // Carregar histórico
  const carregarHistorico = async (apontamentoId) => {
    setLoadingHistorico(true);
    try {
      const data = await apontamentosService.buscarHistoricoAlteracoes(apontamentoId);
      setHistorico(data);
      setShowHistorico(apontamentoId);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Função para converter nome do campo para label amigável
  const getFieldLabel = (fieldName) => {
    const labels = {
      'tipo_oportunidade': 'Tipo de Oportunidade',
      'nome_cliente': 'Nome do Cliente',
      'fase': 'Fase',
      'origem_cliente': 'Origem do Cliente',
      'origem_outros': 'Origem (Outros)',
      'proprietario_relacionamento': 'Proprietário',
      'valor_total_servico': 'Valor Total',
      'valor_entrada_servico': 'Valor de Entrada',
      'quantidade_parcelas': 'Parcelas',
      'cidade_atendimento': 'Cidade',
      'cidade_outras': 'Cidade (Outras)'
    };
    return labels[fieldName] || fieldName;
  };

  // Renderizar ícone de ordenação
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <FaSort className="ml-1 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' ? 
      <FaSortUp className="ml-1 text-blue-500" /> : 
      <FaSortDown className="ml-1 text-blue-500" />;
  };

  // Renderizar input de edição
  const renderEditInput = (field, value, type = 'text') => {
    const commonProps = {
      value: value || '',
      onChange: (e) => setEditData(prev => ({ ...prev, [field]: e.target.value })),
      className: "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
    };

    switch (type) {
      case 'select-tipo':
        return (
          <select {...commonProps}>
            <option value="">Selecione...</option>
            {tiposOportunidade.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        );
      
      case 'select-fase':
        return (
          <select {...commonProps}>
            <option value="">Selecione...</option>
            {fases.map(fase => (
              <option key={fase} value={fase}>{fase}</option>
            ))}
          </select>
        );
      
      case 'select-origem':
        return (
          <select {...commonProps}>
            <option value="">Selecione...</option>
            {origensCliente.map(origem => (
              <option key={origem} value={origem}>{origem}</option>
            ))}
          </select>
        );
      
      case 'select-proprietario':
        return (
          <select {...commonProps}>
            <option value="">Selecione...</option>
            {proprietarios.map(prop => (
              <option key={prop} value={prop}>{prop}</option>
            ))}
          </select>
        );
      
      case 'select-cidade':
        return (
          <select {...commonProps}>
            <option value="">Selecione...</option>
            {cidades.map(cidade => (
              <option key={cidade} value={cidade}>{cidade}</option>
            ))}
          </select>
        );
      
      case 'select-parcelas':
        return (
          <select {...commonProps}>
            {parcelas.map(parcela => (
              <option key={parcela.value} value={parcela.value}>{parcela.label}</option>
            ))}
          </select>
        );
      
      case 'number':
        return <input {...commonProps} type="number" step="0.01" />;
      
      default:
        return <input {...commonProps} type="text" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-xl mt-6">
        <div className="flex items-center justify-center">
          <FaSpinner className="animate-spin text-2xl text-blue-500 mr-3" />
          <span className="text-lg text-gray-600">Carregando apontamentos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            📊 Registros de Apontamentos ({filteredApontamentos.length})
          </h2>
          
          {/* Painel de Filtros */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {/* Filtro Cidade */}
              <select
                value={filtros.cidade}
                onChange={(e) => setFiltros(prev => ({ ...prev, cidade: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-gray-900">Todas as Cidades</option>
                {cidades.map(cidade => (
                  <option key={cidade} value={cidade} className="text-gray-900">{cidade}</option>
                ))}
              </select>

              {/* Filtro Data Início */}
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Data início"
              />

              {/* Filtro Data Fim */}
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Data fim"
              />

              {/* Filtro Proprietário */}
              <select
                value={filtros.proprietario}
                onChange={(e) => setFiltros(prev => ({ ...prev, proprietario: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-gray-900">Todos os Proprietários</option>
                {proprietarios.map(prop => (
                  <option key={prop} value={prop} className="text-gray-900">{prop}</option>
                ))}
              </select>

              {/* Filtro Origem */}
              <select
                value={filtros.origem}
                onChange={(e) => setFiltros(prev => ({ ...prev, origem: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-gray-900">Todas as Origens</option>
                {origensCliente.map(origem => (
                  <option key={origem} value={origem} className="text-gray-900">{origem}</option>
                ))}
              </select>

              {/* Filtro Fase */}
              <select
                value={filtros.fase}
                onChange={(e) => setFiltros(prev => ({ ...prev, fase: e.target.value }))}
                className="px-3 py-1 text-sm rounded border border-white/20 bg-white/10 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-gray-900">Todas as Fases</option>
                {fases.map(fase => (
                  <option key={fase} value={fase} className="text-gray-900">{fase}</option>
                ))}
              </select>

              {/* Botão Limpar Filtros */}
              <button
                onClick={limparFiltros}
                className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 text-white rounded border border-white/20 transition-colors"
                title="Limpar todos os filtros"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Tabela Responsiva */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nome_cliente')}>
                  <div className="flex items-center">
                    Nome do Cliente
                    {renderSortIcon('nome_cliente')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tipo_oportunidade')}>
                  <div className="flex items-center">
                    Oportunidade
                    {renderSortIcon('tipo_oportunidade')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fase')}>
                  <div className="flex items-center">
                    Fase
                    {renderSortIcon('fase')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('origem_cliente')}>
                  <div className="flex items-center">
                    Origem
                    {renderSortIcon('origem_cliente')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('proprietario_relacionamento')}>
                  <div className="flex items-center">
                    Proprietário
                    {renderSortIcon('proprietario_relacionamento')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('valor_total_servico')}>
                  <div className="flex items-center">
                    Valor Total
                    {renderSortIcon('valor_total_servico')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('valor_entrada_servico')}>
                  <div className="flex items-center">
                    Valor Entrada
                    {renderSortIcon('valor_entrada_servico')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('quantidade_parcelas')}>
                  <div className="flex items-center">
                    Parcelas
                    {renderSortIcon('quantidade_parcelas')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cidade_atendimento')}>
                  <div className="flex items-center">
                    Cidade
                    {renderSortIcon('cidade_atendimento')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center">
                    Data Cadastro
                    {renderSortIcon('created_at')}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('updated_at')}>
                  <div className="flex items-center">
                    Última Modificação
                    {renderSortIcon('updated_at')}
                  </div>
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApontamentos.map((apontamento) => (
                <tr key={apontamento.id} className="hover:bg-gray-50">
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    {editingId === apontamento.id ? 
                      renderEditInput('nomeCliente', editData.nomeCliente) :
                      <span className="font-medium text-gray-900">{apontamento.nome_cliente}</span>
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    {editingId === apontamento.id ? 
                      renderEditInput('tipoOportunidade', editData.tipoOportunidade, 'select-tipo') :
                      <span className="text-gray-700 text-xs">{apontamento.tipo_oportunidade}</span>
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    {editingId === apontamento.id ? 
                      renderEditInput('fase', editData.fase, 'select-fase') :
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        apontamento.fase === 'CONTRATO/VENDA' ? 'bg-green-100 text-green-800' :
                        apontamento.fase === 'NEGOCIAÇÃO' ? 'bg-yellow-100 text-yellow-800' :
                        apontamento.fase === 'PROSPECÇÃO' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {apontamento.fase}
                      </span>
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('origemCliente', editData.origemCliente, 'select-origem') :
                      apontamento.origem_cliente
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('proprietarioRelacionamento', editData.proprietarioRelacionamento, 'select-proprietario') :
                      apontamento.proprietario_relacionamento || '-'
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('valorTotalServico', editData.valorTotalServico, 'number') :
                      formatCurrency(apontamento.valor_total_servico)
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('valorEntradaServico', editData.valorEntradaServico, 'number') :
                      formatCurrency(apontamento.valor_entrada_servico)
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('quantidadeParcelas', editData.quantidadeParcelas, 'select-parcelas') :
                      `${apontamento.quantidade_parcelas}x`
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {editingId === apontamento.id ? 
                      renderEditInput('cidadeAtendimento', editData.cidadeAtendimento, 'select-cidade') :
                      apontamento.cidade_atendimento || '-'
                    }
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(apontamento.created_at)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(apontamento.updated_at)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-2">
                      {editingId === apontamento.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-100"
                            title="Salvar"
                          >
                            <FaSave />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100"
                            title="Cancelar"
                          >
                            <FaTimes />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(apontamento)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-100"
                            title="Editar"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => carregarHistorico(apontamento.id)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-100"
                            title="Ver histórico"
                          >
                            <FaHistory />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredApontamentos.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">Nenhum apontamento encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal de Histórico */}
      {showHistorico && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                📋 Histórico de Alterações
              </h3>
              <button
                onClick={() => setShowHistorico(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            
            {loadingHistorico ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="animate-spin text-xl text-blue-500 mr-2" />
                <span>Carregando histórico...</span>
              </div>
            ) : historico.length > 0 ? (
              <div className="space-y-4">
                {historico.map((item, index) => (
                  <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        {getFieldLabel(item.campo_alterado)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(item.data_alteracao)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-red-600">
                        De: {item.valor_anterior || '(vazio)'}
                      </span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600">
                        Para: {item.valor_novo || '(vazio)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Nenhum histórico de alterações encontrado.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApontamentosTable;