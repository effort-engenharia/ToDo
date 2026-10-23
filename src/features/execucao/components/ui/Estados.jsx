import React from 'react';

export function Carregando() {
  return (
    <div className="execucao-loading" role="status" aria-label="Carregando">
      <div className="execucao-spinner" />
    </div>
  );
}

// Distingue falha de consulta de "sem dados"
export function ErroCarregamento({ mensagem, onTentarNovamente }) {
  return (
    <div className="execucao-card" role="alert">
      <div className="execucao-empty-state">
        <div className="execucao-empty-title">Não foi possível carregar os dados</div>
        <div className="execucao-empty-text">{mensagem}</div>
        {onTentarNovamente && (
          <button type="button" className="execucao-btn execucao-btn-primary mt-4" onClick={onTentarNovamente}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

export function EstadoVazio({ titulo, texto, icone = null }) {
  return (
    <div className="execucao-card">
      <div className="execucao-empty-state">
        {icone && <div className="execucao-empty-icon">{icone}</div>}
        <div className="execucao-empty-title">{titulo}</div>
        {texto && <div className="execucao-empty-text">{texto}</div>}
      </div>
    </div>
  );
}
