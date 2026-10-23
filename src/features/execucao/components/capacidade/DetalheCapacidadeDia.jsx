import React, { useMemo, useState } from 'react';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatarDataBR, parseDataLocal } from '../../utils/datas';
import { formatarMinutos, notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import { SITUACOES, situacaoDoDia } from './calculos';
import '../config/config.css';
import './capacidade.css';

const STATUS = {
  pendente: { rotulo: 'Pendente', classe: 'execucao-badge-yellow' },
  transferida: { rotulo: 'Transferida', classe: 'execucao-badge-purple' },
  pausada: { rotulo: 'Pausada', classe: 'execucao-badge-orange' },
  em_andamento: { rotulo: 'Em andamento', classe: 'execucao-badge-blue' },
  concluida: { rotulo: 'Concluída', classe: 'execucao-badge-green' },
};
const REATRIBUIVEIS = ['pendente', 'transferida', 'pausada'];

const DetalheCapacidadeDia = ({ data, usuarioId, nomeUsuario, celula, tecnicos, capacidadePorUsuario, usuarioLogado, onClose, onAlterado }) => {
  const { toast } = useExecucaoUI();
  const { data: atividades, loading, error, reload } = useAsyncData(() => servico.buscarAtividadesDoDiaCapacidade(data), [data]);
  const [destinos, setDestinos] = useState({});
  const [salvando, setSalvando] = useState(null);

  // Atividades do colaborador (líder ou apoio) ou, na linha "sem técnico", as que não têm ninguém
  const doAlvo = useMemo(() => (atividades ?? []).filter((a) => {
    const equipe = a.equipe ?? [];
    if (usuarioId) return a.tecnico_responsavel_id === usuarioId || equipe.some((e) => e.usuario_id === usuarioId);
    return !a.tecnico_responsavel_id && equipe.length === 0;
  }), [atividades, usuarioId]);

  // Opções de destino com a folga do dia (disponível − previsto) para ajudar a escolher
  const opcoes = useMemo(() => tecnicos
    .filter((t) => t.id !== usuarioId)
    .map((t) => {
      const linha = capacidadePorUsuario.get(t.id)?.get(data);
      let detalhe = '';
      if (linha) {
        if (linha.ausente) detalhe = 'ausente';
        else if (!linha.dia_util) detalhe = 'sem expediente';
        else detalhe = `livre ${formatarMinutos(Math.max(0, linha.disponivel_min - linha.previsto_min))}`;
      }
      return { id: t.id, texto: `${t.nome_completo}${detalhe ? ` — ${detalhe}` : ''}` };
    }), [tecnicos, usuarioId, capacidadePorUsuario, data]);

  const reatribuir = async (atividade) => {
    const destino = destinos[atividade.id];
    if (!destino) return toast.info('Escolha o novo responsável.');
    setSalvando(atividade.id);
    const resultado = await execucaoService.transferirAtividade(atividade.id, destino, usuarioLogado.id, 'Reatribuída pela Capacidade da equipe');
    setSalvando(null);
    if (notificarResultado(resultado, toast, 'Atividade reatribuída')) {
      reload();
      onAlterado();
    }
  };

  const situacao = celula ? SITUACOES[situacaoDoDia(celula)] : null;
  const diaSemana = parseDataLocal(data)?.toLocaleDateString('pt-BR', { weekday: 'long' });

  return (
    <Modal titulo={`${nomeUsuario} · ${diaSemana}, ${formatarDataBR(data)}`} onClose={onClose} tamanho="lg">
      {celula && (
        <p className="cfg-muted mb-4">
          Alocado {formatarMinutos(celula.previsto_min)} de {formatarMinutos(celula.disponivel_min)} disponíveis
          {celula.extra_max_min > 0 && ` (+${formatarMinutos(celula.extra_max_min)} de hora extra permitida)`}
          {situacao?.curto && <> · <strong>{situacao.rotulo}</strong></>}
        </p>
      )}

      {error && !atividades ? <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
        : loading && !atividades ? <Carregando />
          : !doAlvo.length ? <p className="text-slate-400">Nenhuma atividade neste dia.</p>
            : doAlvo.map((a) => {
              const status = STATUS[a.status] ?? { rotulo: a.status, classe: 'execucao-badge-gray' };
              const lider = a.tecnico_responsavel_id === usuarioId || !usuarioId;
              const podeReatribuir = REATRIBUIVEIS.includes(a.status) && lider;
              return (
                <div key={a.id} className="cap-atividade">
                  <div className="cap-atividade-linha">
                    <strong className="text-slate-100">{a.titulo}</strong>
                    <span className={`execucao-badge ${status.classe}`}>{status.rotulo}</span>
                    {a.horas_previstas != null && <span className="cfg-muted">{formatarMinutos(Number(a.horas_previstas) * 60)} previstas</span>}
                    {usuarioId && !lider && <span className="execucao-badge execucao-badge-gray">Apoio</span>}
                  </div>
                  <div className="cfg-muted">
                    {[a.etapa?.obra?.nome_cliente, a.etapa?.nome].filter(Boolean).join(' · ') || 'Sem obra vinculada'}
                    {a.data_fim && a.data_fim !== a.data_programada && ` · ${formatarDataBR(a.data_programada)} a ${formatarDataBR(a.data_fim)}`}
                  </div>
                  {podeReatribuir ? (
                    <div className="cap-reatribuir">
                      <label className="sr-only" htmlFor={`reat-${a.id}`}>Novo responsável de {a.titulo}</label>
                      <select
                        id={`reat-${a.id}`}
                        className="execucao-form-select"
                        value={destinos[a.id] ?? ''}
                        onChange={(e) => setDestinos((d) => ({ ...d, [a.id]: e.target.value }))}
                      >
                        <option value="">Reatribuir para…</option>
                        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
                      </select>
                      <button
                        type="button"
                        className="execucao-btn execucao-btn-primary execucao-btn-sm"
                        disabled={!destinos[a.id] || salvando === a.id}
                        onClick={() => reatribuir(a)}
                      >
                        {salvando === a.id ? 'Reatribuindo…' : 'Reatribuir'}
                      </button>
                    </div>
                  ) : (
                    <div className="cfg-muted mt-1">
                      {lider ? 'Só atividades pendentes, transferidas ou pausadas podem ser reatribuídas aqui.' : 'Para alterar a equipe, edite a atividade na agenda.'}
                    </div>
                  )}
                </div>
              );
            })}
    </Modal>
  );
};

export default DetalheCapacidadeDia;
