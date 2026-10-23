import { useCallback, useMemo } from 'react';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { addDias, dataLocalISO } from '../../../utils/datas';
import { criarCalendario } from '../utils';

const VAZIO = { tiposServico: [], cidades: [], feriados: [], feriadosCarregados: false };

// Tipos de serviço, cidades e feriados usados pelo cadastro (carregados uma vez por modal).
// Falhas parciais não impedem o cadastro: sem feriados, o cálculo considera só fins de semana.
export function useDadosCadastro() {
  const { data, loading, error } = useAsyncData(async () => {
    const hoje = new Date();
    const [tipos, cidades, feriados] = await Promise.all([
      execucaoPlanejamentoService.listarTiposServico(),
      execucaoPlanejamentoService.listarCidades(),
      execucaoPlanejamentoService.listarFeriados({
        inicio: dataLocalISO(addDias(hoje, -60)),
        fim: dataLocalISO(addDias(hoje, 365 * 3))
      })
    ]);
    return {
      success: true,
      data: {
        tiposServico: tipos.success ? tipos.data : [],
        cidades: cidades.success ? cidades.data : [],
        feriados: feriados.success ? feriados.data : [],
        feriadosCarregados: feriados.success
      }
    };
  }, []);

  const dados = data ?? VAZIO;
  const { cidades, feriados } = dados;

  const calendarioDe = useCallback(
    (cidadeId) => criarCalendario(feriados, cidades.find((c) => c.id === cidadeId) ?? null),
    [feriados, cidades]
  );

  const tiposExecucao = useMemo(
    () => dados.tiposServico.filter((t) => t.equipe_responsavel !== 'orcamentos'),
    [dados.tiposServico]
  );

  return { ...dados, tiposExecucao, calendarioDe, carregando: loading, erro: error };
}
