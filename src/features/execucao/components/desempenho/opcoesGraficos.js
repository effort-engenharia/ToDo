// Configuração compartilhada dos gráficos de desempenho (tema escuro). Retorna opções puras do ECharts.

export const CORES = {
  eletrica: '#eab308',
  civil: '#f97316',
  galpao: '#3b82f6',
  concluidas: '#10b981',
  emAberto: '#eab308',
  total: '#6366f1'
};

export const TIPOS = [
  { chave: 'eletrica', rotulo: 'Elétrica', cor: CORES.eletrica },
  { chave: 'civil', rotulo: 'Civil', cor: CORES.civil },
  { chave: 'galpao', rotulo: 'Galpão', cor: CORES.galpao }
];

const COR_EIXO = '#475569';
const COR_TEXTO = '#94a3b8';

const tooltip = (trigger, extra = {}) => ({
  trigger,
  backgroundColor: '#1e293b',
  borderColor: COR_EIXO,
  textStyle: { color: '#f1f5f9' },
  ...extra
});

const eixoCategoria = (data, rotulo = {}) => ({
  type: 'category',
  data,
  axisLine: { lineStyle: { color: COR_EIXO } },
  axisLabel: { color: COR_TEXTO, ...rotulo }
});

const eixoValor = () => ({
  type: 'value',
  minInterval: 1,
  axisLine: { lineStyle: { color: COR_EIXO } },
  axisLabel: { color: COR_TEXTO },
  splitLine: { lineStyle: { color: '#334155' } }
});

const legenda = (nomes) => ({ data: nomes, textStyle: { color: COR_TEXTO }, bottom: 0 });

const grade = (comLegenda) => ({
  left: '3%',
  right: '4%',
  bottom: comLegenda ? '15%' : '3%',
  ...(comLegenda ? { top: '5%' } : {}),
  containLabel: true
});

const rgba = (hex, alfa) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
};

// "2025-03-07" -> "07/03"
export const rotuloDia = (dataISO) => {
  const [, mes, dia] = String(dataISO).split('-');
  return mes && dia ? `${dia}/${mes}` : String(dataISO);
};

// series: [{ nome, dados, cor, largura?, area? }]
export function opcaoLinhas({ categorias, series, comLegenda = false }) {
  return {
    backgroundColor: 'transparent',
    tooltip: tooltip('axis'),
    ...(comLegenda ? { legend: legenda(series.map((s) => s.nome)) } : {}),
    grid: grade(comLegenda),
    xAxis: eixoCategoria(categorias),
    yAxis: eixoValor(),
    series: series.map(({ nome, dados, cor, largura = 2, area = false }) => ({
      name: nome,
      type: 'line',
      smooth: true,
      data: dados,
      lineStyle: { color: cor, width: largura },
      itemStyle: { color: cor },
      ...(area
        ? {
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: rgba(cor, 0.3) },
                  { offset: 1, color: rgba(cor, 0.05) }
                ]
              }
            }
          }
        : {})
    }))
  };
}

// series: [{ nome, dados, cor }] empilhadas
export function opcaoBarrasEmpilhadas({ categorias, series }) {
  return {
    backgroundColor: 'transparent',
    tooltip: tooltip('axis', { axisPointer: { type: 'shadow' } }),
    legend: legenda(series.map((s) => s.nome)),
    grid: grade(true),
    xAxis: eixoCategoria(categorias, { rotate: 30 }),
    yAxis: eixoValor(),
    series: series.map(({ nome, dados, cor }) => ({
      name: nome,
      type: 'bar',
      stack: 'total',
      data: dados,
      itemStyle: { color: cor }
    }))
  };
}

// itens: [{ nome, valor, cor }]
export function opcaoRosca({ itens }) {
  return {
    backgroundColor: 'transparent',
    tooltip: tooltip('item'),
    legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: COR_TEXTO } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        data: itens.map(({ nome, valor, cor }) => ({ name: nome, value: valor, itemStyle: { color: cor } })),
        label: { show: true, color: '#f1f5f9' }
      }
    ]
  };
}
