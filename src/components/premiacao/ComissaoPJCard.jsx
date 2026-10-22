import React from 'react';
import { FaHandshake } from 'react-icons/fa';
import { formatCurrency } from '../../utils/formatters';
import { effortColors } from '../../utils/effortTheme';
import { MODOS_COMISSAO_PJ } from '../../config/premiacao';

const CORES_FAIXA = [effortColors.laranja, effortColors.amareloEffort, effortColors.sucesso, effortColors.info];
const corFaixa = (i) => CORES_FAIXA[Math.min(Math.max(i, 0), CORES_FAIXA.length - 1)];
const pct = (v) => `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const BarraPJ = ({ pj }) => {
  const limites = pj.faixas.filter((f) => f.ate != null).map((f) => f.ate);
  const ultimoLimite = limites[limites.length - 1] || 1;
  const escala = Math.max(ultimoLimite * 1.2, pj.valor * 1.05);
  const pos = (v) => Math.min(100, (v / escala) * 100);

  return (
    <div>
      <div className="relative h-4 rounded-full overflow-hidden bg-gray-100 flex">
        {pj.faixas.map((f, i) => {
          const ini = i === 0 ? 0 : pj.faixas[i - 1].ate;
          const fim = f.ate == null ? escala : f.ate;
          return (
            <div
              key={i}
              className="h-full"
              style={{ width: `${pos(fim) - pos(ini)}%`, background: `${corFaixa(i)}33` }}
            />
          );
        })}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{
            width: `${pos(pj.valor)}%`,
            background: `linear-gradient(90deg, ${corFaixa(0)}, ${corFaixa(pj.faixaIndice)})`,
          }}
        />
        {limites.map((l) => (
          <div key={l} className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${pos(l)}%` }} />
        ))}
      </div>
      <div className="relative h-8 text-[10px] text-gray-500">
        {limites.map((l, i) => (
          <div key={l} className="absolute -translate-x-1/2 text-center mt-1" style={{ left: `${pos(l)}%` }}>
            <div className="font-semibold text-gray-700">{formatCurrency(l).replace(',00', '')}</div>
            <div>→ {pct(pj.faixas[i + 1]?.pct)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Seção de parceiros PJ: comissão por faixas de valor bruto vendido. */
const ComissaoPJCard = ({ premiacao }) => {
  if (!premiacao?.ativo || !premiacao.resultado) return null;
  const { resultado, podeVer, config } = premiacao;
  const pjs = resultado.pjs.filter((p) => podeVer(p.nome));
  if (pjs.length === 0) return null;

  const progressiva = config?.comissaoPJ?.modo === MODOS_COMISSAO_PJ.PROGRESSIVA;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${effortColors.info}22`, color: effortColors.info }}
        >
          <FaHandshake className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">Parceiros PJ — comissão por faixa</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Base: valor bruto dos contratos fechados no mês ·{' '}
            {progressiva ? 'progressiva (cada faixa sobre a sua parte)' : 'alíquota da faixa atingida sobre todo o valor'}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {pjs.map((pj) => (
          <div key={pj.nome} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-bold text-gray-800">{pj.nome}</div>
                <div className="text-[11px] text-gray-500">
                  {pj.contratos} contrato{pj.contratos !== 1 ? 's' : ''} · Bruto{' '}
                  <strong className="text-gray-700">{formatCurrency(pj.valor)}</strong>
                </div>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Faixa atual</div>
                  <div className="text-base font-bold" style={{ color: corFaixa(pj.faixaIndice) }}>
                    {pj.faixaIndice >= 0 ? `${pj.faixaIndice + 1}ª · ${pct(pj.pct)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Comissão</div>
                  <div className="text-base font-bold text-gray-900">{formatCurrency(pj.comissao)}</div>
                </div>
              </div>
            </div>

            <BarraPJ pj={pj} />

            <p className="text-xs text-gray-600 mt-1">
              {pj.proxima ? (
                <>
                  Faltam <strong>{formatCurrency(pj.proxima.falta)}</strong> para a comissão de{' '}
                  <strong>{pct(pj.proxima.pct)}</strong>.
                </>
              ) : (
                <span className="text-emerald-600 font-semibold">Faixa máxima atingida 🚀</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
        Faixas:{' '}
        {pjs[0].faixas
          .map((f) =>
            f.ate == null
              ? `a partir de ${formatCurrency(f.de)} → ${pct(f.pct)}`
              : `${formatCurrency(f.de)} a ${formatCurrency(f.ate)} → ${pct(f.pct)}`
          )
          .join(' · ')}
        . PJ não participa da premiação coletiva nem do pódio.
      </div>
    </div>
  );
};

export default ComissaoPJCard;
