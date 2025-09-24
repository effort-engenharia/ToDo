import React from 'react';

const ModernMetricCard = ({ title, value, subtitle, icon: Icon, gradient }) => (
  <div className={`${gradient} p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}>
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <Icon className="text-xl sm:text-2xl lg:text-3xl text-white/90" />
      <div className="text-right">
        <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-white leading-tight">{value}</div>
        <div className="text-white/80 text-xs sm:text-sm font-medium">{title}</div>
      </div>
    </div>
    {subtitle && (
      <div className="text-white/70 text-xs sm:text-sm">{subtitle}</div>
    )}
  </div>
);

export default ModernMetricCard;