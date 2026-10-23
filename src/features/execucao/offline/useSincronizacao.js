import { useCallback, useEffect, useRef, useState } from 'react';
import { assinarOutbox, descartarComErro, resumoOutbox } from './outbox';
import { estaSincronizando, iniciarSincronizacao, sincronizar } from './sincronizador';
import { useOnlineStatus } from './useOnlineStatus';

const RESUMO_VAZIO = { pendentes: 0, comErro: 0, erros: [], sessaoExpirada: false };

// Estado da fila do técnico para a UI + inicia o motor de sincronização (uma vez por aplicativo).
// `aoSincronizar` roda quando ações pendentes foram enviadas (use para recarregar a tela).
export function useSincronizacao(usuarioId, { aoSincronizar } = {}) {
  const online = useOnlineStatus();
  const [resumo, setResumo] = useState(RESUMO_VAZIO);
  const [sincronizando, setSincronizando] = useState(false);
  const aoSincronizarRef = useRef(aoSincronizar);
  aoSincronizarRef.current = aoSincronizar;

  const atualizar = useCallback(async () => {
    try {
      setResumo(await resumoOutbox(usuarioId));
    } catch {
      setResumo(RESUMO_VAZIO);
    }
    setSincronizando(estaSincronizando());
  }, [usuarioId]);

  useEffect(() => {
    iniciarSincronizacao();
    atualizar();
    return assinarOutbox((evento) => {
      if (evento?.tipo === 'sincronizado') aoSincronizarRef.current?.(evento);
      atualizar();
    });
  }, [atualizar]);

  return {
    online,
    sincronizando,
    ...resumo,
    enviarAgora: () => sincronizar({ motivo: 'manual' }),
    descartarErros: async () => { await descartarComErro(usuarioId); }
  };
}
