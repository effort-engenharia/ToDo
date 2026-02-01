import { supabase } from './config.js';

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
  },

  // Serviços para Financiamentos
  async salvarFinanciamento(dadosFinanciamento) {
    try {
      const { data, error } = await supabase
        .from('arsenal_financiamentos')
        .insert([{
          nome: dadosFinanciamento.nome,
          valor_total: dadosFinanciamento.valorTotal,
          valor_entrada: dadosFinanciamento.valorEntrada,
          parcelas_entrada: dadosFinanciamento.parcelasEntrada,
          entrada_com_juros: dadosFinanciamento.entradaComJuros,
          juros_entrada_ano: dadosFinanciamento.jurosEntradaAno,
          valor_restante: dadosFinanciamento.valorRestante,
          parcelas_restante: dadosFinanciamento.parcelasRestante,
          juros_restante_ano: dadosFinanciamento.jurosRestanteAno,
          valor_total_final: dadosFinanciamento.valorTotalFinal,
          valor_juros_total: dadosFinanciamento.valorJurosTotal,
          resumo: dadosFinanciamento.resumo
        }])
        .select();

      if (error) {
        console.error('Erro ao salvar financiamento:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de salvamento de financiamento:', error);
      throw error;
    }
  },

  async buscarFinanciamentos() {
    try {
      const { data, error } = await supabase
        .from('arsenal_financiamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar financiamentos:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de financiamentos:', error);
      throw error;
    }
  },

  async excluirFinanciamento(id) {
    try {
      const { error } = await supabase
        .from('arsenal_financiamentos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir financiamento:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro no serviço de exclusão de financiamento:', error);
      throw error;
    }
  }
};