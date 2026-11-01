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
import { CONSULTA_MOBILE, useMediaQuery } from '../../hooks/useMediaQuery';
import { PRIORIDADE_COR, STATUS_OBRA_COR, STATUS_OBRA_LABEL } from './constants';
import GanttObra from './GanttObra';
import { IconeTipoObra } from './icones';
import ListaEtapasMobile from './ListaEtapasMobile';
import { calcularDuracaoObra, getStatusReal, obraAtrasada } from './utils';
import PrevistoRealizado from './visao/PrevistoRealizado';
import { useHorasDasEtapas } from './visao/datasPrevistoRealizado';
import { COR_SEM_SAUDE, SAUDE } from './visao/saude';
import SeloSaude from './visao/SeloSaude';

const BOTAO_ACAO_CARD = 'plan-toque execucao-btn execucao-btn-sm gap-1.5';

// Mobile: lista de cartões; a partir de 640px: Gantt (nunca os dois ao mesmo tempo)
const CronogramaEtapas = ({ obra, onAdicionarEtapa, ...resto }) => {
  const mobile = useMediaQuery(CONSULTA_MOBILE);
  return mobile
    ? <ListaEtapasMobile obra={obra} onAdicionarEtapa={onAdicionarEtapa} {...resto} />
    : <GanttObra obra={obra} onAdicionarEtapa={onAdicionarEtapa} {...resto} />;
};

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
  passosPorEtapa,
  saude
}) => {
  const atrasada = useMemo(() => obraAtrasada(obra), [obra]);
  const statusReal = getStatusReal(obra);
  const horasPorEtapa = useHorasDasEtapas(obra.etapas, expandida);
  const podeReprogramar = Boolean(onReprogramar) && obra.etapas?.length > 0 && statusReal !== 'concluida' && obra.status !== 'cancelada';
  const idDetalhe = `obra-${obra.id}-detalhe`;
  const progresso = obra.progresso_geral || 0;

  const handleEditarEtapa = useCallback((etapa) => onEditarEtapa(obra, etapa), [onEditarEtapa, obra]);
  const handleReprogramarEtapa = useCallback((etapa) => onReprogramar?.(obra, etapa), [onReprogramar, obra]);
  const handleAdicionarSubEtapa = useCallback((etapaPai) => onAdicionarSubEtapa(obra, etapaPai), [onAdicionarSubEtapa, obra]);

  return (
    <div className="execucao-card !p-4 sm:!p-5 lg:!p-6" id={`obra-${obra.id}`}>
      {/* Header da Obra: 5 linhas no mobile, 2 no tablet, 1 no desktop */}
      <div
        className="flex flex-col gap-3 cursor-pointer lg:flex-row lg:items-start lg:justify-between"
        onClick={() => onToggle(obra.id)}
      >
        <div className="flex min-w-0 items-start gap-3 lg:flex-1 lg:gap-4">
          <div className="p-3 rounded-lg bg-slate-800 shrink-0">
            <IconeTipoObra tipo={obra.tipo_obra} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base sm:text-lg text-white plan-quebra">
                <button
                  type="button"
                  className="text-left"
                  aria-expanded={expandida}
                  aria-controls={idDetalhe}
                  aria-label={expandida ? `Recolher etapas de ${obra.nome_cliente}` : `Expandir etapas de ${obra.nome_cliente}`}
                  onClick={(e) => { e.stopPropagation(); onToggle(obra.id); }}
                >
                  {obra.nome_cliente}
                </button>
              </h3>
              <FaFlag className={PRIORIDADE_COR[obra.prioridade] ?? 'text-gray-400'} size={12} aria-label={`Prioridade ${obra.prioridade}`} role="img" />
              <span className={`execucao-badge execucao-badge-${STATUS_OBRA_COR[statusReal] ?? 'gray'}`}>
                {STATUS_OBRA_LABEL[statusReal] ?? statusReal}
              </span>
              {saude ? (
                <SeloSaude saude={saude} />
              ) : atrasada && (
                <span className="execucao-badge execucao-badge-red animate-pulse motion-reduce:animate-none">
                  Atrasada
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 mt-1">
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
          <span className="shrink-0 self-center text-slate-300 lg:hidden" aria-hidden="true">
            {expandida ? <FaChevronUp /> : <FaChevronDown />}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-4">
          {/* Progresso (no mobile fica ao lado da barra) */}
          <div className="hidden sm:block text-right">
            <div className="text-2xl font-bold text-slate-100">{progresso}%</div>
            <div className="text-xs text-slate-400">Progresso</div>
          </div>

          {/* Ações: 3 colunas com rótulo no mobile; só ícones a partir de 640px */}
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2 sm:flex sm:items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {podeReprogramar && (
              <button
                type="button"
                onClick={() => onReprogramar(obra, null)}
                className={`${BOTAO_ACAO_CARD} execucao-btn-secondary`}
                title="Reprogramar: empurrar etapas seguintes em dias úteis (com prévia)"
                aria-label={`Reprogramar etapas de ${obra.nome_cliente}`}
              >
                <FaForward size={12} aria-hidden="true" /><span className="sm:hidden">Reprogramar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onEditar(obra)}
              className={`${BOTAO_ACAO_CARD} execucao-btn-secondary`}
              title="Editar obra"
              aria-label={`Editar obra ${obra.nome_cliente}`}
            >
              <FaEdit size={12} aria-hidden="true" /><span className="sm:hidden">Editar</span>
            </button>
            <button
              type="button"
              onClick={() => onExcluir(obra.id)}
              className={`${BOTAO_ACAO_CARD} execucao-btn-danger`}
              title="Excluir obra"
              aria-label={`Excluir obra ${obra.nome_cliente}`}
            >
              <FaTrash size={12} aria-hidden="true" /><span className="sm:hidden">Excluir</span>
            </button>
            <span className="hidden lg:inline-flex shrink-0 text-slate-300 px-1" aria-hidden="true">
              {expandida ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="execucao-progress flex-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progresso}
          aria-label={`Progresso geral de ${obra.nome_cliente}`}
        >
          <div
            className={`execucao-progress-bar ${saude ? '' : (atrasada ? 'bg-red-500' : 'bg-blue-500')}`}
            style={{
              width: `${progresso}%`,
              ...(saude ? { background: saude.saude === 'no_prazo' ? '#3b82f6' : (SAUDE[saude.saude]?.cor ?? COR_SEM_SAUDE) } : {})
            }}
          />
        </div>
        <span className="sm:hidden shrink-0 text-sm font-bold text-slate-100">{progresso}%</span>
      </div>

      {/* Conteúdo Expandido */}
      {expandida && (
        <div id={idDetalhe} className="mt-4 pt-4 border-t border-slate-700">
          <PrevistoRealizado obra={obra} horasPorEtapa={horasPorEtapa} />
          {saude?.motivos?.length > 0 && (
            <ul className="visao-motivos" aria-label="Motivos da saúde da obra">
              {saude.motivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          <div className="flex mb-4 sm:justify-end">
            <button
              type="button"
              onClick={() => onAdicionarEtapa(obra)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm plan-toque w-full sm:w-auto"
            >
              <FaPlus size={10} aria-hidden="true" /> Adicionar Etapa
            </button>
          </div>

          <CronogramaEtapas
            obra={obra}
            onAdicionarEtapa={onAdicionarEtapa}
            onEditEtapa={handleEditarEtapa}
            onDeleteEtapa={onExcluirEtapa}
            onAddAtividade={onAdicionarAtividade}
            onAddSubEtapa={handleAdicionarSubEtapa}
            onReprogramar={podeReprogramar ? handleReprogramarEtapa : undefined}
            horasPorEtapa={horasPorEtapa}
            passosPorEtapa={passosPorEtapa}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(ObraCard);
