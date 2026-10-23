import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FaPlus,
  FaSearch,
  FaBook,
  FaEdit,
  FaTrash,
  FaEye,
  FaUpload,
  FaFileAlt,
  FaImage,
  FaVideo,
  FaDownload,
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaFilter,
  FaTags
} from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import Modal from './ui/Modal';
import { Carregando, ErroCarregamento } from './ui/Estados';
import useDebouncedValue from './pedido-material/useDebouncedValue';

const CATEGORIAS = [
  'Instalação',
  'Manutenção',
  'Segurança',
  'Procedimento Padrão',
  'Emergência',
  'Qualidade'
];

const TIPOS_ARQUIVO_PERMITIDOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm'
];
const TAMANHO_MAX_ARQUIVO = 20 * 1024 * 1024;
const ACCEPT_ARQUIVOS = '.pdf,image/png,image/jpeg,image/webp,video/mp4,video/webm';

const FORM_VAZIO = {
  titulo: '',
  descricao: '',
  categoria: '',
  tipo_execucao: '',
  conteudo: '',
  tags: ''
};

const getTipoIcon = (tipo) => {
  switch (tipo) {
    case 'eletrica': return <FaBolt className="text-yellow-400" aria-hidden="true" />;
    case 'civil': return <FaHardHat className="text-orange-400" aria-hidden="true" />;
    case 'galpao': return <FaWarehouse className="text-blue-400" aria-hidden="true" />;
    default: return <FaBook className="text-gray-400" aria-hidden="true" />;
  }
};

const getArquivoIcon = (mime) => {
  if (mime?.startsWith('image/')) return <FaImage className="text-green-400" aria-hidden="true" />;
  if (mime?.startsWith('video/')) return <FaVideo className="text-purple-400" aria-hidden="true" />;
  return <FaFileAlt className="text-blue-400" aria-hidden="true" />;
};

