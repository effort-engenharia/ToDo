import React, { useMemo } from 'react';
import { FaHandshake } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { effortColors } from '../../../utils/effortTheme';
import { intervaloDoMesComercial } from '../../../utils/periodoComercial';

/**
 * ClientesFechados — Últimos contratos fechados no mês comercial vigente.
 */
const ClientesFechados = ({ allData = [], ano, mes }) => {
  const fechados = useMemo(() => {
    if (!Array.isArray(allData)) return [];
    const { de, ate } = intervaloDoMesComercial(ano, mes);
    const deMs = de.getTime();
    const ateMs = ate.getTime();

    return allData
      .filter((it) => {
        if (it?.fase !== 'CONTRATO/VENDA') return false;
        if (!it.created_at) return false;
        const ts = new Date(it.created_at).getTime();
        return !isNaN(ts) && ts >= deMs && ts <= ateMs;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);
  }, [allData, ano, mes]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.sucesso}22`, color: effortColors.sucesso }}
          >
            <FaHandshake className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Fechados recentes</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Últimos contratos</div>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          {fechados.length}
        </span>
      </div>

      {fechados.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-8 text-center">
          Nenhum contrato fechado ainda neste mês.
        </div>
      ) : (
        <ul className="space-y-2 overflow-y-auto flex-1">
          {fechados.map((c, idx) => {
            const valor = parseFloat(c.valor_entrada_servico) || 0;
            const dataFmt = new Date(c.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            });
            return (
              <li
                key={c.id || idx}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
                  style={{ background: effortColors.sucesso, color: '#fff' }}
                >
                  {(c.nome_cliente || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {c.nome_cliente || 'Sem nome'}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {c.proprietario_relacionamento || 'sem vendedor'} · {dataFmt}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-emerald-600">
                    {formatCurrency(valor)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ClientesFechados;
