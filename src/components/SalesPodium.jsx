import React, { useState, useEffect } from 'react';
import { FaTrophy } from 'react-icons/fa';
import PodiumCard from './PodiumCard';
import { supabaseService } from '../services/supabaseService';

const SalesPodium = ({ vendedoresReais = [] }) => {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Carregar vendedores do Supabase
  const carregarVendedores = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Se temos dados reais da planilha, vamos sincronizar com o Supabase
      if (vendedoresReais && vendedoresReais.length > 0) {
        await sincronizarVendedoresComPlanilha();
        return;
      }
      
      // Se não há dados reais da planilha, significa que não há dados para o período
      // Exibir estado vazio em vez de criar dados de exemplo ou buscar dados antigos
      console.log('📊 Sem dados de vendedores para o período atual - exibindo estado vazio');
      setVendedores([]);
      
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
      setError('Erro ao carregar dados dos vendedores');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar vendedores da planilha com o Supabase
  const sincronizarVendedoresComPlanilha = async () => {
    try {
      console.log('🔄 Sincronizando vendedores da planilha:', vendedoresReais);
      
      // Primeiro, buscar vendedores existentes no Supabase
      const { data: existentes } = await supabaseService.client
        .from('vendedores')
        .select('*');

      const vendedoresAtualizados = [];

      // Para cada vendedor da planilha, atualizar ou criar no Supabase
      for (let i = 0; i < Math.min(vendedoresReais.length, 3); i++) {
        const vendedorPlanilha = vendedoresReais[i];
        const valorTotal = vendedorPlanilha.valor || 0;
        const comissao = valorTotal * 0.01;
        
        // Buscar se já existe no Supabase pelo nome
        const existente = existentes?.find(v => 
          v.nome.toLowerCase() === vendedorPlanilha.vendedor.toLowerCase()
        );

        if (existente) {
          // Atualizar vendedor existente
          const { data: updated, error } = await supabaseService.client
            .from('vendedores')
            .update({
              total_vendas_mes: valorTotal,
              comissao_mes: comissao,
              posicao_ranking: i + 1
            })
            .eq('id', existente.id)
            .select()
            .single();

          if (error) throw error;
          vendedoresAtualizados.push(updated);
        } else {
          // Criar novo vendedor
          const { data: created, error } = await supabaseService.client
            .from('vendedores')
            .insert({
              nome: vendedorPlanilha.vendedor,
              email: `${vendedorPlanilha.vendedor.toLowerCase().replace(/\s+/g, '.')}@exemplo.com`,
              total_vendas_mes: valorTotal,
              comissao_mes: comissao,
              posicao_ranking: i + 1
            })
            .select()
            .single();

          if (error) throw error;
          vendedoresAtualizados.push(created);
        }
      }

      console.log('✅ Vendedores sincronizados:', vendedoresAtualizados);
      setVendedores(vendedoresAtualizados);
    } catch (err) {
      console.error('Erro ao sincronizar vendedores:', err);
      setError('Erro ao sincronizar vendedores');
      // Fallback: usar dados da planilha diretamente
      usarDadosPlanilhaDiretamente();
    }
  };

  // Usar dados da planilha diretamente como fallback
  const usarDadosPlanilhaDiretamente = () => {
    const vendedoresPlanilha = vendedoresReais.slice(0, 3).map((vendedor, index) => ({
      id: `planilha-${index}`,
      nome: vendedor.vendedor,
      email: `${vendedor.vendedor.toLowerCase().replace(/\s+/g, '.')}@exemplo.com`,
      foto_url: null,
      total_vendas_mes: vendedor.valor || 0,
      comissao_mes: (vendedor.valor || 0) * 0.01,
      posicao_ranking: index + 1,
      ativo: true
    }));
    
    console.log('📊 Usando dados da planilha diretamente:', vendedoresPlanilha);
    setVendedores(vendedoresPlanilha);
  };

  // Upload de foto
  const handleFotoUpload = async (vendedorId, file) => {
    try {
      setUploading(true);
      setError(null);
      
      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WebP.');
      }

      // Validar tamanho (1MB)
      if (file.size > 1048576) {
        throw new Error('Arquivo muito grande. Máximo 1MB.');
      }
      
      // Gerar nome único para o arquivo
      const fileExtension = file.name.split('.').pop();
      const fileName = `${vendedorId}_${Date.now()}.${fileExtension}`;
      
      console.log('📤 Iniciando upload:', { fileName, fileSize: file.size, fileType: file.type });
      
      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseService.client.storage
        .from('vendedores-fotos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Permitir sobrescrita se arquivo já existir
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload realizado:', uploadData);

      // Obter URL pública da foto
      const { data: { publicUrl } } = supabaseService.client.storage
        .from('vendedores-fotos')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública gerada:', publicUrl);

      // Atualizar vendedor com a nova foto
      const { error: updateError } = await supabaseService.client
        .from('vendedores')
        .update({ foto_url: publicUrl })
        .eq('id', vendedorId);

      if (updateError) {
        console.error('Erro ao atualizar vendedor:', updateError);
        throw updateError;
      }

      // Atualizar estado local
      setVendedores(prev => prev.map(v => 
        v.id === vendedorId ? { ...v, foto_url: publicUrl } : v
      ));

      console.log('✅ Foto atualizada com sucesso!');

    } catch (err) {
      console.error('Erro ao fazer upload da foto:', err);
      let errorMessage = 'Erro ao fazer upload da foto';
      
      if (err.message.includes('row-level security')) {
        errorMessage = 'Erro de permissão. Tentando novamente...';
        // Tentar novamente após um pequeno delay
        setTimeout(() => handleFotoUpload(vendedorId, file), 1000);
        return;
      } else if (err.message.includes('Tipo de arquivo')) {
        errorMessage = err.message;
      } else if (err.message.includes('muito grande')) {
        errorMessage = err.message;
      } else if (err.message.includes('duplicate')) {
        errorMessage = 'Arquivo já existe. Tente renomear o arquivo.';
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };



  useEffect(() => {
    carregarVendedores();
  }, [vendedoresReais]); // Recarregar quando os dados da planilha mudarem

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-purple-600">Carregando podium...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FaTrophy className="text-3xl text-purple-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              🏆 Podium dos Campeões
            </h2>
            <p className="text-gray-600 text-sm">
              Top 3 vendedores do mês
            </p>
          </div>
        </div>
      </div>

      {/* Error e Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
          <span className="mr-2">❌</span>
          {error}
        </div>
      )}

      {uploading && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-3"></div>
          📤 Fazendo upload da foto...
        </div>
      )}

      {/* Podium Cards ou Mensagem Sem Dados */}
      {vendedores.length === 0 ? (
        /* Mensagem quando não há dados */
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Sem dados disponíveis
            </h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Não há vendas registradas para o período atual. 
              Vendas aparecerão aqui quando houver apontamentos com fase "CONTRATO/VENDA".
            </p>
          </div>
        </div>
      ) : (
        /* Podium normal quando há dados */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-end">
          {/* 2º Lugar - Esquerda */}
          <div className="flex flex-col items-center order-2 lg:order-1">
            {vendedores[1] && (
              <div className="lg:mt-8">
                <PodiumCard
                  key={vendedores[1].id}
                  vendedor={vendedores[1]}
                  posicao={2}
                  onFotoUpload={handleFotoUpload}
                />
              </div>
            )}
          </div>
          
          {/* 1º Lugar - Centro (Destacado) */}
          <div className="flex flex-col items-center order-1 lg:order-2">
            {vendedores[0] && (
              <div className="transform lg:scale-105">
                <PodiumCard
                  key={vendedores[0].id}
                  vendedor={vendedores[0]}
                  posicao={1}
                  onFotoUpload={handleFotoUpload}
                />
              </div>
            )}
          </div>
          
          {/* 3º Lugar - Direita */}
          <div className="flex flex-col items-center order-3">
            {vendedores[2] && (
              <div className="lg:mt-16">
                <PodiumCard
                  key={vendedores[2].id}
                  vendedor={vendedores[2]}
                  posicao={3}
                  onFotoUpload={handleFotoUpload}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPodium;