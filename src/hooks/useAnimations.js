import { useEffect, useRef } from 'react';

export const useAnimations = () => {
  const animateIn = (target, delay = 0) => {
    if (!target) return;
    
    target.style.opacity = '0';
    target.style.transform = 'translateY(30px) scale(0.8)';
    
    setTimeout(() => {
      target.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      target.style.opacity = '1';
      target.style.transform = 'translateY(0) scale(1)';
    }, delay);
  };

  const animateNumber = (target, finalValue, duration = 2000) => {
    if (!target) return;
    
    let start = 0;
    const increment = finalValue / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= finalValue) {
        start = finalValue;
        clearInterval(timer);
      }
      target.textContent = Math.round(start).toLocaleString('pt-BR');
    }, 16);
  };

  const animateCard = (target) => {
    if (!target) return;
    
    target.style.transform = 'scale(1.05)';
    target.style.transition = 'transform 0.3s ease-in-out';
    
    setTimeout(() => {
      target.style.transform = 'scale(1)';
    }, 300);
  };

  const pulseEffect = (target) => {
    if (!target) return;
    
    target.style.animation = 'pulse 2s infinite';
  };

  return {
    animateIn,
    animateNumber,
    animateCard,
    pulseEffect
  };
};
