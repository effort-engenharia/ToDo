import React, { useState, useEffect } from 'react';
import {
  FaCheck,
  FaSpinner,
  FaCalendarAlt,
  FaTimes,
  FaHistory,
  FaExclamationTriangle,
  FaClipboardCheck,
  FaCalendarPlus,
  FaBan,
  FaHandshake,
  FaTimesCircle,
  FaArrowRight
} from 'react-icons/fa';
import { apontamentosService } from '../services/supabase/apontamentos';

/**
 * Modal dedicado para trabalhar eventos agendados (Próximos Eventos).
 * Três fluxos:
 *   • Realizado  → contato aconteceu. Sub-escolha: manter fase / CONTRATO/VENDA / CANCELADO/PERCA
 *   • Reagendar  → contato não aconteceu, escolher nova data
 *   • Cancelar   → evento não é mais necessário (apontamento continua ativo, só sai da agenda)
 *
 * Observação é OBRIGATÓRIA em qualquer fluxo.
 * Retorna via onConfirm({ acao, ...dados }) — o pai chama o serviço correspondente.
 */

const ATALHOS_DIAS = [7, 15, 30, 60];

// Formata Date para YYYY-MM-DD (input type=date)
const toISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Retorna próximo dia útil a partir de hoje (pula sáb/dom)
const proximoDiaUtil = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return toISODate(d);
};

const somarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return toISODate(d);
};

