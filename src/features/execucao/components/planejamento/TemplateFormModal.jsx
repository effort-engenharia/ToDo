import React, { useState } from 'react';
import { FaMagic, FaPlus, FaTrash } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../hooks/useAsyncData';
import Modal from '../ui/Modal';
import { FORM_TEMPLATE_VAZIO, TIPOS_ETAPA, TIPOS_OBRA_TEMPLATE } from './constants';
import { novaChave } from './utils';
import CampoHoras from '../ui/CampoHoras';
import { formatarHoras } from '../../utils/formatos';

const TIPOS_ETAPA_VALIDOS = new Set(TIPOS_ETAPA.map((t) => t.valor));
const TIPOS_OBRA_VALIDOS = new Set(TIPOS_OBRA_TEMPLATE.map((t) => t.valor));

const formDoTemplate = (template) => {
  const base = template
    ? {
        nome: template.nome || '',
        descricao: template.descricao || '',
        tipo_obra: TIPOS_OBRA_VALIDOS.has(template.tipo_obra) ? template.tipo_obra : 'eletrica',
        tipo_servico_codigo: template.tipo_servico_codigo || '',
        icone: template.icone || 'FaBolt',
        cor: template.cor || '#eab308',
        ativo: template.ativo !== false,
        itens: template.itens || []
      }
    : FORM_TEMPLATE_VAZIO;

  // `_chave` só existe no cliente: dá identidade estável às linhas editáveis; `_pai` liga a sub-etapa à etapa pai
  const itens = base.itens.map((item) => ({
    ...item,
    tipo: TIPOS_ETAPA_VALIDOS.has(item.tipo) ? item.tipo : 'geral',
    horas_previstas: item.horas_previstas ?? '',
    qtd_tecnicos: item.qtd_tecnicos || 1,
    pop_id: item.pop_id || '',
    _chave: novaChave()
  }));
  const chavePorOrdem = new Map(itens.map((item) => [item.ordem, item._chave]));
  return {
    ...base,
    itens: itens.map((item) => ({ ...item, _pai: item.pai_ordem != null ? (chavePorOrdem.get(item.pai_ordem) ?? null) : null }))
  };
};

// Numeração "1", "1.1", "1.2", "2"... por chave da linha
const numerar = (itens) => {
  let principal = 0;
  const rotulos = new Map();
  const contagem = new Map();
  itens.forEach((item) => {
    if (!item._pai) {
      principal += 1;
      rotulos.set(item._chave, `${principal}`);
      contagem.set(item._chave, 0);
    } else {
      const n = (contagem.get(item._pai) ?? 0) + 1;
      contagem.set(item._pai, n);
      rotulos.set(item._chave, `${rotulos.get(item._pai) ?? '?'}.${n}`);
    }
  });
  return rotulos;
};

const horasDasSubs = (itens, chavePai) =>
  itens.filter((i) => i._pai === chavePai).reduce((soma, i) => soma + (Number(i.horas_previstas) || 0), 0);

