import React from 'react';
import { DIAS_SEMANA_CURTO, TIPO_COR_AGENDA } from './constants';
import LegendaTipos from './LegendaTipos';

// Visão mensal: grade de 6 semanas
const ResumoVisaoMes = ({ semanas, onAddAtividade }) => (
  <div className="execucao-card p-0 overflow-hidden">
    {/* Header com dias da semana */}
    <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-800/70">
      {DIAS_SEMANA_CURTO.map((dia) => (
        <div key={dia} className="p-2 text-center text-xs font-semibold text-slate-400 border-r border-slate-700 last:border-r-0">
          {dia}
        </div>
      ))}
    </div>

    {/* Grid do mês */}
    {semanas.map((semana) => (
      <div key={semana[0].chave} className="grid grid-cols-7 border-b border-slate-700 last:border-b-0">
        {semana.map((dia) => (
          <div
            key={dia.chave}
            className={`min-h-[100px] p-1 border-r border-slate-700 last:border-r-0 ${
              !dia.isMesAtual ? 'bg-slate-900/50' :
              dia.isHoje ? 'bg-sky-500/10' : 'bg-slate-800/30'
            }`}
          >
            {/* Número do dia */}
            <div className={`text-right text-sm font-medium mb-1 ${
              !dia.isMesAtual ? 'text-slate-600' :
              dia.isHoje ? 'text-sky-400' : 'text-slate-400'
            }`}>
              {dia.isHoje ? (
                <span className="bg-sky-500 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                  {dia.diaNumero}
                </span>
              ) : dia.diaNumero}
            </div>

            {/* Etapas do dia */}
            <div className="space-y-0.5 overflow-y-auto max-h-[80px]">
              {dia.etapas.slice(0, 3).map((etapa) => (
                <button
                  type="button"
                  key={etapa.id}
                  onClick={() => onAddAtividade(etapa)}
                  className={`block w-full text-left text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${TIPO_COR_AGENDA[etapa.tipo] ?? TIPO_COR_AGENDA.padrao}`}
                  title={`${etapa.cliente}\n${etapa.nome}`}
                >
                  {etapa.cliente?.substring(0, 10)}
                </button>
              ))}
              {dia.etapas.length > 3 && (
                <div className="text-[9px] text-slate-500 text-center">
                  +{dia.etapas.length - 3} mais
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    ))}

    <LegendaTipos padding="p-3" />
  </div>
);

export default React.memo(ResumoVisaoMes);
