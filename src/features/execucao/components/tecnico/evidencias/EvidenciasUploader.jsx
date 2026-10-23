import React, { useRef } from 'react';
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaMicrophone, FaRedo, FaStop, FaTimes, FaVideo, FaClock, FaPlay, FaVolumeUp } from 'react-icons/fa';
import { EVIDENCIAS_CONFIG, ESTADOS, ROTULO_TIPO, formatarBytes, formatarDuracao, suportaGravacao } from './config.js';
import { aquecerLocalizacao } from './carimbo.js';
import GravadorVideo from './GravadorVideo.jsx';
import './evidencias.css';

const ICONE_TIPO = { foto: FaCamera, video: FaPlay, audio: FaVolumeUp };

const resumo = (itens) => {
  const n = (tipo) => itens.filter((i) => i.tipo === tipo).length;
  const partes = [];
  if (n('foto')) partes.push(`${n('foto')} ${n('foto') === 1 ? 'foto' : 'fotos'}`);
  if (n('video')) partes.push(`${n('video')} ${n('video') === 1 ? 'vídeo' : 'vídeos'}`);
  if (n('audio')) partes.push(`${n('audio')} ${n('audio') === 1 ? 'áudio' : 'áudios'}`);
  return partes.join(' · ');
};

function IconeEstado({ estado }) {
  if (estado === 'enviado') return <FaCheckCircle aria-hidden="true" />;
  if (estado === 'erro') return <FaExclamationTriangle aria-hidden="true" />;
  return <FaClock aria-hidden="true" />;
}

