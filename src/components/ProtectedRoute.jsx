import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SmartRedirect from './SmartRedirect';

const ProtectedRoute = ({ children, requiredRoute, fallbackComponent = null, onRedirect = null }) => {
  const { usuario, temPermissao } = useAuth();
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!usuario?.id || !requiredRoute) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      try {
        // Administradores têm acesso a tudo (páginas comerciais)
        if (usuario.nivel_acesso?.nome === 'Administrador') {
          // Verificar se a rota é do módulo execução
          if (requiredRoute.startsWith('execucao')) {
            setHasPermission(false);
          } else {
            setHasPermission(true);
          }
          setLoading(false);
          return;
        }
        
        // ADMIN_EXECUCAO tem acesso a todas as páginas de execução
        if (usuario.nivel_acesso?.nome === 'ADMIN_EXECUCAO') {
          if (requiredRoute.startsWith('execucao')) {
            setHasPermission(true);
          } else {
            setHasPermission(false);
          }
          setLoading(false);
          return;
        }
        
        // TECNICO tem acesso limitado às páginas de execução
        if (usuario.nivel_acesso?.nome === 'TECNICO') {
          const paginasTecnico = ['execucao', 'execucao/minhas-atividades', 'execucao/pops'];
          setHasPermission(paginasTecnico.includes(requiredRoute));
          setLoading(false);
          return;
        }

        // Verificar permissão específica para outros níveis
        const permission = await temPermissao(requiredRoute);
        setHasPermission(permission);
      } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [usuario, requiredRoute, temPermissao]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não tem permissão, mostrar fallback ou redirecionamento inteligente
  if (!hasPermission) {
    if (fallbackComponent) {
      return fallbackComponent;
    }

    // Se há função de redirecionamento, usar SmartRedirect
    if (onRedirect) {
      return <SmartRedirect onRedirect={onRedirect} />;
    }

    // Fallback padrão para acesso negado
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Acesso Negado
          </h2>
          <p className="text-gray-600 mb-6">
            Você não tem permissão para acessar esta página. Entre em contato com o administrador para solicitar acesso.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-left">
            <strong>Seu nível de acesso:</strong> {usuario?.nivel_acesso?.nome || 'Não definido'}<br />
            <strong>Página solicitada:</strong> {requiredRoute}
          </div>
        </div>
      </div>
    );
  }

  // Se tem permissão, renderizar o conteúdo
  return children;
};

export default ProtectedRoute;