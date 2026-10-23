// Motivos padronizados de pausa (gravados em execucao_atividades_historico.motivo_codigo)
export const MOTIVOS_PAUSA = [
  { codigo: 'falta_material', rotulo: 'Falta de material' },
  { codigo: 'cliente_ausente', rotulo: 'Cliente ausente / sem acesso' },
  { codigo: 'clima', rotulo: 'Chuva / clima' },
  { codigo: 'aguardando_equipe', rotulo: 'Aguardando outra equipe' },
  { codigo: 'problema_tecnico', rotulo: 'Problema técnico' },
  { codigo: 'outro', rotulo: 'Outro' }
];

export const rotuloMotivoPausa = (codigo) => MOTIVOS_PAUSA.find((m) => m.codigo === codigo)?.rotulo ?? null;
