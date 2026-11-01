import React, { useId, useMemo, useState } from 'react';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import { EstadoVazio } from '../../../execucao/components/ui/Estados';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { parseBRL } from '../../utils/cotacao/moeda';

// Configurações da cotação (plano §10.6 / Anexo B.9). Só Administrador: o banco também valida em `compras_config_salvar`.
const PCT = [
  { chave: 'taxa_mensal', rotulo: 'Taxa de desconto mensal (% a.m.)', max: 20, ajuda: 'Ex.: 1,5% a.m.: parcelas futuras valem menos que pagamento hoje. Usada para comparar à vista e parcelado pelo valor presente.' },
  { chave: 'empate_pct', rotulo: 'Margem de empate (%)', max: 100, ajuda: 'Propostas com diferença menor que isso são tratadas como empatadas; o desempate usa prazo, frete e histórico.' },
  { chave: 'alerta_pct', rotulo: 'Alerta de preço acima da referência (%)', max: 100, ajuda: 'Acima desta variação sobre o preço de referência, o item é destacado como caro.' },
  { chave: 'faixa_neutra_pct', rotulo: 'Faixa neutra da referência (%)', max: 100, ajuda: 'Variações dentro desta faixa aparecem em cinza (sem alta nem baixa).' },
];
const INTEIROS = [
  { chave: 'prazo_padrao_horas', rotulo: 'Prazo padrão de resposta (horas)', min: 1, max: 720, ajuda: 'Prazo sugerido ao abrir uma cotação.' },
  { chave: 'janela_referencia_meses', rotulo: 'Janela do preço de referência (meses)', min: 1, max: 60, ajuda: 'Compras mais antigas que isso não entram na média.' },
  { chave: 'fallback_ultimas_compras', rotulo: 'Últimas compras como referência (quantidade)', min: 1, max: 50, ajuda: 'Usado quando a janela não tem compras.' },
  { chave: 'prazo_aceite_horas_uteis', rotulo: 'Prazo de aceite do solicitante (horas úteis)', min: 1, max: 720, ajuda: 'Tempo para o solicitante aceitar alterações na lista antes do alerta.' },
];
const MENSAGENS = [
  { chave: 'mensagem_padrao', rotulo: 'Mensagem de envio da cotação' },
  { chave: 'mensagem_lembrete', rotulo: 'Mensagem de lembrete' },
  { chave: 'mensagem_revisao', rotulo: 'Mensagem de lista alterada' },
];
const LIMITES = [
  { chave: 'rl_token_obter_10min', rotulo: 'Leituras por link (10 min)', min: 1, max: 10000 },
  { chave: 'rl_token_responder_10min', rotulo: 'Respostas por link (10 min)', min: 1, max: 10000 },
  { chave: 'rl_ip_obter_10min', rotulo: 'Leituras por IP (10 min)', min: 1, max: 10000 },
  { chave: 'rl_ip_responder_10min', rotulo: 'Respostas por IP (10 min)', min: 1, max: 10000 },
  { chave: 'rl_global_responder_hora', rotulo: 'Respostas no total (por hora)', min: 1, max: 100000 },
];
const PLACEHOLDERS = ['{contato}', '{empresa_publica}', '{numero}', '{qtd_itens}', '{link}', '{prazo}'];

const txt = (n, casas = 2) => (n === null || n === undefined ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas }));

const formDeConfig = (c) => {
  const f = { nome_empresa_publico: c?.nome_empresa_publico ?? '', link_publico_ativo: c?.link_publico_ativo !== false };
  PCT.forEach(({ chave }) => { f[chave] = txt(Math.round((c?.[chave] ?? 0) * 10000) / 100); });
  [...INTEIROS, ...LIMITES].forEach(({ chave }) => { f[chave] = c?.[chave] == null ? '' : String(c[chave]); });
  MENSAGENS.forEach(({ chave }) => { f[chave] = c?.[chave] ?? ''; });
  return f;
};

