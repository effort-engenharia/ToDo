// Testes unitários dos helpers puros do front (sem banco, sem navegador, sem dependência nova).
// Uso: node scripts/testes-unitarios.mjs
//
// O repositório não tem runner (Vitest/Jest). Este script usa só `node:test` (embutido no Node ≥ 18) e o `esbuild`
// que já vem junto do Vite (dependência transitiva; NÃO está no package.json) para empacotar os módulos do `src/`,
// que usam imports sem extensão e JSX. Os bundles temporários ficam em node_modules/.cache/qa-testes (ignorado pelo git).
//
// Cobre: pedido-material/utils (diffItens, normalizarQuantidade, passoDaUnidade...), pedido-material/periodo,
// ui/TextoFormatado, planejamento/estadoEtapa (passosPendentesDaEtapa), utils/conclusao, compras/statusCompra.
// Se a suíte for adotada de vez (Vitest + Testing Library), estes casos migram quase 1:1.

process.env.TZ = 'America/Sao_Paulo'; // as datas civis do app são do fuso local; fixa para o teste ser determinístico

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(RAIZ, 'node_modules', '.cache', 'qa-testes');
mkdirSync(SAIDA, { recursive: true });

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  console.error('esbuild não encontrado (vem com o Vite). Rode `npm install` e tente de novo.');
  process.exit(1);
}

