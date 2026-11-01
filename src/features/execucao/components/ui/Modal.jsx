import React, { useEffect, useId, useRef } from 'react';

const LARGURA = { sm: 'execucao-modal-sm', md: '', lg: 'execucao-modal-lg' };

// Modal acessível: role="dialog", fecha com Esc, foco inicial e retorno do foco, rolagem do fundo travada.
// telaCheia (opt-in): abaixo de 640px ocupa a tela toda, com cabeçalho/rodapé fixos (estilos em visao.css).
// variante (opt-in, estilos em compras/compras.css): 'drawer' = painel lateral (≥768px) / tela cheia (<768px);
// 'cheia' = modal centralizado que vira tela cheia abaixo de 640px.
const CLASSES_VARIANTE = {
  drawer: { overlay: ' cmp-overlay-drawer', janela: ' cmp-janela cmp-janela-drawer' },
  cheia: { overlay: ' cmp-overlay-cheia', janela: ' cmp-janela cmp-janela-cheia' },
};

export default function Modal({ titulo, onClose, children, tamanho = 'md', cabecalho = null, telaCheia = false, variante = null }) {
  const tituloId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const anterior = document.activeElement;
    const foco = dialogRef.current?.querySelector('[data-autofocus], [autofocus], input, select, textarea, button:not(.execucao-modal-close)');
    // preventScroll: sem isso, focar um botão do rodapé abria a janela já rolada para baixo (e o topo ficava escondido)
    (foco || dialogRef.current)?.focus({ preventScroll: true });
    if (dialogRef.current) dialogRef.current.scrollTop = 0;

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
    <div className={`execucao-modal-overlay${telaCheia ? ' plan-modal-overlay' : ''}${CLASSES_VARIANTE[variante]?.overlay ?? ''}`} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`execucao-modal ${LARGURA[tamanho] ?? ''}${telaCheia ? ' plan-modal' : ''}${CLASSES_VARIANTE[variante]?.janela ?? ''}`}
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
