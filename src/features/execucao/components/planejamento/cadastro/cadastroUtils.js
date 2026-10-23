import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import { DURACAO_PADRAO_ETAPA_TEMPLATE } from '../constants';
import {
  addDiasUteis,
  deslocamentoUteis,
  diasUteisEntre,
  normalizarTexto,
  proximoDiaUtil
} from '../utils';

export const formatarMoeda = (valor) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};

// 'vencido' (início já passou) | 'proximo' (próximos 7 dias) | null
export const classePrazoContrato = (inicioISO, hojeISO = dataLocalISO()) => {
  if (!inicioISO) return null;
  const inicio = String(inicioISO).slice(0, 10);
  if (inicio < hojeISO) return 'vencido';
  const limite = dataLocalISO(addDias(parseDataLocal(hojeISO), 7));
  return inicio <= limite ? 'proximo' : null;
};

// Preenche o formulário da obra a partir de um contrato (linha da RPC execucao_contratos_pendentes)
export const camposDoContrato = (contrato) => ({
  nome_cliente: contrato.nome_cliente || '',
  endereco: [contrato.logradouro, contrato.numero, contrato.bairro].filter(Boolean).join(', '),
  cidade: contrato.cidade || '',
  cidade_id: contrato.cidade_id || '',
  data_inicio_prevista: contrato.cronograma_data_inicio || '',
  data_fim_prevista: contrato.cronograma_data_termino || '',
  contato_cliente: contrato.contato_cliente || '',
  apontamento_id: contrato.id || '',
  valor_contrato: contrato.valor_total_servico ?? '',
  tipo_servico_codigo: contrato.tipo_servico_codigo || ''
});

export const resolverCidade = (nome, cidades) => {
  const alvo = normalizarTexto(nome);
  return alvo ? cidades.find((c) => normalizarTexto(c.nome) === alvo) ?? null : null;
};

// Template do tipo de serviço: o padrão configurado, o vinculado ao tipo ou o de mesmo tipo de obra
export const sugerirTemplate = (tipoServico, templates) => {
  if (!tipoServico) return null;
  const ativos = templates.filter((t) => t.ativo);
  return ativos.find((t) => t.id === tipoServico.template_padrao_id)
    ?? ativos.find((t) => t.tipo_servico_codigo === tipoServico.codigo)
    ?? ativos.find((t) => t.tipo_obra === tipoServico.codigo)
    ?? null;
};

// ---------------------------------------------------
// Prévia das etapas
// ---------------------------------------------------

const linhaPrevia = (item, indice, responsavelId) => ({
  _chave: `p${indice}-${item.id ?? item.nome}`,
  nome: item.nome || '',
  descricao: item.descricao || '',
  tipo: item.tipo || 'geral',
  ordem: indice + 1,
  duracao_dias: Math.max(1, item.duracao_dias || DURACAO_PADRAO_ETAPA_TEMPLATE),
  horas_previstas: item.horas_previstas ?? '',
  qtd_tecnicos: item.qtd_tecnicos || 1,
  pop_id: item.pop_id || null,
  data_inicio: '',
  data_fim: '',
  lider_id: item.tipo === 'estoque' ? '' : (responsavelId || ''),
  apoio_ids: [],
  progresso: 0
});

// Cada etapa começa no dia útil seguinte ao fim da anterior; a duração é em dias úteis (1 dia = início e fim no mesmo dia)
export const recalcularDatasPrevia = (etapas, inicioISO, calendario) => {
  let cursor = parseDataLocal(inicioISO);
  if (!cursor) return etapas;
  return etapas.map((etapa) => {
    const inicio = proximoDiaUtil(cursor, calendario);
    const fim = addDiasUteis(inicio, Math.max(1, etapa.duracao_dias) - 1, calendario);
    cursor = addDias(fim, 1);
    return { ...etapa, data_inicio: dataLocalISO(inicio), data_fim: dataLocalISO(fim) };
  });
};

export const gerarEtapasPrevia = (template, { inicioISO, calendario, responsavelId }) => {
  if (!template?.itens?.length || !parseDataLocal(inicioISO)) return [];
  const linhas = template.itens.map((item, i) => linhaPrevia(item, i, responsavelId));
  return recalcularDatasPrevia(linhas, inicioISO, calendario);
};

