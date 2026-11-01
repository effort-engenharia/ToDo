// Adaptadores entre o contrato real do banco (Anexo C) e os formatos dos helpers puros de F-01. Funções puras.
//
// Divergências tratadas:
//  1. `cotacao_publica_*` usa `condicoes[].total` (parcelado); os helpers (validarResposta/comparacao) usam `total_informado`.
//  2. `compras_cotacao_detalhe().respostas_atuais[]` traz `convite_id` mas não `fornecedor_id`/`empresa`/`compras_anteriores`
//     (estão em `convites[]`): o comparativo precisa deles por candidato.
//  3. `obter().resposta.itens[].id` é o id da linha da cotação (os helpers aceitam `id` ou `cotacao_item_id`: sem mudança).
//  4. Placeholder de mensagem é `{empresa_publica}` (o plano §5.1 dizia `{empresa}`).

const semNulos = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''));

// Modelo interno (helpers) → entrada de `cotacao_publica_responder.p_resposta`
export const respostaParaPayloadPublico = (resposta) => {
  const r = resposta || {};
  const base = { versao_lista: r.versao_lista, recusou: r.recusou === true };
  if (r.observacao) base.observacao = r.observacao;
  if (r.recusou === true) return base;
  return {
    ...base,
    prazo_entrega_dias: r.prazo_entrega_dias,
    frete: r.frete?.tipo === 'valor' ? { tipo: 'valor', valor: r.frete.valor } : { tipo: 'cif' },
    itens: (r.itens || []).map((i) => (i.tem_item
      ? semNulos({ id: i.id ?? i.cotacao_item_id, tem_item: true, preco_unitario: i.preco_unitario, quantidade_disponivel: i.quantidade_disponivel, observacao: i.observacao })
      : semNulos({ id: i.id ?? i.cotacao_item_id, tem_item: false, observacao: i.observacao }))),
    condicoes: (r.condicoes || []).map((c) => (c.tipo === 'a_vista'
      ? semNulos({ tipo: 'a_vista', desconto_tipo: c.desconto_tipo, desconto_valor: c.desconto_tipo ? c.desconto_valor : null })
      : semNulos({
        tipo: 'parcelado', parcelas: c.parcelas, entrada_valor: c.entrada_valor, primeira_parcela_dias: c.primeira_parcela_dias,
        total: c.total_informado ?? c.total
      })))
  };
};

// `obter().resposta` (ou versão do detalhe) → modelo interno; `total` vira `total_informado`
export const respostaPublicaParaModelo = (resposta) => {
  if (!resposta) return null;
  return {
    ...resposta,
    frete: resposta.frete ?? { tipo: resposta.frete_tipo ?? 'cif', valor: resposta.frete_valor ?? null },
    condicoes: (resposta.condicoes || []).map(({ total, ...c }) => ({ ...c, total_informado: c.total_informado ?? total ?? null }))
  };
};

// `compras_cotacao_detalhe()` → respostas prontas para `montarCandidatos`/`combinacaoDividida` (junta dados do convite)
export const respostasDoDetalhe = (detalhe) => {
  const convites = new Map((detalhe?.convites || []).map((c) => [c.id, c]));
  return (detalhe?.respostas_atuais || []).map((r) => {
    const cv = convites.get(r.convite_id);
    return {
      ...r,
      fornecedor_id: cv?.fornecedor_id ?? r.fornecedor_id,
      empresa: cv?.fornecedor?.empresa ?? r.empresa,
      nome_contato: cv?.fornecedor?.nome_contato,
      compras_anteriores: cv?.compras_anteriores ?? 0,
      respondido_em: r.enviado_em ?? r.respondido_em
    };
  });
};

// Linhas ativas da cotação para os helpers ({ id, quantidade, versao_alterada, ... })
export const linhasAtivasDoDetalhe = (detalhe) => (detalhe?.itens || []).filter((i) => i.ativo !== false);

// Variáveis da mensagem de WhatsApp (config.mensagem_padrao etc.). Aceita ainda o legado `{empresa}`.
export const varsMensagem = ({ contato, empresaPublica, numero, qtdItens, link, prazo }) => (
  { contato, empresa_publica: empresaPublica, empresa: empresaPublica, numero, qtd_itens: qtdItens, link, prazo }
);
