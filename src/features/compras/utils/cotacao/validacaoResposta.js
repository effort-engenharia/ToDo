// Validação da resposta do fornecedor no cliente (espelha as regras do §7.4 de `cotacao_publica_responder`).
// O banco valida de novo: isto é só para dar erro claro antes de enviar. Funções puras.
//
// Formato da resposta (entrada do RPC):
// { versao_lista, recusou, itens:[{id, tem_item, preco_unitario, quantidade_disponivel, observacao}],
//   condicoes:[{tipo:'a_vista'|'parcelado', desconto_tipo, desconto_valor, parcelas, entrada_valor, primeira_parcela_dias, total_informado}],
//   prazo_entrega_dias, frete:{tipo:'cif'|'valor', valor}, observacao }

export const LIMITES_RESPOSTA = Object.freeze({
  precoMax: 1e9,
  precoCasas: 4,
  qtdDispMax: 1e7,
  obsItemMax: 200,
  obsMax: 1000,
  descontoPctMax: 50,
  parcelasMax: 24,
  primeiraParcelaMaxDias: 180,
  totalInformadoMin: 0.5,
  totalInformadoMax: 3,
  prazoEntregaMaxDias: 365,
  freteMax: 1e7
});

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehInteiro = (v) => ehNumero(v) && Number.isInteger(v);
const temAteCasas = (v, casas) => Math.abs(v * 10 ** casas - Math.round(v * 10 ** casas)) < 1e-6;

