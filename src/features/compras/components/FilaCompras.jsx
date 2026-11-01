import React, { useId } from 'react';
import { formatarDataBR } from '../../execucao/utils/datas';
import CartaoPedidoCompras from './CartaoPedidoCompras';
import { STATUS_COMPRA, URGENCIAS, descricaoAcessivelDoPedido, pedidoSelecionavelParaCotacao } from '../utils/statusCompra';
import { irParaCotacao } from '../utils/navegacaoCompras';

const contar = (grupo, soAtrasados) => {
  const itens = grupo?.itens ?? [];
  const n = soAtrasados ? itens.filter((p) => p.atrasado).length : itens.length;
  return `${n}${grupo?.temMais ? '+' : ''}`;
};

const itensDoGrupo = (grupo, soAtrasados) => {
  const itens = grupo?.itens ?? [];
  return soAtrasados ? itens.filter((p) => p.atrasado) : itens;
};

function EsqueletoCartoes({ n = 3 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <div key={i} className="cmp-skeleton h-32 w-full rounded-xl" />)}
    </div>
  );
}

function VazioColuna() {
  return (
    <div className="text-center py-6 text-slate-400 text-sm">
      <p className="text-2xl mb-1" aria-hidden="true">🛒</p>
      Nenhum pedido aqui
    </div>
  );
}

function BotaoCarregarMais({ grupo, carregando, onClick, mostrando }) {
  if (!grupo?.temMais) return null;
  return (
    <button
      type="button"
      className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque w-full mt-3"
      onClick={onClick}
      disabled={carregando}
      aria-busy={carregando}
    >
      {carregando ? 'Carregando…' : `Carregar mais (${mostrando})`}
    </button>
  );
}

/**
 * Fila de compras (Anexo D.2/D.3). modo: 'quadro' (kanban ≥ 1280 px) | 'abas' (chips de status + cartões) | 'lista' (tabela).
 * Sem arrastar e soltar: a mudança de status é por botão no cartão e no detalhe.
 */
