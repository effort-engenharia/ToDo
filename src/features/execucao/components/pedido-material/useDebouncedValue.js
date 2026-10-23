import { useEffect, useState } from 'react';

export default function useDebouncedValue(valor, atrasoMs = 250) {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), atrasoMs);
    return () => clearTimeout(t);
  }, [valor, atrasoMs]);
  return debounced;
}
