// Derivações do comparativo para as telas (RankingPropostas, MatrizComparativa, ModalDecisao). Funções puras.
// Os cálculos pesados ficam em comparacao.js; aqui só se combina o contrato do detalhe (adaptadores) com a apresentação.
import { combinacaoDividida, montarCandidatos, rankingGlobal, variacaoReferencia, variacaoTotalCotacao } from './comparacao';
import { linhasAtivasDoDetalhe, respostasDoDetalhe } from './adaptadores';
import { formatarBRL } from './moeda';

export const rotuloCondicao = (c) => {
  if (!c) return '—';
  if (c.tipo === 'parcelado') {
    const ent = Number(c.entrada_valor) > 0 ? `, entrada ${formatarBRL(c.entrada_valor)}` : '';
    return `${c.parcelas}x${ent}`;
  }
  if (c.desconto_tipo === 'percentual') return `À vista (−${Number(c.desconto_valor).toLocaleString('pt-BR')}%)`;
  if (c.desconto_tipo === 'valor') return `À vista (−${formatarBRL(c.desconto_valor)})`;
  return 'À vista';
};

const num = (v, padrao) => { const n = Number(v); return Number.isFinite(n) ? n : padrao; };

export const calcularComparativo = (detalhe, config = {}) => {
  const cotacao = detalhe?.cotacao ?? {};
  const taxa = num(cotacao.taxa_mensal, num(config?.taxa_mensal, 0));
  const empate = num(cotacao.empate_pct, num(config?.empate_pct, 0.01));
  // Linhas e respostas dos helpers. `versao_lista` da cotação vale para respostas sem a versão.
  const linhas = linhasAtivasDoDetalhe(detalhe);
  const respostas = respostasDoDetalhe(detalhe).filter((r) => !r.recusou);
  const opcoes = { taxa_mensal: taxa, empate_pct: empate };
  const candidatos = montarCandidatos(respostas, linhas, opcoes);
  const ranking = rankingGlobal(candidatos, opcoes);
  const divisao = respostas.length >= 2 ? combinacaoDividida(respostas, linhas, opcoes) : null;
  return { cotacao, taxa, empate, linhas, respostas, candidatos, ranking, divisao };
};

// Candidato "padrão" por fornecedor (a condição de menor VP). Chave: convite_id.
export const candidatosPorConvite = (ranking) => new Map((ranking?.ordenados ?? []).map((c) => [c.convite_id, c]));

// Célula da matriz: estado do item para o fornecedor + preços comparáveis
export const celulaDaMatriz = (linha, resposta, candidato) => {
  if (!resposta || !candidato) return { estado: 'sem_resposta' };
  const estado = candidato.cobertura?.[linha.id];
  const it = (resposta.itens ?? []).find((i) => (i.id ?? i.cotacao_item_id) === linha.id);
  if (estado === 'nao_cotada') return { estado };
  if (!it || !it.tem_item) return { estado: 'sem_item' };
  const p = num(it.preco_unitario, null);
  return {
    estado: estado === 'parcial' ? 'parcial' : 'atendida',
    precoBase: p,
    precoVp: p == null ? null : p * candidato.fvp,
    precoNominal: p == null ? null : p * candidato.fc,
    quantidadeDisponivel: it.quantidade_disponivel ?? null
  };
};

// Variação vs. referência de uma célula (§8.6). `referencias` = detalhe.referencias; config traz faixa/alerta.
export const variacaoDaCelula = (linha, celula, referencias, config = {}) => {
  if (celula?.precoVp == null) return null;
  return variacaoReferencia({
    precoVp: celula.precoVp,
    referencia: linha.material_id ? referencias?.[linha.material_id] ?? null : null,
    materialId: linha.material_id ?? null,
    faixaNeutraPct: num(config?.faixa_neutra_pct, 0.02),
    alertaPct: num(config?.alerta_pct, 0.1)
  });
};

// Fornecedores (convites) mais baratos por linha entre as células atendidas integralmente
export const menoresPorLinha = (linhas, respostas, porConvite) => {
  const saida = {};
  linhas.forEach((l) => {
    let melhor = null;
    respostas.forEach((r) => {
      const cel = celulaDaMatriz(l, r, porConvite.get(r.convite_id));
      if (cel.estado === 'atendida' && cel.precoVp != null && (melhor === null || cel.precoVp < melhor.vp - 1e-9)) melhor = { vp: cel.precoVp, convite_id: r.convite_id };
    });
    saida[l.id] = melhor?.convite_id ?? null;
  });
  return saida;
};

// Snapshot gravado em `compras_cotacao_decisoes.recomendacao_snapshot`.
// `vencedor_recomendado_fornecedor_id` alimenta o KPI K7 (vitórias, migration 39): é o 1º do ranking no momento da decisão.
export const snapshotRecomendacao = ({ ranking, divisao }) => ({
  vencedor_recomendado_fornecedor_id: ranking?.melhor?.fornecedor_id ?? null,
  vencedor_recomendado_convite_id: ranking?.melhor?.convite_id ?? null,
  modo_ranking: ranking?.modo ?? 'vazio',
  empate_tecnico: Boolean(ranking?.empatados),
  vp_recomendado: ranking?.melhor ? ranking.melhor.vp_total : null,
  divisao_mostrada: Boolean(divisao?.mostrar),
  divisao_economia: divisao?.mostrar && divisao.economia != null ? divisao.economia : null
});

