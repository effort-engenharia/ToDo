// Limites e parâmetros das evidências (foto/vídeo/áudio). Plano gratuito do Supabase: 1 GB de storage, 50 MB/arquivo.
const MB = 1024 * 1024;

export const EVIDENCIAS_CONFIG = {
  maxArquivosPorAtividade: 20,

  foto: {
    ladoMaiorPx: 1600,
    qualidade: 0.7,
    alvoBytes: 400 * 1024,
    maxBytes: 3 * MB, // pós-compressão
    maxBytesOriginalSemCompressao: 8 * MB, // se o canvas falhar, só sobe o original abaixo disso
    miniaturaPx: 320,
    miniaturaQualidade: 0.6
  },

  video: {
    limiteSegundos: 60,
    largura: 1280,
    altura: 720,
    quadrosPorSegundo: 24,
    bitsPorSegundoVideo: 1_200_000,
    bitsPorSegundoAudio: 64_000,
    maxBytes: 45 * MB // abaixo do limite de 50 MB do bucket
  },

  audio: {
    limiteSegundos: 180,
    bitsPorSegundo: 32_000,
    maxBytes: 10 * MB
  },

  upload: {
    tentativasMax: 8,
    esperaBaseMs: 5_000,
    esperaMaxMs: 10 * 60_000,
    timeoutBaseMs: 60_000,
    timeoutPorMbMs: 20_000,
    verificacaoPeriodicaMs: 30_000
  },

  // Rascunhos abandonados e registros "enviado" são limpos após esse prazo
  retencaoRascunhoMs: 3 * 24 * 3600_000,
  retencaoEnviadoMs: 24 * 3600_000
};

export const ROTULO_TIPO = { foto: 'Foto', video: 'Vídeo', audio: 'Áudio' };

export const ESTADOS = {
  rascunho: 'Pronta para enviar',
  pendente: 'Na fila',
  enviando: 'Enviando…',
  enviado: 'Enviada',
  erro: 'Erro no envio'
};

export const formatarBytes = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${Math.round(n / 1024)} KB`;
  return `${(n / MB).toFixed(1).replace('.', ',')} MB`;
};

export const formatarDuracao = (segundos) => {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const novoUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const extensaoDoTipo = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') || m.includes('m4a')) return m.startsWith('audio') ? 'm4a' : 'mp4';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('quicktime')) return 'mov';
  return 'bin';
};

export const suportaGravacao = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && !!window.MediaRecorder;
