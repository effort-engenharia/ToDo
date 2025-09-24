import { supabase } from './config.js';

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