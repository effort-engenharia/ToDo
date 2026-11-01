// Vocabulário e helpers do Dashboard de Compras (Anexo D.1). Estado nunca só por cor: emoji + texto.

// Classes literais (o Tailwind só gera o que aparece por inteiro no código)
const BADGE = {
  yellow: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/40',
  blue: 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
  purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
  cyan: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  orange: 'bg-orange-500/15 text-orange-300 border border-orange-500/40',
  green: 'bg-green-500/15 text-green-300 border border-green-500/40',
  slate: 'bg-slate-500/15 text-slate-300 border border-slate-500/40',
  red: 'bg-red-500/15 text-red-300 border border-red-500/40',
};

export const STATUS_COMPRA = {
  aguardando_compra: { rotulo: 'Aguardando compra', emoji: '🛒', classe: BADGE.yellow },
  em_cotacao: { rotulo: 'Em cotação', emoji: '🧾', classe: BADGE.blue },
  aguardando_solicitante: { rotulo: 'Aguardando solicitante', emoji: '❓', classe: BADGE.purple },
  comprado: { rotulo: 'Comprado', emoji: '🛍️', classe: BADGE.cyan },
  entregue_parcial: { rotulo: 'Entregue parcial', emoji: '🚚', classe: BADGE.orange },
  entregue: { rotulo: 'Entregue', emoji: '📦', classe: BADGE.green },
  cancelado: { rotulo: 'Cancelado', emoji: '🚫', classe: BADGE.slate },
};

// Status em que o pedido ainda aceita questionamento (N1-j.2) e em que os itens ainda podem mudar (F.2.7)
export const STATUS_ACEITA_QUESTIONAMENTO = ['aguardando_compra', 'em_cotacao'];
export const STATUS_ITENS_TRAVADOS = ['comprado', 'entregue_parcial', 'entregue'];
export const STATUS_TERMINAIS = ['entregue', 'cancelado'];

export const rotuloStatusCompra = (status) => {
  const s = STATUS_COMPRA[status];
  return s ? `${s.emoji} ${s.rotulo}` : status || '—';
};

// Colunas do quadro / abas do mobile. Cada uma agrupa um ou mais status_compra.
// `acao` = ação rápida do cartão (D.2): assumir | comprado | entrega | null
export const COLUNAS_COMPRAS = [
  { id: 'aguardando_compra', rotulo: 'Aguardando compra', emoji: '🛒', status: ['aguardando_compra'], acao: 'assumir' },
  { id: 'em_cotacao', rotulo: 'Em cotação', emoji: '🧾', status: ['em_cotacao'], acao: 'comprado' },
  { id: 'aguardando_solicitante', rotulo: 'Aguardando solicitante', emoji: '❓', status: ['aguardando_solicitante'], acao: null },
  { id: 'comprado', rotulo: 'Comprado', emoji: '🛍️', status: ['comprado', 'entregue_parcial'], acao: 'entrega' },
  { id: 'entregue', rotulo: 'Entregue', emoji: '📦', status: ['entregue'], acao: null },
];

// Ação rápida do cartão conforme a coluna do pedido (D.2)
export const acaoRapidaDoPedido = (pedido) =>
  COLUNAS_COMPRAS.find((c) => c.status.includes(pedido.status_compra))?.acao ?? null;

// Transições válidas de compras_alterar_status (N1-j / F.4). aguardando_solicitante é automático (só sai cancelando).
export const TRANSICOES_COMPRA = {
  aguardando_compra: ['em_cotacao', 'cancelado'],
  em_cotacao: ['aguardando_compra', 'comprado', 'cancelado'],
  aguardando_solicitante: ['cancelado'],
  comprado: ['entregue_parcial', 'entregue', 'cancelado'],
  entregue_parcial: ['entregue', 'cancelado'],
};

export const URGENCIAS = {
  baixa: { rotulo: 'Baixa', emoji: '🔵', classe: BADGE.blue },
  normal: { rotulo: 'Normal', emoji: '⚪', classe: BADGE.slate },
  alta: { rotulo: 'Alta', emoji: '🟠', classe: BADGE.orange },
  urgente: { rotulo: 'Urgente', emoji: '🔴', classe: BADGE.red },
};

export const rotuloUrgencia = (urgencia) => {
  const u = URGENCIAS[urgencia];
  return u ? `${u.emoji} ${u.rotulo}` : urgencia || '—';
};

