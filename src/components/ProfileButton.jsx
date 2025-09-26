import React, { useState } from 'react';
import { FaUserCircle, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

const ProfileButton = ({ className = "" }) => {
  const { usuario, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair do sistema?')) {
      await logout();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
      >
        <FaUserCircle className="text-lg" />
        <span className="hidden sm:inline text-sm font-medium">
          {usuario?.nome_completo?.split(' ')[0] || 'Usuário'}
        </span>
        <FaChevronDown className={`text-xs transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          {/* Backdrop para fechar dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-800 truncate">
                {usuario?.nome_completo || 'Nome não disponível'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {usuario?.email || 'Email não disponível'}
              </p>
              <p className="text-xs text-blue-600 font-medium mt-1">
                {usuario?.nivel_acesso?.nome || 'Nível não definido'}
              </p>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors duration-200"
            >
              <FaSignOutAlt className="text-sm" />
              <span className="text-sm font-medium">Sair do sistema</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileButton;