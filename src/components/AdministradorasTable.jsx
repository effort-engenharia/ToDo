import React, { useState, useEffect } from 'react';
import { 
  FaMapMarkerAlt, 
  FaGlobe, 
  FaPhone, 
  FaWhatsapp, 
  FaCheck, 
  FaTimes,
  FaSpinner,
  FaSync,
  FaPlus
} from 'react-icons/fa';
import { administradorasService } from '../services/supabaseService';

const AdministradorasTable = ({ adicionarParadaRoteiro, addNotification }) => {
  // Estados
  const [administradoras, setAdministradoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cidadeSelecionada, setCidadeSelecionada] = useState('');
  const [atualizandoGoogle, setAtualizandoGoogle] = useState(false);
  const [atualizandoContato, setAtualizandoContato] = useState({});

  // Lista de cidades
  const cidades = [
    'Guarujá',
    'Bertioga', 
    'Santos',
    'São Vicente',
    'Praia Grande',
    'Cubatão',
    'São Sebastião'
  ];

  // Carregar dados ao montar componente
  useEffect(() => {
    carregarDados();
  }, [cidadeSelecionada]);

  // Funções
  const carregarDados = async () => {
    try {
      setLoading(true);
      const dados = await administradorasService.buscarAdministradoras(cidadeSelecionada || null);
      setAdministradoras(dados);
    } catch (error) {
      console.error('Erro ao carregar administradoras:', error);
      addNotification?.('Erro ao carregar dados das administradoras', 'error');
    } finally {
      setLoading(false);
    }
  };

  const atualizarDadosGoogle = async () => {
    if (!cidadeSelecionada) {
      addNotification?.('Selecione uma cidade para atualizar os dados', 'warning');
      return;
    }

    try {
      setAtualizandoGoogle(true);
      
      addNotification?.('Iniciando busca no Google Maps... Isso pode levar alguns minutos.', 'success');
      
      const novasAdministradoras = await administradorasService.buscarAdministradorasGoogle(cidadeSelecionada);
      
      if (novasAdministradoras.length > 0) {
        addNotification?.(`${novasAdministradoras.length} nova(s) administradora(s) encontrada(s) e salva(s)!`, 'success');
        await carregarDados(); // Recarregar dados
      } else {
        addNotification?.('Nenhuma nova administradora encontrada para esta cidade', 'warning');
      }
    } catch (error) {
      console.error('Erro ao atualizar dados do Google:', error);
      if (error.message.includes('Google Maps API não está carregada')) {
        addNotification?.('Google Maps API não carregada. Verifique a configuração da chave de API.', 'error');
      } else {
        addNotification?.(error.message || 'Erro ao buscar dados do Google Maps', 'error');
      }
    } finally {
      setAtualizandoGoogle(false);
    }
  };

  const alterarContatoRealizado = async (id, novoStatus) => {
    try {
      setAtualizandoContato(prev => ({ ...prev, [id]: true }));
      
      await administradorasService.atualizarContatoRealizado(id, novoStatus);
      
      // Atualizar estado local
      setAdministradoras(prev => prev.map(admin => 
        admin.id === id ? { ...admin, contato_realizado: novoStatus } : admin
      ));
      
      addNotification?.(`Contato marcado como ${novoStatus ? 'realizado' : 'não realizado'}`, 'success');
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      addNotification?.('Erro ao atualizar status do contato', 'error');
    } finally {
      setAtualizandoContato(prev => ({ ...prev, [id]: false }));
    }
  };

  const adicionarAoRoteiro = (endereco, nome) => {
    if (adicionarParadaRoteiro) {
      adicionarParadaRoteiro(endereco);
      addNotification?.(`"${nome}" adicionado como parada no roteiro`, 'success');
    } else {
      addNotification?.('Função de adicionar ao roteiro não disponível', 'error');
    }
  };

  const formatarTelefone = (telefone) => {
    if (!telefone) return '';
    // Remove todos os caracteres não numéricos
    const numeros = telefone.replace(/\D/g, '');
    // Se tem código do país, remove
    if (numeros.startsWith('55') && numeros.length > 11) {
      return numeros.substring(2);
    }
    return numeros;
  };

  const criarLinkTelefone = (telefone) => {
    const numeroFormatado = formatarTelefone(telefone);
    if (!numeroFormatado) return '#';
    return `tel:+55${numeroFormatado}`;
  };

  const criarLinkWhatsApp = (telefone) => {
    const numeroFormatado = formatarTelefone(telefone);
    if (!numeroFormatado) return '#';
    return `https://wa.me/55${numeroFormatado}`;
  };

  const filtrarPorCidade = () => {
    if (!cidadeSelecionada) return administradoras;
    return administradoras.filter(admin => admin.cidade === cidadeSelecionada);
  };

  const dadosFiltrados = filtrarPorCidade();

  return (
    <div className="bg-white rounded-xl shadow-xl p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          🏢 Dados de Administradoras e Síndicos Profissionais
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Filtro de cidade */}
          <select
            value={cidadeSelecionada}
            onChange={(e) => setCidadeSelecionada(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todas as cidades</option>
            {cidades.map(cidade => (
              <option key={cidade} value={cidade}>{cidade}</option>
            ))}
          </select>

          {/* Botão de atualizar dados do Google */}
          <button
            onClick={atualizarDadosGoogle}
            disabled={atualizandoGoogle || !cidadeSelecionada}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
          >
            {atualizandoGoogle ? (
              <>
                <FaSpinner className="animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <FaSync />
                Atualizar Google
              </>
            )}
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {dadosFiltrados.length}
          </div>
          <div className="text-sm text-gray-600">Total de Administradoras</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {dadosFiltrados.filter(admin => admin.contato_realizado).length}
          </div>
          <div className="text-sm text-gray-600">Contatos Realizados</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {dadosFiltrados.filter(admin => !admin.contato_realizado).length}
          </div>
          <div className="text-sm text-gray-600">Pendentes</div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <FaSpinner className="animate-spin text-4xl text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Carregando administradoras...</p>
          </div>
        </div>
      ) : dadosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FaGlobe className="text-4xl mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">
            {cidadeSelecionada 
              ? `Nenhuma administradora encontrada em ${cidadeSelecionada}`
              : 'Nenhuma administradora cadastrada'
            }
          </p>
          <p className="text-sm">
            {cidadeSelecionada 
              ? 'Clique em "Atualizar Google" para buscar automaticamente'
              : 'Selecione uma cidade e clique em "Atualizar Google"'
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
          <table className="w-full text-sm text-left">{" "}
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Endereço</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Contato Realizado?</th>
              </tr>
            </thead>
            <tbody>
              {dadosFiltrados.map((admin) => (
                <tr 
                  key={admin.id} 
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    admin.contato_realizado ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Nome */}
                  <td className="px-4 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {admin.rating && (
                        <span className="text-yellow-500 text-xs">
                          ⭐ {admin.rating.toFixed(1)}
                        </span>
                      )}
                      <span>{admin.nome}</span>
                    </div>
                  </td>

                  {/* Endereço com botão de adicionar ao roteiro */}
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-gray-600">{admin.endereco || '-'}</span>
                      {admin.endereco && (
                        <button
                          onClick={() => adicionarAoRoteiro(admin.endereco, admin.nome)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                          title="Adicionar ao roteiro"
                        >
                          <FaPlus />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Site */}
                  <td className="px-4 py-4">
                    {admin.site ? (
                      <a 
                        href={admin.site.startsWith('http') ? admin.site : `https://${admin.site}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FaGlobe className="text-sm" />
                        Site
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  {/* Telefone */}
                  <td className="px-4 py-4">
                    {admin.telefone ? (
                      <a 
                        href={criarLinkTelefone(admin.telefone)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FaPhone className="text-sm" />
                        {admin.telefone}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  {/* WhatsApp */}
                  <td className="px-4 py-4">
                    {admin.whatsapp ? (
                      <a 
                        href={criarLinkWhatsApp(admin.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 flex items-center gap-1"
                      >
                        <FaWhatsapp className="text-sm" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>

                  {/* Contato Realizado */}
                  <td className="px-4 py-4">
                    <button
                      onClick={() => alterarContatoRealizado(admin.id, !admin.contato_realizado)}
                      disabled={atualizandoContato[admin.id]}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
                        admin.contato_realizado
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {atualizandoContato[admin.id] ? (
                        <FaSpinner className="animate-spin text-xs" />
                      ) : admin.contato_realizado ? (
                        <FaCheck className="text-xs" />
                      ) : (
                        <FaTimes className="text-xs" />
                      )}
                      {admin.contato_realizado ? 'Sim' : 'Não'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdministradorasTable;