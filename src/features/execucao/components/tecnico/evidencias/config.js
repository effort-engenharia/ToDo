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
  if (m.includes('3gpp')) return '3gp';
  if (m.includes('aac')) return 'aac';
  if (m.includes('wav')) return 'wav';
  if (m.includes('amr')) return 'amr';
  return 'bin';
};

export const LIMITE_BUCKET_MB = 50; // plano gratuito do Supabase: 50 MB por arquivo

export const suportaGravacao = () =>
  typeof navigator !== 'undefined'
  && typeof window !== 'undefined'
  && window.isSecureContext !== false
  && !!navigator.mediaDevices?.getUserMedia
  && typeof window.MediaRecorder === 'function';

// O MediaRecorder sem mimeType usa o padrão do navegador, então basta ele existir.
export const suportaGravacaoTipo = (tipo) => (tipo === 'audio' || tipo === 'video') && suportaGravacao();

// Explica por que o app não consegue gravar (null quando consegue).
export const motivoSemGravacao = (tipo) => {
  if (suportaGravacaoTipo(tipo)) return null;
  const alvo = tipo === 'video' ? 'vídeo' : 'áudio';
  const aparelho = tipo === 'video' ? 'a câmera do aparelho' : 'o gravador do aparelho';
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return `Câmera/microfone bloqueados: a página não está em conexão segura (HTTPS). Vamos usar ${aparelho}.`;
  }
  return `Este navegador não grava ${alvo} pelo app. Vamos usar ${aparelho}.`;
};

const MIME_POR_EXTENSAO = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp',
  m4a: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', amr: 'audio/amr'
};

// Mime real do arquivo nativo (sem `;codecs=`); se o aparelho não informar, deduz pela extensão e, por último, usa mp4.
export const mimeDoArquivo = (arquivo, tipo) => {
  const informado = String(arquivo?.type || '').split(';')[0].trim().toLowerCase();
  if (informado) return informado;
  const ext = String(arquivo?.name || '').split('.').pop().toLowerCase();
  const porExtensao = MIME_POR_EXTENSAO[ext];
  if (porExtensao && porExtensao.startsWith(`${tipo}/`)) return porExtensao;
  return tipo === 'audio' ? 'audio/mp4' : 'video/mp4';
};

// Mensagem de limite de tamanho: diz o que foi enviado, o limite e o que fazer.
export const mensagemLimiteTamanho = (tipo, bytes) => {
  const limite = EVIDENCIAS_CONFIG[tipo]?.maxBytes ?? LIMITE_BUCKET_MB * MB;
  const nome = tipo === 'video' ? 'Vídeo' : tipo === 'audio' ? 'Áudio' : 'Arquivo';
  const acao = tipo === 'video'
    ? `grave um vídeo mais curto (até ${EVIDENCIAS_CONFIG.video.limiteSegundos} s) ou reduza a qualidade da câmera nas configurações do aparelho`
    : tipo === 'audio'
      ? `grave um áudio mais curto (até ${formatarDuracao(EVIDENCIAS_CONFIG.audio.limiteSegundos)})`
      : 'tente um arquivo menor';
  return `${nome} muito grande: ${formatarBytes(bytes)} enviados e o limite é ${formatarBytes(limite)}. Para continuar, ${acao}.`;
};
