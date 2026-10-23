import React, { useMemo } from 'react';
import { FaBalanceScale, FaSyncAlt } from 'react-icons/fa';
import { formatarHoras, formatarMinutos } from '../../../utils/formatos';
import { obraPassaFiltroVisao } from './saude';

// Cartão com o número clicável (filtra a lista); os detalhes ficam fora do botão
const Cartao = ({ id, rotulo, valor, tom, ativo, onFiltrar, children, desabilitado = false }) => (
  <div className={`visao-cartao visao-tom-${tom} ${ativo ? 'visao-cartao-ativo' : ''}`}>
    <button
      type="button"
      className="visao-cartao-botao"
      onClick={() => onFiltrar(ativo ? 'todos' : id)}
      aria-pressed={ativo}
      disabled={desabilitado}
      title={desabilitado ? undefined : (ativo ? 'Remover filtro' : 'Filtrar a lista de obras')}
    >
      <span className="visao-cartao-rotulo">{rotulo}</span>
      <span className="visao-cartao-valor">{valor}</span>
    </button>
    {children && <div className="visao-cartao-detalhe">{children}</div>}
  </div>
);

const PainelCarteira = ({
  painel, resumo, filtro, onFiltrar, carga, capacidadeCarregando,
  onAbrirCapacidade, onAbrirHorasExtras, onRecarregar, fallback
}) => {
  const dados = painel.data;

  const entregasSemana = useMemo(
    () => (resumo.data ?? []).filter((o) => obraPassaFiltroVisao(o, 'entregas_semana', new Map())).length,
    [resumo.data]
  );

  if (painel.loading && !dados) {
    return <div className="visao-painel-estado" role="status">Carregando indicadores da carteira…</div>;
  }
  if (painel.error || !dados) {
    return (
      <>
        {fallback}
        <div className="visao-painel-estado visao-painel-erro" role="alert">
          Indicadores da carteira indisponíveis{painel.error ? `: ${painel.error}` : ''}.{' '}
          <button type="button" className="visao-link" onClick={onRecarregar}>Tentar novamente</button>
        </div>
      </>
    );
  }

  const p = dados.pendencias ?? {};
  const totalPendencias = (p.sem_responsavel ?? 0) + (p.material ?? 0) + (p.replanejamento ?? 0) + (p.pausadas ?? 0) + (p.horas_extras ?? 0);
  const sobrecarregados = carga.tecnicos.filter((t) => t.percentual === null || t.percentual > 100);

  return (
    <section className="visao-painel" aria-label="Painel da carteira">
      <div className="visao-painel-grade">
        <Cartao id="em_execucao" rotulo="Em execução" valor={dados.em_execucao ?? 0} tom="azul" ativo={filtro === 'em_execucao'} onFiltrar={onFiltrar} />
        <Cartao id="comecam" rotulo="Começam em 15 dias" valor={dados.comecam_15d ?? 0} tom="ciano" ativo={filtro === 'comecam'} onFiltrar={onFiltrar} />
        <Cartao id="entregas_semana" rotulo="Entregas da semana" valor={resumo.data ? entregasSemana : '—'} tom="verde" ativo={filtro === 'entregas_semana'} onFiltrar={onFiltrar} desabilitado={!resumo.data} />
        <Cartao id="atrasada" rotulo="Atrasadas" valor={dados.atrasadas ?? 0} tom="vermelho" ativo={filtro === 'atrasada'} onFiltrar={onFiltrar}>
          {(dados.atrasadas ?? 0) > 0 ? 'Replanejar ou cobrar a equipe' : 'Nenhuma obra estourou o prazo'}
        </Cartao>
        <Cartao id="em_risco" rotulo="Em risco" valor={dados.em_risco ?? 0} tom="laranja" ativo={filtro === 'em_risco'} onFiltrar={onFiltrar}>
          Ainda dá para salvar
        </Cartao>
        <Cartao id="pendencias" rotulo="Pendências" valor={totalPendencias} tom="amarelo" ativo={filtro === 'pendencias'} onFiltrar={onFiltrar}>
          <ul className="visao-lista-detalhe">
            {p.sem_responsavel > 0 && <li>{p.sem_responsavel} sem responsável</li>}
            {p.material > 0 && <li>{p.material} material sem data</li>}
            {p.replanejamento > 0 && <li>{p.replanejamento} pedido(s) de replanejamento</li>}
            {p.pausadas > 0 && <li>{p.pausadas} pausada(s) há mais de 1 dia útil</li>}
            {p.horas_extras > 0 && (
              <li>
                <button type="button" className="visao-link" onClick={onAbrirHorasExtras}>
                  {p.horas_extras} hora(s) extra a aprovar
                </button>
              </li>
            )}
            {totalPendencias === 0 && <li>Nada aguardando decisão</li>}
          </ul>
        </Cartao>
        <div className="visao-cartao visao-tom-roxo">
          <div className="visao-cartao-botao visao-cartao-estatico">
            <span className="visao-cartao-rotulo">Horas a executar</span>
            <span className="visao-cartao-valor">{formatarHoras(dados.horas_restantes)}</span>
          </div>
          <div className="visao-cartao-detalhe">
            <div>Capacidade da semana: {formatarHoras(dados.horas_semana)}</div>
            {dados.semanas_carteira != null && <div>≈ {String(dados.semanas_carteira).replace('.', ',')} semanas de carteira</div>}
          </div>
        </div>
      </div>

      <div className="visao-carga" aria-label="Carga da equipe nesta semana">
        <div className="visao-carga-titulo">
          <FaBalanceScale aria-hidden="true" /> Carga da equipe nesta semana
        </div>
        <div className="visao-carga-itens">
          {capacidadeCarregando && carga.tecnicos.length === 0 && <span className="text-slate-400 text-xs">Carregando…</span>}
          {carga.tecnicos.slice(0, 6).map((t) => (
            <span
              key={t.usuarioId}
              className={`visao-carga-item ${t.percentual === null || t.percentual > 100 ? 'visao-carga-alta' : ''}`}
              title={`${formatarMinutos(t.previstoMin)} previstas de ${formatarMinutos(t.disponivelMin)} disponíveis`}
            >
              {t.nome.split(' ')[0]} <strong>{t.percentual === null ? 'sem jornada' : `${t.percentual}%`}</strong>
              {(t.percentual === null || t.percentual > 100) && <span aria-label="sobrecarga"> ⚠</span>}
            </span>
          ))}
          {carga.tecnicos.length > 6 && <span className="text-slate-400 text-xs">+{carga.tecnicos.length - 6}</span>}
          {carga.semTecnicoMin > 0 && (
            <span className="visao-carga-item visao-carga-alta">Sem técnico <strong>{formatarMinutos(carga.semTecnicoMin)}</strong></span>
          )}
          {!capacidadeCarregando && carga.tecnicos.length === 0 && carga.semTecnicoMin === 0 && (
            <span className="text-slate-400 text-xs">Sem atividades alocadas na semana.</span>
          )}
          {sobrecarregados.length > 0 && (
            <span className="text-xs text-amber-300">{sobrecarregados.length} acima da jornada</span>
          )}
        </div>
        <div className="visao-carga-acoes">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={onAbrirCapacidade}>
            Capacidade da equipe
          </button>
          <button type="button" className="visao-icone" onClick={onRecarregar} title="Atualizar indicadores" aria-label="Atualizar indicadores">
            <FaSyncAlt size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default React.memo(PainelCarteira);
