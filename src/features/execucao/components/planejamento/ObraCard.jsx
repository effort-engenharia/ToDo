import React, { useCallback, useMemo } from 'react';
import {
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaFlag,
  FaPlus,
  FaTrash
} from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import { PRIORIDADE_COR, STATUS_OBRA_COR, STATUS_OBRA_LABEL } from './constants';
import GanttObra from './GanttObra';
import { IconeTipoObra } from './icones';
import { calcularDuracaoObra, getStatusReal, obraAtrasada } from './utils';

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
  onAdicionarSubEtapa
}) => {
  const atrasada = useMemo(() => obraAtrasada(obra), [obra]);
  const statusReal = getStatusReal(obra);

  const handleEditarEtapa = useCallback((etapa) => onEditarEtapa(obra, etapa), [onEditarEtapa, obra]);
  const handleAdicionarSubEtapa = useCallback((etapaPai) => onAdicionarSubEtapa(obra, etapaPai), [onAdicionarSubEtapa, obra]);

  return (
    <div className="execucao-card">
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
              {atrasada && (
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
            className={`execucao-progress-bar ${atrasada ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${obra.progresso_geral || 0}%` }}
          />
        </div>
      </div>

      {/* Conteúdo Expandido */}
      {expandida && (
        <div className="mt-4 pt-4 border-t border-slate-700">
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
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(ObraCard);
