import React, { useEffect, useRef, useState } from 'react';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import { CLASSE_TOM, estadoDoConvite, mensagemDoConvite } from '../../utils/cotacao/envio';
import { urlWhatsapp } from '../../utils/cotacao/mensagemWhatsapp';
import { urlCotacao } from '../../utils/cotacao/tokensSessao';
import { mascaraWhatsapp } from '../fornecedores/formatos';
import { formatarDataHora } from '../../utils/statusCompra';

// Uma linha do painel de envio (Anexo B.4). REGRA DE OURO (§10.3): o `window.open` do wa.me acontece no MESMO clique,
// sem `await` antes (senão o navegador bloqueia o pop-up). Lembrete/novo link são em duas etapas: 1) gerar link (await), 2) enviar.
function LinhaConvite({ convite, cotacao, config, qtdItens, token, onToken, onAtualizado, destacado, proximo, bloqueado, tipoMensagem }) {
  const { toast } = useExecucaoUI();
  const estado = estadoDoConvite(convite);
  const [etapa, setEtapa] = useState(null); // null | 'confirmando' | 'gerando' | { pronto: 'novo_link'|'lembrete'|'revisao' }
  const [feito, setFeito] = useState(null); // 'whatsapp' | 'copia' por 3 s
  const [bloqueadoPopup, setBloqueadoPopup] = useState(false);
  const [linkManual, setLinkManual] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const botaoRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const empresa = convite.fornecedor?.empresa ?? 'fornecedor';
  const pronto = etapa && typeof etapa === 'object' ? etapa.pronto : null;
  const jaEnviou = convite.status !== 'nao_enviado' || (convite.envios ?? 0) > 0;
  const exigeLembrete = jaEnviou && !pronto;
  const tipoLembrete = convite.precisa_reconfirmar ? 'revisao' : 'lembrete';

  const marcarFeito = (canal) => {
    setFeito(canal);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeito(null), 3000);
  };

  // Mesmo handler do clique: sem await antes do window.open
  const enviarWhatsapp = (tipo, lembrete) => {
    setErro(''); setBloqueadoPopup(false);
    const link = urlCotacao(token);
    const msg = mensagemDoConvite({ tipo, config, cotacao, convite, link, qtdItens });
    const url = urlWhatsapp(convite.fornecedor?.whatsapp, msg);
    if (!url) { setErro('WhatsApp inválido. Corrija o cadastro do fornecedor.'); return; }
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else setBloqueadoPopup(true);
    setEtapa(null);
    comprasCotacaoService.registrarEnvio(convite.id, 'whatsapp', lembrete).then((r) => {
      if (!r.success) { setErro(r.message || 'O envio foi aberto, mas não foi registrado.'); return; }
      marcarFeito('whatsapp');
      setAviso(`Envio registrado para ${empresa}`);
      onAtualizado?.();
    });
  };

  const copiar = async () => {
    setErro('');
    const link = urlCotacao(token);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setLinkManual(link);
      return;
    }
    const r = await comprasCotacaoService.registrarEnvio(convite.id, 'copia', jaEnviou);
    if (!r.success) { setErro(r.message || 'Link copiado, mas o envio não foi registrado.'); return; }
    marcarFeito('copia');
    setAviso(`Link copiado para ${empresa}`);
    onAtualizado?.();
  };

  const gerar = async (motivo, tipoPronto) => {
    setErro('');
    setEtapa('gerando');
    const r = await comprasCotacaoService.gerarLink(convite.id, motivo);
    if (!r.success || !r.data?.token) { setEtapa(null); setErro(r.message || 'Não foi possível gerar o link.'); return; }
    onToken({ [convite.id]: r.data.token });
    setEtapa({ pronto: tipoPronto });
    toast.info(`Novo link gerado para ${empresa}. O link anterior deixou de funcionar.`);
  };

  // Foco programático no botão da 2ª etapa
  useEffect(() => { if (pronto) botaoRef.current?.focus(); }, [pronto]);

  const btn = 'execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque';
  const btnPrim = 'execucao-btn execucao-btn-primary execucao-btn-sm cmp-btn-toque';

  let acoes;
  if (bloqueado) {
    acoes = null;
  } else if (etapa === 'gerando') {
    acoes = <span className="text-sm text-slate-300" aria-live="polite">Gerando link…</span>;
  } else if (etapa === 'confirmando') {
    acoes = (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-amber-200">O link antigo deixa de funcionar.</span>
        <button type="button" className={btnPrim} onClick={() => gerar('novo_link', 'novo_link')}>Gerar novo link</button>
        <button type="button" className={btn} onClick={() => setEtapa(null)}>Cancelar</button>
      </div>
    );
  } else if (pronto) {
    acoes = (
      <button ref={botaoRef} type="button" className={btnPrim} onClick={() => enviarWhatsapp(pronto === 'novo_link' ? 'padrao' : pronto, pronto !== 'novo_link')}>
        {pronto === 'novo_link' ? 'Enviar WhatsApp' : pronto === 'revisao' ? 'Enviar aviso de revisão pelo WhatsApp' : 'Enviar lembrete pelo WhatsApp'}
      </button>
    );
  } else if (!token) {
    acoes = (
      <button type="button" className={btn} onClick={() => (convite.tem_token_vivo ? setEtapa('confirmando') : gerar('novo_link', 'novo_link'))}>
        Gerar link para enviar
      </button>
    );
  } else {
    acoes = (
      <>
        <button type="button" className={proximo ? btnPrim : btn} onClick={() => enviarWhatsapp(tipoMensagem === 'revisao' ? 'revisao' : 'padrao', tipoMensagem === 'revisao' || jaEnviou)}>
          {feito === 'whatsapp' ? 'Enviado ✓' : jaEnviou ? 'Reenviar' : 'Enviar WhatsApp'}
        </button>
        <button type="button" className={btn} onClick={copiar}>{feito === 'copia' ? 'Link copiado ✓' : 'Copiar link'}</button>
      </>
    );
  }

  const mostrarLembrete = !bloqueado && exigeLembrete && !pronto && etapa === null && convite.status !== 'recusou';

  return (
    <li className={`cmp-linha${destacado ? ' cmp-destaque' : ''}${proximo ? ' cmp-linha-proximo' : ''}`}>
      <div className="min-w-0 flex-1" style={{ minWidth: '14rem' }}>
        <p className="text-sm text-slate-100 break-words">
          <strong>{empresa}</strong> · {convite.fornecedor?.nome_contato} · {mascaraWhatsapp(convite.fornecedor?.whatsapp)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`cmp-selo ${CLASSE_TOM[estado.tom]}`}>
            {estado.emoji} {estado.rotulo}{estado.id === 'respondido' && convite.versao_lista_respondida != null ? ` · v${convite.versao_lista_respondida}` : ''}
          </span>
          {proximo && <span className="cmp-selo bg-teal-500/20 text-teal-200 border border-teal-400">Próximo a enviar</span>}
          <span className="cmp-texto-mudo">
            {convite.envios ?? 0} {(convite.envios ?? 0) === 1 ? 'envio' : 'envios'}
            {convite.enviado_em ? ` · último ${formatarDataHora(convite.enviado_em)}` : ''}
          </span>
        </p>
        {erro && <p className="cmp-erro-campo" role="alert">{erro}</p>}
        {bloqueadoPopup && <div className="cmp-aviso" role="alert">O navegador bloqueou o WhatsApp. Permita pop-ups ou use Copiar link.</div>}
        {linkManual && (
          <div className="cmp-campo mt-2">
            <label htmlFor={`link-${convite.id}`}>Copie o link manualmente</label>
            <input id={`link-${convite.id}`} readOnly className="execucao-form-input" value={linkManual} onFocus={(e) => e.target.select()} />
          </div>
        )}
        <span className="sr-only" aria-live="polite">{aviso}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {acoes}
        {mostrarLembrete && (
          <button type="button" className={btn} onClick={() => gerar('lembrete', tipoLembrete)} title="O link anterior deixa de funcionar.">
            {tipoLembrete === 'revisao' ? 'Avisar revisão' : 'Lembrete'}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Painel de envio (Anexo B.4). `apenas` (ids de convites) restringe a lista (usado pela revisão).
 * `tokens` = { convite_id: token } do sessionStorage; `onToken(parcial)` guarda tokens novos.
 */
export default function PainelEnvio({ cotacao, convites, config, qtdItens, tokens, onToken, onAtualizado, destaques, apenas = null, titulo = 'Enviar aos fornecedores', tipoMensagem = 'padrao', anuncio = '' }) {
  const lista = apenas ? convites.filter((c) => apenas.includes(c.id)) : convites;
  const encerrada = !['aberta'].includes(cotacao.status);
  const enviados = convites.filter((c) => c.status !== 'nao_enviado' || (c.envios ?? 0) > 0).length;
  const respondidos = convites.filter((c) => c.status === 'respondido').length;
  const proximoId = lista.find((c) => c.status === 'nao_enviado' && !(c.envios > 0))?.id ?? null;

  return (
    <section className="cmp-bloco" aria-labelledby="cmp-envio-titulo">
      <div className="cmp-secao-cab !mb-2">
        <h3 id="cmp-envio-titulo" tabIndex={-1} className="!mb-0">{titulo}</h3>
        <p className="cmp-texto-mudo" aria-live="polite">Enviados {enviados} de {convites.length} · Respostas {respondidos} de {convites.length}</p>
      </div>
      <span className="sr-only" aria-live="polite">{anuncio}</span>
      {encerrada && <div className="cmp-aviso">Cotação {cotacao.status === 'rascunho' ? 'em rascunho: abra-a para enviar' : cotacao.status === 'encerrada' ? 'encerrada' : 'cancelada'}. Os envios estão desabilitados.</div>}
      {lista.length === 0 ? (
        <p className="text-slate-300">Nenhum fornecedor nesta cotação. Volte ao rascunho para escolher.</p>
      ) : (
        <ul className="cmp-lista-limpa">
          {lista.map((c) => (
            <LinhaConvite
              key={c.id} convite={c} cotacao={cotacao} config={config} qtdItens={qtdItens}
              token={tokens[c.id]} onToken={onToken} onAtualizado={onAtualizado}
              destacado={destaques?.has(c.id)} proximo={c.id === proximoId && !encerrada} bloqueado={encerrada} tipoMensagem={tipoMensagem}
            />
          ))}
        </ul>
      )}
      <p className="cmp-texto-mudo mt-3">O envio é confirmado por você no WhatsApp. O sistema só sabe que o link foi aberto.</p>
    </section>
  );
}
