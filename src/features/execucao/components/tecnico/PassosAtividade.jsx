import React from 'react';
import { FaCheckCircle, FaListUl, FaRegCircle } from 'react-icons/fa';
import { formatarHoras } from '../../utils/formatos';

// Sub-etapas da etapa da atividade, mostradas como passos (ex.: "Entrada no condomínio · 20min").
// Vêm do `contexto` da atividade (RPC execucao_contexto_atividades).
const PassosAtividade = ({ atividade, compacto = false }) => {
  // Status real de cada passo (sub-etapa): concluir a atividade não marca os passos, quem marca é o técnico (N1-g)
  const passos = atividade?.contexto?.sub_etapas?.filter?.((p) => p?.status !== 'cancelada');
  if (!Array.isArray(passos) || passos.length === 0) return null;

  return (
    <div className={`tec-passos ${compacto ? 'tec-passos-compacto' : ''}`}>
      <div className="tec-passos-titulo">
        <FaListUl aria-hidden="true" /> Passos ({passos.filter((p) => p.status === 'concluida').length}/{passos.length})
      </div>
      <ol className="tec-passos-lista">
        {passos.map((p, i) => {
          const feito = p.status === 'concluida';
          return (
            <li key={p.id || `${p.nome}-${i}`} className={feito ? 'tec-passo-feito' : undefined}>
              {feito
                ? <FaCheckCircle className="text-green-400" aria-label="Concluído" />
                : <FaRegCircle aria-hidden="true" />}
              <span className="tec-passo-nome">{p.nome}</span>
              {Number(p.horas) > 0 && <span className="tec-passo-horas">{formatarHoras(p.horas)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PassosAtividade;
