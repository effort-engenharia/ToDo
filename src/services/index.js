// Importar configuração do Supabase
import { supabase } from './supabase/config.js';

// Importar todos os serviços
import { apontamentosService } from './supabase/apontamentos.js';
import { metasService } from './supabase/metas.js';
import { arsenalService } from './supabase/arsenal.js';
import { administradorasService } from './supabase/administradoras.js';
import { authService, adminService } from './supabase/auth.js';
import { configuracoesService } from './supabase/configuracoes.js';
import { premiacaoService } from './supabase/premiacao.js';

// NOTA (performance): execucaoService e execucaoComprasService NÃO são reexportados aqui de propósito.
// Este barrel entra no chunk principal (dashboard comercial); o módulo Execução importa seus serviços direto de
// ./supabase/execucao*.js e os carrega sob demanda (React.lazy). Reexportá-los aqui os traria para o bundle inicial.

// Re-exportar tudo para manter compatibilidade com importações existentes
export { supabase };
export { apontamentosService };
export { metasService };
export { arsenalService };
export { administradorasService };
export { authService };
export { adminService };
export { configuracoesService };
export { premiacaoService };

// Exportar o objeto de serviço principal para compatibilidade
export const supabaseService = {
  client: supabase,
  apontamentos: apontamentosService,
  metas: metasService,
  arsenal: arsenalService,
  administradoras: administradorasService,
  auth: authService,
  admin: adminService,
  configuracoes: configuracoesService,
  premiacao: premiacaoService
};

// Export default para uso simplificado
export default supabaseService;