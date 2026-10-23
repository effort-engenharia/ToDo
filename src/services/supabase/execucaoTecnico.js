import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';
import { dataLocalISO } from '../../features/execucao/utils/datas.js';

const SEM_ID = '00000000-0000-0000-0000-000000000000';
const STATUS_ABERTOS = 'pendente,em_andamento,pausada';

const SELECT_BASE = `
  *,
  tecnico:usuarios!tecnico_responsavel_id(id, nome_completo),
  criador:usuarios!created_by(id, nome_completo),
  equipe:execucao_atividades_equipe(usuario_id, papel, horas_previstas, usuario:usuarios(id, nome_completo))
`;

// A obra (contato/endereço) só é legível para quem tem acesso a execucao_obras; para os demais vem nula.
const SELECT_COM_OBRA = `
  ${SELECT_BASE},
  etapa:execucao_obras_etapas(id, obra_id, obra:execucao_obras(id, nome_cliente, contato_cliente, endereco, cidade))
`;

// Notificações do usuário: técnico vê só as endereçadas a ele; admin vê as gerais (sem destinatário) e as suas
const filtroDestinatario = (usuarioId, isAdmin) =>
  (isAdmin ? `destinatario_id.is.null,destinatario_id.eq.${usuarioId}` : `destinatario_id.eq.${usuarioId}`);

// Cliente/endereço/cidade/contato da obra via RPC (o RLS de execucao_obras bloqueia o join para técnico).
// Falha aqui nunca impede de listar atividades: devolve {} e fica o join/dados da própria atividade.
async function buscarContexto(ids) {
  if (!ids?.length) return {};
  try {
    const { data, error } = await supabase.rpc('execucao_contexto_atividades', { p_ids: ids });
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.atividade_id, r]));
  } catch (error) {
    console.warn('Contexto das atividades indisponível, usando dados da própria atividade.', error);
    return {};
  }
}

const comContexto = (atividades, contexto) =>
  atividades.map((a) => (contexto[a.id] ? { ...a, contexto: contexto[a.id] } : a));

