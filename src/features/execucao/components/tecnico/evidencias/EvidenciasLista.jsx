import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronLeft, FaChevronRight, FaDownload, FaMapMarkerAlt, FaPlay, FaSyncAlt, FaTimes, FaVolumeUp } from 'react-icons/fa';
import { execucaoEvidenciasService } from '../../../../../services/supabase/execucaoEvidencias.js';
import { formatarBytes, formatarDuracao } from './config.js';
import './evidencias.css';

const INTERVALO_ATUALIZACAO_MS = 20000;

const formatarQuando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
};

const linkMapa = (e) => (e.latitude != null && e.longitude != null
  ? `https://www.google.com/maps?q=${e.latitude},${e.longitude}`
  : null);

const ROTULO_TIPO = { foto: 'Foto', video: 'Vídeo', audio: 'Áudio' };

// Visualização em tela cheia com navegação (setas do teclado e botões) entre as mídias visuais e de áudio
function Visualizador({ itens, indice, onMudar, onFechar }) {
  const evidencia = itens[indice];
  const tem = itens.length > 1;
  const anterior = useCallback(() => onMudar((indice - 1 + itens.length) % itens.length), [indice, itens.length, onMudar]);
  const proxima = useCallback(() => onMudar((indice + 1) % itens.length), [indice, itens.length, onMudar]);

  useEffect(() => {
    const aoTeclar = (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); onFechar(); }
      else if (ev.key === 'ArrowLeft' && tem) { ev.stopPropagation(); anterior(); }
      else if (ev.key === 'ArrowRight' && tem) { ev.stopPropagation(); proxima(); }
    };
    document.addEventListener('keydown', aoTeclar, true);
    return () => document.removeEventListener('keydown', aoTeclar, true);
  }, [onFechar, anterior, proxima, tem]);

  const mapa = linkMapa(evidencia);
  return createPortal(
    <div className="execucao-theme evid-visualizador" role="dialog" aria-modal="true" aria-label={`${ROTULO_TIPO[evidencia.tipo] ?? 'Evidência'} ${indice + 1} de ${itens.length}`} onClick={onFechar}>
      <button type="button" className="evid-visualizador-fechar" onClick={onFechar} aria-label="Fechar"><FaTimes /></button>
      {tem && (
        <button type="button" className="evid-visualizador-nav evid-visualizador-nav-anterior" onClick={(e) => { e.stopPropagation(); anterior(); }} aria-label="Anterior">
          <FaChevronLeft />
        </button>
      )}
      <div className="evid-visualizador-conteudo" onClick={(e) => e.stopPropagation()}>
        {evidencia.tipo === 'foto' && <img key={evidencia.id} src={evidencia.url} alt="Evidência" />}
        {evidencia.tipo === 'video' && <video key={evidencia.id} src={evidencia.url} controls autoPlay playsInline />}
        {evidencia.tipo === 'audio' && <audio key={evidencia.id} src={evidencia.url} controls autoPlay className="evid-visualizador-audio" />}
        <div className="evid-visualizador-legenda">
          <span>{indice + 1} / {itens.length} · {formatarQuando(evidencia.capturado_em || evidencia.created_at)}</span>
          {evidencia.autor?.nome_completo && <span> · {evidencia.autor.nome_completo}</span>}
          {mapa && <a href={mapa} target="_blank" rel="noopener noreferrer"> · <FaMapMarkerAlt aria-hidden="true" /> mapa</a>}
          {evidencia.url && <a href={evidencia.url} target="_blank" rel="noopener noreferrer" download> · <FaDownload aria-hidden="true" /> baixar</a>}
        </div>
      </div>
      {tem && (
        <button type="button" className="evid-visualizador-nav evid-visualizador-nav-proxima" onClick={(e) => { e.stopPropagation(); proxima(); }} aria-label="Próxima">
          <FaChevronRight />
        </button>
      )}
    </div>,
    document.body
  );
}

