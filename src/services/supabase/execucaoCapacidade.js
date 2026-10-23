import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';
import { mensagemErro } from '../../features/execucao/utils/formatos.js';

// Executa a consulta e devolve o formato padrão { success, data } / { success: false, message }
async function executar(contexto, fn) {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`Erro em ${contexto}:`, error);
    return { success: false, message: mensagemErro(error) };
  }
}

const lerOuFalhar = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// Cidades, feriados, jornadas, ausências, horas extras, capacidade e indicadores do módulo Execução.
// Métodos de escrita usam os prefixos criar/atualizar/excluir/salvar/aprovar/cancelar (bloqueados em impersonation).
const _execucaoCapacidadeService = {
  // ---------- Cidades ----------
  buscarCidades() {
    return executar('buscarCidades', async () =>
      lerOuFalhar(await supabase.from('execucao_cidades').select('*').order('nome')));
  },

  criarCidade({ nome, uf = 'SP' }) {
    return executar('criarCidade', async () =>
      lerOuFalhar(await supabase.from('execucao_cidades').insert({ nome: nome.trim(), uf: uf.toUpperCase() }).select().single()));
  },

  atualizarCidade(id, dados) {
    return executar('atualizarCidade', async () =>
      lerOuFalhar(await supabase.from('execucao_cidades').update(dados).eq('id', id).select().single()));
  },

  excluirCidade(id) {
    return executar('excluirCidade', async () =>
      lerOuFalhar(await supabase.from('execucao_cidades').delete().eq('id', id)));
  },

  // ---------- Feriados ----------
  buscarFeriados(ano) {
    return executar('buscarFeriados', async () =>
      lerOuFalhar(await supabase
        .from('execucao_feriados')
        .select('*, cidade:execucao_cidades(id, nome)')
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data')
        .order('descricao')));
  },

  criarFeriado(feriado) {
    return executar('criarFeriado', async () =>
      lerOuFalhar(await supabase.from('execucao_feriados').insert(feriado).select().single()));
  },

  criarFeriadosEmLote(feriados) {
    return executar('criarFeriadosEmLote', async () => {
      if (!feriados.length) return [];
      return lerOuFalhar(await supabase.from('execucao_feriados').insert(feriados).select('id'));
    });
  },

  atualizarFeriado(id, dados) {
    return executar('atualizarFeriado', async () =>
      lerOuFalhar(await supabase.from('execucao_feriados').update(dados).eq('id', id).select().single()));
  },

  excluirFeriado(id) {
    return executar('excluirFeriado', async () =>
      lerOuFalhar(await supabase.from('execucao_feriados').delete().eq('id', id)));
  },

  // ---------- Modelos de jornada ----------
  buscarJornadasModelo() {
    return executar('buscarJornadasModelo', async () =>
      lerOuFalhar(await supabase.from('execucao_jornadas_modelo').select('*').order('nome').order('vigente_desde', { ascending: false })));
  },

  criarJornadaModelo(modelo) {
    return executar('criarJornadaModelo', async () =>
      lerOuFalhar(await supabase.from('execucao_jornadas_modelo').insert(modelo).select().single()));
  },

  atualizarJornadaModelo(id, dados) {
    return executar('atualizarJornadaModelo', async () =>
      lerOuFalhar(await supabase.from('execucao_jornadas_modelo').update(dados).eq('id', id).select().single()));
  },

  excluirJornadaModelo(id) {
    return executar('excluirJornadaModelo', async () =>
      lerOuFalhar(await supabase.from('execucao_jornadas_modelo').delete().eq('id', id)));
  },

  // ---------- Jornada por colaborador ----------
  buscarJornadasColaborador() {
    return executar('buscarJornadasColaborador', async () =>
      lerOuFalhar(await supabase.from('execucao_jornadas_colaborador').select('*').order('vigente_desde', { ascending: false })));
  },

  salvarJornadaColaborador(registro) {
    return executar('salvarJornadaColaborador', async () =>
      lerOuFalhar(await supabase
        .from('execucao_jornadas_colaborador')
        .upsert(registro, { onConflict: 'usuario_id,vigente_desde' })
        .select()
        .single()));
  },

  excluirJornadaColaborador(usuarioId, vigenteDesde) {
    return executar('excluirJornadaColaborador', async () =>
      lerOuFalhar(await supabase
        .from('execucao_jornadas_colaborador')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('vigente_desde', vigenteDesde)));
  },

  // ---------- Ausências ----------
  // Ausências que se sobrepõem ao período informado
  buscarAusencias({ inicio, fim, usuarioId } = {}) {
    return executar('buscarAusencias', async () => {
      let query = supabase.from('execucao_ausencias').select('*').order('data_inicio', { ascending: false });
      if (inicio) query = query.gte('data_fim', inicio);
      if (fim) query = query.lte('data_inicio', fim);
      if (usuarioId) query = query.eq('usuario_id', usuarioId);
      return lerOuFalhar(await query);
    });
  },

  criarAusencia(ausencia) {
    return executar('criarAusencia', async () =>
      lerOuFalhar(await supabase.from('execucao_ausencias').insert(ausencia).select().single()));
  },

  atualizarAusencia(id, dados) {
    return executar('atualizarAusencia', async () =>
      lerOuFalhar(await supabase.from('execucao_ausencias').update(dados).eq('id', id).select().single()));
  },

  excluirAusencia(id) {
    return executar('excluirAusencia', async () =>
      lerOuFalhar(await supabase.from('execucao_ausencias').delete().eq('id', id)));
  },

  // ---------- Capacidade ----------
  // Linhas por colaborador e dia (usuario_id nulo = atividades sem técnico). Minutos.
  buscarCapacidade(inicio, fim) {
    return executar('buscarCapacidade', async () =>
      lerOuFalhar(await supabase.rpc('execucao_capacidade', { p_inicio: inicio, p_fim: fim })));
  },

  // Atividades (não canceladas) que ocupam o dia; o filtro por técnico é feito pelo chamador
  buscarAtividadesDoDiaCapacidade(data) {
    return executar('buscarAtividadesDoDiaCapacidade', async () =>
      lerOuFalhar(await supabase
        .from('execucao_atividades')
        .select(`
          id, titulo, tipo_execucao, status, data_programada, data_fim, hora_inicio, horas_previstas,
          tecnico_responsavel_id,
          etapa:execucao_obras_etapas(nome, obra:execucao_obras(nome_cliente)),
          equipe:execucao_atividades_equipe(usuario_id, papel)
        `)
        .neq('status', 'cancelada')
        .lte('data_programada', data)
        .or(`data_fim.gte.${data},and(data_fim.is.null,data_programada.eq.${data})`)
        .order('hora_inicio', { nullsFirst: false })
        .order('titulo')));
  },

  // ---------- Horas extras e emergências ----------
  buscarHorasExtras({ status, inicio, fim, usuarioId, tipo, limite = 300 } = {}) {
    return executar('buscarHorasExtras', async () => {
      let query = supabase
        .from('execucao_horas_extras')
        .select(`
          *,
          usuario:usuarios!usuario_id(id, nome_completo),
          registrador:usuarios!registrado_por(id, nome_completo),
          decisor:usuarios!decidido_por(id, nome_completo),
          atividade:execucao_atividades(titulo, etapa:execucao_obras_etapas(obra:execucao_obras(nome_cliente)))
        `)
        .order('data', { ascending: status === 'pendente' })
        .order('created_at', { ascending: false })
        .limit(limite);
      if (status) query = query.eq('status', status);
      if (inicio) query = query.gte('data', inicio);
      if (fim) query = query.lte('data', fim);
      if (usuarioId) query = query.eq('usuario_id', usuarioId);
      if (tipo) query = query.eq('tipo', tipo);
      return lerOuFalhar(await query);
    });
  },

  contarHorasExtrasPendentes() {
    return executar('contarHorasExtrasPendentes', async () => {
      const { count, error } = await supabase
        .from('execucao_horas_extras')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      if (error) throw error;
      return count ?? 0;
    });
  },

  criarHoraExtra(registro) {
    return executar('criarHoraExtra', async () =>
      lerOuFalhar(await supabase.from('execucao_horas_extras').insert(registro).select().single()));
  },

  // Decisão em lote (somente admin; validada no banco). Devolve quantos registros foram decididos.
  aprovarHorasExtras(ids, justificativa) {
    return executar('aprovarHorasExtras', async () =>
      lerOuFalhar(await supabase.rpc('decidir_horas_extras', { p_ids: ids, p_aprovar: true, p_justificativa: justificativa })));
  },

  cancelarHorasExtras(ids, justificativa) {
    return executar('cancelarHorasExtras', async () =>
      lerOuFalhar(await supabase.rpc('decidir_horas_extras', { p_ids: ids, p_aprovar: false, p_justificativa: justificativa })));
  },

  // ---------- Indicadores (4.2) e calibração de templates (4.3) ----------
  buscarIndicadores(inicio, fim) {
    return executar('buscarIndicadores', async () =>
      lerOuFalhar(await supabase.rpc('execucao_indicadores', { p_inicio: inicio, p_fim: fim })));
  },

  buscarMediaRealizadaTemplates() {
    return executar('buscarMediaRealizadaTemplates', async () => {
      const [media, templates] = await Promise.all([
        supabase.rpc('execucao_media_realizada_templates'),
        supabase.from('execucao_templates_etapas').select('id, nome'),
      ]);
      const nomes = new Map((lerOuFalhar(templates) ?? []).map((t) => [t.id, t.nome]));
      return (lerOuFalhar(media) ?? []).map((m) => ({ ...m, template_nome: nomes.get(m.template_id) ?? 'Template' }));
    });
  },

  atualizarHorasItemTemplate(itemId, horas) {
    return executar('atualizarHorasItemTemplate', async () =>
      lerOuFalhar(await supabase
        .from('execucao_templates_etapas_itens')
        .update({ horas_previstas: horas })
        .eq('id', itemId)
        .select('id, horas_previstas')
        .single()));
  },

  // ---------- Tipos de serviço ----------
  buscarTiposServico() {
    return executar('buscarTiposServico', async () =>
      lerOuFalhar(await supabase.from('execucao_tipos_servico').select('*').order('nome')));
  },

  atualizarTipoServico(codigo, dados) {
    return executar('atualizarTipoServico', async () =>
      lerOuFalhar(await supabase.from('execucao_tipos_servico').update(dados).eq('codigo', codigo).select().single()));
  },

  buscarTemplatesResumo() {
    return executar('buscarTemplatesResumo', async () =>
      lerOuFalhar(await supabase.from('execucao_templates_etapas').select('id, nome').eq('ativo', true).order('nome')));
  },
};

export const execucaoCapacidadeService = wrapServiceWithImpersonationGuard(_execucaoCapacidadeService, {
  label: 'execucaoCapacidadeService',
});

export default execucaoCapacidadeService;
