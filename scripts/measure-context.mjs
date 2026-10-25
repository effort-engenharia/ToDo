#!/usr/bin/env node
// Mede a economia de contexto: saída do `graphify` vs. busca manual (grep / leitura de arquivos).
// Tokens aproximados = caracteres / 4. Uso: node scripts/measure-context.mjs [--json]
//
// Baselines de "leitura direta":
//   grep   = saída de `grep -rnIE <padrão> src supabase` (só linhas, sem abrir arquivos)
//   files  = conteúdo integral dos arquivos que casam com o padrão (o que um agente leria para entender)
// Limitação: graphify devolve um MAPA (nós/arestas/localizações), não código. Para editar,
// ainda será preciso abrir 1–3 arquivos; por isso a coluna "graphify + 3 arq." estima esse custo.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = ['src', 'supabase'];
const tok = (s) => Math.ceil(s.length / 4);

const CASES = [
  {
    q: 'Onde fica a lógica de apontamentos comerciais?',
    graph: ['query', 'onde fica a lógica de apontamentos comerciais?'],
    pattern: 'apontamentos_comerciais|apontamentosService|ApontamentosComercial',
  },
  {
    q: 'Quem usa a tabela execucao_obras?',
    graph: ['explain', 'public.execucao_obras'],
    pattern: 'execucao_obras',
  },
  {
    q: 'Onde é calculada a premiação / metas?',
    graph: ['query', 'onde é calculada a premiação e as metas?'],
    pattern: 'premiacao|premiação|metas_premiacao',
  },
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { out: r.stdout || '', status: r.status };
}

const rows = CASES.map(({ q, graph, pattern }) => {
  const g = run('graphify', graph);
  const grepLines = run('grep', ['-rnIiE', pattern, ...SCOPE]).out;
  const files = run('grep', ['-rlIiE', pattern, ...SCOPE]).out.split('\n').filter(Boolean);
  const sizes = files.map((f) => ({ f, chars: statSync(resolve(ROOT, f)).size }));
  const filesChars = sizes.reduce((a, s) => a + s.chars, 0);
  const smallest3 = sizes.map((s) => s.chars).sort((a, b) => a - b).slice(0, 3).reduce((a, b) => a + b, 0);
  const tg = tok(g.out);
  return {
    q,
    graphify: tg,
    grepLinhas: tok(grepLines),
    arquivosCasados: files.length,
    arquivosInteiros: Math.ceil(filesChars / 4),
    economiaVsGrep: +((1 - tg / tok(grepLines)) * 100).toFixed(1),
    economiaVsArquivos: +((1 - tg / Math.ceil(filesChars / 4)) * 100).toFixed(1),
    graphifyMais3Arq: tg + Math.ceil(smallest3 / 4), // estimativa otimista (3 menores arquivos)
    ok: g.status === 0,
  };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.table(rows.map((r) => ({
    pergunta: r.q,
    'tok graphify': r.graphify,
    'tok grep (linhas)': r.grepLinhas,
    'arq. casados': r.arquivosCasados,
    'tok arquivos inteiros': r.arquivosInteiros,
    '% econ. vs grep': r.economiaVsGrep,
    '% econ. vs arquivos': r.economiaVsArquivos,
  })));
}
