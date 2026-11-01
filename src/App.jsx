import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import AuthGuard from './components/AuthGuard';
import AdminPanel from './components/AdminPanel';
import ProtectedRoute from './components/ProtectedRoute';
import SmartRedirect from './components/SmartRedirect';
import ResetPasswordPage from './components/ResetPasswordPage';
import ImpersonationBar from './components/ImpersonationBar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutProvider, useLayout } from './contexts/LayoutContext';
import { useGoogleSheetsData } from './hooks/useGoogleSheetsData';
import { hashEhCompras } from './features/compras/utils/navegacaoCompras';

// Cada módulo vira um chunk próprio: técnico/Compras (Execução) não baixam o Dashboard Comercial (echarts etc.) e vice-versa
const Dashboard = lazy(() => import('./features/dashboard/components/Dashboard'));
const DashboardV2 = lazy(() => import('./features/dashboard-v2/DashboardV2'));
const ApontamentosComercial = lazy(() => import('./components/ApontamentosComercial'));
const ArsenalDeGuerra = lazy(() => import('./components/ArsenalDeGuerra'));

// O módulo Execução só é baixado por quem tem acesso a ele
const ExecucaoDashboard = lazy(() => import('./features/execucao/components/ExecucaoDashboard'));

// Compras é um módulo de topo próprio (chunk separado); só quem tem a rota `compras` o baixa
const ComprasModulo = lazy(() => import('./features/compras/ComprasModulo'));

