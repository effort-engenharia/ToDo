// Estado do formulário público ↔ resposta do contrato (puro, sem React). O estado guarda TEXTO digitado; o modelo converte.
import { parseBRL } from '../features/compras/utils/cotacao/moeda.js';
import { validarResposta } from '../features/compras/utils/cotacao/validacaoResposta.js';
import { respostaPublicaParaModelo, respostaParaPayloadPublico } from '../features/compras/utils/cotacao/adaptadores.js';

export const formularioVazio = () => ({
  itens: {}, // { [linhaId]: { tem: null|true|false, preco, parcial, qtdDisp, obs } }
  aVista: { on: false, tipo: 'percentual', valor: '' },
  parcelado: { on: false, parcelas: '', entrada: '', dias: '30', total: '' },
  prazo: '',
  frete: { tipo: null, valor: '' },
  obs: ''
});

const LIMITE_TOTAL = 1e9;

export const itemVazio = () => ({ tem: null, preco: '', parcial: false, qtdDisp: '', obs: '' });

const numeroTexto = (n, max = 4) => (n === null || n === undefined ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: max }));
const num = (t) => (String(t ?? '').trim() === '' ? null : parseBRL(String(t)));
const inteiro = (t) => {
  const s = String(t ?? '').trim();
  return s === '' ? null : (/^\d+$/.test(s) ? Number(s) : NaN);
};

// Resposta do servidor (obter().resposta) → estado do formulário
export const formularioDaResposta = (respostaServidor) => {
  const r = respostaPublicaParaModelo(respostaServidor);
  const f = formularioVazio();
  if (!r) return f;
  (r.itens || []).forEach((i) => {
    f.itens[i.id] = {
      tem: !!i.tem_item,
      preco: numeroTexto(i.preco_unitario),
      parcial: i.quantidade_disponivel != null,
      qtdDisp: numeroTexto(i.quantidade_disponivel, 3),
      obs: i.observacao ?? ''
    };
  });
  const av = (r.condicoes || []).find((c) => c.tipo === 'a_vista');
  const pa = (r.condicoes || []).find((c) => c.tipo === 'parcelado');
  if (av) f.aVista = { on: true, tipo: av.desconto_tipo ?? 'percentual', valor: numeroTexto(av.desconto_valor, 2) };
  if (pa) {
    f.parcelado = {
      on: true, parcelas: String(pa.parcelas ?? ''), entrada: numeroTexto(pa.entrada_valor, 2),
      dias: String(pa.primeira_parcela_dias ?? 30), total: numeroTexto(pa.total_informado, 2)
    };
  }
  f.prazo = r.prazo_entrega_dias == null ? '' : String(r.prazo_entrega_dias);
  f.frete = { tipo: r.frete?.tipo ?? null, valor: numeroTexto(r.frete?.valor, 2) };
  f.obs = r.observacao ?? '';
  return f;
};

// Quantidade efetiva cotada de uma linha (parcial só vale se menor que a pedida)
export const quantidadeEfetiva = (linha, it) => {
  const pedida = Number(linha.quantidade) || 0;
  const d = it?.parcial ? num(it.qtdDisp) : null;
  return d != null && d > 0 && d < pedida ? d : pedida;
};

export const subtotalDaLinha = (linha, it) => {
  const p = it?.tem ? num(it.preco) : null;
  return p != null && p > 0 ? p * quantidadeEfetiva(linha, it) : 0;
};

export const totaisNominais = (linhas, f) => {
  const base = linhas.reduce((s, l) => s + subtotalDaLinha(l, f.itens[l.id]), 0);
  let aVista = null;
  if (f.aVista.on) {
    const d = num(f.aVista.valor) ?? 0;
    aVista = Math.max(0, f.aVista.tipo === 'valor' ? base - d : base * (1 - d / 100));
  }
  let parcelado = null;
  if (f.parcelado.on) {
    const total = num(f.parcelado.total);
    const n = inteiro(f.parcelado.parcelas);
    const entrada = num(f.parcelado.entrada) ?? 0;
    const t = total != null && total > 0 ? total : base;
    const nOk = Number.isInteger(n) && n > 0;
    parcelado = { total: t, parcelas: nOk ? n : null, entrada, valorParcela: nOk ? (t - entrada) / n : null };
  }
  return { base, aVista, parcelado };
};

