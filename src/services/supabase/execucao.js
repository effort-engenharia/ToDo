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
      const { data, error } = await supabase
        .from('execucao_obras')
        .insert([obra])
        .select(`
          *,
          responsavel:usuarios!responsavel_id(id, nome_completo, email)
        `)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar obra:', error);
      return { success: false, message: error.message };
    }
  },

  // Atualizar obra
  async atualizarObra(id, atualizacoes) {
    try {
      const { data, error } = await supabase
        .from('execucao_obras')
        .update({
          ...atualizacoes,
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

  // Excluir obra
  async excluirObra(id) {
    try {
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
      // Buscar obra_id antes de excluir
      const { data: etapa } = await supabase
        .from('execucao_obras_etapas')
        .select('obra_id')
        .eq('id', id)
        .single();

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

  // Criar atividade a partir de uma etapa (integração com agendas)
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

      // Criar atividade com dados da etapa + dados personalizados
      const atividade = {
        titulo: dadosAtividade.titulo || etapa.nome,
        descricao: dadosAtividade.descricao || etapa.descricao,
        tipo_execucao: etapa.tipo === 'geral' || etapa.tipo === 'administrativo' ? 'eletrica' : etapa.tipo,
        data_programada: dadosAtividade.data_programada || etapa.data_inicio,
        hora_inicio: dadosAtividade.hora_inicio || '08:00',
        hora_fim: dadosAtividade.hora_fim || '17:00',
        prioridade: dadosAtividade.prioridade || 'normal',
        tecnico_responsavel_id: dadosAtividade.tecnico_responsavel_id || etapa.responsavel_id,
        cliente_nome: etapa.obra?.nome_cliente,
        endereco: etapa.obra?.endereco,
        observacoes: dadosAtividade.observacoes || `Etapa: ${etapa.nome}`,
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
  }
};

export default execucaoService;
