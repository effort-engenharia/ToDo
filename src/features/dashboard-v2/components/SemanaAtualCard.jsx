import React from 'react';
import { FaClock, FaFlag } from 'react-icons/fa';
import { semanaCores } from '../../../utils/effortTheme';
import { diasRestantesNaSemana, progressoSemanaAtual } from '../../../utils/semanasComercial';

/**
 * SemanaAtualCard — Card destaque da semana atual do mês comercial.
 * Mostra: nome, dias restantes, mini progresso, e cor semântica.
 */
const SemanaAtualCard = ({ semanaAtual, ano, mes }) => {
  if (!semanaAtual) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-full flex flex-col items-center justify-center min-h-[180px]">
        <FaClock className="w-10 h-10 text-gray-300 mb-2" />
        <div className="text-sm text-gray-500 text-center">
          Estamos fora do mês comercial vigente.
        </div>
      </div>
    );
  }

  const cor = semanaCores[semanaAtual.corIndex];
  const diasRestantes = diasRestantesNaSemana(ano, mes);
  const progresso = progressoSemanaAtual(ano, mes);

  return (
    <div
      className="rounded-xl shadow-sm p-5 h-full flex flex-col overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${cor.cor} 0%, ${cor.corEscura} 100%)`,
        color: '#fff',
      }}
    >
      <div className="absolute right-0 top-0 opacity-10 text-9xl font-black leading-none pr-2">
        {semanaAtual.numero}
      </div>

      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            <FaFlag className="w-2.5 h-2.5" /> Agora
          </span>
          <span className="text-[10px] uppercase tracking-wider opacity-90">{cor.label}</span>
        </div>

        <div className="text-3xl font-black leading-tight mb-1">Semana {semanaAtual.numero}</div>
        <div className="text-sm opacity-90 mb-4">
          {semanaAtual.de.getDate().toString().padStart(2, '0')}/
          {(semanaAtual.de.getMonth() + 1).toString().padStart(2, '0')}
          {' → '}
          {semanaAtual.ate.getDate().toString().padStart(2, '0')}/
          {(semanaAtual.ate.getMonth() + 1).toString().padStart(2, '0')}
        </div>

        <div className="mt-auto space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1 opacity-90">
              <span>Progresso da semana</span>
              <span>{Math.round(progresso)}%</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{diasRestantes}</span>
            <span className="text-xs opacity-90 uppercase tracking-wider">
              {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemanaAtualCard;
