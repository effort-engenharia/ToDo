import { supabase } from './config.js';

// Serviços para apontamentos comerciais
export const apontamentosService = {
  // Criar novo apontamento
  async criarApontamento(dadosApontamento) {
    try {
      // Função auxiliar para normalizar strings para uppercase
      const normalizar = (valor) => valor ? valor.toString().toUpperCase().trim() : valor;

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .insert([{
          cnpj_cliente: dadosApontamento.cnpjCliente,
          razao_social: normalizar(dadosApontamento.razaoSocial),
          nome_fantasia: normalizar(dadosApontamento.nomeFantasia),
          logradouro: normalizar(dadosApontamento.logradouro),
          numero: dadosApontamento.numero,
          bairro: normalizar(dadosApontamento.bairro),
          municipio: normalizar(dadosApontamento.municipio),
          uf: normalizar(dadosApontamento.uf),
          cep: dadosApontamento.cep,
          tipo_oportunidade: normalizar(dadosApontamento.tipoOportunidade),
          nome_cliente: normalizar(dadosApontamento.nomeCliente),
          contato_cliente: dadosApontamento.contatoCliente,
          fase: normalizar(dadosApontamento.fase),
          origem_cliente: normalizar(dadosApontamento.origemCliente),
          origem_outros: normalizar(dadosApontamento.origemOutros),
          proprietario_relacionamento: normalizar(dadosApontamento.proprietarioRelacionamento),
          valor_total_servico: dadosApontamento.valorTotalServico,
          valor_entrada_servico: dadosApontamento.valorEntradaServico,
          quantidade_parcelas: parseInt(dadosApontamento.quantidadeParcelas),
          cidade_atendimento: normalizar(dadosApontamento.cidadeAtendimento),
          cidade_outras: normalizar(dadosApontamento.cidadeOutras),
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
          numero,
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
      // Função auxiliar para normalizar strings para uppercase
      const normalizar = (valor) => valor ? valor.toString().toUpperCase().trim() : valor;

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
        'contato_cliente': 'contatoCliente',
        'valor_total_servico': 'valorTotalServico',
        'valor_entrada_servico': 'valorEntradaServico',
        'quantidade_parcelas': 'quantidadeParcelas',
        'cidade_atendimento': 'cidadeAtendimento',
        'cidade_outras': 'cidadeOutras',
        'cronograma_data_inicio': 'cronogramaDataInicio',
        'cronograma_data_termino': 'cronogramaDataTermino',
        'cep': 'cep',
        'logradouro': 'logradouro',
        'numero': 'numero',
        'bairro': 'bairro',
        'municipio': 'municipio',
        'uf': 'uf',
        'cnpj_cliente': 'cnpjCliente',
        'razao_social': 'razaoSocial',
        'nome_fantasia': 'nomeFantasia'
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
          tipo_oportunidade: normalizar(dadosAtualizacao.tipoOportunidade),
          nome_cliente: normalizar(dadosAtualizacao.nomeCliente),
          contato_cliente: dadosAtualizacao.contatoCliente,
          fase: normalizar(dadosAtualizacao.fase),
          origem_cliente: normalizar(dadosAtualizacao.origemCliente),
          origem_outros: normalizar(dadosAtualizacao.origemOutros),
          proprietario_relacionamento: normalizar(dadosAtualizacao.proprietarioRelacionamento),
          valor_total_servico: dadosAtualizacao.valorTotalServico,
          valor_entrada_servico: dadosAtualizacao.valorEntradaServico,
          quantidade_parcelas: parseInt(dadosAtualizacao.quantidadeParcelas),
          cidade_atendimento: normalizar(dadosAtualizacao.cidadeAtendimento),
          cidade_outras: normalizar(dadosAtualizacao.cidadeOutras),
          cronograma_data_inicio: dadosAtualizacao.cronogramaDataInicio || null,
          cronograma_data_termino: dadosAtualizacao.cronogramaDataTermino || null,
          cep: dadosAtualizacao.cep,
          logradouro: normalizar(dadosAtualizacao.logradouro),
          numero: dadosAtualizacao.numero,
          bairro: normalizar(dadosAtualizacao.bairro),
          municipio: normalizar(dadosAtualizacao.municipio),
          uf: normalizar(dadosAtualizacao.uf),
          cnpj_cliente: dadosAtualizacao.cnpjCliente,
          razao_social: normalizar(dadosAtualizacao.razaoSocial),
          nome_fantasia: normalizar(dadosAtualizacao.nomeFantasia)
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

  // Registrar alinhamento realizado (com suporte a data de retomada)
  async registrarAlinhamento(apontamentoId, dataRetomada = null, observacaoRetomada = null) {
    try {
      const agora = new Date();
      
      // Verificar registro atual
      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('ultimo_alinhamento_realizado, data_retomada_prevista')
        .eq('id', apontamentoId)
        .single();

      if (errorBusca) {
        console.error('Erro ao buscar registro atual:', errorBusca);
        throw errorBusca;
      }

      // Verificar se já foi realizado alinhamento hoje
      // EXCEÇÃO: Permitir se o apontamento tem data de retomada agendada (está em Próximos Eventos)
      // Isso permite reagendar ou concluir eventos já agendados
      if (registroAtual.ultimo_alinhamento_realizado && !registroAtual.data_retomada_prevista) {
        const ultimoAlinhamento = new Date(registroAtual.ultimo_alinhamento_realizado);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        ultimoAlinhamento.setHours(0, 0, 0, 0);
        
        if (ultimoAlinhamento.getTime() === hoje.getTime()) {
          throw new Error('Alinhamento já foi realizado hoje para este apontamento');
        }
      }

      // Preparar dados de atualização
      const updateData = {
        ultimo_alinhamento_realizado: agora.toISOString(),
        updated_at: agora.toISOString()
      };

      // Adicionar data de retomada se fornecida
      if (dataRetomada) {
        updateData.data_retomada_prevista = dataRetomada;
        updateData.observacao_retomada = observacaoRetomada || null;
      } else {
        // Se não há data de retomada, limpar campos anteriores
        updateData.data_retomada_prevista = null;
        updateData.observacao_retomada = null;
      }

      // Atualizar o campo de último alinhamento e updated_at
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update(updateData)
        .eq('id', apontamentoId)
        .select();

      if (error) {
        console.error('Erro ao registrar alinhamento:', error);
        throw error;
      }

      // Registrar no histórico de alterações
      let valorNovo = `Realizado em ${agora.toLocaleString('pt-BR')}`;
      if (dataRetomada) {
        const dataFormatada = new Date(dataRetomada + 'T00:00:00').toLocaleDateString('pt-BR');
        valorNovo += ` | Retomada agendada: ${dataFormatada}`;
        if (observacaoRetomada) {
          valorNovo += ` | Obs: ${observacaoRetomada}`;
        }
      }

      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: apontamentoId,
          campo_alterado: 'alinhamento_realizado',
          valor_anterior: 'Não realizado',
          valor_novo: valorNovo,
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
  },

  // Buscar apontamentos esquecidos (sem atualização há mais de 8 dias OU com data de retomada vencida há mais de 8 dias)
  async buscarApontamentosEsquecidos(diasSemAtualizacao = 8) {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const dataLimiteUpdated = new Date();
      dataLimiteUpdated.setDate(dataLimiteUpdated.getDate() - diasSemAtualizacao);

      const dataLimiteRetomada = new Date();
      dataLimiteRetomada.setDate(dataLimiteRetomada.getDate() - diasSemAtualizacao);
      const dataLimiteRetomadaStr = dataLimiteRetomada.toISOString().split('T')[0];

      // Buscar todos os apontamentos em fases ativas
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select('id, nome_cliente, proprietario_relacionamento, fase, tipo_oportunidade, updated_at, valor_total_servico, data_retomada_prevista, observacao_retomada')
        .in('fase', ['PROSPECÇÃO', 'QUALIFICAÇÃO', 'NEGOCIAÇÃO'])
        .order('updated_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar apontamentos esquecidos:', error);
        throw error;
      }

      // Filtrar e calcular dias de atraso
      const agora = new Date();
      const esquecidos = data.filter(item => {
        // Se tem data de retomada prevista
        if (item.data_retomada_prevista) {
          const dataRetomada = new Date(item.data_retomada_prevista + 'T00:00:00');
          // Só é esquecido se passou 8 dias da data de retomada
          const diffTime = agora - dataRetomada;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= diasSemAtualizacao;
        } else {
          // Sem data de retomada: usa lógica antiga (updated_at)
          const updatedAt = new Date(item.updated_at);
          return updatedAt < dataLimiteUpdated;
        }
      }).map(item => {
        let diasAtraso;
        let dataReferencia;
        
        if (item.data_retomada_prevista) {
          // Calcular dias desde a data de retomada
          const dataRetomada = new Date(item.data_retomada_prevista + 'T00:00:00');
          const diffTime = agora - dataRetomada;
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          dataReferencia = 'retomada';
        } else {
          // Calcular dias desde última atualização
          const updatedAt = new Date(item.updated_at);
          const diffTime = Math.abs(agora - updatedAt);
          diasAtraso = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          dataReferencia = 'atualizacao';
        }
        
        return {
          ...item,
          dias_sem_atualizacao: diasAtraso,
          tipo_atraso: dataReferencia
        };
      });

      return esquecidos;
    } catch (error) {
      console.error('Erro no serviço de apontamentos esquecidos:', error);
      throw error;
    }
  },

  // Buscar próximos eventos (apontamentos com data de retomada futura ou hoje)
  async buscarProximosEventos() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split('T')[0];

      // Data limite: 8 dias após hoje (para não mostrar retomadas muito distantes)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 8);
      const dataLimiteStr = dataLimite.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select('id, nome_cliente, proprietario_relacionamento, fase, tipo_oportunidade, updated_at, valor_total_servico, data_retomada_prevista, observacao_retomada')
        .in('fase', ['PROSPECÇÃO', 'QUALIFICAÇÃO', 'NEGOCIAÇÃO'])
        .not('data_retomada_prevista', 'is', null)
        .gte('data_retomada_prevista', hojeStr)
        .lt('data_retomada_prevista', dataLimiteStr)
        .order('data_retomada_prevista', { ascending: true });

      if (error) {
        console.error('Erro ao buscar próximos eventos:', error);
        throw error;
      }

      // Calcular dias até a retomada
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);
      
      const eventosComDias = data.map(item => {
        const dataRetomada = new Date(item.data_retomada_prevista + 'T00:00:00');
        const diffTime = dataRetomada - agora;
        const diasAteRetomada = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...item,
          dias_ate_retomada: diasAteRetomada
        };
      });

      return eventosComDias;
    } catch (error) {
      console.error('Erro no serviço de próximos eventos:', error);
      throw error;
    }
  }
};