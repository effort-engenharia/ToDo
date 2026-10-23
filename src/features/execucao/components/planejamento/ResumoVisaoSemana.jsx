import React from 'react';
import { TIPO_COR_AGENDA } from './constants';
import LegendaTipos from './LegendaTipos';
import { formatarDataCurta } from './utils';

// Visão semanal (agenda): 7 colunas com as etapas ativas em cada dia
const ResumoVisaoSemana = ({ dias, onAddAtividade }) => (
  <div className="execucao-card p-0 overflow-hidden">
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-7 border-b border-slate-700">
          {dias.map((dia) => (
            <div
              key={dia.chave}
              className={`p-3 text-center border-r border-slate-700 last:border-r-0 ${
                dia.isHoje ? 'bg-sky-500/20' : 'bg-slate-800/50'
              }`}
            >
              <div className={`text-xs font-medium ${dia.isHoje ? 'text-sky-400' : 'text-slate-400'}`}>
                {dia.diaSemana}
              </div>
              <div className={`text-2xl font-bold ${dia.isHoje ? 'text-sky-400' : 'text-white'} ${
                dia.isHoje ? 'bg-sky-500 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto' : ''
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
                <div className="text-center text-slate-600 text-xs py-4">
                  Sem etapas
                </div>
              ) : (
                <div className="space-y-1">
                  {dia.etapas.map((etapa) => (
                    <button
                      type="button"
                      key={etapa.id}
                      onClick={() => onAddAtividade(etapa)}
                      className={`block w-full text-left p-2 rounded-md cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-l-4 ${TIPO_COR_AGENDA[etapa.tipo] ?? TIPO_COR_AGENDA.padrao}`}
                      title={`${etapa.cliente} - ${etapa.nome}\n${formatarDataCurta(etapa.data_inicio)} - ${formatarDataCurta(etapa.data_fim)}\nClique para agendar atividade`}
                    >
                      <div className="text-xs font-bold text-white truncate">
                        {(etapa.cliente || '').substring(0, 15)}{(etapa.cliente || '').length > 15 ? '...' : ''}
                      </div>
                      <div className="text-[10px] text-white/80 truncate">
                        {etapa.nome}
                      </div>
                      <div className="text-[9px] text-white/60 mt-1">
                        {etapa.progresso || 0}%
                      </div>
                    </button>
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

export default React.memo(ResumoVisaoSemana);
