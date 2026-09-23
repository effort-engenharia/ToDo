import React, { useState, useEffect } from 'react';
import { FaUserSecret, FaSignOutAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

/**
 * ImpersonationBar — barra fixa no topo, visível apenas quando um admin
 * está impersonando outro usuário. Permite sair com um clique.
 * Também aplica padding-top no <body> para não sobrepor o conteúdo.
 */
const ImpersonationBar = () => {
  const { impersonando, adminOriginal, usuario, sairImpersonation } = useAuth();
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (impersonando) {
      document.body.style.paddingTop = '56px';
    } else {
      document.body.style.paddingTop = '';
    }
    return () => {
      document.body.style.paddingTop = '';
    };
  }, [impersonando]);

  if (!impersonando) return null;

  const handleSair = async () => {
    setSaindo(true);
    try {
      const res = await sairImpersonation();
      if (res?.success) {
        // Recarregar para garantir que todos os estados/consultas resetem
        window.location.reload();
      } else {
        alert(res?.message || 'Erro ao sair da impersonation');
        setSaindo(false);
      }
    } catch (err) {
      console.error(err);
      setSaindo(false);
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] shadow-lg"
      style={{
        background:
          'repeating-linear-gradient(45deg, #DC2626, #DC2626 10px, #B91C1C 10px, #B91C1C 20px)',
      }}
      role="alert"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-white min-w-0">
          <FaExclamationTriangle className="w-5 h-5 shrink-0 animate-pulse" />
          <FaUserSecret className="w-5 h-5 shrink-0" />
          <div className="text-sm leading-tight min-w-0">
            <div className="font-bold uppercase tracking-wider text-xs">
              Modo teste — Impersonation ativa
            </div>
            <div className="truncate">
              <span className="opacity-80">Admin</span>{' '}
              <strong>{adminOriginal?.nome_completo || adminOriginal?.email}</strong>{' '}
              <span className="opacity-80">visualizando como</span>{' '}
              <strong>{usuario?.nome_completo || usuario?.email}</strong>
              <span className="opacity-80"> · escrita bloqueada</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleSair}
          disabled={saindo}
          className="bg-white text-red-700 font-bold text-xs md:text-sm px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors shadow flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <FaSignOutAlt className="w-3 h-3" />
          {saindo ? 'Saindo...' : 'Voltar para admin'}
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBar;
