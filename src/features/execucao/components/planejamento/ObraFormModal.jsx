import React, { useEffect, useMemo, useState } from 'react';
import { FaBuilding, FaFilePdf, FaMagic, FaSearch, FaTimes, FaUpload } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import Modal from '../ui/Modal';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import { FORM_OBRA_VAZIO } from './constants';
import { IconeTemplate } from './icones';
import { chaveArquivo } from './utils';

const formDaObra = (obra) => ({
  nome_cliente: obra.nome_cliente || '',
  endereco: obra.endereco || '',
  cidade: obra.cidade || '',
  contrato_numero: obra.contrato_numero || '',
  data_inicio_prevista: obra.data_inicio_prevista || '',
  data_fim_prevista: obra.data_fim_prevista || '',
  tipo_obra: obra.tipo_obra || 'misto',
  prioridade: obra.prioridade || 'media',
  responsavel_id: obra.responsavel_id || '',
  observacoes: obra.observacoes || '',
  contato_cliente: obra.contato_cliente || '',
  apontamento_id: obra.apontamento_id || '',
  arquivos_pdf: []
});

// Monta cidade/endereço a partir de um apontamento (contrato/venda)
const camposDoApontamento = (apontamento) => {
  const endereco = [apontamento.logradouro, apontamento.numero, apontamento.bairro].filter(Boolean).join(', ');
  const cidade = apontamento.cidade_atendimento === 'OUTRAS'
    ? apontamento.cidade_outras
    : apontamento.cidade_atendimento || apontamento.municipio || '';

  return {
    nome_cliente: apontamento.nome_cliente || '',
    endereco,
    cidade,
    data_inicio_prevista: apontamento.cronograma_data_inicio || '',
    data_fim_prevista: apontamento.cronograma_data_termino || '',
    contato_cliente: apontamento.contato_cliente || '',
    apontamento_id: apontamento.id || ''
  };
};

