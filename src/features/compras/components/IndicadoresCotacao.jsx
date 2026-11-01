import React, { useEffect, useRef } from 'react';
import { useAsyncData } from '../../execucao/hooks/useAsyncData';
import comprasCotacaoService from '../../../services/supabase/comprasCotacao';
import { formatarBRL } from '../utils/cotacao/moeda';
import { formatarDuracaoHoras } from '../utils/statusCompra';

const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'));
const pct = (n, casas = 1) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`);

function Cartao({ emoji, rotulo, valor, detalhe = null, tom = 'azul', suficiente = true, carregando = false }) {
  return (
    <div className={`cmp-kpi cmp-tom-${tom}`}>
      <span className="cmp-kpi-rotulo"><span aria-hidden="true">{emoji}</span> {rotulo}</span>
      <span className="cmp-kpi-valor" style={suficiente ? undefined : { fontSize: '1rem', color: 'var(--text-muted)' }}>
        {carregando ? <span className="cmp-skeleton cmp-skeleton-valor" aria-hidden="true" /> : suficiente ? valor : 'dados insuficientes'}
      </span>
      {detalhe && suficiente && !carregando && <span className="cmp-kpi-detalhe">{detalhe}</span>}
    </div>
  );
}

/** KPIs de cotação (plano §12, K1–K10) abaixo dos indicadores de Compras. `suficiente=false` → "dados insuficientes". */
export default function IndicadoresCotacao({ de = null, ate = null, versao = 0 }) {
  const ind = useAsyncData(() => comprasCotacaoService.indicadoresCotacao(de, ate), [de, ate]);
  const refresh = ind.refresh;
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    refresh();
  }, [versao, refresh]);

  const k = ind.data ?? {};
  const semDados = ind.loading && !ind.data;
  const top = [...(ind.data?.por_fornecedor ?? [])].filter((f) => f.participacoes > 0).sort((a, b) => (b.taxa_vitoria ?? 0) - (a.taxa_vitoria ?? 0))[0];

  if (ind.error && !ind.data) {
    return (
      <section className="cmp-kpi-cotacao" aria-label="Indicadores de cotação">
        <div className="cmp-aviso-erro" role="alert">
          <span>Indicadores de cotação indisponíveis: {ind.error}</span>
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={ind.reload}>Tentar novamente</button>
        </div>
      </section>
    );
  }

  return (
    <section className="cmp-kpi-cotacao" aria-label="Indicadores de cotação" aria-busy={semDados || undefined}>
      <details open>
        <summary className="text-sm font-semibold text-slate-200 cursor-pointer mb-2">🧾 Cotações com fornecedores {k.periodo ? <span className="cmp-texto-mudo">({String(k.periodo.de).split('-').reverse().join('/')} a {String(k.periodo.ate).split('-').reverse().join('/')})</span> : null}</summary>
        <div className="cmp-kpi-grade">
          <Cartao emoji="💰" rotulo="Economia obtida" tom="verde" carregando={semDados} suficiente={k.k1?.suficiente}
            valor={formatarBRL(k.k1?.valor)} detalhe={k.k1?.pct != null ? `${pct(k.k1.pct)} sobre a referência · ${num(k.k1.n_linhas)} linhas` : null} />
          <Cartao emoji="📊" rotulo="Preço vs. referência" tom="azul" carregando={semDados} suficiente={k.k2?.suficiente}
            valor={`${pct(k.k2?.acima_pct, 0)} acima`} detalhe={`${pct(k.k2?.abaixo_pct, 0)} abaixo · ${pct(k.k2?.neutras_pct, 0)} neutras`} />
          <Cartao emoji="📨" rotulo="Taxa de resposta" tom="ciano" carregando={semDados} suficiente={k.k3?.suficiente}
            valor={pct(k.k3?.taxa, 0)} detalhe={`${num(k.k3?.respondidos)} de ${num(k.k3?.enviados)} enviados`} />
          <Cartao emoji="⏱️" rotulo="Ciclo da cotação" tom="azul" carregando={semDados} suficiente={k.k4?.suficiente}
            valor={formatarDuracaoHoras(k.k4?.decisao_horas)} detalhe={`1ª resposta em ${formatarDuracaoHoras(k.k4?.primeira_resposta_horas)}`} />
          <Cartao emoji="🟢" rotulo="Abertas agora" tom="amarelo" carregando={semDados} suficiente
            valor={num(k.k5?.abertas)} detalhe={`${num(k.k5?.vencendo_24h)} vencendo em 24 h · ${num(k.k5?.sem_respostas)} sem respostas · ${num(k.k5?.prazo_vencido)} com prazo vencido`} />
          <Cartao emoji="🏭" rotulo="Gasto e concentração" tom="laranja" carregando={semDados} suficiente={k.k6?.suficiente}
            valor={formatarBRL(k.k6?.total)} detalhe={`maior fornecedor: ${pct(k.k6?.concentracao_pct, 0)}${k.k6?.fornecedor_top ? ` (${k.k6.fornecedor_top})` : ''}`} />
          <Cartao emoji="🏆" rotulo="Competitividade" tom="roxo" carregando={semDados} suficiente={k.k7?.suficiente}
            valor={top ? top.empresa : '—'} detalhe={top ? `1º do ranking em ${pct(top.taxa_vitoria, 0)} das cotações` : null} />
          <Cartao emoji="✏️" rotulo="Alterações em listas" tom="laranja" carregando={semDados} suficiente={k.k8?.suficiente}
            valor={num(k.k8?.questionamentos)} detalhe={`${num(k.k8?.historicos)} aplicadas na hora · aceite em ${formatarDuracaoHoras(k.k8?.mediana_aceite_horas)}`} />
          <Cartao emoji="💳" rotulo="Parcelado × à vista" tom="ciano" carregando={semDados} suficiente={k.k9?.suficiente}
            valor={`${pct(k.k9?.parcelado_pct, 0)} parcelado`} detalhe={`${pct(k.k9?.a_vista_pct, 0)} à vista (valor nominal)`} />
          <Cartao emoji="🔺" rotulo="Itens mais caros" tom="vermelho" carregando={semDados} suficiente={k.k10?.suficiente}
            valor={k.k10?.itens?.[0]?.nome ?? '—'} detalhe={(k.k10?.itens ?? []).slice(0, 3).map((i) => `${i.nome} (+${pct(i.delta_pct)})`).join(' · ')} />
        </div>
      </details>
    </section>
  );
}