function TelaCarregando() {
  return (
    <div className="min-h-screen flex items-center justify-center login-dark-bg">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500" role="status" aria-label="Carregando"></div>
    </div>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState(null); // null inicialmente para determinar automaticamente
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);
  const { refreshData } = useGoogleSheetsData();
  const { usuario, obterPaginasPermitidas, isAuthenticated } = useAuth();

  // Escutar evento global de abertura do admin (usado pelo Dashboard V2)
  useEffect(() => {
    const handler = () => setShowAdminPanel(true);
    window.addEventListener('effort:open-admin', handler);
    return () => window.removeEventListener('effort:open-admin', handler);
  }, []);

  // COMPRAS (pelo nome do nível) vive só no módulo Compras: qualquer outro estado/hash cai de volta nele
  const somenteCompras = usuario?.nivel_acesso?.nome === 'COMPRAS';
  const paginaAtual = somenteCompras && isAuthenticated ? 'compras' : currentPage;

  // Deep links e atalhos (#/compras?pedido=ID, sino de notificação) abrem o módulo Compras; quem não tem a rota
  // recebe o redirecionamento do ProtectedRoute
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const aoNavegar = () => {
      if (hashEhCompras()) setCurrentPage((atual) => (atual === null || atual === 'compras' ? atual : 'compras'));
      // Botão "voltar" do navegador de Compras para uma página da Execução (admin)
      else if (window.location.hash.startsWith('#/execucao')) setCurrentPage((atual) => (atual === 'compras' ? 'execucao' : atual));
    };
    window.addEventListener('popstate', aoNavegar);
    // F5/login com #/compras?pedido=ID: a página inicial sai como 'dashboard' antes da autenticação; corrige já
    aoNavegar();
    return () => window.removeEventListener('popstate', aoNavegar);
  }, [isAuthenticated]);

  // Saindo do módulo Compras, o hash #/compras não deve sobrar (a Execução lê o próprio hash).
  // Só limpa depois de ter estado em Compras: antes disso apagaria o deep link (F5 / login)
  const paginaAnterior = useRef(null);
  useEffect(() => {
    if (paginaAnterior.current === 'compras' && paginaAtual && paginaAtual !== 'compras' && hashEhCompras()) {
      window.history.replaceState(null, '', paginaAtual === 'execucao' ? '#/execucao' : window.location.pathname + window.location.search);
    }
    paginaAnterior.current = paginaAtual;
  }, [paginaAtual]);

  // Determinar página inicial baseada nas permissões
  useEffect(() => {
    const determinarPaginaInicial = async () => {
      if (!isAuthenticated || !usuario) {
        setCurrentPage('dashboard'); // fallback para não autenticados
        setIsRedirecting(false);
        return;
      }

      console.log('🔍 Determinando página inicial para:', usuario.email);
      console.log('📋 Nível de acesso:', usuario.nivel_acesso?.nome);

      try {
        const paginasPermitidas = await obterPaginasPermitidas();
        
        console.log('✅ Páginas permitidas:', paginasPermitidas);

        if (paginasPermitidas.length === 0) {
          console.error('❌ Usuário não tem acesso a nenhuma página');
          setCurrentPage('dashboard'); // fallback
          setIsRedirecting(false);
          return;
        }

        // Ordem de preferência: dashboard > apontamentos > arsenal > execucao
        const ordemPreferencia = ['dashboard', 'apontamentos', 'arsenal', 'execucao', 'compras'];
        let paginaInicial = paginasPermitidas[0]; // fallback para primeira permitida
        
        // COMPRAS: direto para o módulo Compras (nunca vê outro módulo)
        const isCompras = usuario.nivel_acesso?.nome === 'COMPRAS';
        // Deep link do módulo Compras (inclui o hash legado #/execucao/compras)
        const querCompras = hashEhCompras() && paginasPermitidas.includes('compras');

        // Verificar se usuário é do módulo execução (ADMIN_EXECUCAO, TECNICO ou COMPRAS)
        const isExecucaoUser = paginasPermitidas.some(p => p.startsWith('execucao'));
        
        if (isCompras || querCompras) {
          paginaInicial = 'compras';
        } else if (isExecucaoUser) {
          // Usuários de execução vão direto para o módulo
          paginaInicial = 'execucao';
        } else {
          for (const pagina of ordemPreferencia) {
            if (paginasPermitidas.includes(pagina)) {
              paginaInicial = pagina;
              break;
            }
          }
        }

        console.log('Redirecionando para:', paginaInicial, 'Páginas permitidas:', paginasPermitidas);
        setCurrentPage(paginaInicial);
      } catch (error) {
        console.error('Erro ao determinar página inicial:', error);
        setCurrentPage('dashboard'); // fallback
      } finally {
        setIsRedirecting(false);
      }
    };

    // Só executar se ainda estamos redirecionando e currentPage é null
    if (currentPage === null && isRedirecting) {
      determinarPaginaInicial();
    }
  }, [isAuthenticated, usuario, obterPaginasPermitidas, currentPage, isRedirecting]);

  // Mostrar loading enquanto determina a página inicial
  if (isRedirecting || currentPage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center login-dark-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Módulo Compras (rota de topo `compras`): COMPRAS, ADMIN_EXECUCAO e Administrador
  if (paginaAtual === 'compras') {
    return (
      <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
        <ProtectedRoute
          requiredRoute="compras"
          fallbackComponent={
            <SmartRedirect onRedirect={setCurrentPage} />
          }
        >
          <Suspense fallback={<TelaCarregando />}>
            <ComprasModulo onVoltar={setCurrentPage} />
          </Suspense>
        </ProtectedRoute>
        <AdminPanel 
          isOpen={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
        />
      </AuthGuard>
    );
  }

  // Renderizar página de apontamentos se selecionada
  if (currentPage === 'apontamentos') {
    return (
      <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
        <ProtectedRoute 
          requiredRoute="apontamentos"
          fallbackComponent={
            <SmartRedirect onRedirect={setCurrentPage} />
          }
        >
          <Suspense fallback={<TelaCarregando />}>
            <ApontamentosComercial 
              onVoltar={() => {
                refreshData(); // Atualizar dados quando voltar
                setCurrentPage('dashboard');
              }} 
              onDataUpdate={refreshData} // Função para atualizar dados
            />
          </Suspense>
        </ProtectedRoute>
        <AdminPanel 
          isOpen={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
        />
      </AuthGuard>
    );
  }

  // Renderizar página Arsenal de Guerra se selecionada
  if (currentPage === 'arsenal') {
    return (
      <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
        <ProtectedRoute 
          requiredRoute="arsenal"
          fallbackComponent={
            <SmartRedirect onRedirect={setCurrentPage} />
          }
        >
          <Suspense fallback={<TelaCarregando />}>
            <ArsenalDeGuerra onVoltar={() => setCurrentPage('dashboard')} />
          </Suspense>
        </ProtectedRoute>
        <AdminPanel 
          isOpen={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
        />
      </AuthGuard>
    );
  }

  // Renderizar Dashboard Execução se selecionada (para usuários ADMIN_EXECUCAO e TECNICO)
  if (currentPage === 'execucao') {
    return (
      <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
        <ProtectedRoute 
          requiredRoute="execucao"
          fallbackComponent={
            <SmartRedirect onRedirect={setCurrentPage} />
          }
        >
          <Suspense fallback={<TelaCarregando />}>
            <ExecucaoDashboard 
              usuario={usuario}
              onVoltar={() => setCurrentPage('dashboard')} 
            />
          </Suspense>
        </ProtectedRoute>
        <AdminPanel 
          isOpen={showAdminPanel} 
          onClose={() => setShowAdminPanel(false)} 
        />
      </AuthGuard>
    );
  }

  // Renderizar o Dashboard principal
  return (
    <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
      <ProtectedRoute 
        requiredRoute="dashboard" 
        onRedirect={setCurrentPage}
      >
        <DashboardSelector setCurrentPage={setCurrentPage} />
      </ProtectedRoute>
      <AdminPanel 
        isOpen={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
    </AuthGuard>
  );
}

/**
 * Escolhe entre Dashboard clássico (V1) e Dashboard moderno (V2) com base
 * na preferência global salva em Supabase (context: LayoutContext).
 * Enquanto o valor está carregando, mostra V1 (cache do localStorage).
 */
function DashboardSelector({ setCurrentPage }) {
  const { layout, LAYOUT_MODERNO } = useLayout();
  return (
    <Suspense fallback={<TelaCarregando />}>
      {layout === LAYOUT_MODERNO
        ? <DashboardV2 setCurrentPage={setCurrentPage} />
        : <Dashboard setCurrentPage={setCurrentPage} />}
    </Suspense>
  );
}

function App() {
  // A página de reset de senha não usa o app autenticado; decidir aqui evita hooks após return condicional
  const isResetPasswordPage = window.location.pathname === '/reset-password';

  return (
    <AuthProvider>
      <LayoutProvider>
        <ImpersonationBar />
        {isResetPasswordPage ? <ResetPasswordPage /> : <AppContent />}
      </LayoutProvider>
    </AuthProvider>
  );
}

export default App;
