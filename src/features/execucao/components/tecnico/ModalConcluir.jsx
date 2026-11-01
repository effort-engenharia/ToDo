import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import Modal from '../ui/Modal';
import { formatarDataHora, formatarHoras } from '../../utils/formatos';
import EvidenciasUploader from './evidencias/EvidenciasUploader';
import { useEvidencias } from './evidencias/useEvidencias';
import { usuarioIdAtual } from './evidencias/filaUpload';
import { aquecerLocalizacao, obterLocalizacao } from './evidencias/carimbo';
import './tecnico.css';

const MAX_OBSERVACAO = 1000;
const AVISO_OBSERVACAO_A_PARTIR_DE = 900; // só narra o contador perto do limite
const TEMPO_LOCALIZACAO_MS = 6000;
const IDADE_MAXIMA_LOCALIZACAO_MS = 30000;

const Aviso = ({ children, ...props }) => (
  <p className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-2 text-sm text-amber-200" {...props}>{children}</p>
);

// Passos (sub-etapas) da atividade que o técnico pode marcar. Só entram os que têm id (contexto da migration 19).
const passosMarcaveis = (atividade) => {
  const lista = atividade?.contexto?.sub_etapas;
  if (!Array.isArray(lista)) return [];
  return lista.filter((p) => p?.id && p.status !== 'cancelada');
};

const useOnline = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const ligar = () => setOnline(true);
    const desligar = () => setOnline(false);
    window.addEventListener('online', ligar);
    window.addEventListener('offline', desligar);
    return () => {
      window.removeEventListener('online', ligar);
      window.removeEventListener('offline', desligar);
    };
  }, []);
  return online;
};

// Permissão de localização já negada no navegador (quando a Permissions API existir)
const usePermissaoNegada = () => {
  const [negada, setNegada] = useState(false);
  useEffect(() => {
    let status = null;
    let ativo = true;
    const atualizar = () => { if (ativo) setNegada(status?.state === 'denied'); };
    Promise.resolve(navigator.permissions?.query?.({ name: 'geolocation' }))
      .then((s) => {
        if (!s || !ativo) return;
        status = s;
        status.onchange = atualizar;
        atualizar();
      })
      .catch(() => {});
    return () => { ativo = false; if (status) status.onchange = null; };
  }, []);
  return negada;
};

