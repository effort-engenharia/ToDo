import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { execucaoPlanejamentoService as servico } from '../../../../../services/supabase/execucaoPlanejamento';
import { addDias, dataLocalISO, formatarDataBR, parseDataLocal } from '../../../utils/datas';
import { formatarDataHora } from '../../../utils/formatos';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';

const MS_DIA = 1000 * 60 * 60 * 24;

const ModalReagendar = ({ atividade, salvando, onConfirmar, onClose }) => {
  const [data, setData] = useState(atividade.data_programada || '');

  const submit = (e) => {
    e.preventDefault();
    if (data) onConfirmar(data);
  };

  return (
    <Modal titulo="Reagendar atividade" onClose={onClose} tamanho="sm">
      <form onSubmit={submit}>
        <p className="text-sm text-slate-300 mb-4">
          <strong>{atividade.titulo}</strong>
          {atividade.etapa?.obra?.nome_cliente ? ` · ${atividade.etapa.obra.nome_cliente}` : ''}
        </p>
        <div className="execucao-form-group">
          <label htmlFor="reagendar-data" className="execucao-form-label">Nova data de início *</label>
          <input
            id="reagendar-data"
            type="date"
            className="execucao-form-input"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
          {atividade.data_fim && (
            <p className="text-xs text-slate-400 mt-2">A data de término acompanha o deslocamento (mesma duração).</p>
          )}
          <p className="text-xs text-slate-400 mt-2">Ao reagendar, o pedido de replanejamento é marcado como resolvido.</p>
        </div>
        <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando || !data}>
            {salvando ? 'Salvando...' : 'Reagendar e resolver'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Pausas em que o técnico pediu para atualizar o planejamento (item 2.7)
const PendenciasReplanejamento = ({ pendencias, onReprogramar, onAlterado }) => {
  const { toast } = useExecucaoUI();
  const [reagendando, setReagendando] = useState(null);
  const [processando, setProcessando] = useState(null); // id da atividade em processamento

  const lista = pendencias.data ?? [];

  if (pendencias.error) {
    return (
      <div className="visao-painel-estado visao-painel-erro" role="alert">
        Não foi possível carregar os pedidos de replanejamento: {pendencias.error}{' '}
        <button type="button" className="visao-link" onClick={pendencias.reload}>Tentar novamente</button>
      </div>
    );
  }
  if (lista.length === 0) return null;

  const resolver = async (atividade, novasDatas = null) => {
    if (processando) return;
    setProcessando(atividade.id);
    try {
      const resultado = await servico.atualizarResolverReplanejamento(atividade.id, novasDatas);
      if (!resultado.success) {
        toast.error(`Não foi possível atualizar o pedido: ${resultado.message}`);
        return;
      }
      toast.success(novasDatas ? 'Atividade reagendada e pedido resolvido.' : 'Pedido de replanejamento resolvido.');
      setReagendando(null);
      onAlterado();
    } finally {
      setProcessando(null);
    }
  };

  const reagendar = (atividade, novaData) => {
    const dados = { data_programada: novaData };
    const inicioAtual = parseDataLocal(atividade.data_programada);
    const fimAtual = parseDataLocal(atividade.data_fim);
    if (fimAtual && inicioAtual) {
      const duracao = Math.round((fimAtual - inicioAtual) / MS_DIA);
      dados.data_fim = dataLocalISO(addDias(parseDataLocal(novaData), Math.max(0, duracao)));
    }
    return resolver(atividade, dados);
  };

  return (
    <section className="visao-pendencias" aria-label="Pedidos de replanejamento">
      <h3 className="visao-pendencias-titulo">
        <FaExclamationTriangle className="text-amber-400" aria-hidden="true" />
        Pedidos de replanejamento ({lista.length})
      </h3>
      <ul className="visao-pendencias-lista">
        {lista.map((a) => (
          <li key={a.id} className="visao-pendencia">
            <div className="visao-pendencia-texto">
              <div className="font-medium text-white">
                {a.etapa?.obra?.nome_cliente ?? 'Obra'} <span className="text-slate-400">·</span> {a.titulo}
              </div>
              <div className="text-xs text-slate-400">
                {a.tecnico?.nome_completo ?? 'Sem técnico'} · programada para {formatarDataBR(a.data_programada)}
                {a.pausada_em ? ` · pausada em ${formatarDataHora(a.pausada_em)}` : ''}
              </div>
              {a.motivo && <div className="text-xs text-amber-200 mt-1">“{a.motivo}”</div>}
            </div>
            <div className="visao-pendencia-acoes">
              {a.etapa?.obra_id && (
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                  onClick={() => onReprogramar(a.etapa.obra_id, a.etapa.id)}
                  title="Empurrar as etapas seguintes (com prévia)"
                >
                  Reprogramar etapas
                </button>
              )}
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                onClick={() => setReagendando(a)}
                disabled={Boolean(processando)}
              >
                Reagendar
              </button>
              <button
                type="button"
                className="execucao-btn execucao-btn-primary execucao-btn-sm"
                onClick={() => resolver(a)}
                disabled={Boolean(processando)}
              >
                {processando === a.id ? 'Salvando...' : 'Resolver'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {reagendando && (
        <ModalReagendar
          atividade={reagendando}
          salvando={processando === reagendando.id}
          onConfirmar={(data) => reagendar(reagendando, data)}
          onClose={() => setReagendando(null)}
        />
      )}
    </section>
  );
};

export default PendenciasReplanejamento;
