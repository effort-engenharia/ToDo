import React from 'react';
import { execucaoComprasService } from '../../../../services/supabase/execucaoCompras';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAtualizacaoTabelas } from '../../hooks/useAtualizacaoTabelas';
import { EVENTO_BADGES } from '../../hooks/useBadgesMenu';
import { isAdminExecucao } from '../../utils/permissoes';
import Modal from '../ui/Modal';
import { STATUS_COMPRA, URGENCIAS } from '../../../compras/utils/statusCompra';
import QuestionamentosPedido from './QuestionamentosPedido';
import '../../../compras/styles/compras.css';

/**
 * Conversa do pedido na gestão (Anexo D.5): o solicitante/admin aprova ou reprova a sugestão do comprador.
 * Carrega o próprio detalhe (pedido + questionamentos) pelo id, então também abre por notificação/deep link.
 */
export default function ModalConversaPedido({ pedidoId, usuario, onClose, onAlterado }) {
  const { data, loading, error, reload, refresh } = useAsyncData(
    () => execucaoComprasService.buscarDetalhe(pedidoId),
    [pedidoId]
  );
  useAtualizacaoTabelas(['execucao_pedidos_questionamentos'], refresh);

  const pedido = data?.pedido ?? null;
  const status = STATUS_COMPRA[pedido?.status_compra];
  const urg = URGENCIAS[pedido?.urgencia];

  const aposAlteracao = () => {
    refresh();
    onAlterado?.();
    window.dispatchEvent(new CustomEvent(EVENTO_BADGES));
  };

  return (
    <Modal tamanho="lg" variante="cheia" onClose={onClose} cabecalho={<>💬 Conversa do pedido</>}>
      {pedido && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-200 font-semibold break-words">{pedido.descricao || 'Pedido de material'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {status && <span className={`cmp-selo ${status.classe}`}>{status.emoji} {status.rotulo}</span>}
            {urg && <span className={`cmp-selo ${urg.classe}`}>{urg.emoji} {urg.rotulo}</span>}
            {pedido.cliente_nome && <span className="text-xs text-slate-400">Cliente: {pedido.cliente_nome}</span>}
            <span className="text-xs text-slate-400">Solicitante: {pedido.solicitante_nome || '—'}</span>
          </div>
        </div>
      )}

      <QuestionamentosPedido
        questionamentos={data?.questionamentos ?? null}
        carregando={loading}
        erro={error}
        onRecarregar={reload}
        podeResponder={isAdminExecucao(usuario)}
        podeCancelarQualquer={isAdminExecucao(usuario)}
        usuarioId={usuario?.id}
        nomeSolicitante={pedido?.solicitante_nome}
        onRespondido={aposAlteracao}
        onCancelado={aposAlteracao}
      />

      <div className="execucao-modal-footer !px-0 !pb-0 mt-4">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
