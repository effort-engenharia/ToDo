import React, { useId, useMemo, useState } from 'react';
import Modal from '../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../execucao/components/ui/ExecucaoUI';
import { useDebouncedValue } from '../../execucao/hooks/useDebouncedValue';
import CampoQuantidade from '../../execucao/components/pedido-material/CampoQuantidade';
import { UNIDADES } from '../../execucao/components/pedido-material/utils';
import { execucaoComprasService } from '../../../services/supabase/execucaoCompras';
import { MAX_ALTERACOES, MAX_MOTIVO, MIN_MOTIVO, MOTIVOS_RAPIDOS, classificarAlteracao, classificarLote, resumoResultado } from '../utils/alteracoesLista';
import { itensPreenchidos } from '../utils/statusCompra';
import { prazoPadrao } from '../utils/cotacao/envio';
import SeletorPrazo from './cotacao/SeletorPrazo';

const qtdTxt = (q) => String(q ?? '').replace('.', ',');
const BTN = 'execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque';

function EtiquetaClasse({ r }) {
  if (!r || r.classe === 'invalida') return null;
  return r.classe === 'ciencia'
    ? <span className="cmp-selo bg-green-500/15 text-green-300 border border-green-500/40">✅ Ciência</span>
    : <span className="cmp-selo bg-purple-500/15 text-purple-300 border border-purple-500/40">❓ Pede aceite</span>;
}

