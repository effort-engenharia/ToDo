import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';
import { useAsyncData } from '../../execucao/hooks/useAsyncData';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../execucao/hooks/useMediaQuery';
import { formatarDataBR } from '../../execucao/utils/datas';
import { isAdminExecucao, isCompras } from '../../execucao/utils/permissoes';
import { useExecucaoUI } from '../../execucao/components/ui/ExecucaoUI';
import Modal from '../../execucao/components/ui/Modal';
import { ErroCarregamento } from '../../execucao/components/ui/Estados';
import ListaHistorico from '../../execucao/components/pedido-material/ListaHistorico';
import QuestionamentosPedido from '../../execucao/components/pedido-material/QuestionamentosPedido';
import { EVENTO_BADGES } from '../../execucao/hooks/useBadgesMenu';
import ModalQuestionamento from './ModalQuestionamento';
import { ModalDisponibilidade, ModalStatusCompra } from './ModalAcoesCompras';
import {
  STATUS_ACEITA_QUESTIONAMENTO,
  STATUS_COMPRA,
  TRANSICOES_COMPRA,
  URGENCIAS,
  acaoRapidaDoPedido,
  formatarDataHora,
  itensPreenchidos,
  rotuloStatusCompra,
} from '../utils/statusCompra';

const ABAS = [
  { id: 'itens', rotulo: 'Itens' },
  { id: 'conversa', rotulo: 'Conversa' },
  { id: 'historico', rotulo: 'Histórico' },
];

const ROTULO_ACAO_PRINCIPAL = { assumir: 'Assumir', comprado: 'Marcar como comprado ✓', entrega: 'Registrar entrega' };

