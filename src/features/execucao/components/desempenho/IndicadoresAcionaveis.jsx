import React from 'react';
import { FaBullseye, FaClock, FaFlagCheckered, FaHourglassHalf, FaBolt } from 'react-icons/fa';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { intervaloPeriodo } from '../../utils/datas';
import { formatarHoras } from '../../utils/formatos';
import { Carregando, ErroCarregamento } from '../ui/Estados';

const MOTIVOS = {
  material: 'Falta de material',
  falta_material: 'Falta de material',
  cliente: 'Cliente ausente / sem acesso',
  cliente_ausente: 'Cliente ausente / sem acesso',
  sem_acesso: 'Cliente ausente / sem acesso',
  clima: 'Chuva / clima',
  chuva: 'Chuva / clima',
  outra_equipe: 'Aguardando outra equipe',
  aguardando_equipe: 'Aguardando outra equipe',
  problema_tecnico: 'Problema técnico',
  tecnico: 'Problema técnico',
  outro: 'Outro',
  outros: 'Outro',
  sem_motivo: 'Sem motivo informado',
};

const TIPOS_ATIVIDADE = { eletrica: 'Elétrica', civil: 'Civil', galpao: 'Galpão', gestao: 'Gestão', estoque: 'Estoque' };

const rotuloMotivo = (codigo) => MOTIVOS[codigo] ?? `${codigo.charAt(0).toUpperCase()}${codigo.slice(1).replace(/_/g, ' ')}`;
const percentual = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);
const formatarPercentual = (valor) => (valor === null ? '—' : `${valor}%`);

const Cartao = ({ icone, cor, rotulo, valor, detalhe }) => {
  const Icone = icone;
  return (
    <div className="execucao-stat-card">
      <div className={`execucao-stat-icon ${cor}`}><Icone aria-hidden="true" /></div>
      <div className="execucao-stat-content">
        <div className="execucao-stat-label">{rotulo}</div>
        <div className="execucao-stat-value">{valor}</div>
        {detalhe && <div className="text-xs text-slate-400">{detalhe}</div>}
      </div>
    </div>
  );
};

// Indicadores que geram ação (4.2): pontualidade, causas de pausa, horas por tipo, obras no prazo, lead time e horas extras
const IndicadoresAcionaveis = ({ periodo }) => {
  const { data, loading, error, reload } = useAsyncData(() => {
    const { inicio, fim } = intervaloPeriodo(periodo);
    return servico.buscarIndicadores(inicio, fim);
  }, [periodo]);

  if (error && !data) {
    return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  }
  if (loading && !data) return <Carregando />;

  const pontualidade = data.pontualidade ?? { concluidas: 0, no_prazo: 0 };
  const obras = data.obras_no_prazo ?? { concluidas: 0, no_prazo: 0 };
  const extras = data.horas_extras ?? { aprovadas: 0, emergencia: 0, pendentes: 0 };
  const pausas = data.pausas_por_motivo ?? [];
  const horasPorTipo = data.horas_por_tipo ?? [];
  const totalPausas = pausas.reduce((soma, p) => soma + Number(p.total), 0);
  const maiorPausa = Math.max(1, ...pausas.map((p) => Number(p.total)));

  return (
    <section className="mt-6" aria-labelledby="indicadores-titulo" aria-busy={loading}>
      <h3 id="indicadores-titulo" className="text-lg font-semibold text-slate-100 mb-4">Indicadores de gestão</h3>

      <div className="execucao-grid execucao-grid-4 mb-6">
        <Cartao
          icone={FaBullseye}
          cor="green"
          rotulo="Pontualidade"
          valor={formatarPercentual(percentual(pontualidade.no_prazo, pontualidade.concluidas))}
          detalhe={`${pontualidade.no_prazo} de ${pontualidade.concluidas} atividades no prazo`}
        />
        <Cartao
          icone={FaFlagCheckered}
          cor="blue"
          rotulo="Obras entregues no prazo"
          valor={formatarPercentual(percentual(obras.no_prazo, obras.concluidas))}
          detalhe={`${obras.no_prazo} de ${obras.concluidas} obras concluídas`}
        />
        <Cartao
          icone={FaClock}
          cor="purple"
          rotulo="Lead time contrato → início"
          valor={data.lead_time_dias === null || data.lead_time_dias === undefined ? '—' : `${data.lead_time_dias} dias`}
          detalhe="média das obras iniciadas no período"
        />
        <Cartao
          icone={FaBolt}
          cor="yellow"
          rotulo="Horas extras aprovadas"
          valor={formatarHoras(extras.aprovadas)}
          detalhe={`Emergência: ${formatarHoras(extras.emergencia)} · Pendentes: ${formatarHoras(extras.pendentes)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="execucao-card">
          <div className="execucao-card-header">
            <h4 className="execucao-card-title"><FaHourglassHalf className="text-orange-400" aria-hidden="true" /> Causas de pausa</h4>
          </div>
          {!pausas.length ? (
            <p className="text-sm text-slate-400">Nenhuma pausa registrada no período.</p>
          ) : (
            <ul className="space-y-3">
              {pausas.map((p) => (
                <li key={p.codigo}>
                  <div className="flex justify-between text-sm text-slate-300 mb-1">
                    <span>{rotuloMotivo(p.codigo)}</span>
                    <span>{p.total} ({percentual(Number(p.total), totalPausas)}%)</span>
                  </div>
                  <div className="h-2 rounded bg-slate-700" role="img" aria-label={`${rotuloMotivo(p.codigo)}: ${p.total} pausas`}>
                    <div className="h-2 rounded bg-orange-500" style={{ width: `${(Number(p.total) / maiorPausa) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="execucao-card">
          <div className="execucao-card-header">
            <h4 className="execucao-card-title"><FaClock className="text-blue-400" aria-hidden="true" /> Horas previstas × realizadas</h4>
          </div>
          {!horasPorTipo.length ? (
            <p className="text-sm text-slate-400">Nenhuma atividade concluída com horas previstas no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="execucao-table">
                <thead>
                  <tr><th>Tipo</th><th>Ativ.</th><th>Previstas</th><th>Realizadas</th><th>Desvio</th><th>Com ajuste</th></tr>
                </thead>
                <tbody>
                  {horasPorTipo.map((t) => {
                    const previstas = Number(t.previstas) || 0;
                    const realizadas = Number(t.realizadas) || 0;
                    const desvio = previstas > 0 ? Math.round(((realizadas - previstas) / previstas) * 100) : null;
                    return (
                      <tr key={t.tipo}>
                        <td className="text-slate-100">{TIPOS_ATIVIDADE[t.tipo] ?? t.tipo}</td>
                        <td>{t.atividades}</td>
                        <td>{formatarHoras(previstas)}</td>
                        <td>{formatarHoras(realizadas)}</td>
                        <td>{desvio === null ? '—' : `${desvio > 0 ? '+' : ''}${desvio}%`}</td>
                        <td>{t.ajustadas}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            O realizado assume o previsto ao concluir; o desvio só aparece quando houve ajuste. Calibre as horas dos templates em Configurações → Calibrar templates.
          </p>
        </div>
      </div>
    </section>
  );
};

export default IndicadoresAcionaveis;
