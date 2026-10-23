import React, { useId, useState } from 'react';
import { FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { MOTIVOS_NAO_PLANEJAR } from '../constants';
import { formatarDataCurta } from '../utils';
import { classePrazoContrato, formatarMoeda } from './cadastroUtils';
import './cadastro.css';

const LIMITE_LISTA = 80;

const EtiquetaPrazo = ({ inicio }) => {
  const classe = classePrazoContrato(inicio);
  if (classe === 'vencido') return <span className="cad-tag cad-tag-vermelha">vencido</span>;
  if (classe === 'proximo') return <span className="cad-tag cad-tag-amarela">próximos 7 dias</span>;
  return null;
};

// Escolha do contrato do Comercial que ainda não virou obra (busca no servidor, ordenado pelo início previsto).
// `selecionado` é a linha do contrato; onSelecionar(null) limpa a escolha.
const SeletorContrato = ({ selecionado, onSelecionar, usuarioId, onIgnorado }) => {
  const { toast } = useExecucaoUI();
  const idBase = useId();
  const [busca, setBusca] = useState('');
  const [incluirPlanejados, setIncluirPlanejados] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const [ignorando, setIgnorando] = useState(null); // { motivo, outro, salvando }
  const buscaAtrasada = useDebouncedValue(busca, 300);

  const { data, loading, error, reload } = useAsyncData(
    () => execucaoPlanejamentoService.listarContratosPendentes({ incluirPlanejados, busca: buscaAtrasada }),
    [incluirPlanejados, buscaAtrasada]
  );

  const contratos = data ?? [];
  const visiveis = contratos.slice(0, LIMITE_LISTA);
  const selecionavel = (c) => !c.obra_id && !c.ignorado;

  const escolher = (contrato) => {
    if (!contrato || !selecionavel(contrato)) return;
    onSelecionar(contrato);
    setIndiceAtivo(-1);
  };

  const onKeyDown = (e) => {
    if (!visiveis.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(visiveis.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && indiceAtivo >= 0) {
      e.preventDefault();
      escolher(visiveis[indiceAtivo]);
    }
  };

  const confirmarIgnorar = async () => {
    const motivo = ignorando.motivo === 'Outro' ? ignorando.outro.trim() : ignorando.motivo;
    if (!motivo) {
      toast.error('Descreva o motivo.');
      return;
    }
    setIgnorando((atual) => ({ ...atual, salvando: true }));
    const resultado = await execucaoPlanejamentoService.criarContratosIgnorados([selecionado.id], motivo, usuarioId);
    if (!resultado.success) {
      toast.error(`Não foi possível marcar como "não planejar": ${resultado.message || 'erro desconhecido'}`);
      setIgnorando((atual) => ({ ...atual, salvando: false }));
      return;
    }
    toast.success('Contrato removido da lista de pendentes.');
    setIgnorando(null);
    onSelecionar(null);
    onIgnorado?.();
    reload();
  };

  if (selecionado) {
    return (
      <div className="cad-contrato-escolhido">
        <div className="cad-contrato-escolhido-topo">
          <div>
            <p className="text-sm font-medium text-white">{selecionado.nome_cliente}</p>
            <p className="text-xs text-slate-400">
              {[selecionado.tipo_servico_nome || selecionado.tipo_oportunidade, selecionado.cidade,
                selecionado.cronograma_data_inicio ? `início ${formatarDataCurta(selecionado.cronograma_data_inicio)}` : null,
                formatarMoeda(selecionado.valor_total_servico) || null].filter(Boolean).join(' · ')}
              {' '}<EtiquetaPrazo inicio={selecionado.cronograma_data_inicio} />
            </p>
          </div>
          <button type="button" className="cad-link" onClick={() => onSelecionar(null)}>Trocar contrato</button>
        </div>

        {ignorando ? (
          <div className="cad-ignorar" role="group" aria-label="Não planejar este contrato">
            <label htmlFor={`${idBase}-motivo`} className="execucao-form-label">Motivo</label>
            <select
              id={`${idBase}-motivo`}
              className="execucao-form-select"
              value={ignorando.motivo}
              onChange={(e) => setIgnorando({ ...ignorando, motivo: e.target.value })}
            >
              {MOTIVOS_NAO_PLANEJAR.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {ignorando.motivo === 'Outro' && (
              <input
                type="text"
                className="execucao-form-input mt-2"
                aria-label="Descreva o motivo"
                placeholder="Descreva o motivo"
                value={ignorando.outro}
                onChange={(e) => setIgnorando({ ...ignorando, outro: e.target.value })}
              />
            )}
            <div className="flex gap-2 mt-2">
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setIgnorando(null)} disabled={ignorando.salvando}>
                Cancelar
              </button>
              <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm" onClick={confirmarIgnorar} disabled={ignorando.salvando}>
                {ignorando.salvando ? 'Salvando...' : 'Não planejar este contrato'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="cad-link cad-link-discreto"
            onClick={() => setIgnorando({ motivo: MOTIVOS_NAO_PLANEJAR[0], outro: '', salvando: false })}
          >
            Não planejar este contrato
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cad-contrato">
      <label htmlFor={`${idBase}-busca`} className="text-sm font-medium text-sky-400 flex items-center gap-2 mb-2">
        <FaSearch size={12} aria-hidden="true" />
        Contrato / venda aguardando planejamento
      </label>
      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} aria-hidden="true" />
        <input
          id={`${idBase}-busca`}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${idBase}-lista`}
          aria-activedescendant={indiceAtivo >= 0 ? `${idBase}-op-${indiceAtivo}` : undefined}
          autoComplete="off"
          className="execucao-form-input !pl-9"
          placeholder="Digite o nome do cliente para filtrar..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setIndiceAtivo(-1); }}
          onKeyDown={onKeyDown}
        />
      </div>

      <div
        id={`${idBase}-lista`}
        role="listbox"
        aria-label="Contratos"
        aria-busy={loading}
        className="cad-contrato-lista"
      >
        {error && (
          <div className="cad-contrato-aviso" role="alert">
            <FaExclamationTriangle aria-hidden="true" /> {error}
            <button type="button" className="cad-link ml-2" onClick={reload}>Tentar novamente</button>
          </div>
        )}
        {!error && loading && data === null && <div className="cad-contrato-aviso">Carregando contratos...</div>}
        {!error && !loading && contratos.length === 0 && (
          <div className="cad-contrato-aviso">
            {incluirPlanejados ? 'Nenhum contrato encontrado.' : 'Nenhum contrato aguardando planejamento.'}
          </div>
        )}
        {visiveis.map((c, i) => {
          const livre = selecionavel(c);
          return (
            <div
              key={c.id}
              id={`${idBase}-op-${i}`}
              role="option"
              aria-selected={false}
              aria-disabled={!livre}
              tabIndex={-1}
              className={`cad-contrato-opcao ${i === indiceAtivo ? 'cad-contrato-opcao-ativa' : ''} ${livre ? '' : 'cad-contrato-opcao-inativa'}`}
              onClick={() => escolher(c)}
            >
              <span className="cad-contrato-cliente">{c.nome_cliente}</span>
              <span className="cad-contrato-detalhe">
                {[c.tipo_servico_nome || c.tipo_oportunidade || 'sem tipo de serviço',
                  c.cronograma_data_inicio ? `início ${formatarDataCurta(c.cronograma_data_inicio)}` : 'sem início previsto',
                  formatarMoeda(c.valor_total_servico) || null].filter(Boolean).join(' · ')}
              </span>
              {livre && <EtiquetaPrazo inicio={c.cronograma_data_inicio} />}
              {c.obra_id && <span className="cad-tag">já virou obra</span>}
              {c.ignorado && <span className="cad-tag" title={c.motivo_ignorado || ''}>não planejar</span>}
            </div>
          );
        })}
        {contratos.length > LIMITE_LISTA && (
          <div className="cad-contrato-aviso">Mostrando {LIMITE_LISTA} de {contratos.length}. Refine a busca.</div>
        )}
      </div>

      <label className="flex items-center gap-2 mt-2 text-xs text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4"
          checked={incluirPlanejados}
          onChange={(e) => setIncluirPlanejados(e.target.checked)}
        />
        Mostrar também contratos já planejados / antigos
      </label>
    </div>
  );
};

export default SeletorContrato;
