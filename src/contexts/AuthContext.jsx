import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/supabase/auth.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar se há usuário logado no localStorage
  useEffect(() => {
    const usuarioArmazenado = localStorage.getItem('usuario_dashboard');
    if (usuarioArmazenado) {
      try {
        const dadosUsuario = JSON.parse(usuarioArmazenado);
        setUsuario(dadosUsuario);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Erro ao carregar usuário do localStorage:', error);
        localStorage.removeItem('usuario_dashboard');
      }
    }
    setLoading(false);
  }, []);

  // Função de login
  const login = async (email, senha) => {
    try {
      setLoading(true);
      const resultado = await authService.login(email, senha);
      
      if (resultado.success) {
        setUsuario(resultado.usuario);
        setIsAuthenticated(true);
        
        // Armazenar no localStorage
        localStorage.setItem('usuario_dashboard', JSON.stringify(resultado.usuario));
        
        return {
          success: true,
          message: 'Login realizado com sucesso!'
        };
      } else {
        return {
          success: false,
          message: resultado.message
        };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return {
        success: false,
        message: 'Erro interno do sistema. Tente novamente.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Função de registro
  const registrar = async (dadosUsuario) => {
    try {
      setLoading(true);
      const resultado = await authService.registrarUsuario(dadosUsuario);
      
      if (resultado.success) {
        setUsuario(resultado.usuario);
        setIsAuthenticated(true);
        
        // Armazenar no localStorage
        localStorage.setItem('usuario_dashboard', JSON.stringify(resultado.usuario));
        
        return {
          success: true,
          message: 'Cadastro realizado com sucesso!'
        };
      } else {
        return {
          success: false,
          message: resultado.message
        };
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      return {
        success: false,
        message: 'Erro interno do sistema. Tente novamente.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Função de logout
  const logout = async () => {
    try {
      setLoading(true);
      
      // Registrar log de logout antes de sair
      if (usuario?.email) {
        await authService.registrarLog(usuario.email, 'LOGOUT', { sucesso: true });
      }

      // Fazer logout do Supabase Auth
      const resultado = await authService.logout();
      
      if (!resultado.success) {
        console.error('Erro no logout do Supabase:', resultado.message);
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Sempre limpar dados locais, mesmo se houver erro
      setUsuario(null);
      setIsAuthenticated(false);
      localStorage.removeItem('usuario_dashboard');
      setLoading(false);
    }
  };

  // Verificar se o usuário tem permissão para acessar uma página
  const temPermissao = async (rotaPagina) => {
    if (!usuario?.id) return false;
    
    try {
      return await authService.verificarPermissao(usuario.id, rotaPagina);
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      return false;
    }
  };

  // Verificar se o usuário é administrador
  const isAdmin = () => {
    return usuario?.nivel_acesso?.nome === 'Administrador';
  };

  const value = {
    usuario,
    isAuthenticated,
    loading,
    login,
    registrar,
    logout,
    temPermissao,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};