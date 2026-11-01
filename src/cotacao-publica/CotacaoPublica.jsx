import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { obter, responder } from './api.js';
import {
  formularioDaResposta, formularioVazio, idDoCampoServidor, itemVazio, payloadDoFormulario, totaisNominais, validarFormulario
} from './formulario.js';
import CartaoItem from './componentes/CartaoItem.jsx';
import BlocoCondicoes from './componentes/BlocoCondicoes.jsx';
import BlocoEntrega from './componentes/BlocoEntrega.jsx';
import RodapeResumo from './componentes/RodapeResumo.jsx';
import EstadoMensagem from './componentes/EstadoMensagem.jsx';

// Página pública do fornecedor (/cotacao/#token). Plano §9 e Anexo B.1. Sem sessão, sem app logado, sem supabase-js.
const ESPERA_RATE_LIMIT_S = 30;
const MS_DUAS_HORAS = 2 * 3600 * 1000;
const dois = (n) => String(n).padStart(2, '0');

const dataHora = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia} ${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const hora = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${dois(d.getHours())}:${dois(d.getMinutes())}`; };

const faltam = (iso, agora) => {
  const ms = new Date(iso).getTime() - agora;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  const dias = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  if (dias > 0) return `${dias} ${dias === 1 ? 'dia' : 'dias'}${h ? ` e ${h} h` : ''}`;
  if (h > 0) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `${Math.max(min, 1)} min`;
};

const hashToken = async (token) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return null; // contexto sem crypto.subtle: sem rascunho
  }
};

const lerRascunho = (chave) => { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } };
const gravarRascunho = (chave, v) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* storage cheio/bloqueado: segue sem rascunho */ } };
const apagarRascunho = (chave) => { try { localStorage.removeItem(chave); } catch { /* ignora */ } };

const focarCampo = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const alvo = el.matches('input,button,textarea,select') ? el : el.querySelector('input:not([disabled]),button:not([disabled]),textarea') ?? el;
  alvo.scrollIntoView({ block: 'center' });
  alvo.focus({ preventScroll: true });
};

const ESTADOS_PAGINA = {
  LINK_INVALIDO: { icone: '🔗', titulo: 'Link inválido', texto: 'Confira se o endereço está completo ou peça um novo link a quem enviou.' },
  LINK_SUBSTITUIDO: { icone: '🔄', titulo: 'Este link foi substituído', texto: 'Use o link mais recente que você recebeu pelo WhatsApp.' },
  MUITAS_TENTATIVAS: { icone: '⏳', titulo: 'Muitas tentativas', texto: 'Aguarde alguns minutos e tente de novo.' },
  INDISPONIVEL: { icone: '🛠️', titulo: 'Cotação temporariamente indisponível', texto: 'Tente novamente mais tarde.' },
  ERRO_INTERNO: { icone: '🛠️', titulo: 'Não foi possível processar agora', texto: 'Tente novamente em instantes.' },
  REDE: { icone: '📡', titulo: 'Sem conexão', texto: 'Não conseguimos carregar a cotação. Verifique sua internet e tente de novo.' },
  encerrada: { icone: '✅', titulo: 'Cotação encerrada', texto: 'Obrigado pela participação!' },
  recusou: { icone: '✅', titulo: 'Recebemos sua resposta', texto: 'Obrigado por avisar.' }
};

const BotaoTentar = ({ onClick, esperaInicial = 0 }) => {
  const [espera, setEspera] = useState(esperaInicial);
  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  return (
    <button type="button" className="cp-botao cp-botao-auto" disabled={espera > 0} onClick={onClick}>
      {espera > 0 ? `Tentar de novo (${espera} s)` : 'Tentar de novo'}
    </button>
  );
};

const ConfirmarRecusa = ({ empresa, enviando, onVoltar, onConfirmar }) => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onVoltar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onVoltar]);
  return (
    <div className="cp-overlay">
      <div className="cp-dialogo" role="dialog" aria-modal="true" aria-labelledby="cp-recusa-titulo">
        <h2 id="cp-recusa-titulo" className="cp-h2">Não vai cotar desta vez?</h2>
        <p>Vamos avisar a {empresa} que você não vai participar.</p>
        <div className="cp-dialogo-acoes">
          <button ref={ref} type="button" className="cp-botao cp-botao-sec" onClick={onVoltar}>Voltar</button>
          <button type="button" className="cp-botao" aria-busy={enviando || undefined} disabled={enviando} onClick={onConfirmar}>
            {enviando ? 'Enviando…' : 'Sim, não vou cotar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CotacaoPublica = () => {
  const token = useMemo(() => window.location.hash.slice(1).trim(), []);
  const [fase, setFase] = useState('carregando'); // 'carregando' | 'form' | chave de ESTADOS_PAGINA
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(formularioVazio);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [enviado, setEnviado] = useState(null); // { em, versao }
  const [avisoLista, setAvisoLista] = useState(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const [confirmarRecusa, setConfirmarRecusa] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [chaveRascunho, setChaveRascunho] = useState(null);
  const [versaoBase, setVersaoBase] = useState(null);
  const formCarregado = useRef(false);

  const linhasBrutas = dados?.itens;
  const versaoLista = dados?.cotacao?.versao_lista ?? 0;
  const somenteLeitura = dados?.estado === 'prazo_encerrado';
  const temResposta = Boolean(dados?.resposta) || Boolean(enviado);

  const linhas = useMemo(() => (linhasBrutas || []).map((l) => ({
    ...l,
    alterado: versaoBase != null && Number(l.alterado_na_versao) > versaoBase
  })), [linhasBrutas, versaoBase]);

  // Contagem regressiva do prazo
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async () => {
    setFase('carregando');
    if (!token) { setFase('LINK_INVALIDO'); return; }
    const r = await obter(token);
    if (!r.ok) {
      setFase(ESTADOS_PAGINA[r.codigo] ? r.codigo : 'INDISPONIVEL');
      return;
    }
    if (r.estado === 'encerrada') { setDados(r); setFase('encerrada'); return; }

    const chave = await hashToken(token);
    const k = chave ? `cot:rasc:${chave}` : null;
    setChaveRascunho(k);
    setVersaoBase((atual) => atual ?? r.resposta?.versao_lista ?? r.cotacao?.versao_lista ?? 0);
    const inicial = formularioDaResposta(r.resposta);
    const rasc = k && r.estado === 'aberta' ? lerRascunho(k) : null;
    if (rasc?.f && typeof rasc.f === 'object') {
      setForm({ ...formularioVazio(), ...rasc.f });
      setRascunhoRestaurado(true);
    } else {
      setForm(inicial);
    }
    if (r.resposta && !r.resposta.recusou) setEnviado({ em: r.resposta.enviado_em, versao: r.resposta.versao });
    formCarregado.current = true;
    setDados(r);
    setFase('form');
  }, [token]);

  useEffect(() => {
    carregar(); // carga inicial a partir do token do fragmento
  }, [carregar]);

  // Rascunho local (chave = hash do token): debounce de 500 ms
  useEffect(() => {
    if (!chaveRascunho || !formCarregado.current || somenteLeitura || fase !== 'form') return undefined;
    const t = setTimeout(() => gravarRascunho(chaveRascunho, { v: versaoLista, f: form }), 500);
    return () => clearTimeout(t);
  }, [form, chaveRascunho, somenteLeitura, fase, versaoLista]);

  const validacao = useMemo(
    () => (fase === 'form' ? validarFormulario(linhas, form, versaoLista) : { ok: true, erros: {}, ordem: [] }),
    [fase, linhas, form, versaoLista]
  );
  const erros = useMemo(() => (tentou ? { ...validacao.erros, ...errosServidor } : errosServidor), [tentou, validacao, errosServidor]);
  const totais = useMemo(() => totaisNominais(linhas, form), [linhas, form]);
  const nErros = tentou ? validacao.ordem.length : 0;
  const nRespondidos = linhas.filter((l) => form.itens[l.id]?.tem === true || form.itens[l.id]?.tem === false).length;

  const aoMudar = useCallback((novo) => {
    setForm(novo);
    setErrosServidor({});
    setErroEnvio(null);
  }, []);

  const mudarItem = (id, valor) => aoMudar({ ...form, itens: { ...form.itens, [id]: valor } });

  const tratarFalha = (r) => {
    switch (r.codigo) {
      case 'DADOS_INVALIDOS': {
        const id = idDoCampoServidor(r.campo, form, linhas);
        if (id) {
          setErrosServidor({ [id]: r.mensagem || 'Valor inválido' });
          setTimeout(() => focarCampo(id), 0);
        } else {
          setErroEnvio(r.mensagem || 'Confira os dados e tente de novo.');
        }
        break;
      }
      case 'PRAZO_ENCERRADO':
        setDados((d) => ({ ...d, estado: 'prazo_encerrado' }));
        break;
      case 'COTACAO_ENCERRADA': setFase('encerrada'); break;
      case 'LINK_INVALIDO': case 'LINK_SUBSTITUIDO': setFase(r.codigo); break;
      case 'LISTA_ALTERADA':
        obter(token).then((n) => {
          if (n.ok && n.estado !== 'encerrada') {
            setDados(n);
            setAvisoLista(true);
            setTimeout(() => document.querySelector('.cp-selo-aviso')?.scrollIntoView({ block: 'center' }), 50);
          } else if (!n.ok && ESTADOS_PAGINA[n.codigo]) setFase(n.codigo);
        });
        break;
      case 'PAYLOAD_GRANDE': case 'LIMITE_VERSOES':
        setErroEnvio(`Você atingiu o limite de alterações. Fale com a ${dados?.empresa_contratante ?? 'empresa'}.`);
        break;
      case 'MUITAS_TENTATIVAS': setErroEnvio('Muitas tentativas. Aguarde alguns minutos e tente de novo.'); break;
      case 'ERRO_INTERNO': setErroEnvio('Não foi possível processar agora, tente novamente em instantes. Seus dados continuam aqui.'); break;
      case 'INDISPONIVEL': setErroEnvio('Cotação temporariamente indisponível. Tente novamente mais tarde.'); break;
      default: setErroEnvio('Não conseguimos enviar. Seus dados continuam aqui, tente de novo.');
    }
  };

  const enviar = async (recusou = false) => {
    if (enviando) return;
    setErroEnvio(null);
    if (!recusou) {
      setTentou(true);
      if (!validacao.ok) { focarCampo(validacao.ordem[0]); return; }
    }
    setEnviando(true);
    const r = await responder(token, payloadDoFormulario(linhas, form, versaoLista, recusou));
    setEnviando(false);
    setConfirmarRecusa(false);
    if (!r.ok) { tratarFalha(r); return; }
    if (chaveRascunho) apagarRascunho(chaveRascunho);
    setErrosServidor({});
    setAvisoLista(false);
    if (recusou) { setFase('recusou'); return; }
    setEnviado({ em: r.enviado_em, versao: r.versao });
    window.scrollTo({ top: 0 });
  };

  if (fase === 'carregando') {
    return (
      <main className="cp-pagina" aria-busy="true">
        <p className="cp-sr" role="status">Carregando cotação…</p>
        <div className="cp-skel cp-skel-topo" /><div className="cp-skel cp-skel-cartao" /><div className="cp-skel cp-skel-cartao" /><div className="cp-skel cp-skel-cartao" />
      </main>
    );
  }
  if (fase !== 'form') {
    const e = ESTADOS_PAGINA[fase] ?? ESTADOS_PAGINA.INDISPONIVEL;
    let acao = null;
    if (fase === 'MUITAS_TENTATIVAS') acao = <BotaoTentar onClick={carregar} esperaInicial={ESPERA_RATE_LIMIT_S} />;
    else if (fase === 'REDE' || fase === 'ERRO_INTERNO') acao = <BotaoTentar onClick={carregar} />;
    return <EstadoMensagem icone={e.icone} titulo={e.titulo} texto={e.texto} acao={acao} />;
  }

  const prazoIso = dados.cotacao?.prazo_resposta;
  const resta = faltam(prazoIso, agora);
  const urgente = resta && new Date(prazoIso).getTime() - agora < MS_DUAS_HORAS;
  const recusouAntes = dados.resposta?.recusou === true && !enviado;

  return (
    <>
      <main className="cp-pagina cp-com-rodape">
        <header className="cp-cabecalho">
          <h1 className="cp-h1">{dados.empresa_contratante} · Cotação nº {dados.cotacao?.numero}</h1>
          <p>Olá, {dados.fornecedor?.nome_contato} ({dados.fornecedor?.empresa})</p>
          <p className={urgente ? 'cp-prazo-urgente' : ''}>
            ⏰ {somenteLeitura ? 'Prazo encerrado' : <>Responda até {dataHora(prazoIso)}{resta ? ` (faltam ${resta})` : ''}</>}
          </p>
          {dados.cotacao?.regiao_entrega && <p>📍 Entrega: {dados.cotacao.regiao_entrega}</p>}
          {dados.cotacao?.observacao && <p className="cp-dica">{dados.cotacao.observacao}</p>}
        </header>

        <div aria-live="polite" role="status" className="cp-live">
          {nErros > 0 && <div className="cp-faixa cp-faixa-erro">Corrija {nErros} {nErros === 1 ? 'campo' : 'campos'} para enviar</div>}
          {enviado && (
            <div className="cp-faixa cp-faixa-ok">
              ✅ Proposta enviada às {hora(enviado.em)} (versão {enviado.versao}).
              {!somenteLeitura && ` Você pode alterar até ${dataHora(prazoIso)}.`}
            </div>
          )}
          {rascunhoRestaurado && !enviado && <div className="cp-faixa cp-faixa-info">Recuperamos o que você já tinha preenchido.</div>}
          {recusouAntes && <div className="cp-faixa cp-faixa-info">Você informou que não vai cotar. Se mudar de ideia, preencha e envie sua proposta.</div>}
        </div>
        {somenteLeitura && (
          <div className="cp-faixa cp-faixa-aviso" role="status">
            <strong>O prazo desta cotação terminou.</strong> Você ainda pode ver o que enviou, mas não é mais possível alterar.
          </div>
        )}
        {(dados.precisa_reconfirmar || avisoLista) && !somenteLeitura && (
          <div className="cp-faixa cp-faixa-aviso" role="status">
            {avisoLista
              ? 'A lista foi atualizada enquanto você preenchia. Mantivemos os preços dos itens que não mudaram; confira os itens marcados.'
              : 'A lista foi alterada. Confira os itens marcados como "alterado" e envie sua proposta de novo.'}
          </div>
        )}

        <fieldset className="cp-form" disabled={somenteLeitura}>
          <section aria-labelledby="cp-itens-grupo">
            <div className="cp-itens-cab">
              <h2 id="cp-itens-grupo" tabIndex={-1} className="cp-h2">Itens ({linhas.length})</h2>
              <span className="cp-dica">Respondidos {nRespondidos} de {linhas.length}</span>
            </div>
            {erros['cp-itens-grupo'] && <p id="cp-itens-grupo-erro" className="cp-erro">⚠ {erros['cp-itens-grupo']}</p>}
            {linhas.map((l, idx) => (
              <CartaoItem
                key={l.id} idx={idx} linha={l} valor={form.itens[l.id] ?? itemVazio()} erros={erros}
                somenteLeitura={somenteLeitura} onChange={(v) => mudarItem(l.id, v)}
              />
            ))}
          </section>

          <BlocoCondicoes valor={form} erros={erros} onChange={aoMudar} baseItens={totais.base} somenteLeitura={somenteLeitura} />
          <BlocoEntrega valor={form} erros={erros} onChange={aoMudar} regiao={dados.cotacao?.regiao_entrega} somenteLeitura={somenteLeitura} />
        </fieldset>

        {!somenteLeitura && (
          <button type="button" className="cp-botao-link" disabled={enviando} onClick={() => setConfirmarRecusa(true)}>Não vou cotar</button>
        )}
      </main>

      <RodapeResumo
        totais={totais} enviando={enviando} temResposta={temResposta} erroEnvio={erroEnvio}
        bloqueado={somenteLeitura} onEnviar={() => enviar(false)}
      />
      {confirmarRecusa && (
        <ConfirmarRecusa
          empresa={dados.empresa_contratante} enviando={enviando}
          onVoltar={() => setConfirmarRecusa(false)} onConfirmar={() => enviar(true)}
        />
      )}
    </>
  );
};

export default CotacaoPublica;
