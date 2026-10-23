import { useCallback, useEffect, useRef, useState } from 'react';

// Carrega dados assíncronos descartando respostas obsoletas (troca rápida de filtro/aba).
// `fetcher` deve retornar { success, data, message } (padrão do execucaoService).
export function useAsyncData(fetcher, deps, { initialData = null } = {}) {
  const [state, setState] = useState({ data: initialData, loading: true, error: null });
  const reqId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fetcherRef.current();
      if (id !== reqId.current) return;
      if (r && r.success === false) throw new Error(r.message || 'Falha ao carregar');
      setState({ data: r && 'data' in r ? r.data ?? initialData : r, loading: false, error: null });
    } catch (e) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error: e.message || 'Falha ao carregar' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    return () => { reqId.current += 1; };
  }, [load]);

  return { ...state, reload: load };
}
