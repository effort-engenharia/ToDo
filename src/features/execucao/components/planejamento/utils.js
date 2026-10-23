import { addDias, dataLocalISO, parseDataLocal } from '../../utils/datas';
import { DURACAO_PADRAO_ETAPA_TEMPLATE } from './constants';

const MS_DIA = 1000 * 60 * 60 * 24;

export const inicioDeHoje = () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
};

// Aceita 'YYYY-MM-DD' ou Date (a navegação da agenda passa objetos Date)
export const formatarDataCurta = (valor) => {
  const data = valor instanceof Date ? valor : parseDataLocal(valor);
  return data ? data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
};

// Etapa sem data de fim nunca é considerada atrasada
export const etapaAtrasada = (etapa, hoje = inicioDeHoje()) => {
  const fim = parseDataLocal(etapa.data_fim);
  return Boolean(fim && fim < hoje && (etapa.progresso || 0) < 100);
};

// Status automático da obra pelo progresso (cancelada/pausada são mantidos)
export const getStatusReal = (obra) => {
  const progresso = obra.progresso_geral || 0;
  if (obra.status === 'cancelada' || obra.status === 'pausada') return obra.status;
  if (progresso >= 100) return 'concluida';
  if (progresso > 0) return 'em_andamento';
  return 'planejada';
};

export const obraTemEtapaAtrasada = (obra, hoje = inicioDeHoje()) =>
  Boolean(obra.etapas?.some((etapa) => etapaAtrasada(etapa, hoje)));

// Atrasada: tem etapa atrasada OU a data prevista da obra passou (e não está concluída)
export const obraAtrasada = (obra, hoje = inicioDeHoje()) => {
  const fimObra = parseDataLocal(obra.data_fim_prevista);
  const passouData = Boolean(fimObra && fimObra < hoje);
  return (obraTemEtapaAtrasada(obra, hoje) || passouData) && (obra.progresso_geral || 0) < 100;
};

export const calcularEstatisticasObras = (obras) => {
  const hoje = inicioDeHoje();

  const temAtraso = (obra) => {
    if (!obra.etapas || obra.etapas.length === 0) {
      const fimPrevisto = parseDataLocal(obra.data_fim_prevista);
      return Boolean(fimPrevisto && fimPrevisto < hoje && getStatusReal(obra) !== 'concluida');
    }
    return obraTemEtapaAtrasada(obra, hoje);
  };

  const contagem = { planejada: 0, em_andamento: 0, concluida: 0 };
  let atrasadas = 0;
  obras.forEach((obra) => {
    const status = getStatusReal(obra);
    if (status in contagem) contagem[status] += 1;
    if (status !== 'concluida' && temAtraso(obra)) atrasadas += 1;
  });

  return {
    total: obras.length,
    planejadas: contagem.planejada,
    emAndamento: contagem.em_andamento,
    concluidas: contagem.concluida,
    atrasadas
  };
};

export const calcularDuracaoObra = (dataInicio, dataFim) => {
  const inicio = parseDataLocal(dataInicio);
  const fim = parseDataLocal(dataFim);
  if (!inicio || !fim) return '—';
  const dias = Math.round((fim - inicio) / MS_DIA);
  if (dias < 30) return `${dias} dias`;
  if (dias < 365) return `${Math.round(dias / 30)} meses`;
  return `${(dias / 365).toFixed(1)} anos`;
};

// Monta as etapas de uma obra a partir dos itens do template (cada etapa começa no dia seguinte ao fim da anterior)
export const montarEtapasDoTemplate = (template, obraId, dataInicioISO) => {
  let dataAtual = parseDataLocal(dataInicioISO) ?? inicioDeHoje();

  return (template?.itens ?? []).map((item, i) => {
    const inicio = dataAtual;
    const fim = addDias(inicio, item.duracao_dias || DURACAO_PADRAO_ETAPA_TEMPLATE);
    dataAtual = addDias(fim, 1);

    return {
      obra_id: obraId,
      nome: item.nome,
      descricao: item.descricao,
      tipo: item.tipo,
      data_inicio: dataLocalISO(inicio),
      data_fim: dataLocalISO(fim),
      ordem: i + 1,
      status: 'pendente',
      progresso: 0
    };
  });
};

