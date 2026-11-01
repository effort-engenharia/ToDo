import { useState } from 'react';
import { formatarBRL, parseBRL } from '../../features/compras/utils/cotacao/moeda.js';
import { quantidadeEfetiva, subtotalDaLinha } from '../formulario.js';
import CampoErro from './CampoErro.jsx';

const qtdTexto = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const mascaraPreco = (t) => {
  const n = parseBRL(t);
  return n == null || t.trim() === '' ? t : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};
const descreve = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// Cartão de uma linha da cotação (Anexo B.1.3): Tenho/Não tenho, preço, subtotal, quantidade parcial e observação.
// `linha.alterado` (boolean) é calculado pela página (alterado_na_versao > versão que o fornecedor respondeu).
const CartaoItem = ({ idx, linha, valor, erros, onChange, somenteLeitura = false }) => {
  const [obsAberta, setObsAberta] = useState(Boolean(valor.obs));
  const base = `cp-itens-${idx}`;
  const idTitulo = `${base}-titulo`;
  const idTem = `${base}-tem`;
  const idPreco = `${base}-preco_unitario`;
  const idQtd = `${base}-quantidade_disponivel`;
  const idObs = `${base}-observacao`;
  const parcialAberto = valor.parcial;
  const pedida = Number(linha.quantidade) || 0;
  const disp = parcialAberto && valor.qtdDisp.trim() !== '' ? parseBRL(valor.qtdDisp) : null;
  const efetiva = quantidadeEfetiva(linha, valor);
  const subtotal = subtotalDaLinha(linha, valor);

  const mudar = (parcial) => onChange({ ...valor, ...parcial });
  // Setas alternam entre as opções (radiogroup)
  const teclas = (e) => {
    if (somenteLeitura) return;
    const sim = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const nao = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!sim && !nao) return;
    e.preventDefault();
    mudar({ tem: sim });
    e.currentTarget.querySelector(sim ? '[data-op="sim"]' : '[data-op="nao"]')?.focus();
  };

  return (
    <section className={`cp-cartao${valor.tem === false ? ' cp-cartao-neutro' : ''}`} aria-labelledby={idTitulo}>
      <div className="cp-item-topo">
        <span className="cp-item-num" aria-hidden="true">{idx + 1}</span>
        <h3 id={idTitulo} className="cp-item-desc">{linha.descricao}</h3>
      </div>
      <div className="cp-selos">
        {linha.alterado && <span className="cp-selo cp-selo-aviso">⚠ alterado</span>}
        {valor.tem === false && <span className="cp-selo cp-selo-neutro">Sem este item</span>}
      </div>
      <p className="cp-item-qtd">Quantidade: <strong>{qtdTexto(pedida)} {linha.unidade}</strong></p>
      {linha.observacao && <p className="cp-dica">{linha.observacao}</p>}

      <div
        id={idTem}
        className="cp-segmentado"
        role="radiogroup"
        aria-labelledby={idTitulo}
        aria-describedby={descreve(erros[idTem] && `${idTem}-erro`)}
        onKeyDown={teclas}
      >
        <button
          type="button" role="radio" aria-checked={valor.tem === true} disabled={somenteLeitura} data-op="sim"
          className={`cp-seg${valor.tem === true ? ' cp-seg-sim' : ''}`}
          tabIndex={valor.tem === false ? -1 : 0}
          onClick={() => mudar({ tem: true })}
        >
          {valor.tem === true ? '✓ ' : ''}Tenho
        </button>
        <button
          type="button" role="radio" aria-checked={valor.tem === false} disabled={somenteLeitura} data-op="nao"
          className={`cp-seg${valor.tem === false ? ' cp-seg-nao' : ''}`}
          tabIndex={valor.tem === false ? 0 : -1}
          onClick={() => mudar({ tem: false })}
        >
          Não tenho
        </button>
      </div>
      <CampoErro id={idTem} mensagem={erros[idTem]} />

      {valor.tem === true && (
        <>
          <label className="cp-rotulo" htmlFor={idPreco}>Preço unitário (R$ por {linha.unidade})</label>
          <div className="cp-prefixo">
            <span aria-hidden="true">R$</span>
            <input
              id={idPreco} type="text" inputMode="decimal" autoComplete="off" className="cp-campo"
              placeholder="0,00" value={valor.preco} readOnly={somenteLeitura}
              aria-invalid={erros[idPreco] ? true : undefined} aria-describedby={descreve(erros[idPreco] && `${idPreco}-erro`)}
              onChange={(e) => mudar({ preco: e.target.value })}
              onBlur={(e) => mudar({ preco: mascaraPreco(e.target.value) })}
            />
          </div>
          <CampoErro id={idPreco} mensagem={erros[idPreco]} />
          <p className="cp-subtotal" aria-live="polite">
            Subtotal: <strong>{subtotal > 0 ? formatarBRL(subtotal) : '—'}</strong>
            {subtotal > 0 && efetiva < pedida ? ` (${qtdTexto(efetiva)} ${linha.unidade})` : ''}
          </p>

          <button
            type="button" className="cp-disclosure" aria-expanded={parcialAberto} aria-controls={`${base}-parcial`}
            disabled={somenteLeitura} onClick={() => mudar({ parcial: !parcialAberto })}
          >
            {parcialAberto ? '▾' : '▸'} Tenho só parte da quantidade
          </button>
          {parcialAberto && (
            <div id={`${base}-parcial`} className="cp-disclosure-corpo">
              <label className="cp-rotulo" htmlFor={idQtd}>Quantidade disponível ({linha.unidade})</label>
              <input
                id={idQtd} type="text" inputMode="decimal" autoComplete="off" className="cp-campo"
                value={valor.qtdDisp} readOnly={somenteLeitura}
                aria-invalid={erros[idQtd] ? true : undefined} aria-describedby={descreve(erros[idQtd] && `${idQtd}-erro`, `${idQtd}-dica`)}
                onChange={(e) => mudar({ qtdDisp: e.target.value })}
              />
              <CampoErro id={idQtd} mensagem={erros[idQtd]} />
              <p id={`${idQtd}-dica`} className="cp-dica" aria-live="polite">
                {disp != null && disp >= pedida && pedida > 0 && 'Isso cobre o pedido todo.'}
                {disp != null && disp > 0 && disp < pedida && `Faltam ${qtdTexto(pedida - disp)} ${linha.unidade}.`}
              </p>
            </div>
          )}
        </>
      )}

      {valor.tem !== null && (
        <>
          <button
            type="button" className="cp-disclosure" aria-expanded={obsAberta} aria-controls={idObs}
            onClick={() => setObsAberta((a) => !a)}
          >
            {obsAberta ? '▾' : '▸'} Marca / observação (opcional)
          </button>
          {obsAberta && (
            <div className="cp-disclosure-corpo">
              <label className="cp-rotulo" htmlFor={idObs}>Marca / observação</label>
              <input
                id={idObs} type="text" className="cp-campo" maxLength={200} value={valor.obs} readOnly={somenteLeitura}
                aria-invalid={erros[idObs] ? true : undefined} aria-describedby={descreve(erros[idObs] && `${idObs}-erro`)}
                onChange={(e) => mudar({ obs: e.target.value })}
              />
              <CampoErro id={idObs} mensagem={erros[idObs]} />
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default CartaoItem;
