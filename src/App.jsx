import React, { useState } from 'react';
import Dashboard from './features/dashboard/components/Dashboard';
import ApontamentosComercial from './components/ApontamentosComercial';
import ArsenalDeGuerra from './components/ArsenalDeGuerra';
import AuthGuard from './components/AuthGuard';
import AdminPanel from './components/AdminPanel';
import { AuthProvider } from './contexts/AuthContext';
import { useGoogleSheetsData } from './hooks/useGoogleSheetsData';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'apontamentos' ou 'arsenal'
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { refreshData } = useGoogleSheetsData();

  // Renderizar página de apontamentos se selecionada
  if (currentPage === 'apontamentos') {
    return (
      <AuthGuard onOpenAdmin={() => setShowAdminPanel(true)}>
        <ApontamentosComercial 
          onVoltar={() => {
            refreshData(); // Atualizar dados quando voltar
            setCurrentPage('dashboard');
          }} 
          onDataUpdate={refreshData} // Função para atualizar dados
        />
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
        <ArsenalDeGuerra onVoltar={() => setCurrentPage('dashboard')} />
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
      <Dashboard setCurrentPage={setCurrentPage} />
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
