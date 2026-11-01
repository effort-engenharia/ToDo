// Regras de permissão do módulo de Execução (fonte única; espelham is_admin_execucao() / is_compras() / pode_ver_compras() no banco).
export const NIVEIS = {
  ADMIN: 'Administrador',
  ADMIN_EXEC: 'ADMIN_EXECUCAO',
  TECNICO: 'TECNICO',
  COMPRAS: 'COMPRAS',
};

const nivelDe = (usuario) => usuario?.nivel_acesso?.nome;

export const isAdminExecucao = (usuario) =>
  [NIVEIS.ADMIN_EXEC, NIVEIS.ADMIN].includes(nivelDe(usuario));

// Espelha is_compras() do banco: o setor de Compras e o Administrador geral operam a fila (assumir, status, questionar)
export const isCompras = (usuario) => [NIVEIS.COMPRAS, NIVEIS.ADMIN].includes(nivelDe(usuario));

// Perfil exclusivo do setor de Compras (sem acesso às demais páginas de gestão)
export const isSomenteCompras = (usuario) => nivelDe(usuario) === NIVEIS.COMPRAS;

// Espelha pode_ver_compras(): quem enxerga o Dashboard de Compras (Compras, ADMIN_EXECUCAO e Administrador)
export const podeVerCompras = (usuario) => isCompras(usuario) || isAdminExecucao(usuario);

export const PAGINAS_TECNICO = ['meu-dia', 'home', 'minhas-atividades', 'pops'];

// Compras é módulo próprio (rota de topo `compras`); o perfil COMPRAS não acessa nenhuma página da Execução.
// Páginas que o perfil pode abrir na Execução (admin: todas; técnico: as dele)
export const paginaPermitida = (usuario, pagina) => {
  if (isAdminExecucao(usuario)) return true;
  if (isSomenteCompras(usuario)) return false;
  return PAGINAS_TECNICO.includes(pagina);
};

// Destino quando o perfil tenta abrir uma página que não é dele
export const paginaDeSeguranca = () => 'minhas-atividades';

// Página inicial de cada perfil
export const paginaInicial = (usuario) => {
  if (isAdminExecucao(usuario)) return 'home';
  return 'meu-dia';
};
