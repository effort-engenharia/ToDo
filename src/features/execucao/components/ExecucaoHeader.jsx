import React, { useMemo } from 'react';
import { FaBars } from 'react-icons/fa';
import NotificacoesDropdown from './NotificacoesDropdown';
import '../styles/execucao.css';

const ExecucaoHeader = ({ 
  title, 
  subtitle,
  onMenuToggle,
  usuario,
  isAdmin = false
}) => {
  const hoje = useMemo(() => new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), []);

  return (
    <header className="execucao-header">
      <div className="execucao-header-left">
        <button 
          type="button"
          className="execucao-header-btn lg:hidden"
          onClick={onMenuToggle}
          aria-label="Abrir menu"
        >
          <FaBars aria-hidden="true" />
        </button>
        
        <div>
          <h1 className="execucao-header-title">{title}</h1>
          <p className="execucao-header-subtitle">
            {subtitle || hoje}
          </p>
        </div>
      </div>

      <div className="execucao-header-right">
        <NotificacoesDropdown 
          usuarioId={usuario?.id} 
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
};

export default ExecucaoHeader;
