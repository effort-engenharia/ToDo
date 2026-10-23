import React, { useRef, useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import Modal from '../ui/Modal';
import EvidenciasUploader from './evidencias/EvidenciasUploader';
import { useEvidencias } from './evidencias/useEvidencias';
import { usuarioIdAtual } from './evidencias/filaUpload';
import './tecnico.css';

const paraNumero = (valor) => {
  const texto = String(valor).trim().replace(',', '.');
  if (texto === '') return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : NaN;
};

// Conclusão: pergunta as horas realizadas (padrão = horas previstas) e permite anexar evidências.
// As evidências ficam numa fila local e sobem sozinhas: falha de envio nunca bloqueia a conclusão.
export default function ModalConcluir({ atividade, salvando = false, erro = '', usuarioId = usuarioIdAtual(), onConfirmar, onClose }) {
  const previstas = atividade.horas_previstas != null ? Number(atividade.horas_previstas) : null;
  const [horas, setHoras] = useState(previstas != null ? String(previstas).replace('.', ',') : '');
  const [erroLocal, setErroLocal] = useState('');
  const evidencias = useEvidencias(atividade.id, usuarioId);
  const confirmandoRef = useRef(false);

  const fechar = () => {
    if (salvando) return;
    if (evidencias.ocupado) {
      setErroLocal('Aguarde a gravação ou a otimização terminar antes de sair.');
      return;
    }
    onClose();
  };

  const confirmar = async () => {
    if (salvando || confirmandoRef.current) return;
    if (evidencias.ocupado) {
      setErroLocal('Aguarde a gravação ou a otimização das evidências terminar.');
      return;
    }
    const valor = paraNumero(horas);
    if (Number.isNaN(valor) || (valor != null && (valor < 0 || valor > 99))) {
      setErroLocal('Informe um número de horas válido (ex.: 2,5).');
      return;
    }
    confirmandoRef.current = true;
    try {
      await evidencias.liberar();
      await onConfirmar({ horasRealizadas: valor });
    } finally {
      confirmandoRef.current = false;
    }
  };

  const mensagem = erroLocal || erro;

  return (
    <Modal
      onClose={fechar}
      tamanho="md"
      titulo="Concluir atividade"
      cabecalho={
        <span className="flex items-center gap-2">
          <FaCheck className="text-green-400" aria-hidden="true" /> Concluir atividade
        </span>
      }
    >
      <p className="text-slate-200 font-medium mb-4">{atividade.titulo}</p>

      <div className="execucao-form-group">
        <label htmlFor="concluir-horas" className="execucao-form-label">
          Horas realizadas{previstas != null ? ` (previstas: ${String(previstas).replace('.', ',')}h)` : ' (opcional)'}
        </label>
        <input
          id="concluir-horas"
          type="text"
          inputMode="decimal"
          className="execucao-form-input tec-input"
          value={horas}
          onChange={(e) => { setHoras(e.target.value); setErroLocal(''); }}
          onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          aria-invalid={!!mensagem}
        />
      </div>

      <EvidenciasUploader controle={evidencias} desabilitado={salvando} />

      {mensagem && <p className="tec-erro" role="alert">{mensagem}</p>}

      <div className="tec-rodape-modal">
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={fechar} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="execucao-btn execucao-btn-success tec-btn" onClick={confirmar} disabled={salvando || evidencias.ocupado}>
          <FaCheck size={12} aria-hidden="true" /> {salvando ? 'Concluindo...' : 'Concluir'}
        </button>
      </div>
    </Modal>
  );
}
