import React, { useMemo } from 'react';
import { FaTrophy, FaCrown } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { effortColors, medalhaPara } from '../../../utils/effortTheme';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * LeaderboardCard — Ranking gamificado dos vendedores no mês.
 * Todos veem todos. Meta individual = meta do time / número de vendedores ativos.
 */
const LeaderboardCard = ({ dashboardData, metaPersonalizada }) => {
  const { usuario } = useAuth();
  const nomeUsuario = usuario?.nome_vendedor_comercial;

  const ranking = useMemo(() => {
    const vendedores = dashboardData?.vendedores || [];
    if (!vendedores.length) return [];

    // Meta é do TIME e cada vendedor contribui um pedaço
    const metaTime = Number(metaPersonalizada) || 0;
    // Fatia justa = 100% dividido pelo nº de vendedores (referência visual)
    const fatiaJusta = 100 / vendedores.length;

    return [...vendedores]
      .map((v) => ({
        vendedor: v.vendedor,
        vendas: v.vendas || 0,
        valorEntrada: Number(v.valorEntrada) || 0,
        valorTotal: Number(v.valor) || 0,
      }))
      .sort((a, b) => b.valorEntrada - a.valorEntrada)
      .map((v, idx) => {
        const pct = metaTime > 0 ? (v.valorEntrada / metaTime) * 100 : 0;
        return {
          nome: v.vendedor,
          vendas: v.vendas,
          valorEntrada: v.valorEntrada,
          valorTotal: v.valorTotal,
          percentual: pct,
          fatiaJusta,
          posicao: idx + 1,
          medalha: medalhaPara(pct),
        };
      });
  }, [dashboardData, metaPersonalizada]);

  const medalhasPodio = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.amareloEffort}22`, color: effortColors.amareloEscuro }}
          >
            <FaTrophy className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Ranking do time</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              % contribuição para a meta de entrada do time
            </div>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">
          {ranking.length} vendedor{ranking.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {ranking.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-8">
          Sem vendas registradas ainda neste mês.
        </div>
      ) : (
        <ul className="space-y-2 overflow-y-auto max-h-[320px] pr-1">
          {ranking.map((v) => {
            const isSelf = nomeUsuario && v.nome === nomeUsuario;
            const podio = v.posicao <= 3;
            return (
              <li
                key={v.nome}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  isSelf ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Posição */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    podio ? '' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                  style={
                    podio
                      ? {
                          background:
                            v.posicao === 1
                              ? 'linear-gradient(135deg, #FCD34D, #D97706)'
                              : v.posicao === 2
                              ? 'linear-gradient(135deg, #E5E7EB, #6B7280)'
                              : 'linear-gradient(135deg, #CD7F32, #7C3A05)',
                          color: '#fff',
                        }
                      : {}
                  }
                >
                  {podio ? medalhasPodio[v.posicao - 1] : v.posicao}
                </div>

                {/* Nome + entrada */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold truncate ${isSelf ? 'text-yellow-700' : 'text-gray-800'}`}>
                      {v.nome}
                    </span>
                    {isSelf && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500 text-white font-bold uppercase">
                        Você
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <span>
                      Entrada:{' '}
                      <strong className="text-gray-700">{formatCurrency(v.valorEntrada)}</strong>
                    </span>
                    <span className="text-gray-300">·</span>
                    <span>
                      {v.vendas} venda{v.vendas !== 1 ? 's' : ''}
                    </span>
                    {v.valorTotal > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span title="Valor total dos contratos">
                          Total {formatCurrency(v.valorTotal)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Percentual + medalha */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-bold ${
                      v.percentual >= v.fatiaJusta
                        ? 'text-emerald-600'
                        : v.percentual >= v.fatiaJusta * 0.6
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                    }`}
                    title={`Fatia justa por vendedor: ${v.fatiaJusta.toFixed(0)}%`}
                  >
                    {v.percentual.toFixed(0)}%
                  </div>
                  {v.medalha && (
                    <div className="text-lg leading-none" title={v.medalha.nome}>
                      {v.medalha.icone}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LeaderboardCard;
