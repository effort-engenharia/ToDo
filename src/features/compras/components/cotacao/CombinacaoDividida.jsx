import React from 'react';
import { formatarBRL, formatarPercentual } from '../../utils/cotacao/moeda';
import { rotuloCondicao } from '../../utils/cotacao/comparativo';

// "Melhor combinação dividida" (§8.5, B.5.1): economia sobre o melhor único e quem fica com quais itens.
export default function CombinacaoDividida({ divisao, linhas }) {
  if (!divisao?.mostrar) return null;
  const nome = (id) => linhas.find((l) => l.id === id)?.descricao ?? 'Item';
  const porForn = divisao.fornecedores.map((f) => ({
    ...f, itens: divisao.atribuicoes.filter((a) => a.convite_id === f.convite_id).map((a) => nome(a.linha_id))
  }));
  return (
    <section className="cmp-bloco" aria-label="Melhor combinação dividida">
      <h3>💡 Melhor combinação dividida</h3>
      {divisao.unica_forma_de_cobrir ? (
        <p className="text-slate-200">Única forma de cobrir todos os itens: {formatarBRL(divisao.custo)} já somando o frete de cada fornecedor.</p>
      ) : (
        <p className="text-slate-200">
          Economia de <strong>{formatarBRL(divisao.economia)}</strong> ({formatarPercentual(-(divisao.economia_pct ?? 0))}) sobre o melhor fornecedor único,
          já somando o frete de cada um. Total {formatarBRL(divisao.custo)}.
        </p>
      )}
      <ul className="cmp-lista-limpa mt-2">
        {porForn.map((f) => (
          <li key={f.convite_id} className="cmp-linha">
            <div>
              <strong className="text-slate-100">{f.empresa}</strong>
              <span className="cmp-texto-mudo"> · {rotuloCondicao(f.condicao)} · {f.frete > 0 ? `frete ${formatarBRL(f.frete)}` : 'frete incluso'}</span>
              <p className="text-sm text-slate-300">{f.itens.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
      {divisao.aviso_desconto_valor && <div className="cmp-aviso" role="note">⚠ Desconto em R$ pode não valer em compra parcial.</div>}
    </section>
  );
}
