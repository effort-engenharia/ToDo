import React from 'react';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../hooks/useMediaQuery';
import LegendaTipos from './LegendaTipos';
import ListaEtapasDoDia, { BotaoEtapaDia } from './ResumoDiaEtapas';

const rotuloDia = (dia) => `${dia.diaSemana} ${String(dia.diaNumero).padStart(2, '0')}`;

// Visão semanal (agenda): lista por dia abaixo de 768px; 7 colunas a partir daí
const ResumoVisaoSemana = ({ dias, onAddAtividade }) => {
  const compacto = useMediaQuery(CONSULTA_ABAIXO_MD);

  if (compacto) {
    return (
      <div className="execucao-card p-0 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-700">
          {dias.map((dia) => (
            <details key={dia.chave} open={dia.isHoje || undefined} className={dia.isHoje ? 'bg-sky-500/5' : ''}>
              <summary className="plan-toque flex w-full cursor-pointer items-center justify-between gap-2 px-3 text-sm text-white">
                <span className={`font-semibold ${dia.isHoje ? 'rounded bg-sky-700 px-2 py-0.5' : ''}`}>
                  {rotuloDia(dia)}{dia.isHoje ? ' · hoje' : ''}
                </span>
                <span className="text-slate-300">{dia.etapas.length} {dia.etapas.length === 1 ? 'etapa' : 'etapas'}</span>
              </summary>
              <div className="px-3 pb-3">
                <ListaEtapasDoDia etapas={dia.etapas} onAddAtividade={onAddAtividade} />
              </div>
            </details>
          ))}
        </div>
        <LegendaTipos padding="p-4" />
      </div>
    );
  }

  return (
  <div className="execucao-card p-0 overflow-hidden">
    <div
      className="plan-rolagem"
      role="region"
      aria-label="Agenda da semana, role na horizontal para ver todos os dias"
      tabIndex={0}
    >
      <div className="min-w-[900px]">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-7 border-b border-slate-700">
          {dias.map((dia) => (
            <div
              key={dia.chave}
              className={`p-3 text-center border-r border-slate-700 last:border-r-0 ${
                dia.isHoje ? 'bg-sky-900' : 'bg-slate-800'
              }`}
            >
              <div className={`text-xs font-medium ${dia.isHoje ? 'text-sky-200' : 'text-slate-300'}`}>
                {dia.diaSemana}
              </div>
              <div className={`text-2xl font-bold text-white ${
                dia.isHoje ? 'bg-sky-700 w-10 h-10 rounded-full flex items-center justify-center mx-auto' : ''
              }`}>
                {dia.diaNumero}
              </div>
            </div>
          ))}
        </div>

        {/* Corpo da agenda com etapas */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {dias.map((dia) => (
            <div
              key={dia.chave}
              className={`border-r border-slate-700 last:border-r-0 p-2 ${
                dia.isHoje ? 'bg-sky-500/5' : ''
              }`}
            >
              {dia.etapas.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-4">
                  Sem etapas
                </div>
              ) : (
                <div className="space-y-1">
                  {dia.etapas.map((etapa) => (
                    <BotaoEtapaDia key={etapa.id} etapa={etapa} onAddAtividade={onAddAtividade} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

    <LegendaTipos padding="p-4" />
  </div>
  );
};

export default React.memo(ResumoVisaoSemana);
