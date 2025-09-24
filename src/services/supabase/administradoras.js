import { supabase } from './config.js';

// Serviços para administradoras e síndicos profissionais
export const administradorasService = {
  // Buscar administradoras e síndicos
  async buscarAdministradoras(cidade = null) {
    try {
      let query = supabase
        .from('administradoras_sindicos')
        .select('*')
        .order('contato_realizado', { ascending: true })
        .order('nome', { ascending: true });

      if (cidade) {
        query = query.eq('cidade', cidade);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar administradoras:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço de busca de administradoras:', error);
      throw error;
    }
  },

  // Criar nova administradora/síndico
  async criarAdministradora(dados) {
    try {
      // Usar upsert (insert ou update) com place_id como chave única
      const { data, error } = await supabase
        .from('administradoras_sindicos')
        .upsert({
          nome: dados.nome,
          endereco: dados.endereco,
          site: dados.site,
          telefone: dados.telefone,
          whatsapp: dados.whatsapp,
          cidade: dados.cidade,
          latitude: dados.latitude,
          longitude: dados.longitude,
          place_id: dados.place_id,
          rating: dados.rating,
          last_google_sync: new Date().toISOString()
        }, {
          onConflict: 'place_id', // Resolver conflitos baseado no place_id
          ignoreDuplicates: false // Atualizar se já existir
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar administradora:', error);
        throw error;
      }

      return data;
    } catch (error) {
      // Tratar erros de duplicata que podem vir do catch também
      if (error.code === '23505' && error.details?.includes('place_id')) {
        console.log(`📋 Administradora "${dados.nome}" já existe no banco (place_id: ${dados.place_id})`);
        return null;
      }
      
      console.error('Erro no serviço de criação de administradora:', error);
      throw error;
    }
  },

  // Atualizar contato realizado
  async atualizarContatoRealizado(id, contatoRealizado) {
    try {
      const { data, error } = await supabase
        .from('administradoras_sindicos')
        .update({ contato_realizado: contatoRealizado })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar contato realizado:', error);
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Erro no serviço de atualização de contato:', error);
      throw error;
    }
  },

  // Buscar administradoras usando Google Places API
  async buscarAdministradorasGoogle(cidade) {
    try {
      // Carregar Google Maps API se necessário
      await this.carregarGoogleMapsAPI();

      // Verificar se Google Maps API está carregada
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        throw new Error('Google Maps API não está carregada ou Places library não disponível');
      }

      console.log(`🔍 Iniciando busca para ${cidade}`);

      // Palavras-chave para busca
      const palavrasChave = [
        'administradoras de condomínios',
        'administradora de condomínios',
        'administradora predial',
        'gestão condominial',
        'síndico profissional',
        'administradora imobiliária',
        'gestão de condomínios',
        'condomínio administração',
        'consultoria condominial',
        'empresa de administração predial',
        'síndico terceirizado',
        'síndico externo',
        'gestor condominial',
        'consultor condominial',
        'imobiliária',
        'assessoria condominial',
        'consultoria predial',
        'empresa de administração de imóveis'
      ];

      const resultados = [];
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));

      // Buscar coordenadas da cidade primeiro
      const geocoder = new window.google.maps.Geocoder();
      const cidadeCoords = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: `${cidade}, Brasil` }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve(results[0].geometry.location);
          } else {
            reject(new Error(`Não foi possível geocodificar a cidade: ${cidade}`));
          }
        });
      });

      console.log(`📍 Coordenadas de ${cidade}:`, cidadeCoords.lat(), cidadeCoords.lng());

      // Buscar para cada palavra-chave
      for (let i = 0; i < palavrasChave.length; i++) {
        const palavra = palavrasChave[i];
        
        try {
          console.log(`🔍 Buscando: "${palavra}" em ${cidade} (${i + 1}/${palavrasChave.length})`);
          
          const request = {
            query: `${palavra} ${cidade}`,
            location: cidadeCoords,
            radius: 25000, // 25km de raio
            language: 'pt-BR',
            region: 'BR'
          };

          const places = await new Promise((resolve, reject) => {
            service.textSearch(request, (results, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                resolve(results || []);
              } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
              } else {
                console.warn(`⚠️ Erro na busca para "${palavra}": ${status}`);
                resolve([]);
              }
            });
          });

          console.log(`✅ Encontrados ${places.length} resultados para "${palavra}"`);

          for (const place of places) {
            try {
              // Tentar salvar diretamente - se der erro de duplicata, ignorar
              const novaAdministradora = {
                nome: place.name,
                endereco: place.formatted_address || '',
                site: '',
                telefone: '',
                whatsapp: '',
                cidade: cidade,
                latitude: place.geometry?.location?.lat(),
                longitude: place.geometry?.location?.lng(),
                place_id: place.place_id,
                rating: place.rating
              };

              // Buscar detalhes adicionais se necessário
              try {
                const detalhes = await this.buscarDetalhesLugarBrowser(place.place_id, service);
                novaAdministradora.site = detalhes.website || '';
                novaAdministradora.telefone = detalhes.formatted_phone_number || '';
                novaAdministradora.whatsapp = detalhes.formatted_phone_number || '';
              } catch (detError) {
                console.warn(`⚠️ Erro ao buscar detalhes para ${place.name}:`, detError);
              }

              resultados.push(novaAdministradora);
              console.log(`➕ Nova administradora: ${place.name}`);
            } catch (error) {
              console.warn(`❌ Erro ao processar ${place.name}:`, error);
              continue;
            }
          }

          // Pausa entre requests para evitar rate limiting
          if (i < palavrasChave.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn(`❌ Erro na busca para "${palavra}":`, error);
          continue;
        }
      }

      console.log(`🎯 Total de novas administradoras encontradas: ${resultados.length}`);

      // Salvar resultados únicos no banco usando upsert
      const administradorasSalvas = [];
      
      for (const administradora of resultados) {
        try {
          const salva = await this.criarAdministradora(administradora);
          if (salva) {
            administradorasSalvas.push(salva);
            console.log(`💾 Salva: ${administradora.nome}`);
          }
        } catch (error) {
          console.warn('❌ Erro ao salvar administradora:', error);
        }
      }

      console.log(`✨ Processo concluído! ${administradorasSalvas.length} administradoras processadas`);
      return administradorasSalvas;
    } catch (error) {
      console.error('💥 Erro na busca do Google:', error);
      throw error;
    }
  },

  // Função para carregar Google Maps API dinamicamente
  async carregarGoogleMapsAPI() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve(window.google.maps);
        return;
      }
      
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey || apiKey === 'sua_chave_aqui') {
        reject(new Error('API key do Google Maps não configurada'));
        return;
      }
      
      // Remover script anterior se existir
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=pt-BR&region=BR`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('✅ Google Maps API carregada com sucesso');
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps API falhou ao carregar'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Erro ao carregar Google Maps API. Verifique a chave de API.'));
      };
      
      document.head.appendChild(script);
    });
  },

  // Buscar detalhes adicionais de um lugar usando o browser
  async buscarDetalhesLugarBrowser(placeId, service) {
    try {
      const request = {
        placeId: placeId,
        fields: ['website', 'formatted_phone_number', 'international_phone_number']
      };

      return await new Promise((resolve) => {
        service.getDetails(request, (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            resolve({
              website: place.website || '',
              formatted_phone_number: place.formatted_phone_number || '',
              international_phone_number: place.international_phone_number || ''
            });
          } else {
            resolve({});
          }
        });
      });
    } catch (error) {
      console.warn('Erro ao buscar detalhes do lugar:', error);
      return {};
    }
  },

  // Verificar se precisa atualizar dados (semanal)
  async verificarAtualizacaoSemanal(cidade) {
    try {
      const { data } = await supabase
        .from('administradoras_sindicos')
        .select('last_google_sync')
        .eq('cidade', cidade)
        .order('last_google_sync', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return true; // Primeira busca para esta cidade
      }

      const ultimaAtualizacao = new Date(data[0].last_google_sync);
      const agora = new Date();
      const diferenca = agora - ultimaAtualizacao;
      const umaSemana = 7 * 24 * 60 * 60 * 1000; // Uma semana em millisegundos

      return diferenca >= umaSemana;
    } catch (error) {
      console.error('Erro ao verificar atualização semanal:', error);
      return true; // Em caso de erro, permite atualização
    }
  }
};