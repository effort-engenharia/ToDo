// Cálculos do comparativo de cotações (plano §8). Funções puras: sem React, sem Supabase, sem efeitos.
// Taxas e percentuais são frações (0.015 = 1,5% a.m.), como em `compras_config`.
//
// Formatos de entrada (alinhados ao §5/§7; o Anexo C do backend pode exigir ajuste nos adaptadores, não aqui):
//   linha:    { id, quantidade, versao_alterada? }
//   resposta: { convite_id, fornecedor_id, empresa, versao_lista, recusou, itens:[{id|cotacao_item_id, tem_item, preco_unitario, quantidade_disponivel}],
//               condicoes:[{id?, tipo, desconto_tipo, desconto_valor, parcelas, entrada_valor, primeira_parcela_dias, total_informado}],
//               prazo_entrega_dias, frete_tipo|frete:{tipo,valor}, frete_valor, respondido_em, compras_anteriores }
import { arredondar, formatarBRL, formatarPercentual } from './moeda.js';

const EPS = 1e-9;
const LIMITE_EXAUSTIVO = 12; // M ≤ 12 → enumera subconjuntos (§8.5)

const fd = (taxa, dias) => (1 + taxa) ** (dias / 30);
const itemId = (it) => it?.id ?? it?.cotacao_item_id;
const freteDe = (r) => {
  const tipo = r?.frete_tipo ?? r?.frete?.tipo ?? 'cif';
  const valor = Number(r?.frete_valor ?? r?.frete?.valor ?? 0) || 0;
  return tipo === 'cif' ? 0 : valor;
};
const freteTipoDe = (r) => r?.frete_tipo ?? r?.frete?.tipo ?? 'cif';

// --- 8.1 Valor presente ----------------------------------------------------------------------------------------------
// Devolve { total (T, nominal dos itens), vp (VP_itens) } sem arredondar.
export const valorPresente = ({ base, condicao, taxa = 0 }) => {
  const b = Number(base) || 0;
  const c = condicao || {};
  if (c.tipo === 'parcelado') {
    const total = c.total_informado ?? b;
    const entrada = Number(c.entrada_valor) || 0;
    const n = Math.max(1, Number(c.parcelas) || 1);
    const primeira = c.primeira_parcela_dias ?? 30;
    const parcela = (total - entrada) / n;
    let vp = entrada;
    for (let k = 1; k <= n; k += 1) vp += parcela / fd(taxa, primeira + 30 * (k - 1));
    return { total, vp };
  }
  let total = b;
  if (c.desconto_tipo === 'percentual') total = b * (1 - (Number(c.desconto_valor) || 0) / 100);
  else if (c.desconto_tipo === 'valor') total = Math.max(b - (Number(c.desconto_valor) || 0), 0);
  return { total, vp: total };
};

// --- 8.2 Cobertura ---------------------------------------------------------------------------------------------------
// porLinha[id] ∈ 'atendida' | 'parcial' | 'sem_item' | 'nao_cotada' (lista mudou depois da resposta).
export const coberturaResposta = (linhas, resposta) => {
  const lista = Array.isArray(linhas) ? linhas : [];
  const versaoResp = Number(resposta?.versao_lista ?? resposta?.versao_lista_respondida ?? 0);
  const itens = new Map((resposta?.itens || []).map((i) => [itemId(i), i]));
  const porLinha = {};
  let atendidas = 0;
  let defasada = false;
  lista.forEach((l) => {
    if (Number(l.versao_alterada ?? 0) > versaoResp) { porLinha[l.id] = 'nao_cotada'; defasada = true; return; }
    const it = itens.get(l.id);
    if (!it || !it.tem_item) { porLinha[l.id] = 'sem_item'; return; }
    const disp = it.quantidade_disponivel;
    if (disp != null && Number(disp) < Number(l.quantidade)) { porLinha[l.id] = 'parcial'; return; }
    porLinha[l.id] = 'atendida';
    atendidas += 1;
  });
  return {
    porLinha,
    linhas_atendidas: atendidas,
    total_linhas: lista.length,
    completa: lista.length > 0 && atendidas === lista.length,
    defasada,
    versao_lista_respondida: versaoResp
  };
};