// Estado → modelo interno (nomes dos helpers de F-01). Campos inválidos viram null/NaN para a validação acusar.
export const modeloDoFormulario = (linhas, f, versaoLista, recusou = false) => {
  if (recusou) return { versao_lista: versaoLista, recusou: true, observacao: f.obs.trim() || undefined };
  const condicoes = [];
  if (f.aVista.on) {
    const d = f.aVista.valor.trim() === '' ? null : num(f.aVista.valor);
    condicoes.push({ tipo: 'a_vista', desconto_tipo: d == null ? null : f.aVista.tipo, desconto_valor: d });
  }
  if (f.parcelado.on) {
    const dias = inteiro(f.parcelado.dias);
    const totalDigitado = f.parcelado.total.trim() !== '';
    condicoes.push({
      tipo: 'parcelado',
      parcelas: inteiro(f.parcelado.parcelas),
      entrada_valor: f.parcelado.entrada.trim() === '' ? null : num(f.parcelado.entrada),
      primeira_parcela_dias: dias == null ? 30 : dias,
      total_informado: totalDigitado ? num(f.parcelado.total) : null
    });
  }
  return {
    versao_lista: versaoLista,
    recusou: false,
    prazo_entrega_dias: inteiro(f.prazo),
    frete: f.frete.tipo === 'valor' ? { tipo: 'valor', valor: num(f.frete.valor) } : (f.frete.tipo === 'cif' ? { tipo: 'cif' } : null),
    observacao: f.obs.trim() || undefined,
    itens: linhas.map((l) => {
      const it = f.itens[l.id] ?? itemVazio();
      if (it.tem !== true && it.tem !== false) return { id: l.id, tem_item: undefined };
      if (!it.tem) return { id: l.id, tem_item: false, observacao: it.obs.trim() || undefined };
      const q = it.parcial && it.qtdDisp.trim() !== '' ? num(it.qtdDisp) : null;
      const cobreTudo = q != null && q >= (Number(l.quantidade) || 0);
      return {
        id: l.id, tem_item: true,
        preco_unitario: it.preco.trim() === '' ? undefined : (num(it.preco) ?? NaN),
        quantidade_disponivel: it.parcial && !cobreTudo ? (q ?? NaN) : undefined,
        observacao: it.obs.trim() || undefined
      };
    }),
    condicoes
  };
};

export const payloadDoFormulario = (linhas, f, versaoLista, recusou = false) =>
  respostaParaPayloadPublico(modeloDoFormulario(linhas, f, versaoLista, recusou));

// id de DOM de um campo (para foco e aria-describedby)
const slug = (campo) => `cp-${campo.replace(/\]/g, '').replace(/[[.]/g, '-')}`;

const idCondicao = (campo, tipos) => {
  const m = /^condicoes\[(\d+)\]\.(\w+)$/.exec(campo || '');
  // o contrato chama o total parcelado de `total`; o campo da tela é `total_informado`
  return m ? `cp-cond-${tipos[Number(m[1])] ?? 'grupo'}-${m[2] === 'total' ? 'total_informado' : m[2]}` : null;
};

