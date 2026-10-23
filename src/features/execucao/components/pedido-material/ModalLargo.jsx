import React, { useEffect, useId, useRef } from 'react';

// Variante larga do Modal (o Modal compartilhado só oferece sm/md/lg).
// Mesmos recursos de acessibilidade: role="dialog", Esc, foco inicial/retorno e trava de Tab.
// onClose é lido via ref para que re-renders do pai não reposicionem o foco.
export default function ModalLargo({ cabecalho, onClose, children, className = 'execucao-modal-xl', style }) {
  const tituloId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const anterior = document.activeElement;
    const foco = dialogRef.current?.querySelector('input, select, textarea');
    (foco || dialogRef.current)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focaveis = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="execucao-modal-overlay" onClick={() => onClose?.()}>
      <div
        ref={dialogRef}
        className={`execucao-modal ${className}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="execucao-modal-header">
          <h3 id={tituloId} className="execucao-modal-title">{cabecalho}</h3>
          <button type="button" className="execucao-modal-close" aria-label="Fechar" onClick={() => onClose?.()}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
