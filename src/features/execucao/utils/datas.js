// Datas civis (YYYY-MM-DD) sempre no fuso local do navegador.
// Evita new Date('YYYY-MM-DD') (interpretado como UTC) e toISOString() (converte para UTC).

export const dataLocalISO = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseDataLocal = (valor) => {
  if (!valor) return null;
  const [y, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const formatarDataBR = (valor) =>
  parseDataLocal(valor)?.toLocaleDateString('pt-BR') ?? '—';

export const addDias = (date, n) => {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
};

// Instante (ISO/UTC) em que o dia local começa; usado para comparar com colunas timestamptz
export const inicioDoDiaISO = (valorDataLocal) =>
  (parseDataLocal(valorDataLocal) ?? new Date()).toISOString();

// Semana de segunda a domingo (padrão BR)
export const intervaloSemana = (ref = new Date()) => {
  const dia = ref.getDay();
  const inicio = addDias(ref, dia === 0 ? -6 : 1 - dia);
  return { inicio: dataLocalISO(inicio), fim: dataLocalISO(addDias(inicio, 6)) };
};

export const intervaloPeriodo = (periodo, ref = new Date()) => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  switch (periodo) {
    case 'semana':
      return intervaloSemana(ref);
    case 'trimestre': {
      const q = Math.floor(m / 3) * 3;
      return { inicio: dataLocalISO(new Date(y, q, 1)), fim: dataLocalISO(new Date(y, q + 3, 0)) };
    }
    case 'ano':
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
    case 'mes':
    default:
      return { inicio: dataLocalISO(new Date(y, m, 1)), fim: dataLocalISO(new Date(y, m + 1, 0)) };
  }
};

// Mesmo tipo de intervalo, deslocado para o período imediatamente anterior
export const intervaloPeriodoAnterior = (periodo, ref = new Date()) => {
  const r = new Date(ref.getFullYear(), ref.getMonth(), 1);
  if (periodo === 'semana') return intervaloSemana(addDias(ref, -7));
  if (periodo === 'trimestre') r.setMonth(r.getMonth() - 3);
  else if (periodo === 'ano') r.setFullYear(r.getFullYear() - 1);
  else r.setMonth(r.getMonth() - 1);
  return intervaloPeriodo(periodo, r);
};
