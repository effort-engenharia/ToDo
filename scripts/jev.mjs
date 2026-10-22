#!/usr/bin/env node
// CLI para decisões rápidas e baratas com o Jev (TypeSafe AI) durante o desenvolvimento.
// Uso:
//   node scripts/jev.mjs --state "<texto>" --questions '<json>'
//   node scripts/jev.mjs --state @arquivo.txt --questions @perguntas.json [--model jev-latest] [--raw]
// A chave é lida de API_JEV_AI (ou TYPESAFE_API_KEY) no ambiente, .env.local ou .env.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function readEnvKey(names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env']) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && names.includes(m[1])) return m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return undefined;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--raw' || a === '-h' || a === '--help') args[a.replace(/^-+/, '')] = true;
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }
  return args;
}

const loadValue = (v) => (v?.startsWith('@') ? readFileSync(resolve(process.cwd(), v.slice(1)), 'utf8') : v);

function usage(code = 0) {
  console.log(`Uso: node scripts/jev.mjs --state <texto|@arquivo> --questions <json|@arquivo.json> [--model jev-latest] [--raw]

Tipos de pergunta:
  choice: {"type":"choice","instructions":"...","criteria":{"a":"desc","b":"desc"}}
  score:  {"type":"score","instructions":"...","criteria":["nível 0","nível 1","nível 2"]}
  noul:   {"type":"noul","instructions":"afirmação verdadeira/falsa"}

Exemplo:
  node scripts/jev.mjs --state "Botão salvar não persiste no Supabase" \\
    --questions '{"area":{"type":"choice","instructions":"Camada mais provável do bug","criteria":{"ui":"Componente React","service":"Serviço Supabase","db":"Banco/RLS"}}}'`);
  process.exit(code);
}

const args = parseArgs(process.argv.slice(2));
if (args.h || args.help) usage();
if (!args.state || !args.questions) usage(1);

const apiKey = readEnvKey(['API_JEV_AI', 'TYPESAFE_API_KEY']);
if (!apiKey) {
  console.error('Erro: defina API_JEV_AI (ou TYPESAFE_API_KEY) no ambiente, .env.local ou .env.');
  process.exit(1);
}

let state = loadValue(args.state);
try {
  const parsed = JSON.parse(state);
  if (parsed && typeof parsed === 'object') state = parsed;
} catch {
  // estado em texto puro
}

let questions;
try {
  questions = JSON.parse(loadValue(args.questions));
} catch (err) {
  console.error(`Erro: --questions não é um JSON válido (${err.message}).`);
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ state, model: args.model || 'jev-latest', questions }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`Erro ${res.status} da API TypeSafe: ${body}`);
  process.exit(1);
}

const data = JSON.parse(body);
if (args.raw) {
  console.log(JSON.stringify(data, null, 2));
} else {
  // Saída compacta para economizar tokens do agente.
  const out = {};
  for (const [id, a] of Object.entries(data.answers || {})) {
    if (a.type === 'choice') out[id] = { choice: a.choice, confidence: a.confidence };
    else if (a.type === 'score') out[id] = { score: a.score, confidence: a.confidence, legend: a.legend };
    else if (a.type === 'noul') out[id] = { noul: a.noul };
    else out[id] = a;
  }
  console.log(JSON.stringify({ model: data.model, answers: out, usage: data.usage }));
}
