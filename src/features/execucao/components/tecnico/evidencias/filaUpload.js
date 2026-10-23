// Fila local de upload das evidências: IndexedDB + retry com backoff, reenvio ao voltar a conexão.
// Independente da fila de ações do técnico. Idempotente: caminho/id gerados no cliente; "já existe" = sucesso.
import { EVIDENCIAS_CONFIG as CFG, extensaoDoTipo, novoUuid } from './config.js';
import * as local from './armazenamentoLocal.js';
import { execucaoEvidenciasService, caminhoEvidencia } from '../../../../../services/supabase/execucaoEvidencias.js';

export const TAG_BACKGROUND_SYNC = 'execucao-evidencias';
export const MENSAGEM_SW_SYNC = 'execucao-evidencias-sync';

export const assinarFila = local.assinarMudancas;
export const listarEvidenciasLocais = local.listarItens;
export const armazenamentoLocalDisponivel = local.armazenamentoDisponivel;

export const usuarioIdAtual = () => {
  try {
    return JSON.parse(window.localStorage.getItem('usuario_dashboard') || 'null')?.id ?? null;
  } catch {
    return null;
  }
};

const erro = (mensagem, extra = {}) => Object.assign(new Error(mensagem), extra);

export async function adicionarEvidencia({
  atividadeId, usuarioId, tipo, blob, miniatura = null, mime, tamanhoOriginal = null,
  duracaoSeg = null, comprimido = false, capturadoEm, localizacao = null, conteudo = {}
}) {
  if (!atividadeId || !usuarioId) throw erro('Atividade ou usuário não identificado.');
  const limites = CFG[tipo];
  if (!limites) throw erro('Tipo de evidência inválido.');
  if (blob.size > limites.maxBytes) {
    throw erro(`Arquivo grande demais depois da compressão (${Math.round(blob.size / 1048576)} MB).`);
  }

  const existentes = await local.listarItens(atividadeId);
  if (existentes.length >= CFG.maxArquivosPorAtividade) {
    throw erro(`Limite de ${CFG.maxArquivosPorAtividade} arquivos por atividade atingido.`);
  }
  const livre = await local.espacoLivreBytes();
  if (livre != null && livre < blob.size * 2) throw erro('Pouco espaço livre no aparelho para guardar este arquivo.');

  const item = {
    id: novoUuid(),
    atividadeId,
    usuarioId,
    tipo,
    estado: 'rascunho',
    mime,
    tamanho: blob.size,
    tamanhoOriginal,
    duracaoSeg,
    comprimido,
    capturadoEm: capturadoEm || new Date().toISOString(),
    latitude: localizacao?.latitude ?? null,
    longitude: localizacao?.longitude ?? null,
    precisao: localizacao?.precisao ?? null,
    conteudo: { ...conteudo, localizacao: localizacao?.status ?? 'nao_capturada' },
    miniatura,
    miniaturaMime: miniatura?.type || null,
    tentativas: 0,
    proximaTentativa: null,
    erro: null,
    criadoEm: Date.now()
  };
  await local.salvarItem(item, blob);
  return item;
}

export const removerEvidencia = async (id) => {
  const item = await local.obterItem(id);
  if (item && (item.estado === 'rascunho' || item.estado === 'erro' || item.estado === 'enviado')) await local.removerItem(id);
};

export async function reenviarEvidencia(id) {
  await local.atualizarItem(id, { estado: 'pendente', tentativas: 0, proximaTentativa: null, erro: null });
  processarFila();
}

// Rascunhos da atividade entram na fila de envio (chamado ao confirmar a conclusão)
export async function liberarRascunhos(atividadeId) {
  const itens = await local.listarItens(atividadeId);
  const rascunhos = itens.filter((i) => i.estado === 'rascunho');
  for (const i of rascunhos) await local.atualizarItem(i.id, { estado: 'pendente', liberadoEm: Date.now() });
  if (rascunhos.length) {
    registrarBackgroundSync();
    processarFila();
  }
  return rascunhos.length;
}

