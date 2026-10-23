import React, { useState } from 'react';
import { execucaoAuditoriaService as servico } from '../../../../services/supabase/execucaoAuditoria';
import { notificarResultado } from '../../utils/formatos';
import { useExecucaoUI } from '../ui/ExecucaoUI';

const DIAS_CARENCIA_LIXEIRA = 30;
const RETENCAO_PADRAO_DIAS = 365;
const RETENCAO_MINIMA_DIAS = 30;

// Rotinas de manutenção disparadas manualmente pelo admin (lixeira do Storage e retenção da auditoria)
const ManutencaoHistorico = () => {
  const { toast, confirmar } = useExecucaoUI();
  const [pendentes, setPendentes] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [purgando, setPurgando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [dias, setDias] = useState(String(RETENCAO_PADRAO_DIAS));
  const [limpando, setLimpando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    setRelatorio(null);
    const resultado = await servico.buscarLixeiraPendentes(DIAS_CARENCIA_LIXEIRA);
    setVerificando(false);
    if (notificarResultado(resultado, toast)) setPendentes(resultado.data ?? []);
  };

  const purgar = async () => {
    const confirmado = await confirmar({
      titulo: 'Apagar arquivos da lixeira',
      mensagem: `Apagar definitivamente do Storage ${pendentes.length} arquivo(s) excluídos há mais de ${DIAS_CARENCIA_LIXEIRA} dias? Esta ação não pode ser desfeita.`,
      confirmarTexto: 'Apagar definitivamente',
    });
    if (!confirmado) return;
    setPurgando(true);
    const resultado = await servico.removerArquivosLixeira(DIAS_CARENCIA_LIXEIRA);
    setPurgando(false);
    if (!notificarResultado(resultado, toast)) return;
    setRelatorio(resultado.data);
    setPendentes(null);
    if (resultado.data.falhas.length) toast.error(`${resultado.data.removidos} apagado(s); ${resultado.data.falhas.length} falharam e continuam na lixeira.`);
    else toast.success(`${resultado.data.removidos} arquivo(s) apagado(s) da lixeira`);
  };

  const limpar = async () => {
    const qtd = Number(dias);
    if (!Number.isInteger(qtd) || qtd < RETENCAO_MINIMA_DIAS) return toast.error(`Informe pelo menos ${RETENCAO_MINIMA_DIAS} dias.`);
    const confirmado = await confirmar({
      titulo: 'Apagar histórico antigo',
      mensagem: `Apagar do histórico de alterações tudo o que tem mais de ${qtd} dias? Essas ações deixam de aparecer e não poderão mais ser consultadas.`,
      confirmarTexto: 'Apagar histórico',
    });
    if (!confirmado) return;
    setLimpando(true);
    const resultado = await servico.excluirAuditoriaAntiga(qtd);
    setLimpando(false);
    if (notificarResultado(resultado, toast)) toast.success(`${Number(resultado.data) || 0} registro(s) de histórico apagado(s)`);
  };

  const porBucket = (pendentes ?? []).reduce((acc, p) => ({ ...acc, [p.bucket]: (acc[p.bucket] ?? 0) + 1 }), {});

  return (
    <details className="execucao-card mt-6">
      <summary className="execucao-card-title cursor-pointer">Manutenção (lixeira de arquivos e retenção)</summary>

      <div className="mt-4">
        <h4 className="font-semibold text-slate-100">Lixeira de arquivos</h4>
        <p className="cfg-muted mb-2">
          Arquivos de registros excluídos ficam {DIAS_CARENCIA_LIXEIRA} dias guardados para permitir o desfazer. Depois disso, podem ser apagados definitivamente do Storage.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={verificar} disabled={verificando || purgando}>
            {verificando ? 'Verificando…' : 'Verificar arquivos vencidos'}
          </button>
          {pendentes && pendentes.length > 0 && (
            <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm" onClick={purgar} disabled={purgando}>
              {purgando ? 'Apagando…' : `Apagar ${pendentes.length} arquivo(s) do Storage`}
            </button>
          )}
        </div>
        <div aria-live="polite" className="mt-2">
          {pendentes && pendentes.length === 0 && <p className="cfg-muted">Nenhum arquivo vencido na lixeira.</p>}
          {pendentes && pendentes.length > 0 && (
            <p className="cfg-muted">{Object.entries(porBucket).map(([bucket, n]) => `${bucket}: ${n}`).join(' · ')}</p>
          )}
          {relatorio && (
            <p className="cfg-muted">
              Resultado: {relatorio.removidos} de {relatorio.total} apagado(s).
              {relatorio.falhas.length > 0 && ` Falhas: ${relatorio.falhas.slice(0, 3).map((f) => f.motivo).join('; ')}`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold text-slate-100">Retenção do histórico</h4>
        <p className="cfg-muted mb-2">Apaga do histórico as ações mais antigas que o prazo informado (mínimo de {RETENCAO_MINIMA_DIAS} dias; padrão de {RETENCAO_PADRAO_DIAS} dias).</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="cfg-field">
            <label htmlFor="hist-reten">Manter os últimos (dias)</label>
            <input id="hist-reten" type="number" min={RETENCAO_MINIMA_DIAS} step="1" className="execucao-form-input" style={{ width: '8rem', padding: '0.5rem 0.75rem' }} value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm" onClick={limpar} disabled={limpando}>
            {limpando ? 'Apagando…' : 'Apagar histórico antigo'}
          </button>
        </div>
      </div>
    </details>
  );
};

export default ManutencaoHistorico;
