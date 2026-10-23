import React, { useCallback, useMemo, useState } from 'react';
import { FaBell, FaChevronDown, FaChevronRight, FaClipboardList, FaExclamationTriangle, FaPause, FaRegClock } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoTecnicoService } from '../../../../services/supabase/execucaoTecnico';
import { dataLocalISO, parseDataLocal } from '../../utils/datas';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useAtualizacaoAoVivo } from '../../hooks/useAtualizacaoAoVivo';
import { aplicarPendencias } from '../../offline/aplicarPendencias';
import { carregarComCache, preCarregar, preservarContexto } from '../../offline/cacheLeitura';
import FaixaStatusOffline from '../../offline/FaixaStatusOffline';
import { opcoesPreCargaMinhas } from '../../offline/leituras';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import CardAtividadeCampo from './CardAtividadeCampo';
import { useAcoesAtividade } from './useAcoesAtividade';
import { destinoDaNotificacao, irParaDestino } from './navegacaoNotificacao';
import {
  JORNADA_PADRAO_MIN,
  estaAtrasada,
  formatarMinutos,
  hhmm,
  horasPrevistasNoDia,
  rotuloDia
} from './utilsDia';
import './tecnico.css';

const ordenar = (a, b) => {
  const ca = a.status === 'concluida' ? 1 : 0;
  const cb = b.status === 'concluida' ? 1 : 0;
  if (ca !== cb) return ca - cb;
  return (a.hora_inicio || '99:99').localeCompare(b.hora_inicio || '99:99');
};

const carregarDiaDaRede = async (usuarioId, hoje) => {
  const dia = await execucaoTecnicoService.buscarMeuDia(usuarioId, hoje);
  if (!dia.success) return dia;

  const ids = dia.data.atividades.filter((a) => a.status !== 'concluida').map((a) => a.id);
  const [material, jornada, horasExtras, notificacoes] = await Promise.all([
    execucaoTecnicoService.buscarStatusMaterial(ids),
    execucaoTecnicoService.buscarJornadaDia(usuarioId, hoje),
    execucaoTecnicoService.buscarHorasExtrasPendentes(usuarioId),
    execucaoTecnicoService.buscarNotificacoesUsuario(usuarioId, { isAdmin: false, limite: 10 })
  ]);

  return {
    success: true,
    // resposta incompleta (falha pontual de rede) não sobrescreve o cache offline
    parcial: [material, jornada, horasExtras, notificacoes].some((r) => r?.success === false),
    data: {
      ...dia.data,
      material: material.data ?? {},
      jornada: jornada.success ? jornada.data : null,
      horasExtrasPendentes: horasExtras.count,
      notificacoes: (notificacoes.data ?? []).filter((n) => !n.lida)
    }
  };
};

const prepararDia = (data, antigo) => ({ ...data, atividades: preservarContexto(data.atividades, antigo?.atividades) });

const opcoesDia = (usuarioId, dia) => ({
  usuarioId,
  chave: `meu-dia:${dia}`,
  buscar: () => carregarDiaDaRede(usuarioId, dia),
  preparar: prepararDia
});

// Com o dia carregado online, guarda no aparelho o que o técnico vai precisar sem sinal: próximo dia e abas Hoje/Semana
const preCarregarParaOffline = (usuarioId, proximoDia) => {
  setTimeout(async () => {
    if (proximoDia?.data) await preCarregar(opcoesDia(usuarioId, proximoDia.data));
    await preCarregar(opcoesPreCargaMinhas(usuarioId, 'hoje'));
    await preCarregar(opcoesPreCargaMinhas(usuarioId, 'semana'));
  }, 2000);
};

// Rede quando há sinal (e guarda no cache); sem sinal, o último dia salvo. Ações ainda na fila entram por cima.
const carregarDia = async (usuarioId, hoje) => {
  const r = await carregarComCache(opcoesDia(usuarioId, hoje));
  if (!r.success) return r;
  if (!r.offline) preCarregarParaOffline(usuarioId, r.data.proximoDia);
  return {
    success: true,
    data: {
      ...r.data,
      atividades: await aplicarPendencias(usuarioId, r.data.atividades),
      cacheEm: r.offline ? r.salvoEm : null
    }
  };
};

