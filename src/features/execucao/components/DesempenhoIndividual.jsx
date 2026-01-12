import React, { useState, useEffect } from 'react';
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
import * as echarts from 'echarts';
import { execucaoService } from '../../../services/supabase/execucao';

const DesempenhoIndividual = ({ usuario }) => {
  const [loading, setLoading] = useState(true);
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(null);
  const [periodo, setPeriodo] = useState('mes');
  const [desempenho, setDesempenho] = useState(null);

  const chartRef = React.useRef(null);
  const pieChartRef = React.useRef(null);

  useEffect(() => {
    carregarTecnicos();
  }, []);

  useEffect(() => {
    if (tecnicoSelecionado) {
      carregarDesempenho();
    }
  }, [tecnicoSelecionado, periodo]);

  useEffect(() => {
    if (desempenho && chartRef.current) {
      renderizarGraficoLinha();
    }
    if (desempenho && pieChartRef.current) {
      renderizarGraficoPie();
    }
  }, [desempenho]);

  const carregarTecnicos = async () => {
    try {
      const result = await execucaoService.listarTecnicos();
      if (result.success) {
        setTecnicos(result.data);
        if (result.data.length > 0) {
          setTecnicoSelecionado(result.data[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    }
  };

  const carregarDesempenho = async () => {
    setLoading(true);
    try {
      const result = await execucaoService.buscarDesempenhoIndividual(tecnicoSelecionado, periodo);
      if (result.success) {
        setDesempenho(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar desempenho:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderizarGraficoLinha = () => {
    const chart = echarts.init(chartRef.current);
    
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f1f5f9' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: desempenho?.historico?.map(h => h.data) || [],
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
          name: 'Concluídas',
          type: 'line',
          smooth: true,
          data: desempenho?.historico?.map(h => h.concluidas) || [],
          lineStyle: { color: '#10b981', width: 3 },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ])
          }
        },
        {
          name: 'Total',
          type: 'line',
          smooth: true,
          data: desempenho?.historico?.map(h => h.total) || [],
          lineStyle: { color: '#6366f1', width: 2 },
          itemStyle: { color: '#6366f1' }
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

  const renderizarGraficoPie = () => {
    const chart = echarts.init(pieChartRef.current);
    
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#f1f5f9' }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#94a3b8' }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          data: [
            { value: desempenho?.por_tipo?.eletrica || 0, name: 'Elétrica', itemStyle: { color: '#eab308' } },
            { value: desempenho?.por_tipo?.civil || 0, name: 'Civil', itemStyle: { color: '#f97316' } },
            { value: desempenho?.por_tipo?.galpao || 0, name: 'Galpão', itemStyle: { color: '#3b82f6' } }
          ],
          label: {
            show: true,
            color: '#f1f5f9'
          }
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

  const getTecnicoAtual = () => {
    return tecnicos.find(t => t.id === tecnicoSelecionado);
  };

  const calcularPorcentagem = (valor, total) => {
    if (!total) return 0;
    return Math.round((valor / total) * 100);
  };

  if (loading && !desempenho) {
    return (
      <div className="execucao-loading">
        <div className="execucao-spinner"></div>
      </div>
    );
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <FaUser className="text-slate-400" />
          <select
            value={tecnicoSelecionado || ''}
            onChange={(e) => setTecnicoSelecionado(e.target.value)}
            className="execucao-form-select"
          >
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>{t.nome_completo}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Card do técnico */}
      <div className="execucao-card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {getTecnicoAtual()?.nome_completo?.charAt(0) || 'T'}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-100">
              {getTecnicoAtual()?.nome_completo || 'Técnico'}
            </h3>
            <p className="text-slate-400">{getTecnicoAtual()?.email}</p>
          </div>
          {desempenho?.ranking && (
            <div className="text-center">
              <div className="flex items-center gap-2 text-yellow-400">
                <FaTrophy size={24} />
                <span className="text-2xl font-bold">#{desempenho.ranking}</span>
              </div>
              <span className="text-sm text-slate-400">Ranking</span>
            </div>
          )}
        </div>
      </div>

      {/* Métricas principais */}
      <div className="execucao-grid execucao-grid-4 mb-6">
        <div className="execucao-stat-card">
          <div className="execucao-stat-icon blue">
            <FaCalendarAlt />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Total de Atividades</div>
            <div className="execucao-stat-value">{desempenho?.total || 0}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Concluídas</div>
            <div className="execucao-stat-value">{desempenho?.concluidas || 0}</div>
            <div className="text-xs text-green-400">
              {calcularPorcentagem(desempenho?.concluidas, desempenho?.total)}%
            </div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon yellow">
            <FaClock />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Pendentes</div>
            <div className="execucao-stat-value">{desempenho?.pendentes || 0}</div>
          </div>
        </div>

        <div className="execucao-stat-card">
          <div className="execucao-stat-icon purple">
            <FaStar />
          </div>
          <div className="execucao-stat-content">
            <div className="execucao-stat-label">Taxa de Conclusão</div>
            <div className="execucao-stat-value">
              {calcularPorcentagem(desempenho?.concluidas, desempenho?.total)}%
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaChartLine className="text-blue-400" />
              Evolução de Atividades
            </h3>
          </div>
          <div ref={chartRef} className="h-72"></div>
        </div>

        <div className="execucao-card">
          <div className="execucao-card-header">
            <h3 className="execucao-card-title">
              <FaFilter className="text-purple-400" />
              Distribuição por Tipo
            </h3>
          </div>
          <div ref={pieChartRef} className="h-72"></div>
        </div>
      </div>

      {/* Detalhamento por tipo */}
      <div className="execucao-card">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">Detalhamento por Tipo</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <FaBolt className="text-yellow-400" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100">Elétrica</h4>
                <span className="text-sm text-slate-400">
                  {desempenho?.por_tipo?.eletrica || 0} atividades
                </span>
              </div>
            </div>
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-yellow-500"
                style={{ width: `${calcularPorcentagem(desempenho?.por_tipo?.eletrica, desempenho?.total)}%` }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg border border-orange-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <FaHardHat className="text-orange-400" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100">Civil</h4>
                <span className="text-sm text-slate-400">
                  {desempenho?.por_tipo?.civil || 0} atividades
                </span>
              </div>
            </div>
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-orange-500"
                style={{ width: `${calcularPorcentagem(desempenho?.por_tipo?.civil, desempenho?.total)}%` }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FaWarehouse className="text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100">Galpão</h4>
                <span className="text-sm text-slate-400">
                  {desempenho?.por_tipo?.galpao || 0} atividades
                </span>
              </div>
            </div>
            <div className="execucao-progress">
              <div 
                className="execucao-progress-bar bg-blue-500"
                style={{ width: `${calcularPorcentagem(desempenho?.por_tipo?.galpao, desempenho?.total)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesempenhoIndividual;
