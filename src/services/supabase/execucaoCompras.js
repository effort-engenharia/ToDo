import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard, assertNotImpersonating } from '../../utils/impersonationGuard.js';

// Dashboard de Compras (migrations 20261101_24 a _26). Toda escrita é por RPC SECURITY DEFINER (o papel é validado no banco);
// COMPRAS não faz update/delete direto em tabelas. Contrato: { success, data?, message? }.
// ATENÇÃO: as RPCs só existem depois de aplicar as migrations; antes disso as chamadas retornam { success:false, message }.

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

const TODOS_STATUS_COMPRA = [
  'aguardando_compra', 'em_cotacao', 'aguardando_solicitante', 'comprado', 'entregue_parcial', 'entregue', 'cancelado'
];

const _execucaoComprasService = {
  // filtros: { de, ate ('YYYY-MM-DD'), campoData ('pedido'|'evento'), statusCompra[], urgencia[], busca, solicitanteId,
  //            compradorId, pedidoId, comQuestionamentoAberto }
  // cursor: { created_at, id } da última linha recebida (keyset). Linhas: ver "contrato" no plano (Anexo F).
  async listarPedidos(filtros = {}, { limite = 50, cursor = null } = {}) {
    const f = {};
    if (filtros.de) f.de = filtros.de;
    if (filtros.ate) f.ate = filtros.ate;
    if (filtros.campoData) f.campo_data = filtros.campoData;
    if (filtros.statusCompra?.length) f.status_compra = filtros.statusCompra;
    if (filtros.urgencia?.length) f.urgencia = filtros.urgencia;
    if (filtros.busca) f.busca = filtros.busca;
    if (filtros.solicitanteId) f.solicitante_id = filtros.solicitanteId;
    if (filtros.compradorId) f.comprador_id = filtros.compradorId;
    if (filtros.pedidoId) f.pedido_id = filtros.pedidoId;
    if (filtros.comQuestionamentoAberto) f.com_questionamento_aberto = true;
    if (filtros.semCotacao) f.sem_cotacao = true; // migration 36: só pedidos sem cotação ativa
    return rpc('compras_listar_pedidos', { p_filtros: f, p_limite: limite, p_cursor: cursor }, 'listarPedidos');
  },

  // KPIs num jsonb (ver contrato no plano). de/ate opcionais ('YYYY-MM-DD'; padrão: últimos 30 dias)
  async indicadores(de = null, ate = null) {
    return rpc('compras_indicadores', { p_de: de, p_ate: ate }, 'indicadores');
  },

  // Detalhe numa chamada (RPC compras_detalhe_pedido, migration 28): data = { pedido, historico, questionamentos }.
  // Nomes já resolvidos no servidor (COMPRAS não lê public.usuarios): pedido.solicitante_nome / comprador_nome,
  // historico[].usuario_nome, questionamentos[].criador_nome / respondedor_nome.
  async buscarDetalhe(pedidoId) {
    return rpc('compras_detalhe_pedido', { p_pedido: pedidoId }, 'buscarDetalhe');
  },

  // Questionamentos com criador_nome/respondedor_nome (RPC compras_listar_questionamentos, migration 28).
  // pedidoId opcional (sem ele lista de todos os pedidos, máx. 500); status: array opcional ('aberto', ...)
  async buscarQuestionamentosPedido(pedidoId = null, status = null) {
    return rpc('compras_listar_questionamentos', { p_pedido: pedidoId, p_status: status?.length ? status : null },
      'buscarQuestionamentosPedido');
  },

  // tipo: 'substituicao' | 'quantidade' | 'duvida'; sugestao: { nome?, quantidade?, unidade? }; retorna data = id do questionamento
  async abrirQuestionamento(pedidoId, { itemId = null, tipo, pergunta, sugestao = null }) {
    try { assertNotImpersonating('abrirQuestionamento'); } catch (e) { return { success: false, message: e.message, blocked: true }; }
    return rpc('compras_abrir_questionamento',
      { p_pedido: pedidoId, p_item_id: itemId, p_tipo: tipo, p_pergunta: pergunta, p_sugestao: sugestao }, 'abrirQuestionamento');
  },

  // Quem responde: admin de execução ou solicitante não-técnico. data = { questionamento_id, status, status_compra, item_alterado }
  async responderQuestionamento(questionamentoId, aprovar, observacao = null) {
    try { assertNotImpersonating('responderQuestionamento'); } catch (e) { return { success: false, message: e.message, blocked: true }; }
    return rpc('compras_responder_questionamento',
      { p_id: questionamentoId, p_aprovar: !!aprovar, p_observacao: observacao }, 'responderQuestionamento');
  },

  async cancelarQuestionamento(questionamentoId, motivo = null) {
    return rpc('compras_cancelar_questionamento', { p_id: questionamentoId, p_motivo: motivo }, 'cancelarQuestionamento');
  },

  // Alterações da atendente na lista (migration 38). alteracoes: [{ acao:'quantidade'|'remover'|'corrigir'|'substituir'|'adicionar',
  //   itemId?, quantidade?, nome?, unidade? }] (1–50); motivo ≥ 5 caracteres; revisarCotacao: { novoPrazo (ISO) } (obrigatório se o pedido
  //   está em cotação já enviada). data = { aplicadas:[{acao,item_id,resumo}], pendentes_aceite:[{questionamento_id,acao,item_id}],
  //   status_compra, cotacao?:{id,numero,versao_lista,revisada} }. Só COMPRAS/Administrador.
  async alterarItens(pedidoId, alteracoes, motivo, revisarCotacao = null) {
    try { assertNotImpersonating('alterarItens'); } catch (e) { return { success: false, message: e.message, blocked: true }; }
    const lista = (alteracoes ?? []).map(({ itemId, ...resto }) => ({ ...resto, ...(itemId ? { item_id: itemId } : {}) }));
    const rev = revisarCotacao?.novoPrazo ? { novo_prazo: revisarCotacao.novoPrazo } : null;
    return rpc('compras_alterar_itens',
      { p_pedido: pedidoId, p_alteracoes: lista, p_motivo: motivo, p_revisar_cotacao: rev }, 'alterarItens');
  },

  // aguardando_compra → em_cotacao. data = { pedido_id, status_compra, comprador_id }
  async assumirPedido(pedidoId) {
    try { assertNotImpersonating('assumirPedido'); } catch (e) { return { success: false, message: e.message, blocked: true }; }
    return rpc('compras_assumir_pedido', { p_pedido: pedidoId }, 'assumirPedido');
  },

  // status: aguardando_compra|em_cotacao|comprado|entregue_parcial|entregue|cancelado (aguardando_solicitante é automático).
  // 'comprado' exige dataDisponibilidade ('YYYY-MM-DD') se o pedido ainda não tiver; 'cancelado' e 'entregue_parcial' exigem obs.
  async alterarStatus(pedidoId, status, obs = null, dataDisponibilidade = null) {
    return rpc('compras_alterar_status',
      { p_pedido: pedidoId, p_status: status, p_obs: obs, p_data_disponibilidade: dataDisponibilidade }, 'alterarStatus');
  },

  // Alertas (migration 36, idempotente; o banco limita a 1 execução a cada 10 min).
  // data = { aceites_alertados, cotacoes_vencendo, rate_limit_limpos }
  async verificarAlertas() {
    return rpc('compras_verificar_alertas', {}, 'verificarAlertas');
  },

  // data = { data_material_disponivel, etapa_chegada_id, etapa_criada }
  async definirDisponibilidade(pedidoId, data) {
    try { assertNotImpersonating('definirDisponibilidade'); } catch (e) { return { success: false, message: e.message, blocked: true }; }
    return rpc('compras_definir_disponibilidade', { p_pedido: pedidoId, p_data: data }, 'definirDisponibilidade');
  }
};

export const execucaoComprasService = wrapServiceWithImpersonationGuard(_execucaoComprasService, { label: 'execucaoComprasService' });

export default execucaoComprasService;
