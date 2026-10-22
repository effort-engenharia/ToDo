import React from 'react';
import { FaMedal, FaLock, FaFire } from 'react-icons/fa';
import { medalhas, effortColors } from '../../../utils/effortTheme';
import { useAuth } from '../../../contexts/AuthContext';
import { useGamification } from '../hooks/useGamification';
import { mesComercialAtual } from '../../../utils/periodoComercial';

/**
 * BadgesVendedor — Gamificação individual: medalha atual, próxima, streak semanal, badges especiais.
 */
const BadgesVendedor = ({ dashboardData, metaPersonalizada, allData = [], premiacao }) => {
  const { usuario } = useAuth();
  const nomeUsuario = usuario?.nome_vendedor_comercial;
  const { ano, mes } = mesComercialAtual();

  const gam = useGamification({
    allData,
    dashboardData,
    metaPersonalizada,
    ano,
    mes,
    nomeVendedor: nomeUsuario,
    premiacao,
  });

  const { medalhaAtual, percentual, streakSemanas, totalSemanasAteAgora, badgesEspeciais } = gam;

  const listaMedalhas = [medalhas.bronze, medalhas.prata, medalhas.ouro, medalhas.diamante];

  let proxima = null;
  if (percentual < medalhas.bronze.min) proxima = medalhas.bronze;
  else if (percentual < medalhas.prata.min) proxima = medalhas.prata;
  else if (percentual < medalhas.ouro.min) proxima = medalhas.ouro;
  else if (percentual < medalhas.diamante.min) proxima = medalhas.diamante;

  if (!nomeUsuario) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col items-center justify-center text-center">
        <FaMedal className="w-10 h-10 text-gray-300 mb-2" />
        <div className="text-sm text-gray-500">
          Seu perfil não está vinculado a um vendedor. Peça ao administrador para configurar.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.amareloEffort}22`, color: effortColors.amareloEscuro }}
          >
            <FaMedal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Suas conquistas</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Meta individual do mês
            </div>
          </div>
        </div>
        <span
          className="text-lg font-black"
          style={{
            color:
              percentual >= 100
                ? effortColors.sucesso
                : percentual >= 75
                ? effortColors.amareloEscuro
                : effortColors.cinzaSuave,
          }}
        >
          {percentual.toFixed(0)}%
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {listaMedalhas.map((m) => {
          const conquistada = percentual >= m.min;
          const atual = medalhaAtual?.nome === m.nome;
          return (
            <div
              key={m.nome}
              className={`text-center p-2 rounded-lg border-2 transition-all ${
                atual ? 'shadow-md scale-105' : ''
              }`}
              style={{
                borderColor: conquistada ? m.cor : '#E5E7EB',
                background: conquistada ? '#FAFAFA' : '#F9FAFB',
                opacity: conquistada ? 1 : 0.5,
              }}
              title={`${m.nome} — ${m.min}%`}
            >
              <div className="text-2xl mb-0.5">
                {conquistada ? m.icone : <FaLock className="inline w-3 h-3 text-gray-400" />}
              </div>
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: conquistada ? m.cor : '#9CA3AF' }}
              >
                {m.nome}
              </div>
              <div className="text-[9px] text-gray-400">{m.min}%</div>
            </div>
          );
        })}
      </div>

      {totalSemanasAteAgora > 0 && (
        <div
          className="flex items-center gap-2 p-2 rounded-lg mb-3"
          style={{
            background: streakSemanas > 0 ? '#FEF3C7' : '#F3F4F6',
            border: `1px solid ${streakSemanas > 0 ? effortColors.amareloEffort : '#E5E7EB'}`,
          }}
        >
          <FaFire
            className={`w-4 h-4 ${streakSemanas > 0 ? 'text-orange-500' : 'text-gray-400'}`}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-800">
              {streakSemanas > 0
                ? `Streak: ${streakSemanas} semana${streakSemanas > 1 ? 's' : ''} em fogo`
                : 'Sem vendas na semana atual'}
            </div>
            <div className="text-[10px] text-gray-500">
              {streakSemanas}/{totalSemanasAteAgora} semanas com pelo menos 1 fechado
            </div>
          </div>
        </div>
      )}

      {badgesEspeciais.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {badgesEspeciais.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 text-[10px] font-semibold text-yellow-800"
              title={b.descricao}
            >
              <span>{b.icone}</span>
              <span>{b.titulo}</span>
            </div>
          ))}
        </div>
      )}

      {proxima ? (
        <div className="mt-auto p-2.5 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Próxima medalha
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{proxima.icone}</span>
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-800">{proxima.nome}</div>
              <div className="text-[10px] text-gray-500">
                Faltam {Math.max(0, proxima.min - percentual).toFixed(1)}% para conquistar
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mt-auto p-2.5 rounded-lg text-center"
          style={{ background: effortColors.amareloClaro }}
        >
          <div className="text-sm font-bold" style={{ color: effortColors.amareloEscuro }}>
            🏆 Todas as medalhas conquistadas!
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgesVendedor;
