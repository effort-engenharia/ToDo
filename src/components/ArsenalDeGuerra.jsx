import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import AdministradorasTable from './AdministradorasTable';

// Componente da tabela de links editável (Div 1) - movido para fora
const LinksTable = ({ 
  links, 
  isAddingLink, 
  setIsAddingLink, 
  newLink, 
  setNewLink, 
  editingLinkId, 
  setEditingLinkId, 
  editingLinkData, 
  setEditingLinkData, 
  handleSaveLink, 
  handleSaveEditLink, 
  handleDeleteLinkClick 
}) => (
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

// Componente da lista de arquivos (Div 2) - movido para fora
const FilesList = ({ 
  arquivos, 
  isUploading, 
  handleFileUpload, 
  handleDownloadFile, 
  handleDeleteFileClick 
}) => (
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
                {arquivo.tamanho} • {new Date(arquivo.dataUpload).toLocaleDateString('pt-BR')} às {new Date(arquivo.dataUpload).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

// Componente de input com autocomplete - movido para fora
const AddressInput = ({ 
  value, 
  onChange, 
  placeholder, 
  type, 
  index = null,
  label,
  icon,
  suggestions,
  setSuggestions,
  showSuggestions,
  setShowSuggestions,
  debouncedSearch,
  isLoadingSuggestions
}) => {
  const currentSuggestions = index !== null 
    ? suggestions[type]?.[index] || []
    : suggestions[type] || [];
  const isShowingSuggestions = index !== null
    ? showSuggestions[type]?.[index] || false
    : showSuggestions[type] || false;

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue, type, index);
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setSuggestions(prev => ({
      ...prev,
      [type]: index !== null ? { ...prev[type], [index]: [] } : []
    }));
    setShowSuggestions(prev => ({
      ...prev,
      [type]: index !== null ? { ...prev[type], [index]: false } : false
    }));
  };

  const handleInputBlur = () => {
    // Delay para permitir click na sugestão
    setTimeout(() => {
      setShowSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: false } : false
      }));
    }, 200);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {icon} {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder}
      />
      
      {/* Lista de sugestões */}
      {isShowingSuggestions && currentSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoadingSuggestions && (
            <div className="p-3 text-center text-gray-500">
              <FaSpinner className="animate-spin inline mr-2" />
              Buscando sugestões...
            </div>
          )}
          {currentSuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
            >
              <div className="flex items-center gap-2">
                <div className="text-blue-500">📍</div>
                <div className="text-gray-800">{suggestion}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente do roteiro de viagem - movido para fora
const RoteiroViagem = ({ 
  origem, 
  setOrigem, 
  destino, 
  setDestino, 
  paradas, 
  setParadas, 
  linkRota, 
  setLinkRota, 
  addNotification 
}) => {
  // Estados para autocomplete
  const [suggestions, setSuggestions] = useState({
    origem: [],
    destino: [],
    paradas: {}
  });
  
  const [showSuggestions, setShowSuggestions] = useState({
    origem: false,
    destino: false,
    paradas: {}
  });

  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Debounce para evitar muitas requisições
  const debounceTimer = useRef(null);

  // Função para carregar Google Maps API dinamicamente
  const loadGoogleMapsAPI = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
        return;
      }
      
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey || apiKey === 'sua_chave_aqui') {
        reject(new Error('API key não configurada'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=pt-BR&region=BR`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps API falhou ao carregar'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Erro ao carregar Google Maps API'));
      };
      
      document.head.appendChild(script);
    });
  };

  // Função para buscar sugestões de endereço
  const fetchAddressSuggestions = async (query, type, index = null) => {
    if (!query || query.length < 3) {
      setSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: [] } : []
      }));
      setShowSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: false } : false
      }));
      return;
    }

    try {
      setIsLoadingSuggestions(true);
      let suggestions = [];

      try {
        // Tentar carregar Google Maps API
        const maps = await loadGoogleMapsAPI();
        
        // Usar AutocompleteService para buscar sugestões
        const autocompleteService = new maps.places.AutocompleteService();
        
        const request = {
          input: query,
          componentRestrictions: { country: 'BR' },
          language: 'pt-BR',
          types: ['address']
        };

        // Promisificar a chamada do AutocompleteService
        const predictions = await new Promise((resolve, reject) => {
          autocompleteService.getPlacePredictions(request, (results, status) => {
            if (status === maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              resolve([]);
            } else {
              reject(new Error(`Places API error: ${status}`));
            }
          });
        });

        // Formatar as sugestões
        suggestions = predictions.map(prediction => prediction.description).slice(0, 6);

      } catch (apiError) {
        console.warn('Google Maps API não disponível, usando fallback:', apiError.message);
        // Usar sistema mockado como fallback
        suggestions = generateMockSuggestions(query);
      }

      // Se não conseguiu sugestões da API, usar fallback
      if (suggestions.length === 0) {
        suggestions = generateMockSuggestions(query);
      }
      
      setSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: suggestions } : suggestions
      }));
      
      setShowSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: true } : true
      }));
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      // Em caso de erro, usar sistema mockado como fallback
      const mockSuggestions = generateMockSuggestions(query);
      setSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: mockSuggestions } : mockSuggestions
      }));
      setShowSuggestions(prev => ({
        ...prev,
        [type]: index !== null ? { ...prev[type], [index]: true } : true
      }));
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Função para gerar sugestões simuladas (fallback)
  const generateMockSuggestions = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Base de dados mais robusta para fallback
    const addressDatabase = {
      // Principais bairros de São Paulo
      'sp': [
        'Vila Madalena, São Paulo, SP, Brasil',
        'Jardins, São Paulo, SP, Brasil',
        'Itaim Bibi, São Paulo, SP, Brasil',
        'Vila Olímpia, São Paulo, SP, Brasil',
        'Pinheiros, São Paulo, SP, Brasil',
        'Moema, São Paulo, SP, Brasil',
        'Centro, São Paulo, SP, Brasil',
        'Brooklin, São Paulo, SP, Brasil'
      ],
      // Principais bairros do Rio de Janeiro
      'rj': [
        'Ipanema, Rio de Janeiro, RJ, Brasil',
        'Copacabana, Rio de Janeiro, RJ, Brasil',
        'Leblon, Rio de Janeiro, RJ, Brasil',
        'Botafogo, Rio de Janeiro, RJ, Brasil',
        'Flamengo, Rio de Janeiro, RJ, Brasil',
        'Centro, Rio de Janeiro, RJ, Brasil',
        'Tijuca, Rio de Janeiro, RJ, Brasil',
        'Barra da Tijuca, Rio de Janeiro, RJ, Brasil'
      ],
      // Principais bairros de Belo Horizonte
      'bh': [
        'Savassi, Belo Horizonte, MG, Brasil',
        'Funcionários, Belo Horizonte, MG, Brasil',
        'Centro, Belo Horizonte, MG, Brasil',
        'Lourdes, Belo Horizonte, MG, Brasil',
        'Serra, Belo Horizonte, MG, Brasil',
        'Pampulha, Belo Horizonte, MG, Brasil'
      ]
    };

    // Buscar por padrões específicos
    let suggestions = [];

    // Se a query contém nome de cidade/estado, priorizar bairros dessa região
    if (lowerQuery.includes('são paulo') || lowerQuery.includes('sp')) {
      suggestions.push(...addressDatabase.sp.filter(addr => 
        addr.toLowerCase().includes(lowerQuery)
      ));
    }
    
    if (lowerQuery.includes('rio de janeiro') || lowerQuery.includes('rj')) {
      suggestions.push(...addressDatabase.rj.filter(addr => 
        addr.toLowerCase().includes(lowerQuery)
      ));
    }
    
    if (lowerQuery.includes('belo horizonte') || lowerQuery.includes('bh') || lowerQuery.includes('mg')) {
      suggestions.push(...addressDatabase.bh.filter(addr => 
        addr.toLowerCase().includes(lowerQuery)
      ));
    }

    // Buscar em todos os bairros se não encontrou nada específico
    if (suggestions.length === 0) {
      Object.values(addressDatabase).flat().forEach(addr => {
        if (addr.toLowerCase().includes(lowerQuery)) {
          suggestions.push(addr);
        }
      });
    }

    // Adicionar sugestões personalizadas baseadas na query
    const customSuggestions = [
      `${query}, Centro, São Paulo, SP, Brasil`,
      `Rua ${query}, Vila Madalena, São Paulo, SP, Brasil`,
      `Avenida ${query}, Ipanema, Rio de Janeiro, RJ, Brasil`,
      `${query}, Savassi, Belo Horizonte, MG, Brasil`,
      `${query} - Centro, São Paulo, SP, Brasil`,
      `${query}, Jardins, São Paulo, SP, Brasil`
    ];

    // Combinar resultados, removendo duplicatas
    const allSuggestions = [...suggestions, ...customSuggestions];
    const uniqueSuggestions = [...new Set(allSuggestions)];
    
    return uniqueSuggestions.slice(0, 6);
  };

  // Função debounced para buscar sugestões
  const debouncedSearch = (query, type, index = null) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      fetchAddressSuggestions(query, type, index);
    }, 300);
  };

  const adicionarParada = () => {
    setParadas([...paradas, '']);
  };

  const removerParada = (index) => {
    if (paradas.length > 1) {
      setParadas(paradas.filter((_, i) => i !== index));
      // Limpar sugestões da parada removida
      setSuggestions(prev => {
        const newParadas = { ...prev.paradas };
        delete newParadas[index];
        return { ...prev, paradas: newParadas };
      });
      setShowSuggestions(prev => {
        const newParadas = { ...prev.paradas };
        delete newParadas[index];
        return { ...prev, paradas: newParadas };
      });
    }
  };

  const atualizarParada = (index, valor) => {
    const novasParadas = [...paradas];
    novasParadas[index] = valor;
    setParadas(novasParadas);
  };

  const gerarRota = () => {
    if (!origem || !destino) {
      addNotification('Origem e destino são obrigatórios!', 'error');
      return;
    }

    let url = 'https://www.google.com/maps/dir/';
    
    // Adiciona origem
    url += encodeURIComponent(origem) + '/';
    
    // Adiciona paradas intermediárias (apenas as preenchidas)
    const paradasPreenchidas = paradas.filter(parada => parada.trim() !== '');
    paradasPreenchidas.forEach(parada => {
      url += encodeURIComponent(parada) + '/';
    });
    
    // Adiciona destino
    url += encodeURIComponent(destino);

    setLinkRota(url);
    addNotification('Rota gerada com sucesso!', 'success');
  };

  const limparRota = () => {
    setOrigem('');
    setDestino('');
    setParadas(['']);
    setLinkRota('');
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          🗺️ Roteiro de Viagem
        </h2>
        <button
          onClick={limparRota}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          <FaTimes /> Limpar
        </button>
      </div>

      <div className="space-y-4">
        {/* Origem */}
        <AddressInput
          value={origem}
          onChange={setOrigem}
          placeholder="Digite o endereço de origem"
          type="origem"
          label="Origem"
          icon="📍"
          suggestions={suggestions}
          setSuggestions={setSuggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          debouncedSearch={debouncedSearch}
          isLoadingSuggestions={isLoadingSuggestions}
        />

        {/* Paradas */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              🛑 Paradas Intermediárias
            </label>
            <button
              onClick={adicionarParada}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg transition-all duration-300 flex items-center gap-1 text-sm"
            >
              <FaPlus /> Adicionar Parada
            </button>
          </div>
          {paradas.map((parada, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <div className="flex-1">
                <AddressInput
                  value={parada}
                  onChange={(valor) => atualizarParada(index, valor)}
                  placeholder={`Parada ${index + 1} (opcional)`}
                  type="paradas"
                  index={index}
                  suggestions={suggestions}
                  setSuggestions={setSuggestions}
                  showSuggestions={showSuggestions}
                  setShowSuggestions={setShowSuggestions}
                  debouncedSearch={debouncedSearch}
                  isLoadingSuggestions={isLoadingSuggestions}
                />
              </div>
              {paradas.length > 1 && (
                <button
                  onClick={() => removerParada(index)}
                  className="text-red-600 hover:text-red-800 p-3 self-start mt-8"
                  title="Remover parada"
                >
                  <FaTrash />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Destino */}
        <AddressInput
          value={destino}
          onChange={setDestino}
          placeholder="Digite o endereço de destino"
          type="destino"
          label="Destino"
          icon="🎯"
          suggestions={suggestions}
          setSuggestions={setSuggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          debouncedSearch={debouncedSearch}
          isLoadingSuggestions={isLoadingSuggestions}
        />

        {/* Botão Gerar Rota */}
        <div className="pt-4">
          <button
            onClick={gerarRota}
            disabled={!origem || !destino}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium"
          >
            🗺️ Gerar Rota no Google Maps
          </button>
        </div>

        {/* Link da Rota Gerada */}
        {linkRota && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-2">
              ✅ Rota Gerada com Sucesso!
            </h3>
            <a
              href={linkRota}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 underline font-medium"
            >
              🗺️ Abrir Rota no Google Maps
              <FaLink className="text-sm" />
            </a>
            <p className="text-xs text-gray-600 mt-2">
              Clique no link acima para abrir a rota no Google Maps
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

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

  // Estados para o roteiro de viagem
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [paradas, setParadas] = useState(['']);
  const [linkRota, setLinkRota] = useState('');

  // Função para adicionar parada ao roteiro
  const adicionarParadaRoteiro = (endereco) => {
    // Encontrar primeira parada vazia ou adicionar nova
    const indiceVazio = paradas.findIndex(parada => parada.trim() === '');
    
    if (indiceVazio !== -1) {
      // Atualizar parada vazia existente
      const novasParadas = [...paradas];
      novasParadas[indiceVazio] = endereco;
      setParadas(novasParadas);
    } else {
      // Adicionar nova parada
      setParadas(prev => [...prev, endereco]);
    }
  };

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Div 1: Tabela de Links */}
              <LinksTable 
                links={links}
                isAddingLink={isAddingLink}
                setIsAddingLink={setIsAddingLink}
                newLink={newLink}
                setNewLink={setNewLink}
                editingLinkId={editingLinkId}
                setEditingLinkId={setEditingLinkId}
                editingLinkData={editingLinkData}
                setEditingLinkData={setEditingLinkData}
                handleSaveLink={handleSaveLink}
                handleSaveEditLink={handleSaveEditLink}
                handleDeleteLinkClick={handleDeleteLinkClick}
              />
              
              {/* Div 2: Lista de Arquivos */}
              <FilesList 
                arquivos={arquivos}
                isUploading={isUploading}
                handleFileUpload={handleFileUpload}
                handleDownloadFile={handleDownloadFile}
                handleDeleteFileClick={handleDeleteFileClick}
              />
            </div>

            {/* Nova grid para o roteiro de viagem */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <RoteiroViagem 
                origem={origem}
                setOrigem={setOrigem}
                destino={destino}
                setDestino={setDestino}
                paradas={paradas}
                setParadas={setParadas}
                linkRota={linkRota}
                setLinkRota={setLinkRota}
                addNotification={addNotification}
              />
            </div>

            {/* Grid para a tabela de administradoras */}
            <div className="grid grid-cols-1 gap-6">
              <AdministradorasTable 
                adicionarParadaRoteiro={adicionarParadaRoteiro}
                addNotification={addNotification}
              />
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