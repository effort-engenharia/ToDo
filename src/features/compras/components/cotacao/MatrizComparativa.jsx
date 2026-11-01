import React, { useState } from 'react';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../../execucao/hooks/useMediaQuery';
import { formatarBRL } from '../../utils/cotacao/moeda';
import { candidatosPorConvite, celulaDaMatriz, menoresPorLinha, variacaoDaCelula } from '../../utils/cotacao/comparativo';
import { estadoDoConvite, CLASSE_TOM } from '../../utils/cotacao/envio';
import { formatarDataBR } from '../../../execucao/utils/datas';

const COR = { verde: 'cmp-var-verde', vermelho: 'cmp-var-vermelho', cinza: 'cmp-var-cinza' };
const qtd = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function Variacao({ v }) {
  const [aberto, setAberto] = useState(false);
  if (!v) return null;
  const det = v.detalhe;
  return (
    <div className="text-xs">
      <span className={COR[v.cor]}>{v.status === 'ok' ? v.texto : v.texto.charAt(0).toUpperCase() + v.texto.slice(1)}</span>
      {v.alerta && <span className="cmp-var-ambar font-semibold"> ⚠️ renegociar</span>}
      {v.antiga && <span className="cmp-texto-mudo"> (referência antiga)</span>}
      {det && (det.ultima || det.menor) && (
        <>
          {' '}<button type="button" className="cmp-link" aria-expanded={aberto} onClick={() => setAberto((x) => !x)}>detalhes</button>
          {aberto && (
            <span role="note" className="cmp-sugestao block mt-1">
              {det.ultima && <span className="block">Última compra: {formatarBRL(det.ultima.preco_vp)}{det.ultima.data ? ` em ${formatarDataBR(det.ultima.data)}` : ''}{det.quantidadeReferencia != null ? ` · qtd ${qtd(det.quantidadeReferencia)}` : ''}</span>}
              {det.menor && <span className="block">Menor: {formatarBRL(det.menor.preco_vp)}{det.menor.data ? ` em ${formatarDataBR(det.menor.data)}` : ''}</span>}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Celula({ cel, linha, referencias, config, menor, escolhida }) {
  if (cel.estado === 'sem_resposta') return <span className="sem-oferta cmp-sem-oferta">não cotado</span>;
  if (cel.estado === 'nao_cotada') return <span className="cmp-sem-oferta">não cotado (lista mudou)</span>;
  if (cel.estado === 'sem_item') return <span className="cmp-sem-oferta">— não tem</span>;
  const v = variacaoDaCelula(linha, cel, referencias, config);
  return (
    <div>
      {menor && <span className="cmp-var-verde text-xs font-semibold">★ menor </span>}
      {escolhida && <span className="text-xs font-semibold text-teal-300">✔ escolhido </span>}
      {cel.estado === 'parcial' && <span className="cmp-var-ambar text-xs block">parcial ({qtd(cel.quantidadeDisponivel)} de {qtd(linha.quantidade)} {linha.unidade})</span>}
      <span className="font-semibold text-slate-100 block">{formatarBRL(cel.precoVp, 4)}</span>
      <span className="cmp-texto-mudo block">nominal {formatarBRL(cel.precoNominal, 4)}</span>
      <Variacao v={v} />
    </div>
  );
}

// Matriz itens × fornecedores (B.5.3). Desktop: tabela com 1ª coluna fixa; celular: lista por item (3 melhores + "Ver todas").
export default function MatrizComparativa({ comparativo, convites, referencias, config, destaques, escolhidos = null }) {
  const mobile = useMediaQuery(CONSULTA_ABAIXO_MD);
  const [todas, setTodas] = useState(() => new Set());
  const { linhas, respostas, ranking } = comparativo;
  const porConvite = candidatosPorConvite(ranking);
  const respPor = new Map(respostas.map((r) => [r.convite_id, r]));
  const menores = menoresPorLinha(linhas, respostas, porConvite);
  const celula = (l, cid) => celulaDaMatriz(l, respPor.get(cid), porConvite.get(cid));
  const nomeConv = (c) => c.fornecedor?.empresa ?? 'Fornecedor';

  if (!linhas.length) return null;

  if (mobile) {
    return (
      <section aria-label="Itens por fornecedor" className="space-y-3 mb-4">
        {linhas.map((l) => {
          const ofertas = convites.map((c) => ({ c, cel: celula(l, c.id) }))
            .sort((a, b) => (a.cel.precoVp ?? Infinity) - (b.cel.precoVp ?? Infinity));
          const visiveis = todas.has(l.id) ? ofertas : ofertas.slice(0, 3);
          return (
            <article key={l.id} className="cmp-cartao">
              <h4 className="font-semibold text-slate-100 break-words">{l.descricao}</h4>
              <p className="cmp-texto-mudo">{qtd(l.quantidade)} {l.unidade}</p>
              <ol className="cmp-lista-limpa mt-2">
                {visiveis.map(({ c, cel }) => (
                  <li key={c.id} className="cmp-linha">
                    <span className="text-sm text-slate-200">{nomeConv(c)}</span>
                    <Celula cel={cel} linha={l} referencias={referencias} config={config} menor={menores[l.id] === c.id} escolhida={escolhidos?.[l.id] === c.id} />
                  </li>
                ))}
              </ol>
              {ofertas.length > 3 && (
                <button type="button" className="cmp-link text-sm mt-2" aria-expanded={todas.has(l.id)} onClick={() => setTodas((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}>
                  {todas.has(l.id) ? 'Ver menos' : `Ver todas (${ofertas.length})`}
                </button>
              )}
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <div className="cmp-matriz-rolagem mb-4" role="region" aria-label="Matriz itens por fornecedor" tabIndex={0}>
      <table className="cmp-matriz">
        <caption className="sr-only">Preço comparável de cada item por fornecedor; a célula mais barata de cada linha está marcada como menor.</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            {convites.map((c) => {
              const e = estadoDoConvite(c);
              return (
                <th key={c.id} scope="col" className={`${respPor.has(c.id) ? '' : 'cmp-celula-esmaecida'}${destaques?.has(c.id) ? ' cmp-destaque' : ''}`}>
                  {nomeConv(c)}
                  <span className={`cmp-selo block mt-1 ${CLASSE_TOM[e.tom]}`}>{e.emoji} {e.rotulo}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <th scope="row"><span className="block text-slate-100">{l.descricao}</span><span className="cmp-texto-mudo">{qtd(l.quantidade)} {l.unidade}</span></th>
              {convites.map((c) => {
                const cel = celula(l, c.id);
                const menor = menores[l.id] === c.id;
                const escolhida = escolhidos?.[l.id] === c.id;
                return (
                  <td key={c.id} className={`cmp-celula${menor ? ' cmp-celula-menor' : ''}${escolhida ? ' cmp-celula-escolhida' : ''}${respPor.has(c.id) ? '' : ' cmp-celula-esmaecida'}`}>
                    <Celula cel={cel} linha={l} referencias={referencias} config={config} menor={menor} escolhida={escolhida} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
