import { addDias, dataLocalISO, inicioDoDiaISO, parseDataLocal } from '../../utils/datas';

export const ATALHOS_PERIODO = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: 'personalizado', rotulo: 'Personalizado' }
];

export const PERIODO_INICIAL = { atalho: 'todos', de: '', ate: '' };

// Intervalo civil local { de, ate } (YYYY-MM-DD, ambos inclusivos) do atalho; '' = sem limite
export const intervaloDoPeriodo = ({ atalho, de = '', ate = '' } = PERIODO_INICIAL, ref = new Date()) => {
  const hoje = dataLocalISO(ref);
  switch (atalho) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case '7dias':
      return { de: dataLocalISO(addDias(ref, -6)), ate: hoje };
    case '30dias':
      return { de: dataLocalISO(addDias(ref, -29)), ate: hoje };
    case 'mes':
      return { de: dataLocalISO(new Date(ref.getFullYear(), ref.getMonth(), 1)), ate: hoje };
    case 'personalizado':
      return { de, ate };
    default:
      return { de: '', ate: '' };
  }
};

// Filtros do servidor sobre `created_at` (timestamptz): [criadoDe, criadoAte), instantes ISO no fuso local.
// O fim é exclusivo: início do dia seguinte ao último dia escolhido.
export const filtrosServidorDoPeriodo = (periodo, ref = new Date()) => {
  const { de, ate } = intervaloDoPeriodo(periodo, ref);
  return {
    criadoDe: de ? inicioDoDiaISO(de) : undefined,
    criadoAte: ate ? inicioDoDiaISO(dataLocalISO(addDias(parseDataLocal(ate), 1))) : undefined
  };
};

export const periodoAtivo = (periodo) => Boolean(periodo?.atalho) && periodo.atalho !== 'todos';