const ObraFormModal = ({ obra, tecnicos, templates, salvando, onSalvar, onClose }) => {
  const { toast } = useExecucaoUI();
  const [form, setForm] = useState(() => (obra ? formDaObra(obra) : FORM_OBRA_VAZIO));
  const [apontamentos, setApontamentos] = useState([]);
  const [buscaApontamento, setBuscaApontamento] = useState('');

  const editando = Boolean(obra);
  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  // Apontamentos (clientes com contrato/venda) só são necessários para nova obra
  useEffect(() => {
    if (editando) return undefined;
    let ativo = true;
    execucaoService.buscarApontamentosParaObra()
      .then((result) => {
        if (!ativo) return;
        if (result.success) setApontamentos(result.data);
        else toast.error(`Não foi possível carregar os clientes: ${result.message || 'erro desconhecido'}`);
      })
      .catch((error) => {
        console.error('Erro ao carregar apontamentos:', error);
        if (ativo) toast.error(`Não foi possível carregar os clientes: ${error.message}`);
      });
    return () => { ativo = false; };
  }, [editando, toast]);

  const apontamentosFiltrados = useMemo(() => {
    const termo = buscaApontamento.trim().toLowerCase();
    if (!termo) return apontamentos;
    return apontamentos.filter((a) => a.nome_cliente?.toLowerCase().includes(termo));
  }, [apontamentos, buscaApontamento]);

  const templatesAtivos = useMemo(() => templates.filter((t) => t.ativo), [templates]);
  const templateEscolhido = useMemo(
    () => templates.find((t) => t.id === form.template_id),
    [templates, form.template_id]
  );

  const handleSelecionarApontamento = (id) => {
    const apontamento = apontamentos.find((a) => a.id === id);
    if (!apontamento) return;
    setForm((prev) => ({ ...prev, ...camposDoApontamento(apontamento) }));
  };

  const adicionarArquivos = (e) => {
    const novos = Array.from(e.target.files);
    e.target.value = '';
    setForm((prev) => {
      const existentes = new Set((prev.arquivos_pdf || []).map(chaveArquivo));
      return {
        ...prev,
        arquivos_pdf: [...(prev.arquivos_pdf || []), ...novos.filter((f) => !existentes.has(chaveArquivo(f)))]
      };
    });
  };

  const removerArquivo = (chave) => {
    setForm((prev) => ({
      ...prev,
      arquivos_pdf: prev.arquivos_pdf.filter((f) => chaveArquivo(f) !== chave)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(form);
  };

  return (
    <Modal
      titulo={editando ? 'Editar Obra' : 'Nova Obra'}
      cabecalho={
        <>
          <FaBuilding className="text-blue-400" aria-hidden="true" />
          {editando ? 'Editar Obra' : 'Nova Obra'}
        </>
      }
      tamanho="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Seção de busca de apontamento - só mostra para nova obra */}
          {!editando && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
              <label htmlFor="obra-busca-apontamento" className="text-sm font-medium text-sky-400 flex items-center gap-2">
                <FaSearch size={12} aria-hidden="true" />
                Buscar Cliente (Contrato/Venda)
              </label>

              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={12} aria-hidden="true" />
                <input
                  id="obra-busca-apontamento"
                  type="text"
                  className="execucao-form-input !pl-9"
                  value={buscaApontamento}
                  onChange={(e) => setBuscaApontamento(e.target.value)}
                  placeholder="Digite o nome do cliente para buscar..."
                />
              </div>

              <div className="execucao-form-group !mb-0">
                <label htmlFor="obra-apontamento" className="execucao-form-label">Ou selecione da lista</label>
                <select
                  id="obra-apontamento"
                  className="execucao-form-select"
                  value={form.apontamento_id}
                  onChange={(e) => handleSelecionarApontamento(e.target.value)}
                >
                  <option value="">Selecione um cliente...</option>
                  {apontamentosFiltrados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome_cliente} {a.cidade_atendimento ? `- ${a.cidade_atendimento}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {apontamentos.length === 0 && (
                <p className="text-xs text-slate-500">Nenhum cliente com fase CONTRATO/VENDA encontrado.</p>
              )}
            </div>
          )}

          {/* Seção de Templates - só mostra para nova obra */}
          {!editando && templates.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-sky-500/10 rounded-lg border border-purple-500/30 space-y-3">
              <p className="text-sm font-medium text-purple-400 flex items-center gap-2">
                <FaMagic size={12} aria-hidden="true" />
                Usar Template de Etapas
              </p>
              <p className="text-xs text-slate-400">
                Ao salvar a obra, as etapas do template selecionado serão criadas automaticamente.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {templatesAtivos.map((template) => {
                  const selecionado = form.template_id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selecionado}
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        template_id: prev.template_id === template.id ? '' : template.id
                      }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                        selecionado
                          ? 'bg-opacity-20 border-opacity-50'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                      style={selecionado ? {
                        backgroundColor: `${template.cor}20`,
                        borderColor: `${template.cor}80`,
                        color: template.cor
                      } : {}}
                    >
                      <IconeTemplate icone={template.icone} size={16} />
                      <span className="text-xs font-medium">{template.nome?.split(' ')[0] || 'Template'}</span>
                      <span className="text-[10px] opacity-60">{template.itens?.length || 0} etapas</span>
                    </button>
                  );
                })}
              </div>
              {templateEscolhido && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs text-slate-300">
                  <strong className="text-white">Etapas que serão criadas:</strong>
                  <ul className="mt-1 list-disc list-inside space-y-0.5">
                    {templateEscolhido.itens?.map((etapa, i) => (
                      <li key={etapa.id ?? i}>{etapa.nome} <span className="text-slate-500">({etapa.duracao_dias} dias)</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Cliente */}
          <div className="execucao-form-group">
            <label htmlFor="obra-cliente" className="execucao-form-label">Nome do Cliente *</label>
            <input
              id="obra-cliente"
              type="text"
              className="execucao-form-input"
              value={form.nome_cliente}
              onChange={campo('nome_cliente')}
              placeholder="Nome do cliente/condomínio"
              required
            />
          </div>

          <div className="execucao-form-group">
            <label htmlFor="obra-contato" className="execucao-form-label">Contato do Cliente</label>
            <input
              id="obra-contato"
              type="text"
              className="execucao-form-input"
              value={form.contato_cliente}
              onChange={campo('contato_cliente')}
              placeholder="Telefone/WhatsApp do cliente"
            />
          </div>

          {/* Endereço e Cidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="obra-endereco" className="execucao-form-label">Endereço</label>
              <input
                id="obra-endereco"
                type="text"
                className="execucao-form-input"
                value={form.endereco}
                onChange={campo('endereco')}
                placeholder="Endereço da obra"
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="obra-cidade" className="execucao-form-label">Cidade</label>
              <input
                id="obra-cidade"
                type="text"
                className="execucao-form-input"
                value={form.cidade}
                onChange={campo('cidade')}
                placeholder="Cidade"
              />
            </div>
          </div>

          {/* Datas Previstas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="obra-inicio" className="execucao-form-label">Início Previsto *</label>
              <input
                id="obra-inicio"
                type="date"
                className="execucao-form-input"
                value={form.data_inicio_prevista}
                onChange={campo('data_inicio_prevista')}
                required
              />
            </div>
            <div className="execucao-form-group">
              <label htmlFor="obra-fim" className="execucao-form-label">Término Previsto *</label>
              <input
                id="obra-fim"
                type="date"
                className="execucao-form-input"
                value={form.data_fim_prevista}
                onChange={campo('data_fim_prevista')}
                required
              />
            </div>
          </div>

          {/* Tipo, Prioridade e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="execucao-form-group">
              <label htmlFor="obra-tipo" className="execucao-form-label">Tipo de Obra</label>
              <select id="obra-tipo" className="execucao-form-select" value={form.tipo_obra} onChange={campo('tipo_obra')}>
                <option value="eletrica">Elétrica</option>
                <option value="civil">Civil</option>
                <option value="galpao">Galpão</option>
                <option value="misto">Misto</option>
              </select>
            </div>
            <div className="execucao-form-group">
              <label htmlFor="obra-prioridade" className="execucao-form-label">Prioridade</label>
              <select id="obra-prioridade" className="execucao-form-select" value={form.prioridade} onChange={campo('prioridade')}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="execucao-form-group">
              <label htmlFor="obra-responsavel" className="execucao-form-label">Responsável</label>
              <select id="obra-responsavel" className="execucao-form-select" value={form.responsavel_id} onChange={campo('responsavel_id')}>
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_completo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div className="execucao-form-group">
            <label htmlFor="obra-observacoes" className="execucao-form-label">Observações</label>
            <textarea
              id="obra-observacoes"
              className="execucao-form-textarea"
              rows="2"
              value={form.observacoes}
              onChange={campo('observacoes')}
              placeholder="Observações gerais"
            />
          </div>

          {/* Upload de Arquivos PDF */}
          <div className="execucao-form-group">
            <label className="execucao-form-label flex items-center gap-2">
              <FaFilePdf className="text-red-400" aria-hidden="true" />
              Anexar Arquivos (PDF)
            </label>
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 hover:border-sky-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                id="upload-pdf-obra"
                onChange={adicionarArquivos}
              />
              <label
                htmlFor="upload-pdf-obra"
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <FaUpload className="text-slate-400" size={24} aria-hidden="true" />
                <span className="text-sm text-slate-400">Clique para selecionar arquivos PDF</span>
              </label>
            </div>
            {form.arquivos_pdf && form.arquivos_pdf.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.arquivos_pdf.map((file) => {
                  const chave = chaveArquivo(file);
                  return (
                    <div key={chave} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2">
                      <span className="text-sm text-slate-300 flex items-center gap-2">
                        <FaFilePdf className="text-red-400" size={12} aria-hidden="true" />
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removerArquivo(chave)}
                        className="text-red-400 hover:text-red-300"
                        aria-label={`Remover arquivo ${file.name}`}
                      >
                        <FaTimes size={12} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
            {salvando ? 'Salvando...' : (editando ? 'Salvar Alterações' : 'Cadastrar Obra')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ObraFormModal;
