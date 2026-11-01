// Regras de permissão neutras (usadas por Execução, Compras e roteamento de topo).
export const NIVEIS = {
  ADMIN: 'Administrador',
  ADMIN_EXEC: 'ADMIN_EXECUCAO',
  TECNICO: 'TECNICO',
  COMPRAS: 'COMPRAS',
};

export const nivelDe = (usuario) => usuario?.nivel_acesso?.nome;

export const isAdministrador = (usuario) => nivelDe(usuario) === NIVEIS.ADMIN;

// Espelha is_compras() do banco: o setor de Compras e o Administrador geral operam a fila (assumir, status, questionar)
export const isCompras = (usuario) => [NIVEIS.COMPRAS, NIVEIS.ADMIN].includes(nivelDe(usuario));

// Perfil exclusivo do setor de Compras (sem acesso às demais páginas)
export const isSomenteCompras = (usuario) => nivelDe(usuario) === NIVEIS.COMPRAS;

// O módulo Compras (#/compras) é acessível SOMENTE por COMPRAS e Administrador. ADMIN_EXECUCAO/TECNICO nunca.
export const podeAcessarCompras = (usuario) => isCompras(usuario);