// Soma preco × min(quantidade, disponível) nas linhas cotadas (atendidas ou parciais).
const baseDaResposta = (linhas, resposta, cobertura) => {
  const itens = new Map((resposta?.itens || []).map((i) => [itemId(i), i]));
  return linhas.reduce((acc, l) => {
    const estado = cobertura.porLinha[l.id];
    if (estado !== 'atendida' && estado !== 'parcial') return acc;
    const it = itens.get(l.id);
    const q = it.quantidade_disponivel != null ? Math.min(Number(l.quantidade), Number(it.quantidade_disponivel)) : Number(l.quantidade);
    return acc + Number(it.preco_unitario) * q;
  }, 0);
};

// Totais de uma condição (§8.1). Sem arredondar; use `arredondar` só na exibição.
export const totaisCondicao = (resposta, condicao, linhas, taxa = 0, coberturaPronta = null) => {
  const cobertura = coberturaPronta || coberturaResposta(linhas, resposta);
  const base = baseDaResposta(linhas, resposta, cobertura);
  const { total, vp } = valorPresente({ base, condicao, taxa });
  const frete = freteDe(resposta);
  return {
    base,
    total_itens: total,
    vp_itens: vp,
    frete,
    vp_total: vp + frete,
    nominal_total: total + frete,
    fc: base > 0 ? total / base : 1,
    fvp: base > 0 ? vp / base : 1
  };
};

// --- 8.3 Candidatos --------------------------------------------------------------------------------------------------
// Um candidato por (resposta atual não recusada, condição).
export const montarCandidatos = (respostas, linhas, { taxa_mensal: taxa = 0 } = {}) => {
  const candidatos = [];
  (respostas || []).forEach((resp) => {
    if (!resp || resp.recusou) return;
    const cobertura = coberturaResposta(linhas, resp);
    if (cobertura.linhas_atendidas === 0 && !Object.values(cobertura.porLinha).includes('parcial')) return;
    (resp.condicoes || []).forEach((cond, idx) => {
      const t = totaisCondicao(resp, cond, linhas, taxa, cobertura);
      candidatos.push({
        chave: `${resp.convite_id ?? resp.fornecedor_id}:${cond.id ?? cond.tipo ?? idx}`,
        convite_id: resp.convite_id,
        fornecedor_id: resp.fornecedor_id,
        empresa: resp.empresa,
        condicao: cond,
        tipo: cond.tipo,
        ...t,
        completo: cobertura.completa,
        linhas_atendidas: cobertura.linhas_atendidas,
        total_linhas: cobertura.total_linhas,
        defasada: cobertura.defasada,
        versao_lista_respondida: cobertura.versao_lista_respondida,
        cobertura: cobertura.porLinha,
        prazo_entrega_dias: resp.prazo_entrega_dias ?? Infinity,
        frete_tipo: freteTipoDe(resp),
        compras_anteriores: Number(resp.compras_anteriores) || 0,
        respondido_em: resp.respondido_em ?? null
      });
    });
  });
  return candidatos;
};

// --- 8.4 Ranking e empate --------------------------------------------------------------------------------------------
const tempo = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isNaN(t) ? Infinity : t; };
const CRITERIOS = [
  { id: 'prazo_entrega', cmp: (a, b) => a.prazo_entrega_dias - b.prazo_entrega_dias },
  { id: 'frete_cif', cmp: (a, b) => (b.frete_tipo === 'cif' ? 1 : 0) - (a.frete_tipo === 'cif' ? 1 : 0) },
  { id: 'compras_anteriores', cmp: (a, b) => b.compras_anteriores - a.compras_anteriores },
  { id: 'respondido_em', cmp: (a, b) => tempo(a.respondido_em) - tempo(b.respondido_em) }
];
const cmpNum = (x, y) => (x === y ? 0 : x < y ? -1 : 1);

// `ordenados` já vem por VP crescente. Reordena o grupo empatado com o 1º e informa o critério que decidiu.
export const aplicarEmpate = (ordenados, empatePct = 0) => {
  if (!ordenados.length) return { ordenados: [], empatados: false, grupo: [], criterio: null };
  const vp1 = ordenados[0].vp_total;
  const noGrupo = (c) => (vp1 > 0 ? (c.vp_total - vp1) / vp1 < empatePct - EPS : c.vp_total === vp1);
  const grupo = ordenados.filter((c, i) => i === 0 || noGrupo(c));
  const resto = ordenados.filter((c) => !grupo.includes(c));
  if (grupo.length < 2) return { ordenados: [...ordenados], empatados: false, grupo: [], criterio: null };
  const ordGrupo = [...grupo].sort((a, b) => {
    for (const k of CRITERIOS) { const d = cmpNum(k.cmp(a, b), 0); if (d !== 0) return d; }
    return cmpNum(a.vp_total, b.vp_total);
  });
  const decisivo = CRITERIOS.find((k) => k.cmp(ordGrupo[0], ordGrupo[1]) !== 0);
  return { ordenados: [...ordGrupo, ...resto], empatados: true, grupo: ordGrupo, criterio: decisivo ? decisivo.id : 'valor' };
};