const MeuDia = ({ usuario }) => {
  const hoje = dataLocalISO();
  const [amanhaAberto, setAmanhaAberto] = useState(false);

  const { data, loading, error, reload, refresh } = useAsyncData(() => carregarDia(usuario.id, hoje), [usuario.id, hoje]);

  // Atividade nova, transferida ou alterada aparece sozinha (Realtime + reforço a cada minuto e ao voltar para o app)
  useAtualizacaoAoVivo(usuario.id, refresh);

  const acoes = useAcoesAtividade({ usuarioId: usuario.id, onAtualizado: () => reload() });

  const atividades = useMemo(() => data?.atividades ?? [], [data]);
  const atrasadas = useMemo(() => atividades.filter((a) => estaAtrasada(a, hoje)).sort(ordenar), [atividades, hoje]);
  const doDia = useMemo(() => atividades.filter((a) => !estaAtrasada(a, hoje)).sort(ordenar), [atividades, hoje]);

  const resumo = useMemo(() => {
    const previstoMin = Math.round(doDia.reduce((s, a) => s + horasPrevistasNoDia(a, usuario.id), 0) * 60);
    const jornadaMin = data?.jornada ? data.jornada.minutos : JORNADA_PADRAO_MIN;
    const feitas = doDia.filter((a) => a.status === 'concluida').length;
    const pct = jornadaMin > 0 ? Math.min(100, Math.round((previstoMin / jornadaMin) * 100)) : (previstoMin > 0 ? 100 : 0);
    const excedeu = previstoMin > jornadaMin;
    return { previstoMin, jornadaMin, feitas, pct, excedeu, semJornada: !!data?.jornada && jornadaMin === 0 };
  }, [doDia, data, usuario.id]);

  const pausadas = atividades.filter((a) => a.status === 'pausada');
  const naoLidas = data?.notificacoes ?? [];
  const horasExtrasPendentes = data?.horasExtrasPendentes ?? 0;
  const temPendencias = atrasadas.length > 0 || pausadas.length > 0 || naoLidas.length > 0 || horasExtrasPendentes > 0;

  const abrirDetalhes = useCallback((atividade) => {
    irParaDestino({ pagina: 'minhas-atividades', atividadeId: atividade.id });
  }, []);

  const abrirNotificacao = useCallback(async (notif) => {
    await execucaoService.marcarNotificacaoLida(notif.id, usuario.id);
    irParaDestino(destinoDaNotificacao(notif, false));
    reload();
  }, [usuario.id, reload]);

  if (loading && !data) return <Carregando />;
  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;

  const proximoDia = data?.proximoDia;
  const dataHoje = parseDataLocal(hoje);
  const titulo = `Hoje, ${dataHoje.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${dataHoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  const totalAbertas = atividades.filter((a) => a.status !== 'concluida').length;

  const renderCard = (a) => (
    <CardAtividadeCampo
      key={a.id}
      atividade={a}
      usuarioId={usuario.id}
      hoje={hoje}
      material={data?.material?.[a.id] ?? null}
      ocupado={acoes.ocupadoId === a.id}
      onIniciar={acoes.iniciar}
      onRetomar={acoes.retomar}
      onPausar={acoes.abrirPausa}
      onConcluir={acoes.abrirConclusao}
      onFaltaMaterial={acoes.abrirFaltaMaterial}
      onDetalhes={abrirDetalhes}
    />
  );

  return (
    <div className="tec-dia execucao-animate-fade-in">
      <FaixaStatusOffline usuarioId={usuario.id} aoSincronizar={reload} dadosSalvosEm={data?.cacheEm} />

      <div className="tec-dia-topo">
        <h2 className="tec-dia-titulo">{titulo}</h2>
        <span className="tec-dia-contagem">
          {totalAbertas === 0 ? 'Nada em aberto' : `${totalAbertas} ${totalAbertas === 1 ? 'atividade' : 'atividades'} em aberto`}
        </span>
      </div>

      {error && (
        <div className="tec-erro" role="alert">
          Não foi possível atualizar agora: {error}{' '}
          <button type="button" className="underline" onClick={reload}>Tentar novamente</button>
        </div>
      )}

      <section className="tec-resumo" aria-label="Resumo do dia">
        <div className="tec-resumo-linha">
          <span><FaRegClock aria-hidden="true" className="inline mr-1" /> Previsto: <strong>{formatarMinutos(resumo.previstoMin)}</strong></span>
          <span>
            {resumo.semJornada ? 'Sem jornada hoje' : <>Jornada: <strong>{formatarMinutos(resumo.jornadaMin)}</strong></>}
          </span>
        </div>
        <div
          className={`tec-barra ${resumo.excedeu ? 'erro' : resumo.pct >= 90 ? 'aviso' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={resumo.pct}
          aria-label="Horas previstas em relação à jornada"
        >
          <span style={{ width: `${resumo.pct}%` }} />
        </div>
        <div className="tec-resumo-linha">
          <span>Concluídas: <strong>{resumo.feitas} de {doDia.length}</strong></span>
          {resumo.excedeu && <span className="text-red-300">Acima da jornada</span>}
        </div>
      </section>

      {temPendencias && (
        <section className="tec-pendencias" aria-label="Pendências">
          <h3>Pendências</h3>
          <ul>
            {atrasadas.length > 0 && (
              <li className="tec-pendencia-item">
                <FaExclamationTriangle className="text-red-400" aria-hidden="true" />
                {atrasadas.length} {atrasadas.length === 1 ? 'atividade atrasada' : 'atividades atrasadas'}
              </li>
            )}
            {pausadas.length > 0 && (
              <li className="tec-pendencia-item">
                <FaPause className="text-yellow-400" aria-hidden="true" />
                {pausadas.length} {pausadas.length === 1 ? 'atividade pausada' : 'atividades pausadas'}
              </li>
            )}
            {horasExtrasPendentes > 0 && (
              <li className="tec-pendencia-item">
                <FaRegClock className="text-blue-400" aria-hidden="true" />
                {horasExtrasPendentes} {horasExtrasPendentes === 1 ? 'hora extra aguardando' : 'horas extras aguardando'} aprovação
              </li>
            )}
            {naoLidas.slice(0, 5).map((n) => (
              <li key={n.id}>
                <button type="button" className="tec-pendencia-item" onClick={() => abrirNotificacao(n)}>
                  <FaBell className="text-blue-400" aria-hidden="true" />
                  <span>{n.titulo}: {n.mensagem}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {atividades.length === 0 && (
        <EstadoVazio
          icone={<FaClipboardList aria-hidden="true" />}
          titulo="Nenhuma atividade para hoje"
          texto="Você não tem atividades programadas nem atrasadas."
        />
      )}

      {atrasadas.length > 0 && (
        <section className="tec-lista" aria-label="Atividades atrasadas">
          <h3 className="tec-secao-titulo atrasada">Atrasadas ({atrasadas.length})</h3>
          {atrasadas.map(renderCard)}
        </section>
      )}

      {doDia.length > 0 && (
        <section className="tec-lista" aria-label="Atividades de hoje">
          {atrasadas.length > 0 && <h3 className="tec-secao-titulo">Hoje ({doDia.length})</h3>}
          {doDia.map(renderCard)}
        </section>
      )}

      {proximoDia && (
        <section aria-label="Próximo dia">
          <button
            type="button"
            className="tec-amanha-botao"
            aria-expanded={amanhaAberto}
            onClick={() => setAmanhaAberto((v) => !v)}
          >
            <span>
              {rotuloDia(proximoDia.data, hoje)}: {proximoDia.atividades.length}{' '}
              {proximoDia.atividades.length === 1 ? 'atividade' : 'atividades'}
            </span>
            {amanhaAberto ? <FaChevronDown aria-hidden="true" /> : <FaChevronRight aria-hidden="true" />}
          </button>
          {amanhaAberto && (
            <div className="execucao-card" style={{ padding: 0, marginTop: '0.5rem' }}>
              {proximoDia.atividades.map((a) => (
                <div key={a.id} className="tec-amanha-item">
                  {hhmm(a.hora_inicio) && <strong>{hhmm(a.hora_inicio)} </strong>}
                  {a.titulo}
                  {a.cliente_nome && ` · ${a.cliente_nome}`}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {acoes.modais}
    </div>
  );
};

export default MeuDia;
