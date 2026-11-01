import React, { useMemo, useRef, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { addDias, dataLocalISO } from '../../../execucao/utils/datas';
import { formatarBRL, formatarPercentual } from '../../utils/cotacao/moeda';
import {
  candidatosPorConvite, celulaDaMatriz, fugaDaRecomendacao, montarDecisao, recomendacaoDoSistema, rotuloCondicao, totaisDaEscolha, variacaoDaDecisao
} from '../../utils/cotacao/comparativo';

const MIN_JUSTIFICATIVA = 10;
const MODOS = [
  { id: 'unico', rotulo: 'Um fornecedor' },
  { id: 'dividido', rotulo: 'Dividir por item' },
  { id: 'manual', rotulo: 'Escolher manualmente' },
];

const hojeMais = (dias) => dataLocalISO(addDias(new Date(), dias));

/**
 * Decisão (§10.5, B.5.6): único (recomendado), dividido ou manual; data de disponibilidade por pedido; justificativa se foge da recomendação.
 * Grava `recomendacao_snapshot.vencedor_recomendado_fornecedor_id` (KPI K7).
 */
export default function ModalDecisao({ comparativo, referencias, pedidos, onClose, onDecidido }) {
  const { toast, confirmar } = useExecucaoUI();
  const { ranking, divisao, linhas, respostas } = comparativo;
  const porConvite = useMemo(() => candidatosPorConvite(ranking), [ranking]);
  const rec = useMemo(() => recomendacaoDoSistema(comparativo), [comparativo]);
  const completos = ranking.ordenados.filter((c) => c.completo);
  const podeDividir = Boolean(divisao?.mostrar && divisao.cobre_tudo);

  const modoInicial = completos.length ? 'unico' : podeDividir ? 'dividido' : 'manual';
  const [modo, setModo] = useState(modoInicial);
  const [conviteUnico, setConviteUnico] = useState(rec.modo === 'unico' ? rec.convite_id : completos[0]?.convite_id ?? '');
  const [porLinha, setPorLinha] = useState(() => {
    const m = {};
    linhas.forEach((l) => {
      const melhor = ranking.ordenados.map((c) => ({ c, cel: celulaDaMatriz(l, respostas.find((r) => r.convite_id === c.convite_id), c) }))
        .filter((x) => x.cel.estado === 'atendida').sort((a, b) => a.cel.precoVp - b.cel.precoVp)[0];
      m[l.id] = melhor?.c.convite_id ?? '';
    });
    return m;
  });
  const [datasEditadas, setDatasEditadas] = useState({});
  const [justificativa, setJustificativa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [sujo, setSujo] = useState(false);
  const confirmando = useRef(false);

  const escolha = useMemo(() => ({ modo, conviteId: conviteUnico, porLinha }), [modo, conviteUnico, porLinha]);
  const totais = useMemo(() => totaisDaEscolha({ comparativo, escolha }), [comparativo, escolha]);
  const fuga = useMemo(() => fugaDaRecomendacao({ comparativo, escolha }), [comparativo, escolha]);
  const varRef = useMemo(() => variacaoDaDecisao({ comparativo, escolha, referencias }), [comparativo, escolha, referencias]);

  // Data sugerida = hoje + maior prazo de entrega entre os fornecedores escolhidos (pode ser editada)
  const prazoMax = Math.max(0, ...((totais?.convites ?? []).map((cid) => Number(porConvite.get(cid)?.prazo_entrega_dias) || 0)));
  const sugerida = hojeMais(prazoMax);
  const dataDe = (pid) => datasEditadas[pid] ?? sugerida;

  const linhasSemFornecedor = modo === 'manual' ? linhas.filter((l) => !porLinha[l.id]) : [];
  const semMaterial = linhas.filter((l) => !l.material_id).length;
  const hoje = dataLocalISO();
  const datasInvalidas = pedidos.some((p) => !dataDe(p.id) || dataDe(p.id) < hoje);
  const justFalta = fuga.foge && justificativa.trim().length < MIN_JUSTIFICATIVA;

  const motivo = linhasSemFornecedor.length ? 'Nenhum fornecedor cobre este item. Remova o item ou tire o pedido da cotação.'
    : !totais ? 'Escolha como comprar.'
      : modo === 'unico' && !conviteUnico ? 'Escolha o fornecedor.'
        : datasInvalidas ? 'Informe uma data de disponibilidade de hoje em diante para cada pedido.'
          : justFalta ? `Explique o motivo (mínimo de ${MIN_JUSTIFICATIVA} caracteres).` : '';

  const marcar = (fn) => (...a) => { setSujo(true); fn(...a); };

  const fechar = async () => {
    if (confirmando.current) return;
    if (sujo) {
      confirmando.current = true;
      const ok = await confirmar({ titulo: 'Descartar a decisão?', mensagem: 'As escolhas feitas nesta janela serão perdidas.', confirmarTexto: 'Descartar' });
      confirmando.current = false;
      if (!ok) return;
    }
    onClose();
  };

  const confirmar_ = async () => {
    setErro('');
    if (motivo) return;
    setOcupado(true);
    const datas = Object.fromEntries(pedidos.map((p) => [p.id, dataDe(p.id)]));
    const r = await comprasCotacaoService.decidir(comparativo.cotacao.id, montarDecisao({ comparativo, escolha, datas, justificativa }));
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível registrar a decisão.'); return; }
    toast.success('Decisão registrada. Os pedidos seguem para a compra.');
    onDecidido?.(r.data);
  };

  const nomeConv = (cid) => porConvite.get(cid)?.empresa ?? 'Fornecedor';

  return (
    <Modal tamanho="lg" variante="cheia" cabecalho="Decidir cotação" onClose={fechar}>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}

      <fieldset className="mb-4">
        <legend className="cmp-rotulo mb-1">Como comprar</legend>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Como comprar">
          {MODOS.map((m) => {
            const indisponivel = (m.id === 'unico' && !completos.length) || (m.id === 'dividido' && !podeDividir);
            if (m.id === 'dividido' && !podeDividir) return null;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} disabled={indisponivel} className={`cmp-opcao ${modo === m.id ? 'cmp-opcao-ativa' : ''}`} onClick={marcar(() => setModo(m.id))}>
                {m.rotulo}
                {m.id === 'unico' && rec.modo === 'unico' ? ' (recomendado)' : ''}
                {m.id === 'dividido' && divisao?.economia > 0 ? ` (economia ${formatarBRL(divisao.economia)})` : ''}
              </button>
            );
          })}
        </div>
      </fieldset>

      {modo === 'unico' && (
        <div className="cmp-campo mb-4">
          <label htmlFor="cmp-dec-unico">Fornecedor</label>
          <select id="cmp-dec-unico" className="execucao-form-select" value={conviteUnico} onChange={marcar((e) => setConviteUnico(e.target.value))}>
            {completos.map((c) => <option key={c.convite_id} value={c.convite_id}>{c.empresa} · {formatarBRL(c.vp_total)} ({rotuloCondicao(c.condicao)})</option>)}
          </select>
        </div>
      )}

      {modo === 'manual' && (
        <ul className="cmp-lista-limpa mb-4" aria-label="Fornecedor por item">
          {linhas.map((l) => {
            const opcoes = ranking.ordenados.map((c) => ({ c, cel: celulaDaMatriz(l, respostas.find((r) => r.convite_id === c.convite_id), c) })).filter((x) => x.cel.estado === 'atendida');
            return (
              <li key={l.id} className="cmp-linha">
                <div className="cmp-campo" style={{ flex: 1, minWidth: '14rem' }}>
                  <label htmlFor={`cmp-dec-${l.id}`}>{l.descricao}</label>
                  {opcoes.length === 0 ? <p className="cmp-erro-campo" role="alert">Nenhum fornecedor cobre este item. Remova o item ou tire o pedido da cotação.</p> : (
                    <select id={`cmp-dec-${l.id}`} className="execucao-form-select" value={porLinha[l.id] ?? ''} onChange={marcar((e) => setPorLinha((m) => ({ ...m, [l.id]: e.target.value })))}>
                      {opcoes.map(({ c, cel }) => <option key={c.convite_id} value={c.convite_id}>{c.empresa} · {formatarBRL(cel.precoVp, 4)}</option>)}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {semMaterial > 0 && (
        <div className="cmp-aviso" role="note">
          {semMaterial} {semMaterial === 1 ? 'linha está' : 'linhas estão'} sem material confirmado: {semMaterial === 1 ? 'não entra' : 'não entram'} no histórico de preços.
        </div>
      )}

      <fieldset className="mb-4">
        <legend className="cmp-rotulo mb-1">Data de disponibilidade por pedido</legend>
        <ul className="cmp-lista-limpa">
          {pedidos.map((p) => (
            <li key={p.id} className="cmp-linha">
              <label htmlFor={`cmp-dec-data-${p.id}`} className="text-sm text-slate-200">{p.cliente_nome || p.descricao || 'Pedido'}</label>
              <input id={`cmp-dec-data-${p.id}`} type="date" min={hoje} className="execucao-form-input !w-auto" value={dataDe(p.id)} onChange={marcar((e) => setDatasEditadas((d) => ({ ...d, [p.id]: e.target.value })))} />
            </li>
          ))}
        </ul>
        <p className="cmp-texto-mudo mt-1">Sugerida pelo prazo do fornecedor.</p>
      </fieldset>

      {fuga.foge && (
        <div className="mb-4">
          <div className="cmp-aviso" role="status">
            Você escolheu uma opção diferente da recomendada (+{formatarBRL(fuga.diferenca.valor)}, {formatarPercentual(fuga.diferenca.pct, { sinal: true })}). Explique o motivo.
          </div>
          <div className="cmp-campo">
            <label htmlFor="cmp-dec-just">Justificativa *</label>
            <textarea id="cmp-dec-just" className="execucao-form-textarea" rows={3} maxLength={500} value={justificativa} onChange={marcar((e) => setJustificativa(e.target.value))} aria-invalid={justFalta || undefined} />
          </div>
        </div>
      )}

      <section className="cmp-bloco" aria-label="Resumo da decisão">
        <h3>Resumo</h3>
        {totais ? (
          <>
            <p className="text-slate-100">Valor comparável {formatarBRL(totais.vp)} · nominal {formatarBRL(totais.nominal)}</p>
            <p className="text-sm text-slate-300">Fornecedores: {totais.convites.map(nomeConv).join(', ')}</p>
            {varRef && <p className={`text-sm ${varRef.delta <= 0 ? 'cmp-var-verde' : 'cmp-var-vermelho'}`}>vs. referência: {varRef.texto}</p>}
            {modo === 'dividido' && divisao?.aviso_desconto_valor && <p className="cmp-var-ambar text-sm">⚠ Desconto em R$ pode não valer em compra parcial.</p>}
          </>
        ) : <p className="text-slate-300">Sem totais para esta escolha.</p>}
      </section>

      {motivo && <p id="cmp-dec-motivo" className="cmp-texto-mudo" aria-live="polite">{motivo}</p>}
      <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={fechar} disabled={ocupado}>Cancelar</button>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={confirmar_} disabled={ocupado || Boolean(motivo)} aria-busy={ocupado || undefined} aria-describedby={motivo ? 'cmp-dec-motivo' : undefined}>
          {ocupado ? 'Registrando…' : 'Confirmar decisão'}
        </button>
      </div>
    </Modal>
  );
}
