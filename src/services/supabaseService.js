// ============================================================================
// ARQUIVO REFATORADO - MANTIDO APENAS PARA COMPATIBILIDADE
// ============================================================================
// Este arquivo foi refatorado em módulos separados para melhor organização.
// Os serviços agora estão localizados em:
//
// - src/services/supabase/config.js           (configuração do Supabase)
// - src/services/supabase/apontamentos.js     (serviços de apontamentos)
// - src/services/supabase/metas.js            (serviços de metas)
// - src/services/supabase/arsenal.js          (serviços de arsenal)
// - src/services/supabase/administradoras.js  (serviços de administradoras)
// - src/services/index.js                     (arquivo principal de export)
//
// Para novos imports, prefira usar:
// import { apontamentosService, metasService, arsenalService, administradorasService } from '../services';
// ============================================================================

// Re-exportar tudo do arquivo index para manter compatibilidade
export { 
  supabase, 
  apontamentosService, 
  metasService, 
  arsenalService, 
  administradorasService, 
  supabaseService 
} from './index.js';