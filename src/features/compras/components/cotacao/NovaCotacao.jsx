import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { linhasDoServidor, linhasParaPayload, linhasValidas, juntarLinhas, separarOrigem, padraoEndereco } from '../../utils/cotacao/montagem';
import { MENSAGENS_PADRAO, localParaISO, prazoEmHoras } from '../../utils/cotacao/envio';
import { salvarTokens } from '../../utils/cotacao/tokensSessao';
import ModalFornecedor from '../fornecedores/ModalFornecedor';
import PassoItens from './PassoItens';
import PassoFornecedores from './PassoFornecedores';
import PassoPrazoMensagem from './PassoPrazoMensagem';

const PASSOS = ['Pedidos', 'Itens', 'Fornecedores', 'Envio'];
const MAX_FORNECEDORES = 15;
const tituloPedido = (p) => p.cliente_nome || p.descricao || 'Pedido de material';

const prazoInicial = (config) => {
  const h = Number(config?.prazo_padrao_horas);
  const modo = [24, 48, 72].includes(h) ? h : 48;
  return { modo, local: '', iso: prazoEmHoras(modo) };
};

/**
 * Assistente "Nova cotação" (plano §10.2 / Anexo B.3): Pedidos → Itens → Fornecedores → Prazo e mensagem.
 * `pedidos`: linhas selecionadas da fila. `cotacaoId`: retoma um rascunho. `onConcluido(cotacaoId)` após abrir e gerar os links.
 * A região de entrega e a observação pública são pedidas no passo 1 porque só `compras_cotacao_criar` as grava.
 */