function Linha({ rotulo, children }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="text-slate-400 shrink-0">{rotulo}:</dt>
      <dd className="text-slate-200 min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * Detalhe do pedido (Anexo D.2/D.3): drawer ≥ 768 px, tela cheia abaixo. Abas Itens · Conversa · Histórico, ações de
 * status, disponibilidade e questionamento. `versao` muda a cada evento do Realtime para recarregar em silêncio.
 */
export default function DetalhePedidoCompras({ pedidoId, pedidoInicial = null, abaInicial = null, usuario, versao = 0, onClose, onAlterado }) {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const mobile = useMediaQuery(CONSULTA_ABAIXO_MD);
  const podeOperar = isCompras(usuario); // assumir e questionar (is_compras() no banco)
  const podeResponder = isAdminExecucao(usuario); // responder/cancelar qualquer questionamento (admin de execução)

  const { data, loading, error, reload, refresh } = useAsyncData(() => execucaoComprasService.buscarDetalhe(pedidoId), [pedidoId]);

  // Realtime do painel → recarrega o detalhe em silêncio (a 1ª execução é a carga inicial)
  const primeiraVersao = useRef(true);
  useEffect(() => {
    if (primeiraVersao.current) { primeiraVersao.current = false; return; }
    refresh();
  }, [versao, refresh]);

  const pedido = data?.pedido ?? pedidoInicial;
  const questionamentos = data?.questionamentos ?? null;
  const abertos = useMemo(() => (questionamentos ?? []).filter((q) => q.status === 'aberto'), [questionamentos]);
  const itens = useMemo(() => itensPreenchidos(pedido?.itens), [pedido?.itens]);
  const status = STATUS_COMPRA[pedido?.status_compra];
  const urg = URGENCIAS[pedido?.urgencia];

  const [abaEscolhida, setAbaEscolhida] = useState(null);
  const aba = abaEscolhida ?? abaInicial ?? (abertos.length > 0 ? 'conversa' : 'itens');

  const [modal, setModal] = useState(null); // { tipo: 'status'|'entrega'|'disponibilidade'|'questionar', destino?, itemId? }
  const [maisAberto, setMaisAberto] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState('');

  const aceitaQuestionamento = STATUS_ACEITA_QUESTIONAMENTO.includes(pedido?.status_compra);
  const proximos = TRANSICOES_COMPRA[pedido?.status_compra] ?? [];
  const acao = acaoRapidaDoPedido(pedido ?? {});
  const podeAssumir = podeOperar && pedido?.status_compra === 'aguardando_compra';
  const podeDisponibilidade = pedido && !['entregue', 'cancelado'].includes(pedido.status_compra);

  const aposAlteracao = () => {
    setModal(null);
    setStatusSelecionado('');
    refresh();
    onAlterado?.();
    window.dispatchEvent(new CustomEvent(EVENTO_BADGES));
  };

  const assumir = async () => {
    const r = await execucaoComprasService.assumirPedido(pedido.id);
    if (!r.success) { toast.error(r.message || 'Não foi possível assumir o pedido.'); return; }
    toast.success('Pedido assumido');
    aposAlteracao();
  };

  const executarAcaoPrincipal = () => {
    if (acao === 'assumir') assumir();
    else if (acao === 'comprado') setModal({ tipo: 'status', destino: 'comprado' });
    else if (acao === 'entrega') setModal({ tipo: 'entrega', destino: 'entregue' });
  };

  const escolherStatus = (destino) => {
    setStatusSelecionado(destino);
    if (!destino) return;
    setModal({ tipo: 'status', destino });
  };

  const abrirQuestionar = (itemId = null) => setModal({ tipo: 'questionar', itemId });

  // Tablist com setas ←/→, Home e End (roving tabindex)
  const aoTeclarAba = (e) => {
    const i = ABAS.findIndex((a) => a.id === aba);
    let alvo = null;
    if (e.key === 'ArrowRight') alvo = ABAS[(i + 1) % ABAS.length];
    else if (e.key === 'ArrowLeft') alvo = ABAS[(i - 1 + ABAS.length) % ABAS.length];
    else if (e.key === 'Home') alvo = ABAS[0];
    else if (e.key === 'End') alvo = ABAS[ABAS.length - 1];
    if (!alvo) return;
    e.preventDefault();
    setAbaEscolhida(alvo.id);
    document.getElementById(`${idBase}-tab-${alvo.id}`)?.focus();
  };

  const contadorAba = { itens: itens.length, conversa: questionamentos?.length ?? 0, historico: null };
  const titulo = pedido ? `${pedido.descricao || 'Pedido de material'}${pedido.cliente_nome ? ` — ${pedido.cliente_nome}` : ''}` : 'Pedido';

  const seletorStatus = proximos.length > 0 && (
    <select
      className="execucao-form-select cmp-btn-toque !w-auto"
      aria-label="Alterar status"
      value={statusSelecionado}
      onChange={(e) => escolherStatus(e.target.value)}
    >
      <option value="">Status: {status?.rotulo ?? '—'} ▾</option>
      {proximos.map((s) => <option key={s} value={s}>{rotuloStatusCompra(s)}</option>)}
    </select>
  );

  const botoesSecundarios = (
    <>
      {seletorStatus}
      {podeDisponibilidade && (
        <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setModal({ tipo: 'disponibilidade' })}>
          📅 Disponibilidade
        </button>
      )}
    </>
  );

  return (
    <>
      <Modal tamanho="md" variante="drawer" onClose={modal ? () => {} : onClose} cabecalho={<span className="break-words">{titulo}</span>}>
        {error && !pedido ? (
          <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
        ) : loading && !pedido ? (
          <div className="space-y-3" aria-busy="true" role="status" aria-label="Carregando pedido">
            <div className="cmp-skeleton h-6 w-2/3 rounded" />
            <div className="cmp-skeleton h-20 w-full rounded-xl" />
            <div className="cmp-skeleton h-40 w-full rounded-xl" />
          </div>
        ) : !pedido ? (
          <p className="text-slate-300 py-6 text-center">Pedido não encontrado ou fora da fila de Compras.</p>
        ) : (
          <div className="cmp-detalhe">
            <div className="flex flex-wrap gap-2 mb-3">
              {status && <span className={`cmp-selo ${status.classe}`}>{status.emoji} {status.rotulo}</span>}
              {urg && <span className={`cmp-selo ${urg.classe}`}>{urg.emoji} {urg.rotulo}</span>}
              {pedido.qtd_questionamentos_abertos > 0 && (
                <span className="cmp-selo bg-purple-500/15 text-purple-300 border border-purple-500/40">
                  ❓ {pedido.qtd_questionamentos_abertos} aberto{pedido.qtd_questionamentos_abertos > 1 ? 's' : ''}
                </span>
              )}
              {pedido.sem_itens && (
                <span className="cmp-selo bg-amber-500/15 text-amber-300 border border-amber-500/40">📝 Sem lista de itens</span>
              )}
              {pedido.obra_cancelada && (
                <span className="cmp-selo bg-slate-500/15 text-slate-300 border border-slate-500/40">🚧 Obra cancelada</span>
              )}
            </div>

            <dl className="space-y-1 mb-4">
              <Linha rotulo="Solicitante">{pedido.solicitante_nome || '—'}</Linha>
              <Linha rotulo="Comprador">{pedido.comprador_nome || 'Sem comprador'}</Linha>
              <Linha rotulo="Pedido">{formatarDataHora(pedido.created_at)}</Linha>
              {pedido.data_material_disponivel && (
                <Linha rotulo="Previsão de chegada">
                  {formatarDataBR(pedido.data_material_disponivel)}
                  {pedido.atrasado && <span className="text-amber-300 font-semibold"> · ⚠️ atrasado</span>}
                </Linha>
              )}
              {pedido.endereco_obra && <Linha rotulo="Obra">{pedido.endereco_obra}</Linha>}
              {pedido.atividade_titulo && <Linha rotulo="Atividade">{pedido.atividade_titulo}</Linha>}
            </dl>

            {!mobile && (
              <div className="flex flex-wrap gap-2 mb-4">
                {podeAssumir && (
                  <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm cmp-btn-toque" onClick={assumir}>Assumir</button>
                )}
                {botoesSecundarios}
                {podeOperar && aceitaQuestionamento && (
                  <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => abrirQuestionar()}>
                    ❓ Questionar
                  </button>
                )}
              </div>
            )}

            <div className="cmp-abas" role="tablist" aria-label="Seções do pedido" onKeyDown={aoTeclarAba}>
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  id={`${idBase}-tab-${a.id}`}
                  type="button"
                  role="tab"
                  aria-selected={aba === a.id}
                  aria-controls={`${idBase}-painel-${a.id}`}
                  tabIndex={aba === a.id ? 0 : -1}
                  className={`cmp-aba${aba === a.id ? ' cmp-aba-ativa' : ''}`}
                  onClick={() => setAbaEscolhida(a.id)}
                >
                  {a.rotulo}{contadorAba[a.id] !== null && contadorAba[a.id] > 0 ? ` ${contadorAba[a.id]}` : ''}
                </button>
              ))}
            </div>

            <div id={`${idBase}-painel-${aba}`} role="tabpanel" aria-labelledby={`${idBase}-tab-${aba}`} className="pt-4">
              {aba === 'itens' && (
                <div>
                  {itens.length === 0 ? (
                    <div className="cmp-aviso">
                      Este pedido não tem lista de itens (falta de material reportada em campo).
                      {pedido.observacoes && <p className="mt-2 text-slate-200 whitespace-pre-wrap break-words">{pedido.observacoes}</p>}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {itens.map((item, idx) => {
                        const questionamento = item.id ? abertos.find((q) => q.item_id === item.id) : null;
                        const podeQuestionarItem = podeOperar && aceitaQuestionamento && item.id && !questionamento;
                        return (
                          <li key={item.id ?? `${item.nome}-${idx}`} className={`cmp-item${questionamento ? ' cmp-item-questionado' : ''}`}>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-100 break-words">
                                <strong>{item.nome}</strong> · {String(item.quantidade ?? '').replace('.', ',')} {item.unidade}
                              </p>
                              {questionamento && (
                                <p className="text-xs font-semibold text-purple-300">
                                  ❓ Questionado<span className="sr-only"> — questionamento aberto neste item</span>
                                </p>
                              )}
                            </div>
                            {podeQuestionarItem && (
                              <button
                                type="button"
                                className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-icone"
                                onClick={() => abrirQuestionar(item.id)}
                                aria-label={`Questionar o item ${item.nome}`}
                                title="Questionar item"
                              >
                                ❓
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pedido.observacoes && itens.length > 0 && (
                    <p className="text-sm text-slate-300 mt-4 whitespace-pre-wrap break-words">
                      <span className="text-slate-400">Observações:</span> {pedido.observacoes}
                    </p>
                  )}
                </div>
              )}

              {aba === 'conversa' && (
                <QuestionamentosPedido
                  questionamentos={questionamentos}
                  carregando={loading}
                  erro={error}
                  onRecarregar={reload}
                  podeResponder={podeResponder}
                  podeCancelarQualquer={podeResponder}
                  usuarioId={usuario?.id}
                  nomeSolicitante={pedido.solicitante_nome}
                  podeAbrir={podeOperar && aceitaQuestionamento}
                  onAbrir={() => abrirQuestionar()}
                  onRespondido={aposAlteracao}
                  onCancelado={aposAlteracao}
                />
              )}

              {aba === 'historico' && <ListaHistorico historico={data?.historico ?? []} />}
            </div>
          </div>
        )}

        {mobile && pedido && (
          <div className="cmp-barra-acao">
            {maisAberto && (
              <div className="cmp-menu-mais" role="group" aria-label="Mais ações">
                {botoesSecundarios}
              </div>
            )}
            <div className="flex gap-2 items-stretch">
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary cmp-btn-toque"
                aria-expanded={maisAberto}
                onClick={() => setMaisAberto((v) => !v)}
              >
                ⋯ Mais
              </button>
              {podeOperar && aceitaQuestionamento && (
                <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque flex-1" onClick={() => abrirQuestionar()}>
                  ❓ Questionar
                </button>
              )}
              {podeOperar && acao && (
                <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque flex-1" onClick={executarAcaoPrincipal}>
                  {ROTULO_ACAO_PRINCIPAL[acao]}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {modal?.tipo === 'status' && (
        <ModalStatusCompra pedido={pedido} destino={modal.destino} onClose={() => { setModal(null); setStatusSelecionado(''); }} onConfirmado={aposAlteracao} />
      )}
      {modal?.tipo === 'entrega' && (
        <ModalStatusCompra pedido={pedido} destino="entregue" escolherEntrega onClose={() => setModal(null)} onConfirmado={aposAlteracao} />
      )}
      {modal?.tipo === 'disponibilidade' && (
        <ModalDisponibilidade pedido={pedido} onClose={() => setModal(null)} onConfirmado={aposAlteracao} />
      )}
      {modal?.tipo === 'questionar' && (
        <ModalQuestionamento
          pedido={pedido}
          itemInicialId={modal.itemId}
          questionamentosAbertos={abertos}
          onClose={() => setModal(null)}
          onVerConversa={() => { setModal(null); setAbaEscolhida('conversa'); }}
          onEnviado={() => { setAbaEscolhida('conversa'); aposAlteracao(); }}
        />
      )}
    </>
  );
}
