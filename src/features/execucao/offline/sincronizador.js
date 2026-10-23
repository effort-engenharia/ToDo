import { isImpersonating } from '../../../utils/impersonationGuard';
import { classificarErro, mensagemDe, TIPO_ERRO } from './erros';
import { atualizarItem, emitirOutbox, listarOutbox, removerItem, rotuloDoItem } from './outbox';
import { podarCache } from './cacheLeitura';
import { registrarPwa } from './registrarPwa';

// Motor de sincronização da fila. Dispara com: voltar a conexão (online), app voltar ao primeiro plano
// (visibilitychange), Background Sync (o SW acorda a página), timer de retry e botão "Enviar agora".
// Cada item usa seu idCliente, então reenviar é seguro (idempotente no servidor).

const TAG_BG_SYNC = 'execucao-outbox';
const MAX_TENTATIVAS_DESCONHECIDO = 5;
const ESPERA_MIN_MS = 5000;
const ESPERA_MAX_MS = 15 * 60 * 1000;
const ESPERA_SESSAO_MS = 60 * 1000;

const executores = {};
let sincronizando = false;
let timer = null;
let iniciado = false;

// executor(item) -> { success, message?, blocked? }
export const registrarExecutor = (tipo, executor) => {
  executores[tipo] = executor;
};

export const executarItem = (item) => {
  const executor = executores[item.tipo];
  return executor ? executor(item) : Promise.resolve({ success: false, message: `Ação desconhecida: ${item.tipo}` });
};

export const estaSincronizando = () => sincronizando;

export const usuarioAtualId = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario_dashboard') || 'null')?.id ?? null;
  } catch {
    return null;
  }
};

const estaOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const esperaDeRetry = (tentativas) =>
  Math.min(ESPERA_MAX_MS, ESPERA_MIN_MS * 2 ** Math.max(0, tentativas - 1)) * (0.8 + Math.random() * 0.4);

const mensagemFalha = (item, falha) =>
  `${rotuloDoItem(item)}: ${mensagemDe(falha) || 'falha ao enviar'}`;

async function processarFila(usuarioId, motivo) {
  const itens = (await listarOutbox(usuarioId)).filter((i) => i.estado !== 'erro');
  const respeitarBackoff = motivo === 'timer';
  const bloqueadas = new Set(); // mantém a ordem das ações de uma mesma atividade
  let enviados = 0;
  let comErro = 0;

  for (const item of itens) {
    if (estaOffline() || isImpersonating()) break;
    if (bloqueadas.has(item.atividadeId)) continue;
    if (respeitarBackoff && item.proximaTentativaEm > Date.now()) {
      bloqueadas.add(item.atividadeId);
      continue;
    }
    if (!executores[item.tipo]) {
      bloqueadas.add(item.atividadeId);
      continue;
    }

    let resultado;
    try {
      resultado = await executarItem(item);
    } catch (erro) {
      resultado = { success: false, message: erro?.message, erroOriginal: erro };
    }

    if (resultado?.success) {
      await removerItem(item.id);
      enviados += 1;
      continue;
    }

    const tipoErro = classificarErro(resultado);
    const tentativas = item.tentativas + 1;
    const ultimoErro = mensagemFalha(item, resultado);

    if (tipoErro === TIPO_ERRO.REDE) {
      await atualizarItem(item.id, {
        tentativas, ultimoErro, aguardandoLogin: false, proximaTentativaEm: Date.now() + esperaDeRetry(tentativas)
      });
      break; // sem conexão útil: não adianta tentar as demais agora
    }
    if (tipoErro === TIPO_ERRO.SESSAO) {
      await atualizarItem(item.id, {
        ultimoErro: 'Sessão expirada. Entre novamente para enviar.',
        aguardandoLogin: true,
        proximaTentativaEm: Date.now() + ESPERA_SESSAO_MS
      });
      break;
    }
    if (tipoErro === TIPO_ERRO.PERMANENTE || tentativas >= MAX_TENTATIVAS_DESCONHECIDO) {
      await atualizarItem(item.id, { estado: 'erro', tentativas, ultimoErro, aguardandoLogin: false });
      comErro += 1;
      continue;
    }
    await atualizarItem(item.id, {
      tentativas, ultimoErro, aguardandoLogin: false, proximaTentativaEm: Date.now() + esperaDeRetry(tentativas)
    });
    bloqueadas.add(item.atividadeId);
  }
  return { enviados, comErro };
}

async function agendarProxima(usuarioId) {
  clearTimeout(timer);
  timer = null;
  if (estaOffline()) return; // o evento `online` retoma
  const pendentes = (await listarOutbox(usuarioId)).filter((i) => i.estado !== 'erro');
  if (!pendentes.length) return;
  const proxima = Math.min(...pendentes.map((i) => i.proximaTentativaEm || 0));
  const espera = Math.max(ESPERA_MIN_MS, proxima - Date.now());
  timer = setTimeout(() => sincronizar({ motivo: 'timer' }), espera);
}

export async function sincronizar({ motivo = 'manual' } = {}) {
  if (sincronizando || estaOffline() || isImpersonating()) return { executado: false };
  const usuarioId = usuarioAtualId();
  if (!usuarioId) return { executado: false };

  const rodar = async () => {
    sincronizando = true;
    emitirOutbox({ tipo: 'estado' }, { local: true });
    try {
      const { enviados, comErro } = await processarFila(usuarioId, motivo);
      emitirOutbox(enviados > 0 || comErro > 0 ? { tipo: 'sincronizado', enviados, comErro } : { tipo: 'mudou' });
      return { executado: true, enviados, comErro };
    } catch (erro) {
      console.error('Erro ao sincronizar a fila offline:', erro);
      return { executado: false };
    } finally {
      sincronizando = false;
      emitirOutbox({ tipo: 'estado' }, { local: true });
      agendarProxima(usuarioId).catch(() => {});
    }
  };

  // Uma aba por vez (as demais só esperam o próximo gatilho)
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('effort-outbox-flush', { ifAvailable: true }, (lock) => (lock ? rodar() : { executado: false }));
  }
  return rodar();
}

// Pede ao Chrome para acordar o app quando voltar a conexão (se houver aba aberta, ela sincroniza)
export async function pedirBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg && 'sync' in reg) await reg.sync.register(TAG_BG_SYNC);
  } catch {
    // sem suporte ou sem permissão: os eventos online/visibilitychange cobrem
  }
}

// Idempotente. Chamado por quem usa as telas do técnico (hooks), nunca pelo app inteiro.
export function iniciarSincronizacao() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;

  registrarPwa();
  navigator.storage?.persist?.().catch(() => {});
  podarCache().catch(() => {});

  window.addEventListener('online', () => setTimeout(() => sincronizar({ motivo: 'online' }), 500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar({ motivo: 'visivel' });
  });
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.tipo === 'EXECUCAO_SYNC') sincronizar({ motivo: 'bg-sync' });
  });

  sincronizar({ motivo: 'inicio' });
}