// itens: linhas ativas da cotação [{id, quantidade}]; resposta: ver formato acima.
export const validarResposta = (itens, resposta) => {
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });
  const L = LIMITES_RESPOSTA;
  const r = resposta || {};
  const linhas = Array.isArray(itens) ? itens : [];

  if (typeof r.recusou !== 'boolean') erro('recusou', 'Informe se vai cotar ou recusar.');
  if (r.recusou === true) {
    if (r.observacao != null && String(r.observacao).length > L.obsMax) erro('observacao', `A observação pode ter até ${L.obsMax} caracteres.`);
    return { ok: erros.length === 0, erros };
  }

  // Itens: exatamente as linhas ativas
  const respItens = Array.isArray(r.itens) ? r.itens : [];
  const porId = new Map(respItens.map((i) => [i?.id, i]));
  if (respItens.length !== linhas.length || linhas.some((l) => !porId.has(l.id))) {
    erro('itens', 'A resposta precisa trazer todos os itens da lista.');
  }
  let temAlgum = false;
  let base = 0;
  respItens.forEach((it, idx) => {
    const c = `itens[${idx}]`;
    if (typeof it?.tem_item !== 'boolean') { erro(`${c}.tem_item`, 'Informe se tem o item.'); return; }
    const linha = linhas.find((l) => l.id === it.id);
    if (it.observacao != null && String(it.observacao).length > L.obsItemMax) erro(`${c}.observacao`, `A observação do item pode ter até ${L.obsItemMax} caracteres.`);
    if (!it.tem_item) return;
    temAlgum = true;
    const p = it.preco_unitario;
    if (!ehNumero(p)) erro(`${c}.preco_unitario`, 'Informe o preço unitário.');
    else if (p <= 0) erro(`${c}.preco_unitario`, 'O preço deve ser maior que zero.');
    else if (p > L.precoMax) erro(`${c}.preco_unitario`, 'Preço acima do limite permitido.');
    else if (!temAteCasas(p, L.precoCasas)) erro(`${c}.preco_unitario`, `Use no máximo ${L.precoCasas} casas decimais no preço.`);
    const q = it.quantidade_disponivel;
    let qtdBase = Number(linha?.quantidade) || 0;
    if (q != null) {
      if (!ehNumero(q) || q <= 0 || q > L.qtdDispMax) erro(`${c}.quantidade_disponivel`, 'Quantidade disponível inválida.');
      else qtdBase = Math.min(qtdBase, q);
    }
    if (ehNumero(p) && p > 0) base += p * qtdBase;
  });
  if (!temAlgum && respItens.length > 0) erro('itens', 'Informe o preço de pelo menos um item ou recuse a cotação.');

  // Condições
  const conds = Array.isArray(r.condicoes) ? r.condicoes : [];
  if (conds.length < 1 || conds.length > 2) erro('condicoes', 'Informe 1 ou 2 condições de pagamento.');
  else if (conds.length === 2 && conds[0]?.tipo === conds[1]?.tipo) erro('condicoes', 'As duas condições precisam ser de tipos diferentes.');
  conds.forEach((c, idx) => {
    const k = `condicoes[${idx}]`;
    if (c?.tipo === 'a_vista') {
      if (c.desconto_tipo == null) return;
      if (!ehNumero(c.desconto_valor) || c.desconto_valor < 0) { erro(`${k}.desconto_valor`, 'Desconto inválido.'); return; }
      if (c.desconto_tipo === 'percentual') {
        if (c.desconto_valor > L.descontoPctMax) erro(`${k}.desconto_valor`, `O desconto pode ir até ${L.descontoPctMax}%.`);
      } else if (c.desconto_tipo === 'valor') {
        if (base > 0 && c.desconto_valor > base) erro(`${k}.desconto_valor`, 'O desconto não pode passar do valor dos itens.');
      } else erro(`${k}.desconto_tipo`, 'Tipo de desconto inválido.');
    } else if (c?.tipo === 'parcelado') {
      if (!ehInteiro(c.parcelas) || c.parcelas < 1 || c.parcelas > L.parcelasMax) erro(`${k}.parcelas`, `Parcelas de 1 a ${L.parcelasMax}.`);
      const entrada = c.entrada_valor ?? 0;
      const total = c.total_informado ?? base;
      if (!ehNumero(entrada) || entrada < 0 || (total > 0 && entrada > total)) erro(`${k}.entrada_valor`, 'Entrada inválida (não pode passar do total).');
      const dias = c.primeira_parcela_dias ?? 30;
      if (!ehInteiro(dias) || dias < 0 || dias > L.primeiraParcelaMaxDias) erro(`${k}.primeira_parcela_dias`, `Primeira parcela em 0 a ${L.primeiraParcelaMaxDias} dias.`);
      if (c.total_informado != null) {
        const t = c.total_informado;
        if (!ehNumero(t) || (base > 0 && (t < base * L.totalInformadoMin || t > base * L.totalInformadoMax))) {
          erro(`${k}.total_informado`, 'Total parcelado fora do esperado em relação aos itens.');
        }
      }
    } else erro(`${k}.tipo`, 'Tipo de condição inválido.');
  });

  // Entrega e frete (obrigatórios, D5)
  if (r.prazo_entrega_dias == null || r.prazo_entrega_dias === '') erro('prazo_entrega_dias', 'Informe o prazo de entrega em dias.');
  else if (!ehInteiro(r.prazo_entrega_dias) || r.prazo_entrega_dias < 0 || r.prazo_entrega_dias > L.prazoEntregaMaxDias) {
    erro('prazo_entrega_dias', `Prazo de entrega de 0 a ${L.prazoEntregaMaxDias} dias.`);
  }
  const f = r.frete;
  if (!f || (f.tipo !== 'cif' && f.tipo !== 'valor')) erro('frete.tipo', 'Informe o frete (CIF ou valor).');
  else if (f.tipo === 'valor' && (!ehNumero(f.valor) || f.valor < 0 || f.valor > L.freteMax)) erro('frete.valor', 'Informe o valor do frete.');

  if (r.observacao != null && String(r.observacao).length > L.obsMax) erro('observacao', `A observação pode ter até ${L.obsMax} caracteres.`);

  return { ok: erros.length === 0, erros };
};