const formatBR = (isoDate) =>
  isoDate
    ? new Date(isoDate + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '';

const ProximoEventoModal = ({
  isOpen,
  onClose,
  onConfirm,
  evento, // objeto completo do evento (id, nome_cliente, fase, valor_total_servico, data_retomada_prevista, observacao_retomada, proprietario_relacionamento…)
  isProcessing = false
}) => {
  const [acao, setAcao] = useState(null); // 'realizado' | 'reagendar' | 'cancelar'
  const [proximoPasso, setProximoPasso] = useState('manter'); // 'manter' | 'contrato' | 'perca'
  const [dataNova, setDataNova] = useState('');
  const [observacao, setObservacao] = useState('');
  const [qtdReagendamentos, setQtdReagendamentos] = useState(0);
  const [historico, setHistorico] = useState([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Reset ao abrir/trocar evento
  useEffect(() => {
    if (isOpen && evento?.id) {
      setAcao(null);
      setProximoPasso('manter');
      setDataNova('');
      setObservacao('');
      setHistorico([]);
      setHistoricoAberto(false);
      // Buscar contagem de reagendamentos em background
      apontamentosService.contarReagendamentos(evento.id).then(setQtdReagendamentos);
    }
  }, [isOpen, evento?.id]);

  if (!isOpen || !evento) return null;

  const abrirHistorico = async () => {
    if (historicoAberto) {
      setHistoricoAberto(false);
      return;
    }
    setHistoricoAberto(true);
    if (historico.length === 0) {
      setCarregandoHistorico(true);
      try {
        const data = await apontamentosService.buscarHistoricoAlteracoes(evento.id);
        setHistorico(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setCarregandoHistorico(false);
      }
    }
  };

  const getMinDate = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toISODate(t);
  };

  // Regras de validação por ação
  const observacaoOk = observacao.trim().length > 0;
  const dataOk = !!dataNova;

  const podeConfirmar = (() => {
    if (isProcessing || !acao || !observacaoOk) return false;
    if (acao === 'reagendar') return dataOk;
    if (acao === 'realizado' && proximoPasso === 'manter') return dataOk;
    return true; // cancelar, realizado+contrato, realizado+perca
  })();

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    const obs = observacao.trim();
    if (acao === 'reagendar') {
      onConfirm({ acao: 'reagendar', dataNova, observacao: obs });
    } else if (acao === 'cancelar') {
      onConfirm({ acao: 'cancelar', observacao: obs });
    } else if (acao === 'realizado') {
      if (proximoPasso === 'manter') {
        onConfirm({ acao: 'realizado_manter', dataNova, observacao: obs });
      } else if (proximoPasso === 'contrato') {
        onConfirm({ acao: 'realizado_contrato', observacao: obs });
      } else if (proximoPasso === 'perca') {
        onConfirm({ acao: 'realizado_perca', observacao: obs });
      }
    }
  };

  // Preview do próximo estado (rodapé)
  const previewProximoEstado = (() => {
    if (!acao) return null;
    if (acao === 'reagendar' && dataOk) {
      return `Sai da lista e volta em ${formatBR(dataNova)}.`;
    }
    if (acao === 'cancelar') {
      return `Sai da agenda. Apontamento continua ativo na fase ${evento.fase}, sem próximo evento.`;
    }
    if (acao === 'realizado') {
      if (proximoPasso === 'manter' && dataOk) {
        return `Alinhamento registrado. Volta em ${formatBR(dataNova)}.`;
      }
      if (proximoPasso === 'contrato') {
        return `Fase muda para CONTRATO/VENDA. Sai da agenda de eventos.`;
      }
      if (proximoPasso === 'perca') {
        return `Fase muda para CANCELADO/PERCA. Sai da agenda de eventos.`;
      }
    }
    return null;
  })();

  const alertaReagendamento = qtdReagendamentos >= 3;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-white/90" />
              <h2 className="text-white text-lg font-bold leading-tight">
                Evento agendado
              </h2>
              {alertaReagendamento && (
                <span
                  className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full"
                  title="Este evento já foi reagendado múltiplas vezes"
                >
                  <FaExclamationTriangle />
                  {qtdReagendamentos}º reagendamento
                </span>
              )}
            </div>
            <p className="text-white/90 text-sm mt-1 truncate">
              {evento.nome_cliente}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 disabled:opacity-50"
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
        </div>

        {/* Contexto do evento */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
            <div>
              <span className="text-gray-500">Fase:</span>{' '}
              <strong>{evento.fase}</strong>
            </div>
            <div>
              <span className="text-gray-500">Proprietário:</span>{' '}
              <strong>{evento.proprietario_relacionamento || '—'}</strong>
            </div>
          </div>
          <div className="mt-2 text-gray-700">
            <span className="text-gray-500">Agendado para:</span>{' '}
            <strong>{formatBR(evento.data_retomada_prevista)}</strong>
          </div>
          {evento.observacao_retomada && (
            <div className="mt-1 text-gray-700">
              <span className="text-gray-500">Observação anterior:</span>{' '}
              <em>&ldquo;{evento.observacao_retomada}&rdquo;</em>
            </div>
          )}
          <button
            onClick={abrirHistorico}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            type="button"
          >
            <FaHistory /> {historicoAberto ? 'Ocultar histórico' : 'Ver histórico'}
          </button>
          {historicoAberto && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-xs">
              {carregandoHistorico ? (
                <p className="text-gray-500">Carregando…</p>
              ) : historico.length === 0 ? (
                <p className="text-gray-500">Sem alterações registradas.</p>
              ) : (
                <ul className="space-y-1">
                  {historico.slice(0, 15).map((h) => (
                    <li key={h.id} className="border-b border-gray-100 pb-1 last:border-0">
                      <span className="text-gray-400">
                        {new Date(h.data_alteracao).toLocaleString('pt-BR')}
                      </span>{' '}
                      <span className="text-gray-600">{h.campo_alterado}:</span>{' '}
                      <span className="text-gray-800">{h.valor_novo || '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Escolha da ação principal */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              O que aconteceu?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAcao('realizado')}
                disabled={isProcessing}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  acao === 'realizado'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 font-semibold text-green-700">
                  <FaClipboardCheck /> Realizado
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  O contato aconteceu
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAcao('reagendar')}
                disabled={isProcessing}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  acao === 'reagendar'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 font-semibold text-blue-700">
                  <FaCalendarPlus /> Reagendar
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Não falei ainda, remarcar
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAcao('cancelar')}
                disabled={isProcessing}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  acao === 'cancelar'
                    ? 'border-gray-500 bg-gray-100 ring-2 ring-gray-300'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                  <FaBan /> Cancelar evento
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Não vou mais falar
                </p>
              </button>
            </div>
          </div>

          {/* Sub-escolha para 'Realizado' */}
          {acao === 'realizado' && (
            <div className="border-l-4 border-green-400 pl-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Próximo passo
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="proximoPasso"
                    value="manter"
                    checked={proximoPasso === 'manter'}
                    onChange={(e) => setProximoPasso(e.target.value)}
                    disabled={isProcessing}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-gray-800 flex items-center gap-2">
                      <FaArrowRight className="text-gray-400" /> Manter na fase atual e agendar novo contato
                    </div>
                    <p className="text-xs text-gray-500">
                      Fluxo normal — continua em {evento.fase}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-emerald-50 cursor-pointer">
                  <input
                    type="radio"
                    name="proximoPasso"
                    value="contrato"
                    checked={proximoPasso === 'contrato'}
                    onChange={(e) => setProximoPasso(e.target.value)}
                    disabled={isProcessing}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-emerald-700 flex items-center gap-2">
                      <FaHandshake /> Avançou para CONTRATO/VENDA
                    </div>
                    <p className="text-xs text-gray-500">
                      Fecha a agenda e move para CONTRATO/VENDA
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-red-50 cursor-pointer">
                  <input
                    type="radio"
                    name="proximoPasso"
                    value="perca"
                    checked={proximoPasso === 'perca'}
                    onChange={(e) => setProximoPasso(e.target.value)}
                    disabled={isProcessing}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-red-700 flex items-center gap-2">
                      <FaTimesCircle /> Perdemos — CANCELADO/PERCA
                    </div>
                    <p className="text-xs text-gray-500">
                      Fecha a agenda e move para CANCELADO/PERCA (apontamento continua ativo)
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Campo de data (quando aplicável) */}
          {((acao === 'reagendar') || (acao === 'realizado' && proximoPasso === 'manter')) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {acao === 'reagendar' ? 'Nova data do contato' : 'Data do próximo contato'} *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {acao === 'reagendar' && (
                  <button
                    type="button"
                    onClick={() => setDataNova(proximoDiaUtil())}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-colors disabled:opacity-50"
                  >
                    Próximo dia útil
                  </button>
                )}
                {ATALHOS_DIAS.map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setDataNova(somarDias(dias))}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-colors disabled:opacity-50"
                  >
                    +{dias} dias
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={dataNova}
                onChange={(e) => setDataNova(e.target.value)}
                min={getMinDate()}
                disabled={isProcessing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50"
              />
              {dataOk && (
                <p className="text-xs text-gray-500 mt-1">
                  Você será lembrado em <strong className="text-gray-700">{formatBR(dataNova)}</strong>.
                </p>
              )}
            </div>
          )}

          {/* Observação (sempre obrigatória) */}
          {acao && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Observação *
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={
                  acao === 'reagendar'
                    ? 'Por que precisou reagendar? Ex.: cliente pediu para adiar por causa de viagem…'
                    : acao === 'cancelar'
                    ? 'Por que o evento foi cancelado? Ex.: cliente perdeu interesse temporariamente…'
                    : 'O que foi combinado neste alinhamento?'
                }
                maxLength={500}
                rows={3}
                disabled={isProcessing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {observacao.length}/500
              </p>
            </div>
          )}

          {/* Preview do próximo estado */}
          {previewProximoEstado && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Após confirmar:</strong> {previewProximoEstado}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <FaCheck />
                <span>Confirmar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProximoEventoModal;
