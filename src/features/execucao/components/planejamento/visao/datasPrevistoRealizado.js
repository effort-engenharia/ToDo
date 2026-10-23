import { useMemo } from 'react';
import { execucaoPlanejamentoService as servico } from '../../../../../services/supabase/execucaoPlanejamento';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { formatarDataBR, parseDataLocal } from '../../../utils/datas';
import { deslocamentoUteis } from '../utils';

// Desvio em dias úteis (seg–sex) entre a data prevista e a real; positivo = depois do previsto
export const desvioEmDiasUteis = (previsto, real) => {
  const a = parseDataLocal(previsto);
  const b = parseDataLocal(real);
  return a && b ? deslocamentoUteis(a, b, null) : null;
};

export const textoDesvio = (desvio) => {
  if (desvio === null || desvio === 0) return 'no previsto';
  return `${desvio > 0 ? '+' : ''}${desvio} d.u.`;
};

export const classeDesvio = (desvio) => {
  if (desvio === null || desvio === 0) return 'text-emerald-400';
  return desvio > 0 ? 'text-red-400' : 'text-sky-300';
};

// Horas previstas × realizadas por etapa. Só consulta com a obra expandida (nada de N+1 na lista).
export const useHorasDasEtapas = (etapas, ativo) => {
  const chave = useMemo(() => (etapas ?? []).map((e) => e.id).sort().join(','), [etapas]);
  const horas = useAsyncData(
    () => (ativo && chave ? servico.buscarHorasDasEtapas(chave.split(',')) : { success: true, data: {} }),
    [ativo, chave]
  );
  return horas.data ?? {};
};

export const linhaDatas = (rotulo, previsto, real) => {
  const desvio = real ? desvioEmDiasUteis(previsto, real) : null;
  return { rotulo, previsto: formatarDataBR(previsto), real: real ? formatarDataBR(real) : null, desvio };
};
