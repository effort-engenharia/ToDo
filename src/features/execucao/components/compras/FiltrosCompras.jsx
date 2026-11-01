import React, { useId, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import FiltroPeriodo from '../pedido-material/FiltroPeriodo';
import { STATUS_COMPRA, URGENCIAS } from './statusCompra';

/**
 * Barra de filtros do Dashboard de Compras (Anexo D.2/D.3). Controlada pelo pai.
 * Desktop (≥ 1280 px): tudo inline. Abaixo: busca + botão "Filtros" que abre a gaveta com os demais.
 */
export default function FiltrosCompras({
  compacto,
  periodo, onPeriodo,
  campoData, onCampoData,
  busca, onBusca,
  urgencia, onUrgencia,
  solicitantes, solicitanteId, onSolicitante,
  meusPedidos, onMeusPedidos,
  comQuestionamento, onComQuestionamento,
  mostrarVisao, visao, onVisao,
  statusLista, onStatusLista,
  contagemFiltros, onLimpar,
}) {
  const idBase = useId();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const mostrarCampos = !compacto || gavetaAberta;

  const campos = (
    <>
      <FiltroPeriodo value={periodo} onChange={onPeriodo} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-400 block" htmlFor={`${idBase}-campo`}>Data de referência</label>
          <select id={`${idBase}-campo`} className="execucao-form-select cmp-btn-toque" value={campoData} onChange={(e) => onCampoData(e.target.value)}>
            <option value="pedido">Data do pedido</option>
            <option value="evento">Data do evento (status)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block" htmlFor={`${idBase}-urg`}>Urgência</label>
          <select id={`${idBase}-urg`} className="execucao-form-select cmp-btn-toque" value={urgencia} onChange={(e) => onUrgencia(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(URGENCIAS).map(([valor, u]) => <option key={valor} value={valor}>{u.emoji} {u.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block" htmlFor={`${idBase}-sol`}>Solicitante</label>
          <select id={`${idBase}-sol`} className="execucao-form-select cmp-btn-toque" value={solicitanteId} onChange={(e) => onSolicitante(e.target.value)}>
            <option value="">Todos</option>
            {solicitantes.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        {visao === 'lista' && !compacto && (
          <div>
            <label className="text-xs text-slate-400 block" htmlFor={`${idBase}-status`}>Status</label>
            <select id={`${idBase}-status`} className="execucao-form-select cmp-btn-toque" value={statusLista} onChange={(e) => onStatusLista(e.target.value)}>
              <option value="">Todos (exceto cancelados)</option>
              {Object.entries(STATUS_COMPRA).map(([valor, s]) => <option key={valor} value={valor}>{s.emoji} {s.rotulo}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-200 cmp-btn-toque cursor-pointer">
          <input type="checkbox" checked={comQuestionamento} onChange={(e) => onComQuestionamento(e.target.checked)} />
          Só com questionamento aberto
        </label>
      </div>
    </>
  );

  return (
    <section className="cmp-filtros" aria-label="Filtros dos pedidos">
      <div className="flex flex-wrap items-center gap-2">
        <div className="execucao-search flex-1 min-w-[12rem] max-w-md">
          <FaSearch className="execucao-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="execucao-search-input"
            placeholder="Buscar pedido, cliente ou item…"
            aria-label="Buscar pedido, cliente ou item"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
          />
        </div>

        <button
          type="button"
          className={`execucao-btn execucao-btn-sm cmp-btn-toque ${meusPedidos ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
          aria-pressed={meusPedidos}
          onClick={() => onMeusPedidos(!meusPedidos)}
        >
          👤 Meus pedidos
        </button>

        {compacto && (
          <button
            type="button"
            className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque"
            aria-expanded={gavetaAberta}
            aria-controls={`${idBase}-gaveta`}
            onClick={() => setGavetaAberta((v) => !v)}
          >
            ⚙ Filtros{contagemFiltros > 0 ? ` (${contagemFiltros})` : ''}
          </button>
        )}

        {mostrarVisao && (
          <div className="flex gap-1 ml-auto" role="group" aria-label="Modo de exibição">
            <button type="button" className={`execucao-btn execucao-btn-sm ${visao === 'quadro' ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`} aria-pressed={visao === 'quadro'} onClick={() => onVisao('quadro')}>
              ▦ Quadro
            </button>
            <button type="button" className={`execucao-btn execucao-btn-sm ${visao === 'lista' ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`} aria-pressed={visao === 'lista'} onClick={() => onVisao('lista')}>
              ≣ Lista
            </button>
          </div>
        )}
      </div>

      {mostrarCampos && (
        <div id={`${idBase}-gaveta`} className="cmp-filtros-campos">
          {campos}
        </div>
      )}

      {contagemFiltros > 0 && (
        <button type="button" className="cmp-link text-xs mt-2" onClick={onLimpar}>Limpar filtros</button>
      )}
    </section>
  );
}
