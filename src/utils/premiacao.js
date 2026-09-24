// Motor de cálculo da premiação do time e da comissão PJ.
// Funções puras (sem React/Supabase). Valores monetários calculados em centavos inteiros.

import { CLASSIFICACOES, MODOS_COMISSAO_PJ } from '../config/premiacao.js';

const toCents = (v) => Math.round((Number(v) || 0) * 100);
const fromCents = (c) => c / 100;

export const normalizarNome = (nome) => String(nome ?? '').toUpperCase().trim();

export function classificar(nome, config) {
  const alvo = normalizarNome(nome);
  if (!alvo) return CLASSIFICACOES.NAO_CLASSIFICADO;
  const mapa = config?.vendedores || {};
  for (const [chave, valor] of Object.entries(mapa)) {
    if (normalizarNome(chave) === alvo) return valor || CLASSIFICACOES.NAO_CLASSIFICADO;
  }
  return CLASSIFICACOES.NAO_CLASSIFICADO;
}

export function nomesPorClassificacao(config, tipo) {
  return Object.entries(config?.vendedores || {})
    .filter(([, valor]) => valor === tipo)
    .map(([nome]) => normalizarNome(nome))
    .filter((nome, i, arr) => nome && arr.indexOf(nome) === i);
}

/** Soma entrada e bruto dos contratos fechados (ativos) por vendedor, em centavos. */
export function agregarPorVendedor(data = []) {
  const mapa = {};
  for (const item of data || []) {
    if (!item || item.fase !== 'CONTRATO/VENDA' || item.ativo === false) continue;
    const nome = normalizarNome(item.proprietario_relacionamento);
    if (!nome) continue;
    if (!mapa[nome]) mapa[nome] = { nome, entradaCents: 0, brutoCents: 0, contratos: 0 };
    mapa[nome].entradaCents += toCents(parseFloat(item.valor_entrada_servico));
    mapa[nome].brutoCents += toCents(parseFloat(item.valor_total_servico));
    mapa[nome].contratos += 1;
  }
  return mapa;
}

export function metasValidas(metas) {
  const base = toCents(metas?.base);
  const ideal = toCents(metas?.ideal);
  const plus = toCents(metas?.plus);
  return base > 0 && ideal > 0 && plus > 0 && base < ideal && ideal < plus;
}

/** Nível coletivo atingido. Valores de entrada/saída em reais. */
export function calcularNivelColetivo(total, metas, gatilhoBasePct = 1, premios = {}) {
  const totalC = toCents(total);
  const gatilhoC = Math.round(toCents(metas?.base) * (1 + (Number(gatilhoBasePct) || 0) / 100));
  const niveis = [
    { id: 'base', label: 'Meta Base', limiarCents: gatilhoC, premio: Number(premios.base) || 0 },
    { id: 'ideal', label: 'Meta Ideal', limiarCents: toCents(metas?.ideal), premio: Number(premios.ideal) || 0 },
    { id: 'ideal_plus', label: 'Meta Ideal Plus', limiarCents: toCents(metas?.plus), premio: Number(premios.ideal_plus) || 0 },
  ];

  let atual = null;
  let proximo = null;
  for (const nivel of niveis) {
    if (nivel.limiarCents > 0 && totalC >= nivel.limiarCents) atual = nivel;
    else if (!proximo) proximo = nivel;
  }

  return {
    id: atual?.id || 'nenhum',
    label: atual?.label || 'Nenhum nível',
    premio: atual?.premio || 0,
    proximo: proximo
      ? {
          id: proximo.id,
          label: proximo.label,
          premio: proximo.premio,
          limiar: fromCents(proximo.limiarCents),
          falta: fromCents(Math.max(0, proximo.limiarCents - totalC)),
        }
      : null,
    limiares: {
      gatilhoBase: fromCents(gatilhoC),
      ideal: fromCents(niveis[1].limiarCents),
      plus: fromCents(niveis[2].limiarCents),
    },
  };
}

