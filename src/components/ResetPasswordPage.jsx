import React, { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaSpinner, FaCheckCircle, FaTimesCircle, FaBolt } from 'react-icons/fa';
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
    <div className="min-h-screen login-dark-bg flex items-center justify-center p-4">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-500/20 to-yellow-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-orange-600/15 to-amber-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="login-glass-card rounded-2xl w-full max-w-md mx-auto relative">
        {/* Header */}
        <div className="login-header-gradient rounded-t-2xl p-6 text-white text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <FaBolt className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-1">Redefinir Senha</h1>
          <p className="text-white/60 text-sm">
            {isValidSession ? 'Defina sua nova senha' : 'Validando link de recuperação...'}
          </p>
        </div>

        <div className="p-6">
          {/* Status Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-sm ${
              messageType === 'error' 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : messageType === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`login-input w-full px-4 py-3 pl-10 pr-10 rounded-xl focus:outline-none transition-all ${
                      errors.password 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'focus:border-orange-500/50'
                    }`}
                    placeholder="Digite sua nova senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`login-input w-full px-4 py-3 pl-10 rounded-xl focus:outline-none transition-all ${
                      errors.confirmPassword 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'focus:border-orange-500/50'
                    }`}
                    placeholder="Confirme sua nova senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Botão Redefinir */}
              <button
                type="submit"
                disabled={loading}
                className="w-full login-btn-primary text-white py-3.5 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Redefinindo...</span>
                  </>
                ) : (
                  <>
                    <FaBolt className="w-4 h-4" />
                    <span>Redefinir Senha</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Botão Voltar ao Login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
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