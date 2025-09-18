// Configurações globais do Dashboard Comercial
// Este arquivo contém os valores padrão das metas que podem ser editadas

import { metasService } from '../services/supabaseService';

export const METAS_CONFIG = {
  // Meta total de clientes a serem atendidos por mês
  clientesAtendidos: 300,
  
  // Meta de valor de entrada em reais (50000 = R$ 50.000)
  valorEntrada: 50000,
  
  // Outras configurações que podem ser adicionadas
  outros: {
    // Meta de conversão em percentual
    taxaConversao: 85,
    
    // Meta de vendas por vendedor
    vendasPorVendedor: 10
  }
};

// Função para obter a configuração atual das metas do Supabase
export const getCurrentMetas = async () => {
  try {
    // Buscar metas do banco de dados
    const metas = await metasService.buscarMetasDoMes();
    
    let clientesAtendidos = METAS_CONFIG.clientesAtendidos;
    let valorEntrada = METAS_CONFIG.valorEntrada;
    
    // Processar metas vindas do banco
    if (metas && metas.length > 0) {
      const metaClientes = metas.find(m => m.tipo_meta === 'clientes_atendidos');
      const metaValor = metas.find(m => m.tipo_meta === 'valor_entrada');
      
      if (metaClientes) {
        clientesAtendidos = parseInt(metaClientes.valor_meta);
      }
      
      if (metaValor) {
        valorEntrada = parseInt(metaValor.valor_meta);
      }
    } else {
      // Fallback para localStorage se não houver dados no banco
      clientesAtendidos = parseInt(localStorage.getItem('meta_clientesAtendidos')) || METAS_CONFIG.clientesAtendidos;
      valorEntrada = parseInt(localStorage.getItem('meta_valorEntrada')) || METAS_CONFIG.valorEntrada;
    }
    
    console.log('📊 Metas carregadas:', { clientesAtendidos, valorEntrada });
    return {
      clientesAtendidos,
      valorEntrada
    };
  } catch (error) {
    console.error('Erro ao carregar metas do Supabase, usando fallback:', error);
    // Fallback para localStorage em caso de erro
    const clientesAtendidos = parseInt(localStorage.getItem('meta_clientesAtendidos')) || METAS_CONFIG.clientesAtendidos;
    const valorEntrada = parseInt(localStorage.getItem('meta_valorEntrada')) || METAS_CONFIG.valorEntrada;
    
    return {
      clientesAtendidos,
      valorEntrada
    };
  }
};

// Função para salvar meta no Supabase
export const salvarMeta = async (tipoMeta, valor, observacoes = null) => {
  try {
    const metaSalva = await metasService.salvarMeta(tipoMeta, valor, null, null, observacoes);
    
    // Manter sincronização com localStorage como backup
    if (tipoMeta === 'clientes_atendidos') {
      localStorage.setItem('meta_clientesAtendidos', valor.toString());
    } else if (tipoMeta === 'valor_entrada') {
      localStorage.setItem('meta_valorEntrada', valor.toString());
    }
    
    console.log(`✅ Meta ${tipoMeta} salva no Supabase:`, metaSalva);
    return metaSalva;
  } catch (error) {
    console.error(`Erro ao salvar meta ${tipoMeta}:`, error);
    
    // Fallback para localStorage em caso de erro
    if (tipoMeta === 'clientes_atendidos') {
      localStorage.setItem('meta_clientesAtendidos', valor.toString());
    } else if (tipoMeta === 'valor_entrada') {
      localStorage.setItem('meta_valorEntrada', valor.toString());
    }
    
    throw error;
  }
};

// Função para resetar todas as metas para os valores padrão
export const resetMetasToDefault = async () => {
  try {
    // Salvar metas padrão no Supabase
    await salvarMeta('clientes_atendidos', METAS_CONFIG.clientesAtendidos, 'Reset para valor padrão');
    await salvarMeta('valor_entrada', METAS_CONFIG.valorEntrada, 'Reset para valor padrão');
    
    console.log('🔄 Metas resetadas para valores padrão no Supabase:', METAS_CONFIG);
    return METAS_CONFIG;
  } catch (error) {
    console.error('Erro ao resetar metas no Supabase, usando localStorage:', error);
    
    // Fallback para localStorage
    localStorage.setItem('meta_clientesAtendidos', METAS_CONFIG.clientesAtendidos.toString());
    localStorage.setItem('meta_valorEntrada', METAS_CONFIG.valorEntrada.toString());
    
    console.log('🔄 Metas resetadas para valores padrão (localStorage):', METAS_CONFIG);
    return METAS_CONFIG;
  }
};

export default METAS_CONFIG;
