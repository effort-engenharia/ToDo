import React, { useState } from 'react';
import {
  FaChevronDown,
  FaChevronUp,
  FaCopy,
  FaEdit,
  FaList,
  FaMagic,
  FaPlus,
  FaTrash
} from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import { Carregando, ErroCarregamento } from '../ui/Estados';
import IconeTemplate from './IconeTemplate';
import ModalLargo from './ModalLargo';
import {
  UNIDADES,
  converterParaNovoFormato,
  itemPreenchido,
  listasComKey,
  listasSemKey,
  novaLista,
  novoItem,
  totalItensTemplate
} from './utils';

const FORM_VAZIO = () => ({ nome: '', listas: [novaLista()] });

export default function TemplatesMateriais({ templates, loading, error, usuario, onRecarregar }) {
  const { toast, confirmar } = useExecucaoUI();
  const [showModal, setShowModal] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [formTemplate, setFormTemplate] = useState(FORM_VAZIO);
  const [listaExpandida, setListaExpandida] = useState(null); // _key da lista aberta
  const [salvando, setSalvando] = useState(false);

  const fecharModal = () => {
    if (!salvando) setShowModal(false);
  };

  const handleNovoTemplate = () => {
    const form = FORM_VAZIO();
    setTemplateSelecionado(null);
    setFormTemplate(form);
    setListaExpandida(form.listas[0]._key);
    setShowModal(true);
  };

  const handleEditarTemplate = (template) => {
    const listas = listasComKey(converterParaNovoFormato(template));
    const listasForm = listas.length > 0 ? listas : [novaLista()];
    setTemplateSelecionado(template);
    setFormTemplate({ nome: template.nome || '', listas: listasForm });
    setListaExpandida(listasForm[0]._key);
    setShowModal(true);
  };

  const handleSalvarTemplate = async () => {
    if (salvando) return;
    if (!formTemplate.nome.trim()) {
      toast.error('Digite um nome para o template.');
      return;
    }

    const listasValidas = listasSemKey(
      formTemplate.listas
        .filter((lista) => lista.nome && lista.itens?.some(itemPreenchido))
        .map((lista) => ({ ...lista, itens: lista.itens.filter(itemPreenchido) }))
    );

    if (listasValidas.length === 0) {
      toast.error('Adicione pelo menos uma lista com itens ao template.');
      return;
    }

    const dados = {
      nome: formTemplate.nome,
      icone: 'FaBox',
      cor: '#8b5cf6',
      listas: listasValidas
    };

    setSalvando(true);
    try {
      const result = templateSelecionado
        ? await execucaoService.atualizarTemplateMaterial(templateSelecionado.id, dados)
        : await execucaoService.criarTemplateMaterial(dados, usuario?.id);

      if (!result?.success) {
        toast.error(`Erro ao salvar template: ${result?.message || 'Erro desconhecido'}`);
        return;
      }
      setShowModal(false);
      setTemplateSelecionado(null);
      toast.success('Template salvo.');
      onRecarregar();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      toast.error(err.message || 'Erro inesperado ao salvar o template.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirTemplate = async (template) => {
    const ok = await confirmar({
      titulo: 'Excluir template',
      mensagem: `Deseja realmente excluir o template "${template.nome}"?`,
      confirmarTexto: 'Excluir'
    });
    if (!ok) return;
    try {
      const result = await execucaoService.excluirTemplateMaterial(template.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível excluir o template.');
        return;
      }
      toast.success('Template excluído.');
      onRecarregar();
    } catch (err) {
      console.error('Erro ao excluir template:', err);
      toast.error(err.message || 'Erro inesperado ao excluir o template.');
    }
  };

  const handleDuplicarTemplate = async (template) => {
    try {
      const result = await execucaoService.criarTemplateMaterial({
        nome: `${template.nome} (Cópia)`,
        icone: 'FaBox',
        cor: '#8b5cf6',
        listas: converterParaNovoFormato(template)
      }, usuario?.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível duplicar o template.');
        return;
      }
      toast.success('Template duplicado.');
      onRecarregar();
    } catch (err) {
      console.error('Erro ao duplicar template:', err);
      toast.error(err.message || 'Erro inesperado ao duplicar o template.');
    }
  };

  const atualizarListas = (fn) => setFormTemplate((prev) => ({ ...prev, listas: fn(prev.listas) }));

  const handleAdicionarLista = () => {
    const lista = novaLista(`Lista ${formTemplate.listas.length + 1}`);
    atualizarListas((listas) => [...listas, lista]);
    setListaExpandida(lista._key);
  };

  const handleRemoverLista = (key) => {
    if (formTemplate.listas.length <= 1) {
      toast.error('O template deve ter pelo menos uma lista.');
      return;
    }
    atualizarListas((listas) => listas.filter((l) => l._key !== key));
    if (listaExpandida === key) setListaExpandida(null);
  };

  const handleAtualizarNomeLista = (key, nome) => {
    atualizarListas((listas) => listas.map((l) => (l._key === key ? { ...l, nome } : l)));
  };

  const handleAdicionarItemNaLista = (key) => {
    atualizarListas((listas) => listas.map((l) => (
      l._key === key ? { ...l, itens: [...l.itens, novoItem()] } : l
    )));
  };

  const handleRemoverItemDaLista = (key, itemKey) => {
    atualizarListas((listas) => listas.map((l) => (
      l._key === key ? { ...l, itens: l.itens.filter((i) => i._key !== itemKey) } : l
    )));
  };

  const handleAtualizarItemDaLista = (key, itemKey, campo, valor) => {
    atualizarListas((listas) => listas.map((l) => (
      l._key === key
        ? { ...l, itens: l.itens.map((i) => (i._key === itemKey ? { ...i, [campo]: valor } : i)) }
        : l
    )));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FaMagic className="text-purple-400" aria-hidden="true" />
            Templates de Materiais
          </h3>
          <p className="text-sm text-slate-400">
            Gerencie modelos de listas de materiais pré-definidos para agilizar os pedidos
          </p>
        </div>
        <button
          type="button"
          onClick={handleNovoTemplate}
          className="execucao-btn-primary flex items-center gap-2"
        >
          <FaPlus size={12} aria-hidden="true" />
          Novo Template
        </button>
      </div>

      {error && <ErroCarregamento mensagem={error} onTentarNovamente={onRecarregar} />}
      {loading && templates.length === 0 && <Carregando />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const listas = converterParaNovoFormato(template);
          const totalItens = totalItensTemplate(listas);

          return (
            <div
              key={template.id}
              className="p-4 rounded-xl border transition-all bg-slate-800/50 border-slate-700 hover:border-purple-500/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${template.cor || '#8b5cf6'}20`, color: template.cor || '#8b5cf6' }}
                >
                  <IconeTemplate icone={template.icone} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditarTemplate(template)}
                    className="p-1.5 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                    title="Editar template"
                    aria-label={`Editar template ${template.nome}`}
                  >
                    <FaEdit size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicarTemplate(template)}
                    className="p-1.5 rounded text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                    title="Duplicar template"
                    aria-label={`Duplicar template ${template.nome}`}
                  >
                    <FaCopy size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirTemplate(template)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Excluir template"
                    aria-label={`Excluir template ${template.nome}`}
                  >
                    <FaTrash size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <h4 className="font-semibold text-white mb-3">{template.nome}</h4>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                  {listas.length} lista{listas.length > 1 ? 's' : ''}
                </span>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  {totalItens} itens
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {listas.map((lista, listaIdx) => (
                  // Pré-visualização somente leitura derivada do template: índice estável
                  <div
                    key={`${lista.nome}-${listaIdx}`}
                    className="p-2 bg-slate-900/50 rounded border border-slate-700/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FaList className="text-purple-400" size={10} aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-200">{lista.nome}</span>
                      <span className="text-[10px] text-slate-500">({lista.itens?.length || 0} itens)</span>
                    </div>
                    <div className="pl-4 space-y-0.5">
                      {lista.itens?.slice(0, 3).map((item, idx) => (
                        <div key={`${item.nome}-${idx}`} className="text-[10px] text-slate-400 truncate">
                          • {item.nome}
                        </div>
                      ))}
                      {lista.itens?.length > 3 && (
                        <div className="text-[10px] text-slate-500">
                          +{lista.itens.length - 3} mais...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !error && templates.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FaMagic size={48} className="mx-auto mb-4 opacity-30" aria-hidden="true" />
          <p>Nenhum template cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Template" para criar o primeiro</p>
        </div>
      )}

      {showModal && (
        <ModalLargo
          onClose={fecharModal}
          style={{ maxWidth: '900px' }}
          cabecalho={
            <>
              <FaMagic className="text-purple-400" aria-hidden="true" /> {templateSelecionado ? 'Editar Template' : 'Novo Template'}
            </>
          }
        >
          <div className="execucao-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="space-y-4">
              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor="template-nome">Nome do Template *</label>
                <input
                  id="template-nome"
                  type="text"
                  className="execucao-form-input"
                  value={formTemplate.nome}
                  onChange={(e) => setFormTemplate((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Manutenção SPDA"
                />
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-purple-400 flex items-center gap-2">
                    <FaList aria-hidden="true" />
                    Listas do Template ({formTemplate.listas.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAdicionarLista}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-all"
                  >
                    <FaPlus size={10} aria-hidden="true" />
                    Nova Lista
                  </button>
                </div>

                <div className="space-y-3">
                  {formTemplate.listas.map((lista) => {
                    const expandida = listaExpandida === lista._key;
                    return (
                      <div
                        key={lista._key}
                        className={`border rounded-lg transition-all ${
                          expandida ? 'border-purple-500 bg-slate-800/70' : 'border-slate-700 bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <button
                            type="button"
                            className="text-purple-400"
                            onClick={() => setListaExpandida(expandida ? null : lista._key)}
                            aria-expanded={expandida}
                            aria-label={expandida ? 'Recolher lista' : 'Expandir lista'}
                          >
                            {expandida ? <FaChevronUp size={12} aria-hidden="true" /> : <FaChevronDown size={12} aria-hidden="true" />}
                          </button>
                          <input
                            type="text"
                            className="flex-1 bg-transparent border-none text-sm font-medium text-white focus:outline-none placeholder-slate-500"
                            value={lista.nome}
                            onChange={(e) => handleAtualizarNomeLista(lista._key, e.target.value)}
                            placeholder="Nome da lista"
                            aria-label="Nome da lista"
                          />
                          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                            {lista.itens.length} itens
                          </span>
                          {formTemplate.listas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoverLista(lista._key)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                              title="Remover lista"
                              aria-label={`Remover lista ${lista.nome}`}
                            >
                              <FaTrash size={10} aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {expandida && (
                          <div className="border-t border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-400">Itens desta lista:</span>
                              <button
                                type="button"
                                onClick={() => handleAdicionarItemNaLista(lista._key)}
                                className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                              >
                                <FaPlus size={8} aria-hidden="true" />
                                Adicionar Item
                              </button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {lista.itens.map((item, itemIndex) => (
                                <div
                                  key={item._key}
                                  className="flex items-center gap-2 p-2 bg-slate-900/50 rounded border border-slate-700/50"
                                >
                                  <span className="text-[10px] text-slate-500 w-5">{itemIndex + 1}.</span>
                                  <input
                                    type="text"
                                    className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder-slate-500"
                                    value={item.nome || ''}
                                    onChange={(e) => handleAtualizarItemDaLista(lista._key, item._key, 'nome', e.target.value)}
                                    placeholder="Nome do item"
                                    aria-label={`Nome do item ${itemIndex + 1}`}
                                  />
                                  <input
                                    type="number"
                                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-center"
                                    value={item.quantidade || 1}
                                    onChange={(e) => handleAtualizarItemDaLista(lista._key, item._key, 'quantidade', parseFloat(e.target.value) || 1)}
                                    min="0.1"
                                    step="0.1"
                                    aria-label={`Quantidade do item ${itemIndex + 1}`}
                                  />
                                  <select
                                    className="bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs"
                                    value={item.unidade || 'un'}
                                    onChange={(e) => handleAtualizarItemDaLista(lista._key, item._key, 'unidade', e.target.value)}
                                    aria-label={`Unidade do item ${itemIndex + 1}`}
                                  >
                                    {UNIDADES.map((u) => (
                                      <option key={u.valor} value={u.valor}>{u.rotulo}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoverItemDaLista(lista._key, item._key)}
                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                                    aria-label={`Remover item ${itemIndex + 1}`}
                                    title="Remover item"
                                  >
                                    <FaTrash size={10} aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                              {lista.itens.length === 0 && (
                                <div className="text-center py-3 text-slate-500 text-xs">
                                  Nenhum item. Clique em "Adicionar Item".
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="execucao-modal-footer">
            <button
              type="button"
              className="execucao-btn execucao-btn-secondary"
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="execucao-btn bg-purple-600 hover:bg-purple-700"
              onClick={handleSalvarTemplate}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : templateSelecionado ? 'Salvar Alterações' : 'Criar Template'}
            </button>
          </div>
        </ModalLargo>
      )}
    </div>
  );
}
