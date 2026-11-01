import { useCallback, useEffect, useRef, useState } from 'react';
import comprasCotacaoService from '../../../services/supabase/comprasCotacao';
import { useAsyncData } from '../../execucao/hooks/useAsyncData';
import { useAtualizacaoTabelas } from '../../execucao/hooks/useAtualizacaoTabelas';

const TABELAS = ['compras_cotacao_convites', 'compras_cotacao_respostas', 'compras_cotacoes'];
const DESTAQUE_MS = 3000;

// Detalhe da cotação com atualização em tempo real (plano §10.4). Só recarrega quando o evento é desta cotação.
// `destaques` = Set de convite_id alterados nos últimos 3 s; `anuncio` = texto para aria-live ("Casa Y enviou a versão 2").
export function useCotacao(cotacaoId) {
  const { data, loading, error, reload, refresh } = useAsyncData(() => comprasCotacaoService.buscarDetalhe(cotacaoId), [cotacaoId]);
  const [destaques, setDestaques] = useState(() => new Set());
  const [anuncio, setAnuncio] = useState('');
  const pendente = useRef(false);
  const dadosRef = useRef(data);
  dadosRef.current = data;
  const timers = useRef(new Map());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearTimeout(x));
  }, []);

  const destacar = useCallback((conviteId) => {
    if (!conviteId) return;
    setDestaques((s) => new Set(s).add(conviteId));
    clearTimeout(timers.current.get(conviteId));
    timers.current.set(conviteId, setTimeout(() => {
      setDestaques((s) => { const n = new Set(s); n.delete(conviteId); return n; });
      timers.current.delete(conviteId);
    }, DESTAQUE_MS));
  }, []);

  const aoEvento = useCallback((payload) => {
    const novo = payload?.new ?? {};
    const velho = payload?.old ?? {};
    const daCotacao = payload?.table === 'compras_cotacoes'
      ? (novo.id ?? velho.id) === cotacaoId
      : (novo.cotacao_id ?? velho.cotacao_id) === cotacaoId;
    if (!daCotacao) return;
    pendente.current = true;
    if (payload.table === 'compras_cotacao_respostas') {
      destacar(novo.convite_id);
      const cv = dadosRef.current?.convites?.find((c) => c.id === novo.convite_id);
      if (payload.eventType === 'INSERT' && cv) setAnuncio(`${cv.fornecedor?.empresa ?? 'Fornecedor'} enviou a versão ${novo.versao ?? ''}`.trim());
    } else if (payload.table === 'compras_cotacao_convites') {
      destacar(novo.id);
    }
  }, [cotacaoId, destacar]);

  const ultimo = useRef(Date.now());
  const aoMudar = useCallback(() => {
    // Evento de outra cotação não recarrega; o reforço periódico (sem Realtime) recarrega se passou tempo
    if (!pendente.current && Date.now() - ultimo.current < 25000) return;
    pendente.current = false;
    ultimo.current = Date.now();
    refresh();
  }, [refresh]);

  useAtualizacaoTabelas(TABELAS, aoMudar, { aoEvento, intervaloMs: 30000 });

  return { detalhe: data, loading, error, reload, refresh, destaques, anuncio };
}

export default useCotacao;
