import React, { useCallback, useMemo } from 'react';
import {
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaFlag,
  FaForward,
  FaPlus,
  FaTrash
} from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import { PRIORIDADE_COR, STATUS_OBRA_COR, STATUS_OBRA_LABEL } from './constants';
import GanttObra from './GanttObra';
import { IconeTipoObra } from './icones';
import { calcularDuracaoObra, getStatusReal, obraAtrasada } from './utils';
import PrevistoRealizado from './visao/PrevistoRealizado';
import { useHorasDasEtapas } from './visao/datasPrevistoRealizado';
import { COR_SEM_SAUDE, SAUDE } from './visao/saude';
import SeloSaude from './visao/SeloSaude';

const ObraCard = ({
  obra,
  expandida,
  onToggle,
  onEditar,
  onExcluir,
  onAdicionarEtapa,
  onEditarEtapa,
  onExcluirEtapa,
  onAdicionarAtividade,
  onAdicionarSubEtapa,
  onReprogramar,
  saude
}) => {
  const atrasada = useMemo(() => obraAtrasada(obra), [obra]);
  const statusReal = getStatusReal(obra);
  const horasPorEtapa = useHorasDasEtapas(obra.etapas, expandida);
  const podeReprogramar = Boolean(onReprogramar) && obra.etapas?.length > 0 && statusReal !== 'concluida' && obra.status !== 'cancelada';

  const handleEditarEtapa = useCallback((etapa) => onEditarEtapa(obra, etapa), [onEditarEtapa, obra]);
  const handleReprogramarEtapa = useCallback((etapa) => onReprogramar?.(obra, etapa), [onReprogramar, obra]);
  const handleAdicionarSubEtapa = useCallback((etapaPai) => onAdicionarSubEtapa(obra, etapaPai), [onAdicionarSubEtapa, obra]);

  return (
    <div className="execucao-card" id={`obra-${obra.id}`}>
      {/* Header da Obra */}
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => onToggle(obra.id)}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-slate-800">
            <IconeTipoObra tipo={obra.tipo_obra} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-white">{obra.nome_cliente}</h3>
              <FaFlag className={PRIORIDADE_COR[obra.prioridade] ?? 'text-gray-400'} size={12} aria-label={`Prioridade ${obra.prioridade}`} role="img" />
              <span className={`execucao-badge execucao-badge-${STATUS_OBRA_COR[statusReal] ?? 'gray'}`}>
                {STATUS_OBRA_LABEL[statusReal] ?? statusReal}
              </span>
              {saude ? (
                <SeloSaude saude={saude} />
              ) : atrasada && (
                <span className="execucao-badge execucao-badge-red animate-pulse">
                  Atrasada
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-300 mt-1">
              <span className="flex items-center gap-1">
                <FaCalendarAlt size={10} aria-hidden="true" />
                {formatarDataBR(obra.data_inicio_prevista)} - {formatarDataBR(obra.data_fim_prevista)}
              </span>
              <span className="text-slate-200">({calcularDuracaoObra(obra.data_inicio_prevista, obra.data_fim_prevista)})</span>
              {obra.cidade && (
                <span className="text-slate-200">{obra.cidade}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progresso */}
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-100">{obra.progresso_geral || 0}%</div>
            <div className="text-xs text-slate-500">Progresso</div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {podeReprogramar && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReprogramar(obra, null); }}
                className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                title="Reprogramar: empurrar etapas seguintes em dias úteis (com prévia)"
                aria-label={`Reprogramar etapas de ${obra.nome_cliente}`}
              >
                <FaForward size={12} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditar(obra); }}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
              title="Editar obra"
              aria-label={`Editar obra ${obra.nome_cliente}`}
            >
              <FaEdit size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExcluir(obra.id); }}
              className="execucao-btn execucao-btn-danger execucao-btn-sm"
              title="Excluir obra"
              aria-label={`Excluir obra ${obra.nome_cliente}`}
            >
              <FaTrash size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="text-slate-500"
              aria-expanded={expandida}
              aria-label={expandida ? `Recolher etapas de ${obra.nome_cliente}` : `Expandir etapas de ${obra.nome_cliente}`}
              onClick={(e) => { e.stopPropagation(); onToggle(obra.id); }}
            >
              {expandida ? <FaChevronUp aria-hidden="true" /> : <FaChevronDown aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4">
        <div className="execucao-progress">
          <div
            className={`execucao-progress-bar ${saude ? '' : (atrasada ? 'bg-red-500' : 'bg-blue-500')}`}
            style={{
              width: `${obra.progresso_geral || 0}%`,
              ...(saude ? { background: saude.saude === 'no_prazo' ? '#3b82f6' : (SAUDE[saude.saude]?.cor ?? COR_SEM_SAUDE) } : {})
            }}
          />
        </div>
      </div>

      {/* Conteúdo Expandido */}
      {expandida && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <PrevistoRealizado obra={obra} horasPorEtapa={horasPorEtapa} />
          {saude?.motivos?.length > 0 && (
            <ul className="visao-motivos" aria-label="Motivos da saúde da obra">
              {saude.motivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => onAdicionarEtapa(obra)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm"
            >
              <FaPlus size={10} aria-hidden="true" /> Adicionar Etapa
            </button>
          </div>

          <GanttObra
            obra={obra}
            onEditEtapa={handleEditarEtapa}
            onDeleteEtapa={onExcluirEtapa}
            onAddAtividade={onAdicionarAtividade}
            onAddSubEtapa={handleAdicionarSubEtapa}
            onReprogramar={podeReprogramar ? handleReprogramarEtapa : undefined}
            horasPorEtapa={horasPorEtapa}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(ObraCard);
