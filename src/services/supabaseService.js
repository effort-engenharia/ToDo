import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://cadrulmppoxhsfjizcfy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZHJ1bG1wcG94aHNmaml6Y2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMjI1MDAsImV4cCI6MjA3MzY5ODUwMH0.ojYd2pUsjh35mXx2Iy_MShRPb70rh1t0dC6dkB4XvC4';

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Serviços para apontamentos comerciais
export const apontamentosService = {
  // Criar novo apontamento
  async criarApontamento(dadosApontamento) {
    try {
      const { data, error } = await supabase
        .from('apontamentos_comerciais')
        .insert([{
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
          cidade_outras: dadosApontamento.cidadeOutras
        }])
        .select();

      if (error) {
        console.error('Erro ao criar apontamento:', error);
        throw error;
      }

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
        .select('*')
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

      return data;
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
        'cidade_outras': 'cidadeOutras'
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
          cidade_outras: dadosAtualizacao.cidadeOutras
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

// Serviços para metas comerciais
export const metasService = {
  // Buscar meta por tipo, mês e ano
  async buscarMeta(tipoMeta, mes = null, ano = null) {
    try {
      const agora = new Date();
      const mesAtual = mes || (agora.getMonth() + 1);
      const anoAtual = ano || agora.getFullYear();

      const { data, error } = await supabase
        .from('metas_comerciais')
        .select('*')
        .eq('tipo_meta', tipoMeta)
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
        console.error('Erro ao buscar meta:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço de busca de meta:', error);
      return null;
    }
  },

  // Buscar todas as metas ativas do mês
  async buscarMetasDoMes(mes = null, ano = null) {
    try {
      const agora = new Date();
      const mesAtual = mes || (agora.getMonth() + 1);
      const anoAtual = ano || agora.getFullYear();

      const { data, error } = await supabase
        .from('metas_comerciais')
        .select('*')
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)
        .eq('ativo', true)
        .order('tipo_meta');

      if (error) {
        console.error('Erro ao buscar metas do mês:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de metas do mês:', error);
      throw error;
    }
  },

  // Criar ou atualizar meta
  async salvarMeta(tipoMeta, valorMeta, mes = null, ano = null, observacoes = null) {
    try {
      const agora = new Date();
      const mesAtual = mes || (agora.getMonth() + 1);
      const anoAtual = ano || agora.getFullYear();

      // Primeiro, verificar se já existe uma meta ativa para este tipo/mês/ano
      const metaExistente = await this.buscarMeta(tipoMeta, mesAtual, anoAtual);

      if (metaExistente) {
        // Atualizar meta existente
        const { data, error } = await supabase
          .from('metas_comerciais')
          .update({
            valor_meta: valorMeta,
            observacoes: observacoes,
            updated_at: new Date().toISOString()
          })
          .eq('id', metaExistente.id)
          .select();

        if (error) {
          console.error('Erro ao atualizar meta:', error);
          throw error;
        }

        console.log(`✅ Meta ${tipoMeta} atualizada no Supabase:`, data[0]);
        return data[0];
      } else {
        // Criar nova meta
        const { data, error } = await supabase
          .from('metas_comerciais')
          .insert([{
            tipo_meta: tipoMeta,
            valor_meta: valorMeta,
            mes: mesAtual,
            ano: anoAtual,
            observacoes: observacoes,
            ativo: true
          }])
          .select();

        if (error) {
          console.error('Erro ao criar meta:', error);
          throw error;
        }

        console.log(`✅ Meta ${tipoMeta} criada no Supabase:`, data[0]);
        return data[0];
      }
    } catch (error) {
      console.error('Erro no serviço de salvamento de meta:', error);
      throw error;
    }
  },

  // Desativar meta (não deletar, apenas marcar como inativa)
  async desativarMeta(tipoMeta, mes = null, ano = null) {
    try {
      const agora = new Date();
      const mesAtual = mes || (agora.getMonth() + 1);
      const anoAtual = ano || agora.getFullYear();

      const { data, error } = await supabase
        .from('metas_comerciais')
        .update({
          ativo: false,
          updated_at: new Date().toISOString()
        })
        .eq('tipo_meta', tipoMeta)
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)
        .eq('ativo', true)
        .select();

      if (error) {
        console.error('Erro ao desativar meta:', error);
        throw error;
      }

      console.log(`✅ Meta ${tipoMeta} desativada no Supabase:`, data);
      return data;
    } catch (error) {
      console.error('Erro no serviço de desativação de meta:', error);
      throw error;
    }
  },

  // Buscar histórico de metas
  async buscarHistoricoMetas(tipoMeta, limit = 12) {
    try {
      const { data, error } = await supabase
        .from('metas_comerciais')
        .select('*')
        .eq('tipo_meta', tipoMeta)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar histórico de metas:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de histórico de metas:', error);
      throw error;
    }
  }
};

// Serviços para Arsenal de Guerra
export const arsenalService = {
  // Serviços para Links
  async criarLink(dadosLink) {
    try {
      const { data, error } = await supabase
        .from('arsenal_links')
        .insert([{
          nome: dadosLink.nome,
          url: dadosLink.url
        }])
        .select();

      if (error) {
        console.error('Erro ao criar link:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de criação de link:', error);
      throw error;
    }
  },

  async buscarLinks() {
    try {
      const { data, error } = await supabase
        .from('arsenal_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar links:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de links:', error);
      throw error;
    }
  },

  async atualizarLink(id, dadosLink) {
    try {
      const { data, error } = await supabase
        .from('arsenal_links')
        .update({
          nome: dadosLink.nome,
          url: dadosLink.url
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar link:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de atualização de link:', error);
      throw error;
    }
  },

  async excluirLink(id) {
    try {
      const { error } = await supabase
        .from('arsenal_links')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir link:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro no serviço de exclusão de link:', error);
      throw error;
    }
  },

  // Serviços para Arquivos
  async uploadArquivo(arquivo) {
    try {
      console.log('🔄 Iniciando upload do arquivo:', {
        nome: arquivo.name,
        tamanho: arquivo.size,
        tipo: arquivo.type
      });

      // Validações básicas
      if (!arquivo || !arquivo.name) {
        throw new Error('Arquivo inválido');
      }

      if (arquivo.size === 0) {
        throw new Error('Arquivo está vazio');
      }

      // Limite de 50MB
      if (arquivo.size > 50 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Limite: 50MB');
      }

      const nomeArquivo = `${Date.now()}-${arquivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const caminhoArquivo = `arquivos/${nomeArquivo}`;

      console.log('📁 Fazendo upload para:', caminhoArquivo);

      // Upload do arquivo para o Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('arsenal-arquivos')
        .upload(caminhoArquivo, arquivo, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload do arquivo:', uploadError);
        console.error('Detalhes do erro:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error
        });
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      console.log('✅ Upload realizado com sucesso:', uploadData);

      // Salvar metadados na tabela
      const metadados = {
        nome: arquivo.name,
        nome_arquivo_original: arquivo.name,
        tamanho_bytes: arquivo.size,
        tipo_arquivo: arquivo.type || 'application/octet-stream',
        caminho_storage: caminhoArquivo
      };

      console.log('💾 Salvando metadados:', metadados);

      const { data, error } = await supabase
        .from('arsenal_arquivos')
        .insert([metadados])
        .select();

      if (error) {
        console.error('❌ Erro ao salvar metadados do arquivo:', error);
        // Tentar limpar o arquivo do storage se falhou ao salvar metadados
        try {
          await supabase.storage
            .from('arsenal-arquivos')
            .remove([caminhoArquivo]);
        } catch (cleanupError) {
          console.error('Erro ao limpar arquivo após falha nos metadados:', cleanupError);
        }
        throw new Error(`Erro ao salvar informações do arquivo: ${error.message}`);
      }

      console.log('✅ Arquivo salvo com sucesso:', data[0]);
      return data[0];
    } catch (error) {
      console.error('💥 Erro no serviço de upload de arquivo:', error);
      
      // Melhorar a mensagem de erro para o usuário
      if (error.message.includes('Arquivo muito grande')) {
        throw error;
      } else if (error.message.includes('payload too large')) {
        throw new Error('Arquivo muito grande. Tente um arquivo menor.');
      } else if (error.message.includes('unauthorized')) {
        throw new Error('Não autorizado para fazer upload. Verifique as permissões.');
      } else if (error.message.includes('bucket not found')) {
        throw new Error('Storage não configurado corretamente.');
      } else {
        throw new Error(`Erro inesperado no upload: ${error.message}`);
      }
    }
  },

  async buscarArquivos() {
    try {
      const { data, error } = await supabase
        .from('arsenal_arquivos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar arquivos:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de arquivos:', error);
      throw error;
    }
  },

  async excluirArquivo(id, caminhoStorage) {
    try {
      // Excluir arquivo do Storage
      const { error: storageError } = await supabase.storage
        .from('arsenal-arquivos')
        .remove([caminhoStorage]);

      if (storageError) {
        console.error('Erro ao excluir arquivo do storage:', storageError);
      }

      // Excluir metadados da tabela
      const { error } = await supabase
        .from('arsenal_arquivos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir metadados do arquivo:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro no serviço de exclusão de arquivo:', error);
      throw error;
    }
  },

  async downloadArquivo(caminhoStorage) {
    try {
      const { data, error } = await supabase.storage
        .from('arsenal-arquivos')
        .download(caminhoStorage);

      if (error) {
        console.error('Erro ao baixar arquivo:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço de download de arquivo:', error);
      throw error;
    }
  }
};

// Serviços para administradoras e síndicos profissionais
export const administradorasService = {
  // Buscar administradoras e síndicos
  async buscarAdministradoras(cidade = null) {
    try {
      let query = supabase
        .from('administradoras_sindicos')
        .select('*')
        .order('contato_realizado', { ascending: true })
        .order('nome', { ascending: true });

      if (cidade) {
        query = query.eq('cidade', cidade);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar administradoras:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de administradoras:', error);
      throw error;
    }
  },

  // Criar nova administradora/síndico
  async criarAdministradora(dados) {
    try {
      // Usar upsert (insert ou update) com place_id como chave única
      const { data, error } = await supabase
        .from('administradoras_sindicos')
        .upsert({
          nome: dados.nome,
          endereco: dados.endereco,
          site: dados.site,
          telefone: dados.telefone,
          whatsapp: dados.whatsapp,
          cidade: dados.cidade,
          latitude: dados.latitude,
          longitude: dados.longitude,
          place_id: dados.place_id,
          rating: dados.rating,
          last_google_sync: new Date().toISOString()
        }, {
          onConflict: 'place_id', // Resolver conflitos baseado no place_id
          ignoreDuplicates: false // Atualizar se já existir
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar administradora:', error);
        throw error;
      }

      return data;
    } catch (error) {
      // Tratar erros de duplicata que podem vir do catch também
      if (error.code === '23505' && error.details?.includes('place_id')) {
        console.log(`📋 Administradora "${dados.nome}" já existe no banco (place_id: ${dados.place_id})`);
        return null;
      }
      
      console.error('Erro no serviço de criação de administradora:', error);
      throw error;
    }
  },

  // Atualizar contato realizado
  async atualizarContatoRealizado(id, contatoRealizado) {
    try {
      const { data, error } = await supabase
        .from('administradoras_sindicos')
        .update({ contato_realizado: contatoRealizado })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar contato realizado:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de atualização de contato:', error);
      throw error;
    }
  },

  // Buscar administradoras usando Google Places API
  async buscarAdministradorasGoogle(cidade) {
    try {
      // Carregar Google Maps API se necessário
      await this.carregarGoogleMapsAPI();

      // Verificar se Google Maps API está carregada
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        throw new Error('Google Maps API não está carregada ou Places library não disponível');
      }

      console.log(`🔍 Iniciando busca para ${cidade}`);

      // Palavras-chave para busca
      const palavrasChave = [
        'administradoras de condomínios',
        'administradora de condomínios',
        'administradora predial',
        'gestão condominial',
        'síndico profissional',
        'administradora imobiliária',
        'gestão de condomínios',
        'condomínio administração',
        'consultoria condominial',
        'empresa de administração predial',
        'síndico terceirizado',
        'síndico externo',
        'gestor condominial',
        'consultor condominial',
        'imobiliária',
        'assessoria condominial',
        'consultoria predial',
        'empresa de administração de imóveis'
      ];

      const resultados = [];
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));

      // Buscar coordenadas da cidade primeiro
      const geocoder = new window.google.maps.Geocoder();
      const cidadeCoords = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: `${cidade}, Brasil` }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve(results[0].geometry.location);
          } else {
            reject(new Error(`Não foi possível geocodificar a cidade: ${cidade}`));
          }
        });
      });

      console.log(`📍 Coordenadas de ${cidade}:`, cidadeCoords.lat(), cidadeCoords.lng());

      // Buscar para cada palavra-chave
      for (let i = 0; i < palavrasChave.length; i++) {
        const palavra = palavrasChave[i];
        
        try {
          console.log(`🔍 Buscando: "${palavra}" em ${cidade} (${i + 1}/${palavrasChave.length})`);
          
          const request = {
            query: `${palavra} ${cidade}`,
            location: cidadeCoords,
            radius: 25000, // 25km de raio
            language: 'pt-BR',
            region: 'BR'
          };

          const places = await new Promise((resolve, reject) => {
            service.textSearch(request, (results, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                resolve(results || []);
              } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
              } else {
                console.warn(`⚠️ Erro na busca para "${palavra}": ${status}`);
                resolve([]);
              }
            });
          });

          console.log(`✅ Encontrados ${places.length} resultados para "${palavra}"`);

          for (const place of places) {
            try {
              // Tentar salvar diretamente - se der erro de duplicata, ignorar
              const novaAdministradora = {
                nome: place.name,
                endereco: place.formatted_address || '',
                site: '',
                telefone: '',
                whatsapp: '',
                cidade: cidade,
                latitude: place.geometry?.location?.lat(),
                longitude: place.geometry?.location?.lng(),
                place_id: place.place_id,
                rating: place.rating
              };

              // Buscar detalhes adicionais se necessário
              try {
                const detalhes = await this.buscarDetalhesLugarBrowser(place.place_id, service);
                novaAdministradora.site = detalhes.website || '';
                novaAdministradora.telefone = detalhes.formatted_phone_number || '';
                novaAdministradora.whatsapp = detalhes.formatted_phone_number || '';
              } catch (detError) {
                console.warn(`⚠️ Erro ao buscar detalhes para ${place.name}:`, detError);
              }

              resultados.push(novaAdministradora);
              console.log(`➕ Nova administradora: ${place.name}`);
            } catch (error) {
              console.warn(`❌ Erro ao processar ${place.name}:`, error);
              continue;
            }
          }

          // Pausa entre requests para evitar rate limiting
          if (i < palavrasChave.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn(`❌ Erro na busca para "${palavra}":`, error);
          continue;
        }
      }

      console.log(`🎯 Total de novas administradoras encontradas: ${resultados.length}`);

      // Salvar resultados únicos no banco usando upsert
      const administradorasSalvas = [];
      
      for (const administradora of resultados) {
        try {
          const salva = await this.criarAdministradora(administradora);
          if (salva) {
            administradorasSalvas.push(salva);
            console.log(`💾 Salva: ${administradora.nome}`);
          }
        } catch (error) {
          console.warn('❌ Erro ao salvar administradora:', error);
        }
      }

      console.log(`✨ Processo concluído! ${administradorasSalvas.length} administradoras processadas`);
      return administradorasSalvas;
    } catch (error) {
      console.error('💥 Erro na busca do Google:', error);
      throw error;
    }
  },

  // Função para carregar Google Maps API dinamicamente
  async carregarGoogleMapsAPI() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve(window.google.maps);
        return;
      }
      
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey || apiKey === 'sua_chave_aqui') {
        reject(new Error('API key do Google Maps não configurada'));
        return;
      }
      
      // Remover script anterior se existir
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=pt-BR&region=BR`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('✅ Google Maps API carregada com sucesso');
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps API falhou ao carregar'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Erro ao carregar Google Maps API. Verifique a chave de API.'));
      };
      
      document.head.appendChild(script);
    });
  },

  // Buscar detalhes adicionais de um lugar usando o browser
  async buscarDetalhesLugarBrowser(placeId, service) {
    try {
      const request = {
        placeId: placeId,
        fields: ['website', 'formatted_phone_number', 'international_phone_number']
      };

      return await new Promise((resolve) => {
        service.getDetails(request, (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            resolve({
              website: place.website || '',
              formatted_phone_number: place.formatted_phone_number || '',
              international_phone_number: place.international_phone_number || ''
            });
          } else {
            resolve({});
          }
        });
      });
    } catch (error) {
      console.warn('Erro ao buscar detalhes do lugar:', error);
      return {};
    }
  },

  // Verificar se precisa atualizar dados (semanal)
  async verificarAtualizacaoSemanal(cidade) {
    try {
      const { data } = await supabase
        .from('administradoras_sindicos')
        .select('last_google_sync')
        .eq('cidade', cidade)
        .order('last_google_sync', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return true; // Primeira busca para esta cidade
      }

      const ultimaAtualizacao = new Date(data[0].last_google_sync);
      const agora = new Date();
      const diferenca = agora - ultimaAtualizacao;
      const umaSemana = 7 * 24 * 60 * 60 * 1000; // Uma semana em millisegundos

      return diferenca >= umaSemana;
    } catch (error) {
      console.error('Erro ao verificar atualização semanal:', error);
      return true; // Em caso de erro, permite atualização
    }
  }
};

// Exportar cliente para uso direto quando necessário
export const supabaseService = {
  client: supabase,
  apontamentos: apontamentosService,
  arsenal: arsenalService,
  administradoras: administradorasService
};