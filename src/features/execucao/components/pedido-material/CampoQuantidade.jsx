import React, { useState } from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { formatarQuantidade, normalizarQuantidade, passoDaUnidade, unidadeInteira } from './utils';

// Texto digitado → número (aceita vírgula ou ponto); vazio/inválido → null
const lerTexto = (texto) => {
  if (!texto || texto === ',') return null;
  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
};

// Mantém só o que cabe na unidade: inteiros (un/cx/pct) ou até 2 casas decimais
const sanear = (bruto, inteira) => {
  const limpo = bruto.replace(/[^\d.,]/g, '');
  if (inteira) return limpo.split(/[.,]/)[0];
  const [inteiros, ...resto] = limpo.replace(/\./g, ',').split(',');
  return resto.length === 0 ? inteiros : `${inteiros},${resto.join('').slice(0, 2)}`;
};

const arredondar = (valor) => Math.round(valor * 100) / 100;

/**
 * Campo de quantidade com texto livre (pode ficar vazio enquanto edita).
 * `value`: number | null (vazio). `onChange(number | null)`.
 * Setas ↑/↓ e botões −/+ respeitam o passo da unidade (1 para un/cx/pct, 0,1 para as demais).
 */
export default function CampoQuantidade({
  id,
  value,
  unidade,
  onChange,
  invalido = false,
  ariaLabel = 'Quantidade',
  descricaoId,
  className = '',
  inputClassName = 'execucao-form-input'
}) {
  const inteira = unidadeInteira(unidade);
  const passo = passoDaUnidade(unidade);
  const minimo = passo;

  const [texto, setTexto] = useState(() => formatarQuantidade(value));
  const [valorAnterior, setValorAnterior] = useState(value);

  // Mudança vinda de fora (troca de unidade, template aplicado): ressincroniza o texto
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (lerTexto(texto) !== (value ?? null)) setTexto(formatarQuantidade(value));
  }

  const aplicar = (novoTexto, numero) => {
    setTexto(novoTexto);
    setValorAnterior(numero);
    onChange(numero);
  };

  const handleChange = (e) => {
    const novoTexto = sanear(e.target.value, inteira);
    aplicar(novoTexto, lerTexto(novoTexto));
  };

  const mover = (direcao) => {
    const atual = lerTexto(texto) ?? 0;
    const proximo = Math.max(minimo, arredondar(atual + direcao * passo));
    const normalizado = normalizarQuantidade(proximo, unidade);
    aplicar(formatarQuantidade(normalizado), normalizado);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mover(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      mover(-1);
    }
  };

  // Ao sair do campo: ajusta ao formato da unidade; vazio continua vazio (o erro aparece ao salvar)
  const handleBlur = () => {
    const numero = lerTexto(texto);
    if (numero === null) {
      if (texto !== '') aplicar('', null);
      return;
    }
    const normalizado = normalizarQuantidade(numero, unidade);
    aplicar(formatarQuantidade(normalizado), normalizado);
  };

  const botao = 'execucao-btn execucao-btn-secondary execucao-btn-sm !px-2 flex-shrink-0';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        className={botao}
        onClick={() => mover(-1)}
        aria-label={`Diminuir ${passo === 1 ? '1' : '0,1'}`}
        tabIndex={-1}
      >
        <FaMinus size={9} aria-hidden="true" />
      </button>
      <input
        id={id}
        type="text"
        inputMode={inteira ? 'numeric' : 'decimal'}
        autoComplete="off"
        className={`${inputClassName} text-center min-w-0 w-full ${invalido ? 'border-red-500' : ''}`}
        placeholder="Qtd"
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        aria-describedby={descricaoId}
        value={texto}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <button
        type="button"
        className={botao}
        onClick={() => mover(1)}
        aria-label={`Aumentar ${passo === 1 ? '1' : '0,1'}`}
        tabIndex={-1}
      >
        <FaPlus size={9} aria-hidden="true" />
      </button>
    </div>
  );
}
