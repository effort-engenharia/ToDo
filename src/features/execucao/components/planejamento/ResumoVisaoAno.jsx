import React from 'react';

const TIPOS_RESUMO_ANUAL = [
  { tipo: 'eletrica', emoji: '⚡', classe: 'bg-yellow-500/20 text-yellow-300' },
  { tipo: 'civil', emoji: '🏗️', classe: 'bg-orange-500/20 text-orange-300' },
  { tipo: 'galpao', emoji: '🏭', classe: 'bg-purple-500/20 text-purple-300' },
  { tipo: 'geral', emoji: '📋', classe: 'bg-blue-500/20 text-blue-300' },
  { tipo: 'administrativo', emoji: '📊', classe: 'bg-green-500/20 text-green-300' }
];

// Visão anual: um cartão por mês com contagem por equipe e clientes
const ResumoVisaoAno = ({ meses, ano }) => (
  <div className="execucao-card p-4">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {meses.map((mes) => {
        const clientes = [...new Set(mes.etapas.map(e => e.cliente))];

        return (
          <div
            key={mes.mes}
            className={`rounded-lg border p-3 ${
              mes.isAtual
                ? 'border-sky-500/50 bg-sky-500/10'
                : 'border-slate-700 bg-slate-800/30'
            }`}
          >
            {/* Nome do mês */}
            <div className={`text-sm font-bold mb-2 ${mes.isAtual ? 'text-sky-400' : 'text-white'}`}>
              {mes.nomeLongo.toUpperCase()}
            </div>

            {/* Contagem de etapas */}
            <div className="text-2xl font-bold text-white mb-2">
              {mes.etapas.length}
              <span className="text-xs font-normal text-slate-400 ml-1">etapas</span>
            </div>

            {/* Breakdown por tipo */}
            <div className="flex flex-wrap gap-1">
              {TIPOS_RESUMO_ANUAL.map(({ tipo, emoji, classe }) => {
                const quantidade = mes.etapas.filter(e => e.tipo === tipo).length;
                return quantidade > 0 && (
                  <span key={tipo} className={`text-[10px] px-1.5 py-0.5 rounded ${classe}`}>
                    {emoji} {quantidade}
                  </span>
                );
              })}
            </div>

            {/* Lista de clientes únicos */}
            {mes.etapas.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 mb-1">Clientes:</div>
                <div className="flex flex-wrap gap-1">
                  {clientes.slice(0, 3).map((cliente) => (
                    <span key={cliente} className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300 truncate max-w-[80px]">
                      {cliente}
                    </span>
                  ))}
                  {clientes.length > 3 && (
                    <span className="text-[9px] text-slate-500">
                      +{clientes.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Resumo anual */}
    <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="text-slate-400 text-sm">Total {ano}:</div>
        <div className="text-white font-bold">
          {meses.reduce((acc, m) => acc + m.etapas.length, 0)} etapas
        </div>
        <div className="text-slate-400">em</div>
        <div className="text-white font-bold">
          {new Set(meses.flatMap(m => m.etapas.map(e => e.cliente))).size} clientes
        </div>
      </div>
    </div>
  </div>
);

export default React.memo(ResumoVisaoAno);
