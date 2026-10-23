// Service worker do Effort (PWA do módulo Execução).
// Escopo: guarda SÓ o app shell (js/css/html/fontes/ícones) para o app abrir sem internet.
// Nunca intercepta Supabase (API/auth/storage/realtime), Google Sheets nem qualquer dado do dashboard Comercial:
// só há duas rotas, navegação (rede primeiro, cai no index.html salvo) e arquivos pré-cacheados com hash.
// É registrado apenas quando o técnico abre o módulo Execução (ver src/features/execucao/offline/registrarPwa.js).
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

const TEMPO_REDE_MS = 4000;

const navegacaoRedePrimeiro = async ({ request }) => {
  try {
    return await Promise.race([
      fetch(request),
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('timeout')), TEMPO_REDE_MS))
    ]);
  } catch {
    return (await matchPrecache('index.html')) || Response.error();
  }
};

// Registrada antes do precache para que a navegação nunca seja servida do cache primeiro
registerRoute(new NavigationRoute(navegacaoRedePrimeiro, {
  denylist: [/^\/reset-password/, /^\/test-supabase\.html/]
}));

precacheAndRoute(self.__WB_MANIFEST, { directoryIndex: null });

// Background Sync: o token do Supabase fica na página, então o SW só acorda a página para sincronizar.
// Sem nenhuma aba aberta, falha de propósito para o Chrome tentar de novo mais tarde.
self.addEventListener('sync', (event) => {
  const mensagens = {
    'execucao-outbox': { tipo: 'EXECUCAO_SYNC' },
    'execucao-evidencias': { type: 'execucao-evidencias-sync' },
  };
  const mensagem = mensagens[event.tag];
  if (!mensagem) return;
  event.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (abas.length === 0) throw new Error('sem aba aberta');
    abas.forEach((aba) => aba.postMessage(mensagem));
  })());
});
