import React, { useEffect, useId, useRef } from 'react';

const LARGURA = { sm: 'execucao-modal-sm', md: '', lg: 'execucao-modal-lg' };

// Modal acessível: role="dialog", fecha com Esc, foco inicial e retorno do foco, rolagem do fundo travada.
export default function Modal({ titulo, onClose, children, tamanho = 'md', cabecalho = null }) {
  const tituloId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const anterior = document.activeElement;
    const foco = dialogRef.current?.querySelector('[autofocus], input, select, textarea, button:not(.execucao-modal-close)');
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
    <div className="execucao-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`execucao-modal ${LARGURA[tamanho] ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="execucao-modal-header">
          <h3 id={tituloId} className="execucao-modal-title">{cabecalho ?? titulo}</h3>
          <button type="button" className="execucao-modal-close" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
        <div className="execucao-modal-body">{children}</div>
      </div>
    </div>
  );
}
