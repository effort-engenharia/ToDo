import React, { useId, useMemo, useRef, useState } from 'react';
import { FaBox, FaCheck, FaList, FaMagic, FaPlus, FaSave, FaTrash } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dataLocalISO, formatarDataBR } from '../../utils/datas';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import CampoQuantidade from './CampoQuantidade';
import IconeTemplate from './IconeTemplate';
import ModalLargo from './ModalLargo';
import { STATUS_ITENS_TRAVADOS } from '../compras/statusCompra';
import {
  UNIDADES,
  atualizarCampoItem,
  converterParaNovoFormato,
  itemPreenchido,
  itensComKey,
  itensSemKey,
  marcarItensInvalidos,
  novoItem
} from './utils';

const mensagemErro = (result, padrao) => result?.message || padrao;

const STATUS_OBRA_ENCERRADA = ['concluida', 'cancelada'];

// Etapa "Chegada dos Materiais" no cronograma da obra; lança erro se não for criada
const criarEtapaChegadaMateriais = async (pedido, dataDisponivel) => {
  const hoje = dataLocalISO();

  const result = await execucaoService.criarEtapa({
    obra_id: pedido.obra_id,
    nome: '📦 Chegada dos Materiais',
    descricao: `Materiais solicitados: ${pedido.descricao || 'Lista de materiais'}\n\n🏢 Cliente: ${pedido.cliente_nome || 'N/A'}\n📍 Endereço: ${pedido.endereco_obra || 'N/A'}\n\n📋 Lista concluída em: ${formatarDataBR(hoje)}\n📅 Data limite disponibilidade: ${formatarDataBR(dataDisponivel)}\n\n⚠️ Verificar se todos os itens foram entregues/separados.`,
    tipo: 'estoque',
    data_inicio: hoje,
    data_fim: dataDisponivel,
    status: 'pendente',
    progresso: 0
  });

  if (!result?.success) {
    throw new Error(mensagemErro(result, 'Não foi possível criar a etapa "Chegada dos Materiais".'));
  }
};

