// Classificação das alterações da atendente na lista do pedido (plano §11, D13; AL-01).
// ESPELHA `compras_alterar_itens` (migration 38): o servidor é a fonte da verdade; aqui é só a pré-visualização.
//   ciência (aplicada na hora): quantidade menor, remover, corrigir (grafia/sinônimo de unidade)
//   aceite do solicitante:      quantidade maior, substituir, adicionar
// Funções puras (sem React/Supabase). Se a regra do SQL mudar, esta muda junto.
import { normalizarNome, normalizarUnidade } from './cotacao/normalizacao';

export const ACOES_ALTERACAO = ['quantidade', 'remover', 'corrigir', 'substituir', 'adicionar'];
export const LIMITE_SIMILARIDADE_CORRECAO = 0.6; // pg_trgm similarity ≥ 0,6 = correção de grafia
export const MIN_MOTIVO = 5;
export const MAX_MOTIVO = 500;
export const MAX_ALTERACOES = 50;

const UNIDADES_INTEIRAS = ['un', 'cx', 'pct'];

// Texto/number → number > 0 ou null (aceita "1,5"). Espelha `compras_parse_quantidade`.
export const parseQuantidade = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  let n = valor;
  if (typeof valor !== 'number') {
    const t = String(valor).trim();
    n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  }
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Trigramas no estilo pg_trgm: cada palavra com 2 espaços antes e 1 depois.
const trigramas = (texto) => {
  const conj = new Set();
  String(texto ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).forEach((p) => {
    const s = `  ${p} `;
    for (let i = 0; i + 3 <= s.length; i += 1) conj.add(s.slice(i, i + 3));
  });
  return conj;
};

// Aproxima `similarity()` do pg_trgm (0–1). O banco decide de fato; se pg_trgm não existir lá, só nome igual vale como correção.
export const similaridade = (a, b) => {
  const A = trigramas(a);
  const B = trigramas(b);
  if (!A.size || !B.size) return 0;
  let comum = 0;
  A.forEach((t) => { if (B.has(t)) comum += 1; });
  return comum / (A.size + B.size - comum);
};

const rotuloQtd = (q, un) => `${String(q).replace('.', ',')}${un ? ` ${un}` : ''}`;

/**
 * Classifica UMA alteração.
 * @param {{id?, nome, quantidade, unidade}} item item atual da lista (ausente em 'adicionar')
 * @param {{acao, itemId?, quantidade?, nome?, unidade?}} alteracao
 * @returns {{ classe: 'ciencia'|'aceite'|'invalida', tipo?: 'quantidade'|'substituicao'|'adicao', resumo: string, motivo?: string, sugerirSubstituir?: boolean }}
 */
export const classificarAlteracao = (item, alteracao) => {
  const a = alteracao ?? {};
  const acao = a.acao;
  if (!ACOES_ALTERACAO.includes(acao)) return { classe: 'invalida', resumo: '', motivo: 'Ação inválida' };

  if (acao === 'adicionar') {
    const nome = String(a.nome ?? '').trim();
    const un = String(a.unidade ?? '').trim();
    const q = parseQuantidade(a.quantidade);
    if (!nome) return { classe: 'invalida', resumo: '', motivo: 'Informe o nome do item a adicionar' };
    if (nome.length > 200) return { classe: 'invalida', resumo: '', motivo: 'Nome grande demais' };
    if (!un || un.length > 20) return { classe: 'invalida', resumo: '', motivo: 'Informe a unidade do item a adicionar' };
    if (q === null) return { classe: 'invalida', resumo: '', motivo: 'Informe a quantidade do item a adicionar' };
    return { classe: 'aceite', tipo: 'adicao', resumo: `Adicionar: ${nome} · ${rotuloQtd(UNIDADES_INTEIRAS.includes(un.toLowerCase()) ? Math.ceil(q) : q, un)}` };
  }

  if (!item) return { classe: 'invalida', resumo: '', motivo: 'Item não encontrado no pedido' };
  const nome = String(item.nome ?? '');
  const un = String(item.unidade ?? '').trim() || 'un';
  const qAtual = parseQuantidade(item.quantidade);

  if (acao === 'remover') return { classe: 'ciencia', resumo: `Remover: ${nome}` };

  if (acao === 'quantidade') {
    const q = parseQuantidade(a.quantidade);
    if (q === null) return { classe: 'invalida', resumo: '', motivo: 'Quantidade inválida' };
    if (qAtual !== null && q === qAtual) return { classe: 'invalida', resumo: '', motivo: `A quantidade de "${nome}" já é ${rotuloQtd(qAtual)}` };
    if (qAtual !== null && q < qAtual) {
      const final = UNIDADES_INTEIRAS.includes(un.toLowerCase()) ? Math.ceil(q) : q;
      if (final === qAtual) return { classe: 'invalida', resumo: '', motivo: `A quantidade de "${nome}" já é ${rotuloQtd(qAtual)}: informe um valor menor` };
      return { classe: 'ciencia', resumo: `${nome}: ${rotuloQtd(qAtual)} → ${rotuloQtd(final, un)}` };
    }
    // Aumento: o servidor guarda o pedido como veio, mas a aprovação arredonda para cima em un/cx/pct (QA): mostra já arredondado
    const final = UNIDADES_INTEIRAS.includes(un.toLowerCase()) ? Math.ceil(q) : q;
    return {
      classe: 'aceite',
      tipo: 'quantidade',
      quantidadeFinal: final,
      resumo: `Aumentar ${nome}: ${qAtual === null ? '?' : rotuloQtd(qAtual)} → ${rotuloQtd(final, un)}`
    };
  }

  if (acao === 'substituir') {
    const novo = String(a.nome ?? '').trim();
    if (!novo || novo.length > 200) return { classe: 'invalida', resumo: '', motivo: 'Informe o item substituto' };
    if (a.quantidade !== undefined && a.quantidade !== null && a.quantidade !== '' && parseQuantidade(a.quantidade) === null) {
      return { classe: 'invalida', resumo: '', motivo: 'Quantidade inválida' };
    }
    return { classe: 'aceite', tipo: 'substituicao', resumo: `Substituir "${nome}" por "${novo}"` };
  }

  // corrigir
  const nomeNovo = String(a.nome ?? '').trim() || null;
  const unNova = String(a.unidade ?? '').trim() || null;
  if (!nomeNovo && !unNova) return { classe: 'invalida', resumo: '', motivo: 'Informe o novo nome e/ou a nova unidade' };
  if ((nomeNovo ?? '').length > 200 || (unNova ?? '').length > 20) return { classe: 'invalida', resumo: '', motivo: 'Nome ou unidade grande demais' };
  if ((!nomeNovo || nomeNovo === nome) && (!unNova || unNova === un)) return { classe: 'invalida', resumo: '', motivo: 'A correção não muda nada' };
  if (nomeNovo && nomeNovo !== nome) {
    const mesmo = normalizarNome(nomeNovo) === normalizarNome(nome);
    if (!mesmo && similaridade(normalizarNome(nomeNovo), normalizarNome(nome)) < LIMITE_SIMILARIDADE_CORRECAO) {
      return { classe: 'invalida', resumo: '', sugerirSubstituir: true, motivo: `A correção de "${nome}" muda o item: use "Substituir"` };
    }
  }
  if (unNova && unNova !== un && normalizarUnidade(unNova) !== normalizarUnidade(un)) {
    return { classe: 'invalida', resumo: '', sugerirSubstituir: true, motivo: `A unidade de "${nome}" não é sinônima da atual: use "Substituir"` };
  }
  return { classe: 'ciencia', resumo: `Corrigir "${nome}" → "${nomeNovo ?? nome}" (${unNova ?? un})` };
};

