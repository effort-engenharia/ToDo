import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FaPlus,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaUser,
  FaEdit,
  FaTrash,
  FaCheck,
  FaExclamationTriangle,
  FaSearch
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { dataLocalISO, parseDataLocal, intervaloSemana, addDias } from '../utils/datas';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useExecucaoUI } from './ui/ExecucaoUI';
import Modal from './ui/Modal';
import { Carregando, ErroCarregamento, EstadoVazio } from './ui/Estados';

const FORMATO_DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

const STATUS_CLASSE = {
  pendente: 'pendente',
  em_andamento: 'em-andamento',
  concluida: 'concluida',
  urgente: 'urgente'
};

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  transferida: 'Transferida',
  cancelada: 'Cancelada'
};

const formularioVazio = () => ({
  titulo: '',
  descricao: '',
  data_programada: dataLocalISO(),
  hora_inicio: '08:00',
  hora_fim: '17:00',
  prioridade: 'normal',
  tecnico_responsavel_id: '',
  cliente_nome: '',
  endereco: '',
  observacoes: ''
});

const montarFiltros = (tipoExecucao, filtroStatus, filtroPeriodo) => {
  const filtros = { tipo_execucao: tipoExecucao };
  if (filtroStatus !== 'todos') filtros.status = filtroStatus;

  if (filtroPeriodo === 'hoje') {
    filtros.data_programada = dataLocalISO();
  } else if (filtroPeriodo === 'semana') {
    const { inicio, fim } = intervaloSemana();
    filtros.data_inicio = inicio;
    filtros.data_fim = fim;
  } else if (filtroPeriodo === 'mes') {
    const hoje = new Date();
    filtros.data_inicio = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    filtros.data_fim = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  }
  return filtros;
};

const rotuloDia = (dataStr, hojeISO, amanhaISO) => {
  if (dataStr === hojeISO) return 'Hoje';
  if (dataStr === amanhaISO) return 'Amanhã';
  const data = parseDataLocal(dataStr);
  return data ? FORMATO_DIA.format(data) : 'Sem data';
};

