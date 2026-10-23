import React, { useMemo, useState } from 'react';
import {
  FaUsers,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaTrophy,
  FaMedal,
  FaChartLine,
  FaChartBar,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaArrowUp,
  FaArrowDown
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { useAsyncData } from '../hooks/useAsyncData';
import { Carregando, ErroCarregamento } from './ui/Estados';
import Grafico from './desempenho/Grafico';
import IndicadoresAcionaveis from './desempenho/IndicadoresAcionaveis';
import { CORES, TIPOS, opcaoBarrasEmpilhadas, opcaoLinhas, rotuloDia } from './desempenho/opcoesGraficos';

const PERIODOS = [
  { valor: 'semana', rotulo: 'Esta Semana' },
  { valor: 'mes', rotulo: 'Este Mês' },
  { valor: 'trimestre', rotulo: 'Este Trimestre' },
  { valor: 'ano', rotulo: 'Este Ano' }
];

const CARTOES_TIPO = {
  eletrica: { icone: FaBolt, texto: 'text-yellow-400', fundo: 'bg-yellow-500/20', borda: 'border-yellow-500', barra: 'bg-yellow-500' },
  civil: { icone: FaHardHat, texto: 'text-orange-400', fundo: 'bg-orange-500/20', borda: 'border-orange-500', barra: 'bg-orange-500' },
  galpao: { icone: FaWarehouse, texto: 'text-blue-400', fundo: 'bg-blue-500/20', borda: 'border-blue-500', barra: 'bg-blue-500' }
};

const COR_MEDALHA = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];

const carregarTime = async (periodo) => {
  const [desempenhoResult, rankingResult] = await Promise.all([
    execucaoService.buscarDesempenhoTime(periodo),
    execucaoService.buscarRankingTecnicos(periodo)
  ]);
  if (!desempenhoResult?.success) return desempenhoResult;
  if (!rankingResult?.success) return rankingResult;
  return { success: true, data: { desempenho: desempenhoResult.data, ranking: rankingResult.data } };
};

const DesempenhoTime = () => {
  const [periodo, setPeriodo] = useState('mes');

  const { data, loading, error, reload } = useAsyncData(() => carregarTime(periodo), [periodo]);
  const desempenho = data?.desempenho;
  const ranking = useMemo(() => data?.ranking ?? [], [data]);

  const opcaoBarras = useMemo(() => {
    if (!data) return null;
    const top = ranking.slice(0, 8);
    return opcaoBarrasEmpilhadas({
      categorias: top.map((t) => t.nome?.split(' ')[0] || 'N/A'),
      series: [
        { nome: 'Concluídas', dados: top.map((t) => t.concluidas || 0), cor: CORES.concluidas },
        { nome: 'Em aberto', dados: top.map((t) => Math.max(0, (t.total || 0) - (t.concluidas || 0))), cor: CORES.emAberto }
      ]
    });
  }, [data, ranking]);

  const opcaoEvolucao = useMemo(() => {
    if (!data) return null;
    const evolucao = desempenho.evolucao || [];
    return opcaoLinhas({
      categorias: evolucao.map((e) => rotuloDia(e.data)),
      comLegenda: true,
      series: TIPOS.map(({ chave, rotulo, cor }) => ({ nome: rotulo, dados: evolucao.map((e) => e[chave] || 0), cor }))
    });
  }, [data, desempenho]);

  const filtro = (
    <div className="flex items-center gap-4 mb-6">
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
  );

  if (error) {
    return (
      <div className="execucao-animate-fade-in">
        {filtro}
        <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="execucao-animate-fade-in">
        {filtro}
        <Carregando />
      </div>
    );
  }

  const totalAtividades = desempenho.total_atividades || 0;
  const variacao = desempenho.variacao_total;

  return (
    <div className="execucao-animate-fade-in">
      {filtro}

      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue"><FaUsers aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Técnicos</div>
            <div className="execucao-stat-value">{desempenho.total_tecnicos || 0}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon purple"><FaCalendarAlt aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Atividades</div>
            <div className="execucao-stat-value">{totalAtividades}</div>
            {variacao !== undefined && (
              <div className={`text-xs flex items-center gap-1 ${variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {variacao >= 0 ? <FaArrowUp size={10} aria-hidden="true" /> : <FaArrowDown size={10} aria-hidden="true" />}
                {Math.abs(variacao)}% vs período anterior
              </div>
            )}
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green"><FaCheckCircle aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Taxa de Conclusão</div>
            <div className="execucao-stat-value">{desempenho.taxa_conclusao || 0}%</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow"><FaClock aria-hidden="true" /></div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Média por Técnico</div>
            <div className="execucao-stat-value">{desempenho.media_por_tecnico || 0}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaTrophy className="text-yellow-400" aria-hidden="true" />
              Ranking de Técnicos
            </h3>
          </div>
          {ranking.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum técnico com atividades no período.</p>
          ) : (
            <ol className="space-y-3">
              {ranking.slice(0, 5).map((tecnico, index) => (
                <li
                  key={tecnico.id}
                  className={`flex items-center gap-4 p-3 rounded-lg ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800/50'}`}
                >
                  <div className="w-8 text-center">
                    {index < 3 ? (
                      <FaMedal className={COR_MEDALHA[index]} size={20} aria-label={`${index + 1}º lugar`} />
                    ) : (
                      <span className="text-slate-500 font-bold">{index + 1}º</span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold" aria-hidden="true">
                    {tecnico.nome?.charAt(0) || 'T'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">{tecnico.nome || 'Técnico'}</div>
                    <div className="text-sm text-slate-400">{tecnico.concluidas || 0} concluídas</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">{tecnico.taxa_conclusao || 0}%</div>
                    <div className="text-xs text-slate-400">taxa</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaChartBar className="text-blue-400" aria-hidden="true" />
              Atividades por Técnico
            </h3>
          </div>
          {opcaoBarras && <Grafico option={opcaoBarras} rotulo="Gráfico de atividades por técnico" />}
        </div>
      </div>

      <div className="execucao-card mb-6">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">
            <FaChartLine className="text-purple-400" aria-hidden="true" />
            Evolução por Tipo de Atividade
          </h3>
        </div>
        {opcaoEvolucao && <Grafico option={opcaoEvolucao} rotulo="Gráfico de evolução por tipo de atividade" />}
      </div>

      <div className="execucao-grid execucao-grid-3">
        {TIPOS.map(({ chave, rotulo }) => {
          const estilo = CARTOES_TIPO[chave];
          const Icon = estilo.icone;
          const quantidade = desempenho.por_tipo?.[chave] || 0;
          const percentual = totalAtividades ? Math.round((quantidade / totalAtividades) * 100) : 0;
          return (
            <div key={chave} className={`execucao-card border-l-4 ${estilo.borda}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${estilo.fundo} flex items-center justify-center`}>
                  <Icon className={estilo.texto} size={24} aria-hidden="true" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-100">{quantidade}</div>
                  <div className="text-slate-400">{rotulo}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="execucao-progress">
                  <div className={`execucao-progress-bar ${estilo.barra}`} style={{ width: `${percentual}%` }}></div>
                </div>
                <div className="text-xs text-slate-400 mt-1">{percentual}% do total</div>
              </div>
            </div>
          );
        })}
      </div>

      <IndicadoresAcionaveis periodo={periodo} />
    </div>
  );
};

export default DesempenhoTime;
