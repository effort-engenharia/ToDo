import React, { useId } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import { ATALHOS_PERIODO } from './periodo';

/**
 * Filtro por data do pedido (created_at). Controlado: `value = { atalho, de, ate }`.
 * Reutilizável (lista de pedidos e Dashboard de Compras).
 */
export default function FiltroPeriodo({ value, onChange, className = '' }) {
  const idBase = useId();
  const { atalho, de, ate } = value;

  const escolher = (novoAtalho) => onChange({ ...value, atalho: novoAtalho });

  // Mantém de ≤ até: ajustar um lado empurra o outro
  const alterarData = (campo, valor) => {
    const proximo = { ...value, [campo]: valor };
    if (proximo.de && proximo.ate && proximo.de > proximo.ate) {
      if (campo === 'de') proximo.ate = valor;
      else proximo.de = valor;
    }
    onChange(proximo);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Período do pedido">
        <FaCalendarAlt className="text-slate-400" aria-hidden="true" />
        {ATALHOS_PERIODO.map((a) => (
          <button
            key={a.valor}
            type="button"
            aria-pressed={atalho === a.valor}
            onClick={() => escolher(a.valor)}
            className={`execucao-btn execucao-btn-sm ${atalho === a.valor ? 'execucao-btn-primary' : 'execucao-btn-secondary'}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {atalho === 'personalizado' && (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-400" htmlFor={`${idBase}-de`}>De</label>
          <input
            id={`${idBase}-de`}
            type="date"
            className="execucao-form-input w-auto"
            value={de}
            max={ate || undefined}
            onChange={(e) => alterarData('de', e.target.value)}
          />
          <label className="text-xs text-slate-400" htmlFor={`${idBase}-ate`}>até</label>
          <input
            id={`${idBase}-ate`}
            type="date"
            className="execucao-form-input w-auto"
            value={ate}
            min={de || undefined}
            onChange={(e) => alterarData('ate', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
