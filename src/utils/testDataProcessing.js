// Teste rápido para verificar processamento dos dados
import { apontamentosService } from '../services/supabaseService.js';
import { extractFunil, extractClientesAtendidos, extractRelacionamento } from '../utils/extractors.js';

export const testDataProcessing = async () => {
  try {
    console.log('🧪 Iniciando teste de processamento de dados...');
    
    // Buscar dados do Supabase
    const data = await apontamentosService.buscarApontamentos();
    console.log('📊 Dados obtidos:', data?.length, 'registros');
    
    // Processar funil
    const funil = extractFunil(data);
    console.log('📈 Funil processado:', funil);
    
    // Processar clientes atendidos
    const clientesAtendidos = extractClientesAtendidos(data);
    console.log('👥 Clientes atendidos:', clientesAtendidos);
    
    // Processar relacionamento
    const relacionamento = extractRelacionamento(data);
    console.log('🔥 Relacionamento:', relacionamento);
    
    return { funil, clientesAtendidos, relacionamento };
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
};