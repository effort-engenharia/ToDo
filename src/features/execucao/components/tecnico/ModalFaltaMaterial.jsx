import React, { useState } from 'react';
import { FaBoxOpen } from 'react-icons/fa';
import Modal from '../ui/Modal';
import './tecnico.css';

// "Falta material": descreve o que falta e decide se pausa a atividade até o material chegar
export default function ModalFaltaMaterial({ atividade, salvando = false, erro = '', onConfirmar, onClose }) {
  const podePausar = atividade.status === 'pendente' || atividade.status === 'em_andamento';
  const [descricao, setDescricao] = useState('');
  const [pausar, setPausar] = useState(podePausar);
  const [erroLocal, setErroLocal] = useState('');

  const fechar = () => {
    if (!salvando) onClose();
  };

  const confirmar = () => {
    if (salvando) return;
    if (descricao.trim().length < 3) {
      setErroLocal('Descreva o material que está faltando.');
      return;
    }
    onConfirmar({ descricao: descricao.trim(), pausar: podePausar && pausar });
  };

  const mensagem = erroLocal || erro;

  return (
    <Modal
      onClose={fechar}
      tamanho="sm"
      titulo="Falta de material"
      cabecalho={
        <span className="flex items-center gap-2">
          <FaBoxOpen className="text-orange-400" aria-hidden="true" /> Falta de material
        </span>
      }
    >
      <p className="text-slate-200 font-medium mb-4">{atividade.titulo}</p>

      <div className="execucao-form-group">
        <label htmlFor="material-descricao" className="execucao-form-label">O que está faltando?</label>
        <textarea
          id="material-descricao"
          className="execucao-form-textarea tec-input"
          rows={3}
          placeholder="Ex.: 20 m de cabo 6 mm, disjuntor 32 A..."
          value={descricao}
          onChange={(e) => { setDescricao(e.target.value); setErroLocal(''); }}
        />
      </div>

      {podePausar && (
        <label className="tec-check">
          <input type="checkbox" checked={pausar} onChange={(e) => setPausar(e.target.checked)} />
          Pausar a atividade até o material chegar
        </label>
      )}

      <p className="text-slate-400 text-sm mt-2">O escritório é avisado na hora e um pedido urgente é criado.</p>

      {mensagem && <p className="tec-erro" role="alert">{mensagem}</p>}

      <div className="tec-rodape-modal">
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={fechar} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="execucao-btn execucao-btn-primary tec-btn" onClick={confirmar} disabled={salvando}>
          {salvando ? 'Enviando...' : 'Avisar falta'}
        </button>
      </div>
    </Modal>
  );
}
