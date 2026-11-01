import { useEffect, useRef } from 'react';

// Navegação a partir das notificações de Compras (F18). Mantida fora de tecnico/navegacaoNotificacao.js (esse arquivo
// é do fluxo do técnico). Compras é um módulo próprio (#/compras). O pedido viaja:
//  - para o módulo Compras: no hash (#/compras?pedido=ID&aba=conversa), lido pelo DashboardCompras;
//  - para o Pedido de Material (admin): por sessionStorage + evento, consumido pela tela de destino.
const CHAVE = 'execucao:abrir-pedido';
const EVENTO = 'execucao:abrir-pedido';
const PREFIXO_HASH = '#/execucao';
export const HASH_COMPRAS = '#/compras';

// Hash do módulo Compras (inclui o legado #/execucao/compras, de quando Compras era página da Execução)
export const hashEhCompras = (hash = window.location.hash) => /^#\/(execucao\/)?compras(?:[/?]|$)/.test(hash);

export const TIPOS_NOTIFICACAO_COMPRAS = ['compra_questionamento', 'compra_resposta', 'compra_status'];

export const ehNotificacaoCompras = (notif) => TIPOS_NOTIFICACAO_COMPRAS.includes(notif?.tipo);

// Retorna { pagina, pedidoId, aba } ou null (notificação não é de Compras / perfil sem tela de pedido)
// `noModuloCompras`: o sino está no módulo Compras, onde toda notificação de Compras abre o pedido no próprio módulo
export const destinoComprasDaNotificacao = (notif, { isAdmin = false, isCompras = false, noModuloCompras = false } = {}) => {
  if (!ehNotificacaoCompras(notif)) return null;
  const pedidoId = notif?.referencia?.pedido_id ?? null;
  if (!pedidoId) return null;
  const aba = notif.tipo === 'compra_status' ? 'itens' : 'conversa';
  if (noModuloCompras) return { pagina: 'compras', pedidoId, aba };
  // Compras sempre abre o drawer do pedido; o admin vê status no Dashboard de Compras e a conversa na gestão do pedido
  if (isCompras && !isAdmin) return { pagina: 'compras', pedidoId, aba };
  if (isAdmin) return { pagina: notif.tipo === 'compra_status' ? 'compras' : 'pedido-material', pedidoId, aba };
  return null;
};

// Monta o hash do Dashboard de Compras com o pedido aberto
export const hashDoPedidoCompras = (pedidoId, aba = null) => {
  const params = new URLSearchParams({ pedido: pedidoId });
  if (aba) params.set('aba', aba);
  return `${HASH_COMPRAS}?${params.toString()}`;
};

// Lê ?pedido=ID&aba=... do hash atual (ou null)
export const pedidoDoHash = () => {
  const hash = window.location.hash;
  const i = hash.indexOf('?');
  if (i < 0 || !hashEhCompras(hash)) return null;
  const params = new URLSearchParams(hash.slice(i + 1));
  const id = params.get('pedido');
  return id ? { id, aba: params.get('aba') } : null;
};

// Abre o módulo Compras (App escuta o popstate e troca de módulo)
export const abrirModuloCompras = () => {
  if (window.location.hash !== HASH_COMPRAS) window.history.pushState(null, '', HASH_COMPRAS);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const irParaPedido = ({ pagina, pedidoId, aba = null }) => {
  if (pagina === 'compras') {
    window.history.pushState(null, '', hashDoPedidoCompras(pedidoId, aba));
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ id: pedidoId, pagina, aba }));
  } catch {
    // sessionStorage indisponível: o evento abaixo ainda atende quem já está na tela
  }
  const hash = `${PREFIXO_HASH}/${pagina}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { id: pedidoId, pagina, aba } }));
};

const consumirPendente = (pagina) => {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const pendente = JSON.parse(bruto);
    if (pendente.pagina !== pagina) return null;
    sessionStorage.removeItem(CHAVE);
    return pendente;
  } catch {
    return null;
  }
};

// A tela de destino chama `aoAbrir({ id, aba })` ao montar (se havia pedido pendente) e a cada novo pedido
export function useAbrirPedidoDaNotificacao(pagina, aoAbrir) {
  const ref = useRef(aoAbrir);
  ref.current = aoAbrir;

  useEffect(() => {
    const pendente = consumirPendente(pagina);
    if (pendente) ref.current(pendente);

    const aoEvento = () => {
      const p = consumirPendente(pagina);
      if (p) ref.current(p);
    };
    window.addEventListener(EVENTO, aoEvento);
    return () => window.removeEventListener(EVENTO, aoEvento);
  }, [pagina]);
}
