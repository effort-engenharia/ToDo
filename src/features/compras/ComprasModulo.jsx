import React, { lazy, Suspense, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ExecucaoUIProvider } from '../execucao/components/ui/ExecucaoUI';
import ErrorBoundary from '../execucao/components/ui/ErrorBoundary';
import { Carregando } from '../execucao/components/ui/Estados';
import AvisoSessao from '../execucao/components/ui/AvisoSessao';
import { isAdminExecucao, isCompras, isSomenteCompras, NIVEIS } from '../execucao/utils/permissoes';
import { useBadgesMenu } from '../execucao/hooks/useBadgesMenu';
import ComprasHeader from './components/ComprasHeader';
import { HASH_COMPRAS, hashEhCompras } from './utils/navegacaoCompras';
// O módulo reaproveita o design system (tokens e componentes .execucao-*) e acrescenta a identidade do setor
import '../execucao/styles/execucao.css';
import './styles/compras.css';

const DashboardCompras = lazy(() => import('./components/DashboardCompras'));

// Módulo próprio de Compras (rota de topo `compras`): layout, cabeçalho e navegação independentes da Execução.
// `onVoltar(destino)` leva o admin de volta ao módulo de origem; o perfil COMPRAS não tem para onde voltar.
const ComprasModulo = ({ onVoltar }) => {
  const { usuario, logout } = useAuth();
  const soCompras = isSomenteCompras(usuario);
  const admin = isAdminExecucao(usuario);
  const badges = useBadgesMenu({ isAdmin: false, isCompras: soCompras, usuarioId: usuario?.id });

  // Garante o hash do módulo (sobrevive ao F5); preserva ?pedido=ID de deep links. Hash legado vira #/compras
  useEffect(() => {
    const hash = window.location.hash;
    if (!hashEhCompras(hash)) {
      window.history.replaceState(null, '', HASH_COMPRAS);
    } else if (hash.startsWith('#/execucao/compras')) {
      window.history.replaceState(null, '', hash.replace('#/execucao/compras', HASH_COMPRAS));
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  let voltarPara = null;
  if (!soCompras && onVoltar) {
    voltarPara = usuario?.nivel_acesso?.nome === NIVEIS.ADMIN_EXEC
      ? { rotulo: 'Módulo Execução', acao: () => onVoltar('execucao') }
      : { rotulo: 'Dashboard Comercial', acao: () => onVoltar('dashboard') };
  }

  return (
    <ExecucaoUIProvider>
      <div className="execucao-theme compras-theme">
        <div className="cmp-layout">
          <ComprasHeader
            usuario={usuario}
            badges={badges}
            isAdmin={admin}
            isCompras={isCompras(usuario)}
            voltarPara={voltarPara}
            onLogout={handleLogout}
          />
          <main className="cmp-conteudo">
            <AvisoSessao />
            <ErrorBoundary resetKey="compras">
              <Suspense fallback={<Carregando />}>
                <DashboardCompras usuario={usuario} />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ExecucaoUIProvider>
  );
};

export default ComprasModulo;
