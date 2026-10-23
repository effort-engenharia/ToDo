import React, { useMemo, useState } from 'react';
import { FaBell, FaCalendarPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { formatarDataBR, parseDataLocal } from '../../utils/datas';
import { etapaAtrasada, inicioDeHoje } from './utils';

const MS_DIA = 1000 * 60 * 60 * 24;

const AlertasEtapasAtrasadas = ({ obras, onVerEtapa }) => {
  // Hooks sempre antes de qualquer retorno condicional
  const [expanded, setExpanded] = useState(true);

  const etapasAtrasadas = useMemo(() => {
    const hoje = inicioDeHoje();
    const atrasadas = [];

    obras.forEach((obra) => {
      if (!obra.etapas) return;
      obra.etapas.forEach((etapa) => {
        if (!etapaAtrasada(etapa, hoje)) return;
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

  if (etapasAtrasadas.length === 0) return null;

  return (
    <div className="mb-6 execucao-animate-fade-in">
      <div
        className={`rounded-lg border-2 ${expanded ? 'border-red-500/50 bg-red-500/10' : 'border-red-500/30 bg-red-500/5'} overflow-hidden`}
      >
        {/* Header do Alerta */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-500/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg animate-pulse">
              <FaBell className="text-red-400" size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-red-400 flex items-center gap-2">
                ⚠️ Etapas Atrasadas
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {etapasAtrasadas.length}
                </span>
              </h3>
              <p className="text-sm text-slate-400">
                {etapasAtrasadas.length} etapa{etapasAtrasadas.length > 1 ? 's' : ''} precisam de atenção imediata
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-slate-400"
            aria-expanded={expanded}
            aria-label={expanded ? 'Recolher etapas atrasadas' : 'Expandir etapas atrasadas'}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <FaChevronUp aria-hidden="true" /> : <FaChevronDown aria-hidden="true" />}
          </button>
        </div>

        {/* Lista de Etapas Atrasadas */}
        {expanded && (
          <div className="border-t border-red-500/30 max-h-64 overflow-y-auto">
            {etapasAtrasadas.map((etapa, index) => (
              <div
                key={etapa.id}
                className={`flex items-center justify-between p-3 hover:bg-red-500/10 transition-colors ${
                  index < etapasAtrasadas.length - 1 ? 'border-b border-red-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    etapa.diasAtraso > 7 ? 'bg-red-500' :
                    etapa.diasAtraso > 3 ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <div className="font-medium text-white">{etapa.nome}</div>
                    <div className="text-xs text-slate-400">
                      {etapa.cliente} • {etapa.cidade}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      etapa.diasAtraso > 7 ? 'text-red-400' :
                      etapa.diasAtraso > 3 ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {etapa.diasAtraso} dia{etapa.diasAtraso > 1 ? 's' : ''} de atraso
                    </div>
                    <div className="text-xs text-slate-500">
                      Prazo: {formatarDataBR(etapa.data_fim)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {etapa.progresso || 0}%
                  </div>
                  <button
                    type="button"
                    onClick={() => onVerEtapa(etapa)}
                    className="p-2 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors"
                    title="Criar atividade para esta etapa"
                    aria-label={`Criar atividade para a etapa ${etapa.nome}`}
                  >
                    <FaCalendarPlus size={14} aria-hidden="true" />
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
