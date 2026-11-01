import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useCotacao } from '../../hooks/useCotacao';
import { useTokensSessao } from '../../hooks/useTokensSessao';
import { ErroCarregamento } from '../../../execucao/components/ui/Estados';
import { CONSULTA_ABAIXO_MD, useMediaQuery } from '../../../execucao/hooks/useMediaQuery';
import { isCompras } from '../../../../utils/permissoes';
import { CLASSE_TOM, STATUS_COTACAO, formatarPrazo, tempoRestante } from '../../utils/cotacao/envio';
import { calcularComparativo } from '../../utils/cotacao/comparativo';
import { formatarBRL } from '../../utils/cotacao/moeda';
import { hashDoPedidoCompras, irParaSecao } from '../../utils/navegacaoCompras';
import { formatarDataHora } from '../../utils/statusCompra';
import PainelEnvio from './PainelEnvio';
import RankingPropostas from './RankingPropostas';
import CombinacaoDividida from './CombinacaoDividida';
import MatrizComparativa from './MatrizComparativa';
import { variacaoDaDecisao } from '../../utils/cotacao/comparativo';
import { ModalCancelarCotacao, ModalIncluirPedido, ModalProrrogar, ModalRemoverPedido } from './AcoesCotacao';

const ModalDecisao = lazy(() => import('./ModalDecisao'));
const ModalRevisao = lazy(() => import('./ModalRevisao'));
const NovaCotacao = lazy(() => import('./NovaCotacao'));

const ROTULO_EVENTO = {
  criada: 'Criada', pedido_incluido: 'Pedido incluído', pedido_removido: 'Pedido removido', itens_montados: 'Itens montados', aberta: 'Aberta',
  link_gerado: 'Link gerado', enviado: 'Envio registrado', lembrete: 'Lembrete', visualizado: 'Fornecedor visualizou', resposta_enviada: 'Resposta recebida',
  resposta_rejeitada: 'Resposta rejeitada', prorrogada: 'Prazo prorrogado', revisada: 'Revisada', requer_revisao: 'Lista alterada', decidida: 'Decidida',
  encerrada: 'Encerrada', cancelada: 'Cancelada', alerta_vencendo: 'Prazo vencendo'
};

