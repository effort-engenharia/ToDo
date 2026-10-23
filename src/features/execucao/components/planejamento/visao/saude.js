import { addDias, intervaloSemana, parseDataLocal } from '../../../utils/datas';
import { inicioDeHoje } from '../utils';

// A saúde vem do banco (execucao_saude_obras), a única fonte das regras do item 2.3.
export const SAUDE = {
  atrasada: { rotulo: 'Atrasada', emoji: '🔴', badge: 'execucao-badge-red', cor: '#ef4444', peso: 0 },
  em_risco: { rotulo: 'Em risco', emoji: '🟠', badge: 'execucao-badge-orange', cor: '#f97316', peso: 1 },
  pendencia: { rotulo: 'Pendência', emoji: '⚠️', badge: 'execucao-badge-yellow', cor: '#eab308', peso: 2 },
  no_prazo: { rotulo: 'No prazo', emoji: '🟢', badge: 'execucao-badge-green', cor: '#22c55e', peso: 3 }
};

export const COR_SEM_SAUDE = '#64748b';

export const FILTROS_VISAO = [
  { id: 'todos', rotulo: 'Todas as obras' },
  { id: 'em_execucao', rotulo: 'Em execução' },
  { id: 'comecam', rotulo: 'Começam nos próximos 15 dias' },
  { id: 'entregas_semana', rotulo: 'Entregas da semana' },
  { id: 'atrasada', rotulo: 'Atrasadas' },
  { id: 'em_risco', rotulo: 'Em risco' },
  { id: 'pendencia', rotulo: 'Saúde: pendência' },
  { id: 'no_prazo', rotulo: 'No prazo' },
  { id: 'pendencias', rotulo: 'Com pendências' }
];

export const rotuloFiltroVisao = (id) => FILTROS_VISAO.find((f) => f.id === id)?.rotulo ?? '';

export const indexarSaude = (linhas) => new Map((linhas ?? []).map((l) => [l.obra_id, l]));

export const temPendencias = (s) =>
  Boolean(s && (s.sem_responsavel > 0 || s.material_pendente > 0 || s.replanejamento > 0 || s.pausadas > 0));

const obraAberta = (obra) => obra.status !== 'concluida' && obra.status !== 'cancelada';

// Mesmas definições do painel (execucao_painel_carteira), para que o número do cartão bata com a lista
export const obraPassaFiltroVisao = (obra, filtro, saudePorObra, hoje = inicioDeHoje()) => {
  if (filtro === 'todos') return true;
  const saude = saudePorObra.get(obra.id);
  switch (filtro) {
    case 'em_execucao':
      return obra.status === 'em_andamento';
    case 'comecam': {
      const inicio = parseDataLocal(obra.data_inicio_prevista);
      return obra.status === 'planejada' && Boolean(inicio && inicio >= hoje && inicio <= addDias(hoje, 15));
    }
    case 'entregas_semana': {
      const semana = intervaloSemana(hoje);
      const fim = parseDataLocal(obra.data_fim_prevista);
      return obraAberta(obra) && Boolean(fim && fim >= parseDataLocal(semana.inicio) && fim <= parseDataLocal(semana.fim));
    }
    case 'pendencias':
      return temPendencias(saude);
    default:
      return saude?.saude === filtro;
  }
};

export const ordenarPorSaude = (obras, saudePorObra) => {
  const peso = (o) => SAUDE[saudePorObra.get(o.id)?.saude]?.peso ?? 4;
  return [...obras].sort((a, b) => peso(a) - peso(b)
    || (saudePorObra.get(b.id)?.dias_atraso ?? 0) - (saudePorObra.get(a.id)?.dias_atraso ?? 0));
};

export const resumoMotivos = (saude) => {
  if (!saude) return '';
  const lista = saude.motivos?.length ? saude.motivos : ['Sem alertas: dentro do esperado'];
  return `${SAUDE[saude.saude]?.rotulo ?? ''}\n${lista.map((m) => `• ${m}`).join('\n')}`;
};
