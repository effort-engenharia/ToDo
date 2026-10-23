import { useCallback, useMemo } from 'react';
import { execucaoCapacidadeService } from '../../../../../services/supabase/execucaoCapacidade';
import { execucaoPlanejamentoService as servico } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { intervaloSemana } from '../../../utils/datas';
import { resumirCargaSemana } from './carga';
import { indexarSaude } from './saude';

// Carrega, em paralelo e de forma independente, tudo o que a visão do todo precisa.
// Uma falha em um bloco (ex.: RPC indisponível) não derruba os demais.
export const useVisaoCarteira = (tecnicos) => {
  const painel = useAsyncData(() => servico.buscarPainelCarteira(), []);
  const saude = useAsyncData(() => servico.buscarSaudeObras(), []);
  const resumo = useAsyncData(() => servico.buscarObrasAbertasResumo(), []);
  const pendencias = useAsyncData(() => servico.listarPendenciasReplanejamento(), []);
  const capacidade = useAsyncData(() => {
    const semana = intervaloSemana();
    return execucaoCapacidadeService.buscarCapacidade(semana.inicio, semana.fim);
  }, []);

  const { reload: recarregarPainel } = painel;
  const { reload: recarregarSaude } = saude;
  const { reload: recarregarResumo } = resumo;
  const { reload: recarregarPendencias } = pendencias;
  const { reload: recarregarCapacidade } = capacidade;

  const recarregar = useCallback(() => {
    recarregarPainel();
    recarregarSaude();
    recarregarResumo();
    recarregarPendencias();
    recarregarCapacidade();
  }, [recarregarPainel, recarregarSaude, recarregarResumo, recarregarPendencias, recarregarCapacidade]);

  const saudePorObra = useMemo(() => indexarSaude(saude.data), [saude.data]);

  const nomes = useMemo(() => new Map((tecnicos ?? []).map((t) => [t.id, t.nome_completo])), [tecnicos]);
  const carga = useMemo(() => resumirCargaSemana(capacidade.data, nomes), [capacidade.data, nomes]);

  return { painel, saude, resumo, pendencias, capacidade, saudePorObra, carga, recarregar };
};
