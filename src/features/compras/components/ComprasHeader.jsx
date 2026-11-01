import React from 'react';
import { FaShoppingCart, FaSignOutAlt, FaArrowLeft, FaListUl, FaFileInvoiceDollar, FaTruck, FaChartLine, FaCog } from 'react-icons/fa';
import NotificacoesDropdown from '../../execucao/components/NotificacoesDropdown';
import { NIVEIS } from '../../../utils/permissoes';
import { irParaSecao } from '../utils/navegacaoCompras';

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
// Cotações/Fornecedores/Preços aparecem só com `cotacaoDisponivel` (migrations 34–37 aplicadas: `compras_config_obter` responde);
// Configurações só para o Administrador. Sem o recurso, a navegação é idêntica à anterior ("Fila de Compras").
const ABAS_COTACAO = [
  { secao: 'cotacoes', rotulo: 'Cotações', Icone: FaFileInvoiceDollar },
  { secao: 'fornecedores', rotulo: 'Fornecedores', Icone: FaTruck },
  { secao: 'precos', rotulo: 'Preços', Icone: FaChartLine },
  { secao: 'config', rotulo: 'Configurações', Icone: FaCog, soAdmin: true },
];

const ComprasHeader = ({ usuario, badges = {}, isAdmin = false, voltarPara = null, onLogout, secao = 'pedidos', cotacaoDisponivel = false }) => {
  const respostas = badges.compras || 0;
  const abas = ABAS_COTACAO.filter((a) => cotacaoDisponivel && (!a.soAdmin || isAdmin));

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
        <button
          type="button"
          className={`cmp-topbar-link${secao === 'pedidos' ? ' ativo' : ''}`}
          aria-current={secao === 'pedidos' ? 'page' : undefined}
          onClick={() => irParaSecao('pedidos')}
        >
          <FaListUl aria-hidden="true" />
          <span>{cotacaoDisponivel ? 'Pedidos' : 'Fila de Compras'}</span>
          {respostas > 0 && (
            <span className="execucao-nav-badge" aria-label={`${respostas} resposta(s) não lida(s)`}>
              {respostas > 99 ? '99+' : respostas}
            </span>
          )}
        </button>
        {abas.map((a) => {
          const Icone = a.Icone;
          return (
            <button
              key={a.secao}
              type="button"
              className={`cmp-topbar-link${secao === a.secao ? ' ativo' : ''}`}
              aria-current={secao === a.secao ? 'page' : undefined}
              onClick={() => irParaSecao(a.secao)}
            >
              <Icone aria-hidden="true" />
              <span>{a.rotulo}</span>
            </button>
          );
        })}
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
