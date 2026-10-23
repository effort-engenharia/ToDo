import React, { useMemo, useState } from 'react';
import {
  FaUser,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaTrophy,
  FaStar,
  FaChartLine,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaFilter
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { useAsyncData } from '../hooks/useAsyncData';
import { Carregando, ErroCarregamento, EstadoVazio } from './ui/Estados';
import Grafico from './desempenho/Grafico';
import { CORES, TIPOS, opcaoLinhas, opcaoRosca, rotuloDia } from './desempenho/opcoesGraficos';

const PERIODOS = [
  { valor: 'semana', rotulo: 'Esta Semana' },
  { valor: 'mes', rotulo: 'Este Mês' },
  { valor: 'trimestre', rotulo: 'Este Trimestre' },
  { valor: 'ano', rotulo: 'Este Ano' }
];

const DETALHE_TIPOS = {
  eletrica: { icone: FaBolt, texto: 'text-yellow-400', fundo: 'bg-yellow-500/20', borda: 'border-yellow-500/20', barra: 'bg-yellow-500' },
  civil: { icone: FaHardHat, texto: 'text-orange-400', fundo: 'bg-orange-500/20', borda: 'border-orange-500/20', barra: 'bg-orange-500' },
  galpao: { icone: FaWarehouse, texto: 'text-blue-400', fundo: 'bg-blue-500/20', borda: 'border-blue-500/20', barra: 'bg-blue-500' }
};

const calcularPorcentagem = (valor, total) => (total ? Math.round(((valor || 0) / total) * 100) : 0);

const DesempenhoIndividual = () => {
  const [tecnicoEscolhido, setTecnicoEscolhido] = useState(null);
  const [periodo, setPeriodo] = useState('mes');

  const {
    data: tecnicos,
    loading: carregandoTecnicos,
    error: erroTecnicos,
    reload: recarregarTecnicos
  } = useAsyncData(() => execucaoService.buscarTecnicos(), [], { initialData: [] });

  const tecnicoSelecionado = tecnicoEscolhido ?? tecnicos[0]?.id ?? null;
  const tecnicoAtual = useMemo(
    () => tecnicos.find((t) => t.id === tecnicoSelecionado),
    [tecnicos, tecnicoSelecionado]
  );

  const { data: desempenho, loading, error, reload } = useAsyncData(
    () => (tecnicoSelecionado
      ? execucaoService.buscarDesempenhoIndividual(tecnicoSelecionado, periodo)
      : { success: true, data: null }),
    [tecnicoSelecionado, periodo]
  );

  const opcaoEvolucao = useMemo(() => {
    if (!desempenho) return null;
    const historico = desempenho.historico || [];
    return opcaoLinhas({
      categorias: historico.map((h) => rotuloDia(h.data)),
      series: [
        { nome: 'Concluídas', dados: historico.map((h) => h.concluidas), cor: CORES.concluidas, largura: 3, area: true },
        { nome: 'Total', dados: historico.map((h) => h.total), cor: CORES.total }
      ]
    });
  }, [desempenho]);

  const opcaoDistribuicao = useMemo(() => {
    if (!desempenho) return null;
    return opcaoRosca({
      itens: TIPOS.map(({ chave, rotulo, cor }) => ({ nome: rotulo, valor: desempenho.por_tipo?.[chave] || 0, cor }))
    });
  }, [desempenho]);

  const taxaConclusao = calcularPorcentagem(desempenho?.concluidas, desempenho?.total);

  if (carregandoTecnicos && tecnicos.length === 0) return <Carregando />;
  if (erroTecnicos) return <ErroCarregamento mensagem={erroTecnicos} onTentarNovamente={recarregarTecnicos} />;
  if (tecnicos.length === 0) {
    return <EstadoVazio titulo="Nenhum técnico encontrado" texto="Não há técnicos ativos para exibir o desempenho." />;
  }

  return (
    <div className="execucao-animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <FaUser className="text-slate-400" aria-hidden="true" />
          <select
            value={tecnicoSelecionado || ''}
            onChange={(e) => setTecnicoEscolhido(e.target.value)}
            className="execucao-form-select"
            aria-label="Técnico"
          >
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>{t.nome_completo}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <FaCalendarAlt className="text-slate-400" aria-hidden="true" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="execucao-form-select"
            aria-label="Período"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="execucao-card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {tecnicoAtual?.nome_completo?.charAt(0) || 'T'}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-100">{tecnicoAtual?.nome_completo || 'Técnico'}</h3>
            <p className="text-slate-400">{tecnicoAtual?.email}</p>
          </div>
          {desempenho?.ranking && (
            <div className="text-center">
              <div className="flex items-center gap-2 text-yellow-400">
                <FaTrophy size={24} aria-hidden="true" />
                <span className="text-2xl font-bold">#{desempenho.ranking}</span>
              </div>
              <span className="text-sm text-slate-400">Ranking</span>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
      ) : loading ? (
        <Carregando />
      ) : (
        <>
          <div className="execucao-grid execucao-grid-4 mb-6">
            <div className="execucao-stat-card">
              <div className="execucao-stat-icon blue"><FaCalendarAlt aria-hidden="true" /></div>
              <div className="execucao-stat-content">
                <div className="execucao-stat-label">Total de Atividades</div>
                <div className="execucao-stat-value">{desempenho?.total || 0}</div>
              </div>
            </div>

            <div className="execucao-stat-card">
              <div className="execucao-stat-icon green"><FaCheckCircle aria-hidden="true" /></div>
              <div className="execucao-stat-content">
                <div className="execucao-stat-label">Concluídas</div>
                <div className="execucao-stat-value">{desempenho?.concluidas || 0}</div>
                <div className="text-xs text-green-400">{taxaConclusao}%</div>
              </div>
            </div>

            <div className="execucao-stat-card">
              <div className="execucao-stat-icon yellow"><FaClock aria-hidden="true" /></div>
              <div className="execucao-stat-content">
                <div className="execucao-stat-label">Pendentes</div>
                <div className="execucao-stat-value">{desempenho?.pendentes || 0}</div>
              </div>
            </div>

            <div className="execucao-stat-card">
              <div className="execucao-stat-icon purple"><FaStar aria-hidden="true" /></div>
              <div className="execucao-stat-content">
                <div className="execucao-stat-label">Taxa de Conclusão</div>
                <div className="execucao-stat-value">{taxaConclusao}%</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="execucao-card">
              <div className="execucao-card-header">
                <h3 className="execucao-card-title">
                  <FaChartLine className="text-blue-400" aria-hidden="true" />
                  Evolução de Atividades
                </h3>
              </div>
              {opcaoEvolucao && <Grafico option={opcaoEvolucao} rotulo="Gráfico de evolução de atividades" />}
            </div>

            <div className="execucao-card">
              <div className="execucao-card-header">
                <h3 className="execucao-card-title">
                  <FaFilter className="text-purple-400" aria-hidden="true" />
                  Distribuição por Tipo
                </h3>
              </div>
              {opcaoDistribuicao && <Grafico option={opcaoDistribuicao} rotulo="Gráfico de distribuição por tipo" />}
            </div>
          </div>

          <div className="execucao-card">
            <div className="execucao-card-header">
              <h3 className="execucao-card-title">Detalhamento por Tipo</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIPOS.map(({ chave, rotulo }) => {
                const estilo = DETALHE_TIPOS[chave];
                const Icon = estilo.icone;
                const quantidade = desempenho?.por_tipo?.[chave] || 0;
                return (
                  <div key={chave} className={`p-4 bg-slate-800/50 rounded-lg border ${estilo.borda}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg ${estilo.fundo} flex items-center justify-center`}>
                        <Icon className={estilo.texto} aria-hidden="true" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-100">{rotulo}</h4>
                        <span className="text-sm text-slate-400">{quantidade} atividades</span>
                      </div>
                    </div>
                    <div className="execucao-progress">
                      <div
                        className={`execucao-progress-bar ${estilo.barra}`}
                        style={{ width: `${calcularPorcentagem(quantidade, desempenho?.total)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DesempenhoIndividual;
