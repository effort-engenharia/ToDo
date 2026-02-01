import React, { useState, useEffect } from 'react';
import { FaBell, FaExclamationTriangle, FaChevronDown, FaChevronUp, FaClock, FaUserTie, FaSearch, FaCheck, FaSpinner } from 'react-icons/fa';
import { apontamentosService } from '../../../services/supabaseService';

const AvisosEsquecidos = () => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processando, setProcessando] = useState({});

  // Filtrar avisos pelo termo de busca
  const avisosFiltrados = avisos.filter(aviso =>
    aviso.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar avisos por proprietário e ordenar do mais recente para o mais atrasado
  const avisosAgrupados = avisosFiltrados.reduce((acc, aviso) => {
    const proprietario = aviso.proprietario_relacionamento || 'SEM PROPRIETÁRIO';
    if (!acc[proprietario]) {
      acc[proprietario] = [];
    }
    acc[proprietario].push(aviso);
    return acc;
  }, {});

  // Ordenar avisos dentro de cada grupo (menor dias primeiro = mais recente)
  Object.keys(avisosAgrupados).forEach(proprietario => {
    avisosAgrupados[proprietario].sort((a, b) => a.dias_sem_atualizacao - b.dias_sem_atualizacao);
  });

  const carregarAvisos = async () => {
    try {
      setLoading(true);
      const data = await apontamentosService.buscarApontamentosEsquecidos(8);
      setAvisos(data);
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAvisos();

    // Atualizar a cada 5 minutos
    const interval = setInterval(carregarAvisos, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Função para registrar alinhamento
  const handleAlinhamento = async (apontamentoId, nomeCliente) => {
    try {
      setProcessando(prev => ({ ...prev, [apontamentoId]: true }));
      await apontamentosService.registrarAlinhamento(apontamentoId);
      
      // Remover o aviso da lista local
      setAvisos(prev => prev.filter(a => a.id !== apontamentoId));
      
    } catch (error) {
      console.error('Erro ao registrar alinhamento:', error);
      alert('Erro ao registrar alinhamento. Tente novamente.');
    } finally {
      setProcessando(prev => ({ ...prev, [apontamentoId]: false }));
    }
  };

  // Se não houver avisos ou estiver carregando, não exibir nada
  if (loading || avisos.length === 0) {
    return null;
  }

  const totalAvisos = avisos.length;
  const totalFiltrados = avisosFiltrados.length;
  const proprietarios = Object.keys(avisosAgrupados);

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-lg overflow-hidden">
        {/* Header do componente */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 p-2 rounded-lg">
              <FaBell className="text-white text-lg" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-amber-800 flex items-center">
                <FaExclamationTriangle className="mr-2 text-amber-600" />
                Oportunidades Esquecidas
              </h3>
              <p className="text-sm text-amber-600">
                {totalAvisos} {totalAvisos === 1 ? 'oportunidade' : 'oportunidades'} sem atualização há mais de 8 dias
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {totalAvisos}
            </span>
            {expanded ? (
              <FaChevronUp className="text-amber-600" />
            ) : (
              <FaChevronDown className="text-amber-600" />
            )}
          </div>
        </button>

        {/* Conteúdo expandido */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Campo de busca */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-400" />
              <input
                type="text"
                placeholder="Buscar por nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-sm"
              />
              {searchTerm && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-amber-600">
                  {totalFiltrados} encontrados
                </span>
              )}
            </div>

            {/* Lista de proprietários com scroll */}
            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {proprietarios.length === 0 ? (
                <p className="text-center text-amber-600 py-4">Nenhum resultado encontrado</p>
              ) : (
                proprietarios.map((proprietario) => (
                  <div key={proprietario} className="bg-white rounded-lg border border-amber-100 overflow-hidden">
                    {/* Header do proprietário */}
                    <div className="bg-amber-100 px-3 py-2 flex items-center justify-between sticky top-0">
                      <div className="flex items-center space-x-2">
                        <FaUserTie className="text-amber-700" />
                        <span className="font-semibold text-amber-800">{proprietario}</span>
                      </div>
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {avisosAgrupados[proprietario].length}
                      </span>
                    </div>

                    {/* Lista de oportunidades com scroll interno */}
                    <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                      {avisosAgrupados[proprietario].map((aviso) => (
                        <div key={aviso.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm truncate">{aviso.nome_cliente}</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{aviso.fase}</span>
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded truncate">{aviso.tipo_oportunidade}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                <FaClock className="text-xs" />
                                <span className="text-xs font-semibold">{aviso.dias_sem_atualizacao} dias</span>
                              </div>
                              <button
                                onClick={() => handleAlinhamento(aviso.id, aviso.nome_cliente)}
                                disabled={processando[aviso.id]}
                                className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-2 py-1 rounded-lg transition-colors text-xs font-medium"
                                title="Marcar alinhamento realizado"
                              >
                                {processando[aviso.id] ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  <FaCheck />
                                )}
                                <span className="hidden sm:inline">Alinhamento Realizado</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvisosEsquecidos;
