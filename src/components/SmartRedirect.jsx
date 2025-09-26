import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
        const ordemPreferencia = ['dashboard', 'apontamentos', 'arsenal'];
        let paginaDestino = paginasPermitidas[0]; // fallback
        
        for (const pagina of ordemPreferencia) {
          if (paginasPermitidas.includes(pagina)) {
            paginaDestino = pagina;
            break;
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
      arsenal: 'Arsenal de Guerra'
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Redirecionando...
          </h2>
          <p className="text-gray-600 mb-6">
            Você não tem acesso a esta página. Redirecionando para <strong>{pageNames[targetPage]}</strong>...
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left">
            <strong>Seu nível de acesso:</strong> {usuario?.nivel_acesso?.nome || 'Não definido'}
          </div>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Se não tem nenhuma página permitida
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Acesso Negado
        </h2>
        <p className="text-gray-600 mb-6">
          Você não tem permissão para acessar nenhuma página do sistema. Entre em contato com o administrador para solicitar acesso.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-left">
          <strong>Seu nível de acesso:</strong> {usuario?.nivel_acesso?.nome || 'Não definido'}<br />
          <strong>Email:</strong> {usuario?.email || 'Não definido'}
        </div>
      </div>
    </div>
  );
};

export default SmartRedirect;