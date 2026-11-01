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