const TemplateFormModal = ({ template, salvando, onSalvar, onClose }) => {
  const [form, setForm] = useState(() => formDoTemplate(template));
  const editando = Boolean(template);
  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  const { data: tiposServico } = useAsyncData(() => execucaoPlanejamentoService.listarTiposServico(), []);
  const { data: pops } = useAsyncData(() => execucaoPlanejamentoService.listarPopsAtivos(), []);
  const tiposExecucao = (tiposServico ?? []).filter((t) => t.equipe_responsavel !== 'orcamentos');
  const tipoServico = tiposExecucao.find((t) => t.codigo === form.tipo_servico_codigo) ?? null;
  const tipoServicoOriginal = (tiposServico ?? []).find((t) => t.codigo === template?.tipo_servico_codigo) ?? null;
  const eraPadrao = Boolean(template && tipoServicoOriginal && tipoServicoOriginal.template_padrao_id === template.id);
  const [padrao, setPadrao] = useState(null); // null = ainda não mexeu: segue o valor atual do banco
  const marcadoPadrao = padrao ?? (eraPadrao && form.tipo_servico_codigo === tipoServicoOriginal?.codigo);

  const handleTipoServico = (e) => {
    const codigo = e.target.value;
    const tipo = tiposExecucao.find((t) => t.codigo === codigo);
    setForm((prev) => ({
      ...prev,
      tipo_servico_codigo: codigo,
      tipo_obra: tipo && TIPOS_OBRA_VALIDOS.has(tipo.tipo_obra) ? tipo.tipo_obra : prev.tipo_obra
    }));
  };

  const adicionarItem = () => {
    setForm((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          _chave: novaChave(),
          nome: '',
          descricao: '',
          tipo: 'geral',
          duracao_dias: 3,
          horas_previstas: '',
          qtd_tecnicos: 1,
          pop_id: '',
          ordem: prev.itens.length + 1
        }
      ]
    }));
  };

  // Sub-etapa: fica logo abaixo da etapa pai (e das outras sub-etapas dela), sem duração em dias
  const adicionarSubItem = (chavePai) => {
    setForm((prev) => {
      const pai = prev.itens.find((i) => i._chave === chavePai);
      if (!pai) return prev;
      let posicao = prev.itens.findIndex((i) => i._chave === chavePai);
      prev.itens.forEach((i, idx) => { if (i._pai === chavePai) posicao = idx; });
      const nova = {
        _chave: novaChave(),
        _pai: chavePai,
        nome: '',
        descricao: '',
        tipo: pai.tipo,
        duracao_dias: 0,
        horas_previstas: '',
        qtd_tecnicos: pai.qtd_tecnicos || 1,
        pop_id: ''
      };
      return { ...prev, itens: [...prev.itens.slice(0, posicao + 1), nova, ...prev.itens.slice(posicao + 1)] };
    });
  };

  // Remover uma etapa principal remove também as sub-etapas dela
  const removerItem = (chave) => {
    setForm((prev) => ({ ...prev, itens: prev.itens.filter((item) => item._chave !== chave && item._pai !== chave) }));
  };

  const atualizarItem = (chave, nome, valor) => {
    setForm((prev) => ({
      ...prev,
      itens: prev.itens.map((item) => (item._chave === chave ? { ...item, [nome]: valor } : item))
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const itens = form.itens.map((item, indice) => {
      const { _chave, _pai, ...resto } = item;
      const temSubs = form.itens.some((i) => i._pai === _chave);
      return {
        ...resto,
        pop_id: resto.pop_id || null,
        pai_indice: _pai ? form.itens.findIndex((i) => i._chave === _pai) : null,
        // a etapa que tem sub-etapas soma as horas delas
        horas_previstas: temSubs ? horasDasSubs(form.itens, _chave) : resto.horas_previstas,
        ordem: indice + 1
      };
    });
    onSalvar({
      ...form,
      tipo_servico_codigo: form.tipo_servico_codigo || null,
      itens
    }, {
      // template padrão do tipo de serviço (usado na sugestão ao escolher o contrato)
      definirPadraoDe: form.tipo_servico_codigo && marcadoPadrao ? form.tipo_servico_codigo : null,
      limparPadraoDe: eraPadrao && tipoServicoOriginal && (!marcadoPadrao || form.tipo_servico_codigo !== tipoServicoOriginal.codigo)
        ? tipoServicoOriginal.codigo
        : null
    });
  };

  const rotulos = numerar(form.itens);
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
              <select
                id="template-tipo-obra"
                className="execucao-form-select"
                value={form.tipo_obra}
                onChange={campo('tipo_obra')}
              >
                {TIPOS_OBRA_TEMPLATE.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
          </div>

          {tiposExecucao.length > 0 && (
            <div className="execucao-form-group">
              <label htmlFor="template-tipo-servico" className="execucao-form-label">Tipo de serviço (Comercial)</label>
              <select
                id="template-tipo-servico"
                className="execucao-form-select"
                value={form.tipo_servico_codigo}
                onChange={handleTipoServico}
              >
                <option value="">Nenhum</option>
                {tiposExecucao.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
              </select>
              {tipoServico && (
                <label className="flex items-center gap-2 mt-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={marcadoPadrao}
                    onChange={(e) => setPadrao(e.target.checked)}
                  />
                  Usar como template padrão de {tipoServico.nome} (sugerido ao escolher o contrato)
                </label>
              )}
            </div>
          )}

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
                Etapas do Template ({form.itens.filter((i) => !i._pai).length}{form.itens.some((i) => i._pai) ? ` · ${form.itens.filter((i) => i._pai).length} sub-etapas` : ''})
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

            <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-2 custom-scrollbar">
              {form.itens.map((item) => {
                const rotulo = rotulos.get(item._chave);
                const ehSub = Boolean(item._pai);
                const temSubs = !ehSub && form.itens.some((i) => i._pai === item._chave);
                return (
                  <div
                    key={item._chave}
                    className={`p-2 rounded-lg border ${ehSub ? 'ml-8 bg-slate-800/30 border-slate-700/70 border-l-2 border-l-purple-500/60' : 'bg-slate-800/50 border-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-8 shrink-0">{rotulo}.</span>
                      <input
                        type="text"
                        className="flex-1 min-w-0 bg-transparent border-none text-sm text-white focus:outline-none"
                        value={item.nome}
                        onChange={(e) => atualizarItem(item._chave, 'nome', e.target.value)}
                        placeholder={ehSub ? 'Nome da sub-etapa' : 'Nome da etapa'}
                        aria-label={`Nome da ${ehSub ? 'sub-etapa' : 'etapa'} ${rotulo}`}
                        required
                      />
                      {!ehSub && (
                        <button
                          type="button"
                          onClick={() => adicionarSubItem(item._chave)}
                          className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all shrink-0"
                          title="Adicionar sub-etapa (parte da etapa, em horas)"
                          aria-label={`Adicionar sub-etapa à etapa ${rotulo}`}
                        >
                          <FaPlus size={8} aria-hidden="true" /> Sub-etapa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removerItem(item._chave)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
                        title={ehSub ? 'Remover sub-etapa' : 'Remover etapa'}
                        aria-label={`Remover ${ehSub ? 'sub-etapa' : 'etapa'} ${rotulo}`}
                      >
                        <FaTrash size={10} aria-hidden="true" />
                      </button>
                    </div>
                    <div className={`grid grid-cols-2 gap-2 mt-2 pl-8 ${ehSub ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
                      {!ehSub && (
                        <label className="text-[10px] text-slate-400">
                          Duração (dias úteis)
                          <input
                            type="number"
                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                            value={item.duracao_dias}
                            onChange={(e) => atualizarItem(item._chave, 'duracao_dias', parseInt(e.target.value, 10) || 1)}
                            min="1"
                          />
                        </label>
                      )}
                      <label className="text-[10px] text-slate-400">
                        Tipo (define a agenda)
                        <select
                          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                          value={item.tipo}
                          onChange={(e) => atualizarItem(item._chave, 'tipo', e.target.value)}
                        >
                          {TIPOS_ETAPA.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-400">
                        {temSubs ? 'Horas (soma das sub-etapas)' : 'Horas previstas'}
                        {temSubs ? (
                          <div className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 h-[26px] flex items-center">
                            {formatarHoras(horasDasSubs(form.itens, item._chave))}
                          </div>
                        ) : (
                          <CampoHoras
                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                            value={item.horas_previstas}
                            onChange={(valor) => atualizarItem(item._chave, 'horas_previstas', valor)}
                            placeholder="HH:MM"
                            aria-label="Horas previstas (HH:MM)"
                          />
                        )}
                      </label>
                      <label className="text-[10px] text-slate-400">
                        Nº de técnicos
                        <input
                          type="number"
                          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                          value={item.qtd_tecnicos}
                          onChange={(e) => atualizarItem(item._chave, 'qtd_tecnicos', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          min="1"
                        />
                      </label>
                      <label className={`text-[10px] text-slate-400 ${ehSub ? '' : 'col-span-2 md:col-span-1'}`}>
                        POP
                        <select
                          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                          value={item.pop_id}
                          onChange={(e) => atualizarItem(item._chave, 'pop_id', e.target.value)}
                        >
                          <option value="">Nenhum</option>
                          {(pops ?? []).map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                        </select>
                      </label>
                    </div>
                    {ehSub && (
                      <p className="text-[10px] text-slate-500 mt-1 pl-8">Dentro da etapa pai: sem duração em dias, o tempo é controlado pelas horas.</p>
                    )}
                    {item.tipo === 'estoque' && (
                      <p className="text-[10px] text-blue-300 mt-1 pl-8">📦 Etapa de material: gera o pedido de material automaticamente.</p>
                    )}
                  </div>
                );
              })}
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
