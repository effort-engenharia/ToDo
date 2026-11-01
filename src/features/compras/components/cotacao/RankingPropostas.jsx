import React, { useState } from 'react';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../../execucao/hooks/useMediaQuery';
import { formatarBRL, formatarPercentual } from '../../utils/cotacao/moeda';
import { CLASSE_TOM } from '../../utils/cotacao/envio';
import { rotuloCondicao } from '../../utils/cotacao/comparativo';
import { formatarDataHora } from '../../utils/statusCompra';
import VersoesResposta from './VersoesResposta';

const CRITERIOS = { prazo_entrega: 'prazo de entrega', frete_cif: 'frete incluso', compras_anteriores: 'compras anteriores', respondido_em: 'quem respondeu primeiro', valor: 'valor' };

const freteTexto = (c) => (c.frete_tipo === 'cif' ? 'Frete incluso (CIF)' : `Frete ${formatarBRL(c.frete)}`);

function Delta({ rotulo, d }) {
  if (!d) return null;
  const sinal = d.valor > 0 ? '+' : d.valor < 0 ? '−' : '';
  return <p className="text-sm text-slate-300">{sinal}{formatarBRL(Math.abs(d.valor))} ({formatarPercentual(d.pct, { sinal: true })}) {rotulo}</p>;
}

function ValorComparavel({ taxa }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="relative">
      <span className="cmp-rotulo">Valor comparável </span>
      <button type="button" className="cmp-link" aria-expanded={aberto} aria-label="O que é valor comparável?" onClick={() => setAberto((v) => !v)} onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false); }}>ⓘ</button>
      {aberto && (
        <span role="note" className="cmp-sugestao block text-xs text-slate-200 mt-1">
          Considera o prazo de pagamento e a taxa de {(taxa * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.m. Parcelas futuras valem menos que pagar hoje.
        </span>
      )}
    </span>
  );
}

function Cartao({ c, posicao, ranking, taxa, linhas, destacado }) {
  const [outra, setOutra] = useState(false);
  const modo = ranking.modo;
  const melhor = posicao === 0;
  const empatado = ranking.empatados && ranking.empatadosChaves?.includes(c.chave);
  const faltam = linhas.filter((l) => c.cobertura?.[l.id] !== 'atendida');
  const alt = c.alternativas?.[0];
  return (
    <article className={`cmp-rank-cartao${melhor ? ' cmp-rank-melhor' : ''}${destacado ? ' cmp-destaque' : ''}`} aria-label={`Proposta de ${c.empresa}`}>
      <div className="flex flex-wrap gap-1">
        {melhor && modo === 'completo' && <span className={`cmp-selo ${CLASSE_TOM.verde}`}>🏆 Melhor proposta</span>}
        {melhor && modo === 'parcial' && <span className={`cmp-selo ${CLASSE_TOM.amarelo}`}>Melhor parcial</span>}
        {empatado && <span className={`cmp-selo ${CLASSE_TOM.amarelo}`}>⚖️ Empate técnico</span>}
        {!c.completo && <span className={`cmp-selo ${CLASSE_TOM.amarelo}`}>Cobre {c.linhas_atendidas} de {c.total_linhas}</span>}
        {c.defasada && <span className={`cmp-selo ${CLASSE_TOM.roxo}`}>baseada na lista v{c.versao_lista_respondida}</span>}
      </div>
      <h4 className="font-semibold text-slate-100 break-words">{c.empresa}</h4>
      {empatado && melhor && <p className="cmp-texto-mudo">Desempate: {CRITERIOS[ranking.criterioDesempate] ?? 'valor'}</p>}
      <ValorComparavel taxa={taxa} />
      <p className="cmp-rank-valor">{formatarBRL(c.vp_total)}</p>
      <p className="cmp-texto-mudo">Nominal {formatarBRL(c.nominal_total)}</p>
      <p className="text-sm text-slate-200">{rotuloCondicao(c.condicao)}</p>
      <p className="text-sm text-slate-200">{freteTexto(c)} · prazo {Number.isFinite(c.prazo_entrega_dias) ? `${c.prazo_entrega_dias} ${c.prazo_entrega_dias === 1 ? 'dia' : 'dias'}` : '—'}</p>
      {melhor && modo === 'completo' && (
        <>
          <Delta rotulo="para a 2ª" d={ranking.deltaSegundo} />
          <Delta rotulo="vs. mais cara" d={ranking.deltaMaisCara && { valor: -ranking.deltaMaisCara.valor, pct: -ranking.deltaMaisCara.valor / (c.vp_total + ranking.deltaMaisCara.valor) }} />
        </>
      )}
      {!c.completo && faltam.length > 0 && (
        <details className="text-sm text-slate-300"><summary>Faltam: {faltam.length}</summary><ul className="list-disc pl-5">{faltam.map((l) => <li key={l.id}>{l.descricao}</li>)}</ul></details>
      )}
      {alt && (
        <div>
          <button type="button" className="cmp-link text-sm" aria-expanded={outra} onClick={() => setOutra((v) => !v)}>Ver outra condição {outra ? '▴' : '▾'}</button>
          {outra && <p className="text-sm text-slate-300">{rotuloCondicao(alt.condicao)}: {formatarBRL(alt.vp_total)} (nominal {formatarBRL(alt.nominal_total)})</p>}
        </div>
      )}
      <p className="cmp-texto-mudo">{c.respondido_em ? `Resposta de ${formatarDataHora(c.respondido_em)}` : ''}</p>
      <VersoesResposta conviteId={c.convite_id} linhas={linhas} />
    </article>
  );
}

// Cartões de ranking (§8.4, B.5.2). No celular, o 1º vem aberto e os demais recolhidos.
export default function RankingPropostas({ comparativo, destaques }) {
  const mobile = useMediaQuery(CONSULTA_ABAIXO_MD);
  const { ranking, taxa, linhas } = comparativo;
  if (!ranking.ordenados.length) return null;
  const cartoes = ranking.ordenados.map((c, i) => {
    const el = <Cartao c={c} posicao={i} ranking={ranking} taxa={taxa} linhas={linhas} destacado={destaques?.has(c.convite_id)} />;
    return mobile && i > 0
      ? <details key={c.chave}><summary className="cmp-link p-2">{c.empresa} · {formatarBRL(c.vp_total)}</summary>{el}</details>
      : <div key={c.chave}>{el}</div>;
  });
  return <section className="cmp-ranking" aria-label="Ranking das propostas">{cartoes}</section>;
}
