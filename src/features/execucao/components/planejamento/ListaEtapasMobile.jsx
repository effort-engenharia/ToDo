import React, { useId, useMemo, useState } from 'react';
import { FaCalendarPlus, FaChevronDown, FaChevronRight, FaEdit, FaForward, FaPlus, FaProjectDiagram, FaTrash } from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import { formatarHoras } from '../../utils/formatos';
import { estadoEtapa, passosPendentesDaEtapa } from './estadoEtapa';
import SeloPassosPendentes from './SeloPassosPendentes';
import { IconeTipoEtapa } from './icones';
import { inicioDeHoje } from './utils';
import { desvioEmDiasUteis, textoDesvio } from './visao/datasPrevistoRealizado';

const LIMITE_INICIAL = 30;

const COR_PROGRESSO = {
  concluida: 'bg-emerald-600',
  atrasada: 'bg-red-600',
  em_andamento: 'bg-sky-600',
  pausada: 'bg-orange-600',
  planejada: 'bg-indigo-500'
};

const BOTAO_ACAO = 'execucao-btn execucao-btn-secondary plan-toque w-full justify-start text-left';

const porOrdemEData = (a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.data_inicio || '').localeCompare(String(b.data_inicio || ''));

// Cartão de uma etapa (ou sub-etapa) para telas estreitas
const CartaoEtapa = ({
  etapa, estado, sub = false, subEtapas = [], horas, aberta, onAlternarAcoes, passosPendentes = 0,
  subVisiveis, onAlternarSub, onEditEtapa, onDeleteEtapa, onAddAtividade, onAddSubEtapa, onReprogramar, children
}) => {
  const idAcoes = useId();
  const desvioInicio = etapa.data_inicio_real ? desvioEmDiasUteis(etapa.data_inicio, etapa.data_inicio_real) : null;
  const progresso = etapa.progresso || 0;
  const tipo = sub ? 'sub-etapa' : 'etapa';

  return (
    <li className={`rounded-xl border border-slate-700 bg-slate-800/60 p-3 ${sub ? 'border-l-4 border-l-purple-500 ml-3' : ''}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0"><IconeTipoEtapa tipo={etapa.tipo} size={12} /></span>
        <div className="min-w-0 flex-1 plan-quebra">
          <div className="text-base font-medium text-white">{sub ? '↳ ' : ''}{etapa.nome}</div>
          <div className="text-xs text-slate-300">
            📅 {formatarDataBR(etapa.data_inicio)} – {formatarDataBR(etapa.data_fim)}
            {etapa.responsavel?.nome_completo && <> · 👤 {etapa.responsavel.nome_completo}</>}
          </div>
        </div>
        {!sub && subEtapas.length > 0 && (
          <button
            type="button"
            onClick={onAlternarSub}
            className="plan-toque shrink-0 gap-1 rounded-lg px-2 text-xs text-slate-200 hover:bg-slate-700"
            aria-expanded={subVisiveis}
            aria-label={`${subVisiveis ? 'Ocultar' : 'Mostrar'} sub-etapas de ${etapa.nome}`}
          >
            {subVisiveis ? <FaChevronDown size={10} aria-hidden="true" /> : <FaChevronRight size={10} aria-hidden="true" />}
            {subEtapas.length} sub
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="shrink-0 text-xs font-semibold text-slate-100">{estado.emoji} {estado.rotulo}</span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progresso}
          aria-label={`Progresso de ${etapa.nome}`}
        >
          <div className={`h-full ${COR_PROGRESSO[estado.id]}`} style={{ width: `${Math.min(100, progresso)}%` }} />
        </div>
        <span className="shrink-0 text-xs font-bold text-slate-100">{progresso}%</span>
      </div>
      <SeloPassosPendentes quantidade={passosPendentes} className="mt-2" />

      {(etapa.data_inicio_real || horas?.previstas > 0) && (
        <div className="mt-1 text-xs text-slate-300">
          {horas?.previstas > 0 && <span>⏱ {formatarHoras(horas.realizadas)}/{formatarHoras(horas.previstas)}</span>}
          {horas?.previstas > 0 && etapa.data_inicio_real ? ' · ' : ''}
          {etapa.data_inicio_real && <span>início real {formatarDataBR(etapa.data_inicio_real)} ({textoDesvio(desvioInicio)})</span>}
        </div>
      )}

      <button
        type="button"
        className="execucao-btn execucao-btn-secondary plan-toque mt-2 w-full"
        aria-expanded={aberta}
        aria-controls={idAcoes}
        onClick={onAlternarAcoes}
      >
        Ações {aberta ? '▴' : '▾'}
        <span className="sr-only"> de {etapa.nome}</span>
      </button>
      {aberta && (
        <div id={idAcoes} className="mt-2 grid grid-cols-2 gap-2">
          {!sub && (
            <button type="button" className={BOTAO_ACAO} onClick={() => onAddSubEtapa?.(etapa)} aria-label={`Adicionar sub-etapa a ${etapa.nome}`}>
              <FaPlus size={11} aria-hidden="true" /> Sub-etapa
            </button>
          )}
          <button type="button" className={BOTAO_ACAO} onClick={() => onAddAtividade(etapa)} aria-label={`Criar atividade na agenda para ${etapa.nome}`}>
            <FaCalendarPlus size={12} aria-hidden="true" /> Atividade
          </button>
          <button type="button" className={BOTAO_ACAO} onClick={() => onEditEtapa(etapa)} aria-label={`Editar ${tipo} ${etapa.nome}`}>
            <FaEdit size={12} aria-hidden="true" /> Editar
          </button>
          {!sub && onReprogramar && etapa.status !== 'concluida' && (
            <button type="button" className={BOTAO_ACAO} onClick={() => onReprogramar(etapa)} aria-label={`Empurrar etapas seguintes a ${etapa.nome}`}>
              <FaForward size={12} aria-hidden="true" /> Empurrar
            </button>
          )}
          <button
            type="button"
            className={`${BOTAO_ACAO} !text-red-300`}
            onClick={() => onDeleteEtapa(etapa.id)}
            aria-label={`Excluir ${tipo} ${etapa.nome}`}
          >
            <FaTrash size={12} aria-hidden="true" /> Excluir
          </button>
        </div>
      )}
      {children}
    </li>
  );
};

// Cronograma da obra em lista de cartões (<640px; o Gantt só a partir daí)
const ListaEtapasMobile = ({
  obra, onEditEtapa, onDeleteEtapa, onAddAtividade, onAddSubEtapa, onReprogramar, onAdicionarEtapa, horasPorEtapa, passosPorEtapa
}) => {
  const [filtro, setFiltro] = useState('todas'); // todas | em_andamento | atrasada
  const [acoesAbertas, setAcoesAbertas] = useState(null); // id da etapa com as ações visíveis
  const [subAbertas, setSubAbertas] = useState(() => new Set());
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const titulo = useId();
  const hoje = inicioDeHoje();

  const { pais, subPorPai } = useMemo(() => {
    const etapas = obra.etapas || [];
    const subs = {};
    etapas.filter((e) => e.etapa_pai_id).forEach((s) => { (subs[s.etapa_pai_id] ||= []).push(s); });
    Object.values(subs).forEach((lista) => lista.sort(porOrdemEData));
    return { pais: etapas.filter((e) => !e.etapa_pai_id).sort(porOrdemEData), subPorPai: subs };
  }, [obra.etapas]);

  const itens = pais.map((etapa) => ({ etapa, estado: estadoEtapa(etapa, hoje) }));
  const totalAtrasadas = itens.filter((i) => i.estado.id === 'atrasada').length;
  const filtrados = itens.filter((i) => filtro === 'todas' || i.estado.id === filtro);
  const visiveis = filtrados.slice(0, limite);

  const alternarSub = (id) => setSubAbertas((prev) => {
    const novo = new Set(prev);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });
  const alternarAcoes = (id) => setAcoesAbertas((atual) => (atual === id ? null : id));

  if (pais.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-slate-300">
        <p className="mb-3">Nenhuma etapa cadastrada.</p>
        <button type="button" className="execucao-btn execucao-btn-secondary plan-toque w-full" onClick={() => onAdicionarEtapa(obra)}>
          <FaPlus size={10} aria-hidden="true" /> Adicionar Etapa
        </button>
      </div>
    );
  }

  const chips = [
    ['todas', 'Todas'],
    ['em_andamento', 'Em andamento'],
    ['atrasada', `Atrasadas${totalAtrasadas ? ` ${totalAtrasadas}` : ''}`]
  ];

  return (
    <section aria-labelledby={titulo}>
      <h4 id={titulo} className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <FaProjectDiagram className="text-sky-300" aria-hidden="true" /> Cronograma · {pais.length} {pais.length === 1 ? 'etapa' : 'etapas'}
      </h4>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar etapas">
        {chips.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filtro === id}
            onClick={() => setFiltro(id)}
            className={`plan-toque rounded-full border px-3 text-sm ${filtro === id ? 'border-sky-400 bg-sky-700 text-white' : 'border-slate-600 text-slate-200'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-300">Nenhuma etapa neste filtro.</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label={`Etapas de ${obra.nome_cliente}`}>
          {visiveis.map(({ etapa, estado }) => {
            const subs = subPorPai[etapa.id] || [];
            const subVisiveis = subAbertas.has(etapa.id);
            return (
              <CartaoEtapa
                key={etapa.id}
                etapa={etapa}
                estado={estado}
                subEtapas={subs}
                passosPendentes={passosPendentesDaEtapa(passosPorEtapa, etapa.id)}
                horas={horasPorEtapa?.[etapa.id]}
                aberta={acoesAbertas === etapa.id}
                onAlternarAcoes={() => alternarAcoes(etapa.id)}
                subVisiveis={subVisiveis}
                onAlternarSub={() => alternarSub(etapa.id)}
                onEditEtapa={onEditEtapa}
                onDeleteEtapa={onDeleteEtapa}
                onAddAtividade={onAddAtividade}
                onAddSubEtapa={onAddSubEtapa}
                onReprogramar={onReprogramar}
              >
                {subVisiveis && (
                  <ol className="mt-3 flex flex-col gap-2" aria-label={`Sub-etapas de ${etapa.nome}`}>
                    {subs.map((sub) => (
                      <CartaoEtapa
                        key={sub.id}
                        etapa={sub}
                        sub
                        estado={estadoEtapa(sub, hoje)}
                        horas={horasPorEtapa?.[sub.id]}
                        aberta={acoesAbertas === sub.id}
                        onAlternarAcoes={() => alternarAcoes(sub.id)}
                        onEditEtapa={onEditEtapa}
                        onDeleteEtapa={onDeleteEtapa}
                        onAddAtividade={onAddAtividade}
                      />
                    ))}
                  </ol>
                )}
              </CartaoEtapa>
            );
          })}
        </ol>
      )}

      {filtrados.length > visiveis.length && (
        <button type="button" className="execucao-btn execucao-btn-secondary plan-toque mt-3 w-full" onClick={() => setLimite((n) => n + LIMITE_INICIAL)}>
          Mostrar mais ({filtrados.length - visiveis.length} restantes)
        </button>
      )}
    </section>
  );
};

export default React.memo(ListaEtapasMobile);
