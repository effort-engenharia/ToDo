import React, { useMemo, useState } from 'react';
import { ErroCarregamento, EstadoVazio } from '../../../execucao/components/ui/Estados';
import { useAsyncData } from '../../../execucao/hooks/useAsyncData';
import { useDebouncedValue } from '../../../execucao/hooks/useDebouncedValue';
import { formatarDataBR } from '../../../execucao/utils/datas';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { isCompras } from '../../../../utils/permissoes';
import { useCotacaoDisponivel } from '../../hooks/useCotacaoDisponivel';
import { variacaoReferencia } from '../../utils/cotacao/comparacao';
import { formatarBRL } from '../../utils/cotacao/moeda';
import DetalheMaterial from './DetalheMaterial';

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const LOTE = 500; // limite de compras_precos_referencia

const carregarTudo = async () => {
  const mats = await comprasCotacaoService.listarMateriais({ apenasAtivos: true });
  if (!mats.success) return mats;
  const ids = mats.data.map((m) => m.id);
  const refs = {};
  for (let i = 0; i < ids.length; i += LOTE) {
    const r = await comprasCotacaoService.precosReferencia(ids.slice(i, i + LOTE));
    if (!r.success) return r;
    Object.assign(refs, r.data ?? {});
  }
  return { success: true, data: { materiais: mats.data, referencias: refs } };
};

function Variacao({ v }) {
  if (!v || v.status !== 'ok') return <span className="cmp-var-cinza">—</span>;
  const cls = v.cor === 'verde' ? 'cmp-var-verde' : v.cor === 'vermelho' ? 'cmp-var-vermelho' : 'cmp-var-cinza';
  const sinal = v.delta > 0 ? '+' : v.delta < 0 ? '−' : '';
  return (
    <span className={cls}>
      {sinal}{formatarBRL(Math.abs(v.delta))} / {sinal}{Math.abs(v.deltaPct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      {v.alerta && ' ⚠️'}
    </span>
  );
}

// Histórico de preços (§10.6, B.7): tabela por material com última compra, média, menor e nº de compras; detalhe em drawer. Só COMPRAS/Administrador (D16).
const PrecosPagina = ({ usuario }) => {
  const { config } = useCotacaoDisponivel();
  const dados = useAsyncData(carregarTudo, []);
  const [busca, setBusca] = useState('');
  const buscaDeb = useDebouncedValue(busca, 250);
  const [aberto, setAberto] = useState(null);

  const materiais = useMemo(() => dados.data?.materiais ?? [], [dados.data]);
  const refs = useMemo(() => dados.data?.referencias ?? {}, [dados.data]);

  const linhas = useMemo(() => {
    const q = semAcento(buscaDeb.trim());
    return materiais.filter((m) => !q || semAcento(`${m.nome} ${m.unidade} ${m.categoria ?? ''}`).includes(q)).map((m) => {
      const ref = refs[m.id] ?? null;
      const v = ref?.ultimo ? variacaoReferencia({
        precoVp: Number(ref.ultimo.preco_vp), referencia: ref, materialId: m.id,
        faixaNeutraPct: Number(config?.faixa_neutra_pct ?? 0.02), alertaPct: Number(config?.alerta_pct ?? 0.1)
      }) : null;
      return { m, ref, v };
    });
  }, [materiais, refs, buscaDeb, config]);

  if (!isCompras(usuario)) return <p className="text-slate-300">Esta área é restrita à equipe de Compras.</p>;

  return (
    <div className="cmp-pagina execucao-animate-fade-in">
      <div className="cmp-secao-cab"><h2 className="text-xl font-semibold">Preços</h2></div>
      <div className="cmp-campo mb-4" style={{ maxWidth: '24rem' }}>
        <label htmlFor="cmp-preco-busca">Buscar material</label>
        <input id="cmp-preco-busca" type="search" className="execucao-form-input" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {dados.error && !dados.data ? <ErroCarregamento mensagem={dados.error} onTentarNovamente={dados.reload} />
        : dados.loading && !dados.data ? <div className="space-y-2" aria-busy="true" role="status" aria-label="Carregando preços">{[0, 1, 2, 3].map((i) => <div key={i} className="cmp-skeleton h-12 w-full rounded-lg" />)}</div>
          : materiais.length === 0 ? <EstadoVazio icone="📈" titulo="O histórico começa na primeira cotação decidida." texto="Quando você decidir uma cotação, os preços comprados aparecem aqui." />
            : linhas.length === 0 ? <EstadoVazio icone="🔎" titulo="Nada encontrado" texto="Tente outro termo de busca." /> : (
              <div className="cmp-tabela-rolagem" role="region" aria-label="Preços por material" tabIndex={0}>
                <table className="execucao-table cmp-tabela" style={{ minWidth: '56rem' }}>
                  <thead><tr>
                    <th scope="col">Material</th><th scope="col">Unid.</th><th scope="col">Última compra</th><th scope="col">Média (janela)</th>
                    <th scope="col">Menor</th><th scope="col">Nº de compras</th><th scope="col">Última vs. média</th>
                  </tr></thead>
                  <tbody>
                    {linhas.map(({ m, ref, v }) => (
                      <tr key={m.id}>
                        <td><button type="button" className="cmp-link" onClick={() => setAberto(m)}>{m.nome}</button></td>
                        <td>{m.unidade}</td>
                        <td>{ref?.ultimo ? <>{formatarBRL(ref.ultimo.preco_vp, 4)}<span className="cmp-texto-mudo block">{ref.ultimo.data ? formatarDataBR(ref.ultimo.data) : ''}</span></> : '—'}</td>
                        <td>{ref?.media_janela != null ? <>{formatarBRL(ref.media_janela, 4)}{ref.n_janela === 0 && <span className="cmp-texto-mudo block">referência antiga</span>}</> : '—'}</td>
                        <td>{ref?.menor ? <>{formatarBRL(ref.menor.preco_vp, 4)}<span className="cmp-texto-mudo block">{ref.menor.data ? formatarDataBR(ref.menor.data) : ''}</span></> : '—'}</td>
                        <td>{ref?.n_total ?? 0}</td>
                        <td>{ref ? <Variacao v={v} /> : <span className="cmp-texto-mudo">sem histórico</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

      {aberto && (
        <DetalheMaterial
          material={aberto} referencia={refs[aberto.id] ?? null} materiais={materiais}
          onClose={() => setAberto(null)} onMesclado={() => { setAberto(null); dados.reload(); }}
        />
      )}
    </div>
  );
};

export default PrecosPagina;