// Mudar o início preserva a duração; mudar o fim altera a duração. As etapas seguintes deslocam pelo mesmo nº de dias úteis
export const editarDataPrevia = (etapas, indice, campo, valorISO, calendario) => {
  const nova = parseDataLocal(valorISO);
  const atual = etapas[indice];
  if (!nova || !atual) return etapas;

  let inicio = parseDataLocal(atual.data_inicio);
  let fim = parseDataLocal(atual.data_fim);
  const fimAntes = fim;

  if (campo === 'data_inicio') {
    const duracao = Math.max(1, diasUteisEntre(inicio, fim, calendario));
    inicio = nova;
    fim = addDiasUteis(proximoDiaUtil(inicio, calendario), duracao - 1, calendario);
  } else {
    fim = nova < inicio ? inicio : nova;
  }

  const delta = deslocamentoUteis(fimAntes, fim, calendario);
  return etapas.map((etapa, i) => {
    if (i === indice) {
      return {
        ...etapa,
        data_inicio: dataLocalISO(inicio),
        data_fim: dataLocalISO(fim),
        duracao_dias: Math.max(1, diasUteisEntre(inicio, fim, calendario))
      };
    }
    if (i < indice || delta === 0) return etapa;
    return {
      ...etapa,
      data_inicio: dataLocalISO(addDiasUteis(parseDataLocal(etapa.data_inicio), delta, calendario)),
      data_fim: dataLocalISO(addDiasUteis(parseDataLocal(etapa.data_fim), delta, calendario))
    };
  });
};

export const terminoPrevisto = (etapas) => etapas.reduce((max, e) => (e.data_fim && e.data_fim > max ? e.data_fim : max), '');

// Situação da etapa numa obra que já está em andamento: o que terminou antes de hoje está concluído; a etapa de hoje está em andamento
export const situacaoAndamento = (etapa, hojeISO) => {
  if (!etapa.data_inicio || !etapa.data_fim) return 'pendente';
  if (etapa.data_fim < hojeISO) return 'concluida';
  if (etapa.data_inicio <= hojeISO) return 'em_andamento';
  return 'pendente';
};

export const validarEtapasPrevia = (etapas) => {
  for (const [i, etapa] of etapas.entries()) {
    if (!etapa.nome?.trim()) return `Informe o nome da etapa ${i + 1}.`;
    if (!etapa.data_inicio || !etapa.data_fim) return `Informe as datas da etapa "${etapa.nome}".`;
    if (etapa.data_fim < etapa.data_inicio) return `A etapa "${etapa.nome}" termina antes de começar.`;
  }
  return null;
};

// Equipe no formato do banco: líder em responsavel_id; equipe_ids = líder + apoios
export const equipeDaLinha = (liderId, apoioIds = []) => {
  const apoios = apoioIds.filter((id) => id && id !== liderId);
  return { responsavel_id: liderId || null, equipe_ids: liderId ? [liderId, ...apoios] : apoios };
};

// Linhas da prévia → jsonb p_etapas de criar_obra_completa
export const etapasParaPayload = (etapas, { andamento = false, hojeISO = dataLocalISO() } = {}) =>
  etapas.map((etapa, i) => {
    const situacao = andamento ? situacaoAndamento(etapa, hojeISO) : 'pendente';
    const equipe = etapa.tipo === 'estoque'
      ? { responsavel_id: null, equipe_ids: [] }
      : equipeDaLinha(etapa.lider_id, etapa.apoio_ids);
    let progresso = 0;
    if (situacao === 'concluida') progresso = 100;
    else if (situacao === 'em_andamento') progresso = Math.min(99, Math.max(0, Number(etapa.progresso) || 0));

    return {
      nome: etapa.nome.trim(),
      descricao: etapa.descricao || '',
      tipo: etapa.tipo,
      data_inicio: etapa.data_inicio,
      data_fim: etapa.data_fim,
      ordem: i + 1,
      ...equipe,
      horas_previstas: etapa.horas_previstas === '' || etapa.horas_previstas == null ? '' : String(etapa.horas_previstas),
      qtd_tecnicos: Math.max(1, parseInt(etapa.qtd_tecnicos, 10) || 1),
      pop_id: etapa.pop_id || '',
      status: situacao,
      progresso,
      data_inicio_real: situacao === 'pendente' ? '' : etapa.data_inicio,
      data_fim_real: situacao === 'concluida' ? etapa.data_fim : ''
    };
  });

// Obra "já em andamento": entra como em_andamento quando alguma etapa já começou
export const statusObraAndamento = (etapas, hojeISO = dataLocalISO()) => {
  const iniciadas = etapas.filter((e) => situacaoAndamento(e, hojeISO) !== 'pendente');
  if (!iniciadas.length) return { status: 'planejada', data_inicio_real: '' };
  return { status: 'em_andamento', data_inicio_real: iniciadas.map((e) => e.data_inicio).sort()[0] };
};

// Tipo da etapa/atividade de um serviço rápido a partir do tipo de obra do serviço
export const tipoEtapaDoTipoObra = (tipoObra) => (['eletrica', 'civil', 'galpao'].includes(tipoObra) ? tipoObra : 'eletrica');
