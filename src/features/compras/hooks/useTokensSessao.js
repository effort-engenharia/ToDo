import { useCallback, useState } from 'react';
import { lerTokens, removerTokens, salvarTokens } from '../utils/cotacao/tokensSessao';

// Tokens dos links da cotação em sessionStorage (por cotação). `tokens` = { <convite_id>: token }.
export function useTokensSessao(cotacaoId) {
  const [tokens, setTokens] = useState(() => lerTokens(cotacaoId));
  const [idAnterior, setIdAnterior] = useState(cotacaoId);
  if (cotacaoId !== idAnterior) { setIdAnterior(cotacaoId); setTokens(lerTokens(cotacaoId)); }

  // `parcial` = { <convite_id>: token }
  const guardar = useCallback((parcial) => {
    salvarTokens(cotacaoId, parcial);
    setTokens((t) => ({ ...t, ...parcial }));
  }, [cotacaoId]);

  const limpar = useCallback(() => { removerTokens(cotacaoId); setTokens({}); }, [cotacaoId]);
  // Relê do sessionStorage (ex.: o assistente do rascunho gravou os tokens ao abrir a cotação)
  const recarregar = useCallback(() => setTokens(lerTokens(cotacaoId)), [cotacaoId]);

  return { tokens, guardar, limpar, recarregar };
}

export default useTokensSessao;
