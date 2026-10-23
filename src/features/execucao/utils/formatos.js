// Formatação compartilhada das telas de capacidade, horas extras, histórico e configurações.

// 525 -> "8h45"; 480 -> "8h"; 30 -> "30min"
export const formatarMinutos = (minutos) => {
  const total = Math.round(Number(minutos) || 0);
  const sinal = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sinal}${m}min`;
  return `${sinal}${h}h${m ? String(m).padStart(2, '0') : ''}`;
};

// 1.5 -> "1h30"
export const formatarHoras = (horas) => formatarMinutos(Math.round((Number(horas) || 0) * 60));

// Valor "HH:MM" (ou "HH:MM:SS") -> minutos desde 00:00
export const horaParaMinutos = (valor) => {
  const [h, m] = String(valor ?? '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

// timestamptz -> "23/10 14:32" no horário de Brasília, independentemente do fuso do navegador
export const formatarDataHora = (valor, { comAno = false } = {}) => {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    ...(comAno ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
};

// Tradução amigável de mensagens comuns do Postgres
export const mensagemErro = (erro) => {
  const msg = erro?.message || String(erro || '');
  if (erro?.code === '23505' || /duplicate key/i.test(msg)) return 'Já existe um registro igual.';
  if (erro?.code === '23503' || /foreign key/i.test(msg)) return 'Registro em uso por outros dados; desative-o em vez de excluir.';
  if (erro?.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para esta ação.';
  return msg;
};

// Mostra o toast adequado para o retorno { success, message } dos serviços; devolve true quando deu certo
export const notificarResultado = (resultado, toast, mensagemSucesso) => {
  if (resultado?.success) {
    if (mensagemSucesso) toast.success(mensagemSucesso);
    return true;
  }
  toast.error(resultado?.message || 'Não foi possível concluir a ação');
  return false;
};

// 1.5 -> "01:30"; 0.25 -> "00:15"; vazio/inválido -> ""
export const horasParaHHMM = (horas) => {
  if (horas === '' || horas == null || Number.isNaN(Number(horas))) return '';
  const total = Math.round(Number(horas) * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// "1:30" | "1h30" | "01:30" | "2" (= 2 horas) -> 1.5 | 2; vazio/inválido -> null
export const hhmmParaHoras = (texto) => {
  const t = String(texto ?? '').trim().toLowerCase().replace('h', ':');
  if (!t) return null;
  const [h, m = '0'] = t.split(':');
  if (!/^\d+$/.test(h) || !/^\d{0,2}$/.test(m)) return null;
  const minutos = Number(m || 0);
  if (minutos > 59) return null;
  return Number(h) + minutos / 60;
};
