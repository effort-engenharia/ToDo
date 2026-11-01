import React, { createElement, useRef } from 'react';
import { FaBuilding, FaListAlt, FaMagic } from 'react-icons/fa';
import { idAba, idPainelAba } from './filtrosObrasUtils';

const ABAS = [
  { id: 'obras', rotulo: 'Obras', curto: 'Obras', icone: FaBuilding, cor: 'sky' },
  { id: 'resumo', rotulo: 'Resumo de Etapas', curto: 'Resumo', icone: FaListAlt, cor: 'sky' },
  { id: 'templates', rotulo: 'Templates', curto: 'Templates', icone: FaMagic, cor: 'purple' }
];

const ABA_ATIVA = {
  sky: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  purple: 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
};

// Abas do Planejamento: alvos de 44px, cabem em 360px e navegam com ←/→ (roving tabindex)
const AbasPlanejamento = ({ abaAtiva, onChange, totalTemplates }) => {
  const refs = useRef({});

  const aoTeclar = (e, indice) => {
    let destino = null;
    if (e.key === 'ArrowRight') destino = (indice + 1) % ABAS.length;
    else if (e.key === 'ArrowLeft') destino = (indice - 1 + ABAS.length) % ABAS.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = ABAS.length - 1;
    if (destino === null) return;
    e.preventDefault();
    onChange(ABAS[destino].id);
    refs.current[ABAS[destino].id]?.focus();
  };

  return (
    <div role="tablist" aria-label="Planejamento" className="flex w-full sm:w-auto items-center gap-1 overflow-x-auto">
      {ABAS.map(({ id, rotulo, curto, icone, cor }, indice) => {
        const ativa = abaAtiva === id;
        return (
          <button
            key={id}
            ref={(el) => { refs.current[id] = el; }}
            id={idAba(id)}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={idPainelAba(id)}
            aria-label={id === 'resumo' ? rotulo : undefined}
            tabIndex={ativa ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => aoTeclar(e, indice)}
            className={`plan-toque shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all ${
              ativa ? ABA_ATIVA[cor] : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {createElement(icone, { size: 14, 'aria-hidden': true })}
            {curto === rotulo ? (
              <span>{rotulo}</span>
            ) : (
              <>
                <span className="hidden sm:inline">{rotulo}</span>
                <span className="sm:hidden" aria-hidden="true">{curto}</span>
              </>
            )}
            {id === 'templates' && (
              <span className="text-xs bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded">{totalTemplates}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(AbasPlanejamento);
