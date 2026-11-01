import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard, assertNotImpersonating } from '../../utils/impersonationGuard.js';

// Cotação com fornecedores (migrations 20261102_34 a _37; plano PLANO_COTACAO_FORNECEDORES.md, Anexo C).
// Toda escrita é por RPC SECURITY DEFINER (o papel is_compras() é validado no banco). Contrato: { success, data?, message? }.
// As RPCs públicas do fornecedor (cotacao_publica_obter / _responder) NÃO passam por aqui: a página /cotacao/ usa um cliente
// HTTP próprio (src/cotacao-publica/api.js), sem sessão e sem importar o supabase-js.
// ATENÇÃO: as RPCs só existem depois de aplicar as migrations (B-08); antes disso retornam { success:false, message }.
// SEGURANÇA: o token em claro só vem de abrir()/gerarLink(); guarde-o apenas em sessionStorage ('cmp:tokens:<cotacao_id>').

const rpc = async (nome, params, rotulo) => {
  try {
    const { data, error } = await supabase.rpc(nome, params);
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error(`Erro em ${rotulo ?? nome}:`, error);
    return { success: false, message: error.message };
  }
};

const escrita = (rotulo, nome, params) => {
  try { assertNotImpersonating(rotulo); } catch (e) { return Promise.resolve({ success: false, message: e.message, blocked: true }); }
  return rpc(nome, params, rotulo);
};