export default function FormularioPedido({
  pedido,
  valoresIniciais,
  dataDefinidaPeloAlerta,
  templates,
  usuario,
  onClose,
  onSalvo,
  onRecarregar,
  onTemplatesAlterados,
  // Questionamentos abertos do pedido (F17): faixa no topo e itens marcados
  questionamentosAbertos = [],
  onVerConversa
}) {
  const { toast } = useExecucaoUI();
  const idBase = useId();

  const [formData, setFormData] = useState(valoresIniciais);
  const [salvando, setSalvando] = useState(false);
  const [templateParaAplicar, setTemplateParaAplicar] = useState(null);
  const [listasSelecionadas, setListasSelecionadas] = useState([]);
  const [salvarTemplate, setSalvarTemplate] = useState(null); // { nome, nomeLista, salvando }

  // Passos já persistidos: uma nova tentativa após falha parcial não duplica registros
  const persistido = useRef({});

  const fechar = () => {
    if (!salvando) onClose();
  };

  const atualizarCampo = (campo, valor) => setFormData((prev) => ({ ...prev, [campo]: valor }));

  const pedidoDeObra = Boolean(pedido?.obra_id);
  // Depois de "comprado" o banco recusa mudar os itens (Anexo F.2-7): o formulário os mostra só para leitura
  const itensTravados = STATUS_ITENS_TRAVADOS.includes(pedido?.status_compra);

  // Sugestões de cliente: obras em andamento/planejadas. Só para pedido avulso; falha não impede o uso.
  const { data: obras } = useAsyncData(
    () => (pedidoDeObra ? Promise.resolve({ success: true, data: [] }) : execucaoService.buscarClientesDeObras()),
    [pedidoDeObra]
  );
  const sugestoesCliente = useMemo(() => {
    const nomes = (obras ?? [])
      .filter((o) => o.nome_cliente && !STATUS_OBRA_ENCERRADA.includes(o.status))
      .map((o) => o.nome_cliente.trim());
    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [obras]);

  const adicionarItem = () => {
    setFormData((prev) => ({ ...prev, itens: [...prev.itens, novoItem()] }));
  };

  const removerItem = (key) => {
    setFormData((prev) => ({ ...prev, itens: prev.itens.filter((i) => i._key !== key) }));
  };

  const atualizarItem = (key, campo, valor) => {
    setFormData((prev) => ({
      ...prev,
      itens: prev.itens.map((item) => (item._key === key ? atualizarCampoItem(item, campo, valor) : item))
    }));
  };

  // Marca erro nos itens preenchidos com quantidade vazia/≤0 e leva o foco ao primeiro; true se tudo ok
  const validarQuantidades = () => {
    const { itens, primeiraKey } = marcarItensInvalidos(formData.itens);
    if (!primeiraKey) return true;
    setFormData((prev) => ({ ...prev, itens }));
    toast.error('Informe a quantidade (maior que zero) dos itens destacados.');
    requestAnimationFrame(() => document.getElementById(`${idBase}-qtd-${primeiraKey}`)?.focus());
    return false;
  };

  const limparSelecaoTemplate = () => {
    setTemplateParaAplicar(null);
    setListasSelecionadas([]);
  };

  const toggleListaSelecionada = (index) => {
    setListasSelecionadas((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const aplicarListasSelecionadas = () => {
    if (!templateParaAplicar || listasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma lista para aplicar.');
      return;
    }

    const listas = converterParaNovoFormato(templateParaAplicar);
    const novosItens = listasSelecionadas.flatMap((idx) => listas[idx]?.itens ?? []);

    setFormData((prev) => {
      const todos = [...prev.itens.filter(itemPreenchido), ...itensComKey(novosItens)];
      return { ...prev, itens: todos.length > 0 ? todos : [novoItem()] };
    });
    limparSelecaoTemplate();
  };

  const handleSalvarComoTemplate = async () => {
    const itensValidos = formData.itens.filter(itemPreenchido);
    const nome = salvarTemplate?.nome.trim();
    if (!nome) {
      toast.error('Informe o nome do template.');
      return;
    }
    if (itensValidos.length === 0) {
      toast.error('Adicione pelo menos um item antes de salvar como template.');
      return;
    }
    if (!validarQuantidades()) return;

    setSalvarTemplate((prev) => ({ ...prev, salvando: true }));
    try {
      const result = await execucaoService.criarTemplateMaterial({
        nome,
        icone: 'FaBox',
        cor: '#8b5cf6',
        listas: [{ nome: salvarTemplate.nomeLista.trim() || 'Lista Principal', itens: itensSemKey(itensValidos) }]
      }, usuario?.id);

      if (!result?.success) {
        toast.error(mensagemErro(result, 'Erro ao salvar template.'));
        setSalvarTemplate((prev) => ({ ...prev, salvando: false }));
        return;
      }
      toast.success('Template salvo com sucesso!');
      setSalvarTemplate(null);
      onTemplatesAlterados();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error(error.message || 'Erro ao salvar template.');
      setSalvarTemplate((prev) => ({ ...prev, salvando: false }));
    }
  };

  const salvarPedido = async () => {
    const itens = itensSemKey(formData.itens.filter(itemPreenchido));
    const dados = {
      descricao: formData.descricao,
      urgencia: formData.urgencia,
      itens,
      observacoes: formData.observacoes,
      data_material_disponivel: formData.data_material_disponivel || null
    };
    // Pedido de obra: cliente vem da obra (somente leitura), não é regravado
    if (!pedidoDeObra) dados.cliente_nome = formData.cliente_nome.trim();
    const feito = persistido.current;
    const dadosNovos = { ...dados, data_material_disponivel: dados.data_material_disponivel ?? '' };

    if (pedido) {
      const dadosAnteriores = {
        descricao: pedido.descricao,
        urgencia: pedido.urgencia,
        itens: pedido.itens,
        observacoes: pedido.observacoes,
        data_material_disponivel: pedido.data_material_disponivel
      };
      if (!pedidoDeObra) dadosAnteriores.cliente_nome = pedido.cliente_nome ?? '';

      if (!feito.pedido) {
        const result = await execucaoService.atualizarPedidoMaterial(pedido.id, dados);
        if (!result?.success) throw new Error(mensagemErro(result, 'Não foi possível atualizar o pedido.'));
        feito.pedido = true;
      }

      if (!feito.historico) {
        const result = await execucaoService.registrarHistoricoPedido(pedido.id, {
          tipo_alteracao: 'edicao',
          descricao: 'Pedido editado',
          dados_anteriores: dadosAnteriores,
          dados_novos: dadosNovos,
          data_limite_anterior: pedido.data_material_disponivel,
          data_limite_nova: dados.data_material_disponivel
        }, usuario);
        if (!result?.success) throw new Error(mensagemErro(result, 'Pedido salvo, mas o histórico não foi registrado.'));
        feito.historico = true;
      }

      if (dados.data_material_disponivel && pedido.obra_id && !pedido.etapa_chegada_criada && !feito.etapaChegada) {
        await criarEtapaChegadaMateriais(pedido, dados.data_material_disponivel);
        feito.etapaChegada = true;
        toast.success('Etapa "Chegada dos Materiais" criada automaticamente no cronograma da obra!');
      }
      if (feito.etapaChegada && !feito.etapaChegadaMarcada) {
        const result = await execucaoService.atualizarPedidoMaterial(pedido.id, { etapa_chegada_criada: true });
        if (!result?.success) throw new Error(mensagemErro(result, 'Etapa criada, mas o pedido não foi marcado como processado.'));
        feito.etapaChegadaMarcada = true;
      }

      // Pedido com itens preenchidos vinculado a uma etapa: conclui a etapa de estoque
      if (itens.length > 0 && pedido.etapa_id && !feito.etapaEstoque) {
        const result = await execucaoService.atualizarEtapa(pedido.etapa_id, {
          progresso: 100,
          status: 'concluida'
        });
        if (!result?.success) throw new Error(mensagemErro(result, 'Pedido salvo, mas a etapa de estoque não foi atualizada.'));
        feito.etapaEstoque = true;
      }
    } else if (!feito.criacao) {
      const result = await execucaoService.criarPedidoMaterial(dados, usuario.id);
      if (!result?.success || !result.data) throw new Error(mensagemErro(result, 'Não foi possível criar o pedido.'));
      feito.pedido = true;
      feito.criacao = result.data.id;
    }

    if (!pedido && !feito.historico) {
      const result = await execucaoService.registrarHistoricoPedido(feito.criacao, {
        tipo_alteracao: 'criacao',
        descricao: 'Pedido de material criado',
        dados_novos: dadosNovos
      }, usuario);
      if (!result?.success) throw new Error(mensagemErro(result, 'Pedido criado, mas o histórico não foi registrado.'));
      feito.historico = true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (!usuario?.id) {
      toast.error('Usuário não identificado. Faça login novamente.');
      return;
    }
    // Cliente obrigatório no pedido avulso novo (⛳ N1-c)
    if (!pedido && !formData.cliente_nome.trim()) {
      toast.error('Informe o cliente do pedido.');
      document.getElementById(`${idBase}-cliente`)?.focus();
      return;
    }
    if (!validarQuantidades()) return;

    setSalvando(true);
    try {
      await salvarPedido();
      toast.success(pedido ? 'Pedido atualizado.' : 'Pedido criado.');
      onSalvo();
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      toast.error(`${error.message || 'Erro inesperado ao salvar o pedido.'} Você pode tentar novamente.`);
      // O pedido pode já ter sido gravado: mantém a lista atualizada sem fechar o modal
      if (persistido.current.pedido) onRecarregar();
    } finally {
      setSalvando(false);
    }
  };

  const textareaObservacoes = (el) => {
    if (el && formData.observacoes) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  return (
    <ModalLargo
      onClose={fechar}
      cabecalho={
        <>
          <FaBox className="text-blue-400" aria-hidden="true" /> {pedido ? 'Editar Pedido' : 'Novo Pedido de Material'}
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="execucao-modal-body">
          {questionamentosAbertos.length > 0 && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-sm text-purple-200"
              role="status"
            >
              <span>
                ❓ Há {questionamentosAbertos.length} {questionamentosAbertos.length === 1 ? 'questionamento aguardando' : 'questionamentos aguardando'} sua resposta
              </span>
              {onVerConversa && (
                <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm min-h-[44px]" onClick={onVerConversa}>
                  Ver conversa
                </button>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor={`${idBase}-descricao`}>Descrição</label>
                <input
                  id={`${idBase}-descricao`}
                  type="text"
                  className="execucao-form-input"
                  placeholder="Descrição do pedido"
                  value={formData.descricao}
                  onChange={(e) => atualizarCampo('descricao', e.target.value)}
                  required
                />
              </div>

              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor={`${idBase}-urgencia`}>Urgência</label>
                <select
                  id={`${idBase}-urgencia`}
                  className="execucao-form-select"
                  value={formData.urgencia}
                  onChange={(e) => atualizarCampo('urgencia', e.target.value)}
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            <div className="execucao-form-group">
              <label className="execucao-form-label" htmlFor={`${idBase}-cliente`}>
                Cliente {!pedido && <span className="text-red-400">*</span>}
              </label>
              {pedidoDeObra ? (
                <input
                  id={`${idBase}-cliente`}
                  type="text"
                  className="execucao-form-input opacity-60 cursor-not-allowed"
                  value={pedido.cliente_nome || ''}
                  readOnly
                  aria-readonly="true"
                />
              ) : (
                <>
                  <input
                    id={`${idBase}-cliente`}
                    type="text"
                    className="execucao-form-input"
                    placeholder="Nome do cliente"
                    list={`${idBase}-clientes`}
                    autoComplete="off"
                    value={formData.cliente_nome}
                    onChange={(e) => atualizarCampo('cliente_nome', e.target.value)}
                    required={!pedido}
                  />
                  <datalist id={`${idBase}-clientes`}>
                    {sugestoesCliente.map((nome) => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                </>
              )}
            </div>

            <fieldset disabled={itensTravados} className="execucao-form-group border-0 p-0 m-0 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="execucao-form-label">Itens</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSalvarTemplate((prev) => (prev ? null : { nome: '', nomeLista: 'Lista Principal', salvando: false }))}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Salvar lista como template"
                    aria-expanded={Boolean(salvarTemplate)}
                  >
                    <FaSave size={10} aria-hidden="true" /> Salvar Template
                  </button>
                  <button
                    type="button"
                    onClick={adicionarItem}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                  >
                    <FaPlus size={10} aria-hidden="true" /> Adicionar
                  </button>
                </div>
              </div>

              {itensTravados && (
                <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="status">
                  🔒 Este pedido já foi comprado: os itens não podem mais ser alterados. Os demais campos continuam editáveis.
                </p>
              )}

              {salvarTemplate && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      className="execucao-form-input"
                      placeholder="Nome do template"
                      aria-label="Nome do template"
                      value={salvarTemplate.nome}
                      onChange={(e) => setSalvarTemplate((prev) => ({ ...prev, nome: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSalvarComoTemplate(); } }}
                    />
                    <input
                      type="text"
                      className="execucao-form-input"
                      placeholder="Nome da lista dentro do template"
                      aria-label="Nome da lista dentro do template"
                      value={salvarTemplate.nomeLista}
                      onChange={(e) => setSalvarTemplate((prev) => ({ ...prev, nomeLista: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSalvarComoTemplate(); } }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                      onClick={() => setSalvarTemplate(null)}
                      disabled={salvarTemplate.salvando}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="execucao-btn execucao-btn-primary execucao-btn-sm"
                      onClick={handleSalvarComoTemplate}
                      disabled={salvarTemplate.salvando}
                    >
                      {salvarTemplate.salvando ? 'Salvando...' : 'Salvar template'}
                    </button>
                  </div>
                </div>
              )}

              {templates.length > 0 && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FaMagic className="text-purple-400" aria-hidden="true" />
                      <span className="text-sm text-slate-300 font-medium">Carregar de Template</span>
                    </div>
                    {templateParaAplicar && (
                      <button
                        type="button"
                        onClick={limparSelecaoTemplate}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        Limpar seleção
                      </button>
                    )}
                  </div>

                  {!templateParaAplicar ? (
                    <div className="flex flex-wrap gap-2">
                      {templates.map((template) => {
                        const listas = converterParaNovoFormato(template);
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => { setTemplateParaAplicar(template); setListasSelecionadas([]); }}
                            className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/40 rounded-lg text-sm text-purple-300 transition-all flex items-center gap-2"
                          >
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center text-xs"
                              style={{ backgroundColor: `${template.cor || '#8b5cf6'}30`, color: template.cor || '#8b5cf6' }}
                            >
                              <IconeTemplate icone={template.icone} size={12} />
                            </div>
                            <span>{template.nome}</span>
                            <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">
                              {listas.length} lista{listas.length > 1 ? 's' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-purple-300">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${templateParaAplicar.cor || '#8b5cf6'}30`, color: templateParaAplicar.cor || '#8b5cf6' }}
                        >
                          <IconeTemplate icone={templateParaAplicar.icone} />
                        </div>
                        <span className="font-medium">{templateParaAplicar.nome}</span>
                        <span className="text-xs text-slate-400">- Selecione as listas:</span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {converterParaNovoFormato(templateParaAplicar).map((lista, idx) => {
                          const marcada = listasSelecionadas.includes(idx);
                          return (
                            // Lista do template é somente leitura aqui: índice estável
                            <button
                              key={`${lista.nome}-${idx}`}
                              type="button"
                              role="checkbox"
                              aria-checked={marcada}
                              className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
                                marcada
                                  ? 'bg-purple-500/20 border-purple-500'
                                  : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                              }`}
                              onClick={() => toggleListaSelecionada(idx)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  marcada ? 'bg-purple-500 border-purple-500' : 'border-slate-500'
                                }`}>
                                  {marcada && <FaCheck size={10} className="text-white" aria-hidden="true" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FaList className="text-purple-400 flex-shrink-0" size={10} aria-hidden="true" />
                                    <span className="text-sm font-medium text-slate-200 break-words">{lista.nome}</span>
                                    <span className="text-xs text-slate-500 flex-shrink-0">({lista.itens?.length || 0} itens)</span>
                                  </div>
                                  {lista.itens?.length > 0 && (
                                    <div className="mt-1 text-xs text-slate-400 break-words line-clamp-2">
                                      {lista.itens.slice(0, 3).map((i) => i.nome).join(', ')}
                                      {lista.itens.length > 3 && '...'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                        <span className="text-xs text-slate-400">
                          {listasSelecionadas.length} lista{listasSelecionadas.length !== 1 ? 's' : ''} selecionada{listasSelecionadas.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={aplicarListasSelecionadas}
                          disabled={listasSelecionadas.length === 0}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            listasSelecionadas.length > 0
                              ? 'bg-purple-500 hover:bg-purple-600 text-white'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Aplicar Listas Selecionadas
                        </button>
                      </div>
                    </div>
                  )}

                  {!templateParaAplicar && (
                    <p className="text-xs text-slate-500 mt-2">
                      Clique em um template para selecionar quais listas adicionar
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 mb-1" aria-hidden="true">
                <span className="col-span-5">Nome do Item</span>
                <span className="col-span-4 text-center">Qtd</span>
                <span className="col-span-2">Unidade</span>
                <span className="col-span-1"></span>
              </div>

              <div className="space-y-2">
                {formData.itens.map((item, index) => {
                  const questionado = Boolean(item.id) && questionamentosAbertos.some((q) => q.item_id === item.id);
                  return (
                  <div
                    key={item._key}
                    className={questionado ? 'border-l-4 border-purple-400 bg-purple-500/10 pl-2 rounded-r' : undefined}
                  >
                    {questionado && (
                      <p className="text-xs font-semibold text-purple-300 mb-1">
                        ❓ Questionado<span className="sr-only"> — há um questionamento aberto neste item</span>
                      </p>
                    )}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        className="execucao-form-input col-span-5"
                        placeholder="Nome do item"
                        aria-label={`Nome do item ${index + 1}`}
                        value={item.nome || ''}
                        onChange={(e) => atualizarItem(item._key, 'nome', e.target.value)}
                      />
                      <CampoQuantidade
                        className="col-span-4"
                        id={`${idBase}-qtd-${item._key}`}
                        ariaLabel={`Quantidade do item ${index + 1}`}
                        value={item.quantidade ?? null}
                        unidade={item.unidade || 'un'}
                        invalido={Boolean(item._erro)}
                        descricaoId={item._erro ? `${idBase}-erro-${item._key}` : undefined}
                        onChange={(q) => atualizarItem(item._key, 'quantidade', q)}
                      />
                      <select
                        className="execucao-form-select col-span-2"
                        aria-label={`Unidade do item ${index + 1}`}
                        value={item.unidade || 'un'}
                        onChange={(e) => atualizarItem(item._key, 'unidade', e.target.value)}
                      >
                        {UNIDADES.map((u) => (
                          <option key={u.valor} value={u.valor}>{u.rotulo}</option>
                        ))}
                      </select>
                      <div className="col-span-1 flex justify-center">
                        {formData.itens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerItem(item._key)}
                            className="execucao-btn execucao-btn-danger execucao-btn-sm"
                            aria-label={`Remover item ${index + 1}`}
                            title="Remover item"
                          >
                            <FaTrash size={10} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item._erro && (
                      <p id={`${idBase}-erro-${item._key}`} className="text-xs text-red-400 mt-1" role="alert">
                        {item._erro}
                      </p>
                    )}
                    {item._aviso && !item._erro && (
                      <p className="text-xs text-amber-400/90 mt-1" role="status">{item._aviso}</p>
                    )}
                  </div>
                  );
                })}
              </div>
            </fieldset>

            <div className="execucao-form-group">
              <label className="execucao-form-label" htmlFor={`${idBase}-observacoes`}>Observações</label>
              <textarea
                id={`${idBase}-observacoes`}
                className="execucao-form-textarea"
                rows="3"
                style={{ resize: 'vertical', minHeight: '80px', overflow: 'hidden' }}
                placeholder="Observações adicionais..."
                value={formData.observacoes}
                onChange={(e) => atualizarCampo('observacoes', e.target.value)}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                ref={textareaObservacoes}
              ></textarea>
            </div>

            {/* Data limite: só ao editar pedido vinculado a obra */}
            {pedido?.obra_id && (
              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor={`${idBase}-data-limite`}>
                  📦 Data Limite para Materiais Disponíveis <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  {dataDefinidaPeloAlerta
                    ? 'Data definida durante a confirmação de edição. Não pode ser alterada.'
                    : 'Defina até quando os materiais devem estar disponíveis. Uma etapa "Chegada dos Materiais" será criada automaticamente no cronograma da obra.'}
                </p>
                <input
                  id={`${idBase}-data-limite`}
                  type="date"
                  className={`execucao-form-input ${dataDefinidaPeloAlerta ? 'opacity-60 cursor-not-allowed' : ''}`}
                  value={formData.data_material_disponivel}
                  onChange={(e) => atualizarCampo('data_material_disponivel', e.target.value)}
                  required
                  disabled={dataDefinidaPeloAlerta}
                />
                {pedido.cliente_nome && (
                  <p className="text-xs text-slate-500 mt-1">
                    Cliente: {pedido.cliente_nome}
                  </p>
                )}
                {pedido.endereco_obra && (
                  <p className="text-xs text-slate-500">
                    Obra: {pedido.endereco_obra}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="execucao-modal-footer">
          <button
            type="button"
            className="execucao-btn execucao-btn-secondary"
            onClick={fechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : pedido ? 'Salvar Alterações' : 'Criar Pedido'}
          </button>
        </div>
      </form>
    </ModalLargo>
  );
}
