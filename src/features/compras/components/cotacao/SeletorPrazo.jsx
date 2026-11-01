import React, { useId } from 'react';
import { formatarPrazo, localParaISO, prazoEmHoras } from '../../utils/cotacao/envio';

// Chips de prazo (+24 h / +48 h / +72 h / data e hora). `valor` = { modo, local, iso }. Devolve o novo valor por `onChange`.

export default function SeletorPrazo({ valor, onChange, rotulo = 'Novo prazo', prefixo = '', erro = '' }) {
  const id = useId();
  const escolher = (modo, local) => {
    if (modo === 'data') { const l = local ?? valor.local; onChange({ modo, local: l, iso: localParaISO(l) }); }
    else onChange({ modo, local: '', iso: prazoEmHoras(modo) });
  };
  return (
    <fieldset>
      <legend className="cmp-rotulo mb-1">{rotulo}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={rotulo}>
        {[24, 48, 72, 'data'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={valor.modo === m} className={`cmp-opcao ${valor.modo === m ? 'cmp-opcao-ativa' : ''}`} onClick={() => escolher(m)}>
            {m === 'data' ? 'Data e hora' : `${prefixo}${m} h`}
          </button>
        ))}
      </div>
      {valor.modo === 'data' && (
        <div className="cmp-campo mt-2">
          <label htmlFor={`${id}-dt`}>Data e hora limite</label>
          <input id={`${id}-dt`} type="datetime-local" className="execucao-form-input" value={valor.local} onChange={(e) => escolher('data', e.target.value)} />
        </div>
      )}
      <p className="text-sm text-slate-300 mt-2" aria-live="polite">Prazo: {valor.iso ? formatarPrazo(valor.iso) : '—'}</p>
      {erro && <p className="cmp-erro-campo" role="alert">{erro}</p>}
    </fieldset>
  );
}