async function registrarBackgroundSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.sync) await reg.sync.register(TAG_BACKGROUND_SYNC);
  } catch { /* sem Background Sync: online/visibilitychange cobrem */ }
}

const comTimeout = (promessa, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(erro('Tempo esgotado no envio.', { rede: true })), ms);
  promessa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

const ehErroDeRede = (e) => {
  if (e?.rede) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const texto = `${e?.name ?? ''} ${e?.message ?? ''} ${e?.originalError?.message ?? ''}`.toLowerCase();
  return e instanceof TypeError || /failed to fetch|network|load failed|fetch failed|abort|timeout/.test(texto);
};

const codigoHttp = (e) => Number(e?.statusCode ?? e?.status) || 0;

const ehPermanente = (e) => {
  const http = codigoHttp(e);
  const texto = `${e?.message ?? ''}`.toLowerCase();
  return http === 413 || http === 400 || e?.permanente
    || /maximum allowed size|exceeded|invalid mime|mime type/.test(texto)
    || ['23502', '23514', '23503', '22P02'].includes(e?.code);
};

const mensagemAmigavel = (e) => {
  if (e?.permanente) return e.message;
  const http = codigoHttp(e);
  const texto = `${e?.message ?? ''}`.toLowerCase();
  if (http === 413 || /maximum allowed size|exceeded/.test(texto)) return 'Arquivo acima do limite de 50 MB.';
  if (http === 401 || http === 403 || e?.code === '42501' || /row-level security|jwt|unauthorized/.test(texto)) {
    return 'Sem permissão para enviar (entre de novo no app ou confirme que você faz parte da equipe da atividade).';
  }
  return e?.message || 'Falha no envio.';
};

const esperaBackoff = (tentativas) => {
  const bruto = Math.min(CFG.upload.esperaMaxMs, CFG.upload.esperaBaseMs * 2 ** Math.max(0, tentativas - 1));
  return Math.round(bruto * (0.75 + Math.random() * 0.5));
};

async function enviarItem(item) {
  await local.atualizarItem(item.id, { estado: 'enviando', erro: null });
  try {
    const blob = await local.obterArquivo(item.id);
    if (!blob) throw erro('Arquivo local não encontrado.', { permanente: true });

    const timeout = CFG.upload.timeoutBaseMs + (blob.size / 1048576) * CFG.upload.timeoutPorMbMs;
    const caminho = item.caminho || caminhoEvidencia(item.atividadeId, item.id, extensaoDoTipo(item.mime));
    const caminhoMiniatura = item.miniatura
      ? (item.caminhoMiniatura || caminhoEvidencia(item.atividadeId, item.id, extensaoDoTipo(item.miniaturaMime), true))
      : null;

    await comTimeout(execucaoEvidenciasService.uploadEvidenciaArquivo(caminho, blob, item.mime), timeout);
    if (caminhoMiniatura) {
      await comTimeout(
        execucaoEvidenciasService.uploadEvidenciaArquivo(caminhoMiniatura, item.miniatura, item.miniaturaMime),
        CFG.upload.timeoutBaseMs
      );
    }

    await comTimeout(execucaoEvidenciasService.inserirEvidencia({
      id: item.id,
      atividade_id: item.atividadeId,
      tipo: item.tipo,
      caminho_storage: caminho,
      caminho_miniatura: caminhoMiniatura,
      mime_type: item.mime,
      tamanho_original_bytes: item.tamanhoOriginal,
      tamanho_bytes: item.tamanho,
      duracao_segundos: item.duracaoSeg,
      comprimido: item.comprimido,
      conteudo: item.conteudo,
      capturado_em: item.capturadoEm,
      latitude: item.latitude,
      longitude: item.longitude,
      precisao_metros: item.precisao,
      criado_por: item.usuarioId
    }), CFG.upload.timeoutBaseMs);

    await local.atualizarItem(item.id, { estado: 'enviado', enviadoEm: Date.now(), erro: null, proximaTentativa: null });
    await local.removerArquivo(item.id);
    return 'ok';
  } catch (e) {
    if (e?.code === 'IMPERSONATION_BLOCKED') {
      await local.atualizarItem(item.id, { estado: 'pendente', erro: 'Modo teste ativo: envio suspenso.' });
      return 'bloqueado';
    }
    if (ehErroDeRede(e)) {
      // Falha de rede nunca vira erro definitivo: só espaça as tentativas
      const falhasRede = (item.falhasRede || 0) + 1;
      await local.atualizarItem(item.id, {
        estado: 'pendente',
        falhasRede,
        erro: 'Sem conexão estável. Vamos tentar de novo automaticamente.',
        proximaTentativa: Date.now() + esperaBackoff(Math.min(falhasRede, 6))
      });
      return 'rede';
    }
    const tentativas = item.tentativas + 1;
    const definitivo = ehPermanente(e) || tentativas >= CFG.upload.tentativasMax;
    await local.atualizarItem(item.id, {
      estado: definitivo ? 'erro' : 'pendente',
      tentativas,
      erro: mensagemAmigavel(e),
      proximaTentativa: definitivo ? null : Date.now() + esperaBackoff(tentativas)
    });
    console.warn('[evidencias] falha no envio', item.id, e);
    return 'falha';
  }
}

