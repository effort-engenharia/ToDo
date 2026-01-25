const fs = require('fs');
const content = fs.readFileSync('./src/features/execucao/components/PlanejamentoMacro.jsx', 'utf8');
const lines = content.split('\n');

let braces = 0;
let parens = 0;
let brackets = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Ignorar strings e comentários é complexo, mas vamos tentar básico
  for (const c of line) {
    if (c === '{') braces++;
    if (c === '}') braces--;
    if (c === '(') parens++;
    if (c === ')') parens--;
    if (c === '[') brackets++;
    if (c === ']') brackets--;
  }
  
  // Mostrar onde fica negativo
  if (braces < 0 || parens < 0 || brackets < 0) {
    console.log(`PROBLEMA na linha ${i + 1}:`);
    console.log(`  braces=${braces}, parens=${parens}, brackets=${brackets}`);
    console.log(`  "${line.substring(0, 80)}"`);
  }
}

console.log('\n=== RESULTADO FINAL ===');
console.log(`braces ({}): ${braces}`);
console.log(`parens (()): ${parens}`);
console.log(`brackets ([]): ${brackets}`);

if (braces === 0 && parens === 0 && brackets === 0) {
  console.log('\n✅ Arquivo balanceado!');
} else {
  console.log('\n❌ Arquivo desbalanceado!');
}
