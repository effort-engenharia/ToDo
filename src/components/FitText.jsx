import { useLayoutEffect, useRef } from 'react';

// Mantém o texto em uma linha e reduz a fonte (de maxSize até minSize) apenas o necessário
// para caber na largura disponível do container pai.
const FitText = ({ children, maxSize = 24, minSize = 12, className = '' }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return undefined;

    const fit = () => {
      text.style.fontSize = `${maxSize}px`;
      const available = container.clientWidth;
      const needed = text.scrollWidth;
      if (available > 0 && needed > available) {
        const size = Math.max(minSize, Math.floor((maxSize * available) / needed));
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children, maxSize, minSize]);

  return (
    <div ref={containerRef} className="w-full min-w-0 overflow-hidden">
      <span ref={textRef} className={`inline-block whitespace-nowrap leading-tight ${className}`}>
        {children}
      </span>
    </div>
  );
};

export default FitText;
