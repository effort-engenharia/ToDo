import React, { useMemo, useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { dataLocalISO, formatarDataBR, parseDataLocal } from '../../utils/datas';
import { ROTULO_TIPO_OBRA_TEMPLATE } from './constants';
import { inicioDeHoje } from './utils';
import { COR_SEM_SAUDE, SAUDE, ordenarPorSaude, resumoMotivos } from './visao/saude';
import './visao/visao.css';

const MS_DIA = 1000 * 60 * 60 * 24;
const LARGURA_ROTULO = 270;
const PX_POR_DIA = { semana: 22, mes: 5 };
const MARGEM_DIAS = 7;
const LARGURA_MINIMA_TRILHA = 900; // evita uma linha do tempo minúscula quando há poucas obras
const LIMITE_INICIAL = 100;

const AGRUPAMENTOS = [
  { id: 'nenhum', rotulo: 'Sem agrupamento' },
  { id: 'responsavel', rotulo: 'Responsável' },
  { id: 'tipo', rotulo: 'Tipo de serviço' },
  { id: 'cidade', rotulo: 'Cidade' }
];

const chaveDoGrupo = (obra, agrupar) => {
  switch (agrupar) {
    case 'responsavel': return obra.responsavel?.nome_completo || 'Sem responsável';
    case 'tipo': return ROTULO_TIPO_OBRA_TEMPLATE[obra.tipo_obra] ?? obra.tipo_obra ?? 'Sem tipo';
    case 'cidade': return obra.cidade || 'Sem cidade';
    default: return '';
  }
};

const dias = (a, b) => Math.round((b - a) / MS_DIA);

const corDaObra = (obra, saude) => {
  if (obra.status === 'concluida' || (obra.progresso_geral || 0) >= 100) return '#10b981';
  return SAUDE[saude?.saude]?.cor ?? COR_SEM_SAUDE;
};

// Linha do tempo de todas as obras (item 2.2): como cada obra está, do início ao fim, e quais se sobrepõem
const ResumoVisaoLinhaDoTempo = ({ obras, filtroTipo, saudePorObra, onAbrirObra }) => {
  const [zoom, setZoom] = useState('mes');
  const [agrupar, setAgrupar] = useState('nenhum');
  const [ordenar, setOrdenar] = useState('data');
  const [expandidas, setExpandidas] = useState(() => new Set());
  const [limite, setLimite] = useState(LIMITE_INICIAL);

  const hoje = useMemo(() => inicioDeHoje(), []);
  const pxDia = PX_POR_DIA[zoom];

  const linhas = useMemo(() => {
    const comDatas = obras.filter((o) => o.status !== 'cancelada' && parseDataLocal(o.data_inicio_prevista) && parseDataLocal(o.data_fim_prevista));
    const filtradas = filtroTipo === 'todos'
      ? comDatas
      : comDatas.filter((o) => o.etapas?.some((e) => e.tipo === filtroTipo));
    return ordenar === 'saude' ? ordenarPorSaude(filtradas, saudePorObra) : filtradas;
  }, [obras, filtroTipo, ordenar, saudePorObra]);

  const escala = useMemo(() => {
    if (linhas.length === 0) return null;
    let minimo = hoje;
    let maximo = hoje;
    linhas.forEach((obra) => {
      [obra.data_inicio_prevista, obra.data_inicio_real].forEach((d) => {
        const data = parseDataLocal(d);
        if (data && data < minimo) minimo = data;
      });
      [obra.data_fim_prevista, obra.data_fim_real].forEach((d) => {
        const data = parseDataLocal(d);
        if (data && data > maximo) maximo = data;
      });
    });
    const inicio = new Date(minimo.getFullYear(), minimo.getMonth(), minimo.getDate() - MARGEM_DIAS);
    const diasMinimos = Math.ceil(LARGURA_MINIMA_TRILHA / pxDia);
    const diasAteMaximo = dias(inicio, maximo) + MARGEM_DIAS + 1;
    const fim = new Date(maximo.getFullYear(), maximo.getMonth(), maximo.getDate() + MARGEM_DIAS + Math.max(0, diasMinimos - diasAteMaximo));
    const totalDias = dias(inicio, fim) + 1;

    const meses = [];
    for (let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1); cursor <= fim; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      const ini = cursor < inicio ? inicio : cursor;
      const proximo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const ultimo = new Date(proximo.getFullYear(), proximo.getMonth(), proximo.getDate() - 1);
      const f = ultimo > fim ? fim : ultimo;
      meses.push({
        chave: dataLocalISO(cursor),
        rotulo: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        left: dias(inicio, ini) * pxDia,
        largura: (dias(ini, f) + 1) * pxDia
      });
    }

    const semanas = [];
    if (zoom === 'semana') {
      for (let i = 0; i < totalDias; i += 1) {
        const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        if (data.getDay() === 1) semanas.push({ chave: dataLocalISO(data), rotulo: `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`, left: i * pxDia });
      }
    }

    return { inicio, totalDias, largura: totalDias * pxDia, meses, semanas, hojeX: dias(inicio, hoje) * pxDia + pxDia / 2 };
  }, [linhas, hoje, pxDia, zoom]);

  const grupos = useMemo(() => {
    if (agrupar === 'nenhum') return [{ chave: '', obras: linhas }];
    const mapa = new Map();
    linhas.forEach((obra) => {
      const chave = chaveDoGrupo(obra, agrupar);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(obra);
    });
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([chave, lista]) => ({ chave, obras: lista }));
  }, [linhas, agrupar]);

  const alternar = (id) => setExpandidas((atual) => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    return novo;
  });

  if (!escala) {
    return (
      <div className="execucao-card text-center py-12">
        <h3 className="text-lg font-medium text-slate-400 mb-2">Nenhuma obra com datas no período</h3>
        <p className="text-slate-500">Ajuste o período ou a equipe para ver a linha do tempo.</p>
      </div>
    );
  }

  const posicao = (inicioISO, fimISO) => {
    const ini = parseDataLocal(inicioISO);
    const fim = parseDataLocal(fimISO);
    if (!ini || !fim) return null;
    return { left: dias(escala.inicio, ini) * pxDia, width: Math.max(pxDia, (dias(ini, fim) + 1) * pxDia) };
  };

  let restante = limite;

  return (
    <div className="execucao-card visao-timeline">
      <div className="visao-timeline-controles">
        <div className="flex items-center bg-slate-800 rounded-lg p-1" role="group" aria-label="Escala da linha do tempo">
          {['semana', 'mes'].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={zoom === id}
              onClick={() => setZoom(id)}
              className={`px-3 py-1 rounded-md text-sm ${zoom === id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {id === 'semana' ? 'Semanas' : 'Meses'}
            </button>
          ))}
        </div>
        <label className="text-sm text-slate-400 flex items-center gap-2">
          Agrupar por
          <select className="execucao-form-select text-sm py-1" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
            {AGRUPAMENTOS.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-400 flex items-center gap-2">
          Ordenar
          <select className="execucao-form-select text-sm py-1" value={ordenar} onChange={(e) => setOrdenar(e.target.value)}>
            <option value="data">Por início</option>
            <option value="saude">Piores primeiro</option>
          </select>
        </label>
        <span className="text-xs text-slate-400">{linhas.length} obra(s)</span>
      </div>

      <div className="visao-timeline-rolagem">
        <div className="visao-timeline-corpo" style={{ width: LARGURA_ROTULO + escala.largura }}>
          <div className="visao-timeline-cabecalho">
            <div className="visao-timeline-rotulo visao-timeline-rotulo-cab" style={{ width: LARGURA_ROTULO }}>Obra</div>
            <div className="visao-timeline-trilha" style={{ width: escala.largura }}>
              {escala.meses.map((m) => (
                <div key={m.chave} className="visao-timeline-mes" style={{ left: m.left, width: m.largura }}>{m.rotulo}</div>
              ))}
              {escala.semanas.map((s) => (
                <div key={s.chave} className="visao-timeline-semana" style={{ left: s.left }}>{s.rotulo}</div>
              ))}
            </div>
          </div>

          <div className="visao-timeline-linhas">
            <div
              className="visao-timeline-hoje"
              style={{ left: LARGURA_ROTULO + escala.hojeX }}
              aria-hidden="true"
            >
              <span>HOJE</span>
            </div>

            {grupos.map((grupo) => {
              const visiveis = grupo.obras.slice(0, Math.max(0, restante));
              restante -= visiveis.length;
              if (visiveis.length === 0) return null;
              return (
                <React.Fragment key={grupo.chave || 'todas'}>
                  {agrupar !== 'nenhum' && (
                    <div className="visao-timeline-grupo">{grupo.chave} <span className="text-slate-500">({grupo.obras.length})</span></div>
                  )}
                  {visiveis.map((obra) => {
                    const saude = saudePorObra.get(obra.id);
                    const cor = corDaObra(obra, saude);
                    const barra = posicao(obra.data_inicio_prevista, obra.data_fim_prevista);
                    const realInicio = obra.data_inicio_real;
                    const realFim = obra.data_fim_real || (obra.status === 'concluida' ? null : dataLocalISO(hoje));
                    const real = realInicio && realFim ? posicao(realInicio, realFim < realInicio ? realInicio : realFim) : null;
                    const aberta = expandidas.has(obra.id);
                    const etapas = aberta
                      ? [...(obra.etapas ?? [])]
                        .filter((e) => !e.etapa_pai_id && (filtroTipo === 'todos' || e.tipo === filtroTipo))
                        .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''))
                      : [];
                    return (
                      <React.Fragment key={obra.id}>
                        <div className="visao-timeline-linha">
                          <div className="visao-timeline-rotulo" style={{ width: LARGURA_ROTULO }}>
                            <button
                              type="button"
                              className="visao-icone"
                              onClick={() => alternar(obra.id)}
                              aria-expanded={aberta}
                              aria-label={`${aberta ? 'Recolher' : 'Expandir'} etapas de ${obra.nome_cliente}`}
                              disabled={!obra.etapas?.length}
                            >
                              {aberta ? <FaChevronDown size={10} aria-hidden="true" /> : <FaChevronRight size={10} aria-hidden="true" />}
                            </button>
                            <span title={saude ? resumoMotivos(saude) : undefined} aria-hidden="true">{SAUDE[saude?.saude]?.emoji ?? '▫️'}</span>
                            <button
                              type="button"
                              className="visao-timeline-nome"
                              onClick={() => onAbrirObra(obra.id)}
                              title={`Abrir ${obra.nome_cliente}`}
                            >
                              {obra.nome_cliente}
                            </button>
                            {saude?.saude === 'atrasada' && saude.dias_atraso > 0 && (
                              <span className="text-[11px] text-red-300 whitespace-nowrap">{saude.dias_atraso}d</span>
                            )}
                            {saude?.replanejamento > 0 && <span title="Pedido de replanejamento do técnico" aria-label="Pedido de replanejamento">⚠</span>}
                          </div>
                          <div className="visao-timeline-trilha" style={{ width: escala.largura }}>
                            {barra && (
                              <div
                                className="visao-timeline-barra"
                                style={{ left: barra.left, width: barra.width, background: cor }}
                                title={`${obra.nome_cliente}\nPrevisto: ${formatarDataBR(obra.data_inicio_prevista)} – ${formatarDataBR(obra.data_fim_prevista)}\nProgresso: ${obra.progresso_geral || 0}%${saude ? `\n${resumoMotivos(saude)}` : ''}`}
                              >
                                <div className="visao-timeline-progresso" style={{ width: `${obra.progresso_geral || 0}%` }} />
                                <span className="visao-timeline-pct">{obra.progresso_geral || 0}%</span>
                              </div>
                            )}
                            {real && (
                              <div
                                className={`visao-timeline-real ${obra.data_fim_real ? '' : 'visao-timeline-real-curso'}`}
                                style={{ left: real.left, width: real.width }}
                                title={`Realizado: ${formatarDataBR(realInicio)} – ${obra.data_fim_real ? formatarDataBR(obra.data_fim_real) : 'em andamento'}`}
                              />
                            )}
                          </div>
                        </div>
                        {etapas.map((etapa) => {
                          const pos = posicao(etapa.data_inicio, etapa.data_fim);
                          return (
                            <div className="visao-timeline-linha visao-timeline-linha-etapa" key={etapa.id}>
                              <div className="visao-timeline-rotulo visao-timeline-rotulo-etapa" style={{ width: LARGURA_ROTULO }} title={etapa.nome}>
                                ↳ {etapa.nome}
                              </div>
                              <div className="visao-timeline-trilha" style={{ width: escala.largura }}>
                                {pos && (
                                  <div
                                    className="visao-timeline-barra visao-timeline-barra-etapa"
                                    style={{ left: pos.left, width: pos.width, background: cor }}
                                    title={`${etapa.nome}: ${formatarDataBR(etapa.data_inicio)} – ${formatarDataBR(etapa.data_fim)} (${etapa.progresso || 0}%)`}
                                  >
                                    <div className="visao-timeline-progresso" style={{ width: `${etapa.progresso || 0}%` }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {linhas.length > limite && (
        <div className="text-center mt-3">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setLimite((n) => n + LIMITE_INICIAL)}>
            Mostrar mais ({linhas.length - limite} restantes)
          </button>
        </div>
      )}

      <div className="visao-timeline-legenda">
        {Object.entries(SAUDE).map(([id, s]) => (
          <span key={id}><i style={{ background: s.cor }} /> {s.rotulo}</span>
        ))}
        <span><i style={{ background: '#10b981' }} /> Concluída</span>
        <span><i style={{ background: COR_SEM_SAUDE }} /> Sem avaliação</span>
        <span><i className="visao-legenda-real" /> Realizado</span>
        <span className="text-slate-400">Preenchimento escuro = progresso</span>
      </div>
    </div>
  );
};

export default React.memo(ResumoVisaoLinhaDoTempo);
