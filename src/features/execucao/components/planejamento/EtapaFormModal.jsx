import React, { useState } from 'react';
import { FaProjectDiagram } from 'react-icons/fa';
import Modal from '../ui/Modal';
import SeletorEquipe from './cadastro/SeletorEquipe';

const EtapaFormModal = ({ etapa, inicial, tecnicos, salvando, onSalvar, onClose }) => {
  const [form, setForm] = useState(inicial);
  const editando = Boolean(etapa);
  const subEtapa = Boolean(form.etapa_pai_id);
  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  const titulo = editando
    ? (etapa.etapa_pai_id ? 'Editar Sub-etapa' : 'Editar Etapa')
    : (subEtapa ? 'Nova Sub-etapa' : 'Nova Etapa');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(form);
  };

  return (
    <Modal
      titulo={titulo}
      cabecalho={
        <>
          <FaProjectDiagram className={subEtapa ? 'text-purple-400' : 'text-green-400'} aria-hidden="true" />
          {titulo}
        </>
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Indicador de etapa pai (quando é sub-etapa) */}
          {subEtapa && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                <FaProjectDiagram size={12} aria-hidden="true" />
                <span className="font-medium">Sub-etapa de:</span>
                <span className="text-white">{form.etapa_pai_nome || 'Etapa pai'}</span>
              </div>
            </div>
          )}

          <div className="execucao-form-group">
            <label htmlFor="etapa-nome" className="execucao-form-label">
              {subEtapa ? 'Nome da Sub-etapa *' : 'Nome da Etapa *'}
            </label>
            <input
              id="etapa-nome"
              type="text"
              className="execucao-form-input"
              value={form.nome}
              onChange={campo('nome')}
              placeholder={subEtapa ? 'Ex: Passagem de cabos - Bloco A' : 'Ex: Instalação de quadros elétricos'}
              required
            />
          </div>

          <div className="execucao-form-group">
            <label htmlFor="etapa-descricao" className="execucao-form-label">Descrição</label>
            <textarea
              id="etapa-descricao"
              className="execucao-form-textarea"
              rows="2"
              value={form.descricao}
              onChange={campo('descricao')}
              placeholder="Detalhes da etapa..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="etapa-tipo" className="execucao-form-label">Tipo da Etapa</label>
              <select id="etapa-tipo" className="execucao-form-select" value={form.tipo} onChange={campo('tipo')}>
                <option value="gestao">🎯 Gestão/Liderança</option>
                <option value="eletrica">⚡ Elétrica</option>
                <option value="civil">🏗️ Civil</option>
                <option value="galpao">🏭 Galpão</option>
                <option value="estoque">📦 Estoque/Compras</option>
                <option value="administrativo">📋 Administrativo</option>
              </select>
            </div>
            <div className="execucao-form-group">
              <span className="execucao-form-label block">Responsável / equipe</span>
              <SeletorEquipe
                tecnicos={tecnicos}
                liderId={form.responsavel_id}
                apoioIds={(form.equipe_ids || []).filter((id) => id !== form.responsavel_id)}
                rotulo="Responsável / equipe"
                onChange={({ liderId, apoioIds }) => setForm((prev) => ({
                  ...prev,
                  responsavel_id: liderId,
                  equipe_ids: liderId ? [liderId, ...apoioIds] : apoioIds
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="etapa-inicio" className="execucao-form-label">Data Início *</label>
              <input
                id="etapa-inicio"
                type="date"
                className="execucao-form-input"
                value={form.data_inicio}
                onChange={campo('data_inicio')}
                required
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="etapa-fim" className="execucao-form-label">Data Fim *</label>
              <input
                id="etapa-fim"
                type="date"
                className="execucao-form-input"
                value={form.data_fim}
                onChange={campo('data_fim')}
                required
              />
            </div>
          </div>

          {editando && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="execucao-form-group">
                <label htmlFor="etapa-status" className="execucao-form-label">Status</label>
                <select id="etapa-status" className="execucao-form-select" value={form.status} onChange={campo('status')}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="atrasada">Atrasada</option>
                </select>
              </div>
              <div className="execucao-form-group">
                <label htmlFor="etapa-progresso" className="execucao-form-label">Progresso: {form.progresso || 0}%</label>
                <input
                  id="etapa-progresso"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.progresso || 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, progresso: parseInt(e.target.value, 10) }))}
                  className="w-full"
                />
              </div>
            </div>
          )}
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
          <button
            type="submit"
            className={`execucao-btn ${subEtapa ? 'bg-purple-600 hover:bg-purple-700' : 'execucao-btn-primary'}`}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : (editando ? 'Salvar' : (subEtapa ? 'Adicionar Sub-etapa' : 'Adicionar Etapa'))}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EtapaFormModal;
