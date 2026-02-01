import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaCalculator, 
  FaSave, 
  FaTrash, 
  FaTimes, 
  FaSpinner,
  FaEye,
  FaPercent,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaHistory,
  FaChevronDown,
  FaChevronUp,
  FaCheck
} from 'react-icons/fa';
import { arsenalService } from '../services/supabaseService';

// Componente para exibir cálculos salvos
const FinanciamentosSalvos = ({ 
  financiamentos, 
  onExcluir, 
  onVisualizar,
  isLoading 
}) => {
  const [expandido, setExpandido] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-center py-8">
          <FaSpinner className="animate-spin text-2xl text-blue-500 mr-2" />
          <span className="text-gray-600">Carregando financiamentos salvos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-6">
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex justify-between items-center mb-4"
      >
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FaHistory className="text-purple-500" />
          Financiamentos Salvos ({financiamentos.length})
        </h3>
        {expandido ? <FaChevronUp /> : <FaChevronDown />}
      </button>

      {expandido && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {financiamentos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FaCalculator className="text-4xl mx-auto mb-4 opacity-50" />
              <p>Nenhum financiamento salvo ainda</p>
              <p className="text-sm">Faça um cálculo e salve para visualizar aqui</p>
            </div>
          ) : (
            financiamentos.map((fin) => (
              <div 
                key={fin.id} 
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{fin.nome}</h4>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="inline-block mr-4">
                        💰 Total: {Number(fin.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="inline-block">
                        📊 Final: {Number(fin.valor_total_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(fin.created_at).toLocaleDateString('pt-BR')} às {new Date(fin.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onVisualizar(fin)}
                      className="text-blue-600 hover:text-blue-800 p-2"
                      title="Visualizar detalhes"
                    >
                      <FaEye />
                    </button>
                    <button
                      onClick={() => onExcluir(fin)}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Excluir"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Modal para visualizar detalhes do financiamento
const ModalDetalhes = ({ financiamento, onFechar }) => {
  if (!financiamento) return null;

  const resumo = financiamento.resumo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaCalculator className="text-blue-500" />
            {financiamento.nome}
          </h3>
          <button
            onClick={onFechar}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Resumo Geral */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Valor Original</div>
              <div className="text-2xl font-bold text-blue-800">
                {Number(financiamento.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Valor Final</div>
              <div className="text-2xl font-bold text-green-800">
                {Number(financiamento.valor_total_final).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          {/* Total de Juros */}
          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="text-sm text-amber-600 font-medium">Total de Juros Pagos</div>
            <div className="text-xl font-bold text-amber-800">
              {Number(financiamento.valor_juros_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              <span className="text-sm font-normal ml-2">
                ({((Number(financiamento.valor_juros_total) / Number(financiamento.valor_total)) * 100).toFixed(2)}% do valor original)
              </span>
            </div>
          </div>

          {/* Detalhes da Entrada */}
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              💳 Entrada
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Valor da Entrada:</span>
                <span className="font-medium ml-2">
                  {Number(financiamento.valor_entrada).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Parcelas:</span>
                <span className="font-medium ml-2">{financiamento.parcelas_entrada}x</span>
              </div>
              <div>
                <span className="text-gray-500">Com Juros:</span>
                <span className="font-medium ml-2">{financiamento.entrada_com_juros ? 'Sim' : 'Não'}</span>
              </div>
              {financiamento.entrada_com_juros && (
                <div>
                  <span className="text-gray-500">Taxa de Juros (a.a.):</span>
                  <span className="font-medium ml-2">{Number(financiamento.juros_entrada_ano).toFixed(2)}%</span>
                </div>
              )}
            </div>
            {resumo?.entrada && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-sm">
                  <span className="text-gray-500">Valor da Parcela:</span>
                  <span className="font-medium ml-2">
                    {Number(resumo.entrada.valorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Total com Juros:</span>
                  <span className="font-medium ml-2">
                    {Number(resumo.entrada.totalComJuros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detalhes do Restante */}
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              📊 Valor Restante (Financiado)
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Valor Financiado:</span>
                <span className="font-medium ml-2">
                  {Number(financiamento.valor_restante).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Parcelas:</span>
                <span className="font-medium ml-2">{financiamento.parcelas_restante}x</span>
              </div>
              <div>
                <span className="text-gray-500">Taxa de Juros (a.a.):</span>
                <span className="font-medium ml-2">{Number(financiamento.juros_restante_ano).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-gray-500">Taxa de Juros (a.m.):</span>
                <span className="font-medium ml-2">{(Number(financiamento.juros_restante_ano) / 12).toFixed(4)}%</span>
              </div>
            </div>
            {resumo?.restante && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-sm">
                  <span className="text-gray-500">Valor da Parcela:</span>
                  <span className="font-medium ml-2">
                    {Number(resumo.restante.valorParcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Total com Juros:</span>
                  <span className="font-medium ml-2">
                    {Number(resumo.restante.totalComJuros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onFechar}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente principal da Calculadora
const CalculadoraFinanciamento = ({ addNotification }) => {
  // Estados do formulário
  const [valorTotal, setValorTotal] = useState('');
  const [valorEntrada, setValorEntrada] = useState('');
  const [parcelasEntrada, setParcelasEntrada] = useState(1);
  const [entradaComJuros, setEntradaComJuros] = useState(false);
  const [jurosEntradaAno, setJurosEntradaAno] = useState('');
  const [parcelasRestante, setParcelasRestante] = useState(12);
  const [jurosRestanteAno, setJurosRestanteAno] = useState('');
  
  // Estados do resultado
  const [resultado, setResultado] = useState(null);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  
  // Estados para salvar
  const [nomeFinanciamento, setNomeFinanciamento] = useState('');
  const [mostrarModalSalvar, setMostrarModalSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Estados para financiamentos salvos
  const [financiamentosSalvos, setFinanciamentosSalvos] = useState([]);
  const [carregandoSalvos, setCarregandoSalvos] = useState(true);
  const [financiamentoVisualizar, setFinanciamentoVisualizar] = useState(null);
  
  // Estados para exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [financiamentoExcluir, setFinanciamentoExcluir] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Estados para taxas econômicas
  const [taxaSelic, setTaxaSelic] = useState(null);
  const [carregandoTaxas, setCarregandoTaxas] = useState(true);

  // Carregar financiamentos salvos e taxas econômicas
  useEffect(() => {
    carregarFinanciamentosSalvos();
    carregarTaxasEconomicas();
  }, []);

  const carregarFinanciamentosSalvos = async () => {
    try {
      setCarregandoSalvos(true);
      const dados = await arsenalService.buscarFinanciamentos();
      setFinanciamentosSalvos(dados);
    } catch (error) {
      console.error('Erro ao carregar financiamentos:', error);
    } finally {
      setCarregandoSalvos(false);
    }
  };

  // Buscar taxas Selic e IPCA do Banco Central
  const carregarTaxasEconomicas = async () => {
    try {
      setCarregandoTaxas(true);
      
      // API do Banco Central - Taxa Selic Meta (série 432)
      const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
      const data = await response.json();
      if (data && data[0]) {
        setTaxaSelic(parseFloat(data[0].valor));
      }
    } catch (error) {
      console.error('Erro ao carregar taxas econômicas:', error);
    } finally {
      setCarregandoTaxas(false);
    }
  };

  // Formatar valor para exibição
  const formatarMoeda = (valor) => {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Converter string para número
  const parseValor = (valor) => {
    if (!valor) return 0;
    // Remove R$, espaços e pontos de milhar, depois substitui vírgula por ponto
    const limpo = String(valor)
      .replace(/R\$\s?/g, '')     // Remove R$ e espaço opcional
      .replace(/\./g, '')         // Remove pontos de milhar
      .replace(',', '.');         // Substitui vírgula decimal por ponto
    return parseFloat(limpo) || 0;
  };

  // Formatar input de moeda enquanto digita
  const formatarInputMoeda = (valor) => {
    // Remove tudo que não é número
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    
    // Converte para número e formata
    const numero = parseInt(apenasNumeros, 10) / 100;
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Handler para inputs de moeda
  const handleValorTotalChange = (e) => {
    const formatted = formatarInputMoeda(e.target.value);
    setValorTotal(formatted);
  };

  const handleValorEntradaChange = (e) => {
    const formatted = formatarInputMoeda(e.target.value);
    setValorEntrada(formatted);
  };

  // Gerar opções de parcelas (1 a 200)
  const gerarOpcoesParcelas = (max = 200) => {
    return Array.from({ length: max }, (_, i) => i + 1);
  };

  // Calcular parcela usando tabela PRICE (amortização francesa)
  const calcularParcelaPRICE = (valorPrincipal, taxaJurosAnual, numeroParcelas) => {
    if (valorPrincipal <= 0 || numeroParcelas <= 0) return 0;
    if (taxaJurosAnual <= 0) return valorPrincipal / numeroParcelas;

    // Converter taxa anual para mensal
    const taxaMensal = taxaJurosAnual / 100 / 12;
    
    // Fórmula PRICE: PMT = PV * [i * (1 + i)^n] / [(1 + i)^n - 1]
    const fator = Math.pow(1 + taxaMensal, numeroParcelas);
    const parcela = valorPrincipal * (taxaMensal * fator) / (fator - 1);
    
    return parcela;
  };

  // Calcular financiamento
  const calcularFinanciamento = useCallback(() => {
    const total = parseValor(valorTotal);
    const entrada = parseValor(valorEntrada);
    const jurosEntrada = parseValor(jurosEntradaAno);
    const jurosRestante = parseValor(jurosRestanteAno);

    if (total <= 0) {
      addNotification('Informe o valor total do contrato', 'error');
      return;
    }

    if (entrada < 0 || entrada > total) {
      addNotification('O valor da entrada deve ser entre 0 e o valor total', 'error');
      return;
    }

    if (parcelasRestante <= 0) {
      addNotification('Informe a quantidade de parcelas do restante', 'error');
      return;
    }

    const valorRestante = total - entrada;

    // Calcular entrada
    let parcelaEntrada = 0;
    let totalEntradaComJuros = entrada;
    let jurosEntradaTotal = 0;

    if (entrada > 0 && parcelasEntrada > 0) {
      if (entradaComJuros && jurosEntrada > 0) {
        parcelaEntrada = calcularParcelaPRICE(entrada, jurosEntrada, parcelasEntrada);
        totalEntradaComJuros = parcelaEntrada * parcelasEntrada;
        jurosEntradaTotal = totalEntradaComJuros - entrada;
      } else {
        parcelaEntrada = entrada / parcelasEntrada;
        totalEntradaComJuros = entrada;
      }
    }

    // Calcular restante
    let parcelaRestante = 0;
    let totalRestanteComJuros = valorRestante;
    let jurosRestanteTotal = 0;

    if (valorRestante > 0 && parcelasRestante > 0) {
      if (jurosRestante > 0) {
        parcelaRestante = calcularParcelaPRICE(valorRestante, jurosRestante, parcelasRestante);
        totalRestanteComJuros = parcelaRestante * parcelasRestante;
        jurosRestanteTotal = totalRestanteComJuros - valorRestante;
      } else {
        parcelaRestante = valorRestante / parcelasRestante;
        totalRestanteComJuros = valorRestante;
      }
    }

    // Totais
    const valorTotalFinal = totalEntradaComJuros + totalRestanteComJuros;
    const jurosTotal = jurosEntradaTotal + jurosRestanteTotal;

    const novoResultado = {
      valorTotal: total,
      valorEntrada: entrada,
      parcelasEntrada,
      entradaComJuros,
      jurosEntradaAno: jurosEntrada,
      valorRestante,
      parcelasRestante,
      jurosRestanteAno: jurosRestante,
      valorTotalFinal,
      valorJurosTotal: jurosTotal,
      resumo: {
        entrada: {
          valorOriginal: entrada,
          parcelas: parcelasEntrada,
          valorParcela: parcelaEntrada,
          totalComJuros: totalEntradaComJuros,
          juros: jurosEntradaTotal
        },
        restante: {
          valorOriginal: valorRestante,
          parcelas: parcelasRestante,
          valorParcela: parcelaRestante,
          totalComJuros: totalRestanteComJuros,
          juros: jurosRestanteTotal
        }
      }
    };

    setResultado(novoResultado);
    setMostrarResumo(true);
    addNotification('Cálculo realizado com sucesso!', 'success');
  }, [valorTotal, valorEntrada, parcelasEntrada, entradaComJuros, jurosEntradaAno, parcelasRestante, jurosRestanteAno, addNotification]);

  // Salvar financiamento
  const handleSalvar = async () => {
    if (!nomeFinanciamento.trim()) {
      addNotification('Informe um nome para o financiamento', 'error');
      return;
    }

    if (!resultado) {
      addNotification('Faça um cálculo primeiro', 'error');
      return;
    }

    try {
      setSalvando(true);
      const dadosParaSalvar = {
        nome: nomeFinanciamento.trim(),
        ...resultado
      };

      await arsenalService.salvarFinanciamento(dadosParaSalvar);
      await carregarFinanciamentosSalvos();
      
      setMostrarModalSalvar(false);
      setNomeFinanciamento('');
      addNotification('Financiamento salvo com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar financiamento:', error);
      addNotification('Erro ao salvar financiamento. Tente novamente.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  // Excluir financiamento
  const handleConfirmDelete = async () => {
    if (deleteConfirmName !== financiamentoExcluir?.nome) return;

    try {
      await arsenalService.excluirFinanciamento(financiamentoExcluir.id);
      await carregarFinanciamentosSalvos();
      
      setShowDeleteModal(false);
      setFinanciamentoExcluir(null);
      setDeleteConfirmName('');
      addNotification('Financiamento excluído com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao excluir financiamento:', error);
      addNotification('Erro ao excluir financiamento. Tente novamente.', 'error');
    }
  };

  // Limpar formulário
  const limparFormulario = () => {
    setValorTotal('');
    setValorEntrada('');
    setParcelasEntrada(1);
    setEntradaComJuros(false);
    setJurosEntradaAno('');
    setParcelasRestante(12);
    setJurosRestanteAno('');
    setResultado(null);
    setMostrarResumo(false);
  };

  return (
    <div className="space-y-6">
      {/* Calculadora */}
      <div className="bg-white rounded-xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaCalculator className="text-blue-500" />
            Calculadora de Financiamento
          </h2>
          <button
            onClick={limparFormulario}
            className="text-gray-500 hover:text-gray-700 p-2"
            title="Limpar"
          >
            <FaTimes />
          </button>
        </div>

        {/* Alerta com taxas atuais */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📊</span>
            <span className="font-semibold text-blue-800">Taxas de Referência Atuais</span>
            <span className="text-xs text-blue-600">(Banco Central do Brasil)</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
              <span className="text-amber-500 font-bold">SELIC:</span>
              {carregandoTaxas ? (
                <FaSpinner className="animate-spin text-blue-500" />
              ) : taxaSelic !== null ? (
                <span className="font-bold text-gray-800">{taxaSelic.toFixed(2)}% a.a.</span>
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </div>
            <button
              onClick={carregarTaxasEconomicas}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 ml-auto"
              title="Atualizar taxas"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna 1: Dados do Contrato */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaMoneyBillWave className="text-green-500" />
              Dados do Contrato
            </h3>

            {/* Valor Total */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Valor Total do Contrato
              </label>
              <input
                type="text"
                value={valorTotal}
                onChange={handleValorTotalChange}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="R$ 0,00"
              />
            </div>

            {/* Entrada */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-gray-700 mb-3">💳 Entrada</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Valor da Entrada
                  </label>
                  <input
                    type="text"
                    value={valorEntrada}
                    onChange={handleValorEntradaChange}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="R$ 0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Parcelas da Entrada
                  </label>
                  <select
                    value={parcelasEntrada}
                    onChange={(e) => setParcelasEntrada(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {gerarOpcoesParcelas(200).map(n => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? '(À vista)' : n <= 12 ? '' : `(${(n/12).toFixed(1)} anos)`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="entradaComJuros"
                    checked={entradaComJuros}
                    onChange={(e) => setEntradaComJuros(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="entradaComJuros" className="text-sm text-gray-600">
                    Entrada com juros
                  </label>
                </div>

                {entradaComJuros && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <FaPercent className="inline mr-1" /> Juros da Entrada (% ao ano)
                    </label>
                    <input
                      type="text"
                      value={jurosEntradaAno}
                      onChange={(e) => setJurosEntradaAno(e.target.value)}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Financiamento do Restante */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              Financiamento do Restante
            </h3>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">Valor a Financiar</div>
                <div className="text-xl font-bold text-blue-800">
                  {formatarMoeda(Math.max(0, parseValor(valorTotal) - parseValor(valorEntrada)))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Quantidade de Parcelas
                  </label>
                  <select
                    value={parcelasRestante}
                    onChange={(e) => setParcelasRestante(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {gerarOpcoesParcelas(200).map(n => (
                      <option key={n} value={n}>
                        {n}x {n < 12 ? `(${n} ${n === 1 ? 'mês' : 'meses'})` : `(${(n/12).toFixed(1)} anos)`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    <FaPercent className="inline mr-1" /> Taxa de Juros (% ao ano)
                  </label>
                  <input
                    type="text"
                    value={jurosRestanteAno}
                    onChange={(e) => setJurosRestanteAno(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                  {jurosRestanteAno && (
                    <div className="text-xs text-gray-500 mt-1">
                      ≈ {(parseValor(jurosRestanteAno) / 12).toFixed(4)}% ao mês
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Botão Calcular */}
            <button
              onClick={calcularFinanciamento}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium shadow-lg"
            >
              <FaCalculator />
              Calcular Financiamento
            </button>
          </div>
        </div>

        {/* Resultado */}
        {mostrarResumo && resultado && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              📊 Resumo do Cálculo
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-blue-600 font-medium">Valor Original</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatarMoeda(resultado.valorTotal)}
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg text-center">
                <div className="text-sm text-amber-600 font-medium">Total de Juros</div>
                <div className="text-2xl font-bold text-amber-800">
                  {formatarMoeda(resultado.valorJurosTotal)}
                </div>
                <div className="text-xs text-amber-600">
                  ({((resultado.valorJurosTotal / resultado.valorTotal) * 100).toFixed(2)}%)
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 font-medium">Valor Final</div>
                <div className="text-2xl font-bold text-green-800">
                  {formatarMoeda(resultado.valorTotalFinal)}
                </div>
              </div>
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Entrada */}
              {resultado.valorEntrada > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2">💳 Entrada</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Valor:</span>
                      <span className="font-medium">{formatarMoeda(resultado.valorEntrada)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Parcelas:</span>
                      <span className="font-medium">{resultado.parcelasEntrada}x de {formatarMoeda(resultado.resumo.entrada.valorParcela)}</span>
                    </div>
                    {resultado.entradaComJuros && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Juros:</span>
                        <span className="font-medium text-amber-600">+{formatarMoeda(resultado.resumo.entrada.juros)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700 font-medium">Total Entrada:</span>
                      <span className="font-bold">{formatarMoeda(resultado.resumo.entrada.totalComJuros)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Restante */}
              {resultado.valorRestante > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2">📊 Financiamento</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Valor Financiado:</span>
                      <span className="font-medium">{formatarMoeda(resultado.valorRestante)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Parcelas:</span>
                      <span className="font-medium">{resultado.parcelasRestante}x de {formatarMoeda(resultado.resumo.restante.valorParcela)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxa:</span>
                      <span className="font-medium">{resultado.jurosRestanteAno}% a.a.</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Juros:</span>
                      <span className="font-medium text-amber-600">+{formatarMoeda(resultado.resumo.restante.juros)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700 font-medium">Total Financiado:</span>
                      <span className="font-bold">{formatarMoeda(resultado.resumo.restante.totalComJuros)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-end">
              <button
                onClick={() => setMostrarModalSalvar(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 font-medium shadow-lg"
              >
                <FaSave />
                Salvar Cálculo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financiamentos Salvos */}
      <FinanciamentosSalvos 
        financiamentos={financiamentosSalvos}
        isLoading={carregandoSalvos}
        onExcluir={(fin) => {
          setFinanciamentoExcluir(fin);
          setShowDeleteModal(true);
          setDeleteConfirmName('');
        }}
        onVisualizar={(fin) => setFinanciamentoVisualizar(fin)}
      />

      {/* Modal Salvar */}
      {mostrarModalSalvar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaSave className="text-green-500" />
              Salvar Financiamento
            </h3>
            <p className="text-gray-600 mb-4">
              Digite um nome para identificar este cálculo:
            </p>
            <input
              type="text"
              value={nomeFinanciamento}
              onChange={(e) => setNomeFinanciamento(e.target.value)}
              className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-green-500"
              placeholder="Ex: Financiamento Casa João Silva"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setMostrarModalSalvar(false);
                  setNomeFinanciamento('');
                }}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!nomeFinanciamento.trim() || salvando}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {salvando ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-600 mb-4">
              Para confirmar a exclusão de <strong>{financiamentoExcluir?.nome}</strong>, 
              digite o nome completo abaixo:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="w-full p-3 border rounded-lg mb-4"
              placeholder="Nome do financiamento"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setFinanciamentoExcluir(null);
                  setDeleteConfirmName('');
                }}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmName !== financiamentoExcluir?.nome}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      <ModalDetalhes 
        financiamento={financiamentoVisualizar}
        onFechar={() => setFinanciamentoVisualizar(null)}
      />
    </div>
  );
};

export default CalculadoraFinanciamento;
