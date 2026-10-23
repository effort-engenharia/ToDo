import React, { useId, useMemo, useState } from 'react';
import { FaClipboardList, FaSearch } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { ErroCarregamento } from '../../ui/Estados';
import { MOTIVOS_NAO_PLANEJAR } from '../constants';
import { formatarDataCurta } from '../utils';
import { classePrazoContrato, formatarMoeda } from './cadastroUtils';
import './cadastro.css';

const mensagemDe = (resultado) => resultado?.message || 'erro desconhecido';

// Triagem em lote dos contratos do Comercial que ainda não viraram obra:
// marcar vários como "não planejar" (já concluídos, cancelados...) ou abrir o cadastro de um deles.
const RevisarContratosPendentes = ({ usuarioId, onClose, onAlterado, onPlanejar, onServicoRapido }) => {
  const { toast, confirmar } = useExecucaoUI();
  const idBase = useId();
  const [busca, setBusca] = useState('');
  const [mostrarTratados, setMostrarTratados] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [motivo, setMotivo] = useState(MOTIVOS_NAO_PLANEJAR[0]);
  const [outroMotivo, setOutroMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const buscaAtrasada = useDebouncedValue(busca, 300);

  const { data, loading, error, reload } = useAsyncData(
    () => execucaoPlanejamentoService.listarContratosPendentes({ incluirPlanejados: mostrarTratados, busca: buscaAtrasada }),
    [mostrarTratados, buscaAtrasada]
  );

  const contratos = useMemo(() => data ?? [], [data]);
  const selecionaveis = useMemo(() => contratos.filter((c) => !c.obra_id && !c.ignorado), [contratos]);
  const marcados = selecionaveis.filter((c) => selecionados.has(c.id));
  const todosMarcados = selecionaveis.length > 0 && marcados.length === selecionaveis.length;

  const alternar = (id) => setSelecionados((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });

  const alternarTodos = () => setSelecionados((atual) => {
    const proximo = new Set(atual);
    if (todosMarcados) selecionaveis.forEach((c) => proximo.delete(c.id));
    else selecionaveis.forEach((c) => proximo.add(c.id));
    return proximo;
  });

  const motivoFinal = motivo === 'Outro' ? outroMotivo.trim() : motivo;

  const aplicarEmLote = async () => {
    if (!marcados.length || salvando) return;
    if (!motivoFinal) {
      toast.error('Descreva o motivo.');
      return;
    }
    const confirmado = await confirmar({
      titulo: 'Não planejar contratos',
      mensagem: `Marcar ${marcados.length} contrato(s) como "${motivoFinal}"? Eles saem da lista de pendentes; nada é alterado no Comercial.`,
      confirmarTexto: 'Marcar',
      perigo: false
    });
    if (!confirmado) return;

    setSalvando(true);
    try {
      const resultado = await execucaoPlanejamentoService.criarContratosIgnorados(marcados.map((c) => c.id), motivoFinal, usuarioId);
      if (!resultado.success) {
        toast.error(`Não foi possível marcar os contratos: ${mensagemDe(resultado)}`);
        return;
      }
      toast.success(`${marcados.length} contrato(s) removido(s) da lista de pendentes.`);
      setSelecionados(new Set());
      onAlterado?.();
      reload();
    } catch (err) {
      console.error('Erro ao ignorar contratos em lote:', err);
      toast.error(`Não foi possível marcar os contratos: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const restaurar = async (contrato) => {
    const resultado = await execucaoPlanejamentoService.excluirContratosIgnorados([contrato.id]);
    if (!resultado.success) {
      toast.error(`Não foi possível restaurar o contrato: ${mensagemDe(resultado)}`);
      return;
    }
    toast.success('Contrato voltou para a lista de pendentes.');
    onAlterado?.();
    reload();
  };

  return (
    <Modal
      titulo="Revisar contratos pendentes"
      cabecalho={
        <>
          <FaClipboardList className="text-sky-400" aria-hidden="true" />
          Revisar contratos pendentes
        </>
      }
      tamanho="lg"
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Marque os contratos que não precisam ser planejados (já concluídos antes do sistema, cancelados...) e trate todos de uma vez.
          Para os que estão em execução hoje, use &quot;Cadastrar obra&quot; e ative &quot;Obra já em andamento&quot;.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[14rem]">
            <label htmlFor={`${idBase}-busca`} className="sr-only">Buscar cliente</label>
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} aria-hidden="true" />
            <input
              id={`${idBase}-busca`}
              type="text"
              className="execucao-form-input !pl-9"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={mostrarTratados}
              onChange={(e) => setMostrarTratados(e.target.checked)}
            />
            Mostrar também já planejados / não planejados
          </label>
        </div>

        {error ? (
          <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
        ) : (
          <div className="cad-revisar-tabela-wrap" aria-busy={loading}>
            <table className="cad-revisar-tabela">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '2rem' }}>
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      aria-label="Selecionar todos os contratos da lista"
                      checked={todosMarcados}
                      ref={(el) => { if (el) el.indeterminate = marcados.length > 0 && !todosMarcados; }}
                      onChange={alternarTodos}
                      disabled={selecionaveis.length === 0}
                    />
                  </th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Serviço</th>
                  <th scope="col">Início previsto</th>
                  <th scope="col">Valor</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && data === null && (
                  <tr><td colSpan={6} className="text-center text-slate-500">Carregando contratos...</td></tr>
                )}
                {!loading && contratos.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-500">Nenhum contrato aguardando planejamento.</td></tr>
                )}
                {contratos.map((c) => {
                  const livre = !c.obra_id && !c.ignorado;
                  const prazo = livre ? classePrazoContrato(c.cronograma_data_inicio) : null;
                  return (
                    <tr key={c.id} data-selecionada={selecionados.has(c.id)}>
                      <td>
                        {livre && (
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={selecionados.has(c.id)}
                            onChange={() => alternar(c.id)}
                            aria-label={`Selecionar ${c.nome_cliente}`}
                          />
                        )}
                      </td>
                      <td className="text-white">{c.nome_cliente}</td>
                      <td>{c.tipo_servico_nome || c.tipo_oportunidade || '—'}</td>
                      <td>
                        {formatarDataCurta(c.cronograma_data_inicio)}{' '}
                        {prazo === 'vencido' && <span className="cad-tag cad-tag-vermelha">vencido</span>}
                        {prazo === 'proximo' && <span className="cad-tag cad-tag-amarela">7 dias</span>}
                      </td>
                      <td>{formatarMoeda(c.valor_total_servico) || '—'}</td>
                      <td>
                        {livre && (
                          <span className="flex flex-wrap gap-2">
                            <button type="button" className="cad-link" onClick={() => onPlanejar?.(c)}>Cadastrar obra</button>
                            {c.modalidade === 'servico' && (
                              <button type="button" className="cad-link" onClick={() => onServicoRapido?.(c)}>Serviço rápido</button>
                            )}
                          </span>
                        )}
                        {c.obra_id && <span className="cad-tag">já virou obra</span>}
                        {c.ignorado && (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="cad-tag" title={c.motivo_ignorado || ''}>{c.motivo_ignorado || 'não planejar'}</span>
                            <button type="button" className="cad-link" onClick={() => restaurar(c)}>Restaurar</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="cad-revisar-acoes" role="group" aria-label="Ação em lote">
          <div>
            <label htmlFor={`${idBase}-motivo`} className="execucao-form-label">Não planejar os selecionados como</label>
            <select
              id={`${idBase}-motivo`}
              className="execucao-form-select"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_NAO_PLANEJAR.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {motivo === 'Outro' && (
            <div>
              <label htmlFor={`${idBase}-outro`} className="execucao-form-label">Motivo</label>
              <input
                id={`${idBase}-outro`}
                type="text"
                className="execucao-form-input"
                value={outroMotivo}
                onChange={(e) => setOutroMotivo(e.target.value)}
                placeholder="Descreva o motivo"
              />
            </div>
          )}
          <button
            type="button"
            className="execucao-btn execucao-btn-primary"
            onClick={aplicarEmLote}
            disabled={marcados.length === 0 || salvando}
          >
            {salvando ? 'Salvando...' : `Marcar ${marcados.length} como não planejar`}
          </button>
        </div>
      </div>

      <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
        <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
};

export default RevisarContratosPendentes;
