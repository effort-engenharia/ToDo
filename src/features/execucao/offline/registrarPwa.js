// Registro do service worker do PWA. Só é chamado quando o técnico abre telas do módulo Execução
// (via iniciarSincronizacao), então quem usa apenas o dashboard Comercial nunca registra o SW.
// Desativar: build com VITE_PWA_SELF_DESTROY=1 (ver vite.config.js), ou `localStorage.effort_sw_off = '1'` no aparelho.

let registrado = false;

export const desregistrarServiceWorkers = async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } catch (erro) {
    console.warn('Falha ao remover o service worker:', erro);
  }
};

export async function registrarPwa() {
  if (registrado || import.meta.env.DEV || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  registrado = true;
  try {
    if (import.meta.env.VITE_PWA_SELF_DESTROY === '1' || localStorage.getItem('effort_sw_off') === '1') {
      await desregistrarServiceWorkers();
      return;
    }
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  } catch (erro) {
    console.warn('PWA não registrado:', erro);
  }
}
