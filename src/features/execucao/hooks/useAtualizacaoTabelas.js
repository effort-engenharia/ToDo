import { useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase/config';

const DEBOUNCE_MS = 500;
const MAX_ESPERA_MS = 3000;

// Atualiza a tela quando linhas de tabelas (sem filtro por usuário) mudam: o RLS decide o que cada perfil recebe.
// Padrão do useAtualizacaoAoVivo: Realtime com o token do usuário + reforço periódico + ao voltar para o app/conexão.
// `aoMudar` (debounce de 500 ms, com espera máxima de 3 s numa rajada) deve ser uma atualização silenciosa; `aoEvento`
// recebe cada payload na hora (útil para realçar o cartão alterado ou avisar o usuário).
// O reforço periódico (`intervaloMs`) só atualiza quando o Realtime NÃO está conectado (sem Realtime, é o que mantém a tela viva).
export function useAtualizacaoTabelas(tabelas, aoMudar, { aoEvento = null, intervaloMs = 60000, ativo = true } = {}) {
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const aoEventoRef = useRef(aoEvento);
  aoEventoRef.current = aoEvento;
  const chaveTabelas = tabelas.join('|');

  useEffect(() => {
    if (!ativo) return undefined;

    let vivo = true;
    let debounce = null;
    let reforco = null;
    let canal = null;
    let assinatura = null;
    let conectado = false; // Realtime assinado: o polling de reforço só roda quando está desconectado
    let jaConectou = false;
    let primeiroPendente = 0; // início da rajada atual (debounce com maxWait)

    const visivelEOnline = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const executar = () => {
      primeiroPendente = 0;
      if (vivo && visivelEOnline()) aoMudarRef.current?.();
    };
    const disparar = () => {
      const agora = Date.now();
      if (!primeiroPendente) primeiroPendente = agora;
      clearTimeout(debounce);
      // Debounce de 500 ms, mas uma rajada contínua não adia o refresh além de MAX_ESPERA_MS
      debounce = setTimeout(executar, Math.min(DEBOUNCE_MS, Math.max(0, MAX_ESPERA_MS - (agora - primeiroPendente))));
    };
    const aoReceber = (payload) => {
      aoEventoRef.current?.(payload);
      disparar();
    };

    const conectar = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!vivo) return;
        // Sem o token ANTES de assinar, a assinatura entra como anônima e o RLS descarta todos os eventos
        if (data?.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
        if (!vivo) return;
        let construtor = supabase.channel(`execucao-tabelas-${chaveTabelas}-${Math.random().toString(36).slice(2, 8)}`);
        for (const tabela of chaveTabelas.split('|')) {
          construtor = construtor.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, aoReceber);
        }
        canal = construtor.subscribe((status) => {
          const antes = conectado;
          conectado = status === 'SUBSCRIBED';
          // Reconectou depois de uma queda: atualiza uma vez para recuperar o que o Realtime não entregou
          if (conectado && !antes) {
            if (jaConectou) disparar();
            jaConectou = true;
          }
        });
        const { data: listener } = supabase.auth.onAuthStateChange((evento, sessao) => {
          if (sessao?.access_token && (evento === 'TOKEN_REFRESHED' || evento === 'SIGNED_IN')) {
            supabase.realtime.setAuth(sessao.access_token);
          }
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
        if (visivelEOnline() && !conectado) aoMudarRef.current?.();
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
  }, [chaveTabelas, ativo, intervaloMs]);
}
