// Normalização de nome e unidade para catálogo e histórico de preços.
// Espelha `compras_normalizar_nome` e `compras_normalizar_unidade` do SQL (plano §5.3). Se um mudar, o outro muda junto.

// lower, remove acentos pt-BR, troca [^a-z0-9,.] por espaço, colapsa espaços e apara.
export const normalizarNome = (texto) => String(texto ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9,.]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const MAPA_UNIDADES = {
  un: 'un', und: 'un', unid: 'un', unidade: 'un', pc: 'un', peca: 'un', 'peça': 'un',
  m: 'm', mt: 'm', metro: 'm', metros: 'm',
  cx: 'cx', caixa: 'cx',
  pct: 'pct', pacote: 'pct',
  kg: 'kg',
  l: 'l', lt: 'l', litro: 'l',
  m2: 'm2', 'm²': 'm2', m3: 'm3', 'm³': 'm3',
  rolo: 'rolo', barra: 'barra', saco: 'saco', galao: 'galao'
};

// Unidade desconhecida passa por lower(trim) (igual ao SQL).
export const normalizarUnidade = (texto) => {
  const base = String(texto ?? '').toLowerCase().trim();
  return Object.hasOwn(MAPA_UNIDADES, base) ? MAPA_UNIDADES[base] : base;
};

// Chave de consolidação de itens (§5.4): material confirmado vence; senão nome|unidade normalizados.
export const chaveConsolidacao = ({ material_id: materialId, nome, descricao, unidade } = {}) => (
  materialId ? `mat:${materialId}` : `${normalizarNome(nome ?? descricao)}|${normalizarUnidade(unidade)}`
);
