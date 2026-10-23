import { useEffect, useState } from 'react';

// Devolve `valor` somente após `atrasoMs` sem alterações (ex.: campo de busca).
export function useDebouncedValue(valor, atrasoMs = 250) {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), atrasoMs);
    return () => clearTimeout(timer);
  }, [valor, atrasoMs]);

  return debounced;
}
