// Edição local das linhas consolidadas no passo 2 do assistente (plano §10.2). Funções puras.
// Linha: { id?, _chave, descricao, unidade, material_id, observacao_publica, origens:[{pedido_id,item_id,quantidade}] }

export const padraoEndereco = /(\b(rua|av\.?|avenida|travessa|rodovia|estrada)\b)|\d{4,}/i;

export const quantidadeDaLinha = (l) => (l?.origens ?? []).reduce((s, o) => s + Number(o.quantidade || 0), 0);

let seq = 0;
export const novaChave = () => { seq += 1; return `n${seq}`; };

// Itens devolvidos pelo servidor → linhas editáveis (só ativas)
export const linhasDoServidor = (itens) => (itens ?? []).filter((i) => i.ativo !== false).map((i) => ({
  id: i.id,
  _chave: i.id ?? novaChave(),
  descricao: i.descricao ?? '',
  unidade: i.unidade ?? '',
  material_id: i.material_id ?? null,
  observacao_publica: i.observacao_publica ?? '',
  origens: (i.origens ?? []).map((o) => ({ pedido_id: o.pedido_id, item_id: o.item_id, quantidade: Number(o.quantidade) }))
}));

// Tira UMA origem para uma linha nova (sem id)
export const separarOrigem = (linhas, chave, origem) => {
  const alvo = linhas.find((l) => l._chave === chave);
  if (!alvo || alvo.origens.length < 2) return linhas;
  const restante = linhas.map((l) => (l._chave === chave
    ? { ...l, origens: l.origens.filter((o) => !(o.pedido_id === origem.pedido_id && o.item_id === origem.item_id)) }
    : l));
  const nova = { _chave: novaChave(), descricao: alvo.descricao, unidade: alvo.unidade, material_id: alvo.material_id, observacao_publica: alvo.observacao_publica, origens: [origem] };
  const i = restante.findIndex((l) => l._chave === chave);
  return [...restante.slice(0, i + 1), nova, ...restante.slice(i + 1)];
};

// Move as origens da linha `de` para a linha `para` (que mantém id/descrição) e remove `de`
export const juntarLinhas = (linhas, de, para) => {
  const origem = linhas.find((l) => l._chave === de);
  if (!origem || de === para) return linhas;
  return linhas
    .filter((l) => l._chave !== de)
    .map((l) => (l._chave === para ? { ...l, material_id: l.material_id ?? origem.material_id, origens: [...l.origens, ...origem.origens] } : l));
};

// Linhas → p_itens de compras_cotacao_montar_itens
export const linhasParaPayload = (linhas) => linhas.map((l) => ({
  ...(l.id ? { id: l.id } : {}),
  descricao: l.descricao.trim(),
  unidade: l.unidade,
  ...(l.material_id ? { material_id: l.material_id } : {}),
  ...(l.observacao_publica?.trim() ? { observacao_publica: l.observacao_publica.trim() } : {}),
  origens: l.origens
}));

export const linhasValidas = (linhas) => linhas.length > 0 && linhas.every((l) => l.descricao.trim().length > 0 && l.origens.length > 0);
