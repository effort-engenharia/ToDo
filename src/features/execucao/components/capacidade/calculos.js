import { intervaloSemana, parseDataLocal } from '../../utils/datas';

// Situação de um dia (ou semana) de um colaborador: ordem de gravidade crescente em PRIORIDADE
export const SITUACOES = {
  folga: { rotulo: 'Sem expediente', curto: '', classe: 'cap-folga' },
  livre: { rotulo: 'Livre', curto: '', classe: 'cap-livre' },
  ok: { rotulo: 'Dentro da jornada', curto: 'ok', classe: 'cap-ok' },
  extra: { rotulo: 'Hora extra (até o limite diário)', curto: 'extra', classe: 'cap-extra' },
  emergencia: { rotulo: 'Emergência (dia não útil)', curto: 'emerg.', classe: 'cap-emergencia' },
  limite: { rotulo: 'Acima do limite diário', curto: 'limite', classe: 'cap-limite' },
  ausente: { rotulo: 'Ausente', curto: 'ausente', classe: 'cap-ausente' },
  feriado: { rotulo: 'Feriado', curto: 'feriado', classe: 'cap-folga' },
};

const PRIORIDADE = ['folga', 'feriado', 'ausente', 'livre', 'ok', 'extra', 'emergencia', 'limite'];

export const situacaoDoDia = (c) => {
  const previsto = c.previsto_min ?? 0;
  if (c.ausente) return previsto > 0 ? 'limite' : 'ausente';
  if (!c.dia_util) {
    if (previsto > 0) return 'emergencia';
    return c.feriado ? 'feriado' : 'folga';
  }
  if (previsto === 0) return 'livre';
  if (previsto <= c.disponivel_min) return 'ok';
  if (previsto <= c.disponivel_min + c.extra_max_min) return 'extra';
  return 'limite';
};

export const piorSituacao = (situacoes) =>
  situacoes.reduce((pior, s) => (PRIORIDADE.indexOf(s) > PRIORIDADE.indexOf(pior) ? s : pior), 'folga');

// Agrupa linhas do RPC por colaborador: Map<usuario_id|null, Map<data, linha>>
export const agruparPorUsuario = (linhas) => {
  const mapa = new Map();
  linhas.forEach((l) => {
    const chave = l.usuario_id ?? null;
    if (!mapa.has(chave)) mapa.set(chave, new Map());
    mapa.get(chave).set(String(l.data).slice(0, 10), l);
  });
  return mapa;
};

// Soma um conjunto de dias em um bloco (usado na visão por semana)
export const somarDias = (dias) => {
  const total = { disponivel_min: 0, extra_max_min: 0, previsto_min: 0, atividades: 0 };
  const situacoes = [];
  let conflitos = 0;
  dias.forEach((d) => {
    total.disponivel_min += d.disponivel_min;
    total.extra_max_min += d.extra_max_min;
    total.previsto_min += d.previsto_min;
    total.atividades = Math.max(total.atividades, d.atividades);
    const s = situacaoDoDia(d);
    situacoes.push(s);
    if (['limite', 'emergencia'].includes(s)) conflitos += 1;
  });
  return { ...total, situacao: piorSituacao(situacoes), conflitos };
};

// Segunda-feira da semana de uma data civil (YYYY-MM-DD)
export const segundaDa = (valor) => intervaloSemana(parseDataLocal(valor)).inicio;

// Totais do período para os cartões de resumo
export const resumirPeriodo = (linhas) => {
  const r = { disponivel: 0, previsto: 0, acimaJornada: 0, emergencia: 0, semTecnico: 0 };
  linhas.forEach((l) => {
    if (l.usuario_id === null || l.usuario_id === undefined) {
      r.semTecnico += l.previsto_min;
      return;
    }
    r.disponivel += l.disponivel_min;
    r.previsto += l.previsto_min;
    if (!l.dia_util) r.emergencia += l.previsto_min;
    else r.acimaJornada += Math.max(0, l.previsto_min - l.disponivel_min);
  });
  return r;
};
