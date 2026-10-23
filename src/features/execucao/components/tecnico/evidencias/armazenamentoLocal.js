// IndexedDB próprio das evidências pendentes (sem biblioteca).
// "itens": metadados + miniatura (leve, listado na tela); "arquivos": o blob comprimido (pesado).

const NOME_DB = 'effort-execucao-evidencias';
const VERSAO = 1;
const CANAL = 'execucao-evidencias';

let dbPromise = null;
const ouvintes = new Set();
let canal = null;

const abrirCanal = () => {
  if (canal || typeof BroadcastChannel === 'undefined') return;
  canal = new BroadcastChannel(CANAL);
  canal.onmessage = () => ouvintes.forEach((fn) => fn());
};

export const assinarMudancas = (fn) => {
  abrirCanal();
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
};

const notificar = () => {
  ouvintes.forEach((fn) => fn());
  try { canal?.postMessage('mudou'); } catch { /* canal fechado */ }
};

const abrir = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Armazenamento local indisponível neste navegador.'));
      return;
    }
    const req = indexedDB.open(NOME_DB, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('itens')) {
        const itens = db.createObjectStore('itens', { keyPath: 'id' });
        itens.createIndex('atividadeId', 'atividadeId');
        itens.createIndex('estado', 'estado');
      }
      if (!db.objectStoreNames.contains('arquivos')) db.createObjectStore('arquivos');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Falha ao abrir o armazenamento local.'));
    req.onblocked = () => reject(new Error('Armazenamento local bloqueado por outra aba.'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
};

const pedido = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const transacao = async (stores, modo, executar) => {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, modo);
    let resultado;
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação cancelada (armazenamento cheio?).'));
    Promise.resolve(executar(tx)).then((r) => { resultado = r; }).catch((e) => {
      try { tx.abort(); } catch { /* já finalizada */ }
      reject(e);
    });
  });
};

export const armazenamentoDisponivel = async () => {
  try { await abrir(); return true; } catch { return false; }
};

export const salvarItem = async (item, blob) => {
  await transacao(['itens', 'arquivos'], 'readwrite', (tx) => {
    tx.objectStore('itens').put(item);
    if (blob) tx.objectStore('arquivos').put(blob, item.id);
  });
  notificar();
};

// Leitura-modificação-gravação atômica de um item; `patch` pode ser objeto ou função(item) → objeto
export const atualizarItem = async (id, patch) => {
  const atualizado = await transacao(['itens'], 'readwrite', async (tx) => {
    const store = tx.objectStore('itens');
    const atual = await pedido(store.get(id));
    if (!atual) return null;
    const novo = { ...atual, ...(typeof patch === 'function' ? patch(atual) : patch) };
    store.put(novo);
    return novo;
  });
  if (atualizado) notificar();
  return atualizado;
};

export const obterItem = async (id) => transacao(['itens'], 'readonly', (tx) => pedido(tx.objectStore('itens').get(id)));

export const obterArquivo = async (id) => transacao(['arquivos'], 'readonly', (tx) => pedido(tx.objectStore('arquivos').get(id)));

export const listarItens = async (atividadeId = null) => transacao(['itens'], 'readonly', (tx) => {
  const store = tx.objectStore('itens');
  return pedido(atividadeId ? store.index('atividadeId').getAll(atividadeId) : store.getAll());
});

export const removerArquivo = async (id) => {
  await transacao(['arquivos'], 'readwrite', (tx) => { tx.objectStore('arquivos').delete(id); });
};

export const removerItem = async (id) => {
  await transacao(['itens', 'arquivos'], 'readwrite', (tx) => {
    tx.objectStore('itens').delete(id);
    tx.objectStore('arquivos').delete(id);
  });
  notificar();
};

// Pede ao navegador para não despejar os dados da fila sob pressão de armazenamento
export const persistirArmazenamento = async () => {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) {
      return await navigator.storage.persist();
    }
  } catch { /* não suportado */ }
  return false;
};

export const espacoLivreBytes = async () => {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    return quota && usage != null ? quota - usage : null;
  } catch {
    return null;
  }
};
