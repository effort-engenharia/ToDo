import React, { useState, useEffect } from 'react';
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

const POPs = ({ usuario, isAdmin = true }) => {
  const [loading, setLoading] = useState(true);
  const [pops, setPops] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [popSelecionado, setPopSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    categoria: '',
    tipo_execucao: '',
    conteudo: '',
    tags: ''
  });

  const [arquivos, setArquivos] = useState([]);
  const [uploadingArquivo, setUploadingArquivo] = useState(false);

  const categorias = [
    'Instalação',
    'Manutenção',
    'Segurança',
    'Procedimento Padrão',
    'Emergência',
    'Qualidade'
  ];

  useEffect(() => {
    carregarPOPs();
  }, []);

  const carregarPOPs = async () => {
    setLoading(true);
    try {
      const result = await execucaoService.listarPOPs();
      if (result.success) {
        setPops(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar POPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const dados = {
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      criado_por: usuario.id
    };

    let result;
    if (popSelecionado) {
      result = await execucaoService.atualizarPOP(popSelecionado.id, dados);
    } else {
      result = await execucaoService.criarPOP(dados);
    }

    if (result.success) {
      // Upload de arquivos se houver
      if (arquivos.length > 0 && result.data?.id) {
        for (const arquivo of arquivos) {
          await execucaoService.uploadArquivoPOP(result.data.id, arquivo);
        }
      }
      
      setShowModal(false);
      setPopSelecionado(null);
      resetForm();
      carregarPOPs();
    }
  };

  const handleExcluir = async (id) => {
    if (confirm('Deseja realmente excluir este POP?')) {
      const result = await execucaoService.excluirPOP(id);
      if (result.success) {
        carregarPOPs();
      }
    }
  };

  const handleEditar = (pop) => {
    setPopSelecionado(pop);
    setFormData({
      titulo: pop.titulo || '',
      descricao: pop.descricao || '',
      categoria: pop.categoria || '',
      tipo_execucao: pop.tipo_execucao || '',
      conteudo: pop.conteudo || '',
      tags: pop.tags?.join(', ') || ''
    });
    setArquivos([]);
    setShowModal(true);
  };

  const handleVisualizar = (pop) => {
    setPopSelecionado(pop);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      categoria: '',
      tipo_execucao: '',
      conteudo: '',
      tags: ''
    });
    setArquivos([]);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setArquivos(prev => [...prev, ...files]);
  };

  const removerArquivo = (index) => {
    setArquivos(prev => prev.filter((_, i) => i !== index));
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'eletrica': return <FaBolt className="text-yellow-400" />;
      case 'civil': return <FaHardHat className="text-orange-400" />;
      case 'galpao': return <FaWarehouse className="text-blue-400" />;
      default: return <FaBook className="text-gray-400" />;
    }
  };

  const getArquivoIcon = (tipo) => {
    if (tipo?.startsWith('image/')) return <FaImage className="text-green-400" />;
    if (tipo?.startsWith('video/')) return <FaVideo className="text-purple-400" />;
    return <FaFileAlt className="text-blue-400" />;
  };

  // Filtrar POPs
  const popsFiltrados = pops.filter(p => {
    const matchBusca = p.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
                       p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
                       p.tags?.some(t => t.toLowerCase().includes(busca.toLowerCase()));
    const matchCategoria = filtroCategoria === 'todos' || p.categoria === filtroCategoria;
    const matchTipo = filtroTipo === 'todos' || p.tipo_execucao === filtroTipo;
    return matchBusca && matchCategoria && matchTipo;
  });

  if (loading) {
    return (
      <div className="execucao-loading">
        <div className="execucao-spinner"></div>
      </div>
    );
  }

  return (
    <div className="execucao-animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1 flex flex-wrap gap-4">
          <div className="execucao-search flex-1 max-w-md">
            <FaSearch className="execucao-search-icon" />
            <input
              type="text"
              placeholder="Buscar POPs..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="execucao-search-input"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400" />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="execucao-form-select text-sm"
            >
              <option value="todos">Todas categorias</option>
              {categorias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="execucao-form-select text-sm"
          >
            <option value="todos">Todos tipos</option>
            <option value="eletrica">Elétrica</option>
            <option value="civil">Civil</option>
            <option value="galpao">Galpão</option>
          </select>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setPopSelecionado(null);
              setShowModal(true);
            }}
            className="execucao-btn execucao-btn-primary"
          >
            <FaPlus /> Novo POP
          </button>
        )}
      </div>

      {/* Grid de POPs */}
      {popsFiltrados.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaBook />
            </div>
            <div className="execucao-empty-title">Nenhum POP encontrado</div>
            <div className="execucao-empty-text">
              {busca ? 'Tente ajustar sua busca.' : isAdmin ? 'Clique em "Novo POP" para criar um procedimento.' : 'Nenhum procedimento disponível.'}
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

              {pop.tags && pop.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {pop.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
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

              {pop.arquivos && pop.arquivos.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <FaFileAlt />
                  <span>{pop.arquivos.length} arquivo(s)</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                <span className="text-xs text-slate-500">
                  {new Date(pop.created_at).toLocaleDateString('pt-BR')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVisualizar(pop)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Visualizar"
                  >
                    <FaEye size={10} />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleEditar(pop)}
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        title="Editar"
                      >
                        <FaEdit size={10} />
                      </button>
                      <button
                        onClick={() => handleExcluir(pop.id)}
                        className="execucao-btn execucao-btn-danger execucao-btn-sm"
                        title="Excluir"
                      >
                        <FaTrash size={10} />
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
      {showViewModal && popSelecionado && (
        <div className="execucao-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                {getTipoIcon(popSelecionado.tipo_execucao)}
                {popSelecionado.titulo}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowViewModal(false)}>
                ×
              </button>
            </div>
            <div className="execucao-modal-body">
              <div className="space-y-4">
                {popSelecionado.categoria && (
                  <div className="flex items-center gap-2">
                    <span className="execucao-badge execucao-badge-blue">
                      {popSelecionado.categoria}
                    </span>
                  </div>
                )}

                {popSelecionado.descricao && (
                  <div>
                    <label className="text-sm text-slate-400">Descrição</label>
                    <p className="text-slate-200">{popSelecionado.descricao}</p>
                  </div>
                )}

                {popSelecionado.conteudo && (
                  <div>
                    <label className="text-sm text-slate-400">Procedimento</label>
                    <div className="mt-2 p-4 bg-slate-800 rounded-lg text-slate-200 whitespace-pre-wrap">
                      {popSelecionado.conteudo}
                    </div>
                  </div>
                )}

                {popSelecionado.tags && popSelecionado.tags.length > 0 && (
                  <div>
                    <label className="text-sm text-slate-400">Tags</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {popSelecionado.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">
                          <FaTags className="inline mr-1" size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {popSelecionado.arquivos && popSelecionado.arquivos.length > 0 && (
                  <div>
                    <label className="text-sm text-slate-400">Arquivos</label>
                    <div className="space-y-2 mt-2">
                      {popSelecionado.arquivos.map((arquivo, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getArquivoIcon(arquivo.tipo)}
                            <span className="text-slate-200">{arquivo.nome}</span>
                          </div>
                          <a
                            href={arquivo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                          >
                            <FaDownload size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="execucao-modal-footer">
              <button
                className="execucao-btn execucao-btn-secondary"
                onClick={() => setShowViewModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo/Editar POP */}
      {showModal && (
        <div className="execucao-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="execucao-modal execucao-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="execucao-modal-header">
              <h3 className="execucao-modal-title">
                <FaBook className="text-blue-400" />
                {popSelecionado ? 'Editar POP' : 'Novo Procedimento Operacional Padrão'}
              </h3>
              <button className="execucao-modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="execucao-modal-body">
                <div className="space-y-4">
                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Título</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      placeholder="Título do POP"
                      value={formData.titulo}
                      onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Categoria</label>
                      <select
                        className="execucao-form-select"
                        value={formData.categoria}
                        onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                        required
                      >
                        <option value="">Selecione...</option>
                        {categorias.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="execucao-form-group">
                      <label className="execucao-form-label">Tipo de Execução</label>
                      <select
                        className="execucao-form-select"
                        value={formData.tipo_execucao}
                        onChange={(e) => setFormData(prev => ({ ...prev, tipo_execucao: e.target.value }))}
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
                    <label className="execucao-form-label">Descrição</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="2"
                      placeholder="Breve descrição do procedimento..."
                      value={formData.descricao}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    ></textarea>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Procedimento Detalhado</label>
                    <textarea
                      className="execucao-form-textarea"
                      rows="8"
                      placeholder="Descreva o procedimento passo a passo..."
                      value={formData.conteudo}
                      onChange={(e) => setFormData(prev => ({ ...prev, conteudo: e.target.value }))}
                      required
                    ></textarea>
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Tags (separadas por vírgula)</label>
                    <input
                      type="text"
                      className="execucao-form-input"
                      placeholder="segurança, instalação, manutenção..."
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    />
                  </div>

                  <div className="execucao-form-group">
                    <label className="execucao-form-label">Arquivos</label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        accept="image/*,video/*,.pdf,.doc,.docx"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <FaUpload className="mx-auto text-slate-400 text-2xl mb-2" />
                        <p className="text-slate-400">Clique para adicionar arquivos</p>
                        <p className="text-xs text-slate-500">Imagens, vídeos ou documentos</p>
                      </label>
                    </div>

                    {arquivos.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {arquivos.map((arquivo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                            <div className="flex items-center gap-2">
                              {getArquivoIcon(arquivo.type)}
                              <span className="text-sm text-slate-300">{arquivo.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removerArquivo(idx)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <FaTrash size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="execucao-modal-footer">
                <button
                  type="button"
                  className="execucao-btn execucao-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="execucao-btn execucao-btn-primary">
                  {popSelecionado ? 'Salvar Alterações' : 'Criar POP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default POPs;
