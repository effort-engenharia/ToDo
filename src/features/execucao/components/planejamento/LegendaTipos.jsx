import React from 'react';
import { LEGENDA_TIPOS } from './constants';

const LegendaTipos = ({ padding = 'p-4' }) => (
  <div className={`${padding} border-t border-slate-700 flex flex-wrap gap-4 text-xs`}>
    <span className="text-slate-400">Legenda:</span>
    {LEGENDA_TIPOS.map(({ chave, cor, label }) => (
      <div key={chave} className="flex items-center gap-1">
        <div className={`w-3 h-3 rounded ${cor}`}></div>
        <span className="text-slate-300">{label}</span>
      </div>
    ))}
  </div>
);

export default LegendaTipos;
