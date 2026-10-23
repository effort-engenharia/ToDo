import React, { useMemo } from 'react';
import { FaCalendarPlus } from 'react-icons/fa';
import { TIPO_BADGE_COR } from './constants';
import { IconeTipoEtapa } from './icones';
import { etapaAtrasada, formatarDataCurta, inicioDeHoje } from './utils';

// Visão em tabela: etapas agrupadas visualmente por cliente (cores alternadas)
const ResumoVisaoTabela = ({ etapas, onAddAtividade }) => {
  const linhas = useMemo(() => {
    const hoje = inicioDeHoje();
    let corAlternada = false;
    let ultimoCliente = '';

    return etapas.map((etapa, index) => {
      if (etapa.cliente !== ultimoCliente) {
        corAlternada = !corAlternada;
        ultimoCliente = etapa.cliente;
      }
      return {
        etapa,
        corAlternada,
        atrasada: etapaAtrasada(etapa, hoje),
        isNovoCliente: index === 0 || etapas[index - 1].cliente !== etapa.cliente
      };
    });
  }, [etapas]);

  return (
    <div className="execucao-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-slate-800/70">
              <th className="sticky left-0 bg-slate-800 z-10 text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold border-r border-slate-700 min-w-[200px]">
                Cliente
              </th>
              <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                Equipe
              </th>
              <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[200px]">
                Etapa
              </th>
              <th className="text-left px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[130px]">
                Período
              </th>
              <th className="text-center px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[120px]">
                Progresso
              </th>
              <th className="text-center px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs text-slate-300 uppercase font-semibold min-w-[100px]">
                Ação
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ etapa, corAlternada, atrasada, isNovoCliente }) => {
              const bgColor = corAlternada ? 'bg-slate-800/30' : 'bg-slate-800/10';

              return (
                <tr
                  key={etapa.id}
                  className={`${bgColor} hover:bg-slate-700/40 border-b border-slate-700/30 ${atrasada ? '!bg-red-500/10' : ''}`}
                >
                  {/* Cliente - Fixo à esquerda */}
                  <td className={`sticky left-0 z-10 px-4 py-3 border-r border-slate-700 ${corAlternada ? 'bg-slate-800' : 'bg-slate-900'} ${atrasada ? '!bg-red-900/50' : ''}`}>
                    {isNovoCliente ? (
                      <div>
                        <div className="font-semibold text-white">{etapa.cliente}</div>
                        {etapa.cidade && (
                          <div className="text-xs text-slate-400">{etapa.cidade}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-sm italic">↳ mesmo cliente</div>
                    )}
                  </td>

                  {/* Equipe */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${TIPO_BADGE_COR[etapa.tipo] ?? TIPO_BADGE_COR.padrao}`}>
                      <IconeTipoEtapa tipo={etapa.tipo} />
                      <span className="capitalize">{etapa.tipo}</span>
                    </span>
                  </td>

                  {/* Etapa */}
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{etapa.nome}</div>
                    {etapa.descricao && (
                      <div className="text-xs text-slate-400 truncate max-w-[180px]">{etapa.descricao}</div>
                    )}
                  </td>

                  {/* Período */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-200">
                      {formatarDataCurta(etapa.data_inicio)} → {formatarDataCurta(etapa.data_fim)}
                    </div>
                  </td>

                  {/* Progresso */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            etapa.progresso >= 100 ? 'bg-emerald-500' :
                            atrasada ? 'bg-red-500' : 'bg-sky-500'
                          }`}
                          style={{ width: `${etapa.progresso || 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-10 ${
                        etapa.progresso >= 100 ? 'text-emerald-400' :
                        atrasada ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {etapa.progresso || 0}%
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    {atrasada ? (
                      <span className="execucao-badge execucao-badge-red animate-pulse">Atrasada</span>
                    ) : etapa.progresso >= 100 ? (
                      <span className="execucao-badge execucao-badge-green">Concluída</span>
                    ) : etapa.status === 'em_andamento' ? (
                      <span className="execucao-badge execucao-badge-blue">Em Andamento</span>
                    ) : (
                      <span className="execucao-badge execucao-badge-gray">Pendente</span>
                    )}
                  </td>

                  {/* Ação */}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onAddAtividade(etapa)}
                      className="execucao-btn execucao-btn-success execucao-btn-sm"
                      title="Criar atividade na agenda"
                      aria-label={`Criar atividade na agenda para ${etapa.nome}`}
                    >
                      <FaCalendarPlus size={12} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(ResumoVisaoTabela);