// Conclusão: observação opcional, passos marcáveis e evidências. O horário e a localização são registrados
// automaticamente no clique de Concluir (sem campo editável; as horas realizadas são calculadas no servidor).
// As evidências ficam numa fila local e sobem sozinhas: falha de envio nunca bloqueia a conclusão.
export default function ModalConcluir({ atividade, salvando = false, erro = '', usuarioId = usuarioIdAtual(), onConfirmar, onClose }) {
  const passos = useMemo(() => passosMarcaveis(atividade), [atividade]);
  const [marcados, setMarcados] = useState(() => new Set(passos.filter((p) => p.status === 'concluida').map((p) => p.id)));
  const [observacao, setObservacao] = useState('');
  const [erroLocal, setErroLocal] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [geo, setGeo] = useState(null); // resultado de obterLocalizacao() depois do clique
  const [confirmandoAbertos, setConfirmandoAbertos] = useState(false);
  const [abertoEm] = useState(() => new Date().toISOString()); // só leitura; o instante real é o do clique
  const evidencias = useEvidencias(atividade.id, usuarioId);
  const confirmandoRef = useRef(false);
  const online = useOnline();
  const permissaoNegada = usePermissaoNegada();

  // Aquece o GPS/permissão ao abrir (o fix chega pronto no clique de Concluir)
  useEffect(() => { aquecerLocalizacao(); }, []);

  const feitos = marcados.size;
  const abertos = passos.length - feitos;
  const todosMarcados = passos.length > 0 && abertos === 0;
  const ocupado = salvando || registrando;

  const alternarPasso = (id) => {
    setConfirmandoAbertos(false);
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };
  const alternarTodos = () => {
    setConfirmandoAbertos(false);
    setMarcados(todosMarcados ? new Set() : new Set(passos.map((p) => p.id)));
  };

  const fechar = () => {
    if (ocupado) return;
    if (evidencias.ocupado) {
      setErroLocal('Aguarde a gravação ou a otimização terminar antes de sair.');
      return;
    }
    onClose();
  };

  const concluir = async () => {
    if (confirmandoRef.current) return;
    confirmandoRef.current = true;
    const cliqueEm = new Date().toISOString(); // instante do clique: vale para o horário de conclusão, também offline
    setRegistrando(true);
    setConfirmandoAbertos(false);
    setErroLocal('');
    try {
      const [localizacao] = await Promise.all([
        obterLocalizacao({ timeoutMs: TEMPO_LOCALIZACAO_MS, maxIdadeMs: IDADE_MAXIMA_LOCALIZACAO_MS }),
        evidencias.liberar()
      ]);
      setGeo(localizacao);
      // Só os passos cujo estado mudou em relação ao que veio do servidor
      const alterados = passos
        .filter((p) => marcados.has(p.id) !== (p.status === 'concluida'))
        .map((p) => ({ subEtapaId: p.id, concluido: marcados.has(p.id), nome: p.nome }));
      await onConfirmar({ observacao, localizacao, ocorridoEm: cliqueEm, passos: alterados });
    } finally {
      confirmandoRef.current = false;
      setRegistrando(false);
    }
  };

  const confirmar = () => {
    if (ocupado || confirmandoRef.current) return;
    if (evidencias.ocupado) {
      setErroLocal('Aguarde a gravação ou a otimização das evidências terminar.');
      return;
    }
    if (abertos > 0 && !confirmandoAbertos) {
      setConfirmandoAbertos(true); // N1-g: concluir com passos em aberto pede confirmação, sem bloquear
      return;
    }
    concluir();
  };

  const mensagem = erroLocal || erro;
  const geoNegada = permissaoNegada || geo?.status === 'negada';
  const geoFalhou = !geoNegada && geo && geo.status !== 'ok';

  return (
    <Modal
      onClose={fechar}
      tamanho="md"
      titulo="Concluir atividade"
      cabecalho={
        <span className="flex items-center gap-2">
          <FaCheck className="text-green-400" aria-hidden="true" /> Concluir atividade
        </span>
      }
    >
      <p className="text-slate-200 font-medium mb-4" tabIndex={-1} data-autofocus>{atividade.titulo}</p>

      {passos.length > 0 && (
        <fieldset className="mb-4 rounded-lg bg-slate-800/40 p-3" disabled={ocupado}>
          <legend className="px-1 text-sm font-semibold text-slate-200">
            Passos da atividade, {feitos} de {passos.length} concluídos
          </legend>
          <button
            type="button"
            className="execucao-btn execucao-btn-secondary tec-btn mb-1 w-full"
            aria-pressed={todosMarcados}
            onClick={alternarTodos}
          >
            {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
          <ul className="list-none m-0 p-0">
            {passos.map((p) => (
              <li key={p.id}>
                <label className="tec-check">
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternarPasso(p.id)} />
                  <span className="min-w-0 flex-1">{p.nome}</span>
                  {Number(p.horas) > 0 && <span className="tec-passo-horas">{formatarHoras(p.horas)}</span>}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {abertos > 0 && (
        <Aviso role="status">
          ⚠️ A etapa seguirá em andamento no planejamento até todos os passos serem concluídos.
        </Aviso>
      )}

      <div className="execucao-form-group mt-4">
        <label htmlFor="concluir-observacao" className="execucao-form-label">Observação (opcional)</label>
        <textarea
          id="concluir-observacao"
          className="execucao-form-textarea tec-input"
          rows={4}
          maxLength={MAX_OBSERVACAO}
          value={observacao}
          enterKeyHint="enter"
          aria-describedby="concluir-observacao-contador"
          disabled={ocupado}
          onChange={(e) => { setObservacao(e.target.value); setConfirmandoAbertos(false); }}
        />
        <span
          id="concluir-observacao-contador"
          className="block text-right text-xs text-slate-400"
          aria-live={observacao.length >= AVISO_OBSERVACAO_A_PARTIR_DE ? 'polite' : 'off'}
        >
          {observacao.length}/{MAX_OBSERVACAO}
        </span>
      </div>

      <EvidenciasUploader controle={evidencias} desabilitado={ocupado} />

      <div className="mt-4 space-y-2 text-sm text-slate-300">
        <p>🕒 Horário e localização são registrados automaticamente no momento da conclusão.</p>
        <p>🕒 Agora: <time dateTime={abertoEm}>{formatarDataHora(abertoEm, { comAno: true })}</time></p>
        <div aria-live="polite" className="space-y-2">
          {geo?.status === 'ok' && (
            <p className="text-green-300">
              📍 Localização capturada{geo.precisao != null ? ` (±${Math.round(geo.precisao)} m)` : ''}
            </p>
          )}
          {geoNegada && (
            <Aviso>
              📍 Localização bloqueada. Para registrar, libere em Configurações do navegador → Permissões → Localização e
              toque em Concluir de novo. Você também pode concluir sem localização.
            </Aviso>
          )}
          {geoFalhou && (
            <Aviso>📍 Não foi possível obter a localização agora. A conclusão segue normalmente.</Aviso>
          )}
          {!geo && !geoNegada && (
            <p>{registrando ? '📍 Buscando localização…' : '📍 A localização será pedida ao concluir.'}</p>
          )}
          {registrando && <span className="sr-only">Registrando horário e localização…</span>}
        </div>
        {!online && (
          <Aviso>📶 Sem conexão: a conclusão será enviada quando a rede voltar, com o horário deste aparelho.</Aviso>
        )}
      </div>

      {confirmandoAbertos && (
        <Aviso role="alert">
          Há {abertos} {abertos === 1 ? 'passo não marcado' : 'passos não marcados'}. Concluir mesmo assim?
          {' '}Se quiser, explique na observação.
        </Aviso>
      )}

      {mensagem && <p className="tec-erro" role="alert">{mensagem}</p>}

      <div className="tec-rodape-modal">
        <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={confirmandoAbertos ? () => setConfirmandoAbertos(false) : fechar} disabled={ocupado}>
          {confirmandoAbertos ? 'Voltar e marcar' : 'Cancelar'}
        </button>
        <button
          type="button"
          className="execucao-btn execucao-btn-success tec-btn"
          onClick={confirmar}
          disabled={ocupado || evidencias.ocupado}
          aria-busy={ocupado}
        >
          <FaCheck size={12} aria-hidden="true" /> {ocupado ? 'Concluindo…' : confirmandoAbertos ? 'Concluir mesmo assim' : 'Concluir'}
        </button>
      </div>
    </Modal>
  );
}
