import React from 'react';
import { semanaCores } from '../../../utils/effortTheme';

/**
 * BarraSemanas — Timeline visual das 4 semanas do mês comercial.
 * Cor progressiva: verde → amarelo → laranja → vermelho.
 * Semana atual em destaque com ring.
 */
const BarraSemanas = ({ semanas = [], semanaAtual }) => {
  if (!semanas.length) return null;
  const atualId = semanaAtual?.numero;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Ciclo do mês comercial
        </h3>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">4 semanas</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {semanas.map((s) => {
          const cor = semanaCores[s.corIndex];
          const ativa = atualId === s.numero;
          const passada = atualId ? s.numero < atualId : false;
          return (
            <div
              key={s.numero}
              className={`rounded-lg p-2.5 border-2 transition-all ${
                ativa ? 'ring-4 shadow-md' : ''
              } ${passada ? 'opacity-60' : ''}`}
              style={{
                background: ativa ? cor.corClara : cor.hexRgba,
                borderColor: cor.cor,
                ...(ativa ? { boxShadow: `0 0 0 3px ${cor.cor}33` } : {}),
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase" style={{ color: cor.corEscura }}>
                  Sem {s.numero}
                </span>
                {passada && <span className="text-[10px]">✓</span>}
              </div>
              <div className="text-[10px] font-semibold" style={{ color: cor.corEscura }}>
                {cor.label}
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">
                {s.de.getDate().toString().padStart(2, '0')}/{(s.de.getMonth() + 1).toString().padStart(2, '0')}
                {' → '}
                {s.ate.getDate().toString().padStart(2, '0')}/{(s.ate.getMonth() + 1).toString().padStart(2, '0')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarraSemanas;
