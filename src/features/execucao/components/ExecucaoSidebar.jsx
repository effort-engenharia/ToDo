import React from 'react';
import { 
  FaHome, 
  FaCalendarDay, 
  FaBolt, 
  FaHardHat, 
  FaWarehouse,
  FaBoxOpen,
  FaChartLine,
  FaUsers,
  FaProjectDiagram,
  FaBook,
  FaClipboardList,
  FaSignOutAlt
} from 'react-icons/fa';
import { NIVEIS, isAdminExecucao } from '../utils/permissoes';
import '../styles/execucao.css';

// Definição dos itens do menu
const menuItemsAdmin = [
  { id: 'home', label: 'Visão Geral', icon: FaHome, rota: 'execucao' },
  { id: 'atividades-dia', label: 'Atividades do Dia', icon: FaCalendarDay, rota: 'execucao/atividades-dia' },
  { id: 'agenda-eletrica', label: 'Agenda Elétrica', icon: FaBolt, rota: 'execucao/agenda-eletrica' },
  { id: 'agenda-civil', label: 'Agenda Civil', icon: FaHardHat, rota: 'execucao/agenda-civil' },
  { id: 'agenda-galpao', label: 'Agenda Galpão', icon: FaWarehouse, rota: 'execucao/agenda-galpao' },
  { id: 'agenda-gestao', label: 'Agenda Gestão', icon: FaClipboardList, rota: 'execucao/agenda-gestao' },
  { id: 'pedido-material', label: 'Pedido de Material', icon: FaBoxOpen, rota: 'execucao/pedido-material' },
  { id: 'desempenho-individual', label: 'Desempenho Individual', icon: FaChartLine, rota: 'execucao/desempenho-individual' },
  { id: 'desempenho-time', label: 'Desempenho do Time', icon: FaUsers, rota: 'execucao/desempenho-time' },
  { id: 'planejamento-macro', label: 'Planejamento Macro', icon: FaProjectDiagram, rota: 'execucao/planejamento-macro' },
  { id: 'pops', label: 'POPs', icon: FaBook, rota: 'execucao/pops' },
];

const menuItemsTecnico = [
  { id: 'home', label: 'Visão Geral', icon: FaHome, rota: 'execucao' },
  { id: 'minhas-atividades', label: 'Minhas Atividades', icon: FaClipboardList, rota: 'execucao/minhas-atividades' },
  { id: 'pops', label: 'POPs', icon: FaBook, rota: 'execucao/pops' },
];

const ExecucaoSidebar = ({ 
  currentPage, 
  onPageChange, 
  usuario, 
  isAdmin,
  onLogout,
  isMobileOpen,
  onCloseMobile
}) => {
  const menuItems = isAdmin ? menuItemsAdmin : menuItemsTecnico;

  // Agrupar itens por seção
  const menuSections = isAdmin ? [
    {
      title: 'Principal',
      items: menuItems.filter(item => ['home', 'atividades-dia'].includes(item.id))
    },
    {
      title: 'Agendas',
      items: menuItems.filter(item => item.id.startsWith('agenda-'))
    },
    {
      title: 'Gestão',
      items: menuItems.filter(item => ['pedido-material', 'desempenho-individual', 'desempenho-time', 'planejamento-macro', 'pops'].includes(item.id))
    }
  ] : [
    {
      title: 'Menu',
      items: menuItems
    }
  ];

  const handleItemClick = (item) => {
    onPageChange(item.id);
    if (onCloseMobile) onCloseMobile();
  };

  // Obter iniciais do usuário
  const getInitials = (nome) => {
    if (!nome) return '?';
    const partes = nome.split(' ');
    if (partes.length >= 2) {
      return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  // Obter nome do cargo
  const getRoleName = () => {
    if (isAdminExecucao(usuario)) return 'Administrador';
    if (usuario?.nivel_acesso?.nome === NIVEIS.TECNICO) return 'Técnico';
    return usuario?.nivel_acesso?.nome || 'Usuário';
  };

  return (
    <>
      {/* Overlay mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`execucao-sidebar ${isMobileOpen ? 'open' : ''}`} aria-label="Menu do módulo Execução">
        {/* Header com Logo */}
        <div className="execucao-sidebar-header">
          <div className="execucao-sidebar-logo">
            <div className="execucao-sidebar-logo-icon">
              <FaHardHat />
            </div>
            <div>
              <div className="execucao-sidebar-logo-text">Execução</div>
              <div className="execucao-sidebar-logo-subtitle">Dashboard</div>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="execucao-sidebar-nav">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="execucao-nav-section">
              <div className="execucao-nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`execucao-nav-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="execucao-nav-item-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer com usuário */}
        <div className="execucao-sidebar-footer">
          <div className="execucao-user-card">
            <div className="execucao-user-avatar">
              {getInitials(usuario?.nome_completo)}
            </div>
            <div className="execucao-user-info">
              <div className="execucao-user-name">
                {usuario?.nome_completo || 'Usuário'}
              </div>
              <div className="execucao-user-role">
                {getRoleName()}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="execucao-header-btn"
              title="Sair"
              aria-label="Sair"
              style={{ marginLeft: 'auto' }}
            >
              <FaSignOutAlt aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ExecucaoSidebar;
