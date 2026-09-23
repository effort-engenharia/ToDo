import React, { useMemo } from 'react';
import { FaChartLine, FaUsers, FaMoneyBillWave } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { effortColors } from '../../../utils/effortTheme';

/**
 * KPISemana — Card de KPI comparando semana atual vs. semana anterior.
 * Suporta 3 métricas: 'vendas' (valor entrada), 'clientes' (contatos), 'ticket' (ticket médio).
 */
const KPISemana = ({ allData = [], semanaAtual, metric = 'vendas' }) => {
  const config = useMemo(() => {
    switch (metric) {
      case 'clientes':
        return {
          label: 'Clientes atendidos',
          icon: FaUsers,
          color: '#3B82F6',
          format: (n) => `${n}`,
        };
      case 'ticket':
        return {
          label: 'Ticket médio',
          icon: FaMoneyBillWave,
          color: '#8B5CF6',
          format: (n) => formatCurrency(n),
        };
      case 'vendas':
      default:
        return {
          label: 'Vendas (entrada)',
          icon: FaChartLine,
          color: effortColors.sucesso,
          format: (n) => formatCurrency(n),
        };
    }
  }, [metric]);

  const { atualValor, anteriorValor, diff, diffPct } = useMemo(() => {
    if (!semanaAtual || !Array.isArray(allData)) {
      return { atualValor: 0, anteriorValor: 0, diff: 0, diffPct: 0 };
    }

    // Janela da semana atual
    const inicioAtual = semanaAtual.de.getTime();
    const fimAtual = semanaAtual.ate.getTime();
    const duracaoMs = fimAtual - inicioAtual + 1;

    // Janela da semana anterior — mesmo tamanho, terminando imediatamente antes
    const fimAnterior = inicioAtual - 1;
    const inicioAnterior = fimAnterior - duracaoMs + 1;

    let atual = 0;
    let anterior = 0;
    let atualCount = 0;
    let anteriorCount = 0;
    const clientesAtual = new Set();
    const clientesAnterior = new Set();

    allData.forEach((item) => {
      if (!item?.created_at) return;
      const ts = new Date(item.created_at).getTime();
      if (isNaN(ts)) return;

      const isAtual = ts >= inicioAtual && ts <= fimAtual;
      const isAnterior = ts >= inicioAnterior && ts <= fimAnterior;
      if (!isAtual && !isAnterior) return;

      if (metric === 'clientes') {
        const key = item.nome_cliente || item.id;
        if (isAtual) clientesAtual.add(key);
        if (isAnterior) clientesAnterior.add(key);
        return;
      }

      // vendas ou ticket — só contrato/venda
      if (item.fase !== 'CONTRATO/VENDA') return;
      const valor = parseFloat(item.valor_entrada_servico) || 0;

      if (isAtual) {
        atual += valor;
        atualCount++;
      }
      if (isAnterior) {
        anterior += valor;
        anteriorCount++;
      }
    });

    if (metric === 'clientes') {
      atual = clientesAtual.size;
      anterior = clientesAnterior.size;
    }
    if (metric === 'ticket') {
      atual = atualCount > 0 ? atual / atualCount : 0;
      anterior = anteriorCount > 0 ? anterior / anteriorCount : 0;
    }

    const diffVal = atual - anterior;
    const pct = anterior > 0 ? (diffVal / anterior) * 100 : atual > 0 ? 100 : 0;

    return { atualValor: atual, anteriorValor: anterior, diff: diffVal, diffPct: pct };
  }, [allData, semanaAtual, metric]);

  const Icon = config.icon;
  const positivo = diff >= 0;
  const semDados = !semanaAtual || (atualValor === 0 && anteriorValor === 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${config.color}22`, color: config.color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        {!semDados && (
          <div
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              positivo ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {positivo ? '▲' : '▼'} {Math.abs(diffPct).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{config.label}</div>
      <div className="text-xl md:text-2xl font-bold text-gray-800 leading-tight break-words">
        {config.format(atualValor)}
      </div>
      <div className="text-[11px] text-gray-400 mt-1">
        Semana anterior: <span className="font-medium">{config.format(anteriorValor)}</span>
      </div>
    </div>
  );
};

export default KPISemana;