// Recomendação do sistema (§8.4): melhor único quando há proposta completa; senão a divisão que cobre tudo.
export const recomendacaoDoSistema = ({ ranking, divisao }) => {
  if (ranking?.modo === 'completo') return { modo: 'unico', convite_id: ranking.melhor.convite_id, vp: ranking.melhor.vp_total };
  if (ranking?.modo === 'parcial' && divisao?.mostrar && divisao.cobre_tudo) return { modo: 'dividido', convite_id: null, vp: divisao.custo };
  return { modo: null, convite_id: null, vp: null };
};

// Foge da recomendação quando custa mais que ela (mesma regra do servidor: "proposta completa mais barata que a escolhida").
// Uma divisão mais barata ou igual segue a recomendação. Devolve { foge, diferenca: { valor, pct } | null }.
export const fugaDaRecomendacao = ({ comparativo, escolha }) => {
  const rec = recomendacaoDoSistema(comparativo);
  const tot = totaisDaEscolha({ comparativo, escolha });
  if (rec.vp == null || !tot) return { foge: false, diferenca: null };
  const valor = tot.vp - rec.vp;
  return { foge: valor > 0.005, diferenca: valor > 0.005 ? { valor, pct: rec.vp > 0 ? valor / rec.vp : 0 } : null };
};

// Monta o payload de `compras_cotacao_decidir`. escolha: { modo, conviteId?, porLinha?: {linhaId: conviteId} }
export const montarDecisao = ({ comparativo, escolha, datas, justificativa }) => {
  const { ranking, divisao, linhas } = comparativo;
  const porConvite = candidatosPorConvite(ranking);
  const condDe = (conviteId) => porConvite.get(conviteId)?.tipo ?? null;
  let itens = [];
  if (escolha.modo === 'unico') {
    itens = linhas.map((l) => ({ cotacao_item_id: l.id, convite_id: escolha.conviteId, condicao_tipo: condDe(escolha.conviteId) }));
  } else if (escolha.modo === 'dividido') {
    itens = (divisao?.atribuicoes ?? []).map((a) => ({ cotacao_item_id: a.linha_id, convite_id: a.convite_id, condicao_tipo: a.condicao?.tipo }));
  } else {
    itens = linhas.map((l) => ({ cotacao_item_id: l.id, convite_id: escolha.porLinha?.[l.id], condicao_tipo: condDe(escolha.porLinha?.[l.id]) }));
  }
  const decisao = {
    modo: escolha.modo,
    segue_recomendacao: !fugaDaRecomendacao({ comparativo, escolha }).foge,
    itens,
    datas_disponibilidade: datas,
    recomendacao_snapshot: snapshotRecomendacao({ ranking, divisao })
  };
  if (justificativa?.trim()) decisao.justificativa = justificativa.trim();
  return decisao;
};

// Total (VP e nominal) de uma escolha, para o resumo e a comparação com a recomendação
export const totaisDaEscolha = ({ comparativo, escolha }) => {
  const { ranking, divisao, linhas, respostas } = comparativo;
  const porConvite = candidatosPorConvite(ranking);
  if (escolha.modo === 'unico') {
    const c = porConvite.get(escolha.conviteId);
    return c ? { vp: c.vp_total, nominal: c.nominal_total, convites: [escolha.conviteId], frete: c.frete } : null;
  }
  if (escolha.modo === 'dividido') {
    if (!divisao) return null;
    const nominal = divisao.atribuicoes.reduce((s, a) => s + a.preco_unitario_nominal * a.quantidade, 0) + divisao.frete_total;
    return { vp: divisao.custo, nominal, convites: divisao.fornecedores.map((f) => f.convite_id), frete: divisao.frete_total };
  }
  let vp = 0; let nominal = 0; const usados = new Set();
  for (const l of linhas) {
    const cid = escolha.porLinha?.[l.id];
    const c = porConvite.get(cid);
    const r = respostas.find((x) => x.convite_id === cid);
    const cel = celulaDaMatriz(l, r, c);
    if (!cel || cel.precoVp == null) return null;
    vp += cel.precoVp * Number(l.quantidade);
    nominal += cel.precoNominal * Number(l.quantidade);
    usados.add(cid);
  }
  const frete = [...usados].reduce((s, cid) => s + (porConvite.get(cid)?.frete ?? 0), 0);
  return { vp: vp + frete, nominal: nominal + frete, convites: [...usados], frete };
};

// Σ(ref × qtd) vs. total da decisão (rodapé "vs. referência")
export const variacaoDaDecisao = ({ comparativo, escolha, referencias }) => {
  const { linhas, ranking, respostas, divisao } = comparativo;
  const porConvite = candidatosPorConvite(ranking);
  const itens = linhas.map((l) => {
    let precoVp = null;
    if (escolha.modo === 'dividido') precoVp = divisao?.atribuicoes.find((a) => a.linha_id === l.id)?.preco_unitario_vp ?? null;
    else {
      const cid = escolha.modo === 'unico' ? escolha.conviteId : escolha.porLinha?.[l.id];
      precoVp = celulaDaMatriz(l, respostas.find((r) => r.convite_id === cid), porConvite.get(cid)).precoVp ?? null;
    }
    const ref = l.material_id ? num(referencias?.[l.material_id]?.media_janela, null) : null;
    return { ref, quantidade: l.quantidade, preco_vp: precoVp };
  }).filter((i) => i.preco_vp != null);
  return variacaoTotalCotacao(itens);
};
