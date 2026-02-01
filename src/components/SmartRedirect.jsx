import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FaBolt, FaExclamationTriangle } from 'react-icons/fa';

const SmartRedirect = ({ onRedirect }) => {
  const { usuario, obterPaginasPermitidas } = useAuth();
  const [redirecting, setRedirecting] = useState(true);
  const [targetPage, setTargetPage] = useState(null);

  useEffect(() => {
    const findAllowedPage = async () => {
      try {
        const paginasPermitidas = await obterPaginasPermitidas();
        
        if (paginasPermitidas.length === 0) {
          setTargetPage(null);
          setRedirecting(false);
          return;
        }

        // Ordem de preferência para redirecionamento
        const ordemPreferenciaComercial = ['dashboard', 'apontamentos', 'arsenal'];
        const ordemPreferenciaExecucao = ['execucao', 'execucao/minhas-atividades'];
        let paginaDestino = paginasPermitidas[0]; // fallback
        
        // Verificar se tem páginas de execução
        const temPaginasExecucao = paginasPermitidas.some(p => p.startsWith('execucao'));
        
        if (temPaginasExecucao) {
          // Usuário de execução
          for (const pagina of ordemPreferenciaExecucao) {
            if (paginasPermitidas.includes(pagina)) {
              paginaDestino = pagina;
              break;
            }
          }
        } else {
          // Usuário comercial
          for (const pagina of ordemPreferenciaComercial) {
            if (paginasPermitidas.includes(pagina)) {
              paginaDestino = pagina;
              break;
            }
          }
        }

        setTargetPage(paginaDestino);
        
        // Aguardar um pouco antes de redirecionar para mostrar a mensagem
        setTimeout(() => {
          onRedirect(paginaDestino);
        }, 2000);
        
      } catch (error) {
        console.error('Erro ao buscar páginas permitidas:', error);
        setTargetPage(null);
        setRedirecting(false);
      }
    };

    findAllowedPage();
  }, [usuario, obterPaginasPermitidas, onRedirect]);

  if (redirecting && targetPage) {
    const pageNames = {
      dashboard: 'Dashboard',
      apontamentos: 'Apontamentos Comerciais',
      arsenal: 'Arsenal de Guerra',
      execucao: 'Dashboard Execução',
      'execucao/minhas-atividades': 'Minhas Atividades',
      'execucao/pops': 'Procedimentos Operacionais'
    };

    return (
      <div className="min-h-screen flex items-center justify-center login-dark-bg relative">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-yellow-500/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-orange-600/10 to-amber-500/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="text-center max-w-md mx-auto p-8 relative z-10">
          {/* Logo animado */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-xl shadow-orange-500/20 animate-pulse">
              <FaBolt className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            Redirecionando...
          </h2>
          <p className="text-gray-400 mb-6">
            Você não tem acesso a esta página.<br />
            Redirecionando para <span className="text-orange-400 font-semibold">{pageNames[targetPage]}</span>...
          </p>
          <div className="login-glass-card rounded-xl p-4 text-sm text-left">
            <span className="text-gray-400">Seu nível de acesso:</span>{' '}
            <span className="text-white font-medium">{usuario?.nivel_acesso?.nome || 'Não definido'}</span>
          </div>
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Se não tem nenhuma página permitida
  return (
    <div className="min-h-screen flex items-center justify-center login-dark-bg relative">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-500/10 to-orange-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-red-600/10 to-orange-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="text-center max-w-md mx-auto p-8 relative z-10">
        {/* Ícone de alerta */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-xl shadow-red-500/20">
            <FaExclamationTriangle className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">
          Acesso Negado
        </h2>
        <p className="text-gray-400 mb-6">
          Você não tem permissão para acessar nenhuma página do sistema. Entre em contato com o administrador para solicitar acesso.
        </p>
        <div className="login-glass-card rounded-xl p-4 text-sm text-left space-y-2">
          <div>
            <span className="text-gray-400">Seu nível de acesso:</span>{' '}
            <span className="text-white font-medium">{usuario?.nivel_acesso?.nome || 'Não definido'}</span>
          </div>
          <div>
            <span className="text-gray-400">Email:</span>{' '}
            <span className="text-white font-medium">{usuario?.email || 'Não definido'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartRedirect;