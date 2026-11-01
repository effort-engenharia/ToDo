import React, { useId, useMemo, useState } from 'react';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';
import { useExecucaoUI } from '../../execucao/components/ui/ExecucaoUI';
import Modal from '../../execucao/components/ui/Modal';
import CampoQuantidade from '../../execucao/components/pedido-material/CampoQuantidade';
import { UNIDADES, normalizarQuantidade, quantidadeValida } from '../../execucao/components/pedido-material/utils';
import { TIPOS_QUESTIONAMENTO, itensPreenchidos, montarPrevia, rotuloItem } from '../utils/statusCompra';
import '../styles/compras.css';

const MAX_PERGUNTA = 500;
const MIN_PERGUNTA = 5;
const SEM_ITEM = '';

/**
 * Modal do comprador para questionar um item (ou o pedido) — Anexo D.4. Desktop: Modal md; mobile: tela cheia.
 * Enviar muda o pedido para "Aguardando solicitante" no banco (RPC compras_abrir_questionamento).
 */
export default function ModalQuestionamento({ pedido, itemInicialId = null, questionamentosAbertos = [], onClose, onEnviado, onVerConversa }) {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const itens = useMemo(() => itensPreenchidos(pedido.itens), [pedido.itens]);
  const semItens = itens.length === 0;

  const [tipo, setTipo] = useState('duvida');
  const [itemId, setItemId] = useState(itemInicialId ?? (itens.length === 1 ? itens[0].id ?? SEM_ITEM : SEM_ITEM));
  const [pergunta, setPergunta] = useState('');
  const [sugNome, setSugNome] = useState('');
  const [sugQtd, setSugQtd] = useState(null);
  const [sugUnidade, setSugUnidade] = useState(null); // null = a do item
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  const item = itens.find((i) => i.id && i.id === itemId) ?? null;
  const unidade = sugUnidade ?? item?.unidade ?? 'un';
  const exigeItem = tipo !== 'duvida';
  const abertoNoItem = itemId ? questionamentosAbertos.find((q) => q.item_id === itemId && q.status === 'aberto') : null;

  const erros = {};
  if (exigeItem && !item) erros.item = 'Escolha o item questionado.';
  if (pergunta.trim().length < MIN_PERGUNTA) erros.pergunta = `Explique o motivo (mínimo de ${MIN_PERGUNTA} caracteres).`;
  if (tipo === 'substituicao' && !sugNome.trim()) erros.sugNome = 'Informe o nome do item sugerido.';
  if (tipo === 'quantidade' && !quantidadeValida(sugQtd)) erros.sugQtd = 'Informe a quantidade sugerida (maior que zero).';

  const sugestao = (() => {
    if (tipo === 'substituicao') {
      const s = { nome: sugNome.trim() };
      if (quantidadeValida(sugQtd)) { s.quantidade = sugQtd; s.unidade = unidade; }
      return s;
    }
    if (tipo === 'quantidade' && quantidadeValida(sugQtd)) return { quantidade: sugQtd, unidade };
    return null;
  })();
  const previa = exigeItem && item ? montarPrevia(item, sugestao) : null;

  const trocarTipo = (novo) => {
    setTipo(novo);
    setSugNome('');
    setSugQtd(null);
    setSugUnidade(null);
  };

  const enviar = async (e) => {
    e?.preventDefault();
    setTentou(true);
    setErroEnvio('');
    if (Object.keys(erros).length > 0 || abertoNoItem) return;
    setEnviando(true);
    const r = await execucaoComprasService.abrirQuestionamento(pedido.id, {
      itemId: item?.id ?? null,
      tipo,
      pergunta: pergunta.trim(),
      sugestao,
    });
    setEnviando(false);
    if (!r.success) {
      setErroEnvio(r.message || 'Não foi possível enviar o questionamento.');
      return;
    }
    toast.success(`Questionamento enviado${pedido.solicitante_nome ? ` a ${pedido.solicitante_nome}` : ''}. O pedido aguarda o solicitante.`);
    onEnviado?.(r.data);
  };

  const erroDe = (campo) => (tentou ? erros[campo] : null);
  const idErro = (campo) => `${idBase}-erro-${campo}`;

  return (
    <Modal tamanho="md" variante="cheia" onClose={enviando ? () => {} : onClose} cabecalho={<>❓ Questionar item</>}>
      <form onSubmit={enviar} noValidate>
        <p className="text-sm text-slate-300 mb-4">
          <strong>Pedido:</strong> {pedido.descricao || 'Pedido de material'}{pedido.cliente_nome ? ` — ${pedido.cliente_nome}` : ''}
        </p>

        <div className="mb-4">
          <label className="execucao-form-label" htmlFor={`${idBase}-item`}>
            Item {exigeItem ? '*' : '(opcional)'}
          </label>
          <select
            id={`${idBase}-item`}
            className="execucao-form-select"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            aria-invalid={Boolean(erroDe('item')) || undefined}
            aria-describedby={erroDe('item') ? idErro('item') : undefined}
            disabled={semItens}
          >
            <option value={SEM_ITEM}>{semItens ? 'Pedido sem lista de itens' : exigeItem ? 'Selecione o item…' : 'Pedido inteiro'}</option>
            {itens.filter((i) => i.id).map((i) => (
              <option key={i.id} value={i.id}>{rotuloItem(i)}</option>
            ))}
          </select>
          {erroDe('item') && <p id={idErro('item')} className="cmp-erro-campo" role="alert">{erroDe('item')}</p>}
        </div>

        {abertoNoItem && (
          <div className="cmp-aviso" role="alert">
            Este item já tem um questionamento aberto.{' '}
            {onVerConversa && (
              <button type="button" className="underline font-semibold" onClick={onVerConversa}>Ver conversa</button>
            )}
          </div>
        )}

        <fieldset className="mb-4">
          <legend className="execucao-form-label">Tipo *</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de questionamento">
            {Object.entries(TIPOS_QUESTIONAMENTO).map(([valor, t]) => {
              const desabilitado = semItens && valor !== 'duvida';
              return (
                <label key={valor} className={`cmp-opcao${tipo === valor ? ' cmp-opcao-ativa' : ''}${desabilitado ? ' opacity-50' : ''}`}>
                  <input
                    type="radio"
                    name={`${idBase}-tipo`}
                    value={valor}
                    checked={tipo === valor}
                    disabled={desabilitado}
                    onChange={() => trocarTipo(valor)}
                  />
                  <span>{t.emoji} {t.rotulo}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mb-4">
          <label className="execucao-form-label" htmlFor={`${idBase}-pergunta`}>Pergunta ou motivo *</label>
          <textarea
            id={`${idBase}-pergunta`}
            className="execucao-form-textarea"
            rows={3}
            maxLength={MAX_PERGUNTA}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: Sem estoque na curva B. Pode ser a curva C?"
            aria-required="true"
            aria-invalid={Boolean(erroDe('pergunta')) || undefined}
            aria-describedby={erroDe('pergunta') ? idErro('pergunta') : `${idBase}-contador`}
          />
          <div className="flex justify-between gap-2">
            {erroDe('pergunta')
              ? <p id={idErro('pergunta')} className="cmp-erro-campo" role="alert">{erroDe('pergunta')}</p>
              : <span />}
            <span id={`${idBase}-contador`} className="text-xs text-slate-400">{pergunta.length}/{MAX_PERGUNTA}</span>
          </div>
        </div>

        {tipo !== 'duvida' && (
          <fieldset className="mb-4 cmp-sugestao">
            <legend className="execucao-form-label">Sugestão {tipo === 'quantidade' ? '*' : '(opcional)'}</legend>

            {tipo === 'substituicao' && (
              <div className="mb-3">
                <label className="text-xs text-slate-400" htmlFor={`${idBase}-sug-nome`}>Nome do item sugerido *</label>
                <input
                  id={`${idBase}-sug-nome`}
                  type="text"
                  className="execucao-form-input"
                  value={sugNome}
                  maxLength={120}
                  onChange={(e) => setSugNome(e.target.value)}
                  placeholder="Ex.: Disjuntor 63A curva C"
                  aria-required="true"
                  aria-invalid={Boolean(erroDe('sugNome')) || undefined}
                  aria-describedby={erroDe('sugNome') ? idErro('sugNome') : undefined}
                />
                {erroDe('sugNome') && <p id={idErro('sugNome')} className="cmp-erro-campo" role="alert">{erroDe('sugNome')}</p>}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="text-xs text-slate-400" htmlFor={`${idBase}-sug-qtd`}>
                  Quantidade {tipo === 'quantidade' ? '*' : '(opcional)'}
                </label>
                <CampoQuantidade
                  key={`${itemId}-${tipo}-${unidade}`}
                  id={`${idBase}-sug-qtd`}
                  value={sugQtd}
                  unidade={unidade}
                  onChange={setSugQtd}
                  invalido={Boolean(erroDe('sugQtd'))}
                  ariaLabel="Quantidade sugerida"
                  descricaoId={erroDe('sugQtd') ? idErro('sugQtd') : undefined}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400" htmlFor={`${idBase}-sug-un`}>Unidade</label>
                <select
                  id={`${idBase}-sug-un`}
                  className="execucao-form-select"
                  value={unidade}
                  onChange={(e) => {
                    setSugUnidade(e.target.value);
                    setSugQtd((q) => normalizarQuantidade(q, e.target.value));
                  }}
                >
                  {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
                </select>
              </div>
            </div>
            {erroDe('sugQtd') && <p id={idErro('sugQtd')} className="cmp-erro-campo" role="alert">{erroDe('sugQtd')}</p>}

            {previa && sugestao && (
              <p className="text-sm text-slate-300 mt-3" aria-live="polite">
                <span className="text-slate-400">Prévia:</span> {previa.de} → <strong>{previa.para}</strong>
              </p>
            )}
            {tipo === 'quantidade' && item && sugQtd !== null && (
              <p className="sr-only">Quantidade sugerida {sugQtd} {unidade}</p>
            )}
          </fieldset>
        )}

        <p className="text-xs text-slate-400 mb-4">
          ℹ️ O pedido ficará “Aguardando solicitante” até a resposta
          {pedido.solicitante_nome ? `. ${pedido.solicitante_nome} será notificado(a).` : '.'}
        </p>

        {erroEnvio && (
          <div className="cmp-erro-envio" role="alert">
            <span>{erroEnvio}</span>
            <button type="submit" className="underline font-semibold" disabled={enviando}>Tentar novamente</button>
          </div>
        )}

        <div className="execucao-modal-footer !px-0 !pb-0">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="submit"
            className="execucao-btn execucao-btn-primary cmp-btn-toque"
            disabled={enviando || Boolean(abertoNoItem)}
            aria-busy={enviando}
          >
            {enviando ? 'Enviando…' : '❓ Enviar questionamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
