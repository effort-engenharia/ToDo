import { supabase } from './config.js';

// Somente leitura: a RPC devolve apenas status, progresso e datas (sem dados internos da Execução).
// Não usa guard de impersonation porque não escreve nada no banco.

const CANAL = 'execucao-status';
const EVENTO = 'status';

/**
 * Status de execução dos contratos fechados.
 * @param {string[]|null} ids ids de apontamentos; null = todos
 * @returns {Promise<Array>} linhas { apontamento_id, status_execucao, progresso, inicio_previsto, entrega_prevista, entregue_em, saude }
 */
async function buscarStatusContratos(ids = null) {
  const { data, error } = await supabase.rpc('status_execucao_contratos', {
    p_apontamento_ids: ids,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * Escuta (opcional) o broadcast privado de mudança de status. Qualquer falha é silenciosa:
 * o chamador continua funcionando só com a atualização periódica.
 * @param {(payload: {apontamento_id: string, status?: string, progresso?: number}) => void} onEvento
 * @param {(conectado: boolean) => void} [onEstado]
 * @returns {{ unsubscribe: () => void }}
 */
function assinarStatusExecucao(onEvento, onEstado) {
  let canal = null;
  let encerrado = false;

  const limpar = () => {
    if (!canal) return;
    try {
      supabase.removeChannel(canal);
    } catch {
      // ignora
    }
    canal = null;
  };

  (async () => {
    try {
      await supabase.realtime.setAuth();
      if (encerrado) return;
      canal = supabase
        .channel(CANAL, { config: { private: true } })
        .on('broadcast', { event: EVENTO }, (msg) => {
          const payload = msg?.payload;
          if (payload?.apontamento_id) onEvento?.(payload);
        })
        .subscribe((estado) => {
          if (encerrado) return;
          if (estado === 'SUBSCRIBED') {
            onEstado?.(true);
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) {
            onEstado?.(false);
            if (estado !== 'CLOSED') limpar();
          }
        });
    } catch {
      onEstado?.(false);
      limpar();
    }
  })();

  return {
    unsubscribe: () => {
      encerrado = true;
      limpar();
    },
  };
}

export const execucaoStatusComercialService = {
  buscarStatusContratos,
  assinarStatusExecucao,
};

export default execucaoStatusComercialService;
