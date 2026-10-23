import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaBuilding,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaFilter,
  FaListAlt,
  FaMagic,
  FaPlus,
  FaSearch
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import { Carregando, ErroCarregamento } from './ui/Estados';
import AlertasEtapasAtrasadas from './planejamento/AlertasEtapasAtrasadas';
import AtividadeEtapaModal from './planejamento/AtividadeEtapaModal';
import EtapaFormModal from './planejamento/EtapaFormModal';
import ObraCard from './planejamento/ObraCard';
import ObraFormModal from './planejamento/ObraFormModal';
import ResumoEtapas from './planejamento/ResumoEtapas';
import TemplateFormModal from './planejamento/TemplateFormModal';
import TemplatesTab from './planejamento/TemplatesTab';
import { FORM_ETAPA_VAZIO } from './planejamento/constants';
import { calcularEstatisticasObras, montarEtapasDoTemplate } from './planejamento/utils';

const ABA_ATIVA = {
  sky: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
};

const classeAba = (ativa, cor) => `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
  ativa ? ABA_ATIVA[cor] : 'text-slate-400 hover:text-white hover:bg-slate-800'
}`;

const mensagemDe = (result) => result?.message || 'erro desconhecido';

// Etapas de estoque geram um pedido de material; as demais geram/atualizam a atividade na agenda
const sincronizarAtividadeDaEtapa = async (etapa, obra, usuarioId, { criarPedidoEstoque }) => {
  if (etapa.tipo === 'estoque') {
    if (!criarPedidoEstoque) return { success: true };

    const dadosPedido = {
      descricao: `Lista de Materiais - ${obra?.nome_cliente || 'N/A'}`,
      itens: [],
      urgencia: 'normal',
      status: 'concluido',
      obra_id: obra?.id,
      etapa_id: etapa.id,
      cliente_nome: obra?.nome_cliente || '',
      endereco_obra: obra?.endereco || '',
      data_lista_pronta: etapa.data_fim, // Data limite para montar a lista
      observacoes: `📦 Lista de materiais para a obra.\n\n🏢 Cliente: ${obra?.nome_cliente || 'N/A'}\n📍 Endereço: ${obra?.endereco || 'N/A'}\n📅 Data limite para lista pronta: ${etapa.data_fim}\n\n⚠️ Após preencher os itens e definir a data de disponibilidade, uma etapa "Chegada dos Materiais" será criada automaticamente no cronograma.`
    };
    return execucaoService.criarPedidoMaterial(dadosPedido, usuarioId);
  }

  // criarAtividadeDeEtapa é idempotente: reaproveita a atividade já vinculada à etapa
  return execucaoService.criarAtividadeDeEtapa(
    etapa.id,
    {
      titulo: etapa.nome,
      descricao: etapa.descricao || `Etapa da obra: ${obra?.nome_cliente || 'N/A'}`,
      data_programada: etapa.data_inicio,
      hora_inicio: '08:00',
      hora_fim: '17:00',
      prioridade: 'normal',
      tecnico_responsavel_id: etapa.responsavel_id,
      cliente_nome: obra?.nome_cliente || '',
      endereco: obra?.endereco || '',
      observacoes: `Etapa automática - Obra: ${obra?.nome_cliente || 'N/A'}\nPeríodo: ${etapa.data_inicio} a ${etapa.data_fim}`
    },
    usuarioId
  );
};

