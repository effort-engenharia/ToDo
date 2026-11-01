import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoTecnicoService } from '../../../../services/supabase/execucaoTecnico';
import { assertNotImpersonating } from '../../../../utils/impersonationGuard';
import { classificarErro, TIPO_ERRO } from '../../offline/erros';
import { enfileirar, listarOutbox } from '../../offline/outbox';
import { executarItem, pedirBackgroundSync, registrarExecutor, sincronizar, usuarioAtualId } from '../../offline/sincronizador';

// Ponto único das ações do técnico sobre uma atividade. Cada ação recebe um id_cliente (idempotência no
// servidor) e o instante em que aconteceu no aparelho (ocorrido_em). `enfileirarOuEnviar` é o único lugar
// que decide entre enviar agora ou guardar na fila offline; os executores abaixo são os únicos que chamam
// o serviço (tanto no envio imediato quanto na sincronização da fila).

const uuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const novaAcao = () => ({ idCliente: uuid(), ocorridoEm: new Date().toISOString() });

registrarExecutor('status', ({ atividadeId, usuarioId, id, ocorridoEm, payload }) =>
  execucaoService.alterarStatusAtividade(atividadeId, payload.status, usuarioId, payload.motivo ?? null, {
    ocorridoEm,
    idCliente: id,
    motivoCodigo: payload.motivoCodigo ?? null,
    solicitaReplanejamento: payload.solicitaReplanejamento ?? null,
    // horasRealizadas só existe em itens antigos da fila (o técnico não informa mais horas; o servidor calcula)
    horasRealizadas: payload.horasRealizadas ?? null,
    // Conclusão: observação e localização do instante do clique (ficam no payload, inclusive offline)
    observacao: payload.observacao ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    precisaoM: payload.precisaoM ?? null,
    geoStatus: payload.geoStatus ?? null
  }));

// Passo (sub-etapa) marcado/desmarcado no modal de conclusão. Idempotente no servidor por id_cliente.
registrarExecutor('passo', ({ atividadeId, id, ocorridoEm, payload }) =>
  execucaoTecnicoService.marcarPasso(atividadeId, payload.subEtapaId, payload.concluido, {
    idCliente: id,
    ocorridoEm
  }));

registrarExecutor('falta_material', ({ atividadeId, id, ocorridoEm, payload }) =>
  execucaoTecnicoService.criarFaltaMaterial(atividadeId, payload.descricao, {
    pausar: payload.pausar,
    ocorridoEm,
    idCliente: id
  }));

const TEMPO_ENVIO_MS = 15000;

