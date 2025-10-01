import { supabase } from './config.js';

// Serviços para apontamentos comerciais
export const apontamentosService = {
  // Criar novo apontamento
  async criarApontamento(dadosApontamento) {
    try {
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .insert([{
          cnpj_cliente: dadosApontamento.cnpjCliente,
          razao_social: dadosApontamento.razaoSocial,
          nome_fantasia: dadosApontamento.nomeFantasia,
          logradouro: dadosApontamento.logradouro,
          bairro: dadosApontamento.bairro,
          municipio: dadosApontamento.municipio,
          uf: dadosApontamento.uf,
          cep: dadosApontamento.cep,
          tipo_oportunidade: dadosApontamento.tipoOportunidade,
          nome_cliente: dadosApontamento.nomeCliente,
          fase: dadosApontamento.fase,
          origem_cliente: dadosApontamento.origemCliente,
          origem_outros: dadosApontamento.origemOutros,
          proprietario_relacionamento: dadosApontamento.proprietarioRelacionamento,
          valor_total_servico: dadosApontamento.valorTotalServico,
          valor_entrada_servico: dadosApontamento.valorEntradaServico,
          quantidade_parcelas: parseInt(dadosApontamento.quantidadeParcelas),
          cidade_atendimento: dadosApontamento.cidadeAtendimento,
          cidade_outras: dadosApontamento.cidadeOutras,
          cronograma_data_inicio: dadosApontamento.cronogramaDataInicio,
          cronograma_data_termino: dadosApontamento.cronogramaDataTermino
        }])
        .select();

      if (error) {
        console.error('Erro ao criar apontamento:', error);
        throw error;
      }

      // Disparar evento de atualização para o dashboard
      console.log('📤 Disparando evento apontamento-created para forçar atualização do dashboard');
      window.dispatchEvent(new CustomEvent('apontamento-created', { 
        detail: data[0] 
      }));

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de criação de apontamento:', error);
      throw error;
    }
  },

  // Buscar apontamentos
  async buscarApontamentos(filtros = {}) {
    try {
      let query = supabase
        .from('apontamentos_comerciais')
        .select(`
          *, 
          ultimo_alinhamento_realizado,
          cnpj_cliente,
          razao_social,
          nome_fantasia,
          logradouro,
          bairro,
          municipio,
          uf,
          cep,
          cronograma_data_inicio,
          cronograma_data_termino
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros se fornecidos
      if (filtros.fase) {
        query = query.eq('fase', filtros.fase);
      }

      if (filtros.proprietario) {
        query = query.eq('proprietario_relacionamento', filtros.proprietario);
      }

      if (filtros.tipo) {
        query = query.eq('tipo_oportunidade', filtros.tipo);
      }

      if (filtros.pesquisa) {
        query = query.or(`nome_cliente.ilike.%${filtros.pesquisa}%,tipo_oportunidade.ilike.%${filtros.pesquisa}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar apontamentos:', error);
        throw error;
      }

      // Calcular se pode realizar alinhamento para cada registro
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataComStatus = data.map(apontamento => ({
        ...apontamento,
        pode_realizar_alinhamento: !apontamento.ultimo_alinhamento_realizado || 
          new Date(apontamento.ultimo_alinhamento_realizado).setHours(0, 0, 0, 0) !== hoje.getTime()
      }));

      return dataComStatus;
    } catch (error) {
      console.error('Erro no serviço de busca de apontamentos:', error);
      throw error;
    }
  },

  // Atualizar apontamento com histórico
  async atualizarApontamento(id, dadosAtualizacao) {
    try {
      // Primeiro, buscar o registro atual para comparar
      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('*')
        .eq('id', id)
        .single();

      if (errorBusca) {
        console.error('Erro ao buscar registro atual:', errorBusca);
        throw errorBusca;
      }

      // Mapear campos para comparação
      const camposMap = {
        'tipo_oportunidade': 'tipoOportunidade',
        'nome_cliente': 'nomeCliente',
        'fase': 'fase',
        'origem_cliente': 'origemCliente',
        'origem_outros': 'origemOutros',
        'proprietario_relacionamento': 'proprietarioRelacionamento',
        'valor_total_servico': 'valorTotalServico',
        'valor_entrada_servico': 'valorEntradaServico',
        'quantidade_parcelas': 'quantidadeParcelas',
        'cidade_atendimento': 'cidadeAtendimento',
        'cidade_outras': 'cidadeOutras',
        'cronograma_data_inicio': 'cronogramaDataInicio',
        'cronograma_data_termino': 'cronogramaDataTermino'
      };

      // Preparar alterações para histórico
      const alteracoes = [];
      
      for (const [campoDb, campoForm] of Object.entries(camposMap)) {
        let valorAtual = registroAtual[campoDb];
        let valorNovo = dadosAtualizacao[campoForm];

        // Tratar conversões especiais
        if (campoDb === 'quantidade_parcelas') {
          valorNovo = parseInt(valorNovo);
        }
        if (campoDb === 'valor_total_servico' || campoDb === 'valor_entrada_servico') {
          valorAtual = parseFloat(valorAtual || 0);
          valorNovo = parseFloat(valorNovo || 0);
        }

        // Verificar se houve alteração
        if (valorAtual !== valorNovo) {
          alteracoes.push({
            apontamento_id: id,
            campo_alterado: campoDb,
            valor_anterior: valorAtual ? valorAtual.toString() : null,
            valor_novo: valorNovo ? valorNovo.toString() : null
          });
        }
      }

      // Atualizar o registro
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          tipo_oportunidade: dadosAtualizacao.tipoOportunidade,
          nome_cliente: dadosAtualizacao.nomeCliente,
          fase: dadosAtualizacao.fase,
          origem_cliente: dadosAtualizacao.origemCliente,
          origem_outros: dadosAtualizacao.origemOutros,
          proprietario_relacionamento: dadosAtualizacao.proprietarioRelacionamento,
          valor_total_servico: dadosAtualizacao.valorTotalServico,
          valor_entrada_servico: dadosAtualizacao.valorEntradaServico,
          quantidade_parcelas: parseInt(dadosAtualizacao.quantidadeParcelas),
          cidade_atendimento: dadosAtualizacao.cidadeAtendimento,
          cidade_outras: dadosAtualizacao.cidadeOutras,
          cronograma_data_inicio: dadosAtualizacao.cronogramaDataInicio,
          cronograma_data_termino: dadosAtualizacao.cronogramaDataTermino
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar apontamento:', error);
        throw error;
      }

      // Inserir histórico de alterações se houver
      if (alteracoes.length > 0) {
        const { error: errorHistorico } = await supabase
          .from('historico_alteracoes_apontamentos')
          .insert(alteracoes);

        if (errorHistorico) {
          console.error('Erro ao salvar histórico:', errorHistorico);
          // Não falhar a operação por causa do histórico
        }
      }

      // Disparar evento de atualização para o dashboard
      console.log('📤 Disparando evento apontamento-updated para forçar atualização do dashboard');
      window.dispatchEvent(new CustomEvent('apontamento-updated', { 
        detail: data[0] 
      }));

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de atualização de apontamento:', error);
      throw error;
    }
  },

  // Buscar histórico de alterações
  async buscarHistoricoAlteracoes(apontamentoId) {
    try {
      const { data, error } = await supabase
        .from('historico_alteracoes_apontamentos')
        .select('*')
        .eq('apontamento_id', apontamentoId)
        .order('data_alteracao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço de histórico:', error);
      throw error;
    }
  },

  // Deletar apontamento
  async deletarApontamento(id) {
    try {
      const { error } = await supabase
        .from('apontamentos_comerciais')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar apontamento:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro no serviço de exclusão de apontamento:', error);
      throw error;
    }
  },

  // Registrar alinhamento realizado
  async registrarAlinhamento(apontamentoId) {
    try {
      const agora = new Date();
      
      // Verificar se já foi realizado alinhamento hoje
      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('ultimo_alinhamento_realizado')
        .eq('id', apontamentoId)
        .single();

      if (errorBusca) {
        console.error('Erro ao buscar registro atual:', errorBusca);
        throw errorBusca;
      }

      // Verificar se já foi realizado alinhamento hoje
      if (registroAtual.ultimo_alinhamento_realizado) {
        const ultimoAlinhamento = new Date(registroAtual.ultimo_alinhamento_realizado);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        ultimoAlinhamento.setHours(0, 0, 0, 0);
        
        if (ultimoAlinhamento.getTime() === hoje.getTime()) {
          throw new Error('Alinhamento já foi realizado hoje para este apontamento');
        }
      }

      // Atualizar o campo de último alinhamento e updated_at
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          ultimo_alinhamento_realizado: agora.toISOString(),
          updated_at: agora.toISOString()
        })
        .eq('id', apontamentoId)
        .select();

      if (error) {
        console.error('Erro ao registrar alinhamento:', error);
        throw error;
      }

      // Registrar no histórico de alterações
      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: apontamentoId,
          campo_alterado: 'alinhamento_realizado',
          valor_anterior: 'Não realizado',
          valor_novo: `Realizado em ${agora.toLocaleString('pt-BR')}`,
          data_alteracao: agora.toISOString()
        });

      if (errorHistorico) {
        console.error('Erro ao salvar histórico de alinhamento:', errorHistorico);
        // Não falhar a operação por causa do histórico
      }

      // Disparar evento de atualização para o dashboard
      console.log('📤 Disparando evento apontamento-alignment para forçar atualização');
      window.dispatchEvent(new CustomEvent('apontamento-alignment', { 
        detail: data[0] 
      }));

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de alinhamento:', error);
      throw error;
    }
  },

  // Buscar estatísticas
  async buscarEstatisticas() {
    try {
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select(`
          fase,
          valor_total_servico,
          valor_entrada_servico,
          proprietario_relacionamento,
          tipo_oportunidade
        `);

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        throw error;
      }

      // Processar estatísticas
      const stats = {
        totalApontamentos: data.length,
        porFase: {},
        porProprietario: {},
        porTipo: {},
        valorTotal: 0,
        valorEntrada: 0
      };

      data.forEach(item => {
        // Contar por fase
        stats.porFase[item.fase] = (stats.porFase[item.fase] || 0) + 1;

        // Contar por proprietário
        if (item.proprietario_relacionamento) {
          stats.porProprietario[item.proprietario_relacionamento] = (stats.porProprietario[item.proprietario_relacionamento] || 0) + 1;
        }

        // Contar por tipo
        stats.porTipo[item.tipo_oportunidade] = (stats.porTipo[item.tipo_oportunidade] || 0) + 1;

        // Somar valores
        stats.valorTotal += parseFloat(item.valor_total_servico || 0);
        stats.valorEntrada += parseFloat(item.valor_entrada_servico || 0);
      });

      return stats;
    } catch (error) {
      console.error('Erro no serviço de estatísticas:', error);
      throw error;
    }
  }
};