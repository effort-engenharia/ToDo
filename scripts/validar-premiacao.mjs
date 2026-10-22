// Validação do motor de premiação. Uso: node scripts/validar-premiacao.mjs
import assert from 'node:assert/strict';
import { PREMIACAO_DEFAULTS, mesclarConfigPremiacao, MODOS_COMISSAO_PJ } from '../src/config/premiacao.js';
import {
  calcularPremiacao,
  calcularNivelColetivo,
  calcularComissaoPJ,
  distribuirPremio,
  classificar,
} from '../src/utils/premiacao.js';

const cfg = (extra = {}) => ({ ...mesclarConfigPremiacao(null), ...extra });
const metas = { base: 100000, ideal: 150000, plus: 200000 };
const venda = (vendedor, entrada, bruto, extra = {}) => ({
  fase: 'CONTRATO/VENDA',
  proprietario_relacionamento: vendedor,
  valor_entrada_servico: entrada,
  valor_total_servico: bruto,
  ...extra,
});

let ok = 0;
const caso = (nome, fn) => {
  fn();
  ok += 1;
  console.log(`✔ ${nome}`);
};

const premios = PREMIACAO_DEFAULTS.premios;

caso('T1 abaixo do gatilho base', () => {
  const n = calcularNivelColetivo(100999.99, metas, 1, premios);
  assert.equal(n.id, 'nenhum');
  assert.equal(n.premio, 0);
});

caso('T2 Meta Base exata: gatilho 1% → nenhum; gatilho 0% → 1.500', () => {
  assert.equal(calcularNivelColetivo(100000, metas, 1, premios).premio, 0);
  assert.equal(calcularNivelColetivo(101000, metas, 1, premios).premio, 1500);
  assert.equal(calcularNivelColetivo(100000, metas, 0, premios).premio, 1500);
});

caso('T3/T4/T5 limites de nível', () => {
  assert.equal(calcularNivelColetivo(149999.99, metas, 1, premios).premio, 1500);
  assert.equal(calcularNivelColetivo(150000, metas, 1, premios).premio, 3000);
  assert.equal(calcularNivelColetivo(199999.99, metas, 1, premios).premio, 3000);
  assert.equal(calcularNivelColetivo(200000, metas, 1, premios).premio, 4500);
  assert.equal(calcularNivelColetivo(999999, metas, 1, premios).proximo, null);
});

caso('T6/T7 elegibilidade exata na meta individual', () => {
  const r = calcularPremiacao({
    data: [venda('EDGAR', 50000, 60000), venda('EDUARDA', 49999.99, 900000)],
    metas,
    config: cfg(),
  });
  const edgar = r.linhas.find((l) => l.nome === 'EDGAR');
  const eduarda = r.linhas.find((l) => l.nome === 'EDUARDA');
  assert.equal(r.metaIndividual, 50000);
  assert.equal(edgar.elegivel, true);
  assert.equal(eduarda.elegivel, false);
  assert.equal(eduarda.premioFinal, 0);
});

caso('T8 nenhum elegível', () => {
  const r = calcularPremiacao({ data: [venda('EDGAR', 10, 10)], metas, config: cfg() });
  assert.equal(r.qtdElegiveis, 0);
  assert.equal(r.linhas.reduce((s, l) => s + l.premioFinal, 0), 0);
});

caso('T9 elegíveis com bruto total 0 → 70% igual', () => {
  const { resultado } = distribuirPremio(300000, [
    { nome: 'A', brutoCents: 0 },
    { nome: 'B', brutoCents: 0 },
  ]);
  assert.equal(resultado.A.totalCents, 150000);
  assert.equal(resultado.B.totalCents, 150000);
});

caso('T10 exemplo do plano (5.2)', () => {
  const { resultado } = distribuirPremio(300000, [
    { nome: 'EDGAR', brutoCents: 8395000 },
    { nome: 'EDUARDA', brutoCents: 20308200 },
  ]);
  assert.equal(resultado.EDGAR.coletivaCents, 45000);
  assert.equal(resultado.EDGAR.performanceCents, 61420);
  assert.equal(resultado.EDGAR.totalCents, 106420);
  assert.equal(resultado.EDUARDA.totalCents, 193580);
});