export default function FilaCompras({
  modo,
  colunas,
  grupos,
  carregando,
  colunasVisiveis = null,
  soAtrasados = false,
  abaAtiva,
  onAba,
  onAbrir,
  onAcao,
  onCarregarMais,
  carregandoMais,
  podeAgir,
  destaques,
  pedidoOcupado = null,
  selecao = null, // { ids:Set, onAlternar(pedido) } quando o recurso de cotação está disponível
}) {
  const idBase = useId();
  // Esqueleto enquanto nenhuma das colunas atuais foi carregada (1ª carga ou troca quadro ↔ lista)
  const semDados = carregando && colunas.every((c) => !grupos[c.id]);
  const visiveis = colunas.filter((c) => !colunasVisiveis || colunasVisiveis.includes(c.id));
  const selecionavel = (p) => Boolean(selecao) && podeAgir && pedidoSelecionavelParaCotacao(p);

  const cartao = (p) => (
    <CartaoPedidoCompras
      key={p.id}
      pedido={p}
      onAbrir={onAbrir}
      onAcao={onAcao}
      podeAgir={podeAgir}
      destacado={destaques?.has(p.id)}
      ocupado={pedidoOcupado === p.id}
      selecionavel={selecionavel(p)}
      selecionado={Boolean(selecao?.ids?.has(p.id))}
      onSelecionar={selecao?.onAlternar}
      mostrarCotacao={Boolean(selecao)}
    />
  );

  if (modo === 'quadro') {
    return (
      <div className={`cmp-quadro${carregando && !semDados ? ' opacity-60' : ''}`} role="region" aria-label="Fila de compras" tabIndex={0} aria-busy={carregando || undefined}>
        {visiveis.map((c) => {
          const grupo = grupos[c.id];
          const itens = itensDoGrupo(grupo, soAtrasados);
          return (
            <section key={c.id} className="cmp-coluna" aria-labelledby={`${idBase}-col-${c.id}`}>
              <h3 id={`${idBase}-col-${c.id}`} className="cmp-coluna-titulo">
                <span aria-hidden="true">{c.emoji}</span> {c.rotulo} <span className="cmp-coluna-contagem">({contar(grupo, soAtrasados)})</span>
              </h3>
              <div className="cmp-coluna-corpo">
                {semDados ? <EsqueletoCartoes /> : itens.length === 0 ? <VazioColuna /> : itens.map(cartao)}
                <BotaoCarregarMais grupo={grupo} carregando={carregandoMais === c.id} onClick={() => onCarregarMais(c.id)} mostrando={itens.length} />
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  if (modo === 'abas') {
    const ativa = visiveis.find((c) => c.id === abaAtiva) ?? visiveis[0];
    const grupo = ativa ? grupos[ativa.id] : null;
    const itens = itensDoGrupo(grupo, soAtrasados);

    const aoTeclar = (e) => {
      const i = visiveis.findIndex((c) => c.id === ativa?.id);
      let alvo = null;
      if (e.key === 'ArrowRight') alvo = visiveis[(i + 1) % visiveis.length];
      else if (e.key === 'ArrowLeft') alvo = visiveis[(i - 1 + visiveis.length) % visiveis.length];
      else if (e.key === 'Home') alvo = visiveis[0];
      else if (e.key === 'End') alvo = visiveis[visiveis.length - 1];
      if (!alvo) return;
      e.preventDefault();
      onAba(alvo.id);
      document.getElementById(`${idBase}-aba-${alvo.id}`)?.focus();
    };

    return (
      <div aria-busy={carregando || undefined}>
        <div className="cmp-abas cmp-abas-status" role="tablist" aria-label="Status dos pedidos" onKeyDown={aoTeclar}>
          {visiveis.map((c) => (
            <button
              key={c.id}
              id={`${idBase}-aba-${c.id}`}
              type="button"
              role="tab"
              aria-selected={ativa?.id === c.id}
              aria-controls={`${idBase}-painel`}
              tabIndex={ativa?.id === c.id ? 0 : -1}
              className={`cmp-aba${ativa?.id === c.id ? ' cmp-aba-ativa' : ''}`}
              onClick={() => onAba(c.id)}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.rotulo} <span className="cmp-coluna-contagem">{contar(grupos[c.id], soAtrasados)}</span>
            </button>
          ))}
        </div>
        <div id={`${idBase}-painel`} role="tabpanel" className={`pt-3${carregando && !semDados ? ' opacity-60' : ''}`}>
          {semDados ? <EsqueletoCartoes /> : itens.length === 0 ? <VazioColuna /> : (
            <div className="grid gap-3 md:grid-cols-2">{itens.map(cartao)}</div>
          )}
          {ativa && <BotaoCarregarMais grupo={grupo} carregando={carregandoMais === ativa.id} onClick={() => onCarregarMais(ativa.id)} mostrando={itens.length} />}
        </div>
      </div>
    );
  }

  // Lista (tabela)
  const grupo = grupos.todos;
  const itens = itensDoGrupo(grupo, soAtrasados);
  return (
    <div aria-busy={carregando || undefined} className={carregando && !semDados ? 'opacity-60' : ''}>
      {semDados ? <EsqueletoCartoes /> : itens.length === 0 ? <VazioColuna /> : (
        <div className="cmp-tabela-rolagem" role="region" aria-label="Lista de pedidos" tabIndex={0}>
          <table className="execucao-table cmp-tabela">
            <thead>
              <tr>
                {selecao && <th scope="col"><span className="sr-only">Selecionar</span></th>}
                <th scope="col">Pedido</th>
                <th scope="col">Cliente</th>
                <th scope="col">Solicitante</th>
                <th scope="col">Itens</th>
                <th scope="col">Urgência</th>
                <th scope="col">Status</th>
                <th scope="col">Data do pedido</th>
                <th scope="col">Previsão de chegada</th>
                <th scope="col">Comprador</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((p) => {
                const st = STATUS_COMPRA[p.status_compra];
                const urg = URGENCIAS[p.urgencia];
                return (
                  <tr key={p.id} className={destaques?.has(p.id) ? 'cmp-destaque' : ''}>
                    {selecao && (
                      <td>
                        {selecionavel(p) ? (
                          <input
                            type="checkbox"
                            className="cmp-checkbox"
                            checked={selecao.ids.has(p.id)}
                            onChange={() => selecao.onAlternar(p)}
                            aria-label={`Selecionar pedido ${p.cliente_nome || p.descricao || 'de material'}`}
                          />
                        ) : p.cotacao_ativa ? (
                          <button type="button" className="cmp-link" onClick={() => irParaCotacao(p.cotacao_ativa.id)}>
                            🧾 nº {p.cotacao_ativa.numero}
                          </button>
                        ) : null}
                      </td>
                    )}
                    <td>
                      <button type="button" className="cmp-link" onClick={() => onAbrir(p)} aria-label={descricaoAcessivelDoPedido(p)}>
                        {p.descricao || 'Pedido de material'}
                      </button>
                      {p.qtd_questionamentos_abertos > 0 && <span className="text-purple-300 text-xs"> ❓ {p.qtd_questionamentos_abertos}</span>}
                    </td>
                    <td>{p.cliente_nome || '—'}</td>
                    <td>{p.solicitante_nome || '—'}</td>
                    <td>{p.sem_itens ? 'Sem lista' : p.qtd_itens}</td>
                    <td>{urg ? `${urg.emoji} ${urg.rotulo}` : p.urgencia}</td>
                    <td>{st ? <span className={`cmp-selo ${st.classe}`}>{st.emoji} {st.rotulo}</span> : p.status_compra}</td>
                    <td>{formatarDataBR(p.created_at)}</td>
                    <td>
                      {p.data_material_disponivel ? formatarDataBR(p.data_material_disponivel) : '—'}
                      {p.atrasado && <span className="text-amber-300"> ⚠️ atrasado</span>}
                    </td>
                    <td>{p.comprador_nome || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-2" aria-live="polite">
        {itens.length > 0 ? `Mostrando ${itens.length}${grupo?.temMais ? ' (há mais pedidos)' : ''}` : ''}
      </p>
      <BotaoCarregarMais grupo={grupo} carregando={carregandoMais === 'todos'} onClick={() => onCarregarMais('todos')} mostrando={itens.length} />
    </div>
  );
}
