import React, { useRef, useEffect } from 'react';
import { useAnimations } from '../hooks/useAnimations';
import { formatCurrency, formatNumber } from '../utils/dataProcessing';

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'blue', 
  emoji, 
  delay = 0,
  isCurrency = false,
  trend = null 
}) => {
  const cardRef = useRef(null);
  const valueRef = useRef(null);
  const { animateIn, animateNumber } = useAnimations();

  // Log detalhado dos valores recebidos
  console.log(`💳 MetricCard [${title}]:`, {
    value,
    valueType: typeof value,
    subtitle,
    color,
    emoji,
    isCurrency,
    trend,
    delay
  });

  useEffect(() => {
    if (cardRef.current) {
      animateIn(cardRef.current, delay);
    }
    
    if (valueRef.current && typeof value === 'number') {
      setTimeout(() => {
        animateNumber(valueRef.current, value);
      }, delay + 300);
    }
  }, [value, delay]);

  const colorClasses = {
    blue: 'border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100',
    green: 'border-l-green-500 bg-gradient-to-br from-green-50 to-green-100',
    red: 'border-l-red-500 bg-gradient-to-br from-red-50 to-red-100',
    yellow: 'border-l-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100',
    purple: 'border-l-purple-500 bg-gradient-to-br from-purple-50 to-purple-100'
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend > 0) return <span className="text-green-500 text-sm">↗ +{trend}%</span>;
    if (trend < 0) return <span className="text-red-500 text-sm">↘ {trend}%</span>;
    return <span className="text-gray-500 text-sm">→ {trend}%</span>;
  };

  return (
    <div
      ref={cardRef}
      className={`metric-card border-l-4 ${colorClasses[color]} opacity-0 cursor-pointer transform hover:scale-105 transition-all duration-300`}
      onClick={() => cardRef.current && animateIn(cardRef.current)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {emoji && <span className="text-2xl">{emoji}</span>}
          {icon && <div className="text-gray-600">{icon}</div>}
        </div>
        {getTrendIcon()}
      </div>
      
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      
      <div className="flex items-baseline space-x-2">
        <span
          ref={valueRef}
          className={`text-2xl font-bold text-${color}-600`}
        >
          {typeof value === 'number' 
            ? isCurrency 
              ? formatCurrency(value)
              : formatNumber(value)
            : value
          }
        </span>
      </div>
      
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default MetricCard;
