import React, { useMemo, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import { ErroCarregamento } from '../../../execucao/components/ui/Estados';
import { useAsyncData } from '../../../execucao/hooks/useAsyncData';
import { formatarDataBR } from '../../../execucao/utils/datas';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { formatarBRL, formatarPercentual } from '../../utils/cotacao/moeda';
import { normalizarUnidade } from '../../utils/cotacao/normalizacao';
import { hashDaCotacao } from '../../utils/navegacaoCompras';
import { resumoHistorico, variacoesSequenciais } from '../../utils/cotacao/historicoPrecos';
import Sparkline from './Sparkline';

const sinalBRL = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatarBRL(Math.abs(v))}`;

function BlocoPreco({ emoji, titulo, p }) {
  if (!p) return <div className="cmp-bloco !mb-0"><p className="cmp-texto-mudo">{emoji} {titulo}: sem compras</p></div>;
  return (
    <div className="cmp-bloco !mb-0">
      <p className="text-sm text-slate-100"><span aria-hidden="true">{emoji}</span> {titulo}: <strong>{formatarBRL(p.preco_unitario_vp, 4)}</strong></p>
      <p className="cmp-texto-mudo">{p.fornecedor || 'fornecedor n/d'} · {formatarDataBR(p.registrado_em)}</p>
    </div>
  );
}

/** Detalhe do material (drawer): mais barato/mais caro, sparkline (SVG puro) + tabela do histórico e mesclagem. */
export default function DetalheMaterial({ material, referencia, materiais, onClose, onMesclado }) {
  const { toast, confirmar } = useExecucaoUI();
  const hist = useAsyncData(() => comprasCotacaoService.historicoMaterial(material.id, 50), [material.id]);
  const [mesclando, setMesclando] = useState(false);
  const [destinoId, setDestinoId] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const linhas = useMemo(() => hist.data ?? [], [hist.data]);
  const resumo = useMemo(() => resumoHistorico(linhas), [linhas]);
  const variacoes = useMemo(() => variacoesSequenciais(linhas), [linhas]);
  const pontos = useMemo(() => [...resumo.compras].reverse().map((c) => ({ valor: Number(c.preco_unitario_vp), data: c.registrado_em })), [resumo.compras]);
  const candidatos = materiais.filter((m) => m.id !== material.id && normalizarUnidade(m.unidade) === normalizarUnidade(material.unidade));
  const destino = candidatos.find((m) => m.id === destinoId);

  const mesclar = async () => {
    const ok = await confirmar({
      titulo: 'Mesclar materiais?',
      mensagem: `As compras de “${material.nome}” passam para “${destino.nome}”. Isso não pode ser desfeito.`,
      confirmarTexto: 'Mesclar',
    });
    if (!ok) return;
    setOcupado(true);
    const r = await comprasCotacaoService.mesclarMateriais(material.id, destino.id, null);
    setOcupado(false);
    if (!r.success) { toast.error(r.message || 'Não foi possível mesclar.'); return; }
    toast.success('Materiais mesclados.');
    onMesclado?.();
  };

  return (
    <Modal tamanho="md" variante="drawer" cabecalho={`${material.nome} (${material.unidade})`} onClose={onClose}>
      {hist.error && !hist.data ? <ErroCarregamento mensagem={hist.error} onTentarNovamente={hist.reload} />
        : hist.loading && !hist.data ? <div className="cmp-skeleton h-40 w-full rounded-xl" aria-busy="true" role="status" aria-label="Carregando histórico" />
          : linhas.length === 0 ? <p className="text-slate-300">O histórico começa na primeira cotação decidida.</p> : (
            <>
              {referencia && (
                <p className="text-sm text-slate-300 mb-3">
                  Média ({referencia.n_janela > 0 ? 'janela de referência' : 'referência antiga'}): <strong>{formatarBRL(referencia.media_janela, 4)}</strong> · {referencia.n_total} {referencia.n_total === 1 ? 'compra' : 'compras'}
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-2 mb-2">
                <BlocoPreco emoji="🟢" titulo="Mais barato" p={resumo.maisBarato} />
                <BlocoPreco emoji="🔴" titulo="Mais caro" p={resumo.maisCaro} />
              </div>
              {resumo.diferenca && (
                <p className="text-sm text-slate-200 mb-3">
                  Diferença: {formatarBRL(resumo.diferenca.valor)} ({formatarPercentual(resumo.diferenca.pct, { sinal: true })} sobre o mais barato)
                </p>
              )}
              <Sparkline pontos={pontos} media={referencia ? Number(referencia.media_janela) : null} rotuloPeriodo="no histórico de compras" />

              <div className="cmp-tabela-rolagem mt-3" role="region" aria-label="Histórico de preços do material" tabIndex={0}>
                <table className="execucao-table cmp-tabela" style={{ minWidth: '34rem' }}>
                  <thead><tr><th scope="col">Data</th><th scope="col">Tipo</th><th scope="col">Fornecedor</th><th scope="col">Qtd</th><th scope="col">Preço unit.</th><th scope="col">vs. anterior</th><th scope="col">Cotação</th></tr></thead>
                  <tbody>
                    {linhas.map((h) => {
                      const v = variacoes.get(h.id);
                      return (
                        <tr key={h.id}>
                          <td>{formatarDataBR(h.registrado_em)}</td>
                          <td>{h.tipo === 'comprado' ? '🛍️ Comprado' : '💬 Cotado'}</td>
                          <td>{h.fornecedor || '—'}</td>
                          <td>{Number(h.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                          <td>{formatarBRL(h.preco_unitario_vp, 4)}<span className="cmp-texto-mudo block">nominal {formatarBRL(h.preco_unitario_nominal, 4)}</span></td>
                          <td>{v ? <span className={v.valor > 0 ? 'cmp-var-vermelho' : v.valor < 0 ? 'cmp-var-verde' : 'cmp-var-cinza'}>{sinalBRL(v.valor)} / {formatarPercentual(v.pct, { sinal: true })}</span> : '—'}</td>
                          <td>{h.cotacao_id ? <a className="cmp-link" href={hashDaCotacao(h.cotacao_id)}>nº {h.cotacao_numero}</a> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

      <div className="mt-4">
        {!mesclando ? (
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setMesclando(true)} disabled={candidatos.length === 0}>
            Mesclar com…
          </button>
        ) : (
          <div className="cmp-sugestao">
            <div className="cmp-campo">
              <label htmlFor="cmp-mesclar">Mesclar “{material.nome}” com</label>
              <select id="cmp-mesclar" className="execucao-form-select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Escolha o material de destino</option>
                {candidatos.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>)}
              </select>
              <span className="cmp-texto-mudo">Só materiais com a mesma unidade. O histórico de “{material.nome}” passa para o destino. Não pode ser desfeito.</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setMesclando(false)} disabled={ocupado}>Cancelar</button>
              <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm cmp-btn-toque" onClick={mesclar} disabled={!destino || ocupado} aria-busy={ocupado || undefined}>{ocupado ? 'Mesclando…' : 'Mesclar'}</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