caso('T11 soma exata com dízima (3 elegíveis)', () => {
  const { resultado } = distribuirPremio(100000, [
    { nome: 'A', brutoCents: 1 },
    { nome: 'B', brutoCents: 1 },
    { nome: 'C', brutoCents: 1 },
  ]);
  const soma = Object.values(resultado).reduce((s, x) => s + x.totalCents, 0);
  assert.equal(soma, 100000);
});

caso('T12 PJ e líder fora do divisor e do coletivo; T12c efetiva sem vendas conta no divisor', () => {
  const r = calcularPremiacao({
    data: [
      venda('EDGAR', 60000, 100000),
      venda('EDUARDA', 60000, 300000),
      venda('VITOR', 90000, 144350),
      venda('FÁBIO', 90000, 90000),
    ],
    metas,
    config: cfg(),
  });
  assert.equal(r.qtdEfetivos, 3);
  assert.equal(r.metaIndividual, 50000);
  assert.equal(r.resultadoColetivo, 120000);
  assert.equal(r.nivel.id, 'base');
  assert.equal(r.premioLiberado, 1500);
  assert.deepEqual(r.linhas.map((l) => l.nome).sort(), ['CAMILA', 'EDGAR', 'EDUARDA']);
  const camila = r.linhas.find((l) => l.nome === 'CAMILA');
  assert.equal(camila.elegivel, false);
  assert.equal(camila.premioFinal, 0);
  const soma = r.linhas.reduce((s, l) => s + l.premioFinal, 0);
  assert.equal(Math.round(soma * 100), 150000);
});

caso('T12d prêmios editados', () => {
  const r = calcularPremiacao({
    data: [venda('EDGAR', 80000, 1), venda('EDUARDA', 80000, 1)],
    metas,
    config: cfg({ premios: { base: 2000, ideal: 4000, ideal_plus: 6000 } }),
  });
  assert.equal(r.nivel.id, 'ideal');
  assert.equal(r.premioLiberado, 4000);
});

caso('T13 comissão PJ por faixa atingida', () => {
  const faixas = PREMIACAO_DEFAULTS.comissaoPJ.faixas;
  const c = (v) => calcularComissaoPJ(v, { faixas, modo: MODOS_COMISSAO_PJ.FAIXA_ATINGIDA });
  assert.equal(c(0).comissao, 0);
  assert.equal(c(15000).pct, 1);
  assert.equal(c(15000.01).pct, 1.5);
  assert.equal(c(60000).pct, 1.5);
  assert.equal(c(100000).pct, 2);
  assert.equal(c(100000.01).pct, 2.5);
  assert.equal(c(144350).comissao, 3608.75);
  assert.equal(c(15000).proxima.falta, 0.01);
  assert.equal(c(144350).proxima, null);
});

caso('T13b comissão PJ progressiva', () => {
  const faixas = PREMIACAO_DEFAULTS.comissaoPJ.faixas;
  assert.equal(calcularComissaoPJ(144350, { faixas, modo: MODOS_COMISSAO_PJ.PROGRESSIVA }).comissao, 2733.75);
});

caso('T14 ignora ativo=false e fases diferentes', () => {
  const r = calcularPremiacao({
    data: [
      venda('EDGAR', 99999, 1, { ativo: false }),
      { ...venda('EDGAR', 99999, 1), fase: 'NEGOCIAÇÃO' },
    ],
    metas,
    config: cfg(),
  });
  assert.equal(r.linhas.find((l) => l.nome === 'EDGAR').entrada, 0);
});

caso('T15 normalização de nome', () => {
  assert.equal(classificar(' vitor', cfg()), 'PJ');
  assert.equal(classificar('Fábio', cfg()), 'LIDER');
  assert.equal(classificar('NOVO', cfg()), 'NAO_CLASSIFICADO');
});

caso('T16 config ausente/JSON inválido', () => {
  assert.equal(mesclarConfigPremiacao('{invalido').habilitado, false);
  assert.equal(mesclarConfigPremiacao(null).premios.ideal, 3000);
  assert.equal(mesclarConfigPremiacao('{"premios":{"base":10}}').premios.ideal, 3000);
});

caso('Metas inválidas → não configurado', () => {
  const r = calcularPremiacao({ data: [], metas: { base: 200, ideal: 100, plus: 300 }, config: cfg() });
  assert.equal(r.configurado, false);
  assert.equal(r.premioLiberado, 0);
});

console.log(`\n${ok} casos OK`);
