import { useEffect, useRef } from 'react';

// Navegação a partir das notificações de Compras (F18). Mantida fora de tecnico/navegacaoNotificacao.js (esse arquivo
// é do fluxo do técnico). Compras é um módulo próprio (#/compras). O pedido viaja:
//  - para o módulo Compras: no hash (#/compras?pedido=ID&aba=conversa), lido pelo DashboardCompras;
//  - para o Pedido de Material (ADMIN_EXECUCAO): por sessionStorage + evento, consumido pela tela de destino.
// Só COMPRAS e Administrador acessam o módulo Compras.
const CHAVE = 'execucao:abrir-pedido';
const EVENTO = 'execucao:abrir-pedido';
const PREFIXO_HASH = '#/execucao';
export const HASH_COMPRAS = '#/compras';

// Hash do módulo Compras (inclui o legado #/execucao/compras, de quando Compras era página da Execução)
export const hashEhCompras = (hash = window.location.hash) => /^#\/(execucao\/)?compras(?:[/?]|$)/.test(hash);

// ---- Seções do módulo (plano §10.1): #/compras (pedidos), #/compras/cotacoes[?id=], /fornecedores, /precos, /config ----
export const SECOES_COMPRAS = ['pedidos', 'cotacoes', 'fornecedores', 'precos', 'config'];
export const hashDaSecao = (secao) => (secao && secao !== 'pedidos' ? `${HASH_COMPRAS}/${secao}` : HASH_COMPRAS);

// Seção do hash atual. Hash fora do módulo, legado ou desconhecido → 'pedidos'
export const secaoDoHash = (hash = window.location.hash) => {
  const m = /^#\/(?:execucao\/)?compras\/([a-z]+)(?:[/?]|$)/.exec(hash);
  return m && SECOES_COMPRAS.includes(m[1]) ? m[1] : 'pedidos';
};

// ?id=<uuid> da seção Cotações (detalhe) ou null
export const cotacaoDoHash = (hash = window.location.hash) => {
  const i = hash.indexOf('?');
  if (i < 0 || secaoDoHash(hash) !== 'cotacoes') return null;
  return new URLSearchParams(hash.slice(i + 1)).get('id') || null;
};

export const hashDaCotacao = (id) => `${hashDaSecao('cotacoes')}?${new URLSearchParams({ id })}`;

// Navega para uma seção sem recarregar (App e seções escutam o popstate)
export const irParaSecao = (secao) => {
  const hash = hashDaSecao(secao);
  if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// Abre o detalhe de uma cotação (#/compras/cotacoes?id=…) sem recarregar
export const irParaCotacao = (id) => {
  window.history.pushState(null, '', hashDaCotacao(id));
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const TIPOS_NOTIFICACAO_COMPRAS = ['compra_questionamento', 'compra_resposta', 'compra_status', 'compra_cotacao', 'compra_alteracao'];

export const ehNotificacaoCompras = (notif) => TIPOS_NOTIFICACAO_COMPRAS.includes(notif?.tipo);

// Retorna { pagina, pedidoId, aba } | { pagina: 'cotacao', cotacaoId } ou null (notificação não é de Compras / perfil sem tela de destino)
// `noModuloCompras`: o sino está no módulo Compras, onde toda notificação de Compras abre o pedido no próprio módulo
export const destinoComprasDaNotificacao = (notif, { isAdmin = false, noModuloCompras = false } = {}) => {
  if (!ehNotificacaoCompras(notif)) return null;
  // compra_cotacao: abre o detalhe da cotação (só existe no módulo Compras; ADMIN_EXECUCAO não recebe esse tipo)
  const cotacaoId = notif?.referencia?.cotacao_id ?? null;
  if (notif.tipo === 'compra_cotacao') {
    return noModuloCompras && cotacaoId ? { pagina: 'cotacao', cotacaoId } : null;
  }
  const pedidoId = notif?.referencia?.pedido_id ?? null;
  if (!pedidoId) return null;
  const aba = notif.tipo === 'compra_status' ? 'itens' : 'conversa';
  // No módulo Compras (COMPRAS/Administrador) toda notificação abre o drawer do pedido
  if (noModuloCompras) return { pagina: 'compras', pedidoId, aba };
  // Na Execução (ADMIN_EXECUCAO) NUNCA abre Compras: o pedido abre na conversa do Pedido de Material
  // (compra_alteracao também: o solicitante vê a conversa com a alteração/aceite pendente)
  if (isAdmin) return { pagina: 'pedido-material', pedidoId, aba: 'conversa' };
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

export const irParaPedido = ({ pagina, pedidoId, cotacaoId = null, aba = null }) => {
  if (pagina === 'cotacao') {
    irParaCotacao(cotacaoId);
    return;
  }
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
