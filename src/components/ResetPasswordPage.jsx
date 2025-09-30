import React, { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { supabase } from '../services/supabase/config.js';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error' | 'info'
  const [isValidSession, setIsValidSession] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Verificar se há uma sessão válida para reset de senha
    const checkSession = async () => {
      try {
        // Verificar se há parâmetros de hash na URL (tokens do Supabase)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('🔍 URL Params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        if (type === 'recovery' && accessToken) {
          console.log('✅ Link de recuperação válido detectado');
          
          // Estabelecer sessão com os tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('❌ Erro ao estabelecer sessão:', error);
            setMessage('Link inválido ou expirado. Solicite um novo link de recuperação.');
            setMessageType('error');
            return;
          }

          if (data.user) {
            console.log('✅ Sessão estabelecida para:', data.user.email);
            setIsValidSession(true);
            setMessage(`Defina uma nova senha para ${data.user.email}`);
            setMessageType('info');
            
            // Limpar parâmetros da URL para segurança
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          // Verificar sessão existente
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Erro ao verificar sessão:', error);
            setMessage('Link inválido ou expirado. Solicite um novo link de recuperação.');
            setMessageType('error');
            return;
          }

          if (session && session.user) {
            console.log('✅ Sessão existente válida:', session.user.email);
            setIsValidSession(true);
            setMessage(`Defina uma nova senha para ${session.user.email}`);
            setMessageType('info');
          } else {
            setMessage('Link inválido ou expirado. Solicite um novo link de recuperação.');
            setMessageType('error');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        setMessage('Erro ao validar link de recuperação.');
        setMessageType('error');
      }
    };

    checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email);
      
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setMessage(`Defina uma nova senha para ${session?.user?.email}`);
        setMessageType('info');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = 'Nova senha é obrigatória';
    } else if (password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setMessage('');

    try {
      // Atualizar senha usando Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('❌ Erro ao redefinir senha:', error);
        setMessage(error.message || 'Erro ao redefinir senha. Tente novamente.');
        setMessageType('error');
        return;
      }

      console.log('✅ Senha redefinida com sucesso');
      setMessage('Senha redefinida com sucesso! Você será redirecionado para o login.');
      setMessageType('success');

      // Limpar formulário
      setPassword('');
      setConfirmPassword('');

      // Fazer logout para limpar sessão e redirecionar para login
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
      }, 3000);

    } catch (error) {
      console.error('💥 Erro na redefinição de senha:', error);
      setMessage('Erro inesperado. Tente novamente.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto">
        {/* Header */}
        <div className="header-gradient rounded-t-2xl p-6 text-white text-center">
          <h1 className="text-2xl font-bold mb-2">🔑 Redefinir Senha</h1>
          <p className="text-white/80 text-sm">
            {isValidSession ? 'Defina sua nova senha' : 'Validando link de recuperação...'}
          </p>
        </div>

        <div className="p-6">
          {/* Status Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-sm ${
              messageType === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : messageType === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 mt-0.5">
                  {messageType === 'error' ? <FaTimesCircle /> :
                   messageType === 'success' ? <FaCheckCircle /> : 'ℹ️'}
                </span>
                <span className="flex-1">{message}</span>
              </div>
            </div>
          )}

          {/* Formulário (apenas se sessão válida) */}
          {isValidSession && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Nova Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-4 py-3 pl-10 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.password 
                        ? 'border-red-300 focus:ring-red-200' 
                        : 'border-gray-300 focus:ring-blue-200'
                    }`}
                    placeholder="Digite sua nova senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 pl-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.confirmPassword 
                        ? 'border-red-300 focus:ring-red-200' 
                        : 'border-gray-300 focus:ring-blue-200'
                    }`}
                    placeholder="Confirme sua nova senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Botão Redefinir */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Redefinindo...</span>
                  </>
                ) : (
                  <span>🔄 Redefinir Senha</span>
                )}
              </button>
            </form>
          )}

          {/* Botão Voltar ao Login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
              disabled={loading}
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;