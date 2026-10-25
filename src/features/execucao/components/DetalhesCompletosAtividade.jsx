import React from 'react';
import {
  FaBoxOpen, FaCheckCircle, FaClock, FaExchangeAlt, FaHistory, FaPause, FaPhoneAlt, FaPlay, FaRegCircle, FaRoute,
  FaUsers, FaWhatsapp
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { execucaoTecnicoService } from '../../../services/supabase/execucaoTecnico';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatarHoras } from '../utils/formatos';
import EvidenciasLista from './tecnico/evidencias/EvidenciasLista';
import { contatoDaAtividade } from './tecnico/contatos';
import { textoMaterial } from './tecnico/utilsDia';

const FUSO = 'America/Sao_Paulo';
const dataHora = (valor) => {
  const d = valor ? new Date(valor) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO }) : '—';
};

// Duração entre dois instantes: "2h15" / "40min"
const duracao = (inicio, fim) => {
  const a = inicio ? new Date(inicio).getTime() : NaN;
  const b = fim ? new Date(fim).getTime() : NaN;
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return formatarHoras((b - a) / 3600000);
};

const ACOES = {
  criacao: { icone: FaHistory, cor: 'text-slate-400', rotulo: 'Criada' },
  status_alterado: { icone: FaPlay, cor: 'text-blue-400', rotulo: 'Status alterado' },
  pausa: { icone: FaPause, cor: 'text-orange-400', rotulo: 'Pausada' },
  retomada: { icone: FaPlay, cor: 'text-green-400', rotulo: 'Retomada' },
  conclusao: { icone: FaCheckCircle, cor: 'text-green-400', rotulo: 'Concluída' },
  transferencia: { icone: FaExchangeAlt, cor: 'text-cyan-400', rotulo: 'Transferida' },
  cancelamento: { icone: FaHistory, cor: 'text-red-400', rotulo: 'Cancelada' }
};

