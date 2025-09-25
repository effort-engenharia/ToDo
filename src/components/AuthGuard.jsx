import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import AdminButton from './AdminButton';

const AuthGuard = ({ children, onOpenAdmin }) => {
  const { isAuthenticated, loading, login, registrar } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Mostrar login se não autenticado
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      setShowLoginModal(true);
    }
  }, [loading, isAuthenticated]);

  // Handler para login
  const handleLogin = async (email, senha) => {
    setLoginLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const resultado = await login(email, senha);
      
      if (resultado.success) {
        setMessage({ type: 'success', text: resultado.message });
        setTimeout(() => {
          setShowLoginModal(false);
          setMessage({ type: '', text: '' });
        }, 1000);
      } else {
        setMessage({ type: 'error', text: resultado.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro interno do sistema' });
    } finally {
      setLoginLoading(false);
    }
  };

  // Handler para registro
  const handleRegister = async (dadosUsuario) => {
    setLoginLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const resultado = await registrar(dadosUsuario);
      
      if (resultado.success) {
        setMessage({ type: 'success', text: resultado.message });
        setTimeout(() => {
          setShowLoginModal(false);
          setMessage({ type: '', text: '' });
        }, 1000);
      } else {
        setMessage({ type: 'error', text: resultado.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro interno do sistema' });
    } finally {
      setLoginLoading(false);
    }
  };

  // Loading inicial
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando Dashboard Comercial...</p>
        </div>
      </div>
    );
  }

  // Se autenticado, mostrar conteúdo
  if (isAuthenticated) {
    return (
      <>
        {children}
        <AdminButton onOpenAdmin={onOpenAdmin} />
      </>
    );
  }

  // Se não autenticado, mostrar modal de login
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Backdrop do sistema */}
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              📊 Dashboard Comercial
            </h1>
            <p className="text-gray-600">
              Sistema de gestão comercial com gamificação
            </p>
          </div>
          
          {/* Mostrar mensagem se existir */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-100 border border-green-300 text-green-700' 
                : 'bg-red-100 border border-red-300 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
          
          <div className="text-sm text-gray-500">
            Faça login para acessar o sistema
          </div>
        </div>
      </div>

      {/* Modal de Login */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {}} // Não permite fechar sem login
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={loginLoading}
      />
    </div>
  );
};

export default AuthGuard;