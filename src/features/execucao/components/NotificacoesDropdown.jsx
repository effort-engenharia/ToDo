import React, { useState, useEffect, useRef } from 'react';
import { 
  FaBell, 
  FaCheck,
  FaPause,
  FaPlay,
  FaExclamationTriangle,
  FaClipboardList,
  FaTimes,
  FaCheckDouble,
  FaSpinner
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import '../styles/execucao.css';

const NotificacoesDropdown = ({ usuarioId, isAdmin = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [contadorNaoLidas, setContadorNaoLidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Carregar notificações
  const carregarNotificacoes = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const [notifResult, contadorResult] = await Promise.all([
        execucaoService.buscarNotificacoes(20),
        execucaoService.contarNotificacoesNaoLidas()
      ]);

      if (notifResult.success) {
        setNotificacoes(notifResult.data || []);
      }
      if (contadorResult.success) {
        setContadorNaoLidas(contadorResult.count);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
    setLoading(false);
  };

  // Verificar atrasos e carregar notificações
  useEffect(() => {
    if (isAdmin) {
      // Verificar atividades atrasadas
      execucaoService.verificarECriarNotificacoesAtraso();
      // Carregar notificações
      carregarNotificacoes();
      
      // Atualizar a cada 30 segundos
      const interval = setInterval(() => {
        carregarNotificacoes();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Marcar como lida
  const handleMarcarLida = async (notificacaoId, e) => {
    e.stopPropagation();
    const result = await execucaoService.marcarNotificacaoLida(notificacaoId, usuarioId);
    if (result.success) {
      setNotificacoes(prev => 
        prev.map(n => n.id === notificacaoId ? { ...n, lida: true } : n)
      );
      setContadorNaoLidas(prev => Math.max(0, prev - 1));
    }
  };

  // Marcar todas como lidas
  const handleMarcarTodasLidas = async () => {
    const result = await execucaoService.marcarTodasNotificacoesLidas(usuarioId);
    if (result.success) {
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setContadorNaoLidas(0);
    }
  };

  // Ícone baseado no tipo
  const getIcone = (tipo) => {
    switch (tipo) {
      case 'pausa':
        return <FaPause className="text-yellow-400" />;
      case 'conclusao':
        return <FaCheck className="text-green-400" />;
      case 'retomada':
        return <FaPlay className="text-blue-400" />;
      case 'atraso':
        return <FaExclamationTriangle className="text-red-400" />;
      case 'pendente':
        return <FaClipboardList className="text-slate-400" />;
      case 'urgente':
        return <FaExclamationTriangle className="text-orange-400" />;
      default:
        return <FaBell className="text-slate-400" />;
    }
  };

  // Cor de fundo baseada no tipo
  const getBgColor = (tipo, lida) => {
    if (lida) return 'bg-slate-800/50';
    switch (tipo) {
      case 'pausa':
        return 'bg-yellow-900/30';
      case 'conclusao':
        return 'bg-green-900/30';
      case 'retomada':
        return 'bg-blue-900/30';
      case 'atraso':
        return 'bg-red-900/30';
      case 'urgente':
        return 'bg-orange-900/30';
      default:
        return 'bg-slate-800';
    }
  };

  // Formatar tempo relativo
  const formatarTempoRelativo = (dataStr) => {
    const data = new Date(dataStr);
    const agora = new Date();
    const diffMs = agora - data;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHoras < 24) return `${diffHoras}h atrás`;
    if (diffDias < 7) return `${diffDias}d atrás`;
    return data.toLocaleDateString('pt-BR');
  };

  // Se não for admin, mostrar botão desabilitado
  if (!isAdmin) {
    return (
      <button className="execucao-header-btn relative opacity-50" disabled>
        <FaBell />
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button 
        className="execucao-header-btn relative"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) carregarNotificacoes();
        }}
      >
        <FaBell />
        {contadorNaoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-xs font-bold flex items-center justify-center px-1">
            {contadorNaoLidas > 99 ? '99+' : contadorNaoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FaBell className="text-blue-400" />
              Notificações
              {contadorNaoLidas > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {contadorNaoLidas}
                </span>
              )}
            </h3>
            {contadorNaoLidas > 0 && (
              <button 
                onClick={handleMarcarTodasLidas}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <FaCheckDouble size={10} />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista de notificações */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="animate-spin text-blue-400" size={24} />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FaBell size={32} className="mx-auto mb-2 opacity-50" />
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              notificacoes.map((notif) => (
                <div 
                  key={notif.id}
                  className={`px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800 cursor-pointer transition-colors ${getBgColor(notif.tipo, notif.lida)} ${!notif.lida ? 'border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Ícone */}
                    <div className="mt-1">
                      {getIcone(notif.tipo)}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${notif.lida ? 'text-slate-400' : 'text-white'}`}>
                        {notif.titulo}
                      </p>
                      <p className={`text-xs mt-0.5 ${notif.lida ? 'text-slate-500' : 'text-slate-300'}`}>
                        {notif.mensagem}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatarTempoRelativo(notif.created_at)}
                      </p>
                    </div>

                    {/* Botão marcar como lida */}
                    {!notif.lida && (
                      <button
                        onClick={(e) => handleMarcarLida(notif.id, e)}
                        className="text-slate-500 hover:text-green-400 transition-colors p-1"
                        title="Marcar como lida"
                      >
                        <FaCheck size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 text-center">
              <button 
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
