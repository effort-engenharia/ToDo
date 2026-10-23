import { useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase/config';

// Atualiza a tela do técnico quando algo muda para ele: atividade nova/alterada, equipe e notificações.
// Realtime (instantâneo) + reforço a cada `intervaloMs` e ao voltar para o app/conexão, caso o Realtime falhe.
// `aoMudar` deve ser uma atualização silenciosa (sem piscar "carregando").
export function useAtualizacaoAoVivo(usuarioId, aoMudar, { intervaloMs = 60000, ativo = true } = {}) {
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;

  useEffect(() => {
    if (!usuarioId || !ativo) return undefined;

    let vivo = true;
    let debounce = null;
    let reforco = null;

    const visivelEOnline = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const disparar = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { if (vivo && visivelEOnline()) aoMudarRef.current?.(); }, 500);
    };

    let canal = null;
    let assinatura = null;

    // O Realtime precisa do token do usuário ANTES de assinar: sem isso a assinatura entra como anônima e o RLS
    // descarta todos os eventos (ficaria "conectado" mas mudo).
    const conectar = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!vivo) return;
        if (data?.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
        if (!vivo) return;
        const filtro = (tabela, coluna) => ({ event: '*', schema: 'public', table: tabela, filter: `${coluna}=eq.${usuarioId}` });
        canal = supabase
          .channel(`execucao-ao-vivo-${usuarioId}-${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', filtro('execucao_atividades', 'tecnico_responsavel_id'), disparar)
          .on('postgres_changes', filtro('execucao_atividades_equipe', 'usuario_id'), disparar)
          .on('postgres_changes', filtro('execucao_notificacoes', 'destinatario_id'), disparar)
          .subscribe();
        // Token renovado: repassa ao Realtime para a assinatura continuar valendo
        const { data: listener } = supabase.auth.onAuthStateChange((evento, sessao) => {
          if (sessao?.access_token && (evento === 'TOKEN_REFRESHED' || evento === 'SIGNED_IN')) supabase.realtime.setAuth(sessao.access_token);
        });
        assinatura = listener?.subscription ?? null;
      } catch {
        canal = null; // sem Realtime: segue só o reforço periódico
      }
    };
    conectar();

    const agendarReforco = () => {
      reforco = setTimeout(() => {
        if (!vivo) return;
        if (visivelEOnline()) aoMudarRef.current?.();
        agendarReforco();
      }, intervaloMs);
    };
    agendarReforco();

    const aoVoltar = () => { if (visivelEOnline()) disparar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoVoltar);

    return () => {
      vivo = false;
      clearTimeout(debounce);
      clearTimeout(reforco);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoVoltar);
      assinatura?.unsubscribe();
      if (canal) supabase.removeChannel(canal);
    };
  }, [usuarioId, ativo, intervaloMs]);
}
