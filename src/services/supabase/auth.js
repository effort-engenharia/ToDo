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
      console.log('🔧 Dados enviados:', { 
        email: dadosUsuario.email, 
        hasPassword: !!dadosUsuario.senha,
        fullName: dadosUsuario.nomeCompleto 
      });

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
        console.log('🔍 Detalhes do erro:', {
          code: authError.code,
          status: authError.status,
          details: authError.details,
          hint: authError.hint
        });

        // Tratar diferentes tipos de erro
        let mensagemUsuario = authError.message;
        
        if (authError.message.includes('Invalid email')) {
          mensagemUsuario = 'Email inválido. Verifique o formato do email.';
        } else if (authError.message.includes('Email address') && authError.message.includes('invalid')) {
          mensagemUsuario = 'Este domínio de email não é permitido no sistema.';
        } else if (authError.message.includes('Password')) {
          mensagemUsuario = 'Senha inválida. Use pelo menos 6 caracteres.';
        } else if (authError.message.includes('signup disabled')) {
          mensagemUsuario = 'Cadastro temporariamente desabilitado. Contate o administrador.';
        } else if (authError.message.includes('domain')) {
          mensagemUsuario = 'Domínio de email não permitido. Use um email corporativo.';
        }
        
        throw new Error(mensagemUsuario);
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
          auth_user_id: authData.user?.id || null
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
      // Se falhou o registro com Supabase Auth, tentar método alternativo
      if (error.message.includes('domínio de email não permitido') || 
          error.message.includes('domain') ||
          error.message.includes('Invalid email') ||
          error.message.includes('signup disabled')) {
        
        console.log('🔄 Tentando método alternativo de registro...');
        return await this.registrarUsuarioAlternativo(dadosUsuario);
      }

      await this.registrarLog(dadosUsuario.email, 'REGISTRO_FAILED', { erro: error.message });
      
      console.error('Erro ao registrar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Método alternativo de registro (sem Supabase Auth)
  async registrarUsuarioAlternativo(dadosUsuario) {
    try {
      console.log('🆔 Registro alternativo para:', dadosUsuario.email);

      // Verificar se o email já existe
      const { data: usuarioExistente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', dadosUsuario.email)
        .single();

      if (usuarioExistente) {
        throw new Error('Email já cadastrado no sistema');
      }

      // Buscar nível de acesso padrão (Usuário)
      const { data: nivelUsuario } = await supabase
        .from('niveis_acesso')
        .select('id')
        .eq('nome', 'Usuário')
        .single();

      // Hash da senha (simplificado - em produção usar bcrypt)
      const senhaHash = btoa(dadosUsuario.senha); // Base64 como exemplo

      // Criar entrada na tabela usuarios personalizada
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          email: dadosUsuario.email,
          nome_completo: dadosUsuario.nomeCompleto,
          senha_hash: senhaHash, // Adicionar coluna na tabela se necessário
          nivel_acesso_id: nivelUsuario?.id,
          ativo: true,
          auth_user_id: null, // Sem Supabase Auth
          created_at: new Date().toISOString(),
          metodo_registro: 'alternativo'
        }])
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `);

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('Email já cadastrado no sistema');
        }
        console.error('❌ Erro no registro alternativo:', error);
        throw new Error('Erro ao criar usuário. Contate o administrador.');
      }

      console.log('✅ Usuário criado com método alternativo');

      // Registrar log
      await this.registrarLog(dadosUsuario.email, 'REGISTRO_ALTERNATIVO', { sucesso: true });

      return {
        success: true,
        usuario: data[0],
        message: 'Usuário registrado com sucesso (modo alternativo)'
      };
    } catch (error) {
      await this.registrarLog(dadosUsuario.email, 'REGISTRO_ALTERNATIVO_FAILED', { erro: error.message });
      
      console.error('Erro no registro alternativo:', error);
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
        usuarios: data
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
      console.log('👤 Criando usuário via admin:', dadosUsuario.email);

      // Validar dados obrigatórios
      if (!dadosUsuario.email || !dadosUsuario.senha || !dadosUsuario.nomeCompleto) {
        throw new Error('Todos os campos são obrigatórios');
      }

      // Verificar se o email já existe na tabela usuarios
      const { data: existingUser, error: checkError } = await supabase
        .from('usuarios')
        .select('email')
        .eq('email', dadosUsuario.email)
        .single();

      if (existingUser) {
        throw new Error('Este email já está cadastrado no sistema');
      }

      // Removi a pré-validação problemática - deixar o Supabase Auth lidar com duplicatas
      console.log('✅ Prosseguindo com criação do usuário...');

      // Criar usuário no Supabase Auth usando signUp
      console.log('📝 Criando usuário no Supabase Auth...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: dadosUsuario.email,
        password: dadosUsuario.senha,
        options: {
          data: {
            full_name: dadosUsuario.nomeCompleto
          },
          emailRedirectTo: undefined // Desabilitar confirmação por email
        }
      });

      if (authError) {
        console.log('❌ Erro no Supabase Auth:', authError.message);
        
        // Tratar erros específicos do Supabase Auth
        if (authError.message.includes('already registered') || 
            authError.message.includes('invalid') ||
            authError.message.includes('Unable to validate email')) {
          throw new Error('Este email já está cadastrado ou é inválido');
        }
        
        throw new Error(`Erro de autenticação: ${authError.message}`);
      }

      console.log('✅ Usuário criado no Supabase Auth');

      // Confirmar automaticamente o email do usuário (para evitar problemas de "Email not confirmed")
      if (authData?.user?.id) {
        try {
          await supabase.auth.admin.updateUserById(authData.user.id, {
            email_confirm: true
          });
          console.log('✅ Email confirmado automaticamente');
        } catch (confirmError) {
          console.log('⚠️ Erro ao confirmar email automaticamente:', confirmError);
          // Não falhar a criação por causa disso
        }
      }

      // Criar entrada na tabela usuarios personalizada
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          email: dadosUsuario.email,
          nome_completo: dadosUsuario.nomeCompleto,
          nivel_acesso_id: nivelAcessoId,
          ativo: true,
          auth_user_id: authData.user?.id || null
        }])
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `);

      if (error) {
        console.error('❌ Erro ao inserir na tabela usuarios:', error);
        
        // Se houver erro, tentar remover o usuário do Supabase Auth
        if (authData?.user?.id) {
          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
            console.log('🧹 Usuário removido do Supabase Auth após erro');
          } catch (cleanupError) {
            console.error('Erro ao limpar usuário do Auth:', cleanupError);
          }
        }
        
        // Tratar erros específicos de banco de dados
        if (error.code === '23505') {
          throw new Error('Este email já está cadastrado no sistema');
        }
        
        throw new Error(`Erro ao criar usuário: ${error.message}`);
      }

      console.log('✅ Usuário criado com sucesso');
      return {
        success: true,
        usuario: data[0]
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