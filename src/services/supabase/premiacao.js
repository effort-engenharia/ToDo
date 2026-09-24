import { supabase } from './config.js';
import { configuracoesService } from './configuracoes.js';
import { metasService } from './metas.js';
import { wrapServiceWithImpersonationGuard } from '../../utils/impersonationGuard.js';
import {
  CHAVE_CONFIG_PREMIACAO,
  TIPOS_META_PREMIACAO,
  mesclarConfigPremiacao,
} from '../../config/premiacao.js';
import { metasValidas, normalizarNome } from '../../utils/premiacao.js';

// `mes` sempre 1-12 referente ao MÊS COMERCIAL (não ao mês do relógio).
const _premiacaoService = {
  async obterConfig() {
    const res = await configuracoesService.obterConfiguracao(CHAVE_CONFIG_PREMIACAO);
    if (!res.success) throw new Error(res.message || 'Erro ao ler configuração de premiação');
    return {
      config: mesclarConfigPremiacao(res.valor),
      existe: !!res.valor,
      atualizadoEm: res.atualizado_em || null,
      atualizadoPor: res.atualizado_por || null,
    };
  },

  async salvarConfig(config, atualizadoPor = null) {
    const normalizada = mesclarConfigPremiacao(config);
    const res = await configuracoesService.salvarConfiguracao(
      CHAVE_CONFIG_PREMIACAO,
      JSON.stringify(normalizada),
      atualizadoPor
    );
    if (!res.success) throw new Error(res.message || 'Erro ao salvar configuração de premiação');
    return normalizada;
  },

  async buscarMetas(ano, mes) {
    const { data, error } = await supabase
      .from('metas_comerciais')
      .select('tipo_meta, valor_meta')
      .in('tipo_meta', [...Object.values(TIPOS_META_PREMIACAO), 'valor_entrada'])
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('ativo', true);

    if (error) throw error;

    const valor = (tipo) => {
      const linha = (data || []).find((m) => m.tipo_meta === tipo);
      return linha ? Number(linha.valor_meta) || 0 : 0;
    };

    return {
      base: valor(TIPOS_META_PREMIACAO.base),
      ideal: valor(TIPOS_META_PREMIACAO.ideal),
      plus: valor(TIPOS_META_PREMIACAO.plus),
      sugestaoIdeal: valor('valor_entrada'),
    };
  },

  async salvarMetas(ano, mes, { base, ideal, plus }, atualizadoPor = null) {
    const metas = { base: Number(base), ideal: Number(ideal), plus: Number(plus) };
    if (!metasValidas(metas)) {
      throw new Error('As metas devem ser maiores que zero e obedecer: Meta Base < Meta Ideal < Meta Ideal Plus.');
    }
    const obs = `Premiação ${String(mes).padStart(2, '0')}/${ano} — salvo por ${atualizadoPor || 'admin'} em ${new Date().toLocaleString('pt-BR')}`;
    await metasService.salvarMeta(TIPOS_META_PREMIACAO.base, metas.base, mes, ano, obs);
    await metasService.salvarMeta(TIPOS_META_PREMIACAO.ideal, metas.ideal, mes, ano, obs);
    await metasService.salvarMeta(TIPOS_META_PREMIACAO.plus, metas.plus, mes, ano, obs);
    return metas;
  },

  /** Nomes de vendedor conhecidos (usuários vinculados + donos de apontamentos). */
  async listarNomesVendedores() {
    const [usuarios, apontamentos] = await Promise.all([
      supabase.from('usuarios').select('nome_vendedor_comercial'),
      supabase.from('apontamentos_comerciais').select('proprietario_relacionamento').limit(5000),
    ]);
    const nomes = new Set();
    (usuarios.data || []).forEach((u) => {
      const n = normalizarNome(u.nome_vendedor_comercial);
      if (n) nomes.add(n);
    });
    (apontamentos.data || []).forEach((a) => {
      const n = normalizarNome(a.proprietario_relacionamento);
      if (n) nomes.add(n);
    });
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },
};

export const premiacaoService = wrapServiceWithImpersonationGuard(_premiacaoService, {
  label: 'premiacaoService',
  throwOnBlock: true,
});

export default premiacaoService;