const _comprasCotacaoService = {
  // ---------- Configuração ----------
  // data = linha de compras_config (jsonb). Só COMPRAS/Administrador.
  async obterConfig() { return rpc('compras_config_obter', {}, 'obterConfig'); },
  // chaves parciais (taxa_mensal, empate_pct, alerta_pct, faixa_neutra_pct, prazo_padrao_horas, janela_referencia_meses,
  // fallback_ultimas_compras, prazo_aceite_horas_uteis, nome_empresa_publico, mensagem_padrao|lembrete|revisao, link_publico_ativo, rl_*). Só Administrador.
  async salvarConfig(valores) { return escrita('salvarConfig', 'compras_config_salvar', { p: valores }); },

  // ---------- Fornecedores (leitura simples via RLS; escrita via RPC) ----------
  async listarFornecedores({ apenasAtivos = false } = {}) {
    try {
      let q = supabase.from('compras_fornecedores')
        .select('id, nome_contato, empresa, whatsapp, documento, email, categorias, observacao, ativo, anonimizado_em, created_at, updated_at')
        .order('empresa', { ascending: true });
      if (apenasAtivos) q = q.eq('ativo', true).is('anonimizado_em', null);
      const { data, error } = await q;
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro em listarFornecedores:', error);
      return { success: false, message: error.message };
    }
  },
  // dados: { nome_contato, empresa, whatsapp, documento?, email?, categorias?[], observacao? }; id null = criar. data = uuid
  async salvarFornecedor(id, dados) { return escrita('salvarFornecedor', 'compras_fornecedor_salvar', { p_id: id ?? null, p_dados: dados }); },
  async definirFornecedorAtivo(id, ativo) { return escrita('definirFornecedorAtivo', 'compras_fornecedor_definir_ativo', { p_id: id, p_ativo: !!ativo }); },
  async excluirFornecedor(id) { return escrita('excluirFornecedor', 'compras_fornecedor_excluir', { p_id: id }); },
  async anonimizarFornecedor(id, motivo) { return escrita('anonimizarFornecedor', 'compras_fornecedor_anonimizar', { p_id: id, p_motivo: motivo }); },
  // text | null (pré-validação; o banco valida de novo). Mesmo resultado de compras_normalizar_whatsapp.
  async normalizarWhatsapp(texto) { return rpc('compras_normalizar_whatsapp', { p: texto }, 'normalizarWhatsapp'); },

  // ---------- Catálogo de materiais ----------
  async listarMateriais({ apenasAtivos = true } = {}) {
    try {
      let q = supabase.from('compras_materiais')
        .select('id, nome, nome_normalizado, unidade, categoria, ativo, mesclado_em_id, created_at')
        .is('mesclado_em_id', null).order('nome', { ascending: true });
      if (apenasAtivos) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return { success: true, data: data ?? [] };
    } catch (error) {
      console.error('Erro em listarMateriais:', error);
      return { success: false, message: error.message };
    }
  },
  // data = [{ id, nome, unidade, score, origem: 'alias'|'exato'|'similar' }]
  async sugerirMaterial(nome, unidade, limite = 5) { return rpc('compras_material_sugerir', { p_nome: nome, p_unidade: unidade, p_limite: limite }, 'sugerirMaterial'); },
  async salvarMaterial(id, { nome, unidade, categoria = null }) {
    return escrita('salvarMaterial', 'compras_material_salvar', { p_id: id ?? null, p_nome: nome, p_unidade: unidade, p_categoria: categoria });
  },
  // data = { historico_movido, aliases_movidos }
  async mesclarMateriais(origemId, destinoId, motivo = null) {
    return escrita('mesclarMateriais', 'compras_material_mesclar', { p_origem: origemId, p_destino: destinoId, p_motivo: motivo });
  },
  // data = { <material_id>: { ultimo:{preco_vp, preco_nominal, data, quantidade, fornecedor}, media_janela, n_janela, menor:{preco_vp, data}, fora_janela, n_total } }
  async precosReferencia(materiaisIds) { return rpc('compras_precos_referencia', { p_materiais: materiaisIds }, 'precosReferencia'); },
  async historicoMaterial(materialId, limite = 50) { return rpc('compras_material_historico', { p_material: materialId, p_limite: limite }, 'historicoMaterial'); },

  // ---------- Cotação ----------
  // pedidos: 1–30 ids. data = { cotacao_id, numero, itens:[{ id, seq, descricao, unidade, quantidade, material_id, observacao_publica, ativo,
  //   versao_criada, versao_alterada, origens:[{ pedido_id, item_id, quantidade }] }] }
  async criar(pedidosIds, { observacaoPublica = null, regiaoEntrega = null } = {}) {
    return escrita('criarCotacao', 'compras_cotacao_criar', { p_pedidos: pedidosIds, p_observacao_publica: observacaoPublica, p_regiao_entrega: regiaoEntrega });
  },
  // itens null = recomposição automática (rascunho, ou aberta aguardando revisão). data = itens ativos (mesmo formato de criar().itens)
  async montarItens(cotacaoId, itens = null) { return escrita('montarItens', 'compras_cotacao_montar_itens', { p_cotacao: cotacaoId, p_itens: itens }); },
  // data = { cotacao_id, itens, requer_revisao }
  async incluirPedidos(cotacaoId, pedidosIds) { return escrita('incluirPedidos', 'compras_cotacao_incluir_pedidos', { p_cotacao: cotacaoId, p_pedidos: pedidosIds }); },
  async removerPedido(cotacaoId, pedidoId, motivo) { return escrita('removerPedido', 'compras_cotacao_remover_pedido', { p_cotacao: cotacaoId, p_pedido: pedidoId, p_motivo: motivo }); },
  // data = [{ convite_id, fornecedor_id, status }]
  async definirFornecedores(cotacaoId, fornecedoresIds) {
    return escrita('definirFornecedores', 'compras_cotacao_definir_fornecedores', { p_cotacao: cotacaoId, p_fornecedores: fornecedoresIds });
  },
  // prazo: ISO timestamp (null = padrão da config). data = { cotacao:{ id, numero, status, prazo_resposta, versao_lista }, links:[{ convite_id, fornecedor_id, token }] }
  // O token em claro é devolvido UMA ÚNICA vez.
  async abrir(cotacaoId, { prazo = null, mensagem = null } = {}) { return escrita('abrirCotacao', 'compras_cotacao_abrir', { p_cotacao: cotacaoId, p_prazo: prazo, p_mensagem: mensagem }); },
  // motivo: 'novo_link' | 'lembrete'. data = { convite_id, token } (revoga o token anterior → o link antigo passa a responder LINK_SUBSTITUIDO)
  async gerarLink(conviteId, motivo = 'novo_link') { return escrita('gerarLink', 'compras_cotacao_gerar_link', { p_convite: conviteId, p_motivo: motivo }); },
  // canal: 'whatsapp' | 'copia'. data = linha do convite
  async registrarEnvio(conviteId, canal, lembrete = false) {
    return escrita('registrarEnvio', 'compras_cotacao_registrar_envio', { p_convite: conviteId, p_canal: canal, p_lembrete: !!lembrete });
  },
  async prorrogar(cotacaoId, novoPrazo, motivo = null) { return escrita('prorrogarCotacao', 'compras_cotacao_prorrogar', { p_cotacao: cotacaoId, p_novo_prazo: novoPrazo, p_motivo: motivo }); },
  // data = { versao_lista, convites_reconfirmar:[{ convite_id, fornecedor_id }], itens }
  async revisar(cotacaoId, motivo, novoPrazo) { return escrita('revisarCotacao', 'compras_cotacao_revisar', { p_cotacao: cotacaoId, p_motivo: motivo, p_novo_prazo: novoPrazo }); },
  async cancelar(cotacaoId, motivo) { return escrita('cancelarCotacao', 'compras_cotacao_cancelar', { p_cotacao: cotacaoId, p_motivo: motivo }); },

  // filtros: { status[], busca, de, ate ('YYYY-MM-DD'), minhas }; cursor { created_at, id }.
  // data = { itens:[{ id, numero, status, prazo_resposta, requer_revisao, created_at, n_pedidos, n_itens, n_convites, n_enviados, n_respondidos, criado_por_nome }], proximo_cursor }
  async listar(filtros = {}, { limite = 30, cursor = null } = {}) {
    const f = {};
    if (filtros.status?.length) f.status = filtros.status;
    if (filtros.busca) f.busca = filtros.busca;
    if (filtros.de) f.de = filtros.de;
    if (filtros.ate) f.ate = filtros.ate;
    if (filtros.minhas) f.minhas = true;
    return rpc('compras_cotacao_listar', { p_filtros: f, p_limite: limite, p_cursor: cursor }, 'listarCotacoes');
  },
  // data = { cotacao, pedidos, itens, convites, respostas_atuais, referencias, eventos, decisao } (ver plano, Anexo C)
  async buscarDetalhe(cotacaoId) { return rpc('compras_cotacao_detalhe', { p_cotacao: cotacaoId }, 'buscarDetalheCotacao'); },
  async respostasVersoes(conviteId) { return rpc('compras_cotacao_respostas_versoes', { p_convite: conviteId }, 'respostasVersoes'); },
  // decisao: { modo:'unico'|'dividido'|'manual', segue_recomendacao, justificativa?, itens:[{ cotacao_item_id, convite_id, condicao_tipo }],
  //            datas_disponibilidade:{ <pedido_id>:'YYYY-MM-DD' }, recomendacao_snapshot? }
  // data = { decisao_id, pedidos:[{ pedido_id, status_compra, data_material_disponivel, etapa_chegada_id }] }
  async decidir(cotacaoId, decisao) { return escrita('decidirCotacao', 'compras_cotacao_decidir', { p_cotacao: cotacaoId, p_decisao: decisao }); },

  // KPIs de cotação (migration 39). de/ate: 'YYYY-MM-DD' (padrão: últimos 90 dias; máx. 5 anos). Cada kN traz `suficiente` (false = "dados insuficientes").
  // data = { periodo, k1:{valor,pct,total_referencia,n_linhas,suficiente}, k2:{acima,abaixo,neutras,*_pct,n_linhas,suficiente},
  //   k3:{enviados,respondidos,recusaram,taxa,suficiente}, k4:{primeira_resposta_horas,decisao_horas,n_*,suficiente},
  //   k5:{abertas,vencendo_24h,prazo_vencido,sem_respostas}, k6:{total,concentracao_pct,fornecedor_top,por_categoria[],suficiente},
  //   k7:{cotacoes_com_ranking,suficiente}, k8:{questionamentos,aprovados,reprovados,abertos,historicos,mediana_aceite_horas,por_atendente[],suficiente},
  //   k9:{a_vista,parcelado,a_vista_pct,parcelado_pct,suficiente}, k10:{itens[{material_id,nome,unidade,n_linhas,delta_pct,ref_medio,vp_medio}],suficiente},
  //   por_fornecedor:[{fornecedor_id,empresa,enviados,respondidos,recusaram,taxa,vitorias,participacoes,taxa_vitoria,gasto}] }
  async indicadoresCotacao(de = null, ate = null) { return rpc('compras_indicadores_cotacao', { p_de: de, p_ate: ate }, 'indicadoresCotacao'); },

  // Realtime (Postgres Changes; RLS aplicada): devolve a função de cancelamento da assinatura.
  assinarCotacao(cotacaoId, aoMudar) {
    const canal = supabase.channel(`compras-cotacao-${cotacaoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_cotacao_convites', filter: `cotacao_id=eq.${cotacaoId}` }, aoMudar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_cotacao_respostas', filter: `cotacao_id=eq.${cotacaoId}` }, aoMudar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_cotacoes', filter: `id=eq.${cotacaoId}` }, aoMudar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }
};

export const comprasCotacaoService = wrapServiceWithImpersonationGuard(_comprasCotacaoService, { label: 'comprasCotacaoService' });

export default comprasCotacaoService;
