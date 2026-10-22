// Parâmetros padrão da premiação do time e da comissão PJ.
// Valores salvos pelo admin ficam em configuracoes_sistema (chave CHAVE_CONFIG_PREMIACAO).

export const CHAVE_CONFIG_PREMIACAO = 'premiacao_config';

export const TIPOS_META_PREMIACAO = {
  base: 'premiacao_meta_base',
  ideal: 'premiacao_meta_ideal',
  plus: 'premiacao_meta_ideal_plus',
};

export const CLASSIFICACOES = {
  EFETIVO: 'EFETIVO',
  PJ: 'PJ',
  LIDER: 'LIDER',
  DESLIGADO: 'DESLIGADO',
  NAO_CLASSIFICADO: 'NAO_CLASSIFICADO',
};

export const ROTULOS_CLASSIFICACAO = {
  EFETIVO: 'Efetivo',
  PJ: 'PJ',
  LIDER: 'Líder',
  DESLIGADO: 'Desligado',
  NAO_CLASSIFICADO: 'Não classificado',
};

export const MODOS_COMISSAO_PJ = {
  FAIXA_ATINGIDA: 'faixa_atingida',
  PROGRESSIVA: 'progressiva',
};

export const PREMIACAO_DEFAULTS = {
  habilitado: false,
  visibilidade: 'admin',
  gatilhoBasePct: 1,
  premios: { base: 1500, ideal: 3000, ideal_plus: 4500 },
  distribuicao: { coletivo: 0.3, performance: 0.7 },
  vendedores: {
    EDGAR: CLASSIFICACOES.EFETIVO,
    EDUARDA: CLASSIFICACOES.EFETIVO,
    CAMILA: CLASSIFICACOES.EFETIVO,
    'FÁBIO': CLASSIFICACOES.LIDER,
    PAMELLI: CLASSIFICACOES.DESLIGADO,
    VITOR: CLASSIFICACOES.PJ,
  },
  comissaoPJ: {
    base: 'valor_total_servico',
    modo: MODOS_COMISSAO_PJ.FAIXA_ATINGIDA,
    faixas: [
      { ate: 15000, pct: 1.0 },
      { ate: 60000, pct: 1.5 },
      { ate: 100000, pct: 2.0 },
      { ate: null, pct: 2.5 },
    ],
  },
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Mescla a config salva (string JSON ou objeto) sobre os defaults. JSON inválido → defaults. */
export function mesclarConfigPremiacao(salva) {
  let obj = salva;
  if (typeof salva === 'string') {
    try {
      obj = JSON.parse(salva);
    } catch {
      console.warn('[premiacao] JSON de configuração inválido — usando padrões.');
      obj = null;
    }
  }
  if (!isObj(obj)) return structuredClone(PREMIACAO_DEFAULTS);

  const d = PREMIACAO_DEFAULTS;
  return {
    ...structuredClone(d),
    ...obj,
    premios: { ...d.premios, ...(isObj(obj.premios) ? obj.premios : {}) },
    distribuicao: { ...d.distribuicao, ...(isObj(obj.distribuicao) ? obj.distribuicao : {}) },
    vendedores: isObj(obj.vendedores) ? { ...obj.vendedores } : { ...d.vendedores },
    comissaoPJ: {
      ...structuredClone(d.comissaoPJ),
      ...(isObj(obj.comissaoPJ) ? obj.comissaoPJ : {}),
      faixas: Array.isArray(obj.comissaoPJ?.faixas) && obj.comissaoPJ.faixas.length > 0
        ? obj.comissaoPJ.faixas
        : structuredClone(d.comissaoPJ.faixas),
    },
  };
}
