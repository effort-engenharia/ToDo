import React, { useState, useEffect } from 'react';
import { 
  FaTimes, FaUser, FaUserPlus, FaUserCheck, FaUserTimes, 
  FaTrash, FaEye, FaEyeSlash, FaCog, FaShieldAlt, FaHistory,
  FaUsers, FaKey, FaClipboardList
} from 'react-icons/fa';
import { adminService } from '../services/supabase/auth.js';
import { useAuth } from '../contexts/AuthContext';

const AdminPanel = ({ isOpen, onClose }) => {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estados para usuários
  const [usuarios, setUsuarios] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    nomeCompleto: '',
    senha: '',
    nivelAcessoId: ''
  });

  // Estados para níveis de acesso e permissões
  const [niveisAcesso, setNiveisAcesso] = useState([]);
  const [paginas, setPaginas] = useState([]);
  const [selectedNivel, setSelectedNivel] = useState('');
  const [permissoes, setPermissoes] = useState([]);
  const [selectedPaginas, setSelectedPaginas] = useState([]);

  // Estados para logs
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'usuarios') {
        await loadUsuarios();
        await loadNiveisAcesso();
      } else if (activeTab === 'permissoes') {
        await loadNiveisAcesso();
        await loadPaginas();
      } else if (activeTab === 'logs') {
        await loadLogs();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showMessage('error', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadUsuarios = async () => {
    const resultado = await adminService.listarUsuarios();
    if (resultado.success) {
      setUsuarios(resultado.usuarios);
    }
  };

  const loadNiveisAcesso = async () => {
    const resultado = await adminService.listarNiveisAcesso();
    if (resultado.success) {
      setNiveisAcesso(resultado.niveis);
    }
  };

  const loadPaginas = async () => {
    const resultado = await adminService.listarPaginas();
    if (resultado.success) {
      setPaginas(resultado.paginas);
    }
  };

  const loadLogs = async () => {
    const resultado = await adminService.listarLogs(50);
    if (resultado.success) {
      setLogs(resultado.logs);
    }
  };

  const loadPermissoes = async (nivelId) => {
    if (!nivelId) return;
    
    const resultado = await adminService.obterPermissoes(nivelId);
    if (resultado.success) {
      setPermissoes(resultado.permissoes);
      setSelectedPaginas(resultado.permissoes.map(p => p.id));
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resultado = await adminService.criarUsuario(formData, formData.nivelAcessoId);
      
      if (resultado.success) {
        showMessage('success', 'Usuário criado com sucesso!');
        setShowUserForm(false);
        setFormData({ email: '', nomeCompleto: '', senha: '', nivelAcessoId: '' });
        await loadUsuarios();
      } else {
        showMessage('error', resultado.message);
      }
    } catch (error) {
      showMessage('error', 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (usuarioId, ativo) => {
    setLoading(true);
    try {
      const resultado = ativo 
        ? await adminService.inativarUsuario(usuarioId)
        : await adminService.ativarUsuario(usuarioId);
      
      if (resultado.success) {
        showMessage('success', resultado.message);
        await loadUsuarios();
      } else {
        showMessage('error', resultado.message);
      }
    } catch (error) {
      showMessage('error', 'Erro ao alterar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (usuarioId) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    setLoading(true);
    try {
      const resultado = await adminService.excluirUsuario(usuarioId);
      
      if (resultado.success) {
        showMessage('success', 'Usuário excluído com sucesso!');
        await loadUsuarios();
      } else {
        showMessage('error', resultado.message);
      }
    } catch (error) {
      showMessage('error', 'Erro ao excluir usuário');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionsUpdate = async () => {
    if (!selectedNivel) return;

    setLoading(true);
    try {
      const resultado = await adminService.atualizarPermissoes(selectedNivel, selectedPaginas);
      
      if (resultado.success) {
        showMessage('success', 'Permissões atualizadas com sucesso!');
      } else {
        showMessage('error', resultado.message);
      }
    } catch (error) {
      showMessage('error', 'Erro ao atualizar permissões');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="header-gradient p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">⚙️ Área de Administrador</h2>
              <p className="text-white/80">
                Gestão de usuários, permissões e logs do sistema
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mx-6 mt-4 p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 border border-green-300 text-green-700' 
              : 'bg-red-100 border border-red-300 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="px-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('usuarios')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'usuarios'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FaUsers className="inline w-4 h-4 mr-2" />
                Usuários
              </button>
              <button
                onClick={() => setActiveTab('permissoes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'permissoes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FaKey className="inline w-4 h-4 mr-2" />
                Permissões
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FaHistory className="inline w-4 h-4 mr-2" />
                Logs
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Tab Usuários */}
          {activeTab === 'usuarios' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Gestão de Usuários</h3>
                <button
                  onClick={() => setShowUserForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <FaUserPlus className="w-4 h-4" />
                  <span>Adicionar Usuário</span>
                </button>
              </div>

              {/* Estatísticas de Usuários */}
              {usuarios.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <FaUsers className="text-blue-600 w-6 h-6 mr-3" />
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Total de Usuários</p>
                        <p className="text-2xl font-bold text-blue-800">{usuarios.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <FaUserCheck className="text-green-600 w-6 h-6 mr-3" />
                      <div>
                        <p className="text-sm text-green-600 font-medium">Usuários Ativos</p>
                        <p className="text-2xl font-bold text-green-800">
                          {usuarios.filter(u => u.ativo).length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center">
                      <FaUserTimes className="text-orange-600 w-6 h-6 mr-3" />
                      <div>
                        <p className="text-sm text-orange-600 font-medium">Pendentes Ativação</p>
                        <p className="text-2xl font-bold text-orange-800">
                          {usuarios.filter(u => !u.ativo).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form de Novo Usuário */}
              {showUserForm && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h4 className="font-medium text-gray-800 mb-4">Novo Usuário</h4>
                  <form onSubmit={handleUserSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={formData.nomeCompleto}
                        onChange={(e) => setFormData({...formData, nomeCompleto: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        value={formData.senha}
                        onChange={(e) => setFormData({...formData, senha: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nível de Acesso
                      </label>
                      <select
                        value={formData.nivelAcessoId}
                        onChange={(e) => setFormData({...formData, nivelAcessoId: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecionar nível</option>
                        {niveisAcesso.map(nivel => (
                          <option key={nivel.id} value={nivel.id}>
                            {nivel.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserForm(false);
                          setFormData({ email: '', nomeCompleto: '', senha: '', nivelAcessoId: '' });
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                      >
                        Criar Usuário
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Lista de Usuários */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nível de Acesso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usuarios.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.nome_completo}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.nivel_acesso?.nome === 'Administrador' 
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.nivel_acesso?.nome || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.ativo 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {user.ativo ? '✅ Ativo' : '⏳ Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.criado_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleToggleUser(user.id, user.ativo)}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                              user.ativo
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                            disabled={loading}
                          >
                            {user.ativo ? (
                              <>
                                <FaEyeSlash className="w-3 h-3 mr-1" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <FaUserCheck className="w-3 h-3 mr-1" />
                                Ativar Conta
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800 hover:bg-red-200"
                            disabled={loading || user.id === usuario?.id}
                            title={user.id === usuario?.id ? "Não é possível excluir seu próprio usuário" : "Excluir usuário"}
                          >
                            <FaTrash className="w-3 h-3 mr-1" />
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Permissões */}
          {activeTab === 'permissoes' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Gestão de Permissões</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nível de Acesso
                  </label>
                  <select
                    value={selectedNivel}
                    onChange={(e) => {
                      setSelectedNivel(e.target.value);
                      loadPermissoes(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecionar nível</option>
                    {niveisAcesso.map(nivel => (
                      <option key={nivel.id} value={nivel.id}>
                        {nivel.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedNivel && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Páginas Permitidas
                    </label>
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-3">
                      {paginas.map(pagina => (
                        <label key={pagina.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedPaginas.includes(pagina.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPaginas([...selectedPaginas, pagina.id]);
                              } else {
                                setSelectedPaginas(selectedPaginas.filter(id => id !== pagina.id));
                              }
                            }}
                            className="mr-2 focus:ring-blue-500"
                          />
                          <span className="text-sm">{pagina.nome} - {pagina.descricao}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handlePermissionsUpdate}
                      disabled={loading}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                    >
                      Salvar Permissões
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Logs */}
          {activeTab === 'logs' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Logs de Acesso</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data/Horário
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.usuario_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.acao === 'LOGIN' 
                              ? 'bg-green-100 text-green-800'
                              : log.acao === 'LOGOUT'
                              ? 'bg-gray-100 text-gray-800'
                              : log.acao.includes('FAILED')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_address || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.data_acesso).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;