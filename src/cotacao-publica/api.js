// Cliente HTTP da página pública (plano §9.2). Só `fetch`: NÃO importa o supabase-js nem nada de src/services.
// Usa apenas as 2 RPCs públicas, com a anon key (sem sessão). O token nunca vai para console, analytics ou storage em claro.
//
// Variáveis: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (o app logado tem URL/chave fixas em services/supabase/config.js;
// importar aquele arquivo traria o supabase-js para esta entrada, então o build precisa expor as mesmas duas variáveis).
const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TIMEOUT_MS = 15000;

// Resultado sempre { ok, ... }. Falhas locais: codigo 'REDE' (sem conexão/timeout), 'ERRO_SERVIDOR' (HTTP ≠ 2xx), 'CONFIG'.
const chamar = async (fn, corpo) => {
  if (!URL_BASE || !ANON) return { ok: false, codigo: 'CONFIG' };
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controle.signal
    });
    if (!resp.ok) return { ok: false, codigo: 'ERRO_SERVIDOR', status: resp.status };
    const dados = await resp.json();
    return dados && typeof dados === 'object' ? dados : { ok: false, codigo: 'ERRO_SERVIDOR' };
  } catch {
    return { ok: false, codigo: 'REDE' };
  } finally {
    clearTimeout(timer);
  }
};

export const obter = (token) => chamar('cotacao_publica_obter', { p_token: token });
export const responder = (token, resposta) => chamar('cotacao_publica_responder', { p_token: token, p_resposta: resposta });
