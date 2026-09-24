import { useMemo } from 'react';
import { intervaloDoMesComercial } from '../../../utils/periodoComercial';
import { semanasDoMesComercial } from '../../../utils/semanasComercial';
import { medalhaPara } from '../../../utils/effortTheme';
import { CLASSIFICACOES } from '../../../config/premiacao';

/**
 * useGamification — Agrega métricas de gamificação do vendedor logado.
 *
 * Retorna:
 * - medalhaAtual: objeto de medalhas (bronze/prata/ouro/diamante) ou null
 * - percentual: 0..∞ do vendedor vs meta individual
 * - streakSemanas: número de semanas consecutivas com pelo menos 1 venda
 * - badgesEspeciais: array de badges conquistados
 *   - primeiraVendaMes
 *   - maiorVendaMes
 *   - todasSemanasVenderam (streak 4 no mês)
 */
export function useGamification({
  allData = [],
  dashboardData,
  metaPersonalizada,
  ano,
  mes,
  nomeVendedor,
  premiacao,
}) {
  return useMemo(() => {
    const vendedores = dashboardData?.vendedores || [];
    const meu = vendedores.find((v) => v.vendedor === nomeVendedor);
    // Somente valor de entrada (a meta é de entrada, não do total vendido)
    const meuValor = meu ? Number(meu.valorEntrada) || 0 : 0;
    // Meta do TIME dividida igualmente entre os vendedores = meta INDIVIDUAL
    // (o card "Suas conquistas" mede o vendedor contra a fatia dele, não contra o time)
    const metaTime = Number(metaPersonalizada) || 0;
    const qtdVendedores = vendedores.length || 1;
    const regra = premiacao?.ativo && premiacao.resultado?.configurado ? premiacao.resultado : null;
    const foraDaMeta = !!regra && premiacao.classificacaoDe(nomeVendedor) !== CLASSIFICACOES.EFETIVO;
    const metaIndividual = regra ? regra.metaIndividual : metaTime / qtdVendedores;
    const percentual = !foraDaMeta && metaIndividual > 0 ? (meuValor / metaIndividual) * 100 : 0;
    const medalhaAtual = foraDaMeta ? null : medalhaPara(percentual);

    // Filtra vendas do vendedor no mês comercial
    const { de, ate } = intervaloDoMesComercial(ano, mes);
    const deMs = de.getTime();
    const ateMs = ate.getTime();
    const minhasVendas = (allData || []).filter((it) => {
      if (it?.fase !== 'CONTRATO/VENDA') return false;
      if (it.proprietario_relacionamento !== nomeVendedor) return false;
      const ts = it.created_at ? new Date(it.created_at).getTime() : NaN;
      return !isNaN(ts) && ts >= deMs && ts <= ateMs;
    });

    // Streak semanal: quantas semanas contíguas até a semana atual tive pelo menos 1 venda
    const semanas = semanasDoMesComercial(ano, mes);
    const semanaTemVenda = semanas.map((s) => {
      return minhasVendas.some((v) => {
        const ts = new Date(v.created_at).getTime();
        return ts >= s.de.getTime() && ts <= s.ate.getTime();
      });
    });

    // Streak até a semana atual (contando as anteriores)
    const agora = Date.now();
    let streakSemanas = 0;
    for (let i = 0; i < semanas.length; i++) {
      if (agora < semanas[i].de.getTime()) break; // futuro
      if (semanaTemVenda[i]) streakSemanas++;
      else streakSemanas = 0;
    }

    // Badges especiais
    const badgesEspeciais = [];

    // Primeira venda do mês (comparando com todo o time)
    const primeiraVendaDoMes = (allData || [])
      .filter((it) => {
        if (it?.fase !== 'CONTRATO/VENDA') return false;
        const ts = it.created_at ? new Date(it.created_at).getTime() : NaN;
        return !isNaN(ts) && ts >= deMs && ts <= ateMs;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    if (primeiraVendaDoMes && primeiraVendaDoMes.proprietario_relacionamento === nomeVendedor) {
      badgesEspeciais.push({
        id: 'primeira-venda-mes',
        icone: '🌱',
        titulo: 'Primeira venda do mês',
        descricao: 'Você foi o primeiro a fechar neste mês',
      });
    }

    // Maior venda do mês
    let maiorVenda = null;
    (allData || []).forEach((it) => {
      if (it?.fase !== 'CONTRATO/VENDA') return;
      const ts = it.created_at ? new Date(it.created_at).getTime() : NaN;
      if (isNaN(ts) || ts < deMs || ts > ateMs) return;
      const v = parseFloat(it.valor_entrada_servico) || 0;
      if (!maiorVenda || v > maiorVenda.valor) {
        maiorVenda = { valor: v, vendedor: it.proprietario_relacionamento };
      }
    });
    if (maiorVenda && maiorVenda.vendedor === nomeVendedor && maiorVenda.valor > 0) {
      badgesEspeciais.push({
        id: 'maior-venda-mes',
        icone: '💰',
        titulo: 'Maior venda do mês',
        descricao: 'Ninguém superou seu ticket neste mês',
      });
    }

    // Todas as semanas até agora com venda
    const totalSemanasAteAgora = semanas.filter((s) => Date.now() >= s.de.getTime()).length;
    if (streakSemanas === totalSemanasAteAgora && totalSemanasAteAgora >= 2) {
      badgesEspeciais.push({
        id: 'consistencia',
        icone: '🔥',
        titulo: `${totalSemanasAteAgora} semanas em fogo!`,
        descricao: 'Você vendeu em todas as semanas do mês até agora',
      });
    }

    // Bateu meta
    if (percentual >= 100) {
      badgesEspeciais.push({
        id: 'meta-batida',
        icone: '🎯',
        titulo: 'Meta batida',
        descricao: 'Você atingiu sua meta individual do mês',
      });
    }

    return {
      medalhaAtual,
      percentual,
      streakSemanas,
      totalSemanasAteAgora,
      badgesEspeciais,
      meuValor,
      metaIndividual, // fatia individual = metaTime / qtdVendedores
      metaTime,
    };
  }, [allData, dashboardData, metaPersonalizada, ano, mes, nomeVendedor, premiacao]);
}

export default useGamification;
