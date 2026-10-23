import React, { useState } from 'react';
import { FaPause } from 'react-icons/fa';
import Modal from '../ui/Modal';
import { MOTIVOS_PAUSA, rotuloMotivoPausa } from './motivosPausa';
import './tecnico.css';

// Pausa com motivo padronizado (chips) + justificativa + pedido de replanejamento
export default function ModalPausa({ atividade, salvando = false, erro = '', onConfirmar, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [texto, setTexto] = useState('');
  const [solicitar, setSolicitar] = useState(false);
  const [erroLocal, setErroLocal] = useState('');

  const fechar = () => {
    if (!salvando) onClose();
  };

  const confirmar = () => {
    if (salvando) return;
    const justificativa = texto.trim();
    if (!codigo) {
      setErroLocal('Escolha o motivo da pausa.');
      return;
    }
    if ((codigo === 'outro' || solicitar) && justificativa.length < 3) {
      setErroLocal(codigo === 'outro' ? 'Descreva o motivo da pausa.' : 'Explique por que precisa replanejar.');
      return;
    }
    const rotulo = rotuloMotivoPausa(codigo);
    onConfirmar({
      motivoCodigo: codigo,
      motivo: justificativa ? `${rotulo}: ${justificativa}` : rotulo,
      solicitaReplanejamento: solicitar
    });
  };

  const mensagem = erroLocal || erro;

  return (
    <Modal
      onClose={fechar}
      tamanho="sm"
      titulo="Pausar atividade"
      cabecalho={
        <span className="flex items-center gap-2">
          <FaPause className="text-yellow-400" aria-hidden="true" /> Pausar atividade
        </span>
      }
    >
      <p className="text-slate-200 font-medium mb-4">{atividade.titulo}</p>

      <div role="group" aria-label="Motivo da pausa" className="tec-chips">
        {MOTIVOS_PAUSA.map((m) => (
          <button
            key={m.codigo}
            type="button"
            className="tec-chip"
            aria-pressed={codigo === m.codigo}
            onClick={() => { setCodigo(m.codigo); setErroLocal(''); }}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      <div className="execucao-form-group mt-4">
        <label htmlFor="pausa-justificativa" className="execucao-form-label">
          Justificativa {codigo === 'outro' || solicitar ? '(obrigatória)' : '(opcional)'}
        </label>
        <textarea
          id="pausa-justificativa"
          className="execucao-form-textarea tec-input"
          rows={3}
          placeholder="Conte o que aconteceu..."
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setErroLocal(''); }}
        />
      </div>

      <label className="tec-check">
        <input type="checkbox" checked={solicitar} onChange={(e) => { setSolicitar(e.target.checked); setErroLocal(''); }} />
        Solicitar replanejamento (a data precisa mudar)
      </label>

      {mensagem && <p className="tec-erro" role="alert">{mensagem}</p>}

      <div className="tec-rodape-modal">
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={fechar} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="execucao-btn tec-btn tec-btn-pausa" onClick={confirmar} disabled={salvando}>
          <FaPause size={12} aria-hidden="true" /> {salvando ? 'Pausando...' : 'Confirmar pausa'}
        </button>
      </div>
    </Modal>
  );
}
