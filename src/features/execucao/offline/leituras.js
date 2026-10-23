import { execucaoService } from '../../../services/supabase/execucao';
import { execucaoTecnicoService } from '../../../services/supabase/execucaoTecnico';
import { dataLocalISO } from '../utils/datas';
import { aplicarPendencias } from './aplicarPendencias';
import { carregarComCache, preservarContexto } from './cacheLeitura';

// Leitura das atividades do técnico (aba Hoje/Semana de Minhas Atividades) com cache offline e fila por cima.

export const chaveMinhas = (tab, dia = dataLocalISO()) => `minhas:${tab}:${dia}`;

const buscarMinhas = async (usuarioId, tab) => {
  const r = await execucaoService.buscarAtividadesTecnico(usuarioId, tab);
  if (!r?.success) return r;
  // Nomes da equipe e situação do material (falhas aqui não impedem de ver as atividades)
  const ids = r.data.map((a) => a.id);
  const abertas = r.data.filter((a) => a.status !== 'concluida' && a.status !== 'cancelada').map((a) => a.id);
  const [equipes, material, contexto] = await Promise.all([
    execucaoTecnicoService.buscarEquipes(ids),
    execucaoTecnicoService.buscarStatusMaterial(abertas),
    execucaoTecnicoService.buscarContextoAtividades(ids)
  ]);
  return {
    success: true,
    parcial: equipes.success === false || material.success === false,
    data: {
      atividades: r.data.map((a) => ({
        ...a,
        equipe: equipes.data?.[a.id] ?? a.equipe,
        ...(contexto.data[a.id] ? { contexto: contexto.data[a.id] } : {})
      })),
      material: material.data ?? {}
    }
  };
};

const preparar = (data, antigo) => ({ ...data, atividades: preservarContexto(data.atividades, antigo?.atividades) });

// Só 'hoje' e 'semana' vão para o cache; 'todas' (até 500 linhas) segue sempre pela rede
export const carregarAtividadesTecnico = async (usuarioId, tab) => {
  const r = tab === 'todas'
    ? await buscarMinhas(usuarioId, tab)
    : await carregarComCache({ usuarioId, chave: chaveMinhas(tab), buscar: () => buscarMinhas(usuarioId, tab), preparar });
  if (!r?.success) return r;
  return {
    success: true,
    data: {
      ...r.data,
      atividades: await aplicarPendencias(usuarioId, r.data.atividades),
      cacheEm: r.offline ? r.salvoEm : null
    }
  };
};

export const opcoesPreCargaMinhas = (usuarioId, tab) => ({
  usuarioId,
  chave: chaveMinhas(tab),
  buscar: () => buscarMinhas(usuarioId, tab),
  preparar
});
