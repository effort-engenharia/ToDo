import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import ExecucaoSidebar from './ExecucaoSidebar';
import ExecucaoHeader from './ExecucaoHeader';
import { ExecucaoUIProvider } from './ui/ExecucaoUI';
import ErrorBoundary from './ui/ErrorBoundary';
import { Carregando } from './ui/Estados';
import AvisoSessao from './ui/AvisoSessao';
import { isAdminExecucao, PAGINAS_TECNICO, paginaInicial } from '../utils/permissoes';
import { useBadgesMenu } from '../hooks/useBadgesMenu';
import '../styles/execucao.css';

// Cada página vira um chunk separado: o técnico não baixa Planejamento (PDF/Excel), gráficos etc.
const ExecucaoHome = lazy(() => import('./ExecucaoHome'));
const AtividadesDia = lazy(() => import('./AtividadesDia'));
const AgendaBase = lazy(() => import('./AgendaBase'));
const PedidoMaterial = lazy(() => import('./PedidoMaterial'));
const DesempenhoIndividual = lazy(() => import('./DesempenhoIndividual'));
const DesempenhoTime = lazy(() => import('./DesempenhoTime'));
const PlanejamentoMacro = lazy(() => import('./PlanejamentoMacro'));
const POPs = lazy(() => import('./POPs'));
const MinhasAtividades = lazy(() => import('./MinhasAtividades'));
const MeuDia = lazy(() => import('./tecnico/MeuDia'));
const HorasExtras = lazy(() => import('./capacidade/HorasExtras'));
const CapacidadeEquipe = lazy(() => import('./capacidade/CapacidadeEquipe'));
const HistoricoAlteracoes = lazy(() => import('./historico/HistoricoAlteracoes'));
const ConfiguracoesExecucao = lazy(() => import('./config/ConfiguracoesExecucao'));

const AGENDAS = {
  'agenda-eletrica': { tipoExecucao: 'eletrica', titulo: 'Agenda Elétrica' },
  'agenda-civil': { tipoExecucao: 'civil', titulo: 'Agenda Civil' },
  'agenda-galpao': { tipoExecucao: 'galpao', titulo: 'Agenda Galpão' },
  'agenda-gestao': { tipoExecucao: 'gestao', titulo: 'Agenda Gestão' },
};

// Mapeamento de páginas para títulos
const pageTitles = {
  'home': 'Visão Geral',
  'atividades-dia': 'Atividades do Dia',
  'pedido-material': 'Pedido de Material',
  'desempenho-individual': 'Desempenho Individual',
  'desempenho-time': 'Desempenho do Time',
  'planejamento-macro': 'Planejamento Macro',
  'pops': 'Procedimentos Operacionais',
  'minhas-atividades': 'Minhas Atividades',
  'meu-dia': 'Meu Dia',
  'horas-extras': 'Horas Extras e Emergências',
  'capacidade': 'Capacidade da Equipe',
  'historico': 'Histórico de Alterações',
  'configuracoes': 'Configurações',
  ...Object.fromEntries(Object.entries(AGENDAS).map(([id, { titulo }]) => [id, titulo])),
};

const PAGINAS_VALIDAS = new Set(Object.keys(pageTitles));
const PREFIXO_HASH = '#/execucao';

// A página atual vive no hash (#/execucao/pops): sobrevive ao F5 e funciona com o botão "voltar".
// Sem hash válido, abre a página inicial do perfil (técnico: "Meu Dia").
const paginaDoHash = (inicial = 'home') => {
  const pagina = window.location.hash.startsWith(PREFIXO_HASH)
    ? window.location.hash.slice(PREFIXO_HASH.length).replace(/^\//, '')
    : '';
  return PAGINAS_VALIDAS.has(pagina) ? pagina : inicial;
};

const ExecucaoDashboard = ({ onVoltar }) => {
  const { usuario, logout } = useAuth();
  const isAdmin = isAdminExecucao(usuario);
  const inicial = paginaInicial(usuario);
  const [pagina, setPagina] = useState(() => paginaDoHash(inicial));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const badges = useBadgesMenu(isAdmin);

  // Técnico só acessa as páginas permitidas; qualquer outra cai em "Minhas Atividades"
  const currentPage = isAdmin || PAGINAS_TECNICO.includes(pagina) ? pagina : 'minhas-atividades';

  const navegar = useCallback((destino) => {
    const alvo = PAGINAS_VALIDAS.has(destino) ? destino : inicial;
    setPagina(alvo);
    const hash = alvo === 'home' ? PREFIXO_HASH : `${PREFIXO_HASH}/${alvo}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  }, [inicial]);

  useEffect(() => {
    const aoVoltar = () => setPagina(paginaDoHash(inicial));
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, [inicial]);

  const handleLogout = async () => {
    try {
      await logout();
      if (onVoltar) onVoltar();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const renderPage = () => {
    if (AGENDAS[currentPage]) {
      return <AgendaBase usuario={usuario} {...AGENDAS[currentPage]} />;
    }

    switch (currentPage) {
      case 'atividades-dia':
        return <AtividadesDia usuario={usuario} />;
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
      case 'meu-dia':
        return <MeuDia usuario={usuario} onNavigate={navegar} />;
      case 'horas-extras':
        return <HorasExtras usuario={usuario} />;
      case 'capacidade':
        return <CapacidadeEquipe usuario={usuario} />;
      case 'historico':
        return <HistoricoAlteracoes usuario={usuario} />;
      case 'configuracoes':
        return <ConfiguracoesExecucao usuario={usuario} />;
      case 'home':
      default:
        return <ExecucaoHome usuario={usuario} isAdmin={isAdmin} onNavigate={navegar} />;
    }
  };

  return (
    <ExecucaoUIProvider>
      <div className="execucao-theme">
        <div className="execucao-layout">
          <ExecucaoSidebar
            currentPage={currentPage}
            onPageChange={navegar}
            usuario={usuario}
            isAdmin={isAdmin}
            onLogout={handleLogout}
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            badges={badges}
          />

          <main className="execucao-main">
            <ExecucaoHeader
              title={pageTitles[currentPage] || 'Dashboard'}
              onMenuToggle={() => setIsMobileMenuOpen((aberto) => !aberto)}
              usuario={usuario}
              isAdmin={isAdmin}
              onNavigate={navegar}
            />

            <div className="execucao-content">
              <AvisoSessao />
              <ErrorBoundary resetKey={currentPage}>
                <Suspense fallback={<Carregando />}>
                  {renderPage()}
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </ExecucaoUIProvider>
  );
};

export default ExecucaoDashboard;
