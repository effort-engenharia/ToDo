import React, { useMemo } from 'react';
import { FaBolt, FaPlusCircle, FaChartLine, FaFire, FaExclamationTriangle } from 'react-icons/fa';
import { effortColors } from '../../../utils/effortTheme';

/**
 * AcoesRapidasPanel — Atalhos + alertas contextuais.
 * Detecta apontamentos "esquecidos" (fase != contrato/venda com mais de X dias sem atualização).
 */
const AcoesRapidasPanel = ({ setCurrentPage, allData = [] }) => {
  const alertas = useMemo(() => {
    if (!Array.isArray(allData)) return [];
    const agora = Date.now();
    const LIMITE_MS = 5 * 24 * 60 * 60 * 1000; // 5 dias

    return allData
      .filter((it) => {
        if (!it?.fase) return false;
        if (it.fase === 'CONTRATO/VENDA' || it.fase === 'PERDIDO') return false;
        const ts = it.updated_at || it.created_at;
        if (!ts) return false;
        const idadeMs = agora - new Date(ts).getTime();
        return idadeMs > LIMITE_MS;
      })
      .slice(0, 3);
  }, [allData]);

  const acoes = [
    {
      label: 'Novo apontamento',
      icon: FaPlusCircle,
      cor: effortColors.sucesso,
      onClick: () => setCurrentPage?.('apontamentos'),
    },
    {
      label: 'Arsenal de Guerra',
      icon: FaFire,
      cor: effortColors.perigo,
      onClick: () => setCurrentPage?.('arsenal'),
    },
    {
      label: 'Ver dashboard clássico',
      icon: FaChartLine,
      cor: effortColors.info,
      onClick: () => {
        window.dispatchEvent(new CustomEvent('effort:open-admin'));
      },
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${effortColors.amareloEffort}22`, color: effortColors.amareloEscuro }}
        >
          <FaBolt className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">Ações rápidas</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Atalhos</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {acoes.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${a.cor}22`, color: a.cor }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 text-left">{a.label}</span>
              <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
            </button>
          );
        })}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <FaExclamationTriangle className="w-3 h-3 text-red-500" />
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
              {alertas.length} apontamento{alertas.length !== 1 ? 's' : ''} esquecido{alertas.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1">
            {alertas.map((a, idx) => (
              <li key={idx} className="text-[11px] text-gray-600 truncate">
                • <strong>{a.nome_cliente || 'Cliente s/ nome'}</strong> — {a.fase}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AcoesRapidasPanel;
