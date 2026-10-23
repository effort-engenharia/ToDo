import {
  FaBolt,
  FaBuilding,
  FaHardHat,
  FaTasks,
  FaWarehouse,
  FaWrench
} from 'react-icons/fa';

// Ícone + cor por tipo de etapa
export const ICONE_TIPO_ETAPA = {
  eletrica: { Icone: FaBolt, cor: 'text-yellow-400' },
  civil: { Icone: FaHardHat, cor: 'text-orange-400' },
  galpao: { Icone: FaWarehouse, cor: 'text-purple-400' },
  administrativo: { Icone: FaTasks, cor: 'text-green-400' },
  geral: { Icone: FaTasks, cor: 'text-blue-400' }
};

// Ícone + cor por tipo de obra
export const ICONE_TIPO_OBRA = {
  eletrica: { Icone: FaBolt, cor: 'text-yellow-400' },
  civil: { Icone: FaHardHat, cor: 'text-orange-400' },
  galpao: { Icone: FaWarehouse, cor: 'text-purple-400' },
  padrao: { Icone: FaBuilding, cor: 'text-blue-400' }
};

// Ícones selecionáveis nos templates (valor salvo no banco = nome da chave)
export const ICONES_TEMPLATE = {
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaWrench,
  FaTasks
};

export const TIPO_BADGE_COR = {
  eletrica: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  civil: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  galpao: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  administrativo: 'bg-green-500/20 text-green-300 border-green-500/30',
  padrao: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
};

// Cores das etapas na agenda (baseado no tipo)
export const TIPO_COR_AGENDA = {
  eletrica: 'bg-yellow-500 border-yellow-400',
  civil: 'bg-orange-500 border-orange-400',
  galpao: 'bg-purple-500 border-purple-400',
  administrativo: 'bg-green-500 border-green-400',
  padrao: 'bg-blue-500 border-blue-400'
};

export const STATUS_OBRA_COR = {
  planejada: 'blue',
  em_andamento: 'yellow',
  concluida: 'green',
  pausada: 'orange',
  cancelada: 'red'
};

export const STATUS_OBRA_LABEL = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
  cancelada: 'Cancelada'
};

export const PRIORIDADE_COR = {
  baixa: 'text-blue-400',
  media: 'text-yellow-400',
  alta: 'text-orange-400',
  urgente: 'text-red-400'
};

export const LEGENDA_TIPOS = [
  { chave: 'eletrica', cor: 'bg-yellow-500', label: 'Elétrica' },
  { chave: 'civil', cor: 'bg-orange-500', label: 'Civil' },
  { chave: 'galpao', cor: 'bg-purple-500', label: 'Galpão' },
  { chave: 'geral', cor: 'bg-blue-500', label: 'Geral' },
  { chave: 'administrativo', cor: 'bg-green-500', label: 'Administrativo' }
];

export const DIAS_SEMANA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const DURACAO_PADRAO_ETAPA_TEMPLATE = 3;

export const FORM_OBRA_VAZIO = {
  nome_cliente: '',
  endereco: '',
  cidade: '',
  data_inicio_prevista: '',
  data_fim_prevista: '',
  tipo_obra: 'misto',
  prioridade: 'media',
  responsavel_id: '',
  observacoes: '',
  contato_cliente: '',
  apontamento_id: '',
  arquivos_pdf: [],
  template_id: ''
};

export const FORM_ETAPA_VAZIO = {
  nome: '',
  descricao: '',
  tipo: 'geral',
  data_inicio: '',
  data_fim: '',
  responsavel_id: '',
  ordem: 0,
  etapa_pai_id: null
};

export const FORM_ATIVIDADE_VAZIO = {
  titulo: '',
  descricao: '',
  data_programada: '',
  hora_inicio: '08:00',
  hora_fim: '17:00',
  prioridade: 'normal',
  tecnico_responsavel_id: '',
  observacoes: ''
};

export const FORM_TEMPLATE_VAZIO = {
  nome: '',
  descricao: '',
  tipo_obra: 'eletrica',
  icone: 'FaBolt',
  cor: '#eab308',
  ativo: true,
  itens: []
};
