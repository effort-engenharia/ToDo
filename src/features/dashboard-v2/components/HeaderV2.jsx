import React from 'react';
import { FaBars, FaSyncAlt, FaCalendarAlt, FaCog, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayout } from '../../../contexts/LayoutContext';
import { effortColors, semanaCores } from '../../../utils/effortTheme';
import { rotuloMesComercial, rangeCurtoMesComercial } from '../../../utils/periodoComercial';

const MESES_INDICE = {
  janeiro: 0, fevereiro: 1, 'março': 2, marco: 2, abril: 3,
  maio: 4, junho: 5, julho: 6, agosto: 7,
  setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

/**
 * HeaderV2 — barra superior com saudação, mês vigente, badge da semana,
 * botão refresh e toggle mobile.
 */
const HeaderV2 = ({
  onOpenMobileSidebar,
  onRefresh,
  ano,
  mes,
  semanaAtual, // objeto do semanasDoMesComercial ou null
  loading,
  lastUpdated,
  // Filtros mês/ano
  selectedMonth,
  selectedYear,
  availableMonths = [],
  availableYears = [],
  setSelectedMonth,
  setSelectedYear,
}) => {
  const { usuario } = useAuth();
  const { canSwitch } = useLayout();
  const nomeUsuario =
    usuario?.nome_vendedor_comercial ||
    usuario?.nome_completo?.split(' ')[0] ||
    'vendedor';

  const saudacao = getSaudacao();
  const rotulo = rotuloMesComercial(ano, mes);
  const corSemana = semanaAtual ? semanaCores[semanaAtual.corIndex] : null;

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{
        background: 'rgba(255, 255, 255, 0.92)',
        borderColor: '#E5E7EB',
      }}
    >
      <div className="flex items-center gap-3 px-4 md:px-6 py-3">
        {/* Mobile toggle */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          aria-label="Abrir menu"
        >
          <FaBars className="w-5 h-5 text-gray-700" />
        </button>

        {/* Título */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">
              {saudacao}, <span style={{ color: effortColors.amareloEscuro }}>{nomeUsuario}</span> ⚡
            </h1>
            {corSemana && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide whitespace-nowrap"
                style={{
                  background: corSemana.corClara,
                  color: corSemana.corEscura,
                  border: `1px solid ${corSemana.cor}`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: corSemana.cor }}
                />
                {corSemana.nome} — {corSemana.label}
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1 mt-0.5 truncate">
            <FaCalendarAlt className="w-3 h-3 shrink-0" />
            <span className="truncate">{rotulo}</span>
          </p>
        </div>

        {/* Filtros mês/ano */}
        {availableMonths.length > 0 && setSelectedMonth && (
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs md:text-sm font-semibold pl-3 pr-7 py-2 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 cursor-pointer"
              style={{ minWidth: '100px' }}
              title="Mês comercial"
            >
              {availableMonths.map((m) => {
                const nome = m.charAt(0).toUpperCase() + m.slice(1);
                const idx = MESES_INDICE[m.toLowerCase()];
                const range = idx != null
                  ? rangeCurtoMesComercial(parseInt(selectedYear), idx)
                  : null;
                return (
                  <option key={m} value={m}>
                    {range ? `${nome} (${range})` : nome}
                  </option>
                );
              })}
            </select>
            <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none" />
          </div>
        )}

        {availableYears.length > 0 && setSelectedYear && (
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-white border border-gray-200 text-gray-700 text-xs md:text-sm font-semibold pl-3 pr-7 py-2 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 cursor-pointer"
              title="Ano"
            >
              {availableYears.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none" />
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          title="Atualizar dados"
        >
          <FaSyncAlt
            className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`}
          />
        </button>

        {/* Admin (só admin) — atalho para aba Aparência */}
        {canSwitch && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('effort:open-admin'))}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Configurações do administrador"
          >
            <FaCog className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Sub-barra de progresso do mês (fina) */}
      {corSemana && (
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg,
              ${semanaCores[0].cor} 0%, ${semanaCores[0].cor} 25%,
              ${semanaCores[1].cor} 25%, ${semanaCores[1].cor} 50%,
              ${semanaCores[2].cor} 50%, ${semanaCores[2].cor} 75%,
              ${semanaCores[3].cor} 75%, ${semanaCores[3].cor} 100%)`,
          }}
        />
      )}
    </header>
  );
};

function getSaudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default HeaderV2;
