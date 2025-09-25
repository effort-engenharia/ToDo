import { supabase } from './config.js';

// Serviços de autenticação usando Supabase Auth nativo
export const authService = {
  // Fazer login usando Supabase Auth
  async login(email, password) {
    try {
      console.log('🔐 Tentando fazer login com Supabase Auth:', email);
      
      // Usar Supabase Auth para autenticação segura
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) {
        console.log('❌ Erro de autenticação:', authError.message);
        
        // Registrar log de falha
        await this.registrarLog(email, 'LOGIN_FAILED', { erro: authError.message });
        
        throw new Error('Email ou senha inválidos');
      }

      console.log('✅ Autenticação Supabase bem-sucedida');

      // Buscar dados adicionais do usuário na tabela personalizada
      let { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `)
        .eq('email', email)
        .eq('ativo', true)
        .single();

      // Se não encontrou na tabela customizada, criar entrada
      if (userError && userError.code === 'PGRST116') {
        console.log('👤 Criando entrada na tabela usuarios para:', email);
        
        // Buscar nível de acesso padrão
        let nivelAcessoId = null;
        if (email === 'effort.engenharia.eletrica@gmail.com') {
          const { data: nivelAdmin } = await supabase
            .from('niveis_acesso')
            .select('id')
            .eq('nome', 'Administrador')
            .single();
          nivelAcessoId = nivelAdmin?.id;
        } else {
          const { data: nivelUsuario } = await supabase
            .from('niveis_acesso')
            .select('id')
            .eq('nome', 'Usuário')
            .single();
          nivelAcessoId = nivelUsuario?.id;
        }

        // Criar entrada na tabela usuarios
        const { data: novoUsuario, error: createError } = await supabase
          .from('usuarios')
          .insert([{
            email: email,
            nome_completo: authData.user.user_metadata?.full_name || email.split('@')[0],
            nivel_acesso_id: nivelAcessoId,
            ativo: true,
            auth_user_id: authData.user.id
          }])
          .select(`
            *,
            nivel_acesso:niveis_acesso(*)
          `)
          .single();

        if (createError) {
          console.error('❌ Erro ao criar usuário:', createError);
          throw new Error('Erro ao configurar usuário');
        }

        usuario = novoUsuario;
      } else if (userError) {
        console.log('❌ Usuário inativo ou erro:', userError);
        throw new Error('Usuário inativo ou não encontrado');
      }

      // Registrar log de acesso bem-sucedido
      await this.registrarLog(email, 'LOGIN', { sucesso: true });

      // Retornar dados do usuário
      console.log('🎉 Login bem-sucedido para:', email);
      return {
        success: true,
        usuario: usuario,
        session: authData.session
      };
    } catch (error) {
      // Registrar log de falha se não foi registrado antes
      if (!error.message.includes('Email ou senha inválidos')) {
        await this.registrarLog(email, 'LOGIN_FAILED', { erro: error.message });
      }
      
      console.error('💥 Erro ao fazer login:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Registrar novo usuário usando Supabase Auth
  async registrarUsuario(dadosUsuario) {
    try {
      console.log('📝 Registrando usuário com Supabase Auth:', dadosUsuario.email);

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: dadosUsuario.email,
        password: dadosUsuario.senha,
        options: {
          data: {
            full_name: dadosUsuario.nomeCompleto
          }
        }
      });

      if (authError) {
        console.log('❌ Erro no registro Supabase Auth:', authError.message);
        throw new Error(authError.message);
      }

      console.log('✅ Usuário criado no Supabase Auth');

      // Buscar nível de acesso padrão (Usuário)
      const { data: nivelUsuario } = await supabase
        .from('niveis_acesso')
        .select('id')
        .eq('nome', 'Usuário')
        .single();

      // Criar entrada na tabela usuarios personalizada
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          email: dadosUsuario.email,
          nome_completo: dadosUsuario.nomeCompleto,
          nivel_acesso_id: nivelUsuario?.id,
          ativo: true,
          auth_user_id: authData.user.id
        }])
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `);

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('Email já cadastrado no sistema');
        }
        throw error;
      }

      // Registrar log
      await this.registrarLog(dadosUsuario.email, 'REGISTRO', { sucesso: true });

      return {
        success: true,
        usuario: data[0],
        message: 'Usuário registrado com sucesso'
      };
    } catch (error) {
      await this.registrarLog(dadosUsuario.email, 'REGISTRO_FAILED', { erro: error.message });
      
      console.error('Erro ao registrar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Logout usando Supabase Auth
  async logout() {
    try {
      console.log('🚪 Fazendo logout do Supabase Auth');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      console.log('✅ Logout bem-sucedido');
      return { success: true };
    } catch (error) {
      console.error('💥 Erro no logout:', error);
      return { success: false, message: error.message };
    }
  },

  // Verificar permissões do usuário para uma página
  async verificarPermissao(usuarioId, rotaPagina) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          nivel_acesso:niveis_acesso(
            permissoes(
              pagina:paginas(rota)
            )
          )
        `)
        .eq('id', usuarioId)
        .single();

      if (error) throw error;

      const permissoes = data.nivel_acesso?.permissoes || [];
      return permissoes.some(p => p.pagina.rota === rotaPagina);
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      return false;
    }
  },

  // Obter IP do usuário (simulado - em produção usar real IP)
  async obterIP() {
    try {
      // Em desenvolvimento, retorna IP local
      // Em produção, implementar detecção real de IP
      return '127.0.0.1';
    } catch (error) {
      return 'unknown';
    }
  },

  // Registrar log de acesso
  async registrarLog(email, acao, detalhes = {}) {
    try {
      const ip = await this.obterIP();
      
      await supabase
        .from('logs_acesso')
        .insert([{
          usuario_email: email,
          ip_address: ip,
          acao: acao,
          detalhes: detalhes
        }]);
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }
};

// Serviços de administração de usuários
export const adminService = {
  // Listar todos os usuários
  async listarUsuarios() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        usuarios: data.map(user => {
          const { senha_hash, ...userSemSenha } = user;
          return userSemSenha;
        })
      };
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Criar novo usuário (admin)
  async criarUsuario(dadosUsuario, nivelAcessoId) {
    try {
      // TEMPORÁRIO: Sem hash para teste
      const senhaHash = dadosUsuario.senha;

      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          email: dadosUsuario.email,
          senha_hash: senhaHash,
          nome_completo: dadosUsuario.nomeCompleto,
          nivel_acesso_id: nivelAcessoId,
          ativo: true
        }])
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Email já cadastrado no sistema');
        }
        throw error;
      }

      const { senha_hash, ...usuarioLimpo } = data[0];
      return {
        success: true,
        usuario: usuarioLimpo
      };
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Inativar usuário
  async inativarUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update({ ativo: false })
        .eq('id', usuarioId)
        .select();

      if (error) throw error;

      return {
        success: true,
        message: 'Usuário inativado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao inativar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Ativar usuário
  async ativarUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update({ ativo: true })
        .eq('id', usuarioId)
        .select();

      if (error) throw error;

      return {
        success: true,
        message: 'Usuário ativado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao ativar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Excluir usuário
  async excluirUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuarioId);

      if (error) throw error;

      return {
        success: true,
        message: 'Usuário excluído com sucesso'
      };
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Listar níveis de acesso
  async listarNiveisAcesso() {
    try {
      const { data, error } = await supabase
        .from('niveis_acesso')
        .select('*')
        .order('nome');

      if (error) throw error;

      return {
        success: true,
        niveis: data
      };
    } catch (error) {
      console.error('Erro ao listar níveis de acesso:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Listar logs de acesso
  async listarLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('logs_acesso')
        .select('*')
        .order('data_acesso', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        logs: data
      };
    } catch (error) {
      console.error('Erro ao listar logs:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Listar páginas disponíveis
  async listarPaginas() {
    try {
      const { data, error } = await supabase
        .from('paginas')
        .select('*')
        .order('nome');

      if (error) throw error;

      return {
        success: true,
        paginas: data
      };
    } catch (error) {
      console.error('Erro ao listar páginas:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Atualizar permissões de um nível de acesso
  async atualizarPermissoes(nivelAcessoId, paginaIds) {
    try {
      // Primeiro, remover permissões existentes
      await supabase
        .from('permissoes')
        .delete()
        .eq('nivel_acesso_id', nivelAcessoId);

      // Inserir novas permissões
      if (paginaIds.length > 0) {
        const permissoes = paginaIds.map(paginaId => ({
          nivel_acesso_id: nivelAcessoId,
          pagina_id: paginaId
        }));

        const { error } = await supabase
          .from('permissoes')
          .insert(permissoes);

        if (error) throw error;
      }

      return {
        success: true,
        message: 'Permissões atualizadas com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Obter permissões de um nível de acesso
  async obterPermissoes(nivelAcessoId) {
    try {
      const { data, error } = await supabase
        .from('permissoes')
        .select(`
          pagina:paginas(*)
        `)
        .eq('nivel_acesso_id', nivelAcessoId);

      if (error) throw error;

      return {
        success: true,
        permissoes: data.map(p => p.pagina)
      };
    } catch (error) {
      console.error('Erro ao obter permissões:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
};