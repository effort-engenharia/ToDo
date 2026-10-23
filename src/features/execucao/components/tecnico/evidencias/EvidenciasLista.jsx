import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaMapMarkerAlt, FaPlay, FaTimes, FaVolumeUp } from 'react-icons/fa';
import { execucaoEvidenciasService } from '../../../../../services/supabase/execucaoEvidencias.js';
import { formatarBytes, formatarDuracao } from './config.js';
import './evidencias.css';

const formatarQuando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const linkMapa = (e) => (e.latitude != null && e.longitude != null
  ? `https://www.google.com/maps?q=${e.latitude},${e.longitude}`
  : null);

function Visualizador({ evidencia, onFechar }) {
  useEffect(() => {
    const aoTeclar = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); onFechar(); } };
    document.addEventListener('keydown', aoTeclar, true);
    return () => document.removeEventListener('keydown', aoTeclar, true);
  }, [onFechar]);

  return createPortal(
    <div className="execucao-theme evid-visualizador" role="dialog" aria-modal="true" aria-label="Evidência" onClick={onFechar}>
      <button type="button" className="evid-visualizador-fechar" onClick={onFechar} aria-label="Fechar"><FaTimes /></button>
      <div className="evid-visualizador-conteudo" onClick={(e) => e.stopPropagation()}>
        {evidencia.tipo === 'foto' && <img src={evidencia.url} alt="Evidência" />}
        {evidencia.tipo === 'video' && <video src={evidencia.url} controls autoPlay playsInline />}
      </div>
    </div>,
    document.body
  );
}

// Evidências já enviadas de uma atividade (URLs assinadas). Reutilizável em AtividadesDia/Agenda/detalhe da obra.
export default function EvidenciasLista({ atividadeId, ocultarSeVazio = true, titulo = 'Evidências', recarregarChave = 0 }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);
  const fechar = useCallback(() => setAberta(null), []);

  useEffect(() => {
    if (!atividadeId) return undefined;
    let ativo = true;
    execucaoEvidenciasService.listarEvidencias(atividadeId)
      .then((dados) => { if (ativo) { setLista(dados); setErro(''); } })
      .catch((e) => { if (ativo) { console.error('Erro ao carregar evidências:', e); setErro('Não foi possível carregar as evidências.'); } });
    return () => { ativo = false; };
  }, [atividadeId, recarregarChave]);

  if (erro) return <p className="tec-erro" role="alert">{erro}</p>;
  if (lista === null) return <p className="evid-dica">Carregando evidências…</p>;
  if (!lista.length) return ocultarSeVazio ? null : <p className="evid-dica">Nenhuma evidência enviada.</p>;

  return (
    <section className="evid evid-lista" aria-label={titulo}>
      <div className="evid-cabecalho">
        <span className="execucao-form-label evid-titulo">{titulo} ({lista.length})</span>
      </div>
      <ul className="evid-galeria">
        {lista.map((e) => {
          const mapa = linkMapa(e);
          return (
            <li key={e.id} className="evid-item evid-item-enviado">
              <div className="evid-item-midia">
                {e.tipo === 'audio' ? (
                  <audio src={e.url || undefined} controls preload="none" className="evid-item-audio" />
                ) : (
                  <button type="button" className="evid-item-abrir" onClick={() => e.url && setAberta(e)} aria-label={e.tipo === 'video' ? 'Reproduzir vídeo' : 'Ampliar foto'}>
                    {e.url_miniatura || (e.tipo === 'foto' && e.url)
                      ? <img src={e.url_miniatura || e.url} alt="" className="evid-item-img" loading="lazy" />
                      : <FaPlay className="evid-item-icone" aria-hidden="true" />}
                    {e.tipo === 'video' && <FaPlay className="evid-item-play" aria-hidden="true" />}
                  </button>
                )}
                <span className="evid-item-tipo">
                  {e.tipo === 'audio' ? <FaVolumeUp aria-hidden="true" /> : null}
                  {e.duracao_segundos ? ` ${formatarDuracao(e.duracao_segundos)}` : ''}
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
      {aberta && <Visualizador evidencia={aberta} onFechar={fechar} />}
    </section>
  );
}
