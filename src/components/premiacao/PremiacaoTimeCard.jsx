import React from 'react';
import { FaTrophy, FaCheckCircle, FaTimesCircle, FaUsers } from 'react-icons/fa';
import { formatCurrency } from '../../utils/formatters';
import { effortColors } from '../../utils/effortTheme';
import { intervaloDoMesComercial, rotuloMesComercial } from '../../utils/periodoComercial';

const pct = (v, casas = 1) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`;

const CORES_NIVEL = {
  nenhum: '#9CA3AF',
  base: effortColors.laranja,
  ideal: effortColors.sucesso,
  ideal_plus: effortColors.info,
};

const Kpi = ({ label, valor, destaque, cor }) => (
  <div className={`rounded-lg p-3 border ${destaque ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
    <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
    <div className="text-base font-bold mt-0.5" style={cor ? { color: cor } : undefined}>
      {valor}
    </div>
  </div>
);

/** Premiação coletiva do time: nível atingido, prêmio liberado e rateio entre elegíveis. */
const PremiacaoTimeCard = ({ premiacao, ano, mes }) => {
  if (!premiacao?.ativo || !premiacao.resultado) return null;
  const { resultado: r, admin, podeVer, config } = premiacao;
  const pctColetivo = Math.round((Number(config?.distribuicao?.coletivo) || 0) * 100);

  const periodo = Number.isInteger(ano) && Number.isInteger(mes) ? rotuloMesComercial(ano, mes) : '';
  const emAndamento = Number.isInteger(ano) && Number.isInteger(mes)
    ? intervaloDoMesComercial(ano, mes).ate.getTime() >= Date.now()
    : false;

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${effortColors.amareloEffort}22`, color: effortColors.amareloEscuro }}
        >
          <FaTrophy className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">Premiação do time</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{periodo}</div>
        </div>
      </div>
      {emAndamento && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold uppercase">
          Prévia — mês em andamento
        </span>
      )}
    </div>
  );

  if (!r.configurado) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        {cabecalho}
        <p className="text-sm text-gray-500">
          Metas de premiação não configuradas para este mês.
          {admin && ' Defina Meta Base, Meta Ideal e Meta Ideal Plus em Administrador › Premiação.'}
        </p>
      </div>
    );
  }

  const { nivel } = r;
  const escala = Math.max(r.metas.plus * 1.1, r.resultadoColetivo * 1.05) || 1;
  const posicao = (v) => `${Math.min(100, (v / escala) * 100)}%`;
  const corNivel = CORES_NIVEL[nivel.id] || CORES_NIVEL.nenhum;
  const linhasVisiveis = r.linhas.filter((l) => podeVer(l.nome));

  const marcadores = [
    { label: 'Base', valor: nivel.limiares.gatilhoBase },
    { label: 'Ideal', valor: nivel.limiares.ideal },
    { label: 'Plus', valor: nivel.limiares.plus },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      {cabecalho}

      {/* Barra do resultado coletivo */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>
            Resultado coletivo (entradas líquidas dos efetivos):{' '}
            <strong className="text-gray-900">{formatCurrency(r.resultadoColetivo)}</strong>
          </span>
          <span className="font-semibold" style={{ color: corNivel }}>{nivel.label}</span>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: posicao(r.resultadoColetivo), background: corNivel }}
          />
          {marcadores.map((m) => (
            <div key={m.label} className="absolute top-[-3px] h-[18px] w-0.5 bg-gray-700" style={{ left: posicao(m.valor) }} />
          ))}
        </div>
        <div className="relative h-8 text-[10px] text-gray-500">
          {marcadores.map((m) => (
            <div key={m.label} className="absolute -translate-x-1/2 text-center mt-1" style={{ left: posicao(m.valor) }}>
              <div className="font-semibold text-gray-700">{m.label}</div>
              <div>{formatCurrency(m.valor)}</div>
            </div>
          ))}
        </div>
        {nivel.proximo && (
          <p className="text-xs text-gray-600 mt-2">
            Faltam <strong>{formatCurrency(nivel.proximo.falta)}</strong> para {nivel.proximo.label}
            {nivel.proximo.premio > nivel.premio && (
              <> — prêmio sobe para <strong>{formatCurrency(nivel.proximo.premio)}</strong></>
            )}
            .
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        <Kpi label="Meta individual" valor={formatCurrency(r.metaIndividual)} />
        <Kpi label="Nível atingido" valor={nivel.label} cor={corNivel} />
        <Kpi label="Prêmio liberado" valor={formatCurrency(r.premioLiberado)} destaque />
        <Kpi label={`Coletivo (${pctColetivo}%)`} valor={formatCurrency(r.poolColetivo)} />
        <Kpi label={`Performance (${100 - pctColetivo}%)`} valor={formatCurrency(r.poolPerformance)} />
        <Kpi label="Elegíveis" valor={`${r.qtdElegiveis} de ${r.qtdEfetivos}`} />
      </div>

      {r.premioLiberado > 0 && r.qtdElegiveis === 0 && (
        <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3">
          Nenhum vendedor atingiu a meta individual — o prêmio liberado não é distribuído.
        </p>
      )}

      {/* Tabela por vendedor */}
      {linhasVisiveis.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2">Vendedor</th>
                <th className="py-2 px-2 text-right">Entrada líquida</th>
                <th className="py-2 px-2 text-right">% meta</th>
                <th className="py-2 px-2 text-center">Elegível</th>
                <th className="py-2 px-2 text-right">Bruto fechado</th>
                <th className="py-2 px-2 text-right">Participação</th>
                <th className="py-2 px-2 text-right">Parcela coletiva</th>
                <th className="py-2 px-2 text-right">Parcela performance</th>
                <th className="py-2 pl-2 text-right">Prêmio final</th>
              </tr>
            </thead>
            <tbody>
              {linhasVisiveis.map((l) => (
                <tr key={l.nome} className="border-b border-gray-50">
                  <td className="py-2 pr-2 font-semibold text-gray-800">{l.nome}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(l.entrada)}</td>
                  <td
                    className="py-2 px-2 text-right font-semibold"
                    style={{ color: l.atingimento >= 100 ? effortColors.sucesso : effortColors.perigo }}
                  >
                    {pct(l.atingimento)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {l.elegivel ? (
                      <FaCheckCircle className="inline text-emerald-500" title="Elegível" />
                    ) : (
                      <FaTimesCircle
                        className="inline text-gray-300"
                        title={`Faltam ${formatCurrency(l.faltaParaMeta)} para a meta individual`}
                      />
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">{formatCurrency(l.bruto)}</td>
                  <td className="py-2 px-2 text-right">{l.elegivel ? pct(l.participacao * 100) : '—'}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(l.parcelaColetiva)}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(l.parcelaPerformance)}</td>
                  <td className="py-2 pl-2 text-right font-bold text-gray-900">{formatCurrency(l.premioFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-start gap-1">
        <FaUsers className="mt-0.5 shrink-0" />
        <span>
          Meta individual = Meta Ideal {formatCurrency(r.metas.ideal)} ÷ {r.qtdEfetivos} vendedor(es) efetivo(s).
          Elegível quando a entrada líquida ≥ meta individual. Prêmio: {pctColetivo}% dividido igualmente entre os elegíveis
          + {100 - pctColetivo}% proporcional ao valor bruto fechado de cada elegível. PJ e líder não participam.
        </span>
      </div>
    </div>
  );
};

export default PremiacaoTimeCard;
