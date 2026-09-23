/**
 * Período Comercial (Mês de Fechamento de Folha)
 * ------------------------------------------------
 * A partir de 23/07/2026 o mês de folha vai do dia 23 do mês anterior
 * ao dia 22 do mês corrente. Vendas anteriores a essa data seguem
 * o mês calendário (regra antiga).
 *
 * Exemplos (regra nova, a partir de 23/07/2026):
 *   23/07 → 22/08 = Agosto/2026
 *   23/08 → 22/09 = Setembro/2026
 *
 * Dezembro comercial (23/nov → 22/dez) fecha o ano — o time entra em
 * recesso após 22/12 e não há vendas 23-31/dez para "vazar" para janeiro.
 */

export const DIA_CORTE = 22;

/** Data a partir da qual a regra comercial entra em vigor. */
export const INICIO_REGRA_COMERCIAL = new Date('2026-07-23T00:00:00');

/** Retorna true se a data já está no regime de mês comercial. */
export function isRegraComercialAtiva(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return false;
  return d >= INICIO_REGRA_COMERCIAL;
}

/**
 * Retorna { ano, mes } (mes 0-11) referente ao mês comercial da data.
 * Antes de 23/07/2026 → mês calendário puro.
 * A partir de 23/07/2026 → dia > 22 pertence ao mês seguinte.
 */
export function mesComercial(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  if (!isRegraComercialAtiva(d)) {
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }

  if (d.getDate() > DIA_CORTE) {
    const prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { ano: prox.getFullYear(), mes: prox.getMonth() };
  }
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/**
 * Intervalo [de, ate] (Date, inclusivo com horas 00:00 / 23:59:59.999)
 * correspondente ao mês comercial informado.
 *
 * Regras:
 * - Se o mês está no regime comercial: 23/(mes-1) 00:00 → 22/mes 23:59:59
 * - Se está no regime antigo: 01/mes 00:00 → último dia/mes 23:59:59
 * - Caso especial de transição: Julho/2026 fica 01/07 → 22/07 (não 31/07),
 *   já que 23-31/07 pertence a Agosto comercial.
 */
export function intervaloDoMesComercial(ano, mes) {
  // Primeiro dia possível deste mês comercial (no calendário)
  const dataReferencia = new Date(ano, mes, 1);
  const comercialAtiva = isRegraComercialAtiva(dataReferencia) ||
    // Mês da transição: o "fim" pode cair na regra nova mesmo com início antigo
    (ano === INICIO_REGRA_COMERCIAL.getFullYear() &&
     mes === INICIO_REGRA_COMERCIAL.getMonth());

  if (!comercialAtiva) {
    // Regime antigo: mês calendário completo
    const de = new Date(ano, mes, 1, 0, 0, 0, 0);
    const ate = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
    return { de, ate };
  }

  // Regime comercial: dia 23 do mês anterior → dia 22 deste mês
  // MAS: se o mês anterior é anterior à data de transição, o "de" é 01/mes
  const inicioComercialCandidato = new Date(ano, mes - 1, DIA_CORTE + 1, 0, 0, 0, 0);
  const de = inicioComercialCandidato < INICIO_REGRA_COMERCIAL
    ? new Date(ano, mes, 1, 0, 0, 0, 0)
    : inicioComercialCandidato;
  const ate = new Date(ano, mes, DIA_CORTE, 23, 59, 59, 999);
  return { de, ate };
}

/** Mês comercial vigente (baseado em "hoje"). */
export function mesComercialAtual(hoje = new Date()) {
  return mesComercial(hoje);
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const NOMES_MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function nomeMes(mes, curto = false) {
  return curto ? NOMES_MESES_CURTOS[mes] : NOMES_MESES[mes];
}

/**
 * Rótulo humano de um mês comercial.
 * - Regime antigo: "Julho/2026"
 * - Regime comercial: "Agosto/2026 (23/jul–22/ago)"
 */
export function rotuloMesComercial(ano, mes, { curto = false } = {}) {
  const nome = nomeMes(mes, curto);
  const { de, ate } = intervaloDoMesComercial(ano, mes);
  const primeiroDia = de.getDate();
  const primeiroMes = de.getMonth();
  const ultimoDia = ate.getDate();
  const usaRegraComercial = primeiroDia !== 1 || primeiroMes !== mes;

  if (!usaRegraComercial) {
    return `${nome}/${ano}`;
  }
  const rangeStr = `${primeiroDia}/${NOMES_MESES_CURTOS[primeiroMes].toLowerCase()}–${ultimoDia}/${NOMES_MESES_CURTOS[mes].toLowerCase()}`;
  return `${nome}/${ano} (${rangeStr})`;
}

/** Subtítulo curto do range, ex "23/jul–22/ago". Null se regime antigo. */
export function rangeCurtoMesComercial(ano, mes) {
  const { de, ate } = intervaloDoMesComercial(ano, mes);
  const primeiroDia = de.getDate();
  const primeiroMes = de.getMonth();
  const ultimoDia = ate.getDate();
  if (primeiroDia === 1 && primeiroMes === mes) return null;
  return `${primeiroDia}/${NOMES_MESES_CURTOS[primeiroMes].toLowerCase()}–${ultimoDia}/${NOMES_MESES_CURTOS[mes].toLowerCase()}`;
}
