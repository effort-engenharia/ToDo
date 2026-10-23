// Regras de permissão do módulo de Execução (fonte única; espelham is_admin_execucao() no banco).
export const NIVEIS = {
  ADMIN: 'Administrador',
  ADMIN_EXEC: 'ADMIN_EXECUCAO',
  TECNICO: 'TECNICO',
};

export const isAdminExecucao = (usuario) =>
  [NIVEIS.ADMIN_EXEC, NIVEIS.ADMIN].includes(usuario?.nivel_acesso?.nome);

export const PAGINAS_TECNICO = ['meu-dia', 'home', 'minhas-atividades', 'pops'];

// Página inicial de cada perfil
export const paginaInicial = (usuario) => (isAdminExecucao(usuario) ? 'home' : 'meu-dia');
