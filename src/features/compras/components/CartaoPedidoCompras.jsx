import React from 'react';
import { formatarDataBR } from '../../execucao/utils/datas';
import { irParaCotacao } from '../utils/navegacaoCompras';
import {
  STATUS_COMPRA,
  URGENCIAS,
  acaoRapidaDoPedido,
  descricaoAcessivelDoPedido,
  diasDeAtraso,
} from '../utils/statusCompra';

const ROTULO_ACAO = {
  assumir: 'Assumir',
  comprado: 'Marcar como comprado',
  entrega: 'Registrar entrega',
};

/**
 * Cartão de pedido (<article>): o botão do título abre o detalhe; a ação rápida muda conforme a coluna.
 * Questionamento aberto → borda roxa + selo ❓; atraso em texto (não só cor).
 */
function CartaoPedidoCompras({
  pedido, onAbrir, onAcao, podeAgir = false, destacado = false, ocupado = false,
  selecionavel = false, selecionado = false, onSelecionar = null, mostrarCotacao = false,
}) {
  const urg = URGENCIAS[pedido.urgencia];
  const status = STATUS_COMPRA[pedido.status_compra];
  const atraso = diasDeAtraso(pedido.data_material_disponivel);
  const acao = podeAgir ? acaoRapidaDoPedido(pedido) : null;
  const abertos = pedido.qtd_questionamentos_abertos ?? 0;
  const titulo = pedido.cliente_nome || pedido.descricao || 'Pedido de material';
  const mostrarStatusNoCartao = pedido.status_compra === 'entregue_parcial';

  return (
    <article
      className={`cmp-cartao${abertos > 0 ? ' cmp-cartao-questionado' : ''}${destacado ? ' cmp-destaque' : ''}${selecionado ? ' cmp-cartao-selecionado' : ''}`}
      aria-busy={ocupado || undefined}
    >
      {selecionavel && onSelecionar && (
        <label className="cmp-selecionar">
          <input type="checkbox" checked={selecionado} onChange={() => onSelecionar(pedido)} aria-label={`Selecionar pedido ${titulo}`} />
          <span className="cmp-selecionar-texto">Selecionar</span>
        </label>
      )}
      {mostrarCotacao && pedido.cotacao_ativa && (
        <a
          href={`#/compras/cotacoes?id=${pedido.cotacao_ativa.id}`}
          className="cmp-selo bg-blue-500/15 text-blue-300 border border-blue-500/40 mb-1"
          onClick={(e) => { e.preventDefault(); irParaCotacao(pedido.cotacao_ativa.id); }}
          aria-label={`Abrir cotação nº ${pedido.cotacao_ativa.numero}`}
        >
          🧾 Cotação nº {pedido.cotacao_ativa.numero}
        </a>
      )}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="cmp-cartao-titulo"
          onClick={() => onAbrir(pedido)}
          aria-label={descricaoAcessivelDoPedido(pedido)}
        >
          {titulo}
        </button>
        {urg && (
          <span className={`cmp-selo ${urg.classe}`} title={`Urgência ${urg.rotulo.toLowerCase()}`}>
            {urg.emoji} {urg.rotulo}
          </span>
        )}
      </div>

      {pedido.cliente_nome && pedido.descricao && (
        <p className="text-sm text-slate-300 mt-1 break-words">{pedido.descricao}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {mostrarStatusNoCartao && status && (
          <span className={`cmp-selo ${status.classe}`}>{status.emoji} {status.rotulo}</span>
        )}
        {pedido.sem_itens && (
          <span className="cmp-selo bg-amber-500/15 text-amber-300 border border-amber-500/40" title="Falta de material reportada em campo, sem lista de itens">
            📝 Sem lista de itens
          </span>
        )}
        {pedido.obra_cancelada && (
          <span className="cmp-selo bg-slate-500/15 text-slate-300 border border-slate-500/40">🚧 Obra cancelada</span>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-2">
        {pedido.sem_itens ? 'Sem itens' : `${pedido.qtd_itens ?? 0} ${pedido.qtd_itens === 1 ? 'item' : 'itens'}`}
        {pedido.data_material_disponivel && <> · 📅 chegada {formatarDataBR(pedido.data_material_disponivel)}</>}
      </p>
      {pedido.atrasado && atraso > 0 && (
        <p className="text-xs font-semibold text-amber-300 mt-1">⚠️ {atraso} {atraso === 1 ? 'dia' : 'dias'} atrasado</p>
      )}

      <p className="text-xs text-slate-400 mt-1">
        Solic.: {pedido.solicitante_nome || '—'} · 👤 {pedido.comprador_nome || 'sem comprador'}
      </p>

      {pedido.status_compra === 'aguardando_solicitante' && (
        <p className="text-xs text-purple-300 mt-1">Aguardando {pedido.solicitante_nome || 'solicitante'}</p>
      )}
      {abertos > 0 && (
        <p className="text-xs font-semibold text-purple-300 mt-1">
          ❓ {abertos} {abertos === 1 ? 'questionamento aberto' : 'questionamentos abertos'}
        </p>
      )}

      {acao && (
        <button
          type="button"
          className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque mt-3 w-full"
          onClick={() => onAcao(acao, pedido)}
          disabled={ocupado}
        >
          {ROTULO_ACAO[acao]}
        </button>
      )}
    </article>
  );
}

// Memoizado: a fila tem dezenas de cartões e o painel re-renderiza a cada tecla da busca / atualização em tempo real
export default React.memo(CartaoPedidoCompras);
