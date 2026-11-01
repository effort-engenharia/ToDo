export const PERIODOS = [
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['trimestre', 'Trimestre'],
  ['ano', 'Ano'],
  ['todos', 'Todas']
];

export const STATUS = [
  ['todos', 'Todos os Status'],
  ['planejada', 'Planejadas'],
  ['em_andamento', 'Em Andamento'],
  ['concluida', 'Concluídas'],
  ['pausada', 'Pausadas']
];

export const ORDENACOES = [
  ['data', 'Ordenar: por início'],
  ['saude', 'Ordenar: piores primeiro']
];

export const FILTROS_PADRAO = { periodo: 'mes', status: 'todos', carteira: 'todos', ordenacao: 'data', ocultarRapidos: false };

// Quantos filtros diferem do padrão (alimenta o contador do botão "Filtros")
export const contarFiltrosAtivos = ({ periodo, status, carteira, ordenacao, ocultarRapidos }) => [
  periodo !== FILTROS_PADRAO.periodo,
  status !== FILTROS_PADRAO.status,
  carteira !== FILTROS_PADRAO.carteira,
  ordenacao !== FILTROS_PADRAO.ordenacao,
  ocultarRapidos
].filter(Boolean).length;

export const rotuloPeriodoObras = (valor) => PERIODOS.find(([v]) => v === valor)?.[1] ?? valor;
export const rotuloStatusObras = (valor) => STATUS.find(([v]) => v === valor)?.[1] ?? valor;

export const idAba = (id) => `plan-aba-${id}`;
export const idPainelAba = (id) => `plan-painel-${id}`;
