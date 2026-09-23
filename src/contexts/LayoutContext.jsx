import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { configuracoesService, LAYOUT_CLASSICO, LAYOUT_MODERNO } from '../services/supabase/configuracoes.js';
import { useAuth } from './AuthContext';

const LayoutContext = createContext(null);

const LS_KEY = 'effort_dashboard_layout_cache';

export const useLayout = () => {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout deve ser usado dentro de <LayoutProvider>');
  }
  return ctx;
};

/**
 * LayoutProvider — controla o layout global do dashboard (clássico | moderno).
 * Fonte da verdade: Supabase (tabela configuracoes_sistema).
 * Cache local: localStorage (evita flash na inicialização).
 * Realtime: subscribe a postgres_changes para propagar entre usuários.
 * Escrita: apenas admin (isAdmin()).
 */
export const LayoutProvider = ({ children }) => {
  const { usuario, isAuthenticated } = useAuth();

  // Cache inicial via localStorage
  const cacheInicial = (() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v === LAYOUT_CLASSICO || v === LAYOUT_MODERNO) return v;
    } catch { /* ignore */ }
    return LAYOUT_CLASSICO;
  })();

  const [layout, setLayoutState] = useState(cacheInicial);
  const [atualizadoPor, setAtualizadoPor] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const subscribeRef = useRef(null);

  const isAdmin = usuario?.nivel_acesso?.nome === 'Administrador';

  // Carrega valor inicial do banco
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await configuracoesService.obterDashboardLayout();
      if (res.success && res.valor) {
        setLayoutState(res.valor);
        setAtualizadoPor(res.atualizado_por || null);
        setAtualizadoEm(res.atualizado_em || null);
        try { localStorage.setItem(LS_KEY, res.valor); } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime — reage a mudanças de outros usuários/dispositivos
  useEffect(() => {
    const sub = configuracoesService.subscribeConfiguracoes(({ chave, valor }) => {
      if (chave === configuracoesService.CHAVE_LAYOUT && valor) {
        setLayoutState(valor);
        try { localStorage.setItem(LS_KEY, valor); } catch { /* ignore */ }
      }
    });
    subscribeRef.current = sub;
    return () => {
      if (subscribeRef.current) {
        subscribeRef.current.unsubscribe();
        subscribeRef.current = null;
      }
    };
  }, []);

  /**
   * Salva novo layout no banco. Apenas admin.
   */
  const setLayout = useCallback(async (novoValor) => {
    if (!isAdmin) {
      return { success: false, message: 'Apenas administradores podem alterar o layout.' };
    }
    if (novoValor !== LAYOUT_CLASSICO && novoValor !== LAYOUT_MODERNO) {
      return { success: false, message: `Valor inválido: ${novoValor}` };
    }
    setSaving(true);
    try {
      const nome = usuario?.nome_completo || usuario?.email || 'admin';
      const res = await configuracoesService.salvarDashboardLayout(novoValor, nome);
      if (res.success) {
        setLayoutState(novoValor);
        setAtualizadoPor(nome);
        setAtualizadoEm(new Date().toISOString());
        try { localStorage.setItem(LS_KEY, novoValor); } catch { /* ignore */ }
      }
      return res;
    } finally {
      setSaving(false);
    }
  }, [isAdmin, usuario]);

  const value = useMemo(() => ({
    layout,
    setLayout,
    loading,
    saving,
    canSwitch: isAdmin && isAuthenticated,
    atualizadoPor,
    atualizadoEm,
    LAYOUT_CLASSICO,
    LAYOUT_MODERNO,
    recarregar: carregar,
  }), [layout, setLayout, loading, saving, isAdmin, isAuthenticated, atualizadoPor, atualizadoEm, carregar]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export default LayoutContext;
