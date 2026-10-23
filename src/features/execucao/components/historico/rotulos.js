import { formatarDataHora } from '../../utils/formatos';
import { formatarDataBR } from '../../utils/datas';

export const TABELAS = {
  execucao_obras: { plural: 'Obras', artigo: 'a obra' },
  execucao_obras_etapas: { plural: 'Etapas', artigo: 'a etapa' },
  execucao_atividades: { plural: 'Atividades', artigo: 'a atividade' },
  execucao_atividades_equipe: { plural: 'Equipe da atividade', artigo: 'a equipe da atividade' },
  execucao_atividades_evidencias: { plural: 'Evidências', artigo: 'a evidência' },
  execucao_pedidos_material: { plural: 'Pedidos de material', artigo: 'o pedido de material' },
  execucao_pops: { plural: 'POPs', artigo: 'o POP' },
  execucao_pops_arquivos: { plural: 'Arquivos de POP', artigo: 'o arquivo de POP' },
  execucao_obras_arquivos: { plural: 'Arquivos de obra', artigo: 'o arquivo da obra' },
  execucao_templates_etapas: { plural: 'Templates', artigo: 'o template' },
  execucao_templates_etapas_itens: { plural: 'Itens de template', artigo: 'o item de template' },
  execucao_templates_materiais: { plural: 'Templates de materiais', artigo: 'o template de materiais' },
  execucao_planejamento_macro: { plural: 'Planejamento macro', artigo: 'o planejamento macro' },
  execucao_jornadas_modelo: { plural: 'Modelos de jornada', artigo: 'o modelo de jornada' },
  execucao_ausencias: { plural: 'Ausências', artigo: 'a ausência' },
  execucao_horas_extras: { plural: 'Horas extras', artigo: 'o registro de hora extra' },
  execucao_feriados: { plural: 'Feriados', artigo: 'o feriado' },
  execucao_cidades: { plural: 'Cidades', artigo: 'a cidade' },
};

export const rotuloTabela = (tabela) => TABELAS[tabela]?.plural ?? tabela;
export const artigoTabela = (tabela) => TABELAS[tabela]?.artigo ?? 'um registro';

export const OPERACOES = {
  INSERT: { rotulo: 'Criação', classe: 'execucao-badge-green' },
  UPDATE: { rotulo: 'Alteração', classe: 'execucao-badge-blue' },
  DELETE: { rotulo: 'Exclusão', classe: 'execucao-badge-red' },
};

const CAMPOS = {
  data_inicio: 'início',
  data_fim: 'fim',
  data_programada: 'data',
  data_inicio_prevista: 'início previsto',
  data_fim_prevista: 'fim previsto',
  data_inicio_real: 'início real',
  data_fim_real: 'fim real',
  tecnico_responsavel_id: 'técnico',
  responsavel_id: 'responsável',
  nome_cliente: 'cliente',
  horas_previstas: 'horas previstas',
  horas_realizadas: 'horas realizadas',
  horas_ajustadas: 'horas ajustadas',
  qtd_tecnicos: 'nº de técnicos',
  tipo_execucao: 'tipo',
  hora_inicio: 'hora de início',
  hora_fim: 'hora de fim',
  usuario_id: 'colaborador',
  registrado_por: 'registrado por',
  decidido_por: 'decidido por',
  justificativa_decisao: 'justificativa da decisão',
  vigente_desde: 'vigente desde',
  periodos: 'horários',
  descontos: 'descontos',
  horas_extra_max_dia: 'hora extra máxima/dia',
  considerar_feriado: 'considerar feriado',
  created_by: 'criado por',
};

export const rotuloCampo = (campo) => CAMPOS[campo] ?? campo.replace(/_id$/, '').replace(/_/g, ' ');

// Campos que guardam o id de um usuário (exibidos com o nome, quando conhecido)
const CAMPOS_USUARIO = new Set(['tecnico_responsavel_id', 'responsavel_id', 'usuario_id', 'registrado_por', 'decidido_por', 'created_by']);
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const formatarValor = (campo, valor, nomesUsuarios) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (CAMPOS_USUARIO.has(campo)) return nomesUsuarios?.get(valor) ?? 'Usuário';
  if (typeof valor === 'string') {
    if (RE_DATA.test(valor)) return formatarDataBR(valor);
    if (RE_TIMESTAMP.test(valor)) return formatarDataHora(valor, { comAno: true });
    return valor.length > 160 ? `${valor.slice(0, 160)}…` : valor;
  }
  if (typeof valor === 'object') {
    const texto = JSON.stringify(valor);
    return texto.length > 160 ? `${texto.slice(0, 160)}…` : texto;
  }
  return String(valor);
};

// Campos sem interesse para o leitor ao listar uma criação/exclusão
// valor_contrato: o módulo Execução não exibe valores de contrato/serviço
export const CAMPOS_OCULTOS = new Set(['id', 'created_at', 'updated_at', 'caminho_storage', 'caminho_miniatura', 'valor_contrato']);
