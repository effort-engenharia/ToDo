import { idbAll, idbDelete, idbPut, idbUpdate, LOJAS } from './idb';

// Fila (outbox) das ações do técnico feitas no aparelho. O id do item é o próprio idCliente da ação:
// o servidor ignora repetições, então reenviar (inclusive após timeout) nunca duplica.
//
// item = {
//   id, tipo: 'status' | 'falta_material', atividadeId, usuarioId, ocorridoEm, criadoEm,
//   payload,            // dados da ação (ver acoesAtividade.js)
//   estado: 'pendente' | 'erro',
//   tentativas, proximaTentativaEm, ultimoErro
// }

const CANAL = 'effort-execucao-outbox';
const ouvintes = new Set();
let canal = null;

const iniciarCanal = () => {
  if (canal || typeof BroadcastChannel === 'undefined') return;
  canal = new BroadcastChannel(CANAL);
  canal.onmessage = (e) => ouvintes.forEach((fn) => fn(e.data));
};

export const assinarOutbox = (fn) => {
  iniciarCanal();
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
};

// Avisa esta aba e (salvo `local`) as outras abas abertas do app
export const emitirOutbox = (evento = { tipo: 'mudou' }, { local = false } = {}) => {
  ouvintes.forEach((fn) => fn(evento));
  if (local) return;
  iniciarCanal();
  try { canal?.postMessage(evento); } catch { /* canal fechado */ }
};

export const enfileirar = async (item) => {
  await idbPut(LOJAS.outbox, {
    estado: 'pendente',
    tentativas: 0,
    proximaTentativaEm: 0,
    ultimoErro: null,
    criadoEm: Date.now(),
    ...item
  });
  emitirOutbox();
};

export const listarOutbox = async (usuarioId) => {
  const itens = await idbAll(LOJAS.outbox);
  return itens
    .filter((i) => usuarioId == null || i.usuarioId === usuarioId)
    .sort((a, b) => a.criadoEm - b.criadoEm);
};

export const atualizarItem = (id, mudancas) =>
  idbUpdate(LOJAS.outbox, id, (atual) => ({ ...atual, ...mudancas }));

export const removerItem = async (id) => {
  await idbDelete(LOJAS.outbox, id);
};

export const descartarItem = async (id) => {
  await removerItem(id);
  emitirOutbox();
};

export const descartarComErro = async (usuarioId) => {
  const itens = await listarOutbox(usuarioId);
  await Promise.all(itens.filter((i) => i.estado === 'erro').map((i) => removerItem(i.id)));
  emitirOutbox();
};

// { pendentes, comErro, erros: [{ id, mensagem }] } do usuário
export const resumoOutbox = async (usuarioId) => {
  const itens = await listarOutbox(usuarioId);
  const comErro = itens.filter((i) => i.estado === 'erro');
  return {
    pendentes: itens.length - comErro.length,
    comErro: comErro.length,
    erros: comErro.map((i) => ({ id: i.id, mensagem: i.ultimoErro || 'Falha ao enviar' })),
    sessaoExpirada: itens.some((i) => i.estado !== 'erro' && i.aguardandoLogin)
  };
};

const rotuloAcao = { status: 'status da atividade', falta_material: 'falta de material' };
export const rotuloDoItem = (item) => rotuloAcao[item.tipo] || 'ação';
