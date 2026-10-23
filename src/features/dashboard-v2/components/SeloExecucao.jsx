import React from 'react';
import { STATUS_VISUAL, statusEfetivo, textoSelo } from '../utils/statusExecucao';
import './ExecucaoContratos.css';

/** Selo com o status da execução de um contrato. `info` = linha da RPC status_execucao_contratos. */
const SeloExecucao = ({ info, className = '' }) => {
  const chave = statusEfetivo(info);
  if (!chave) return null;
  const visual = STATUS_VISUAL[chave] || { tom: 'cinza' };
  const texto = textoSelo(info) || chave.replace(/_/g, ' ');
  return (
    <span className={`exec-selo exec-selo--${visual.tom} ${className}`} title={texto}>
      {texto}
    </span>
  );
};

export default SeloExecucao;
