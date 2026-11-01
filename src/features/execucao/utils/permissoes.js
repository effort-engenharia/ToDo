// Regras de permissão do módulo de Execução (espelham is_admin_execucao() no banco).
// Níveis e regras de Compras vivem em src/utils/permissoes.js (neutro).
import { NIVEIS, isSomenteCompras, nivelDe } from '../../../utils/permissoes';

export { NIVEIS };

export const isAdminExecucao = (usuario) =>
  [NIVEIS.ADMIN_EXEC, NIVEIS.ADMIN].includes(nivelDe(usuario));

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
