import React, { useMemo } from 'react';
import { FaChartBar } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { semanaCores, effortColors } from '../../../utils/effortTheme';
import { agruparVendasPorSemana } from '../../../utils/semanasComercial';

/**
 * VendasPorSemana — Barras coloridas por semana do mês comercial.
 * Cada semana tem a cor semântica (verde → vermelho).
 */
const VendasPorSemana = ({ allData = [], ano, mes, semanas = [] }) => {
  const buckets = useMemo(() => {
    const vendas = (allData || [])
      .filter((it) => it.fase === 'CONTRATO/VENDA' && it.created_at)
      .map((it) => ({
        data: new Date(it.created_at),
        valor: parseFloat(it.valor_entrada_servico) || 0,
      }));
    return agruparVendasPorSemana(vendas, ano, mes);
  }, [allData, ano, mes]);

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));

  const totalMes = buckets.reduce((s, b) => s + b.total, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.info}22`, color: effortColors.info }}
          >
            <FaChartBar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Vendas por semana</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Valor de entrada
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 uppercase">Total do mês</div>
          <div className="text-sm font-bold text-gray-800">{formatCurrency(totalMes)}</div>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-10">
          Nenhuma venda registrada neste mês.
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-2 md:gap-3 min-h-[180px] pb-2">
          {buckets.map((b) => {
            const cor = semanaCores[b.semana.corIndex];
            const altura = (b.total / maxTotal) * 100;
            return (
              <div key={b.semana.numero} className="flex-1 flex flex-col items-center gap-1.5">
                {/* Valor */}
                <div className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                  {b.total > 0 ? formatCurrency(b.total) : '—'}
                </div>
                {/* Barra */}
                <div className="w-full flex-1 flex items-end min-h-[140px]">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-90 relative group"
                    style={{
                      height: `${Math.max(altura, b.total > 0 ? 4 : 0)}%`,
                      background: `linear-gradient(180deg, ${cor.cor} 0%, ${cor.corEscura} 100%)`,
                    }}
                  >
                    {b.count > 0 && (
                      <div
                        className="absolute top-1 left-1/2 -translate-x-1/2 bg-white/95 text-[10px] font-bold px-1.5 py-0.5 rounded shadow"
                        style={{ color: cor.corEscura }}
                      >
                        {b.count}
                      </div>
                    )}
                  </div>
                </div>
                {/* Rótulo */}
                <div className="text-center">
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: cor.corEscura }}
                  >
                    Sem {b.semana.numero}
                  </div>
                  <div className="text-[9px] text-gray-400">
                    {b.semana.de.getDate()}–{b.semana.ate.getDate()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendasPorSemana;
