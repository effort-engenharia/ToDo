import React from 'react';
import { FaClipboardList } from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import DiffItens from './DiffItens';

const TIPOS = {
  criacao: { rotulo: 'Criação', classe: 'bg-green-500/20 text-green-400' },
  edicao: { rotulo: 'Edição', classe: 'bg-blue-500/20 text-blue-400' },
  status: { rotulo: 'Status', classe: 'bg-purple-500/20 text-purple-400' },
  data_limite: { rotulo: 'Data Limite', classe: 'bg-amber-500/20 text-amber-400' },
  questionamento: { rotulo: 'Questionamento', classe: 'bg-orange-500/20 text-orange-400' },
  compra_status: { rotulo: 'Status da compra', classe: 'bg-cyan-500/20 text-cyan-400' },
  alteracao_compras: { rotulo: '✏️ Alteração da Compras', classe: 'bg-amber-500/20 text-amber-300' },
  cotacao: { rotulo: '🧾 Cotação', classe: 'bg-blue-500/20 text-blue-300' }
};

// Registros com lista de itens em dados_novos (e dados_anteriores, exceto na criação)
const TIPOS_COM_ITENS = ['criacao', 'edicao', 'questionamento', 'alteracao_compras'];

const temDetalhesDeItens = (registro) =>
  TIPOS_COM_ITENS.includes(registro.tipo_alteracao) &&
  Array.isArray(registro.dados_novos?.itens) &&
  (registro.tipo_alteracao === 'criacao' || Array.isArray(registro.dados_anteriores?.itens));

const mudou = (registro, campo) =>
  registro.dados_anteriores[campo] !== undefined &&
  (registro.dados_anteriores[campo] || '') !== (registro.dados_novos[campo] || '');

// Lista de registros do histórico do pedido, sem moldura de modal: usada no modal "Histórico de Alterações"
// (gestão) e embutida na aba Histórico do drawer de Compras. `rolavel` limita a altura (modal).
export default function ListaHistorico({ historico, rolavel = false }) {
  if (!historico || historico.length === 0) {
    return (
      <div className="text-center py-8">
        <FaClipboardList className="mx-auto text-4xl text-slate-600 mb-3" aria-hidden="true" />
        <p className="text-slate-400">Nenhuma alteração registrada</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${rolavel ? 'max-h-96 overflow-y-auto' : ''}`}>
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

            {['questionamento', 'alteracao_compras', 'cotacao'].includes(item.tipo_alteracao) && item.motivo && (
              <p className="text-sm text-slate-300 mb-2 whitespace-pre-wrap break-words">
                {item.tipo_alteracao === 'alteracao_compras' ? 'Motivo: ' : ''}“{item.motivo}”
              </p>
            )}

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

            {item.tipo_alteracao === 'compra_status' && item.dados_novos?.status_compra && (
              <p className="mt-2 pt-2 border-t border-slate-700 text-xs text-slate-400">
                Status da compra: {item.dados_anteriores?.status_compra ? `${item.dados_anteriores.status_compra} → ` : ''}
                {item.dados_novos.status_compra}
              </p>
            )}

            {temDetalhesDeItens(item) && (
              <div className="mt-2 pt-2 border-t border-slate-700 space-y-2">
                <DiffItens
                  antes={item.tipo_alteracao === 'criacao' ? [] : item.dados_anteriores?.itens}
                  depois={item.dados_novos?.itens}
                  tituloAdicionados={item.tipo_alteracao === 'criacao' ? 'Itens do pedido' : 'Adicionados'}
                />
                {item.dados_anteriores && item.dados_novos && (
                  <div className="text-xs text-slate-400 space-y-1">
                    {mudou(item, 'descricao') && (
                      <p>Descrição: {item.dados_anteriores.descricao || '—'} → {item.dados_novos.descricao || '—'}</p>
                    )}
                    {mudou(item, 'cliente_nome') && (
                      <p>Cliente: {item.dados_anteriores.cliente_nome || '—'} → {item.dados_novos.cliente_nome || '—'}</p>
                    )}
                    {mudou(item, 'urgencia') && (
                      <p>Urgência: {item.dados_anteriores.urgencia} → {item.dados_novos.urgencia}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
