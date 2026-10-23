import React from 'react';
import { SAUDE, resumoMotivos } from './saude';

// Selo de saúde da obra; o tooltip e o texto lido por leitores de tela trazem os motivos
const SeloSaude = ({ saude, mostrarMotivos = false }) => {
  const meta = SAUDE[saude?.saude];
  if (!meta) return null;
  const motivos = saude.motivos ?? [];

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span
        className={`execucao-badge ${meta.badge}`}
        title={resumoMotivos(saude)}
        aria-label={`Saúde da obra: ${meta.rotulo}${motivos.length ? `. ${motivos.join('; ')}` : ''}`}
      >
        <span aria-hidden="true" className="mr-1">{meta.emoji}</span>
        {meta.rotulo}
        {saude.saude === 'atrasada' && saude.dias_atraso > 0 ? ` ${saude.dias_atraso}d` : ''}
      </span>
      {mostrarMotivos && motivos.length > 0 && (
        <span className="text-xs text-slate-400">{motivos.join(' · ')}</span>
      )}
    </span>
  );
};

export default React.memo(SeloSaude);
