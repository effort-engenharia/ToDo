import { supabase } from './config.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';

export const BUCKET_EVIDENCIAS = 'atividades-evidencias';
const URL_ASSINADA_SEGUNDOS = 3600;
const COLUNAS = `id, atividade_id, tipo, caminho_storage, caminho_miniatura, mime_type, tamanho_original_bytes,
  tamanho_bytes, duracao_segundos, comprimido, conteudo, capturado_em, latitude, longitude, precisao_metros,
  criado_por, created_at`;

// Convenção do bucket: o 1º segmento do caminho é o id da atividade (política execucao_participa_path)
export const caminhoEvidencia = (atividadeId, evidenciaId, extensao, miniatura = false) =>
  `${atividadeId}/${evidenciaId}${miniatura ? '_thumb' : ''}.${extensao}`;

const jaExiste = (error) => {
  const texto = `${error?.statusCode ?? ''} ${error?.status ?? ''} ${error?.error ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return texto.includes('409') || texto.includes('already exists') || texto.includes('duplicate');
};

const _execucaoEvidenciasService = {
  // Idempotente: "já existe" (reenvio após falha de rede no meio do upload) conta como sucesso
  async uploadEvidenciaArquivo(caminho, blob, contentType) {
    const { error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(caminho, blob, { contentType, upsert: false, cacheControl: '31536000' });
    if (error && !jaExiste(error)) throw error;
    return { success: true, existente: !!error };
  },

  // O id da evidência é gerado no celular: violação de chave (23505) significa que já foi gravada
  async inserirEvidencia(linha) {
    const { error } = await supabase.from('execucao_atividades_evidencias').insert(linha);
    if (error && error.code !== '23505') throw error;
    return { success: true, existente: !!error };
  },

  // Evidências já enviadas de uma atividade, com URLs assinadas (bucket privado)
  async listarEvidencias(atividadeId) {
    const consultar = (colunas) => supabase
      .from('execucao_atividades_evidencias')
      .select(colunas)
      .eq('atividade_id', atividadeId)
      .is('excluido_em', null)
      .order('capturado_em', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    let { data, error } = await consultar(`${COLUNAS}, autor:usuarios!criado_por(id, nome_completo)`);
    if (error) ({ data, error } = await consultar(COLUNAS)); // o nome do autor é opcional
    if (error) throw error;

    const linhas = data ?? [];
    const caminhos = linhas.flatMap((l) => [l.caminho_storage, l.caminho_miniatura]).filter(Boolean);
    const urls = new Map();
    if (caminhos.length) {
      const { data: assinadas } = await supabase.storage
        .from(BUCKET_EVIDENCIAS)
        .createSignedUrls(caminhos, URL_ASSINADA_SEGUNDOS);
      for (const s of assinadas ?? []) if (s.signedUrl) urls.set(s.path, s.signedUrl);
    }

    return linhas.map((l) => ({
      ...l,
      url: urls.get(l.caminho_storage) ?? null,
      url_miniatura: urls.get(l.caminho_miniatura) ?? null
    }));
  },

  // { [atividadeId]: quantidade } para exibir selos "📎 3" sem baixar as evidências
  async contarEvidencias(atividadeIds) {
    const ids = [...new Set((atividadeIds ?? []).filter(Boolean))];
    if (!ids.length) return {};
    const { data, error } = await supabase
      .from('execucao_atividades_evidencias')
      .select('atividade_id')
      .in('atividade_id', ids)
      .is('excluido_em', null);
    if (error) throw error;
    const contagem = {};
    for (const l of data ?? []) contagem[l.atividade_id] = (contagem[l.atividade_id] ?? 0) + 1;
    return contagem;
  }
};

export const execucaoEvidenciasService = wrapServiceWithImpersonationGuard(_execucaoEvidenciasService, {
  label: 'execucaoEvidenciasService',
  throwOnBlock: true
});

export default execucaoEvidenciasService;
