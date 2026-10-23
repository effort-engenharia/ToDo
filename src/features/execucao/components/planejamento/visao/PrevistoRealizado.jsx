import React, { useMemo } from 'react';
import { formatarHoras } from '../../../utils/formatos';
import { classeDesvio, linhaDatas, textoDesvio } from './datasPrevistoRealizado';

const Datas = ({ linha }) => (
  <span>
    <span className="text-slate-400">{linha.rotulo}:</span> previsto {linha.previsto}
    {linha.real ? (
      <>
        {' · '}real {linha.real}{' '}
        <span className={classeDesvio(linha.desvio)}>({textoDesvio(linha.desvio)})</span>
      </>
    ) : (
      <span className="text-slate-500"> · real —</span>
    )}
  </span>
);

// Previsto × realizado da obra: datas (início/fim) e horas (somente quando a obra está expandida)
const PrevistoRealizado = ({ obra, horasPorEtapa }) => {
  const horas = useMemo(() => {
    const etapas = obra.etapas ?? [];
    const principais = etapas.filter((e) => !e.etapa_pai_id);
    const previstasEtapas = principais.reduce((soma, e) => soma + (Number(e.horas_previstas) || 0), 0);
    const totais = Object.values(horasPorEtapa ?? {}).reduce(
      (acc, h) => ({ previstas: acc.previstas + h.previstas, realizadas: acc.realizadas + h.realizadas }),
      { previstas: 0, realizadas: 0 }
    );
    return { previstas: previstasEtapas || totais.previstas, realizadas: totais.realizadas };
  }, [obra.etapas, horasPorEtapa]);

  const inicio = linhaDatas('Início', obra.data_inicio_prevista, obra.data_inicio_real);
  const fim = linhaDatas('Término', obra.data_fim_prevista, obra.data_fim_real);

  return (
    <div className="visao-previsto-realizado" aria-label="Previsto e realizado">
      <Datas linha={inicio} />
      <Datas linha={fim} />
      {horas.previstas > 0 && (
        <span>
          <span className="text-slate-400">Horas:</span> previstas {formatarHoras(horas.previstas)}
          {' · '}realizadas {formatarHoras(horas.realizadas)}
          <span className="text-slate-500"> ({Math.round((horas.realizadas / horas.previstas) * 100)}%)</span>
        </span>
      )}
    </div>
  );
};

export default React.memo(PrevistoRealizado);
