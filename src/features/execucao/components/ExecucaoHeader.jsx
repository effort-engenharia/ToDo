import React from 'react';
import { 
  FaBars, 
  FaBell, 
  FaSearch,
  FaCog
} from 'react-icons/fa';
import '../styles/execucao.css';

const ExecucaoHeader = ({ 
  title, 
  subtitle,
  onMenuToggle,
  usuario
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

        {/* Botão de notificações */}
        <button className="execucao-header-btn relative">
          <FaBell />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Botão de configurações */}
        <button className="execucao-header-btn">
          <FaCog />
        </button>
      </div>
    </header>
  );
};

export default ExecucaoHeader;
