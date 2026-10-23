import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { execucaoStatusComercialService } from '../../../services/supabase/execucaoStatusComercial';

const INTERVALO_MS = 2 * 60 * 1000;
const DEBOUNCE_EVENTO_MS = 800;

/**
 * Status de execução dos contratos fechados (somente leitura).
 * Polling a cada 2 min (pausa com a aba oculta) + broadcast opcional para atualizar na hora.
 * Nunca lança: falhas viram `erro` e o dashboard segue normal.
 */
export function useStatusExecucaoContratos(allData, { enabled = true } = {}) {
  const idsChave = useMemo(() => {
    if (!Array.isArray(allData)) return '';
    return allData
      .filter((it) => it?.id && it.fase === 'CONTRATO/VENDA' && it.ativo !== false && !it.duplicado_de)
      .map((it) => it.id)
      .sort()
      .join(',');
  }, [allData]);

  const [mapa, setMapa] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aoVivo, setAoVivo] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const idsRef = useRef([]);
  const reqRef = useRef(0);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    const ids = idsRef.current;
    if (!ids.length) return;
    const req = ++reqRef.current;
    setCarregando(true);
    try {
      const linhas = await execucaoStatusComercialService.buscarStatusContratos(ids);
      if (!montadoRef.current || req !== reqRef.current) return;
      const novo = {};
      linhas.forEach((l) => {
        if (l?.apontamento_id) novo[l.apontamento_id] = l;
      });
      setMapa(novo);
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      if (!montadoRef.current || req !== reqRef.current) return;
      console.warn('[ExecucaoContratos] Falha ao carregar status:', e?.message || e);
      setErro(e?.message || 'Falha ao carregar');
    } finally {
      if (montadoRef.current && req === reqRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    idsRef.current = idsChave ? idsChave.split(',') : [];
    if (!enabled || !idsRef.current.length) return undefined;

    carregar();

    const timer = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) carregar();
    }, INTERVALO_MS);

    const aoVoltar = () => {
      if (!document.hidden) carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [idsChave, enabled, carregar]);

  // Realtime opcional: atualiza o contrato na hora e confirma com uma busca (traz datas/saúde).
  useEffect(() => {
    if (!enabled || !idsChave) return undefined;
    let debounce = null;
    const assinatura = execucaoStatusComercialService.assinarStatusExecucao(
      (payload) => {
        if (!idsRef.current.includes(payload.apontamento_id)) return;
        setMapa((atual) => ({
          ...atual,
          [payload.apontamento_id]: {
            ...(atual[payload.apontamento_id] || { apontamento_id: payload.apontamento_id }),
            ...(payload.status ? { status_execucao: payload.status } : {}),
            ...(payload.progresso != null ? { progresso: payload.progresso } : {}),
          },
        }));
        clearTimeout(debounce);
        debounce = setTimeout(carregar, DEBOUNCE_EVENTO_MS);
      },
      (conectado) => {
        if (montadoRef.current) setAoVivo(conectado);
      }
    );
    return () => {
      clearTimeout(debounce);
      assinatura.unsubscribe();
      setAoVivo(false);
    };
  }, [idsChave, enabled, carregar]);

  return { mapa, carregando, erro, aoVivo, atualizadoEm, recarregar: carregar };
}

export default useStatusExecucaoContratos;
