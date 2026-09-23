import React, { useState } from 'react';
import { FaCheck, FaPalette, FaClock, FaUser } from 'react-icons/fa';
import { useLayout } from '../contexts/LayoutContext';
import { effortColors } from '../utils/effortTheme';

/**
 * AparenciaTab — conteúdo da aba "Aparência" no AdminPanel.
 * Permite ao admin escolher entre layout Clássico (V1) e Moderno (V2).
 * Persistência: Supabase (tabela configuracoes_sistema).
 */
const AparenciaTab = () => {
  const {
    layout,
    setLayout,
    loading,
    saving,
    canSwitch,
    atualizadoPor,
    atualizadoEm,
    LAYOUT_CLASSICO,
    LAYOUT_MODERNO,
  } = useLayout();

  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  const handleSelecionar = async (novoValor) => {
    if (!canSwitch) return;
    if (novoValor === layout) return;
    setMensagem(null);
    setErro(null);
    const res = await setLayout(novoValor);
    if (res?.success) {
      setMensagem(`Layout alterado para "${novoValor}" com sucesso. Todos os usuários verão a mudança no próximo carregamento.`);
      setTimeout(() => setMensagem(null), 5000);
    } else {
      setErro(res?.message || 'Erro ao salvar preferência.');
    }
  };

  const dataFormatada = atualizadoEm
    ? new Date(atualizadoEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <FaPalette className="mr-2" style={{ color: effortColors.amareloEffort }} />
            Aparência do Dashboard Comercial
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Escolha o layout que será aplicado para todos os usuários com acesso ao dashboard.
          </p>
        </div>
      </div>

      {mensagem && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center">
          <FaCheck className="mr-2" /> {mensagem}
        </div>
      )}
      {erro && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card Clássico */}
        <LayoutCard
          titulo="Clássico"
          subtitulo="Layout atual em produção"
          selecionado={layout === LAYOUT_CLASSICO}
          onClick={() => handleSelecionar(LAYOUT_CLASSICO)}
          disabled={!canSwitch || saving || loading}
          preview={
            <div className="w-full h-40 rounded-md bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col p-2 gap-1">
              <div className="h-4 bg-blue-500 rounded w-full" />
              <div className="flex gap-1 flex-1">
                <div className="flex-1 bg-white rounded shadow-sm" />
                <div className="flex-1 bg-white rounded shadow-sm" />
                <div className="flex-1 bg-white rounded shadow-sm" />
              </div>
              <div className="flex gap-1 flex-1">
                <div className="flex-1 bg-white rounded shadow-sm" />
                <div className="flex-1 bg-white rounded shadow-sm" />
              </div>
            </div>
          }
          descricao="Visão completa com múltiplas tabelas, gráficos detalhados e todas as métricas em uma única página."
          badges={['Estável', 'Todos os dados']}
        />

        {/* Card Moderno */}
        <LayoutCard
          titulo="Moderno"
          subtitulo="Beta — Novo layout Effort"
          selecionado={layout === LAYOUT_MODERNO}
          onClick={() => handleSelecionar(LAYOUT_MODERNO)}
          disabled={!canSwitch || saving || loading}
          highlight
          preview={
            <div
              className="w-full h-40 rounded-md p-2 flex gap-1"
              style={{ background: `linear-gradient(135deg, ${effortColors.cinzaMedio}, ${effortColors.preto})` }}
            >
              <div className="w-8 rounded flex flex-col gap-1 py-1 items-center" style={{ background: effortColors.preto }}>
                <div className="w-4 h-4 rounded" style={{ background: effortColors.amareloEffort }} />
                <div className="w-3 h-3 rounded bg-white/30" />
                <div className="w-3 h-3 rounded bg-white/30" />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-6 rounded" style={{ background: effortColors.amareloEffort }} />
                <div className="flex-1 flex gap-1">
                  <div className="flex-1 rounded bg-white/90" />
                  <div className="flex-1 rounded bg-white/90" />
                  <div className="flex-1 rounded bg-white/90" />
                </div>
                <div className="flex gap-1 h-6">
                  <div className="flex-1 rounded" style={{ background: '#10B981' }} />
                  <div className="flex-1 rounded" style={{ background: '#F5B841' }} />
                  <div className="flex-1 rounded" style={{ background: '#F97316' }} />
                  <div className="flex-1 rounded" style={{ background: '#EF4444' }} />
                </div>
              </div>
            </div>
          }
          descricao="Foco em ciclo semanal, ranking gamificado, sidebar lateral e paleta Effort. Otimizado para mobile."
          badges={['Beta', 'Gamificação', 'Ciclo semanal']}
        />
      </div>

      {/* Meta info */}
      <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <FaClock className="mr-2 text-gray-400" />
            <span>
              Última alteração:{' '}
              <strong className="text-gray-800">{dataFormatada || '—'}</strong>
            </span>
          </div>
          <div className="flex items-center">
            <FaUser className="mr-2 text-gray-400" />
            <span>
              Por:{' '}
              <strong className="text-gray-800">{atualizadoPor || 'sistema'}</strong>
            </span>
          </div>
        </div>
        {!canSwitch && (
          <p className="text-xs text-gray-500 mt-2">
            Apenas administradores podem alterar o layout global.
          </p>
        )}
      </div>
    </div>
  );
};

const LayoutCard = ({
  titulo,
  subtitulo,
  selecionado,
  onClick,
  disabled,
  preview,
  descricao,
  badges = [],
  highlight = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left w-full p-4 rounded-xl border-2 transition-all group ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'
      } ${
        selecionado
          ? 'shadow-lg'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
      style={
        selecionado
          ? {
              borderColor: effortColors.amareloEffort,
              background: `linear-gradient(180deg, ${effortColors.amareloClaro}22, #fff 40%)`,
            }
          : {}
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-gray-800">{titulo}</h4>
            {highlight && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: effortColors.amareloEffort, color: effortColors.preto }}
              >
                Novo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{subtitulo}</p>
        </div>
        {selecionado ? (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: effortColors.amareloEffort }}
          >
            <FaCheck className="w-3 h-3" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full border-2 border-gray-300 shrink-0" />
        )}
      </div>

      {preview}

      <p className="text-sm text-gray-600 mt-3">{descricao}</p>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {badges.map((b) => (
            <span
              key={b}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

export default AparenciaTab;
