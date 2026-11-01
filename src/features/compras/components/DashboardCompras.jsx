import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';
import { useAsyncData } from '../../execucao/hooks/useAsyncData';
import { useAtualizacaoTabelas } from '../../execucao/hooks/useAtualizacaoTabelas';
import { useDebouncedValue } from '../../execucao/hooks/useDebouncedValue';
import { useMediaQuery } from '../../execucao/hooks/useMediaQuery';
import { isCompras } from '../../../utils/permissoes';
import { intervaloDoPeriodo } from '../../execucao/components/pedido-material/periodo';
import { useExecucaoUI } from '../../execucao/components/ui/ExecucaoUI';
import { ErroCarregamento, EstadoVazio } from '../../execucao/components/ui/Estados';
import DetalhePedidoCompras from './DetalhePedidoCompras';
import FilaCompras from './FilaCompras';
import FiltrosCompras from './FiltrosCompras';
import IndicadoresCompras from './IndicadoresCompras';
import { ModalStatusCompra } from './ModalAcoesCompras';
import { HASH_COMPRAS, hashDoPedidoCompras, pedidoDoHash } from '../utils/navegacaoCompras';
import { useComprasPainel, useRefreshLimitado } from '../hooks/useComprasPainel';
import { COLUNAS_COMPRAS } from '../utils/statusCompra';
import '../styles/compras.css';

const PERIODO_COMPRAS_INICIAL = { atalho: '30dias', de: '', ate: '' };
const CONSULTA_DESKTOP = '(min-width: 1280px)';
const COLUNAS_LISTA = (status) => [{ id: 'todos', status: status ? [status] : undefined }];
const KPIS_DE_STATUS = ['aguardando_compra', 'em_cotacao', 'aguardando_solicitante'];

const INICIO_TODOS_OS_PERIODOS = '2000-01-01'; // sem "de": os KPIs de período valem para todo o histórico (o RPC assumiria 30 dias)

const rotuloPeriodo = (de, ate) => {
  if (!de && !ate) return 'todos os períodos';
  const fmt = (d) => d.split('-').reverse().join('/');
  if (de && !ate) return `a partir de ${fmt(de)}`;
  if (!de) return `até ${fmt(ate)}`;
  return de === ate ? fmt(de) : `${fmt(de)} a ${fmt(ate)}`;
};

/**
 * Dashboard do setor de Compras (#/compras): KPIs, fila por status (quadro/abas/lista), filtros, detalhe em
 * drawer (deep link ?pedido=ID) e atualização em tempo real (Realtime + reforço periódico).
 */
