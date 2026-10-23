import React from 'react';

// Evita tela branca quando uma página (ou seu chunk lazy) falha ao carregar/renderizar.
export default class ErrorBoundary extends React.Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro ao renderizar página do módulo Execução:', erro, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.erro && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ erro: null });
    }
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="execucao-card" role="alert">
        <div className="execucao-empty-state">
          <div className="execucao-empty-title">Algo deu errado ao abrir esta página</div>
          <div className="execucao-empty-text">
            Se o problema persistir, recarregue a página (pode haver uma versão nova do sistema).
          </div>
          <button
            type="button"
            className="execucao-btn execucao-btn-primary mt-4"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
