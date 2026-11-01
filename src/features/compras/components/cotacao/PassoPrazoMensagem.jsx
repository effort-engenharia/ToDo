import React, { useId } from 'react';
import { formatarPrazo, mensagemDoConvite } from '../../utils/cotacao/envio';

const CHIPS = [24, 48, 72];
const PLACEHOLDERS = ['{contato}', '{empresa_publica}', '{numero}', '{qtd_itens}', '{link}', '{prazo}'];

// Passo 4: prazo (chips 24/48/72 h ou data/hora) e mensagem. `prazo` = { modo: 24|48|72|'data', local: 'YYYY-MM-DDTHH:mm', iso }
export default function PassoPrazoMensagem({ prazo, onPrazo, mensagem, onMensagem, erroPrazo, config, cotacao, primeiroConvite, qtdItens, qtdFornecedores }) {
  const idBase = useId();
  const previa = mensagemDoConvite({
    tipo: 'padrao', config: { ...config, mensagem_padrao: mensagem }, cotacao: { ...cotacao, mensagem: null, prazo_resposta: prazo.iso },
    convite: primeiroConvite, link: 'https://…/cotacao/#••••', qtdItens
  });

  return (
    <div>
      <fieldset className="mb-4">
        <legend className="cmp-rotulo mb-1">Prazo para resposta</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Prazo para resposta">
          {[...CHIPS, 'data'].map((m) => (
            <button
              key={m} type="button" role="radio" aria-checked={prazo.modo === m}
              className={`cmp-opcao ${prazo.modo === m ? 'cmp-opcao-ativa' : ''}`}
              onClick={() => onPrazo(m)}
            >
              {m === 'data' ? 'Data e hora' : m === 48 ? '48 h (padrão)' : `${m} h`}
            </button>
          ))}
        </div>
        {prazo.modo === 'data' && (
          <div className="cmp-campo mt-2">
            <label htmlFor={`${idBase}-dt`}>Data e hora limite</label>
            <input id={`${idBase}-dt`} type="datetime-local" className="execucao-form-input" value={prazo.local} onChange={(e) => onPrazo('data', e.target.value)} aria-invalid={Boolean(erroPrazo) || undefined} />
          </div>
        )}
        <p className="text-sm text-slate-300 mt-2" aria-live="polite">Prazo: {prazo.iso ? formatarPrazo(prazo.iso) : '—'}</p>
        {erroPrazo && <p className="cmp-erro-campo" role="alert">{erroPrazo}</p>}
      </fieldset>

      <div className="cmp-campo mb-2">
        <label htmlFor={`${idBase}-msg`}>Mensagem do WhatsApp</label>
        <textarea id={`${idBase}-msg`} className="execucao-form-textarea" rows={5} maxLength={1000} value={mensagem} onChange={(e) => onMensagem(e.target.value)} aria-describedby={`${idBase}-ph`} />
        <p id={`${idBase}-ph`} className="cmp-texto-mudo">Variáveis: {PLACEHOLDERS.join(' ')}</p>
      </div>
      <p className="cmp-rotulo">Pré-visualização para {primeiroConvite?.fornecedor?.nome_contato || 'o primeiro fornecedor'}</p>
      <div className="cmp-sugestao whitespace-pre-wrap break-words text-sm text-slate-100" aria-label="Pré-visualização da mensagem">{previa}</div>

      <div className="cmp-aviso" role="note">
        Você vai abrir a cotação com {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} e {qtdFornecedores} {qtdFornecedores === 1 ? 'fornecedor' : 'fornecedores'}.
        Depois de enviar, as listas só podem ser alteradas com “Revisar cotação”.
      </div>
    </div>
  );
}
