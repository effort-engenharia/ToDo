import { agruparPorUsuario, somarDias } from '../../capacidade/calculos';

// Carga da semana por técnico a partir das linhas de execucao_capacidade (minutos)
// Retorna [{ usuarioId, nome, previstoMin, disponivelMin, percentual, situacao }] do mais ao menos carregado
// e o total de minutos sem técnico.
export const resumirCargaSemana = (linhas, nomes) => {
  const porUsuario = agruparPorUsuario(linhas ?? []);
  const tecnicos = [];
  let semTecnicoMin = 0;

  porUsuario.forEach((dias, usuarioId) => {
    const lista = [...dias.values()];
    if (usuarioId === null) {
      semTecnicoMin = lista.reduce((soma, d) => soma + (d.previsto_min ?? 0), 0);
      return;
    }
    const total = somarDias(lista);
    // Técnico sem atividade e sem jornada na semana não entra no resumo
    if (total.previsto_min === 0 && total.disponivel_min === 0) return;
    tecnicos.push({
      usuarioId,
      nome: nomes.get(usuarioId) ?? 'Técnico',
      previstoMin: total.previsto_min,
      disponivelMin: total.disponivel_min,
      percentual: total.disponivel_min > 0 ? Math.round((total.previsto_min / total.disponivel_min) * 100) : (total.previsto_min > 0 ? null : 0),
      situacao: total.situacao,
      conflitos: total.conflitos
    });
  });

  tecnicos.sort((a, b) => (b.percentual ?? Infinity) - (a.percentual ?? Infinity) || a.nome.localeCompare(b.nome));
  return { tecnicos, semTecnicoMin };
};
