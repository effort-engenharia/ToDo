import { addDias, dataLocalISO, formatarDataBR } from '../../../utils/datas';
import { rotuloMotivoPausa } from '../../tecnico/motivosPausa';
import { SAUDE } from './saude';

const SEM_TECNICO = 'Sem técnico';
const STATUS_ATIVIDADE = {
  pendente: 'pendente', em_andamento: 'em andamento', pausada: 'pausada', concluida: 'concluída', atrasada: 'atrasada'
};

// Segunda a domingo da semana que contém `referencia`, deslocada em `semanas`
export const intervaloDaPauta = (semanas = 0, referencia = new Date()) => {
  const dia = referencia.getDay();
  const segunda = addDias(referencia, (dia === 0 ? -6 : 1 - dia) + semanas * 7);
  return { inicio: dataLocalISO(segunda), fim: dataLocalISO(addDias(segunda, 6)) };
};

const nomeEquipe = (etapa, nomes) => {
  const ids = [...new Set([etapa.responsavel_id, ...(etapa.equipe_ids ?? [])].filter(Boolean))];
  const lista = ids.map((id) => (id === etapa.responsavel_id && etapa.responsavel?.nome_completo) || nomes.get(id)).filter(Boolean);
  return lista.join(', ');
};

const entre = (valor, inicio, fim) => Boolean(valor) && valor >= inicio && valor <= fim;

// Organiza os dados da semana na ordem da reunião: problemas, começam, terminam, agenda por técnico, carga, semana passada
export const montarPauta = ({ inicio, fim, obrasAbertas, saude, pendencias, dados, carga, indicadores, nomes }) => {
  const obraPorId = new Map((obrasAbertas ?? []).map((o) => [o.id, o]));

  const problemas = (saude ?? [])
    .filter((s) => s.saude !== 'no_prazo')
    .map((s) => ({
      obra: obraPorId.get(s.obra_id)?.nome_cliente ?? 'Obra',
      saude: s.saude,
      rotulo: SAUDE[s.saude]?.rotulo ?? s.saude,
      motivos: s.motivos ?? [],
      diasAtraso: s.dias_atraso ?? 0
    }))
    .sort((a, b) => (SAUDE[a.saude]?.peso ?? 9) - (SAUDE[b.saude]?.peso ?? 9) || b.diasAtraso - a.diasAtraso);

  const pedidos = (pendencias ?? []).map((a) => ({
    obra: a.etapa?.obra?.nome_cliente ?? 'Obra',
    atividade: a.titulo,
    tecnico: a.tecnico?.nome_completo ?? SEM_TECNICO,
    motivo: a.motivo || ''
  }));

  const etapas = dados.etapas ?? [];
  const comecam = etapas
    .filter((e) => entre(e.data_inicio, inicio, fim))
    .map((e) => {
      const equipe = nomeEquipe(e, nomes);
      return {
        data: e.data_inicio,
        obra: e.obra?.nome_cliente ?? 'Obra',
        etapa: e.nome,
        responsavel: equipe || (e.tipo === 'estoque' ? 'material' : ''),
        semResponsavel: !equipe && e.tipo !== 'estoque'
      };
    });

  const terminam = [
    ...(dados.entregas ?? []).map((o) => ({
      data: o.data_fim_prevista, obra: o.nome_cliente, descricao: 'Entrega prevista da obra', obra_inteira: true
    })),
    ...etapas
      .filter((e) => entre(e.data_fim, inicio, fim))
      .map((e) => ({ data: e.data_fim, obra: e.obra?.nome_cliente ?? 'Obra', descricao: `Término da etapa “${e.nome}”`, obra_inteira: false }))
  ].sort((a, b) => String(a.data).localeCompare(String(b.data)) || Number(b.obra_inteira) - Number(a.obra_inteira));

  const grupos = new Map();
  (dados.atividades ?? []).forEach((a) => {
    const ids = [...new Set([a.tecnico_responsavel_id, ...(a.equipe ?? []).map((e) => e.usuario_id)].filter(Boolean))];
    const donos = ids.length ? ids.map((id) => nomes.get(id) ?? 'Técnico') : [SEM_TECNICO];
    donos.forEach((dono) => {
      if (!grupos.has(dono)) grupos.set(dono, []);
      grupos.get(dono).push({
        data: a.data_programada,
        dataFim: a.data_fim,
        hora: a.hora_inicio ? String(a.hora_inicio).slice(0, 5) : '',
        titulo: a.titulo,
        obra: a.etapa?.obra?.nome_cliente ?? '',
        status: STATUS_ATIVIDADE[a.status] ?? a.status ?? ''
      });
    });
  });
  const porTecnico = [...grupos.entries()]
    .sort((a, b) => (a[0] === SEM_TECNICO) - (b[0] === SEM_TECNICO) || a[0].localeCompare(b[0]))
    .map(([nome, itens]) => ({ nome, itens }));

  let semanaPassada = null;
  if (indicadores) {
    const pontualidade = indicadores.pontualidade ?? {};
    const pausas = indicadores.pausas_por_motivo ?? [];
    semanaPassada = {
      concluidas: pontualidade.concluidas ?? 0,
      noPrazo: pontualidade.no_prazo ?? 0,
      pausasTotal: pausas.reduce((soma, p) => soma + (p.total || 0), 0),
      pausasPorMotivo: pausas.map((p) => ({
        motivo: p.codigo === 'sem_motivo' ? 'sem motivo informado' : (rotuloMotivoPausa(p.codigo) ?? p.codigo),
        total: p.total
      }))
    };
  }

  return {
    inicio,
    fim,
    periodo: `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`,
    problemas,
    pedidos,
    comecam,
    terminam,
    porTecnico,
    carga: carga ?? { tecnicos: [], semTecnicoMin: 0 },
    semanaPassada
  };
};
