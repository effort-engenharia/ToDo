import React, { useState } from 'react';
import Dashboard from './features/dashboard/components/Dashboard';
import ApontamentosComercial from './components/ApontamentosComercial';
import ArsenalDeGuerra from './components/ArsenalDeGuerra';
import { useGoogleSheetsData } from './hooks/useGoogleSheetsData';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'apontamentos' ou 'arsenal'
  const { refreshData } = useGoogleSheetsData();

  // Renderizar página de apontamentos se selecionada
  if (currentPage === 'apontamentos') {
    return <ApontamentosComercial 
      onVoltar={() => {
        refreshData(); // Atualizar dados quando voltar
        setCurrentPage('dashboard');
      }} 
      onDataUpdate={refreshData} // Função para atualizar dados
    />;
  }

  // Renderizar página Arsenal de Guerra se selecionada
  if (currentPage === 'arsenal') {
    return <ArsenalDeGuerra onVoltar={() => setCurrentPage('dashboard')} />;
  }

  // Renderizar o Dashboard principal
  return <Dashboard setCurrentPage={setCurrentPage} />;
}

export default App;
