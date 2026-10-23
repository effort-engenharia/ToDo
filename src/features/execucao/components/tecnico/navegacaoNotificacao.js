import { useEffect, useRef } from 'react';

// Navegação a partir de notificações (0.5). O dashboard só entende "#/execucao/<página>", então o id da
// atividade viaja por sessionStorage + evento, e a tela de destino o consome.
const CHAVE = 'execucao:abrir-atividade';
const EVENTO = 'execucao:abrir-atividade';
const PREFIXO_HASH = '#/execucao';

export const destinoDaNotificacao = (notif, isAdmin) => {
  const ref = notif?.referencia ?? {};
  const atividadeId = notif?.atividade_id ?? ref.atividade_id ?? null;

  if (isAdmin) {
    if (atividadeId) return { pagina: 'atividades-dia', atividadeId };
    if (ref.horas_extra_id || notif?.tipo === 'hora_extra') return { pagina: 'horas-extras' };
    if (ref.pedido_id || notif?.tipo === 'material') return { pagina: 'pedido-material' };
    if (ref.obra_id || notif?.tipo === 'replanejamento') return { pagina: 'planejamento-macro' };
    return { pagina: 'home' };
  }

  if (atividadeId) return { pagina: 'minhas-atividades', atividadeId };
  return { pagina: 'meu-dia' };
};

export const irParaDestino = ({ pagina, atividadeId = null }) => {
  if (atividadeId) {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({ id: atividadeId, pagina }));
    } catch {
      // sessionStorage indisponível: o evento abaixo ainda atende quem já está na tela
    }
  }

  const hash = pagina === 'home' ? PREFIXO_HASH : `${PREFIXO_HASH}/${pagina}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  if (atividadeId) window.dispatchEvent(new CustomEvent(EVENTO, { detail: { id: atividadeId, pagina } }));
};

const consumirPendente = (pagina) => {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const { id, pagina: alvo } = JSON.parse(bruto);
    if (alvo !== pagina) return null;
    sessionStorage.removeItem(CHAVE);
    return id;
  } catch {
    return null;
  }
};

// A tela de destino chama `aoAbrir(atividadeId)` ao montar (se havia pedido pendente) e a cada novo pedido
export function useAbrirAtividadePedida(pagina, aoAbrir) {
  const ref = useRef(aoAbrir);
  ref.current = aoAbrir;

  useEffect(() => {
    const pendente = consumirPendente(pagina);
    if (pendente) ref.current(pendente);

    const aoEvento = () => {
      const id = consumirPendente(pagina);
      if (id) ref.current(id);
    };
    window.addEventListener(EVENTO, aoEvento);
    return () => window.removeEventListener(EVENTO, aoEvento);
  }, [pagina]);
}