// Por fornecedor, só a condição de menor VP_total; as outras ficam em `alternativas`.
const melhorCondicaoPorFornecedor = (candidatos) => {
  const grupos = new Map();
  candidatos.forEach((c) => {
    const k = c.convite_id ?? c.fornecedor_id;
    grupos.set(k, [...(grupos.get(k) || []), c]);
  });
  return [...grupos.values()].map((cs) => {
    const ord = [...cs].sort((x, y) => cmpNum(x.vp_total, y.vp_total) || (x.tipo === 'a_vista' ? -1 : 1) - (y.tipo === 'a_vista' ? -1 : 1));
    return { ...ord[0], alternativas: ord.slice(1) };
  });
};

const delta = (valor, ref) => ({ valor: valor - ref, pct: ref > 0 ? (valor - ref) / ref : 0 });

// Ranking global (§8.4). modo: 'completo' (há ≥ 1 completa), 'parcial' (só parciais) ou 'vazio'.
export const rankingGlobal = (candidatos, { empate_pct: empatePct = 0.01 } = {}) => {
  const unicos = melhorCondicaoPorFornecedor(candidatos || []);
  const porVp = (a, b) => cmpNum(a.vp_total, b.vp_total);
  const completos = unicos.filter((c) => c.completo).sort(porVp);
  const parciais = unicos.filter((c) => !c.completo)
    .sort((a, b) => cmpNum(b.linhas_atendidas, a.linhas_atendidas) || porVp(a, b));
  if (!unicos.length) return { modo: 'vazio', ordenados: [], melhor: null, empatados: false, criterioDesempate: null, deltaSegundo: null, deltaMaisCara: null };

  if (completos.length) {
    const emp = aplicarEmpate(completos, empatePct);
    const ord = emp.ordenados;
    return {
      modo: 'completo',
      ordenados: [...ord, ...parciais],
      melhor: ord[0],
      empatados: emp.empatados,
      empatadosChaves: emp.grupo.map((c) => c.chave),
      criterioDesempate: emp.criterio,
      deltaSegundo: ord.length > 1 ? delta(ord[1].vp_total, ord[0].vp_total) : null,
      deltaMaisCara: ord.length > 1 ? delta(ord[ord.length - 1].vp_total, ord[0].vp_total) : null
    };
  }
  const maxCob = parciais[0].linhas_atendidas;
  const topo = parciais.filter((c) => c.linhas_atendidas === maxCob);
  const emp = aplicarEmpate(topo, empatePct);
  const ord = [...emp.ordenados, ...parciais.filter((c) => c.linhas_atendidas !== maxCob)];
  return {
    modo: 'parcial',
    ordenados: ord,
    melhor: ord[0], // "Melhor parcial"
    empatados: emp.empatados,
    empatadosChaves: emp.grupo.map((c) => c.chave),
    criterioDesempate: emp.criterio,
    deltaSegundo: null,
    deltaMaisCara: null
  };
};

