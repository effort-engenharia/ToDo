import React, { useState, useRef, useEffect } from 'react';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { useAnimations } from '../hooks/useAnimations';
import { useAuth } from '../contexts/AuthContext';

const EditableMetricCard = ({ 
  title, 
  value, 
  metaValue,
  onMetaChange,
  icon: Icon, 
  gradient = 'bg-gradient-to-br from-purple-500 to-purple-600',
  delay = 0
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempMeta, setTempMeta] = useState(metaValue);
  const cardRef = useRef(null);
  const { animateIn } = useAnimations();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (cardRef.current) {
      animateIn(cardRef.current, delay);
    }
  }, [delay]);

  useEffect(() => {
    setTempMeta(metaValue);
  }, [metaValue]);

  const handleEdit = () => {
    setIsEditing(true);
    setTempMeta(metaValue);
  };

  const handleSave = () => {
    const newMeta = parseFloat(tempMeta);
    if (!isNaN(newMeta) && newMeta > 0) {
      onMetaChange(newMeta);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempMeta(metaValue);
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const formatValue = (val) => {
    return (val / 1000).toFixed(3);
  };

  const percentage = metaValue > 0 ? ((value / metaValue) * 100).toFixed(1) : 0;

  return (
    <div
      ref={cardRef}
      className={`transform ${gradient} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl transition-all duration-300 hover:scale-105 text-white`}
      style={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="text-lg sm:text-xl" />}
          <h3 className="text-sm sm:text-base font-medium">{title}</h3>
        </div>
        {!isEditing && isAdmin() && (
          <button
            onClick={handleEdit}
            className="p-1 rounded-full hover:bg-white/20 transition-colors duration-200"
            title="Editar meta (Apenas Administradores)"
          >
            <FaEdit className="text-sm" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-2xl sm:text-3xl font-bold">
          {formatValue(value)} mil
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm text-white/70">Meta:</span>
            {isEditing ? (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={tempMeta}
                  onChange={(e) => setTempMeta(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-20 px-2 py-1 text-sm bg-white/20 border border-white/30 rounded text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="50000"
                  autoFocus
                />
                <div className="flex space-x-1">
                  <button
                    onClick={handleSave}
                    className="p-1 rounded bg-green-500/80 hover:bg-green-500 transition-colors"
                    title="Salvar"
                  >
                    <FaCheck className="text-xs" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1 rounded bg-red-500/80 hover:bg-red-500 transition-colors"
                    title="Cancelar"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-xs sm:text-sm text-white/70">
                {formatValue(metaValue)} mil
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm text-white/90 font-medium">
            {percentage}%
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="w-full bg-white/20 rounded-full h-2 mt-3">
          <div
            className="bg-white h-2 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(percentage, 100)}%`
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default EditableMetricCard;
