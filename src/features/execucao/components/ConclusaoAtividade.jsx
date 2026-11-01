import React from 'react';
import { FaCheckCircle, FaClock, FaCommentDots, FaMapMarkerAlt } from 'react-icons/fa';
import { formatarDataHora } from '../utils/formatos';
import { linkMapa } from '../utils/conclusao';

// Dados da conclusão feita pelo técnico (migration 20261101_20): observação, horário e localização do clique.
// Conclusões antigas não têm esses campos e o bloco simplesmente não aparece.

const GEO_ROTULO = {
  negada: 'Localização bloqueada pelo técnico (negada)',
  indisponivel: 'Localização indisponível no aparelho',
  tempo_esgotado: 'Localização não obtida (tempo esgotado)',
  nao_suportado: 'Aparelho sem suporte a localização'
};

const ConclusaoAtividade = ({ atividade }) => {
  if (atividade?.status !== 'concluida') return null;
  const {
    observacao_conclusao: observacao,
    conclusao_geo_status: geoStatus,
    conclusao_origem_horario: origemHorario,
    conclusao_latitude: latitude,
    conclusao_longitude: longitude,
    conclusao_precisao_m: precisao,
    fim_real_em: fimReal,
    conclusao_registrada_em: registradaEm
  } = atividade;
  if (!observacao && !geoStatus && !origemHorario) return null;

  const instante = fimReal || registradaEm;
  const temPosicao = geoStatus === 'ok' && latitude != null && longitude != null;

  return (
    <section className="bg-slate-800/30 p-3 rounded-lg space-y-2" aria-label="Dados da conclusão">
      <span className="text-xs text-slate-400 uppercase flex items-center gap-1">
        <FaCheckCircle size={10} aria-hidden="true" /> Conclusão pelo técnico
      </span>

      {observacao && (
        <div>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <FaCommentDots size={10} aria-hidden="true" /> Observação
          </span>
          <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{observacao}</p>
        </div>
      )}

      {instante && (
        <p className="text-sm text-slate-200 flex flex-wrap items-center gap-2">
          <FaClock size={11} className="text-slate-400" aria-hidden="true" />
          <span>Concluída em <time dateTime={new Date(instante).toISOString()}>{formatarDataHora(instante, { comAno: true })}</time></span>
          {origemHorario === 'dispositivo' && (
            <span
              className="text-xs text-amber-200 bg-amber-300/10 border border-amber-300/40 rounded px-1.5 py-0.5"
              title="A conclusão foi feita sem conexão; vale o horário do relógio do aparelho"
            >
              horário do aparelho (offline)
            </span>
          )}
        </p>
      )}

      {(geoStatus || temPosicao) && (
        <p className="text-sm text-slate-200 flex flex-wrap items-center gap-2">
          <FaMapMarkerAlt size={11} className="text-slate-400" aria-hidden="true" />
          {temPosicao ? (
            <>
              <a
                className="text-sky-400 underline"
                href={linkMapa(latitude, longitude)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no mapa
              </a>
              <span className="text-xs text-slate-400">
                {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
                {precisao != null ? ` · precisão ±${Math.round(Number(precisao))} m` : ''}
              </span>
            </>
          ) : (
            <span className="text-slate-300">{GEO_ROTULO[geoStatus] ?? 'Localização não registrada'}</span>
          )}
        </p>
      )}
    </section>
  );
};

export default ConclusaoAtividade;
