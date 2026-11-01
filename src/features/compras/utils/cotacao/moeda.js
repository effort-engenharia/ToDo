// Helpers puros de moeda/percentual (pt-BR). Sem React e sem Supabase: também são usados pela página pública (§9).

// Arredondamento "half-up" (plano §8.1): Math.round sobre a escala; o epsilon evita 1.005 → 1.00 por ruído binário.
export const arredondar = (valor, casas = 2) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** casas;
  const r = Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
  return n < 0 ? -r : r;
};

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// `casas` permite 4 decimais para preço unitário.
export const formatarBRL = (valor, casas = 2) => {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(n)) return '—';
  if (casas === 2) return fmtBRL.format(arredondar(n, 2)).replace(/\u00a0/g, ' ');
  return `R$ ${arredondar(n, casas).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
};

// Aceita "1.234,56", "R$ 12,5", "12.5". Ponto sem vírgula é decimal, exceto "1.234" (grupo de 3 = milhar) ou vários pontos.
// Devolve null se inválido.
export const parseBRL = (texto) => {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  if (typeof texto !== 'string') return null;
  let s = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  } else if (/^-?\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace('.', '');
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Fração (0.116) → "11,6%"; com `sinal`, "+11,6%". Negativo usa "−".
export const formatarPercentual = (fracao, { sinal = false, casas = 1 } = {}) => {
  const n = Number(fracao);
  if (!Number.isFinite(n)) return '—';
  const pct = arredondar(n * 100, casas);
  const txt = `${Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
  if (pct < 0) return `−${txt}`;
  return sinal && pct > 0 ? `+${txt}` : txt;
};
