import React, { useMemo, useState } from 'react';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatarHoras, notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';

// Diferença percentual da média em relação ao previsto (null quando não há previsto)
const diferenca = (linha) => {
  const previsto = Number(linha.horas_previstas);
  if (!previsto) return null;
  return Math.round(((Number(linha.media_realizada) - previsto) / previsto) * 100);
};

const AbaCalibrarTemplates = () => {
  const { toast, confirmar } = useExecucaoUI();
  const { data, loading, error, reload } = useAsyncData(() => servico.buscarMediaRealizadaTemplates(), []);
  const [somenteDiferentes, setSomenteDiferentes] = useState(false);
  const [aplicando, setAplicando] = useState(null);

  const grupos = useMemo(() => {
    const mapa = new Map();
    (data ?? []).forEach((linha) => {
      const dif = diferenca(linha);
      if (somenteDiferentes && (dif === null ? false : Math.abs(dif) < 10)) return;
      if (!mapa.has(linha.template_id)) mapa.set(linha.template_id, { nome: linha.template_nome, linhas: [] });
      mapa.get(linha.template_id).linhas.push(linha);
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [data, somenteDiferentes]);

  const usarMedia = async (linha) => {
    const media = Number(linha.media_realizada);
    const confirmado = await confirmar({
      titulo: 'Usar média realizada',
      mensagem: `Atualizar "${linha.item_nome}" (${linha.template_nome}) de ${linha.horas_previstas != null ? formatarHoras(linha.horas_previstas) : 'sem horas'} para ${formatarHoras(media)}? Vale para novos cronogramas criados a partir do template.`,
      confirmarTexto: 'Usar média',
      perigo: false,
    });
    if (!confirmado) return;
    setAplicando(linha.item_id);
    const ok = notificarResultado(await servico.atualizarHorasItemTemplate(linha.item_id, media), toast, 'Horas do template atualizadas');
    setAplicando(null);
    if (ok) reload();
  };

  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !data) return <Carregando />;

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Calibrar horas dos templates com o realizado</h3>
      </div>
      <p className="cfg-note">
        A média usa as horas realizadas das etapas concluídas. Como o realizado assume o previsto, só há desvio quando alguém ajustou as horas:
        confira a coluna “Com ajuste” antes de confiar na média.
      </p>
      <label className="cfg-check mb-4">
        <input type="checkbox" checked={somenteDiferentes} onChange={(e) => setSomenteDiferentes(e.target.checked)} />
        Mostrar só etapas com diferença de 10% ou mais
      </label>

      {!grupos.length ? (
        <EstadoVazio
          titulo="Nada para calibrar ainda"
          texto={data?.length ? 'Nenhuma etapa com diferença relevante.' : 'Ainda não há etapas concluídas com horas realizadas registradas.'}
        />
      ) : grupos.map((grupo) => (
        <section key={grupo.nome} className="mb-6" aria-label={`Template ${grupo.nome}`}>
          <h4 className="font-semibold text-slate-100 mb-2">{grupo.nome}</h4>
          <div className="cfg-table-wrap">
            <table className="execucao-table">
              <thead>
                <tr><th>Etapa</th><th>Previsto</th><th>Realizado médio</th><th>Diferença</th><th>Execuções</th><th>Com ajuste</th><th><span className="sr-only">Ação</span></th></tr>
              </thead>
              <tbody>
                {grupo.linhas.map((linha) => {
                  const dif = diferenca(linha);
                  const semAjuste = linha.ajustes === 0;
                  return (
                    <tr key={linha.item_id}>
                      <td className="text-slate-100">{linha.item_nome}</td>
                      <td>{linha.horas_previstas != null ? formatarHoras(linha.horas_previstas) : '—'}</td>
                      <td className="text-slate-100">{formatarHoras(linha.media_realizada)}</td>
                      <td>
                        {dif === null ? '—' : (
                          <span className={`execucao-badge ${Math.abs(dif) >= 10 ? 'execucao-badge-orange' : 'execucao-badge-gray'}`}>
                            {dif > 0 ? '+' : ''}{dif}%
                          </span>
                        )}
                      </td>
                      <td>{linha.execucoes}</td>
                      <td>
                        {linha.ajustes}
                        {semAjuste && <span className="cfg-muted"> · média = previsto</span>}
                      </td>
                      <td>
                        <div className="cfg-actions">
                          <button
                            type="button"
                            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                            disabled={aplicando === linha.item_id || dif === 0}
                            onClick={() => usarMedia(linha)}
                          >
                            Usar média
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};

export default AbaCalibrarTemplates;
