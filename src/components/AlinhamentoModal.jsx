import React, { useState } from 'react';
import { FaCheck, FaSpinner, FaCalendarAlt, FaStickyNote } from 'react-icons/fa';

/**
 * Modal reutilizável para registrar alinhamento.
 * Regra de negócio (2026-07): TODO alinhamento exige uma data de próximo contato.
 * O sistema só volta a lembrar o vendedor quando a data escolhida chegar.
 * Usado em: AvisosEsquecidos, ProximosEventos, ApontamentosTable
 */

// Atalhos de dias (não pré-selecionados — apenas preenchem o campo de data ao clicar)
const ATALHOS_DIAS = [7, 15, 30, 60];

const AlinhamentoModal = ({
  isOpen,
  onClose,
  onConfirm,
  nomeCliente,
  isProcessing = false
}) => {
  const [dataRetomada, setDataRetomada] = useState('');
  const [observacao, setObservacao] = useState('');

  // Limpar formulário ao fechar
  const handleClose = () => {
    setDataRetomada('');
    setObservacao('');
    onClose();
  };

  // Confirmar alinhamento
  const handleConfirm = () => {
    if (!dataRetomada) return; // Guard: botão já fica desabilitado, mas garante segurança
    onConfirm({
      dataRetomada,
      observacao: observacao || null
    });
  };

  // Calcular data mínima (amanhã) para o input de data
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Aplica um atalho: hoje + N dias
  const aplicarAtalho = (dias) => {
    const alvo = new Date();
    alvo.setDate(alvo.getDate() + dias);
    setDataRetomada(alvo.toISOString().split('T')[0]);
  };

  // Formata a data escolhida para preview em pt-BR
  const preview = dataRetomada
    ? new Date(dataRetomada + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FaCheck className="text-white text-lg" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Registrar Alinhamento</h2>
              <p className="text-green-100 text-sm truncate max-w-[280px]">{nomeCliente}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Instrução principal */}
          <p className="text-sm text-gray-700">
            Escolha <strong>quando você quer ser lembrado</strong> deste cliente novamente.
            O apontamento sai das listas até essa data.
          </p>

          {/* Atalhos rápidos (não pré-selecionados) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Atalhos
            </label>
            <div className="flex flex-wrap gap-2">
              {ATALHOS_DIAS.map(dias => (
                <button
                  key={dias}
                  type="button"
                  onClick={() => aplicarAtalho(dias)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 text-gray-700 transition-colors disabled:opacity-50"
                >
                  +{dias} dias
                </button>
              ))}
            </div>
          </div>

          {/* Data de retomada */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <FaCalendarAlt className="text-green-500" />
              <span>Data para próximo contato *</span>
            </label>
            <input
              type="date"
              value={dataRetomada}
              onChange={(e) => setDataRetomada(e.target.value)}
              min={getMinDate()}
              disabled={isProcessing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent disabled:opacity-50"
            />
            {preview && (
              <p className="text-xs text-gray-500 mt-1">
                Você será lembrado em <strong className="text-gray-700">{preview}</strong>.
              </p>
            )}
          </div>

          {/* Observação (opcional) */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <FaStickyNote className="text-green-500" />
              <span>Observação (opcional)</span>
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Cliente solicitou retorno após análise do orçamento…"
              maxLength={500}
              rows={3}
              disabled={isProcessing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{observacao.length}/500</p>
          </div>

          {/* Aviso sobre efeito */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            📅 O apontamento vai para <strong>Próximos Eventos</strong> até a data escolhida.
            Depois disso, se você não retomar o contato, ele aparece em <strong>Oportunidades Esquecidas</strong>.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || !dataRetomada}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
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

export default AlinhamentoModal;