function Miniatura({ item, url, onRemover, onReenviar, desabilitado }) {
  const Icone = ICONE_TIPO[item.tipo];
  const removivel = !desabilitado && (item.estado === 'rascunho' || item.estado === 'erro' || item.estado === 'enviado');
  const compressao = item.tamanhoOriginal && item.comprimido && item.tamanhoOriginal !== item.tamanho
    ? `${formatarBytes(item.tamanhoOriginal)} → ${formatarBytes(item.tamanho)}`
    : formatarBytes(item.tamanho);

  return (
    <li className={`evid-item evid-item-${item.estado}`}>
      <div className="evid-item-midia">
        {url ? <img src={url} alt={ROTULO_TIPO[item.tipo]} className="evid-item-img" /> : <Icone className="evid-item-icone" aria-hidden="true" />}
        <span className="evid-item-tipo">
          <Icone aria-hidden="true" /> {item.duracaoSeg ? formatarDuracao(item.duracaoSeg) : ROTULO_TIPO[item.tipo]}
        </span>
        {removivel && (
          <button type="button" className="evid-item-remover" onClick={() => onRemover(item.id)} aria-label={`Remover ${ROTULO_TIPO[item.tipo].toLowerCase()}`}>
            <FaTimes aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="evid-item-info">
        <span className="evid-item-tamanho" title="Tamanho antes → depois da otimização">{compressao}</span>
        <span className={`evid-estado evid-estado-${item.estado}`}>
          <IconeEstado estado={item.estado} /> {ESTADOS[item.estado]}
        </span>
        {item.estado === 'erro' && (
          <button type="button" className="evid-reenviar" onClick={() => onReenviar(item.id)}>
            <FaRedo aria-hidden="true" /> Tentar de novo
          </button>
        )}
        {item.erro && item.estado !== 'enviado' && item.estado !== 'rascunho' && <span className="evid-item-msg">{item.erro}</span>}
      </div>
    </li>
  );
}

// Botões Foto/Vídeo/Áudio + galeria com remoção antes do envio. `controle` vem de useEvidencias().
export default function EvidenciasUploader({ controle, desabilitado = false }) {
  const c = controle;
  const inputFoto = useRef(null);
  const inputVideo = useRef(null);
  const gravadorSuportado = suportaGravacao();
  const travado = desabilitado || c.bloqueado || !c.armazenamentoOk;
  const emGravacao = !!c.gravandoAudio || c.gravandoVideo;
  const bloquearNovos = travado || c.limiteAtingido || emGravacao;

  const escolherArquivo = (aoEscolher) => (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    aoEscolher(arquivo);
  };

  const tocarFoto = () => { aquecerLocalizacao(); inputFoto.current?.click(); };
  const tocarVideo = () => {
    c.setErro('');
    if (gravadorSuportado) c.setGravandoVideo(true);
    else { aquecerLocalizacao(); inputVideo.current?.click(); }
  };

  const total = resumo(c.itens);

  return (
    <section className="evid" aria-label="Evidências">
      <div className="evid-cabecalho">
        <span className="execucao-form-label evid-titulo">
          Evidências{total ? ` (${total})` : ' (opcional)'}
        </span>
        <span className="evid-contador">{c.itens.length}/{EVIDENCIAS_CONFIG.maxArquivosPorAtividade}</span>
      </div>

      {c.bloqueado && <p className="evid-aviso">Modo teste (impersonation) ativo: o envio de evidências fica desativado.</p>}
      {!c.armazenamentoOk && <p className="evid-aviso">Este navegador não permite guardar arquivos no aparelho. Não é possível anexar evidências.</p>}

      <div className="evid-botoes">
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={tocarFoto} disabled={bloquearNovos}>
          <FaCamera aria-hidden="true" /> Foto
        </button>
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={tocarVideo} disabled={bloquearNovos}>
          <FaVideo aria-hidden="true" /> Vídeo
        </button>
        {c.gravandoAudio ? (
          <button type="button" className="execucao-btn execucao-btn-danger tec-btn" onClick={c.pararAudio}>
            <FaStop aria-hidden="true" /> Parar {formatarDuracao(c.gravandoAudio.segundos)}
          </button>
        ) : (
          <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={c.iniciarAudio} disabled={bloquearNovos}>
            <FaMicrophone aria-hidden="true" /> Áudio
          </button>
        )}
      </div>

      <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={escolherArquivo(c.capturarFoto)} />
      <input ref={inputVideo} type="file" accept="video/*" capture="environment" hidden onChange={escolherArquivo(c.capturarVideoArquivo)} />

      {c.gravandoAudio && (
        <div className="evid-gravando" role="status">
          <span className="evid-ponto-rec" aria-hidden="true" /> Gravando áudio {formatarDuracao(c.gravandoAudio.segundos)} / {formatarDuracao(EVIDENCIAS_CONFIG.audio.limiteSegundos)}
          <progress value={c.gravandoAudio.segundos} max={EVIDENCIAS_CONFIG.audio.limiteSegundos} />
        </div>
      )}

      {c.erro && <p className="tec-erro" role="alert">{c.erro}</p>}
      {c.limiteAtingido && <p className="evid-aviso">Limite de {EVIDENCIAS_CONFIG.maxArquivosPorAtividade} arquivos por atividade atingido.</p>}

      {(c.itens.length > 0 || c.trabalhos.length > 0) && (
        <ul className="evid-galeria">
          {c.itens.map((item) => (
            <Miniatura key={item.id} item={item} url={c.urls[item.id]} onRemover={c.remover} onReenviar={c.reenviar} desabilitado={desabilitado} />
          ))}
          {c.trabalhos.map((t) => (
            <li key={t.chave} className="evid-item evid-item-trabalhando" aria-live="polite">
              <div className="evid-item-midia"><span className="evid-spinner" aria-hidden="true" /></div>
              <div className="evid-item-info">
                <span className="evid-estado">{t.texto}</span>
                <progress aria-label={t.texto} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="evid-dica">
        Data, hora e localização ficam registradas em cada evidência. Sem sinal? Pode concluir: o envio acontece sozinho quando a conexão voltar.
      </p>

      {c.gravandoVideo && (
        <GravadorVideo
          onCancelar={() => c.setGravandoVideo(false)}
          onConcluir={(resultado) => { c.setGravandoVideo(false); c.guardarGravacao('video', resultado); }}
        />
      )}
    </section>
  );
}
