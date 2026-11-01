// Carrega o módulo de gravação (chunk separado) com 1 nova tentativa.
// Após um deploy, o chunk antigo some do servidor e o import() rejeita; nesse caso pede para atualizar o app.
export const MENSAGEM_ATUALIZAR_APP = 'Atualize o app para usar a gravação (há uma versão nova disponível).';

const espera = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export async function importarGravador() {
  try {
    return await import('./gravador.js');
  } catch {
    await espera(600);
    try {
      return await import('./gravador.js');
    } catch (e) {
      throw Object.assign(new Error(MENSAGEM_ATUALIZAR_APP), { name: 'ChunkLoadError', causa: e });
    }
  }
}

export const ehErroDeChunk = (err) => err?.name === 'ChunkLoadError';

// Falha de chunk: confirma com o usuário e recarrega (gravações já salvas ficam no IndexedDB).
export function oferecerAtualizacao() {
  if (typeof window === 'undefined') return;
  if (window.confirm('Há uma versão nova do app. Atualizar agora? Suas evidências já salvas no aparelho são mantidas.')) {
    window.location.reload();
  }
}
