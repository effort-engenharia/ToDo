import React, { useState } from 'react';
import { FaCalendarPlus } from 'react-icons/fa';
import Modal from '../ui/Modal';
import { FORM_ATIVIDADE_VAZIO } from './constants';

const AtividadeEtapaModal = ({ etapa, tecnicos, salvando, onSalvar, onClose }) => {
  const [form, setForm] = useState(() => ({
    ...FORM_ATIVIDADE_VAZIO,
    titulo: etapa.nome,
    descricao: etapa.descricao || '',
    data_programada: etapa.data_inicio,
    tecnico_responsavel_id: etapa.responsavel_id || ''
  }));
  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(form);
  };

  return (
    <Modal
      titulo="Criar Atividade na Agenda"
      cabecalho={
        <>
          <FaCalendarPlus className="text-green-400" aria-hidden="true" />
          Criar Atividade na Agenda
        </>
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-400">Criando atividade a partir da etapa:</p>
          <p className="font-medium">{etapa.nome}</p>
        </div>

        <div className="space-y-4">
          <div className="execucao-form-group">
            <label htmlFor="atividade-titulo" className="execucao-form-label">Título da Atividade</label>
            <input
              id="atividade-titulo"
              type="text"
              className="execucao-form-input"
              value={form.titulo}
              onChange={campo('titulo')}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="atividade-data" className="execucao-form-label">Data *</label>
              <input
                id="atividade-data"
                type="date"
                className="execucao-form-input"
                value={form.data_programada}
                onChange={campo('data_programada')}
                required
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="atividade-hora-inicio" className="execucao-form-label">Hora Início</label>
              <input
                id="atividade-hora-inicio"
                type="time"
                className="execucao-form-input"
                value={form.hora_inicio}
                onChange={campo('hora_inicio')}
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="atividade-hora-fim" className="execucao-form-label">Hora Fim</label>
              <input
                id="atividade-hora-fim"
                type="time"
                className="execucao-form-input"
                value={form.hora_fim}
                onChange={campo('hora_fim')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="atividade-tecnico" className="execucao-form-label">Técnico Responsável</label>
              <select
                id="atividade-tecnico"
                className="execucao-form-select"
                value={form.tecnico_responsavel_id}
                onChange={campo('tecnico_responsavel_id')}
              >
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_completo}</option>
                ))}
              </select>
            </div>
            <div className="execucao-form-group">
              <label htmlFor="atividade-prioridade" className="execucao-form-label">Prioridade</label>
              <select
                id="atividade-prioridade"
                className="execucao-form-select"
                value={form.prioridade}
                onChange={campo('prioridade')}
              >
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="execucao-form-group">
            <label htmlFor="atividade-observacoes" className="execucao-form-label">Observações</label>
            <textarea
              id="atividade-observacoes"
              className="execucao-form-textarea"
              rows="2"
              value={form.observacoes}
              onChange={campo('observacoes')}
              placeholder="Instruções adicionais..."
            />
          </div>
        </div>

        <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
          <button
            type="button"
            className="execucao-btn execucao-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>
            <FaCalendarPlus aria-hidden="true" /> {salvando ? 'Criando...' : 'Criar Atividade'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AtividadeEtapaModal;
