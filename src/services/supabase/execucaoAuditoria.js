import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';
import { mensagemErro } from '../../features/execucao/utils/formatos.js';

const LOTE_REMOCAO_STORAGE = 100;

async function executar(contexto, fn) {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`Erro em ${contexto}:`, error);
    return { success: false, message: mensagemErro(error) };
  }
}

const lerOuFalhar = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// Histórico de alterações (auditoria), desfazer e rotinas de manutenção (lixeira do Storage, retenção).
// Métodos de escrita usam prefixos protegidos (alterar/remover/excluir) para o bloqueio em impersonation.
const _execucaoAuditoriaService = {
  // Lista agrupada por ação; `limite` já deve incluir +1 se o chamador quiser saber se há próxima página
  listarHistoricoAlteracoes({ obraId, usuarioId, tabela, inicio, fim, busca, limite = 26, offset = 0 } = {}) {
    return executar('listarHistoricoAlteracoes', async () =>
      lerOuFalhar(await supabase.rpc('execucao_listar_historico', {
        p_obra: obraId || null,
        p_usuario: usuarioId || null,
        p_tabela: tabela || null,
        p_inicio: inicio || null,
        p_fim: fim || null,
        p_busca: busca?.trim() || null,
        p_limite: limite,
        p_offset: offset,
      })));
  },

  // Linhas de auditoria de uma ação (antes × depois)
  buscarDetalheTransacao(transacao) {
    return executar('buscarDetalheTransacao', async () =>
      lerOuFalhar(await supabase
        .from('execucao_auditoria')
        .select('id, tabela, registro_id, operacao, antes, depois, campos_alterados, usuario_id, created_at, desfeito_em, contexto')
        .eq('transacao', transacao)
        .order('id')));
  },

  // Ação mais recente que mexeu em um registro (usada no "Ver mudança" de um conflito)
  buscarUltimaTransacaoDoRegistro(tabela, registroId) {
    return executar('buscarUltimaTransacaoDoRegistro', async () => {
      const linhas = lerOuFalhar(await supabase
        .from('execucao_auditoria')
        .select('transacao')
        .eq('tabela', tabela)
        .eq('registro_id', String(registroId))
        .order('id', { ascending: false })
        .limit(1));
      return linhas?.[0]?.transacao ?? null;
    });
  },

  buscarObrasResumo() {
    return executar('buscarObrasResumo', async () =>
      lerOuFalhar(await supabase.from('execucao_obras').select('id, nome_cliente').order('nome_cliente')));
  },

  // Desfaz uma ação inteira. Sem `forcar`, devolve { ok: false, conflitos } se houve alteração posterior.
  alterarDesfazerTransacao(transacao, forcar = false) {
    return executar('alterarDesfazerTransacao', async () =>
      lerOuFalhar(await supabase.rpc('execucao_desfazer', { p_transacao: transacao, p_forcar: forcar })));
  },

  buscarLixeiraPendentes(dias = 30) {
    return executar('buscarLixeiraPendentes', async () =>
      lerOuFalhar(await supabase.rpc('execucao_lixeira_pendentes', { p_dias: dias })));
  },

  // Apaga do Storage os arquivos que estão na lixeira há mais de `dias` e confirma no banco só o que sumiu de fato.
  removerArquivosLixeira(dias = 30) {
    return executar('removerArquivosLixeira', async () => {
      const pendentes = lerOuFalhar(await supabase.rpc('execucao_lixeira_pendentes', { p_dias: dias })) ?? [];
      const porBucket = new Map();
      pendentes.forEach((p) => {
        if (!porBucket.has(p.bucket)) porBucket.set(p.bucket, []);
        porBucket.get(p.bucket).push(p.caminho);
      });

      const resultado = { total: pendentes.length, removidos: 0, falhas: [] };
      for (const [bucket, caminhos] of porBucket) {
        for (let i = 0; i < caminhos.length; i += LOTE_REMOCAO_STORAGE) {
          const lote = caminhos.slice(i, i + LOTE_REMOCAO_STORAGE);
          const confirmar = [];
          const { error: erroRemocao } = await supabase.storage.from(bucket).remove(lote);
          if (erroRemocao) {
            resultado.falhas.push(...lote.map((caminho) => ({ bucket, caminho, motivo: erroRemocao.message })));
            continue;
          }
          // A política de Storage pode ignorar a remoção sem erro; só confirma o que não existe mais.
          for (const caminho of lote) {
            const { data: aindaExiste, error: erroExiste } = await supabase.storage.from(bucket).exists(caminho);
            if (erroExiste || aindaExiste) {
              resultado.falhas.push({ bucket, caminho, motivo: erroExiste?.message || 'Arquivo não foi removido' });
            } else {
              confirmar.push(caminho);
            }
          }
          if (confirmar.length) {
            lerOuFalhar(await supabase.rpc('execucao_lixeira_confirmar', { p_bucket: bucket, p_caminhos: confirmar }));
            resultado.removidos += confirmar.length;
          }
        }
      }
      return resultado;
    });
  },

  // Retenção: apaga registros de auditoria mais antigos que `dias` (mínimo de 30 no banco)
  excluirAuditoriaAntiga(dias = 365) {
    return executar('excluirAuditoriaAntiga', async () =>
      lerOuFalhar(await supabase.rpc('execucao_auditoria_limpar', { p_dias: dias })));
  },
};

export const execucaoAuditoriaService = wrapServiceWithImpersonationGuard(_execucaoAuditoriaService, {
  label: 'execucaoAuditoriaService',
});

export default execucaoAuditoriaService;
