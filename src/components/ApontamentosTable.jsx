import React, { useState, useEffect, useMemo } from 'react';
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
  FaSpinner,
  FaHandshake,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaBuilding,
  FaMapMarkerAlt,
  FaCalendarAlt
} from 'react-icons/fa';
import { apontamentosService, adminService } from '../services/supabaseService';

const ApontamentosTable = ({ reloadTrigger, searchTerm }) => {
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [showHistorico, setShowHistorico] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [processandoAlinhamento, setProcessandoAlinhamento] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Estado para modal de detalhes
  const [showDetalhes, setShowDetalhes] = useState(null);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Estados dos filtros
  const [filtros, setFiltros] = useState({
    cidade: '',
    dataInicio: '',
    dataFim: '',
    proprietario: '',
    origem: '',
    fase: ''
  });

  // Função para mostrar toast
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 4000);
  };

  // Componente Toast
  const Toast = ({ show, message, type, onClose }) => {
    if (!show) return null;

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
    const icon = type === 'success' ? <FaCheck /> : type === 'warning' ? <FaSpinner /> : <FaTimes />;

    return (
      <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center space-x-3 transform transition-all duration-300 ease-in-out`}>
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium">{message}</span>
        </div>
        <button 
          onClick={onClose}
          className="ml-4 hover:bg-white/20 p-1 rounded"
        >
          <FaTimes size={14} />
        </button>
      </div>
    );
  };

  // Opções dos comboboxes (mesmas do formulário)
  const tiposOportunidade = [
    'MEDIÇÃO OHMICA', 'SPDA', 'ENTRADA DE ENERGIA', 'CENTRO DE MEDIÇÃO', 'PRUMADAS',
    'ESTAÇÃO DE RECARGA', 'CABINE PRIMÁRIA', 'QUADROS DE BOMBA', 'PROJETOS ELÉTRICOS',
    'QUADROS ADMINISTRATIVOS', 'SISTEMA DE ILUMINAÇÃO', 'RESIDÊNCIAL', 'QUADRO DE ELEVADOR',
    'ADEQUAÇÃO ELÉTRICA', 'QUADRO DE DISJUNTORES', 'MANUTENÇÃO ELÉTRICA', 'CIVIL',
    'LAUDOS', 'POSTE DE ENTRADA', 'AVCB E SISTEMA DE INCÊNDIO'
  ];

  const fases = ['PROSPECÇÃO', 'QUALIFICAÇÃO', 'NEGOCIAÇÃO', 'CONTRATO/VENDA', 'CANCELADO/PERCA'];
  const origensCliente = ['PROSPECÇÃO', 'INDICAÇÃO', 'GOOGLE', 'CARTEIRA', 'ADM', 'OUTROS'];
  // proprietarios agora é carregado dinamicamente (ver estados abaixo)
  const cidades = ['GUARUJÁ', 'BERTIOGA', 'SANTOS', 'SÃO VICENTE', 'PRAIA GRANDE', 'CUBATÃO', 'SÃO SEBASTIÃO', 'OUTRAS'];
  
  // Estado para vendedores dinâmicos
  const [proprietariosAtivos, setProprietariosAtivos] = useState([]);
  const [proprietariosTodos, setProprietariosTodos] = useState([]);
  const [loadingVendedores, setLoadingVendedores] = useState(true);

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

  // Carregar vendedores comerciais do banco
  useEffect(() => {
    const carregarVendedores = async () => {
      setLoadingVendedores(true);
      try {
        // Carregar vendedores ativos (para edição)
        const resultadoAtivos = await adminService.listarVendedoresComerciais(false);
        if (resultadoAtivos.success) {
          setProprietariosAtivos(resultadoAtivos.vendedores);
        }
        
        // Carregar todos os vendedores incluindo inativos (para filtros - dados históricos)
        const resultadoTodos = await adminService.listarVendedoresComerciais(true);
        if (resultadoTodos.success) {
          setProprietariosTodos(resultadoTodos.vendedores);
        }
      } catch (error) {
        console.error('Erro ao carregar vendedores:', error);
      } finally {
        setLoadingVendedores(false);
      }
    };
    carregarVendedores();
  }, []);

  // Realizar alinhamento
  const realizarAlinhamento = async (apontamentoId) => {
    setProcessandoAlinhamento(prev => ({ ...prev, [apontamentoId]: true }));
    
    try {
      await apontamentosService.registrarAlinhamento(apontamentoId);
      
      // Atualizar apenas o registro específico localmente (otimização)
      setApontamentos(prev => 
        prev.map(apontamento => 
          apontamento.id === apontamentoId 
            ? { 
                ...apontamento, 
                ultimo_alinhamento_realizado: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                pode_realizar_alinhamento: false 
              }
            : apontamento
        )
      );
      
      // Mostrar feedback visual via toast
      showToast('✅ Alinhamento realizado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao realizar alinhamento:', error);
      if (error.message.includes('já foi realizado hoje')) {
        showToast('⚠️ O alinhamento já foi realizado hoje para este apontamento.', 'warning');
      } else {
        showToast('❌ Erro ao realizar alinhamento. Tente novamente.', 'error');
      }
    } finally {
      setProcessandoAlinhamento(prev => ({ ...prev, [apontamentoId]: false }));
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

  // Calcular dados de paginação
  const totalItems = filteredApontamentos.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApontamentos = filteredApontamentos.slice(startIndex, endIndex);

  // Resetar para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [filtros, searchTerm]);

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

  // Iniciar edição no modal
  const startEditModal = () => {
    if (!showDetalhes) return;
    setEditData({
      tipoOportunidade: showDetalhes.tipo_oportunidade || '',
      nomeCliente: showDetalhes.nome_cliente || '',
      contatoCliente: showDetalhes.contato_cliente || '',
      fase: showDetalhes.fase || '',
      origemCliente: showDetalhes.origem_cliente || '',
      origemOutros: showDetalhes.origem_outros || '',
      proprietarioRelacionamento: showDetalhes.proprietario_relacionamento || '',
      valorTotalServico: showDetalhes.valor_total_servico || 0,
      valorEntradaServico: showDetalhes.valor_entrada_servico || 0,
      quantidadeParcelas: showDetalhes.quantidade_parcelas?.toString() || '1',
      cidadeAtendimento: showDetalhes.cidade_atendimento || '',
      cidadeOutras: showDetalhes.cidade_outras || '',
      cnpjCliente: showDetalhes.cnpj_cliente || '',
      razaoSocial: showDetalhes.razao_social || '',
      nomeFantasia: showDetalhes.nome_fantasia || '',
      cep: showDetalhes.cep || '',
      logradouro: showDetalhes.logradouro || '',
      numero: showDetalhes.numero || '',
      bairro: showDetalhes.bairro || '',
      municipio: showDetalhes.municipio || '',
      uf: showDetalhes.uf || '',
      cronogramaDataInicio: showDetalhes.cronograma_data_inicio || '',
      cronogramaDataTermino: showDetalhes.cronograma_data_termino || ''
    });
    setIsEditingModal(true);
  };

  // Cancelar edição no modal
  const cancelEditModal = () => {
    setIsEditingModal(false);
    setEditData({});
  };

  // Salvar edição do modal
  const saveEditModal = async () => {
    if (!showDetalhes) return;
    setSavingEdit(true);
    try {
      const updatedRecord = await apontamentosService.atualizarApontamento(showDetalhes.id, editData);
      
      // Atualizar apenas o registro específico localmente
      setApontamentos(prev => 
        prev.map(apontamento => 
          apontamento.id === showDetalhes.id 
            ? { ...updatedRecord, pode_realizar_alinhamento: apontamento.pode_realizar_alinhamento }
            : apontamento
        )
      );
      
      // Atualizar o showDetalhes com os novos dados
      setShowDetalhes({ ...updatedRecord, pode_realizar_alinhamento: showDetalhes.pode_realizar_alinhamento });
      setIsEditingModal(false);
      setEditData({});
      showToast('✅ Alterações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      showToast('❌ Erro ao salvar alterações. Tente novamente.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Fechar modal de detalhes
  const closeDetalhesModal = () => {
    setShowDetalhes(null);
    setIsEditingModal(false);
    setEditData({});
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
      'contato_cliente': 'Contato do Cliente',
      'fase': 'Fase',
      'origem_cliente': 'Origem do Cliente',
      'origem_outros': 'Origem (Outros)',
      'proprietario_relacionamento': 'Proprietário',
      'valor_total_servico': 'Valor Total',
      'valor_entrada_servico': 'Valor de Entrada',
      'quantidade_parcelas': 'Parcelas',
      'cidade_atendimento': 'Cidade',
      'cidade_outras': 'Cidade (Outras)',
      'alinhamento_realizado': 'Alinhamento Realizado',
      // Campos expandidos
      'cnpj_cliente': 'CNPJ',
      'razao_social': 'Razão Social',
      'nome_fantasia': 'Nome Fantasia',
      'cep': 'CEP',
      'logradouro': 'Logradouro',
      'numero': 'Número',
      'bairro': 'Bairro',
      'municipio': 'Município',
      'uf': 'UF',
      'cronograma_data_inicio': 'Data Início Cronograma',
      'cronograma_data_termino': 'Data Término Cronograma'
    };
    return labels[fieldName] || fieldName;
  };

  // Função para formatar data de alinhamento (item 9)
  const formatAlinhamento = (ultimoAlinhamento) => {
    if (!ultimoAlinhamento) return null;
    
    const data = new Date(ultimoAlinhamento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const dataAlinhamento = new Date(ultimoAlinhamento);
    dataAlinhamento.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((hoje - dataAlinhamento) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return { text: 'Hoje', color: 'bg-green-100 text-green-800', recent: true };
    } else if (diffDays === 1) {
      return { text: 'Ontem', color: 'bg-yellow-100 text-yellow-800', recent: true };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}d atrás`, color: 'bg-orange-100 text-orange-800', recent: false };
    } else {
      return { text: data.toLocaleDateString('pt-BR'), color: 'bg-gray-100 text-gray-600', recent: false };
    }
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
          <select {...commonProps} disabled={loadingVendedores}>
            <option value="">{loadingVendedores ? 'Carregando...' : 'Selecione...'}</option>
            {proprietariosAtivos.map(prop => (
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
                {proprietariosTodos.map(prop => (
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
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('contato_cliente')}>
                  <div className="flex items-center">
                    📞 Contato
                    {renderSortIcon('contato_cliente')}
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
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ultimo_alinhamento_realizado')}>
                  <div className="flex items-center">
                    🤝 Alinhamento
                    {renderSortIcon('ultimo_alinhamento_realizado')}
                  </div>
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedApontamentos.map((apontamento) => {
                const alinhamentoInfo = formatAlinhamento(apontamento.ultimo_alinhamento_realizado);
                return (
                <tr key={apontamento.id} className={`hover:bg-gray-50 ${alinhamentoInfo?.recent ? 'bg-green-50/30' : ''}`}>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    <span className="font-medium text-gray-900">{apontamento.nome_cliente}</span>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    <span className="text-gray-700">
                      {apontamento.contato_cliente ? (
                        <a href={`tel:${apontamento.contato_cliente.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">
                          {apontamento.contato_cliente}
                        </a>
                      ) : '-'}
                    </span>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    <span className="text-gray-700 text-xs">{apontamento.tipo_oportunidade}</span>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      apontamento.fase === 'CONTRATO/VENDA' ? 'bg-green-100 text-green-800' :
                      apontamento.fase === 'NEGOCIAÇÃO' ? 'bg-yellow-100 text-yellow-800' :
                      apontamento.fase === 'PROSPECÇÃO' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {apontamento.fase}
                    </span>
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {apontamento.origem_cliente}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {apontamento.proprietario_relacionamento || '-'}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatCurrency(apontamento.valor_total_servico)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatCurrency(apontamento.valor_entrada_servico)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {`${apontamento.quantidade_parcelas}x`}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {apontamento.cidade_atendimento || '-'}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(apontamento.created_at)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(apontamento.updated_at)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm">
                    {alinhamentoInfo ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${alinhamentoInfo.color}`}>
                        {alinhamentoInfo.text}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Nunca</span>
                    )}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setShowDetalhes(apontamento)}
                        className="text-cyan-600 hover:text-cyan-900 p-1 rounded hover:bg-cyan-100"
                        title="Ver detalhes / Editar"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => carregarHistorico(apontamento.id)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-100"
                        title="Ver histórico"
                      >
                        <FaHistory />
                      </button>
                      <button
                        onClick={() => realizarAlinhamento(apontamento.id)}
                        disabled={!apontamento.pode_realizar_alinhamento || processandoAlinhamento[apontamento.id]}
                        className={`p-1 rounded transition-all duration-200 ${
                          apontamento.pode_realizar_alinhamento && !processandoAlinhamento[apontamento.id]
                            ? 'text-green-600 hover:text-green-900 hover:bg-green-100 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Alinhamento Realizado"
                      >
                        {processandoAlinhamento[apontamento.id] ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaHandshake />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredApontamentos.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">Nenhum apontamento encontrado.</p>
          </div>
        )}

        {/* Controles de Paginação */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Exibindo</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>de {totalItems} registros</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={`p-2 rounded ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                title="Primeira página"
              >
                <FaAngleDoubleLeft />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                title="Página anterior"
              >
                <FaChevronLeft />
              </button>
              
              <div className="flex items-center space-x-1 px-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                title="Próxima página"
              >
                <FaChevronRight />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'}`}
                title="Última página"
              >
                <FaAngleDoubleRight />
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
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

      {/* Modal de Detalhes com Edição */}
      {showDetalhes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {isEditingModal ? '✏️ Editar Apontamento' : '📋 Detalhes do Apontamento'}
              </h3>
              <button
                onClick={closeDetalhesModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Dados do Cliente */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <FaBuilding className="mr-2" />
                  Dados do Cliente
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Nome do Cliente: {isEditingModal && <span className="text-red-500">*</span>}</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.nomeCliente || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, nomeCliente: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '') }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome do cliente"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.nome_cliente || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Contato (Telefone): {isEditingModal && <span className="text-red-500">*</span>}</label>
                    {isEditingModal ? (
                      <input
                        type="tel"
                        value={editData.contatoCliente || ''}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 2) {
                            value = value;
                          } else if (value.length <= 7) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                          } else if (value.length <= 11) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                          } else {
                            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
                          }
                          setEditData(prev => ({ ...prev, contatoCliente: value }));
                        }}
                        placeholder="(XX) XXXXX-XXXX"
                        maxLength={16}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.contato_cliente || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">CNPJ:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.cnpjCliente || ''}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 2) value = value;
                          else if (value.length <= 5) value = value.replace(/(\d{2})(\d+)/, '$1.$2');
                          else if (value.length <= 8) value = value.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
                          else if (value.length <= 12) value = value.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
                          else value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
                          setEditData(prev => ({ ...prev, cnpjCliente: value }));
                        }}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.cnpj_cliente || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Razão Social:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.razaoSocial || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Razão social"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.razao_social || '-'}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-gray-500 block mb-1">Nome Fantasia:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.nomeFantasia || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, nomeFantasia: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome fantasia"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.nome_fantasia || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <FaMapMarkerAlt className="mr-2" />
                  Endereço
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">CEP:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.cep || ''}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 5) value = value;
                          else value = value.replace(/(\d{5})(\d+)/, '$1-$2');
                          setEditData(prev => ({ ...prev, cep: value }));
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.cep || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Cidade de Atendimento:</label>
                    {isEditingModal ? (
                      <select
                        value={editData.cidadeAtendimento || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, cidadeAtendimento: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {cidades.map(cidade => (
                          <option key={cidade} value={cidade}>{cidade}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium text-gray-900">
                        {showDetalhes.cidade_atendimento === 'OUTRAS' 
                          ? showDetalhes.cidade_outras 
                          : showDetalhes.cidade_atendimento || '-'}
                      </p>
                    )}
                  </div>
                  {isEditingModal && editData.cidadeAtendimento === 'OUTRAS' && (
                    <div className="md:col-span-2">
                      <label className="text-gray-500 block mb-1">Especifique a cidade:</label>
                      <input
                        type="text"
                        value={editData.cidadeOutras || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, cidadeOutras: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome da cidade"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-gray-500 block mb-1">Logradouro:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.logradouro || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, logradouro: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Rua, Avenida, etc."
                      />
                    ) : (
                      <p className="font-medium text-gray-900">
                        {showDetalhes.logradouro || '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Número:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.numero || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, numero: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nº"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.numero || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Bairro:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.bairro || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, bairro: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Bairro"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.bairro || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Município:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.municipio || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, municipio: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Município"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.municipio || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">UF:</label>
                    {isEditingModal ? (
                      <input
                        type="text"
                        value={editData.uf || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="UF"
                        maxLength={2}
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.uf || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados da Oportunidade */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                  📊 Dados da Oportunidade
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Tipo de Oportunidade: {isEditingModal && <span className="text-red-500">*</span>}</label>
                    {isEditingModal ? (
                      <select
                        value={editData.tipoOportunidade || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, tipoOportunidade: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {tiposOportunidade.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.tipo_oportunidade || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Fase: {isEditingModal && <span className="text-red-500">*</span>}</label>
                    {isEditingModal ? (
                      <select
                        value={editData.fase || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, fase: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {fases.map(fase => (
                          <option key={fase} value={fase}>{fase}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          showDetalhes.fase === 'CONTRATO/VENDA' ? 'bg-green-100 text-green-800' :
                          showDetalhes.fase === 'NEGOCIAÇÃO' ? 'bg-yellow-100 text-yellow-800' :
                          showDetalhes.fase === 'PROSPECÇÃO' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {showDetalhes.fase}
                        </span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Origem do Cliente: {isEditingModal && <span className="text-red-500">*</span>}</label>
                    {isEditingModal ? (
                      <select
                        value={editData.origemCliente || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, origemCliente: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {origensCliente.map(origem => (
                          <option key={origem} value={origem}>{origem}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium text-gray-900">
                        {showDetalhes.origem_cliente === 'OUTROS' 
                          ? showDetalhes.origem_outros 
                          : showDetalhes.origem_cliente || '-'}
                      </p>
                    )}
                  </div>
                  {isEditingModal && editData.origemCliente === 'OUTROS' && (
                    <div>
                      <label className="text-gray-500 block mb-1">Especifique a origem:</label>
                      <input
                        type="text"
                        value={editData.origemOutros || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, origemOutros: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Origem do cliente"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-gray-500 block mb-1">Proprietário do Relacionamento:</label>
                    {isEditingModal ? (
                      <select
                        value={editData.proprietarioRelacionamento || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, proprietarioRelacionamento: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loadingVendedores}
                      >
                        <option value="">{loadingVendedores ? 'Carregando...' : 'Selecione...'}</option>
                        {proprietariosAtivos.map(prop => (
                          <option key={prop} value={prop}>{prop}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium text-gray-900">{showDetalhes.proprietario_relacionamento || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
                  💰 Valores
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Valor Total:</label>
                    {isEditingModal ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.valorTotalServico || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, valorTotalServico: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 text-lg">{formatCurrency(showDetalhes.valor_total_servico)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Valor de Entrada:</label>
                    {isEditingModal ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.valorEntradaServico || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, valorEntradaServico: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <p className="font-medium text-gray-900 text-lg">{formatCurrency(showDetalhes.valor_entrada_servico)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Parcelas:</label>
                    {isEditingModal ? (
                      <select
                        value={editData.quantidadeParcelas || '1'}
                        onChange={(e) => setEditData(prev => ({ ...prev, quantidadeParcelas: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {parcelas.map(parcela => (
                          <option key={parcela.value} value={parcela.value}>{parcela.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-medium text-gray-900 text-lg">{showDetalhes.quantidade_parcelas}x</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cronograma */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                  <FaCalendarAlt className="mr-2" />
                  Cronograma
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Data de Início:</label>
                    {isEditingModal ? (
                      <input
                        type="date"
                        value={editData.cronogramaDataInicio || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, cronogramaDataInicio: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">
                        {showDetalhes.cronograma_data_inicio 
                          ? new Date(showDetalhes.cronograma_data_inicio).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 block mb-1">Data de Término:</label>
                    {isEditingModal ? (
                      <input
                        type="date"
                        value={editData.cronogramaDataTermino || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, cronogramaDataTermino: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">
                        {showDetalhes.cronograma_data_termino 
                          ? new Date(showDetalhes.cronograma_data_termino).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Datas do Sistema - Somente visualização */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                  🕐 Informações do Sistema
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Data de Cadastro:</span>
                    <p className="font-medium text-gray-900">{formatDate(showDetalhes.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Última Modificação:</span>
                    <p className="font-medium text-gray-900">{formatDate(showDetalhes.updated_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Último Alinhamento:</span>
                    <p className="font-medium text-gray-900">
                      {showDetalhes.ultimo_alinhamento_realizado 
                        ? formatDate(showDetalhes.ultimo_alinhamento_realizado) 
                        : 'Nunca realizado'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="mt-6 flex justify-end space-x-3">
              {isEditingModal ? (
                <>
                  <button
                    onClick={cancelEditModal}
                    disabled={savingEdit}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveEditModal}
                    disabled={savingEdit}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center disabled:opacity-50"
                  >
                    {savingEdit ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <FaSave className="mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditModal}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                  >
                    <FaEdit className="mr-2" />
                    Editar
                  </button>
                  <button
                    onClick={closeDetalhesModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Component */}
      <Toast 
        show={toast.show} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ show: false, message: '', type: '' })}
      />
    </div>
  );
};

export default ApontamentosTable;