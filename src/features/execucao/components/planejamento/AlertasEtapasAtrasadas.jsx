import React, { useMemo, useState } from 'react';
import { FaBell, FaCalendarPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { formatarDataBR, parseDataLocal } from '../../utils/datas';
import { etapaAtrasada, inicioDeHoje } from './utils';
import { passosPendentesDaEtapa } from './estadoEtapa';
import SeloPassosPendentes from './SeloPassosPendentes';

const MS_DIA = 1000 * 60 * 60 * 24;

const AlertasEtapasAtrasadas = ({ obras, onVerEtapa, passosPorEtapa }) => {
  // Hooks sempre antes de qualquer retorno condicional
  const [expanded, setExpanded] = useState(true);

  const etapasAtrasadas = useMemo(() => {
    const hoje = inicioDeHoje();
    const atrasadas = [];

    obras.forEach((obra) => {
      if (!obra.etapas) return;
      obra.etapas.forEach((etapa) => {
        if (etapa.etapa_pai_id || !etapaAtrasada(etapa, hoje)) return;
        const diasAtraso = Math.ceil((hoje - parseDataLocal(etapa.data_fim)) / MS_DIA);
        atrasadas.push({
          ...etapa,
          cliente: obra.nome_cliente,
          cidade: obra.cidade,
          obra_id: obra.id,
          diasAtraso
        });
      });
    });

    // Mais atrasadas primeiro
    return atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [obras]);

  // Etapas pai com a atividade concluída e passos (sub-etapas) em aberto: o servidor mantém o pai em andamento
  const etapasComPassosPendentes = useMemo(() => {
    const lista = [];
    obras.forEach((obra) => {
      (obra.etapas || []).forEach((etapa) => {
        const pendentes = passosPendentesDaEtapa(passosPorEtapa, etapa.id);
        if (pendentes > 0) {
          lista.push({ ...etapa, cliente: obra.nome_cliente, cidade: obra.cidade, obra_id: obra.id, passosPendentes: pendentes });
        }
      });
    });
    return lista.sort((a, b) => b.passosPendentes - a.passosPendentes);
  }, [obras, passosPorEtapa]);

  if (etapasAtrasadas.length === 0 && etapasComPassosPendentes.length === 0) return null;

  return (
    <>
      {etapasComPassosPendentes.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-amber-300/40 bg-amber-300/10 execucao-animate-fade-in" role="region" aria-label="Etapas com passos pendentes">
          <div className="p-4">
            <span className="flex flex-wrap items-center gap-2 font-bold text-amber-200">
              ⚠️ Passos pendentes
              <span className="bg-amber-700 text-white text-xs px-2 py-0.5 rounded-full">{etapasComPassosPendentes.length}</span>
            </span>
            <span className="block text-sm text-slate-300">
              A atividade foi concluída, mas a etapa segue em andamento até todos os passos serem concluídos.
            </span>
          </div>
          <ul className="border-t border-amber-300/30 max-h-[40dvh] sm:max-h-56 overflow-y-auto">
            {etapasComPassosPendentes.map((etapa) => (
              <li key={etapa.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between p-3 border-b border-amber-300/20 last:border-b-0">
                <div className="min-w-0 plan-quebra">
                  <div className="font-medium text-white">{etapa.nome}</div>
                  <div className="text-xs text-slate-300">{etapa.cliente} • {etapa.cidade}</div>
                </div>
                <SeloPassosPendentes quantidade={etapa.passosPendentes} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {etapasAtrasadas.length > 0 && (
        <BlocoEtapasAtrasadas etapasAtrasadas={etapasAtrasadas} expanded={expanded} setExpanded={setExpanded} onVerEtapa={onVerEtapa} />
      )}
    </>
  );
};

const BlocoEtapasAtrasadas = ({ etapasAtrasadas, expanded, setExpanded, onVerEtapa }) => {
  return (
    <div className="mb-6 execucao-animate-fade-in">
      <div
        className={`rounded-lg border-2 ${expanded ? 'border-red-500/50 bg-red-500/10' : 'border-red-500/30 bg-red-500/5'} overflow-hidden`}
      >
        {/* Header do Alerta: o título inteiro é o botão que expande/recolhe */}
        <button
          type="button"
          className="plan-toque flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-red-500/20 transition-colors"
          aria-expanded={expanded}
          aria-controls="alertas-atrasadas-lista"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="p-2 bg-red-500/20 rounded-lg animate-pulse motion-reduce:animate-none shrink-0">
              <FaBell className="text-red-300" size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-bold text-red-300">
                ⚠️ Etapas Atrasadas
                <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {etapasAtrasadas.length}
                </span>
              </span>
              <span className="block text-sm text-slate-300">
                {etapasAtrasadas.length} etapa{etapasAtrasadas.length > 1 ? 's' : ''} precisam de atenção imediata
              </span>
            </span>
          </span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">
            {expanded ? <FaChevronUp /> : <FaChevronDown />}
          </span>
        </button>

        {/* Lista de Etapas Atrasadas */}
        {expanded && (
          <div id="alertas-atrasadas-lista" className="border-t border-red-500/30 max-h-[50dvh] sm:max-h-64 overflow-y-auto">
            {etapasAtrasadas.map((etapa, index) => (
              <div
                key={etapa.id}
                className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 hover:bg-red-500/10 transition-colors ${
                  index < etapasAtrasadas.length - 1 ? 'border-b border-red-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 shrink-0 rounded-full ${
                    etapa.diasAtraso > 7 ? 'bg-red-500' :
                    etapa.diasAtraso > 3 ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div className="min-w-0 plan-quebra">
                    <div className="font-medium text-white">{etapa.nome}</div>
                    <div className="text-xs text-slate-300">
                      {etapa.cliente} • {etapa.cidade}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <div className="sm:text-right flex-1 sm:flex-none">
                    <div className={`text-sm font-bold ${
                      etapa.diasAtraso > 7 ? 'text-red-400' :
                      etapa.diasAtraso > 3 ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {etapa.diasAtraso} dia{etapa.diasAtraso > 1 ? 's' : ''} de atraso
                    </div>
                    <div className="text-xs text-slate-400">
                      Prazo: {formatarDataBR(etapa.data_fim)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">
                    {etapa.progresso || 0}%
                  </div>
                  <button
                    type="button"
                    onClick={() => onVerEtapa(etapa)}
                    className="plan-toque w-full sm:w-auto gap-2 p-2 text-sky-300 hover:bg-sky-500/20 rounded-lg transition-colors"
                    title="Criar atividade para esta etapa"
                    aria-label={`Criar atividade para a etapa ${etapa.nome}`}
                  >
                    <FaCalendarPlus size={14} aria-hidden="true" />
                    <span className="sm:hidden text-sm font-medium" aria-hidden="true">Criar atividade</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(AlertasEtapasAtrasadas);
