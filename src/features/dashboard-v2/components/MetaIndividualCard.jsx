import React, { useMemo } from 'react';
import { FaBullseye, FaCalendarDay, FaUser, FaUsers } from 'react-icons/fa';
import { formatCurrency } from '../../../utils/dataProcessing';
import { effortColors, medalhaPara } from '../../../utils/effortTheme';
import { diasUteisRestantesNoMes } from '../../../utils/semanasComercial';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * MetaIndividualCard — Progresso de cada vendedor contra sua meta individual
 * (meta do time dividida igualmente pelo número de vendedores).
 *
 * - Vendedor comum: vê apenas a linha dele.
 * - Administrador: vê a lista completa do time.
 */
const MetaIndividualCard = ({
  dashboardData,
  metaPersonalizada,
  ano,
  mes,
  premiacao,
}) => {
  const { usuario, isAdmin } = useAuth();
  const admin = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const meuNome = usuario?.nome_vendedor_comercial;
  const regra = premiacao?.ativo && premiacao.resultado?.configurado ? premiacao.resultado : null;

  const { linhas, metaIndividual, diasUteis } = useMemo(() => {
    const dias = diasUteisRestantesNoMes(ano, mes);

    if (regra) {
      const todasRegra = regra.linhas.map((l) => ({
        nome: l.nome,
        entrada: l.entrada,
        faltam: l.faltaParaMeta,
        percentual: l.atingimento,
        ritmoDia: dias > 0 ? l.faltaParaMeta / dias : l.faltaParaMeta,
        medalha: medalhaPara(l.atingimento),
        elegivel: l.elegivel,
        premioFinal: l.premioFinal,
      }));
      const visiveis = admin
        ? todasRegra
        : todasRegra.filter((l) => (l.nome || '').toUpperCase() === (meuNome || '').toUpperCase().trim());
      return { linhas: visiveis, metaIndividual: regra.metaIndividual, diasUteis: dias };
    }

    const vendedores = dashboardData?.vendedores || [];
    const metaTime = Number(metaPersonalizada) || 0;
    const metaInd = vendedores.length > 0 ? metaTime / vendedores.length : 0;

    const todas = [...vendedores]
      .map((v) => {
        const entrada = Number(v.valorEntrada) || 0;
        const faltam = Math.max(0, metaInd - entrada);
        const pct = metaInd > 0 ? (entrada / metaInd) * 100 : 0;
        const ritmoDia = dias > 0 ? faltam / dias : faltam;
        return {
          nome: v.vendedor,
          entrada,
          faltam,
          percentual: pct,
          ritmoDia,
          medalha: medalhaPara(pct),
        };
      })
      .sort((a, b) => b.percentual - a.percentual);

    // Se não for admin, mantém só a linha do vendedor logado
    const filtradas = admin
      ? todas
      : todas.filter((l) => l.nome === meuNome);

    return { linhas: filtradas, metaIndividual: metaInd, diasUteis: dias };
  }, [dashboardData, metaPersonalizada, ano, mes, admin, meuNome, regra]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: `${effortColors.amareloEffort}22`,
              color: effortColors.amareloEscuro,
            }}
          >
            {admin ? <FaUsers className="w-4 h-4" /> : <FaUser className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">
              {admin ? 'Metas individuais do time' : 'Sua meta individual'}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Meta por vendedor · {formatCurrency(metaIndividual)}
            </div>
          </div>
        </div>
        {diasUteis > 0 && (
          <div
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase"
            title="Dias úteis restantes no mês comercial"
          >
            <FaCalendarDay className="w-2.5 h-2.5" />
            {diasUteis} dias úteis
          </div>
        )}
      </div>

      {/* Corpo */}
      {linhas.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-6 text-center">
          {admin ? (
            <span>Sem vendedores com vendas neste mês.</span>
          ) : regra && meuNome && !premiacao.souEfetivo ? (
            <span>Seu perfil não participa da meta individual do time.</span>
          ) : meuNome ? (
            <span>
              Você ainda não aparece nas vendas deste mês. Assim que registrar uma entrada,
              seu progresso aparece aqui.
            </span>
          ) : (
            <span>
              Configure o campo <strong>nome_vendedor_comercial</strong> no seu usuário
              para acompanhar a sua meta.
            </span>
          )}
        </div>
      ) : (
        <ul className="space-y-3 overflow-y-auto pr-1">
          {linhas.map((l) => {
            const isSelf = meuNome && l.nome === meuNome;
            const barCor =
              l.percentual >= 100
                ? effortColors.sucesso
                : l.percentual >= 75
                ? effortColors.amareloEffort
                : l.percentual >= 50
                ? effortColors.laranja
                : effortColors.perigo;

            return (
              <li
                key={l.nome}
                className={`rounded-lg p-3 border transition ${
                  isSelf
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isSelf ? 'text-yellow-700' : 'text-gray-800'
                      }`}
                    >
                      {l.nome}
                    </span>
                    {isSelf && admin && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500 text-white font-bold uppercase">
                        Você
                      </span>
                    )}
                    {l.medalha && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white shadow-sm inline-flex items-center gap-1"
                        style={{ background: l.medalha.fundo }}
                        title={`Medalha ${l.medalha.nome}`}
                      >
                        <span className="text-xs leading-none">{l.medalha.icone}</span>
                        {l.medalha.nome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {regra && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          l.elegivel ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Elegível à premiação quando a entrada líquida ≥ meta individual"
                      >
                        {l.elegivel ? 'Elegível' : 'Não elegível'}
                      </span>
                    )}
                    <div className="text-sm font-bold" style={{ color: barCor }}>
                      {l.percentual.toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, l.percentual)}%`,
                      background: `linear-gradient(90deg, ${barCor}, ${barCor}dd)`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="text-gray-400 uppercase tracking-wider">Entrada</div>
                    <div className="text-gray-800 font-semibold">
                      {formatCurrency(l.entrada)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 uppercase tracking-wider">Falta</div>
                    <div className="text-gray-800 font-semibold">
                      {l.faltam > 0 ? formatCurrency(l.faltam) : (
                        <span className="text-emerald-600">Meta batida 🎯</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 uppercase tracking-wider">Ritmo/dia</div>
                    <div className="text-gray-800 font-semibold">
                      {l.faltam > 0 ? formatCurrency(l.ritmoDia) : '—'}
                    </div>
                  </div>
                </div>
                {regra && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-[10px]">
                    <span className="text-gray-400 uppercase tracking-wider">Prêmio (prévia)</span>
                    <span className="text-gray-800 font-bold">{formatCurrency(l.premioFinal)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
        {regra ? (
          <>
            Meta individual = Meta Ideal <strong>{formatCurrency(regra.metas.ideal)}</strong>{' '}
            ÷ {regra.qtdEfetivos} vendedor(es) efetivo(s). PJ e líder não entram no divisor.
          </>
        ) : (
          <>
            Meta individual = meta do time <strong>{formatCurrency(Number(metaPersonalizada) || 0)}</strong>{' '}
            ÷ {dashboardData?.vendedores?.length || 0} vendedor(es).
          </>
        )}
      </div>
    </div>
  );
};

export default MetaIndividualCard;