let rodando = false;
let temporizador = null;

const comTravaEntreAbas = async (executar) => {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('execucao-evidencias-fila', { ifAvailable: true }, (lock) => (lock ? executar() : undefined));
  }
  return executar();
};

const agendarProxima = async () => {
  clearTimeout(temporizador);
  try {
    const usuarioId = usuarioIdAtual();
    const itens = (await local.listarItens()).filter((i) => i.usuarioId === usuarioId && (i.estado === 'pendente' || i.estado === 'enviando'));
    if (!itens.length) return;
    const proxima = Math.min(...itens.map((i) => i.proximaTentativa || 0));
    const espera = Math.max(1000, proxima - Date.now());
    temporizador = setTimeout(processarFila, Math.min(espera, CFG.upload.verificacaoPeriodicaMs * 2));
  } catch { /* armazenamento indisponível */ }
};

// Envia, um por vez, tudo que está pendente e já pode ser tentado. Seguro chamar a qualquer momento.
export async function processarFila() {
  if (rodando || typeof navigator === 'undefined' || navigator.onLine === false) return;
  rodando = true;
  try {
    await comTravaEntreAbas(async () => {
      const usuarioId = usuarioIdAtual();
      if (!usuarioId) return;
      for (;;) {
        const agora = Date.now();
        const candidato = (await local.listarItens())
          .filter((i) => i.usuarioId === usuarioId && (i.estado === 'pendente' || i.estado === 'enviando')
            && (!i.proximaTentativa || i.proximaTentativa <= agora))
          .sort((a, b) => a.criadoEm - b.criadoEm)[0];
        if (!candidato) break;
        const resultado = await enviarItem(candidato);
        if (resultado === 'rede' || resultado === 'bloqueado') break;
      }
    });
  } catch (e) {
    console.warn('[evidencias] fila indisponível', e);
  } finally {
    rodando = false;
    agendarProxima();
  }
}

let iniciada = false;

// Idempotente. Liga os gatilhos de reenvio e limpa registros antigos.
export function iniciarFilaEvidencias() {
  if (iniciada || typeof window === 'undefined') return;
  iniciada = true;

  window.addEventListener('online', processarFila);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') processarFila(); });
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === MENSAGEM_SW_SYNC) processarFila();
  });

  local.persistirArmazenamento();
  limparAntigos().finally(processarFila);
}

async function limparAntigos() {
  try {
    const agora = Date.now();
    for (const i of await local.listarItens()) {
      const antigoRascunho = i.estado === 'rascunho' && agora - i.criadoEm > CFG.retencaoRascunhoMs;
      const antigoEnviado = i.estado === 'enviado' && agora - (i.enviadoEm || i.criadoEm) > CFG.retencaoEnviadoMs;
      if (antigoRascunho || antigoEnviado) await local.removerItem(i.id);
    }
  } catch { /* armazenamento indisponível */ }
}
