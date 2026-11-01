import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCircle, FaStop, FaTimes, FaVideo } from 'react-icons/fa';
import { EVIDENCIAS_CONFIG, formatarDuracao } from './config.js';
import { aquecerLocalizacao } from './carimbo.js';
import { ehErroDeChunk, importarGravador, oferecerAtualizacao } from './importarGravador.js';

const TEMPO_CARREGAR_MS = 10_000; // baixar o módulo de gravação
const TEMPO_PERMISSAO_MS = 45_000; // inclui o usuário responder ao pedido de permissão

const comLimite = (promessa, ms, nome) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(Object.assign(new Error('Tempo esgotado ao abrir a câmera.'), { name: nome })), ms);
  promessa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

// Gravação de vídeo no app: 720p ~1,2 Mbps, limite de duração configurável (já sai pequeno do aparelho).
export default function GravadorVideo({ onConcluir, onCancelar, onFallback }) {
  const limite = EVIDENCIAS_CONFIG.video.limiteSegundos;
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const ctrlRef = useRef(null);
  const miniaturaRef = useRef(null);
  const modulosRef = useRef(null);
  const onConcluirRef = useRef(onConcluir);
  const onCancelarRef = useRef(onCancelar);
  onConcluirRef.current = onConcluir;
  onCancelarRef.current = onCancelar;
  const [fase, setFase] = useState('abrindo'); // abrindo | pronto | gravando | salvando | erro
  const [chunkFalhou, setChunkFalhou] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    aquecerLocalizacao();
    (async () => {
      try {
        const g = await comLimite(importarGravador(), TEMPO_CARREGAR_MS, 'TimeoutError');
        modulosRef.current = g;
        const abertura = g.abrirMidia('video');
        // Se a câmera abrir depois do erro/timeout/fechamento, solta o stream para não deixar a câmera ligada
        abertura.then((s) => { if (!ativo) g.pararStream(s); }, () => {});
        const stream = await comLimite(abertura, TEMPO_PERMISSAO_MS, 'TimeoutError');
        if (!ativo) { g.pararStream(stream); return; }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
        setFase('pronto');
      } catch (e) {
        if (!ativo) return;
        ativo = false; // descarta um stream que chegue atrasado
        const g = modulosRef.current;
        if (ehErroDeChunk(e)) {
          setChunkFalhou(true);
          setErro(e.message);
        } else if (e?.name === 'TimeoutError') {
          setErro('A câmera demorou para abrir. Use a câmera do aparelho para gravar.');
        } else {
          setErro(g ? g.mensagemErroMidia(e, 'video') : (e?.message || 'Não foi possível abrir a câmera.'));
        }
        setFase('erro');
      }
    })();
    return () => {
      ativo = false;
      ctrlRef.current?.cancelar();
      modulosRef.current?.pararStream(streamRef.current);
    };
  }, []);

  const iniciar = async () => {
    const g = modulosRef.current;
    if (!g || !streamRef.current) return;
    try {
      const inicioMs = Date.now();
      const ctrl = g.gravar(streamRef.current, { tipo: 'video', onTick: setSegundos });
      ctrlRef.current = ctrl;
      setFase('gravando');
      // Capa do vídeo: um quadro do preview, logo no início
      setTimeout(async () => {
        const midia = await import('./midia.js');
        if (!miniaturaRef.current) miniaturaRef.current = await midia.miniaturaDeElementoVideo(videoRef.current);
      }, 800);
      const resultado = await ctrl.concluido;
      ctrlRef.current = null;
      g.pararStream(streamRef.current);
      setFase('salvando');
      if (resultado) onConcluirRef.current({ ...resultado, miniatura: miniaturaRef.current, inicioMs });
    } catch (e) {
      ctrlRef.current = null;
      g.pararStream(streamRef.current);
      setErro(g.mensagemErroMidia(e, 'video'));
      setFase('erro');
    }
  };

  const cancelar = () => {
    ctrlRef.current?.cancelar();
    onCancelarRef.current();
  };

  return createPortal(
    <div className="execucao-theme evid-gravador" role="dialog" aria-modal="true" aria-label="Gravar vídeo">
      <video ref={videoRef} className="evid-gravador-video" muted playsInline />
      <div className="evid-gravador-topo">
        <span className="evid-gravador-tempo">
          {fase === 'gravando' && <FaCircle className="evid-ponto-rec" aria-hidden="true" />}
          {formatarDuracao(segundos)} / {formatarDuracao(limite)}
        </span>
        <button type="button" className="evid-gravador-fechar" onClick={cancelar} aria-label="Cancelar gravação" disabled={fase === 'salvando'}>
          <FaTimes />
        </button>
      </div>
      {erro && <p className="evid-gravador-erro" role="alert">{erro}</p>}
      <div className="evid-gravador-base">
        {fase === 'abrindo' && <span className="evid-gravador-msg">Abrindo a câmera…</span>}
        {fase === 'pronto' && (
          <button type="button" className="evid-gravador-botao" onClick={iniciar} aria-label="Iniciar gravação">
            <FaCircle />
          </button>
        )}
        {fase === 'gravando' && (
          <button type="button" className="evid-gravador-botao evid-gravador-parar" onClick={() => ctrlRef.current?.parar()} aria-label="Parar gravação">
            <FaStop />
          </button>
        )}
        {fase === 'salvando' && <span className="evid-gravador-msg">Salvando…</span>}
        {fase === 'erro' && (
          <div className="evid-gravador-acoes">
            {chunkFalhou && (
              <button type="button" className="execucao-btn execucao-btn-primary tec-btn" onClick={oferecerAtualizacao}>
                Atualizar app
              </button>
            )}
            <button type="button" className="execucao-btn execucao-btn-primary tec-btn" onClick={() => onFallback?.()}>
              <FaVideo aria-hidden="true" /> Usar câmera do aparelho
            </button>
            <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={cancelar}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
