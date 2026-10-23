import React from 'react';
import {
  FaBoxOpen,
  FaCheck,
  FaClock,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaPause,
  FaPhoneAlt,
  FaPlay,
  FaRoute,
  FaUsers,
  FaWhatsapp
} from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import { clienteDaAtividade, contatoDaAtividade } from './contatos';
import {
  diaDaAtividade,
  equipeDaAtividade,
  estaAtrasada,
  formatarHoras,
  hhmm,
  horasDoTecnico,
  textoMaterial
} from './utilsDia';
import '../../offline/FaixaStatusOffline.css';
import './tecnico.css';
import PassosAtividade from './PassosAtividade';

const STATUS_ROTULO = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída'
};

const STATUS_CLASSE = { pendente: 'pendente', em_andamento: 'em-andamento', pausada: 'pausada', concluida: 'concluida' };

const LINK_EXTERNO = { target: '_blank', rel: 'noopener noreferrer' };

// Cartão grande de uma atividade para o celular: dados do local, equipe, material e ações de um toque
export default function CardAtividadeCampo({
  atividade,
  usuarioId,
  hoje,
  material = null,
  ocupado = false,
  onIniciar,
  onRetomar,
  onPausar,
  onConcluir,
  onFaltaMaterial,
  onDetalhes
}) {
  const { endereco, contato, mapa, waze, ligar, whatsapp } = contatoDaAtividade(atividade);
  const equipe = equipeDaAtividade(atividade, usuarioId);
  const dia = diaDaAtividade(atividade, hoje);
  const atrasada = estaAtrasada(atividade, hoje);
  const mat = textoMaterial(material);
  const minhasHoras = horasDoTecnico(atividade, usuarioId);
  const aberta = atividade.status !== 'concluida';
  const inicio = hhmm(atividade.hora_inicio);
  const fim = hhmm(atividade.hora_fim);

  return (
    <article className={`tec-card ${atrasada ? 'atrasada' : atividade.status}`} aria-label={atividade.titulo}>
      <div className="tec-card-topo">
        {inicio && <span className="tec-hora">{fim ? `${inicio} – ${fim}` : inicio}</span>}
        <span className={`execucao-activity-status ${STATUS_CLASSE[atividade.status] || 'pendente'}`}>
          {STATUS_ROTULO[atividade.status] || atividade.status}
        </span>
        {atividade.pendente_envio && <span className="tec-pendente-envio">Pendente de envio</span>}
        {atividade.prioridade === 'urgente' && (
          <span className="execucao-badge execucao-badge-red">
            <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" /> Urgente
          </span>
        )}
        {atrasada && (
          <span className="execucao-badge execucao-badge-red">
            Atrasada · era {formatarDataBR(atividade.data_fim || atividade.data_programada)}
          </span>
        )}
        {atividade.solicita_replanejamento && atividade.status === 'pausada' && (
          <span className="execucao-badge execucao-badge-yellow">Replanejamento solicitado</span>
        )}
      </div>

      <h3 className="tec-card-titulo">
        {atividade.titulo}
        {dia && <span className="tec-card-sub"> · Dia {dia.dia} de {dia.total}</span>}
      </h3>

      {clienteDaAtividade(atividade) && <div className="tec-card-sub">{clienteDaAtividade(atividade)}</div>}

      {endereco && (
        <div className="tec-linha">
          <FaMapMarkerAlt aria-hidden="true" />
          <span>{endereco}</span>
        </div>
      )}

      <div className="tec-card-meta">
        {atividade.horas_previstas != null && (
          <span className="flex items-center gap-1">
            <FaClock size={12} aria-hidden="true" />
            {formatarHoras(atividade.horas_previstas)} previstas
            {equipe.length > 1 && minhasHoras != null && ` (sua parte: ${formatarHoras(minhasHoras)})`}
          </span>
        )}
        {atividade.status === 'concluida' && atividade.horas_realizadas != null && (
          <span>Realizadas: {formatarHoras(atividade.horas_realizadas)}</span>
        )}
      </div>

      <PassosAtividade atividade={atividade} />

      {equipe.length > 1 && (
        <div className="tec-linha">
          <FaUsers aria-hidden="true" />
          <span>
            Equipe:{' '}
            {equipe.map((p, i) => (
              <span key={p.id ?? i}>
                {i > 0 && ', '}
                {p.eu ? <strong>{p.nome}</strong> : p.nome}
                {p.papel === 'lider' && ' (líder)'}
              </span>
            ))}
          </span>
        </div>
      )}

      {mat && (
        <div className={`tec-linha tec-material ${mat.classe}`}>
          <FaBoxOpen aria-hidden="true" />
          <span>Material: {mat.texto}</span>
        </div>
      )}

      {contato && (ligar || whatsapp) && <div className="tec-linha"><FaPhoneAlt aria-hidden="true" /><span>{contato}</span></div>}

      {(mapa || ligar || whatsapp) && (
        <div className="tec-contatos">
          {mapa && (
            <a className="execucao-btn execucao-btn-secondary tec-btn" href={mapa} {...LINK_EXTERNO}>
              <FaRoute aria-hidden="true" /> Rota
            </a>
          )}
          {waze && (
            <a className="execucao-btn execucao-btn-secondary tec-btn" href={waze} {...LINK_EXTERNO}>
              <FaMapMarkerAlt aria-hidden="true" /> Waze
            </a>
          )}
          {ligar && (
            <a className="execucao-btn execucao-btn-secondary tec-btn" href={ligar}>
              <FaPhoneAlt aria-hidden="true" /> Ligar
            </a>
          )}
          {whatsapp && (
            <a className="execucao-btn execucao-btn-secondary tec-btn" href={whatsapp} {...LINK_EXTERNO}>
              <FaWhatsapp aria-hidden="true" /> WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Concluir e Pausar só existem depois que a atividade foi iniciada */}
      {atividade.status === 'em_andamento' && (
        <button
          type="button"
          className="execucao-btn execucao-btn-success tec-btn tec-btn-grande"
          onClick={() => onConcluir(atividade)}
          disabled={ocupado}
        >
          <FaCheck aria-hidden="true" /> CONCLUIR
        </button>
      )}

      <div className="tec-acoes-secundarias">
        {atividade.status === 'pendente' && (
          <button type="button" className="execucao-btn execucao-btn-primary tec-btn" onClick={() => onIniciar(atividade)} disabled={ocupado}>
            <FaPlay size={12} aria-hidden="true" /> Iniciar
          </button>
        )}
        {atividade.status === 'pausada' && (
          <button type="button" className="execucao-btn execucao-btn-primary tec-btn" onClick={() => onRetomar(atividade)} disabled={ocupado}>
            <FaPlay size={12} aria-hidden="true" /> Retomar
          </button>
        )}
        {atividade.status === 'em_andamento' && (
          <button type="button" className="execucao-btn tec-btn tec-btn-pausa" onClick={() => onPausar(atividade)} disabled={ocupado}>
            <FaPause size={12} aria-hidden="true" /> Pausar
          </button>
        )}
        {aberta && (
          <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={() => onFaltaMaterial(atividade)} disabled={ocupado}>
            <FaBoxOpen aria-hidden="true" /> Falta material
          </button>
        )}
        {onDetalhes && (
          <button type="button" className="execucao-btn execucao-btn-secondary tec-btn" onClick={() => onDetalhes(atividade)}>
            Detalhes
          </button>
        )}
      </div>
    </article>
  );
}
