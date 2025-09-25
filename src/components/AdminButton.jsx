import React from 'react';
import { FaCog } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

const AdminButton = ({ onOpenAdmin }) => {
  const { isAdmin } = useAuth();

  // Só mostra o botão para administradores
  if (!isAdmin()) return null;

  return (
    <button
      onClick={onOpenAdmin}
      className="fixed bottom-4 right-4 z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group"
      title="Área de Administrador"
    >
      <FaCog className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
      
      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
        ⚙️ Admin
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </button>
  );
};

export default AdminButton;