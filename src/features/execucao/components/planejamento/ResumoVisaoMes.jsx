import React, { useRef, useState } from 'react';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../hooks/useMediaQuery';
import { DIAS_SEMANA_CURTO } from './constants';
import LegendaTipos from './LegendaTipos';
import ListaEtapasDoDia from './ResumoDiaEtapas';
import { formatarDataCurta } from './utils';

const PONTO_TIPO = {
  eletrica: 'bg-yellow-500',
  civil: 'bg-orange-500',
  galpao: 'bg-purple-500',
  administrativo: 'bg-green-500',
  geral: 'bg-blue-500',
  padrao: 'bg-blue-500'
};
const BORDA_TIPO = {
  eletrica: 'border-yellow-500',
  civil: 'border-orange-500',
  galpao: 'border-purple-500',
  administrativo: 'border-green-500',
  geral: 'border-blue-500',
  padrao: 'border-blue-500'
};

const textoEtapas = (n) => `${n} ${n === 1 ? 'etapa' : 'etapas'}`;

// Visão mensal: grade de 6 semanas. Abaixo de 768px cada dia vira um alvo de 44px com pontos; o toque abre o painel do dia.
const ResumoVisaoMes = ({ semanas, onAddAtividade }) => {
  const compacto = useMediaQuery(CONSULTA_ABAIXO_MD);
  const [selecionada, setSelecionada] = useState(null); // chave (YYYY-MM-DD) do dia aberto no painel
  const gradeRef = useRef(null);

  const diaSelecionado = semanas.flat().find((d) => d.chave === selecionada) ?? null;

  // Setas movem o foco entre os dias (←/→ um dia, ↑/↓ uma semana)
  const aoTeclar = (e) => {
    const passos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const passo = passos[e.key];
    if (!passo) return;
    const botoes = [...gradeRef.current.querySelectorAll('button[data-dia]')];
    const destino = botoes[botoes.indexOf(document.activeElement) + passo];
    if (!destino) return;
    e.preventDefault();
    destino.focus();
  };

  return (
    <div className="execucao-card p-0 overflow-hidden">
      {/* Header com dias da semana */}
      <div className="grid grid-cols-7 border-b border-slate-700 bg-slate-800">
        {DIAS_SEMANA_CURTO.map((dia) => (
          <div key={dia} className="p-2 text-center text-xs font-semibold text-slate-300 border-r border-slate-700 last:border-r-0">
            {dia}
          </div>
        ))}
      </div>

      {/* Grid do mês */}
      <div ref={gradeRef} onKeyDown={compacto ? aoTeclar : undefined}>
        {semanas.map((semana) => (
          <div key={semana[0].chave} className="grid grid-cols-7 border-b border-slate-700 last:border-b-0">
            {semana.map((dia) => (compacto ? (
              <button
                type="button"
                key={dia.chave}
                data-dia
                onClick={() => setSelecionada((atual) => (atual === dia.chave ? null : dia.chave))}
                aria-pressed={selecionada === dia.chave}
                aria-label={`Dia ${dia.diaNumero}: ${textoEtapas(dia.etapas.length)}`}
                className={`plan-toque flex min-h-[48px] w-full flex-col items-center justify-center gap-1 border-r border-slate-700 last:border-r-0 ${
                  !dia.isMesAtual ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-800/30 text-slate-100'
                } ${selecionada === dia.chave ? 'ring-2 ring-inset ring-sky-400' : ''}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${dia.isHoje ? 'bg-sky-700 text-white' : ''}`}>
                  {dia.diaNumero}
                </span>
                <span className="flex h-2 items-center gap-0.5" aria-hidden="true">
                  {dia.etapas.slice(0, 3).map((etapa) => (
                    <span key={etapa.id} className={`plan-dia-ponto ${PONTO_TIPO[etapa.tipo] ?? PONTO_TIPO.padrao}`} />
                  ))}
                  {dia.etapas.length > 3 && <span className="text-xs leading-none text-slate-200">+{dia.etapas.length - 3}</span>}
                </span>
              </button>
            ) : (
              <div
                key={dia.chave}
                className={`min-h-[100px] p-1 border-r border-slate-700 last:border-r-0 ${
                  !dia.isMesAtual ? 'bg-slate-900/50' :
                  dia.isHoje ? 'bg-sky-500/10' : 'bg-slate-800/30'
                }`}
              >
                {/* Número do dia */}
                <div className={`text-right text-sm font-medium mb-1 ${
                  !dia.isMesAtual ? 'text-slate-400' : 'text-slate-200'
                }`}>
                  {dia.isHoje ? (
                    <span className="bg-sky-700 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                      {dia.diaNumero}
                    </span>
                  ) : dia.diaNumero}
                </div>

                {/* Etapas do dia */}
                <div className="space-y-0.5">
                  {dia.etapas.slice(0, 3).map((etapa) => (
                    <button
                      type="button"
                      key={etapa.id}
                      onClick={() => onAddAtividade(etapa)}
                      className={`plan-toque block w-full text-left text-xs px-1 py-0.5 rounded truncate cursor-pointer bg-slate-800 text-white border-l-4 hover:bg-slate-700 ${BORDA_TIPO[etapa.tipo] ?? BORDA_TIPO.padrao}`}
                      title={`${etapa.cliente}\n${etapa.nome}`}
                    >
                      {etapa.cliente?.substring(0, 12)}
                    </button>
                  ))}
                  {dia.etapas.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setSelecionada(dia.chave)}
                      className="plan-toque block w-full text-center text-xs text-sky-300 underline"
                      aria-label={`Ver todas as ${textoEtapas(dia.etapas.length)} do dia ${dia.diaNumero}`}
                    >
                      +{dia.etapas.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            )))}
          </div>
        ))}
      </div>

      {diaSelecionado && (
        <section aria-label={`Etapas de ${formatarDataCurta(diaSelecionado.data)}`} className="border-t border-slate-700 bg-slate-800/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">Etapas de {formatarDataCurta(diaSelecionado.data)}</h4>
            <button type="button" className="plan-toque rounded px-2 text-sm text-slate-200 hover:bg-slate-700" onClick={() => setSelecionada(null)}>
              Fechar
            </button>
          </div>
          <ListaEtapasDoDia etapas={diaSelecionado.etapas} onAddAtividade={onAddAtividade} />
        </section>
      )}

      <LegendaTipos padding="p-3" />
    </div>
  );
};

export default React.memo(ResumoVisaoMes);
