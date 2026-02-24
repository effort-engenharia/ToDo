import React, { useState } from 'react';
import { FaCheck, FaTimes, FaSpinner, FaCalendarAlt, FaStickyNote } from 'react-icons/fa';

/**
 * Modal reutilizável para registrar alinhamento com opção de agendar retomada
 * Usado em: AvisosEsquecidos, ApontamentosTable
 */
const AlinhamentoModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  nomeCliente, 
  isProcessing = false 
}) => {
  const [agendarRetomada, setAgendarRetomada] = useState(false);
  const [dataRetomada, setDataRetomada] = useState('');
  const [observacao, setObservacao] = useState('');

  // Limpar formulário ao fechar
  const handleClose = () => {
    setAgendarRetomada(false);
    setDataRetomada('');
    setObservacao('');
    onClose();
  };

  // Confirmar alinhamento
  const handleConfirm = () => {
    if (agendarRetomada && !dataRetomada) {
      alert('Por favor, informe a data de retomada.');
      return;
    }

    onConfirm({
      dataRetomada: agendarRetomada ? dataRetomada : null,
      observacao: agendarRetomada ? observacao : null
    });
  };

  // Calcular data mínima (amanhã)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

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
          {/* Checkbox para agendar retomada */}
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agendarRetomada}
              onChange={(e) => setAgendarRetomada(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500 cursor-pointer"
            />
            <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
              Agendar próximo contato
            </span>
          </label>

          {/* Campos de retomada (aparecem se checkbox marcado) */}
          {agendarRetomada && (
            <div className="space-y-4 pl-8 border-l-2 border-green-200 animate-in slide-in-from-top duration-200">
              {/* Data de retomada */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <FaCalendarAlt className="text-green-500" />
                  <span>Data de Retomada *</span>
                </label>
                <input
                  type="date"
                  value={dataRetomada}
                  onChange={(e) => setDataRetomada(e.target.value)}
                  min={getMinDate()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                />
              </div>

              {/* Observação */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <FaStickyNote className="text-green-500" />
                  <span>Observação (opcional)</span>
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Cliente solicitou retorno após análise do orçamento..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{observacao.length}/500</p>
              </div>
            </div>
          )}

          {/* Informação */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            {agendarRetomada ? (
              <p>
                📅 O apontamento será movido para <strong>"Próximos Eventos"</strong> até a data de retomada. 
                Após a data, voltará a contar os 8 dias para aparecer em "Oportunidades Esquecidas".
              </p>
            ) : (
              <p>
                ✅ O alinhamento será registrado e o contador de dias será reiniciado.
              </p>
            )}
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
            disabled={isProcessing || (agendarRetomada && !dataRetomada)}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
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
