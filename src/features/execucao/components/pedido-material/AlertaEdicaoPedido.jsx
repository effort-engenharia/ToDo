import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';

// Exige nova data limite posterior à atual e o "De Acordo" antes de editar um pedido já datado
export default function AlertaEdicaoPedido({ pedido, onConfirmar, onClose }) {
  const { toast } = useExecucaoUI();
  const [deAcordo, setDeAcordo] = useState(false);
  const [novaDataLimite, setNovaDataLimite] = useState('');

  const handleConfirmar = () => {
    if (!deAcordo) {
      toast.error('Você precisa marcar "De Acordo" para continuar.');
      return;
    }
    if (!novaDataLimite) {
      toast.error('Você precisa definir uma nova data limite.');
      return;
    }
    if (pedido.data_material_disponivel && novaDataLimite <= pedido.data_material_disponivel) {
      toast.error(`A nova data limite deve ser posterior à data anterior (${formatarDataBR(pedido.data_material_disponivel)}).`);
      return;
    }
    onConfirmar(novaDataLimite);
  };

  return (
    <Modal
      onClose={onClose}
      cabecalho={
        <>
          <FaExclamationTriangle className="text-amber-400" aria-hidden="true" /> Atenção - Edição de Pedido
        </>
      }
    >
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

      {pedido.data_material_disponivel && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Data limite atual:</p>
          <p className="text-slate-200 font-medium">
            {formatarDataBR(pedido.data_material_disponivel)}
          </p>
        </div>
      )}

      <div className="execucao-form-group mb-4">
        <label className="execucao-form-label" htmlFor="nova-data-limite">
          Nova Data Limite <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-slate-400 mb-2">
          Deve ser posterior à data anterior
        </p>
        <input
          id="nova-data-limite"
          type="date"
          className="execucao-form-input"
          value={novaDataLimite}
          min={pedido.data_material_disponivel || ''}
          onChange={(e) => setNovaDataLimite(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
        <input
          type="checkbox"
          checked={deAcordo}
          onChange={(e) => setDeAcordo(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-200">
          <strong>De Acordo</strong> - Estou ciente de que esta alteração irá impactar o planejamento e assumo a responsabilidade pela mudança.
        </span>
      </label>

      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="execucao-btn execucao-btn-primary"
          onClick={handleConfirmar}
          disabled={!deAcordo || !novaDataLimite}
        >
          Confirmar e Editar
        </button>
      </div>
    </Modal>
  );
}
