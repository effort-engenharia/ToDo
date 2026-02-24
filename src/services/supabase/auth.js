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
        
        // Se for erro de email não confirmado, verificar se usuário está ativo na nossa tabela
        if (authError.message.includes('Email not confirmed')) {
          console.log('📧 Email não confirmado, verificando se usuário está ativo...');
          
          // Buscar usuário na nossa tabela
          const { data: usuarioLocal, error: localError } = await supabase
            .from('usuarios')
            .select(`
              *,
              nivel_acesso:niveis_acesso(*)
            `)
            .eq('email', email)
            .single();

          if (usuarioLocal && usuarioLocal.ativo) {
            console.log('✅ Usuário ativo encontrado, permitindo login mesmo sem confirmação de email');
            
            // Registrar log de acesso bem-sucedido (com observação sobre confirmação)
            await authService.registrarLog(email, 'LOGIN', { 
              sucesso: true, 
              observacao: 'Login sem confirmação de email (usuário ativo)' 
            });

            // Retornar dados do usuário mesmo sem confirmação de email
            return {
              success: true,
              usuario: usuarioLocal,
              session: null // Sem sessão do Supabase Auth, mas permitir acesso
            };
          } else if (usuarioLocal && !usuarioLocal.ativo) {
            console.log('🔒 Usuário encontrado mas inativo');
            await authService.registrarLog(email, 'LOGIN_FAILED', { erro: 'Conta inativa' });
            throw new Error('Sua conta está pendente de ativação pelo administrador. Entre em contato para liberar o acesso.');
          } else {
            console.log('❌ Usuário não encontrado na tabela local');
            await authService.registrarLog(email, 'LOGIN_FAILED', { erro: 'Usuário não encontrado' });
            throw new Error('Usuário não encontrado');
          }
        } else {
          // Outros erros de autenticação
          await authService.registrarLog(email, 'LOGIN_FAILED', { erro: authError.message });
          throw new Error('Email ou senha inválidos');
        }
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
        .single();

      // Verificar se usuário existe mas está inativo
      if (usuario && !usuario.ativo) {
        console.log('🔒 Usuário encontrado mas está inativo:', email);
        await authService.registrarLog(email, 'LOGIN_FAILED', { erro: 'Conta inativa' });
        throw new Error('Sua conta está pendente de ativação pelo administrador. Entre em contato para liberar o acesso.');
      }

      // Se não encontrou na tabela customizada, criar entrada (compatibilidade)
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
      await authService.registrarLog(email, 'LOGIN', { sucesso: true });

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
        await authService.registrarLog(email, 'LOGIN_FAILED', { erro: error.message });
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
          },
          emailRedirectTo: undefined // Tentar desabilitar confirmação por email
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
      // Usuários ficam inativos por padrão, exceto admin principal
      const isAdminPrincipal = dadosUsuario.email === 'effort.engenharia.eletrica@gmail.com';
      
      const { data, error } = await supabase
        .from('usuarios')
        .insert([{
          email: dadosUsuario.email,
          nome_completo: dadosUsuario.nomeCompleto,
          nivel_acesso_id: nivelUsuario?.id,
          ativo: isAdminPrincipal, // Apenas admin principal fica ativo imediatamente
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
      await authService.registrarLog(dadosUsuario.email, 'REGISTRO', { sucesso: true });

      const usuarioCriado = data[0];

      return {
        success: true,
        usuario: usuarioCriado,
        pendingActivation: !isAdminPrincipal, // Indica se precisa de ativação
        message: isAdminPrincipal 
          ? 'Usuário registrado com sucesso!' 
          : 'Conta criada com sucesso! Aguardando ativação pelo administrador.'
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

      await authService.registrarLog(dadosUsuario.email, 'REGISTRO_FAILED', { erro: error.message });
      
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
      await authService.registrarLog(dadosUsuario.email, 'REGISTRO_ALTERNATIVO', { sucesso: true });

      return {
        success: true,
        usuario: data[0],
        message: 'Usuário registrado com sucesso (modo alternativo)'
      };
    } catch (error) {
      await authService.registrarLog(dadosUsuario.email, 'REGISTRO_ALTERNATIVO_FAILED', { erro: error.message });
      
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

  // Obter IP real do usuário
  async obterIP() {
    try {
      // Tentar múltiplas APIs para obter o IP real
      const ipApis = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://ipinfo.io/json',
        'https://api.my-ip.io/ip.json'
      ];

      for (const apiUrl of ipApis) {
        try {
          const response = await fetch(apiUrl, {
            method: 'GET',
            timeout: 5000 // Timeout de 5 segundos
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Diferentes APIs retornam o IP em campos diferentes
            const ip = data.ip || data.query || data.IPv4 || data.ipAddress;
            
            if (ip && this.isValidIP(ip)) {
              console.log(`✅ IP obtido via ${apiUrl}: ${ip}`);
              return ip;
            }
          }
        } catch (apiError) {
          console.warn(`⚠️ Falha na API ${apiUrl}:`, apiError.message);
          continue; // Tenta a próxima API
        }
      }

      // Se todas as APIs falharam, tentar obter através do WebRTC
      const webRtcIp = await this.obterIPWebRTC();
      if (webRtcIp && this.isValidIP(webRtcIp)) {
        console.log(`✅ IP obtido via WebRTC: ${webRtcIp}`);
        return webRtcIp;
      }

      // Fallback: retorna IP local como indicador
      console.warn('⚠️ Não foi possível obter IP real, usando fallback');
      return '127.0.0.1';
    } catch (error) {
      console.error('❌ Erro ao obter IP:', error);
      return 'unknown';
    }
  },

  // Validar se o IP está em formato válido
  isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  },

  // Método alternativo usando WebRTC para obter IP local/público
  async obterIPWebRTC() {
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/);
            if (ipMatch && !ipMatch[0].startsWith('127.') && !ipMatch[0].startsWith('192.168.')) {
              pc.close();
              resolve(ipMatch[0]);
            }
          }
        };
        
        // Timeout de 3 segundos para WebRTC
        setTimeout(() => {
          pc.close();
          resolve(null);
        }, 3000);
      } catch (error) {
        console.warn('WebRTC IP detection failed:', error);
        resolve(null);
      }
    });
  },

  // Registrar log de acesso
  async registrarLog(email, acao, detalhes = {}) {
    try {
      const ip = await this.obterIP();
      
      // Adicionar informações adicionais nos detalhes
      const detalhesCompletos = {
        ...detalhes,
        user_agent: navigator?.userAgent || 'unknown',
        timestamp_local: new Date().toISOString(),
        ip_tipo: ip === '127.0.0.1' ? 'local_fallback' : 
               ip === 'unknown' ? 'unknown' : 'public'
      };
      
      await supabase
        .from('logs_acesso')
        .insert([{
          usuario_email: email,
          ip_address: ip,
          acao: acao,
          detalhes: detalhesCompletos
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
      // Primeiro, buscar dados do usuário
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('email, auth_user_id')
        .eq('id', usuarioId)
        .single();

      if (userError) throw userError;

      // Ativar na tabela usuarios
      const { data, error } = await supabase
        .from('usuarios')
        .update({ ativo: true })
        .eq('id', usuarioId)
        .select();

      if (error) throw error;

      // Se tem auth_user_id, confirmar email no Supabase Auth também
      if (usuario.auth_user_id) {
        try {
          console.log('🔐 Confirmando email no Supabase Auth para:', usuario.email);
          
          // Confirmar email no Supabase Auth usando Admin API
          const { error: confirmError } = await supabase.auth.admin.updateUserById(
            usuario.auth_user_id,
            { 
              email_confirm: true,
              updated_at: new Date().toISOString()
            }
          );

          if (confirmError) {
            console.warn('⚠️ Erro ao confirmar email:', confirmError.message);
            // Não falhar a ativação por causa disso, apenas registrar log
          } else {
            console.log('✅ Email confirmado no Supabase Auth');
          }
        } catch (authError) {
          console.warn('⚠️ Erro na confirmação do email:', authError.message);
          // Continuar com a ativação mesmo se falhar aqui
        }
      }

      // Registrar log da ativação
      await authService.registrarLog(usuario.email, 'USUARIO_ATIVADO', { 
        usuarioId: usuarioId,
        admin: true
      });

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
  },

  // Criar novo nível de acesso
  async criarNivelAcesso(nome, descricao) {
    try {
      const { data, error } = await supabase
        .from('niveis_acesso')
        .insert([{
          nome: nome,
          descricao: descricao
        }])
        .select();

      if (error) throw error;

      return {
        success: true,
        nivel: data[0],
        message: 'Nível de acesso criado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar nível de acesso:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Editar usuário (alterar nível de acesso)
  async editarUsuario(usuarioId, dadosAtualizacao) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update(dadosAtualizacao)
        .eq('id', usuarioId)
        .select(`
          *,
          nivel_acesso:niveis_acesso(*)
        `);

      if (error) throw error;

      return {
        success: true,
        usuario: data[0],
        message: 'Usuário atualizado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao editar usuário:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  // Enviar email de recuperação de senha
  async resetPassword(email) {
    try {
      console.log('🔄 Enviando email de recuperação de senha para:', email);
      
      // Verificar se o email existe na nossa base de usuários
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('email, ativo')
        .eq('email', email)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      if (!usuario) {
        console.log('❌ Email não encontrado na base de usuários');
        // Por segurança, não revelar se o email existe ou não
        return {
          success: true,
          message: 'Se o email existir em nossa base, você receberá as instruções para redefinir sua senha.'
        };
      }

      if (!usuario.ativo) {
        console.log('🔒 Usuário inativo tentando recuperar senha');
        return {
          success: false,
          message: 'Conta inativa. Entre em contato com o administrador.'
        };
      }

      // Usar Supabase Auth para enviar email de recuperação
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (resetError) {
        console.error('❌ Erro ao enviar email de recuperação:', resetError);
        throw resetError;
      }

      // Registrar log da tentativa de recuperação
      await authService.registrarLog(email, 'PASSWORD_RESET_REQUEST', { 
        sucesso: true,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Email de recuperação enviado com sucesso');
      
      return {
        success: true,
        message: 'Email de recuperação enviado! Verifique sua caixa de entrada e spam.'
      };

    } catch (error) {
      console.error('💥 Erro na recuperação de senha:', error);
      
      // Registrar log do erro
      await authService.registrarLog(email, 'PASSWORD_RESET_ERROR', { 
        erro: error.message,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        message: 'Erro ao enviar email de recuperação. Tente novamente mais tarde.'
      };
    }
  },

  // Listar vendedores comerciais ativos (usuários com nome_vendedor_comercial preenchido e ativo = true)
  async listarVendedoresComerciais(incluirInativos = false) {
    try {
      let query = supabase
        .from('usuarios')
        .select('id, nome_completo, nome_vendedor_comercial, ativo')
        .not('nome_vendedor_comercial', 'is', null)
        .order('nome_vendedor_comercial');

      // Se não incluir inativos, filtrar apenas ativos
      if (!incluirInativos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        vendedores: data.map(u => u.nome_vendedor_comercial)
      };
    } catch (error) {
      console.error('Erro ao listar vendedores comerciais:', error);
      return {
        success: false,
        vendedores: [],
        message: error.message
      };
    }
  }
};

// Função separada para recuperação de senha (para resolver problema de contexto)
export const resetPassword = async (email) => {
  try {
    console.log('🔄 Enviando email de recuperação de senha para:', email);
    
    // Verificar se o email existe na nossa base de usuários
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('email, ativo')
      .eq('email', email)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    if (!usuario) {
      console.log('❌ Email não encontrado na base de usuários');
      // Por segurança, não revelar se o email existe ou não
      return {
        success: true,
        message: 'Se o email existir em nossa base, você receberá as instruções para redefinir sua senha.'
      };
    }

    if (!usuario.ativo) {
      console.log('🔒 Usuário inativo tentando recuperar senha');
      return {
        success: false,
        message: 'Conta inativa. Entre em contato com o administrador.'
      };
    }

    // Usar Supabase Auth para enviar email de recuperação
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (resetError) {
      console.error('❌ Erro ao enviar email de recuperação:', resetError);
      throw resetError;
    }

    // Registrar log da tentativa de recuperação
    await authService.registrarLog(email, 'PASSWORD_RESET_REQUEST', { 
      sucesso: true,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Email de recuperação enviado com sucesso');
    
    return {
      success: true,
      message: 'Email de recuperação enviado! Verifique sua caixa de entrada e spam.'
    };

  } catch (error) {
    console.error('💥 Erro na recuperação de senha:', error);
    
    // Registrar log do erro
    await authService.registrarLog(email, 'PASSWORD_RESET_ERROR', { 
      erro: error.message,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      message: 'Erro ao enviar email de recuperação. Tente novamente mais tarde.'
    };
  }
};