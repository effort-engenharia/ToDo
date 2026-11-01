import { useCallback, useEffect, useState } from 'react';
import comprasCotacaoService from '../../../services/supabase/comprasCotacao';

// Portão do recurso "Cotação com fornecedores": as migrations 34–37 podem ainda não estar aplicadas (deploy do front
// antes do banco). O recurso só aparece se `compras_config_obter` responde com sucesso; qualquer falha esconde os menus
// novos e o módulo segue exatamente como antes. Resultado em cache de módulo (1 consulta por sessão de página).
let cache = null; // { disponivel, config }
let emVoo = null;

const consultar = () => {
  if (!emVoo) {
    emVoo = comprasCotacaoService.obterConfig()
      .then((r) => {
        cache = r?.success && r.data ? { disponivel: true, config: r.data } : { disponivel: false, config: null };
        return cache;
      })
      .catch(() => { cache = { disponivel: false, config: null }; return cache; })
      .finally(() => { emVoo = null; });
  }
  return emVoo;
};

export const limparCacheCotacaoDisponivel = () => { cache = null; };

export function useCotacaoDisponivel() {
  const [estado, setEstado] = useState(() => cache ?? { disponivel: false, config: null });
  const [verificando, setVerificando] = useState(!cache);

  useEffect(() => {
    if (cache) return undefined;
    let ativo = true;
    consultar().then((r) => { if (ativo) { setEstado(r); setVerificando(false); } });
    return () => { ativo = false; };
  }, []);

  // Atualiza o cache e o estado depois de salvar a configuração
  const atualizarConfig = useCallback((config) => {
    cache = { disponivel: true, config };
    setEstado(cache);
  }, []);

  return { disponivel: estado.disponivel, config: estado.config, verificando, atualizarConfig };
}
