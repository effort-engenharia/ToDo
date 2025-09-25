// Importar configuração do Supabase
import { supabase } from './supabase/config.js';

// Importar todos os serviços
import { apontamentosService } from './supabase/apontamentos.js';
import { metasService } from './supabase/metas.js';
import { arsenalService } from './supabase/arsenal.js';
import { administradorasService } from './supabase/administradoras.js';
import { authService, adminService } from './supabase/auth.js';

// Re-exportar tudo para manter compatibilidade com importações existentes
export { supabase };
export { apontamentosService };
export { metasService };
export { arsenalService };
export { administradorasService };
export { authService };
export { adminService };

// Exportar o objeto de serviço principal para compatibilidade
export const supabaseService = {
  client: supabase,
  apontamentos: apontamentosService,
  metas: metasService,
  arsenal: arsenalService,
  administradoras: administradorasService,
  auth: authService,
  admin: adminService
};

// Export default para uso simplificado
export default supabaseService;