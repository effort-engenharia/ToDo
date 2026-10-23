import { listarOutbox } from './outbox';

// Aplica por cima de uma lista de atividades (da rede ou do cache) o efeito das ações ainda na fila,
// para o cartão já mostrar o novo status e "pendente de envio". Ações com erro definitivo não entram:
// o que vale é o estado do servidor.
const aplicarItem = (atividade, item) => {
  const p = item.payload || {};
  if (item.tipo === 'status') {
    return {
      ...atividade,
      status: p.status,
      ...(p.status === 'pausada' && p.solicitaReplanejamento ? { solicita_replanejamento: true } : {}),
      ...(p.status === 'concluida' && p.horasRealizadas != null ? { horas_realizadas: p.horasRealizadas } : {})
    };
  }
  if (item.tipo === 'falta_material' && p.pausar) return { ...atividade, status: 'pausada' };
  return atividade;
};

export const sobreporPendencias = (atividades, itens) => {
  if (!itens.length || !atividades?.length) return atividades;
  const porAtividade = new Map();
  for (const item of itens) {
    if (item.estado === 'erro') continue;
    if (!porAtividade.has(item.atividadeId)) porAtividade.set(item.atividadeId, []);
    porAtividade.get(item.atividadeId).push(item);
  }
  if (!porAtividade.size) return atividades;
  return atividades.map((a) => {
    const fila = porAtividade.get(a.id);
    return fila ? { ...fila.reduce(aplicarItem, a), pendente_envio: true } : a;
  });
};

export const aplicarPendencias = async (usuarioId, atividades) => {
  try {
    return sobreporPendencias(atividades, await listarOutbox(usuarioId));
  } catch (erro) {
    console.warn('Não foi possível ler a fila offline:', erro);
    return atividades;
  }
};