export default function DashboardCompras({ usuario }) {
  const { toast } = useExecucaoUI();
  const desktop = useMediaQuery(CONSULTA_DESKTOP);
  const podeAgir = isCompras(usuario);

  // ---------- Filtros ----------
  const [periodo, setPeriodo] = useState(PERIODO_COMPRAS_INICIAL);
  const [campoData, setCampoData] = useState('pedido');
  const [busca, setBusca] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [solicitanteId, setSolicitanteId] = useState('');
  const [meusPedidos, setMeusPedidos] = useState(false);
  const [comQuestionamento, setComQuestionamento] = useState(false);
  const [visao, setVisao] = useState('quadro');
  const [statusLista, setStatusLista] = useState('');
  const [kpiAtivo, setKpiAtivo] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('aguardando_compra');
  const buscaDebounced = useDebouncedValue(busca, 350);

  const { de, ate } = useMemo(() => intervaloDoPeriodo(periodo), [periodo]);

  const filtros = useMemo(() => ({
    de: de || undefined,
    ate: ate || undefined,
    campoData: campoData === 'evento' ? 'evento' : undefined,
    urgencia: urgencia ? [urgencia] : undefined,
    busca: buscaDebounced.trim() || undefined,
    solicitanteId: solicitanteId || undefined,
    compradorId: meusPedidos ? usuario?.id : undefined,
    comQuestionamentoAberto: comQuestionamento || undefined,
  }), [de, ate, campoData, urgencia, buscaDebounced, solicitanteId, meusPedidos, comQuestionamento, usuario?.id]);

  const modo = !desktop ? 'abas' : visao === 'lista' ? 'lista' : 'quadro';
  const statusKpi = KPIS_DE_STATUS.includes(kpiAtivo) ? kpiAtivo : null;
  const colunas = useMemo(
    () => (modo === 'lista' ? COLUNAS_LISTA(statusKpi || statusLista) : COLUNAS_COMPRAS),
    [modo, statusKpi, statusLista]
  );
  const colunasVisiveis = modo !== 'lista' && statusKpi ? [statusKpi] : null;
  const soAtrasados = kpiAtivo === 'atrasados';

  const contagemFiltros = [
    periodo.atalho !== PERIODO_COMPRAS_INICIAL.atalho,
    campoData !== 'pedido', Boolean(busca.trim()), Boolean(urgencia), Boolean(solicitanteId), meusPedidos, comQuestionamento,
    Boolean(statusLista) && modo === 'lista', Boolean(kpiAtivo),
  ].filter(Boolean).length;

  const limparFiltros = () => {
    setPeriodo(PERIODO_COMPRAS_INICIAL);
    setCampoData('pedido');
    setBusca('');
    setUrgencia('');
    setSolicitanteId('');
    setMeusPedidos(false);
    setComQuestionamento(false);
    setStatusLista('');
    setKpiAtivo(null);
  };

  // ---------- Dados ----------
  const painel = useComprasPainel(filtros, colunas);
  const { grupos, carregando, erro, carregandoMais, carregarMais, recarregar, atualizadoEm } = painel;
  const refreshPainel = painel.refresh;

  const ind = useAsyncData(() => execucaoComprasService.indicadores(de || INICIO_TODOS_OS_PERIODOS, ate || null), [de, ate]);
  const refreshIndicadores = ind.refresh;
  // KPIs: no máx. 1 consulta a cada ~5 s (rajadas de eventos Realtime), com chamada final garantida (trailing)
  const refreshIndicadoresLimitado = useRefreshLimitado(refreshIndicadores, 5000);

  // Solicitantes já vistos (acumula entre recargas para o seletor não encolher ao filtrar)
  const solicitantesRef = useRef(new Map());
  const solicitantes = useMemo(() => {
    for (const g of Object.values(grupos)) {
      for (const p of g.itens) if (p.solicitante_id && p.solicitante_nome) solicitantesRef.current.set(p.solicitante_id, p.solicitante_nome);
    }
    return [...solicitantesRef.current].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [grupos]);

  // ---------- Tempo real ----------
  const [versao, setVersao] = useState(0);
  const [destaques, setDestaques] = useState(() => new Set());
  const timersDestaque = useRef(new Map());

  useEffect(() => {
    const timers = timersDestaque.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const destacar = useCallback((id) => {
    if (!id) return;
    setDestaques((s) => new Set(s).add(id));
    clearTimeout(timersDestaque.current.get(id));
    timersDestaque.current.set(id, setTimeout(() => {
      setDestaques((s) => { const n = new Set(s); n.delete(id); return n; });
      timersDestaque.current.delete(id);
    }, 2000));
  }, []);

  const aoEvento = useCallback((payload) => {
    const novo = payload?.new ?? {};
    if (payload?.table === 'execucao_pedidos_questionamentos') {
      destacar(novo.pedido_id);
      if (payload.eventType === 'UPDATE' && ['aprovado', 'reprovado'].includes(novo.status) && novo.criado_por === usuario?.id) {
        toast.info('Um questionamento seu foi respondido.');
      }
    } else {
      destacar(novo.id);
    }
  }, [destacar, toast, usuario?.id]);

  const aoMudar = useCallback(() => {
    refreshPainel();
    refreshIndicadoresLimitado();
    setVersao((v) => v + 1);
  }, [refreshPainel, refreshIndicadoresLimitado]);

  // Botão "Atualizar": ação explícita do usuário, sem limite
  const atualizarAgora = useCallback(() => {
    refreshPainel();
    refreshIndicadores();
    setVersao((v) => v + 1);
  }, [refreshPainel, refreshIndicadores]);

  useAtualizacaoTabelas(['execucao_pedidos_material', 'execucao_pedidos_questionamentos'], aoMudar, { aoEvento });

  // ---------- Detalhe (drawer) com URL ?pedido=ID ----------
  const [aberto, setAberto] = useState(() => pedidoDoHash());
  const empilhado = useRef(false);

  useEffect(() => {
    const aoNavegar = () => {
      const doHash = pedidoDoHash();
      setAberto((atual) => (doHash ? (atual?.id === doHash.id ? atual : doHash) : null));
      if (!doHash) empilhado.current = false;
    };
    window.addEventListener('popstate', aoNavegar);
    return () => window.removeEventListener('popstate', aoNavegar);
  }, []);

  const abrirDetalhe = useCallback((pedido, aba = null) => {
    window.history.pushState(null, '', hashDoPedidoCompras(pedido.id, aba));
    empilhado.current = true;
    setAberto({ id: pedido.id, aba, pedido });
  }, []);

  const fecharDetalhe = useCallback(() => {
    if (empilhado.current) {
      empilhado.current = false;
      window.history.back(); // o popstate zera `aberto`
    } else {
      window.history.replaceState(null, '', HASH_COMPRAS);
      setAberto(null);
    }
  }, []);

  // ---------- Ações rápidas dos cartões ----------
  const [pedidoOcupado, setPedidoOcupado] = useState(null);
  const [modalAcao, setModalAcao] = useState(null); // { tipo: 'status'|'entrega', pedido }

  const aoAcaoRapida = useCallback(async (acao, pedido) => {
    if (acao === 'assumir') {
      setPedidoOcupado(pedido.id);
      const r = await execucaoComprasService.assumirPedido(pedido.id);
      setPedidoOcupado(null);
      if (!r.success) { toast.error(r.message || 'Não foi possível assumir o pedido.'); return; }
      toast.success('Pedido assumido');
      aoMudar();
    } else if (acao === 'comprado') {
      setModalAcao({ tipo: 'status', pedido });
    } else if (acao === 'entrega') {
      setModalAcao({ tipo: 'entrega', pedido });
    }
  }, [toast, aoMudar]);

  const aposAcaoModal = () => { setModalAcao(null); aoMudar(); };

  const aoClicarKpi = (id) => {
    setKpiAtivo(id);
    if (KPIS_DE_STATUS.includes(id)) setAbaAtiva(id);
  };

  // ---------- Estados derivados ----------
  const todosVazios = !carregando && colunas.every((c) => (grupos[c.id]?.itens.length ?? 0) === 0);
  const semDadosInicial = Object.keys(grupos).length === 0;

  // Pedidos abertos antigos escondidos pelo filtro de período (o KPI de estoque ignora o período)
  const foraDoPeriodo = useMemo(() => {
    if (modo === 'lista' || periodo.atalho === 'todos' || campoData !== 'pedido') return 0;
    if (busca.trim() || urgencia || solicitanteId || meusPedidos || comQuestionamento || !ind.data) return 0;
    const abertosKpi = (ind.data.aguardando_compra ?? 0) + (ind.data.em_cotacao ?? 0) + (ind.data.aguardando_solicitante?.pedidos ?? 0);
    const carregados = KPIS_DE_STATUS.reduce((soma, id) => soma + (grupos[id]?.itens.length ?? 0), 0);
    return KPIS_DE_STATUS.some((id) => grupos[id]?.temMais) ? 0 : Math.max(0, abertosKpi - carregados);
  }, [modo, periodo.atalho, campoData, busca, urgencia, solicitanteId, meusPedidos, comQuestionamento, ind.data, grupos]);

  const horaAtualizacao = atualizadoEm
    ? atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="execucao-animate-fade-in cmp-pagina">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <p className="text-xs text-slate-400" aria-live="off">
          {horaAtualizacao ? `Atualizado às ${horaAtualizacao} ● ao vivo` : 'Carregando…'}
        </p>
        <button
          type="button"
          className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque"
          onClick={atualizarAgora}
          aria-label="Atualizar agora"
        >
          <FaSyncAlt aria-hidden="true" /> Atualizar
        </button>
      </div>

      <IndicadoresCompras
        indicadores={ind.data}
        carregando={ind.loading}
        erro={ind.error}
        onTentarNovamente={ind.reload}
        kpiAtivo={kpiAtivo}
        onKpi={aoClicarKpi}
        rotuloPeriodo={rotuloPeriodo(de, ate)}
      />

      <FiltrosCompras
        compacto={!desktop}
        periodo={periodo} onPeriodo={setPeriodo}
        campoData={campoData} onCampoData={setCampoData}
        busca={busca} onBusca={setBusca}
        urgencia={urgencia} onUrgencia={setUrgencia}
        solicitantes={solicitantes} solicitanteId={solicitanteId} onSolicitante={setSolicitanteId}
        meusPedidos={meusPedidos} onMeusPedidos={setMeusPedidos}
        comQuestionamento={comQuestionamento} onComQuestionamento={setComQuestionamento}
        mostrarVisao={desktop} visao={visao} onVisao={setVisao}
        statusLista={statusLista} onStatusLista={setStatusLista}
        contagemFiltros={contagemFiltros} onLimpar={limparFiltros}
      />

      {foraDoPeriodo > 0 && (
        <div className="cmp-aviso" role="status">
          {foraDoPeriodo} {foraDoPeriodo === 1 ? 'pedido aberto está' : 'pedidos abertos estão'} fora do período selecionado.{' '}
          <button type="button" className="underline font-semibold" onClick={() => setPeriodo({ atalho: 'todos', de: '', ate: '' })}>
            Mostrar todos os períodos
          </button>
        </div>
      )}

      {erro && semDadosInicial ? (
        <ErroCarregamento mensagem={erro} onTentarNovamente={recarregar} />
      ) : (
        <>
          {erro && (
            <div className="cmp-aviso-erro" role="alert">
              <span>{erro}</span>
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={recarregar}>Tentar novamente</button>
            </div>
          )}
          {todosVazios && contagemFiltros > 0 ? (
            <EstadoVazio
              titulo="Nenhum pedido com esses filtros"
              texto="Ajuste a busca ou o período para ver mais pedidos."
              icone="🛒"
            />
          ) : (
            <FilaCompras
              modo={modo}
              colunas={colunas}
              grupos={grupos}
              carregando={carregando}
              colunasVisiveis={colunasVisiveis}
              soAtrasados={soAtrasados}
              abaAtiva={abaAtiva}
              onAba={setAbaAtiva}
              onAbrir={abrirDetalhe}
              onAcao={aoAcaoRapida}
              onCarregarMais={carregarMais}
              carregandoMais={carregandoMais}
              podeAgir={podeAgir}
              destaques={destaques}
              pedidoOcupado={pedidoOcupado}
            />
          )}
          {todosVazios && contagemFiltros > 0 && (
            <div className="text-center mt-3">
              <button type="button" className="execucao-btn execucao-btn-secondary" onClick={limparFiltros}>Limpar filtros</button>
            </div>
          )}
        </>
      )}

      {aberto && (
        <DetalhePedidoCompras
          key={aberto.id}
          pedidoId={aberto.id}
          pedidoInicial={aberto.pedido ?? null}
          abaInicial={aberto.aba}
          usuario={usuario}
          versao={versao}
          onClose={fecharDetalhe}
          onAlterado={aoMudar}
        />
      )}

      {modalAcao?.tipo === 'status' && (
        <ModalStatusCompra pedido={modalAcao.pedido} destino="comprado" onClose={() => setModalAcao(null)} onConfirmado={aposAcaoModal} />
      )}
      {modalAcao?.tipo === 'entrega' && (
        <ModalStatusCompra pedido={modalAcao.pedido} destino="entregue" escolherEntrega onClose={() => setModalAcao(null)} onConfirmado={aposAcaoModal} />
      )}
    </div>
  );
}
