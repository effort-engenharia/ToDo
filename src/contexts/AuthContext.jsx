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
        // Se a conta está pendente de ativação, NÃO fazer login automático
        if (resultado.pendingActivation) {
          return {
            success: true,
            pendingActivation: true,
            message: resultado.message
          };
        }
        
        // Apenas fazer login automático se for admin principal
        setUsuario(resultado.usuario);
        setIsAuthenticated(true);
        
        // Armazenar no localStorage
        localStorage.setItem('usuario_dashboard', JSON.stringify(resultado.usuario));
        
        return {
          success: true,
          message: resultado.message
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

  // Obter todas as páginas que o usuário tem acesso
  const obterPaginasPermitidas = async () => {
    if (!usuario?.id) return [];
    
    try {
      // Páginas comerciais e execução
      const paginasComerciais = ['dashboard', 'apontamentos', 'arsenal'];
      const paginasExecucao = ['execucao', 'execucao/atividades-dia', 'execucao/agenda-eletrica', 
        'execucao/agenda-civil', 'execucao/agenda-galpao', 'execucao/pedido-material',
        'execucao/desempenho-individual', 'execucao/desempenho-time', 'execucao/planejamento-macro',
        'execucao/pops', 'execucao/minhas-atividades'];
      const todasPaginas = [...paginasComerciais, ...paginasExecucao];
      const paginasPermitidas = [];
      
      // Administrador geral tem acesso a tudo
      if (usuario?.nivel_acesso?.nome === 'Administrador') {
        return paginasComerciais; // Admin comercial só vê páginas comerciais
      }
      
      // ADMIN_EXECUCAO tem acesso a todas as páginas de execução
      if (usuario?.nivel_acesso?.nome === 'ADMIN_EXECUCAO') {
        return paginasExecucao;
      }
      
      // TECNICO tem acesso limitado às páginas de execução
      if (usuario?.nivel_acesso?.nome === 'TECNICO') {
        return ['execucao', 'execucao/minhas-atividades', 'execucao/pops'];
      }
      
      // Verificar permissão para cada página para outros níveis
      for (const pagina of todasPaginas) {
        const temAcesso = await authService.verificarPermissao(usuario.id, pagina);
        if (temAcesso) {
          paginasPermitidas.push(pagina);
        }
      }
      
      return paginasPermitidas;
    } catch (error) {
      console.error('Erro ao obter páginas permitidas:', error);
      return [];
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
    obterPaginasPermitidas,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};