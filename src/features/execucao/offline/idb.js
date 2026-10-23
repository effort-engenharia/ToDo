// Wrapper mínimo do IndexedDB (sem bibliotecas). Duas lojas: `cache` (leituras) e `outbox` (ações pendentes).
// Se o IndexedDB não existir/falhar (modo privativo antigo), cai para memória: o app continua funcionando,
// só não sobrevive a recarregar a página.

const NOME_DB = 'effort-execucao-offline';
const VERSAO = 1;
export const LOJAS = { cache: 'cache', outbox: 'outbox' };
const CHAVES = { cache: 'chave', outbox: 'id' };

const memoria = { cache: new Map(), outbox: new Map() };
let usarMemoria = typeof indexedDB === 'undefined';
let abrindo = null;

const abrir = () => {
  if (!abrindo) {
    abrindo = new Promise((resolver, rejeitar) => {
      const req = indexedDB.open(NOME_DB, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const loja of Object.values(LOJAS)) {
          if (!db.objectStoreNames.contains(loja)) db.createObjectStore(loja, { keyPath: CHAVES[loja] });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); abrindo = null; };
        db.onclose = () => { abrindo = null; };
        resolver(db);
      };
      req.onerror = () => rejeitar(req.error);
      req.onblocked = () => rejeitar(new Error('IndexedDB bloqueado'));
    }).catch((erro) => {
      abrindo = null;
      throw erro;
    });
  }
  return abrindo;
};

const executar = async (loja, modo, operacao) => {
  const db = await abrir();
  return new Promise((resolver, rejeitar) => {
    const tx = db.transaction(loja, modo);
    const req = operacao(tx.objectStore(loja));
    tx.oncomplete = () => resolver(req?.result);
    tx.onerror = () => rejeitar(tx.error);
    tx.onabort = () => rejeitar(tx.error || new Error('Transação abortada'));
  });
};

const comFallback = async (loja, modo, operacao, emMemoria) => {
  if (!usarMemoria) {
    try {
      return await executar(loja, modo, operacao);
    } catch (erro) {
      console.warn('IndexedDB indisponível, usando memória:', erro);
      usarMemoria = true;
    }
  }
  return emMemoria(memoria[loja]);
};

export const idbGet = (loja, chave) =>
  comFallback(loja, 'readonly', (s) => s.get(chave), (m) => m.get(chave));

export const idbPut = (loja, valor) =>
  comFallback(loja, 'readwrite', (s) => s.put(valor), (m) => { m.set(valor[CHAVES[loja]], valor); });

export const idbDelete = (loja, chave) =>
  comFallback(loja, 'readwrite', (s) => s.delete(chave), (m) => { m.delete(chave); });

export const idbAll = async (loja) =>
  (await comFallback(loja, 'readonly', (s) => s.getAll(), (m) => [...m.values()])) ?? [];

export const idbClear = (loja) =>
  comFallback(loja, 'readwrite', (s) => s.clear(), (m) => { m.clear(); });

// Lê e grava na mesma transação: uma remoção concorrente nunca é desfeita por uma atualização atrasada.
// `mudar(atual)` devolve o novo registro, ou null para não gravar. Retorna o registro gravado (ou null).
export const idbUpdate = async (loja, chave, mudar) => {
  if (!usarMemoria) {
    try {
      const db = await abrir();
      return await new Promise((resolver, rejeitar) => {
        const tx = db.transaction(loja, 'readwrite');
        const armazem = tx.objectStore(loja);
        let gravado = null;
        const leitura = armazem.get(chave);
        leitura.onsuccess = () => {
          const novo = leitura.result ? mudar(leitura.result) : null;
          if (novo) {
            gravado = novo;
            armazem.put(novo);
          }
        };
        tx.oncomplete = () => resolver(gravado);
        tx.onerror = () => rejeitar(tx.error);
        tx.onabort = () => rejeitar(tx.error || new Error('Transação abortada'));
      });
    } catch (erro) {
      console.warn('IndexedDB indisponível, usando memória:', erro);
      usarMemoria = true;
    }
  }
  const atual = memoria[loja].get(chave);
  const novo = atual ? mudar(atual) : null;
  if (novo) memoria[loja].set(chave, novo);
  return novo;
};
