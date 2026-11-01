import React from 'react';
import { formatarBRL } from '../../utils/cotacao/moeda';

const L = 320;
const A = 120;
const MARGEM = 14;

/**
 * Sparkline em SVG puro (sem echarts). `pontos`: [{ valor, data }] em ordem cronológica. `media`: linha tracejada opcional.
 * Acessível: role="img" com descrição em texto; a tabela do histórico é a alternativa completa. Mínimo e máximo têm rótulo de texto.
 */
export default function Sparkline({ pontos, media = null, rotuloPeriodo = '' }) {
  if (!pontos || pontos.length < 3) return <p className="cmp-texto-mudo">Poucos dados para gráfico.</p>;
  const valores = pontos.map((p) => p.valor);
  const todos = media != null ? [...valores, media] : valores;
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const faixa = max - min || 1;
  const x = (i) => MARGEM + (i * (L - 2 * MARGEM)) / (pontos.length - 1);
  const y = (v) => A - MARGEM - ((v - min) / faixa) * (A - 2 * MARGEM);
  const d = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const iMin = valores.indexOf(Math.min(...valores));
  const iMax = valores.indexOf(Math.max(...valores));
  const ultimo = valores[valores.length - 1];
  const descricao = `Preço de ${formatarBRL(Math.min(...valores))} a ${formatarBRL(Math.max(...valores))}${rotuloPeriodo ? ` ${rotuloPeriodo}` : ''}, último ${formatarBRL(ultimo)}`;

  return (
    <figure>
      <svg className="cmp-spark" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={descricao}>
        {media != null && <line className="cmp-spark-ref" x1={MARGEM} x2={L - MARGEM} y1={y(media)} y2={y(media)} />}
        <path className="cmp-spark-linha" d={d} />
        <circle cx={x(iMin)} cy={y(valores[iMin])} r="4" fill="#22c55e" />
        <circle cx={x(iMax)} cy={y(valores[iMax])} r="4" fill="#ef4444" />
        <text x={x(iMin)} y={Math.min(A - 2, y(valores[iMin]) + 13)} fontSize="9" fill="#86efac" textAnchor="middle">menor</text>
        <text x={x(iMax)} y={Math.max(9, y(valores[iMax]) - 6)} fontSize="9" fill="#fca5a5" textAnchor="middle">maior</text>
        {media != null && <text x={L - MARGEM} y={y(media) - 3} fontSize="9" fill="#94a3b8" textAnchor="end">média</text>}
      </svg>
      <figcaption className="cmp-texto-mudo">{descricao}. A tabela abaixo traz os mesmos dados.</figcaption>
    </figure>
  );
}
