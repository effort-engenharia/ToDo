import React, { useState, useEffect } from 'react';
import { FaCalendarCheck, FaChevronDown, FaChevronUp, FaClock, FaUserTie, FaSearch, FaStickyNote, FaCalendarAlt, FaCheck, FaSpinner } from 'react-icons/fa';
import { apontamentosService } from '../../../services/supabaseService';
import ProximoEventoModal from '../../../components/ProximoEventoModal';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Componente para exibir próximos eventos (retomadas agendadas)
 * Exibe oportunidades com data de retomada futura ou para hoje
 *
 * Filtro por vendedor:
 *  - Admin (não impersonando) vê tudo.
 *  - Vendedor comum (ou admin impersonando um vendedor) vê apenas os próprios.
 */
const ProximosEventos = () => {
  const { usuario, isAdmin } = useAuth();
  const nomeVendedor = usuario?.nome_vendedor_comercial;
  const admin = typeof isAdmin === 'function' ? isAdmin() : false;

  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processando, setProcessando] = useState({});

  // Estado para o modal de trabalho de evento
  const [modalEvento, setModalEvento] = useState({
    isOpen: false,
    evento: null
  });

  // Aplica escopo por vendedor (não-admins só vêem os próprios)
  const eventosDoEscopo = admin
    ? eventos
    : eventos.filter(ev => ev.proprietario_relacionamento === nomeVendedor);

  // Filtrar eventos pelo termo de busca
  const eventosFiltrados = eventosDoEscopo.filter(evento =>
    evento.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar eventos por proprietário
  const eventosAgrupados = eventosFiltrados.reduce((acc, evento) => {
    const proprietario = evento.proprietario_relacionamento || 'SEM PROPRIETÁRIO';
    if (!acc[proprietario]) {
      acc[proprietario] = [];
    }
    acc[proprietario].push(evento);
    return acc;
  }, {});

  // Ordenar eventos dentro de cada grupo (mais próximo primeiro)
  Object.keys(eventosAgrupados).forEach(proprietario => {
    eventosAgrupados[proprietario].sort((a, b) => a.dias_ate_retomada - b.dias_ate_retomada);
  });

  const carregarEventos = async () => {
    try {
      setLoading(true);
      const data = await apontamentosService.buscarProximosEventos();
      setEventos(data);
    } catch (error) {
      console.error('Erro ao carregar próximos eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEventos();

    // Atualizar a cada 5 minutos
    const interval = setInterval(carregarEventos, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Abrir modal de trabalho de evento
  const abrirModalEvento = (evento) => {
    setModalEvento({ isOpen: true, evento });
  };

  // Fechar modal
  const fecharModalEvento = () => {
    setModalEvento({ isOpen: false, evento: null });
  };

  // Confirmar ação do modal (dispatcher)
  const confirmarAcaoEvento = async ({ acao, dataNova, observacao }) => {
    const evento = modalEvento.evento;
    if (!evento) return;
    const apontamentoId = evento.id;

    try {
      setProcessando(prev => ({ ...prev, [apontamentoId]: true }));

      switch (acao) {
        case 'realizado_manter':
          // Registra alinhamento e agenda próximo contato
          await apontamentosService.registrarAlinhamento(apontamentoId, dataNova, observacao);
          break;
        case 'realizado_contrato':
          await apontamentosService.concluirEventoMudandoFase(apontamentoId, 'CONTRATO/VENDA', observacao);
          break;
        case 'realizado_perca':
          await apontamentosService.concluirEventoMudandoFase(apontamentoId, 'CANCELADO/PERCA', observacao);
          break;
        case 'reagendar':
          await apontamentosService.reagendarEvento(apontamentoId, dataNova, observacao);
          break;
        case 'cancelar':
          await apontamentosService.cancelarEvento(apontamentoId, observacao);
          break;
        default:
          throw new Error(`Ação desconhecida: ${acao}`);
      }

      // Recarrega a lista — quase todas as ações removem/alteram o item
      await carregarEventos();
      fecharModalEvento();
    } catch (error) {
      console.error('Erro ao processar evento:', error);
      alert(error.message || 'Erro ao processar evento. Tente novamente.');
    } finally {
      setProcessando(prev => ({ ...prev, [apontamentoId]: false }));
    }
  };

  // Se não houver eventos (no escopo do usuário) ou estiver carregando, não exibir nada
  if (loading || eventosDoEscopo.length === 0) {
    return null;
  }

  const totalEventos = eventosDoEscopo.length;
  const totalFiltrados = eventosFiltrados.length;
  const proprietarios = Object.keys(eventosAgrupados);

  // Formatar data de retomada
  const formatarDataRetomada = (dataStr) => {
    const data = new Date(dataStr + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  // Obter classe de cor baseada nos dias até retomada
  //  0 dias         → verde (hoje)
  //  1-2 dias       → azul forte (iminente)
  //  3-7 dias       → azul claro (semana)
  //  8-30 dias      → cinza-azulado (médio prazo)
  //  > 30 dias      → cinza (longo prazo)
  const getCorDias = (dias) => {
    if (dias === 0) return 'bg-green-500 text-white';
    if (dias <= 2) return 'bg-blue-500 text-white';
    if (dias <= 7) return 'bg-blue-100 text-blue-700';
    if (dias <= 30) return 'bg-slate-100 text-slate-700';
    return 'bg-gray-100 text-gray-600';
  };

  // Obter texto do badge de dias
  const getTextoDias = (dias) => {
    if (dias === 0) return 'HOJE';
    if (dias === 1) return 'Amanhã';
    return `${dias} dias`;
  };

  return (
    <div className="mb-4">
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl shadow-lg overflow-hidden">
        {/* Header do componente */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 p-2 rounded-lg">
              <FaCalendarCheck className="text-white text-lg" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-blue-800 flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-600" />
                Próximos Eventos
              </h3>
              <p className="text-sm text-blue-600">
                {totalEventos} {totalEventos === 1 ? 'retomada agendada' : 'retomadas agendadas'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {totalEventos}
            </span>
            {expanded ? (
              <FaChevronUp className="text-blue-600" />
            ) : (
              <FaChevronDown className="text-blue-600" />
            )}
          </div>
        </button>

        {/* Conteúdo expandido */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Campo de busca */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="Buscar por nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-sm"
              />
              {searchTerm && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-blue-600">
                  {totalFiltrados} encontrados
                </span>
              )}
            </div>

            {/* Lista de proprietários com scroll */}
            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {proprietarios.length === 0 ? (
                <p className="text-center text-blue-600 py-4">Nenhum resultado encontrado</p>
              ) : (
                proprietarios.map((proprietario) => (
                  <div key={proprietario} className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                    {/* Header do proprietário */}
                    <div className="bg-blue-100 px-3 py-2 flex items-center justify-between sticky top-0">
                      <div className="flex items-center space-x-2">
                        <FaUserTie className="text-blue-700" />
                        <span className="font-semibold text-blue-800">{proprietario}</span>
                      </div>
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {eventosAgrupados[proprietario].length}
                      </span>
                    </div>

                    {/* Lista de eventos com scroll interno */}
                    <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                      {eventosAgrupados[proprietario].map((evento) => (
                        <div key={evento.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm truncate">{evento.nome_cliente}</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{evento.fase}</span>
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded truncate">{evento.tipo_oportunidade}</span>
                              </div>
                              {evento.observacao_retomada && (
                                <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                                  <FaStickyNote className="text-gray-400" />
                                  <span className="truncate">{evento.observacao_retomada}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <div className="flex flex-col items-end space-y-1">
                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold ${getCorDias(evento.dias_ate_retomada)}`}>
                                  <FaClock className="text-xs" />
                                  <span>{getTextoDias(evento.dias_ate_retomada)}</span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatarDataRetomada(evento.data_retomada_prevista)}
                                </span>
                              </div>
                              <button
                                onClick={() => abrirModalEvento(evento)}
                                disabled={processando[evento.id]}
                                className="flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-2 py-1 rounded-lg transition-colors text-xs font-medium"
                                title="Editar este evento agendado"
                              >
                                {processando[evento.id] ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  <FaCheck />
                                )}
                                <span className="hidden sm:inline">Editar Evento</span>
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

      {/* Modal de Trabalho de Evento */}
      <ProximoEventoModal
        isOpen={modalEvento.isOpen}
        onClose={fecharModalEvento}
        onConfirm={confirmarAcaoEvento}
        evento={modalEvento.evento}
        isProcessing={modalEvento.evento ? processando[modalEvento.evento.id] : false}
      />
    </div>
  );
};

export default ProximosEventos;
