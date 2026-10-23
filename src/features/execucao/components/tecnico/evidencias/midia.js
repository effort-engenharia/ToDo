// Compressão no navegador (canvas), sem biblioteca e sem serviço externo. Carregado sob demanda (import()).
import { EVIDENCIAS_CONFIG } from './config.js';
import { textoCarimbo } from './carimbo.js';

let tipoImagemCache = null;
const tipoImagem = () => {
  if (tipoImagemCache) return tipoImagemCache;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    tipoImagemCache = c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  } catch {
    tipoImagemCache = 'image/jpeg';
  }
  return tipoImagemCache;
};

const paraBlob = (canvas, tipo, qualidade) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), tipo, qualidade);
});

const carregarImagem = async (arquivo) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close?.() };
    } catch { /* cai para <img> */ }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
};

const escalar = (largura, altura, ladoMaior) => {
  const fator = Math.min(1, ladoMaior / Math.max(largura, altura));
  return { w: Math.max(1, Math.round(largura * fator)), h: Math.max(1, Math.round(altura * fator)) };
};

const desenhar = (img, ladoMaior, texto) => {
  const { w, h } = escalar(img.largura, img.altura, ladoMaior);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.fonte, 0, 0, w, h);
  if (texto) {
    const fonte = Math.max(14, Math.round(Math.min(w, h) * 0.032));
    const margem = Math.round(fonte * 0.5);
    const faixa = fonte + margem * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, h - faixa, w, faixa);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fonte}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, margem, h - faixa / 2, w - margem * 2);
  }
  return canvas;
};

const liberarCanvas = (canvas) => { canvas.width = 0; canvas.height = 0; };

export const miniaturaDeCanvasFonte = async (fonte, largura, altura) => {
  const { miniaturaPx, miniaturaQualidade } = EVIDENCIAS_CONFIG.foto;
  const { w, h } = escalar(largura, altura, miniaturaPx);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(fonte, 0, 0, w, h);
  try {
    return await paraBlob(canvas, tipoImagem(), miniaturaQualidade);
  } finally {
    liberarCanvas(canvas);
  }
};

const TENTATIVAS = [
  { lado: 1600, q: 0.7 },
  { lado: 1600, q: 0.6 },
  { lado: 1280, q: 0.6 },
  { lado: 1280, q: 0.5 },
  { lado: 1024, q: 0.5 }
];

// Redimensiona (lado maior 1600 px), recodifica (WebP/JPEG ~70%) até caber em ~400 KB e imprime o carimbo.
export async function comprimirFoto(arquivo, { data, localizacao }) {
  const cfg = EVIDENCIAS_CONFIG.foto;
  const img = await carregarImagem(arquivo);
  try {
    const texto = textoCarimbo(data, localizacao);
    const tipo = tipoImagem();
    let melhor = null;
    for (const t of TENTATIVAS) {
      const lado = Math.min(t.lado, cfg.ladoMaiorPx);
      const canvas = desenhar(img, lado, texto);
      let blob;
      try {
        blob = await paraBlob(canvas, tipo, Math.min(t.q, cfg.qualidade));
      } finally {
        liberarCanvas(canvas);
      }
      if (!melhor || blob.size < melhor.size) melhor = blob;
      if (blob.size <= cfg.alvoBytes) break;
    }
    const miniatura = await miniaturaDeCanvasFonte(img.fonte, img.largura, img.altura);
    return { blob: melhor, miniatura, mime: melhor.type || tipo, largura: img.largura, altura: img.altura };
  } finally {
    img.liberar();
  }
}

// Quadro de capa de um vídeo (arquivo ou elemento <video> já tocando)
export async function miniaturaDeElementoVideo(video) {
  if (!video?.videoWidth) return null;
  try {
    return await miniaturaDeCanvasFonte(video, video.videoWidth, video.videoHeight);
  } catch {
    return null;
  }
}

// Vídeo vindo da câmera nativa (contingência): lê duração e capa; qualquer falha devolve valores nulos
export function inspecionarVideoArquivo(arquivo) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    let encerrado = false;
    const fim = async (usarFrame) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer);
      const duracao = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      const miniatura = usarFrame ? await miniaturaDeElementoVideo(video) : null;
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve({ duracao, miniatura });
    };
    const timer = setTimeout(() => fim(false), 6000);
    video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, (video.duration || 1) / 2); };
    video.onseeked = () => fim(true);
    video.onerror = () => fim(false);
    video.src = url;
  });
}
