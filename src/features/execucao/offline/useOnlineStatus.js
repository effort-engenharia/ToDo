import { useSyncExternalStore } from 'react';

const assinar = (aoMudar) => {
  window.addEventListener('online', aoMudar);
  window.addEventListener('offline', aoMudar);
  return () => {
    window.removeEventListener('online', aoMudar);
    window.removeEventListener('offline', aoMudar);
  };
};

// `navigator.onLine` só detecta "sem rede" (modo avião/sem sinal); rede ruim é tratada pelos timeouts/retries
export function useOnlineStatus() {
  return useSyncExternalStore(assinar, () => navigator.onLine !== false, () => true);
}
