import React, { useState, useEffect } from 'react';
import { 
  FaArrowLeft, 
  FaSearch, 
  FaSave,
  FaUser,
  FaBuilding,
  FaMoneyBillWave,
  FaMapMarkedAlt,
  FaTasks,
  FaUserTie,
  FaSpinner,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaTimes
} from 'react-icons/fa';
import { apontamentosService } from '../services/supabaseService';
import ApontamentosTable from './ApontamentosTable';

const ApontamentosComercial = ({ onVoltar, onDataUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false); // Estado inicial oculto
  const [formData, setFormData] = useState({
    tipoOportunidade: '',
    nomeCliente: '',
    fase: '',
    origemCliente: '',
    origemOutros: '',
    proprietarioRelacionamento: '',
    valorTotalServico: 0,
    valorEntradaServico: 0,
    quantidadeParcelas: '1',
    cidadeAtendimento: '',
    cidadeOutras: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Estados para controlar os valores formatados dos inputs monetários
  const [displayValues, setDisplayValues] = useState({
    valorTotalServico: 'R$ 0,00',
    valorEntradaServico: 'R$ 0,00'
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

    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const icon = type === 'success' ? <FaCheck /> : <FaTimes />;

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

  // Opções dos comboboxes
  const tiposOportunidade = [
    'MEDIÇÃO OHMICA',
    'SPDA',
    'ENTRADA DE ENERGIA',
    'CENTRO DE MEDIÇÃO',
    'PRUMADAS',
    'ESTAÇÃO DE RECARGA',
    'CABINE PRIMÁRIA',
    'QUADROS DE BOMBA',
    'PROJETOS ELÉTRICOS',
    'QUADROS ADMINISTRATIVOS',
    'SISTEMA DE ILUMINAÇÃO',
    'RESIDÊNCIAL',
    'QUADRO DE ELEVADOR',
    'ADEQUAÇÃO ELÉTRICA',
    'QUADRO DE DISJUNTORES',
    'MANUTENÇÃO ELÉTRICA',
    'CIVIL',
    'LAUDOS',
    'POSTE DE ENTRADA',
    'AVCB E SISTEMA DE INCÊNDIO'
  ];

  const fases = [
    'PROSPECÇÃO',
    'QUALIFICAÇÃO',
    'NEGOCIAÇÃO',
    'CONTRATO/VENDA',
    'CANCELADO/PERCA'
  ];

  const origensCliente = [
    'PROSPECÇÃO',
    'INDICAÇÃO',
    'GOOGLE',
    'CARTEIRA',
    'ADM',
    'OUTROS'
  ];

  const proprietarios = [
    'PAMELLI',
    'EDUARDA',
    'FÁBIO',
    'EDGAR'
  ];

  const cidades = [
    'GUARUJÁ',
    'BERTIOGA',
    'SANTOS',
    'SÃO VICENTE',
    'PRAIA GRANDE',
    'CUBATÃO',
    'SÃO SEBASTIÃO',
    'OUTRAS'
  ];

  // Gerar opções de parcelas (1x até 100x)
  const parcelas = Array.from({ length: 100 }, (_, i) => {
    const num = i + 1;
    if (num === 1) return { value: '1', label: '1x (À Vista)' };
    return { value: num.toString(), label: `${num}x` };
  });

  // Função para formatar valor monetário para exibição
  const formatCurrency = (numericValue) => {
    if (!numericValue) return 'R$ 0,00';
    const cleanValue = numericValue.toString().replace(/\D/g, '');
    if (!cleanValue) return 'R$ 0,00';
    
    const formattedValue = (parseInt(cleanValue) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formattedValue;
  };

  // Função para manipular mudanças nos inputs monetários
  const handleCurrencyChange = (field, value) => {
    const numericValue = value.replace(/\D/g, '');
    
    // Atualiza o valor formatado para exibição
    const formattedValue = formatCurrency(numericValue);
    setDisplayValues(prev => ({
      ...prev,
      [field]: formattedValue
    }));
    
    // Atualiza o valor numérico no formData
    const finalValue = numericValue ? parseInt(numericValue) / 100 : 0;
    setFormData(prev => ({
      ...prev,
      [field]: finalValue
    }));
  };

  // Função para validar apenas letras no nome do cliente
  const handleClienteNameChange = (value) => {
    const onlyLetters = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    setFormData(prev => ({
      ...prev,
      nomeCliente: onlyLetters
    }));
  };

  // Função para validar formulário
  const validateForm = () => {
    const newErrors = {};

    if (!formData.tipoOportunidade) {
      newErrors.tipoOportunidade = 'Tipo de oportunidade é obrigatório';
    }

    if (!formData.nomeCliente.trim()) {
      newErrors.nomeCliente = 'Nome do cliente é obrigatório';
    }

    if (!formData.fase) {
      newErrors.fase = 'Fase é obrigatória';
    }

    if (!formData.origemCliente) {
      newErrors.origemCliente = 'Origem do cliente é obrigatória';
    }

    if (formData.origemCliente === 'OUTROS' && !formData.origemOutros.trim()) {
      newErrors.origemOutros = 'Especifique a origem quando selecionado "OUTROS"';
    }

    if (formData.cidadeAtendimento === 'OUTRAS' && !formData.cidadeOutras.trim()) {
      newErrors.cidadeOutras = 'Especifique a cidade quando selecionado "OUTRAS"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Função para submeter o formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Salvar no Supabase
      const novoApontamento = await apontamentosService.criarApontamento(formData);
      
      console.log('Apontamento salvo com sucesso:', novoApontamento);
      
      // Mostrar mensagem de sucesso via toast
      showToast('🎉 Apontamento salvo com sucesso!', 'success');
      
      // Limpar formulário após salvar
      setFormData({
        tipoOportunidade: '',
        nomeCliente: '',
        fase: '',
        origemCliente: '',
        origemOutros: '',
        proprietarioRelacionamento: '',
        valorTotalServico: 0,
        valorEntradaServico: 0,
        quantidadeParcelas: '1',
        cidadeAtendimento: '',
        cidadeOutras: ''
      });
      setDisplayValues({
        valorTotalServico: 'R$ 0,00',
        valorEntradaServico: 'R$ 0,00'
      });
      setErrors({});
      
      // Trigger reload da tabela
      setReloadTrigger(prev => prev + 1);
      
      // Atualizar dados no dashboard principal se a callback foi fornecida
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (error) {
      console.error('Erro ao salvar apontamento:', error);
      showToast('❌ Erro ao salvar apontamento. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Toast Component */}
      <Toast 
        show={toast.show} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ show: false, message: '', type: '' })}
      />

      {/* Header */}
      <div className="header-gradient shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <button
                onClick={onVoltar}
                className="bg-white/20 hover:bg-white/30 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <FaArrowLeft className="text-lg sm:text-xl" />
              </button>
              
              <div className="text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  Apontamentos Comercial
                </h1>
                <p className="text-base sm:text-lg text-white/80 mt-1 sm:mt-2">
                  📝 Registre novas oportunidades comerciais
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/20 backdrop-blur-sm text-white placeholder-white/70 pl-10 pr-4 py-2 sm:py-3 rounded-lg sm:rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 text-sm sm:text-base w-full sm:w-64"
                />
              </div>
              
              {/* Botão para ocultar/mostrar formulário */}
              <button
                onClick={() => setIsFormVisible(!isFormVisible)}
                className="bg-white/20 hover:bg-white/30 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
                title={isFormVisible ? "Ocultar formulário de cadastro" : "Mostrar formulário de cadastro"}
              >
                {isFormVisible ? <FaEyeSlash className="text-lg sm:text-xl" /> : <FaEye className="text-lg sm:text-xl" />}
                <span className="hidden sm:inline text-sm">
                  {isFormVisible ? "Ocultar Formulário de Cadastro" : "Mostrar Formulário de Cadastro"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isFormVisible && (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Oportunidade */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaTasks className="mr-2 text-blue-500" />
                  Tipo de Oportunidade *
                </label>
                <select
                  value={formData.tipoOportunidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipoOportunidade: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.tipoOportunidade ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Selecione o tipo de oportunidade</option>
                  {tiposOportunidade.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {errors.tipoOportunidade && (
                  <p className="text-red-500 text-sm mt-1">{errors.tipoOportunidade}</p>
                )}
              </div>

            {/* Nome do Cliente */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FaUser className="mr-2 text-green-500" />
                Nome do Cliente *
              </label>
              <input
                type="text"
                value={formData.nomeCliente}
                onChange={(e) => handleClienteNameChange(e.target.value)}
                placeholder="Digite o nome do cliente (apenas letras)"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.nomeCliente ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.nomeCliente && (
                <p className="text-red-500 text-sm mt-1">{errors.nomeCliente}</p>
              )}
            </div>

            {/* Grid para Fase e Origem */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fase */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaBuilding className="mr-2 text-purple-500" />
                  Fase *
                </label>
                <select
                  value={formData.fase}
                  onChange={(e) => setFormData(prev => ({ ...prev, fase: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.fase ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Selecione a fase</option>
                  {fases.map((fase) => (
                    <option key={fase} value={fase}>{fase}</option>
                  ))}
                </select>
                {errors.fase && (
                  <p className="text-red-500 text-sm mt-1">{errors.fase}</p>
                )}
              </div>

              {/* Origem do Cliente */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaSearch className="mr-2 text-orange-500" />
                  O Cliente Chegou por *
                </label>
                <select
                  value={formData.origemCliente}
                  onChange={(e) => setFormData(prev => ({ ...prev, origemCliente: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.origemCliente ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Selecione a origem</option>
                  {origensCliente.map((origem) => (
                    <option key={origem} value={origem}>{origem}</option>
                  ))}
                </select>
                {errors.origemCliente && (
                  <p className="text-red-500 text-sm mt-1">{errors.origemCliente}</p>
                )}
              </div>
            </div>

            {/* Campo adicional para "OUTROS" na origem */}
            {formData.origemCliente === 'OUTROS' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Especifique a origem *
                </label>
                <input
                  type="text"
                  value={formData.origemOutros}
                  onChange={(e) => setFormData(prev => ({ ...prev, origemOutros: e.target.value }))}
                  placeholder="Digite a origem do cliente"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.origemOutros ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.origemOutros && (
                  <p className="text-red-500 text-sm mt-1">{errors.origemOutros}</p>
                )}
              </div>
            )}

            {/* Proprietário do Relacionamento */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FaUserTie className="mr-2 text-indigo-500" />
                Proprietário do Relacionamento
              </label>
              <select
                value={formData.proprietarioRelacionamento}
                onChange={(e) => setFormData(prev => ({ ...prev, proprietarioRelacionamento: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione o proprietário</option>
                {proprietarios.map((proprietario) => (
                  <option key={proprietario} value={proprietario}>{proprietario}</option>
                ))}
              </select>
            </div>

            {/* Grid para Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Valor Total do Serviço */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaMoneyBillWave className="mr-2 text-green-500" />
                  Valor Total do Serviço
                </label>
                <input
                  type="text"
                  value={displayValues.valorTotalServico}
                  onChange={(e) => handleCurrencyChange('valorTotalServico', e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Valor de Entrada do Serviço */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaMoneyBillWave className="mr-2 text-blue-500" />
                  Valor de Entrada do Serviço
                </label>
                <input
                  type="text"
                  value={displayValues.valorEntradaServico}
                  onChange={(e) => handleCurrencyChange('valorEntradaServico', e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Grid para Parcelas e Cidade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quantidade de Parcelas */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Quantidade de Parcelas
                </label>
                <select
                  value={formData.quantidadeParcelas}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantidadeParcelas: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {parcelas.map((parcela) => (
                    <option key={parcela.value} value={parcela.value}>{parcela.label}</option>
                  ))}
                </select>
              </div>

              {/* Cidade de Atendimento */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <FaMapMarkedAlt className="mr-2 text-red-500" />
                  Cidade de Atendimento
                </label>
                <select
                  value={formData.cidadeAtendimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidadeAtendimento: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione a cidade</option>
                  {cidades.map((cidade) => (
                    <option key={cidade} value={cidade}>{cidade}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campo adicional para "OUTRAS" cidades */}
            {formData.cidadeAtendimento === 'OUTRAS' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Especifique a cidade *
                </label>
                <input
                  type="text"
                  value={formData.cidadeOutras}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidadeOutras: e.target.value }))}
                  placeholder="Digite o nome da cidade"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.cidadeOutras ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.cidadeOutras && (
                  <p className="text-red-500 text-sm mt-1">{errors.cidadeOutras}</p>
                )}
              </div>
            )}

            {/* Botão de Salvar */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <FaSpinner className="mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FaSave className="mr-2" />
                    Salvar Apontamento
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* Tabela de Apontamentos */}
      <ApontamentosTable 
        reloadTrigger={reloadTrigger} 
        searchTerm={searchTerm}
      />
    </div>
  );
};

export default ApontamentosComercial;