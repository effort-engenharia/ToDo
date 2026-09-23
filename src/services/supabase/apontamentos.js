import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';

// Serviços para apontamentos comerciais
const _apontamentosService = {
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
          cronograma_data_termino,
          ativo,
          motivo_inativacao,
          duplicado_de
        `)
        .order('created_at', { ascending: false });

      // Por padrão, buscar apenas registros ativos (a menos que explicitamente solicite todos)
      if (filtros.incluirInativos !== true) {
        query = query.eq('ativo', true);
      }

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

  // Reagendar evento (apenas move data_retomada_prevista para outra data — não conta como alinhamento realizado)
  async reagendarEvento(apontamentoId, novaData, observacao) {
    if (!novaData) throw new Error('Nova data é obrigatória para reagendar');
    if (!observacao || !observacao.trim()) throw new Error('Observação é obrigatória para reagendar');
    try {
      const agora = new Date();

      // Buscar data anterior para o histórico
      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('data_retomada_prevista, observacao_retomada')
        .eq('id', apontamentoId)
        .single();
      if (errorBusca) throw errorBusca;

      const dataAnteriorStr = registroAtual.data_retomada_prevista
        ? new Date(registroAtual.data_retomada_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
        : 'sem data';
      const dataNovaStr = new Date(novaData + 'T00:00:00').toLocaleDateString('pt-BR');

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          data_retomada_prevista: novaData,
          observacao_retomada: observacao.trim(),
          updated_at: agora.toISOString()
        })
        .eq('id', apontamentoId)
        .select();
      if (error) throw error;

      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: apontamentoId,
          campo_alterado: 'reagendamento_evento',
          valor_anterior: dataAnteriorStr,
          valor_novo: `${dataNovaStr} | Motivo: ${observacao.trim()}`,
          data_alteracao: agora.toISOString()
        });
      if (errorHistorico) console.error('Erro ao salvar histórico de reagendamento:', errorHistorico);

      window.dispatchEvent(new CustomEvent('apontamento-updated', { detail: data[0] }));
      return data[0];
    } catch (error) {
      console.error('Erro no serviço de reagendamento:', error);
      throw error;
    }
  },

  // Cancelar evento agendado (limpa data_retomada_prevista — apontamento continua ativo na fase atual)
  async cancelarEvento(apontamentoId, observacao) {
    if (!observacao || !observacao.trim()) throw new Error('Observação é obrigatória para cancelar o evento');
    try {
      const agora = new Date();

      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('data_retomada_prevista')
        .eq('id', apontamentoId)
        .single();
      if (errorBusca) throw errorBusca;

      const dataAnteriorStr = registroAtual.data_retomada_prevista
        ? new Date(registroAtual.data_retomada_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
        : 'sem data';

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          data_retomada_prevista: null,
          observacao_retomada: null,
          updated_at: agora.toISOString()
        })
        .eq('id', apontamentoId)
        .select();
      if (error) throw error;

      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: apontamentoId,
          campo_alterado: 'cancelamento_evento',
          valor_anterior: dataAnteriorStr,
          valor_novo: `Evento cancelado | Motivo: ${observacao.trim()}`,
          data_alteracao: agora.toISOString()
        });
      if (errorHistorico) console.error('Erro ao salvar histórico de cancelamento:', errorHistorico);

      window.dispatchEvent(new CustomEvent('apontamento-updated', { detail: data[0] }));
      return data[0];
    } catch (error) {
      console.error('Erro no serviço de cancelamento de evento:', error);
      throw error;
    }
  },

  // Concluir evento mudando a fase (CONTRATO/VENDA ou CANCELADO/PERCA).
  // Apontamento continua ativo — a fase muda e a agenda é encerrada.
  async concluirEventoMudandoFase(apontamentoId, novaFase, observacao) {
    if (!novaFase) throw new Error('Nova fase é obrigatória');
    if (!observacao || !observacao.trim()) throw new Error('Observação é obrigatória');
    const fasesPermitidas = ['CONTRATO/VENDA', 'CANCELADO/PERCA'];
    if (!fasesPermitidas.includes(novaFase)) {
      throw new Error(`Fase inválida para conclusão de evento: ${novaFase}`);
    }
    try {
      const agora = new Date();

      const { data: registroAtual, error: errorBusca } = await supabase
        .from('apontamentos_comerciais')
        .select('fase')
        .eq('id', apontamentoId)
        .single();
      if (errorBusca) throw errorBusca;

      const faseAnterior = registroAtual.fase;

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          fase: novaFase,
          data_retomada_prevista: null,
          observacao_retomada: null,
          ultimo_alinhamento_realizado: agora.toISOString(),
          updated_at: agora.toISOString()
        })
        .eq('id', apontamentoId)
        .select();
      if (error) throw error;

      // Dois registros de histórico: mudança de fase + alinhamento realizado (contextualiza a decisão)
      const registrosHistorico = [
        {
          apontamento_id: apontamentoId,
          campo_alterado: 'fase',
          valor_anterior: faseAnterior,
          valor_novo: novaFase,
          data_alteracao: agora.toISOString()
        },
        {
          apontamento_id: apontamentoId,
          campo_alterado: 'alinhamento_realizado',
          valor_anterior: 'Não realizado',
          valor_novo: `Realizado em ${agora.toLocaleString('pt-BR')} | Conclusão: ${novaFase} | Obs: ${observacao.trim()}`,
          data_alteracao: agora.toISOString()
        }
      ];
      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert(registrosHistorico);
      if (errorHistorico) console.error('Erro ao salvar histórico de conclusão:', errorHistorico);

      window.dispatchEvent(new CustomEvent('apontamento-updated', { detail: data[0] }));
      window.dispatchEvent(new CustomEvent('apontamento-alignment', { detail: data[0] }));
      return data[0];
    } catch (error) {
      console.error('Erro no serviço de conclusão de evento:', error);
      throw error;
    }
  },

  // Contar quantas vezes um evento já foi reagendado (usa histórico)
  async contarReagendamentos(apontamentoId) {
    try {
      const { count, error } = await supabase
        .from('historico_alteracoes_apontamentos')
        .select('*', { count: 'exact', head: true })
        .eq('apontamento_id', apontamentoId)
        .eq('campo_alterado', 'reagendamento_evento');
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Erro ao contar reagendamentos:', error);
      return 0;
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
        `)
        .eq('ativo', true);

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

  // Buscar apontamentos esquecidos.
  // Nova regra:
  //  - Se tem data_retomada_prevista: é esquecido a partir do momento em que a data agendada JÁ PASSOU
  //    (o vendedor escolheu o prazo; passou do prazo, o alarme dispara — sem tolerância adicional).
  //  - Se NÃO tem data_retomada_prevista (registros legados anteriores à nova UX):
  //    usa o último alinhamento realizado (ou created_at como fallback) e considera esquecido após `diasSemContato` dias.
  // IMPORTANTE: não usamos mais `updated_at` como base — edições cadastrais (endereço, valor, etc.)
  // não devem mais zerar o timer de contato.
  async buscarApontamentosEsquecidos(diasSemContato = 8) {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataLimiteContato = new Date();
      dataLimiteContato.setHours(0, 0, 0, 0);
      dataLimiteContato.setDate(dataLimiteContato.getDate() - diasSemContato);

      // Buscar todos os apontamentos ativos em fases operacionais
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select('id, nome_cliente, proprietario_relacionamento, fase, tipo_oportunidade, updated_at, created_at, ultimo_alinhamento_realizado, valor_total_servico, data_retomada_prevista, observacao_retomada')
        .eq('ativo', true)
        .in('fase', ['PROSPECÇÃO', 'QUALIFICAÇÃO', 'NEGOCIAÇÃO']);

      if (error) {
        console.error('Erro ao buscar apontamentos esquecidos:', error);
        throw error;
      }

      const esquecidos = data
        .map(item => {
          // Caso 1: retomada agendada — venceu?
          if (item.data_retomada_prevista) {
            const dataRetomada = new Date(item.data_retomada_prevista + 'T00:00:00');
            const diffMs = hoje - dataRetomada;
            const diasVencido = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diasVencido < 1) return null; // ainda não venceu (hoje ou futuro)
            return {
              ...item,
              dias_sem_atualizacao: diasVencido,
              tipo_atraso: 'retomada'
            };
          }

          // Caso 2: legado sem retomada — usa último alinhamento (ou created_at)
          const referenciaStr = item.ultimo_alinhamento_realizado || item.created_at;
          if (!referenciaStr) return null;
          const referencia = new Date(referenciaStr);
          if (referencia >= dataLimiteContato) return null; // ainda dentro do prazo
          const diffMs = hoje - referencia;
          const diasSem = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          return {
            ...item,
            dias_sem_atualizacao: diasSem,
            tipo_atraso: item.ultimo_alinhamento_realizado ? 'sem_alinhamento' : 'nunca_alinhado'
          };
        })
        .filter(Boolean)
        // Mais atrasado primeiro (o time percebeu que ordem por dias faz mais sentido do que por updated_at)
        .sort((a, b) => b.dias_sem_atualizacao - a.dias_sem_atualizacao);

      return esquecidos;
    } catch (error) {
      console.error('Erro no serviço de apontamentos esquecidos:', error);
      throw error;
    }
  },

  // Buscar próximos eventos: TODAS as retomadas agendadas para hoje ou futuro.
  // Sem teto superior — se o vendedor agendou para daqui a 60 dias, aparece.
  async buscarProximosEventos() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select('id, nome_cliente, proprietario_relacionamento, fase, tipo_oportunidade, updated_at, valor_total_servico, data_retomada_prevista, observacao_retomada')
        .eq('ativo', true)
        .in('fase', ['PROSPECÇÃO', 'QUALIFICAÇÃO', 'NEGOCIAÇÃO'])
        .not('data_retomada_prevista', 'is', null)
        .gte('data_retomada_prevista', hojeStr)
        .order('data_retomada_prevista', { ascending: true });

      if (error) {
        console.error('Erro ao buscar próximos eventos:', error);
        throw error;
      }

      // Calcular dias até a retomada (0 = hoje, 1 = amanhã, …)
      const eventosComDias = data.map(item => {
        const dataRetomada = new Date(item.data_retomada_prevista + 'T00:00:00');
        const diffTime = dataRetomada - hoje;
        const diasAteRetomada = Math.round(diffTime / (1000 * 60 * 60 * 24));
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
  },

  // Buscar duplicados com critérios configuráveis
  async buscarDuplicados(criterios = ['nome_cliente', 'tipo_oportunidade']) {
    try {
      // Buscar todos os registros ativos
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .select(`
          id,
          nome_cliente,
          tipo_oportunidade,
          fase,
          origem_cliente,
          proprietario_relacionamento,
          valor_total_servico,
          valor_entrada_servico,
          cidade_atendimento,
          created_at,
          updated_at,
          ativo
        `)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar registros para duplicados:', error);
        throw error;
      }

      // Agrupar por critérios selecionados
      const grupos = {};
      
      data.forEach(registro => {
        // Criar chave de agrupamento normalizada (case-insensitive, trim)
        const chave = criterios.map(criterio => {
          const valor = registro[criterio];
          if (valor === null || valor === undefined) return '';
          return valor.toString().toUpperCase().trim();
        }).join('|||');
        
        if (!grupos[chave]) {
          grupos[chave] = [];
        }
        grupos[chave].push(registro);
      });

      // Filtrar apenas grupos com mais de 1 registro (duplicados)
      const duplicados = Object.entries(grupos)
        .filter(([_, registros]) => registros.length > 1)
        .map(([chave, registros]) => ({
          chave,
          criteriosUsados: criterios,
          quantidade: registros.length,
          registros: registros.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        }))
        .sort((a, b) => b.quantidade - a.quantidade);

      return {
        totalGrupos: duplicados.length,
        totalRegistrosDuplicados: duplicados.reduce((sum, g) => sum + g.quantidade, 0),
        grupos: duplicados
      };
    } catch (error) {
      console.error('Erro no serviço de busca de duplicados:', error);
      throw error;
    }
  },

  // Inativar apontamento (marcar como duplicado)
  async inativarApontamento(id, motivo, duplicadoDeId = null) {
    try {
      const agora = new Date();

      // Atualizar o registro para inativo
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          ativo: false,
          motivo_inativacao: motivo,
          duplicado_de: duplicadoDeId,
          updated_at: agora.toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao inativar apontamento:', error);
        throw error;
      }

      // Registrar no histórico de alterações
      const { error: errorHistorico } = await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: id,
          campo_alterado: 'ativo',
          valor_anterior: 'true',
          valor_novo: 'false',
          data_alteracao: agora.toISOString()
        });

      if (errorHistorico) {
        console.error('Erro ao salvar histórico de inativação:', errorHistorico);
        // Não falhar a operação por causa do histórico
      }

      // Disparar evento de atualização
      window.dispatchEvent(new CustomEvent('apontamento-inativado', { 
        detail: data[0] 
      }));

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de inativação:', error);
      throw error;
    }
  },

  // Inativar múltiplos apontamentos de uma vez
  async inativarMultiplos(ids, motivo, manterRegistroId = null) {
    try {
      const resultados = [];
      
      for (const id of ids) {
        if (id === manterRegistroId) continue; // Pular o registro que será mantido
        
        const resultado = await this.inativarApontamento(id, motivo, manterRegistroId);
        resultados.push(resultado);
      }

      return {
        success: true,
        inativados: resultados.length,
        registros: resultados
      };
    } catch (error) {
      console.error('Erro ao inativar múltiplos:', error);
      throw error;
    }
  },

  // Reativar apontamento (reverter inativação)
  async reativarApontamento(id) {
    try {
      const agora = new Date();

      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .update({
          ativo: true,
          motivo_inativacao: null,
          duplicado_de: null,
          updated_at: agora.toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao reativar apontamento:', error);
        throw error;
      }

      // Registrar no histórico
      await supabase
        .from('historico_alteracoes_apontamentos')
        .insert({
          apontamento_id: id,
          campo_alterado: 'ativo',
          valor_anterior: 'false',
          valor_novo: 'true',
          data_alteracao: agora.toISOString()
        });

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de reativação:', error);
      throw error;
    }
  }
};
export const apontamentosService = wrapServiceWithImpersonationGuard(_apontamentosService, {
  label: 'apontamentosService',
  throwOnBlock: true
});

export default apontamentosService;
