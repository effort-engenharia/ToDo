import { intervaloDoMesComercial } from './periodoComercial.js';

/**
 * Semanas Comerciais
 * ------------------
 * Dado um mês comercial (ex.: 23/jul → 22/ago), divide em 4 blocos
 * aproximadamente iguais. As sobras vão para a última semana.
 *
 * Uso principal:
 * - "Em qual semana estamos?" para o SemanaAtualCard do Dashboard V2
 * - Bucketing de vendas por semana no VendasPorSemana chart
 * - Cor da barra de progresso (verde → amarelo → laranja → vermelho)
 */

/**
 * Retorna array de 4 objetos com { numero, de, ate, dias, corIndex }.
 * `corIndex` = 0..3 → mapeia para semanaCores[i] em effortTheme.js
 *
 * @param {number} ano
 * @param {number} mes 0-11
 */
export function semanasDoMesComercial(ano, mes) {
  const { de, ate } = intervaloDoMesComercial(ano, mes);
  const inicioMs = de.getTime();
  const fimMs = ate.getTime();
  const totalMs = fimMs - inicioMs;
  const totalDias = Math.round(totalMs / (1000 * 60 * 60 * 24)) + 1;

  // 4 semanas — divide dias em 4 blocos
  const diasPorSemana = Math.floor(totalDias / 4);
  const sobra = totalDias - diasPorSemana * 4;

  const semanas = [];
  let cursorInicio = new Date(de);

  for (let i = 0; i < 4; i++) {
    // Última semana absorve a sobra
    const dias = i === 3 ? diasPorSemana + sobra : diasPorSemana;
    const inicio = new Date(cursorInicio);
    inicio.setHours(0, 0, 0, 0);

    const fim = new Date(cursorInicio);
    fim.setDate(fim.getDate() + dias - 1);
    fim.setHours(23, 59, 59, 999);

    semanas.push({
      numero: i + 1,
      corIndex: i,
      de: inicio,
      ate: fim,
      dias,
    });

    cursorInicio = new Date(fim);
    cursorInicio.setDate(cursorInicio.getDate() + 1);
    cursorInicio.setHours(0, 0, 0, 0);
  }

  return semanas;
}

/**
 * Retorna a semana atual (1..4) dentro do mês comercial informado,
 * ou null se `hoje` está fora do mês comercial.
 *
 * @param {number} ano
 * @param {number} mes 0-11
 * @param {Date} hoje
 */
export function semanaAtualDoMesComercial(ano, mes, hoje = new Date()) {
  const semanas = semanasDoMesComercial(ano, mes);
  const nowMs = hoje.getTime();
  for (const s of semanas) {
    if (nowMs >= s.de.getTime() && nowMs <= s.ate.getTime()) {
      return s;
    }
  }
  return null;
}

/**
 * Dias restantes na semana atual (inteiro >= 0).
 * Se hoje está fora do mês comercial, retorna 0.
 */
export function diasRestantesNaSemana(ano, mes, hoje = new Date()) {
  const semanaAtual = semanaAtualDoMesComercial(ano, mes, hoje);
  if (!semanaAtual) return 0;
  const nowMs = hoje.getTime();
  const restanteMs = semanaAtual.ate.getTime() - nowMs;
  return Math.max(0, Math.ceil(restanteMs / (1000 * 60 * 60 * 24)));
}

/**
 * Dias úteis (seg-sex) restantes no mês comercial inteiro.
 */
export function diasUteisRestantesNoMes(ano, mes, hoje = new Date()) {
  const { ate } = intervaloDoMesComercial(ano, mes);
  if (hoje.getTime() > ate.getTime()) return 0;

  const cursor = new Date(hoje);
  cursor.setHours(0, 0, 0, 0);
  const fim = new Date(ate);
  fim.setHours(0, 0, 0, 0);

  let uteis = 0;
  while (cursor <= fim) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) uteis++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return uteis;
}

/**
 * Bucket: dado um array de vendas com propriedade `data` (Date ou string ISO),
 * agrupa por semana comercial e retorna [{ semana, total, count, vendas[] }].
 *
 * @param {Array} vendas item deve ter `.data` e `.valor` (opcional)
 * @param {number} ano
 * @param {number} mes 0-11
 */
export function agruparVendasPorSemana(vendas, ano, mes) {
  const semanas = semanasDoMesComercial(ano, mes);
  const buckets = semanas.map((s) => ({
    semana: s,
    total: 0,
    count: 0,
    vendas: [],
  }));

  vendas.forEach((v) => {
    const d = v.data instanceof Date ? v.data : new Date(v.data);
    if (isNaN(d.getTime())) return;
    const ms = d.getTime();
    for (const b of buckets) {
      if (ms >= b.semana.de.getTime() && ms <= b.semana.ate.getTime()) {
        b.total += Number(v.valor || 0);
        b.count += 1;
        b.vendas.push(v);
        break;
      }
    }
  });

  return buckets;
}

/**
 * Retorna percentual (0-100+) da posição de `hoje` dentro da semana atual.
 * Útil para mostrar barra de progresso mini.
 */
export function progressoSemanaAtual(ano, mes, hoje = new Date()) {
  const s = semanaAtualDoMesComercial(ano, mes, hoje);
  if (!s) return 0;
  const total = s.ate.getTime() - s.de.getTime();
  const passado = hoje.getTime() - s.de.getTime();
  return Math.min(100, Math.max(0, (passado / total) * 100));
}
