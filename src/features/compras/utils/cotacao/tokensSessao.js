// Tokens em claro dos links de cotação (plano §10.3). O banco só guarda o hash: o token vem UMA vez de `abrir()`/`gerarLink()`.
// Ficam apenas em sessionStorage ('cmp:tokens:<cotacao_id>' → { <convite_id>: token }), nunca em localStorage/log/URL do app.
// Sem React: usado também pelo logout (AuthContext) para limpar tudo.

const PREFIXO = 'cmp:tokens:';

const armazenamento = () => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
};

export const lerTokens = (cotacaoId) => {
  const s = armazenamento();
  if (!s || !cotacaoId) return {};
  try {
    const bruto = JSON.parse(s.getItem(PREFIXO + cotacaoId) || '{}');
    return bruto && typeof bruto === 'object' ? bruto : {};
  } catch {
    return {};
  }
};

export const salvarTokens = (cotacaoId, parcial) => {
  const s = armazenamento();
  if (!s || !cotacaoId) return;
  try { s.setItem(PREFIXO + cotacaoId, JSON.stringify({ ...lerTokens(cotacaoId), ...parcial })); } catch { /* storage cheio/bloqueado: o link só poderá ser regenerado */ }
};

export const removerTokens = (cotacaoId) => {
  try { armazenamento()?.removeItem(PREFIXO + cotacaoId); } catch { /* ignora */ }
};

// Logout: apaga todos os 'cmp:tokens:*'
export const limparTokensSessao = () => {
  const s = armazenamento();
  if (!s) return;
  try {
    Object.keys(s).filter((k) => k.startsWith(PREFIXO)).forEach((k) => s.removeItem(k));
  } catch { /* ignora */ }
};

// Link público: o token vai no fragmento (#), que o navegador nunca envia ao servidor (§9.1)
export const urlCotacao = (token, origem = typeof window !== 'undefined' ? window.location.origin : '') => `${origem}/cotacao/#${token}`;