const AgendaBase = ({ usuario, tipoExecucao, titulo }) => {
  const { toast, confirmar } = useExecucaoUI();
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebouncedValue(busca, 250);
  const [showModal, setShowModal] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState(null);
  const [formData, setFormData] = useState(formularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(null);

  const { data: atividades, loading, error, reload } = useAsyncData(
    () => execucaoService.buscarAtividades(montarFiltros(tipoExecucao, filtroStatus, filtroPeriodo)),
    [tipoExecucao, filtroStatus, filtroPeriodo],
    { initialData: [] }
  );

  const { data: tecnicos } = useAsyncData(() => execucaoService.buscarTecnicos(), [], { initialData: [] });

  const grupos = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase();
    const filtradas = termo
      ? atividades.filter((a) =>
          a.titulo?.toLowerCase().includes(termo) ||
          a.cliente_nome?.toLowerCase().includes(termo) ||
          a.tecnico?.nome_completo?.toLowerCase().includes(termo))
      : atividades;

    const porData = new Map();
    filtradas.forEach((atividade) => {
      const data = atividade.data_programada;
      if (!porData.has(data)) porData.set(data, []);
      porData.get(data).push(atividade);
    });

    const hojeISO = dataLocalISO();
    const amanhaISO = dataLocalISO(addDias(new Date(), 1));
    return [...porData.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([data, items]) => ({ data, items, rotulo: rotuloDia(data, hojeISO, amanhaISO) }));
  }, [atividades, buscaDebounced]);

  const atualizarCampo = (campo) => (e) => setFormData((f) => ({ ...f, [campo]: e.target.value }));

  // Estável: o Modal reexecuta o foco inicial sempre que onClose muda
  const salvandoRef = useRef(false);
  const fecharModal = useCallback(() => {
    if (salvandoRef.current) return;
    setShowModal(false);
    setAtividadeEditando(null);
  }, []);

  const handleNova = () => {
    setAtividadeEditando(null);
    setFormData(formularioVazio());
    setShowModal(true);
  };

  const handleEditar = (atividade) => {
    setAtividadeEditando(atividade);
    setFormData({
      titulo: atividade.titulo || '',
      descricao: atividade.descricao || '',
      data_programada: atividade.data_programada || dataLocalISO(),
      hora_inicio: atividade.hora_inicio?.substring(0, 5) || '08:00',
      hora_fim: atividade.hora_fim?.substring(0, 5) || '17:00',
      prioridade: atividade.prioridade || 'normal',
      tecnico_responsavel_id: atividade.tecnico_responsavel_id || '',
      cliente_nome: atividade.cliente_nome || '',
      endereco: atividade.endereco || '',
      observacoes: atividade.observacoes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvandoRef.current) return;
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const dados = { ...formData, tipo_execucao: tipoExecucao };
      const result = atividadeEditando
        ? await execucaoService.atualizarAtividade(atividadeEditando.id, dados, usuario.id)
        : await execucaoService.criarAtividade(dados, usuario.id);

      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível salvar a atividade.');
        return;
      }

      toast.success(atividadeEditando ? 'Atividade atualizada.' : 'Atividade criada.');
      setShowModal(false);
      setAtividadeEditando(null);
      reload();
    } catch (err) {
      console.error('Erro ao salvar atividade:', err);
      toast.error('Erro inesperado ao salvar a atividade.');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const executarAcao = async (id, acao, mensagemSucesso, mensagemErro) => {
    if (acaoEmAndamento) return;
    setAcaoEmAndamento(id);
    try {
      const result = await acao();
      if (!result?.success) {
        toast.error(result?.message || mensagemErro);
        return;
      }
      toast.success(mensagemSucesso);
      reload();
    } catch (err) {
      console.error(mensagemErro, err);
      toast.error(mensagemErro);
    } finally {
      setAcaoEmAndamento(null);
    }
  };

  const handleExcluir = async (id) => {
    const ok = await confirmar({
      titulo: 'Excluir atividade',
      mensagem: 'Tem certeza que deseja excluir esta atividade?',
      confirmarTexto: 'Excluir'
    });
    if (!ok) return;
    executarAcao(id, () => execucaoService.excluirAtividade(id), 'Atividade excluída.', 'Não foi possível excluir a atividade.');
  };

  const handleConcluir = (id) =>
    executarAcao(
      id,
      () => execucaoService.alterarStatusAtividade(id, 'concluida', usuario.id),
      'Atividade concluída.',
      'Não foi possível concluir a atividade.'
    );

  return (
    <section className="execucao-animate-fade-in" aria-label={titulo}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="execucao-select"
            style={{ width: 'auto' }}
            aria-label="Filtrar por período"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="todos">Todos</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="execucao-select"
            style={{ width: 'auto' }}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
            <FaSearch className="text-slate-500" size={14} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar..."
              aria-label="Buscar atividades"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-300 text-sm w-40 placeholder-slate-500"
            />
          </div>

          <button type="button" className="execucao-btn execucao-btn-primary" onClick={handleNova}>
            <FaPlus aria-hidden="true" /> Nova Atividade
          </button>
        </div>
      </div>

      {loading ? (
        <Carregando />
      ) : error ? (
        <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
      ) : grupos.length === 0 ? (
        <EstadoVazio
          icone={<FaCalendarAlt aria-hidden="true" />}
          titulo="Nenhuma atividade encontrada"
          texto={`Não há atividades de ${titulo} para o período selecionado.`}
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(({ data, items, rotulo }) => (
            <div key={data}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">{rotulo}</h3>
              <div className="space-y-3">
                {items.map((atividade) => {
                  const ocupada = acaoEmAndamento === atividade.id;
                  return (
                    <div key={atividade.id} className="execucao-activity-card">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`execucao-activity-status ${STATUS_CLASSE[atividade.status] || 'pendente'}`}>
                              {STATUS_LABEL[atividade.status] || atividade.status}
                            </span>
                            {atividade.prioridade === 'urgente' && (
                              <span className="execucao-badge execucao-badge-red">
                                <FaExclamationTriangle size={10} className="mr-1" aria-hidden="true" />
                                Urgente
                              </span>
                            )}
                          </div>
                          <h4 className="text-slate-100 font-semibold mb-2">{atividade.titulo}</h4>
                          <div className="execucao-activity-meta">
                            {atividade.hora_inicio && (
                              <span className="execucao-activity-meta-item">
                                <FaClock size={12} aria-hidden="true" />
                                {atividade.hora_inicio.substring(0, 5)} - {atividade.hora_fim?.substring(0, 5) || ''}
                              </span>
                            )}
                            {atividade.cliente_nome && (
                              <span className="execucao-activity-meta-item">
                                <FaUser size={12} aria-hidden="true" />
                                {atividade.cliente_nome}
                              </span>
                            )}
                            {atividade.endereco && (
                              <span className="execucao-activity-meta-item">
                                <FaMapMarkerAlt size={12} aria-hidden="true" />
                                {atividade.endereco.length > 30 ? `${atividade.endereco.substring(0, 30)}...` : atividade.endereco}
                              </span>
                            )}
                            {atividade.tecnico?.nome_completo && (
                              <span className="execucao-activity-meta-item">
                                <FaUser size={12} aria-hidden="true" />
                                {atividade.tecnico.nome_completo}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {atividade.status !== 'concluida' && (
                            <button
                              type="button"
                              onClick={() => handleConcluir(atividade.id)}
                              disabled={!!acaoEmAndamento}
                              className="execucao-btn execucao-btn-success execucao-btn-sm"
                              title="Concluir"
                              aria-label={`Concluir atividade ${atividade.titulo}`}
                              aria-busy={ocupada}
                            >
                              <FaCheck aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditar(atividade)}
                            disabled={!!acaoEmAndamento}
                            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                            title="Editar"
                            aria-label={`Editar atividade ${atividade.titulo}`}
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(atividade.id)}
                            disabled={!!acaoEmAndamento}
                            className="execucao-btn execucao-btn-danger execucao-btn-sm"
                            title="Excluir"
                            aria-label={`Excluir atividade ${atividade.titulo}`}
                          >
                            <FaTrash aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal titulo={atividadeEditando ? 'Editar Atividade' : 'Nova Atividade'} onClose={fecharModal}>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="execucao-label" htmlFor="agenda-titulo">Título *</label>
                <input
                  id="agenda-titulo"
                  type="text"
                  className="execucao-input"
                  value={formData.titulo}
                  onChange={atualizarCampo('titulo')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="execucao-label" htmlFor="agenda-data">Data *</label>
                  <input
                    id="agenda-data"
                    type="date"
                    className="execucao-input"
                    value={formData.data_programada}
                    onChange={atualizarCampo('data_programada')}
                    required
                  />
                </div>
                <div>
                  <label className="execucao-label" htmlFor="agenda-prioridade">Prioridade</label>
                  <select
                    id="agenda-prioridade"
                    className="execucao-select"
                    value={formData.prioridade}
                    onChange={atualizarCampo('prioridade')}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="execucao-label" htmlFor="agenda-hora-inicio">Hora Início</label>
                  <input
                    id="agenda-hora-inicio"
                    type="time"
                    className="execucao-input"
                    value={formData.hora_inicio}
                    onChange={atualizarCampo('hora_inicio')}
                  />
                </div>
                <div>
                  <label className="execucao-label" htmlFor="agenda-hora-fim">Hora Fim</label>
                  <input
                    id="agenda-hora-fim"
                    type="time"
                    className="execucao-input"
                    value={formData.hora_fim}
                    onChange={atualizarCampo('hora_fim')}
                  />
                </div>
              </div>

              <div>
                <label className="execucao-label" htmlFor="agenda-tecnico">Técnico Responsável</label>
                <select
                  id="agenda-tecnico"
                  className="execucao-select"
                  value={formData.tecnico_responsavel_id}
                  onChange={atualizarCampo('tecnico_responsavel_id')}
                >
                  <option value="">Selecione...</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome_completo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="execucao-label" htmlFor="agenda-cliente">Cliente</label>
                <input
                  id="agenda-cliente"
                  type="text"
                  className="execucao-input"
                  value={formData.cliente_nome}
                  onChange={atualizarCampo('cliente_nome')}
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <label className="execucao-label" htmlFor="agenda-endereco">Endereço</label>
                <input
                  id="agenda-endereco"
                  type="text"
                  className="execucao-input"
                  value={formData.endereco}
                  onChange={atualizarCampo('endereco')}
                  placeholder="Endereço completo"
                />
              </div>

              <div>
                <label className="execucao-label" htmlFor="agenda-descricao">Descrição</label>
                <textarea
                  id="agenda-descricao"
                  className="execucao-input"
                  rows={3}
                  value={formData.descricao}
                  onChange={atualizarCampo('descricao')}
                  placeholder="Descrição da atividade"
                />
              </div>

              <div>
                <label className="execucao-label" htmlFor="agenda-observacoes">Observações</label>
                <textarea
                  id="agenda-observacoes"
                  className="execucao-input"
                  rows={2}
                  value={formData.observacoes}
                  onChange={atualizarCampo('observacoes')}
                  placeholder="Observações adicionais"
                />
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
              <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : atividadeEditando ? 'Salvar' : 'Criar Atividade'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};

export default AgendaBase;
