import React from 'react';
import { FaShoppingCart, FaSignOutAlt, FaArrowLeft, FaListUl } from 'react-icons/fa';
import NotificacoesDropdown from '../../execucao/components/NotificacoesDropdown';
import { NIVEIS } from '../../../utils/permissoes';

const iniciais = (nome) => {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  return partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : nome.substring(0, 2).toUpperCase();
};

const rotuloPerfil = (usuario) => {
  const nivel = usuario?.nivel_acesso?.nome;
  if (nivel === NIVEIS.COMPRAS) return 'Compras';
  if (nivel === NIVEIS.ADMIN) return 'Administrador';
  return nivel || 'Usuário';
};

// Cabeçalho + navegação própria do módulo Compras (só COMPRAS e Administrador).
// Somente o Administrador ganha o atalho de volta ao Dashboard Comercial.
const ComprasHeader = ({ usuario, badges = {}, isAdmin = false, voltarPara = null, onLogout }) => {
  const respostas = badges.compras || 0;

  return (
    <header className="cmp-topbar">
      <div className="cmp-topbar-marca">
        <span className="cmp-topbar-logo" aria-hidden="true"><FaShoppingCart /></span>
        <div>
          <div className="cmp-topbar-titulo">Compras</div>
          <div className="cmp-topbar-subtitulo">Dashboard do setor</div>
        </div>
      </div>

      <nav className="cmp-topbar-nav" aria-label="Navegação do módulo Compras">
        <button type="button" className="cmp-topbar-link ativo" aria-current="page">
          <FaListUl aria-hidden="true" />
          <span>Fila de Compras</span>
          {respostas > 0 && (
            <span className="execucao-nav-badge" aria-label={`${respostas} resposta(s) não lida(s)`}>
              {respostas > 99 ? '99+' : respostas}
            </span>
          )}
        </button>
        {voltarPara && (
          <button type="button" className="cmp-topbar-link" onClick={voltarPara.acao}>
            <FaArrowLeft aria-hidden="true" />
            <span>{voltarPara.rotulo}</span>
          </button>
        )}
      </nav>

      <div className="cmp-topbar-direita">
        <NotificacoesDropdown usuarioId={usuario?.id} isAdmin={isAdmin} noModuloCompras />
        <div className="cmp-topbar-usuario">
          <span className="execucao-user-avatar" aria-hidden="true">{iniciais(usuario?.nome_completo)}</span>
          <div className="cmp-topbar-usuario-info">
            <div className="execucao-user-name">{usuario?.nome_completo || 'Usuário'}</div>
            <div className="execucao-user-role">{rotuloPerfil(usuario)}</div>
          </div>
        </div>
        <button type="button" className="execucao-header-btn" onClick={onLogout} title="Sair" aria-label="Sair">
          <FaSignOutAlt aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

export default ComprasHeader;
