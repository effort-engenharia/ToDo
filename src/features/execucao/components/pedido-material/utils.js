import { dataLocalISO, parseDataLocal } from '../../utils/datas';

export const UNIDADES = [
  { valor: 'un', rotulo: 'un' },
  { valor: 'm', rotulo: 'm' },
  { valor: 'm²', rotulo: 'm²' },
  { valor: 'kg', rotulo: 'kg' },
  { valor: 'l', rotulo: 'L' },
  { valor: 'cx', rotulo: 'cx' },
  { valor: 'pct', rotulo: 'pct' }
];

// `_key` é só de UI (key estável do React) e nunca é enviado ao banco
export const novoKey = () => crypto.randomUUID();

export const novoItem = () => ({ _key: novoKey(), nome: '', quantidade: 1, unidade: 'un' });

export const itensComKey = (itens) =>
  (Array.isArray(itens) ? itens : []).map((item) => ({ ...item, _key: novoKey() }));

export const itensSemKey = (itens) =>
  (itens ?? []).map((item) => {
    const copia = { ...item };
    delete copia._key;
    return copia;
  });

export const itemPreenchido = (item) => Boolean(item?.nome && item.nome.trim() !== '');

export const listasComKey = (listas) =>
  listas.map((lista) => ({ ...lista, _key: novoKey(), itens: itensComKey(lista.itens) }));

export const listasSemKey = (listas) =>
  listas.map((lista) => ({ nome: lista.nome, itens: itensSemKey(lista.itens) }));

export const novaLista = (nome = 'Lista Principal') => ({ _key: novoKey(), nome, itens: [novoItem()] });

const parseJSON = (valor) => {
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
};

// Converte template antigo (itens) ou intermediário para o formato atual (listas)
export const converterParaNovoFormato = (template) => {
  const listas = parseJSON(template.listas);
  if (Array.isArray(listas) && listas.length > 0) return listas;

  const dados = parseJSON(template.itens);
  if (Array.isArray(dados) && dados.length > 0) {
    if (dados[0].itens) return dados;
    if (dados[0].nome !== undefined) return [{ nome: 'Lista Principal', itens: dados }];
  }
  return [{ nome: 'Lista Principal', itens: [] }];
};

export const totalItensTemplate = (listas) =>
  listas.reduce((acc, lista) => acc + (lista.itens?.length || 0), 0);

export const isDataAtrasada = (data) => Boolean(data) && String(data).slice(0, 10) < dataLocalISO();

// Dias entre hoje (local) e a data limite; negativo = atrasada
export const calcularDiasRestantes = (data) => {
  const limite = parseDataLocal(data);
  if (!limite) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((limite - hoje) / 86400000);
};
