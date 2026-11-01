// Derivações do histórico de preços de um material (plano §10.6, B.7). Funções puras.
// Linha do histórico (`compras_material_historico`): { id, tipo:'cotado'|'comprado', preco_unitario_vp, preco_unitario_nominal, registrado_em, fornecedor, ... }
// ordenada da mais recente para a mais antiga.

const vp = (h) => Number(h.preco_unitario_vp);

// Mais barato / mais caro entre as COMPRAS (preço comparável), com a diferença; % sobre o mais barato (base declarada na tela).
export const resumoHistorico = (linhas) => {
  const compras = (linhas ?? []).filter((h) => h.tipo === 'comprado' && Number.isFinite(vp(h)) && vp(h) > 0);
  if (!compras.length) return { compras: [], maisBarato: null, maisCaro: null, diferenca: null };
  const maisBarato = compras.reduce((a, b) => (vp(b) < vp(a) ? b : a));
  const maisCaro = compras.reduce((a, b) => (vp(b) > vp(a) ? b : a));
  const valor = vp(maisCaro) - vp(maisBarato);
  return { compras, maisBarato, maisCaro, diferenca: valor > 0 ? { valor, pct: valor / vp(maisBarato) } : null };
};

// Variação de cada linha vs. a compra/cotação ANTERIOR do mesmo tipo: Map<id, { valor, pct }>. A mais antiga não tem anterior.
export const variacoesSequenciais = (linhas) => {
  const mapa = new Map();
  ['comprado', 'cotado'].forEach((tipo) => {
    const doTipo = (linhas ?? []).filter((h) => h.tipo === tipo);
    doTipo.forEach((h, i) => {
      const anterior = doTipo[i + 1];
      if (!anterior || !(vp(anterior) > 0)) return;
      const valor = vp(h) - vp(anterior);
      mapa.set(h.id, { valor, pct: valor / vp(anterior) });
    });
  });
  return mapa;
};
