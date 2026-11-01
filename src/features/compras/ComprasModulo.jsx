import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ExecucaoUIProvider } from '../execucao/components/ui/ExecucaoUI';
import ErrorBoundary from '../execucao/components/ui/ErrorBoundary';
import { Carregando } from '../execucao/components/ui/Estados';
import AvisoSessao from '../execucao/components/ui/AvisoSessao';
import { isAdministrador, isSomenteCompras } from '../../utils/permissoes';
import { useBadgesMenu } from '../execucao/hooks/useBadgesMenu';
import ComprasHeader from './components/ComprasHeader';
import { useCotacaoDisponivel } from './hooks/useCotacaoDisponivel';
import { execucaoComprasService } from '../../services/supabase/execucaoCompras';
import { HASH_COMPRAS, hashEhCompras, secaoDoHash } from './utils/navegacaoCompras';
// O módulo reaproveita o design system (tokens e componentes .execucao-*) e acrescenta a identidade do setor
import '../execucao/styles/execucao.css';
import './styles/compras.css';

const DashboardCompras = lazy(() => import('./components/DashboardCompras'));
const CotacoesPagina = lazy(() => import('./components/cotacao/CotacoesPagina'));
const FornecedoresPagina = lazy(() => import('./components/fornecedores/FornecedoresPagina'));
const PrecosPagina = lazy(() => import('./components/precos/PrecosPagina'));
const ConfigComprasPagina = lazy(() => import('./components/config/ConfigComprasPagina'));

// Módulo próprio de Compras (rota de topo `compras`): layout, cabeçalho e navegação independentes da Execução.
// `onVoltar(destino)` leva o Administrador de volta ao Dashboard Comercial; o perfil COMPRAS não tem para onde voltar.
const ComprasModulo = ({ onVoltar }) => {
  const { usuario, logout } = useAuth();
  const soCompras = isSomenteCompras(usuario);
  const admin = isAdministrador(usuario);
  const badges = useBadgesMenu({ isAdmin: false, isCompras: soCompras, usuarioId: usuario?.id });
  // Cotação com fornecedores: só liga quando o banco responde (migrations 34–37 aplicadas); senão o módulo segue como antes
  const { disponivel: cotacaoDisponivel, config, verificando, atualizarConfig } = useCotacaoDisponivel();
  const [secaoHash, setSecaoHash] = useState(() => secaoDoHash());
  useEffect(() => {
    const aoNavegar = () => setSecaoHash(secaoDoHash());
    window.addEventListener('popstate', aoNavegar);
    return () => window.removeEventListener('popstate', aoNavegar);
  }, []);
  // Seção efetiva: sem o recurso (ou sem permissão para Configurações) cai em Pedidos
  const secao = !cotacaoDisponivel || (secaoHash === 'config' && !admin) ? 'pedidos' : secaoHash;
  const aguardandoGate = verificando && secaoHash !== 'pedidos';

  // Alertas de cotação/aceites (idempotente; o banco limita a 1 execução a cada 10 min): ao montar e a cada 15 min
  useEffect(() => {
    if (!cotacaoDisponivel) return undefined;
    execucaoComprasService.verificarAlertas();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') execucaoComprasService.verificarAlertas(); }, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [cotacaoDisponivel]);

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

  const voltarPara = admin && onVoltar
    ? { rotulo: 'Dashboard Comercial', acao: () => onVoltar('dashboard') }
    : null;

  return (
    <ExecucaoUIProvider>
      <div className="execucao-theme compras-theme">
        <div className="cmp-layout">
          <ComprasHeader
            usuario={usuario}
            badges={badges}
            isAdmin={admin}
            voltarPara={voltarPara}
            onLogout={handleLogout}
            secao={secao}
            cotacaoDisponivel={cotacaoDisponivel}
          />
          <main className="cmp-conteudo">
            <AvisoSessao />
            <ErrorBoundary resetKey="compras">
              <Suspense fallback={<Carregando />}>
                {aguardandoGate && <Carregando />}
                {!aguardandoGate && secao === 'pedidos' && <DashboardCompras usuario={usuario} />}
                {!aguardandoGate && secao === 'cotacoes' && <CotacoesPagina usuario={usuario} config={config} />}
                {!aguardandoGate && secao === 'fornecedores' && <FornecedoresPagina usuario={usuario} />}
                {!aguardandoGate && secao === 'precos' && <PrecosPagina usuario={usuario} />}
                {!aguardandoGate && secao === 'config' && <ConfigComprasPagina config={config} onSalvo={atualizarConfig} />}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ExecucaoUIProvider>
  );
};

export default ComprasModulo;
