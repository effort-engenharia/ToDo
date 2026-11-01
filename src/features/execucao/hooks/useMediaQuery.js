import { useEffect, useState } from 'react';

const suportaMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

// Acompanha uma media query (ex.: '(max-width: 639px)'); reage a rotação e redimensionamento.
export function useMediaQuery(consulta) {
  const [corresponde, setCorresponde] = useState(() => (suportaMatchMedia() ? window.matchMedia(consulta).matches : false));

  useEffect(() => {
    if (!suportaMatchMedia()) return undefined;
    const lista = window.matchMedia(consulta);
    const atualizar = () => setCorresponde(lista.matches);
    atualizar();
    lista.addEventListener('change', atualizar);
    return () => lista.removeEventListener('change', atualizar);
  }, [consulta]);

  return corresponde;
}

// Faixas do Anexo C: XS/S < 640 · M 640–1023 · L ≥ 1024
export const CONSULTA_MOBILE = '(max-width: 639px)';
export const CONSULTA_ABAIXO_MD = '(max-width: 767px)';
export const CONSULTA_ACIMA_LG = '(min-width: 1024px)';
export const CONSULTA_ABAIXO_LG = '(max-width: 1023px)';
