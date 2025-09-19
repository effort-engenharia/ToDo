import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaArrowLeft, 
  FaPlus,
  FaEdit,
  FaTrash,
  FaDownload,
  FaUpload,
  FaLink,
  FaTimes,
  FaSave,
  FaSpinner,
  FaCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import { arsenalService } from '../services/supabaseService';

const ArsenalDeGuerra = ({ onVoltar }) => {
  // Estados para a tabela de links (Div 1)
  const [links, setLinks] = useState([]);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [newLink, setNewLink] = useState({ nome: '', url: '' });
  const [editingLinkData, setEditingLinkData] = useState({ nome: '', url: '' });
  
  // Estados para modal de confirmação de exclusão de links
  const [showDeleteLinkModal, setShowDeleteLinkModal] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState(null);
  const [deleteLinkConfirmName, setDeleteLinkConfirmName] = useState('');

  // Estados para os arquivos (Div 2)
  const [arquivos, setArquivos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [loading, setLoading] = useState(true);

  // Estados para notificações
  const [notifications, setNotifications] = useState([]);

  // Carregar dados ao montar o componente
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [linksData, arquivosData] = await Promise.all([
        arsenalService.buscarLinks(),
        arsenalService.buscarArquivos()
      ]);
      
      setLinks(linksData);
      setArquivos(arquivosData.map(arquivo => ({
        ...arquivo,
        tamanho: formatFileSize(arquivo.tamanho_bytes),
        dataUpload: arquivo.created_at
      })));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funções para gerenciar notificações
  const addNotification = (message, type = 'success') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    // Remove a notificação após 5 segundos
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Cabeçalho moderno mantendo o estilo da página principal
  const ModernHeader = () => (
    <div className="header-gradient shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Primeira linha: Título com botão de voltar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onVoltar}
              className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <FaArrowLeft className="text-xl" />
            </button>
            <div className="text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight">
                ⚔️ Arsenal de Guerra
              </h1>
              <p className="text-base sm:text-lg text-white/80 mt-1 sm:mt-2 max-w-4xl italic leading-relaxed">
                "Se você conhece o inimigo e conhece a si mesmo, não precisa temer o resultado de cem batalhas. 
                Se você se conhece mas não conhece o inimigo, para cada vitória ganha sofrerá também uma derrota. 
                Se você não conhece nem o inimigo nem a si mesmo, perderá todas as batalhas..." 
                <span className="font-semibold text-yellow-300">- Sun Tzu</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente da tabela de links editável (Div 1)
  const LinksTable = () => (
    <div className="bg-white rounded-xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FaLink className="text-blue-500" />
          Links Úteis
        </h2>
        <button
          onClick={() => setIsAddingLink(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          <FaPlus /> Adicionar Link
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">Link</th>
              <th className="px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isAddingLink && (
              <tr className="bg-blue-50 border-b">
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={newLink.nome}
                    onChange={(e) => setNewLink({ ...newLink, nome: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="Nome do link"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="url"
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="https://..."
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveLink}
                      className="text-green-600 hover:text-green-800"
                    >
                      <FaSave />
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingLink(false);
                        setNewLink({ nome: '', url: '' });
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {links.map((link) => (
              <tr key={link.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4">
                  {editingLinkId === link.id ? (
                    <input
                      type="text"
                      value={editingLinkData.nome}
                      onChange={(e) => setEditingLinkData({ ...editingLinkData, nome: e.target.value })}
                      className="w-full p-2 border rounded"
                      autoFocus
                    />
                  ) : (
                    link.nome
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingLinkId === link.id ? (
                    <input
                      type="url"
                      value={editingLinkData.url}
                      onChange={(e) => setEditingLinkData({ ...editingLinkData, url: e.target.value })}
                      className="w-full p-2 border rounded"
                    />
                  ) : (
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {link.url}
                    </a>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {editingLinkId === link.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEditLink(link.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <FaSave />
                        </button>
                        <button
                          onClick={() => {
                            setEditingLinkId(null);
                            setEditingLinkData({ nome: '', url: '' });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTimes />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingLinkId(link.id);
                            setEditingLinkData({ nome: link.nome, url: link.url });
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteLinkClick(link)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Componente da lista de arquivos (Div 2)
  const FilesList = () => (
    <div className="bg-white rounded-xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FaUpload className="text-green-500" />
          Arquivos Importantes
        </h2>
        <div className="flex gap-2">
          <input
            type="file"
            id="fileUpload"
            multiple
            onChange={handleFileUpload}
            accept="*/*"
            className="hidden"
          />
          <label
            htmlFor="fileUpload"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 cursor-pointer"
          >
            {isUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
            Fazer Upload
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {arquivos.map((arquivo) => (
          <div key={arquivo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📄</div>
              <div>
                <div className="font-medium text-gray-800">{arquivo.nome}</div>
                <div className="text-sm text-gray-500">
                  {arquivo.tamanho} • {new Date(arquivo.dataUpload).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownloadFile(arquivo)}
                className="text-blue-600 hover:text-blue-800 p-2"
                title="Download"
              >
                <FaDownload />
              </button>
              <button
                onClick={() => handleDeleteFileClick(arquivo)}
                className="text-red-600 hover:text-red-800 p-2"
                title="Excluir"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}
        {arquivos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FaUpload className="text-4xl mx-auto mb-4 opacity-50" />
            <p>Nenhum arquivo enviado ainda</p>
            <p className="text-sm">Clique em "Fazer Upload" para adicionar arquivos</p>
          </div>
        )}
      </div>
    </div>
  );

  // Modal de confirmação de exclusão de links
  const renderDeleteLinkModal = () => {
    if (!showDeleteLinkModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmar Exclusão de Link</h3>
          <p className="text-gray-600 mb-4">
            Para confirmar a exclusão do link <strong>{linkToDelete?.nome}</strong>, 
            digite o nome completo do link abaixo:
          </p>
          <input
            type="text"
            value={deleteLinkConfirmName}
            onChange={(e) => setDeleteLinkConfirmName(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
            placeholder="Nome do link"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancelDeleteLink}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDeleteLink}
              disabled={deleteLinkConfirmName !== linkToDelete?.nome}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Modal de confirmação de exclusão de arquivos
  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmar Exclusão</h3>
          <p className="text-gray-600 mb-4">
            Para confirmar a exclusão do arquivo <strong>{fileToDelete?.nome}</strong>, 
            digite o nome completo do arquivo abaixo:
          </p>
          <input
            type="text"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4"
            placeholder="Nome do arquivo"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setFileToDelete(null);
                setDeleteConfirmName('');
              }}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteConfirmName !== fileToDelete?.nome}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Funções de manipulação de links otimizadas
  const handleSaveLink = useCallback(async () => {
    if (!newLink.nome || !newLink.url) return;
    
    try {
      const novoLink = await arsenalService.criarLink(newLink);
      setLinks(prev => [...prev, novoLink]);
      setNewLink({ nome: '', url: '' });
      setIsAddingLink(false);
      addNotification('Link criado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar link:', error);
      addNotification('Erro ao salvar link. Tente novamente.', 'error');
    }
  }, [newLink]);

  const handleLinkChange = (id, field, value) => {
    setLinks(links.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  const handleSaveEditLink = useCallback(async (id) => {
    try {
      await arsenalService.atualizarLink(id, editingLinkData);
      setLinks(prev => prev.map(link => 
        link.id === id ? { ...link, ...editingLinkData } : link
      ));
      setEditingLinkId(null);
      setEditingLinkData({ nome: '', url: '' });
      addNotification('Link atualizado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar link:', error);
      addNotification('Erro ao atualizar link. Tente novamente.', 'error');
    }
  }, [editingLinkData]);

  const handleDeleteLinkClick = useCallback((link) => {
    setLinkToDelete(link);
    setShowDeleteLinkModal(true);
    setDeleteLinkConfirmName('');
  }, []);

  const handleConfirmDeleteLink = useCallback(async () => {
    if (deleteLinkConfirmName === linkToDelete?.nome) {
      try {
        await arsenalService.excluirLink(linkToDelete.id);
        setLinks(prev => prev.filter(link => link.id !== linkToDelete.id));
        setShowDeleteLinkModal(false);
        setLinkToDelete(null);
        setDeleteLinkConfirmName('');
        addNotification('Link excluído com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao excluir link:', error);
        addNotification('Erro ao excluir link. Tente novamente.', 'error');
      }
    }
  }, [deleteLinkConfirmName, linkToDelete]);

  const handleCancelDeleteLink = useCallback(() => {
    setShowDeleteLinkModal(false);
    setLinkToDelete(null);
    setDeleteLinkConfirmName('');
  }, []);

  // Funções de manipulação de arquivos
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Validações antes do upload
    const arquivosInvalidos = [];
    const arquivosValidos = [];

    for (const file of files) {
      // Validar tamanho (50MB)
      if (file.size > 50 * 1024 * 1024) {
        arquivosInvalidos.push(`${file.name}: muito grande (máx 50MB)`);
        continue;
      }

      // Validar se não está vazio
      if (file.size === 0) {
        arquivosInvalidos.push(`${file.name}: arquivo vazio`);
        continue;
      }

      // Validar nome do arquivo
      if (!file.name || file.name.trim() === '') {
        arquivosInvalidos.push(`Arquivo sem nome válido`);
        continue;
      }

      arquivosValidos.push(file);
    }

    // Mostrar arquivos inválidos se houver
    if (arquivosInvalidos.length > 0) {
      addNotification(
        `Arquivos inválidos encontrados: ${arquivosInvalidos.length}. ${arquivosValidos.length > 0 ? 'Enviando arquivos válidos...' : 'Nenhum arquivo será enviado.'}`,
        'warning'
      );
    }

    // Se não há arquivos válidos, cancela
    if (arquivosValidos.length === 0) {
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    
    try {
      let errosUpload = [];
      let sucessosUpload = 0;

      for (const file of arquivosValidos) {
        try {
          console.log(`📤 Iniciando upload de: ${file.name}`);
          
          const novoArquivo = await arsenalService.uploadArquivo(file);
          const arquivoFormatado = {
            ...novoArquivo,
            tamanho: formatFileSize(novoArquivo.tamanho_bytes),
            dataUpload: novoArquivo.created_at
          };
          
          setArquivos(prev => [...prev, arquivoFormatado]);
          sucessosUpload++;
          
          console.log(`✅ Upload concluído: ${file.name}`);
        } catch (fileError) {
          console.error(`❌ Erro no upload de ${file.name}:`, fileError);
          errosUpload.push({
            nome: file.name,
            erro: fileError.message
          });
        }
      }

      // Mostrar resultado do upload
      if (sucessosUpload > 0 && errosUpload.length === 0) {
        addNotification(`${sucessosUpload} arquivo(s) enviado(s) com sucesso!`, 'success');
      } else if (sucessosUpload > 0 && errosUpload.length > 0) {
        addNotification(`${sucessosUpload} arquivo(s) enviado(s), ${errosUpload.length} falharam.`, 'warning');
        // Mostrar erros específicos em notificações separadas
        errosUpload.slice(0, 3).forEach(erro => {
          addNotification(`${erro.nome}: ${erro.erro}`, 'error');
        });
        if (errosUpload.length > 3) {
          addNotification(`...e mais ${errosUpload.length - 3} erro(s)`, 'error');
        }
      } else {
        addNotification('Falha no upload de todos os arquivos', 'error');
        // Mostrar primeiro erro específico
        if (errosUpload.length > 0) {
          addNotification(`${errosUpload[0].nome}: ${errosUpload[0].erro}`, 'error');
        }
      }
    } catch (error) {
      console.error('💥 Erro geral no upload:', error);
      addNotification(`Erro inesperado: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDownloadFile = async (arquivo) => {
    try {
      const blob = await arsenalService.downloadArquivo(arquivo.caminho_storage);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      addNotification('Erro ao baixar arquivo. Tente novamente.', 'error');
    }
  };

  const handleDeleteFileClick = (arquivo) => {
    setFileToDelete(arquivo);
    setShowDeleteModal(true);
    setDeleteConfirmName('');
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmName === fileToDelete?.nome) {
      try {
        await arsenalService.excluirArquivo(fileToDelete.id, fileToDelete.caminho_storage);
        setArquivos(arquivos.filter(arquivo => arquivo.id !== fileToDelete.id));
        setShowDeleteModal(false);
        setFileToDelete(null);
        setDeleteConfirmName('');
        addNotification('Arquivo excluído com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao excluir arquivo:', error);
        addNotification('Erro ao excluir arquivo. Tente novamente.', 'error');
      }
    }
  };

  // Componente de notificações toast
  const NotificationToast = () => {
    if (notifications.length === 0) return null;

    return (
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out animate-slide-in-right max-w-sm ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white' 
                : notification.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-yellow-500 text-white'
            }`}
          >
            <div className="flex-shrink-0">
              {notification.type === 'success' && <FaCheck className="text-lg" />}
              {notification.type === 'error' && <FaTimes className="text-lg" />}
              {notification.type === 'warning' && <FaExclamationTriangle className="text-lg" />}
            </div>
            <div className="flex-1 text-sm font-medium">
              {notification.message}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Função utilitária
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <ModernHeader />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <FaSpinner className="animate-spin text-4xl text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Grid responsiva com duas divs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Div 1: Tabela de Links */}
              <LinksTable />
              
              {/* Div 2: Lista de Arquivos */}
              <FilesList />
            </div>
          </>
        )}
      </div>
      
      {/* Modais de confirmação */}
      {renderDeleteLinkModal()}
      {renderDeleteModal()}
      
      {/* Notificações Toast */}
      <NotificationToast />
    </div>
  );
};

export default ArsenalDeGuerra;