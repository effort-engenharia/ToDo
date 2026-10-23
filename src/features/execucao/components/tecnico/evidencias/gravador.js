// Captura de áudio/vídeo já comprimida na origem, com MediaRecorder (nativo, sem biblioteca).
import { EVIDENCIAS_CONFIG } from './config.js';

const MIMES = {
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'],
  video: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
};

const escolherMime = (tipo) => MIMES[tipo].find((m) => window.MediaRecorder.isTypeSupported?.(m)) || '';

export const mimeBase = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();

export function mensagemErroMidia(err, tipo) {
  const alvo = tipo === 'video' ? 'a câmera e o microfone' : 'o microfone';
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Permissão negada. Libere ${alvo} nas configurações do navegador e tente de novo.`;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Não encontramos ${alvo} neste aparelho.`;
    case 'NotReadableError':
    case 'AbortError':
      return `${tipo === 'video' ? 'A câmera' : 'O microfone'} está em uso por outro aplicativo.`;
    default:
      return err?.message || 'Não foi possível iniciar a gravação.';
  }
}

export async function abrirMidia(tipo) {
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
      const mime = mimeBase(gravador.mimeType || partes[0]?.type || mimeType) || (tipo === 'video' ? 'video/webm' : 'audio/webm');
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