const PlanejamentoMacro = ({ usuario }) => {
  const { toast, confirmar } = useExecucaoUI();

  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('obras'); // obras, resumo, templates
  const [obraExpandida, setObraExpandida] = useState(null); // só uma obra com o Gantt aberto
  const [salvando, setSalvando] = useState(false);

  const [tecnicos, setTecnicos] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Modais: null = fechado
  const [modalObra, setModalObra] = useState(null); // { obra: obra | null }
  const [modalEtapa, setModalEtapa] = useState(null); // { obra, etapa, inicial }
  const [modalAtividade, setModalAtividade] = useState(null); // etapa
  const [modalTemplate, setModalTemplate] = useState(null); // { template: template | null }

  // Obras do período/status escolhido; respostas obsoletas são descartadas pelo hook
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (filtroPeriodo === 'todos') {
      return execucaoService.buscarObras(filtroStatus !== 'todos' ? { status: filtroStatus } : {});
    }
    const result = await execucaoService.buscarObrasPorPeriodo(filtroPeriodo);
    if (result.success && filtroStatus !== 'todos') {
      return { ...result, data: result.data.filter((o) => o.status === filtroStatus) };
    }
    return result;
  }, [filtroPeriodo, filtroStatus]);

  // Cópia local das obras para atualizar/remover sem refazer a consulta inteira
  const [obras, setObras] = useState([]);
  const [dataOrigem, setDataOrigem] = useState(null);
  if (data !== dataOrigem) {
    setDataOrigem(data);
    setObras(data ?? []);
  }

  // Técnicos e templates não dependem dos filtros: carregados uma única vez
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [resTecnicos, resTemplates] = await Promise.all([
          execucaoService.buscarTecnicos(),
          execucaoService.buscarTemplates(false) // false = incluir inativos
        ]);
        if (!ativo) return;
        if (resTecnicos.success) setTecnicos(resTecnicos.data);
        else toast.error(`Não foi possível carregar os técnicos: ${mensagemDe(resTecnicos)}`);
        if (resTemplates.success) setTemplates(resTemplates.data);
        else toast.error(`Não foi possível carregar os templates: ${mensagemDe(resTemplates)}`);
      } catch (err) {
        console.error('Erro ao carregar técnicos e templates:', err);
        if (ativo) toast.error(`Não foi possível carregar técnicos e templates: ${err.message}`);
      }
    })();
    return () => { ativo = false; };
  }, [toast]);

  const recarregarTemplates = useCallback(async () => {
    const result = await execucaoService.buscarTemplates(false);
    if (result.success) setTemplates(result.data);
    else toast.error(`Não foi possível atualizar os templates: ${mensagemDe(result)}`);
  }, [toast]);

  const obrasFiltradas = useMemo(() => {
    if (!busca) return obras;
    const termo = busca.toLowerCase();
    return obras.filter((o) =>
      o.nome_cliente?.toLowerCase().includes(termo) ||
      o.endereco?.toLowerCase().includes(termo) ||
      o.cidade?.toLowerCase().includes(termo)
    );
  }, [obras, busca]);

  const stats = useMemo(() => calcularEstatisticasObras(obras), [obras]);

  const fecharModalObra = useCallback(() => setModalObra(null), []);
  const fecharModalEtapa = useCallback(() => setModalEtapa(null), []);
  const fecharModalAtividade = useCallback(() => setModalAtividade(null), []);
  const fecharModalTemplate = useCallback(() => setModalTemplate(null), []);

  // ---------------------------------------------------
  // Obras
  // ---------------------------------------------------
  const handleSalvarObra = async (formObra) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const obraEditada = modalObra?.obra;

      if (obraEditada) {
        const result = await execucaoService.atualizarObra(obraEditada.id, formObra);
        if (!result.success) {
          toast.error(`Erro ao salvar obra: ${mensagemDe(result)}`);
          return;
        }
        if (result.warning) toast.info(result.warning);
        setObras((prev) => prev.map((o) => (o.id === obraEditada.id ? { ...o, ...result.data } : o)));
        setModalObra(null);
        toast.success('Obra atualizada com sucesso.');
        return;
      }

      const result = await execucaoService.criarObra(formObra);
      if (!result.success) {
        toast.error(`Erro ao criar obra: ${mensagemDe(result)}`);
        return;
      }

      // Etapas do template: um único insert; se falhar, desfaz a criação da obra
      const template = templates.find((t) => t.id === formObra.template_id);
      if (template?.itens?.length) {
        const etapas = montarEtapasDoTemplate(template, result.data.id, formObra.data_inicio_prevista);
        const resEtapas = await execucaoService.criarEtapas(etapas);

        if (!resEtapas.success) {
          const rollback = await execucaoService.excluirObra(result.data.id);
          toast.error(
            `Não foi possível criar as etapas do template (${mensagemDe(resEtapas)}). ` +
            (rollback.success
              ? 'A obra não foi criada; tente novamente.'
              : `Também não foi possível desfazer a obra "${formObra.nome_cliente}" (${mensagemDe(rollback)}); remova-a manualmente.`)
          );
          if (!rollback.success) reload();
          return;
        }
      }

      setModalObra(null);
      toast.success('Obra cadastrada com sucesso.');
      reload();
    } catch (err) {
      console.error('Erro ao salvar obra:', err);
      toast.error(`Erro ao salvar obra: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirObra = useCallback(async (id) => {
    const confirmado = await confirmar({
      titulo: 'Excluir obra',
      mensagem: 'Deseja realmente excluir esta obra e todas as suas etapas?',
      confirmarTexto: 'Excluir',
      perigo: true
    });
    if (!confirmado) return;

    try {
      const result = await execucaoService.excluirObra(id);
      if (!result.success) {
        toast.error(`Erro ao excluir obra: ${mensagemDe(result)}`);
        return;
      }
      setObras((prev) => prev.filter((o) => o.id !== id));
      setObraExpandida((atual) => (atual === id ? null : atual));
      toast.success('Obra excluída.');
    } catch (err) {
      console.error('Erro ao excluir obra:', err);
      toast.error(`Erro ao excluir obra: ${err.message}`);
    }
  }, [confirmar, toast]);

  const handleNovaObra = useCallback(() => setModalObra({ obra: null }), []);
  const handleEditarObra = useCallback((obra) => setModalObra({ obra }), []);
  const handleAlternarObra = useCallback((id) => setObraExpandida((atual) => (atual === id ? null : id)), []);

  // ---------------------------------------------------
  // Templates
  // ---------------------------------------------------
  const handleSalvarTemplate = async (formTemplate) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const templateEditado = modalTemplate?.template;
      const result = templateEditado
        ? await execucaoService.atualizarTemplate(templateEditado.id, formTemplate)
        : await execucaoService.criarTemplate(formTemplate);

      if (!result.success) {
        toast.error(`Erro ao salvar template: ${mensagemDe(result)}`);
        return;
      }
      setModalTemplate(null);
      toast.success('Template salvo.');
      await recarregarTemplates();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      toast.error(`Erro ao salvar template: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirTemplate = useCallback(async (templateId) => {
    const confirmado = await confirmar({
      titulo: 'Excluir template',
      mensagem: 'Deseja realmente excluir este template?',
      confirmarTexto: 'Excluir',
      perigo: true
    });
    if (!confirmado) return;

    try {
      const result = await execucaoService.excluirTemplate(templateId);
      if (!result.success) {
        toast.error(`Erro ao excluir template: ${mensagemDe(result)}`);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success('Template excluído.');
    } catch (err) {
      console.error('Erro ao excluir template:', err);
      toast.error(`Erro ao excluir template: ${err.message}`);
    }
  }, [confirmar, toast]);

  const handleDuplicarTemplate = useCallback(async (template) => {
    try {
      const result = await execucaoService.duplicarTemplate(template.id, `${template.nome} (Cópia)`);
      if (!result.success) {
        toast.error(`Erro ao duplicar template: ${mensagemDe(result)}`);
        return;
      }
      toast.success('Template duplicado.');
      await recarregarTemplates();
    } catch (err) {
      console.error('Erro ao duplicar template:', err);
      toast.error(`Erro ao duplicar template: ${err.message}`);
    }
  }, [toast, recarregarTemplates]);

  const handleNovoTemplate = useCallback(() => setModalTemplate({ template: null }), []);
  const handleEditarTemplate = useCallback((template) => setModalTemplate({ template }), []);

  // ---------------------------------------------------
  // Etapas
  // ---------------------------------------------------
  const handleAbrirEtapaModal = useCallback((obra, etapa = null) => {
    if (etapa) {
      const etapaPai = etapa.etapa_pai_id ? obra.etapas?.find((e) => e.id === etapa.etapa_pai_id) : null;
      setModalEtapa({
        obra,
        etapa,
        inicial: {
          nome: etapa.nome || '',
          descricao: etapa.descricao || '',
          tipo: etapa.tipo || 'geral',
          data_inicio: etapa.data_inicio || '',
          data_fim: etapa.data_fim || '',
          responsavel_id: etapa.responsavel_id || '',
          ordem: etapa.ordem || 0,
          progresso: etapa.progresso || 0,
          status: etapa.status || 'pendente',
          etapa_pai_id: etapa.etapa_pai_id || null,
          etapa_pai_nome: etapaPai?.nome || null // só para exibição no modal
        }
      });
      return;
    }

    setModalEtapa({
      obra,
      etapa: null,
      inicial: {
        ...FORM_ETAPA_VAZIO,
        data_inicio: obra.data_inicio_prevista || '',
        ordem: (obra.etapas?.length || 0) + 1
      }
    });
  }, []);

  const handleAbrirSubEtapaModal = useCallback((obra, etapaPai) => {
    const subEtapasExistentes = obra.etapas?.filter((e) => e.etapa_pai_id === etapaPai.id) || [];
    setModalEtapa({
      obra,
      etapa: null,
      inicial: {
        ...FORM_ETAPA_VAZIO,
        tipo: etapaPai.tipo || 'geral', // herda o tipo da etapa pai
        data_inicio: etapaPai.data_inicio || '',
        data_fim: etapaPai.data_fim || '',
        responsavel_id: etapaPai.responsavel_id || '',
        ordem: subEtapasExistentes.length + 1,
        etapa_pai_id: etapaPai.id,
        etapa_pai_nome: etapaPai.nome
      }
    });
  }, []);

  const handleSalvarEtapa = async (formEtapa) => {
    if (salvando || !modalEtapa) return;
    const { obra, etapa: etapaOriginal } = modalEtapa;
    setSalvando(true);
    try {
      // Campo auxiliar de exibição que não existe no banco
      const dadosParaSalvar = { ...formEtapa };
      delete dadosParaSalvar.etapa_pai_nome;

      const result = etapaOriginal
        ? await execucaoService.atualizarEtapa(etapaOriginal.id, dadosParaSalvar)
        : await execucaoService.criarEtapa({ ...dadosParaSalvar, obra_id: obra.id });

      if (!result.success) {
        toast.error(`Erro ao salvar etapa: ${mensagemDe(result)}`);
        return;
      }
      if (result.warning) toast.info(result.warning);

      // Com responsável definido, cria/atualiza a atividade (ou pedido de material) automaticamente
      if (formEtapa.responsavel_id) {
        const etapaSalva = { ...etapaOriginal, ...dadosParaSalvar, obra_id: obra.id, ...(result.data || {}) };
        const sync = await sincronizarAtividadeDaEtapa(etapaSalva, obra, usuario?.id, {
          // Evita duplicar o pedido de material a cada edição da etapa de estoque
          criarPedidoEstoque: etapaOriginal?.tipo !== 'estoque'
        });
        if (!sync.success) {
          toast.error(`Etapa salva, mas não foi possível criar a atividade/pedido automático: ${mensagemDe(sync)}`);
        } else if (sync.warning) {
          toast.info(sync.warning);
        }
      }

      setModalEtapa(null);
      toast.success(etapaOriginal ? 'Etapa atualizada.' : 'Etapa criada.');
      reload();
    } catch (err) {
      console.error('Erro ao salvar etapa:', err);
      toast.error(`Erro ao salvar etapa: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirEtapa = useCallback(async (id) => {
    const confirmado = await confirmar({
      titulo: 'Excluir etapa',
      mensagem: 'Deseja realmente excluir esta etapa?',
      confirmarTexto: 'Excluir',
      perigo: true
    });
    if (!confirmado) return;

    try {
      const result = await execucaoService.excluirEtapa(id);
      if (!result.success) {
        toast.error(`Erro ao excluir etapa: ${mensagemDe(result)}`);
        return;
      }
      toast.success('Etapa excluída.');
      reload(); // o progresso geral da obra é recalculado no servidor
    } catch (err) {
      console.error('Erro ao excluir etapa:', err);
      toast.error(`Erro ao excluir etapa: ${err.message}`);
    }
  }, [confirmar, toast, reload]);

  const handleAbrirAtividadeModal = useCallback((etapa) => setModalAtividade(etapa), []);

  const handleCriarAtividade = async (formAtividade) => {
    if (salvando || !modalAtividade) return;
    setSalvando(true);
    try {
      const result = await execucaoService.criarAtividadeDeEtapa(modalAtividade.id, formAtividade, usuario?.id);
      if (!result.success) {
        toast.error(`Erro ao criar atividade: ${mensagemDe(result)}`);
        return;
      }
      if (result.warning) toast.info(result.warning);
      setModalAtividade(null);
      toast.success('Atividade criada com sucesso! Verifique na agenda correspondente.');
    } catch (err) {
      console.error('Erro ao criar atividade:', err);
      toast.error(`Erro ao criar atividade: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleVerEtapaAtrasada = useCallback((etapa) => {
    const obra = obras.find((o) => o.id === etapa.obra_id);
    if (obra) handleAbrirEtapaModal(obra, etapa);
  }, [obras, handleAbrirEtapaModal]);

  if (loading && data === null) return <Carregando />;

  return (
    <div className="execucao-animate-fade-in" aria-busy={loading}>
      <AlertasEtapasAtrasadas obras={obras} onVerEtapa={handleVerEtapaAtrasada} />

      {/* Abas de Navegação */}
      <div role="tablist" aria-label="Planejamento" className="flex items-center gap-1 mb-6 border-b border-slate-700 pb-4">
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'obras'}
          onClick={() => setAbaAtiva('obras')}
          className={classeAba(abaAtiva === 'obras', 'sky')}
        >
          <FaBuilding size={14} aria-hidden="true" />
          Obras
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'resumo'}
          onClick={() => setAbaAtiva('resumo')}
          className={classeAba(abaAtiva === 'resumo', 'sky')}
        >
          <FaListAlt size={14} aria-hidden="true" />
          Resumo de Etapas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'templates'}
          onClick={() => setAbaAtiva('templates')}
          className={classeAba(abaAtiva === 'templates', 'purple')}
        >
          <FaMagic size={14} aria-hidden="true" />
          Templates
          <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
            {templates.length}
          </span>
        </button>
      </div>

      <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {/* Aba de Resumo de Etapas */}
        {abaAtiva === 'resumo' && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <FaFilter className="text-slate-400" size={12} aria-hidden="true" />
                <label htmlFor="resumo-periodo" className="text-slate-400 text-sm">Período:</label>
                <select
                  id="resumo-periodo"
                  className="execucao-form-select text-sm py-1 min-w-[150px]"
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                >
                  <option value="semana">Esta Semana</option>
                  <option value="mes">Este Mês</option>
                  <option value="trimestre">Este Trimestre</option>
                  <option value="ano">Este Ano</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
            </div>

            {error ? (
              <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
            ) : (
              <ResumoEtapas
                obras={obras}
                filtroPeriodo={filtroPeriodo}
                onAddAtividade={handleAbrirAtividadeModal}
              />
            )}
          </>
        )}

        {/* Aba de Templates */}
        {abaAtiva === 'templates' && (
          <TemplatesTab
            templates={templates}
            onNovo={handleNovoTemplate}
            onEditar={handleEditarTemplate}
            onDuplicar={handleDuplicarTemplate}
            onExcluir={handleExcluirTemplate}
          />
        )}

        {/* Aba de Obras */}
        {abaAtiva === 'obras' && (
          <>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FaFilter className="text-slate-400" size={12} aria-hidden="true" />
                  <select
                    aria-label="Período"
                    className="execucao-form-select text-sm py-1 min-w-[140px]"
                    value={filtroPeriodo}
                    onChange={(e) => setFiltroPeriodo(e.target.value)}
                  >
                    <option value="semana">Semana</option>
                    <option value="mes">Mês</option>
                    <option value="trimestre">Trimestre</option>
                    <option value="ano">Ano</option>
                    <option value="todos">Todas</option>
                  </select>
                </div>

                <select
                  aria-label="Status"
                  className="execucao-form-select text-sm py-1"
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                >
                  <option value="todos">Todos os Status</option>
                  <option value="planejada">Planejadas</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluídas</option>
                  <option value="pausada">Pausadas</option>
                </select>
              </div>

              {/* Busca e Ações */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <FaSearch className="absolute left-3 text-slate-400 pointer-events-none z-10" size={12} style={{ top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
                  <input
                    type="text"
                    aria-label="Buscar cliente"
                    placeholder="Buscar cliente..."
                    className="execucao-form-input text-sm !py-2 !pl-9 !pr-3 w-48"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNovaObra}
                  className="execucao-btn execucao-btn-primary"
                >
                  <FaPlus aria-hidden="true" /> Nova Obra
                </button>
              </div>
            </div>

            {/* Cards de Estatísticas */}
            <div className="execucao-grid execucao-grid-4 mb-6">
              <div className="execucao-stat-card">
                <div className="execucao-stat-icon blue">
                  <FaBuilding aria-hidden="true" />
                </div>
                <div className="execucao-stat-content">
                  <div className="execucao-stat-label">Total de Obras</div>
                  <div className="execucao-stat-value">{stats.total}</div>
                </div>
              </div>

              <div className="execucao-stat-card">
                <div className="execucao-stat-icon yellow">
                  <FaClock aria-hidden="true" />
                </div>
                <div className="execucao-stat-content">
                  <div className="execucao-stat-label">Em Andamento</div>
                  <div className="execucao-stat-value">{stats.emAndamento}</div>
                </div>
              </div>

              <div className="execucao-stat-card">
                <div className="execucao-stat-icon green">
                  <FaCheckCircle aria-hidden="true" />
                </div>
                <div className="execucao-stat-content">
                  <div className="execucao-stat-label">Concluídas</div>
                  <div className="execucao-stat-value">{stats.concluidas}</div>
                </div>
              </div>

              <div className="execucao-stat-card">
                <div className="execucao-stat-icon red">
                  <FaExclamationCircle aria-hidden="true" />
                </div>
                <div className="execucao-stat-content">
                  <div className="execucao-stat-label">Atrasadas</div>
                  <div className="execucao-stat-value">{stats.atrasadas}</div>
                </div>
              </div>
            </div>

            {/* Lista de Obras */}
            {error ? (
              <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
            ) : obrasFiltradas.length === 0 ? (
              <div className="execucao-card text-center py-12">
                <FaBuilding className="mx-auto text-slate-600 mb-4" size={48} aria-hidden="true" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Nenhuma obra encontrada</h3>
                <p className="text-slate-500 mb-4">Clique em "Nova Obra" para cadastrar um cronograma</p>
              </div>
            ) : (
              <div className="space-y-4">
                {obrasFiltradas.map((obra) => (
                  <ObraCard
                    key={obra.id}
                    obra={obra}
                    expandida={obraExpandida === obra.id}
                    onToggle={handleAlternarObra}
                    onEditar={handleEditarObra}
                    onExcluir={handleExcluirObra}
                    onAdicionarEtapa={handleAbrirEtapaModal}
                    onEditarEtapa={handleAbrirEtapaModal}
                    onExcluirEtapa={handleExcluirEtapa}
                    onAdicionarAtividade={handleAbrirAtividadeModal}
                    onAdicionarSubEtapa={handleAbrirSubEtapaModal}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalTemplate && (
        <TemplateFormModal
          template={modalTemplate.template}
          salvando={salvando}
          onSalvar={handleSalvarTemplate}
          onClose={fecharModalTemplate}
        />
      )}

      {modalObra && (
        <ObraFormModal
          obra={modalObra.obra}
          tecnicos={tecnicos}
          templates={templates}
          salvando={salvando}
          onSalvar={handleSalvarObra}
          onClose={fecharModalObra}
        />
      )}

      {modalEtapa && (
        <EtapaFormModal
          etapa={modalEtapa.etapa}
          inicial={modalEtapa.inicial}
          tecnicos={tecnicos}
          salvando={salvando}
          onSalvar={handleSalvarEtapa}
          onClose={fecharModalEtapa}
        />
      )}

      {modalAtividade && (
        <AtividadeEtapaModal
          etapa={modalAtividade}
          tecnicos={tecnicos}
          salvando={salvando}
          onSalvar={handleCriarAtividade}
          onClose={fecharModalAtividade}
        />
      )}
    </div>
  );
};

export default PlanejamentoMacro;
