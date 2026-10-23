import React, { useState } from 'react';
import { FaMagic, FaPlus, FaTrash } from 'react-icons/fa';
import Modal from '../ui/Modal';
import { FORM_TEMPLATE_VAZIO } from './constants';
import { novaChave } from './utils';

const formDoTemplate = (template) => {
  const base = template
    ? {
        nome: template.nome || '',
        descricao: template.descricao || '',
        tipo_obra: template.tipo_obra || 'eletrica',
        icone: template.icone || 'FaBolt',
        cor: template.cor || '#eab308',
        ativo: template.ativo !== false,
        itens: template.itens || []
      }
    : FORM_TEMPLATE_VAZIO;

  // `_chave` só existe no cliente: dá identidade estável às linhas editáveis
  return { ...base, itens: base.itens.map((item) => ({ ...item, _chave: novaChave() })) };
};

const TemplateFormModal = ({ template, salvando, onSalvar, onClose }) => {
  const [form, setForm] = useState(() => formDoTemplate(template));
  const editando = Boolean(template);
  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  const adicionarItem = () => {
    setForm((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        { _chave: novaChave(), nome: '', descricao: '', tipo: 'geral', duracao_dias: 3, ordem: prev.itens.length + 1 }
      ]
    }));
  };

  const removerItem = (chave) => {
    setForm((prev) => ({ ...prev, itens: prev.itens.filter((item) => item._chave !== chave) }));
  };

  const atualizarItem = (chave, nome, valor) => {
    setForm((prev) => ({
      ...prev,
      itens: prev.itens.map((item) => (item._chave === chave ? { ...item, [nome]: valor } : item))
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({
      ...form,
      // eslint-disable-next-line no-unused-vars
      itens: form.itens.map(({ _chave, ...item }) => item)
    });
  };

  const titulo = editando ? 'Editar Template' : 'Novo Template';

  return (
    <Modal
      titulo={titulo}
      cabecalho={
        <>
          <FaMagic className="text-purple-400" aria-hidden="true" />
          {titulo}
        </>
      }
      tamanho="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Dados básicos do template */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="template-nome" className="execucao-form-label">Nome do Template *</label>
              <input
                id="template-nome"
                type="text"
                className="execucao-form-input"
                value={form.nome}
                onChange={campo('nome')}
                placeholder="Ex: Template Elétrica Industrial"
                required
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="template-tipo-obra" className="execucao-form-label">Tipo de Obra</label>
              <input
                id="template-tipo-obra"
                type="text"
                className="execucao-form-input"
                value={form.tipo_obra}
                onChange={campo('tipo_obra')}
                placeholder="Ex: Elétrica, Civil, Galpão..."
              />
            </div>
          </div>

          <div className="execucao-form-group">
            <label htmlFor="template-descricao" className="execucao-form-label">Descrição</label>
            <textarea
              id="template-descricao"
              className="execucao-form-textarea"
              rows="2"
              value={form.descricao}
              onChange={campo('descricao')}
              placeholder="Descreva quando usar este template..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="template-icone" className="execucao-form-label">Ícone</label>
              <select id="template-icone" className="execucao-form-select" value={form.icone} onChange={campo('icone')}>
                <option value="FaTasks">📋 Tarefas</option>
                <option value="FaBolt">⚡ Elétrica</option>
                <option value="FaHardHat">👷 Civil</option>
                <option value="FaWarehouse">🏭 Galpão</option>
                <option value="FaWrench">🔧 Manutenção</option>
              </select>
            </div>
            <div className="execucao-form-group">
              <label htmlFor="template-cor" className="execucao-form-label">Cor</label>
              <input
                id="template-cor"
                type="color"
                className="execucao-form-input h-10 p-1 cursor-pointer"
                value={form.cor}
                onChange={campo('cor')}
              />
            </div>
            <div className="execucao-form-group">
              <label className="execucao-form-label flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                  className="w-4 h-4"
                />
                Template Ativo
              </label>
            </div>
          </div>

          {/* Etapas do Template */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-400">
                Etapas do Template ({form.itens.length})
              </span>
              <button
                type="button"
                onClick={adicionarItem}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
              >
                <FaPlus size={10} aria-hidden="true" />
                Adicionar Etapa
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {form.itens.map((item, index) => (
                <div
                  key={item._chave}
                  className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none"
                    value={item.nome}
                    onChange={(e) => atualizarItem(item._chave, 'nome', e.target.value)}
                    placeholder="Nome da etapa"
                    aria-label={`Nome da etapa ${index + 1}`}
                  />
                  <input
                    type="number"
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-center"
                    value={item.duracao_dias}
                    onChange={(e) => atualizarItem(item._chave, 'duracao_dias', parseInt(e.target.value, 10) || 1)}
                    min="1"
                    title="Duração em dias"
                    aria-label={`Duração em dias da etapa ${index + 1}`}
                  />
                  <span className="text-xs text-slate-500">dias</span>
                  <select
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                    value={item.tipo || 'etapa'}
                    onChange={(e) => atualizarItem(item._chave, 'tipo', e.target.value)}
                    title="Tipo"
                    aria-label={`Tipo da etapa ${index + 1}`}
                  >
                    <option value="etapa">Etapa</option>
                    <option value="marco">Marco</option>
                    <option value="fase">Fase</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removerItem(item._chave)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                    title="Remover etapa"
                    aria-label={`Remover etapa ${index + 1}`}
                  >
                    <FaTrash size={10} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {form.itens.length === 0 && (
                <div className="text-center py-4 text-slate-500 text-sm">
                  Nenhuma etapa adicionada. Clique em "Adicionar Etapa" para começar.
                </div>
              )}
            </div>
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
          <button type="submit" className="execucao-btn bg-purple-600 hover:bg-purple-700" disabled={salvando}>
            {salvando ? 'Salvando...' : (editando ? 'Salvar Alterações' : 'Criar Template')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TemplateFormModal;
