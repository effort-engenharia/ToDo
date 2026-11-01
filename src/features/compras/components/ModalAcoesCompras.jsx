import React, { useId, useState } from 'react';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';
import { useExecucaoUI } from '../../execucao/components/ui/ExecucaoUI';
import Modal from '../../execucao/components/ui/Modal';
import { STATUS_COMPRA, rotuloStatusCompra } from '../utils/statusCompra';
import '../styles/compras.css';

const MIN_OBS = 3;

/**
 * Mudança de status de compra com os dados que o banco exige (F.4): data de disponibilidade ao comprar
 * (se o pedido ainda não tem), observação obrigatória em entrega parcial e cancelamento.
 * `destino` inicial; com `escolherEntrega`, o comprador escolhe entre entrega total e parcial.
 */
export function ModalStatusCompra({ pedido, destino: destinoInicial, escolherEntrega = false, onClose, onConfirmado }) {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const jaParcial = pedido.status_compra === 'entregue_parcial';
  const [destino, setDestino] = useState(escolherEntrega ? 'entregue' : destinoInicial);
  const [data, setData] = useState(pedido.data_material_disponivel ? String(pedido.data_material_disponivel).slice(0, 10) : '');
  const [obs, setObs] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const exigeData = destino === 'comprado' && !pedido.data_material_disponivel;
  const mostraData = destino === 'comprado';
  const exigeObs = destino === 'cancelado' || destino === 'entregue_parcial';
  const erroData = tentou && exigeData && !data ? 'Informe quando os materiais ficam disponíveis.' : '';
  const erroObs = tentou && exigeObs && obs.trim().length < MIN_OBS
    ? (destino === 'cancelado' ? 'Informe o motivo do cancelamento.' : 'Informe o que ainda falta entregar.')
    : '';

  const confirmar = async (e) => {
    e.preventDefault();
    setTentou(true);
    setErro('');
    if ((exigeData && !data) || (exigeObs && obs.trim().length < MIN_OBS)) return;
    setEnviando(true);
    const r = await execucaoComprasService.alterarStatus(pedido.id, destino, obs.trim() || null, mostraData && data ? data : null);
    setEnviando(false);
    if (!r.success) { setErro(r.message || 'Não foi possível alterar o status.'); return; }
    toast.success(`Status atualizado: ${STATUS_COMPRA[destino]?.rotulo ?? destino}`);
    onConfirmado?.(r.data);
  };

  const titulo = escolherEntrega ? 'Registrar entrega' : `Alterar status → ${rotuloStatusCompra(destino)}`;

  return (
    <Modal tamanho="sm" onClose={enviando ? () => {} : onClose} titulo={titulo}>
      <form onSubmit={confirmar} noValidate>
        <p className="text-sm text-slate-300 mb-4 break-words">
          {pedido.cliente_nome || pedido.descricao || 'Pedido de material'}
        </p>

        {escolherEntrega && (
          <fieldset className="mb-4">
            <legend className="execucao-form-label">Entrega</legend>
            <div className="grid gap-2" role="radiogroup" aria-label="Tipo de entrega">
              {[['entregue', '📦 Entrega total'], ...(!jaParcial ? [['entregue_parcial', '🚚 Entrega parcial']] : [])].map(([valor, rotulo]) => (
                <label key={valor} className={`cmp-opcao${destino === valor ? ' cmp-opcao-ativa' : ''}`}>
                  <input type="radio" name={`${idBase}-entrega`} value={valor} checked={destino === valor} onChange={() => setDestino(valor)} />
                  <span>{rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {mostraData && (
          <div className="mb-4">
            <label className="execucao-form-label" htmlFor={`${idBase}-data`}>
              Quando os materiais ficam disponíveis? {exigeData ? '*' : '(opcional)'}
            </label>
            <input
              id={`${idBase}-data`}
              type="date"
              className="execucao-form-input"
              value={data}
              onChange={(e) => setData(e.target.value)}
              aria-required={exigeData || undefined}
              aria-invalid={Boolean(erroData) || undefined}
              aria-describedby={erroData ? `${idBase}-erro-data` : undefined}
            />
            {erroData && <p id={`${idBase}-erro-data`} className="cmp-erro-campo" role="alert">{erroData}</p>}
            <p className="text-xs text-slate-400 mt-1">É a previsão de chegada; atualiza a etapa “Chegada dos Materiais” da obra.</p>
          </div>
        )}

        <div className="mb-4">
          <label className="execucao-form-label" htmlFor={`${idBase}-obs`}>
            {destino === 'cancelado' ? 'Motivo *' : destino === 'entregue_parcial' ? 'O que falta entregar *' : 'Observação (opcional)'}
          </label>
          <textarea
            id={`${idBase}-obs`}
            className="execucao-form-textarea"
            rows={3}
            maxLength={500}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            aria-required={exigeObs || undefined}
            aria-invalid={Boolean(erroObs) || undefined}
            aria-describedby={erroObs ? `${idBase}-erro-obs` : undefined}
          />
          {erroObs && <p id={`${idBase}-erro-obs`} className="cmp-erro-campo" role="alert">{erroObs}</p>}
        </div>

        {erro && <p className="cmp-erro-envio" role="alert">{erro}</p>}

        <div className="execucao-modal-footer !px-0 !pb-0">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`execucao-btn cmp-btn-toque ${destino === 'cancelado' ? 'execucao-btn-danger' : 'execucao-btn-primary'}`}
            disabled={enviando}
            aria-busy={enviando}
          >
            {enviando ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Define a previsão de chegada (data de disponibilidade); o banco cria/atualiza a etapa de chegada da obra. */
export function ModalDisponibilidade({ pedido, onClose, onConfirmado }) {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const [data, setData] = useState(pedido.data_material_disponivel ? String(pedido.data_material_disponivel).slice(0, 10) : '');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const confirmar = async (e) => {
    e.preventDefault();
    setTentou(true);
    setErro('');
    if (!data) return;
    setEnviando(true);
    const r = await execucaoComprasService.definirDisponibilidade(pedido.id, data);
    setEnviando(false);
    if (!r.success) { setErro(r.message || 'Não foi possível definir a disponibilidade.'); return; }
    toast.success(r.data?.etapa_criada ? 'Disponibilidade definida e etapa de chegada criada na obra.' : 'Disponibilidade atualizada.');
    onConfirmado?.(r.data);
  };

  return (
    <Modal tamanho="sm" onClose={enviando ? () => {} : onClose} titulo="📅 Disponibilidade dos materiais">
      <form onSubmit={confirmar} noValidate>
        <label className="execucao-form-label" htmlFor={`${idBase}-data`}>Previsão de chegada *</label>
        <input
          id={`${idBase}-data`}
          type="date"
          className="execucao-form-input"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-required="true"
          aria-invalid={(tentou && !data) || undefined}
        />
        {tentou && !data && <p className="cmp-erro-campo" role="alert">Informe a data.</p>}
        {erro && <p className="cmp-erro-envio mt-3" role="alert">{erro}</p>}
        <div className="execucao-modal-footer !px-0 !pb-0 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary cmp-btn-toque" disabled={enviando} aria-busy={enviando}>
            {enviando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
