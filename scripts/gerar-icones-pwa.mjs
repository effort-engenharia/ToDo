// Gera os ícones do PWA (public/icons/*.png) sem dependências: node scripts/gerar-icones-pwa.mjs
// Desenho: fundo slate escuro + "E" laranja (cores do módulo Execução). Substitua por arte oficial quando houver.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FUNDO = [15, 23, 42];
const LETRA = [249, 115, 22];
const SAIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const crcTabela = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const bloco = (tipo, dados) => {
  const cabecalho = Buffer.alloc(8);
  cabecalho.writeUInt32BE(dados.length, 0);
  cabecalho.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([cabecalho.subarray(4), dados])), 0);
  return Buffer.concat([cabecalho, dados, crc]);
};

// `margem`: fração da borda livre (maskable precisa de zona segura de ~10% por lado)
const desenhar = (tam, { cantos, margem }) => {
  const raio = cantos * tam;
  const area = tam * (1 - 2 * margem);
  const x0 = tam * margem;
  // "E": haste vertical + três barras horizontais, dentro de um quadrado centralizado
  const lado = area * 0.62;
  const espessura = lado * 0.2;
  const lx = x0 + (area - lado) / 2;
  const ly = x0 + (area - lado) / 2;
  const retangulos = [
    [lx, ly, espessura, lado],
    [lx, ly, lado, espessura],
    [lx, ly + (lado - espessura) / 2, lado * 0.85, espessura],
    [lx, ly + lado - espessura, lado, espessura]
  ];
  const linhas = [];
  for (let y = 0; y < tam; y += 1) {
    const linha = Buffer.alloc(1 + tam * 3);
    for (let x = 0; x < tam; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(raio - px, px - (tam - raio), 0);
      const dy = Math.max(raio - py, py - (tam - raio), 0);
      const dentro = raio === 0 || dx * dx + dy * dy <= raio * raio;
      const letra = retangulos.some(([rx, ry, rw, rh]) => px >= rx && px <= rx + rw && py >= ry && py <= ry + rh);
      const cor = !dentro ? FUNDO : letra ? LETRA : FUNDO;
      linha.set(cor, 1 + x * 3);
    }
    linhas.push(linha);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    bloco('IEND', Buffer.alloc(0))
  ]);
};

mkdirSync(SAIDA, { recursive: true });
const icones = [
  ['icon-192.png', 192, { cantos: 0.18, margem: 0 }],
  ['icon-512.png', 512, { cantos: 0.18, margem: 0 }],
  ['icon-maskable-512.png', 512, { cantos: 0, margem: 0.1 }],
  ['apple-touch-icon.png', 180, { cantos: 0, margem: 0 }]
];
for (const [nome, tam, opcoes] of icones) {
  writeFileSync(join(SAIDA, nome), desenhar(tam, opcoes));
  console.log('gerado', nome);
}
