import React, { useMemo } from 'react';
import { FaFilter } from 'react-icons/fa';
import { effortColors } from '../../../utils/effortTheme';

/**
 * FunilCompact — Funil vertical compacto com etapas + taxa de conversão.
 * Etapas: Contato → Negociação → Contrato/Venda
 */
const FunilCompact = ({ dashboardData, totalClientesAtendidos }) => {
  const etapas = useMemo(() => {
    const funil = dashboardData?.funil || {};
    const contatos = totalClientesAtendidos || 0;
    const negociacao = funil.negociacao || 0;
    const contratos = funil.contratoVenda || 0;

    return [
      {
        label: 'Clientes atendidos',
        valor: contatos,
        cor: effortColors.info,
        corClara: '#DBEAFE',
      },
      {
        label: 'Em negociação',
        valor: negociacao,
        cor: effortColors.amareloEffort,
        corClara: '#FEF3C7',
      },
      {
        label: 'Contratos fechados',
        valor: contratos,
        cor: effortColors.sucesso,
        corClara: '#D1FAE5',
      },
    ];
  }, [dashboardData, totalClientesAtendidos]);

  const maxValor = Math.max(1, ...etapas.map((e) => e.valor));
  const taxaConversao = etapas[0].valor > 0 ? (etapas[2].valor / etapas[0].valor) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.info}22`, color: effortColors.info }}
          >
            <FaFilter className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Funil comercial</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mês vigente</div>
          </div>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {etapas.map((e, idx) => {
          const largura = (e.valor / maxValor) * 100;
          const previa = idx > 0 ? etapas[idx - 1].valor : e.valor;
          const conversao = previa > 0 ? (e.valor / previa) * 100 : 0;
          return (
            <div key={e.label}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs font-medium text-gray-700">{e.label}</span>
                <span className="text-sm font-bold" style={{ color: e.cor }}>
                  {e.valor}
                </span>
              </div>
              <div className="w-full h-6 bg-gray-100 rounded relative overflow-hidden">
                <div
                  className="h-full rounded transition-all flex items-center px-2 text-white text-[10px] font-bold"
                  style={{
                    width: `${Math.max(largura, e.valor > 0 ? 8 : 0)}%`,
                    background: `linear-gradient(90deg, ${e.cor}, ${e.cor}dd)`,
                  }}
                >
                  {e.valor > 0 && largura > 15 && `${conversao.toFixed(0)}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Taxa geral */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Taxa geral</span>
        <span
          className={`text-lg font-bold ${
            taxaConversao >= 20 ? 'text-emerald-600' : taxaConversao >= 10 ? 'text-yellow-600' : 'text-gray-600'
          }`}
        >
          {taxaConversao.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default FunilCompact;