// ---------------------------------------------------
// Dias úteis (seg–sex, sem feriados) — espelha execucao_dia_util / execucao_add_dias_uteis do banco
// ---------------------------------------------------

// Comparação sem maiúsculas/acentos (mesma ideia de execucao_norm)
export const normalizarTexto = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// `cidade` = { id, uf } da obra (opcional). Nacionais + estaduais da UF (padrão SP) + municipais da cidade.
export const criarCalendario = (feriados = [], cidade = null) => {
  const uf = cidade?.uf || 'SP';
  const datas = new Set();
  feriados.forEach((f) => {
    if (f.considerar_feriado === false) return;
    const vale = f.abrangencia === 'nacional'
      || (f.abrangencia === 'estadual' && f.uf === uf)
      || (f.abrangencia === 'municipal' && cidade?.id && f.cidade_id === cidade.id);
    if (vale) datas.add(String(f.data).slice(0, 10));
  });
  return { feriados: datas, carregado: feriados.length > 0 };
};

export const ehFeriado = (data, calendario) => Boolean(calendario?.feriados?.has(dataLocalISO(data)));

export const ehDiaUtil = (data, calendario) => {
  const diaSemana = data.getDay();
  return diaSemana !== 0 && diaSemana !== 6 && !ehFeriado(data, calendario);
};

export const addDiasUteis = (data, n, calendario) => {
  const passo = n < 0 ? -1 : 1;
  let restante = Math.abs(n);
  let atual = new Date(data);
  for (let guarda = 0; restante > 0 && guarda < 3660; guarda += 1) {
    atual = addDias(atual, passo);
    if (ehDiaUtil(atual, calendario)) restante -= 1;
  }
  return atual;
};

export const proximoDiaUtil = (data, calendario) => (ehDiaUtil(data, calendario) ? data : addDiasUteis(data, 1, calendario));

// Quantidade de dias úteis entre as datas, contando as duas pontas
export const diasUteisEntre = (inicio, fim, calendario) => {
  let total = 0;
  for (let d = new Date(inicio), guarda = 0; d <= fim && guarda < 3660; d = addDias(d, 1), guarda += 1) {
    if (ehDiaUtil(d, calendario)) total += 1;
  }
  return total;
};

// Deslocamento (com sinal) em dias úteis de `de` para `para`
export const deslocamentoUteis = (de, para, calendario) => {
  if (para >= de) return diasUteisEntre(addDias(de, 1), para, calendario);
  return -diasUteisEntre(addDias(para, 1), de, calendario);
};

// Chave estável para itens editáveis que ainda não têm id (itens de template, arquivos)
let sequencia = 0;
export const novaChave = () => `k${Date.now().toString(36)}-${++sequencia}`;

export const chaveArquivo = (file) => `${file.name}-${file.size}-${file.lastModified}`;

// Intervalo do filtro de período do Resumo (semana de domingo a sábado, como a grade da agenda)
export const intervaloFiltroResumo = (filtroPeriodo, hoje = inicioDeHoje()) => {
  switch (filtroPeriodo) {
    case 'semana': {
      const inicio = addDias(hoje, -hoje.getDay());
      return { inicio, fim: addDias(inicio, 6) };
    }
    case 'mes':
      return {
        inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
        fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      };
    case 'trimestre': {
      const trimestre = Math.floor(hoje.getMonth() / 3);
      return {
        inicio: new Date(hoje.getFullYear(), trimestre * 3, 1),
        fim: new Date(hoje.getFullYear(), trimestre * 3 + 3, 0)
      };
    }
    case 'ano':
      return { inicio: new Date(hoje.getFullYear(), 0, 1), fim: new Date(hoje.getFullYear(), 11, 31) };
    default:
      return null;
  }
};

export const rotuloPeriodo = (filtroPeriodo) => {
  const hoje = new Date();
  switch (filtroPeriodo) {
    case 'semana': return 'Esta Semana';
    case 'mes': return hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    case 'trimestre': return `${Math.floor(hoje.getMonth() / 3) + 1}º Trimestre ${hoje.getFullYear()}`;
    case 'ano': return `Ano ${hoje.getFullYear()}`;
    default: return 'Todos os Períodos';
  }
};
