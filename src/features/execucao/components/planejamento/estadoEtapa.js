import { parseDataLocal } from '../../utils/datas';
import { etapaAtrasada } from './utils';

const MS_DIA = 1000 * 60 * 60 * 24;

// Passos (sub-etapas) em aberto de uma etapa pai cuja atividade já foi concluída. O número vem do servidor
// (RPC execucao_passos_pendentes_por_etapa, em `passosPorEtapa` indexado por etapa_id): quem define se o pai está
// concluído é o servidor, e o cliente nunca infere concluída por sub-etapa. Sem dados, devolve 0 (sem selo).
export const passosPendentesDaEtapa = (passosPorEtapa, etapaId) =>
  Number(passosPorEtapa?.[etapaId]?.passos_pendentes) || 0;

// Estado da etapa em texto + emoji (o estado nunca depende só da cor)
export const estadoEtapa = (etapa, hoje) => {
  const progresso = etapa.progresso || 0;
  if (progresso >= 100 || etapa.status === 'concluida') return { id: 'concluida', emoji: '✅', rotulo: 'Concluída', diasAtraso: 0 };

  if (etapaAtrasada(etapa, hoje) || etapa.status === 'atrasada') {
    const fim = parseDataLocal(etapa.data_fim);
    const diasAtraso = fim ? Math.max(1, Math.ceil((hoje - fim) / MS_DIA)) : 0;
    return {
      id: 'atrasada',
      emoji: '🔴',
      rotulo: diasAtraso ? `Atrasada · ${diasAtraso} d` : 'Atrasada',
      diasAtraso
    };
  }
  if (etapa.status === 'em_andamento') return { id: 'em_andamento', emoji: '🔵', rotulo: 'Em andamento', diasAtraso: 0 };
  if (etapa.status === 'pausada') return { id: 'pausada', emoji: '🟠', rotulo: 'Pausada', diasAtraso: 0 };
  return { id: 'planejada', emoji: '⚪', rotulo: 'Planejada', diasAtraso: 0 };
};
