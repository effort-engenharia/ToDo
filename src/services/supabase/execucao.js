import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';
import {
  dataLocalISO,
  inicioDoDiaISO,
  intervaloSemana,
  intervaloPeriodo,
  intervaloPeriodoAnterior,
} from '../../features/execucao/utils/datas.js';

const PAGE_SIZE = 1000;

// O PostgREST limita cada resposta (~1000 linhas) sem avisar; percorre todas as páginas.
// `buildQuery` deve devolver uma query nova a cada chamada.
async function fetchAll(buildQuery, maxPages = 20) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const BUCKET_OBRAS = 'obras-arquivos';
const BUCKET_POPS = 'pops-arquivos';
const URL_ASSINADA_SEGUNDOS = 3600;

// Métodos do serviço de execução. Um Proxy no final adiciona bloqueio
// automático de operações de escrita quando o admin está impersonando.
const _execucaoService = {
  // ==========================================
  // ATIVIDADES
  // ==========================================

  // Buscar todas as atividades
  async buscarAtividades(filtros = {}) {
    try {
      const data = await fetchAll(() => {
        let query = supabase
          .from('execucao_atividades')
          .select(`
            *,
            tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
            criador:usuarios!created_by(id, nome_completo)
          `)
          .order('data_programada', { ascending: true })
          .order('hora_inicio', { ascending: true })
          .order('id', { ascending: true });

        if (filtros.tipo_execucao) query = query.eq('tipo_execucao', filtros.tipo_execucao);
        if (filtros.status) query = query.eq('status', filtros.status);
        if (filtros.tecnico_id) query = query.eq('tecnico_responsavel_id', filtros.tecnico_id);
        if (filtros.data_inicio) query = query.gte('data_programada', filtros.data_inicio);
        if (filtros.data_fim) query = query.lte('data_programada', filtros.data_fim);
        if (filtros.data_programada) query = query.eq('data_programada', filtros.data_programada);
        return query;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar atividades do dia
  async buscarAtividadesDoDia(data = null) {
    const hoje = data || dataLocalISO();
    return this.buscarAtividades({ data_programada: hoje });
  },

  // Atividades de um técnico: 'hoje' | 'semana' (seg-dom) | 'todas'
  async buscarAtividadesTecnico(tecnicoId, periodo = 'hoje') {
    try {
      let query = supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email)
        `)
        .eq('tecnico_responsavel_id', tecnicoId)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true, nullsFirst: false });

      if (periodo === 'hoje') {
        query = query.eq('data_programada', dataLocalISO());
      } else if (periodo === 'semana') {
        const { inicio, fim } = intervaloSemana();
        query = query.gte('data_programada', inicio).lte('data_programada', fim);
      } else {
        query = query.limit(500);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao buscar atividades do técnico:', error);
      return { success: false, message: error.message, data: [] };
    }
  },

  // Buscar atividades pausadas com justificativas (do histórico)
  async buscarAtividadesPausadas() {
    try {
      const { data: atividades, error } = await supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
          criador:usuarios!created_by(id, nome_completo)
        `)
        .eq('status', 'pausada')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!atividades.length) return { success: true, data: [] };

      // Uma única consulta para todas as pausas; a mais recente de cada atividade prevalece
      const { data: historico, error: histError } = await supabase
        .from('execucao_atividades_historico')
        .select(`
          *,
          usuario:usuarios(id, nome_completo)
        `)
        .in('atividade_id', atividades.map(a => a.id))
        .eq('tipo_acao', 'pausa')
        .order('created_at', { ascending: false });

      if (histError) throw histError;

      const ultimaPausa = new Map();
      for (const h of historico ?? []) {
        if (!ultimaPausa.has(h.atividade_id)) ultimaPausa.set(h.atividade_id, h);
      }

      return {
        success: true,
        data: atividades.map(a => ({ ...a, pausa_info: ultimaPausa.get(a.id) || null }))
      };
    } catch (error) {
      console.error('Erro ao buscar atividades pausadas:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar atividades do dia + atrasadas (pendentes de dias anteriores) + concluídas hoje
  async buscarAtividadesDoDiaComAtrasadas(data = null) {
    try {
      const hoje = data || dataLocalISO();
      const inicioHoje = inicioDoDiaISO(hoje);

      const atividades = await fetchAll(() => supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
          criador:usuarios!created_by(id, nome_completo)
        `)
        .or(`data_programada.eq.${hoje},and(data_programada.lt.${hoje},status.in.(pendente,em_andamento,pausada)),and(status.eq.concluida,updated_at.gte.${inicioHoje})`)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .order('id', { ascending: true }));

      return { success: true, data: atividades };
    } catch (error) {
      console.error('Erro ao buscar atividades do dia com atrasadas:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar atividades da semana do técnico
  async buscarAtividadesSemana(tecnicoId, dataInicio, dataFim) {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
          criador:usuarios!created_by(id, nome_completo)
        `)
        .eq('tecnico_responsavel_id', tecnicoId)
        .gte('data_programada', dataInicio)
        .lte('data_programada', dataFim)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar atividades da semana:', error);
      return { success: false, message: error.message };
    }
  },

  // Criar atividade
  async criarAtividade(atividade, usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades')
        .insert([{
          ...atividade,
          created_by: usuarioId
        }])
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;

      const historico = await this.registrarHistorico(data.id, usuarioId, 'criacao', 'Atividade criada');

      return { success: true, data, ...(historico.success ? {} : { warning: historico.message }) };
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar atividade
  async atualizarAtividade(id, atualizacoes, usuarioId) {
    try {
      const { data: atividadeAtual, error: atualError } = await supabase
        .from('execucao_atividades')
        .select('*')
        .eq('id', id)
        .single();

      if (atualError) throw atualError;

      const { data, error } = await supabase
        .from('execucao_atividades')
        .update({
          ...atualizacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;

      // Um único insert com todas as alterações
      const alteracoes = Object.entries(atualizacoes)
        .filter(([campo, valorNovo]) => atividadeAtual[campo] !== valorNovo)
        .map(([campo, valorNovo]) => ({
          atividade_id: id,
          usuario_id: usuarioId,
          tipo_acao: 'edicao',
          descricao: `Campo ${campo} alterado`,
          valor_anterior: atividadeAtual[campo]?.toString() ?? null,
          valor_novo: valorNovo?.toString() ?? null
        }));

      let warning;
      if (alteracoes.length) {
        const { error: histError } = await supabase.from('execucao_atividades_historico').insert(alteracoes);
        if (histError) {
          console.error('Erro ao registrar histórico:', histError);
          warning = histError.message;
        }
      }

      return { success: true, data, ...(warning ? { warning } : {}) };
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Alterar status da atividade (RPC transacional: status + histórico + notificação + etapa vinculada)
  async alterarStatusAtividade(id, novoStatus, _usuarioId, motivo = null) {
    try {
      const { data, error } = await supabase.rpc('alterar_status_atividade', {
        p_id: id,
        p_status: novoStatus,
        p_motivo: motivo
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      return { success: false, message: error.message };
    }
  },

  // Transferir atividade para outro técnico
  async transferirAtividade(id, novoTecnicoId, usuarioId, motivo = '') {
    try {
      const { data: atividadeAtual, error: atualError } = await supabase
        .from('execucao_atividades')
        .select('tecnico_responsavel_id')
        .eq('id', id)
        .single();

      if (atualError) throw atualError;

      const { data, error } = await supabase
        .from('execucao_atividades')
        .update({
          tecnico_responsavel_id: novoTecnicoId,
          status: 'transferida',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;

      const historico = await this.registrarHistorico(id, usuarioId, 'transferencia', motivo || 'Atividade transferida', atividadeAtual.tecnico_responsavel_id, novoTecnicoId);

      return { success: true, data, ...(historico.success ? {} : { warning: historico.message }) };
    } catch (error) {
      console.error('Erro ao transferir atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir atividade
  async excluirAtividade(id) {
    try {
      const { error } = await supabase
        .from('execucao_atividades')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // HISTÓRICO
  // ==========================================

  async registrarHistorico(atividadeId, usuarioId, tipoAcao, descricao, valorAnterior = null, valorNovo = null) {
    try {
      const { error } = await supabase
        .from('execucao_atividades_historico')
        .insert([{
          atividade_id: atividadeId,
          usuario_id: usuarioId,
          tipo_acao: tipoAcao,
          descricao,
          valor_anterior: valorAnterior,
          valor_novo: valorNovo
        }]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
      return { success: false, message: error.message };
    }
  },

  // Alias usado pelos componentes
  async buscarHistoricoAtividade(atividadeId) {
    return this.buscarHistorico(atividadeId);
  },

  // Alias usado pelos componentes
  async buscarComentariosAtividade(atividadeId) {
    return this.buscarComentarios(atividadeId);
  },

  async buscarHistorico(atividadeId) {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades_historico')
        .select(`
          *,
          usuario:usuarios(id, nome_completo)
        `)
        .eq('atividade_id', atividadeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // COMENTÁRIOS
  // ==========================================

  async adicionarComentario(atividadeId, usuarioId, comentario) {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades_comentarios')
        .insert([{
          atividade_id: atividadeId,
          usuario_id: usuarioId,
          comentario
        }])
        .select(`
          *,
          usuario:usuarios(id, nome_completo)
        `)
        .single();

      if (error) throw error;

      // Registrar no histórico
      await this.registrarHistorico(atividadeId, usuarioId, 'comentario', comentario);

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarComentarios(atividadeId) {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades_comentarios')
        .select(`
          *,
          usuario:usuarios(id, nome_completo)
        `)
        .eq('atividade_id', atividadeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar comentários:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // PEDIDOS DE MATERIAL
  // ==========================================

  async buscarPedidosMaterial(filtros = {}) {
    try {
      const data = await fetchAll(() => {
        let query = supabase
          .from('execucao_pedidos_material')
          .select(`
            *,
            solicitante:usuarios!solicitante_id(id, nome_completo),
            aprovador:usuarios!aprovado_por(id, nome_completo),
            atividade:execucao_atividades(id, titulo)
          `)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });

        if (filtros.status) query = query.eq('status', filtros.status);
        if (filtros.solicitante_id) query = query.eq('solicitante_id', filtros.solicitante_id);
        return query;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar pedidos de material:', error);
      return { success: false, message: error.message };
    }
  },

  async criarPedidoMaterial(pedido, usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_pedidos_material')
        .insert([{
          ...pedido,
          solicitante_id: usuarioId
        }])
        .select(`
          *,
          solicitante:usuarios!solicitante_id(id, nome_completo)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar pedido de material:', error);
      return { success: false, message: error.message };
    }
  },

  async atualizarStatusPedido(id, status, usuarioId) {
    try {
      const updates = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'aprovado' || status === 'recusado') {
        updates.aprovado_por = usuarioId;
        updates.data_aprovacao = new Date().toISOString();
      }
      if (status === 'entregue') {
        updates.data_entrega = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('execucao_pedidos_material')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      return { success: false, message: error.message };
    }
  },

  async atualizarPedidoMaterial(id, dados) {
    try {
      const { data, error } = await supabase
        .from('execucao_pedidos_material')
        .update({
          ...dados,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          solicitante:usuarios!solicitante_id(id, nome_completo)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar pedido de material:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirPedidoMaterial(id) {
    try {
      const { error } = await supabase
        .from('execucao_pedidos_material')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir pedido de material:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // HISTÓRICO DE PEDIDOS
  // ==========================================

  async registrarHistoricoPedido(pedidoId, dados, usuario) {
    try {
      const { data, error } = await supabase
        .from('execucao_historico_pedidos')
        .insert([{
          pedido_id: pedidoId,
          usuario_id: usuario?.id || null,
          usuario_nome: usuario?.nome_completo || 'Sistema',
          tipo_alteracao: dados.tipo_alteracao,
          descricao: dados.descricao,
          dados_anteriores: dados.dados_anteriores || null,
          dados_novos: dados.dados_novos || null,
          data_limite_anterior: dados.data_limite_anterior || null,
          data_limite_nova: dados.data_limite_nova || null,
          motivo: dados.motivo || null
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarHistoricoPedido(pedidoId) {
    try {
      const { data, error } = await supabase
        .from('execucao_historico_pedidos')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('data_alteracao', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // TEMPLATES DE MATERIAIS
  // ==========================================

  async buscarTemplatesMateriais(filtros = {}) {
    try {
      let query = supabase
        .from('execucao_templates_materiais')
        .select('*')
        .eq('ativo', true)
        .order('tipo_servico', { ascending: true })
        .order('nome', { ascending: true });

      if (filtros.tipo_servico) {
        query = query.eq('tipo_servico', filtros.tipo_servico);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar templates de materiais:', error);
      return { success: false, message: error.message };
    }
  },

  async criarTemplateMaterial(template, usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_templates_materiais')
        .insert([{
          ...template,
          created_by: usuarioId
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar template de material:', error);
      return { success: false, message: error.message };
    }
  },

  async atualizarTemplateMaterial(id, dados) {
    try {
      const { data, error } = await supabase
        .from('execucao_templates_materiais')
        .update({
          ...dados,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar template de material:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirTemplateMaterial(id) {
    try {
      // Soft delete - apenas desativa
      const { error } = await supabase
        .from('execucao_templates_materiais')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir template de material:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // POPs
  // ==========================================

  async buscarPOPs(filtros = {}) {
    try {
      let query = supabase
        .from('execucao_pops')
        .select(`
          *,
          criador:usuarios!created_by(id, nome_completo),
          arquivos:execucao_pops_arquivos(*)
        `)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false });

      if (filtros.categoria) {
        query = query.eq('categoria', filtros.categoria);
      }
      if (filtros.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Bucket privado: gera URLs assinadas em lote para todos os anexos
      const caminhos = data.flatMap(p => (p.arquivos ?? []).map(a => a.caminho_storage));
      const urls = new Map();
      if (caminhos.length) {
        const { data: assinadas } = await supabase.storage
          .from(BUCKET_POPS)
          .createSignedUrls(caminhos, URL_ASSINADA_SEGUNDOS);
        for (const s of assinadas ?? []) {
          if (s.signedUrl) urls.set(s.path, s.signedUrl);
        }
      }

      const normalizados = data.map(p => ({
        ...p,
        tags: Array.isArray(p.tags) ? p.tags : [],
        arquivos: (p.arquivos ?? []).map(a => ({ ...a, url: urls.get(a.caminho_storage) ?? null }))
      }));

      return { success: true, data: normalizados };
    } catch (error) {
      console.error('Erro ao buscar POPs:', error);
      return { success: false, message: error.message };
    }
  },

  // Alias usado pelos componentes
  async listarPOPs(filtros = {}) {
    return this.buscarPOPs(filtros);
  },

  async criarPOP(pop, usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_pops')
        .insert([{
          ...pop,
          created_by: usuarioId
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar POP:', error);
      return { success: false, message: error.message };
    }
  },

  async atualizarPOP(id, atualizacoes) {
    try {
      const { data, error } = await supabase
        .from('execucao_pops')
        .update({
          ...atualizacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar POP:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirPOP(id) {
    try {
      const { data: arquivos, error: arqError } = await supabase
        .from('execucao_pops_arquivos')
        .select('caminho_storage')
        .eq('pop_id', id);

      if (arqError) throw arqError;

      const { error } = await supabase
        .from('execucao_pops')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Depois do delete no banco, remove os anexos do Storage (evita arquivos órfãos)
      if (arquivos?.length) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_POPS)
          .remove(arquivos.map(a => a.caminho_storage));
        if (storageError) console.error('Erro ao remover anexos do POP:', storageError);
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir POP:', error);
      return { success: false, message: error.message };
    }
  },

  async adicionarArquivoPOP(popId, arquivo) {
    try {
      const { data, error } = await supabase
        .from('execucao_pops_arquivos')
        .insert([{
          pop_id: popId,
          ...arquivo
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao adicionar arquivo ao POP:', error);
      return { success: false, message: error.message };
    }
  },

  // Envia o arquivo ao Storage (bucket privado) e registra os metadados
  async uploadArquivoPOP(popId, file) {
    const caminho = `${popId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_POPS)
        .upload(caminho, file, { contentType: file.type || undefined, upsert: false });

      if (uploadError) throw uploadError;

      const tipo = file.type?.startsWith('image/') ? 'foto'
        : file.type?.startsWith('video/') ? 'video'
        : 'documento';

      const resultado = await this.adicionarArquivoPOP(popId, {
        tipo,
        nome: file.name,
        nome_arquivo_original: file.name,
        caminho_storage: caminho,
        tamanho_bytes: file.size,
        mime_type: file.type || null
      });

      if (!resultado.success) {
        await supabase.storage.from(BUCKET_POPS).remove([caminho]);
        throw new Error(resultado.message);
      }
      return resultado;
    } catch (error) {
      console.error('Erro no upload do arquivo do POP:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirArquivoPOP(arquivoId) {
    try {
      const { data: arquivo, error: buscaError } = await supabase
        .from('execucao_pops_arquivos')
        .select('caminho_storage')
        .eq('id', arquivoId)
        .single();

      if (buscaError) throw buscaError;

      const { error } = await supabase
        .from('execucao_pops_arquivos')
        .delete()
        .eq('id', arquivoId);

      if (error) throw error;

      const { error: storageError } = await supabase.storage
        .from(BUCKET_POPS)
        .remove([arquivo.caminho_storage]);
      if (storageError) console.error('Erro ao remover arquivo do Storage:', storageError);

      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir arquivo do POP:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // OBRAS E CRONOGRAMAS
  // ==========================================

  // Buscar todas as obras com filtros
  async buscarObras(filtros = {}) {
    try {
      const data = await fetchAll(() => {
        let query = supabase
          .from('execucao_obras')
          .select(`
            *,
            responsavel:usuarios!responsavel_id(id, nome_completo, email),
            etapas:execucao_obras_etapas(
              *,
              responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(id, nome_completo)
            )
          `)
          .order('data_inicio_prevista', { ascending: true })
          .order('id', { ascending: true });

        if (filtros.status) query = query.eq('status', filtros.status);
        if (filtros.tipo_obra) query = query.eq('tipo_obra', filtros.tipo_obra);
        if (filtros.responsavel_id) query = query.eq('responsavel_id', filtros.responsavel_id);
        if (filtros.data_inicio) query = query.gte('data_inicio_prevista', filtros.data_inicio);
        if (filtros.data_fim) query = query.lte('data_fim_prevista', filtros.data_fim);
        return query;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar obras:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar obras por período (para filtros de visualização)
  async buscarObrasPorPeriodo(periodo) {
    try {
      if (!['semana', 'mes', 'trimestre', 'ano'].includes(periodo)) {
        return this.buscarObras({});
      }

      const { inicio, fim } = intervaloPeriodo(periodo);

      // Interseção: a obra começa até o fim do período e termina a partir do início
      const data = await fetchAll(() => supabase
        .from('execucao_obras')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo, email),
          etapas:execucao_obras_etapas(
            *,
            responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(id, nome_completo)
          )
        `)
        .lte('data_inicio_prevista', fim)
        .gte('data_fim_prevista', inicio)
        .order('data_inicio_prevista', { ascending: true })
        .order('id', { ascending: true }));

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar obras por período:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar uma obra específica com todas as etapas
  async buscarObraDetalhada(obraId) {
    try {
      const { data, error } = await supabase
        .from('execucao_obras')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo, email),
          etapas:execucao_obras_etapas(
            *,
            responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(id, nome_completo)
          )
        `)
        .eq('id', obraId)
        .single();

      if (error) throw error;

      // Ordenar etapas por data e ordem
      if (data.etapas) {
        data.etapas.sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem;
          return new Date(a.data_inicio) - new Date(b.data_inicio);
        });
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar obra detalhada:', error);
      return { success: false, message: error.message };
    }
  },

  // Criar nova obra
  async criarObra(obra) {
    try {
      // Separar arquivos do objeto obra
      const { arquivos_pdf, ...dadosObra } = obra;
      
      // Tratar template_id vazio como null (UUID não aceita string vazia)
      if (dadosObra.template_id === '' || dadosObra.template_id === undefined) {
        dadosObra.template_id = null;
      }
      
      const { data, error } = await supabase
        .from('execucao_obras')
        .insert([dadosObra])
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;

      // Se houver arquivos, fazer upload e informar as falhas (a obra já foi criada)
      let warning;
      if (arquivos_pdf && arquivos_pdf.length > 0) {
        const upload = await this.uploadArquivosObra(data.id, arquivos_pdf);
        if (!upload.success) {
          const nomes = (upload.falhas ?? []).map(f => f.arquivo).join(', ');
          warning = `Obra criada, mas o envio de PDF falhou${nomes ? `: ${nomes}` : ''}`;
        }
      }

      return { success: true, data, ...(warning ? { warning } : {}) };
    } catch (error) {
      console.error('Erro ao criar obra:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar obra
  async atualizarObra(id, atualizacoes) {
    try {
      // Separar arquivos do objeto (upload é feito à parte)
      const { arquivos_pdf: _arquivos, ...dadosAtualizacao } = atualizacoes;
      
      const { data, error } = await supabase
        .from('execucao_obras')
        .update({
          ...dadosAtualizacao,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar obra:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir obra e as atividades/pedidos vinculados a ela por FK (etapa_id / obra_id)
  async excluirObra(id) {
    try {
      const { data: etapas, error: etapasError } = await supabase
        .from('execucao_obras_etapas')
        .select('id')
        .eq('obra_id', id);

      if (etapasError) throw etapasError;

      const etapaIds = (etapas ?? []).map(e => e.id);
      if (etapaIds.length) {
        const { error: atvError } = await supabase
          .from('execucao_atividades')
          .delete()
          .in('etapa_id', etapaIds);
        if (atvError) throw atvError;
      }

      const { error: pedidosError } = await supabase
        .from('execucao_pedidos_material')
        .delete()
        .eq('obra_id', id);
      if (pedidosError) throw pedidosError;

      // Etapas e registros de arquivos são excluídos por CASCADE; os objetos do Storage são removidos depois
      const { data: arquivos } = await supabase
        .from('execucao_obras_arquivos')
        .select('caminho_storage')
        .eq('obra_id', id);

      const { error } = await supabase
        .from('execucao_obras')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (arquivos?.length) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_OBRAS)
          .remove(arquivos.map(a => a.caminho_storage));
        if (storageError) console.error('Erro ao remover arquivos da obra:', storageError);
      }
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir obra:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ETAPAS DAS OBRAS
  // ==========================================

  // Criar várias etapas de uma vez (um único insert) e recalcular o progresso uma vez
  async criarEtapas(etapas) {
    try {
      if (!etapas?.length) return { success: true, data: [] };

      const { data, error } = await supabase
        .from('execucao_obras_etapas')
        .insert(etapas)
        .select();

      if (error) throw error;

      await this.recalcularProgressoObra(etapas[0].obra_id);
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar etapas:', error);
      return { success: false, message: error.message };
    }
  },
  // Criar etapa
  async criarEtapa(etapa) {
    try {
      const { data, error } = await supabase
        .from('execucao_obras_etapas')
        .insert([etapa])
        .select(`
          *,
          responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(id, nome_completo)
        `)
        .single();

      if (error) throw error;

      // Recalcular progresso da obra
      await this.recalcularProgressoObra(etapa.obra_id);

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar etapa:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar etapa
  async atualizarEtapa(id, atualizacoes) {
    try {
      // Buscar obra_id antes de atualizar
      const { data: etapaAtual } = await supabase
        .from('execucao_obras_etapas')
        .select('obra_id')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('execucao_obras_etapas')
        .update({
          ...atualizacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(id, nome_completo)
        `)
        .single();

      if (error) throw error;

      // Recalcular progresso da obra
      if (etapaAtual) {
        await this.recalcularProgressoObra(etapaAtual.obra_id);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar etapa:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir etapa (e atividades/pedidos vinculados por etapa_id)
  async excluirEtapa(id) {
    try {
      const { data: etapa, error: etapaError } = await supabase
        .from('execucao_obras_etapas')
        .select('obra_id, tipo')
        .eq('id', id)
        .single();

      if (etapaError) throw etapaError;

      const tabela = etapa.tipo === 'estoque' ? 'execucao_pedidos_material' : 'execucao_atividades';
      const { error: vinculosError } = await supabase.from(tabela).delete().eq('etapa_id', id);
      if (vinculosError) throw vinculosError;

      const { error } = await supabase
        .from('execucao_obras_etapas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await this.recalcularProgressoObra(etapa.obra_id);

      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir etapa:', error);
      return { success: false, message: error.message };
    }
  },

  // Recalcular progresso geral da obra baseado nas etapas
  async recalcularProgressoObra(obraId) {
    try {
      const { data: etapas } = await supabase
        .from('execucao_obras_etapas')
        .select('progresso')
        .eq('obra_id', obraId);

      if (etapas && etapas.length > 0) {
        const progressoTotal = etapas.reduce((acc, e) => acc + (e.progresso || 0), 0);
        const progressoMedio = Math.round(progressoTotal / etapas.length);

        await supabase
          .from('execucao_obras')
          .update({ 
            progresso_geral: progressoMedio,
            updated_at: new Date().toISOString()
          })
          .eq('id', obraId);
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao recalcular progresso:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar etapas por período (para preencher agendas)
  async buscarEtapasPorPeriodo(tipo, dataInicio, dataFim) {
    try {
      let query = supabase
        .from('execucao_obras_etapas')
        .select(`
          *,
          obra:execucao_obras(id, nome_cliente, endereco, cidade),
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .gte('data_inicio', dataInicio)
        .lte('data_fim', dataFim)
        .order('data_inicio', { ascending: true });

      if (tipo && tipo !== 'todos') {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar etapas por período:', error);
      return { success: false, message: error.message };
    }
  },

  // Criar ou atualizar atividade a partir de uma etapa (integração com agendas)
  // Evita duplicação verificando se já existe atividade para a mesma etapa
  async criarAtividadeDeEtapa(etapaId, dadosAtividade, usuarioId) {
    try {
      // Buscar dados da etapa
      const { data: etapa, error: etapaError } = await supabase
        .from('execucao_obras_etapas')
        .select(`
          *,
          obra:execucao_obras(id, nome_cliente, endereco)
        `)
        .eq('id', etapaId)
        .single();

      if (etapaError) throw etapaError;

      // Reaproveita a atividade já vinculada à etapa; senão, tenta o vínculo legado (título + cliente + data)
      const { data: vinculada, error: vinculadaError } = await supabase
        .from('execucao_atividades')
        .select('id')
        .eq('etapa_id', etapaId)
        .limit(1)
        .maybeSingle();

      if (vinculadaError) throw vinculadaError;

      let atividadeExistente = vinculada;
      if (!atividadeExistente) {
        const { data: legada, error: buscaError } = await supabase
          .from('execucao_atividades')
          .select('id')
          .is('etapa_id', null)
          .eq('titulo', dadosAtividade.titulo || etapa.nome)
          .eq('cliente_nome', dadosAtividade.cliente_nome || etapa.obra?.nome_cliente || '')
          .eq('data_programada', dadosAtividade.data_programada || etapa.data_inicio)
          .limit(1)
          .maybeSingle();

        if (buscaError) throw buscaError;
        atividadeExistente = legada;
      }

      // Se já existe, atualizar ao invés de criar
      if (atividadeExistente) {
        return await this.atualizarAtividade(atividadeExistente.id, {
          tecnico_responsavel_id: dadosAtividade.tecnico_responsavel_id || etapa.responsavel_id,
          data_programada: dadosAtividade.data_programada || etapa.data_inicio,
          observacoes: dadosAtividade.observacoes,
          etapa_id: etapaId
        }, usuarioId);
      }

      // Mapear tipo da etapa para tipo_execucao da atividade
      // Tipos válidos para atividade: eletrica, civil, galpao, gestao, estoque
      const mapearTipoExecucao = (tipoEtapa) => {
        const tiposValidos = ['eletrica', 'civil', 'galpao', 'gestao', 'estoque'];
        if (tiposValidos.includes(tipoEtapa)) {
          return tipoEtapa;
        }
        // 'geral' e 'administrativo' vão para 'gestao'
        return 'gestao';
      };

      // Criar atividade com dados da etapa + dados personalizados
      // Inclui etapa_id para vincular diretamente a atividade à etapa
      const atividade = {
        titulo: dadosAtividade.titulo || etapa.nome,
        descricao: dadosAtividade.descricao || etapa.descricao,
        tipo_execucao: mapearTipoExecucao(etapa.tipo),
        data_programada: dadosAtividade.data_programada || etapa.data_inicio,
        hora_inicio: dadosAtividade.hora_inicio || '08:00',
        hora_fim: dadosAtividade.hora_fim || '17:00',
        prioridade: dadosAtividade.prioridade || 'normal',
        tecnico_responsavel_id: dadosAtividade.tecnico_responsavel_id || etapa.responsavel_id,
        cliente_nome: dadosAtividade.cliente_nome || etapa.obra?.nome_cliente,
        endereco: dadosAtividade.endereco || etapa.obra?.endereco,
        observacoes: dadosAtividade.observacoes || `Etapa: ${etapa.nome}`,
        etapa_id: etapaId, // Vincula a atividade à etapa para sincronização automática
        created_by: usuarioId
      };

      const result = await this.criarAtividade(atividade, usuarioId);
      return result;
    } catch (error) {
      console.error('Erro ao criar atividade de etapa:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // PLANEJAMENTO MACRO (legado - mantido para compatibilidade)
  // ==========================================

  async buscarPlanejamentoMacro(filtros = {}) {
    try {
      let query = supabase
        .from('execucao_planejamento_macro')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .order('data_inicio', { ascending: true });

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.tipo_projeto) {
        query = query.eq('tipo_projeto', filtros.tipo_projeto);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  async criarPlanejamentoMacro(planejamento) {
    try {
      const { data, error } = await supabase
        .from('execucao_planejamento_macro')
        .insert([planejamento])
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  async atualizarPlanejamentoMacro(id, atualizacoes) {
    try {
      const { data, error } = await supabase
        .from('execucao_planejamento_macro')
        .update({
          ...atualizacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirPlanejamentoMacro(id) {
    try {
      const { error } = await supabase
        .from('execucao_planejamento_macro')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  // Alias para compatibilidade - lista planejamentos de um mês específico
  async listarPlanejamentoMacro(ano, mes) {
    try {
      const primeiroDia = dataLocalISO(new Date(ano, mes - 1, 1));
      const ultimoDia = dataLocalISO(new Date(ano, mes, 0));

      // Interseção com o mês: começa até o último dia e (sem fim ou termina a partir do primeiro dia)
      const data = await fetchAll(() => supabase
        .from('execucao_planejamento_macro')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .lte('data_inicio', ultimoDia)
        .or(`data_fim.is.null,data_fim.gte.${primeiroDia}`)
        .order('data_inicio', { ascending: true })
        .order('id', { ascending: true }));

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao listar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ESTATÍSTICAS
  // ==========================================

  async buscarEstatisticasDia(data = null) {
    const hoje = data || dataLocalISO();
    const inicioHoje = inicioDoDiaISO(hoje);

    try {
      // Atividades do dia + atrasadas (incluindo pausadas) + concluídas hoje
      const atividades = await fetchAll(() => supabase
        .from('execucao_atividades')
        .select('id, status, prioridade, data_programada, updated_at')
        .or(`data_programada.eq.${hoje},and(data_programada.lt.${hoje},status.in.(pendente,em_andamento,pausada)),and(status.eq.concluida,updated_at.gte.${inicioHoje})`)
        .order('id', { ascending: true }));

      const emAberto = ['pendente', 'em_andamento', 'pausada'];
      const atrasadas = atividades.filter(a => a.data_programada < hoje && emAberto.includes(a.status));

      // Concluídas hoje (independente da data programada), comparando em fuso local
      const inicio = new Date(inicioHoje);
      const concluidasHoje = atividades.filter(a =>
        a.status === 'concluida' && a.updated_at && new Date(a.updated_at) >= inicio
      );

      const stats = {
        total: atividades.length,
        pendentes: atividades.filter(a => a.status === 'pendente').length,
        em_andamento: atividades.filter(a => a.status === 'em_andamento').length,
        concluidas: concluidasHoje.length,
        pausadas: atividades.filter(a => a.status === 'pausada').length,
        urgentes: atividades.filter(a => a.prioridade === 'urgente' || atrasadas.includes(a)).length
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarEstatisticasTecnico(tecnicoId, dataInicio, dataFim) {
    try {
      const linhas = await this._agregado(dataInicio, dataFim, tecnicoId);
      const total = linhas.reduce((acc, l) => acc + l.total, 0);
      const concluidas = linhas.filter(l => l.status === 'concluida').reduce((acc, l) => acc + l.total, 0);

      return {
        success: true,
        data: {
          total,
          concluidas,
          taxa_conclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0
        }
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do técnico:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // DESEMPENHO (agregado no banco via RPC)
  // ==========================================

  async _agregado(inicio, fim, tecnicoId = null) {
    const { data, error } = await supabase.rpc('execucao_atividades_agregado', {
      p_inicio: inicio,
      p_fim: fim,
      p_tecnico: tecnicoId
    });
    if (error) throw error;
    return (data ?? []).map(l => ({ ...l, total: Number(l.total) }));
  },

  _porTipo(linhas) {
    const porTipo = { eletrica: 0, civil: 0, galpao: 0, gestao: 0 };
    for (const l of linhas) {
      if (l.tipo_execucao in porTipo) porTipo[l.tipo_execucao] += l.total;
    }
    return porTipo;
  },

  async buscarRankingTecnicos(periodo = 'mes') {
    try {
      const { inicio, fim } = intervaloPeriodo(periodo);
      const [linhas, tecnicosResult] = await Promise.all([
        this._agregado(inicio, fim),
        this.buscarTecnicos()
      ]);
      const tecnicos = (tecnicosResult.data ?? []).filter(t => t.nivel_acesso?.nome === 'TECNICO');

      const ranking = tecnicos.map(t => {
        const doTecnico = linhas.filter(l => l.tecnico_id === t.id);
        const total = doTecnico.reduce((acc, l) => acc + l.total, 0);
        const concluidas = doTecnico.filter(l => l.status === 'concluida').reduce((acc, l) => acc + l.total, 0);
        return {
          id: t.id,
          nome: t.nome_completo,
          total,
          concluidas,
          taxa_conclusao: total ? Math.round((concluidas / total) * 100) : 0
        };
      }).sort((a, b) => b.concluidas - a.concluidas || b.taxa_conclusao - a.taxa_conclusao);

      return { success: true, data: ranking };
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      return { success: false, message: error.message, data: [] };
    }
  },

  async buscarDesempenhoIndividual(tecnicoId, periodo = 'mes') {
    try {
      const { inicio, fim } = intervaloPeriodo(periodo);
      const [linhasTodos, ranking] = await Promise.all([
        this._agregado(inicio, fim),
        this.buscarRankingTecnicos(periodo)
      ]);
      const linhas = linhasTodos.filter(l => l.tecnico_id === tecnicoId);

      const porDia = {};
      for (const l of linhas) {
        porDia[l.data_programada] ??= { data: l.data_programada, total: 0, concluidas: 0 };
        porDia[l.data_programada].total += l.total;
        if (l.status === 'concluida') porDia[l.data_programada].concluidas += l.total;
      }

      const soma = (filtro) => linhas.filter(filtro).reduce((acc, l) => acc + l.total, 0);
      const posicao = (ranking.data ?? []).findIndex(r => r.id === tecnicoId);

      return {
        success: true,
        data: {
          total: soma(() => true),
          concluidas: soma(l => l.status === 'concluida'),
          pendentes: soma(l => ['pendente', 'em_andamento', 'pausada'].includes(l.status)),
          por_tipo: this._porTipo(linhas),
          historico: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)),
          ranking: posicao >= 0 ? posicao + 1 : null
        }
      };
    } catch (error) {
      console.error('Erro ao buscar desempenho individual:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarDesempenhoTime(periodo = 'mes') {
    try {
      const atual = intervaloPeriodo(periodo);
      const anterior = intervaloPeriodoAnterior(periodo);
      const [linhas, linhasAnt, tecnicosResult] = await Promise.all([
        this._agregado(atual.inicio, atual.fim),
        this._agregado(anterior.inicio, anterior.fim),
        this.buscarTecnicos()
      ]);

      const totalTecnicos = (tecnicosResult.data ?? []).filter(t => t.nivel_acesso?.nome === 'TECNICO').length;
      const total = linhas.reduce((acc, l) => acc + l.total, 0);
      const totalAnterior = linhasAnt.reduce((acc, l) => acc + l.total, 0);
      const concluidas = linhas.filter(l => l.status === 'concluida').reduce((acc, l) => acc + l.total, 0);

      const porDia = {};
      for (const l of linhas) {
        porDia[l.data_programada] ??= { data: l.data_programada, eletrica: 0, civil: 0, galpao: 0, gestao: 0 };
        if (l.tipo_execucao in porDia[l.data_programada]) porDia[l.data_programada][l.tipo_execucao] += l.total;
      }

      return {
        success: true,
        data: {
          total_tecnicos: totalTecnicos,
          total_atividades: total,
          taxa_conclusao: total ? Math.round((concluidas / total) * 100) : 0,
          media_por_tecnico: totalTecnicos ? Math.round(total / totalTecnicos) : 0,
          variacao_total: totalAnterior ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : 0,
          por_tipo: this._porTipo(linhas),
          evolucao: Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data))
        }
      };
    } catch (error) {
      console.error('Erro ao buscar desempenho do time:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // TÉCNICOS
  // ==========================================

  async buscarTecnicos() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          id,
          nome_completo,
          email,
          ativo,
          niveis_acesso!inner(id, nome)
        `)
        .in('niveis_acesso.nome', ['TECNICO', 'ADMIN_EXECUCAO', 'Administrador'])
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;

      // Mantém o formato esperado pelos componentes (nivel_acesso)
      return {
        success: true,
        data: data.map(({ niveis_acesso, ...usuario }) => ({ ...usuario, nivel_acesso: niveis_acesso }))
      };
    } catch (error) {
      console.error('Erro ao buscar técnicos:', error);
      return { success: false, message: error.message };
    }
  },

  // Alias para compatibilidade
  async listarTecnicos() {
    return this.buscarTecnicos();
  },

  // ==========================================
  // NOTIFICAÇÕES
  // ==========================================

  // Criar notificação
  async criarNotificacao(notificacao) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .insert([notificacao])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar notificações (não lidas primeiro)
  async buscarNotificacoes(limite = 50) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .select(`
          *,
          atividade:execucao_atividades(id, titulo, status),
          usuario_origem:usuarios!usuario_origem_id(id, nome_completo)
        `)
        .order('lida', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(limite);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar contagem de notificações não lidas
  async contarNotificacoesNaoLidas() {
    try {
      const { count, error } = await supabase
        .from('execucao_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false);

      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Erro ao contar notificações:', error);
      return { success: false, count: 0 };
    }
  },

  // Marcar notificação como lida
  async marcarNotificacaoLida(notificacaoId, usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .update({
          lida: true,
          lida_em: new Date().toISOString(),
          lida_por: usuarioId
        })
        .eq('id', notificacaoId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return { success: false, message: error.message };
    }
  },

  // Marcar todas as notificações como lidas
  async marcarTodasNotificacoesLidas(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .update({
          lida: true,
          lida_em: new Date().toISOString(),
          lida_por: usuarioId
        })
        .eq('lida', false)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      return { success: false, message: error.message };
    }
  },

  // Gera as notificações de atraso (uma por atividade/dia) em uma única chamada no banco
  async verificarECriarNotificacoesAtraso() {
    try {
      const { data, error } = await supabase.rpc('gerar_notificacoes_atraso');
      if (error) throw error;
      return { success: true, count: data ?? 0 };
    } catch (error) {
      console.error('Erro ao verificar atrasos:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // APONTAMENTOS COMERCIAIS (para vincular obras)
  // ==========================================

  // Buscar apontamentos com fase CONTRATO/VENDA para vincular às obras
  async buscarApontamentosParaObra(termoBusca = '') {
    try {
      let query = supabase
        .from('apontamentos_comerciais')
        .select(`
          id,
          nome_cliente,
          contato_cliente,
          logradouro,
          numero,
          bairro,
          municipio,
          uf,
          cep,
          cidade_atendimento,
          cidade_outras,
          cronograma_data_inicio,
          cronograma_data_termino,
          fase,
          created_at
        `)
        .eq('fase', 'CONTRATO/VENDA')
        .order('created_at', { ascending: false });

      if (termoBusca && termoBusca.trim() !== '') {
        query = query.ilike('nome_cliente', `%${termoBusca.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar apontamentos para obra:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ARQUIVOS DAS OBRAS
  // ==========================================

  // Upload de arquivos PDF para uma obra
  async uploadArquivosObra(obraId, arquivos) {
    try {
      const resultados = [];
      const falhas = [];

      for (const arquivo of arquivos) {
        const nomeSeguro = arquivo.name.replace(/[^\w.-]+/g, '_');
        const nomeArquivo = `${obraId}/${crypto.randomUUID()}-${nomeSeguro}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_OBRAS)
          .upload(nomeArquivo, arquivo, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          falhas.push({ arquivo: arquivo.name, message: uploadError.message });
          continue;
        }

        const { data: arquivoData, error: dbError } = await supabase
          .from('execucao_obras_arquivos')
          .insert([{
            obra_id: obraId,
            nome: arquivo.name.replace(/\.pdf$/i, ''),
            nome_arquivo_original: arquivo.name,
            caminho_storage: nomeArquivo,
            tamanho_bytes: arquivo.size,
            mime_type: arquivo.type || 'application/pdf'
          }])
          .select()
          .single();

        if (dbError) {
          console.error('Erro ao salvar referência:', dbError);
          // Evita arquivo órfão no Storage
          await supabase.storage.from(BUCKET_OBRAS).remove([nomeArquivo]);
          falhas.push({ arquivo: arquivo.name, message: dbError.message });
          continue;
        }

        resultados.push(arquivoData);
      }

      return { success: falhas.length === 0, data: resultados, falhas };
    } catch (error) {
      console.error('Erro ao fazer upload de arquivos:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar arquivos de uma obra
  async buscarArquivosObra(obraId) {
    try {
      const { data, error } = await supabase
        .from('execucao_obras_arquivos')
        .select('*')
        .eq('obra_id', obraId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar arquivos:', error);
      return { success: false, message: error.message };
    }
  },

  // URL assinada e temporária (bucket privado)
  async obterUrlArquivo(caminhoStorage, expiraEmSegundos = 300) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_OBRAS)
        .createSignedUrl(caminhoStorage, expiraEmSegundos);

      if (error) throw error;
      return { success: true, url: data.signedUrl };
    } catch (error) {
      console.error('Erro ao obter URL:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir arquivo (o caminho é lido do banco, nunca recebido do cliente)
  async excluirArquivoObra(arquivoId) {
    try {
      const { data: arquivo, error: buscaError } = await supabase
        .from('execucao_obras_arquivos')
        .select('caminho_storage')
        .eq('id', arquivoId)
        .single();

      if (buscaError) throw buscaError;

      const { error: dbError } = await supabase
        .from('execucao_obras_arquivos')
        .delete()
        .eq('id', arquivoId);

      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage
        .from(BUCKET_OBRAS)
        .remove([arquivo.caminho_storage]);

      if (storageError) console.error('Erro ao excluir do storage:', storageError);
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // TEMPLATES DE ETAPAS
  // ==========================================

  // Buscar todos os templates
  async buscarTemplates(apenasAtivos = true) {
    try {
      let query = supabase
        .from('execucao_templates_etapas')
        .select(`
          *,
          itens:execucao_templates_etapas_itens(*)
        `)
        .order('ordem', { ascending: true });

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Ordenar itens de cada template por ordem
      const templatesOrdenados = data.map(template => ({
        ...template,
        itens: (template.itens || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      }));

      return { success: true, data: templatesOrdenados };
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar um template específico
  async buscarTemplate(templateId) {
    try {
      const { data, error } = await supabase
        .from('execucao_templates_etapas')
        .select(`
          *,
          itens:execucao_templates_etapas_itens(*)
        `)
        .eq('id', templateId)
        .single();

      if (error) throw error;

      // Ordenar itens por ordem
      if (data.itens) {
        data.itens.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar template:', error);
      return { success: false, message: error.message };
    }
  },

  // Criar novo template
  async criarTemplate(templateData) {
    try {
      const { itens, ...dadosTemplate } = templateData;

      // Criar template
      const { data: template, error: templateError } = await supabase
        .from('execucao_templates_etapas')
        .insert(dadosTemplate)
        .select()
        .single();

      if (templateError) throw templateError;

      // Criar itens se existirem
      if (itens && itens.length > 0) {
        const itensComTemplateId = itens.map((item, index) => ({
          ...item,
          template_id: template.id,
          ordem: item.ordem || index + 1
        }));

        const { error: itensError } = await supabase
          .from('execucao_templates_etapas_itens')
          .insert(itensComTemplateId);

        if (itensError) throw itensError;
      }

      return { success: true, data: template };
    } catch (error) {
      console.error('Erro ao criar template:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar template
  async atualizarTemplate(templateId, templateData) {
    try {
      const { itens, ...dadosTemplate } = templateData;

      // Atualizar dados do template
      dadosTemplate.updated_at = new Date().toISOString();
      const { error: templateError } = await supabase
        .from('execucao_templates_etapas')
        .update(dadosTemplate)
        .eq('id', templateId);

      if (templateError) throw templateError;

      // Se itens foram enviados, substitui todos. Insere os novos antes de remover os antigos:
      // uma falha no meio deixa itens duplicados, nunca um template sem itens.
      if (itens !== undefined) {
        const { data: antigos, error: antigosError } = await supabase
          .from('execucao_templates_etapas_itens')
          .select('id')
          .eq('template_id', templateId);

        if (antigosError) throw antigosError;

        if (itens && itens.length > 0) {
          const itensComTemplateId = itens.map((item, index) => ({
            nome: item.nome,
            descricao: item.descricao,
            tipo: item.tipo,
            duracao_dias: item.duracao_dias || item.duracao || 3,
            template_id: templateId,
            ordem: item.ordem || index + 1
          }));

          const { error: itensError } = await supabase
            .from('execucao_templates_etapas_itens')
            .insert(itensComTemplateId);

          if (itensError) throw itensError;
        }

        if (antigos?.length) {
          const { error: deleteError } = await supabase
            .from('execucao_templates_etapas_itens')
            .delete()
            .in('id', antigos.map(i => i.id));

          if (deleteError) throw deleteError;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir template
  async excluirTemplate(templateId) {
    try {
      // Os itens serão excluídos automaticamente pelo ON DELETE CASCADE
      const { error } = await supabase
        .from('execucao_templates_etapas')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      return { success: false, message: error.message };
    }
  },

  // Adicionar item a um template
  async adicionarItemTemplate(templateId, itemData) {
    try {
      const { data, error } = await supabase
        .from('execucao_templates_etapas_itens')
        .insert({
          ...itemData,
          template_id: templateId
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar item de template
  async atualizarItemTemplate(itemId, itemData) {
    try {
      const { error } = await supabase
        .from('execucao_templates_etapas_itens')
        .update(itemData)
        .eq('id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir item de template
  async excluirItemTemplate(itemId) {
    try {
      const { error } = await supabase
        .from('execucao_templates_etapas_itens')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      return { success: false, message: error.message };
    }
  },

  // Duplicar template existente
  async duplicarTemplate(templateId, novoNome) {
    try {
      // Buscar template original
      const { data: original, error: fetchError } = await supabase
        .from('execucao_templates_etapas')
        .select(`
          *,
          itens:execucao_templates_etapas_itens(*)
        `)
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;

      // Criar cópia
      const dadosTemplate = Object.fromEntries(
        Object.entries(original).filter(([campo]) => !['id', 'created_at', 'updated_at', 'itens'].includes(campo))
      );
      const itens = original.itens;
      const novoTemplate = {
        ...dadosTemplate,
        nome: novoNome || `${original.nome} (Cópia)`
      };

      const { data: templateCriado, error: createError } = await supabase
        .from('execucao_templates_etapas')
        .insert(novoTemplate)
        .select()
        .single();

      if (createError) throw createError;

      // Copiar itens
      if (itens && itens.length > 0) {
        const novosItens = itens.map(item => ({
          template_id: templateCriado.id,
          nome: item.nome,
          descricao: item.descricao,
          tipo: item.tipo,
          duracao_dias: item.duracao_dias,
          ordem: item.ordem
        }));

        const { error: itensError } = await supabase
          .from('execucao_templates_etapas_itens')
          .insert(novosItens);

        if (itensError) throw itensError;
      }

      return { success: true, data: templateCriado };
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      return { success: false, message: error.message };
    }
  }
};

export const execucaoService = wrapServiceWithImpersonationGuard(_execucaoService, {
  label: 'execucaoService'
});

export default execucaoService;
