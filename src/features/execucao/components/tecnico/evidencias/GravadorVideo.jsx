import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCircle, FaStop, FaTimes } from 'react-icons/fa';
import { EVIDENCIAS_CONFIG, formatarDuracao } from './config.js';
import { aquecerLocalizacao } from './carimbo.js';

// Gravação de vídeo no app: 720p ~1,2 Mbps, limite de duração configurável (já sai pequeno do aparelho).
export default function GravadorVideo({ onConcluir, onCancelar }) {
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
  const [fase, setFase] = useState('abrindo'); // abrindo | pronto | gravando | salvando
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    aquecerLocalizacao();
    (async () => {
      const g = await import('./gravador.js');
      modulosRef.current = g;
      try {
        const stream = await g.abrirMidia('video');
        if (!ativo) { g.pararStream(stream); return; }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
        setFase('pronto');
      } catch (e) {
        if (ativo) setErro(g.mensagemErroMidia(e, 'video'));
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
      setFase('pronto');
      setErro(e?.message || 'Falha na gravação.');
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
      </div>
    </div>,
    document.body
  );
}
