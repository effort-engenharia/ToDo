import React, { useId, useState } from 'react';
import { formatarDuracaoDias, formatarDuracaoHoras } from '../utils/statusCompra';

const numero = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'));

function Cartao({ emoji, rotulo, valor, detalhe = null, tom = 'azul', onClick = null, ativo = false, carregando = false }) {
  const corpo = (
    <>
      <span className="cmp-kpi-rotulo"><span aria-hidden="true">{emoji}</span> {rotulo}</span>
      <span className="cmp-kpi-valor">{carregando ? <span className="cmp-skeleton cmp-skeleton-valor" aria-hidden="true" /> : valor}</span>
      {detalhe && !carregando && <span className="cmp-kpi-detalhe">{detalhe}</span>}
    </>
  );
  const classe = `cmp-kpi cmp-tom-${tom}${ativo ? ' cmp-kpi-ativo' : ''}`;
  if (!onClick) return <div className={classe}>{corpo}</div>;
  return (
    <button type="button" className={`${classe} cmp-kpi-botao`} onClick={onClick} aria-pressed={ativo}>
      {corpo}
    </button>
  );
}

/**
 * KPIs do Dashboard de Compras (D9/N1-l). Os 4 primeiros filtram a fila (aria-pressed); os demais são estáticos.
 * No celular/tablet estreito: 4 prioritários em 2×2 + disclosure "Mais indicadores".
 */
export default function IndicadoresCompras({ indicadores, carregando, erro, onTentarNovamente, kpiAtivo, onKpi, rotuloPeriodo }) {
  const [maisAberto, setMaisAberto] = useState(false);
  const idMais = useId();
  const k = indicadores ?? {};
  const solic = k.aguardando_solicitante ?? {};
  const tFila = k.tempo_fila_ate_comprado_dias ?? {};
  const tResp = k.tempo_resposta_questionamento_horas ?? {};
  const paradas = k.obras_paradas_falta_material ?? {};
  const semDados = carregando && !indicadores;

  const alternar = (id) => onKpi(kpiAtivo === id ? null : id);

  const prioritarios = (
    <>
      <Cartao emoji="🛒" rotulo="Aguardando compra" valor={numero(k.aguardando_compra)} tom="amarelo" carregando={semDados}
        onClick={() => alternar('aguardando_compra')} ativo={kpiAtivo === 'aguardando_compra'} />
      <Cartao emoji="🧾" rotulo="Em cotação" valor={numero(k.em_cotacao)} tom="azul" carregando={semDados}
        onClick={() => alternar('em_cotacao')} ativo={kpiAtivo === 'em_cotacao'} />
      <Cartao emoji="❓" rotulo="Aguardando solicitante" valor={numero(solic.pedidos)} tom="roxo" carregando={semDados}
        detalhe={solic.mais_antigo_dias != null ? `mais antigo: ${formatarDuracaoDias(solic.mais_antigo_dias)}` : null}
        onClick={() => alternar('aguardando_solicitante')} ativo={kpiAtivo === 'aguardando_solicitante'} />
      <Cartao emoji="⚠️" rotulo="Atrasados" valor={numero(k.atrasados)} tom="laranja" carregando={semDados}
        detalhe="previsão de chegada vencida"
        onClick={() => alternar('atrasados')} ativo={kpiAtivo === 'atrasados'} />
    </>
  );

  const demais = (
    <>
      <Cartao emoji="🔴" rotulo="Urgentes em aberto" valor={numero(k.urgentes_em_aberto)} tom="vermelho" carregando={semDados} />
      <Cartao emoji="🚧" rotulo="Obras paradas por falta" valor={numero(paradas.obras)} tom="vermelho" carregando={semDados}
        detalhe={paradas.atividades != null ? `${numero(paradas.atividades)} atividade(s) pausada(s)` : null} />
      <Cartao emoji="🛍️" rotulo="Comprados no período" valor={numero(k.comprados_periodo)} tom="ciano" carregando={semDados}
        detalhe={rotuloPeriodo} />
      <Cartao emoji="📦" rotulo="Entregues no período" valor={numero(k.entregues_periodo)} tom="verde" carregando={semDados}
        detalhe={rotuloPeriodo} />
      <Cartao emoji="⏱️" rotulo="Tempo fila → comprado" valor={formatarDuracaoDias(tFila.media)} tom="azul" carregando={semDados}
        detalhe={tFila.amostra ? `mediana ${formatarDuracaoDias(tFila.mediana)} · ${numero(tFila.amostra)} pedidos` : 'sem pedidos comprados'} />
      <Cartao emoji="💬" rotulo="Tempo de resposta" valor={formatarDuracaoHoras(tResp.media)} tom="roxo" carregando={semDados}
        detalhe={tResp.amostra ? `mediana ${formatarDuracaoHoras(tResp.mediana)} · ${numero(tResp.amostra)} respondidos` : 'sem respostas no período'} />
    </>
  );

  return (
    <section aria-label="Indicadores de compras" aria-busy={carregando || undefined} className={carregando && indicadores ? 'opacity-60' : ''}>
      {erro && (
        <div className="cmp-aviso-erro" role="alert">
          <span>Não foi possível carregar os indicadores: {erro}</span>
          {onTentarNovamente && (
            <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={onTentarNovamente}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <div className="cmp-kpi-grade" aria-live="polite">
        {prioritarios}
        <div className="cmp-kpi-mais-desktop contents">{demais}</div>
      </div>

      <div className="cmp-kpi-mais-mobile">
        <button
          type="button"
          className="execucao-btn execucao-btn-secondary cmp-btn-toque w-full mt-3"
          aria-expanded={maisAberto}
          aria-controls={idMais}
          onClick={() => setMaisAberto((v) => !v)}
        >
          Mais indicadores {maisAberto ? '▴' : '▾'}
        </button>
        {maisAberto && <div id={idMais} className="cmp-kpi-grade mt-3">{demais}</div>}
      </div>
    </section>
  );
}