// --- 8.5 Combinação dividida -----------------------------------------------------------------------------------------
// Compra dividida por item: cada linha vai ao fornecedor (que a atende integralmente) de menor preço VP, somando frete
// de quem receber ≥ 1 linha. Mostra só se usa ≥ 2 fornecedores e economiza vs. o melhor único completo.
export const combinacaoDividida = (respostas, linhas, { taxa_mensal: taxa = 0, empate_pct: empatePct = 0.01 } = {}) => {
  const lista = Array.isArray(linhas) ? linhas : [];
  const candidatos = montarCandidatos(respostas, lista, { taxa_mensal: taxa });
  const ranking = rankingGlobal(candidatos, { empate_pct: empatePct });
  const vpUnico = ranking.modo === 'completo' ? ranking.melhor.vp_total : null;

  // 1 condição por fornecedor: menor fvp; empate → à vista
  const porForn = new Map();
  candidatos.forEach((c) => {
    const k = c.convite_id ?? c.fornecedor_id;
    const a = porForn.get(k);
    if (!a || c.fvp < a.fvp - EPS || (Math.abs(c.fvp - a.fvp) <= EPS && c.tipo === 'a_vista' && a.tipo !== 'a_vista')) porForn.set(k, c);
  });
  const respPorChave = new Map((respostas || []).map((r) => [r.convite_id ?? r.fornecedor_id, r]));
  const forns = [...porForn.entries()].map(([k, cand]) => {
    const resp = respPorChave.get(k);
    const itens = new Map((resp.itens || []).map((i) => [itemId(i), i]));
    const preco = new Map();
    lista.forEach((l) => {
      if (cand.cobertura[l.id] !== 'atendida') return;
      const p = Number(itens.get(l.id).preco_unitario);
      preco.set(l.id, { base: p, nominal: p * cand.fc, vp: p * cand.fvp });
    });
    return { chave: k, cand, preco, frete: cand.frete, prazo: cand.prazo_entrega_dias };
  });
  const M = forns.length;
  if (M === 0) return null;

  // Para cada linha: fornecedores que a atendem, do mais barato ao mais caro (desempate: prazo, índice)
  const ordemLinha = lista.map((l) => forns
    .map((f, i) => ({ i, p: f.preco.get(l.id) }))
    .filter((x) => x.p)
    .sort((a, b) => cmpNum(a.p.vp, b.p.vp) || cmpNum(forns[a.i].prazo, forns[b.i].prazo) || a.i - b.i));

  const avaliar = (dentro) => {
    let custo = 0;
    let semCobertura = 0;
    const usados = new Uint8Array(M);
    lista.forEach((l, li) => {
      const escolhido = ordemLinha[li].find((x) => dentro[x.i]);
      if (!escolhido) { semCobertura += 1; return; }
      usados[escolhido.i] = 1;
      custo += escolhido.p.vp * Number(l.quantidade);
    });
    let nUsados = 0;
    usados.forEach((u, i) => { if (u) { nUsados += 1; custo += forns[i].frete; } });
    return { custo, semCobertura, nUsados };
  };
  const melhorQue = (a, b) => !b
    || a.semCobertura < b.semCobertura
    || (a.semCobertura === b.semCobertura && (a.custo < b.custo - EPS || (Math.abs(a.custo - b.custo) <= EPS && a.nUsados < b.nUsados)));

  let melhor = null;
  let melhorSet = null;
  let modo;
  if (M <= LIMITE_EXAUSTIVO) {
    modo = 'exaustivo';
    const dentro = new Uint8Array(M);
    for (let mask = 1; mask < (1 << M); mask += 1) {
      for (let i = 0; i < M; i += 1) dentro[i] = (mask >> i) & 1;
      const av = avaliar(dentro);
      if (melhorQue(av, melhor)) { melhor = av; melhorSet = Uint8Array.from(dentro); }
    }
  } else {
    modo = 'guloso';
    const dentro = new Uint8Array(M);
    const chaveMelhor = ranking.modo === 'completo' ? (ranking.melhor.convite_id ?? ranking.melhor.fornecedor_id) : null;
    let inicio = chaveMelhor == null ? -1 : forns.findIndex((f) => f.chave === chaveMelhor);
    if (inicio < 0) inicio = forns.reduce((best, f, i) => (f.preco.size > forns[best].preco.size ? i : best), 0);
    dentro[inicio] = 1;
    melhor = avaliar(dentro);
    for (;;) {
      let passo = null;
      let passoI = -1;
      for (let i = 0; i < M; i += 1) {
        if (dentro[i]) continue;
        dentro[i] = 1;
        const av = avaliar(dentro);
        dentro[i] = 0;
        if (melhorQue(av, melhor) && melhorQue(av, passo)) { passo = av; passoI = i; }
      }
      if (passoI < 0) break;
      dentro[passoI] = 1;
      melhor = passo;
    }
    melhorSet = dentro;
  }

  // Atribuições finais
  const atribuicoes = [];
  const usados = new Set();
  lista.forEach((l, li) => {
    const x = ordemLinha[li].find((y) => melhorSet[y.i]);
    if (!x) return;
    const f = forns[x.i];
    usados.add(x.i);
    atribuicoes.push({
      linha_id: l.id,
      convite_id: f.cand.convite_id,
      fornecedor_id: f.cand.fornecedor_id,
      empresa: f.cand.empresa,
      condicao: f.cand.condicao,
      quantidade: Number(l.quantidade),
      preco_unitario_base: x.p.base,
      preco_unitario_nominal: x.p.nominal,
      preco_unitario_vp: x.p.vp,
      subtotal_vp: x.p.vp * Number(l.quantidade)
    });
  });
  const fornecedoresUsados = [...usados].map((i) => ({
    convite_id: forns[i].cand.convite_id,
    fornecedor_id: forns[i].cand.fornecedor_id,
    empresa: forns[i].cand.empresa,
    condicao: forns[i].cand.condicao,
    frete: forns[i].frete,
    prazo_entrega_dias: forns[i].prazo
  }));
  const cobreTudo = melhor.semCobertura === 0;
  const economia = vpUnico == null ? null : vpUnico - melhor.custo;
  const mostrar = cobreTudo && usados.size >= 2 && (vpUnico == null || arredondar(economia, 2) > 0);
  return {
    modo,
    mostrar,
    cobre_tudo: cobreTudo,
    unica_forma_de_cobrir: mostrar && vpUnico == null,
    custo: melhor.custo,
    frete_total: fornecedoresUsados.reduce((s, f) => s + f.frete, 0),
    linhas_sem_cobertura: melhor.semCobertura,
    vp_unico: vpUnico,
    economia,
    economia_pct: economia != null && vpUnico > 0 ? economia / vpUnico : null,
    fornecedores: fornecedoresUsados,
    atribuicoes,
    // N3: desconto em R$ "à vista" deixa de valer quando a compra é dividida
    aviso_desconto_valor: fornecedoresUsados.some((f) => f.condicao?.tipo === 'a_vista' && f.condicao?.desconto_tipo === 'valor')
  };
};

