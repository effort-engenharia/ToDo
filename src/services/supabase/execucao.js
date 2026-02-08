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

  // Buscar atividades pausadas com justificativas (do histórico)
  async buscarAtividadesPausadas() {
    try {
      // Buscar atividades com status pausada
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

      // Buscar a última justificativa de pausa de cada atividade no histórico
      const atividadesComJustificativa = await Promise.all(
        atividades.map(async (atividade) => {
          const { data: historico } = await supabase
            .from('execucao_atividades_historico')
            .select(`
              *,
              usuario:usuarios(id, nome_completo)
            `)
            .eq('atividade_id', atividade.id)
            .eq('tipo_acao', 'pausa')
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...atividade,
            pausa_info: historico?.[0] || null
          };
        })
      );

      return { success: true, data: atividadesComJustificativa };
    } catch (error) {
      console.error('Erro ao buscar atividades pausadas:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar atividades do dia + atrasadas (pendentes de dias anteriores) + concluídas hoje
  async buscarAtividadesDoDiaComAtrasadas(data = null) {
    try {
      const hoje = data || new Date().toISOString().split('T')[0];
      
      const { data: atividades, error } = await supabase
        .from('execucao_atividades')
        .select(`
          *,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo, email),
          criador:usuarios!created_by(id, nome_completo)
        `)
        .or(`data_programada.eq.${hoje},and(data_programada.lt.${hoje},status.in.(pendente,em_andamento,pausada)),and(status.eq.concluida,updated_at.gte.${hoje})`)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
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
  async alterarStatusAtividade(id, novoStatus, usuarioId, motivo = null) {
    try {
      const { data: atividadeAtual } = await supabase
        .from('execucao_atividades')
        .select('status, titulo, tecnico:usuarios!tecnico_responsavel_id(nome_completo)')
        .eq('id', id)
        .single();

      const updateData = {
        status: novoStatus,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('execucao_atividades')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      let tipoAcao = 'status_alterado';
      let descricao = `Status alterado para ${novoStatus}`;
      let tipoNotificacao = null;
      let tituloNotificacao = '';
      let mensagemNotificacao = '';
      const tecnicoNome = atividadeAtual.tecnico?.nome_completo || 'Técnico';
      
      if (novoStatus === 'concluida') {
        tipoAcao = 'conclusao';
        descricao = 'Atividade concluída';
        tipoNotificacao = 'conclusao';
        tituloNotificacao = '✅ Atividade Concluída';
        mensagemNotificacao = `${tecnicoNome} concluiu a atividade "${atividadeAtual.titulo}"`;
      } else if (novoStatus === 'cancelada') {
        tipoAcao = 'cancelamento';
        descricao = 'Atividade cancelada';
      } else if (novoStatus === 'pausada') {
        tipoAcao = 'pausa';
        descricao = motivo ? `Atividade pausada. Motivo: ${motivo}` : 'Atividade pausada';
        tipoNotificacao = 'pausa';
        tituloNotificacao = '⏸️ Atividade Pausada';
        mensagemNotificacao = `${tecnicoNome} pausou a atividade "${atividadeAtual.titulo}"${motivo ? `. Motivo: ${motivo}` : ''}`;
      } else if (novoStatus === 'em_andamento' && atividadeAtual.status === 'pausada') {
        tipoAcao = 'retomada';
        descricao = 'Atividade retomada';
        tipoNotificacao = 'retomada';
        tituloNotificacao = '▶️ Atividade Retomada';
        mensagemNotificacao = `${tecnicoNome} retomou a atividade "${atividadeAtual.titulo}"`;
      } else if (novoStatus === 'pendente') {
        tipoNotificacao = 'pendente';
        tituloNotificacao = '📋 Atividade Pendente';
        mensagemNotificacao = `A atividade "${atividadeAtual.titulo}" foi marcada como pendente`;
      }
      
      await this.registrarHistorico(id, usuarioId, tipoAcao, descricao, atividadeAtual.status, novoStatus);

      // Criar notificação para administrador
      if (tipoNotificacao) {
        await this.criarNotificacao({
          tipo: tipoNotificacao,
          titulo: tituloNotificacao,
          mensagem: mensagemNotificacao,
          atividade_id: id,
          usuario_origem_id: usuarioId
        });
      }

      // Se concluída, verificar se há etapa vinculada e atualizar progresso
      if (novoStatus === 'concluida') {
        await this.atualizarEtapaVinculada(id);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar etapa vinculada quando atividade é concluída
  async atualizarEtapaVinculada(atividadeId) {
    try {
      // Buscar atividade com etapa_id
      const { data: atividade, error: atividadeError } = await supabase
        .from('execucao_atividades')
        .select('id, titulo, cliente_nome, etapa_id')
        .eq('id', atividadeId)
        .single();

      if (atividadeError || !atividade) return;

      // Se tem etapa_id direto, usar ele
      if (atividade.etapa_id) {
        await supabase
          .from('execucao_obras_etapas')
          .update({
            progresso: 100,
            status: 'concluida',
            updated_at: new Date().toISOString()
          })
          .eq('id', atividade.etapa_id);
        console.log('✅ Etapa vinculada atualizada para 100%');
        return;
      }

      // Se não tem etapa_id, tentar encontrar por título + cliente usando RPC ou query direta
      // Buscar todas as etapas com o mesmo nome
      const { data: etapas, error: etapaError } = await supabase
        .from('execucao_obras_etapas')
        .select('id, nome, obra:execucao_obras(nome_cliente)')
        .eq('nome', atividade.titulo);

      if (!etapaError && etapas && etapas.length > 0) {
        // Verificar se o cliente bate
        const etapaMatch = etapas.find(e => 
          e.obra?.nome_cliente === atividade.cliente_nome
        );
        
        if (etapaMatch) {
          await supabase
            .from('execucao_obras_etapas')
            .update({
              progresso: 100,
              status: 'concluida',
              updated_at: new Date().toISOString()
            })
            .eq('id', etapaMatch.id);
          
          // Vincular atividade à etapa para futuras atualizações
          await supabase
            .from('execucao_atividades')
            .update({ etapa_id: etapaMatch.id })
            .eq('id', atividadeId);
            
          console.log('✅ Etapa encontrada e atualizada para 100%:', etapaMatch.id);
        } else {
          console.log('⚠️ Nenhuma etapa encontrada com cliente correspondente');
        }
      } else {
        console.log('⚠️ Nenhuma etapa encontrada com o nome:', atividade.titulo);
      }
    } catch (error) {
      console.error('Erro ao atualizar etapa vinculada:', error);
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
  // OBRAS E CRONOGRAMAS
  // ==========================================

  // Buscar todas as obras com filtros
  async buscarObras(filtros = {}) {
    try {
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
        .order('data_inicio_prevista', { ascending: true });

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }
      if (filtros.tipo_obra) {
        query = query.eq('tipo_obra', filtros.tipo_obra);
      }
      if (filtros.responsavel_id) {
        query = query.eq('responsavel_id', filtros.responsavel_id);
      }
      if (filtros.data_inicio) {
        query = query.gte('data_inicio_prevista', filtros.data_inicio);
      }
      if (filtros.data_fim) {
        query = query.lte('data_fim_prevista', filtros.data_fim);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar obras:', error);
      return { success: false, message: error.message };
    }
  },

  // Buscar obras por período (para filtros de visualização)
  async buscarObrasPorPeriodo(periodo) {
    try {
      const hoje = new Date();
      let dataInicio, dataFim;

      switch (periodo) {
        case 'semana':
          dataInicio = new Date(hoje);
          dataInicio.setDate(hoje.getDate() - hoje.getDay());
          dataFim = new Date(dataInicio);
          dataFim.setDate(dataInicio.getDate() + 6);
          break;
        case 'mes':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          break;
        case 'trimestre':
          const trimestre = Math.floor(hoje.getMonth() / 3);
          dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
          dataFim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 0);
          break;
        case 'ano':
          dataInicio = new Date(hoje.getFullYear(), 0, 1);
          dataFim = new Date(hoje.getFullYear(), 11, 31);
          break;
        case 'todos':
        default:
          // Sem filtro de data
          return this.buscarObras({});
      }

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
        .or(`data_inicio_prevista.lte.${dataFim.toISOString().split('T')[0]},data_fim_prevista.gte.${dataInicio.toISOString().split('T')[0]}`)
        .order('data_inicio_prevista', { ascending: true });

      if (error) throw error;

      // Filtrar obras que realmente intersectam o período
      const obrasFiltradas = data.filter(obra => {
        const inicio = new Date(obra.data_inicio_prevista);
        const fim = new Date(obra.data_fim_prevista);
        return inicio <= dataFim && fim >= dataInicio;
      });

      return { success: true, data: obrasFiltradas };
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

      // Se houver arquivos, fazer upload
      if (arquivos_pdf && arquivos_pdf.length > 0) {
        await this.uploadArquivosObra(data.id, arquivos_pdf);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar obra:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar obra
  async atualizarObra(id, atualizacoes) {
    try {
      // Separar arquivos do objeto
      const { arquivos_pdf, ...dadosAtualizacao } = atualizacoes;
      
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

  // Excluir obra e todas as atividades/pedidos relacionados
  async excluirObra(id) {
    try {
      // Buscar dados da obra antes de excluir
      const { data: obra } = await supabase
        .from('execucao_obras')
        .select('nome_cliente')
        .eq('id', id)
        .single();

      if (obra) {
        // Excluir todas as atividades relacionadas a esta obra
        await supabase
          .from('execucao_atividades')
          .delete()
          .eq('cliente_nome', obra.nome_cliente);
        
        // Excluir todos os pedidos de material relacionados a esta obra
        await supabase
          .from('execucao_pedidos_material')
          .delete()
          .ilike('descricao', `%${obra.nome_cliente}%`);
        
        console.log('🗑️ Atividades e pedidos relacionados à obra excluídos');
      }

      // Excluir a obra (etapas são excluídas por CASCADE)
      const { error } = await supabase
        .from('execucao_obras')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir obra:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ETAPAS DAS OBRAS
  // ==========================================

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

  // Excluir etapa
  async excluirEtapa(id) {
    try {
      // Buscar dados da etapa antes de excluir
      const { data: etapa } = await supabase
        .from('execucao_obras_etapas')
        .select(`
          obra_id,
          nome,
          data_inicio,
          tipo,
          obra:execucao_obras(nome_cliente)
        `)
        .eq('id', id)
        .single();

      if (etapa) {
        // Se for etapa de estoque, excluir pedidos de material relacionados
        if (etapa.tipo === 'estoque') {
          const descricaoPedido = `${etapa.nome} - Obra: ${etapa.obra?.nome_cliente || ''}`;
          await supabase
            .from('execucao_pedidos_material')
            .delete()
            .ilike('descricao', `%${etapa.nome}%`)
            .ilike('descricao', `%${etapa.obra?.nome_cliente || 'N/A'}%`);
          
          console.log('🗑️ Pedidos de material relacionados excluídos');
        } else {
          // Excluir atividades relacionadas (mesmo título + cliente + data)
          await supabase
            .from('execucao_atividades')
            .delete()
            .eq('titulo', etapa.nome)
            .eq('cliente_nome', etapa.obra?.nome_cliente || '')
            .eq('data_programada', etapa.data_inicio);
          
          console.log('🗑️ Atividades relacionadas excluídas');
        }
      }

      // Excluir a etapa
      const { error } = await supabase
        .from('execucao_obras_etapas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Recalcular progresso da obra
      if (etapa) {
        await this.recalcularProgressoObra(etapa.obra_id);
      }

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

      // Verificar se já existe atividade para esta etapa (pelo título + cliente + data)
      const { data: atividadeExistente, error: buscaError } = await supabase
        .from('execucao_atividades')
        .select('id')
        .eq('titulo', dadosAtividade.titulo || etapa.nome)
        .eq('cliente_nome', dadosAtividade.cliente_nome || etapa.obra?.nome_cliente || '')
        .eq('data_programada', dadosAtividade.data_programada || etapa.data_inicio)
        .maybeSingle();

      // Ignorar erro de "não encontrado" - é esperado quando não existe atividade
      if (buscaError && buscaError.code !== 'PGRST116') {
        console.warn('Aviso ao buscar atividade existente:', buscaError);
      }

      // Se já existe, atualizar ao invés de criar
      if (atividadeExistente) {
        console.log('📝 Atualizando atividade existente:', atividadeExistente.id);
        return await this.atualizarAtividade(atividadeExistente.id, {
          tecnico_responsavel_id: dadosAtividade.tecnico_responsavel_id || etapa.responsavel_id,
          data_programada: dadosAtividade.data_programada || etapa.data_inicio,
          observacoes: dadosAtividade.observacoes
        });
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
      // Calcular primeiro e último dia do mês
      const primeiroDia = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
      const ultimoDia = new Date(ano, mes, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('execucao_planejamento_macro')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo)
        `)
        .or(`data_inicio.gte.${primeiroDia},data_fim.gte.${primeiroDia}`)
        .or(`data_inicio.lte.${ultimoDia},data_fim.lte.${ultimoDia}`)
        .order('data_inicio', { ascending: true });

      if (error) throw error;
      
      // Filtrar apenas planejamentos que intersectam com o mês
      const planejamentosFiltrados = data.filter(p => {
        const inicio = new Date(p.data_inicio);
        const fim = p.data_fim ? new Date(p.data_fim) : inicio;
        const inicioMes = new Date(ano, mes - 1, 1);
        const fimMes = new Date(ano, mes, 0);
        
        // Verifica se há interseção entre o período do planejamento e o mês
        return inicio <= fimMes && fim >= inicioMes;
      });

      return { success: true, data: planejamentosFiltrados };
    } catch (error) {
      console.error('Erro ao listar planejamento macro:', error);
      return { success: false, message: error.message };
    }
  },

  // ==========================================
  // ESTATÍSTICAS
  // ==========================================

  async buscarEstatisticasDia(data = null) {
    const hoje = data || new Date().toISOString().split('T')[0];
    
    try {
      // Buscar atividades do dia + atrasadas (incluindo pausadas) + concluídas hoje
      const { data: atividades, error } = await supabase
        .from('execucao_atividades')
        .select('status, prioridade, data_programada, updated_at')
        .or(`data_programada.eq.${hoje},and(data_programada.lt.${hoje},status.in.(pendente,em_andamento,pausada)),and(status.eq.concluida,updated_at.gte.${hoje})`);

      if (error) throw error;

      // Separar atrasadas para contagem (inclui pausadas também)
      const atrasadas = atividades.filter(a => 
        a.data_programada < hoje && 
        (a.status === 'pendente' || a.status === 'em_andamento' || a.status === 'pausada')
      );

      // Atividades concluídas hoje (independente da data programada)
      const concluidasHoje = atividades.filter(a => 
        a.status === 'concluida' && 
        a.updated_at?.startsWith(hoje)
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
        .select('*', { count: 'exact', head: true })
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

  // Criar notificação de atraso (para atividades que passaram da data programada)
  async verificarECriarNotificacoesAtraso() {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      // Buscar atividades atrasadas que ainda não têm notificação de atraso recente
      const { data: atrasadas, error } = await supabase
        .from('execucao_atividades')
        .select(`
          id, titulo, data_programada, status,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo)
        `)
        .lt('data_programada', hoje)
        .in('status', ['pendente', 'em_andamento', 'pausada']);

      if (error) throw error;

      // Para cada atividade atrasada, verificar se já existe notificação de atraso hoje
      for (const atividade of atrasadas || []) {
        const { data: notificacaoExistente } = await supabase
          .from('execucao_notificacoes')
          .select('id')
          .eq('atividade_id', atividade.id)
          .eq('tipo', 'atraso')
          .gte('created_at', hoje)
          .limit(1);

        if (!notificacaoExistente || notificacaoExistente.length === 0) {
          const tecnicoNome = atividade.tecnico?.nome_completo || 'Sem técnico';
          await this.criarNotificacao({
            tipo: 'atraso',
            titulo: '⚠️ Atividade em Atraso',
            mensagem: `A atividade "${atividade.titulo}" (${tecnicoNome}) está atrasada desde ${new Date(atividade.data_programada).toLocaleDateString('pt-BR')}`,
            atividade_id: atividade.id,
            usuario_origem_id: null
          });
        }
      }

      return { success: true, count: atrasadas?.length || 0 };
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

      for (const arquivo of arquivos) {
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const nomeArquivo = `${obraId}/${timestamp}_${arquivo.name}`;
        
        // Upload para o Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('obras-arquivos')
          .upload(nomeArquivo, arquivo, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          continue;
        }

        // Salvar referência no banco
        const { data: arquivoData, error: dbError } = await supabase
          .from('execucao_obras_arquivos')
          .insert([{
            obra_id: obraId,
            nome: arquivo.name.replace('.pdf', ''),
            nome_arquivo_original: arquivo.name,
            caminho_storage: nomeArquivo,
            tamanho_bytes: arquivo.size,
            mime_type: arquivo.type || 'application/pdf'
          }])
          .select()
          .single();

        if (dbError) {
          console.error('Erro ao salvar referência:', dbError);
          continue;
        }

        resultados.push(arquivoData);
      }

      return { success: true, data: resultados };
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

  // Obter URL pública de um arquivo
  async obterUrlArquivo(caminhoStorage) {
    try {
      const { data } = supabase.storage
        .from('obras-arquivos')
        .getPublicUrl(caminhoStorage);

      return { success: true, url: data.publicUrl };
    } catch (error) {
      console.error('Erro ao obter URL:', error);
      return { success: false, message: error.message };
    }
  },

  // Excluir arquivo
  async excluirArquivoObra(arquivoId, caminhoStorage) {
    try {
      // Excluir do Storage
      const { error: storageError } = await supabase.storage
        .from('obras-arquivos')
        .remove([caminhoStorage]);

      if (storageError) {
        console.error('Erro ao excluir do storage:', storageError);
      }

      // Excluir do banco
      const { error: dbError } = await supabase
        .from('execucao_obras_arquivos')
        .delete()
        .eq('id', arquivoId);

      if (dbError) throw dbError;
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

      // Se itens foram enviados, atualizar todos
      if (itens !== undefined) {
        // Excluir itens antigos
        const { error: deleteError } = await supabase
          .from('execucao_templates_etapas_itens')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) throw deleteError;

        // Inserir novos itens
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
      const { id, created_at, updated_at, itens, ...dadosTemplate } = original;
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

export default execucaoService;
