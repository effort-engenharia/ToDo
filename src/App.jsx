import React, { useState, useEffect } from 'react';
import Dashboard from './features/dashboard/components/Dashboard';
import ApontamentosComercial from './components/ApontamentosComercial';
import ArsenalDeGuerra from './components/ArsenalDeGuerra';
import AuthGuard from './components/AuthGuard';
import AdminPanel from './components/AdminPanel';
import ProtectedRoute from './components/ProtectedRoute';
import SmartRedirect from './components/SmartRedirect';
import ResetPasswordPage from './components/ResetPasswordPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useGoogleSheetsData } from './hooks/useGoogleSheetsData';

function AppContent() {
  // Verificar se estamos na página de reset de senha
  const isResetPasswordPage = window.location.pathname === '/reset-password';
  
  // Se for página de reset, renderizar apenas ela
  if (isResetPasswordPage) {
    return <ResetPasswordPage />;
  }

  const [currentPage, setCurrentPage] = useState(null); // null inicialmente para determinar automaticamente
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);
  const { refreshData } = useGoogleSheetsData();
  const { usuario, obterPaginasPermitidas, isAuthenticated } = useAuth();

  // Determinar página inicial baseada nas permissões
  useEffect(() => {
    const determinarPaginaInicial = async () => {
      if (!isAuthenticated || !usuario) {
        setCurrentPage('dashboard'); // fallback para não autenticados
        setIsRedirecting(false);
        return;
      }

      try {
        const paginasPermitidas = await obterPaginasPermitidas();
        
        if (paginasPermitidas.length === 0) {
          console.error('Usuário não tem acesso a nenhuma página');
          setCurrentPage('dashboard'); // fallback
          setIsRedirecting(false);
          return;
        }

        // Ordem de preferência: dashboard > apontamentos > arsenal
        const ordemPreferencia = ['dashboard', 'apontamentos', 'arsenal'];
        let paginaInicial = paginasPermitidas[0]; // fallback para primeira permitida
        
        for (const pagina of ordemPreferencia) {
          if (paginasPermitidas.includes(pagina)) {
            paginaInicial = pagina;
            break;
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando Dashboard Comercial...</p>
        </div>
      </div>
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
          <ApontamentosComercial 
            onVoltar={() => {
              refreshData(); // Atualizar dados quando voltar
              setCurrentPage('dashboard');
            }} 
            onDataUpdate={refreshData} // Função para atualizar dados
          />
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
          <ArsenalDeGuerra onVoltar={() => setCurrentPage('dashboard')} />
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
        <Dashboard setCurrentPage={setCurrentPage} />
      </ProtectedRoute>
      <AdminPanel 
        isOpen={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
    </AuthGuard>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
