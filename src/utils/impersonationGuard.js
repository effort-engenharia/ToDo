/**
 * Guarda de impersonation — módulo compartilhado (sem React) para
 * ser consultado por services do Supabase, evitando escritas quando
 * um admin está impersonando outro usuário.
 *
 * Estado mantido em memória + espelho no localStorage para robustez
 * caso o React ainda não tenha hidratado quando um service é chamado.
 */

const STORAGE_KEY = 'admin_original_dashboard';

let impersonating = false;

// Inicializa lendo o localStorage (uma única vez ao importar)
try {
  if (typeof window !== 'undefined') {
    impersonating = !!window.localStorage.getItem(STORAGE_KEY);
  }
} catch {
  impersonating = false;
}

export function setImpersonating(value) {
  impersonating = !!value;
}

export function isImpersonating() {
  if (impersonating) return true;
  try {
    if (typeof window !== 'undefined') {
      return !!window.localStorage.getItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Lança erro se estivermos em impersonation. Uso nos services de escrita:
 *   assertNotImpersonating('criarAtividade');
 */
export function assertNotImpersonating(operacao = 'operação de escrita') {
  if (isImpersonating()) {
    const err = new Error(
      `🎭 Modo teste (impersonation) ativo — ${operacao} bloqueada. ` +
      `Saia da impersonation para gravar dados.`
    );
    err.code = 'IMPERSONATION_BLOCKED';
    throw err;
  }
}

// Prefixos de método considerados escrita — bloqueiam automaticamente
// quando o admin está impersonando outro usuário.
const WRITE_METHOD_PREFIXES = [
  'criar',
  'atualizar',
  'alterar',
  'excluir',
  'salvar',
  'transferir',
  'adicionar',
  'remover',
  'duplicar',
  'registrarHistorico',
  'iniciar',
  'pausar',
  'retomar',
  'concluir',
  'cancelar',
  'aprovar',
  'reprovar',
  'upload',
  'reativar',
  'desativar',
  'inserir',
  'importar'
];

function isWriteMethodName(name) {
  if (typeof name !== 'string') return false;
  return WRITE_METHOD_PREFIXES.some(p => name === p || name.startsWith(p));
}

/**
 * Envolve um objeto de serviço com um Proxy que bloqueia métodos de escrita
 * quando o admin está impersonando. O retorno usa o formato padrão
 * { success: false, message, blocked: true } quando bloqueado, para permanecer
 * compatível com callers que já esperam esse shape. Métodos que lançam por
 * padrão (ex.: throw error) recebem uma rejection com o mesmo Error.
 *
 * @param {object} service objeto com métodos async
 * @param {{throwOnBlock?: boolean, label?: string}} [opts]
 */
export function wrapServiceWithImpersonationGuard(service, opts = {}) {
  const { throwOnBlock = false, label = 'service' } = opts;
  return new Proxy(service, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function' && isWriteMethodName(prop)) {
        return function (...args) {
          try {
            assertNotImpersonating(prop);
          } catch (err) {
            console.warn(`[impersonation] bloqueio em ${label}.${String(prop)}`);
            if (throwOnBlock) {
              return Promise.reject(err);
            }
            return Promise.resolve({ success: false, message: err.message, blocked: true });
          }
          return value.apply(target, args);
        };
      }
      return value;
    }
  });
}
