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
  FaFilter,
  FaClipboardList,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaBuilding,
  FaExclamationTriangle,
  FaFileAlt,
  FaSave,
  FaCog,
  FaMagic,
  FaCopy,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaWrench,
  FaTasks,
  FaChevronDown,
  FaChevronUp,
  FaList,
  FaCheck
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';

const PedidoMaterial = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  
  // Aba ativa
  const [abaAtiva, setAbaAtiva] = useState('pedidos'); // 'pedidos' ou 'templates'
  
  // Templates
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [listaExpandida, setListaExpandida] = useState(null); // índice da lista expandida no modal
  
  // Novo formato: template com múltiplas listas
  const [formTemplate, setFormTemplate] = useState({
    nome: '',
    icone: 'FaBox',
    cor: '#8b5cf6',
    listas: [{ 
      nome: 'Lista Principal', 
      itens: [{ nome: '', quantidade: 1, unidade: 'un' }] 
    }]
  });
  
  // Seleção de template/listas no formulário de pedido
  const [templateParaAplicar, setTemplateParaAplicar] = useState(null);
  const [listasSelecionadas, setListasSelecionadas] = useState([]);
  const [showSeletorTemplate, setShowSeletorTemplate] = useState(false);

  // Modal de alerta para edição
  const [showAlertaEdicao, setShowAlertaEdicao] = useState(false);
  const [deAcordoMarcado, setDeAcordoMarcado] = useState(false);
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [pedidoParaEditar, setPedidoParaEditar] = useState(null);
  const [dataDefinidaPeloAlerta, setDataDefinidaPeloAlerta] = useState(false);

  // Histórico do pedido
  const [historicoPedido, setHistoricoPedido] = useState([]);
  const [showHistorico, setShowHistorico] = useState(false);

  const [formData, setFormData] = useState({
    descricao: '',
    urgencia: 'normal',
    itens: [{ nome: '', quantidade: 1, unidade: 'un' }],
    observacoes: '',
    data_material_disponivel: ''
  });

  useEffect(() => {
    carregarPedidos();
    carregarTemplates();
  }, []);

  // Garantir que formData.itens sempre tenha pelo menos um item
  useEffect(() => {
    if (!formData.itens || formData.itens.length === 0) {
      setFormData(prev => ({
        ...prev,
        itens: [{ nome: '', quantidade: 1, unidade: 'un' }]
      }));
    }
  }, [formData.itens]);

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      const result = await execucaoService.buscarPedidosMaterial();
      if (result.success) {
        setPedidos(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTemplates = async () => {
    try {
      const result = await execucaoService.buscarTemplatesMateriais();
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  // Converter template antigo (itens) para novo formato (listas)
  const converterParaNovoFormato = (template) => {
    // Primeiro, verificar se tem a coluna 'listas' (novo formato)
    if (template.listas) {
      const listas = typeof template.listas === 'string' 
        ? JSON.parse(template.listas) 
        : template.listas;
      if (Array.isArray(listas) && listas.length > 0) {
        return listas;
      }
    }
    
    // Se não tem listas, verificar itens (formato antigo)
    if (!template.itens) {
      return [{ nome: 'Lista Principal', itens: [] }];
    }
    
    const dados = typeof template.itens === 'string' 
      ? JSON.parse(template.itens) 
      : template.itens;
    
    // Se tem formato antigo (array de itens direto)
    if (Array.isArray(dados) && dados.length > 0 && dados[0].nome !== undefined && !dados[0].itens) {
      return [{ nome: 'Lista Principal', itens: dados }];
    }
    
    // Se já é array de listas (estrutura intermediária)
    if (Array.isArray(dados) && dados.length > 0 && dados[0].itens) {
      return dados;
    }
    
    return [{ nome: 'Lista Principal', itens: [] }];
  };

  // Aplicar listas selecionadas aos itens do pedido
  const aplicarListasSelecionadas = () => {
    if (!templateParaAplicar || listasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma lista para aplicar.');
      return;
    }
    
    const listas = converterParaNovoFormato(templateParaAplicar);
    
    // Juntar todos os itens das listas selecionadas
    let novosItens = [];
    listasSelecionadas.forEach(listaIdx => {
      if (listas[listaIdx] && listas[listaIdx].itens) {
        novosItens = [...novosItens, ...listas[listaIdx].itens];
      }
    });
    
    // Mesclar com itens existentes que tenham nome preenchido
    const itensExistentes = formData.itens.filter(i => i.nome && i.nome.trim() !== '');
    const todosItens = [...itensExistentes, ...novosItens];
    
    setFormData(prev => ({
      ...prev,
      itens: todosItens.length > 0 ? todosItens : [{ nome: '', quantidade: 1, unidade: 'un' }]
    }));
    
    // Limpar seleção
    setTemplateParaAplicar(null);
    setListasSelecionadas([]);
    setShowSeletorTemplate(false);
  };

  // Toggle seleção de lista
  const toggleListaSelecionada = (index) => {
    setListasSelecionadas(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  // Salvar lista atual como template
  const handleSalvarComoTemplate = async () => {
    const itensValidos = formData.itens.filter(i => i.nome && i.nome.trim() !== '');
    if (itensValidos.length === 0) {
      alert('Adicione pelo menos um item antes de salvar como template.');
      return;
    }
    
    const nome = prompt('Nome do template:');
    if (!nome) return;
    
    const nomeLista = prompt('Nome da lista dentro do template:', 'Lista Principal');
    
    const result = await execucaoService.criarTemplateMaterial({
      nome,
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: [{ nome: nomeLista || 'Lista Principal', itens: itensValidos }]
    }, usuario?.id);
    
    if (result.success) {
      alert('✅ Template salvo com sucesso!');
      carregarTemplates();
    } else {
      alert('Erro ao salvar template.');
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
      // Guardar dados anteriores para histórico
      const dadosAnteriores = {
        descricao: pedidoSelecionado.descricao,
        urgencia: pedidoSelecionado.urgencia,
        itens: pedidoSelecionado.itens,
        observacoes: pedidoSelecionado.observacoes,
        data_material_disponivel: pedidoSelecionado.data_material_disponivel
      };
      
      result = await execucaoService.atualizarPedidoMaterial(pedidoSelecionado.id, dados);
      
      if (result.success) {
        // Registrar no histórico
        await execucaoService.registrarHistoricoPedido(pedidoSelecionado.id, {
          tipo_alteracao: 'edicao',
          descricao: 'Pedido editado',
          dados_anteriores: dadosAnteriores,
          dados_novos: formData,
          data_limite_anterior: pedidoSelecionado.data_material_disponivel,
          data_limite_nova: formData.data_material_disponivel
        }, usuario);
      }
      
      // Se definiu data de disponibilidade e o pedido está vinculado a uma obra, criar etapa "Chegada dos Materiais"
      if (result.success && formData.data_material_disponivel && pedidoSelecionado.obra_id && !pedidoSelecionado.etapa_chegada_criada) {
        await criarEtapaChegadaMateriais(pedidoSelecionado, formData.data_material_disponivel);
        // Marcar que a etapa já foi criada
        await execucaoService.atualizarPedidoMaterial(pedidoSelecionado.id, { etapa_chegada_criada: true });
      }
    } else {
      result = await execucaoService.criarPedidoMaterial(dados, usuario.id);
      
      if (result.success && result.data) {
        // Registrar criação no histórico
        await execucaoService.registrarHistoricoPedido(result.data.id, {
          tipo_alteracao: 'criacao',
          descricao: 'Pedido de material criado',
          dados_novos: formData
        }, usuario);
      }
    }

    if (result.success) {
      // Se o pedido tem itens preenchidos e está vinculado a uma etapa, atualizar progresso da etapa para 100%
      const itensPreenchidos = formData.itens.filter(i => i.nome && i.nome.trim() !== '');
      if (itensPreenchidos.length > 0 && pedidoSelecionado?.etapa_id) {
        await execucaoService.atualizarEtapa(pedidoSelecionado.etapa_id, {
          progresso: 100,
          status: 'concluida'
        });
        console.log('✅ Etapa de estoque atualizada para 100% concluída');
      }
      
      setShowModal(false);
      setPedidoSelecionado(null);
      resetForm();
      carregarPedidos();
    }
  };

  // Criar etapa "Chegada dos Materiais" automaticamente quando define data de disponibilidade
  const criarEtapaChegadaMateriais = async (pedido, dataDisponivel) => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      const etapaData = {
        obra_id: pedido.obra_id,
        nome: '📦 Chegada dos Materiais',
        descricao: `Materiais solicitados: ${pedido.descricao || 'Lista de materiais'}\n\n🏢 Cliente: ${pedido.cliente_nome || 'N/A'}\n📍 Endereço: ${pedido.endereco_obra || 'N/A'}\n\n📋 Lista concluída em: ${hoje}\n📅 Data limite disponibilidade: ${dataDisponivel}\n\n⚠️ Verificar se todos os itens foram entregues/separados.`,
        tipo: 'estoque',
        data_inicio: hoje, // Data que a lista foi concluída
        data_fim: dataDisponivel, // Data limite para materiais disponíveis
        status: 'pendente',
        progresso: 0
      };

      const result = await execucaoService.criarEtapa(etapaData);
      if (result.success) {
        alert('✅ Etapa "Chegada dos Materiais" criada automaticamente no cronograma da obra!');
      }
      console.log('✅ Etapa "Chegada dos Materiais" criada automaticamente');
    } catch (error) {
      console.error('Erro ao criar etapa de chegada:', error);
    }
  };

  // Handler específico para abrir modal de lista de obra
  const handleAbrirListaObra = (pedido) => {
    setPedidoSelecionado(pedido);
    // Garantir que itens seja um array válido com pelo menos um item
    const itensValidos = Array.isArray(pedido.itens) && pedido.itens.length > 0 && pedido.itens.some(i => i.nome)
      ? pedido.itens 
      : [{ nome: '', quantidade: 1, unidade: 'un' }];
    
    setFormData({
      descricao: pedido.descricao || '',
      urgencia: pedido.urgencia || 'normal',
      itens: itensValidos,
      observacoes: pedido.observacoes || '',
      data_material_disponivel: pedido.data_material_disponivel || ''
    });
    setShowModal(true);
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
      observacoes: '',
      data_material_disponivel: ''
    });
    setDataDefinidaPeloAlerta(false);
  };

  // Ver histórico do pedido
  const handleVerHistorico = async (pedido) => {
    const result = await execucaoService.buscarHistoricoPedido(pedido.id);
    if (result.success) {
      setHistoricoPedido(result.data || []);
      setPedidoParaEditar(pedido);
      setShowHistorico(true);
    }
  };

  // Iniciar edição - mostrar alerta se pedido já existe
  const handleEditar = (pedido) => {
    // Se é um pedido existente, mostrar modal de alerta primeiro
    if (pedido.id && pedido.data_material_disponivel) {
      setPedidoParaEditar(pedido);
      setNovaDataLimite('');
      setDeAcordoMarcado(false);
      setShowAlertaEdicao(true);
    } else {
      // Novo pedido ou pedido sem data limite - abrir direto
      abrirModalEdicao(pedido);
    }
  };

  // Confirmar edição após aceitar alerta
  const handleConfirmarEdicao = () => {
    if (!deAcordoMarcado) {
      alert('Você precisa marcar "De Acordo" para continuar.');
      return;
    }
    if (!novaDataLimite) {
      alert('Você precisa definir uma nova data limite.');
      return;
    }
    // Validar se nova data é posterior à anterior
    if (pedidoParaEditar.data_material_disponivel && novaDataLimite <= pedidoParaEditar.data_material_disponivel) {
      alert('A nova data limite deve ser posterior à data anterior (' + new Date(pedidoParaEditar.data_material_disponivel + 'T12:00:00').toLocaleDateString('pt-BR') + ').');
      return;
    }
    
    setShowAlertaEdicao(false);
    setDataDefinidaPeloAlerta(true); // Marcar que a data foi definida pelo alerta
    abrirModalEdicao(pedidoParaEditar, novaDataLimite);
  };

  // Abrir modal de edição
  const abrirModalEdicao = (pedido, novaData = null) => {
    setPedidoSelecionado(pedido);
    // Garantir que itens seja um array válido com pelo menos um item
    const itensValidos = Array.isArray(pedido.itens) && pedido.itens.length > 0 
      ? pedido.itens 
      : [{ nome: '', quantidade: 1, unidade: 'un' }];
    
    // Se não veio novaData, significa que não passou pelo modal de alerta (pedido novo ou sem data anterior)
    if (!novaData) {
      setDataDefinidaPeloAlerta(false);
    }
    
    setFormData({
      descricao: pedido.descricao || '',
      urgencia: pedido.urgencia || 'normal',
      itens: itensValidos,
      observacoes: pedido.observacoes || '',
      data_material_disponivel: novaData || pedido.data_material_disponivel || ''
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
      case 'concluido': return 'Concluído';
      case 'solicitado': return 'Solicitado';
      case 'pendente': return 'Pendente';
      case 'aprovado': return 'Aprovado';
      case 'recusado': return 'Recusado';
      case 'entregue': return 'Entregue';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'concluido': return 'green';
      case 'solicitado': return 'purple';
      case 'pendente': return 'yellow';
      case 'aprovado': return 'blue';
      case 'recusado': return 'red';
      case 'entregue': return 'green';
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

  // Verificar se data está atrasada
  const isDataAtrasada = (data) => {
    if (!data) return false;
    const hoje = new Date().toISOString().split('T')[0];
    return data < hoje;
  };

  // Calcular dias de atraso ou restantes
  const calcularDiasRestantes = (data) => {
    if (!data) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataLimite = new Date(data + 'T12:00:00');
    const diff = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Handlers de Templates
  const handleNovoTemplate = () => {
    setTemplateSelecionado(null);
    setListaExpandida(0);
    setFormTemplate({
      nome: '',
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: [{ 
        nome: 'Lista Principal', 
        itens: [{ nome: '', quantidade: 1, unidade: 'un' }] 
      }]
    });
    setShowTemplateModal(true);
  };

  const handleEditarTemplate = (template) => {
    const listas = converterParaNovoFormato(template);
    setTemplateSelecionado(template);
    setListaExpandida(0);
    setFormTemplate({
      nome: template.nome || '',
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: listas.length > 0 ? listas : [{ nome: 'Lista Principal', itens: [{ nome: '', quantidade: 1, unidade: 'un' }] }]
    });
    setShowTemplateModal(true);
  };

  const handleSalvarTemplate = async () => {
    if (!formTemplate.nome.trim()) {
      alert('Digite um nome para o template.');
      return;
    }
    
    // Validar que todas as listas tenham pelo menos um item válido
    const listasValidas = formTemplate.listas.filter(lista => 
      lista.nome && lista.itens && lista.itens.some(i => i.nome && i.nome.trim())
    ).map(lista => ({
      nome: lista.nome,
      itens: lista.itens.filter(i => i.nome && i.nome.trim())
    }));
    
    if (listasValidas.length === 0) {
      alert('Adicione pelo menos uma lista com itens ao template.');
      return;
    }

    const dados = {
      nome: formTemplate.nome,
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: listasValidas
    };

    let result;
    if (templateSelecionado) {
      result = await execucaoService.atualizarTemplateMaterial(templateSelecionado.id, dados);
    } else {
      result = await execucaoService.criarTemplateMaterial(dados, usuario?.id);
    }

    if (result.success) {
      setShowTemplateModal(false);
      setTemplateSelecionado(null);
      carregarTemplates();
    } else {
      alert('Erro ao salvar template: ' + (result.message || 'Erro desconhecido'));
    }
  };

  const handleExcluirTemplate = async (templateId) => {
    if (confirm('Deseja realmente excluir este template?')) {
      const result = await execucaoService.excluirTemplateMaterial(templateId);
      if (result.success) {
        carregarTemplates();
      }
    }
  };

  const handleDuplicarTemplate = async (template) => {
    const listas = converterParaNovoFormato(template);
    
    const result = await execucaoService.criarTemplateMaterial({
      nome: template.nome + ' (Cópia)',
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: listas
    }, usuario?.id);
    
    if (result.success) {
      carregarTemplates();
    }
  };

  // Handlers para listas dentro do template
  const handleAdicionarLista = () => {
    setFormTemplate(prev => ({
      ...prev,
      listas: [...prev.listas, { nome: `Lista ${prev.listas.length + 1}`, itens: [{ nome: '', quantidade: 1, unidade: 'un' }] }]
    }));
    setListaExpandida(formTemplate.listas.length);
  };

  const handleRemoverLista = (listaIndex) => {
    if (formTemplate.listas.length <= 1) {
      alert('O template deve ter pelo menos uma lista.');
      return;
    }
    setFormTemplate(prev => ({
      ...prev,
      listas: prev.listas.filter((_, i) => i !== listaIndex)
    }));
    if (listaExpandida === listaIndex) {
      setListaExpandida(null);
    } else if (listaExpandida > listaIndex) {
      setListaExpandida(listaExpandida - 1);
    }
  };

  const handleAtualizarNomeLista = (listaIndex, novoNome) => {
    setFormTemplate(prev => ({
      ...prev,
      listas: prev.listas.map((lista, i) => 
        i === listaIndex ? { ...lista, nome: novoNome } : lista
      )
    }));
  };

  const handleAdicionarItemNaLista = (listaIndex) => {
    setFormTemplate(prev => ({
      ...prev,
      listas: prev.listas.map((lista, i) => 
        i === listaIndex 
          ? { ...lista, itens: [...lista.itens, { nome: '', quantidade: 1, unidade: 'un' }] }
          : lista
      )
    }));
  };

  const handleRemoverItemDaLista = (listaIndex, itemIndex) => {
    setFormTemplate(prev => ({
      ...prev,
      listas: prev.listas.map((lista, i) => 
        i === listaIndex 
          ? { ...lista, itens: lista.itens.filter((_, j) => j !== itemIndex) }
          : lista
      )
    }));
  };

  const handleAtualizarItemDaLista = (listaIndex, itemIndex, campo, valor) => {
    setFormTemplate(prev => ({
      ...prev,
      listas: prev.listas.map((lista, i) => 
        i === listaIndex 
          ? { 
              ...lista, 
              itens: lista.itens.map((item, j) => 
                j === itemIndex ? { ...item, [campo]: valor } : item
              )
            }
          : lista
      )
    }));
  };

  const getIcone = (icone) => {
    switch(icone) {
      case 'FaBolt': return <FaBolt size={24} />;
      case 'FaHardHat': return <FaHardHat size={24} />;
      case 'FaWarehouse': return <FaWarehouse size={24} />;
      case 'FaWrench': return <FaWrench size={24} />;
      case 'FaBox': return <FaBox size={24} />;
      default: return <FaTasks size={24} />;
    }
  };

  // Separar pedidos de obras (listas pendentes) dos pedidos normais
  const listasObrasPendentes = pedidos.filter(p => 
    p.obra_id && 
    (p.itens?.length === 0 || !p.itens || p.itens.every(i => !i.nome)) &&
    p.status !== 'entregue'
  );

  const pedidosNormais = pedidos.filter(p => 
    !p.obra_id || 
    (p.itens?.length > 0 && p.itens.some(i => i.nome))
  );

  // Filtrar pedidos normais
  const pedidosFiltrados = pedidosNormais.filter(p => {
    const matchBusca = p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
                       p.solicitante?.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
                       p.cliente_nome?.toLowerCase().includes(busca.toLowerCase());
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
      {/* Abas de navegação */}
      <div className="execucao-tabs mb-6">
        <button
          className={`execucao-tab ${abaAtiva === 'pedidos' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('pedidos')}
        >
          <FaBox className="mr-2" />
          Pedidos
        </button>
        <button
          className={`execucao-tab ${abaAtiva === 'templates' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('templates')}
        >
          <FaMagic className="mr-2" />
          Templates
          <span className="ml-2 bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full text-xs">
            {templates.length}
          </span>
        </button>
      </div>

      {/* ========================= */}
      {/* ABA DE TEMPLATES */}
      {/* ========================= */}
      {abaAtiva === 'templates' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FaMagic className="text-purple-400" />
                Templates de Materiais
              </h3>
              <p className="text-sm text-slate-400">
                Gerencie modelos de listas de materiais pré-definidos para agilizar os pedidos
              </p>
            </div>
            <button
              onClick={handleNovoTemplate}
              className="execucao-btn-primary flex items-center gap-2"
            >
              <FaPlus size={12} />
              Novo Template
            </button>
          </div>

          {/* Lista de Templates em Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => {
              const listas = converterParaNovoFormato(template);
              const totalItens = listas.reduce((acc, lista) => acc + (lista.itens?.length || 0), 0);
              
              return (
                <div 
                  key={template.id}
                  className="p-4 rounded-xl border transition-all bg-slate-800/50 border-slate-700 hover:border-purple-500/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${template.cor || '#8b5cf6'}20`, color: template.cor || '#8b5cf6' }}
                    >
                      {getIcone(template.icone)}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditarTemplate(template)}
                        className="p-1.5 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                        title="Editar template"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => handleDuplicarTemplate(template)}
                        className="p-1.5 rounded text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                        title="Duplicar template"
                      >
                        <FaCopy size={12} />
                      </button>
                      <button
                        onClick={() => handleExcluirTemplate(template.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Excluir template"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <h4 className="font-semibold text-white mb-3">{template.nome}</h4>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                      {listas.length} lista{listas.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {totalItens} itens
                    </span>
                  </div>
                  
                  {/* Listas do template */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {listas.map((lista, listaIdx) => (
                      <div 
                        key={listaIdx}
                        className="p-2 bg-slate-900/50 rounded border border-slate-700/50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FaList className="text-purple-400" size={10} />
                          <span className="text-xs font-medium text-slate-200">{lista.nome}</span>
                          <span className="text-[10px] text-slate-500">({lista.itens?.length || 0} itens)</span>
                        </div>
                        <div className="pl-4 space-y-0.5">
                          {lista.itens?.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-[10px] text-slate-400 truncate">
                              • {item.nome}
                            </div>
                          ))}
                          {lista.itens?.length > 3 && (
                            <div className="text-[10px] text-slate-500">
                              +{lista.itens.length - 3} mais...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FaMagic size={48} className="mx-auto mb-4 opacity-30" />
              <p>Nenhum template cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo Template" para criar o primeiro</p>
            </div>
          )}
        </div>
      )}

      {/* ========================= */}
      {/* ABA DE PEDIDOS */}
      {/* ========================= */}
      {abaAtiva === 'pedidos' && (
        <>
      {/* Seção de Listas de Obras Pendentes - Cards Especiais */}
      {listasObrasPendentes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <FaClipboardList className="text-amber-400 text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">📦 Listas de Materiais Pendentes</h3>
              <p className="text-xs text-slate-400">
                Listas de obras aguardando preenchimento dos itens
              </p>
            </div>
            <span className="ml-auto bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-semibold">
              {listasObrasPendentes.length} pendente{listasObrasPendentes.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listasObrasPendentes.map((pedido) => {
              const diasRestantes = calcularDiasRestantes(pedido.data_lista_pronta);
              const atrasada = isDataAtrasada(pedido.data_lista_pronta);
              
              return (
                <div 
                  key={pedido.id} 
                  className={`relative overflow-hidden rounded-xl border-2 ${
                    atrasada 
                      ? 'bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-500/50' 
                      : 'bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-500/30'
                  } p-5 transition-all hover:scale-[1.02] hover:shadow-xl`}
                >
                  {/* Badge de status */}
                  {atrasada && (
                    <div className="absolute top-3 right-3">
                      <span className="flex items-center gap-1 bg-red-500/30 text-red-400 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
                        <FaExclamationTriangle size={10} />
                        {Math.abs(diasRestantes)} dia{Math.abs(diasRestantes) > 1 ? 's' : ''} atrasada
                      </span>
                    </div>
                  )}

                  {/* Nome do Cliente */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      atrasada ? 'bg-red-500/20' : 'bg-amber-500/20'
                    }`}>
                      <FaBuilding className={`text-xl ${atrasada ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-slate-100 truncate">
                        {pedido.cliente_nome || 'Cliente não definido'}
                      </h4>
                      {pedido.endereco_obra && (
                        <p className="text-sm text-slate-400 flex items-center gap-1 truncate">
                          <FaMapMarkerAlt size={10} />
                          {pedido.endereco_obra}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Data Limite */}
                  <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${
                    atrasada ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-700/50'
                  }`}>
                    <FaCalendarAlt className={atrasada ? 'text-red-400' : 'text-amber-400'} />
                    <div className="flex-1">
                      <p className="text-xs text-slate-400">Data limite para lista pronta</p>
                      <p className={`font-bold ${atrasada ? 'text-red-400' : 'text-slate-100'}`}>
                        {pedido.data_lista_pronta 
                          ? new Date(pedido.data_lista_pronta + 'T12:00:00').toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Não definida'
                        }
                      </p>
                    </div>
                    {!atrasada && diasRestantes !== null && diasRestantes >= 0 && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                        {diasRestantes === 0 ? 'Hoje!' : `${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>

                  {/* Botão de Ação */}
                  <button
                    onClick={() => handleAbrirListaObra(pedido)}
                    className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                      atrasada
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                    }`}
                  >
                    <FaClipboardList />
                    Preencher Lista de Materiais
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header da seção de pedidos normais */}
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

        <div className="flex gap-2">
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
                      Data do Pedido: {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                    </span>
                    {pedido.data_material_disponivel && (
                      <span 
                        className="flex items-center gap-1 cursor-help"
                        title="Data limite para chegada dos materiais"
                      >
                        <FaCalendarAlt className="text-green-400" size={12} />
                        Data Limite: {new Date(pedido.data_material_disponivel + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
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
                  
                  <button
                    onClick={() => handleVerHistorico(pedido)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Ver Histórico"
                  >
                    <FaClipboardList />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Modal de Novo/Editar Pedido */}
      {showModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="execucao-modal execucao-modal-xl" onClick={(e) => e.stopPropagation()}>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSalvarComoTemplate}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          title="Salvar lista como template"
                        >
                          <FaSave size={10} /> Salvar Template
                        </button>
                        <button
                          type="button"
                          onClick={adicionarItem}
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        >
                          <FaPlus size={10} /> Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Seletor de Templates com Listas */}
                    {templates.length > 0 && (
                      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FaMagic className="text-purple-400" />
                            <span className="text-sm text-slate-300 font-medium">Carregar de Template</span>
                          </div>
                          {templateParaAplicar && (
                            <button
                              type="button"
                              onClick={() => { setTemplateParaAplicar(null); setListasSelecionadas([]); }}
                              className="text-xs text-slate-400 hover:text-slate-300"
                            >
                              Limpar seleção
                            </button>
                          )}
                        </div>
                        
                        {/* Lista de templates disponíveis */}
                        {!templateParaAplicar ? (
                          <div className="flex flex-wrap gap-2">
                            {templates.map(template => {
                              const listas = converterParaNovoFormato(template);
                              const totalItens = listas.reduce((acc, l) => acc + (l.itens?.length || 0), 0);
                              return (
                                <button
                                  key={template.id}
                                  type="button"
                                  onClick={() => { setTemplateParaAplicar(template); setListasSelecionadas([]); }}
                                  className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/40 rounded-lg text-sm text-purple-300 transition-all flex items-center gap-2"
                                >
                                  <div 
                                    className="w-6 h-6 rounded flex items-center justify-center text-xs"
                                    style={{ backgroundColor: `${template.cor || '#8b5cf6'}30`, color: template.cor || '#8b5cf6' }}
                                  >
                                    {getIcone(template.icone) ? React.cloneElement(getIcone(template.icone), { size: 12 }) : <FaTasks size={12} />}
                                  </div>
                                  <span>{template.nome}</span>
                                  <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">
                                    {listas.length} lista{listas.length > 1 ? 's' : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          /* Seleção de listas do template escolhido */
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-purple-300">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${templateParaAplicar.cor || '#8b5cf6'}30`, color: templateParaAplicar.cor || '#8b5cf6' }}
                              >
                                {getIcone(templateParaAplicar.icone)}
                              </div>
                              <span className="font-medium">{templateParaAplicar.nome}</span>
                              <span className="text-xs text-slate-400">- Selecione as listas:</span>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {converterParaNovoFormato(templateParaAplicar).map((lista, idx) => (
                                <div 
                                  key={idx}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    listasSelecionadas.includes(idx)
                                      ? 'bg-purple-500/20 border-purple-500'
                                      : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                                  }`}
                                  onClick={() => toggleListaSelecionada(idx)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      listasSelecionadas.includes(idx)
                                        ? 'bg-purple-500 border-purple-500'
                                        : 'border-slate-500'
                                    }`}>
                                      {listasSelecionadas.includes(idx) && <FaCheck size={10} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <FaList className="text-purple-400 flex-shrink-0" size={10} />
                                        <span className="text-sm font-medium text-slate-200 break-words">{lista.nome}</span>
                                        <span className="text-xs text-slate-500 flex-shrink-0">({lista.itens?.length || 0} itens)</span>
                                      </div>
                                      {lista.itens?.length > 0 && (
                                        <div className="mt-1 text-xs text-slate-400 break-words line-clamp-2">
                                          {lista.itens.slice(0, 3).map(i => i.nome).join(', ')}
                                          {lista.itens.length > 3 && '...'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                              <span className="text-xs text-slate-400">
                                {listasSelecionadas.length} lista{listasSelecionadas.length !== 1 ? 's' : ''} selecionada{listasSelecionadas.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={aplicarListasSelecionadas}
                                disabled={listasSelecionadas.length === 0}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  listasSelecionadas.length > 0
                                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                Aplicar Listas Selecionadas
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {!templateParaAplicar && (
                          <p className="text-xs text-slate-500 mt-2">
                            Clique em um template para selecionar quais listas adicionar
                          </p>
                        )}
                      </div>
                    )}

                    {/* Header dos itens */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 mb-1">
                      <span className="col-span-7">Nome do Item</span>
                      <span className="col-span-2 text-center">Qtd</span>
                      <span className="col-span-2">Unidade</span>
                      <span className="col-span-1"></span>
                    </div>

                    <div className="space-y-2">
                      {formData.itens.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            className="execucao-form-input col-span-7"
                            placeholder="Nome do item"
                            value={item.nome || ''}
                            onChange={(e) => atualizarItem(index, 'nome', e.target.value)}
                          />
                          <input
                            type="number"
                            className="execucao-form-input col-span-2 text-center"
                            placeholder="Qtd"
                            min="0.1"
                            step="0.1"
                            value={item.quantidade || 1}
                            onChange={(e) => atualizarItem(index, 'quantidade', parseFloat(e.target.value) || 1)}
                          />
                          <select
                            className="execucao-form-select col-span-2"
                            value={item.unidade || 'un'}
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
                          <div className="col-span-1 flex justify-center">
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
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Observações</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="3"
                      style={{ 
                        resize: 'vertical', 
                        minHeight: '80px',
                        overflow: 'hidden'
                      }}
                      placeholder="Observações adicionais..."
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      ref={(el) => {
                        if (el && formData.observacoes) {
                          el.style.height = 'auto';
                          el.style.height = el.scrollHeight + 'px';
                        }
                      }}
                    ></textarea>
                  </div>

                  {/* Campo de data de disponibilidade - só aparece ao editar pedido vinculado a obra */}
                  {pedidoSelecionado && pedidoSelecionado.obra_id && (
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">
                        📦 Data Limite para Materiais Disponíveis <span className="text-red-400">*</span>
                      </label>
                      <p className="text-xs text-slate-400 mb-2">
                        {dataDefinidaPeloAlerta 
                          ? 'Data definida durante a confirmação de edição. Não pode ser alterada.'
                          : 'Defina até quando os materiais devem estar disponíveis. Uma etapa "Chegada dos Materiais" será criada automaticamente no cronograma da obra.'
                        }
                      </p>
                      <input
                        type="date"
                        className={`execucao-form-input ${dataDefinidaPeloAlerta ? 'opacity-60 cursor-not-allowed' : ''}`}
                        value={formData.data_material_disponivel}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_material_disponivel: e.target.value }))}
                        required
                        disabled={dataDefinidaPeloAlerta}
                      />
                      {pedidoSelecionado.cliente_nome && (
                        <p className="text-xs text-slate-500 mt-1">
                          Cliente: {pedidoSelecionado.cliente_nome}
                        </p>
                      )}
                      {pedidoSelecionado.endereco_obra && (
                        <p className="text-xs text-slate-500">
                          Obra: {pedidoSelecionado.endereco_obra}
                        </p>
                      )}
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
                  {pedidoSelecionado ? 'Salvar Alterações' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar Template */}
      {showTemplateModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="execucao-modal execucao-modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaMagic className="text-purple-400" />
                {templateSelecionado ? 'Editar Template' : 'Novo Template'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowTemplateModal(false)}>
                ×
              </button>
            </div>

            <div className="execucao-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="space-y-4">
                {/* Dados básicos do template */}
                <div className="execucao-form-group">
                  <label className="execucao-form-label">Nome do Template *</label>
                  <input
                    type="text"
                    className="execucao-form-input"
                    value={formTemplate.nome}
                    onChange={(e) => setFormTemplate(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Manutenção SPDA"
                  />
                </div>

                {/* Listas do Template */}
                <div className="border-t border-slate-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-purple-400 flex items-center gap-2">
                      <FaList />
                      Listas do Template ({formTemplate.listas?.length || 0})
                    </label>
                    <button
                      type="button"
                      onClick={handleAdicionarLista}
                      className="text-xs flex items-center gap-1 px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
                    >
                      <FaPlus size={10} />
                      Nova Lista
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formTemplate.listas?.map((lista, listaIndex) => (
                      <div 
                        key={listaIndex}
                        className={`border rounded-lg transition-all ${
                          listaExpandida === listaIndex 
                            ? 'border-purple-500 bg-slate-800/70' 
                            : 'border-slate-700 bg-slate-800/30'
                        }`}
                      >
                        {/* Header da Lista */}
                        <div 
                          className="flex items-center gap-3 p-3 cursor-pointer"
                          onClick={() => setListaExpandida(listaExpandida === listaIndex ? null : listaIndex)}
                        >
                          <div className="text-purple-400">
                            {listaExpandida === listaIndex ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                          </div>
                          <input
                            type="text"
                            className="flex-1 bg-transparent border-none text-sm font-medium text-white focus:outline-none placeholder-slate-500"
                            value={lista.nome}
                            onChange={(e) => handleAtualizarNomeLista(listaIndex, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Nome da lista"
                          />
                          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                            {lista.itens?.length || 0} itens
                          </span>
                          {formTemplate.listas.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoverLista(listaIndex); }}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                              title="Remover lista"
                            >
                              <FaTrash size={10} />
                            </button>
                          )}
                        </div>

                        {/* Itens da Lista (expandido) */}
                        {listaExpandida === listaIndex && (
                          <div className="border-t border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-400">Itens desta lista:</span>
                              <button
                                type="button"
                                onClick={() => handleAdicionarItemNaLista(listaIndex)}
                                className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                              >
                                <FaPlus size={8} />
                                Adicionar Item
                              </button>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {lista.itens?.map((item, itemIndex) => (
                                <div 
                                  key={itemIndex}
                                  className="flex items-center gap-2 p-2 bg-slate-900/50 rounded border border-slate-700/50"
                                >
                                  <span className="text-[10px] text-slate-500 w-5">{itemIndex + 1}.</span>
                                  <input
                                    type="text"
                                    className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder-slate-500"
                                    value={item.nome || ''}
                                    onChange={(e) => handleAtualizarItemDaLista(listaIndex, itemIndex, 'nome', e.target.value)}
                                    placeholder="Nome do item"
                                  />
                                  <input
                                    type="number"
                                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-center"
                                    value={item.quantidade || 1}
                                    onChange={(e) => handleAtualizarItemDaLista(listaIndex, itemIndex, 'quantidade', parseFloat(e.target.value) || 1)}
                                    min="0.1"
                                    step="0.1"
                                  />
                                  <select
                                    className="bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs"
                                    value={item.unidade || 'un'}
                                    onChange={(e) => handleAtualizarItemDaLista(listaIndex, itemIndex, 'unidade', e.target.value)}
                                  >
                                    <option value="un">un</option>
                                    <option value="m">m</option>
                                    <option value="m²">m²</option>
                                    <option value="kg">kg</option>
                                    <option value="l">L</option>
                                    <option value="cx">cx</option>
                                    <option value="pct">pct</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoverItemDaLista(listaIndex, itemIndex)}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                                  >
                                    <FaTrash size={10} />
                                  </button>
                                </div>
                              ))}
                              {(!lista.itens || lista.itens.length === 0) && (
                                <div className="text-center py-3 text-slate-500 text-xs">
                                  Nenhum item. Clique em "Adicionar Item".
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="execucao-modal-footer">
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="execucao-btn bg-purple-600 hover:bg-purple-700"
                onClick={handleSalvarTemplate}
              >
                {templateSelecionado ? 'Salvar Alterações' : 'Criar Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alerta para Edição */}
      {showAlertaEdicao && (
        <div className="execucao-modal-overlay" onClick={() => setShowAlertaEdicao(false)}>
          <div className="execucao-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                <FaExclamationTriangle className="text-amber-400" />
                Atenção - Edição de Pedido
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowAlertaEdicao(false)}>
                ×
              </button>
            </div>

            <div className="execucao-modal-body">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-amber-200 text-sm mb-3">
                  <strong>⚠️ Impacto no Planejamento</strong>
                </p>
                <p className="text-slate-300 text-sm mb-2">
                  Ao editar este pedido, a <strong>data limite para chegada dos materiais deverá ser alterada</strong>.
                </p>
                <p className="text-slate-400 text-sm">
                  Esta modificação irá impactar o planejamento dos pedidos e, por consequência, o planejamento da execução do serviço.
                </p>
              </div>

              {pedidoParaEditar?.data_material_disponivel && (
                <div className="mb-4 p-3 bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Data limite atual:</p>
                  <p className="text-slate-200 font-medium">
                    {new Date(pedidoParaEditar.data_material_disponivel + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}

              <div className="execucao-form-group mb-4">
                <label className="execucao-form-label">
                  Nova Data Limite <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Deve ser posterior à data anterior
                </p>
                <input
                  type="date"
                  className="execucao-form-input"
                  value={novaDataLimite}
                  min={pedidoParaEditar?.data_material_disponivel || ''}
                  onChange={(e) => setNovaDataLimite(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={deAcordoMarcado}
                  onChange={(e) => setDeAcordoMarcado(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">
                  <strong>De Acordo</strong> - Estou ciente de que esta alteração irá impactar o planejamento e assumo a responsabilidade pela mudança.
                </span>
              </label>
            </div>

            <div className="execucao-modal-footer">
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setShowAlertaEdicao(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="execucao-btn execucao-btn-primary"
                onClick={handleConfirmarEdicao}
                disabled={!deAcordoMarcado || !novaDataLimite}
              >
                Confirmar e Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {showHistorico && (
        <div className="execucao-modal-overlay" onClick={() => setShowHistorico(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title flex items-center gap-2">
                <FaClipboardList className="text-blue-400" />
                Histórico de Alterações
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowHistorico(false)}>
                ×
              </button>
            </div>

            <div className="execucao-modal-body">
              {pedidoParaEditar && (
                <div className="mb-4 p-3 bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-300">
                    <strong>Pedido:</strong> {pedidoParaEditar.descricao}
                  </p>
                </div>
              )}

              {historicoPedido.length === 0 ? (
                <div className="text-center py-8">
                  <FaClipboardList className="mx-auto text-4xl text-slate-600 mb-3" />
                  <p className="text-slate-400">Nenhuma alteração registrada</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {historicoPedido.map((item, idx) => (
                    <div key={item.id || idx} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {item.tipo_alteracao === 'criacao' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Criação</span>
                          )}
                          {item.tipo_alteracao === 'edicao' && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Edição</span>
                          )}
                          {item.tipo_alteracao === 'status' && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">Status</span>
                          )}
                          {item.tipo_alteracao === 'data_limite' && (
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">Data Limite</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(item.data_alteracao).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-300 mb-2">{item.descricao}</p>
                      
                      <p className="text-xs text-slate-400">
                        Por: {item.usuario_nome || 'Sistema'}
                      </p>

                      {item.data_limite_anterior && item.data_limite_nova && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                          <p className="text-xs text-slate-400">
                            Data limite: {new Date(item.data_limite_anterior + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(item.data_limite_nova + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}

                      {item.dados_anteriores && item.dados_novos && item.tipo_alteracao === 'edicao' && (
                        <details className="mt-2 pt-2 border-t border-slate-700">
                          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                            Ver detalhes das alterações
                          </summary>
                          <div className="mt-2 text-xs text-slate-500 space-y-1">
                            {item.dados_anteriores.itens?.length !== item.dados_novos.itens?.length && (
                              <p>Itens: {item.dados_anteriores.itens?.length || 0} → {item.dados_novos.itens?.length || 0}</p>
                            )}
                            {item.dados_anteriores.urgencia !== item.dados_novos.urgencia && (
                              <p>Urgência: {item.dados_anteriores.urgencia} → {item.dados_novos.urgencia}</p>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="execucao-modal-footer">
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setShowHistorico(false)}
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

export default PedidoMaterial;