const _execucaoTecnicoService = {
  async buscarContextoAtividades(atividadeIds) {
    return { success: true, data: await buscarContexto(atividadeIds) };
  },

  // Anexa `contexto` às atividades de uma lista já carregada
  async anexarContexto(atividades) {
    return comContexto(atividades, await buscarContexto(atividades.map((a) => a.id)));
  },

  // Atividades de hoje + atrasadas (em aberto de dias anteriores) + próximo dia com atividades
  async buscarMeuDia(usuarioId, hoje = dataLocalISO()) {
    try {
      const { data: vinculos } = await supabase
        .from('execucao_atividades_equipe')
        .select('atividade_id')
        .eq('usuario_id', usuarioId);
      const idsDaEquipe = (vinculos ?? []).map((v) => v.atividade_id).join(',') || SEM_ID;
      const filtroUsuario = `tecnico_responsavel_id.eq.${usuarioId},id.in.(${idsDaEquipe})`;

      const consultar = async (select) => {
        const [dia, proximas] = await Promise.all([
          supabase
            .from('execucao_atividades')
            .select(select)
            .or(filtroUsuario)
            .or(`data_programada.eq.${hoje},and(data_programada.lt.${hoje},status.in.(${STATUS_ABERTOS}))`)
            .order('data_programada', { ascending: true })
            .order('hora_inicio', { ascending: true, nullsFirst: false }),
          supabase
            .from('execucao_atividades')
            .select(select)
            .or(filtroUsuario)
            .gt('data_programada', hoje)
            .in('status', STATUS_ABERTOS.split(','))
            .order('data_programada', { ascending: true })
            .order('hora_inicio', { ascending: true, nullsFirst: false })
            .limit(30)
        ]);
        if (dia.error) throw dia.error;
        if (proximas.error) throw proximas.error;
        return { dia: dia.data ?? [], proximas: proximas.data ?? [] };
      };

      let resultado;
      try {
        resultado = await consultar(SELECT_COM_OBRA);
      } catch (erroComObra) {
        console.warn('Meu dia: consulta com obra falhou, usando consulta básica.', erroComObra);
        resultado = await consultar(SELECT_BASE);
      }

      const contexto = await buscarContexto(resultado.dia.map((a) => a.id));
      const ativas = comContexto(
        resultado.dia.filter((a) => a.status !== 'cancelada' && a.status !== 'transferida'),
        contexto
      );
      const primeiroDia = resultado.proximas[0]?.data_programada ?? null;
      return {
        success: true,
        data: {
          atividades: ativas,
          proximoDia: primeiroDia
            ? { data: primeiroDia, atividades: resultado.proximas.filter((a) => a.data_programada === primeiroDia) }
            : null
        }
      };
    } catch (error) {
      console.error('Erro ao buscar o dia do técnico:', error);
      return { success: false, message: error.message };
    }
  },

  async buscarAtividadePorId(id) {
    try {
      const consultar = (select) => supabase.from('execucao_atividades').select(select).eq('id', id).maybeSingle();
      let { data, error } = await consultar(SELECT_COM_OBRA);
      if (error) ({ data, error } = await consultar(SELECT_BASE));
      if (error) throw error;
      if (data) data = comContexto([data], await buscarContexto([data.id]))[0];
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao buscar atividade:', error);
      return { success: false, message: error.message };
    }
  },

  // Equipe (com nomes) de várias atividades: { [atividadeId]: [{ usuario_id, papel, horas_previstas, usuario }] }
  async buscarEquipes(atividadeIds) {
    try {
      if (!atividadeIds?.length) return { success: true, data: {} };
      const { data, error } = await supabase
        .from('execucao_atividades_equipe')
        .select('atividade_id, usuario_id, papel, horas_previstas, usuario:usuarios(id, nome_completo)')
        .in('atividade_id', atividadeIds);
      if (error) throw error;
      const porAtividade = {};
      for (const linha of data ?? []) (porAtividade[linha.atividade_id] ??= []).push(linha);
      return { success: true, data: porAtividade };
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
      return { success: false, message: error.message, data: {} };
    }
  },

  // Situação do material por atividade: { [id]: { situacao, data_disponivel, pedidos } }
  async buscarStatusMaterial(atividadeIds) {
    try {
      if (!atividadeIds?.length) return { success: true, data: {} };
      const { data, error } = await supabase.rpc('execucao_material_status', { p_atividade_ids: atividadeIds });
      if (error) throw error;
      return { success: true, data: Object.fromEntries((data ?? []).map((r) => [r.atividade_id, r])) };
    } catch (error) {
      console.error('Erro ao buscar status do material:', error);
      return { success: false, message: error.message, data: {} };
    }
  },

  // Minutos líquidos de jornada do dia (0 em fim de semana/feriado/ausência)
  async buscarJornadaDia(usuarioId, data = dataLocalISO()) {
    try {
      const { data: linhas, error } = await supabase.rpc('execucao_jornada_dia', { p_usuario: usuarioId, p_data: data });
      if (error) throw error;
      const linha = Array.isArray(linhas) ? linhas[0] : linhas;
      if (!linha) return { success: true, data: null };
      return {
        success: true,
        data: {
          minutos: linha.minutos_liquidos ?? 0,
          extraMaxMin: linha.extra_max_min ?? 0,
          diaUtil: !!linha.dia_util,
          feriado: !!linha.feriado,
          ausente: !!linha.ausente
        }
      };
    } catch (error) {
      console.error('Erro ao buscar jornada do dia:', error);
      return { success: false, message: error.message };
    }
  },

  // Horas extras/emergências do técnico ainda sem decisão do gestor
  async buscarHorasExtrasPendentes(usuarioId) {
    try {
      const { count, error } = await supabase
        .from('execucao_horas_extras')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .eq('status', 'pendente');
      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Erro ao buscar horas extras pendentes:', error);
      return { success: false, count: 0 };
    }
  },

  // "Falta de material": cria o pedido pendente (urgência alta), avisa o admin e opcionalmente pausa a atividade
  async criarFaltaMaterial(atividadeId, descricao, { pausar = true, ocorridoEm = null, idCliente = null } = {}) {
    try {
      const { data, error } = await supabase.rpc('reportar_falta_material', {
        p_atividade_id: atividadeId,
        p_descricao: descricao,
        p_pausar: pausar,
        p_ocorrido_em: ocorridoEm,
        p_id_cliente: idCliente
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao reportar falta de material:', error);
      return { success: false, message: error.message };
    }
  },

  // ---------- Notificações do usuário logado ----------
  async buscarNotificacoesUsuario(usuarioId, { isAdmin = false, limite = 20 } = {}) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .select(`
          *,
          atividade:execucao_atividades(id, titulo, status),
          usuario_origem:usuarios!usuario_origem_id(id, nome_completo)
        `)
        .or(filtroDestinatario(usuarioId, isAdmin))
        .order('lida', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao buscar notificações do usuário:', error);
      return { success: false, message: error.message };
    }
  },

  async contarNotificacoesUsuario(usuarioId, { isAdmin = false } = {}) {
    try {
      const { count, error } = await supabase
        .from('execucao_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
        .or(filtroDestinatario(usuarioId, isAdmin));
      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Erro ao contar notificações do usuário:', error);
      return { success: false, count: 0 };
    }
  },

  async marcarNotificacoesUsuarioLidas(usuarioId, { isAdmin = false } = {}) {
    try {
      const { data, error } = await supabase
        .from('execucao_notificacoes')
        .update({ lida: true, lida_em: new Date().toISOString(), lida_por: usuarioId })
        .eq('lida', false)
        .or(filtroDestinatario(usuarioId, isAdmin))
        .select('id');
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      return { success: false, message: error.message };
    }
  }
};

export const execucaoTecnicoService = wrapServiceWithImpersonationGuard(_execucaoTecnicoService, {
  label: 'execucaoTecnicoService'
});

export default execucaoTecnicoService;
