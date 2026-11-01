import { formatarBRL } from '../../features/compras/utils/cotacao/moeda.js';
import CampoErro from './CampoErro.jsx';

const descreve = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// Condições de pagamento (Anexo B.1.3): pelo menos uma; campos dependentes só aparecem quando a condição está marcada.
const BlocoCondicoes = ({ valor, erros, onChange, baseItens = 0, somenteLeitura = false }) => {
  const { aVista, parcelado } = valor;
  const setAVista = (p) => onChange({ ...valor, aVista: { ...aVista, ...p } });
  const setParcelado = (p) => onChange({ ...valor, parcelado: { ...parcelado, ...p } });
  const campo = (id, extra = {}) => ({
    id, 'aria-invalid': erros[id] ? true : undefined, 'aria-describedby': descreve(erros[id] && `${id}-erro`), readOnly: somenteLeitura, ...extra
  });

  return (
    <section className="cp-cartao" aria-labelledby="cp-cond-titulo">
      <h2 id="cp-cond-titulo" className="cp-h2">Condições de pagamento</h2>
      <fieldset id="cp-cond-grupo" className="cp-fieldset" aria-describedby={erros['cp-cond-grupo'] ? 'cp-cond-grupo-erro' : undefined}>
        <legend className="cp-dica cp-legend">Informe pelo menos uma.</legend>
        <CampoErro id="cp-cond-grupo" mensagem={erros['cp-cond-grupo']} />

        <label className="cp-check">
          <input type="checkbox" checked={aVista.on} disabled={somenteLeitura} onChange={(e) => setAVista({ on: e.target.checked })} />
          <span>À vista</span>
        </label>
        {aVista.on && (
          <div className="cp-disclosure-corpo">
            <fieldset className="cp-fieldset">
              <legend className="cp-rotulo">Desconto (opcional)</legend>
              <div className="cp-linha">
                <label className="cp-radio">
                  <input type="radio" name="cp-desc-tipo" checked={aVista.tipo === 'percentual'} disabled={somenteLeitura} onChange={() => setAVista({ tipo: 'percentual' })} />
                  <span>%</span>
                </label>
                <label className="cp-radio">
                  <input type="radio" name="cp-desc-tipo" checked={aVista.tipo === 'valor'} disabled={somenteLeitura} onChange={() => setAVista({ tipo: 'valor' })} />
                  <span>R$</span>
                </label>
                <input
                  {...campo('cp-cond-a_vista-desconto_valor')} type="text" inputMode="decimal" autoComplete="off" className="cp-campo"
                  aria-label={`Desconto à vista em ${aVista.tipo === 'valor' ? 'reais' : 'percentual'}`}
                  placeholder="0,00" value={aVista.valor} onChange={(e) => setAVista({ valor: e.target.value })}
                />
              </div>
              <CampoErro id="cp-cond-a_vista-desconto_valor" mensagem={erros['cp-cond-a_vista-desconto_valor'] || erros['cp-cond-a_vista-desconto_tipo']} />
            </fieldset>
          </div>
        )}

        <label className="cp-check">
          <input type="checkbox" checked={parcelado.on} disabled={somenteLeitura} onChange={(e) => setParcelado({ on: e.target.checked })} />
          <span>Parcelado</span>
        </label>
        {parcelado.on && (
          <div className="cp-disclosure-corpo">
            <div className="cp-grade2">
              <div>
                <label className="cp-rotulo" htmlFor="cp-cond-parcelado-parcelas">Parcelas (1 a 24)</label>
                <input {...campo('cp-cond-parcelado-parcelas')} type="text" inputMode="numeric" autoComplete="off" className="cp-campo"
                  value={parcelado.parcelas} onChange={(e) => setParcelado({ parcelas: e.target.value })} />
                <CampoErro id="cp-cond-parcelado-parcelas" mensagem={erros['cp-cond-parcelado-parcelas']} />
              </div>
              <div>
                <label className="cp-rotulo" htmlFor="cp-cond-parcelado-entrada_valor">Entrada (R$, opcional)</label>
                <input {...campo('cp-cond-parcelado-entrada_valor')} type="text" inputMode="decimal" autoComplete="off" className="cp-campo"
                  value={parcelado.entrada} onChange={(e) => setParcelado({ entrada: e.target.value })} />
                <CampoErro id="cp-cond-parcelado-entrada_valor" mensagem={erros['cp-cond-parcelado-entrada_valor']} />
              </div>
            </div>
            <label className="cp-rotulo" htmlFor="cp-cond-parcelado-primeira_parcela_dias">1ª parcela em (dias)</label>
            <input {...campo('cp-cond-parcelado-primeira_parcela_dias')} type="text" inputMode="numeric" autoComplete="off" className="cp-campo"
              value={parcelado.dias} onChange={(e) => setParcelado({ dias: e.target.value })} />
            <CampoErro id="cp-cond-parcelado-primeira_parcela_dias" mensagem={erros['cp-cond-parcelado-primeira_parcela_dias']} />

            <label className="cp-rotulo" htmlFor="cp-cond-parcelado-total_informado">Total parcelado (R$)</label>
            <input {...campo('cp-cond-parcelado-total_informado', { 'aria-describedby': descreve(erros['cp-cond-parcelado-total_informado'] && 'cp-cond-parcelado-total_informado-erro', 'cp-total-dica') })}
              type="text" inputMode="decimal" autoComplete="off" className="cp-campo"
              placeholder={baseItens > 0 ? formatarBRL(baseItens).replace('R$ ', '') : '0,00'}
              value={parcelado.total} onChange={(e) => setParcelado({ total: e.target.value })} />
            <CampoErro id="cp-cond-parcelado-total_informado" mensagem={erros['cp-cond-parcelado-total_informado']} />
            <p id="cp-total-dica" className="cp-dica">Em branco, usamos a soma dos itens. Se houver juros, informe o total com juros.</p>
          </div>
        )}
      </fieldset>
    </section>
  );
};

export default BlocoCondicoes;
