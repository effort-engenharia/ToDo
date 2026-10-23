// Classificação de falhas do envio: decide se a ação deve ser tentada de novo ou se é um erro definitivo.
export const TIPO_ERRO = {
  REDE: 'rede', // sem sinal/lento/servidor fora: tenta de novo, sem limite
  SESSAO: 'sessao', // login expirado: mantém na fila até o técnico entrar de novo
  PERMANENTE: 'permanente', // regra/permissão: reenviar não adianta
  DESCONHECIDO: 'desconhecido' // tenta algumas vezes e depois vira permanente
};

const REDE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|err_connection|timeout|timed out|abort|offline|bad gateway|service unavailable|gateway time-?out|temporarily unavailable|<html|^\s*5\d\d\b/i;
const SESSAO = /usu[aá]rio n[aã]o autenticado|jwt expired|invalid jwt|not authenticated|refresh token|session (expired|missing)|auth session missing/i;
const PERMANENTE = /sem permiss[aã]o|n[aã]o encontrad|permission denied|row-level security|violates|invalid input|inv[aá]lid|informe|descreva|n[aã]o [eé] poss[ií]vel|bloquead|impersonation/i;

export const mensagemDe = (falha) => {
  if (!falha) return '';
  if (typeof falha === 'string') return falha;
  return [falha.message, falha.details, falha.hint].filter(Boolean).join(' ');
};

export const ehErroDeRede = (falha) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return REDE.test(mensagemDe(falha));
};

export const classificarErro = (falha) => {
  if (falha?.blocked || falha?.code === 'IMPERSONATION_BLOCKED') return TIPO_ERRO.PERMANENTE;
  const texto = mensagemDe(falha);
  if (SESSAO.test(texto)) return TIPO_ERRO.SESSAO;
  if (PERMANENTE.test(texto)) return TIPO_ERRO.PERMANENTE;
  if (ehErroDeRede(falha)) return TIPO_ERRO.REDE;
  return TIPO_ERRO.DESCONHECIDO;
};
