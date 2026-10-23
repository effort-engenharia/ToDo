import { useCallback, useEffect, useRef, useState } from 'react';
import { EVIDENCIAS_CONFIG as CFG, novoUuid } from './config.js';
import {
  adicionarEvidencia,
  armazenamentoLocalDisponivel,
  assinarFila,
  iniciarFilaEvidencias,
  liberarRascunhos,
  listarEvidenciasLocais,
  reenviarEvidencia,
  removerEvidencia
} from './filaUpload.js';
import { aquecerLocalizacao, instanteDaCaptura, obterLocalizacao } from './carimbo.js';
import { isImpersonating } from '../../../../../utils/impersonationGuard.js';

const mensagemDe = (err, padrao) => err?.message || padrao;

// Estado das evidências de uma atividade: itens da fila local + trabalhos em andamento (otimizando/gravando).
export function useEvidencias(atividadeId, usuarioId) {
  const [itens, setItens] = useState([]);
  const [trabalhos, setTrabalhos] = useState([]);
  const [erro, setErro] = useState('');
  const [armazenamentoOk, setArmazenamentoOk] = useState(true);
  const [gravandoAudio, setGravandoAudio] = useState(null); // { segundos }
  const [gravandoVideo, setGravandoVideo] = useState(false);
  const [urls, setUrls] = useState({});
  const urlsRef = useRef(new Map());
  const audioRef = useRef(null);
  const ativoRef = useRef(true);
  const bloqueado = isImpersonating();

  const recarregar = useCallback(async () => {
    try {
      const lista = await listarEvidenciasLocais(atividadeId);
      lista.sort((a, b) => a.criadoEm - b.criadoEm);
      if (!ativoRef.current) return;
      setItens(lista);

      const mapa = urlsRef.current;
      const ids = new Set(lista.map((i) => i.id));
      for (const [id, url] of mapa) if (!ids.has(id)) { URL.revokeObjectURL(url); mapa.delete(id); }
      for (const i of lista) if (i.miniatura && !mapa.has(i.id)) mapa.set(i.id, URL.createObjectURL(i.miniatura));
      setUrls(Object.fromEntries(mapa));
    } catch { /* tratado em armazenamentoOk */ }
  }, [atividadeId]);

  useEffect(() => {
    ativoRef.current = true;
    iniciarFilaEvidencias();
    armazenamentoLocalDisponivel().then((ok) => { if (ativoRef.current) setArmazenamentoOk(ok); });
    recarregar();
    const cancelar = assinarFila(recarregar);
    const mapa = urlsRef.current;
    return () => {
      ativoRef.current = false;
      cancelar();
      audioRef.current?.cancelar();
      for (const url of mapa.values()) URL.revokeObjectURL(url);
      mapa.clear();
    };
  }, [recarregar]);

  const iniciarTrabalho = useCallback((tipo, texto) => {
    const chave = novoUuid();
    setTrabalhos((t) => [...t, { chave, tipo, texto }]);
    return chave;
  }, []);
  const atualizarTrabalho = useCallback((chave, texto) => setTrabalhos((t) => t.map((x) => (x.chave === chave ? { ...x, texto } : x))), []);
  const encerrarTrabalho = useCallback((chave) => setTrabalhos((t) => t.filter((x) => x.chave !== chave)), []);

  const guardar = useCallback(async (dados) => {
    await adicionarEvidencia({ atividadeId, usuarioId, ...dados });
  }, [atividadeId, usuarioId]);

  const capturarFoto = useCallback(async (arquivo) => {
    if (!arquivo) return;
    setErro('');
    const chave = iniciarTrabalho('foto', 'Otimizando foto…');
    try {
      const [midia, localizacao] = await Promise.all([import('./midia.js'), obterLocalizacao()]);
      const data = instanteDaCaptura(arquivo);
      let resultado;
      let comprimido = true;
      try {
        resultado = await midia.comprimirFoto(arquivo, { data, localizacao });
      } catch (e) {
        console.warn('[evidencias] compressão falhou, usando o original', e);
        if (arquivo.size > CFG.foto.maxBytesOriginalSemCompressao) {
          throw new Error('Não foi possível otimizar esta foto e ela é grande demais para enviar. Tire outra.');
        }
        resultado = { blob: arquivo, miniatura: null, mime: arquivo.type || 'image/jpeg' };
        comprimido = false;
      }
      atualizarTrabalho(chave, 'Salvando…');
      await guardar({
        tipo: 'foto',
        blob: resultado.blob,
        miniatura: resultado.miniatura,
        mime: resultado.mime,
        tamanhoOriginal: arquivo.size,
        comprimido,
        capturadoEm: data.toISOString(),
        localizacao,
        conteudo: { origem: 'camera', carimbo_na_imagem: comprimido, largura: resultado.largura ?? null, altura: resultado.altura ?? null }
      });
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível adicionar a foto.'));
    } finally {
      encerrarTrabalho(chave);
    }
  }, [guardar, iniciarTrabalho, atualizarTrabalho, encerrarTrabalho]);

  // Vídeo gravado dentro do app (já comprimido: 720p ~1,2 Mbps) ou áudio gravado
  const guardarGravacao = useCallback(async (tipo, { blob, mime, duracaoSeg, miniatura = null, inicioMs }) => {
    const chave = iniciarTrabalho(tipo, 'Salvando…');
    try {
      const localizacao = await obterLocalizacao({ timeoutMs: 5000 });
      await guardar({
        tipo,
        blob,
        miniatura,
        mime,
        tamanhoOriginal: blob.size,
        duracaoSeg,
        comprimido: true,
        capturadoEm: new Date(inicioMs ?? Date.now()).toISOString(),
        localizacao,
        conteudo: { origem: 'gravador_app', perfil: tipo === 'video' ? '720p-1.2Mbps' : 'opus-32kbps' }
      });
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível salvar a gravação.'));
    } finally {
      encerrarTrabalho(chave);
    }
  }, [guardar, iniciarTrabalho, encerrarTrabalho]);

  // Contingência: vídeo da câmera nativa (sem recompressão). Acima do limite do bucket é rejeitado.
  const capturarVideoArquivo = useCallback(async (arquivo) => {
    if (!arquivo) return;
    setErro('');
    if (arquivo.size > CFG.video.maxBytes) {
      setErro(`Vídeo muito grande (${(arquivo.size / 1048576).toFixed(0)} MB). O limite é ${Math.round(CFG.video.maxBytes / 1048576)} MB: grave um vídeo mais curto (até ${CFG.video.limiteSegundos} s) ou reduza a qualidade da câmera.`);
      return;
    }
    const chave = iniciarTrabalho('video', 'Lendo vídeo…');
    try {
      const [midia, localizacao] = await Promise.all([import('./midia.js'), obterLocalizacao()]);
      const { duracao, miniatura } = await midia.inspecionarVideoArquivo(arquivo);
      const data = instanteDaCaptura(arquivo);
      await guardar({
        tipo: 'video',
        blob: arquivo,
        miniatura,
        mime: (arquivo.type || 'video/mp4').split(';')[0],
        tamanhoOriginal: arquivo.size,
        duracaoSeg: duracao,
        comprimido: false,
        capturadoEm: data.toISOString(),
        localizacao,
        conteudo: { origem: 'camera_nativa', sem_recompressao: true }
      });
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível adicionar o vídeo.'));
    } finally {
      encerrarTrabalho(chave);
    }
  }, [guardar, iniciarTrabalho, encerrarTrabalho]);

  const iniciarAudio = useCallback(async () => {
    setErro('');
    if (audioRef.current) return;
    aquecerLocalizacao();
    const g = await import('./gravador.js');
    let stream = null;
    try {
      stream = await g.abrirMidia('audio');
      const inicioMs = Date.now();
      const ctrl = g.gravar(stream, { tipo: 'audio', onTick: (segundos) => setGravandoAudio({ segundos }) });
      audioRef.current = ctrl;
      setGravandoAudio({ segundos: 0 });
      const resultado = await ctrl.concluido;
      if (resultado && ativoRef.current) await guardarGravacao('audio', { ...resultado, inicioMs });
    } catch (e) {
      setErro(g.mensagemErroMidia(e, 'audio'));
    } finally {
      g.pararStream(stream);
      audioRef.current = null;
      setGravandoAudio(null);
    }
  }, [guardarGravacao, setErro]);

  const pararAudio = useCallback(() => audioRef.current?.parar(), []);

  const remover = useCallback(async (id) => {
    try { await removerEvidencia(id); } catch (e) { setErro(mensagemDe(e, 'Não foi possível remover.')); }
  }, []);

  const reenviar = useCallback((id) => reenviarEvidencia(id), []);

  const liberar = useCallback(async () => {
    try { return await liberarRascunhos(atividadeId); } catch (e) { console.warn('[evidencias] liberar falhou', e); return 0; }
  }, [atividadeId]);

  const ocupado = trabalhos.length > 0 || !!gravandoAudio || gravandoVideo;
  const limiteAtingido = itens.length + trabalhos.length >= CFG.maxArquivosPorAtividade;

  return {
    itens, urls, trabalhos, erro, setErro, armazenamentoOk, bloqueado,
    gravandoAudio, gravandoVideo, setGravandoVideo,
    ocupado, limiteAtingido,
    capturarFoto, capturarVideoArquivo, guardarGravacao, iniciarAudio, pararAudio,
    remover, reenviar, liberar
  };
}