export const TIPOS_QUESTIONAMENTO = {
  substituicao: { rotulo: 'Substituição', emoji: '🔄' },
  quantidade: { rotulo: 'Quantidade', emoji: '🔢' },
  duvida: { rotulo: 'Dúvida', emoji: '❓' },
};

export const ESTADOS_QUESTIONAMENTO = {
  aberto: { rotulo: 'Aberto', emoji: '🟣', classe: BADGE.purple },
  aprovado: { rotulo: 'Aprovado', emoji: '✅', classe: BADGE.green },
  reprovado: { rotulo: 'Reprovado', emoji: '❌', classe: BADGE.red },
  cancelado: { rotulo: 'Cancelado', emoji: '⚪', classe: BADGE.slate },
};

// Dúvida respondida fica 'aprovado' no banco (F.2.10); na tela vira "Respondido"
export const rotuloEstadoQuestionamento = (q) => {
  if (q?.tipo === 'duvida' && q?.status === 'aprovado') return { rotulo: 'Respondido', emoji: '✅', classe: BADGE.green };
  return ESTADOS_QUESTIONAMENTO[q?.status] ?? { rotulo: q?.status || '—', emoji: '', classe: BADGE.slate };
};

// ---------- Formatação pt-BR ----------

export const formatarDataHora = (valor) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// "há 2 h"; a data completa vai no title/<time dateTime>
export const tempoRelativo = (valor, agora = Date.now()) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const min = Math.max(0, Math.floor((agora - data.getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 48) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
};

const numeroBR = (n, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });

// Durações (D.1): <1 h "45 min"; <48 h "5 h 30 min"; ≥48 h "2,5 dias"
export const formatarDuracaoHoras = (horas) => {
  if (horas === null || horas === undefined || Number.isNaN(Number(horas))) return '—';
  const h = Number(horas);
  // Arredonda o total em minutos ANTES de separar horas/minutos (evita "60 min" e "1 h 60 min")
  const totalMin = Math.max(0, Math.round(h * 60));
  if (totalMin < 60) return `${totalMin} min`;
  if (totalMin < 48 * 60) {
    const inteiras = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return min === 0 ? `${inteiras} h` : `${inteiras} h ${min} min`;
  }
  return `${numeroBR(h / 24)} dias`;
};

export const formatarDuracaoDias = (dias) =>
  dias === null || dias === undefined ? '—' : formatarDuracaoHoras(Number(dias) * 24);

// Dias de atraso da previsão de chegada (data_material_disponivel), 0 se em dia
export const diasDeAtraso = (dataISO, hoje = new Date()) => {
  if (!dataISO) return 0;
  const [y, m, d] = String(dataISO).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 0;
  const alvo = new Date(y, m - 1, d);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((base - alvo) / 86400000));
};

export const itensPreenchidos = (itens) =>
  (Array.isArray(itens) ? itens : []).filter((i) => i?.nome && String(i.nome).trim() !== '');

// "Disjuntor 63A · 2 un"
export const rotuloItem = (item) => {
  if (!item) return '—';
  const qtd = item.quantidade === null || item.quantidade === undefined ? '' : String(item.quantidade).replace('.', ',');
  return [item.nome, [qtd, item.unidade].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
};

// Texto "De → Para" da sugestão de um questionamento (prévia do modal e cartão da conversa)
export const montarPrevia = (item, sugestao) => {
  if (!sugestao) return null;
  const para = {
    nome: sugestao.nome || item?.nome,
    quantidade: sugestao.quantidade ?? item?.quantidade,
    unidade: sugestao.unidade || item?.unidade,
  };
  return { de: item ? rotuloItem(item) : null, para: rotuloItem(para) };
};

// Texto lido por leitor de tela ao focar o título do cartão
export const descricaoAcessivelDoPedido = (p) => {
  const partes = [`Pedido ${p.cliente_nome || p.descricao || ''}`.trim()];
  partes.push(URGENCIAS[p.urgencia]?.rotulo?.toLowerCase() ?? p.urgencia);
  partes.push(p.sem_itens ? 'sem lista de itens' : `${p.qtd_itens ?? 0} itens`);
  const atraso = diasDeAtraso(p.data_material_disponivel);
  if (p.atrasado && atraso > 0) partes.push(`${atraso} dias atrasado`);
  if (p.qtd_questionamentos_abertos > 0) partes.push(`${p.qtd_questionamentos_abertos} questionamento(s) aberto(s)`);
  return partes.filter(Boolean).join(', ');
};