export default function NovaCotacao({ pedidos: pedidosIniciais = [], cotacaoId: cotacaoRetomada = null, config, onClose, onConcluido }) {
  const { toast } = useExecucaoUI();
  const [passo, setPasso] = useState(cotacaoRetomada ? 2 : 1);
  const [pedidos, setPedidos] = useState(pedidosIniciais);
  const [cotacaoId, setCotacaoId] = useState(cotacaoRetomada);
  const [numero, setNumero] = useState(null);
  const [regiao, setRegiao] = useState('');
  const [obsPublica, setObsPublica] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [fornecedores, setFornecedores] = useState({ lista: null, carregando: true, erro: null });
  const [desempenho, setDesempenho] = useState(null);
  const [selForn, setSelForn] = useState(() => new Set());
  const [convitesSalvos, setConvitesSalvos] = useState([]);
  const [prazo, setPrazo] = useState(() => prazoInicial(config));
  const [mensagem, setMensagem] = useState(config?.mensagem_padrao || MENSAGENS_PADRAO.padrao);
  const [erro, setErro] = useState('');
  const [erroPrazo, setErroPrazo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregandoRetomada, setCarregandoRetomada] = useState(Boolean(cotacaoRetomada));
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);
  const [modalForn, setModalForn] = useState(undefined); // undefined fechado · null novo · objeto editar

  const carregarFornecedores = useCallback(async () => {
    setFornecedores((f) => ({ ...f, carregando: true, erro: null }));
    const r = await comprasCotacaoService.listarFornecedores({ apenasAtivos: true });
    setFornecedores(r.success ? { lista: r.data, carregando: false, erro: null } : { lista: null, carregando: false, erro: r.message || 'Falha ao carregar fornecedores' });
  }, []);

  useEffect(() => { carregarFornecedores(); }, [carregarFornecedores]);
  useEffect(() => {
    let vivo = true;
    comprasCotacaoService.indicadoresCotacao().then((r) => {
      if (vivo && r.success && r.data) setDesempenho(new Map((r.data.por_fornecedor ?? []).map((p) => [p.fornecedor_id, p])));
    });
    return () => { vivo = false; };
  }, []);

  // Retomada de rascunho
  useEffect(() => {
    if (!cotacaoRetomada) return undefined;
    let vivo = true;
    comprasCotacaoService.buscarDetalhe(cotacaoRetomada).then((r) => {
      if (!vivo) return;
      setCarregandoRetomada(false);
      if (!r.success) { setErro(r.message || 'Não foi possível carregar o rascunho.'); return; }
      const d = r.data;
      setNumero(d.cotacao?.numero ?? null);
      setRegiao(d.cotacao?.regiao_entrega ?? '');
      setObsPublica(d.cotacao?.observacao_publica ?? '');
      setPedidos((d.pedidos ?? []).filter((p) => p.ativa !== false));
      setLinhas(linhasDoServidor(d.itens));
      setSelForn(new Set((d.convites ?? []).map((c) => c.fornecedor_id)));
      setConvitesSalvos(d.convites ?? []);
    });
    return () => { vivo = false; };
  }, [cotacaoRetomada]);

  const pedidosPorId = useMemo(() => new Map(pedidos.map((p) => [p.id, tituloPedido(p)])), [pedidos]);
  const qtdLinhas = linhas.length;
  const primeiroConvite = useMemo(() => {
    const f = (fornecedores.lista ?? []).find((x) => selForn.has(x.id));
    return f ? { fornecedor: { nome_contato: f.nome_contato, empresa: f.empresa } } : null;
  }, [fornecedores.lista, selForn]);

  // ---------- validação por passo (motivo em texto) ----------
  const motivoBloqueio = (() => {
    if (passo === 1) return pedidos.length === 0 ? 'Selecione ao menos um pedido.' : '';
    if (passo === 2) return linhasValidas(linhas) ? '' : 'Toda linha precisa de descrição pública.';
    if (passo === 3) return selForn.size === 0 ? 'Escolha ao menos 1 fornecedor.' : selForn.size > MAX_FORNECEDORES ? `No máximo ${MAX_FORNECEDORES} fornecedores.` : '';
    return '';
  })();

  const alterarLinha = (chave, parcial) => setLinhas((ls) => ls.map((l) => (l._chave === chave ? { ...l, ...parcial } : l)));

  const removerPedido = async (p) => {
    setErro('');
    if (cotacaoId) {
      setOcupado(true);
      const r = await comprasCotacaoService.removerPedido(cotacaoId, p.id, 'Removido no assistente');
      setOcupado(false);
      if (!r.success) { setErro(r.message || 'Não foi possível remover o pedido.'); return; }
      if (Array.isArray(r.data?.itens)) setLinhas(linhasDoServidor(r.data.itens));
    }
    setPedidos((ps) => ps.filter((x) => x.id !== p.id));
  };

  const avancar = async () => {
    setErro('');
    if (motivoBloqueio) return;
    setOcupado(true);
    try {
      if (passo === 1) {
        if (!cotacaoId) {
          const r = await comprasCotacaoService.criar(pedidos.map((p) => p.id), { observacaoPublica: obsPublica.trim() || null, regiaoEntrega: regiao.trim() || null });
          if (!r.success) { setErro(r.message || 'Não foi possível criar a cotação.'); return; }
          setCotacaoId(r.data.cotacao_id);
          setNumero(r.data.numero);
          setLinhas(linhasDoServidor(r.data.itens));
        }
        setPasso(2);
      } else if (passo === 2) {
        const r = await comprasCotacaoService.montarItens(cotacaoId, linhasParaPayload(linhas));
        if (!r.success) { setErro(r.message || 'Não foi possível salvar os itens.'); return; }
        if (Array.isArray(r.data)) setLinhas(linhasDoServidor(r.data));
        setPasso(3);
      } else if (passo === 3) {
        const r = await comprasCotacaoService.definirFornecedores(cotacaoId, [...selForn]);
        if (!r.success) { setErro(r.message || 'Não foi possível salvar os fornecedores.'); return; }
        setConvitesSalvos(r.data ?? []);
        setPasso(4);
      }
    } finally {
      setOcupado(false);
    }
  };

  const abrir = async () => {
    setErro('');
    const iso = prazo.iso;
    if (!iso || new Date(iso).getTime() <= Date.now()) { setErroPrazo('Escolha um horário futuro'); return; }
    setErroPrazo('');
    setOcupado(true);
    const padrao = config?.mensagem_padrao || MENSAGENS_PADRAO.padrao;
    const r = await comprasCotacaoService.abrir(cotacaoId, { prazo: iso, mensagem: mensagem.trim() && mensagem.trim() !== padrao ? mensagem.trim() : null });
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível abrir a cotação.'); return; }
    // O token em claro vem só desta vez: sessionStorage por cotação
    salvarTokens(cotacaoId, Object.fromEntries((r.data?.links ?? []).map((l) => [l.convite_id, l.token])));
    toast.success('Cotação aberta. Links gerados.');
    onConcluido?.(cotacaoId);
  };

  const escolherPrazo = (modo, local) => {
    if (modo === 'data') {
      const l = local ?? prazo.local;
      setPrazo({ modo, local: l, iso: localParaISO(l) });
    } else {
      setPrazo({ modo, local: '', iso: prazoEmHoras(modo) });
    }
    setErroPrazo('');
  };

  // ---------- fechar ----------
  const pedirFechar = () => { if (cotacaoId) setConfirmandoFechar(true); else onClose?.(); };
  const salvarRascunho = async () => {
    setOcupado(true);
    if (passo === 2 && linhasValidas(linhas)) await comprasCotacaoService.montarItens(cotacaoId, linhasParaPayload(linhas));
    if (passo === 3 && selForn.size > 0 && selForn.size <= MAX_FORNECEDORES) await comprasCotacaoService.definirFornecedores(cotacaoId, [...selForn]);
    setOcupado(false);
    toast.info(`Rascunho da cotação nº ${numero ?? ''} mantido.`);
    onClose?.();
  };
  const descartar = async () => {
    setOcupado(true);
    const r = await comprasCotacaoService.cancelar(cotacaoId, 'Rascunho descartado');
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível descartar.'); setConfirmandoFechar(false); return; }
    toast.info('Rascunho descartado. Os pedidos voltaram para aguardando compra.');
    onClose?.();
  };

  const cabecalho = `Nova cotação${numero ? ` · nº ${numero}` : ''}`;
  const proximoRotulo = ocupado ? 'Salvando…' : 'Avançar';

  return (
    <>
      <Modal tamanho="lg" variante="cheia" cabecalho={cabecalho} onClose={confirmandoFechar || modalForn !== undefined ? () => {} : pedirFechar}>
        <ol className="cmp-stepper" aria-label="Passos">
          {PASSOS.map((p, i) => (
            <li key={p} aria-current={passo === i + 1 ? 'step' : undefined} className={passo > i + 1 ? 'cmp-passo-feito' : ''}>
              {passo > i + 1 && i + 1 < 4
                ? <button type="button" className="cmp-link" onClick={() => setPasso(i + 1)} disabled={ocupado}>{i + 1}. {p} ✓</button>
                : <>{i + 1}. {p}</>}
            </li>
          ))}
        </ol>
        <p className="cmp-stepper-curto" aria-live="polite">Passo {passo} de 4 · {PASSOS[passo - 1]}</p>

        {carregandoRetomada ? (
          <div className="cmp-skeleton h-40 w-full rounded-xl" aria-busy="true" role="status" aria-label="Carregando rascunho" />
        ) : (
          <>
            {passo === 1 && (
              <div>
                <ul className="cmp-lista-limpa">
                  {pedidos.map((p) => (
                    <li key={p.id} className="cmp-linha">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-100 break-words font-semibold">{tituloPedido(p)}</p>
                        {p.cliente_nome && p.descricao && <p className="text-sm text-slate-300 break-words">{p.descricao}</p>}
                        <p className="cmp-texto-mudo">Solicitante (interno): {p.solicitante_nome || '—'}{p.qtd_itens != null ? ` · ${p.qtd_itens} ${p.qtd_itens === 1 ? 'item' : 'itens'}` : ''}</p>
                      </div>
                      <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-icone" aria-label={`Remover pedido ${tituloPedido(p)} da cotação`} disabled={ocupado} onClick={() => removerPedido(p)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className="cmp-grade-campos mt-4">
                  <div className="cmp-campo">
                    <label htmlFor="cmp-nc-regiao">Região de entrega (cidade/bairro)</label>
                    <input id="cmp-nc-regiao" className="execucao-form-input" maxLength={80} value={regiao} onChange={(e) => setRegiao(e.target.value)} disabled={Boolean(cotacaoId)} aria-describedby="cmp-nc-regiao-d" />
                    <span id="cmp-nc-regiao-d" className="cmp-texto-mudo">Não informe o endereço.</span>
                    {regiao && padraoEndereco.test(regiao) && <span className="cmp-erro-campo" role="status">Parece conter um endereço. Informe só cidade/bairro.</span>}
                  </div>
                  <div className="cmp-campo">
                    <label htmlFor="cmp-nc-obs">Observação para os fornecedores (opcional)</label>
                    <input id="cmp-nc-obs" className="execucao-form-input" maxLength={500} value={obsPublica} onChange={(e) => setObsPublica(e.target.value)} disabled={Boolean(cotacaoId)} />
                  </div>
                </div>
              </div>
            )}
            {passo === 2 && (
              <PassoItens
                itens={linhas} pedidosPorId={pedidosPorId} regiao={regiao}
                onAlterar={alterarLinha}
                onSeparar={(chave, origem) => setLinhas((ls) => separarOrigem(ls, chave, origem))}
                onJuntar={(de, para) => setLinhas((ls) => juntarLinhas(ls, de, para))}
              />
            )}
            {passo === 3 && (
              <PassoFornecedores
                fornecedores={fornecedores.lista} carregando={fornecedores.carregando} erro={fornecedores.erro} desempenho={desempenho}
                selecionados={selForn}
                onAlternar={(id) => setSelForn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < MAX_FORNECEDORES) n.add(id); return n; })}
                onCadastrar={() => setModalForn(null)} onEditar={(f) => setModalForn(f)} onRecarregar={carregarFornecedores}
              />
            )}
            {passo === 4 && (
              <PassoPrazoMensagem
                prazo={prazo} onPrazo={escolherPrazo} mensagem={mensagem} onMensagem={setMensagem} erroPrazo={erroPrazo}
                config={config} cotacao={{ numero }} primeiroConvite={primeiroConvite}
                qtdItens={qtdLinhas} qtdFornecedores={convitesSalvos.length || selForn.size}
              />
            )}
          </>
        )}

        {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}
        {motivoBloqueio && passo < 4 && <p id="cmp-nc-motivo" className="cmp-texto-mudo mt-3" aria-live="polite">{motivoBloqueio}</p>}

        <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={() => setPasso((p) => Math.max(1, p - 1))} disabled={passo === 1 || ocupado}>Voltar</button>
          <div className="flex gap-2 flex-wrap">
            {cotacaoId && passo > 1 && (
              <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={salvarRascunho} disabled={ocupado}>Salvar rascunho</button>
            )}
            {passo === 1 && pedidos.length === 0 ? (
              <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={pedirFechar}>Fechar</button>
            ) : passo < 4 ? (
              <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={avancar} disabled={ocupado || Boolean(motivoBloqueio)} aria-busy={ocupado || undefined} aria-describedby={motivoBloqueio ? 'cmp-nc-motivo' : undefined}>
                {proximoRotulo}
              </button>
            ) : (
              <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={abrir} disabled={ocupado} aria-busy={ocupado || undefined}>
                {ocupado ? 'Gerando links…' : 'Abrir cotação e gerar links'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {confirmandoFechar && (
        <Modal tamanho="sm" titulo="Fechar o assistente?" onClose={() => setConfirmandoFechar(false)}>
          <p className="text-slate-200 mb-4">A cotação nº {numero} está em rascunho. Você pode mantê-lo para continuar depois ou descartá-lo (os pedidos voltam para aguardando compra).</p>
          <div className="flex flex-col gap-2">
            <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={salvarRascunho} disabled={ocupado}>Manter rascunho</button>
            <button type="button" className="execucao-btn execucao-btn-danger cmp-btn-toque" onClick={descartar} disabled={ocupado}>Descartar</button>
            <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={() => setConfirmandoFechar(false)}>Continuar editando</button>
          </div>
        </Modal>
      )}

      {modalForn !== undefined && (
        <ModalFornecedor
          fornecedor={modalForn}
          onClose={() => setModalForn(undefined)}
          onSalvo={async (id) => {
            setModalForn(undefined);
            await carregarFornecedores();
            if (typeof id === 'string') setSelForn((s) => (s.size < MAX_FORNECEDORES ? new Set(s).add(id) : s));
          }}
        />
      )}
    </>
  );
}