// Evidências já enviadas de uma atividade (URLs assinadas).
// - Sempre mostra a seção (com "nenhuma evidência" quando vazia), para o admin saber que o lugar é este;
// - atualiza em segundo plano sem apagar o que já está na tela (sem "piscar") e reenvia a consulta ao voltar para a aba.
export default function EvidenciasLista({ atividadeId, ocultarSeVazio = false, titulo = 'Evidências', recarregarChave = 0 }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [indiceAberto, setIndiceAberto] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const montado = useRef(true);
  const requisicao = useRef(0);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!atividadeId) return;
    const id = ++requisicao.current;
    if (!silencioso) setAtualizando(true);
    try {
      const dados = await execucaoEvidenciasService.listarEvidencias(atividadeId);
      if (!montado.current || id !== requisicao.current) return;
      setLista(dados);
      setErro('');
    } catch (e) {
      if (!montado.current || id !== requisicao.current) return;
      console.error('Erro ao carregar evidências:', e);
      // com algo já na tela, uma falha em segundo plano não apaga nem avisa
      if (!silencioso) setErro('Não foi possível carregar as evidências.');
    } finally {
      if (montado.current && id === requisicao.current) setAtualizando(false);
    }
  }, [atividadeId]);

  useEffect(() => {
    montado.current = true;
    setLista(null);
    setErro('');
    setIndiceAberto(null);
    carregar();

    const timer = setInterval(() => { if (document.visibilityState === 'visible') carregar({ silencioso: true }); }, INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar({ silencioso: true }); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      montado.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregar, recarregarChave]);

  const fechar = useCallback(() => setIndiceAberto(null), []);
  const itensComUrl = (lista ?? []).filter((e) => e.url);

  const abrir = (evidencia) => {
    const i = itensComUrl.findIndex((e) => e.id === evidencia.id);
    if (i >= 0) setIndiceAberto(i);
  };

  const cabecalho = (
    <div className="evid-cabecalho">
      <span className="execucao-form-label evid-titulo">{titulo}{lista ? ` (${lista.length})` : ''}</span>
      <button type="button" className="evid-atualizar" onClick={() => carregar()} disabled={atualizando} aria-label="Atualizar evidências" title="Atualizar">
        <FaSyncAlt className={atualizando ? 'animate-spin' : ''} aria-hidden="true" />
      </button>
    </div>
  );

  if (lista === null && !erro) {
    return (
      <section className="evid evid-lista" aria-label={titulo} aria-busy="true">
        {cabecalho}
        <div className="evid-galeria evid-galeria-esqueleto" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  if (erro && lista === null) {
    return (
      <section className="evid evid-lista" aria-label={titulo}>
        {cabecalho}
        <p className="tec-erro" role="alert">{erro}</p>
      </section>
    );
  }

  if (!lista.length) {
    if (ocultarSeVazio) return null;
    return (
      <section className="evid evid-lista" aria-label={titulo}>
        {cabecalho}
        <p className="evid-dica">
          Nenhuma evidência enviada ainda. O técnico anexa fotos, vídeos e áudios ao concluir a atividade; se estava sem sinal, elas aparecem aqui quando o envio for concluído.
        </p>
      </section>
    );
  }

  return (
    <section className="evid evid-lista" aria-label={titulo}>
      {cabecalho}
      <ul className="evid-galeria">
        {lista.map((e) => {
          const mapa = linkMapa(e);
          const miniatura = e.url_miniatura || (e.tipo === 'foto' && e.url);
          return (
            <li key={e.id} className="evid-item evid-item-enviado">
              <div className="evid-item-midia">
                {e.tipo === 'audio' ? (
                  <audio src={e.url || undefined} controls preload="none" className="evid-item-audio" />
                ) : (
                  <button type="button" className="evid-item-abrir" onClick={() => abrir(e)} disabled={!e.url} aria-label={e.tipo === 'video' ? 'Reproduzir vídeo' : 'Ampliar foto'}>
                    {miniatura
                      ? <img src={miniatura} alt="" className="evid-item-img" loading="lazy" />
                      : e.tipo === 'video' && e.url
                        ? <video src={`${e.url}#t=0.1`} preload="metadata" muted playsInline className="evid-item-img" />
                        : <FaPlay className="evid-item-icone" aria-hidden="true" />}
                    {e.tipo === 'video' && <FaPlay className="evid-item-play" aria-hidden="true" />}
                  </button>
                )}
                <span className="evid-item-tipo">
                  {e.tipo === 'audio' ? <FaVolumeUp aria-hidden="true" /> : null}
                  {ROTULO_TIPO[e.tipo] ? ` ${ROTULO_TIPO[e.tipo]}` : ''}
                  {e.duracao_segundos ? ` · ${formatarDuracao(e.duracao_segundos)}` : ''}
                </span>
              </div>
              <div className="evid-item-info">
                <span className="evid-item-tamanho">{formatarQuando(e.capturado_em || e.created_at)}</span>
                {e.autor?.nome_completo && <span className="evid-item-autor">{e.autor.nome_completo}</span>}
                <span className="evid-item-tamanho">{formatarBytes(e.tamanho_bytes)}</span>
                {mapa ? (
                  <a className="evid-mapa" href={mapa} target="_blank" rel="noopener noreferrer">
                    <FaMapMarkerAlt aria-hidden="true" /> Ver no mapa{e.precisao_metros != null ? ` (±${Math.round(e.precisao_metros)} m)` : ''}
                  </a>
                ) : (
                  <span className="evid-item-msg">Localização indisponível</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {indiceAberto !== null && itensComUrl[indiceAberto] && (
        <Visualizador itens={itensComUrl} indice={indiceAberto} onMudar={setIndiceAberto} onFechar={fechar} />
      )}
    </section>
  );
}
