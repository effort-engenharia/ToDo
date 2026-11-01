import React from 'react';
import { diffItens, formatarQuantidade } from './utils';

const rotuloItem = (item) =>
  `${item.nome} — ${formatarQuantidade(item.quantidade)} ${item.unidade || 'un'}`;

// "Disjuntor 63A: 2 un → 3 un" ou "Cabo 2,5mm → Cabo 4mm"
const descreverAlteracao = ({ item, antes, mudancas }) => {
  const renomeado = mudancas.find((m) => m.campo === 'nome');
  const nome = renomeado ? renomeado.de : item.nome;
  const detalhes = [];

  if (renomeado) detalhes.push(`${renomeado.de} → ${renomeado.para}`);

  const qtd = mudancas.find((m) => m.campo === 'quantidade');
  const un = mudancas.find((m) => m.campo === 'unidade');
  if (qtd || un) {
    const de = `${formatarQuantidade(antes.quantidade)} ${antes.unidade || 'un'}`;
    const para = `${formatarQuantidade(item.quantidade)} ${item.unidade || 'un'}`;
    detalhes.push(renomeado ? `${de} → ${para}` : `${nome}: ${de} → ${para}`);
  }
  return detalhes.join(' · ');
};

function Secao({ titulo, cor, children }) {
  return (
    <div>
      <p className={`text-xs font-semibold mb-1 ${cor}`}>{titulo}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

/**
 * Diferenças entre duas listas de itens (Adicionados / Removidos / Alterados).
 * Para registros de criação, passe `antes = []` e `tituloAdicionados="Itens"`.
 */
export default function DiffItens({ antes, depois, tituloAdicionados = 'Adicionados' }) {
  const { adicionados, removidos, alterados } = diffItens(antes, depois);

  if (adicionados.length === 0 && removidos.length === 0 && alterados.length === 0) {
    return <p className="text-xs text-slate-500">Nenhuma alteração nos itens.</p>;
  }

  return (
    <div className="space-y-2 text-xs">
      {adicionados.length > 0 && (
        <Secao titulo={`${tituloAdicionados} (${adicionados.length})`} cor="text-green-400">
          {adicionados.map((item, i) => (
            // Lista somente leitura derivada do histórico: índice estável
            <li key={`${item.id ?? item.nome}-${i}`} className="text-green-300/90 break-words">
              + {rotuloItem(item)}
            </li>
          ))}
        </Secao>
      )}
      {removidos.length > 0 && (
        <Secao titulo={`Removidos (${removidos.length})`} cor="text-red-400">
          {removidos.map((item, i) => (
            <li key={`${item.id ?? item.nome}-${i}`} className="text-red-300/90 break-words">
              − {rotuloItem(item)}
            </li>
          ))}
        </Secao>
      )}
      {alterados.length > 0 && (
        <Secao titulo={`Alterados (${alterados.length})`} cor="text-amber-400">
          {alterados.map((alteracao, i) => (
            <li key={`${alteracao.item.id ?? alteracao.item.nome}-${i}`} className="text-amber-300/90 break-words">
              ~ {descreverAlteracao(alteracao)}
            </li>
          ))}
        </Secao>
      )}
    </div>
  );
}
