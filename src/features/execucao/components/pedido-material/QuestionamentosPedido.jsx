import React, { useId, useMemo, useState } from 'react';
import { execucaoComprasService } from '../../../../services/supabase/execucaoCompras';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import { ErroCarregamento } from '../ui/Estados';
import '../../../compras/styles/compras.css';
import {
  TIPOS_QUESTIONAMENTO,
  formatarDataHora,
  montarPrevia,
  rotuloEstadoQuestionamento,
  rotuloItem,
  tempoRelativo,
} from '../../../compras/utils/statusCompra';

const MAX_OBS = 500;
const MIN_OBS = 3;

const ordenar = (lista) =>
  [...lista].sort((a, b) => {
    if ((a.status === 'aberto') !== (b.status === 'aberto')) return a.status === 'aberto' ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

const Esqueleto = () => (
  <div className="space-y-3" aria-busy="true" role="status" aria-label="Carregando questionamentos">
    {[0, 1].map((i) => <div key={i} className="cmp-skeleton h-28 w-full rounded-xl" />)}
  </div>
);

function Tempo({ valor }) {
  if (!valor) return null;
  return <time dateTime={new Date(valor).toISOString()} title={formatarDataHora(valor)}>{tempoRelativo(valor)}</time>;
}

function CartaoQuestionamento({ q, podeResponder, podeCancelar, nomeSolicitante, onRespondido, onCancelado, onConflito, anunciar }) {
  const { toast, confirmar } = useExecucaoUI();
  const idBase = useId();
  const [modo, setModo] = useState(null); // 'aprovar' | 'reprovar' | 'responder'
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const tipo = TIPOS_QUESTIONAMENTO[q.tipo] ?? { rotulo: q.tipo, emoji: '' };
  const estado = rotuloEstadoQuestionamento(q);
  const aberto = q.status === 'aberto';
  const sugestao = q.sugestao && Object.keys(q.sugestao).length > 0 ? q.sugestao : null;
  const previa = montarPrevia(q.item_snapshot, sugestao);
  const obsObrigatoria = modo === 'reprovar' || modo === 'responder';
  const obsInvalida = obsObrigatoria && obs.trim().length < MIN_OBS;

  const fecharPainel = () => { setModo(null); setObs(''); setErro(''); };

  const enviar = async (e) => {
    e.preventDefault();
    if (obsInvalida) { setErro(`Escreva uma observação (mínimo de ${MIN_OBS} caracteres).`); return; }
    setEnviando(true);
    setErro('');
    const r = await execucaoComprasService.responderQuestionamento(q.id, modo !== 'reprovar', obs.trim() || null);
    setEnviando(false);
    if (!r.success) {
      // Já respondido/cancelado por outra pessoa: avisa e recarrega a conversa
      if (/respondid|cancelad|encerrad|não está aberto|nao esta aberto/i.test(r.message || '')) {
        setErro('Este questionamento já foi respondido ou cancelado. Atualizando a conversa…');
        onConflito?.();
      } else {
        setErro(r.message || 'Não foi possível enviar a resposta.');
      }
      return;
    }
    const alterou = r.data?.item_alterado;
    const texto = modo === 'reprovar'
      ? 'Questionamento reprovado.'
      : alterou ? 'Questionamento aprovado. Item atualizado.' : 'Questionamento respondido.';
    toast.success(texto);
    anunciar?.(texto, q.id);
    fecharPainel();
    onRespondido?.(r.data, q);
  };

  const cancelar = async () => {
    const ok = await confirmar({
      titulo: 'Cancelar questionamento',
      mensagem: 'O questionamento será cancelado e o pedido volta ao status anterior (se não houver outros abertos).',
      confirmarTexto: 'Cancelar questionamento',
    });
    if (!ok) return;
    setEnviando(true);
    const r = await execucaoComprasService.cancelarQuestionamento(q.id);
    setEnviando(false);
    if (!r.success) { setErro(r.message || 'Não foi possível cancelar.'); return; }
    toast.success('Questionamento cancelado.');
    onCancelado?.(q);
  };

  const tituloPainel = { aprovar: 'Aprovar sugestão', reprovar: 'Reprovar sugestão', responder: 'Responder dúvida' }[modo];

  return (
    <article
      id={`quest-${q.id}`}
      tabIndex={-1}
      className={`cmp-quest${aberto ? ' cmp-quest-aberto' : ''}`}
      aria-label={`Questionamento ${tipo.rotulo}, ${estado.rotulo}`}
    >
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-sm text-slate-200">
          <strong>{tipo.emoji} {tipo.rotulo}</strong>
          <span className="text-slate-400"> · {q.criador_nome || 'Compras'} (Compras) · <Tempo valor={q.created_at} /></span>
        </p>
        <span className="flex flex-wrap gap-1">
          {q.origem === 'alteracao_compras' && (
            <span className="cmp-selo bg-amber-500/15 text-amber-300 border border-amber-500/40">✏️ Alteração da Compras</span>
          )}
          <span className={`cmp-selo ${estado.classe}`}>{estado.emoji} {estado.rotulo}</span>
        </span>
      </header>

      {q.item_snapshot?.nome && (
        <p className="text-sm text-slate-300 mt-2"><span className="text-slate-400">Item:</span> {rotuloItem(q.item_snapshot)}</p>
      )}
      <p className="text-sm text-slate-100 mt-2 whitespace-pre-wrap break-words">“{q.pergunta}”</p>
      {q.motivo_alteracao && (
        <p className="text-sm text-slate-300 mt-1 break-words"><span className="text-slate-400">Motivo:</span> {q.motivo_alteracao}</p>
      )}
      {aberto && q.origem === 'alteracao_compras' && q.prazo_resposta_em && (
        <p className={`text-xs mt-1 ${new Date(q.prazo_resposta_em) < new Date() ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
          {new Date(q.prazo_resposta_em) < new Date() ? '⏳ Aguardando sua resposta além do prazo (' : 'Responder até '}
          {formatarDataHora(q.prazo_resposta_em)}{new Date(q.prazo_resposta_em) < new Date() ? ')' : ''}
        </p>
      )}

      {q.tipo === 'adicao' && sugestao ? (
        <p className="text-sm text-slate-300 mt-2">
          <span className="text-slate-400">➕ Adição de item:</span> <strong>{sugestao.nome}, {String(sugestao.quantidade ?? '').replace('.', ',')} {sugestao.unidade}</strong>
        </p>
      ) : previa && (
        <p className="text-sm text-slate-300 mt-2">
          <span className="text-slate-400">Sugestão:</span>{' '}
          {previa.de ? <>{previa.de} <span aria-label="para">→</span> </> : null}
          <strong>{previa.para}</strong>
        </p>
      )}

      {!aberto && (q.resposta_observacao || q.respondedor_nome) && q.status !== 'cancelado' && (
        <p className="text-sm text-slate-300 mt-3 pt-2 border-t border-slate-700">
          {estado.emoji} {estado.rotulo} por {q.respondedor_nome || 'solicitante'}
          {' · '}<Tempo valor={q.respondido_em} />
          {q.resposta_observacao && <> · “{q.resposta_observacao}”</>}
        </p>
      )}
      {q.status === 'cancelado' && (
        <p className="text-xs text-slate-400 mt-2">Cancelado{q.resposta_observacao ? `: ${q.resposta_observacao}` : '.'}</p>
      )}

      {aberto && !modo && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {podeResponder ? (
            q.tipo === 'duvida' ? (
              <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm cmp-btn-toque" onClick={() => setModo('responder')} disabled={enviando}>
                💬 Responder
              </button>
            ) : (
              <>
                <button type="button" className="execucao-btn execucao-btn-success execucao-btn-sm cmp-btn-toque" onClick={() => setModo('aprovar')} disabled={enviando}>
                  ✅ Aprovar sugestão
                </button>
                <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm cmp-btn-toque" onClick={() => setModo('reprovar')} disabled={enviando}>
                  ❌ Reprovar
                </button>
              </>
            )
          ) : (
            <p className="text-xs text-purple-300">Aguardando resposta de {nomeSolicitante || 'solicitante'}</p>
          )}
          {podeCancelar && (
            <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={cancelar} disabled={enviando}>
              Cancelar questionamento
            </button>
          )}
        </div>
      )}

      {aberto && modo && (
        <form onSubmit={enviar} className="mt-3 cmp-painel-resposta" noValidate>
          <p className="text-sm font-semibold text-slate-100 mb-1">{tituloPainel}</p>
          {modo === 'aprovar' && previa && (
            <p className="text-sm text-slate-300 mb-2">Será aplicado: <strong>{previa.para}</strong></p>
          )}
          <label className="text-xs text-slate-400" htmlFor={`${idBase}-obs`}>
            Observação {obsObrigatoria ? '*' : '(opcional)'}
          </label>
          <textarea
            id={`${idBase}-obs`}
            className="execucao-form-textarea"
            rows={2}
            maxLength={MAX_OBS}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            aria-required={obsObrigatoria || undefined}
            aria-invalid={Boolean(erro && obsInvalida) || undefined}
            autoFocus
          />
          <div className="flex flex-wrap gap-2 mt-2 justify-end">
            <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={fecharPainel} disabled={enviando}>
              Voltar
            </button>
            <button
              type="submit"
              className={`execucao-btn execucao-btn-sm cmp-btn-toque ${modo === 'reprovar' ? 'execucao-btn-danger' : 'execucao-btn-success'}`}
              disabled={enviando}
              aria-busy={enviando}
            >
              {enviando ? 'Enviando…' : modo === 'reprovar' ? 'Confirmar reprovação' : modo === 'aprovar' ? 'Confirmar aprovação' : 'Enviar resposta'}
            </button>
          </div>
        </form>
      )}

      {erro && <p className="cmp-erro-campo mt-2" role="alert">{erro}</p>}
    </article>
  );
}

/**
 * Conversa de questionamentos do pedido (Anexo D.5): linha do tempo de cartões, abertos no topo.
 * Reaproveitada na gestão do PedidoMaterial (solicitante/admin) e na aba "Conversa" do drawer de Compras.
 */
export default function QuestionamentosPedido({
  questionamentos,
  carregando = false,
  erro = null,
  onRecarregar,
  podeResponder = false,
  usuarioId = null,
  podeCancelarQualquer = false,
  nomeSolicitante = '',
  podeAbrir = false,
  onAbrir,
  onRespondido,
  onCancelado,
}) {
  const [anuncio, setAnuncio] = useState('');
  const lista = useMemo(() => ordenar(questionamentos ?? []), [questionamentos]);

  // Anuncia o resultado e leva o foco ao cartão respondido (depois que a lista recarregar)
  const anunciar = (texto, id) => {
    setAnuncio(texto);
    setTimeout(() => document.getElementById(`quest-${id}`)?.focus({ preventScroll: false }), 400);
  };

  if (carregando && !questionamentos) return <Esqueleto />;
  if (erro && !questionamentos) return <ErroCarregamento mensagem={erro} onTentarNovamente={onRecarregar} />;

  return (
    <div>
      <div className="sr-only" aria-live="polite" role="status">{anuncio}</div>

      {podeAbrir && (
        <div className="mb-3 flex justify-end">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={onAbrir}>
            ❓ Abrir questionamento
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2" aria-hidden="true">💬</p>
          <p className="text-slate-300">Nenhum questionamento neste pedido</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((q) => (
            <CartaoQuestionamento
              key={q.id}
              q={q}
              podeResponder={podeResponder}
              podeCancelar={q.status === 'aberto' && (podeCancelarQualquer || (usuarioId && q.criado_por === usuarioId))}
              nomeSolicitante={nomeSolicitante}
              onRespondido={onRespondido}
              onCancelado={onCancelado}
              onConflito={onRecarregar}
              anunciar={anunciar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
