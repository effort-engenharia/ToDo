import React from 'react';
import { FaClipboardList } from 'react-icons/fa';
import Modal from '../ui/Modal';
import ListaHistorico from './ListaHistorico';

export default function HistoricoPedido({ pedido, historico, onClose }) {
  return (
    <Modal
      tamanho="lg"
      onClose={onClose}
      cabecalho={
        <>
          <FaClipboardList className="text-blue-400" aria-hidden="true" /> Histórico de Alterações
        </>
      }
    >
      {pedido && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-300">
            <strong>Pedido:</strong> {pedido.descricao}
          </p>
          {pedido.cliente_nome && (
            <p className="text-sm text-slate-300">
              <strong>Cliente:</strong> {pedido.cliente_nome}
            </p>
          )}
        </div>
      )}

      <ListaHistorico historico={historico} rolavel />

      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
