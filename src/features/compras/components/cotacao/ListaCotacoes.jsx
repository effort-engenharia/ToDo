import React, { useCallback, useEffect, useRef, useState } from 'react';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { useAsyncData } from '../../../execucao/hooks/useAsyncData';
import { useDebouncedValue } from '../../../execucao/hooks/useDebouncedValue';
import { ErroCarregamento, EstadoVazio } from '../../../execucao/components/ui/Estados';
import { CLASSE_TOM, STATUS_COTACAO, formatarPrazo, tempoRestante } from '../../utils/cotacao/envio';
import { irParaCotacao, irParaSecao } from '../../utils/navegacaoCompras';

const FILTROS = [
  { id: 'abertas', rotulo: 'Abertas', status: ['aberta'] },
  { id: 'rascunhos', rotulo: 'Rascunhos', status: ['rascunho'] },
  { id: 'encerradas', rotulo: 'Encerradas', status: ['encerrada'] },
  { id: 'canceladas', rotulo: 'Canceladas', status: ['cancelada'] },
  { id: 'todas', rotulo: 'Todas', status: undefined },
];

export default function ListaCotacoes() {
  const [filtro, setFiltro] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [minhas, setMinhas] = useState(false);
  const buscaDeb = useDebouncedValue(busca, 350);
  const status = FILTROS.find((f) => f.id === filtro)?.status;

  const primeira = useAsyncData(
    () => comprasCotacaoService.listar({ status, busca: buscaDeb.trim() || undefined, minhas }, { limite: 30 }),
    [filtro, buscaDeb, minhas]
  );
  const [extra, setExtra] = useState({ itens: [], cursor: null, base: null });
  const [carregandoMais, setCarregandoMais] = useState(false);
  const baseRef = useRef(null);
  baseRef.current = primeira.data;

  // Nova primeira página zera as páginas extras
  useEffect(() => { setExtra({ itens: [], cursor: null, base: primeira.data }); }, [primeira.data]);

  const itens = [...(primeira.data?.itens ?? []), ...(extra.base === primeira.data ? extra.itens : [])];
  const cursor = extra.base === primeira.data && extra.cursor ? extra.cursor : primeira.data?.proximo_cursor;

  const carregarMais = useCallback(async () => {
    setCarregandoMais(true);
    const r = await comprasCotacaoService.listar({ status, busca: buscaDeb.trim() || undefined, minhas }, { limite: 30, cursor });
    setCarregandoMais(false);
    if (r.success) setExtra((e) => ({ base: baseRef.current, itens: [...(e.base === baseRef.current ? e.itens : []), ...(r.data?.itens ?? [])], cursor: r.data?.proximo_cursor ?? null }));
  }, [status, buscaDeb, minhas, cursor]);

  return (
    <div>
      <div className="cmp-secao-cab">
        <h2 className="text-xl font-semibold">Cotações</h2>
        <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => irParaSecao('pedidos')}>
          Criar a partir da fila de pedidos
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} className={`cmp-selo cmp-btn-toque ${filtro === f.id ? 'bg-teal-500/20 text-teal-200 border border-teal-400' : 'bg-slate-500/15 text-slate-300 border border-slate-500/40'}`} onClick={() => setFiltro(f.id)}>
              {f.rotulo}
            </button>
          ))}
        </div>
        <div className="cmp-campo">
          <label htmlFor="cmp-cot-busca">Buscar (nº, fornecedor)</label>
          <input id="cmp-cot-busca" type="search" className="execucao-form-input" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cmp-btn-toque">
          <input type="checkbox" className="cmp-checkbox" checked={minhas} onChange={(e) => setMinhas(e.target.checked)} /> Só as minhas
        </label>
      </div>

      {primeira.error && !primeira.data ? (
        <ErroCarregamento mensagem={primeira.error} onTentarNovamente={primeira.reload} />
      ) : primeira.loading && !primeira.data ? (
        <div className="space-y-2" aria-busy="true" role="status" aria-label="Carregando cotações">
          {[0, 1, 2].map((i) => <div key={i} className="cmp-skeleton h-20 w-full rounded-xl" />)}
        </div>
      ) : itens.length === 0 ? (
        <EstadoVazio icone="🧾" titulo="Nenhuma cotação aqui" texto="Selecione pedidos na fila e use “Criar cotação” para começar." />
      ) : (
        <>
          <ul className="cmp-lista-limpa" aria-busy={primeira.loading || undefined}>
            {itens.map((c) => {
              const st = STATUS_COTACAO[c.status] ?? { emoji: '', rotulo: c.status, tom: 'cinza' };
              return (
                <li key={c.id} className="cmp-linha">
                  <div className="min-w-0">
                    <button type="button" className="cmp-link font-semibold" onClick={() => irParaCotacao(c.id)}>Cotação nº {c.numero}</button>
                    <span className={`cmp-selo ml-2 ${CLASSE_TOM[st.tom]}`}>{st.emoji} {st.rotulo}</span>
                    {c.requer_revisao && <span className={`cmp-selo ml-2 ${CLASSE_TOM.vermelho}`}>⚠️ Lista alterada</span>}
                    <p className="cmp-texto-mudo mt-1">
                      {c.n_pedidos} {c.n_pedidos === 1 ? 'pedido' : 'pedidos'} · {c.n_itens} {c.n_itens === 1 ? 'item' : 'itens'} · enviados {c.n_enviados}/{c.n_convites} · respostas {c.n_respondidos}/{c.n_convites}
                      {c.criado_por_nome ? ` · ${c.criado_por_nome}` : ''}
                    </p>
                  </div>
                  {c.status === 'aberta' && c.prazo_resposta && (
                    <p className="text-sm text-slate-300">Prazo {formatarPrazo(c.prazo_resposta)} <span className="cmp-texto-mudo">({tempoRestante(c.prazo_resposta)})</span></p>
                  )}
                </li>
              );
            })}
          </ul>
          {cursor && (
            <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque w-full mt-3" onClick={carregarMais} disabled={carregandoMais} aria-busy={carregandoMais || undefined}>
              {carregandoMais ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
