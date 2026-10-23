import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';

const UIContext = createContext(null);

let seq = 0;

// Fornece toasts não-bloqueantes e confirmação acessível (substitui alert()/confirm()).
export function ExecucaoUIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);
  const timers = useRef(new Map());

  const remover = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((lista) => lista.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo, mensagem) => {
    const id = ++seq;
    setToasts((lista) => [...lista, { id, tipo, mensagem }]);
    timers.current.set(id, setTimeout(() => remover(id), tipo === 'error' ? 7000 : 4000));
  }, [remover]);

  useEffect(() => {
    const ativos = timers.current;
    return () => ativos.forEach((t) => clearTimeout(t));
  }, []);

  const confirmar = useCallback((opcoes) => new Promise((resolve) => {
    const config = typeof opcoes === 'string' ? { mensagem: opcoes } : opcoes;
    setConfirmacao({ ...config, resolve });
  }), []);

  const resolver = (valor) => {
    confirmacao?.resolve(valor);
    setConfirmacao(null);
  };

  const api = useMemo(() => ({
    toast: {
      success: (m) => mostrar('success', m),
      error: (m) => mostrar('error', m),
      info: (m) => mostrar('info', m),
    },
    confirmar,
  }), [mostrar, confirmar]);

  return (
    <UIContext.Provider value={api}>
      {children}

      <div className="execucao-toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`execucao-toast execucao-toast-${t.tipo}`}
            role={t.tipo === 'error' ? 'alert' : 'status'}
          >
            <span>{t.mensagem}</span>
            <button type="button" aria-label="Fechar aviso" onClick={() => remover(t.id)}>×</button>
          </div>
        ))}
      </div>

      {confirmacao && (
        <Modal titulo={confirmacao.titulo || 'Confirmar'} onClose={() => resolver(false)} tamanho="sm">
          <p className="text-slate-300 mb-6">{confirmacao.mensagem}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="execucao-btn execucao-btn-secondary" onClick={() => resolver(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={`execucao-btn ${confirmacao.perigo === false ? 'execucao-btn-primary' : 'execucao-btn-danger'}`}
              onClick={() => resolver(true)}
              autoFocus
            >
              {confirmacao.confirmarTexto || 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExecucaoUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useExecucaoUI deve ser usado dentro de <ExecucaoUIProvider>');
  return ctx;
}
