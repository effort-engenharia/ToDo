import React from 'react';
import { formatarDataCurta } from './utils';

// Borda por tipo: cartão escuro com texto branco (contraste ≥4,5:1) e a cor só como marcador
const BORDA_TIPO = {
  eletrica: 'border-yellow-500',
  civil: 'border-orange-500',
  galpao: 'border-purple-500',
  administrativo: 'border-green-500',
  geral: 'border-blue-500',
  padrao: 'border-blue-500'
};

const bordaDoTipo = (tipo) => BORDA_TIPO[tipo] ?? BORDA_TIPO.padrao;

// Etapa de um dia: abre o cadastro de atividade. Alvo de 44px em toque.
export const BotaoEtapaDia = ({ etapa, onAddAtividade }) => (
  <button
    type="button"
    onClick={() => onAddAtividade(etapa)}
    className={`plan-toque block w-full text-left px-2 py-1.5 rounded-md bg-slate-800 border-l-4 ${bordaDoTipo(etapa.tipo)} hover:bg-slate-700 transition-colors`}
    title={`${etapa.cliente} - ${etapa.nome}\n${formatarDataCurta(etapa.data_inicio)} - ${formatarDataCurta(etapa.data_fim)}\nClique para agendar atividade`}
    aria-label={`${etapa.cliente}, ${etapa.nome}, ${etapa.progresso || 0}%. Agendar atividade`}
  >
    <span className="block text-xs font-bold text-white plan-quebra">{etapa.cliente}</span>
    <span className="block text-xs text-slate-200 plan-quebra">{etapa.nome}</span>
    <span className="block text-xs text-slate-300">{etapa.progresso || 0}%</span>
  </button>
);

// Lista de etapas de um dia (visão Semana no mobile e painel do dia na visão Mês)
const ListaEtapasDoDia = ({ etapas, onAddAtividade }) => (
  etapas.length === 0 ? (
    <p className="py-2 text-sm text-slate-300">Sem etapas neste dia.</p>
  ) : (
    <ul className="flex flex-col gap-2">
      {etapas.map((etapa) => (
        <li key={etapa.id}><BotaoEtapaDia etapa={etapa} onAddAtividade={onAddAtividade} /></li>
      ))}
    </ul>
  )
);

export default React.memo(ListaEtapasDoDia);
