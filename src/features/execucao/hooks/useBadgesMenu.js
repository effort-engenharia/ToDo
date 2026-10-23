import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase/config';

// Contadores de pendências do menu do admin (horas extras a aprovar e contratos a planejar).
// Falhas são silenciosas: o menu simplesmente fica sem selo.
export function useBadgesMenu(ativo) {
  const [badges, setBadges] = useState({});

  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    let timer;

    const carregar = async () => {
      try {
        const [extras, contratos] = await Promise.all([
          supabase.from('execucao_horas_extras').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
          supabase.rpc('execucao_contar_contratos_pendentes'),
        ]);
        if (!vivo) return;
        setBadges({
          'horas-extras': extras.count || 0,
          'planejamento-macro': typeof contratos.data === 'number' ? contratos.data : 0,
        });
      } catch {
        /* sem selo */
      }
      if (vivo && document.visibilityState !== 'hidden') timer = setTimeout(carregar, 120000);
      else if (vivo) timer = setTimeout(carregar, 120000);
    };

    carregar();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') { clearTimeout(timer); carregar(); }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; clearTimeout(timer); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [ativo]);

  return badges;
}
