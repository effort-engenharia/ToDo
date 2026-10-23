import React from 'react';
import { FaCopy, FaEdit, FaMagic, FaPlus, FaTrash } from 'react-icons/fa';
import { IconeTemplate } from './icones';

const TemplateCard = React.memo(({ template, onEditar, onDuplicar, onExcluir }) => (
  <div
    className={`p-4 rounded-xl border transition-all ${
      template.ativo
        ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
        : 'bg-slate-900/50 border-slate-800 opacity-60'
    }`}
  >
    <div className="flex items-start justify-between mb-3">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${template.cor}20`, color: template.cor }}
      >
        <IconeTemplate icone={template.icone} size={24} />
      </div>
      <div className="flex items-center gap-1">
        {!template.ativo && (
          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
            Inativo
          </span>
        )}
        <button
          type="button"
          onClick={() => onEditar(template)}
          className="p-1.5 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
          title="Editar template"
          aria-label={`Editar template ${template.nome}`}
        >
          <FaEdit size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicar(template)}
          className="p-1.5 rounded text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
          title="Duplicar template"
          aria-label={`Duplicar template ${template.nome}`}
        >
          <FaCopy size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onExcluir(template.id)}
          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Excluir template"
          aria-label={`Excluir template ${template.nome}`}
        >
          <FaTrash size={12} aria-hidden="true" />
        </button>
      </div>
    </div>

    <h4 className="font-semibold text-white mb-1">{template.nome}</h4>
    {template.descricao && (
      <p className="text-xs text-slate-400 mb-3">{template.descricao}</p>
    )}

    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
        {template.tipo_obra || 'Geral'}
      </span>
      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
        {template.itens?.length || 0} etapas
      </span>
    </div>

    {/* Lista de etapas do template */}
    <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
      {template.itens?.slice(0, 5).map((etapa, idx) => (
        <div
          key={etapa.id ?? idx}
          className="flex items-center justify-between text-xs p-1.5 bg-slate-900/50 rounded"
        >
          <span className="text-slate-300 truncate">{idx + 1}. {etapa.nome}</span>
          <span className="text-slate-500 shrink-0 ml-2">{etapa.duracao_dias}d</span>
        </div>
      ))}
      {template.itens?.length > 5 && (
        <div className="text-center text-[10px] text-slate-500 py-1">
          +{template.itens.length - 5} mais etapas...
        </div>
      )}
    </div>
  </div>
));
TemplateCard.displayName = 'TemplateCard';

const TemplatesTab = ({ templates, onNovo, onEditar, onDuplicar, onExcluir }) => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FaMagic className="text-purple-400" aria-hidden="true" />
          Templates de Etapas
        </h3>
        <p className="text-sm text-slate-400">
          Gerencie modelos de etapas pré-definidos para usar ao criar novas obras
        </p>
      </div>
      <button
        type="button"
        onClick={onNovo}
        className="execucao-btn-primary flex items-center gap-2"
      >
        <FaPlus size={12} aria-hidden="true" />
        Novo Template
      </button>
    </div>

    {/* Lista de Templates */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onEditar={onEditar}
          onDuplicar={onDuplicar}
          onExcluir={onExcluir}
        />
      ))}
    </div>

    {templates.length === 0 && (
      <div className="text-center py-12 text-slate-400">
        <FaMagic size={48} className="mx-auto mb-4 opacity-30" aria-hidden="true" />
        <p>Nenhum template cadastrado</p>
        <p className="text-sm mt-1">Clique em "Novo Template" para criar o primeiro</p>
      </div>
    )}
  </div>
);

export default TemplatesTab;
