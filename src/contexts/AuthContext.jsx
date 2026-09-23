import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/supabase/auth.js';
import { setImpersonating } from '../utils/impersonationGuard';

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
  // Impersonation: quando admin "entra como" outro usuário, salvamos aqui a sessão real
  const [adminOriginal, setAdminOriginal] = useState(null);

  // Verificar se há usuário logado no localStorage
  useEffect(() => {
    const usuarioArmazenado = localStorage.getItem('usuario_dashboard');
    const adminArmazenado = localStorage.getItem('admin_original_dashboard');
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
    if (adminArmazenado) {
      try {
        setAdminOriginal(JSON.parse(adminArmazenado));
      } catch (error) {
        console.error('Erro ao carregar admin original:', error);
        localStorage.removeItem('admin_original_dashboard');
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
      setAdminOriginal(null);
      localStorage.removeItem('usuario_dashboard');
      localStorage.removeItem('admin_original_dashboard');
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

  // ==== IMPERSONATION ====
  const impersonando = !!adminOriginal;

  // Espelha o estado no guard compartilhado (usado por services de escrita)
  useEffect(() => {
    setImpersonating(impersonando);
  }, [impersonando]);

  // Admin "entra como" outro usuário para testes. Guarda a sessão admin original
  // em localStorage e coloca o alvo como usuário corrente. Não mexe no Supabase Auth
  // (token permanece do admin), é uma troca só no estado da aplicação.
  const impersonar = async (usuarioAlvo) => {
    if (!usuario) {
      return { success: false, message: 'Nenhum usuário logado.' };
    }
    if (usuario?.nivel_acesso?.nome !== 'Administrador') {
      return { success: false, message: 'Apenas administradores podem impersonar.' };
    }
    if (adminOriginal) {
      return { success: false, message: 'Já está impersonando alguém. Volte primeiro.' };
    }
    if (!usuarioAlvo?.id) {
      return { success: false, message: 'Usuário alvo inválido.' };
    }
    if (usuarioAlvo.id === usuario.id) {
      return { success: false, message: 'Você já está logado como este usuário.' };
    }

    try {
      const adminAtual = usuario;
      setAdminOriginal(adminAtual);
      setUsuario(usuarioAlvo);
      localStorage.setItem('admin_original_dashboard', JSON.stringify(adminAtual));
      localStorage.setItem('usuario_dashboard', JSON.stringify(usuarioAlvo));

      // Log de auditoria (não interrompe se falhar)
      try {
        await authService.registrarLog(adminAtual.email, 'ADMIN_IMPERSONATE_START', {
          alvo_email: usuarioAlvo.email,
          alvo_id: usuarioAlvo.id,
          alvo_nome: usuarioAlvo.nome_completo,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Falha ao registrar log de impersonation:', logErr);
      }

      return { success: true, message: `Impersonando ${usuarioAlvo.nome_completo}` };
    } catch (error) {
      console.error('Erro ao impersonar:', error);
      // Rollback em caso de erro
      setAdminOriginal(null);
      localStorage.removeItem('admin_original_dashboard');
      return { success: false, message: 'Erro ao iniciar impersonation.' };
    }
  };

  // Volta pra sessão admin original
  const sairImpersonation = async () => {
    if (!adminOriginal) {
      return { success: false, message: 'Você não está impersonando ninguém.' };
    }
    try {
      const alvo = usuario;
      const admin = adminOriginal;

      setUsuario(admin);
      setAdminOriginal(null);
      localStorage.setItem('usuario_dashboard', JSON.stringify(admin));
      localStorage.removeItem('admin_original_dashboard');

      try {
        await authService.registrarLog(admin.email, 'ADMIN_IMPERSONATE_STOP', {
          alvo_email: alvo?.email,
          alvo_id: alvo?.id,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Falha ao registrar log de fim de impersonation:', logErr);
      }

      return { success: true, message: 'Voltou para a sessão admin.' };
    } catch (error) {
      console.error('Erro ao sair da impersonation:', error);
      return { success: false, message: 'Erro ao voltar.' };
    }
  };

  // Utilitário para bloquear ações de escrita durante impersonation.
  // Uso: if (!podeEscrever()) return;
  const podeEscrever = () => !impersonando;

  const value = {
    usuario,
    isAuthenticated,
    loading,
    login,
    registrar,
    logout,
    temPermissao,
    obterPaginasPermitidas,
    isAdmin,
    // Impersonation
    impersonando,
    adminOriginal,
    impersonar,
    sairImpersonation,
    podeEscrever,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};