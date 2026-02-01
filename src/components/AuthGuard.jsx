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
        if (resultado.pendingActivation) {
          // Conta criada mas pendente de ativação
          setMessage({ 
            type: 'info', 
            text: resultado.message + ' Entre em contato com o administrador para ativar sua conta.'
          });
          // Não fechar o modal, permitir que o usuário faça login quando ativado
        } else {
          // Admin principal - login automático
          setMessage({ type: 'success', text: resultado.message });
          setTimeout(() => {
            setShowLoginModal(false);
            setMessage({ type: '', text: '' });
          }, 1000);
        }
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
      <div className="min-h-screen flex items-center justify-center login-dark-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
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
    <div className="min-h-screen login-dark-bg">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-yellow-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-orange-600/10 to-amber-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Backdrop do sistema */}
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-xl shadow-orange-500/20">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">
              Effort Engenharia
            </h1>
            <p className="text-gray-400">
              Sistema de gestão integrado
            </p>
          </div>
          
          {/* Mostrar mensagem se existir */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
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
        statusMessage={message.text}
        statusType={message.type}
      />
    </div>
  );
};

export default AuthGuard;