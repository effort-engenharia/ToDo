import React from 'react';
import { FaCloudUploadAlt, FaExclamationTriangle, FaSyncAlt, FaWifi } from 'react-icons/fa';
import { useSincronizacao } from './useSincronizacao';
import './FaixaStatusOffline.css';

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;

const horaCurta = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Faixa no topo das telas do técnico: aparece só quando há algo a informar (offline, fila, erro, dados salvos)
export default function FaixaStatusOffline({ usuarioId, aoSincronizar, dadosSalvosEm = null }) {
  const { online, sincronizando, pendentes, comErro, erros, sessaoExpirada, enviarAgora, descartarErros } =
    useSincronizacao(usuarioId, { aoSincronizar });

  if (online && !sincronizando && pendentes === 0 && comErro === 0 && !dadosSalvosEm) return null;

  const textoFila = pendentes > 0 ? plural(pendentes, 'ação pendente', 'ações pendentes') : null;

  return (
    <div className="tec-offline" role="status" aria-live="polite">
      {!online && (
        <div className="tec-offline-linha tec-offline-aviso">
          <FaWifi aria-hidden="true" />
          <span>
            Offline{textoFila ? ` — ${textoFila}` : ''}
            {dadosSalvosEm ? ` · dados salvos às ${horaCurta(dadosSalvosEm)}` : ''}
          </span>
        </div>
      )}

      {online && !sincronizando && dadosSalvosEm && (
        <div className="tec-offline-linha tec-offline-info">
          <FaWifi aria-hidden="true" />
          <span>Conexão instável — mostrando dados salvos às {horaCurta(dadosSalvosEm)}</span>
        </div>
      )}

      {online && sincronizando && (
        <div className="tec-offline-linha tec-offline-info">
          <FaSyncAlt className="tec-offline-gira" aria-hidden="true" />
          <span>Sincronizando…</span>
        </div>
      )}

      {online && !sincronizando && pendentes > 0 && (
        <div className="tec-offline-linha tec-offline-aviso">
          <FaCloudUploadAlt aria-hidden="true" />
          <span>{sessaoExpirada ? `${textoFila} — sessão expirada, entre novamente` : `${textoFila} aguardando envio`}</span>
          <button type="button" className="tec-offline-botao" onClick={enviarAgora}>Enviar agora</button>
        </div>
      )}

      {comErro > 0 && (
        <div className="tec-offline-linha tec-offline-erro">
          <FaExclamationTriangle aria-hidden="true" />
          <span>
            {plural(comErro, 'ação não pôde ser enviada', 'ações não puderam ser enviadas')}: {erros[0]?.mensagem}
          </span>
          <button type="button" className="tec-offline-botao" onClick={descartarErros}>Descartar</button>
        </div>
      )}
    </div>
  );
}
