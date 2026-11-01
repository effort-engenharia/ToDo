// Formatação e montagem de mensagens do painel de envio (plano §10.3). Funções puras.
import { montarMensagem } from './mensagemWhatsapp';
import { varsMensagem } from './adaptadores';

// "qui 03/11 18:00" (Anexo B.0)
export const formatarPrazo = (valor) => {
  const d = new Date(valor);
  if (!valor || Number.isNaN(d.getTime())) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${String(p.weekday).replace('.', '')} ${p.day}/${p.month} ${p.hour}:${p.minute}`;
};

// "faltam 1 d 4 h" / "vencido"
export const tempoRestante = (valor, agora = Date.now()) => {
  const t = new Date(valor).getTime();
  if (!valor || Number.isNaN(t)) return '';
  const min = Math.floor((t - agora) / 60000);
  if (min <= 0) return 'prazo vencido';
  if (min < 60) return `faltam ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `faltam ${h} h`;
  return `faltam ${Math.floor(h / 24)} d ${h % 24} h`;
};

// Padrões usados quando a config ainda não foi carregada (os mesmos de compras_config, §10.3)
export const MENSAGENS_PADRAO = {
  padrao: 'Olá {contato}, tudo bem? Aqui é da {empresa_publica}. Segue a cotação nº {numero} com {qtd_itens} itens. Para informar preços e condições, acesse: {link} . Prazo para resposta: {prazo}. Obrigado!',
  lembrete: 'Olá {contato}, lembrando da cotação nº {numero} da {empresa_publica}. Prazo: {prazo}. Link atualizado: {link}',
  revisao: 'Olá {contato}, a lista da cotação nº {numero} foi atualizada. Por favor, confira e reenvie sua proposta até {prazo}: {link}'
};

// tipo: 'padrao' | 'lembrete' | 'revisao'. A mensagem editada na abertura da cotação (`cotacao.mensagem`) vale para o envio padrão.
export const mensagemDoConvite = ({ tipo = 'padrao', config, cotacao, convite, link, qtdItens }) => {
  const template = (tipo === 'padrao' && cotacao?.mensagem)
    || (tipo === 'lembrete' && (config?.mensagem_lembrete || MENSAGENS_PADRAO.lembrete))
    || (tipo === 'revisao' && (config?.mensagem_revisao || MENSAGENS_PADRAO.revisao))
    || config?.mensagem_padrao
    || MENSAGENS_PADRAO.padrao;
  return montarMensagem(template, varsMensagem({
    contato: convite?.fornecedor?.nome_contato,
    empresaPublica: config?.nome_empresa_publico || 'Effort',
    numero: cotacao?.numero,
    qtdItens,
    link,
    prazo: formatarPrazo(cotacao?.prazo_resposta)
  }));
};

// Estado visual do convite (Anexo B.4): emoji + texto sempre
export const estadoDoConvite = (convite) => {
  if (convite?.precisa_reconfirmar && convite.status === 'respondido') {
    return { id: 'reconfirmar', emoji: '🔄', rotulo: `Reconfirmar (lista v${convite.versao_lista_respondida ?? '?'})`, tom: 'roxo' };
  }
  if (convite?.expirado && !['respondido', 'recusou'].includes(convite.status)) {
    return { id: 'expirado', emoji: '⏰', rotulo: 'Prazo vencido sem resposta', tom: 'amarelo' };
  }
  switch (convite?.status) {
    case 'enviado': return { id: 'enviado', emoji: '📤', rotulo: 'Enviado', tom: 'azul' };
    case 'visualizado': return { id: 'visualizado', emoji: '👀', rotulo: 'Visualizou', tom: 'ciano' };
    case 'respondido': return { id: 'respondido', emoji: '✅', rotulo: 'Respondido', tom: 'verde' };
    case 'recusou': return { id: 'recusou', emoji: '🚫', rotulo: 'Não vai cotar', tom: 'cinza' };
    default: return { id: 'nao_enviado', emoji: '⚪', rotulo: 'Não enviado', tom: 'cinza' };
  }
};

export const STATUS_COTACAO = {
  rascunho: { emoji: '📝', rotulo: 'Rascunho', tom: 'cinza' },
  aberta: { emoji: '🟢', rotulo: 'Aberta', tom: 'verde' },
  encerrada: { emoji: '🏁', rotulo: 'Encerrada', tom: 'azul' },
  cancelada: { emoji: '🚫', rotulo: 'Cancelada', tom: 'cinza' }
};

// Prazos em horas → ISO a partir de agora
export const prazoEmHoras = (horas, agora = Date.now()) => new Date(agora + horas * 3600000).toISOString();
export const prazoPadrao = (horas = 48) => ({ modo: horas, local: '', iso: prazoEmHoras(horas) });

// <input type="datetime-local"> (hora local) → ISO; inválido → null
export const localParaISO = (valorLocal) => {
  if (!valorLocal) return null;
  const d = new Date(valorLocal);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// Tom → classes de selo (cinza escuro/azul/etc. sobre o fundo escuro; texto sempre acompanha)
export const CLASSE_TOM = {
  cinza: 'bg-slate-500/15 text-slate-300 border border-slate-500/40',
  azul: 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
  ciano: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  verde: 'bg-green-500/15 text-green-300 border border-green-500/40',
  amarelo: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  roxo: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
  vermelho: 'bg-red-500/15 text-red-300 border border-red-500/40'
};
