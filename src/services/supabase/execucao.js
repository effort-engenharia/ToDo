import { supabase } from './config.js';

// Serviços de execução para o Dashboard Execução
export const execucaoService = {
  // ==========================================
  // ATIVIDADES
  // ==========================================

  // Buscar todas as atividades
  async buscarAtividades(filtros = {}) {
    try {
      let query = supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
          criador:usuarios!created_by(id, nome_completo)
        `)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      // Aplicar filtros
      if (filtros.tipo_execucao) {
        query = query.eq('tipo_execucao', filtros.tipo_execucao);
      }
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.tecnico_id) {
        query = query.eq('tecnico_responsavel_id', filtros.tecnico_id);
      }
      if (filtros.data_inicio) {
        query = query.gte('data_programada', filtros.data_inicio);
      }
      if (filtros.data_fim) {
        query = query.lte('data_programada', filtros.data_fim);
      }
      if (filtros.data_programada) {
        query = query.eq('data_programada', filtros.data_programada);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar atividades do dia
  async buscarAtividadesDoDia(data = null) {
    const hoje = data || new Date().toISOString().split('T')[0];
    return this.buscarAtividades({ data_programada: hoje });
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

      // Registrar no histórico
      await this.registrarHistorico(data.id, usuarioId, 'criacao', 'Atividade criada');

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar atividade
  async atualizarAtividade(id, atualizacoes, usuarioId) {
    try {
      // Buscar dados atuais para histórico
      const { data: atividadeAtual } = await supabase
        .from('execucao_atividades')
        .select('*')
        .eq('id', id)
        .single();

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

      // Registrar mudanças no histórico
      for (const [campo, valorNovo] of Object.entries(atualizacoes)) {
        if (atividadeAtual[campo] !== valorNovo) {
          await this.registrarHistorico(id, usuarioId, 'edicao', `Campo ${campo} alterado`, atividadeAtual[campo]?.toString(), valorNovo?.toString());
        }
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Alterar status da atividade
  async alterarStatusAtividade(id, novoStatus, usuarioId) {
    try {
      const { data: atividadeAtual } = await supabase
        .from('execucao_atividades')
        .select('status')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('execucao_atividades')
        .update({
          status: novoStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      const tipoAcao = novoStatus === 'concluida' ? 'conclusao' : 
                       novoStatus === 'cancelada' ? 'cancelamento' : 'status_alterado';
      await this.registrarHistorico(id, usuarioId, tipoAcao, `Status alterado para ${novoStatus}`, atividadeAtual.status, novoStatus);

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      return { success: false, message: error.message };
    }
  },

  // Transferir atividade para outro técnico
  async transferirAtividade(id, novoTecnicoId, usuarioId, motivo = '') {
    try {
      const { data: atividadeAtual } = await supabase
        .from('execucao_atividades')
        .select('tecnico_responsavel_id')
        .eq('id', id)
        .single();

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

      // Registrar no histórico
      await this.registrarHistorico(id, usuarioId, 'transferencia', motivo || 'Atividade transferida', atividadeAtual.tecnico_responsavel_id, novoTecnicoId);

      return { success: true, data };
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
      await supabase
        .from('execucao_atividades_historico')
        .insert([{
          atividade_id: atividadeId,
          usuario_id: usuarioId,
          tipo_acao: tipoAcao,
          descricao,
          valor_anterior: valorAnterior,
          valor_novo: valorNovo
        }]);
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
    }
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
      let query = supabase
        .from('execucao_pedidos_material')
        .select(`
          *,
          solicitante:usuarios!solicitante_id(id, nome_completo),
          aprovador:usuarios!aprovado_por(id, nome_completo),
          atividade:execucao_atividades(id, titulo)
        `)
        .order('created_at', { ascending: false });

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.solicitante_id) {
        query = query.eq('solicitante_id', filtros.solicitante_id);
      }

      const { data, error } = await query;

      if (error) throw error;
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
        .order('ordem', { ascending: true });

      if (filtros.categoria) {
        query = query.eq('categoria', filtros.categoria);
      }
      if (filtros.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar POPs:', error);
      return { success: false, message: error.message };
    }
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
      const { error } = await supabase
        .from('execucao_pops')
        .delete()
        .eq('id', id);

      if (error) throw error;
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

  async excluirArquivoPOP(arquivoId) {
    try {
      const { error } = await supabase
        .from('execucao_pops_arquivos')
        .delete()
        .eq('id', arquivoId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir arquivo do POP:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // PLANEJAMENTO MACRO
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
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ESTATÍSTICAS
  // ==========================================

  async buscarEstatisticasDia(data = null) {
    const hoje = data || new Date().toISOString().split('T')[0];
    
    try {
      const { data: atividades, error } = await supabase
        .from('execucao_atividades')
        .select('status, prioridade')
        .eq('data_programada', hoje);

      if (error) throw error;

      const stats = {
        total: atividades.length,
        pendentes: atividades.filter(a => a.status === 'pendente').length,
        em_andamento: atividades.filter(a => a.status === 'em_andamento').length,
        concluidas: atividades.filter(a => a.status === 'concluida').length,
        urgentes: atividades.filter(a => a.prioridade === 'urgente').length
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarEstatisticasTecnico(tecnicoId, dataInicio, dataFim) {
    try {
      const { data: atividades, error } = await supabase
        .from('execucao_atividades')
        .select('status, prioridade, data_programada')
        .eq('tecnico_responsavel_id', tecnicoId)
        .gte('data_programada', dataInicio)
        .lte('data_programada', dataFim);

      if (error) throw error;

      const stats = {
        total: atividades.length,
        concluidas: atividades.filter(a => a.status === 'concluida').length,
        taxa_conclusao: atividades.length > 0 
          ? Math.round((atividades.filter(a => a.status === 'concluida').length / atividades.length) * 100) 
          : 0
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do técnico:', error);
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
          nivel_acesso:niveis_acesso(id, nome)
        `)
        .in('nivel_acesso_id', [
          '94519cec-cb25-4559-9c31-02cb7c22f799', // TECNICO
          '694a84e6-f00b-44b0-8857-6b7e308bd1ac', // ADMIN_EXECUCAO
          'd011db6c-a00b-41d8-a62a-b44e787d269f'  // Administrador
        ])
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar técnicos:', error);
      return { success: false, message: error.message };
    }
  }
};

export default execucaoService;
