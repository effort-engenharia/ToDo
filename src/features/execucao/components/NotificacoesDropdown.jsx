import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  FaBell,
  FaCheck,
  FaPause,
  FaPlay,
  FaExclamationTriangle,
  FaClipboardList,
  FaCheckDouble,
  FaSpinner,
  FaBoxOpen,
  FaRegClock,
  FaCalendarAlt,
  FaExchangeAlt
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { execucaoTecnicoService } from '../../../services/supabase/execucaoTecnico';
import { destinoDaNotificacao, irParaDestino } from './tecnico/navegacaoNotificacao';
import '../styles/execucao.css';

const INTERVALO_MS = 30000;

const ICONES = {
  pausa: <FaPause className="text-yellow-400" aria-hidden="true" />,
  conclusao: <FaCheck className="text-green-400" aria-hidden="true" />,
  retomada: <FaPlay className="text-blue-400" aria-hidden="true" />,
  atraso: <FaExclamationTriangle className="text-red-400" aria-hidden="true" />,
  pendente: <FaClipboardList className="text-slate-400" aria-hidden="true" />,
  urgente: <FaExclamationTriangle className="text-orange-400" aria-hidden="true" />,
  material: <FaBoxOpen className="text-orange-400" aria-hidden="true" />,
  hora_extra: <FaRegClock className="text-blue-400" aria-hidden="true" />,
  replanejamento: <FaCalendarAlt className="text-purple-400" aria-hidden="true" />,
  transferencia: <FaExchangeAlt className="text-cyan-400" aria-hidden="true" />,
  pendencia: <FaClipboardList className="text-yellow-400" aria-hidden="true" />
};

const FUNDOS = {
  pausa: 'bg-yellow-900/30',
  conclusao: 'bg-green-900/30',
  retomada: 'bg-blue-900/30',
  atraso: 'bg-red-900/30',
  urgente: 'bg-orange-900/30',
  material: 'bg-orange-900/30',
  hora_extra: 'bg-blue-900/30',
  replanejamento: 'bg-purple-900/30',
  transferencia: 'bg-cyan-900/30',
  pendencia: 'bg-yellow-900/30'
};

const getIcone = (tipo) => ICONES[tipo] ?? <FaBell className="text-slate-400" aria-hidden="true" />;

const getBgColor = (tipo, lida) => (lida ? 'bg-slate-800/50' : FUNDOS[tipo] ?? 'bg-slate-800');

const formatarTempoRelativo = (dataStr) => {
  const data = new Date(dataStr);
  if (Number.isNaN(data.getTime())) return '';
  const diffMs = Date.now() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHoras < 24) return `${diffHoras}h atrás`;
  if (diffDias < 7) return `${diffDias}d atrás`;
  return data.toLocaleDateString('pt-BR');
};

