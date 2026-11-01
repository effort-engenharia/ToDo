import { dataLocalISO, parseDataLocal } from '../../utils/datas';

// `inteira`: a quantidade dessa unidade só aceita números inteiros (⛳ N1-a: un, cx, pct)
export const UNIDADES = [
  { valor: 'un', rotulo: 'un', inteira: true },
  { valor: 'm', rotulo: 'm', inteira: false },
  { valor: 'm²', rotulo: 'm²', inteira: false },
  { valor: 'kg', rotulo: 'kg', inteira: false },
  { valor: 'l', rotulo: 'L', inteira: false },
  { valor: 'cx', rotulo: 'cx', inteira: true },
  { valor: 'pct', rotulo: 'pct', inteira: true }
];

export const unidadeInteira = (unidade) =>
  UNIDADES.find((u) => u.valor === unidade)?.inteira === true;

// Passo das setas/botões: 1 para unidades inteiras, 0,1 para as demais
export const passoDaUnidade = (unidade) => (unidadeInteira(unidade) ? 1 : 0.1);

export const quantidadeValida = (quantidade) =>
  typeof quantidade === 'number' && Number.isFinite(quantidade) && quantidade > 0;

// Inteira: arredonda para cima (⛳ N1-b). Demais: no máximo 2 casas. Valor vazio/inválido → null.
export const normalizarQuantidade = (valor, unidade) => {
  if (valor === '' || valor === null || valor === undefined) return null;
  const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero)) return null;
  if (unidadeInteira(unidade)) return Math.ceil(numero - 1e-9);
  return Math.round(numero * 100) / 100;
};

// 2.5 → "2,5" (pt-BR); vazio → ''
export const formatarQuantidade = (quantidade) =>
  quantidade === null || quantidade === undefined || quantidade === ''
    ? ''
    : String(quantidade).replace('.', ',');

// `_key`, `_aviso` e `_erro` são só de UI e nunca são enviados ao banco
export const novoKey = () => crypto.randomUUID();

export const novoItem = () => ({ _key: novoKey(), nome: '', quantidade: 1, unidade: 'un' });

export const itensComKey = (itens) =>
  (Array.isArray(itens) ? itens : []).map((item) => ({ ...item, _key: novoKey() }));

export const itensSemKey = (itens) =>
  (itens ?? []).map((item) => {
    const copia = { ...item };
    delete copia._key;
    delete copia._aviso;
    delete copia._erro;
    return copia;
  });

export const itemPreenchido = (item) => Boolean(item?.nome && item.nome.trim() !== '');

// Atualiza um campo do item. Trocar a unidade para uma inteira normaliza a quantidade
// (arredonda para cima) e deixa um aviso discreto em `_aviso`; editar a quantidade limpa aviso e erro.
export const atualizarCampoItem = (item, campo, valor) => {
  if (campo === 'unidade') {
    const quantidade = normalizarQuantidade(item.quantidade, valor);
    const ajustou = unidadeInteira(valor) && quantidade !== null && quantidade !== item.quantidade;
    return {
      ...item,
      unidade: valor,
      quantidade: quantidade ?? item.quantidade,
      _aviso: ajustou
        ? `Quantidade ajustada de ${formatarQuantidade(item.quantidade)} para ${formatarQuantidade(quantidade)} (${valor} só aceita inteiros).`
        : undefined
    };
  }
  if (campo === 'quantidade') return { ...item, quantidade: valor, _aviso: undefined, _erro: undefined };
  return { ...item, [campo]: valor };
};

// Marca `_erro` nos itens preenchidos com quantidade vazia/≤0 e devolve a `_key` do primeiro inválido
export const marcarItensInvalidos = (itens) => {
  let primeiraKey = null;
  const marcados = itens.map((item) => {
    if (itemPreenchido(item) && !quantidadeValida(item.quantidade)) {
      primeiraKey ??= item._key;
      return { ...item, _erro: 'Informe uma quantidade maior que zero.' };
    }
    return item._erro ? { ...item, _erro: undefined } : item;
  });
  return { itens: marcados, primeiraKey };
};

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

// ---------------------------------------------------------------------------
// Diff de itens (histórico). Puro: recebe as listas gravadas em dados_anteriores/dados_novos.
// ---------------------------------------------------------------------------

// minúsculas, sem acento, sem espaços nas pontas
export const normalizarTexto = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const listaDeItens = (valor) => {
  const lista = parseJSON(valor);
  return Array.isArray(lista) ? lista.filter(itemPreenchido) : [];
};

const mudancasDoItem = (antes, depois) => {
  const mudancas = [];
  if (String(antes.nome ?? '').trim() !== String(depois.nome ?? '').trim()) {
    mudancas.push({ campo: 'nome', de: String(antes.nome ?? '').trim(), para: String(depois.nome ?? '').trim() });
  }
  const qtdAntes = Number(antes.quantidade);
  const qtdDepois = Number(depois.quantidade);
  // NaN × NaN (item sem quantidade dos dois lados) não é alteração
  if (qtdAntes !== qtdDepois && !(Number.isNaN(qtdAntes) && Number.isNaN(qtdDepois))) {
    mudancas.push({ campo: 'quantidade', de: antes.quantidade, para: depois.quantidade });
  }
  if ((antes.unidade || 'un') !== (depois.unidade || 'un')) {
    mudancas.push({ campo: 'unidade', de: antes.unidade || 'un', para: depois.unidade || 'un' });
  }
  return mudancas;
};

// Casa os itens por `id` e, sem id, por nome normalizado + unidade (depois só por nome).
// Retorna { adicionados, removidos, alterados: [{ item, antes, mudancas: [{ campo, de, para }] }] }
export const diffItens = (antesBruto, depoisBruto) => {
  const antes = listaDeItens(antesBruto);
  const depois = listaDeItens(depoisBruto);

  const pares = [];
  const restantesAntes = new Set(antes.map((_, i) => i));
  const restantesDepois = new Set(depois.map((_, i) => i));

  const parear = (iAntes, iDepois) => {
    pares.push([antes[iAntes], depois[iDepois]]);
    restantesAntes.delete(iAntes);
    restantesDepois.delete(iDepois);
  };

  // 1) por id estável
  for (const iDepois of [...restantesDepois]) {
    const id = depois[iDepois].id;
    if (!id) continue;
    const iAntes = [...restantesAntes].find((i) => antes[i].id === id);
    if (iAntes !== undefined) parear(iAntes, iDepois);
  }

  // 2) por nome normalizado + unidade; 3) só por nome (unidade alterada)
  const porNome = (compararUnidade) => {
    for (const iDepois of [...restantesDepois]) {
      const alvo = depois[iDepois];
      const iAntes = [...restantesAntes].find((i) => {
        const candidato = antes[i];
        if (candidato.id && alvo.id) return false; // ids diferentes: itens distintos
        if (normalizarTexto(candidato.nome) !== normalizarTexto(alvo.nome)) return false;
        return !compararUnidade || (candidato.unidade || 'un') === (alvo.unidade || 'un');
      });
      if (iAntes !== undefined) parear(iAntes, iDepois);
    }
  };
  porNome(true);
  porNome(false);

  const alterados = pares
    .map(([a, d]) => ({ item: d, antes: a, mudancas: mudancasDoItem(a, d) }))
    .filter((p) => p.mudancas.length > 0);

  return {
    adicionados: [...restantesDepois].sort((x, y) => x - y).map((i) => depois[i]),
    removidos: [...restantesAntes].sort((x, y) => x - y).map((i) => antes[i]),
    alterados
  };
};
