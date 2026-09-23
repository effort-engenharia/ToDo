import React, { useState } from 'react';
import {
  FaChartLine, FaClipboardList, FaFire, FaBars, FaCog, FaUser, FaSignOutAlt,
  FaBolt, FaChevronLeft, FaTools
} from 'react-icons/fa';
import { useAuth } from '../../../contexts/AuthContext';
import { effortColors } from '../../../utils/effortTheme';

/**
 * Sidebar lateral do Dashboard V2 — paleta Effort (preto + amarelo).
 * Recolhível em desktop, drawer em mobile.
 */
const SidebarV2 = ({
  currentPage = 'dashboard',
  setCurrentPage,
  onOpenAdmin,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { usuario, logout, isAdmin } = useAuth();

  const isAdminUser = typeof isAdmin === 'function' ? isAdmin() : false;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FaChartLine, always: true },
    { id: 'apontamentos', label: 'Apontamentos', icon: FaClipboardList, always: true },
    { id: 'arsenal', label: 'Arsenal', icon: FaFire, always: true },
  ];

  const handleClick = (id) => {
    setMobileOpen?.(false);
    if (id === currentPage) return;
    setCurrentPage?.(id);
  };

  const handleLogout = async () => {
    setMobileOpen?.(false);
    await logout();
  };

  const rootWidth = collapsed ? 'md:w-16' : 'md:w-56';

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-50 flex flex-col
          transition-all duration-200 shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 ${rootWidth} w-64`}
        style={{
          background: `linear-gradient(180deg, ${effortColors.preto} 0%, ${effortColors.cinzaEscuro} 100%)`,
          color: effortColors.branco,
        }}
      >
        {/* Header — logo + toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 overflow-hidden">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: effortColors.amareloEffort }}
            >
              <FaBolt className="w-4 h-4" style={{ color: effortColors.preto }} />
            </div>
            {!collapsed && (
              <div className="whitespace-nowrap">
                <div className="text-sm font-bold leading-tight">EFFORT</div>
                <div className="text-[10px] text-white/60 leading-tight uppercase tracking-wider">
                  Comercial
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed?.(!collapsed)}
            className="hidden md:flex text-white/60 hover:text-white p-1"
            aria-label="Recolher menu"
          >
            <FaChevronLeft
              className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            onClick={() => setMobileOpen?.(false)}
            className="md:hidden text-white/60 hover:text-white p-1"
          >
            <FaChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map(({ id, label, icon: Icon }) => {
              const active = currentPage === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => handleClick(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${active ? 'text-black' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                    style={active ? { background: effortColors.amareloEffort } : {}}
                    title={collapsed ? label : ''}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer — perfil + admin + logout */}
        <div className="border-t border-white/10 p-3 space-y-1">
          {isAdminUser && (
            <button
              onClick={() => { setMobileOpen?.(false); onOpenAdmin?.(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
              title={collapsed ? 'Administrador' : ''}
            >
              <FaCog className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Administrador</span>}
            </button>
          )}

          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
              style={{ background: effortColors.amareloEffort, color: effortColors.preto }}
            >
              {(usuario?.nome_completo || usuario?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">
                  {usuario?.nome_completo || 'Usuário'}
                </div>
                <div className="text-[10px] text-white/50 truncate">
                  {usuario?.nivel_acesso?.nome || 'sem nível'}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-red-500/20 transition-colors"
            title={collapsed ? 'Sair' : ''}
          >
            <FaSignOutAlt className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default SidebarV2;