/**
 * Distribui o prêmio liberado entre os elegíveis: parte coletiva igual + parte por participação no bruto.
 * Entrada: liberadoCents, elegiveis [{ nome, brutoCents }]. Saída em centavos, soma exata = liberadoCents.
 */
export function distribuirPremio(liberadoCents, elegiveis = [], distribuicao = { coletivo: 0.3 }) {
  const n = elegiveis.length;
  const resultado = {};
  if (n === 0) {
    return { resultado, coletivoCents: 0, performanceCents: 0 };
  }

  const pctColetivo = Math.min(1, Math.max(0, Number(distribuicao?.coletivo) || 0));
  const coletivoCents = Math.round(Math.max(0, liberadoCents) * pctColetivo);
  const performanceCents = Math.max(0, liberadoCents) - coletivoCents;
  const totalBruto = elegiveis.reduce((s, e) => s + Math.max(0, e.brutoCents), 0);

  const linhas = elegiveis.map((e) => {
    const participacao = totalBruto > 0 ? Math.max(0, e.brutoCents) / totalBruto : 1 / n;
    return {
      nome: e.nome,
      participacao,
      coletivaCents: Math.round(coletivoCents / n),
      performanceCents: Math.round(performanceCents * participacao),
    };
  });

  // Sobra/falta de centavos do arredondamento vai para quem tem maior participação
  const topo = [...linhas].sort((a, b) => b.participacao - a.participacao || a.nome.localeCompare(b.nome))[0];
  topo.coletivaCents += coletivoCents - linhas.reduce((s, l) => s + l.coletivaCents, 0);
  topo.performanceCents += performanceCents - linhas.reduce((s, l) => s + l.performanceCents, 0);

  linhas.forEach((l) => {
    resultado[l.nome] = {
      participacao: l.participacao,
      coletivaCents: l.coletivaCents,
      performanceCents: l.performanceCents,
      totalCents: l.coletivaCents + l.performanceCents,
    };
  });
  return { resultado, coletivoCents, performanceCents };
}

function faixasOrdenadas(faixas = []) {
  return [...faixas].sort((a, b) => {
    if (a.ate == null) return 1;
    if (b.ate == null) return -1;
    return Number(a.ate) - Number(b.ate);
  });
}

/** Comissão PJ por faixas. Valores em reais. */
export function calcularComissaoPJ(valor, { faixas = [], modo = MODOS_COMISSAO_PJ.FAIXA_ATINGIDA } = {}) {
  const lista = faixasOrdenadas(faixas);
  const vC = Math.max(0, toCents(valor));
  const limiteC = (f) => (f.ate == null ? Infinity : toCents(f.ate));

  const faixasInfo = lista.map((f, i) => ({
    indice: i,
    de: i === 0 ? 0.01 : Number(lista[i - 1].ate) + 0.01,
    ate: f.ate == null ? null : Number(f.ate),
    pct: Number(f.pct) || 0,
  }));

  if (lista.length === 0 || vC === 0) {
    return {
      valor: fromCents(vC),
      faixaIndice: -1,
      pct: 0,
      comissao: 0,
      proxima: lista.length ? { pct: faixasInfo[0].pct, aPartirDe: faixasInfo[0].de, falta: 0.01 } : null,
      faixas: faixasInfo,
    };
  }

  const idx = lista.findIndex((f) => vC <= limiteC(f));
  const faixaIndice = idx === -1 ? lista.length - 1 : idx;
  const pct = Number(lista[faixaIndice].pct) || 0;

  let comissaoCents;
  if (modo === MODOS_COMISSAO_PJ.PROGRESSIVA) {
    let acumulado = 0;
    let inferior = 0;
    for (const f of lista) {
      const superior = Math.min(vC, limiteC(f));
      if (superior > inferior) acumulado += (superior - inferior) * ((Number(f.pct) || 0) / 100);
      if (vC <= limiteC(f)) break;
      inferior = limiteC(f);
    }
    comissaoCents = Math.round(acumulado);
  } else {
    comissaoCents = Math.round(vC * (pct / 100));
  }

  const prox = faixasInfo[faixaIndice + 1];
  return {
    valor: fromCents(vC),
    faixaIndice,
    pct,
    comissao: fromCents(comissaoCents),
    proxima: prox
      ? { pct: prox.pct, aPartirDe: prox.de, falta: fromCents(toCents(prox.de) - vC) }
      : null,
    faixas: faixasInfo,
  };
}