// Validação com os textos finais do Anexo B.1.4. Devolve { ok, erros: { [idCampo]: mensagem }, ordem: [idCampo...] }
export const validarFormulario = (linhas, f, versaoLista) => {
  const erros = {};
  const ordem = [];
  const marcar = (id, msg) => { if (!erros[id]) { erros[id] = msg; ordem.push(id); } };

  const modelo = modeloDoFormulario(linhas, f, versaoLista);
  const tipos = modelo.condicoes.map((c) => c.tipo);

  linhas.forEach((l, idx) => {
    const it = f.itens[l.id] ?? itemVazio();
    if (it.tem === null || it.tem === undefined) { marcar(`cp-itens-${idx}-tem`, 'Informe se você tem este item'); return; }
    if (!it.tem) return;
    if (it.preco.trim() === '') marcar(`cp-itens-${idx}-preco_unitario`, 'Informe o preço unitário');
    else if (!(num(it.preco) > 0)) marcar(`cp-itens-${idx}-preco_unitario`, 'Informe um valor maior que zero');
    if (it.parcial && !(num(it.qtdDisp) > 0)) marcar(`cp-itens-${idx}-quantidade_disponivel`, 'Informe uma quantidade maior que zero');
  });
  const algumSim = linhas.some((l) => f.itens[l.id]?.tem === true);
  const todosRespondidos = linhas.every((l) => f.itens[l.id]?.tem === true || f.itens[l.id]?.tem === false);
  if (todosRespondidos && !algumSim) marcar('cp-itens-grupo', 'Marque ao menos um item que você tem ou use "Não vou cotar"');

  if (!f.aVista.on && !f.parcelado.on) marcar('cp-cond-grupo', 'Escolha ao menos uma condição de pagamento');
  const prazo = inteiro(f.prazo);
  if (prazo === null || Number.isNaN(prazo) || prazo > 365) marcar('cp-prazo', 'Informe o prazo de entrega em dias (0 a 365)');
  if (!f.frete.tipo) marcar('cp-frete-tipo', 'Informe se o frete está incluso ou o valor');
  else if (f.frete.tipo === 'valor' && !(num(f.frete.valor) >= 0)) marcar('cp-frete-valor', 'Informe se o frete está incluso ou o valor');

  // Totais acima de R$ 1 bilhão (limite do servidor)
  const { base, aVista } = totaisNominais(linhas, f);
  if (base > LIMITE_TOTAL || (aVista ?? 0) > LIMITE_TOTAL) marcar('cp-itens-grupo', 'O total ultrapassa R$ 1.000.000.000. Confira os preços e quantidades.');
  if (f.parcelado.on && (num(f.parcelado.total) ?? 0) > LIMITE_TOTAL) marcar('cp-cond-parcelado-total_informado', 'O total parcelado não pode passar de R$ 1.000.000.000.');

  // Demais regras (limites do §7.4) pelo helper de F-01; só entram erros de campos ainda sem mensagem
  validarResposta(linhas, modelo).erros.forEach(({ campo, mensagem }) => {
    const cond = idCondicao(campo, tipos);
    if (cond) { marcar(cond, mensagem); return; }
    if (campo === 'condicoes') marcar('cp-cond-grupo', mensagem);
    else if (campo === 'prazo_entrega_dias') marcar('cp-prazo', mensagem);
    else if (campo === 'frete.tipo') marcar('cp-frete-tipo', mensagem);
    else if (campo === 'frete.valor') marcar('cp-frete-valor', mensagem);
    else if (campo === 'observacao') marcar('cp-obs', mensagem);
    else if (/^itens\[\d+\]\.(preco_unitario|quantidade_disponivel|observacao)$/.test(campo)) marcar(slug(campo), mensagem);
    // 'itens' (grupo) e '.tem_item' já foram cobertos acima
  });

  // Foco segue a ordem visual: itens, condições, entrega, observação
  const peso = (id) => (id.startsWith('cp-itens') ? 0 : id.startsWith('cp-cond') ? 1 : /^cp-(prazo|frete)/.test(id) ? 2 : 3);
  const ordenada = ordem.map((id, i) => [id, i]).sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1]).map(([id]) => id);
  return { ok: ordem.length === 0, erros, ordem: ordenada };
};

// Mapeia o campo do erro do servidor (`itens[2].preco_unitario`) para o id de DOM
export const idDoCampoServidor = (campo, f, linhas) => {
  const tipos = modeloDoFormulario(linhas, f, 0).condicoes.map((c) => c.tipo);
  const cond = idCondicao(campo, tipos);
  if (cond) return cond;
  if (campo === 'prazo_entrega_dias') return 'cp-prazo';
  if (campo === 'frete.tipo') return 'cp-frete-tipo';
  if (campo === 'frete.valor') return 'cp-frete-valor';
  if (campo === 'observacao') return 'cp-obs';
  return campo ? slug(campo) : null;
};
