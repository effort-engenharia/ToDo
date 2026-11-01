import CampoErro from './CampoErro.jsx';

const descreve = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// Entrega (Anexo B.1.3): prazo em dias e frete obrigatórios; região só leitura; observação geral.
const BlocoEntrega = ({ valor, erros, onChange, regiao = null, somenteLeitura = false }) => {
  const setFrete = (p) => onChange({ ...valor, frete: { ...valor.frete, ...p } });
  return (
    <>
      <section className="cp-cartao" aria-labelledby="cp-entrega-titulo">
        <h2 id="cp-entrega-titulo" className="cp-h2">Entrega</h2>
        <label className="cp-rotulo" htmlFor="cp-prazo">Prazo de entrega (dias) *</label>
        <input
          id="cp-prazo" type="text" inputMode="numeric" autoComplete="off" className="cp-campo" value={valor.prazo} readOnly={somenteLeitura}
          aria-required="true" aria-invalid={erros['cp-prazo'] ? true : undefined} aria-describedby={descreve(erros['cp-prazo'] && 'cp-prazo-erro')}
          onChange={(e) => onChange({ ...valor, prazo: e.target.value })}
        />
        <CampoErro id="cp-prazo" mensagem={erros['cp-prazo']} />

        <fieldset className="cp-fieldset" aria-describedby={descreve(erros['cp-frete-tipo'] && 'cp-frete-tipo-erro')}>
          <legend className="cp-rotulo">Frete *</legend>
          <div className="cp-linha">
            <label className="cp-radio">
              <input id="cp-frete-tipo" type="radio" name="cp-frete" checked={valor.frete.tipo === 'cif'} disabled={somenteLeitura} onChange={() => setFrete({ tipo: 'cif' })} />
              <span>Incluso (CIF)</span>
            </label>
            <label className="cp-radio">
              <input type="radio" name="cp-frete" checked={valor.frete.tipo === 'valor'} disabled={somenteLeitura} onChange={() => setFrete({ tipo: 'valor' })} />
              <span>Valor R$</span>
            </label>
            {valor.frete.tipo === 'valor' && (
              <input
                id="cp-frete-valor" type="text" inputMode="decimal" autoComplete="off" className="cp-campo" aria-label="Valor do frete em reais"
                placeholder="0,00" value={valor.frete.valor} readOnly={somenteLeitura}
                aria-invalid={erros['cp-frete-valor'] ? true : undefined} aria-describedby={descreve(erros['cp-frete-valor'] && 'cp-frete-valor-erro')}
                onChange={(e) => setFrete({ valor: e.target.value })}
              />
            )}
          </div>
          <CampoErro id="cp-frete-tipo" mensagem={erros['cp-frete-tipo']} />
          <CampoErro id="cp-frete-valor" mensagem={erros['cp-frete-valor']} />
        </fieldset>
        {regiao && <p className="cp-dica">Região de entrega: {regiao}</p>}
      </section>

      <section className="cp-cartao" aria-labelledby="cp-obs-titulo">
        <h2 id="cp-obs-titulo" className="cp-h2">Observações gerais <span className="cp-dica">(opcional)</span></h2>
        <label className="cp-rotulo cp-sr" htmlFor="cp-obs">Observações gerais</label>
        <textarea
          id="cp-obs" className="cp-campo cp-textarea" rows={3} maxLength={1000} value={valor.obs} readOnly={somenteLeitura}
          aria-invalid={erros['cp-obs'] ? true : undefined} aria-describedby={descreve(erros['cp-obs'] && 'cp-obs-erro', 'cp-obs-contador')}
          onChange={(e) => onChange({ ...valor, obs: e.target.value })}
        />
        <p id="cp-obs-contador" className="cp-dica">{valor.obs.length}/1000</p>
        <CampoErro id="cp-obs" mensagem={erros['cp-obs']} />
      </section>
    </>
  );
};

export default BlocoEntrega;
