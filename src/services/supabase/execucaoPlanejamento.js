import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';

// Cadastro de obras/serviços e templates do módulo Execução (contratos pendentes, criação atômica, equipe, tipos de serviço).
// Métodos de escrita começam com criar/atualizar/excluir para serem bloqueados durante a impersonation.

const COLUNAS_TEMPLATE = ['nome', 'descricao', 'tipo_obra', 'icone', 'cor', 'ativo', 'ordem', 'tipo_servico_codigo'];

// Sub-etapa: pai_indice (posição do pai na lista enviada) vira pai_ordem; sem duração própria em dias (fica dentro da etapa pai)
const montarItemTemplate = (item, indice, templateId) => {
  const paiOrdem = item.pai_indice != null ? Number(item.pai_indice) + 1 : (item.pai_ordem ?? null);
  const duracao = Number.parseInt(item.duracao_dias ?? item.duracao, 10);
  return {
    template_id: templateId,
    nome: item.nome,
    descricao: item.descricao || null,
    tipo: item.tipo || 'geral',
    duracao_dias: paiOrdem != null ? 0 : (Number.isFinite(duracao) && duracao > 0 ? duracao : 3),
    ordem: indice + 1,
    pai_ordem: paiOrdem,
    horas_previstas: item.horas_previstas === '' || item.horas_previstas == null ? null : Number(item.horas_previstas),
    qtd_tecnicos: Math.max(1, parseInt(item.qtd_tecnicos, 10) || 1),
    pop_id: item.pop_id || null
  };
};

const montarDadosTemplate = (dados) => Object.fromEntries(
  COLUNAS_TEMPLATE.filter((c) => dados[c] !== undefined).map((c) => [c, dados[c] === '' ? null : dados[c]])
);

// Mesmo formato devolvido pela RPC execucao_contratos_pendentes (usado se a RPC falhar)
const contratoDoApontamento = (a) => ({
  id: a.id,
  nome_cliente: a.nome_cliente,
  tipo_oportunidade: a.tipo_oportunidade ?? null,
  tipo_servico_codigo: null,
  tipo_servico_nome: null,
  modalidade: null,
  equipe_responsavel: 'execucao',
  cronograma_data_inicio: a.cronograma_data_inicio,
  cronograma_data_termino: a.cronograma_data_termino,
  valor_total_servico: a.valor_total_servico ?? null,
  contato_cliente: a.contato_cliente,
  logradouro: a.logradouro,
  numero: a.numero,
  bairro: a.bairro,
  cidade: a.cidade_atendimento === 'OUTRAS' ? a.cidade_outras : (a.cidade_atendimento || a.municipio || ''),
  cidade_id: null,
  obra_id: null,
  ignorado: false,
  motivo_ignorado: null,
  created_at: a.created_at
});

