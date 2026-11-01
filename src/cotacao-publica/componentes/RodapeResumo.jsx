import { formatarBRL } from '../../features/compras/utils/cotacao/moeda.js';

// Rodapé fixo (Anexo B.1.3): total nominal das condições marcadas (nunca VP) e o botão principal.
const RodapeResumo = ({ totais, enviando, temResposta, erroEnvio, onEnviar, onNaoVouCotar = null, bloqueado = false }) => {
  if (bloqueado) return null;
  const { aVista, parcelado } = totais;
  const partes = [];
  if (aVista != null) partes.push(`À vista ${formatarBRL(aVista)}`);
  if (parcelado) {
    const p = parcelado.parcelas && parcelado.valorParcela > 0
      ? `${parcelado.parcelas}x ${formatarBRL(parcelado.valorParcela)}${parcelado.entrada > 0 ? ` + entrada ${formatarBRL(parcelado.entrada)}` : ''}`
      : formatarBRL(parcelado.total);
    partes.push(`Parcelado ${p}`);
  }

  return (
    <footer className="cp-rodape">
      <div className="cp-rodape-in">
        {erroEnvio && (
          <div className="cp-faixa cp-faixa-erro" role="alert">{erroEnvio}</div>
        )}
        <p className="cp-rodape-total">{partes.length ? partes.join(' · ') : 'Total: —'}{partes.length ? <span className="cp-dica"> (itens, sem frete)</span> : null}</p>
        <button type="button" className="cp-botao" aria-busy={enviando || undefined} disabled={enviando} onClick={onEnviar}>
          {enviando ? 'Enviando…' : erroEnvio ? 'Tentar novamente' : temResposta ? 'Enviar nova versão' : 'Enviar proposta'}
        </button>
        {onNaoVouCotar && (
          <button type="button" className="cp-botao-link" disabled={enviando} onClick={onNaoVouCotar}>Não vou cotar</button>
        )}
      </div>
    </footer>
  );
};

export default RodapeResumo;
