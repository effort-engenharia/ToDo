import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase/config';

// Evento para recontar os selos logo após uma ação (ex.: responder questionamento), sem esperar o ciclo de 2 min
export const EVENTO_BADGES = 'execucao:badges-atualizar';

const CICLO_MS = 120000;

// Contadores de pendências do menu. Falhas são silenciosas (ex.: migrations de Compras ainda não aplicadas):
// o menu simplesmente fica sem selo.
//  - admin: horas extras a aprovar, contratos a planejar, questionamentos abertos (Pedido de Material)
//  - Compras: respostas de questionamento ainda não lidas (menu Compras)
export function useBadgesMenu({ isAdmin = false, isCompras = false, usuarioId = null } = {}) {
  const [badges, setBadges] = useState({});
  const ativo = isAdmin || (isCompras && Boolean(usuarioId));

  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    let timer;

    const contar = async (consulta) => {
      try {
        const r = await consulta;
        return r.error ? 0 : (r.count || 0);
      } catch {
        return 0;
      }
    };

    const carregar = async () => {
      // Aba oculta: não consulta nem reagenda; ao voltar a ficar visível, `aoVoltar` recarrega
      if (document.hidden) return;
      try {
        if (isAdmin) {
          const [extras, contratos, quests] = await Promise.all([
            supabase.from('execucao_horas_extras').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
            supabase.rpc('execucao_contar_contratos_pendentes'),
            contar(supabase.from('execucao_pedidos_questionamentos').select('id', { count: 'exact', head: true }).eq('status', 'aberto')),
          ]);
          if (!vivo) return;
          setBadges({
            'horas-extras': extras.count || 0,
            'planejamento-macro': typeof contratos.data === 'number' ? contratos.data : 0,
            'pedido-material': quests,
          });
        } else if (isCompras) {
          const respostas = await contar(
            supabase.from('execucao_notificacoes').select('id', { count: 'exact', head: true })
              .eq('lida', false).eq('destinatario_id', usuarioId).eq('tipo', 'compra_resposta')
          );
          if (!vivo) return;
          setBadges({ compras: respostas });
        }
      } catch {
        /* sem selo */
      }
      if (vivo) timer = setTimeout(carregar, CICLO_MS);
    };

    carregar();
    const recontar = () => { clearTimeout(timer); carregar(); };
    const aoVoltar = () => { if (document.visibilityState === 'visible') recontar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener(EVENTO_BADGES, recontar);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener(EVENTO_BADGES, recontar);
    };
  }, [ativo, isAdmin, isCompras, usuarioId]);

  return badges;
}
