// Regras de apresentação do status da execução (dashboard Comercial). Só leitura.

export const STATUS_VISUAL = {
  aguardando_planejamento: { rotulo: 'Aguardando planejamento', tom: 'cinza' },
  planejada: { rotulo: 'Planejada', tom: 'azul' },
  em_andamento: { rotulo: 'Em execução', tom: 'amarelo' },
  atrasada: { rotulo: '⚠ Atrasada', tom: 'vermelho' },
  concluida: { rotulo: '✔ Concluída', tom: 'verde' },
  pausada: { rotulo: 'Pausada', tom: 'laranja' },
  cancelada: { rotulo: 'Cancelada', tom: 'cinza' },
  outra_equipe: { rotulo: 'Outra equipe', tom: 'cinza' },
  nao_planejado: { rotulo: 'Sem planejamento', tom: 'cinza' },
};

/** Normaliza o status vindo do banco para uma das chaves de STATUS_VISUAL. */
export function statusEfetivo(info) {
  if (!info) return null;
  let s = String(info.status_execucao || '').toLowerCase();
  if (s === 'planejado') s = 'planejada';
  if (s === 'concluido') s = 'concluida';
  if (['planejada', 'em_andamento'].includes(s) && info.saude === 'atrasada') return 'atrasada';
  return s || null;
}

/** 'YYYY-MM-DD' -> 'dd/mm' (sem passar por Date, evita deslocamento de fuso). */
export function formatarDataCurta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}` : '';
}

export function formatarProgresso(info) {
  const n = Number(info?.progresso);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

/** Texto completo do selo, por exemplo "Em execução 60%". */
export function textoSelo(info) {
  const chave = statusEfetivo(info);
  const visual = STATUS_VISUAL[chave];
  if (!visual) return '';
  const prog = formatarProgresso(info);
  if (chave === 'planejada') {
    const d = formatarDataCurta(info.inicio_previsto);
    return d ? `${visual.rotulo} (início ${d})` : visual.rotulo;
  }
  if (chave === 'em_andamento') return prog != null ? `${visual.rotulo} ${prog}%` : visual.rotulo;
  if (chave === 'atrasada') return prog != null ? `${visual.rotulo} ${prog}%` : visual.rotulo;
  if (chave === 'concluida') {
    const d = formatarDataCurta(info.entregue_em);
    return d ? `${visual.rotulo} ${d}` : visual.rotulo;
  }
  return visual.rotulo;
}
