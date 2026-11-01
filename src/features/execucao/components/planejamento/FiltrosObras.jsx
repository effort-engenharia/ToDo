import React, { useId } from 'react';
import Modal from '../ui/Modal';
import { ORDENACOES, PERIODOS, STATUS } from './filtrosObrasUtils';
import { FILTROS_VISAO } from './visao/saude';

const Opcoes = ({ itens }) => itens.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>);

// Selects de período, status, situação e ordenação (mesmos controles inline e na gaveta)
export const CamposFiltroObras = ({ filtros, onPeriodo, onStatus, onCarteira, onOrdenacao, comRotulos = false }) => {
  const base = useId();
  const campo = (sufixo, rotulo, valor, onChange, children) => (
    <div className={comRotulos ? 'flex flex-col gap-1' : undefined}>
      {comRotulos && <label htmlFor={`${base}-${sufixo}`} className="text-sm text-slate-300">{rotulo}</label>}
      <select
        id={`${base}-${sufixo}`}
        aria-label={comRotulos ? undefined : rotulo}
        className="execucao-form-select plan-campo"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );

  return (
    <>
      {campo('periodo', 'Período', filtros.periodo, onPeriodo, <Opcoes itens={PERIODOS} />)}
      {campo('status', 'Status', filtros.status, onStatus, <Opcoes itens={STATUS} />)}
      {campo('situacao', 'Situação', filtros.carteira, onCarteira,
        FILTROS_VISAO.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>))}
      {campo('ordem', 'Ordenar obras', filtros.ordenacao, onOrdenacao, <Opcoes itens={ORDENACOES} />)}
    </>
  );
};

// Gaveta de filtros (<640px): tela cheia, aplica na hora; o rodapé mostra quantas obras sobraram
export const FiltrosObrasGaveta = ({
  filtros, totalObras, onPeriodo, onStatus, onCarteira, onOrdenacao, onOcultarRapidos, onLimpar, onClose
}) => (
  <Modal titulo="Filtros" onClose={onClose} telaCheia>
    <div className="flex flex-col gap-4">
      <CamposFiltroObras
        filtros={filtros}
        onPeriodo={onPeriodo}
        onStatus={onStatus}
        onCarteira={onCarteira}
        onOrdenacao={onOrdenacao}
        comRotulos
      />
      <label className="plan-check">
        <input
          type="checkbox"
          checked={filtros.ocultarRapidos}
          onChange={(e) => onOcultarRapidos(e.target.checked)}
        />
        Ocultar serviços rápidos
      </label>
    </div>

    <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
      <button type="button" className="execucao-btn execucao-btn-secondary plan-toque" onClick={onLimpar}>
        Limpar filtros
      </button>
      <button type="button" className="execucao-btn execucao-btn-primary plan-toque" onClick={onClose} aria-live="polite">
        Ver {totalObras} {totalObras === 1 ? 'obra' : 'obras'}
      </button>
    </div>
  </Modal>
);