/**
 * Cálculo completo do mês.
 * @param {{ data: object[], metas: { base, ideal, plus }, config: object }} params
 */
export function calcularPremiacao({ data = [], metas = {}, config }) {
  const agregados = agregarPorVendedor(data);
  const vazio = (nome) => ({ nome, entradaCents: 0, brutoCents: 0, contratos: 0 });

  const efetivos = nomesPorClassificacao(config, CLASSIFICACOES.EFETIVO);
  const configurado = efetivos.length > 0 && metasValidas(metas);
  const metaIndividualC = configurado ? Math.round(toCents(metas.ideal) / efetivos.length) : 0;

  const baseLinhas = efetivos.map((nome) => {
    const a = agregados[nome] || vazio(nome);
    const elegivel = configurado && a.entradaCents >= metaIndividualC;
    return { ...a, elegivel };
  });

  const resultadoColetivoC = baseLinhas.reduce((s, l) => s + l.entradaCents, 0);
  const nivel = configurado
    ? calcularNivelColetivo(fromCents(resultadoColetivoC), metas, config.gatilhoBasePct, config.premios)
    : null;
  const liberadoC = nivel ? toCents(nivel.premio) : 0;

  const elegiveis = baseLinhas.filter((l) => l.elegivel);
  const distrib = distribuirPremio(liberadoC, elegiveis, config.distribuicao);
  const pctColetivo = Math.min(1, Math.max(0, Number(config?.distribuicao?.coletivo) || 0));
  const poolColetivoC = Math.round(liberadoC * pctColetivo);

  const linhas = baseLinhas
    .map((l) => {
      const d = distrib.resultado[l.nome];
      return {
        nome: l.nome,
        contratos: l.contratos,
        entrada: fromCents(l.entradaCents),
        bruto: fromCents(l.brutoCents),
        atingimento: metaIndividualC > 0 ? (l.entradaCents / metaIndividualC) * 100 : 0,
        faltaParaMeta: fromCents(Math.max(0, metaIndividualC - l.entradaCents)),
        elegivel: l.elegivel,
        participacao: d ? d.participacao : 0,
        parcelaColetiva: d ? fromCents(d.coletivaCents) : 0,
        parcelaPerformance: d ? fromCents(d.performanceCents) : 0,
        premioFinal: d ? fromCents(d.totalCents) : 0,
      };
    })
    .sort((a, b) => b.atingimento - a.atingimento || b.entrada - a.entrada);

  const campoBasePJ = config?.comissaoPJ?.base === 'valor_entrada_servico' ? 'entradaCents' : 'brutoCents';
  const pjs = nomesPorClassificacao(config, CLASSIFICACOES.PJ).map((nome) => {
    const a = agregados[nome] || vazio(nome);
    return {
      nome,
      contratos: a.contratos,
      entrada: fromCents(a.entradaCents),
      bruto: fromCents(a.brutoCents),
      ...calcularComissaoPJ(fromCents(a[campoBasePJ]), config?.comissaoPJ),
    };
  });

  return {
    configurado,
    metas: {
      base: Number(metas?.base) || 0,
      ideal: Number(metas?.ideal) || 0,
      plus: Number(metas?.plus) || 0,
    },
    qtdEfetivos: efetivos.length,
    metaIndividual: fromCents(metaIndividualC),
    resultadoColetivo: fromCents(resultadoColetivoC),
    nivel,
    premioLiberado: fromCents(liberadoC),
    poolColetivo: fromCents(poolColetivoC),
    poolPerformance: fromCents(liberadoC - poolColetivoC),
    premioDistribuido: fromCents(distrib.coletivoCents + distrib.performanceCents),
    qtdElegiveis: elegiveis.length,
    linhas,
    pjs,
  };
}