/** Detalhe da cotação (#/compras/cotacoes?id=): cabeçalho, painel de envio, comparativo e decisão, com atualização em tempo real. */
export default function DetalheCotacao({ cotacaoId, usuario, config }) {
  const { detalhe, loading, error, reload, refresh, destaques, anuncio } = useCotacao(cotacaoId);
  const { tokens, guardar, recarregar: recarregarTokens } = useTokensSessao(cotacaoId);
  const mobile = useMediaQuery(CONSULTA_ABAIXO_MD);
  const podeOperar = isCompras(usuario);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null); // 'prorrogar'|'incluir'|'remover'|'cancelar'|'decidir'|'revisar'|'rascunho'

  const comparativo = useMemo(() => (detalhe ? calcularComparativo(detalhe, config ?? {}) : null), [detalhe, config]);

  if (error && !detalhe) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !detalhe) {
    return (
      <div className="space-y-3" aria-busy="true" role="status" aria-label="Carregando cotação">
        <div className="cmp-skeleton h-16 w-full rounded-xl" />
        {[0, 1, 2].map((i) => <div key={i} className="cmp-skeleton h-24 w-full rounded-xl" />)}
      </div>
    );
  }
  if (!detalhe) return null;

  const { cotacao, pedidos, convites, referencias } = detalhe;
  const st = STATUS_COTACAO[cotacao.status] ?? { emoji: '', rotulo: cotacao.status, tom: 'cinza' };
  const pedidosAtivos = pedidos.filter((p) => p.ativa !== false);
  const aberta = cotacao.status === 'aberta';
  const rascunho = cotacao.status === 'rascunho';
  const temRespostas = comparativo.respostas.length > 0;
  const razaoDecidir = !aberta ? 'A cotação não está aberta.'
    : cotacao.requer_revisao ? 'A lista foi alterada: revise a cotação antes de decidir.'
      : !temRespostas ? 'Ainda não há propostas.'
        : pedidosAtivos.some((p) => p.status_compra !== 'em_cotacao') ? 'Há pedido fora de “em cotação”.' : '';
  const escolhidos = detalhe.decisao?.itens
    ? Object.fromEntries(detalhe.decisao.itens.map((i) => [i.cotacao_item_id, i.convite_id])) : null;
  const qtdItens = comparativo.linhas.length;
  const fecharModal = () => setModal(null);
  const aposAcao = () => { setModal(null); setMenu(false); recarregarTokens(); refresh(); };
  const aposDecisao = () => { setModal(null); refresh(); };
  const melhor = comparativo.ranking.melhor;
  const refDecisao = escolhidos && detalhe.decisao
    ? variacaoDaDecisao({ comparativo, escolha: { modo: 'manual', porLinha: escolhidos }, referencias }) : null;

  const menuItens = [
    aberta && { id: 'prorrogar', rotulo: 'Prorrogar prazo' },
    aberta && { id: 'revisar', rotulo: 'Revisar cotação' },
    (aberta || rascunho) && { id: 'incluir', rotulo: 'Incluir pedido' },
    (aberta || rascunho) && pedidosAtivos.length > 0 && { id: 'remover', rotulo: 'Remover pedido' },
  ].filter(Boolean);

  return (
    <div className="execucao-animate-fade-in">
      <button type="button" className="cmp-link text-sm mb-3" onClick={() => irParaSecao('cotacoes')}>← Todas as cotações</button>

      <header className="cmp-bloco">
        <div className="cmp-secao-cab !mb-1">
          <h2 className="text-xl font-semibold break-words">
            Cotação nº {cotacao.numero} <span className={`cmp-selo ml-1 ${CLASSE_TOM[st.tom]}`}>{st.emoji} {st.rotulo}</span>
          </h2>
          {podeOperar && (aberta || rascunho) && (
            <div className="flex flex-wrap gap-2 relative">
              {rascunho && <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm cmp-btn-toque" onClick={() => setModal('rascunho')}>Continuar rascunho</button>}
              {aberta && <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setModal('prorrogar')}>Prorrogar</button>}
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>Mais ▾</button>
              {menu && (
                <div role="menu" className="cmp-menu-mais cmp-bloco !mb-0" style={{ position: mobile ? 'static' : 'absolute', right: 0, top: '100%', zIndex: 20, minWidth: '14rem' }}>
                  {menuItens.map((m) => <button key={m.id} type="button" role="menuitem" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => { setMenu(false); setModal(m.id); }}>{m.rotulo}</button>)}
                  <button type="button" role="menuitem" className="execucao-btn execucao-btn-danger execucao-btn-sm cmp-btn-toque" onClick={() => { setMenu(false); setModal('cancelar'); }}>🚫 Cancelar cotação</button>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="cmp-texto-mudo">
          {pedidosAtivos.length} {pedidosAtivos.length === 1 ? 'pedido' : 'pedidos'} · {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {convites.length} {convites.length === 1 ? 'fornecedor' : 'fornecedores'}
          {aberta && cotacao.prazo_resposta && <> · Prazo {formatarPrazo(cotacao.prazo_resposta)} ({tempoRestante(cotacao.prazo_resposta)})</>}
          {cotacao.status === 'cancelada' && cotacao.motivo_cancelamento && <> · Motivo: {cotacao.motivo_cancelamento}</>}
        </p>
        {error && <div className="cmp-aviso-erro mt-2" role="status"><span>Atualização automática indisponível.</span><button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={refresh}>Atualizar</button></div>}
      </header>

      {rascunho && <div className="cmp-aviso">Esta cotação é um rascunho. Continue o assistente para escolher fornecedores, definir o prazo e gerar os links.</div>}

      {(aberta || cotacao.status === 'encerrada') && convites.length > 0 && (
        <PainelEnvio
          cotacao={cotacao} convites={convites} config={config} qtdItens={qtdItens}
          tokens={tokens} onToken={guardar} onAtualizado={refresh} destaques={destaques} anuncio={anuncio}
        />
      )}

      {(aberta || cotacao.status === 'encerrada') && (
        <section className="cmp-bloco" aria-labelledby="cmp-comp-titulo">
          <h3 id="cmp-comp-titulo">Comparativo</h3>
          {cotacao.requer_revisao && aberta && (
            <div className="cmp-aviso-erro" role="alert">
              <span>Lista alterada após o envio: revise a cotação antes de decidir.</span>
              {podeOperar && <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setModal('revisar')}>Revisar cotação</button>}
            </div>
          )}
          {!temRespostas ? (
            <p className="text-slate-300">Ainda não há propostas. Quando um fornecedor responder, ela aparece aqui.</p>
          ) : (
            <>
              {comparativo.respostas.length === 1 && <p className="cmp-texto-mudo mb-2">Aguarde mais propostas ou decida com esta.</p>}
              <RankingPropostas comparativo={comparativo} destaques={destaques} />
              <CombinacaoDividida divisao={comparativo.divisao} linhas={comparativo.linhas} />
              <MatrizComparativa comparativo={comparativo} convites={convites} referencias={referencias} config={config} destaques={destaques} escolhidos={escolhidos} />
            </>
          )}
          {detalhe.decisao && (
            <div className="cmp-aviso" role="status">
              Decisão registrada ({detalhe.decisao.modo}) em {formatarDataHora(detalhe.decisao.decidido_em)}: nominal {formatarBRL(detalhe.decisao.total_nominal)} · valor comparável {formatarBRL(detalhe.decisao.total_vp)}
              {refDecisao ? ` · vs. referência: ${refDecisao.texto}` : ''}
              {detalhe.decisao.justificativa ? ` · Justificativa: ${detalhe.decisao.justificativa}` : ''}
            </div>
          )}
          {podeOperar && aberta && (
            <div className={mobile ? 'cmp-barra-acao' : 'flex items-center justify-between gap-3 flex-wrap mt-2'}>
              <p className="text-sm text-slate-300" id="cmp-dec-resumo">{melhor ? `Melhor: ${melhor.empresa} · ${formatarBRL(melhor.vp_total)}` : ''}{razaoDecidir ? ` · ${razaoDecidir}` : ''}</p>
              <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" disabled={Boolean(razaoDecidir)} aria-describedby="cmp-dec-resumo" onClick={() => setModal('decidir')}>Decidir</button>
            </div>
          )}
        </section>
      )}

      <section className="cmp-bloco" aria-labelledby="cmp-ped-titulo">
        <h3 id="cmp-ped-titulo">Pedidos</h3>
        <ul className="cmp-lista-limpa">
          {pedidos.map((p) => (
            <li key={p.id} className="cmp-linha">
              <a className="cmp-link" href={hashDoPedidoCompras(p.id)}>{p.cliente_nome || p.descricao || 'Pedido'}</a>
              <span className="cmp-texto-mudo">{p.ativa === false ? 'removido da cotação' : p.status_compra}</span>
            </li>
          ))}
        </ul>
      </section>

      {(detalhe.eventos ?? []).length > 0 && (
        <details className="cmp-bloco">
          <summary className="cursor-pointer text-slate-200">Histórico da cotação ({detalhe.eventos.length})</summary>
          <ul className="cmp-lista-limpa mt-2">
            {detalhe.eventos.slice(0, 30).map((e) => (
              <li key={e.id} className="cmp-texto-mudo">{formatarDataHora(e.created_at)} · {ROTULO_EVENTO[e.tipo] ?? e.tipo}</li>
            ))}
          </ul>
        </details>
      )}

      {modal === 'prorrogar' && <ModalProrrogar cotacao={cotacao} onClose={fecharModal} onFeito={aposAcao} />}
      {modal === 'incluir' && <ModalIncluirPedido cotacao={cotacao} onClose={fecharModal} onFeito={aposAcao} />}
      {modal === 'remover' && <ModalRemoverPedido cotacao={cotacao} pedidos={pedidos} onClose={fecharModal} onFeito={aposAcao} />}
      {modal === 'cancelar' && <ModalCancelarCotacao cotacao={cotacao} onClose={fecharModal} onFeito={aposAcao} />}
      <Suspense fallback={null}>
        {modal === 'decidir' && comparativo && <ModalDecisao comparativo={comparativo} referencias={referencias} pedidos={pedidosAtivos} onClose={fecharModal} onDecidido={aposDecisao} />}
        {modal === 'revisar' && (
          <ModalRevisao cotacao={cotacao} linhasAtuais={comparativo.linhas} convites={convites} config={config} tokens={tokens} onToken={guardar} onAtualizar={refresh} onClose={fecharModal} />
        )}
        {modal === 'rascunho' && <NovaCotacao cotacaoId={cotacao.id} config={config} onClose={aposAcao} onConcluido={aposAcao} />}
      </Suspense>
    </div>
  );
}