const ROTULO_STATUS = { pendente: 'Pendente', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída', cancelada: 'Cancelada', transferida: 'Transferida' };

const descreverAcao = (h) => {
  const base = ACOES[h.tipo_acao]?.rotulo ?? h.tipo_acao;
  if (h.tipo_acao === 'status_alterado' && h.valor_novo) return `Status: ${ROTULO_STATUS[h.valor_novo] ?? h.valor_novo}`;
  return base;
};

async function carregarExtras(atividade) {
  const [contexto, equipes, material, historico] = await Promise.all([
    execucaoTecnicoService.buscarContextoAtividades([atividade.id]),
    execucaoTecnicoService.buscarEquipes([atividade.id]),
    execucaoTecnicoService.buscarStatusMaterial([atividade.id]),
    execucaoService.buscarHistorico(atividade.id)
  ]);
  return {
    success: true,
    data: {
      contexto: contexto?.data?.[atividade.id] ?? null,
      equipe: equipes?.data?.[atividade.id] ?? [],
      material: material?.data?.[atividade.id] ?? null,
      historico: historico?.success ? [...(historico.data ?? [])].reverse() : null // do mais antigo ao mais novo
    }
  };
}

const Bloco = ({ titulo, icone: Icone, children, tom = 'slate' }) => (
  <div className={`bg-${tom}-800/30 p-3 rounded-lg`}>
    <span className="text-xs text-slate-400 uppercase flex items-center gap-1 mb-1">
      {Icone && <Icone size={10} aria-hidden="true" />} {titulo}
    </span>
    {children}
  </div>
);

// Tudo da atividade num só lugar (equipe, horas, passos, material, contato, tempos reais, evidências e linha do tempo)
const DetalhesCompletosAtividade = ({ atividade }) => {
  const { data, loading, error, reload } = useAsyncData(() => carregarExtras(atividade), [atividade.id, atividade.status]);

  const contexto = data?.contexto ?? null;
  const passos = Array.isArray(contexto?.sub_etapas) ? contexto.sub_etapas : [];
  const contato = contatoDaAtividade({ ...atividade, contexto });
  const mat = atividade.status === 'concluida' || atividade.status === 'cancelada' ? null : textoMaterial(data?.material);
  const equipe = [...(data?.equipe ?? [])].sort((a, b) => (a.papel === 'lider' ? -1 : 0) - (b.papel === 'lider' ? -1 : 0));
  const tempoReal = duracao(atividade.inicio_real_em, atividade.fim_real_em);
  const temTempos = atividade.inicio_real_em || atividade.fim_real_em;
  const temHoras = atividade.horas_previstas != null || atividade.horas_realizadas != null;

  return (
    <>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          Não foi possível carregar parte dos detalhes: {error}{' '}
          <button type="button" className="underline" onClick={reload}>Tentar de novo</button>
        </p>
      )}

      {(temHoras || equipe.length > 0 || temTempos) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {temHoras && (
            <Bloco titulo="Horas" icone={FaClock}>
              <p className="text-slate-200 font-medium">
                {atividade.horas_previstas != null ? `${formatarHoras(atividade.horas_previstas)} previstas` : 'Sem horas previstas'}
              </p>
              {atividade.status === 'concluida' && atividade.horas_realizadas != null && (
                <p className="text-sm text-slate-300">
                  {formatarHoras(atividade.horas_realizadas)} realizadas{atividade.horas_ajustadas ? ' (ajustadas pelo técnico)' : ''}
                </p>
              )}
            </Bloco>
          )}
          {temTempos && (
            <Bloco titulo="Execução" icone={FaPlay}>
              <p className="text-sm text-slate-200">Início: {dataHora(atividade.inicio_real_em)}</p>
              {atividade.fim_real_em && <p className="text-sm text-slate-200">Fim: {dataHora(atividade.fim_real_em)}</p>}
              {tempoReal && <p className="text-xs text-slate-400">Tempo decorrido: {tempoReal}</p>}
            </Bloco>
          )}
          {equipe.length > 0 && (
            <Bloco titulo="Equipe" icone={FaUsers}>
              <ul className="text-sm text-slate-200 space-y-0.5">
                {equipe.map((p) => (
                  <li key={p.usuario_id}>
                    {p.usuario?.nome_completo || 'Técnico'}{p.papel === 'lider' ? ' (líder)' : ''}
                    {p.horas_previstas != null && <span className="text-slate-400"> · {formatarHoras(p.horas_previstas)}</span>}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
          {mat && (
            <Bloco titulo="Material" icone={FaBoxOpen}>
              <p className="text-sm text-slate-200">Material {mat.texto}</p>
            </Bloco>
          )}
        </div>
      )}

      {(contato.contato || contato.mapa) && (
        <Bloco titulo="Contato do cliente" icone={FaPhoneAlt}>
          <div className="flex flex-wrap items-center gap-3">
            {contato.contato && <span className="text-slate-200">{contato.contato}</span>}
            {contato.ligar && <a className="text-sky-400 underline text-sm" href={contato.ligar}><FaPhoneAlt size={10} aria-hidden="true" /> Ligar</a>}
            {contato.whatsapp && <a className="text-green-400 underline text-sm" href={contato.whatsapp} target="_blank" rel="noopener noreferrer"><FaWhatsapp size={11} aria-hidden="true" /> WhatsApp</a>}
            {contato.mapa && <a className="text-sky-400 underline text-sm" href={contato.mapa} target="_blank" rel="noopener noreferrer"><FaRoute size={11} aria-hidden="true" /> Rota</a>}
          </div>
        </Bloco>
      )}

      {passos.length > 0 && (
        <Bloco titulo={`Passos (${passos.length})`}>
          <ol className="space-y-1">
            {passos.map((p, i) => {
              const feito = atividade.status === 'concluida' || p.status === 'concluida';
              return (
                <li key={`${p.nome}-${i}`} className="flex items-center gap-2 text-sm text-slate-200">
                  {feito ? <FaCheckCircle className="text-green-400 shrink-0" aria-label="Concluído" /> : <FaRegCircle className="text-slate-500 shrink-0" aria-hidden="true" />}
                  <span className={feito ? 'line-through text-slate-400' : ''}>{p.nome}</span>
                  {Number(p.horas) > 0 && <span className="text-xs text-slate-400 ml-auto">{formatarHoras(p.horas)}</span>}
                </li>
              );
            })}
          </ol>
        </Bloco>
      )}

      <EvidenciasLista atividadeId={atividade.id} />

      <section aria-label="Linha do tempo">
        <span className="text-xs text-slate-400 uppercase flex items-center gap-1 mb-2">
          <FaHistory size={10} aria-hidden="true" /> Linha do tempo
        </span>
        {loading && !data ? (
          <p className="text-sm text-slate-500" role="status">Carregando histórico…</p>
        ) : data?.historico === null ? (
          <p className="text-sm text-slate-500">Histórico indisponível.</p>
        ) : data?.historico?.length ? (
          <ol className="space-y-2">
            {data.historico.map((h) => {
              const info = ACOES[h.tipo_acao] ?? { icone: FaHistory, cor: 'text-slate-400' };
              const Icone = info.icone;
              const motivo = h.tipo_acao === 'pausa' && h.descricao ? h.descricao.replace('Atividade pausada. Motivo: ', '') : null;
              return (
                <li key={h.id} className="flex gap-2 text-sm">
                  <Icone className={`${info.cor} mt-1 shrink-0`} size={12} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-slate-200">
                      {descreverAcao(h)}
                      <span className="text-xs text-slate-500"> · {dataHora(h.created_at)}{h.usuario?.nome_completo ? ` · ${h.usuario.nome_completo}` : ''}</span>
                    </div>
                    {motivo && <div className="text-slate-300"><strong className="text-orange-300">Motivo:</strong> {motivo}</div>}
                    {h.tipo_acao === 'transferencia' && h.descricao && <div className="text-slate-400">{h.descricao}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Sem registros.</p>
        )}
      </section>
    </>
  );
};

export default DetalhesCompletosAtividade;