/**
 * Classifica o lote inteiro e agrupa para a pré-visualização.
 * @returns {{ ciencia: Array, aceite: Array, invalidas: Array, total: number, ficaVazia: boolean, soAceites: boolean }}
 *  cada entrada: { alteracao, item, ...classificacao }
 */
export const classificarLote = (itens, alteracoes) => {
  const lista = Array.isArray(itens) ? itens : [];
  const porId = new Map(lista.filter((i) => i?.id).map((i) => [i.id, i]));
  const ciencia = [];
  const aceite = [];
  const invalidas = [];
  const vistos = new Set();
  (alteracoes ?? []).forEach((alteracao) => {
    const item = alteracao.acao === 'adicionar' ? null : porId.get(alteracao.itemId) ?? null;
    let r = classificarAlteracao(item, alteracao);
    if (alteracao.acao !== 'adicionar' && alteracao.itemId) {
      if (vistos.has(alteracao.itemId)) r = { classe: 'invalida', resumo: '', motivo: 'O mesmo item não pode ter duas alterações' };
      vistos.add(alteracao.itemId);
    }
    const entrada = { alteracao, item, ...r };
    if (r.classe === 'ciencia') ciencia.push(entrada);
    else if (r.classe === 'aceite') aceite.push(entrada);
    else invalidas.push(entrada);
  });
  const removidos = new Set(ciencia.filter((c) => c.alteracao.acao === 'remover').map((c) => c.alteracao.itemId));
  const ficaVazia = lista.length > 0 && lista.every((i) => removidos.has(i.id)) && aceite.every((a) => a.alteracao.acao !== 'adicionar');
  return { ciencia, aceite, invalidas, total: ciencia.length + aceite.length + invalidas.length, ficaVazia, soAceites: ciencia.length === 0 && aceite.length > 0 };
};

// Mensagem de resumo do toast (B.8): "3 alterações aplicadas. 1 aguarda aceite de Fulano."
export const resumoResultado = (data, nomeSolicitante) => {
  const n = data?.aplicadas?.length ?? 0;
  const p = data?.pendentes_aceite?.length ?? 0;
  const partes = [];
  if (n > 0) partes.push(`${n} ${n === 1 ? 'alteração aplicada' : 'alterações aplicadas'}.`);
  if (p > 0) partes.push(`${p} ${p === 1 ? 'aguarda' : 'aguardam'} aceite de ${nomeSolicitante || 'solicitante'}.`);
  return partes.join(' ') || 'Nenhuma alteração aplicada.';
};

// Motivos rápidos (B.8). 'outro' exige texto livre.
export const MOTIVOS_RAPIDOS = [
  'já temos em estoque', 'duplicado', 'correção de grafia/unidade', 'sem fornecedor', 'equivalente disponível', 'outro'
];

// Pode alterar itens (status do pedido, §11)
export const STATUS_ALTERA_ITENS = ['aguardando_compra', 'em_cotacao', 'aguardando_solicitante'];
export const podeAlterarItens = (statusCompra) => STATUS_ALTERA_ITENS.includes(statusCompra);
