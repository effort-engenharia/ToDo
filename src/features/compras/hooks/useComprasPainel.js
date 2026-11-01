import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';

const LIMITE_PAGINA = 50;
const LIMITE_MAXIMO = 200; // teto do compras_listar_pedidos

const chaveDe = (filtros, colunas) =>
  JSON.stringify([filtros, colunas.map((c) => [c.id, c.status ?? null])]);

// Reaproveita as referências dos pedidos que não mudaram entre duas cargas (refresh silencioso a cada evento
// Realtime / 60 s): os cartões memoizados não re-renderizam e, se nada mudou, o objeto do grupo também se mantém.
const reaproveitarGrupo = (anterior, itens, temMais) => {
  if (!anterior) return { itens, temMais };
  const antigos = new Map(anterior.itens.map((p) => [p.id, p]));
  const reutilizados = itens.map((p) => {
    const antigo = antigos.get(p.id);
    return antigo && JSON.stringify(antigo) === JSON.stringify(p) ? antigo : p;
  });
  const igual = anterior.temMais === temMais
    && reutilizados.length === anterior.itens.length
    && reutilizados.every((p, i) => p === anterior.itens[i]);
  return igual ? anterior : { itens: reutilizados, temMais };
};

/**
 * Carrega os pedidos do Dashboard de Compras em grupos (uma consulta por coluna/status), cada um com paginação
 * keyset própria ("Carregar mais"). `filtros` segue o contrato de execucaoComprasService.listarPedidos.
 * `refresh()` é silencioso (Realtime/reforço): refaz as páginas já carregadas sem piscar nem apagar o erro.
 */
export function useComprasPainel(filtros, colunas) {
  const [estado, setEstado] = useState({ grupos: {}, carregando: true, erro: null, atualizadoEm: null });
  const [carregandoMais, setCarregandoMais] = useState(null);
  const requisicao = useRef(0);
  const maisEmAndamento = useRef(false);
  const gruposRef = useRef({});

  const chave = useMemo(() => chaveDe(filtros, colunas), [filtros, colunas]);
  const configRef = useRef({ filtros, colunas });
  configRef.current = { filtros, colunas };

  const buscarGrupo = useCallback(async (coluna, limite, cursor = null) => {
    const r = await execucaoComprasService.listarPedidos(
      { ...configRef.current.filtros, statusCompra: coluna.status },
      { limite, cursor }
    );
    if (!r.success) throw new Error(r.message || 'Falha ao carregar os pedidos');
    return r.data ?? [];
  }, []);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    // Refresh em segundo plano não atropela um "Carregar mais" em andamento (a página nova seria descartada)
    if (silencioso && maisEmAndamento.current) return;
    const id = ++requisicao.current;
    const { colunas: cols } = configRef.current;
    if (!silencioso) setEstado((s) => ({ ...s, carregando: true, erro: null }));
    try {
      const resultados = await Promise.all(cols.map((c) => {
        const atual = gruposRef.current[c.id]?.itens?.length ?? 0;
        const limite = silencioso ? Math.min(LIMITE_MAXIMO, Math.max(LIMITE_PAGINA, atual)) : LIMITE_PAGINA;
        return buscarGrupo(c, limite).then((itens) => ({ id: c.id, itens, limite }));
      }));
      if (id !== requisicao.current) return;
      const anteriores = gruposRef.current;
      const grupos = {};
      for (const { id: gid, itens, limite } of resultados) {
        const anterior = anteriores[gid];
        // Mais itens carregados do que o teto do RPC (200): refaz a 1ª página e mantém o restante já carregado
        if (silencioso && anterior && anterior.itens.length > limite) {
          const vistos = new Set(itens.map((p) => p.id));
          const cauda = anterior.itens.slice(limite).filter((p) => !vistos.has(p.id));
          grupos[gid] = reaproveitarGrupo(anterior, [...itens, ...cauda], anterior.temMais);
        } else {
          grupos[gid] = reaproveitarGrupo(anterior, itens, itens.length >= limite);
        }
      }
      const mesmasColunas = Object.keys(grupos).length === Object.keys(anteriores).length
        && Object.keys(grupos).every((gid) => grupos[gid] === anteriores[gid]);
      const proximos = mesmasColunas ? anteriores : grupos;
      gruposRef.current = proximos;
      setEstado({ grupos: proximos, carregando: false, erro: null, atualizadoEm: new Date() });
    } catch (e) {
      if (id !== requisicao.current) return;
      if (!silencioso) setEstado((s) => ({ ...s, carregando: false, erro: e.message || 'Falha ao carregar os pedidos' }));
    }
  }, [buscarGrupo]);

  // Mudou filtro/colunas: zera e recarrega
  useEffect(() => {
    gruposRef.current = {};
    carregar();
    return () => { requisicao.current += 1; };
  // `chave` resume filtros e colunas; configRef sempre guarda os valores atuais
  }, [chave, carregar]);

  const carregarMais = useCallback(async (colunaId) => {
    const coluna = configRef.current.colunas.find((c) => c.id === colunaId);
    const grupo = gruposRef.current[colunaId];
    if (!coluna || !grupo?.itens.length) return;
    const ultimo = grupo.itens[grupo.itens.length - 1];
    const id = requisicao.current;
    maisEmAndamento.current = true;
    setCarregandoMais(colunaId);
    try {
      const novos = await buscarGrupo(coluna, LIMITE_PAGINA, { created_at: ultimo.created_at, id: ultimo.id });
      if (id !== requisicao.current) return;
      const existentes = new Set(grupo.itens.map((p) => p.id));
      const itens = [...grupo.itens, ...novos.filter((p) => !existentes.has(p.id))];
      gruposRef.current = { ...gruposRef.current, [colunaId]: { itens, temMais: novos.length >= LIMITE_PAGINA } };
      setEstado((s) => ({ ...s, grupos: gruposRef.current, erro: null }));
    } catch (e) {
      setEstado((s) => ({ ...s, erro: e.message || 'Falha ao carregar mais pedidos' }));
    } finally {
      maisEmAndamento.current = false;
      setCarregandoMais(null);
    }
  }, [buscarGrupo]);

  const recarregar = useCallback(() => carregar(), [carregar]);
  const refresh = useCallback(() => carregar({ silencioso: true }), [carregar]);

  return { ...estado, carregandoMais, carregarMais, recarregar, refresh };
}

/**
 * Limita a frequência de uma atualização (leading + trailing): a 1ª chamada roda na hora; chamadas dentro de
 * `intervaloMs` viram UMA execução ao fim do intervalo. Usada nos KPIs, que são o RPC mais caro do painel.
 */
export function useRefreshLimitado(fn, intervaloMs = 5000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const estado = useRef({ ultimo: 0, timer: null });

  useEffect(() => {
    const e = estado.current;
    return () => clearTimeout(e.timer);
  }, []);

  return useCallback(() => {
    const e = estado.current;
    const espera = e.ultimo + intervaloMs - Date.now();
    if (espera <= 0) {
      clearTimeout(e.timer);
      e.timer = null;
      e.ultimo = Date.now();
      fnRef.current();
    } else if (!e.timer) {
      e.timer = setTimeout(() => {
        e.timer = null;
        e.ultimo = Date.now();
        fnRef.current();
      }, espera);
    }
  }, [intervaloMs]);
}