// --- 8.6 Variação vs. referência -------------------------------------------------------------------------------------
// `materialId` null/'' = material não confirmado; `undefined` = não informado (tratado como confirmado).
// `referencia`: { media_janela, n_janela, fora_janela, n_total, ultimo:{preco_vp, data, quantidade, fornecedor}, menor:{preco_vp, data} } ou null.
export const variacaoReferencia = ({ precoVp, referencia, materialId, faixaNeutraPct = 0.02, alertaPct = 0.10 }) => {
  if (materialId === null || materialId === '') {
    return { status: 'sem_material', texto: 'confirme o material para comparar', cor: 'cinza', alerta: false };
  }
  const ref = referencia?.media_janela;
  if (!referencia || ref == null || !(Number(ref) > 0) || referencia.n_total === 0) {
    return { status: 'primeiro_registro', texto: 'primeiro registro', cor: 'cinza', alerta: false };
  }
  const media = Number(ref);
  const d = Number(precoVp) - media;
  const pct = d / media;
  const cor = Math.abs(pct) <= faixaNeutraPct + EPS ? 'cinza' : d < 0 ? 'verde' : 'vermelho';
  const sinal = d > 0 ? '+' : d < 0 ? '−' : '';
  return {
    status: 'ok',
    referencia: media,
    delta: d,
    deltaPct: pct,
    cor,
    alerta: pct > alertaPct + EPS,
    antiga: !(Number(referencia.n_janela) > 0),
    texto: `${formatarBRL(precoVp)} (${sinal}${formatarBRL(Math.abs(d))} / ${formatarPercentual(pct, { sinal: true })} vs. média)`,
    detalhe: {
      ultima: referencia.ultimo ?? null,
      menor: referencia.menor ?? null,
      quantidadeReferencia: referencia.ultimo?.quantidade ?? null
    }
  };
};

// Por cotação: Σ(ref × quantidade) vs. total da decisão nas mesmas linhas. itens: [{ref, quantidade, preco_vp}] (ref nulo = ignora).
export const variacaoTotalCotacao = (itens) => {
  const comRef = (itens || []).filter((i) => i.ref != null && Number(i.ref) > 0);
  if (!comRef.length) return null;
  const totalRef = comRef.reduce((s, i) => s + Number(i.ref) * Number(i.quantidade), 0);
  const totalDecisao = comRef.reduce((s, i) => s + Number(i.preco_vp) * Number(i.quantidade), 0);
  const d = totalDecisao - totalRef;
  const pct = totalRef > 0 ? d / totalRef : 0;
  return {
    totalRef,
    totalDecisao,
    delta: d,
    deltaPct: pct,
    texto: d <= 0
      ? `economia de ${formatarBRL(Math.abs(d))} (${formatarPercentual(pct)})`
      : `acima da referência em ${formatarBRL(d)} (${formatarPercentual(pct, { sinal: true })})`
  };
};
