import React, { useId, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import execucaoComprasService from '../../../../services/supabase/execucaoCompras';
import { useAsyncData } from '../../../execucao/hooks/useAsyncData';
import { ErroCarregamento } from '../../../execucao/components/ui/Estados';
import { formatarPrazo, localParaISO } from '../../utils/cotacao/envio';

// Ações extras do menu "Mais ▾" da cotação (B.5.7): prorrogar, incluir pedido, remover pedido, cancelar.

export function ModalProrrogar({ cotacao, onClose, onFeito }) {
  const { toast } = useExecucaoUI();
  const id = useId();
  const [modo, setModo] = useState(24);
  const [local, setLocal] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const base = Math.max(Date.now(), new Date(cotacao.prazo_resposta).getTime() || 0);
  const novo = modo === 'data' ? localParaISO(local) : new Date(base + modo * 3600000).toISOString();

  const confirmar = async () => {
    setErro('');
    if (!novo || new Date(novo).getTime() <= Date.now()) { setErro('Escolha um horário futuro.'); return; }
    setOcupado(true);
    const r = await comprasCotacaoService.prorrogar(cotacao.id, novo, null);
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível prorrogar.'); return; }
    toast.success(`Prazo prorrogado para ${formatarPrazo(r.data?.prazo_resposta ?? novo)}.`);
    onFeito();
  };

  return (
    <Modal tamanho="sm" titulo="Prorrogar prazo" onClose={onClose}>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Prorrogar por">
        {[24, 48, 72, 'data'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} className={`cmp-opcao ${modo === m ? 'cmp-opcao-ativa' : ''}`} onClick={() => setModo(m)}>
            {m === 'data' ? 'Data e hora' : `+${m} h`}
          </button>
        ))}
      </div>
      {modo === 'data' && (
        <div className="cmp-campo mt-2">
          <label htmlFor={`${id}-dt`}>Novo prazo</label>
          <input id={`${id}-dt`} type="datetime-local" className="execucao-form-input" value={local} onChange={(e) => setLocal(e.target.value)} />
        </div>
      )}
      <p className="text-sm text-slate-300 mt-2" aria-live="polite">Novo prazo: {novo ? formatarPrazo(novo) : '—'}</p>
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Cancelar</button>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={confirmar} disabled={ocupado} aria-busy={ocupado || undefined}>{ocupado ? 'Prorrogando…' : 'Prorrogar'}</button>
      </div>
    </Modal>
  );
}

export function ModalIncluirPedido({ cotacao, onClose, onFeito }) {
  const { toast } = useExecucaoUI();
  const lista = useAsyncData(() => execucaoComprasService.listarPedidos({ statusCompra: ['aguardando_compra', 'em_cotacao'], semCotacao: true }, { limite: 100 }), []);
  const [sel, setSel] = useState(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const pedidos = (lista.data?.itens ?? lista.data ?? []).filter((p) => !p.sem_itens);

  const confirmar = async () => {
    setOcupado(true); setErro('');
    const r = await comprasCotacaoService.incluirPedidos(cotacao.id, [...sel]);
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível incluir os pedidos.'); return; }
    toast.success(r.data?.requer_revisao ? 'Pedidos incluídos. A cotação precisa ser revisada.' : 'Pedidos incluídos.');
    onFeito();
  };

  return (
    <Modal tamanho="md" titulo="Incluir pedido" onClose={onClose}>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}
      {lista.error ? <ErroCarregamento mensagem={lista.error} onTentarNovamente={lista.reload} />
        : lista.loading ? <div className="cmp-skeleton h-24 w-full rounded-xl" aria-busy="true" />
          : pedidos.length === 0 ? <p className="text-slate-300">Nenhum pedido disponível (sem cotação ativa).</p> : (
            <ul className="cmp-lista-limpa">
              {pedidos.map((p) => (
                <li key={p.id} className="cmp-linha">
                  <label className="flex items-center gap-3 cursor-pointer" style={{ minHeight: 44 }}>
                    <input type="checkbox" className="cmp-checkbox" checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                    <span className="text-sm text-slate-200">{p.cliente_nome || p.descricao || 'Pedido'} · {p.qtd_itens ?? 0} itens</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
      {cotacao.status === 'aberta' && <div className="cmp-aviso">Com a cotação aberta, incluir pedidos exige “Revisar cotação” depois.</div>}
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Cancelar</button>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={confirmar} disabled={ocupado || sel.size === 0}>{ocupado ? 'Incluindo…' : `Incluir ${sel.size || ''}`.trim()}</button>
      </div>
    </Modal>
  );
}

export function ModalRemoverPedido({ cotacao, pedidos, onClose, onFeito }) {
  const { toast } = useExecucaoUI();
  const ativos = pedidos.filter((p) => p.ativa !== false);
  const [pedidoId, setPedidoId] = useState(ativos[0]?.id ?? '');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const confirmar = async () => {
    setOcupado(true); setErro('');
    const r = await comprasCotacaoService.removerPedido(cotacao.id, pedidoId, motivo.trim());
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível remover o pedido.'); return; }
    toast.success(r.data?.requer_revisao ? 'Pedido removido. A cotação precisa ser revisada.' : 'Pedido removido da cotação.');
    onFeito();
  };

  return (
    <Modal tamanho="sm" titulo="Remover pedido da cotação" onClose={onClose}>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}
      <div className="cmp-campo mb-3">
        <label htmlFor="cmp-rem-ped">Pedido</label>
        <select id="cmp-rem-ped" className="execucao-form-select" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)}>
          {ativos.map((p) => <option key={p.id} value={p.id}>{p.cliente_nome || p.descricao || 'Pedido'}</option>)}
        </select>
      </div>
      <div className="cmp-campo">
        <label htmlFor="cmp-rem-mot">Motivo * (mín. 3 caracteres)</label>
        <input id="cmp-rem-mot" className="execucao-form-input" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <p className="cmp-texto-mudo mt-2">O pedido volta para “aguardando compra”.</p>
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Cancelar</button>
        <button type="button" className="execucao-btn execucao-btn-danger cmp-btn-toque" onClick={confirmar} disabled={ocupado || !pedidoId || motivo.trim().length < 3}>{ocupado ? 'Removendo…' : 'Remover pedido'}</button>
      </div>
    </Modal>
  );
}

export function ModalCancelarCotacao({ cotacao, onClose, onFeito }) {
  const { toast } = useExecucaoUI();
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const confirmar = async () => {
    setOcupado(true); setErro('');
    const r = await comprasCotacaoService.cancelar(cotacao.id, motivo.trim());
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível cancelar.'); return; }
    toast.success(`Cotação nº ${cotacao.numero} cancelada.`);
    onFeito();
  };

  return (
    <Modal tamanho="sm" titulo={`Cancelar cotação nº ${cotacao.numero}`} onClose={onClose}>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}
      <p className="text-slate-200 mb-3">Os fornecedores com link verão “Cotação encerrada”. Os pedidos voltam para “aguardando compra”.</p>
      <div className="cmp-campo">
        <label htmlFor="cmp-can-mot">Motivo * (mín. 5 caracteres)</label>
        <input id="cmp-can-mot" className="execucao-form-input" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Voltar</button>
        <button type="button" className="execucao-btn execucao-btn-danger cmp-btn-toque" onClick={confirmar} disabled={ocupado || motivo.trim().length < 5}>{ocupado ? 'Cancelando…' : '🚫 Cancelar cotação'}</button>
      </div>
    </Modal>
  );
}