const POPs = ({ usuario, isAdmin = true }) => {
  const { toast, confirmar } = useExecucaoUI();
  const { data: popsData, loading, error, reload } = useAsyncData(
    () => execucaoService.listarPOPs(),
    []
  );
  const pops = useMemo(() => popsData ?? [], [popsData]);

  // O POP exibido/editado é derivado da lista para refletir recargas (ex.: anexo removido)
  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebouncedValue(busca, 250);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const [formData, setFormData] = useState(FORM_VAZIO);
  const [arquivos, setArquivos] = useState([]);
  const [uploadingArquivo, setUploadingArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const popVisualizado = useMemo(() => pops.find((p) => p.id === viewId) ?? null, [pops, viewId]);
  const popEmEdicao = useMemo(() => pops.find((p) => p.id === editId) ?? null, [pops, editId]);

  const popsFiltrados = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase();
    return pops.filter((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      const matchBusca = !termo ||
        p.titulo?.toLowerCase().includes(termo) ||
        p.descricao?.toLowerCase().includes(termo) ||
        tags.some((t) => String(t).toLowerCase().includes(termo));
      const matchCategoria = filtroCategoria === 'todos' || p.categoria === filtroCategoria;
      const matchTipo = filtroTipo === 'todos' || p.tipo_execucao === filtroTipo;
      return matchBusca && matchCategoria && matchTipo;
    });
  }, [pops, buscaDebounced, filtroCategoria, filtroTipo]);

  const resetForm = () => {
    setFormData(FORM_VAZIO);
    setArquivos([]);
  };

  // Callbacks estáveis: o Modal reaplica o foco sempre que onClose muda
  const salvandoRef = useRef(false);
  salvandoRef.current = salvando;
  const fecharModal = useCallback(() => {
    if (salvandoRef.current) return;
    setShowModal(false);
    setEditId(null);
    setFormData(FORM_VAZIO);
    setArquivos([]);
  }, []);
  const fecharVisualizacao = useCallback(() => setViewId(null), []);

  const handleNovo = () => {
    resetForm();
    setEditId(null);
    setShowModal(true);
  };

  const handleEditar = (pop) => {
    setEditId(pop.id);
    setFormData({
      titulo: pop.titulo || '',
      descricao: pop.descricao || '',
      categoria: pop.categoria || '',
      tipo_execucao: pop.tipo_execucao || '',
      conteudo: pop.conteudo || '',
      tags: Array.isArray(pop.tags) ? pop.tags.join(', ') : ''
    });
    setArquivos([]);
    setShowModal(true);
  };

  const enviarArquivos = async (popId) => {
    setUploadingArquivo(true);
    try {
      const resultados = await Promise.allSettled(
        arquivos.map((a) => execucaoService.uploadArquivoPOP(popId, a.file))
      );
      const falhas = [];
      resultados.forEach((r, i) => {
        const ok = r.status === 'fulfilled' && r.value?.success;
        if (!ok) falhas.push(arquivos[i].file.name);
      });
      return falhas;
    } finally {
      setUploadingArquivo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (!popEmEdicao && !usuario?.id) {
      toast.error('Usuário não identificado. Faça login novamente.');
      return;
    }

    const dados = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao,
      categoria: formData.categoria,
      tipo_execucao: formData.tipo_execucao || null,
      conteudo: formData.conteudo,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
    };

    setSalvando(true);
    try {
      const result = popEmEdicao
        ? await execucaoService.atualizarPOP(popEmEdicao.id, dados)
        : await execucaoService.criarPOP(dados, usuario.id);

      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível salvar o POP.');
        return;
      }

      const popId = result.data?.id ?? popEmEdicao?.id;
      let falhas = [];
      if (arquivos.length > 0 && popId) {
        falhas = await enviarArquivos(popId);
      }

      // O POP já está salvo; falhas de anexo não desfazem o salvamento
      setShowModal(false);
      setEditId(null);
      resetForm();
      reload();

      if (falhas.length > 0) {
        toast.error(`POP salvo, mas ${falhas.length} arquivo(s) não foram enviados: ${falhas.join(', ')}. Edite o POP para tentar novamente.`);
      } else {
        toast.success(popEmEdicao ? 'POP atualizado.' : 'POP criado.');
      }
    } catch (err) {
      console.error('Erro ao salvar POP:', err);
      toast.error(err.message || 'Erro inesperado ao salvar o POP.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (pop) => {
    const ok = await confirmar({
      titulo: 'Excluir POP',
      mensagem: `Deseja realmente excluir o POP "${pop.titulo}"? Os arquivos anexados também serão removidos.`,
      confirmarTexto: 'Excluir'
    });
    if (!ok) return;
    try {
      const result = await execucaoService.excluirPOP(pop.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível excluir o POP.');
        return;
      }
      toast.success('POP excluído.');
      reload();
    } catch (err) {
      console.error('Erro ao excluir POP:', err);
      toast.error(err.message || 'Erro inesperado ao excluir o POP.');
    }
  };

  const handleExcluirArquivoExistente = async (arquivo) => {
    const ok = await confirmar({
      titulo: 'Excluir arquivo',
      mensagem: `Deseja remover o arquivo "${arquivo.nome}" deste POP?`,
      confirmarTexto: 'Remover'
    });
    if (!ok) return;
    try {
      const result = await execucaoService.excluirArquivoPOP(arquivo.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível remover o arquivo.');
        return;
      }
      toast.success('Arquivo removido.');
      reload();
    } catch (err) {
      console.error('Erro ao remover arquivo do POP:', err);
      toast.error(err.message || 'Erro inesperado ao remover o arquivo.');
    }
  };

  const handleFileChange = (e) => {
    const selecionados = Array.from(e.target.files ?? []);
    e.target.value = '';

    const aceitos = [];
    const rejeitados = [];
    for (const file of selecionados) {
      if (!TIPOS_ARQUIVO_PERMITIDOS.includes(file.type)) {
        rejeitados.push(`${file.name} (tipo não permitido)`);
      } else if (file.size > TAMANHO_MAX_ARQUIVO) {
        rejeitados.push(`${file.name} (acima de 20 MB)`);
      } else {
        aceitos.push({ id: crypto.randomUUID(), file });
      }
    }

    if (rejeitados.length > 0) {
      toast.error(`Arquivos rejeitados: ${rejeitados.join('; ')}. Permitidos: PDF, PNG, JPEG, WebP, MP4 e WebM de até 20 MB.`);
    }
    if (aceitos.length > 0) setArquivos((prev) => [...prev, ...aceitos]);
  };

  const removerArquivo = (id) => {
    setArquivos((prev) => prev.filter((a) => a.id !== id));
  };

  // popsData só é null antes da primeira resposta; recargas não desmontam a tela (nem os modais)
  const primeiraCarga = popsData === null;
  if (loading && primeiraCarga) return <Carregando />;
  if (error && primeiraCarga) {
    return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1 flex flex-wrap gap-4">
          <div className="execucao-search flex-1 max-w-md">
            <FaSearch className="execucao-search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar POPs..."
              aria-label="Buscar POPs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="execucao-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400" aria-hidden="true" />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="execucao-form-select text-sm"
              aria-label="Filtrar por categoria"
            >
              <option value="todos">Todas categorias</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="execucao-form-select text-sm"
            aria-label="Filtrar por tipo de execução"
          >
            <option value="todos">Todos tipos</option>
            <option value="eletrica">Elétrica</option>
            <option value="civil">Civil</option>
            <option value="galpao">Galpão</option>
          </select>
        </div>

        {isAdmin && (
          <button type="button" onClick={handleNovo} className="execucao-btn execucao-btn-primary">
            <FaPlus aria-hidden="true" /> Novo POP
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
        </div>
      )}

      {/* Grid de POPs */}
      {popsFiltrados.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaBook aria-hidden="true" />
            </div>
            <div className="execucao-empty-title">Nenhum POP encontrado</div>
            <div className="execucao-empty-text">
              {busca || filtroCategoria !== 'todos' || filtroTipo !== 'todos'
                ? 'Tente ajustar sua busca ou os filtros.'
                : isAdmin ? 'Clique em "Novo POP" para criar um procedimento.' : 'Nenhum procedimento disponível.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popsFiltrados.map((pop) => (
            <div key={pop.id} className="execucao-card hover:border-blue-500/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTipoIcon(pop.tipo_execucao)}
                  <span className="text-xs text-slate-400 uppercase">{pop.tipo_execucao}</span>
                </div>
                {pop.categoria && (
                  <span className="execucao-badge execucao-badge-blue text-xs">
                    {pop.categoria}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                {pop.titulo}
              </h3>

              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                {pop.descricao}
              </p>

              {pop.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {pop.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                  {pop.tags.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                      +{pop.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {pop.arquivos?.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <FaFileAlt aria-hidden="true" />
                  <span>{pop.arquivos.length} arquivo(s)</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                <span className="text-xs text-slate-500">
                  {pop.created_at ? new Date(pop.created_at).toLocaleDateString('pt-BR') : '—'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewId(pop.id)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Visualizar"
                    aria-label={`Visualizar POP ${pop.titulo}`}
                  >
                    <FaEye size={10} aria-hidden="true" />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditar(pop)}
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        title="Editar"
                        aria-label={`Editar POP ${pop.titulo}`}
                      >
                        <FaEdit size={10} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluir(pop)}
                        className="execucao-btn execucao-btn-danger execucao-btn-sm"
                        title="Excluir"
                        aria-label={`Excluir POP ${pop.titulo}`}
                      >
                        <FaTrash size={10} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Visualização */}
      {popVisualizado && (
        <Modal
          tamanho="lg"
          onClose={fecharVisualizacao}
          cabecalho={
            <>
              {getTipoIcon(popVisualizado.tipo_execucao)} {popVisualizado.titulo}
            </>
          }
        >
          <div className="space-y-4">
            {popVisualizado.categoria && (
              <div className="flex items-center gap-2">
                <span className="execucao-badge execucao-badge-blue">
                  {popVisualizado.categoria}
                </span>
              </div>
            )}

            {popVisualizado.descricao && (
              <div>
                <span className="text-sm text-slate-400">Descrição</span>
                <p className="text-slate-200">{popVisualizado.descricao}</p>
              </div>
            )}

            {popVisualizado.conteudo && (
              <div>
                <span className="text-sm text-slate-400">Procedimento</span>
                <div className="mt-2 p-4 bg-slate-800 rounded-lg text-slate-200 whitespace-pre-wrap">
                  {popVisualizado.conteudo}
                </div>
              </div>
            )}

            {popVisualizado.tags.length > 0 && (
              <div>
                <span className="text-sm text-slate-400">Tags</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {popVisualizado.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">
                      <FaTags className="inline mr-1" size={10} aria-hidden="true" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {popVisualizado.arquivos?.length > 0 && (
              <div>
                <span className="text-sm text-slate-400">Arquivos</span>
                <div className="space-y-2 mt-2">
                  {popVisualizado.arquivos.map((arquivo) => (
                    <div key={arquivo.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getArquivoIcon(arquivo.mime_type)}
                        <span className="text-slate-200">{arquivo.nome}</span>
                      </div>
                      {arquivo.url ? (
                        <a
                          href={arquivo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          aria-label={`Baixar ${arquivo.nome}`}
                          title="Baixar"
                        >
                          <FaDownload size={10} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Indisponível</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="execucao-btn execucao-btn-secondary" onClick={fecharVisualizacao}>
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Novo/Editar POP */}
      {showModal && (
        <Modal
          tamanho="lg"
          onClose={fecharModal}
          cabecalho={
            <>
              <FaBook className="text-blue-400" aria-hidden="true" />{' '}
              {popEmEdicao ? 'Editar POP' : 'Novo Procedimento Operacional Padrão'}
            </>
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor="pop-titulo">Título</label>
                <input
                  id="pop-titulo"
                  type="text"
                  className="execucao-form-input"
                  placeholder="Título do POP"
                  value={formData.titulo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="execucao-form-group">
                  <label className="execucao-form-label" htmlFor="pop-categoria">Categoria</label>
                  <select
                    id="pop-categoria"
                    className="execucao-form-select"
                    value={formData.categoria}
                    onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="execucao-form-group">
                  <label className="execucao-form-label" htmlFor="pop-tipo">Tipo de Execução</label>
                  <select
                    id="pop-tipo"
                    className="execucao-form-select"
                    value={formData.tipo_execucao}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tipo_execucao: e.target.value }))}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="eletrica">Elétrica</option>
                    <option value="civil">Civil</option>
                    <option value="galpao">Galpão</option>
                  </select>
                </div>
              </div>

              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor="pop-descricao">Descrição</label>
                <textarea
                  id="pop-descricao"
                  className="execucao-form-textarea"
                  rows="2"
                  placeholder="Breve descrição do procedimento..."
                  value={formData.descricao}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                ></textarea>
              </div>

              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor="pop-conteudo">Procedimento Detalhado</label>
                <textarea
                  id="pop-conteudo"
                  className="execucao-form-textarea"
                  rows="8"
                  placeholder="Descreva o procedimento passo a passo..."
                  value={formData.conteudo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, conteudo: e.target.value }))}
                  required
                ></textarea>
              </div>

              <div className="execucao-form-group">
                <label className="execucao-form-label" htmlFor="pop-tags">Tags (separadas por vírgula)</label>
                <input
                  id="pop-tags"
                  type="text"
                  className="execucao-form-input"
                  placeholder="segurança, instalação, manutenção..."
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                />
              </div>

              <div className="execucao-form-group">
                <span className="execucao-form-label">Arquivos</span>

                {popEmEdicao?.arquivos?.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {popEmEdicao.arquivos.map((arquivo) => (
                      <div key={arquivo.id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <div className="flex items-center gap-2">
                          {getArquivoIcon(arquivo.mime_type)}
                          <span className="text-sm text-slate-300">{arquivo.nome}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleExcluirArquivoExistente(arquivo)}
                          disabled={salvando}
                          className="text-red-400 hover:text-red-300"
                          aria-label={`Remover arquivo ${arquivo.nome}`}
                          title="Remover arquivo"
                        >
                          <FaTrash size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    accept={ACCEPT_ARQUIVOS}
                    disabled={uploadingArquivo || salvando}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FaUpload className="mx-auto text-slate-400 text-2xl mb-2" aria-hidden="true" />
                    <p className="text-slate-400">Clique para adicionar arquivos</p>
                    <p className="text-xs text-slate-500">PDF, PNG, JPEG, WebP, MP4 ou WebM (até 20 MB cada)</p>
                  </label>
                </div>

                {arquivos.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {arquivos.map(({ id, file }) => (
                      <div key={id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <div className="flex items-center gap-2">
                          {getArquivoIcon(file.type)}
                          <span className="text-sm text-slate-300">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerArquivo(id)}
                          disabled={salvando}
                          className="text-red-400 hover:text-red-300"
                          aria-label={`Remover ${file.name} da lista`}
                          title="Remover da lista"
                        >
                          <FaTrash size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                className="execucao-btn execucao-btn-secondary"
                onClick={fecharModal}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="execucao-btn execucao-btn-primary"
                disabled={salvando || uploadingArquivo}
              >
                {uploadingArquivo
                  ? 'Enviando...'
                  : salvando
                    ? 'Salvando...'
                    : popEmEdicao ? 'Salvar Alterações' : 'Criar POP'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default POPs;
