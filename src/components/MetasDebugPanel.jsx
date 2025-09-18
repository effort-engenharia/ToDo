import React, { useState } from 'react';
import { FaCog, FaRedo, FaEye, FaEyeSlash } from 'react-icons/fa';
import { getCurrentMetas, resetMetasToDefault, METAS_CONFIG } from '../config/metas';

const MetasDebugPanel = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMetas, setCurrentMetas] = useState(getCurrentMetas());

  const handleReset = () => {
    if (window.confirm('Tem certeza que deseja resetar todas as metas para os valores padrão?')) {
      resetMetasToDefault();
      setCurrentMetas(getCurrentMetas());
      window.location.reload(); // Recarregar para aplicar as mudanças
    }
  };

  const refreshMetas = () => {
    setCurrentMetas(getCurrentMetas());
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border p-4 max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">Configurações de Metas</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-gray-100 rounded"
          title="Ocultar painel"
        >
          <FaEyeSlash className="text-xs text-gray-600" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <h4 className="font-medium text-gray-700 mb-1">Valores Atuais:</h4>
          <div className="bg-blue-50 p-2 rounded">
            <div>Clientes Atendidos: <strong>{currentMetas.clientesAtendidos}</strong></div>
            <div>Valor de Entrada: <strong>R$ {(currentMetas.valorEntrada).toLocaleString('pt-BR')}</strong></div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-700 mb-1">Valores Padrão:</h4>
          <div className="bg-gray-50 p-2 rounded">
            <div>Clientes Atendidos: <strong>{METAS_CONFIG.clientesAtendidos}</strong></div>
            <div>Valor de Entrada: <strong>R$ {(METAS_CONFIG.valorEntrada).toLocaleString('pt-BR')}</strong></div>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={refreshMetas}
            className="flex-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
            title="Atualizar valores"
          >
            <FaEye className="mr-1" />
            Atualizar
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
            title="Resetar para padrão"
          >
            <FaRedo className="mr-1" />
            Resetar
          </button>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t">
          💡 Para alterar valores padrão, edite <code>src/config/metas.js</code>
        </div>
      </div>
    </div>
  );
};

export default MetasDebugPanel;
