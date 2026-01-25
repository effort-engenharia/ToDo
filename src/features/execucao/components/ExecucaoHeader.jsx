import React from 'react';
import { 
  FaBars, 
  FaSearch,
  FaCog
} from 'react-icons/fa';
import NotificacoesDropdown from './NotificacoesDropdown';
import '../styles/execucao.css';

const ExecucaoHeader = ({ 
  title, 
  subtitle,
  onMenuToggle,
  usuario,
  isAdmin = false
}) => {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="execucao-header">
      <div className="execucao-header-left">
        {/* Botão menu mobile */}
        <button 
          className="execucao-header-btn lg:hidden"
          onClick={onMenuToggle}
        >
          <FaBars />
        </button>
        
        <div>
          <h1 className="execucao-header-title">{title}</h1>
          <p className="execucao-header-subtitle">
            {subtitle || hoje}
          </p>
        </div>
      </div>

      <div className="execucao-header-right">
        {/* Barra de busca */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
          <FaSearch className="text-slate-500" size={14} />
          <input 
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none outline-none text-slate-300 text-sm w-40 placeholder-slate-500"
          />
        </div>

        {/* Dropdown de notificações */}
        <NotificacoesDropdown 
          usuarioId={usuario?.id} 
          isAdmin={isAdmin}
        />

        {/* Botão de configurações */}
        <button className="execucao-header-btn">
          <FaCog />
        </button>
      </div>
    </header>
  );
};

export default ExecucaoHeader;