const NotificacoesDropdown = ({ usuarioId, isAdmin = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [contadorNaoLidas, setContadorNaoLidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const dropdownRef = useRef(null);
  const botaoRef = useRef(null);
  const requisicao = useRef(0);
  const painelId = useId();

  // Só a requisição mais recente aplica resultado; o cleanup do efeito invalida as pendentes
  const carregarNotificacoes = useCallback(async ({ silencioso = false } = {}) => {
    const id = ++requisicao.current;
    if (!silencioso) setLoading(true);
    try {
      const [notifResult, contadorResult] = await Promise.all([
        execucaoTecnicoService.buscarNotificacoesUsuario(usuarioId, { isAdmin, limite: 20 }),
        execucaoTecnicoService.contarNotificacoesUsuario(usuarioId, { isAdmin })
      ]);
      if (id !== requisicao.current) return;

      if (notifResult.success) setNotificacoes(notifResult.data || []);
      if (contadorResult.success) setContadorNaoLidas(contadorResult.count);
      setErro(notifResult.success ? null : notifResult.message || 'Não foi possível carregar as notificações.');
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      if (id === requisicao.current) setErro('Não foi possível carregar as notificações.');
    } finally {
      if (id === requisicao.current) setLoading(false);
    }
  }, [usuarioId, isAdmin]);

  // Rodadas encadeadas: a próxima só é agendada quando a anterior termina; pausa com a aba oculta
  useEffect(() => {
    if (!usuarioId) return undefined;

    let ativo = true;
    let timer = null;
    let emExecucao = false;

    const rodada = async () => {
      timer = null;
      if (!ativo || emExecucao || document.visibilityState === 'hidden') return;
      emExecucao = true;
      if (isAdmin) {
        try {
          const atrasos = await execucaoService.verificarECriarNotificacoesAtraso();
          if (atrasos && atrasos.success === false) console.error('Erro ao verificar atrasos:', atrasos.message);
        } catch (error) {
          console.error('Erro ao verificar atrasos:', error);
        }
      }
      if (ativo) await carregarNotificacoes({ silencioso: true });
      emExecucao = false;
      if (ativo && document.visibilityState !== 'hidden') timer = setTimeout(rodada, INTERVALO_MS);
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible' && ativo && !emExecucao && timer === null) rodada();
    };

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    rodada();

    return () => {
      ativo = false;
      requisicao.current += 1;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [usuarioId, isAdmin, carregarNotificacoes]);

  // Fechar ao clicar fora ou com Esc (listeners só existem enquanto aberto)
  useEffect(() => {
    if (!isOpen) return undefined;

    const aoClicarFora = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    const aoPressionarTecla = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        botaoRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoPressionarTecla);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoPressionarTecla);
    };
  }, [isOpen]);

  const alternar = () => {
    if (!isOpen) carregarNotificacoes();
    setIsOpen(!isOpen);
  };

  const handleMarcarLida = async (notificacaoId, e) => {
    e.stopPropagation();
    try {
      const result = await execucaoService.marcarNotificacaoLida(notificacaoId, usuarioId);
      if (!result.success) {
        setErro(result.message || 'Não foi possível marcar como lida.');
        return;
      }
      setErro(null);
      setNotificacoes((prev) => prev.map((n) => (n.id === notificacaoId ? { ...n, lida: true } : n)));
      setContadorNaoLidas((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      setErro('Não foi possível marcar como lida.');
    }
  };

  // Marca como lida e leva à atividade/tela da notificação
  const handleAbrirNotificacao = async (notif) => {
    setIsOpen(false);
    if (!notif.lida) {
      try {
        const result = await execucaoService.marcarNotificacaoLida(notif.id, usuarioId);
        if (result.success) {
          setNotificacoes((prev) => prev.map((n) => (n.id === notif.id ? { ...n, lida: true } : n)));
          setContadorNaoLidas((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }
    irParaDestino(destinoDaNotificacao(notif, isAdmin));
  };

  const handleMarcarTodasLidas = async () => {
    if (marcandoTodas) return;
    setMarcandoTodas(true);
    try {
      const result = await execucaoTecnicoService.marcarNotificacoesUsuarioLidas(usuarioId, { isAdmin });
      if (!result.success) {
        setErro(result.message || 'Não foi possível marcar todas como lidas.');
        return;
      }
      setErro(null);
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      setContadorNaoLidas(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      setErro('Não foi possível marcar todas como lidas.');
    } finally {
      setMarcandoTodas(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={botaoRef}
        type="button"
        className="execucao-header-btn relative"
        onClick={alternar}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={isOpen ? painelId : undefined}
        aria-label={contadorNaoLidas > 0 ? `Notificações, ${contadorNaoLidas} não lidas` : 'Notificações'}
      >
        <FaBell aria-hidden="true" />
        {contadorNaoLidas > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-xs font-bold flex items-center justify-center px-1"
            aria-hidden="true"
          >
            {contadorNaoLidas > 99 ? '99+' : contadorNaoLidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id={painelId}
          role="region"
          aria-label="Notificações"
          className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FaBell className="text-blue-400" aria-hidden="true" />
              Notificações
              {contadorNaoLidas > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {contadorNaoLidas}
                </span>
              )}
            </h3>
            {contadorNaoLidas > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodasLidas}
                disabled={marcandoTodas}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <FaCheckDouble size={10} aria-hidden="true" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {erro && (
            <div className="px-4 py-2 text-xs text-red-400 bg-red-900/20 border-b border-slate-700" role="alert">
              {erro}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading && notificacoes.length === 0 ? (
              <div className="flex items-center justify-center py-8" role="status" aria-label="Carregando notificações">
                <FaSpinner className="animate-spin text-blue-400" size={24} aria-hidden="true" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FaBell size={32} className="mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              <ul>
                {notificacoes.map((notif) => (
                  <li
                    key={notif.id}
                    className={`border-b border-slate-700/50 hover:bg-slate-800 transition-colors ${getBgColor(notif.tipo, notif.lida)} ${!notif.lida ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => handleAbrirNotificacao(notif)}
                        className="flex-1 min-w-0 min-h-[44px] flex items-start gap-3 px-4 py-3 text-left"
                      >
                        <span className="mt-1">{getIcone(notif.tipo)}</span>

                        <span className="flex-1 min-w-0 block">
                          <span className={`block font-medium text-sm ${notif.lida ? 'text-slate-400' : 'text-white'}`}>
                            {notif.titulo}
                          </span>
                          <span className={`block text-xs mt-0.5 ${notif.lida ? 'text-slate-500' : 'text-slate-300'}`}>
                            {notif.mensagem}
                          </span>
                          <span className="block text-xs text-slate-500 mt-1">{formatarTempoRelativo(notif.created_at)}</span>
                        </span>
                      </button>

                      {!notif.lida && (
                        <button
                          type="button"
                          onClick={(e) => handleMarcarLida(notif.id, e)}
                          className="text-slate-500 hover:text-green-400 transition-colors px-3 min-w-[44px]"
                          title="Marcar como lida"
                          aria-label={`Marcar como lida: ${notif.titulo}`}
                        >
                          <FaCheck size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notificacoes.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacoesDropdown;