// Empacota um módulo do src/ e o importa. react/react-dom ficam externos (resolvidos pelo node_modules do projeto).
const carregar = async (relativo) => {
  const nome = relativo.replace(/[\\/]/g, '_').replace(/\.[jt]sx?$/, '') + '.mjs';
  const outfile = path.join(SAIDA, nome);
  await esbuild.build({
    entryPoints: [path.join(RAIZ, relativo)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    logLevel: 'silent'
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
};

const PM = 'src/features/execucao/components/pedido-material';
const utils = await carregar(`${PM}/utils.js`);
const periodo = await carregar(`${PM}/periodo.js`);
const estado = await carregar('src/features/execucao/components/planejamento/estadoEtapa.js');
const conclusao = await carregar('src/features/execucao/utils/conclusao.js');
const compras = await carregar('src/features/compras/utils/statusCompra.js');
const cmp = await carregar('src/features/compras/utils/cotacao/comparacao.js');
const moeda = await carregar('src/features/compras/utils/cotacao/moeda.js');
const norm = await carregar('src/features/compras/utils/cotacao/normalizacao.js');
const msgWa = await carregar('src/features/compras/utils/cotacao/mensagemWhatsapp.js');
const valResp = await carregar('src/features/compras/utils/cotacao/validacaoResposta.js');
const adapt = await carregar('src/features/compras/utils/cotacao/adaptadores.js');
const altLista = await carregar('src/features/compras/utils/alteracoesLista.js');
const comparativo = await carregar('src/features/compras/utils/cotacao/comparativo.js');
const histPrecos = await carregar('src/features/compras/utils/cotacao/historicoPrecos.js');
const montagem = await carregar('src/features/compras/utils/cotacao/montagem.js');
const texto = await carregar('src/components/ui/TextoFormatado.jsx');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

// ---------------------------------------------------------------------------
describe('pedido-material/utils · passoDaUnidade e normalizarQuantidade (R3, R4)', () => {
  const { passoDaUnidade, normalizarQuantidade, quantidadeValida, unidadeInteira, formatarQuantidade } = utils;

  it('passo 1 para un/cx/pct e 0,1 para m, m², kg, l', () => {
    for (const u of ['un', 'cx', 'pct']) assert.equal(passoDaUnidade(u), 1, u);
    for (const u of ['m', 'm²', 'kg', 'l']) assert.equal(passoDaUnidade(u), 0.1, u);
    assert.equal(passoDaUnidade('xyz'), 0.1); // unidade desconhecida → decimal
    assert.equal(unidadeInteira('un'), true);
    assert.equal(unidadeInteira(undefined), false);
  });

  it('inteira arredonda para cima (2,5 → 3; 2,0 → 2; 2,0000000001 → 2)', () => {
    assert.equal(normalizarQuantidade(2.5, 'un'), 3);
    assert.equal(normalizarQuantidade('2,5', 'cx'), 3);
    assert.equal(normalizarQuantidade(2, 'un'), 2);
    assert.equal(normalizarQuantidade(0.2, 'pct'), 1);
    assert.equal(normalizarQuantidade('2.0000000001', 'un'), 2); // tolerância de ponto flutuante
  });

  it('decimal limita a 2 casas e aceita vírgula', () => {
    assert.equal(normalizarQuantidade('2,555', 'm'), 2.56);
    assert.equal(normalizarQuantidade('1,5', 'kg'), 1.5);
    assert.equal(normalizarQuantidade(3, 'm²'), 3);
  });

  it('vazio/inválido → null (campo pode ficar vazio na edição)', () => {
    for (const v of ['', null, undefined, 'abc', NaN, Infinity]) assert.equal(normalizarQuantidade(v, 'un'), null, String(v));
  });

  it('quantidadeValida: só número finito > 0', () => {
    assert.equal(quantidadeValida(1), true);
    assert.equal(quantidadeValida(0.1), true);
    for (const v of [0, -1, '', null, undefined, NaN, '3']) assert.equal(quantidadeValida(v), false, String(v));
  });

  it('formatarQuantidade usa vírgula', () => {
    assert.equal(formatarQuantidade(2.5), '2,5');
    assert.equal(formatarQuantidade(''), '');
    assert.equal(formatarQuantidade(null), '');
    assert.equal(formatarQuantidade(0), '0');
  });
});

describe('pedido-material/utils · atualizarCampoItem e marcarItensInvalidos', () => {
  const { atualizarCampoItem, marcarItensInvalidos } = utils;

  it('m → un com 2,5 vira 3 e deixa aviso', () => {
    const r = atualizarCampoItem({ nome: 'Cabo', quantidade: 2.5, unidade: 'm' }, 'unidade', 'un');
    assert.equal(r.quantidade, 3);
    assert.match(r._aviso, /2,5 para 3/);
  });

  it('m → un com valor já inteiro não avisa', () => {
    const r = atualizarCampoItem({ nome: 'Cabo', quantidade: 2, unidade: 'm' }, 'unidade', 'un');
    assert.equal(r.quantidade, 2);
    assert.equal(r._aviso, undefined);
  });

  it('un → m não altera a quantidade', () => {
    const r = atualizarCampoItem({ nome: 'x', quantidade: 3, unidade: 'un' }, 'unidade', 'm');
    assert.equal(r.quantidade, 3);
  });

  it('quantidade vazia durante a edição é preservada como string vazia; limpa aviso/erro', () => {
    const r = atualizarCampoItem({ nome: 'x', quantidade: 3, unidade: 'un', _erro: 'e', _aviso: 'a' }, 'quantidade', '');
    assert.equal(r.quantidade, '');
    assert.equal(r._erro, undefined);
    assert.equal(r._aviso, undefined);
  });

  it('unidade inteira + quantidade vazia: não explode e mantém vazio', () => {
    const r = atualizarCampoItem({ nome: 'x', quantidade: '', unidade: 'm' }, 'unidade', 'un');
    assert.equal(r.quantidade, '');
  });

  it('marcarItensInvalidos: só itens preenchidos; devolve a key do primeiro', () => {
    const itens = [
      { _key: 'a', nome: '', quantidade: '' }, // linha em branco: ignora
      { _key: 'b', nome: 'Disjuntor', quantidade: '' },
      { _key: 'c', nome: 'Cabo', quantidade: 0 },
      { _key: 'd', nome: 'Fita', quantidade: 2, _erro: 'velho' }
    ];
    const { itens: m, primeiraKey } = marcarItensInvalidos(itens);
    assert.equal(primeiraKey, 'b');
    assert.equal(m[0]._erro, undefined);
    assert.ok(m[1]._erro && m[2]._erro);
    assert.equal(m[3]._erro, undefined); // erro antigo limpo
  });

  it('itensSemKey remove _key/_aviso/_erro', () => {
    const [i] = utils.itensSemKey([{ _key: 'k', _aviso: 'a', _erro: 'e', nome: 'x', quantidade: 1, unidade: 'un' }]);
    assert.deepEqual(i, { nome: 'x', quantidade: 1, unidade: 'un' });
  });
});

describe('pedido-material/utils · diffItens (R5)', () => {
  const { diffItens } = utils;

  it('adicionado, removido e alterado por id (inclui renomear)', () => {
    const antes = [
      { id: '1', nome: 'Disjuntor 63A', quantidade: 2, unidade: 'un' },
      { id: '2', nome: 'Cabo 2,5mm', quantidade: 10, unidade: 'm' },
      { id: '3', nome: 'Fita', quantidade: 1, unidade: 'un' }
    ];
    const depois = [
      { id: '1', nome: 'Disjuntor 63A', quantidade: 3, unidade: 'un' },
      { id: '2', nome: 'Cabo 4mm', quantidade: 10, unidade: 'm' },
      { id: '4', nome: 'Parafuso', quantidade: 50, unidade: 'un' }
    ];
    const d = diffItens(antes, depois);
    assert.deepEqual(d.adicionados.map((i) => i.nome), ['Parafuso']);
    assert.deepEqual(d.removidos.map((i) => i.nome), ['Fita']);
    assert.equal(d.alterados.length, 2);
    assert.deepEqual(d.alterados[0].mudancas, [{ campo: 'quantidade', de: 2, para: 3 }]);
    assert.deepEqual(d.alterados[1].mudancas, [{ campo: 'nome', de: 'Cabo 2,5mm', para: 'Cabo 4mm' }]);
  });

  it('registros antigos (sem id): casa por nome sem acento/caixa + unidade; espaços nas pontas não contam como mudança', () => {
    const antes = [{ nome: 'Disjuntor 63A', quantidade: 2, unidade: 'un' }, { nome: 'Fita isolante', quantidade: 1, unidade: 'un' }];
    const depois = [{ nome: '  Disjuntor 63A ', quantidade: 3, unidade: 'un' }, { nome: 'Fita isolante', quantidade: 1, unidade: 'un' }];
    const d = diffItens(antes, depois);
    assert.equal(d.adicionados.length, 0);
    assert.equal(d.removidos.length, 0);
    assert.equal(d.alterados.length, 1); // só a quantidade do disjuntor
    assert.equal(d.alterados[0].mudancas.length, 1);
    assert.equal(d.alterados[0].mudancas[0].campo, 'quantidade');
  });

  it('só a caixa/acento mudou: casa o item (não é add+remove) e mostra como renomeação', () => {
    const d = diffItens([{ nome: 'Fita isolante', quantidade: 1, unidade: 'un' }], [{ nome: 'FITA ISOLANTE', quantidade: 1, unidade: 'un' }]);
    assert.equal(d.adicionados.length + d.removidos.length, 0);
    assert.deepEqual(d.alterados[0].mudancas.map((m) => m.campo), ['nome']);
  });

  it('sem id, mesma peça com unidade trocada é "alterado" (unidade), não add+remove', () => {
    const d = diffItens([{ nome: 'Cabo', quantidade: 5, unidade: 'm' }], [{ nome: 'Cabo', quantidade: 5, unidade: 'cx' }]);
    assert.equal(d.adicionados.length + d.removidos.length, 0);
    assert.deepEqual(d.alterados[0].mudancas, [{ campo: 'unidade', de: 'm', para: 'cx' }]);
  });

  it('ids diferentes com o mesmo nome são itens distintos (um removido, um adicionado)', () => {
    const d = diffItens([{ id: 'a', nome: 'Cabo', quantidade: 1, unidade: 'm' }], [{ id: 'b', nome: 'Cabo', quantidade: 1, unidade: 'm' }]);
    assert.equal(d.removidos.length, 1);
    assert.equal(d.adicionados.length, 1);
  });

  it('antes com id (pós-migration 23) e depois sem id casam por nome', () => {
    const d = diffItens([{ id: 'a', nome: 'Cabo', quantidade: 1, unidade: 'm' }], [{ nome: 'Cabo', quantidade: 2, unidade: 'm' }]);
    assert.equal(d.alterados.length, 1);
  });

  it('nulos, strings JSON e linhas em branco são tolerados', () => {
    assert.deepEqual(diffItens(null, undefined), { adicionados: [], removidos: [], alterados: [] });
    const d = diffItens('[{"nome":"A","quantidade":1,"unidade":"un"}]', [{ nome: '', quantidade: 1 }, { nome: 'A', quantidade: 1, unidade: 'un' }]);
    assert.equal(d.adicionados.length + d.removidos.length + d.alterados.length, 0);
    assert.deepEqual(diffItens('lixo{', 'lixo{'), { adicionados: [], removidos: [], alterados: [] });
  });

  it('criação (antes vazio) lista tudo como adicionado', () => {
    const d = diffItens([], [{ nome: 'A', quantidade: 1, unidade: 'un' }, { nome: 'B', quantidade: 2, unidade: 'm' }]);
    assert.equal(d.adicionados.length, 2);
  });

  it('itens idênticos sem quantidade não geram "alteração" falsa (NaN !== NaN)', () => {
    const d = diffItens([{ nome: 'A', unidade: 'un' }], [{ nome: 'A', unidade: 'un' }]);
    assert.equal(d.alterados.length, 0);
  });

  it('quantidade 2 (número) vs "2" (string) não conta como mudança', () => {
    const d = diffItens([{ nome: 'A', quantidade: 2, unidade: 'un' }], [{ nome: 'A', quantidade: '2', unidade: 'un' }]);
    assert.equal(d.alterados.length, 0);
  });
});

describe('pedido-material/periodo · filtro por created_at (R6, fuso America/Sao_Paulo)', () => {
  const { intervaloDoPeriodo, filtrosServidorDoPeriodo, periodoAtivo, PERIODO_INICIAL } = periodo;
  const ref = new Date(2026, 10, 1, 15, 30); // 01/11/2026 15:30 local

  it('atalhos', () => {
    assert.deepEqual(intervaloDoPeriodo({ atalho: 'hoje' }, ref), { de: '2026-11-01', ate: '2026-11-01' });
    assert.deepEqual(intervaloDoPeriodo({ atalho: '7dias' }, ref), { de: '2026-10-26', ate: '2026-11-01' });
    assert.deepEqual(intervaloDoPeriodo({ atalho: '30dias' }, ref), { de: '2026-10-03', ate: '2026-11-01' });
    assert.deepEqual(intervaloDoPeriodo({ atalho: 'mes' }, ref), { de: '2026-11-01', ate: '2026-11-01' });
    assert.deepEqual(intervaloDoPeriodo({ atalho: 'todos' }, ref), { de: '', ate: '' });
    assert.deepEqual(intervaloDoPeriodo({ atalho: 'personalizado', de: '2026-01-10', ate: '2026-01-20' }, ref), { de: '2026-01-10', ate: '2026-01-20' });
    assert.deepEqual(intervaloDoPeriodo(undefined, ref), { de: '', ate: '' });
  });

  it('"hoje": início = 00:00 SP (03:00Z); fim exclusivo = 00:00 SP do dia seguinte', () => {
    const f = filtrosServidorDoPeriodo({ atalho: 'hoje' }, ref);
    assert.equal(f.criadoDe, '2026-11-01T03:00:00.000Z');
    assert.equal(f.criadoAte, '2026-11-02T03:00:00.000Z');
  });

  it('borda: pedido de 23:30 SP do último dia entra; 00:00 do dia seguinte não', () => {
    const f = filtrosServidorDoPeriodo({ atalho: 'personalizado', de: '2026-10-31', ate: '2026-10-31' }, ref);
    const dentro = new Date('2026-11-01T02:30:00Z'); // 23:30 SP de 31/10
    const fora = new Date('2026-11-01T03:00:00Z'); // 00:00 SP de 01/11
    assert.ok(dentro >= new Date(f.criadoDe) && dentro < new Date(f.criadoAte));
    assert.ok(!(fora < new Date(f.criadoAte)));
  });

  it('fim de mês/ano rola o dia seguinte corretamente', () => {
    assert.equal(filtrosServidorDoPeriodo({ atalho: 'personalizado', de: '2026-12-31', ate: '2026-12-31' }, ref).criadoAte, '2027-01-01T03:00:00.000Z');
    assert.equal(filtrosServidorDoPeriodo({ atalho: 'personalizado', de: '2028-02-28', ate: '2028-02-28' }, ref).criadoAte, '2028-02-29T03:00:00.000Z');
  });

  it('personalizado com só um lado; "todos" sem limites', () => {
    const so = filtrosServidorDoPeriodo({ atalho: 'personalizado', de: '2026-10-01', ate: '' }, ref);
    assert.ok(so.criadoDe && so.criadoAte === undefined);
    assert.deepEqual(filtrosServidorDoPeriodo(PERIODO_INICIAL, ref), { criadoDe: undefined, criadoAte: undefined });
  });

  it('periodoAtivo', () => {
    assert.equal(periodoAtivo(PERIODO_INICIAL), false);
    assert.equal(periodoAtivo({ atalho: 'hoje' }), true);
    assert.equal(periodoAtivo(undefined), false);
  });
});

describe('ui/TextoFormatado · parágrafos, listas e segurança (R1)', () => {
  const render = (props) => renderToStaticMarkup(React.createElement(texto.default, props));

  it('parágrafos separados por linha em branco; quebra simples vira <br/>', () => {
    const html = render({ texto: 'Linha 1\nLinha 2\n\nOutro parágrafo' });
    assert.equal((html.match(/<p>/g) || []).length, 2);
    assert.match(html, /Linha 1<br\/>Linha 2/);
  });

  it('listas com -, •, * e numeradas 1. / 1)', () => {
    const html = render({ texto: '- a\n• b\n* c\n\n1. um\n2) dois' });
    assert.equal((html.match(/<ul/g) || []).length, 1);
    assert.equal((html.match(/<ol/g) || []).length, 1);
    assert.equal((html.match(/<li>/g) || []).length, 5);
  });

  it('lista misturada no mesmo bloco gera grupos consecutivos (ul depois ol)', () => {
    const html = render({ texto: 'Título\n- a\n- b\n1. x\n2. y' });
    assert.ok(html.indexOf('<ul') < html.indexOf('<ol'));
    assert.match(html, /<p>Título<\/p>/);
  });

  it('HTML do usuário é exibido literal (escapado), sem interpretar', () => {
    const html = render({ texto: '<b>x</b> <img src=x onerror=alert(1)>' });
    assert.ok(!html.includes('<b>'));
    assert.ok(!html.includes('<img'));
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  });

  it('CRLF e CR antigos funcionam como \\n', () => {
    const html = render({ texto: 'a\r\n\r\nb\rc' });
    assert.equal((html.match(/<p>/g) || []).length, 2);
  });

  it('vazio/nulo/só espaços → nada renderizado', () => {
    for (const t of ['', '   \n\n ', null, undefined]) assert.equal(render({ texto: t }), '', JSON.stringify(t));
    assert.equal(render({ texto: null, compacto: true }), '');
  });

  it('"-texto" sem espaço, "*negrito*" e URL não viram lista', () => {
    const html = render({ texto: '-sem espaço\n*negrito* aqui' });
    assert.ok(!html.includes('<ul'));
  });

  it('compacto: texto cru com whitespace-pre-line e line-clamp-3', () => {
    const html = render({ texto: 'a\nb', compacto: true });
    assert.match(html, /whitespace-pre-line/);
    assert.match(html, /line-clamp-3/);
    assert.ok(!html.includes('<ul'));
  });

  it('sem dangerouslySetInnerHTML no componente', async () => {
    const { readFileSync } = await import('node:fs');
    assert.ok(!readFileSync(path.join(RAIZ, 'src/components/ui/TextoFormatado.jsx'), 'utf8').includes('dangerouslySetInnerHTML'));
  });
});

describe('planejamento/estadoEtapa · estadoEtapa e passosPendentesDaEtapa (R14)', () => {
  const { estadoEtapa, passosPendentesDaEtapa } = estado;
  const hoje = new Date(2026, 10, 1); // 01/11/2026 00:00 local

  it('concluída por progresso ou status', () => {
    assert.equal(estadoEtapa({ progresso: 100 }, hoje).id, 'concluida');
    assert.equal(estadoEtapa({ progresso: 10, status: 'concluida' }, hoje).id, 'concluida');
  });

  it('atrasada com dias; fim ontem = 1 d', () => {
    assert.deepEqual(estadoEtapa({ progresso: 50, status: 'em_andamento', data_fim: '2026-10-30' }, hoje).rotulo, 'Atrasada · 2 d');
    assert.equal(estadoEtapa({ progresso: 0, data_fim: '2026-10-31' }, hoje).diasAtraso, 1);
  });

  it('fim hoje não é atrasada; status "atrasada" sem data_fim → "Atrasada" sem dias', () => {
    assert.equal(estadoEtapa({ progresso: 0, status: 'pendente', data_fim: '2026-11-01' }, hoje).id, 'planejada');
    const r = estadoEtapa({ progresso: 0, status: 'atrasada' }, hoje);
    assert.equal(r.id, 'atrasada');
    assert.equal(r.rotulo, 'Atrasada');
  });

  it('em andamento, pausada e planejada', () => {
    assert.equal(estadoEtapa({ status: 'em_andamento', data_fim: '2026-12-01' }, hoje).id, 'em_andamento');
    assert.equal(estadoEtapa({ status: 'pausada' }, hoje).id, 'pausada');
    assert.equal(estadoEtapa({}, hoje).id, 'planejada');
  });

  // passosPendentesDaEtapa lê o número que o servidor calcula (RPC execucao_passos_pendentes_por_etapa)
  const linha = (passos_pendentes) => ({ passos_pendentes });

  it('passos pendentes: devolve o contador do servidor da etapa pai', () => {
    assert.equal(passosPendentesDaEtapa({ e1: linha(3), e2: linha(0) }, 'e1'), 3);
    assert.equal(passosPendentesDaEtapa({ e1: linha('2') }, 'e1'), 2);
  });

  it('0 quando o servidor devolve 0 (atividade do pai ainda aberta, sem atividades, pai concluído)', () => {
    assert.equal(passosPendentesDaEtapa({ e1: linha(0) }, 'e1'), 0);
  });

  it('0 sem linha para a etapa, sem mapa (RPC indisponível), etapa sem id ou valor inválido', () => {
    assert.equal(passosPendentesDaEtapa({ e1: linha(2) }, 'e2'), 0);
    assert.equal(passosPendentesDaEtapa(undefined, 'e1'), 0);
    assert.equal(passosPendentesDaEtapa(null, 'e1'), 0);
    assert.equal(passosPendentesDaEtapa({}, undefined), 0);
    assert.equal(passosPendentesDaEtapa({ e1: linha(null) }, 'e1'), 0);
    assert.equal(passosPendentesDaEtapa({ e1: linha('x') }, 'e1'), 0);
  });
});

describe('utils/conclusao · origem das horas e link do mapa (R12)', () => {
  const { rotuloOrigemHoras, linkMapa } = conclusao;

  it('rótulo por origem; nulo cai em "(ajustadas)" só se horas_ajustadas; vazio caso contrário', () => {
    assert.match(rotuloOrigemHoras({ horas_origem: 'previstas' }), /previstas/);
    assert.match(rotuloOrigemHoras({ horas_origem: 'intervalos' }), /intervalos/);
    assert.match(rotuloOrigemHoras({ horas_origem: 'ajuste_admin' }), /gestão/);
    assert.match(rotuloOrigemHoras({ horas_origem: 'ajuste_tecnico' }), /técnico/);
    assert.equal(rotuloOrigemHoras({ horas_origem: null, horas_ajustadas: true }), ' (ajustadas)');
    assert.equal(rotuloOrigemHoras({ horas_origem: null, horas_ajustadas: false }), '');
    assert.equal(rotuloOrigemHoras(null), '');
    assert.equal(rotuloOrigemHoras({ horas_origem: 'desconhecida' }), '');
  });

  it('linkMapa', () => {
    assert.equal(linkMapa(-23.55, -46.63), 'https://maps.google.com/?q=-23.55,-46.63');
  });
});

describe('compras/statusCompra · vocabulário, transições e formatação pt-BR', () => {
  const c = compras;

  it('toda coluna/transição referencia status existentes', () => {
    const ids = Object.keys(c.STATUS_COMPRA);
    for (const col of c.COLUNAS_COMPRAS) for (const s of col.status) assert.ok(ids.includes(s), s);
    for (const [de, paras] of Object.entries(c.TRANSICOES_COMPRA)) {
      assert.ok(ids.includes(de), de);
      for (const p of paras) assert.ok(ids.includes(p), p);
    }
    for (const s of [...c.STATUS_ACEITA_QUESTIONAMENTO, ...c.STATUS_ITENS_TRAVADOS, ...c.STATUS_TERMINAIS]) assert.ok(ids.includes(s), s);
  });

  it('todo status (menos terminais) aparece em alguma coluna; cancelado não é coluna', () => {
    const naColuna = new Set(c.COLUNAS_COMPRAS.flatMap((x) => x.status));
    for (const s of Object.keys(c.STATUS_COMPRA)) if (s !== 'cancelado') assert.ok(naColuna.has(s), s);
    assert.ok(!naColuna.has('cancelado'));
  });

  it('transições batem com o Anexo F.4 (compras_alterar_status)', () => {
    assert.deepEqual(c.TRANSICOES_COMPRA.aguardando_compra, ['em_cotacao', 'cancelado']);
    assert.deepEqual(c.TRANSICOES_COMPRA.em_cotacao, ['aguardando_compra', 'comprado', 'cancelado']);
    assert.deepEqual(c.TRANSICOES_COMPRA.aguardando_solicitante, ['cancelado']);
    assert.deepEqual(c.TRANSICOES_COMPRA.comprado, ['entregue_parcial', 'entregue', 'cancelado']);
    assert.deepEqual(c.TRANSICOES_COMPRA.entregue_parcial, ['entregue', 'cancelado']);
    assert.equal(c.TRANSICOES_COMPRA.entregue, undefined);
    assert.equal(c.TRANSICOES_COMPRA.cancelado, undefined);
  });

  it('acaoRapidaDoPedido', () => {
    assert.equal(c.acaoRapidaDoPedido({ status_compra: 'aguardando_compra' }), 'assumir');
    assert.equal(c.acaoRapidaDoPedido({ status_compra: 'em_cotacao' }), 'comprado');
    assert.equal(c.acaoRapidaDoPedido({ status_compra: 'entregue_parcial' }), 'entrega');
    assert.equal(c.acaoRapidaDoPedido({ status_compra: 'cancelado' }), null);
  });

  it('rotulos', () => {
    assert.equal(c.rotuloStatusCompra('em_cotacao'), '🧾 Em cotação');
    assert.equal(c.rotuloStatusCompra(undefined), '—');
    assert.equal(c.rotuloStatusCompra('x'), 'x');
    assert.equal(c.rotuloUrgencia('urgente'), '🔴 Urgente');
    assert.equal(c.rotuloEstadoQuestionamento({ tipo: 'duvida', status: 'aprovado' }).rotulo, 'Respondido');
    assert.equal(c.rotuloEstadoQuestionamento({ tipo: 'substituicao', status: 'aprovado' }).rotulo, 'Aprovado');
    assert.equal(c.rotuloEstadoQuestionamento(null).rotulo, '—');
  });

  it('formatarDuracaoHoras (D.1): min / h / dias pt-BR', () => {
    assert.equal(c.formatarDuracaoHoras(0.5), '30 min');
    assert.equal(c.formatarDuracaoHoras(0), '0 min');
    assert.equal(c.formatarDuracaoHoras(1), '1 h');
    assert.equal(c.formatarDuracaoHoras(5.5), '5 h 30 min');
    assert.equal(c.formatarDuracaoHoras(48), '2 dias');
    assert.equal(c.formatarDuracaoHoras(60), '2,5 dias');
    assert.equal(c.formatarDuracaoHoras(null), '—');
    assert.equal(c.formatarDuracaoHoras(undefined), '—');
    assert.equal(c.formatarDuracaoDias(1.5), '36 h');
    assert.equal(c.formatarDuracaoDias(null), '—');
  });

  it('formatarDuracaoHoras: arredondamento nas bordas nunca gera "60 min"', () => {
    assert.ok(!/60 min/.test(c.formatarDuracaoHoras(1.9999)), c.formatarDuracaoHoras(1.9999));
    assert.ok(!/^60 min/.test(c.formatarDuracaoHoras(0.9999)), c.formatarDuracaoHoras(0.9999));
    assert.ok(!/60 min/.test(c.formatarDuracaoHoras(47.9999)), c.formatarDuracaoHoras(47.9999));
  });

  it('tempoRelativo', () => {
    const agora = Date.parse('2026-11-01T12:00:00Z');
    assert.equal(c.tempoRelativo('2026-11-01T12:00:00Z', agora), 'agora');
    assert.equal(c.tempoRelativo('2026-11-01T11:30:00Z', agora), 'há 30 min');
    assert.equal(c.tempoRelativo('2026-11-01T07:00:00Z', agora), 'há 5 h');
    assert.equal(c.tempoRelativo('2026-10-29T12:00:00Z', agora), 'há 3 d');
    assert.equal(c.tempoRelativo('2026-11-02T12:00:00Z', agora), 'agora'); // futuro não fica negativo
    assert.equal(c.tempoRelativo('lixo', agora), '');
  });

  it('diasDeAtraso usa data civil local (sem deslocamento de fuso)', () => {
    const hoje = new Date(2026, 10, 1, 23, 59);
    assert.equal(c.diasDeAtraso('2026-10-30', hoje), 2);
    assert.equal(c.diasDeAtraso('2026-11-01', hoje), 0);
    assert.equal(c.diasDeAtraso('2026-11-05', hoje), 0);
    assert.equal(c.diasDeAtraso(null, hoje), 0);
    assert.equal(c.diasDeAtraso('2026-10-30T00:00:00+00:00', hoje), 2);
  });

  it('itensPreenchidos, rotuloItem e montarPrevia', () => {
    assert.deepEqual(c.itensPreenchidos([{ nome: ' ' }, { nome: 'A' }, null]), [{ nome: 'A' }]);
    assert.deepEqual(c.itensPreenchidos(null), []);
    assert.equal(c.rotuloItem({ nome: 'Disjuntor', quantidade: 2.5, unidade: 'm' }), 'Disjuntor · 2,5 m');
    assert.equal(c.rotuloItem({ nome: 'X' }), 'X');
    assert.equal(c.rotuloItem(null), '—');
    const p = c.montarPrevia({ nome: 'Disjuntor 63A', quantidade: 2, unidade: 'un' }, { nome: 'Disjuntor 50A' });
    assert.equal(p.de, 'Disjuntor 63A · 2 un');
    assert.equal(p.para, 'Disjuntor 50A · 2 un');
    assert.equal(c.montarPrevia({ nome: 'x' }, null), null);
  });

  it('descricaoAcessivelDoPedido', () => {
    const hoje = new Date();
    const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    const iso = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`;
    const t = c.descricaoAcessivelDoPedido({
      cliente_nome: 'Fulano', urgencia: 'urgente', qtd_itens: 3, atrasado: true, data_material_disponivel: iso, qtd_questionamentos_abertos: 1
    });
    assert.match(t, /Fulano/);
    assert.match(t, /urgente/);
    assert.match(t, /3 itens/);
    assert.match(t, /1 dias atrasado/);
    assert.match(t, /1 questionamento/);
    assert.match(c.descricaoAcessivelDoPedido({ descricao: 'x', urgencia: 'normal', sem_itens: true }), /sem lista de itens/);
  });
});

// ---------------------------------------------------------------------------
// Cotação com fornecedores (PLANO_COTACAO_FORNECEDORES §8 e §15.1) · F-01
describe('compras/cotacao · valor presente (VP-01..04)', () => {
  const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
  it('VP-01 à vista 1.000 com 5% de desconto = 950,00', () => {
    const r = cmp.valorPresente({ base: 1000, condicao: { tipo: 'a_vista', desconto_tipo: 'percentual', desconto_valor: 5 }, taxa: 0.015 });
    perto(r.vp, 950); perto(r.total, 950);
  });
  it('à vista com desconto em valor nunca fica negativo', () => {
    perto(cmp.valorPresente({ base: 100, condicao: { tipo: 'a_vista', desconto_tipo: 'valor', desconto_valor: 150 }, taxa: 0.01 }).vp, 0);
  });
  it('VP-02 parcelado 3x 1.000, 1ª em 30 d, i=1,5% ≈ 970,73', () => {
    const r = cmp.valorPresente({ base: 1000, condicao: { tipo: 'parcelado', parcelas: 3, entrada_valor: 0, primeira_parcela_dias: 30 }, taxa: 0.015 });
    perto(r.vp, 970.73); perto(r.total, 1000);
  });
  it('VP-03 entrada 100, 2x, 1ª em 0 d: entrada + parcela em d0 + parcela em d30', () => {
    const r = cmp.valorPresente({ base: 1000, condicao: { tipo: 'parcelado', parcelas: 2, entrada_valor: 100, primeira_parcela_dias: 0 }, taxa: 0.015 });
    perto(r.vp, 100 + 450 + 450 / 1.015);
  });
  it('VP-04 taxa 0: VP = nominal; total_informado substitui a base', () => {
    const r = cmp.valorPresente({ base: 1000, condicao: { tipo: 'parcelado', parcelas: 4, total_informado: 1100, primeira_parcela_dias: 30 }, taxa: 0 });
    perto(r.vp, 1100); perto(r.total, 1100);
  });
});

// Fixtures: linhas e respostas simples (preço por linha)
const L = (...qtds) => qtds.map((q, i) => ({ id: `l${i + 1}`, quantidade: q }));
const R = (id, precos, extra = {}) => ({
  convite_id: id, fornecedor_id: id, empresa: id, versao_lista: 1, recusou: false,
  itens: precos.map((p, i) => ({ id: `l${i + 1}`, tem_item: p != null, preco_unitario: p ?? null, quantidade_disponivel: null })),
  condicoes: [{ tipo: 'a_vista', desconto_tipo: null }], prazo_entrega_dias: 5, frete_tipo: 'cif', frete_valor: 0,
  respondido_em: '2026-11-01T10:00:00Z', compras_anteriores: 0, ...extra
});
const OPC = { taxa_mensal: 0.015, empate_pct: 0.01 };
const rank = (resps, linhas) => cmp.rankingGlobal(cmp.montarCandidatos(resps, linhas, OPC), OPC);

describe('compras/cotacao · cobertura (CB-01..02)', () => {
  it('CB-01 quantidade disponível menor que a pedida = linha não atendida para completude', () => {
    const resp = R('A', [10]); resp.itens[0].quantidade_disponivel = 50;
    const c = cmp.coberturaResposta(L(100), resp);
    assert.equal(c.porLinha.l1, 'parcial'); assert.equal(c.completa, false);
    assert.equal(cmp.totaisCondicao(resp, resp.condicoes[0], L(100), 0).base, 500); // base usa a quantidade disponível
  });
  it('CB-02 resposta na lista v1 com linha alterada na v2: linha não cotada e resposta defasada', () => {
    const linhas = [{ id: 'l1', quantidade: 1, versao_alterada: 1 }, { id: 'l2', quantidade: 1, versao_alterada: 2 }];
    const c = cmp.coberturaResposta(linhas, R('A', [10, 10]));
    assert.equal(c.porLinha.l2, 'nao_cotada'); assert.equal(c.defasada, true); assert.equal(c.completa, false);
    assert.equal(c.versao_lista_respondida, 1);
  });
});

describe('compras/cotacao · ranking, empate e parciais (RK-01..04)', () => {
  it('RK-01 três completas 1000/1005/1100, empate 1%: 1º e 2º empatam; desempate pelo prazo', () => {
    const r = rank([R('A', [1000], { prazo_entrega_dias: 10 }), R('B', [1005], { prazo_entrega_dias: 3 }), R('C', [1100])], L(1));
    assert.equal(r.modo, 'completo'); assert.equal(r.empatados, true);
    assert.equal(r.criterioDesempate, 'prazo_entrega');
    assert.deepEqual(r.ordenados.map((c) => c.empresa), ['B', 'A', 'C']);
    assert.equal(r.melhor.empresa, 'B');
    assert.equal(Math.round(r.deltaMaisCara.valor), 95);
  });
  it('sem empate quando a diferença é ≥ 1%', () => {
    const r = rank([R('A', [1000]), R('B', [1010], { prazo_entrega_dias: 1 })], L(1));
    assert.equal(r.empatados, false); assert.equal(r.melhor.empresa, 'A');
    assert.ok(Math.abs(r.deltaSegundo.pct - 0.01) < 1e-9);
  });
  it('RK-02 completa 1200 vence parcial 900; parcial traz "cobre X de Y"', () => {
    const r = rank([R('A', [1200, 1200]), R('P', [900, null])], L(1, 1));
    assert.equal(r.melhor.empresa, 'A');
    const p = r.ordenados[1];
    assert.equal(p.empresa, 'P'); assert.equal(p.linhas_atendidas, 1); assert.equal(p.total_linhas, 2);
  });
  it('RK-03 só parciais: melhor parcial = maior cobertura', () => {
    const r = rank([R('A', [10, null, null]), R('B', [50, 50, null]), R('C', [1, null, null])], L(1, 1, 1));
    assert.equal(r.modo, 'parcial'); assert.equal(r.melhor.empresa, 'B');
  });
  it('RK-04 desempate em cascata: prazo → CIF → compras anteriores → respondido_em', () => {
    const base = { prazo_entrega_dias: 5, frete_tipo: 'cif', compras_anteriores: 0 };
    const ids = (resps) => rank(resps, L(1)).ordenados.map((c) => c.empresa);
    // prazo decide
    let r = rank([R('A', [100], { ...base, prazo_entrega_dias: 7 }), R('B', [100], { ...base, prazo_entrega_dias: 2 })], L(1));
    assert.equal(r.criterioDesempate, 'prazo_entrega'); assert.equal(r.melhor.empresa, 'B');
    // mesmo prazo → CIF
    r = rank([R('A', [100], { ...base, frete_tipo: 'valor', frete_valor: 0 }), R('B', [100], base)], L(1));
    assert.equal(r.criterioDesempate, 'frete_cif'); assert.equal(r.melhor.empresa, 'B');
    // → compras anteriores
    r = rank([R('A', [100], { ...base, compras_anteriores: 1 }), R('B', [100], { ...base, compras_anteriores: 4 })], L(1));
    assert.equal(r.criterioDesempate, 'compras_anteriores'); assert.equal(r.melhor.empresa, 'B');
    // → respondido_em
    r = rank([R('A', [100], { ...base, respondido_em: '2026-11-01T12:00:00Z' }), R('B', [100], { ...base, respondido_em: '2026-11-01T09:00:00Z' })], L(1));
    assert.equal(r.criterioDesempate, 'respondido_em'); assert.equal(r.melhor.empresa, 'B');
    assert.deepEqual(ids([R('A', [100], base)]), ['A']);
  });
  it('frete em valor entra no VP e recusas/sem itens ficam fora; melhor condição por fornecedor com alternativa', () => {
    const a = R('A', [100], { frete_tipo: 'valor', frete_valor: 20 });
    a.condicoes = [{ tipo: 'a_vista', desconto_tipo: null }, { tipo: 'parcelado', parcelas: 3, primeira_parcela_dias: 30 }];
    const r = rank([a, R('Z', [1], { recusou: true })], L(1));
    assert.equal(r.ordenados.length, 1);
    assert.equal(r.melhor.tipo, 'parcelado'); assert.ok(r.melhor.vp_total < 120 && r.melhor.vp_total > 110); // frete de 20 somado
    assert.equal(r.melhor.alternativas[0].vp_total, 120);
    assert.equal(r.melhor.alternativas.length, 1);
  });
});

describe('compras/cotacao · compra dividida (DV-01..04)', () => {
  const linhas = L(10, 10);
  it('DV-01 A barato no item 1, B barato no item 2, fretes 0: divide A+B com economia', () => {
    const d = cmp.combinacaoDividida([R('A', [10, 30]), R('B', [30, 10])], linhas, OPC);
    assert.equal(d.mostrar, true); assert.equal(d.fornecedores.length, 2);
    assert.equal(d.custo, 200); assert.equal(d.vp_unico, 400); assert.equal(d.economia, 200);
    assert.deepEqual(d.atribuicoes.map((a) => a.empresa), ['A', 'B']);
  });
  it('DV-02 frete de B maior que o ganho: divisão não mostrada', () => {
    const d = cmp.combinacaoDividida([R('A', [10, 12]), R('B', [30, 10], { frete_tipo: 'valor', frete_valor: 500 })], linhas, OPC);
    assert.equal(d.mostrar, false);
  });
  it('DV-03 nenhum único completo, A∪B cobre tudo: "única forma de cobrir tudo"', () => {
    const d = cmp.combinacaoDividida([R('A', [10, null]), R('B', [null, 10])], linhas, OPC);
    assert.equal(d.mostrar, true); assert.equal(d.unica_forma_de_cobrir, true); assert.equal(d.vp_unico, null);
  });
  it('DV-04 M=13 usa a heurística gulosa e termina rápido', () => {
    const resps = Array.from({ length: 13 }, (_, i) => R(`F${i}`, Array.from({ length: 200 }, (__, j) => 100 + ((i * 7 + j * 3) % 17))));
    const t0 = Date.now();
    const d = cmp.combinacaoDividida(resps, L(...Array(200).fill(1)), OPC);
    assert.equal(d.modo, 'guloso'); assert.ok(d.cobre_tudo);
    assert.ok(Date.now() - t0 < 1500, 'guloso demorou demais');
  });
  it('M=12 com 200 linhas fica abaixo do orçamento (sanidade) e é exaustivo', () => {
    const resps = Array.from({ length: 12 }, (_, i) => R(`F${i}`, Array.from({ length: 200 }, (__, j) => 100 + ((i * 7 + j * 3) % 17))));
    const t0 = Date.now();
    const d = cmp.combinacaoDividida(resps, L(...Array(200).fill(1)), OPC);
    assert.equal(d.modo, 'exaustivo');
    assert.ok(Date.now() - t0 < 5000, 'exaustivo demorou demais para o Node');
  });
  it('aviso N3 quando um fornecedor usado tem desconto em R$', () => {
    const a = R('A', [10, 30]); a.condicoes = [{ tipo: 'a_vista', desconto_tipo: 'valor', desconto_valor: 5 }];
    const d = cmp.combinacaoDividida([a, R('B', [30, 10])], linhas, OPC);
    assert.equal(d.aviso_desconto_valor, true);
  });
});

describe('compras/cotacao · variação vs. referência (VR-01..03)', () => {
  const ref = { media_janela: 10, n_janela: 4, n_total: 4, fora_janela: false, ultimo: { preco_vp: 9.5, quantidade: 20 }, menor: { preco_vp: 9 } };
  it('VR-01 ref 10,00 e preço 11,30: +1,30 / +13,0%, vermelho, alerta', () => {
    const v = cmp.variacaoReferencia({ precoVp: 11.3, referencia: ref });
    assert.equal(v.cor, 'vermelho'); assert.equal(v.alerta, true);
    assert.equal(v.texto, 'R$ 11,30 (+R$ 1,30 / +13,0% vs. média)');
    assert.equal(v.detalhe.quantidadeReferencia, 20);
  });
  it('VR-02 ref 10,00 e preço 10,15: cinza (dentro de ±2%), sem alerta', () => {
    const v = cmp.variacaoReferencia({ precoVp: 10.15, referencia: ref });
    assert.equal(v.cor, 'cinza'); assert.equal(v.alerta, false);
  });
  it('abaixo da média fica verde; referência fora da janela é marcada como antiga', () => {
    assert.equal(cmp.variacaoReferencia({ precoVp: 8, referencia: ref }).cor, 'verde');
    assert.equal(cmp.variacaoReferencia({ precoVp: 8, referencia: { ...ref, n_janela: 0, fora_janela: true } }).antiga, true);
  });
  it('VR-03 sem referência: "primeiro registro"; sem material: "confirme o material"', () => {
    assert.equal(cmp.variacaoReferencia({ precoVp: 5, referencia: null }).texto, 'primeiro registro');
    assert.match(cmp.variacaoReferencia({ precoVp: 5, referencia: ref, materialId: null }).texto, /confirme o material/);
  });
  it('variação por cotação: economia ou acima da referência', () => {
    assert.match(cmp.variacaoTotalCotacao([{ ref: 10, quantidade: 10, preco_vp: 9 }]).texto, /^economia de R\$ 10,00 \(−10,0%\)$/);
    assert.match(cmp.variacaoTotalCotacao([{ ref: 10, quantidade: 10, preco_vp: 11 }]).texto, /^acima da referência em R\$ 10,00 \(\+10,0%\)$/);
    assert.equal(cmp.variacaoTotalCotacao([{ ref: null, quantidade: 1, preco_vp: 1 }]), null);
  });
});

describe('compras/cotacao · moeda, normalização e mensagem (NM-01, MS-01)', () => {
  it('formatarBRL / parseBRL / arredondar half-up', () => {
    assert.equal(moeda.formatarBRL(1234.5), 'R$ 1.234,50');
    assert.equal(moeda.formatarBRL(12.3456, 4), 'R$ 12,3456');
    assert.equal(moeda.formatarBRL(null), '—');
    assert.equal(moeda.parseBRL('R$ 1.234,56'), 1234.56);
    assert.equal(moeda.parseBRL('12,5'), 12.5);
    assert.equal(moeda.parseBRL('12.5'), 12.5);
    assert.equal(moeda.parseBRL('1.234'), 1234);
    assert.equal(moeda.parseBRL('abc'), null);
    assert.equal(moeda.arredondar(1.005, 2), 1.01);
    assert.equal(moeda.arredondar(2.675, 2), 2.68);
  });
  it('NM-01 nomes equivalentes normalizam igual; unidades seguem a tabela fixa do SQL', () => {
    assert.equal(norm.normalizarNome('Cabo  Flexível 2,5mm'), norm.normalizarNome('cabo flexivel 2,5mm'));
    assert.equal(norm.normalizarNome('Tubo ½" (PVC)'), 'tubo pvc');
    const mapa = { UN: 'un', und: 'un', Unid: 'un', unidade: 'un', pc: 'un', 'peça': 'un', peca: 'un', MT: 'm', metros: 'm', Caixa: 'cx', pacote: 'pct',
      kg: 'kg', LT: 'l', litro: 'l', 'm²': 'm2', m2: 'm2', 'm³': 'm3', rolo: 'rolo', barra: 'barra', saco: 'saco', galao: 'galao', ' Par ': 'par' };
    Object.entries(mapa).forEach(([entrada, saida]) => assert.equal(norm.normalizarUnidade(entrada), saida, entrada));
    assert.equal(norm.chaveConsolidacao({ material_id: 'x', nome: 'a', unidade: 'm' }), 'mat:x');
    assert.equal(norm.chaveConsolidacao({ nome: 'Cabo Flexível', unidade: 'Metros' }), 'cabo flexivel|m');
  });
  it('MS-01 montarMensagem preenche todos os placeholders; urlWhatsapp codifica #, & e acentos', () => {
    const t = 'Olá {contato}, aqui é da {empresa_publica}. Cotação nº {numero} com {qtd_itens} itens: {link} . Prazo: {prazo}.';
    const m = msgWa.montarMensagem(t, { contato: 'João', empresa_publica: 'Effort', numero: 7, qtd_itens: 3, link: 'https://x.app/cotacao/#abc_-', prazo: 'qui 03/11 18:00' });
    assert.equal(m, 'Olá João, aqui é da Effort. Cotação nº 7 com 3 itens: https://x.app/cotacao/#abc_- . Prazo: qui 03/11 18:00.');
    const url = msgWa.urlWhatsapp('5541999998888', m);
    assert.ok(url.startsWith('https://wa.me/5541999998888?text='));
    const q = url.split('?text=')[1];
    assert.ok(!/[#&\s]/.test(q)); assert.equal(decodeURIComponent(q), m);
    assert.equal(msgWa.urlWhatsapp('123', 'x'), '');
    assert.equal(msgWa.montarMensagem('Oi {nada}!', {}), 'Oi !');
  });
});

describe('compras/cotacao · validarResposta (VL-01..10)', () => {
  const itens = [{ id: 'a', quantidade: 10 }, { id: 'b', quantidade: 5 }];
  const ok = () => ({
    recusou: false,
    itens: [{ id: 'a', tem_item: true, preco_unitario: 10 }, { id: 'b', tem_item: false }],
    condicoes: [{ tipo: 'a_vista', desconto_tipo: null }],
    prazo_entrega_dias: 5, frete: { tipo: 'cif' }, observacao: ''
  });
  const campos = (r) => valResp.validarResposta(itens, r).erros.map((e) => e.campo);
  it('resposta válida passa; recusa dispensa o resto', () => {
    assert.deepEqual(valResp.validarResposta(itens, ok()), { ok: true, erros: [] });
    assert.equal(valResp.validarResposta(itens, { recusou: true }).ok, true);
  });
  it('VL-01..02 preço 0 e negativo', () => {
    let r = ok(); r.itens[0].preco_unitario = 0; assert.deepEqual(campos(r), ['itens[0].preco_unitario']);
    r = ok(); r.itens[0].preco_unitario = -3; assert.deepEqual(campos(r), ['itens[0].preco_unitario']);
  });
  it('VL-03 mais de 4 casas decimais', () => {
    const r = ok(); r.itens[0].preco_unitario = 1.12345; assert.deepEqual(campos(r), ['itens[0].preco_unitario']);
    r.itens[0].preco_unitario = 1.1234; assert.deepEqual(campos(r), []);
  });
  it('VL-04 "tenho" sem preço', () => {
    const r = ok(); r.itens[0].preco_unitario = null; assert.deepEqual(campos(r), ['itens[0].preco_unitario']);
  });
  it('nenhuma linha com tem_item exige recusa', () => {
    const r = ok(); r.itens[0].tem_item = false; assert.ok(campos(r).includes('itens'));
  });
  it('VL-05..06 sem condição e duas do mesmo tipo', () => {
    let r = ok(); r.condicoes = []; assert.deepEqual(campos(r), ['condicoes']);
    r = ok(); r.condicoes = [{ tipo: 'a_vista' }, { tipo: 'a_vista' }]; assert.deepEqual(campos(r), ['condicoes']);
  });
  it('VL-07 parcelas 25', () => {
    const r = ok(); r.condicoes = [{ tipo: 'parcelado', parcelas: 25, entrada_valor: 0, primeira_parcela_dias: 30 }];
    assert.deepEqual(campos(r), ['condicoes[0].parcelas']);
  });
  it('VL-08..09 prazo e frete ausentes', () => {
    let r = ok(); delete r.prazo_entrega_dias; assert.deepEqual(campos(r), ['prazo_entrega_dias']);
    r = ok(); delete r.frete; assert.deepEqual(campos(r), ['frete.tipo']);
    r = ok(); r.frete = { tipo: 'valor' }; assert.deepEqual(campos(r), ['frete.valor']);
  });
  it('VL-10 observação com 1001 caracteres', () => {
    const r = ok(); r.observacao = 'x'.repeat(1001); assert.deepEqual(campos(r), ['observacao']);
    r.observacao = 'x'.repeat(1000); assert.deepEqual(campos(r), []);
  });
  it('limites: desconto % > 50, entrada > total, itens faltando', () => {
    let r = ok(); r.condicoes = [{ tipo: 'a_vista', desconto_tipo: 'percentual', desconto_valor: 51 }];
    assert.deepEqual(campos(r), ['condicoes[0].desconto_valor']);
    r = ok(); r.condicoes = [{ tipo: 'parcelado', parcelas: 2, entrada_valor: 500, primeira_parcela_dias: 30 }];
    assert.deepEqual(campos(r), ['condicoes[0].entrada_valor']);
    r = ok(); r.itens = r.itens.slice(0, 1); assert.ok(campos(r).includes('itens'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// adaptadores.js: contrato do banco (Anexo C) ⇄ modelo dos helpers
// ---------------------------------------------------------------------------------------------------------------------
describe('adaptadores (cotação)', () => {
  it('respostaParaPayloadPublico: total_informado vira total; desconto só quando há tipo; recusa não leva itens', () => {
    const p = adapt.respostaParaPayloadPublico({
      versao_lista: 2, prazo_entrega_dias: 5, frete: { tipo: 'valor', valor: 120 }, observacao: 'ok',
      itens: [
        { cotacao_item_id: 'a', tem_item: true, preco_unitario: 4.35, quantidade_disponivel: null },
        { id: 'b', tem_item: false }
      ],
      condicoes: [
        { tipo: 'a_vista', desconto_tipo: null, desconto_valor: 3 },
        { tipo: 'parcelado', parcelas: 3, entrada_valor: 0, primeira_parcela_dias: 30, total_informado: 900 }
      ]
    });
    assert.equal(p.versao_lista, 2);
    assert.deepEqual(p.frete, { tipo: 'valor', valor: 120 });
    assert.deepEqual(p.itens[0], { id: 'a', tem_item: true, preco_unitario: 4.35 });
    assert.deepEqual(p.itens[1], { id: 'b', tem_item: false });
    assert.deepEqual(p.condicoes[0], { tipo: 'a_vista' });
    assert.equal(p.condicoes[1].total, 900);
    assert.equal('total_informado' in p.condicoes[1], false);
    const rec = adapt.respostaParaPayloadPublico({ versao_lista: 1, recusou: true, observacao: 'sem estoque', itens: [{ id: 'x', tem_item: true }] });
    assert.deepEqual(rec, { versao_lista: 1, recusou: true, observacao: 'sem estoque' });
  });
  it('respostaParaPayloadPublico: frete sem tipo valor vira CIF', () => {
    const p = adapt.respostaParaPayloadPublico({ versao_lista: 1, prazo_entrega_dias: 1, frete: { tipo: 'cif', valor: 50 }, itens: [], condicoes: [] });
    assert.deepEqual(p.frete, { tipo: 'cif' });
  });
  it('respostaPublicaParaModelo: total → total_informado e frete derivado de frete_tipo/frete_valor', () => {
    assert.equal(adapt.respostaPublicaParaModelo(null), null);
    const m = adapt.respostaPublicaParaModelo({ frete_tipo: 'valor', frete_valor: 80, condicoes: [{ tipo: 'parcelado', parcelas: 2, total: 500 }, { tipo: 'a_vista' }] });
    assert.deepEqual(m.frete, { tipo: 'valor', valor: 80 });
    assert.equal(m.condicoes[0].total_informado, 500);
    assert.equal('total' in m.condicoes[0], false);
    assert.equal(m.condicoes[1].total_informado, null);
  });
  it('respostasDoDetalhe: junta fornecedor/empresa/compras_anteriores do convite; linhasAtivasDoDetalhe ignora inativas', () => {
    const detalhe = {
      convites: [{ id: 'c1', fornecedor_id: 'f1', compras_anteriores: 3, fornecedor: { empresa: 'Elétrica X', nome_contato: 'João' } }],
      respostas_atuais: [{ convite_id: 'c1', enviado_em: '2026-11-02T10:00:00Z', condicoes: [] }, { convite_id: 'zz', condicoes: [] }],
      itens: [{ id: 'l1', ativo: true }, { id: 'l2', ativo: false }, { id: 'l3' }]
    };
    const rs = adapt.respostasDoDetalhe(detalhe);
    assert.equal(rs[0].fornecedor_id, 'f1');
    assert.equal(rs[0].empresa, 'Elétrica X');
    assert.equal(rs[0].compras_anteriores, 3);
    assert.equal(rs[0].respondido_em, '2026-11-02T10:00:00Z');
    assert.equal(rs[1].compras_anteriores, 0);
    assert.deepEqual(adapt.linhasAtivasDoDetalhe(detalhe).map((l) => l.id), ['l1', 'l3']);
    assert.deepEqual(adapt.respostasDoDetalhe(null), []);
  });
  it('varsMensagem + montarMensagem aceitam {empresa_publica} e o legado {empresa}', () => {
    const v = adapt.varsMensagem({ contato: 'Ana', empresaPublica: 'Effort', numero: 7, qtdItens: 3, link: 'https://x/cotacao/#t', prazo: 'qui 03/11 18:00' });
    assert.equal(msgWa.montarMensagem('Olá {contato}, da {empresa_publica}/{empresa}. Cotação {numero}: {link}.', v), 'Olá Ana, da Effort/Effort. Cotação 7: https://x/cotacao/#t .');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// alteracoesLista.js: classificação ciência × aceite (AL-01), espelho de compras_alterar_itens
// ---------------------------------------------------------------------------------------------------------------------
describe('classificação de alterações (AL-01)', () => {
  const cabo = { id: 'i1', nome: 'Cabo flexível 2,5 mm', quantidade: 300, unidade: 'm' };
  const disj = { id: 'i2', nome: 'Disjuntor 63A', quantidade: 10, unidade: 'un' };
  const c = (item, alt) => altLista.classificarAlteracao(item, alt);

  it('AL-01a redução de quantidade = ciência; un/cx/pct arredondam para cima', () => {
    const r = c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: 250 });
    assert.equal(r.classe, 'ciencia');
    assert.match(r.resumo, /300 → 250 m/);
    const u = c(disj, { acao: 'quantidade', itemId: 'i2', quantidade: 7.2 });
    assert.equal(u.classe, 'ciencia');
    assert.match(u.resumo, /10 → 8 un/);
  });
  it('AL-01b aumento de quantidade = aceite (tipo quantidade); igual = inválida', () => {
    const r = c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: 400 });
    assert.equal(r.classe, 'aceite');
    assert.equal(r.tipo, 'quantidade');
    assert.equal(c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: 300 }).classe, 'invalida');
    assert.equal(c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: 0 }).classe, 'invalida');
    assert.equal(c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: '1.250,5' }).classe, 'aceite');
  });
  it('AL-01b2 aumento fracionário em un/cx/pct mostra o valor já arredondado (aprovação arredonda para cima)', () => {
    const r = c(disj, { acao: 'quantidade', itemId: 'i2', quantidade: 12.2 });
    assert.equal(r.classe, 'aceite');
    assert.equal(r.quantidadeFinal, 13);
    assert.match(r.resumo, /10 → 13 un/);
    const m = c(cabo, { acao: 'quantidade', itemId: 'i1', quantidade: 300.5 });
    assert.equal(m.quantidadeFinal, 300.5);
    assert.match(c(null, { acao: 'adicionar', nome: 'Fita', quantidade: 2.1, unidade: 'un' }).resumo, /3 un/);
  });
  it('AL-01c remover = ciência', () => {
    assert.equal(c(cabo, { acao: 'remover', itemId: 'i1' }).classe, 'ciencia');
  });
  it('AL-01d substituir e adicionar = aceite (substituicao/adicao)', () => {
    const s = c(cabo, { acao: 'substituir', itemId: 'i1', nome: 'Cabo rígido 2,5 mm' });
    assert.deepEqual([s.classe, s.tipo], ['aceite', 'substituicao']);
    assert.equal(c(cabo, { acao: 'substituir', itemId: 'i1', nome: '  ' }).classe, 'invalida');
    const a = c(null, { acao: 'adicionar', nome: 'Fita isolante', quantidade: 5, unidade: 'un' });
    assert.deepEqual([a.classe, a.tipo], ['aceite', 'adicao']);
    assert.equal(c(null, { acao: 'adicionar', nome: 'Fita', quantidade: 5 }).classe, 'invalida'); // sem unidade
    assert.equal(c(null, { acao: 'adicionar', nome: 'Fita', unidade: 'un' }).classe, 'invalida'); // sem quantidade
  });
  it('AL-01e corrigir: grafia (acento/caixa/trigrama ≥ 0,6) e unidade sinônima = ciência', () => {
    assert.equal(c(cabo, { acao: 'corrigir', itemId: 'i1', nome: 'CABO FLEXIVEL 2,5 MM' }).classe, 'ciencia');
    assert.equal(c(cabo, { acao: 'corrigir', itemId: 'i1', nome: 'Cabo flexivel 2,5 mmm' }).classe, 'ciencia');
    assert.equal(c(cabo, { acao: 'corrigir', itemId: 'i1', unidade: 'metro' }).classe, 'ciencia');
    assert.equal(c(disj, { acao: 'corrigir', itemId: 'i2', unidade: 'und' }).classe, 'ciencia');
  });
  it('AL-01f corrigir que muda o item (nome distinto ou unidade não sinônima) = inválida com sugestão de Substituir', () => {
    const n = c(cabo, { acao: 'corrigir', itemId: 'i1', nome: 'Eletroduto corrugado 25 mm' });
    assert.equal(n.classe, 'invalida');
    assert.equal(n.sugerirSubstituir, true);
    const u = c(cabo, { acao: 'corrigir', itemId: 'i1', unidade: 'kg' });
    assert.equal(u.classe, 'invalida');
    assert.equal(u.sugerirSubstituir, true);
    assert.equal(c(cabo, { acao: 'corrigir', itemId: 'i1' }).classe, 'invalida');
    assert.equal(c(cabo, { acao: 'corrigir', itemId: 'i1', nome: cabo.nome }).classe, 'invalida'); // não muda nada
  });
  it('ação inválida e item inexistente', () => {
    assert.equal(c(cabo, { acao: 'trocar' }).classe, 'invalida');
    assert.equal(c(null, { acao: 'remover', itemId: 'zz' }).classe, 'invalida');
  });
  it('similaridade (aprox. pg_trgm): idênticos 1, disjuntos 0, grafia próxima ≥ 0,6', () => {
    assert.equal(altLista.similaridade('abc', 'abc'), 1);
    assert.equal(altLista.similaridade('abc', 'xyz'), 0);
    assert.ok(altLista.similaridade('disjuntor 63a', 'disjuntor 63 a') >= altLista.LIMITE_SIMILARIDADE_CORRECAO);
    assert.ok(altLista.similaridade('cabo flexivel', 'tomada dupla') < altLista.LIMITE_SIMILARIDADE_CORRECAO);
  });
  it('classificarLote separa as duas listas, barra item repetido e detecta lista vazia', () => {
    const lote = altLista.classificarLote([cabo, disj], [
      { acao: 'quantidade', itemId: 'i1', quantidade: 250 },
      { acao: 'quantidade', itemId: 'i2', quantidade: 20 },
      { acao: 'adicionar', nome: 'Fita', quantidade: 5, unidade: 'un' },
      { acao: 'remover', itemId: 'i1' }
    ]);
    assert.equal(lote.ciencia.length, 1);
    assert.equal(lote.aceite.length, 2);
    assert.equal(lote.invalidas.length, 1); // i1 repetido
    assert.equal(lote.soAceites, false);
    const vazio = altLista.classificarLote([cabo, disj], [{ acao: 'remover', itemId: 'i1' }, { acao: 'remover', itemId: 'i2' }]);
    assert.equal(vazio.ficaVazia, true);
    const comAdicao = altLista.classificarLote([cabo], [{ acao: 'remover', itemId: 'i1' }, { acao: 'adicionar', nome: 'X', quantidade: 1, unidade: 'un' }]);
    assert.equal(comAdicao.ficaVazia, false);
    assert.equal(altLista.classificarLote([cabo], [{ acao: 'quantidade', itemId: 'i1', quantidade: 999 }]).soAceites, true);
  });
  it('resumoResultado e podeAlterarItens', () => {
    assert.equal(altLista.resumoResultado({ aplicadas: [1, 2, 3], pendentes_aceite: [1] }, 'Fulano'), '3 alterações aplicadas. 1 aguarda aceite de Fulano.');
    assert.equal(altLista.resumoResultado({ aplicadas: [1], pendentes_aceite: [] }), '1 alteração aplicada.');
    assert.equal(altLista.podeAlterarItens('em_cotacao'), true);
    assert.equal(altLista.podeAlterarItens('comprado'), false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// comparativo.js: derivações das telas (snapshot K7, fuga da recomendação, payload da decisão)
// ---------------------------------------------------------------------------------------------------------------------
describe('comparativo (decisão)', () => {
  const resp = (convite, preco, extra = {}) => ({
    convite_id: convite, versao_lista: 1, recusou: false, prazo_entrega_dias: 5, frete_tipo: 'cif', frete_valor: 0,
    enviado_em: '2026-11-02T10:00:00Z',
    itens: [{ cotacao_item_id: 'l1', tem_item: true, preco_unitario: preco }, { cotacao_item_id: 'l2', tem_item: true, preco_unitario: preco * 2 }],
    condicoes: [{ id: `${convite}-av`, tipo: 'a_vista' }], ...extra
  });
  const detalhe = {
    cotacao: { id: 'c1', numero: 9, versao_lista: 1, taxa_mensal: 0.015, empate_pct: 0.01 },
    itens: [{ id: 'l1', quantidade: 10, ativo: true, versao_alterada: 1 }, { id: 'l2', quantidade: 5, ativo: true, versao_alterada: 1 }],
    convites: [
      { id: 'cvA', fornecedor_id: 'fA', compras_anteriores: 0, fornecedor: { empresa: 'A' } },
      { id: 'cvB', fornecedor_id: 'fB', compras_anteriores: 0, fornecedor: { empresa: 'B' } }
    ],
    respostas_atuais: [resp('cvA', 10), resp('cvB', 12)]
  };
  const comp = comparativo.calcularComparativo(detalhe, {});

  it('ranking recomenda o mais barato e o snapshot leva vencedor_recomendado_fornecedor_id (K7)', () => {
    assert.equal(comp.ranking.melhor.empresa, 'A');
    const snap = comparativo.snapshotRecomendacao(comp);
    assert.equal(snap.vencedor_recomendado_fornecedor_id, 'fA');
    assert.equal(snap.vencedor_recomendado_convite_id, 'cvA');
  });
  it('montarDecisao: único recomendado segue a recomendação e grava o snapshot', () => {
    const d = comparativo.montarDecisao({ comparativo: comp, escolha: { modo: 'unico', conviteId: 'cvA' }, datas: { p1: '2026-11-10' }, justificativa: '' });
    assert.equal(d.modo, 'unico');
    assert.equal(d.segue_recomendacao, true);
    assert.equal(d.recomendacao_snapshot.vencedor_recomendado_fornecedor_id, 'fA');
    assert.deepEqual(d.itens.map((i) => [i.cotacao_item_id, i.convite_id, i.condicao_tipo]), [['l1', 'cvA', 'a_vista'], ['l2', 'cvA', 'a_vista']]);
    assert.equal('justificativa' in d, false);
  });
  it('escolher o mais caro foge da recomendação (diferença em R$ e %) e leva a justificativa', () => {
    const f = comparativo.fugaDaRecomendacao({ comparativo: comp, escolha: { modo: 'unico', conviteId: 'cvB' } });
    assert.equal(f.foge, true);
    assert.ok(f.diferenca.valor > 0 && f.diferenca.pct > 0.19 && f.diferenca.pct < 0.21);
    const d = comparativo.montarDecisao({ comparativo: comp, escolha: { modo: 'unico', conviteId: 'cvB' }, datas: {}, justificativa: ' prazo menor ' });
    assert.equal(d.segue_recomendacao, false);
    assert.equal(d.justificativa, 'prazo menor');
  });
  it('rotuloCondicao e células da matriz', () => {
    assert.equal(comparativo.rotuloCondicao({ tipo: 'a_vista' }), 'À vista');
    assert.equal(comparativo.rotuloCondicao({ tipo: 'a_vista', desconto_tipo: 'percentual', desconto_valor: 3 }), 'À vista (−3%)');
    const porConvite = comparativo.candidatosPorConvite(comp.ranking);
    const cel = comparativo.celulaDaMatriz(comp.linhas[0], comp.respostas[0], porConvite.get('cvA'));
    assert.equal(cel.estado, 'atendida');
    assert.equal(cel.precoVp, 10);
    assert.equal(comparativo.celulaDaMatriz(comp.linhas[0], null, null).estado, 'sem_resposta');
  });
});

describe('histórico de preços e montagem de linhas', () => {
  const h = [
    { id: 3, tipo: 'comprado', preco_unitario_vp: 5.6, registrado_em: '2026-09-03' },
    { id: 2, tipo: 'comprado', preco_unitario_vp: 4.1, registrado_em: '2026-05-12' },
    { id: 1, tipo: 'comprado', preco_unitario_vp: 4.8, registrado_em: '2026-03-01' },
    { id: 9, tipo: 'cotado', preco_unitario_vp: 9, registrado_em: '2026-09-04' }
  ];
  it('mais barato/mais caro com % sobre o mais barato e variação vs. anterior', () => {
    const r = histPrecos.resumoHistorico(h);
    assert.equal(r.maisBarato.id, 2);
    assert.equal(r.maisCaro.id, 3);
    assert.ok(Math.abs(r.diferenca.valor - 1.5) < 1e-9 && Math.abs(r.diferenca.pct - 1.5 / 4.1) < 1e-9);
    const v = histPrecos.variacoesSequenciais(h);
    assert.ok(Math.abs(v.get(3).valor - 1.5) < 1e-9); // 5,60 vs. 4,10
    assert.equal(v.has(1), false);
    assert.equal(histPrecos.resumoHistorico([]).maisBarato, null);
  });
  it('separar e juntar linhas preservam as origens', () => {
    const linhas = [
      { _chave: 'a', id: 'a', descricao: 'Cabo', unidade: 'm', material_id: null, observacao_publica: '', origens: [{ pedido_id: 'p1', item_id: 'i1', quantidade: 100 }, { pedido_id: 'p2', item_id: 'i2', quantidade: 200 }] },
      { _chave: 'b', id: 'b', descricao: 'Cabo 2,5', unidade: 'm', material_id: 'm1', observacao_publica: '', origens: [{ pedido_id: 'p3', item_id: 'i3', quantidade: 50 }] }
    ];
    const sep = montagem.separarOrigem(linhas, 'a', linhas[0].origens[1]);
    assert.equal(sep.length, 3);
    assert.equal(montagem.quantidadeDaLinha(sep[0]), 100);
    assert.equal(montagem.quantidadeDaLinha(sep[1]), 200);
    assert.equal('id' in montagem.linhasParaPayload([sep[1]])[0], false); // linha nova sem id
    const jun = montagem.juntarLinhas(linhas, 'a', 'b');
    assert.equal(jun.length, 1);
    assert.equal(montagem.quantidadeDaLinha(jun[0]), 350);
    assert.equal(montagem.separarOrigem([linhas[1]], 'b', linhas[1].origens[0]).length, 1); // 1 origem: não separa
    assert.equal(montagem.padraoEndereco.test('Rua das Flores'), true);
    assert.equal(montagem.padraoEndereco.test('Curitiba/Batel'), false);
  });
});
