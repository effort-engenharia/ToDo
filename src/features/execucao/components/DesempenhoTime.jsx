import React, { useState, useEffect } from 'react';
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
import * as echarts from 'echarts';
import { execucaoService } from '../../../services/supabase/execucao';

const DesempenhoTime = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [desempenho, setDesempenho] = useState(null);
  const [ranking, setRanking] = useState([]);

  const barChartRef = React.useRef(null);
  const lineChartRef = React.useRef(null);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  useEffect(() => {
    if (desempenho && barChartRef.current) {
      renderizarGraficoBarras();
    }
    if (desempenho && lineChartRef.current) {
      renderizarGraficoLinha();
    }
  }, [desempenho]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [desempenhoResult, rankingResult] = await Promise.all([
        execucaoService.buscarDesempenhoTime(periodo),
        execucaoService.buscarRankingTecnicos(periodo)
      ]);

      if (desempenhoResult.success) {
        setDesempenho(desempenhoResult.data);
      }
      if (rankingResult.success) {
        setRanking(rankingResult.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderizarGraficoBarras = () => {
    const chart = echarts.init(barChartRef.current);
    
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f1f5f9' },
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['Concluídas', 'Pendentes', 'Em Andamento'],
        textStyle: { color: '#94a3b8' },
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ranking.slice(0, 8).map(t => t.nome?.split(' ')[0] || 'N/A'),
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', rotate: 30 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Concluídas',
          type: 'bar',
          stack: 'total',
          data: ranking.slice(0, 8).map(t => t.concluidas || 0),
          itemStyle: { color: '#10b981' }
        },
        {
          name: 'Pendentes',
          type: 'bar',
          stack: 'total',
          data: ranking.slice(0, 8).map(t => t.pendentes || 0),
          itemStyle: { color: '#eab308' }
        },
        {
          name: 'Em Andamento',
          type: 'bar',
          stack: 'total',
          data: ranking.slice(0, 8).map(t => t.em_andamento || 0),
          itemStyle: { color: '#3b82f6' }
        }
      ]
    };

    chart.setOption(option);
    
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  };

  const renderizarGraficoLinha = () => {
    const chart = echarts.init(lineChartRef.current);
    
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f1f5f9' }
      },
      legend: {
        data: ['Elétrica', 'Civil', 'Galpão'],
        textStyle: { color: '#94a3b8' },
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: desempenho?.evolucao?.map(e => e.data) || [],
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Elétrica',
          type: 'line',
          smooth: true,
          data: desempenho?.evolucao?.map(e => e.eletrica) || [],
          lineStyle: { color: '#eab308', width: 2 },
          itemStyle: { color: '#eab308' }
        },
        {
          name: 'Civil',
          type: 'line',
          smooth: true,
          data: desempenho?.evolucao?.map(e => e.civil) || [],
          lineStyle: { color: '#f97316', width: 2 },
          itemStyle: { color: '#f97316' }
        },
        {
          name: 'Galpão',
          type: 'line',
          smooth: true,
          data: desempenho?.evolucao?.map(e => e.galpao) || [],
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' }
        }
      ]
    };

    chart.setOption(option);
    
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  };

  const getMedalColor = (posicao) => {
    switch (posicao) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-400';
      case 3: return 'text-amber-600';
      default: return 'text-slate-500';
    }
  };

  const calcularVariacao = (atual, anterior) => {
    if (!anterior) return 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  if (loading) {
    return (
      <div className="execucao-loading">
        <div className="execucao-spinner"></div>
      </div>
    );
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Filtro de período */}
      <div className="flex items-center gap-4 mb-6">
        <FaCalendarAlt className="text-slate-400" />
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="execucao-form-select"
        >
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
          <option value="trimestre">Este Trimestre</option>
          <option value="ano">Este Ano</option>
        </select>
      </div>

      {/* Métricas gerais do time */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaUsers />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Técnicos</div>
            <div className="execucao-stat-value">{desempenho?.total_tecnicos || 0}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon purple">
            <FaCalendarAlt />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total Atividades</div>
            <div className="execucao-stat-value">{desempenho?.total_atividades || 0}</div>
            {desempenho?.variacao_total !== undefined && (
              <div className={`text-xs flex items-center gap-1 ${desempenho.variacao_total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {desempenho.variacao_total >= 0 ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
                {Math.abs(desempenho.variacao_total)}% vs período anterior
              </div>
            )}
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Taxa de Conclusão</div>
            <div className="execucao-stat-value">{desempenho?.taxa_conclusao || 0}%</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Média por Técnico</div>
            <div className="execucao-stat-value">{desempenho?.media_por_tecnico || 0}</div>
          </div>
        </div>
      </div>

      {/* Ranking e Gráfico de barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ranking dos técnicos */}
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaTrophy className="text-yellow-400" />
              Ranking de Técnicos
            </h3>
          </div>
          <div className="space-y-3">
            {ranking.slice(0, 5).map((tecnico, index) => (
              <div 
                key={tecnico.id} 
                className={`flex items-center gap-4 p-3 rounded-lg ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800/50'}`}
              >
                <div className="w-8 text-center">
                  {index < 3 ? (
                    <FaMedal className={getMedalColor(index + 1)} size={20} />
                  ) : (
                    <span className="text-slate-500 font-bold">{index + 1}º</span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {tecnico.nome?.charAt(0) || 'T'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-100">{tecnico.nome || 'Técnico'}</div>
                  <div className="text-sm text-slate-400">
                    {tecnico.concluidas || 0} concluídas
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">{tecnico.taxa_conclusao || 0}%</div>
                  <div className="text-xs text-slate-400">taxa</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de barras por técnico */}
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaChartBar className="text-blue-400" />
              Atividades por Técnico
            </h3>
          </div>
          <div ref={barChartRef} className="h-72"></div>
        </div>
      </div>

      {/* Gráfico de evolução por tipo */}
      <div className="execucao-card mb-6">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">
            <FaChartLine className="text-purple-400" />
            Evolução por Tipo de Atividade
          </h3>
        </div>
        <div ref={lineChartRef} className="h-72"></div>
      </div>

      {/* Distribuição por tipo */}
      <div className="execucao-grid execucao-grid-3">
        <div className="execucao-card border-l-4 border-yellow-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <FaBolt className="text-yellow-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">
                {desempenho?.por_tipo?.eletrica || 0}
              </div>
              <div className="text-slate-400">Elétrica</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-yellow-500"
                style={{ width: `${desempenho?.por_tipo?.eletrica_percentual || 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {desempenho?.por_tipo?.eletrica_percentual || 0}% do total
            </div>
          </div>
        </div>

        <div className="execucao-card border-l-4 border-orange-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FaHardHat className="text-orange-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">
                {desempenho?.por_tipo?.civil || 0}
              </div>
              <div className="text-slate-400">Civil</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-orange-500"
                style={{ width: `${desempenho?.por_tipo?.civil_percentual || 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {desempenho?.por_tipo?.civil_percentual || 0}% do total
            </div>
          </div>
        </div>

        <div className="execucao-card border-l-4 border-blue-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FaWarehouse className="text-blue-400" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">
                {desempenho?.por_tipo?.galpao || 0}
              </div>
              <div className="text-slate-400">Galpão</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-blue-500"
                style={{ width: `${desempenho?.por_tipo?.galpao_percentual || 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {desempenho?.por_tipo?.galpao_percentual || 0}% do total
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesempenhoTime;
