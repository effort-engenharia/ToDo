// Garante que todo `execucaoService.metodo` usado nos componentes existe no serviço.
import { readFileSync, readdirSync } from 'node:fs';

const servico = readFileSync('src/services/supabase/execucao.js', 'utf8');
const definidos = new Set([...servico.matchAll(/^\s{2}(?:async\s+)?(\w+)\s*\(/gm)].map((m) => m[1]));

const dir = 'src/features/execucao/components';
let falhas = 0;
for (const arquivo of readdirSync(dir).filter((f) => /\.jsx?$/.test(f))) {
  const fonte = readFileSync(`${dir}/${arquivo}`, 'utf8');
  for (const [, nome] of fonte.matchAll(/execucaoService\.(\w+)/g)) {
    if (!definidos.has(nome)) {
      console.error(`✗ ${arquivo}: execucaoService.${nome} não existe no serviço`);
      falhas++;
    }
  }
}

if (falhas) process.exit(1);
console.log('✓ Contrato componentes ↔ serviço OK');
