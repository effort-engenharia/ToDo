import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBolt, FaBuilding, FaFilePdf, FaMagic, FaTimes, FaUpload } from 'react-icons/fa';
import Modal from '../ui/Modal';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import { FORM_OBRA_VAZIO, tipoObraDoTemplate } from './constants';
import { IconeTemplate } from './icones';
import { chaveArquivo } from './utils';
import PreviaEtapas from './cadastro/PreviaEtapas';
import SeletorContrato from './cadastro/SeletorContrato';
import {
  camposDoContrato,
  etapasParaPayload,
  gerarEtapasPrevia,
  recalcularDatasPrevia,
  resolverCidade,
  statusObraAndamento,
  sugerirTemplate,
  validarEtapasPrevia
} from './cadastro/cadastroUtils';
import { useDadosCadastro } from './cadastro/useDadosCadastro';

const formDaObra = (obra) => ({
  nome_cliente: obra.nome_cliente || '',
  endereco: obra.endereco || '',
  cidade: obra.cidade || '',
  cidade_id: obra.cidade_id || '',
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

const ObraFormModal = ({
  obra,
  tecnicos,
  templates,
  salvando,
  usuarioId,
  contratoInicial = null,
  onSalvar,
  onClose,
  onUsarServicoRapido,
  onContratosAlterados
}) => {
  const { toast } = useExecucaoUI();
  const editando = Boolean(obra);
  const dados = useDadosCadastro();
  const { tiposExecucao, cidades, calendarioDe, carregando: carregandoDados } = dados;

  const [form, setForm] = useState(() => {
    if (obra) return formDaObra(obra);
    return contratoInicial ? { ...FORM_OBRA_VAZIO, ...camposDoContrato(contratoInicial) } : FORM_OBRA_VAZIO;
  });
  const [contrato, setContrato] = useState(editando ? null : contratoInicial);
  const [edicaoPrevia, setEdicaoPrevia] = useState(null); // null = prévia automática (segue template/datas); array = editada à mão
  const [andamento, setAndamento] = useState(false);
  const [criarAtividades, setCriarAtividades] = useState(true);
  const sugestaoAplicada = useRef(null);

  const campo = (nome) => (e) => setForm((prev) => ({ ...prev, [nome]: e.target.value }));

  const templatesAtivos = useMemo(() => templates.filter((t) => t.ativo), [templates]);
  const templateEscolhido = useMemo(
    () => templates.find((t) => t.id === form.template_id),
    [templates, form.template_id]
  );
  const tipoServico = useMemo(
    () => tiposExecucao.find((t) => t.codigo === form.tipo_servico_codigo) ?? null,
    [tiposExecucao, form.tipo_servico_codigo]
  );

  // Cidade da obra (para feriados municipais): a do contrato ou a que casa com o texto digitado
  const cidadeIdEfetivo = resolverCidade(form.cidade, cidades)?.id || (cidades.length ? '' : form.cidade_id);
  const calendario = useMemo(() => calendarioDe(cidadeIdEfetivo), [calendarioDe, cidadeIdEfetivo]);

  const etapasAutomaticas = useMemo(
    () => (editando ? [] : gerarEtapasPrevia(templateEscolhido, {
      inicioISO: form.data_inicio_prevista,
      calendario,
      responsavelId: form.responsavel_id
    })),
    [editando, templateEscolhido, form.data_inicio_prevista, form.responsavel_id, calendario]
  );
  const etapasPrevia = edicaoPrevia ?? etapasAutomaticas;

  // Tipo de serviço do contrato → tipo de obra + template sugerido (uma vez por contrato escolhido)
  useEffect(() => {
    if (editando || !contrato || carregandoDados || sugestaoAplicada.current === contrato.id) return;
    sugestaoAplicada.current = contrato.id;
    const tipo = tiposExecucao.find((t) => t.codigo === contrato.tipo_servico_codigo);
    const sugerido = sugerirTemplate(tipo, templates);
    if (!tipo && !sugerido) return;
    setForm((prev) => ({
      ...prev,
      tipo_servico_codigo: tipo?.codigo ?? prev.tipo_servico_codigo,
      tipo_obra: tipo?.tipo_obra ?? (sugerido ? tipoObraDoTemplate(sugerido.tipo_obra) : prev.tipo_obra),
      template_id: sugerido?.id ?? prev.template_id
    }));
    setEdicaoPrevia(null);
  }, [editando, contrato, carregandoDados, tiposExecucao, templates]);

  const handleSelecionarContrato = (escolhido) => {
    sugestaoAplicada.current = null;
    setContrato(escolhido);
    if (!escolhido) {
      setForm((prev) => ({ ...prev, apontamento_id: '', valor_contrato: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, ...camposDoContrato(escolhido) }));
    setEdicaoPrevia(null);
  };

  const handleTipoServico = (codigo) => {
    const tipo = tiposExecucao.find((t) => t.codigo === codigo);
    const sugerido = sugerirTemplate(tipo, templates);
    setForm((prev) => ({
      ...prev,
      tipo_servico_codigo: codigo,
      tipo_obra: tipo?.tipo_obra ?? prev.tipo_obra,
      template_id: sugerido?.id ?? prev.template_id
    }));
    if (sugerido) setEdicaoPrevia(null);
  };

  const handleSelecionarTemplate = (templateId) => {
    setForm((prev) => ({ ...prev, template_id: prev.template_id === templateId ? '' : templateId }));
    setEdicaoPrevia(null);
  };

  // O responsável geral preenche as etapas sem líder (ou que seguiam o responsável anterior)
  const handleResponsavel = (e) => {
    const novo = e.target.value;
    const anterior = form.responsavel_id;
    setForm((prev) => ({ ...prev, responsavel_id: novo }));
    if (edicaoPrevia) {
      setEdicaoPrevia(edicaoPrevia.map((etapa) => (
        etapa.tipo !== 'estoque' && (!etapa.lider_id || etapa.lider_id === anterior)
          ? { ...etapa, lider_id: novo, apoio_ids: etapa.apoio_ids.filter((id) => id !== novo) }
          : etapa
      )));
    }
  };

  const handleRecalcularDatas = () => {
    setEdicaoPrevia(edicaoPrevia
      ? recalcularDatasPrevia(edicaoPrevia, form.data_inicio_prevista, calendario)
      : null);
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
    const cidadeId = cidadeIdEfetivo || '';

    if (editando) {
      onSalvar({ ...form, cidade_id: cidadeId || null });
      return;
    }

    const usarPrevia = Boolean(templateEscolhido) && etapasPrevia.length > 0;
    if (usarPrevia) {
      const erro = validarEtapasPrevia(etapasPrevia);
      if (erro) {
        toast.error(erro);
        return;
      }
    }

    onSalvar({ ...form, cidade_id: cidadeId }, {
      etapas: usarPrevia ? etapasParaPayload(etapasPrevia, { andamento }) : [],
      criarAtividades,
      statusObra: usarPrevia && andamento ? statusObraAndamento(etapasPrevia) : null
    });
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
          {/* Contratos do Comercial que ainda não viraram obra - só para nova obra */}
          {!editando && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <SeletorContrato
                selecionado={contrato}
                onSelecionar={handleSelecionarContrato}
                usuarioId={usuarioId}
                onIgnorado={onContratosAlterados}
              />
            </div>
          )}

          {/* Tipo de serviço: define o tipo de obra e sugere o template */}
          {!editando && tiposExecucao.length > 0 && (
            <div className="execucao-form-group !mb-0">
              <label htmlFor="obra-tipo-servico" className="execucao-form-label">Tipo de serviço</label>
              <select
                id="obra-tipo-servico"
                className="execucao-form-select"
                value={form.tipo_servico_codigo}
                onChange={(e) => handleTipoServico(e.target.value)}
              >
                <option value="">Não informado</option>
                {tiposExecucao.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
              </select>
              {tipoServico && templateEscolhido && form.template_id === sugerirTemplate(tipoServico, templates)?.id && (
                <p className="text-xs text-purple-300 mt-1">Template sugerido para {tipoServico.nome}: {templateEscolhido.nome}</p>
              )}
              {tipoServico?.modalidade === 'servico' && onUsarServicoRapido && (
                <div className="cad-aviso" role="status">
                  <FaBolt aria-hidden="true" />
                  <span>Este é um serviço de uma visita. Usar o Serviço rápido?</span>
                  <button type="button" className="cad-link" onClick={() => onUsarServicoRapido({ contrato, tipoServicoCodigo: tipoServico.codigo })}>
                    Abrir Serviço rápido
                  </button>
                </div>
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
                Ao escolher um template, a prévia das etapas aparece abaixo para ajustar antes de salvar.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {templatesAtivos.map((template) => {
                  const selecionado = form.template_id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selecionado}
                      title={template.nome}
                      onClick={() => handleSelecionarTemplate(template.id)}
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
              <select id="obra-responsavel" className="execucao-form-select" value={form.responsavel_id} onChange={handleResponsavel}>
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_completo}</option>
                ))}
              </select>
            </div>
          </div>

          {!editando && (
            <div className="execucao-form-group">
              <label htmlFor="obra-valor" className="execucao-form-label">Valor do contrato (R$)</label>
              <input
                id="obra-valor"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="execucao-form-input"
                value={form.valor_contrato}
                onChange={campo('valor_contrato')}
                placeholder="Preenchido pelo contrato do Comercial"
              />
            </div>
          )}

          {/* Prévia das etapas do template (só na criação) */}
          {!editando && templateEscolhido && (
            etapasPrevia.length > 0 ? (
              <PreviaEtapas
                etapas={etapasPrevia}
                onChange={setEdicaoPrevia}
                tecnicos={tecnicos}
                calendario={calendario}
                dataFimContratada={form.data_fim_prevista}
                onUsarTermino={(iso) => setForm((prev) => ({ ...prev, data_fim_prevista: iso }))}
                onRecalcular={handleRecalcularDatas}
                andamento={andamento}
                onAndamento={setAndamento}
                criarAtividades={criarAtividades}
                onCriarAtividades={setCriarAtividades}
              />
            ) : (
              <p className="text-xs text-slate-400">
                {templateEscolhido.itens?.length
                  ? 'Informe o início previsto para ver a prévia das etapas.'
                  : 'Este template não tem etapas; a obra será criada sem etapas.'}
              </p>
            )
          )}

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
