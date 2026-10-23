import { idbAll, idbClear, idbDelete, idbGet, idbPut, LOJAS } from './idb';
import { ehErroDeRede } from './erros';

// Cache das leituras do técnico (atividades de hoje/semana, contexto da obra/POP). Regras:
//  - online: usa a rede e atualiza o cache (resposta parcial não sobrescreve o que já estava salvo);
//  - sem sinal, ou rede lenta/falhando: devolve o último cache do mesmo dia, marcado com `salvoEm`;
//  - sem cache: devolve o erro original.
// A chave inclui o usuário e o dia, então outro técnico no mesmo aparelho nunca vê dados alheios.

const TEMPO_LIMITE_MS = 12000;
const VALIDADE_MS = 8 * 24 * 60 * 60 * 1000;
const SEM_CONEXAO = 'Sem conexão e sem dados salvos neste aparelho. Abra o app com sinal ao menos uma vez por dia.';

const chaveCompleta = (usuarioId, chave) => `${usuarioId}:${chave}`;

// O flag em localStorage permite ao logout saber (sem carregar este módulo) se há cache a limpar
const FLAG_CACHE = 'effort_offline_cache';

export const salvarCache = (usuarioId, chave, data) => {
  try { localStorage.setItem(FLAG_CACHE, '1'); } catch { /* sem localStorage */ }
  return idbPut(LOJAS.cache, { chave: chaveCompleta(usuarioId, chave), usuarioId, salvoEm: Date.now(), data });
};

export const lerCache = async (usuarioId, chave) => {
  const registro = await idbGet(LOJAS.cache, chaveCompleta(usuarioId, chave));
  if (!registro || Date.now() - registro.salvoEm > VALIDADE_MS) return null;
  return registro;
};

export const limparCache = async () => {
  await idbClear(LOJAS.cache);
  try { localStorage.removeItem(FLAG_CACHE); } catch { /* sem localStorage */ }
};

// Remove entradas antigas (chamado ao iniciar a sincronização)
export const podarCache = async () => {
  const registros = await idbAll(LOJAS.cache);
  await Promise.all(
    registros.filter((r) => Date.now() - r.salvoEm > VALIDADE_MS).map((r) => idbDelete(LOJAS.cache, r.chave))
  );
};

const LIMITE = Symbol('limite');
const comLimite = (promessa) => {
  let timer;
  const limite = new Promise((resolver) => { timer = setTimeout(() => resolver(LIMITE), TEMPO_LIMITE_MS); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
};

// Mantém o `contexto` (cliente/endereço/POP) já salvo quando a nova resposta veio sem ele por falha pontual
export const preservarContexto = (novas, antigas) => {
  const porId = new Map((antigas ?? []).filter((a) => a?.contexto).map((a) => [a.id, a.contexto]));
  if (!porId.size) return novas;
  return (novas ?? []).map((a) => (!a.contexto && porId.has(a.id) ? { ...a, contexto: porId.get(a.id) } : a));
};

/**
 * @param usuarioId
 * @param chave        identifica a leitura (inclua o dia): ex. `meu-dia:2026-10-23`
 * @param buscar       () => Promise<{ success, data, message, parcial? }>
 * @param preparar     (data, dataAntiga|null) => data   (opcional; roda antes de salvar)
 * @returns mesmo formato de `buscar`, mais `offline: true` e `salvoEm` quando veio do cache
 */
export async function carregarComCache({ usuarioId, chave, buscar, preparar }) {
  const doCache = async (falha) => {
    const registro = await lerCache(usuarioId, chave).catch(() => null);
    if (registro) return { success: true, data: registro.data, offline: true, salvoEm: registro.salvoEm };
    return falha ?? { success: false, message: SEM_CONEXAO };
  };

  const finalizar = async (r) => {
    if (r.parcial) return r;
    let data = r.data;
    try {
      if (preparar) {
        const antigo = await lerCache(usuarioId, chave).catch(() => null);
        data = preparar(data, antigo?.data ?? null);
      }
      salvarCache(usuarioId, chave, data).catch((erro) => console.warn('Cache offline não gravado:', erro));
    } catch (erro) {
      console.warn('Cache offline não preparado:', erro);
    }
    return { ...r, data };
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return doCache();

  const requisicao = (async () => {
    try {
      return await buscar();
    } catch (erro) {
      return { success: false, message: erro?.message, erroOriginal: erro };
    }
  })();

  const resposta = await comLimite(requisicao);

  if (resposta === LIMITE) {
    const emCache = await doCache(null);
    if (emCache.success) {
      // A resposta tardia ainda atualiza o cache para a próxima abertura
      requisicao.then((r) => { if (r?.success) finalizar(r); });
      return emCache;
    }
    const tardia = await requisicao;
    return tardia?.success ? finalizar(tardia) : tardia;
  }

  if (resposta?.success) return finalizar(resposta);
  if (ehErroDeRede(resposta)) {
    const emCache = await doCache(resposta);
    return emCache.success ? emCache : { ...resposta, message: SEM_CONEXAO };
  }
  if (resposta?.erroOriginal) throw resposta.erroOriginal;
  return resposta;
}

// Pré-carrega uma leitura em segundo plano (ex.: amanhã, semana) se o cache dela estiver velho. Nunca lança.
export async function preCarregar({ usuarioId, chave, buscar, preparar, maxIdadeMs = 30 * 60 * 1000 }) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const atual = await lerCache(usuarioId, chave);
    if (atual && Date.now() - atual.salvoEm < maxIdadeMs) return;
    const r = await buscar();
    if (!r?.success || r.parcial) return;
    await salvarCache(usuarioId, chave, preparar ? preparar(r.data, atual?.data ?? null) : r.data);
  } catch (erro) {
    console.warn('Pré-carregamento offline ignorado:', erro);
  }
}
