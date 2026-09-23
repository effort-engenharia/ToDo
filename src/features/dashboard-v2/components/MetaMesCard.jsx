import React, { useMemo, useState, useEffect } from 'react';
import { FaBullseye, FaCalendarDay, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { effortColors, medalhaPara } from '../../../utils/effortTheme';
import { diasUteisRestantesNoMes } from '../../../utils/semanasComercial';
import { intervaloDoMesComercial } from '../../../utils/periodoComercial';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * MetaMesCard — Progresso agregado do time em relação à meta mensal.
 * Mostra: barra circular/linear, quanto falta, dias úteis restantes, ritmo/dia sugerido.
 * Admin pode editar o valor da meta inline.
 */
const MetaMesCard = ({ dashboardData, metaPersonalizada, onMetaChange, ano, mes, allData }) => {
  const { isAdmin } = useAuth();
  const [editando, setEditando] = useState(false);
  const [tempMeta, setTempMeta] = useState(metaPersonalizada);

  useEffect(() => {
    setTempMeta(metaPersonalizada);
  }, [metaPersonalizada]);

  const podeEditar = typeof onMetaChange === 'function' && (typeof isAdmin === 'function' ? isAdmin() : !!isAdmin);

  const salvar = () => {
    const novo = parseFloat(tempMeta);
    if (!isNaN(novo) && novo > 0) {
      onMetaChange(novo);
      setEditando(false);
    }
  };

  const cancelar = () => {
    setTempMeta(metaPersonalizada);
    setEditando(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') salvar();
    else if (e.key === 'Escape') cancelar();
  };
  const { atingido, faltam, percentual, diasUteis, ritmoDiaSugerido } = useMemo(() => {
    // Fonte da verdade: total de valor_entrada_servico no mês comercial vigente
    const { de, ate } = intervaloDoMesComercial(ano, mes);
    const deMs = de.getTime();
    const ateMs = ate.getTime();

    let totalEntrada = 0;
    if (Array.isArray(allData)) {
      allData.forEach((item) => {
        if (item?.fase !== 'CONTRATO/VENDA') return;
        if (!item?.created_at) return;
        const ts = new Date(item.created_at).getTime();
        if (isNaN(ts)) return;
        if (ts < deMs || ts > ateMs) return;
        totalEntrada += parseFloat(item.valor_entrada_servico) || 0;
      });
    }

    // Fallback caso allData esteja vazio: usa receitas do dashboardData
    if (totalEntrada === 0 && dashboardData?.receitas?.valorEntrada) {
      totalEntrada = dashboardData.receitas.valorEntrada;
    }

    const meta = Number(metaPersonalizada) || 0;
    const pct = meta > 0 ? (totalEntrada / meta) * 100 : 0;
    const restante = Math.max(0, meta - totalEntrada);
    const uteis = diasUteisRestantesNoMes(ano, mes);
    const ritmo = uteis > 0 ? restante / uteis : restante;

    return {
      atingido: totalEntrada,
      faltam: restante,
      percentual: pct,
      diasUteis: uteis,
      ritmoDiaSugerido: ritmo,
    };
  }, [allData, dashboardData, metaPersonalizada, ano, mes]);

  const medalha = medalhaPara(percentual);
  const barCor =
    percentual >= 100
      ? effortColors.sucesso
      : percentual >= 75
      ? effortColors.amareloEffort
      : percentual >= 50
      ? effortColors.laranja
      : effortColors.perigo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.amareloEffort}22`, color: effortColors.amareloEscuro }}
          >
            <FaBullseye className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Meta do mês</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Time · valor entrada
            </div>
          </div>
        </div>
        {medalha && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white shadow"
            style={{ background: medalha.fundo }}
            title={`Medalha ${medalha.nome}`}
          >
            <span className="text-base leading-none">{medalha.icone}</span>
            {medalha.nome}
          </div>
        )}
      </div>

      {/* Valores */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Realizado</div>
          <div className="text-2xl md:text-3xl font-black text-gray-800 leading-tight">
            {formatCurrency(atingido)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1 justify-end">
            Meta
            {podeEditar && !editando && (
              <button
                onClick={() => setEditando(true)}
                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="Editar meta (Admin)"
              >
                <FaEdit className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          {editando ? (
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <input
                type="number"
                min="0"
                step="1000"
                value={tempMeta}
                onChange={(e) => setTempMeta(e.target.value)}
                onKeyDown={handleKey}
                autoFocus
                className="w-28 px-2 py-1 text-sm text-right font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Meta em R$"
              />
              <button
                onClick={salvar}
                className="p-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white"
                title="Salvar"
              >
                <FaCheck className="w-3 h-3" />
              </button>
              <button
                onClick={cancelar}
                className="p-1 rounded bg-red-500 hover:bg-red-600 text-white"
                title="Cancelar"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-600">
              {formatCurrency(metaPersonalizada || 0)}
            </div>
          )}
        </div>
      </div>

      {/* Barra */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold" style={{ color: barCor }}>
            {percentual.toFixed(1)}%
          </span>
          <span className="text-gray-500">
            faltam <strong>{formatCurrency(faltam)}</strong>
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, percentual)}%`,
              background: `linear-gradient(90deg, ${barCor}, ${barCor}dd)`,
            }}
          />
        </div>
        {percentual > 100 && (
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">
            🎉 Meta batida! Superávit de {(percentual - 100).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Rodapé: dias úteis + ritmo */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
        <div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase mb-0.5">
            <FaCalendarDay className="w-2.5 h-2.5" /> Dias úteis
          </div>
          <div className="text-base font-bold text-gray-800">{diasUteis}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Ritmo/dia sugerido</div>
          <div className="text-base font-bold text-gray-800">
            {formatCurrency(ritmoDiaSugerido)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaMesCard;