const _execucaoPlanejamentoService = {
  // ---------- Contratos do Comercial ainda sem obra ----------
  async listarContratosPendentes({ incluirPlanejados = false, busca = '' } = {}) {
    try {
      const { data, error } = await supabase.rpc('execucao_contratos_pendentes', {
        p_incluir_planejados: incluirPlanejados,
        p_busca: busca?.trim() || null
      });
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao listar contratos pendentes (RPC); usando a consulta simples:', error);
      try {
        let query = supabase
          .from('apontamentos_comerciais')
          .select('id, nome_cliente, tipo_oportunidade, contato_cliente, logradouro, numero, bairro, municipio, cidade_atendimento, cidade_outras, cronograma_data_inicio, cronograma_data_termino, valor_total_servico, created_at')
          .eq('fase', 'CONTRATO/VENDA')
          .order('cronograma_data_inicio', { ascending: true, nullsFirst: false })
          .limit(300);
        if (busca?.trim()) query = query.ilike('nome_cliente', `%${busca.trim()}%`);
        const { data, error: erroSimples } = await query;
        if (erroSimples) throw erroSimples;
        return { success: true, data: (data ?? []).map(contratoDoApontamento), fallback: true };
      } catch (erroFallback) {
        return { success: false, message: erroFallback.message || error.message };
      }
    }
  },

  async contarContratosPendentes() {
    try {
      const { data, error } = await supabase.rpc('execucao_contar_contratos_pendentes');
      if (error) throw error;
      return { success: true, data: Number(data) || 0 };
    } catch (error) {
      console.error('Erro ao contar contratos pendentes:', error);
      return { success: false, message: error.message };
    }
  },

  // "Não planejar": remove os contratos da lista sem alterar nada no Comercial
  async criarContratosIgnorados(apontamentoIds, motivo, usuarioId = null) {
    try {
      const ids = [...new Set(apontamentoIds ?? [])];
      if (!ids.length) return { success: true, data: [] };
      if (!motivo?.trim()) return { success: false, message: 'Informe o motivo.' };
      const linhas = ids.map((id) => ({ apontamento_id: id, motivo: motivo.trim(), ignorado_por: usuarioId || null }));
      const { data, error } = await supabase
        .from('execucao_contratos_ignorados')
        .upsert(linhas, { onConflict: 'apontamento_id' })
        .select('apontamento_id');
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao ignorar contratos:', error);
      return { success: false, message: error.message };
    }
  },

  async excluirContratosIgnorados(apontamentoIds) {
    try {
      const ids = [...new Set(apontamentoIds ?? [])];
      if (!ids.length) return { success: true };
      const { error } = await supabase.from('execucao_contratos_ignorados').delete().in('apontamento_id', ids);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao restaurar contratos:', error);
      return { success: false, message: error.message };
    }
  },

  // ---------- Cadastros de apoio ----------
  async listarTiposServico() {
    try {
      const { data, error } = await supabase
        .from('execucao_tipos_servico')
        .select('codigo, nome, modalidade, equipe_responsavel, tipo_obra, template_padrao_id, ativo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao listar tipos de serviço:', error);
      return { success: false, message: error.message };
    }
  },

  async listarCidades() {
    try {
      const { data, error } = await supabase
        .from('execucao_cidades')
        .select('id, nome, uf')
        .eq('ativa', true)
        .order('nome');
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao listar cidades:', error);
      return { success: false, message: error.message };
    }
  },

  // Feriados que valem como "não útil" (considerar_feriado = true) no intervalo; o filtro por cidade/UF é feito no cliente
  async listarFeriados({ inicio, fim }) {
    try {
      let query = supabase
        .from('execucao_feriados')
        .select('data, descricao, abrangencia, uf, cidade_id, considerar_feriado')
        .eq('considerar_feriado', true);
      if (inicio) query = query.gte('data', inicio);
      if (fim) query = query.lte('data', fim);
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao listar feriados:', error);
      return { success: false, message: error.message };
    }
  },

  async listarPopsAtivos() {
    try {
      const { data, error } = await supabase
        .from('execucao_pops')
        .select('id, titulo, categoria, tipo_execucao')
        .eq('ativo', true)
        .order('titulo');
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao listar POPs:', error);
      return { success: false, message: error.message };
    }
  },

  // ---------- Obra + etapas + atividades + pedidos em uma única transação ----------
  async criarObraCompleta(obra, etapas = [], criarAtividades = true) {
    try {
      const { data, error } = await supabase.rpc('criar_obra_completa', {
        p_obra: obra,
        p_etapas: etapas,
        p_criar_atividades: criarAtividades
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erro ao criar obra completa:', error);
      return { success: false, message: error.message };
    }
  },

  // Líder (tecnico_responsavel_id) + apoios da atividade
  async atualizarEquipeAtividade(atividadeId, liderId, apoioIds = []) {
    try {
      const { error } = await supabase.rpc('execucao_definir_equipe', {
        p_atividade: atividadeId,
        p_lider: liderId || null,
        p_apoios: (apoioIds ?? []).filter((id) => id && id !== liderId)
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao definir equipe:', error);
      return { success: false, message: error.message };
    }
  },

  // ---------- Templates (inclui horas, nº de técnicos e POP por item) ----------
  async criarTemplateCompleto(dados) {
    try {
      const { data: template, error } = await supabase
        .from('execucao_templates_etapas')
        .insert(montarDadosTemplate(dados))
        .select()
        .single();
      if (error) throw error;

      if (dados.itens?.length) {
        const { error: erroItens } = await supabase
          .from('execucao_templates_etapas_itens')
          .insert(dados.itens.map((item, i) => montarItemTemplate(item, i, template.id)));
        if (erroItens) {
          // não deixa um template sem etapas para trás
          await supabase.from('execucao_templates_etapas').delete().eq('id', template.id);
          throw erroItens;
        }
      }
      return { success: true, data: template };
    } catch (error) {
      console.error('Erro ao criar template:', error);
      return { success: false, message: error.message };
    }
  },

  // Insere os itens novos antes de remover os antigos: uma falha no meio nunca deixa o template sem itens
  async atualizarTemplateCompleto(templateId, dados) {
    try {
      const { error } = await supabase
        .from('execucao_templates_etapas')
        .update({ ...montarDadosTemplate(dados), updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) throw error;

      if (dados.itens !== undefined) {
        const { data: antigos, error: erroAntigos } = await supabase
          .from('execucao_templates_etapas_itens')
          .select('id')
          .eq('template_id', templateId);
        if (erroAntigos) throw erroAntigos;

        if (dados.itens.length) {
          const { error: erroItens } = await supabase
            .from('execucao_templates_etapas_itens')
            .insert(dados.itens.map((item, i) => montarItemTemplate(item, i, templateId)));
          if (erroItens) throw erroItens;
        }
        if (antigos?.length) {
          const { error: erroDelete } = await supabase
            .from('execucao_templates_etapas_itens')
            .delete()
            .in('id', antigos.map((i) => i.id));
          if (erroDelete) throw erroDelete;
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      return { success: false, message: error.message };
    }
  },

  async duplicarTemplateCompleto(templateId, novoNome) {
    try {
      const { data: original, error } = await supabase
        .from('execucao_templates_etapas')
        .select('*, itens:execucao_templates_etapas_itens(*)')
        .eq('id', templateId)
        .single();
      if (error) throw error;

      const ordenados = [...(original.itens ?? [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const posicaoPorOrdem = new Map(ordenados.map((item, i) => [item.ordem, i]));
      const itens = ordenados.map((item) => ({
        ...item,
        pai_indice: item.pai_ordem != null && posicaoPorOrdem.has(item.pai_ordem) ? posicaoPorOrdem.get(item.pai_ordem) : null,
        pai_ordem: null
      }));
      return await this.criarTemplateCompleto({
        ...original,
        nome: novoNome || `${original.nome} (Cópia)`,
        itens
      });
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      return { success: false, message: error.message };
    }
  },

  // Template padrão de um tipo de serviço (alimenta a sugestão automática ao escolher o contrato)
  async atualizarTipoServicoTemplatePadrao(codigo, templateId) {
    try {
      const { error } = await supabase
        .from('execucao_tipos_servico')
        .update({ template_padrao_id: templateId || null })
        .eq('codigo', codigo);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar template padrão do serviço:', error);
      return { success: false, message: error.message };
    }
  },

  // ---------- Visão do todo (painel da carteira, saúde, reprogramação, pendências, pauta) ----------
  async buscarPainelCarteira() {
    try {
      const { data, error } = await supabase.rpc('execucao_painel_carteira');
      if (error) throw error;
      return { success: true, data: data ?? null };
    } catch (error) {
      console.error('Erro ao buscar o painel da carteira:', error);
      return { success: false, message: error.message };
    }
  },

  // Uma linha por obra aberta: saude (no_prazo | em_risco | atrasada | pendencia) e motivos legíveis
  async buscarSaudeObras() {
    try {
      const { data, error } = await supabase.rpc('execucao_saude_obras');
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao buscar a saúde das obras:', error);
      return { success: false, message: error.message };
    }
  },

  // Dados mínimos das obras abertas (entregas da semana, nomes para a pauta) sem trazer as etapas
  async buscarObrasAbertasResumo() {
    try {
      const { data, error } = await supabase
        .from('execucao_obras')
        .select('id, nome_cliente, cidade, status, data_inicio_prevista, data_fim_prevista, progresso_geral')
        .not('status', 'in', '(concluida,cancelada)')
        .order('data_fim_prevista', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao buscar o resumo das obras abertas:', error);
      return { success: false, message: error.message };
    }
  },

  // Prévia do deslocamento (não grava): antes/depois de cada etapa a partir da ordem informada
  async buscarPreviaDeslocamento(obraId, aPartirDaOrdem, diasUteis) {
    try {
      const { data, error } = await supabase.rpc('deslocar_etapas', {
        p_obra_id: obraId,
        p_a_partir_da_ordem: aPartirDaOrdem,
        p_dias_uteis: diasUteis,
        p_aplicar: false
      });
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao simular o deslocamento das etapas:', error);
      return { success: false, message: error.message };
    }
  },

  // Aplica o deslocamento: grava etapas e atividades, atualiza o fim previsto e notifica os técnicos
  async alterarDeslocamentoEtapas(obraId, aPartirDaOrdem, diasUteis) {
    try {
      const { data, error } = await supabase.rpc('deslocar_etapas', {
        p_obra_id: obraId,
        p_a_partir_da_ordem: aPartirDaOrdem,
        p_dias_uteis: diasUteis,
        p_aplicar: true
      });
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro ao deslocar as etapas:', error);
      return { success: false, message: error.message };
    }
  },

  // Pausas em que o técnico pediu para atualizar o planejamento e que ainda não foram tratadas
  async listarPendenciasReplanejamento() {
    try {
      const { data, error } = await supabase
        .from('execucao_atividades')
        .select(`
          id, titulo, status, data_programada, data_fim, hora_inicio, tecnico_responsavel_id,
          tecnico:usuarios!tecnico_responsavel_id(id, nome_completo),
          etapa:execucao_obras_etapas(id, nome, obra_id, obra:execucao_obras(id, nome_cliente))
        `)
        .eq('solicita_replanejamento', true)
        .not('status', 'in', '(concluida,cancelada)')
        .order('data_programada', { ascending: true })
        .limit(500);
      if (error) throw error;
      const atividades = data ?? [];

      // Motivo informado na última pausa de cada atividade (uma consulta para todas)
      const motivos = new Map();
      if (atividades.length) {
        const { data: historico, error: erroHistorico } = await supabase
          .from('execucao_atividades_historico')
          .select('atividade_id, descricao, created_at')
          .eq('tipo_acao', 'pausa')
          .in('atividade_id', atividades.map((a) => a.id))
          .order('created_at', { ascending: false });
        if (!erroHistorico) {
          (historico ?? []).forEach((h) => {
            if (!motivos.has(h.atividade_id)) {
              motivos.set(h.atividade_id, {
                motivo: String(h.descricao ?? '').replace(/^Atividade pausada\.?\s*(Motivo:\s*)?/i, '').trim(),
                pausada_em: h.created_at
              });
            }
          });
        }
      }

      return {
        success: true,
        data: atividades.map((a) => ({ ...a, motivo: motivos.get(a.id)?.motivo || '', pausada_em: motivos.get(a.id)?.pausada_em || null }))
      };
    } catch (error) {
      console.error('Erro ao listar pendências de replanejamento:', error);
      return { success: false, message: error.message };
    }
  },

  // Resolve a pendência (com novas datas, quando reagendada). Limpa a flag porque a saúde da obra a considera.
  async atualizarResolverReplanejamento(atividadeId, novasDatas = null) {
    try {
      const dados = { solicita_replanejamento: false, replanejamento_resolvido_em: new Date().toISOString() };
      if (novasDatas?.data_programada) dados.data_programada = novasDatas.data_programada;
      if (novasDatas && 'data_fim' in novasDatas) dados.data_fim = novasDatas.data_fim;
      const { error } = await supabase.from('execucao_atividades').update(dados).eq('id', atividadeId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao resolver o pedido de replanejamento:', error);
      return { success: false, message: error.message };
    }
  },

  // Horas previstas × realizadas por etapa (uma consulta para todas as etapas da obra)
  async buscarHorasDasEtapas(etapaIds) {
    try {
      const ids = [...new Set(etapaIds ?? [])];
      if (!ids.length) return { success: true, data: {} };
      const { data, error } = await supabase
        .from('execucao_atividades')
        .select('etapa_id, status, horas_previstas, horas_realizadas')
        .in('etapa_id', ids)
        .neq('status', 'cancelada');
      if (error) throw error;
      const porEtapa = {};
      (data ?? []).forEach((a) => {
        const total = porEtapa[a.etapa_id] ?? { previstas: 0, realizadas: 0 };
        total.previstas += Number(a.horas_previstas) || 0;
        if (a.status === 'concluida') total.realizadas += Number(a.horas_realizadas ?? a.horas_previstas) || 0;
        porEtapa[a.etapa_id] = total;
      });
      return { success: true, data: porEtapa };
    } catch (error) {
      console.error('Erro ao buscar as horas das etapas:', error);
      return { success: false, message: error.message };
    }
  },

  // Etapas, entregas e atividades da semana para a pauta da reunião (datas YYYY-MM-DD)
  async buscarDadosPautaSemanal(inicio, fim) {
    try {
      const [etapas, entregas, atividades] = await Promise.all([
        supabase
          .from('execucao_obras_etapas')
          .select(`
            id, nome, tipo, status, progresso, data_inicio, data_fim, responsavel_id, equipe_ids,
            responsavel:usuarios!execucao_obras_etapas_responsavel_id_fkey(nome_completo),
            obra:execucao_obras!inner(id, nome_cliente, cidade, status)
          `)
          .not('obra.status', 'in', '(concluida,cancelada)')
          .not('status', 'in', '(concluida,cancelada)')
          .lte('data_inicio', fim)
          .gte('data_fim', inicio)
          .order('data_inicio', { ascending: true })
          .limit(2000),
        supabase
          .from('execucao_obras')
          .select('id, nome_cliente, cidade, data_fim_prevista, progresso_geral')
          .not('status', 'in', '(concluida,cancelada)')
          .gte('data_fim_prevista', inicio)
          .lte('data_fim_prevista', fim)
          .order('data_fim_prevista', { ascending: true })
          .limit(500),
        supabase
          .from('execucao_atividades')
          .select(`
            id, titulo, status, data_programada, data_fim, hora_inicio, hora_fim, horas_previstas, tecnico_responsavel_id,
            etapa:execucao_obras_etapas(nome, obra:execucao_obras(nome_cliente)),
            equipe:execucao_atividades_equipe(usuario_id)
          `)
          .neq('status', 'cancelada')
          .lte('data_programada', fim)
          .or(`data_fim.gte.${inicio},and(data_fim.is.null,data_programada.gte.${inicio})`)
          .order('data_programada', { ascending: true })
          .order('hora_inicio', { ascending: true, nullsFirst: false })
          .limit(3000)
      ]);
      [etapas, entregas, atividades].forEach((r) => { if (r.error) throw r.error; });
      return {
        success: true,
        data: { etapas: etapas.data ?? [], entregas: entregas.data ?? [], atividades: atividades.data ?? [] }
      };
    } catch (error) {
      console.error('Erro ao buscar os dados da pauta semanal:', error);
      return { success: false, message: error.message };
    }
  }
};

export const execucaoPlanejamentoService = wrapServiceWithImpersonationGuard(_execucaoPlanejamentoService, {
  label: 'execucaoPlanejamentoService'
});

export default execucaoPlanejamentoService;
