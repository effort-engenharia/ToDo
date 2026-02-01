import React, { useState } from 'react';
import { FaEnvelope, FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner, FaTimes, FaBolt } from 'react-icons/fa';
import { authService, resetPassword } from '../services/supabase/auth.js';

const LoginModal = ({ isOpen, onClose, onLogin, onRegister, loading, statusMessage, statusType }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    senha: '',
    nomeCompleto: '',
    confirmarSenha: ''
  });
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpar erro do campo quando o usuário digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.senha) {
      newErrors.senha = 'Senha é obrigatória';
    } else if (formData.senha.length < 6) {
      newErrors.senha = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!isLoginMode) {
      if (!formData.nomeCompleto) {
        newErrors.nomeCompleto = 'Nome completo é obrigatório';
      }

      if (!formData.confirmarSenha) {
        newErrors.confirmarSenha = 'Confirmação de senha é obrigatória';
      } else if (formData.senha !== formData.confirmarSenha) {
        newErrors.confirmarSenha = 'Senhas não coincidem';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (isLoginMode) {
        await onLogin(formData.email, formData.senha);
      } else {
        console.log('🚀 Tentando registrar usuário:', formData.email);
        await onRegister({
          email: formData.email,
          senha: formData.senha,
          nomeCompleto: formData.nomeCompleto
        });
      }
    } catch (error) {
      console.error('💥 Erro no formulário:', error);
      // O erro será tratado pelos componentes pai (AuthGuard/AuthContext)
    }
  };

  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    setIsRecoveryMode(false);
    setFormData({
      email: '',
      senha: '',
      nomeCompleto: '',
      confirmarSenha: ''
    });
    setErrors({});
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: 'Digite seu email para recuperar a senha' });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Email inválido' });
      return;
    }

    setRecoveryLoading(true);
    setErrors({});

    try {
      const result = await resetPassword(formData.email);
      
      if (result.success) {
        // Volta para o modo de login e mostra mensagem de sucesso
        setIsRecoveryMode(false);
        // A mensagem será exibida via statusMessage do componente pai
        console.log('✅ Email de recuperação enviado:', result.message);
      } else {
        setErrors({ email: result.message || 'Erro ao enviar email de recuperação' });
      }
    } catch (error) {
      console.error('💥 Erro na recuperação de senha:', error);
      setErrors({ email: 'Erro ao enviar email de recuperação. Tente novamente.' });
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="login-glass-card rounded-2xl w-full max-w-md mx-auto relative animate-in fade-in duration-300">
        {/* Header */}
        <div className="login-header-gradient rounded-t-2xl p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors"
            disabled={loading}
          >
            <FaTimes className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <FaBolt className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold mb-1">
              {isRecoveryMode 
                ? 'Recuperar Senha' 
                : isLoginMode 
                ? 'Bem-vindo de volta' 
                : 'Criar Conta'
              }
            </h2>
            <p className="text-white/60 text-sm">
              {isRecoveryMode 
                ? 'Digite seu email para receber o link de recuperação'
                : isLoginMode 
                ? 'Acesse o sistema Effort Engenharia' 
                : 'Junte-se à equipe Effort Engenharia'
              }
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {/* Status Message */}
          {statusMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              statusType === 'error' 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : statusType === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : statusType === 'info'
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
            }`}>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 mt-0.5">
                  {statusType === 'error' ? '❌' : 
                   statusType === 'success' ? '✅' : 
                   statusType === 'info' ? 'ℹ️' : '📝'}
                </span>
                <span className="flex-1">{statusMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome Completo (apenas no registro) */}
            {!isLoginMode && !isRecoveryMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="nomeCompleto"
                    value={formData.nomeCompleto}
                    onChange={handleInputChange}
                    className={`login-input w-full px-4 py-3 pl-10 rounded-xl focus:outline-none transition-all ${
                      errors.nomeCompleto 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'focus:border-orange-500/50'
                    }`}
                    placeholder="Digite seu nome completo"
                    disabled={loading}
                  />
                  <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                </div>
                {errors.nomeCompleto && (
                  <p className="text-red-400 text-xs mt-1">{errors.nomeCompleto}</p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`login-input w-full px-4 py-3 pl-10 rounded-xl focus:outline-none transition-all ${
                    errors.email 
                      ? 'border-red-500/50 focus:border-red-500' 
                      : 'focus:border-orange-500/50'
                  }`}
                  placeholder="Digite seu email"
                  disabled={loading || recoveryLoading}
                />
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Senha (não mostrar no modo de recuperação) */}
            {!isRecoveryMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="senha"
                    value={formData.senha}
                    onChange={handleInputChange}
                    className={`login-input w-full px-4 py-3 pl-10 pr-10 rounded-xl focus:outline-none transition-all ${
                      errors.senha 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'focus:border-orange-500/50'
                    }`}
                    placeholder="Digite sua senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <FaEyeSlash className="w-4 h-4" />
                    ) : (
                      <FaEye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.senha && (
                  <p className="text-red-400 text-xs mt-1">{errors.senha}</p>
                )}
              </div>
            )}

            {/* Confirmar Senha (apenas no registro) */}
            {!isLoginMode && !isRecoveryMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmarSenha"
                    value={formData.confirmarSenha}
                    onChange={handleInputChange}
                    className={`login-input w-full px-4 py-3 pl-10 rounded-xl focus:outline-none transition-all ${
                      errors.confirmarSenha 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'focus:border-orange-500/50'
                    }`}
                    placeholder="Confirme sua senha"
                    disabled={loading}
                  />
                  <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                </div>
                {errors.confirmarSenha && (
                  <p className="text-red-400 text-xs mt-1">{errors.confirmarSenha}</p>
                )}
              </div>
            )}

            {/* Botão de Submit */}
            <button
              type={isRecoveryMode ? 'button' : 'submit'}
              onClick={isRecoveryMode ? handleForgotPassword : undefined}
              disabled={loading || recoveryLoading}
              className="w-full login-btn-primary text-white py-3.5 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading || recoveryLoading ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <FaBolt className="w-4 h-4" />
                  <span>
                    {isRecoveryMode 
                      ? 'Enviar Link de Recuperação'
                      : isLoginMode 
                      ? 'Entrar' 
                      : 'Criar Conta'
                    }
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Switch Mode e Esqueci a senha */}
          <div className="mt-6 text-center space-y-3">
            {/* Botão Esqueci a senha (apenas no modo login) */}
            {isLoginMode && !isRecoveryMode && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(true)}
                  className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
                  disabled={loading}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {/* Voltar do modo recuperação */}
            {isRecoveryMode && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(false)}
                  className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
                  disabled={recoveryLoading}
                >
                  ← Voltar ao login
                </button>
              </div>
            )}

            {/* Switch entre login e registro (não mostrar no modo recuperação) */}
            {!isRecoveryMode && (
              <div>
                <p className="text-sm text-gray-500">
                  {isLoginMode ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                  <button
                    type="button"
                    onClick={switchMode}
                    className="ml-1 text-orange-400 hover:text-orange-300 font-medium transition-colors"
                    disabled={loading}
                  >
                    {isLoginMode ? 'Cadastre-se' : 'Faça login'}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;