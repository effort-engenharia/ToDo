#!/usr/bin/env node
// Liga o código ao banco no grafo do graphify: adiciona arestas `uses` (supabase.from) e `calls` (.rpc)
// de cada função/arquivo em src/ que chama supabase.from('<tabela>') / .rpc('<fn>')
// até o nó correspondente do snapshot em supabase/schema/*.sql.
// O graphify não entende essas strings do client Supabase; rode após `graphify update/extract`.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = resolve(ROOT, 'graphify-out/graph.json');

if (!existsSync(GRAPH)) {
  console.error('graphify-out/graph.json não encontrado. Rode `graphify extract . --code-only` antes.');
  process.exit(1);
}

const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
const edgesKey = graph.links ? 'links' : 'edges';
graph[edgesKey] = graph[edgesKey].filter((e) => e._origin !== 'supabase-linker');

// Referências SQL entre arquivos (ex.: índice em logic.sql → tabela em tables.sql) viram nós
// "stub" sem source_file; funde-os no nó que define o objeto.
const isSchemaNode = (n) => /^supabase\/schema\/.+\.sql$/.test(n.source_file || '');
const definedByLabel = new Map(graph.nodes.filter(isSchemaNode).map((n) => [n.label, n.id]));
const stubToReal = new Map();
for (const n of graph.nodes) {
  if (!n.source_file && definedByLabel.has(n.label)) stubToReal.set(n.id, definedByLabel.get(n.label));
}
if (stubToReal.size) {
  graph.nodes = graph.nodes.filter((n) => !stubToReal.has(n.id));
  const unique = new Set();
  graph[edgesKey] = graph[edgesKey]
    .map((e) => {
      if (!stubToReal.has(e.source) && !stubToReal.has(e.target)) return e;
      return { ...e, source: stubToReal.get(e.source) ?? e.source, target: stubToReal.get(e.target) ?? e.target, _remapped: true };
    })
    .filter((e) => {
      if (!e._remapped) return true;
      delete e._remapped;
      const key = `${e.source}|${e.target}|${e.relation}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });
}

const lineOf = (n) => Number(String(n.source_location || '').replace(/^L/, '')) || 0;
const dbNodes = new Map();
const codeNodesByFile = new Map();
for (const n of graph.nodes) {
  const file = n.source_file || '';
  if (file.startsWith('supabase/schema/') && file.endsWith('.sql')) {
    const name = n.label.replace(/^public\./, '').replace(/\(\)$/, '');
    if (!dbNodes.has(name) || n.label.startsWith('public.')) dbNodes.set(name, n);
  } else if (file.startsWith('src/')) {
    if (!codeNodesByFile.has(file)) codeNodesByFile.set(file, []);
    codeNodesByFile.get(file).push(n);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(m?jsx?|tsx?)$/.test(name) ? [p] : [];
  });
}

// Nó de código mais interno que antecede a chamada; cai no nó do arquivo se não houver.
function ownerNode(file, line) {
  const nodes = (codeNodesByFile.get(file) || []).slice().sort((a, b) => lineOf(a) - lineOf(b));
  let owner = nodes.find((n) => lineOf(n) === 1 && /\.(m?jsx?|tsx?)$/.test(n.label));
  for (const n of nodes) if (lineOf(n) > 1 && lineOf(n) <= line) owner = n;
  return owner;
}

const CALL = /\.\s*(from|rpc)\s*\(\s*['"`]([A-Za-z0-9_]+)['"`]/g;
const seen = new Set();
const missing = new Set();
let added = 0;

for (const abs of walk(resolve(ROOT, 'src'))) {
  const file = relative(ROOT, abs).split('\\').join('/');
  const src = readFileSync(abs, 'utf8');
  for (const m of src.matchAll(CALL)) {
    const [, kind, name] = m;
    if (kind === 'from' && /storage\s*$/.test(src.slice(Math.max(0, m.index - 40), m.index))) continue;
    const target = dbNodes.get(name);
    if (!target) {
      missing.add(name);
      continue;
    }
    const line = src.slice(0, m.index).split('\n').length;
    const owner = ownerNode(file, line);
    if (!owner) continue;
    const relation = kind === 'rpc' ? 'calls' : 'uses';
    const key = `${owner.id}|${target.id}|${relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    graph[edgesKey].push({
      source: owner.id,
      target: target.id,
      relation,
      _origin: 'supabase-linker',
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      context: kind === 'rpc' ? 'supabase.rpc' : 'supabase.from',
      source_file: file,
      source_location: `L${line}`,
      weight: 1.0,
    });
    added++;
  }
}

writeFileSync(GRAPH, JSON.stringify(graph));
console.log(`[graph-link-db] ${stubToReal.size} nó(s) duplicado(s) do schema fundidos; ${added} aresta(s) código→banco adicionadas.`);
if (missing.size) console.log(`[graph-link-db] sem nó no snapshot (tabela inexistente ou snapshot desatualizado): ${[...missing].join(', ')}`);
