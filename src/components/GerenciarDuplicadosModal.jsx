import React, { useState, useEffect, useMemo } from 'react';
import {
  FaTimes,
  FaSpinner,
  FaCheck,
  FaTrash,
  FaFilter,
  FaExclamationTriangle,
  FaChevronDown,
  FaChevronUp,
  FaClone,
  FaUndo
} from 'react-icons/fa';
import { apontamentosService } from '../services/supabaseService';

// Opções de critérios de agrupamento disponíveis
const CRITERIOS_DISPONIVEIS = [
  { campo: 'nome_cliente', label: 'Nome do Cliente', obrigatorio: true },
  { campo: 'tipo_oportunidade', label: 'Tipo de Oportunidade', obrigatorio: false },
  { campo: 'proprietario_relacionamento', label: 'Proprietário', obrigatorio: false },
  { campo: 'cidade_atendimento', label: 'Cidade', obrigatorio: false },
  { campo: 'fase', label: 'Fase', obrigatorio: false },
  { campo: 'origem_cliente', label: 'Origem', obrigatorio: false }
];

const GerenciarDuplicadosModal = ({ isOpen, onClose, onSuccess }) => {
  // Estados
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [duplicados, setDuplicados] = useState(null);
  const [criteriosSelecionados, setCriteriosSelecionados] = useState(['nome_cliente', 'tipo_oportunidade']);
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [registrosSelecionados, setRegistrosSelecionados] = useState({}); // { grupoChave: [ids] }
  const [registroManter, setRegistroManter] = useState({}); // { grupoChave: id }
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Toast component
  const Toast = ({ show, message, type, onClose }) => {
    if (!show) return null;
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-[60] flex items-center space-x-3`}>
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 hover:bg-white/20 p-1 rounded">
          <FaTimes size={14} />
        </button>
      </div>
    );
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  };

  // Buscar duplicados quando critérios mudam
  const buscarDuplicados = async () => {
    if (criteriosSelecionados.length === 0) {
      showToast('Selecione pelo menos um critério de agrupamento', 'error');
      return;
    }

    setLoading(true);
    try {
      const resultado = await apontamentosService.buscarDuplicados(criteriosSelecionados);
      setDuplicados(resultado);
      setGruposExpandidos({});
      setRegistrosSelecionados({});
      setRegistroManter({});
    } catch (error) {
      console.error('Erro ao buscar duplicados:', error);
      showToast('Erro ao buscar duplicados', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Buscar ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      buscarDuplicados();
    }
  }, [isOpen]);

  // Toggle critério
  const toggleCriterio = (campo) => {
    const criterio = CRITERIOS_DISPONIVEIS.find(c => c.campo === campo);
    if (criterio?.obrigatorio) return; // Não pode desmarcar obrigatório

    setCriteriosSelecionados(prev => {
      if (prev.includes(campo)) {
        return prev.filter(c => c !== campo);
      } else {
        return [...prev, campo];
      }
    });
  };

  // Toggle expansão do grupo
  const toggleGrupo = (chave) => {
    setGruposExpandidos(prev => ({
      ...prev,
      [chave]: !prev[chave]
    }));
  };

  // Selecionar registro para inativar
  const toggleSelecionarRegistro = (grupoChave, registroId) => {
    setRegistrosSelecionados(prev => {
      const selecionados = prev[grupoChave] || [];
      if (selecionados.includes(registroId)) {
        return {
          ...prev,
          [grupoChave]: selecionados.filter(id => id !== registroId)
        };
      } else {
        return {
          ...prev,
          [grupoChave]: [...selecionados, registroId]
        };
      }
    });
  };

  // Definir registro a manter (o principal)
  const definirRegistroManter = (grupoChave, registroId) => {
    setRegistroManter(prev => ({
      ...prev,
      [grupoChave]: registroId
    }));
    
    // Selecionar automaticamente todos os outros para inativar
    const grupo = duplicados?.grupos.find(g => g.chave === grupoChave);
    if (grupo) {
      const outrosIds = grupo.registros
        .filter(r => r.id !== registroId)
        .map(r => r.id);
      setRegistrosSelecionados(prev => ({
        ...prev,
        [grupoChave]: outrosIds
      }));
    }
  };

  // Inativar registros selecionados de um grupo
  const inativarSelecionados = async (grupoChave) => {
    const idsParaInativar = registrosSelecionados[grupoChave] || [];
    const idManter = registroManter[grupoChave];

    if (idsParaInativar.length === 0) {
      showToast('Selecione registros para inativar', 'warning');
      return;
    }

    setProcessando(true);
    try {
      const motivo = `Duplicado identificado por higienização em ${new Date().toLocaleDateString('pt-BR')}`;
      
      await apontamentosService.inativarMultiplos(idsParaInativar, motivo, idManter);
      
      showToast(`${idsParaInativar.length} registro(s) inativado(s) com sucesso!`, 'success');
      
      // Recarregar duplicados
      await buscarDuplicados();
      
      // Notificar componente pai
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao inativar:', error);
      showToast('Erro ao inativar registros', 'error');
    } finally {
      setProcessando(false);
    }
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Cor da fase
  const getFaseColor = (fase) => {
    const cores = {
      'PROSPECÇÃO': 'bg-blue-100 text-blue-800',
      'QUALIFICAÇÃO': 'bg-yellow-100 text-yellow-800',
      'NEGOCIAÇÃO': 'bg-orange-100 text-orange-800',
      'CONTRATO/VENDA': 'bg-green-100 text-green-800',
      'CANCELADO/PERCA': 'bg-red-100 text-red-800'
    };
    return cores[fase] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) return null;

  return (
    <>
      <Toast 
        show={toast.show} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ show: false, message: '', type: '' })} 
      />
      
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FaClone className="text-white text-2xl" />
              <div>
                <h2 className="text-xl font-bold text-white">Gerenciar Duplicados</h2>
                <p className="text-white/80 text-sm">Identifique e inative registros duplicados</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>

          {/* Painel de Critérios */}
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="flex items-center space-x-2 mb-3">
              <FaFilter className="text-gray-500" />
              <span className="font-medium text-gray-700">Critérios de Agrupamento:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CRITERIOS_DISPONIVEIS.map(criterio => {
                const selecionado = criteriosSelecionados.includes(criterio.campo);
                return (
                  <button
                    key={criterio.campo}
                    onClick={() => toggleCriterio(criterio.campo)}
                    disabled={criterio.obrigatorio}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selecionado
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-orange-300'
                    } ${criterio.obrigatorio ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                  >
                    {criterio.label}
                    {criterio.obrigatorio && ' *'}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">* Critério obrigatório</span>
              <button
                onClick={buscarDuplicados}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaFilter />}
                <span>Aplicar Filtros</span>
              </button>
            </div>
          </div>

          {/* Conteúdo (scrollável) */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <FaSpinner className="animate-spin text-3xl text-orange-500 mr-3" />
                <span className="text-lg text-gray-600">Analisando duplicados...</span>
              </div>
            ) : duplicados?.grupos?.length > 0 ? (
              <div className="space-y-4">
                {/* Resumo */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FaExclamationTriangle className="text-orange-500 text-xl" />
                    <div>
                      <span className="font-bold text-orange-800">{duplicados.totalGrupos}</span>
                      <span className="text-orange-700"> grupo(s) com duplicidade encontrado(s)</span>
                      <span className="text-orange-600 ml-2">
                        ({duplicados.totalRegistrosDuplicados} registros no total)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de Grupos */}
                {duplicados.grupos.map((grupo, index) => {
                  const expandido = gruposExpandidos[grupo.chave];
                  const selecionados = registrosSelecionados[grupo.chave] || [];
                  const idManter = registroManter[grupo.chave];

                  return (
                    <div key={grupo.chave} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Header do Grupo */}
                      <div 
                        className="bg-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-150"
                        onClick={() => toggleGrupo(grupo.chave)}
                      >
                        <div className="flex items-center space-x-3">
                          {expandido ? <FaChevronUp className="text-gray-500" /> : <FaChevronDown className="text-gray-500" />}
                          <div>
                            <span className="font-medium text-gray-800">
                              Grupo {index + 1}: 
                            </span>
                            <span className="ml-2 text-gray-600">
                              {grupo.chave.split('|||').join(' + ')}
                            </span>
                          </div>
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {grupo.quantidade} registros
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selecionados.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                inativarSelecionados(grupo.chave);
                              }}
                              disabled={processando}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
                            >
                              {processando ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                              <span>Inativar {selecionados.length}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Registros do Grupo (expandido) */}
                      {expandido && (
                        <div className="divide-y divide-gray-100">
                          {grupo.registros.map((registro, regIndex) => {
                            const selecionado = selecionados.includes(registro.id);
                            const ehManter = idManter === registro.id;

                            return (
                              <div 
                                key={registro.id}
                                className={`px-4 py-3 flex items-center justify-between transition-colors ${
                                  ehManter ? 'bg-green-50 border-l-4 border-green-500' : 
                                  selecionado ? 'bg-red-50 border-l-4 border-red-500' : 
                                  'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center space-x-4 flex-1">
                                  {/* Checkbox de seleção */}
                                  <input
                                    type="checkbox"
                                    checked={selecionado}
                                    onChange={() => toggleSelecionarRegistro(grupo.chave, registro.id)}
                                    className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                    disabled={ehManter}
                                  />

                                  {/* Info do registro */}
                                  <div className="flex-1 grid grid-cols-6 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500 text-xs block">Cliente</span>
                                      <span className="font-medium text-gray-800 truncate block" title={registro.nome_cliente}>
                                        {registro.nome_cliente}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 text-xs block">Oportunidade</span>
                                      <span className="text-gray-700 truncate block" title={registro.tipo_oportunidade}>
                                        {registro.tipo_oportunidade}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 text-xs block">Fase</span>
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getFaseColor(registro.fase)}`}>
                                        {registro.fase}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 text-xs block">Valor</span>
                                      <span className="text-gray-800 font-medium">
                                        {formatCurrency(registro.valor_total_servico)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 text-xs block">Proprietário</span>
                                      <span className="text-gray-700 truncate block">
                                        {registro.proprietario_relacionamento || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500 text-xs block">Criado em</span>
                                      <span className="text-gray-700">{formatDate(registro.created_at)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Ações */}
                                <div className="flex items-center space-x-2 ml-4">
                                  {ehManter ? (
                                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center space-x-1">
                                      <FaCheck />
                                      <span>Manter</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => definirRegistroManter(grupo.chave, registro.id)}
                                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
                                    >
                                      <FaCheck />
                                      <span>Manter este</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : duplicados ? (
              <div className="text-center py-12">
                <FaCheck className="text-5xl text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhum duplicado encontrado!</h3>
                <p className="text-gray-600">
                  Não foram identificados registros duplicados com os critérios selecionados.
                </p>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Critérios: {criteriosSelecionados.map(c => 
                CRITERIOS_DISPONIVEIS.find(cr => cr.campo === c)?.label
              ).join(', ')}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default GerenciarDuplicadosModal;
