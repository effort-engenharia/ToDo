// Captura de áudio/vídeo já comprimida na origem, com MediaRecorder (nativo, sem biblioteca).
import { EVIDENCIAS_CONFIG } from './config.js';

const MIMES = {
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'],
  video: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
};

const escolherMime = (tipo) => MIMES[tipo].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

// Só como rótulo, quando o navegador não informa o tipo gravado: Safari/iOS grava MP4; os demais, WebM.
const mimeRotuloPadrao = (tipo) => {
  const apple = typeof navigator !== 'undefined' && /apple/i.test(navigator.vendor || '');
  if (apple) return tipo === 'video' ? 'video/mp4' : 'audio/mp4';
  return tipo === 'video' ? 'video/webm' : 'audio/webm';
};

export const mimeBase = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();

// Falhas em que vale oferecer a câmera/gravador nativo do aparelho no lugar da gravação pelo app.
const ERROS_COM_FALLBACK = ['NotAllowedError', 'SecurityError', 'NotSupportedError', 'TypeError', 'NotFoundError', 'NotReadableError', 'AbortError', 'OverconstrainedError'];
export const deveUsarFallbackNativo = (err) => !err?.name || ERROS_COM_FALLBACK.includes(err.name);

export function mensagemErroMidia(err, tipo) {
  const alvo = tipo === 'video' ? 'a câmera e o microfone' : 'o microfone';
  const aparelho = tipo === 'video' ? 'a câmera' : 'o gravador';
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Permissão negada. Libere ${alvo} nas configurações do navegador e tente de novo, ou use ${aparelho} do aparelho.`;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Não encontramos ${alvo} neste aparelho.`;
    case 'NotReadableError':
    case 'AbortError':
      return `${tipo === 'video' ? 'A câmera' : 'O microfone'} está em uso por outro aplicativo.`;
    case 'NotSupportedError':
    case 'TypeError':
      return `Este navegador não grava ${tipo === 'video' ? 'vídeo' : 'áudio'} pelo app; use ${aparelho} do aparelho.`;
    default:
      return err?.message || 'Não foi possível iniciar a gravação.';
  }
}

export async function abrirMidia(tipo) {
  if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== 'function') {
    throw Object.assign(new Error('Gravação não suportada neste navegador.'), { name: 'NotSupportedError' });
  }
  const cfg = EVIDENCIAS_CONFIG.video;
  const constraints = tipo === 'video'
    ? {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: cfg.largura },
          height: { ideal: cfg.altura },
          frameRate: { ideal: cfg.quadrosPorSegundo, max: 30 }
        }
      }
    : { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export const pararStream = (stream) => stream?.getTracks().forEach((t) => t.stop());

// Grava até `parar()` ou até o limite de duração. `concluido` resolve com { blob, mime, duracaoSeg } (ou null se cancelada).
export function gravar(stream, { tipo, onTick }) {
  const cfgTipo = EVIDENCIAS_CONFIG[tipo];
  const mimeType = escolherMime(tipo);
  const opcoes = tipo === 'video'
    ? { videoBitsPerSecond: cfgTipo.bitsPorSegundoVideo, audioBitsPerSecond: cfgTipo.bitsPorSegundoAudio }
    : { audioBitsPerSecond: cfgTipo.bitsPorSegundo };
  if (mimeType) opcoes.mimeType = mimeType;

  const gravador = new window.MediaRecorder(stream, opcoes);
  const partes = [];
  const inicio = performance.now();
  let cancelada = false;
  let tick = null;
  let limite = null;

  const concluido = new Promise((resolve, reject) => {
    gravador.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
    gravador.onerror = (e) => { clearInterval(tick); clearTimeout(limite); reject(e.error || new Error('Falha na gravação.')); };
    gravador.onstop = () => {
      clearInterval(tick);
      clearTimeout(limite);
      if (cancelada) { resolve(null); return; }
      if (!partes.length) { reject(new Error('A gravação saiu vazia. Tente gravar de novo.')); return; }
      const mime = mimeBase(gravador.mimeType || partes[0]?.type || mimeType) || mimeRotuloPadrao(tipo);
      const blob = new Blob(partes, { type: mime });
      resolve({ blob, mime, duracaoSeg: Math.max(1, Math.round((performance.now() - inicio) / 1000)) });
    };
  });

  gravador.start(1000);
  tick = setInterval(() => onTick?.((performance.now() - inicio) / 1000), 250);
  limite = setTimeout(() => { if (gravador.state !== 'inactive') gravador.stop(); }, cfgTipo.limiteSegundos * 1000);

  const encerrar = () => { if (gravador.state !== 'inactive') gravador.stop(); };
  return {
    concluido,
    parar: encerrar,
    cancelar: () => { cancelada = true; encerrar(); }
  };
}
