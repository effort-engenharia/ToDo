import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import ExecucaoSidebar from './ExecucaoSidebar';
import ExecucaoHeader from './ExecucaoHeader';
import AtividadesDia from './AtividadesDia';
import AgendaEletrica from './AgendaEletrica';
import AgendaCivil from './AgendaCivil';
import AgendaGalpao from './AgendaGalpao';
import PedidoMaterial from './PedidoMaterial';
import DesempenhoIndividual from './DesempenhoIndividual';
import DesempenhoTime from './DesempenhoTime';
import PlanejamentoMacro from './PlanejamentoMacro';
import POPs from './POPs';
import MinhasAtividades from './MinhasAtividades';
import ExecucaoHome from './ExecucaoHome';
import '../styles/execucao.css';

// Mapeamento de páginas para títulos
const pageTitles = {
  'home': 'Visão Geral',
  'atividades-dia': 'Atividades do Dia',
  'agenda-eletrica': 'Agenda Elétrica',
  'agenda-civil': 'Agenda Civil',
  'agenda-galpao': 'Agenda Galpão',
  'pedido-material': 'Pedido de Material',
  'desempenho-individual': 'Desempenho Individual',
  'desempenho-time': 'Desempenho do Time',
  'planejamento-macro': 'Planejamento Macro',
  'pops': 'Procedimentos Operacionais',
  'minhas-atividades': 'Minhas Atividades'
};

const ExecucaoDashboard = ({ onVoltar }) => {
  const { usuario, logout, temPermissao } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Verificar se é administrador
  const isAdmin = usuario?.nivel_acesso?.nome === 'Administrador' || 
                  usuario?.nivel_acesso?.nome === 'ADMIN_EXECUCAO';

  // Redirecionar técnico para página correta
  useEffect(() => {
    if (!isAdmin && currentPage !== 'home' && currentPage !== 'minhas-atividades' && currentPage !== 'pops') {
      setCurrentPage('minhas-atividades');
    }
  }, [isAdmin, currentPage]);

  const handleLogout = async () => {
    try {
      await logout();
      if (onVoltar) onVoltar();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Renderizar página baseado no estado
  const renderPage = () => {
    // Páginas permitidas para técnicos
    const paginasTecnico = ['home', 'minhas-atividades', 'pops'];
    
    // Se não é admin e página não é permitida, mostrar minhas atividades
    if (!isAdmin && !paginasTecnico.includes(currentPage)) {
      return <MinhasAtividades usuario={usuario} />;
    }

    switch (currentPage) {
      case 'home':
        return <ExecucaoHome usuario={usuario} isAdmin={isAdmin} onNavigate={setCurrentPage} />;
      case 'atividades-dia':
        return <AtividadesDia usuario={usuario} />;
      case 'agenda-eletrica':
        return <AgendaEletrica usuario={usuario} />;
      case 'agenda-civil':
        return <AgendaCivil usuario={usuario} />;
      case 'agenda-galpao':
        return <AgendaGalpao usuario={usuario} />;
      case 'pedido-material':
        return <PedidoMaterial usuario={usuario} isAdmin={isAdmin} />;
      case 'desempenho-individual':
        return <DesempenhoIndividual usuario={usuario} />;
      case 'desempenho-time':
        return <DesempenhoTime usuario={usuario} />;
      case 'planejamento-macro':
        return <PlanejamentoMacro usuario={usuario} />;
      case 'pops':
        return <POPs usuario={usuario} isAdmin={isAdmin} />;
      case 'minhas-atividades':
        return <MinhasAtividades usuario={usuario} />;
      default:
        return <ExecucaoHome usuario={usuario} isAdmin={isAdmin} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="execucao-theme">
      <div className="execucao-layout">
        {/* Sidebar */}
        <ExecucaoSidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          usuario={usuario}
          isAdmin={isAdmin}
          onLogout={handleLogout}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content */}
        <main className="execucao-main">
          {/* Header */}
          <ExecucaoHeader
            title={pageTitles[currentPage] || 'Dashboard'}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            usuario={usuario}
            isAdmin={isAdmin}
          />

          {/* Content */}
          <div className="execucao-content">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExecucaoDashboard;
