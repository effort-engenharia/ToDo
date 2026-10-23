import React, { useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { addDias, dataLocalISO, formatarDataBR, intervaloSemana, parseDataLocal } from '../../utils/datas';
import { formatarMinutos } from '../../utils/formatos';
import { isAdminExecucao } from '../../utils/permissoes';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import {
  SITUACOES, agruparPorUsuario, resumirPeriodo, segundaDa, situacaoDoDia, somarDias,
} from './calculos';
import DetalheCapacidadeDia from './DetalheCapacidadeDia';
import '../config/config.css';
import './capacidade.css';

const SEMANAS_NA_VISAO = 4;

const LEGENDA = [
  { situacao: 'ok', cor: 'var(--accent-green)' },
  { situacao: 'extra', cor: 'var(--accent-yellow)' },
  { situacao: 'limite', cor: 'var(--accent-red)' },
  { situacao: 'emergencia', cor: 'var(--accent-purple)' },
  { situacao: 'ausente', cor: 'var(--accent-cyan)' },
];

const carregar = async (inicio, fim) => {
  const [capacidade, usuarios] = await Promise.all([servico.buscarCapacidade(inicio, fim), execucaoService.buscarTecnicos()]);
  for (const r of [capacidade, usuarios]) if (!r.success) return r;
  return { success: true, data: { linhas: capacidade.data ?? [], usuarios: usuarios.data ?? [] } };
};

const diasDoIntervalo = (inicio, quantidade) =>
  Array.from({ length: quantidade }, (_, i) => dataLocalISO(addDias(parseDataLocal(inicio), i)));

const cabecalhoDia = (iso) => {
  const d = parseDataLocal(iso);
  return { semana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
};

const CapacidadeEquipe = ({ usuario }) => {
  const [modo, setModo] = useState('dia');
  const [semanaInicio, setSemanaInicio] = useState(() => intervaloSemana().inicio);
  const [detalhe, setDetalhe] = useState(null);

  const totalDias = modo === 'dia' ? 7 : SEMANAS_NA_VISAO * 7;
  const inicio = semanaInicio;
  const fim = dataLocalISO(addDias(parseDataLocal(inicio), totalDias - 1));

  const { data, loading, error, reload } = useAsyncData(() => carregar(inicio, fim), [inicio, fim]);

  const dias = useMemo(() => diasDoIntervalo(inicio, totalDias), [inicio, totalDias]);
  const porUsuario = useMemo(() => agruparPorUsuario(data?.linhas ?? []), [data]);
  const nomes = useMemo(() => new Map((data?.usuarios ?? []).map((u) => [u.id, u.nome_completo])), [data]);

  // Colaboradores (A–Z) e, por último, a linha "sem técnico" quando houver demanda
  const linhas = useMemo(() => {
    const ids = [...porUsuario.keys()].filter((id) => id !== null);
    ids.sort((a, b) => (nomes.get(a) ?? 'Colaborador').localeCompare(nomes.get(b) ?? 'Colaborador', 'pt-BR'));
    const semTecnico = porUsuario.has(null) && [...porUsuario.get(null).values()].some((l) => l.previsto_min > 0);
    return [...ids, ...(semTecnico ? [null] : [])];
  }, [porUsuario, nomes]);

  const resumo = useMemo(() => resumirPeriodo(data?.linhas ?? []), [data]);
  const semanas = useMemo(() => Array.from({ length: SEMANAS_NA_VISAO }, (_, i) => dias.slice(i * 7, i * 7 + 7)), [dias]);

  const irPara = (delta) => setSemanaInicio((atual) => dataLocalISO(addDias(parseDataLocal(atual), delta * 7)));
  const linhaDoDia = (id, dia) => porUsuario.get(id)?.get(dia);
  const nomeDe = (id) => (id === null ? 'Sem técnico' : nomes.get(id) ?? 'Colaborador');

  const abrirDia = (id, dia) => setDetalhe({ id, dia });

  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !data) return <Carregando />;

  const celulaDetalhe = detalhe ? linhaDoDia(detalhe.id, detalhe.dia) : null;
  const ocupacao = resumo.disponivel > 0 ? Math.round(((resumo.previsto - resumo.emergencia) / resumo.disponivel) * 100) : null;

  const celulaVazia = () => <div className="cap-cel cap-folga" aria-label="Sem dados">—</div>;

  const renderDia = (id, dia) => {
    const l = linhaDoDia(id, dia);
    if (!l) return celulaVazia();
    if (id === null) {
      if (!l.previsto_min) return celulaVazia();
      return (
        <button type="button" className="cap-cel cap-sem-tecnico" onClick={() => abrirDia(id, dia)} aria-label={`Sem técnico em ${formatarDataBR(dia)}: ${formatarMinutos(l.previsto_min)} a distribuir`}>
          {formatarMinutos(l.previsto_min)}<small>a distribuir</small>
        </button>
      );
    }
    const sit = SITUACOES[situacaoDoDia(l)];
    const conteudo = (
      <>
        {l.previsto_min > 0 || l.disponivel_min > 0
          ? <span>{formatarMinutos(l.previsto_min)}{l.dia_util && !l.ausente ? <span className="text-slate-400">/{formatarMinutos(l.disponivel_min)}</span> : null}</span>
          : <span aria-hidden="true">—</span>}
        {sit.curto && <small>{sit.curto}</small>}
      </>
    );
    const rotulo = `${nomeDe(id)}, ${formatarDataBR(dia)}: ${sit.rotulo}; alocado ${formatarMinutos(l.previsto_min)} de ${formatarMinutos(l.disponivel_min)}`;
    return l.previsto_min > 0
      ? <button type="button" className={`cap-cel ${sit.classe}`} aria-label={rotulo} onClick={() => abrirDia(id, dia)}>{conteudo}</button>
      : <div className={`cap-cel ${sit.classe}`} aria-label={rotulo}>{conteudo}</div>;
  };

  const renderSemana = (id, diasDaSemana) => {
    const registros = diasDaSemana.map((d) => linhaDoDia(id, d)).filter(Boolean);
    if (!registros.length) return celulaVazia();
    const soma = somarDias(registros);
    const sit = SITUACOES[soma.situacao];
    if (id === null) {
      return soma.previsto_min
        ? <div className="cap-cel cap-sem-tecnico">{formatarMinutos(soma.previsto_min)}<small>a distribuir</small></div>
        : celulaVazia();
    }
    const pct = soma.disponivel_min > 0 ? Math.round((soma.previsto_min / soma.disponivel_min) * 100) : null;
    return (
      <button
        type="button"
        className={`cap-cel ${sit.classe}`}
        aria-label={`${nomeDe(id)}, semana de ${formatarDataBR(diasDaSemana[0])}: ${formatarMinutos(soma.previsto_min)} de ${formatarMinutos(soma.disponivel_min)}; ${soma.conflitos} dia(s) com sobrecarga. Abrir detalhe por dia`}
        onClick={() => { setModo('dia'); setSemanaInicio(diasDaSemana[0]); }}
      >
        <span>{formatarMinutos(soma.previsto_min)}<span className="text-slate-400">/{formatarMinutos(soma.disponivel_min)}</span></span>
        <small>{pct !== null ? `${pct}%` : ''}{soma.conflitos > 0 ? ` · ${soma.conflitos} dia(s) crítico(s)` : ''}</small>
      </button>
    );
  };

  const totalLinha = (id) => {
    const soma = somarDias(dias.map((d) => linhaDoDia(id, d)).filter(Boolean));
    return id === null
      ? formatarMinutos(soma.previsto_min)
      : `${formatarMinutos(soma.previsto_min)} / ${formatarMinutos(soma.disponivel_min)}`;
  };

  return (
    <div className="execucao-animate-fade-in">
      <div className="cap-toolbar">
        <div className="flex items-center gap-1" role="group" aria-label="Navegar entre semanas">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => irPara(-1)} aria-label="Semana anterior"><FaChevronLeft aria-hidden="true" /></button>
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setSemanaInicio(intervaloSemana().inicio)}>Hoje</button>
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => irPara(1)} aria-label="Próxima semana"><FaChevronRight aria-hidden="true" /></button>
        </div>
        <div className="cap-field">
          <label htmlFor="cap-semana">Semana de</label>
          <input
            id="cap-semana"
            type="date"
            className="execucao-form-input"
            value={semanaInicio}
            onChange={(e) => e.target.value && setSemanaInicio(segundaDa(e.target.value))}
          />
        </div>
        <div className="cap-field">
          <label htmlFor="cap-modo">Visão</label>
          <select id="cap-modo" className="execucao-form-select" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="dia">Dia a dia (semana)</option>
            <option value="semanas">Por semana (próximas {SEMANAS_NA_VISAO})</option>
          </select>
        </div>
        <span className="cfg-muted" aria-live="polite">{formatarDataBR(inicio)} a {formatarDataBR(fim)}{loading ? ' · atualizando…' : ''}</span>
      </div>

      <dl className="cap-resumo">
        <div className="cap-resumo-item"><dt>Horas disponíveis</dt><dd>{formatarMinutos(resumo.disponivel)}</dd></div>
        <div className="cap-resumo-item"><dt>Horas alocadas</dt><dd>{formatarMinutos(resumo.previsto - resumo.emergencia)}</dd></div>
        <div className="cap-resumo-item"><dt>Ocupação</dt><dd>{ocupacao === null ? '—' : `${ocupacao}%`}</dd></div>
        <div className="cap-resumo-item"><dt>Acima da jornada</dt><dd>{formatarMinutos(resumo.acimaJornada)}</dd></div>
        <div className="cap-resumo-item"><dt>Emergência (dia não útil)</dt><dd>{formatarMinutos(resumo.emergencia)}</dd></div>
        <div className="cap-resumo-item"><dt>Sem técnico</dt><dd>{formatarMinutos(resumo.semTecnico)}</dd></div>
      </dl>

      <ul className="cap-legenda" aria-label="Legenda">
        {LEGENDA.map(({ situacao, cor }) => (
          <li key={situacao}><span className="cap-bolinha" style={{ background: cor }} aria-hidden="true" />{SITUACOES[situacao].rotulo}</li>
        ))}
      </ul>

      {!linhas.length ? (
        <EstadoVazio titulo="Sem técnicos ou atividades no período" texto="Cadastre técnicos ou programe atividades para ver a capacidade." />
      ) : (
        <div className="execucao-card">
          <div className="cap-tabela-wrap">
            <table className="cap-tabela">
              <caption className="sr-only">Horas alocadas e disponíveis por colaborador</caption>
              <thead>
                <tr>
                  <th scope="col" className="cap-th-nome">Colaborador</th>
                  {modo === 'dia'
                    ? dias.map((d) => {
                      const c = cabecalhoDia(d);
                      return <th key={d} scope="col">{c.semana}<br />{c.dia}</th>;
                    })
                    : semanas.map((s) => <th key={s[0]} scope="col">Sem. {cabecalhoDia(s[0]).dia}</th>)}
                  <th scope="col" className="cap-th-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((id) => (
                  <tr key={id ?? 'sem-tecnico'}>
                    <th scope="row" className="cap-th-nome text-slate-100">{nomeDe(id)}</th>
                    {modo === 'dia'
                      ? dias.map((d) => <td key={d}>{renderDia(id, d)}</td>)
                      : semanas.map((s) => <td key={s[0]}>{renderSemana(id, s)}</td>)}
                    <td className="cap-total">{totalLinha(id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalhe && isAdminExecucao(usuario) && (
        <DetalheCapacidadeDia
          data={detalhe.dia}
          usuarioId={detalhe.id}
          nomeUsuario={nomeDe(detalhe.id)}
          celula={celulaDetalhe}
          tecnicos={data?.usuarios ?? []}
          capacidadePorUsuario={porUsuario}
          usuarioLogado={usuario}
          onClose={() => setDetalhe(null)}
          onAlterado={reload}
        />
      )}
    </div>
  );
};

export default CapacidadeEquipe;
