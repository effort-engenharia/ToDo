import { supabase } from './config.js';

/**
 * Serviço de configurações globais do sistema.
 * Tabela: public.configuracoes_sistema (chave PK, valor, atualizado_em, atualizado_por)
 */

const TABELA = 'configuracoes_sistema';

/**
 * Lê uma configuração pela chave.
 * @param {string} chave
 * @returns {Promise<{ success: boolean, valor?: string, atualizado_em?: string, atualizado_por?: string, message?: string }>}
 */
async function obterConfiguracao(chave) {
  try {
    const { data, error } = await supabase
      .from(TABELA)
      .select('chave, valor, atualizado_em, atualizado_por')
      .eq('chave', chave)
      .maybeSingle();

    if (error) {
      console.error('[configuracoesService] Erro ao ler configuração:', error);
      return { success: false, message: error.message };
    }

    if (!data) {
      return { success: true, valor: null };
    }

    return {
      success: true,
      valor: data.valor,
      atualizado_em: data.atualizado_em,
      atualizado_por: data.atualizado_por,
    };
  } catch (err) {
    console.error('[configuracoesService] Exceção ao ler configuração:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Grava (upsert) uma configuração.
 * @param {string} chave
 * @param {string} valor
 * @param {string} [atualizadoPor] nome/email do usuário que salvou
 */
async function salvarConfiguracao(chave, valor, atualizadoPor = null) {
  try {
    const payload = {
      chave,
      valor,
      atualizado_em: new Date().toISOString(),
      atualizado_por: atualizadoPor,
    };

    const { data, error } = await supabase
      .from(TABELA)
      .upsert(payload, { onConflict: 'chave' })
      .select()
      .single();

    if (error) {
      console.error('[configuracoesService] Erro ao salvar configuração:', error);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[configuracoesService] Exceção ao salvar configuração:', err);
    return { success: false, message: err.message };
  }
}

// ─── Atalhos para dashboard_layout ────────────────────────────────

const CHAVE_LAYOUT = 'dashboard_layout';
export const LAYOUT_CLASSICO = 'classico';
export const LAYOUT_MODERNO = 'moderno';

/**
 * Retorna o layout salvo. Default: 'classico' se não existir/erro.
 */
async function obterDashboardLayout() {
  const resultado = await obterConfiguracao(CHAVE_LAYOUT);
  if (!resultado.success || !resultado.valor) {
    return { success: true, valor: LAYOUT_CLASSICO };
  }
  return resultado;
}

async function salvarDashboardLayout(valor, atualizadoPor = null) {
  if (valor !== LAYOUT_CLASSICO && valor !== LAYOUT_MODERNO) {
    return { success: false, message: `Layout inválido: ${valor}` };
  }
  return salvarConfiguracao(CHAVE_LAYOUT, valor, atualizadoPor);
}

/**
 * Subscreve a mudanças em tempo real na tabela configuracoes_sistema.
 * Retorna um objeto com .unsubscribe() para limpeza.
 *
 * @param {(payload: { chave: string, valor: string }) => void} callback
 * @returns {{ unsubscribe: () => void }}
 */
function subscribeConfiguracoes(callback) {
  const channel = supabase
    .channel('configuracoes_sistema_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABELA },
      (payload) => {
        const linha = payload.new || payload.old;
        if (linha && callback) {
          callback({ chave: linha.chave, valor: linha.valor });
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.error('[configuracoesService] Erro ao cancelar subscribe:', err);
      }
    },
  };
}

export const configuracoesService = {
  obterConfiguracao,
  salvarConfiguracao,
  obterDashboardLayout,
  salvarDashboardLayout,
  subscribeConfiguracoes,
  CHAVE_LAYOUT,
  LAYOUT_CLASSICO,
  LAYOUT_MODERNO,
};

export default configuracoesService;
