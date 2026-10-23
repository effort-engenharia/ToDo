import React, { useEffect, useMemo, useState } from 'react';
import { execucaoPlanejamentoService as servico } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { formatarDataBR, parseDataLocal } from '../../../utils/datas';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';

const MAX_DIAS = 60;

const intervalo = (inicio, fim) => `${formatarDataBR(inicio)} – ${formatarDataBR(fim)}`;

// Pontos de partida possíveis: uma opção por ordem de etapa (principal) ainda não concluída
const opcoesDePartida = (obra) => {
  const porOrdem = new Map();
  (obra.etapas ?? [])
    .filter((e) => !e.etapa_pai_id && e.status !== 'concluida' && e.status !== 'cancelada')
    .forEach((e) => {
      const ordem = e.ordem || 0;
      const atual = porOrdem.get(ordem);
      porOrdem.set(ordem, atual ? `${atual} / ${e.nome}` : e.nome);
    });
  return [...porOrdem.entries()].sort((a, b) => a[0] - b[0]).map(([ordem, nome]) => ({ ordem, nome }));
};

// "Empurrar etapas seguintes em N dias úteis": sempre com prévia e confirmação (item 2.5)
const ReprogramarModal = ({ obra, etapa = null, onClose, onAplicado }) => {
  const { toast } = useExecucaoUI();
  const opcoes = useMemo(() => opcoesDePartida(obra), [obra]);

  // Com uma etapa de origem, começa na etapa seguinte; sem ela, na primeira ainda aberta
  const ordemInicial = useMemo(() => {
    if (!opcoes.length) return 0;
    if (!etapa) return opcoes[0].ordem;
    const proxima = opcoes.find((o) => o.ordem > (etapa.ordem || 0));
    return (proxima ?? opcoes[opcoes.length - 1]).ordem;
  }, [opcoes, etapa]);

  const [ordem, setOrdem] = useState(ordemInicial);
  const [dias, setDias] = useState('1');
  const [diasConsulta, setDiasConsulta] = useState(1);
  const [aplicando, setAplicando] = useState(false);

  // Evita uma consulta por tecla enquanto o gestor digita os dias
  useEffect(() => {
    const n = parseInt(dias, 10);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DIAS) return undefined;
    const timer = setTimeout(() => setDiasConsulta(n), 350);
    return () => clearTimeout(timer);
  }, [dias]);

  const diasValidos = Number.isInteger(parseInt(dias, 10)) && parseInt(dias, 10) >= 1 && parseInt(dias, 10) <= MAX_DIAS;
  const previaAtual = diasValidos && parseInt(dias, 10) === diasConsulta;

  const previa = useAsyncData(
    () => (opcoes.length ? servico.buscarPreviaDeslocamento(obra.id, ordem, diasConsulta) : { success: true, data: [] }),
    [obra.id, ordem, diasConsulta]
  );

  const linhas = useMemo(() => previa.data ?? [], [previa.data]);
  const etapasPorId = useMemo(() => new Map((obra.etapas ?? []).map((e) => [e.id, e])), [obra.etapas]);
  const idsDaPrevia = useMemo(() => new Set(linhas.map((l) => l.etapa_id)), [linhas]);

  const resumo = useMemo(() => {
    const fimAntes = linhas[0]?.obra_fim_previsto ?? obra.data_fim_prevista;
    const fimDepois = linhas.reduce((max, l) => (l.obra_fim_depois && l.obra_fim_depois > max ? l.obra_fim_depois : max), fimAntes ?? '');
    const atividades = linhas.reduce((soma, l) => soma + (l.atividades_afetadas || 0), 0);
    const estende = Boolean(fimAntes && fimDepois && parseDataLocal(fimDepois) > parseDataLocal(fimAntes));
    const subSoltas = linhas.filter((l) => {
      const e = etapasPorId.get(l.etapa_id);
      return e?.etapa_pai_id && !idsDaPrevia.has(e.etapa_pai_id);
    }).length;
    return { fimAntes, fimDepois, atividades, estende, subSoltas };
  }, [linhas, obra.data_fim_prevista, etapasPorId, idsDaPrevia]);

  const podeConfirmar = previaAtual && !previa.loading && !previa.error && linhas.length > 0 && !aplicando;

  const confirmar = async () => {
    if (!podeConfirmar) return;
    setAplicando(true);
    try {
      const resultado = await servico.alterarDeslocamentoEtapas(obra.id, ordem, diasConsulta);
      if (!resultado.success) {
        toast.error(`Não foi possível reprogramar: ${resultado.message}`);
        return;
      }
      const total = resultado.data?.length ?? linhas.length;
      toast.success(
        `${total} etapa(s) deslocada(s) em ${diasConsulta} dia(s) útil(eis).`
        + (resumo.atividades > 0
          ? ` ${resumo.atividades} atividade(s) remarcada(s); os técnicos vinculados foram notificados.`
          : '')
      );
      onAplicado();
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Modal titulo={`Reprogramar etapas – ${obra.nome_cliente}`} onClose={onClose} tamanho="lg">
      {opcoes.length === 0 ? (
        <p className="text-slate-300 text-sm">Esta obra não tem etapas em aberto para reprogramar.</p>
      ) : (
        <>
          <p className="text-sm text-slate-300 mb-4">
            Nada é alterado até você confirmar. Confira a prévia abaixo: as datas das etapas e das atividades
            na agenda são deslocadas em dias úteis (considerando feriados) e os técnicos são notificados.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="execucao-form-group md:col-span-2">
              <label htmlFor="reprog-ordem" className="execucao-form-label">Deslocar a partir da etapa</label>
              <select id="reprog-ordem" className="execucao-form-select" value={ordem} onChange={(e) => setOrdem(Number(e.target.value))}>
                {opcoes.map((o) => (
                  <option key={o.ordem} value={o.ordem}>{o.ordem}. {o.nome}</option>
                ))}
              </select>
            </div>
            <div className="execucao-form-group">
              <label htmlFor="reprog-dias" className="execucao-form-label">Dias úteis (1 a {MAX_DIAS})</label>
              <input
                id="reprog-dias"
                type="number"
                min="1"
                max={MAX_DIAS}
                step="1"
                className="execucao-form-input"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                aria-invalid={!diasValidos}
              />
              {!diasValidos && <p className="text-xs text-red-400 mt-1">Informe de 1 a {MAX_DIAS} dias úteis.</p>}
            </div>
          </div>

          <div aria-live="polite">
            {(previa.loading || !previaAtual) && diasValidos ? (
              <p className="text-sm text-slate-400" role="status">Calculando prévia…</p>
            ) : previa.error ? (
              <p className="text-sm text-red-400" role="alert">Não foi possível calcular a prévia: {previa.error}</p>
            ) : linhas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma etapa em aberto a partir desta posição.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="visao-tabela">
                    <thead>
                      <tr><th>Etapa</th><th>Antes</th><th>Depois</th><th>Atividades</th></tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => {
                        const original = etapasPorId.get(l.etapa_id);
                        const pai = original?.etapa_pai_id ? etapasPorId.get(original.etapa_pai_id) : null;
                        return (
                          <tr key={l.etapa_id}>
                            <td>
                              {pai ? '↳ ' : ''}{l.nome}
                              {pai && <span className="text-xs text-slate-400"> (sub-etapa de {pai.nome})</span>}
                            </td>
                            <td>{intervalo(l.data_inicio_antes, l.data_fim_antes)}</td>
                            <td className="text-sky-300">{intervalo(l.data_inicio_depois, l.data_fim_depois)}</td>
                            <td>{l.atividades_afetadas}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-sm space-y-1">
                  <div>
                    <strong>Término da obra:</strong> {formatarDataBR(resumo.fimAntes)} → {formatarDataBR(resumo.fimDepois)}
                    {resumo.estende && <span className="text-amber-300"> ⚠ o fim previsto da obra será estendido</span>}
                  </div>
                  <div className="text-slate-300">
                    {resumo.atividades > 0
                      ? `${resumo.atividades} atividade(s) na agenda serão remarcadas e os técnicos vinculados serão notificados.`
                      : 'Nenhuma atividade na agenda será remarcada.'}
                  </div>
                  {resumo.subSoltas > 0 && (
                    <div className="text-amber-300">
                      ⚠ {resumo.subSoltas} sub-etapa(s) entram no deslocamento sem a etapa principal (a seleção é pela ordem). Confira a lista antes de confirmar.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
        <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose} disabled={aplicando}>
          Cancelar
        </button>
        <button type="button" className="execucao-btn execucao-btn-primary" onClick={confirmar} disabled={!podeConfirmar}>
          {aplicando ? 'Aplicando...' : 'Confirmar reprogramação'}
        </button>
      </div>
    </Modal>
  );
};

export default ReprogramarModal;