// Converte o formulário em valores do banco; devolve { valores, erros }
const converter = (f) => {
  const valores = {};
  const erros = {};
  const nome = f.nome_empresa_publico.trim();
  if (nome.length < 2 || nome.length > 80) erros.nome_empresa_publico = 'Informe o nome com 2 a 80 caracteres.';
  else valores.nome_empresa_publico = nome;
  PCT.forEach(({ chave, max }) => {
    const n = parseBRL(f[chave]);
    if (n === null || n < 0 || n > max) erros[chave] = `Informe um valor de 0 a ${max}%.`;
    else valores[chave] = Math.round(n * 100) / 10000;
  });
  [...INTEIROS, ...LIMITES].forEach(({ chave, min, max }) => {
    const s = String(f[chave]).trim();
    const n = /^\d+$/.test(s) ? Number(s) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) erros[chave] = `Informe um número inteiro de ${min} a ${max.toLocaleString('pt-BR')}.`;
    else valores[chave] = n;
  });
  MENSAGENS.forEach(({ chave }) => {
    const m = f[chave].trim();
    if (m.length < 10 || m.length > 1000) erros[chave] = 'A mensagem precisa ter de 10 a 1000 caracteres.';
    else if (chave === 'mensagem_padrao' && !m.includes('{link}')) erros[chave] = 'Inclua {link} na mensagem de envio.';
    else valores[chave] = m;
  });
  valores.link_publico_ativo = f.link_publico_ativo;
  return { valores, erros };
};

const Campo = ({ id, rotulo, ajuda, erro, children }) => (
  <div className="execucao-form-group">
    <label className="execucao-form-label" htmlFor={id}>{rotulo}</label>
    {children}
    {ajuda && <p id={`${id}-ajuda`} className="text-xs text-slate-400 mt-1">{ajuda}</p>}
    {erro && <p id={`${id}-erro`} className="cmp-erro-campo" role="alert">{erro}</p>}
  </div>
);