function LinhaItem({ item, indice, estado, bloqueadoPorQuestionamento, onEstado }) {
  const idBase = useId();
  const modo = estado?.modo ?? null;
  const alteracao = montarAlteracao(item, estado);
  const r = alteracao ? classificarAlteracao(item, alteracao) : null;
  const removido = modo === 'remover';
  const definir = (m) => onEstado(item.id, m === modo ? null : { ...(estado ?? {}), modo: m, nome: m === 'substituir' ? '' : item.nome, unidade: item.unidade, quantidade: item.quantidade });

  return (
    <li className={`cmp-bloco !mb-0${removido ? ' opacity-80' : ''}`}>
      <p className="text-sm text-slate-100 break-words">
        <span className="text-slate-400">{indice + 1}</span>{' '}
        <strong className={removido ? 'line-through' : ''}>{item.nome}</strong> — {qtdTxt(item.quantidade)} {item.unidade}
        {removido && <span className="cmp-selo ml-2 bg-red-500/15 text-red-300 border border-red-500/40">Será removido</span>}
      </p>
      {bloqueadoPorQuestionamento ? (
        <p className="cmp-texto-mudo mt-1">Este item tem um questionamento aberto: resolva-o antes de alterar.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="w-40">
              <CampoQuantidade
                id={`${idBase}-q`} ariaLabel={`Quantidade de ${item.nome}`} unidade={item.unidade}
                value={modo === 'quantidade' || modo === 'substituir' ? estado.quantidade : Number(String(item.quantidade).replace(',', '.')) || null}
                onChange={(n) => (n === Number(String(item.quantidade).replace(',', '.')) && modo === 'quantidade'
                  ? onEstado(item.id, null)
                  : onEstado(item.id, modo === 'substituir' ? { ...estado, quantidade: n } : { modo: 'quantidade', quantidade: n }))}
              />
            </div>
            <button type="button" className={BTN} aria-pressed={modo === 'corrigir'} onClick={() => definir('corrigir')}>Corrigir nome/un.</button>
            <button type="button" className={BTN} aria-pressed={modo === 'substituir'} onClick={() => definir('substituir')}>Substituir por…</button>
            <button type="button" className={BTN} aria-pressed={removido} onClick={() => definir('remover')}>Remover</button>
          </div>
          {(modo === 'corrigir' || modo === 'substituir') && (
            <div className="cmp-grade-campos mt-2">
              <div className="cmp-campo">
                <label htmlFor={`${idBase}-n`}>{modo === 'corrigir' ? 'Nome corrigido' : 'Item substituto'}</label>
                <input id={`${idBase}-n`} className="execucao-form-input" maxLength={200} value={estado.nome ?? ''} onChange={(e) => onEstado(item.id, { ...estado, nome: e.target.value })} />
              </div>
              <div className="cmp-campo">
                <label htmlFor={`${idBase}-u`}>Unidade</label>
                <select id={`${idBase}-u`} className="execucao-form-select" value={estado.unidade ?? ''} onChange={(e) => onEstado(item.id, { ...estado, unidade: e.target.value })}>
                  {[...new Set([item.unidade, ...UNIDADES.map((u) => u.valor)])].filter(Boolean).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}
      {r?.classe === 'invalida' && modo && (
        <div className="cmp-erro-campo" role="alert">
          {r.motivo}
          {r.sugerirSubstituir && (
            <> {' '}Trocar por outro material?{' '}
              <button type="button" className="cmp-link" onClick={() => onEstado(item.id, { ...estado, modo: 'substituir' })}>Use Substituir por…</button>
            </>
          )}
        </div>
      )}
      {r && r.classe !== 'invalida' && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <EtiquetaClasse r={r} /> {r.classe === 'aceite' && r.tipo === 'quantidade' ? 'Aumento de quantidade: pede aceite do solicitante' : r.resumo}
        </p>
      )}
    </li>
  );
}

// Estado do item → alteração do contrato (execucaoComprasService.alterarItens)
function montarAlteracao(item, estado) {
  if (!estado?.modo) return null;
  const base = { acao: estado.modo, itemId: item.id };
  if (estado.modo === 'quantidade') return { ...base, quantidade: estado.quantidade };
  if (estado.modo === 'remover') return base;
  if (estado.modo === 'corrigir') return { ...base, nome: estado.nome, unidade: estado.unidade };
  return { ...base, nome: estado.nome, unidade: estado.unidade, quantidade: estado.quantidade };
}

/**
 * Alterar itens (plano §11, B.8). A pré-visualização usa `classificarAlteracao` (mesma regra do servidor).
 * `cotacao`: { id, numero, enviados } quando o pedido está em cotação já enviada (exige novo prazo e revisão).
 */
export default function ModalAlterarItens({ pedido, questionamentosAbertos = [], cotacao = null, onClose, onAplicado }) {
  const { toast } = useExecucaoUI();
  const itens = useMemo(() => itensPreenchidos(pedido?.itens).filter((i) => i.id), [pedido?.itens]);
  const idsBloqueados = useMemo(() => new Set(questionamentosAbertos.filter((q) => q.status === 'aberto' && q.item_id).map((q) => q.item_id)), [questionamentosAbertos]);
  const [estados, setEstados] = useState({}); // itemId → { modo, ... }
  const [adicoes, setAdicoes] = useState([]); // { chave, nome, quantidade, unidade }
  const [chip, setChip] = useState('');
  const [texto, setTexto] = useState('');
  const [prazo, setPrazo] = useState(() => prazoPadrao(48));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const idBase = useId();

  const enviada = Boolean(cotacao);
  const motivo = chip === 'outro' || !chip ? texto.trim() : (texto.trim() ? `${chip}: ${texto.trim()}` : chip);

  const alteracoes = useMemo(() => [
    ...itens.map((i) => montarAlteracao(i, estados[i.id])).filter(Boolean),
    ...adicoes.map((a) => ({ acao: 'adicionar', nome: a.nome, quantidade: a.quantidade, unidade: a.unidade })),
  ], [itens, estados, adicoes]);
  const alteracoesDeb = useDebouncedValue(alteracoes, 500);
  const lote = useMemo(() => classificarLote(itens, alteracoes), [itens, alteracoes]);
  const loteDeb = useMemo(() => classificarLote(itens, alteracoesDeb), [itens, alteracoesDeb]);

  const definirEstado = (itemId, novo) => setEstados((e) => { const n = { ...e }; if (novo) n[itemId] = novo; else delete n[itemId]; return n; });

  const motivoBloqueio = alteracoes.length === 0 ? 'Faça ao menos uma alteração.'
    : alteracoes.length > MAX_ALTERACOES ? `No máximo ${MAX_ALTERACOES} alterações por vez.`
      : lote.invalidas.length > 0 ? 'Corrija as alterações marcadas com erro.'
        : lote.ficaVazia ? 'Isto deixa o pedido sem itens: para descartá-lo, cancele o pedido.'
          : motivo.length < MIN_MOTIVO ? `Informe o motivo (mínimo de ${MIN_MOTIVO} caracteres).`
            : enviada && (!prazo.iso || new Date(prazo.iso).getTime() <= Date.now()) ? 'Escolha o novo prazo da cotação (horário futuro).' : '';

  const rotuloAplicar = enviada ? 'Aplicar e revisar cotação' : lote.soAceites ? 'Enviar para aceite do solicitante' : 'Aplicar alterações';

  const aplicar = async () => {
    if (motivoBloqueio) return;
    setErro('');
    setOcupado(true);
    const r = await execucaoComprasService.alterarItens(pedido.id, alteracoes, motivo.slice(0, MAX_MOTIVO), enviada ? { novoPrazo: prazo.iso } : null);
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível aplicar as alterações.'); return; }
    toast.success(resumoResultado(r.data, pedido.solicitante_nome));
    onAplicado?.(r.data);
  };

  const novaAdicao = () => setAdicoes((a) => [...a, { chave: `${Date.now()}-${a.length}`, nome: '', quantidade: null, unidade: 'un' }]);
  const editarAdicao = (chave, parcial) => setAdicoes((a) => a.map((x) => (x.chave === chave ? { ...x, ...parcial } : x)));

  return (
    <Modal tamanho="lg" variante="cheia" cabecalho={`Alterar itens · ${pedido.cliente_nome || pedido.descricao || 'Pedido'}`} onClose={ocupado ? () => {} : onClose}>
      {enviada && (
        <div className="cmp-aviso" role="note">
          Este pedido está na cotação nº {cotacao.numero}, já enviada a {cotacao.enviados} {cotacao.enviados === 1 ? 'fornecedor' : 'fornecedores'}. Ao aplicar, a cotação será revisada.
        </div>
      )}
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}

      {itens.length === 0 ? <p className="text-slate-300">Este pedido não tem itens com identificação para alterar.</p> : (
        <ul className="cmp-lista-limpa">
          {itens.map((it, i) => (
            <LinhaItem key={it.id} item={it} indice={i} estado={estados[it.id]} bloqueadoPorQuestionamento={idsBloqueados.has(it.id)} onEstado={definirEstado} />
          ))}
        </ul>
      )}

      <div className="mt-3">
        {adicoes.map((a) => (
          <div key={a.chave} className="cmp-bloco">
            <div className="cmp-grade-campos">
              <div className="cmp-campo">
                <label htmlFor={`${idBase}-an-${a.chave}`}>Item a adicionar</label>
                <input id={`${idBase}-an-${a.chave}`} className="execucao-form-input" maxLength={200} value={a.nome} onChange={(e) => editarAdicao(a.chave, { nome: e.target.value })} />
              </div>
              <div className="flex gap-2 items-end">
                <div className="cmp-campo flex-1"><span className="cmp-rotulo">Quantidade</span>
                  <CampoQuantidade ariaLabel="Quantidade do item a adicionar" unidade={a.unidade} value={a.quantidade} onChange={(n) => editarAdicao(a.chave, { quantidade: n })} />
                </div>
                <div className="cmp-campo"><label htmlFor={`${idBase}-au-${a.chave}`}>Un.</label>
                  <select id={`${idBase}-au-${a.chave}`} className="execucao-form-select" value={a.unidade} onChange={(e) => editarAdicao(a.chave, { unidade: e.target.value })}>
                    {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
                  </select>
                </div>
                <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-icone" aria-label="Remover item adicionado" onClick={() => setAdicoes((x) => x.filter((y) => y.chave !== a.chave))}>✕</button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className={BTN} onClick={novaAdicao}>＋ Adicionar item</button>
      </div>

      <fieldset className="mt-4">
        <legend className="cmp-rotulo mb-1">Motivo *</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo da alteração">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={chip === m} className={`cmp-opcao ${chip === m ? 'cmp-opcao-ativa' : ''}`} onClick={() => setChip(m)}>{m}</button>
          ))}
        </div>
        <div className="cmp-campo mt-2">
          <label htmlFor={`${idBase}-mot`}>{chip === 'outro' || !chip ? 'Descreva o motivo' : 'Detalhe (opcional)'}</label>
          <textarea id={`${idBase}-mot`} className="execucao-form-textarea" rows={2} maxLength={MAX_MOTIVO} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <span className="cmp-texto-mudo">O solicitante verá este motivo.</span>
        </div>
      </fieldset>

      {enviada && <div className="mt-3"><SeletorPrazo valor={prazo} onChange={setPrazo} rotulo="Novo prazo da cotação" /></div>}

      <section className="cmp-bloco mt-4" aria-label="Pré-visualização" aria-live="polite">
        <h3>Pré-visualização</h3>
        {loteDeb.ciencia.length === 0 && loteDeb.aceite.length === 0 ? <p className="cmp-texto-mudo">Nenhuma alteração válida ainda.</p> : (
          <>
            {loteDeb.ciencia.length > 0 && (
              <div><p className="text-sm text-green-300 font-semibold">✅ Aplicado agora (ciência do solicitante)</p>
                <ul className="list-disc pl-5 text-sm text-slate-200">{loteDeb.ciencia.map((c, i) => <li key={i}>{c.resumo}</li>)}</ul></div>
            )}
            {loteDeb.aceite.length > 0 && (
              <div className="mt-2"><p className="text-sm text-purple-300 font-semibold">❓ Aguardará aceite do solicitante</p>
                <ul className="list-disc pl-5 text-sm text-slate-200">{loteDeb.aceite.map((c, i) => <li key={i}>{c.resumo}</li>)}</ul></div>
            )}
          </>
        )}
      </section>

      {motivoBloqueio && <p id={`${idBase}-bl`} className="cmp-texto-mudo" aria-live="polite">{motivoBloqueio}</p>}
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Cancelar</button>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={aplicar} disabled={ocupado || Boolean(motivoBloqueio)} aria-busy={ocupado || undefined} aria-describedby={motivoBloqueio ? `${idBase}-bl` : undefined}>
          {ocupado ? 'Aplicando…' : rotuloAplicar}
        </button>
      </div>
    </Modal>
  );
}