const comLimite = (promessa, ms) => {
  let timer;
  const limite = new Promise((resolver) => { timer = setTimeout(() => resolver(null), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
};

// Envia agora quando há conexão e a fila está vazia (mantém a ordem das ações); sem sinal, com rede ruim
// (timeout) ou com a sessão vencida, guarda na fila com o mesmo idCliente e devolve { success: true, queued: true }.
// Erros definitivos (permissão, regra) voltam como falha, igual a antes. Impersonation: nunca envia nem enfileira.
// Reenvio de uma ação que falhou: passe a mesma `acao` para não duplicar no servidor
const enfileirarOuEnviar = async ({ tipo, atividadeId, usuarioId, payload, acao }) => {
  try {
    assertNotImpersonating('alteração de atividade');
  } catch (erro) {
    return { success: false, blocked: true, message: erro.message };
  }

  const item = { id: acao.idCliente, tipo, atividadeId, usuarioId, ocorridoEm: acao.ocorridoEm, payload };
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  try {
    if (!offline) {
      const filaVazia = !(await listarOutbox(usuarioId)).some((i) => i.estado !== 'erro');
      if (filaVazia) {
        const envio = executarItem(item);
        const resultado = await comLimite(envio, TEMPO_ENVIO_MS);
        if (resultado?.success) return resultado;
        if (resultado) {
          const tipoErro = classificarErro(resultado);
          if (tipoErro !== TIPO_ERRO.REDE && tipoErro !== TIPO_ERRO.SESSAO) return resultado;
        }
      }
    }
    if (usuarioId !== usuarioAtualId()) {
      return { success: false, message: 'Sessão do usuário mudou. Entre novamente para registrar a ação.' };
    }
    await enfileirar(item);
    pedirBackgroundSync();
    if (!offline) sincronizar({ motivo: 'enfileirado' });
    return { success: true, queued: true };
  } catch (erro) {
    console.error('Erro ao enviar/enfileirar ação:', erro);
    return { success: false, message: erro?.message };
  }
};

export const iniciarAtividade = (atividadeId, usuarioId, acao = novaAcao()) =>
  enfileirarOuEnviar({ tipo: 'status', atividadeId, usuarioId, acao, payload: { status: 'em_andamento' } });

export const retomarAtividade = iniciarAtividade;

export const pausarAtividade = (
  atividadeId,
  usuarioId,
  { motivo = null, motivoCodigo = null, solicitaReplanejamento = false } = {},
  acao = novaAcao()
) =>
  enfileirarOuEnviar({
    tipo: 'status',
    atividadeId,
    usuarioId,
    acao,
    payload: { status: 'pausada', motivo, motivoCodigo, solicitaReplanejamento }
  });

const MAX_OBSERVACAO = 1000;

const AVISO_GEO = {
  negada: 'Localização bloqueada: a conclusão foi registrada sem localização. Para registrar nas próximas, libere em Configurações do navegador → Permissões → Localização.',
  indisponivel: 'Não foi possível obter a localização agora. A conclusão foi registrada normalmente.',
  tempo_esgotado: 'Não foi possível obter a localização agora. A conclusão foi registrada normalmente.',
  nao_suportado: 'Este aparelho não informa a localização. A conclusão foi registrada normalmente.'
};

// Conclusão pelo técnico. Horário: o instante do clique (`ocorridoEm`) vai na ação; online o servidor usa o próprio
// relógio e, vindo da fila offline, usa este instante. Não há horas editáveis (o servidor calcula).
// `localizacao` = resultado de obterLocalizacao() no clique; `passos` = [{ subEtapaId, concluido, nome }] alterados.
// Os passos entram na fila ANTES da ação de status (a ordem da fila é a ordem de criação); falha de um passo
// não impede a conclusão e volta em `avisos`.
export const concluirAtividade = async (
  atividadeId,
  usuarioId,
  { observacao = null, localizacao = null, passos = [], ocorridoEm = null, horasRealizadas = null } = {},
  acao = novaAcao()
) => {
  const instante = ocorridoEm || acao.ocorridoEm;
  const avisos = [];
  const falhasPassos = [];

  for (const passo of passos) {
    const r = await enfileirarOuEnviar({
      tipo: 'passo',
      atividadeId,
      usuarioId,
      acao: { idCliente: uuid(), ocorridoEm: instante },
      payload: { subEtapaId: passo.subEtapaId, concluido: !!passo.concluido }
    });
    if (r.blocked) return r;
    if (!r.success) falhasPassos.push(passo.nome || 'passo');
  }

  const texto = typeof observacao === 'string' ? observacao.trim().slice(0, MAX_OBSERVACAO) : '';
  const geoOk = localizacao?.status === 'ok';
  const resultado = await enfileirarOuEnviar({
    tipo: 'status',
    atividadeId,
    usuarioId,
    acao: { idCliente: acao.idCliente, ocorridoEm: instante },
    payload: {
      status: 'concluida',
      horasRealizadas,
      observacao: texto || null,
      geoStatus: localizacao?.status ?? null,
      latitude: geoOk ? localizacao.latitude : null,
      longitude: geoOk ? localizacao.longitude : null,
      precisaoM: geoOk ? localizacao.precisao ?? null : null
    }
  });
  if (!resultado.success) return resultado;

  if (falhasPassos.length) {
    avisos.push(`A atividade foi concluída, mas não foi possível registrar ${falhasPassos.length === 1 ? 'o passo' : 'os passos'}: ${falhasPassos.join(', ')}.`);
  }
  if (localizacao && !geoOk && AVISO_GEO[localizacao.status]) avisos.push(AVISO_GEO[localizacao.status]);
  return avisos.length ? { ...resultado, avisos } : resultado;
};

export const reportarFaltaMaterial = (atividadeId, usuarioId, { descricao, pausar = true } = {}, acao = novaAcao()) =>
  enfileirarOuEnviar({ tipo: 'falta_material', atividadeId, usuarioId, acao, payload: { descricao, pausar } });
