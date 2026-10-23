import { dataLocalISO, parseDataLocal, addDias } from '../../utils/datas';

export const JORNADA_PADRAO_MIN = 8 * 60 + 45;

export const STATUS_ABERTOS = ['pendente', 'em_andamento', 'pausada'];

export const hhmm = (valor) => (valor ? String(valor).slice(0, 5) : '');

// 1,5 -> "1h30"; 8,75 -> "8h45"; 0,5 -> "30min"
export const formatarHoras = (horas) => {
  const n = Number(horas);
  if (!Number.isFinite(n) || n <= 0) return '0h';
  const minutos = Math.round(n * 60);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

export const formatarMinutos = (min) => formatarHoras((min ?? 0) / 60);

// Dias úteis (seg-sex) entre duas datas YYYY-MM-DD, inclusive; no mínimo 1
export const diasUteisEntre = (inicio, fim) => {
  const a = parseDataLocal(inicio);
  const b = parseDataLocal(fim || inicio);
  if (!a || !b || b < a) return 1;
  let n = 0;
  for (let d = a; d <= b; d = addDias(d, 1)) {
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) n += 1;
  }
  return Math.max(1, n);
};

export const ehMultiDia = (a) => !!a.data_fim && a.data_fim > a.data_programada;

// "Dia 2 de 4" (dias úteis); null para atividades de um dia
export const diaDaAtividade = (a, hoje = dataLocalISO()) => {
  if (!ehMultiDia(a) || hoje < a.data_programada || hoje > a.data_fim) return null;
  return { dia: diasUteisEntre(a.data_programada, hoje), total: diasUteisEntre(a.data_programada, a.data_fim) };
};

export const estaAtrasada = (a, hoje = dataLocalISO()) =>
  STATUS_ABERTOS.includes(a.status) && (a.data_fim || a.data_programada) < hoje;

// Parte do técnico nas horas previstas (equipe: horas individuais ou divisão igual)
export const horasDoTecnico = (a, usuarioId) => {
  const total = a.horas_previstas != null ? Number(a.horas_previstas) : null;
  const equipe = a.equipe ?? [];
  const minha = equipe.find((e) => e.usuario_id === usuarioId);
  if (minha?.horas_previstas != null) return Number(minha.horas_previstas);
  if (total == null) return null;
  return total / Math.max(1, equipe.length);
};

// Horas do técnico que caem num dia (atividade de vários dias dilui nos dias úteis)
export const horasPrevistasNoDia = (a, usuarioId) => {
  const h = horasDoTecnico(a, usuarioId);
  if (h == null) return 0;
  return ehMultiDia(a) ? h / diasUteisEntre(a.data_programada, a.data_fim) : h;
};

const primeiroNome = (nome) => String(nome ?? '').trim().split(/\s+/)[0] || null;

// [{ nome, papel, eu }] com o líder primeiro
export const equipeDaAtividade = (a, usuarioId) => {
  const lista = (a.equipe ?? []).map((e) => ({
    id: e.usuario_id,
    papel: e.papel,
    eu: e.usuario_id === usuarioId,
    nome: e.usuario_id === usuarioId ? 'Você' : primeiroNome(e.usuario?.nome_completo) || 'Colega'
  }));
  if (!lista.length && a.tecnico?.nome_completo) {
    lista.push({
      id: a.tecnico_responsavel_id,
      papel: 'lider',
      eu: a.tecnico_responsavel_id === usuarioId,
      nome: a.tecnico_responsavel_id === usuarioId ? 'Você' : primeiroNome(a.tecnico.nome_completo)
    });
  }
  return lista.sort((x, y) => (x.papel === 'lider' ? -1 : 0) - (y.papel === 'lider' ? -1 : 0));
};

export const rotuloDia = (dataISO, hoje = dataLocalISO()) => {
  const d = parseDataLocal(dataISO);
  if (!d) return '';
  const amanha = dataLocalISO(addDias(parseDataLocal(hoje), 1));
  if (dataISO === hoje) return 'Hoje';
  if (dataISO === amanha) return 'Amanhã';
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${semana} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
};

export const MATERIAL_ROTULOS = {
  disponivel: { texto: 'disponível ✓', classe: 'ok' },
  previsto: { texto: 'previsto', classe: 'aviso' },
  pendente: { texto: 'pendente', classe: 'erro' }
};

export const textoMaterial = (info) => {
  const base = info ? MATERIAL_ROTULOS[info.situacao] : null;
  if (!base) return null;
  let texto = base.texto;
  if (info.situacao === 'previsto' && info.data_disponivel) {
    const d = parseDataLocal(info.data_disponivel);
    texto = `previsto para ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  }
  return { texto, classe: base.classe };
};
