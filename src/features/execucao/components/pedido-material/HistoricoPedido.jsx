import React from 'react';
import { FaClipboardList } from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import Modal from '../ui/Modal';

const TIPOS = {
  criacao: { rotulo: 'Criação', classe: 'bg-green-500/20 text-green-400' },
  edicao: { rotulo: 'Edição', classe: 'bg-blue-500/20 text-blue-400' },
  status: { rotulo: 'Status', classe: 'bg-purple-500/20 text-purple-400' },
  data_limite: { rotulo: 'Data Limite', classe: 'bg-amber-500/20 text-amber-400' }
};

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
        </div>
      )}

      {historico.length === 0 ? (
        <div className="text-center py-8">
          <FaClipboardList className="mx-auto text-4xl text-slate-600 mb-3" aria-hidden="true" />
          <p className="text-slate-400">Nenhuma alteração registrada</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {historico.map((item) => {
            const tipo = TIPOS[item.tipo_alteracao];
            return (
              <div key={item.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {tipo && (
                      <span className={`px-2 py-1 text-xs rounded ${tipo.classe}`}>{tipo.rotulo}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(item.data_alteracao).toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mb-2">{item.descricao}</p>

                <p className="text-xs text-slate-400">
                  Por: {item.usuario_nome || 'Sistema'}
                </p>

                {item.data_limite_anterior && item.data_limite_nova && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      Data limite: {formatarDataBR(item.data_limite_anterior)} → {formatarDataBR(item.data_limite_nova)}
                    </p>
                  </div>
                )}

                {item.dados_anteriores && item.dados_novos && item.tipo_alteracao === 'edicao' && (
                  <details className="mt-2 pt-2 border-t border-slate-700">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      Ver detalhes das alterações
                    </summary>
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      {item.dados_anteriores.itens?.length !== item.dados_novos.itens?.length && (
                        <p>Itens: {item.dados_anteriores.itens?.length || 0} → {item.dados_novos.itens?.length || 0}</p>
                      )}
                      {item.dados_anteriores.urgencia !== item.dados_novos.urgencia && (
                        <p>Urgência: {item.dados_anteriores.urgencia} → {item.dados_novos.urgencia}</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