const ConfigComprasPagina = ({ config, onSalvo }) => {
  const { toast, confirmar } = useExecucaoUI();
  const idBase = useId();
  const [form, setForm] = useState(() => formDeConfig(config));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const original = useMemo(() => formDeConfig(config), [config]);
  const alterado = JSON.stringify(form) !== JSON.stringify(original);

  if (!config) {
    return (
      <div className="cmp-pagina">
        <EstadoVazio icone="🔒" titulo="Configurações indisponíveis" texto="Esta área é restrita à equipe de Compras." />
      </div>
    );
  }

  const set = (chave, valor) => { setForm((f) => ({ ...f, [chave]: valor })); setErros((e) => ({ ...e, [chave]: undefined })); };
  const id = (chave) => `${idBase}-${chave}`;
  const props = (chave) => ({
    id: id(chave), value: form[chave], onChange: (e) => set(chave, e.target.value),
    'aria-invalid': erros[chave] ? true : undefined,
    'aria-describedby': [erros[chave] && `${id(chave)}-erro`, `${id(chave)}-ajuda`].filter(Boolean).join(' ') || undefined,
  });

  const alternarLink = async (ligado) => {
    if (!ligado) {
      const ok = await confirmar({
        titulo: 'Desativar link público?',
        mensagem: 'Os fornecedores deixarão de conseguir abrir e responder as cotações pelo link enviado. Use só em emergência.',
        confirmarTexto: 'Desativar link',
      });
      if (!ok) return;
    }
    set('link_publico_ativo', ligado);
  };

  const salvar = async (e) => {
    e.preventDefault();
    const { valores, erros: novosErros } = converter(form);
    setErros(novosErros);
    if (Object.keys(novosErros).length) {
      toast.error('Corrija os campos destacados.');
      document.getElementById(id(Object.keys(novosErros)[0]))?.focus();
      return;
    }
    setSalvando(true);
    setErroEnvio(null);
    const r = await comprasCotacaoService.salvarConfig(valores);
    setSalvando(false);
    if (!r.success) { setErroEnvio(r.message || 'Não foi possível salvar.'); return; }
    const nova = r.data && typeof r.data === 'object' ? r.data : { ...config, ...valores };
    onSalvo?.(nova);
    setForm(formDeConfig(nova));
    toast.success('Configurações salvas');
  };

  return (
    <div className="cmp-pagina">
      <h2 className="text-xl font-semibold mb-1">Configurações da cotação</h2>
      <p className="text-sm text-slate-400 mb-4">Valem para todas as cotações. Alterações não mudam cotações já decididas.</p>

      <form onSubmit={salvar} noValidate aria-busy={salvando || undefined}>
        {erroEnvio && <div className="cmp-aviso-erro" role="alert">{erroEnvio}</div>}

        <section className="execucao-card mb-4" aria-labelledby={`${idBase}-s1`}>
          <h3 id={`${idBase}-s1`} className="font-semibold mb-3">Comparação de propostas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {PCT.map(({ chave, rotulo, ajuda }) => (
              <Campo key={chave} id={id(chave)} rotulo={rotulo} ajuda={ajuda} erro={erros[chave]}>
                <input {...props(chave)} type="text" inputMode="decimal" autoComplete="off" className="execucao-form-input" />
              </Campo>
            ))}
          </div>
        </section>

        <section className="execucao-card mb-4" aria-labelledby={`${idBase}-s2`}>
          <h3 id={`${idBase}-s2`} className="font-semibold mb-3">Prazos e referência de preço</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {INTEIROS.map(({ chave, rotulo, ajuda }) => (
              <Campo key={chave} id={id(chave)} rotulo={rotulo} ajuda={ajuda} erro={erros[chave]}>
                <input {...props(chave)} type="text" inputMode="numeric" autoComplete="off" className="execucao-form-input" />
              </Campo>
            ))}
          </div>
        </section>

        <section className="execucao-card mb-4" aria-labelledby={`${idBase}-s3`}>
          <h3 id={`${idBase}-s3`} className="font-semibold mb-3">Fornecedor e WhatsApp</h3>
          <Campo id={id('nome_empresa_publico')} rotulo="Nome público da empresa" ajuda="É o nome que o fornecedor vê na página da cotação e na mensagem." erro={erros.nome_empresa_publico}>
            <input {...props('nome_empresa_publico')} type="text" maxLength={80} autoComplete="off" className="execucao-form-input" />
          </Campo>
          <p className="text-xs text-slate-400 mb-3">
            Variáveis que você pode usar: {PLACEHOLDERS.map((p) => <code key={p} className="mr-1">{p}</code>)}
          </p>
          {MENSAGENS.map(({ chave, rotulo }) => (
            <Campo key={chave} id={id(chave)} rotulo={rotulo} ajuda={`${form[chave].length}/1000`} erro={erros[chave]}>
              <textarea {...props(chave)} rows={4} maxLength={1000} className="execucao-form-textarea" />
            </Campo>
          ))}
        </section>

        <section className="execucao-card mb-4" aria-labelledby={`${idBase}-s4`}>
          <h3 id={`${idBase}-s4`} className="font-semibold mb-3">Link público</h3>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" className="mt-1 h-5 w-5 flex-none" checked={form.link_publico_ativo}
              onChange={(e) => alternarLink(e.target.checked)} aria-describedby={`${idBase}-link-ajuda`}
            />
            <span className="font-medium">Link público ativo</span>
          </label>
          <p id={`${idBase}-link-ajuda`} className="text-xs text-slate-400 mt-1">
            Desativar bloqueia a abertura e a resposta de todos os links (botão de emergência).
          </p>
          {!form.link_publico_ativo && (
            <div className="cmp-aviso" role="status">⚠ Com o link desativado, nenhum fornecedor consegue responder cotações.</div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-300">Limites de tentativas (avançado)</summary>
            <p className="text-xs text-slate-400 my-2">Protegem o link contra abuso. Mude só se fornecedores legítimos forem bloqueados.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {LIMITES.map(({ chave, rotulo }) => (
                <Campo key={chave} id={id(chave)} rotulo={rotulo} erro={erros[chave]}>
                  <input {...props(chave)} type="text" inputMode="numeric" autoComplete="off" className="execucao-form-input" />
                </Campo>
              ))}
            </div>
          </details>
        </section>

        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" disabled={!alterado || salvando}
            onClick={() => { setForm(original); setErros({}); setErroEnvio(null); }}>
            Descartar alterações
          </button>
          <button type="submit" className="execucao-btn execucao-btn-primary cmp-btn-toque" disabled={!alterado || salvando} aria-busy={salvando || undefined}>
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigComprasPagina;
