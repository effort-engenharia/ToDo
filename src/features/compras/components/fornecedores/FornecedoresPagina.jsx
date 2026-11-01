import React, { useMemo, useState } from 'react';
import { FaPen, FaPowerOff, FaTrash, FaUserSlash, FaWhatsapp } from 'react-icons/fa';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import { ErroCarregamento } from '../../../execucao/components/ui/Estados';
import { useAsyncData } from '../../../execucao/hooks/useAsyncData';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { isAdministrador } from '../../../../utils/permissoes';
import { linkWhatsapp, mascaraWhatsapp } from './formatos';
import ModalFornecedor from './ModalFornecedor';
import ModalAnonimizar from './ModalAnonimizar';

// Cadastro de fornecedores (plano §10.6 / Anexo B.6). Leitura via RLS; escrita via RPC (comprasCotacaoService).
const SITUACOES = [
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'inativos', rotulo: 'Inativos' },
  { valor: 'todos', rotulo: 'Todos' },
];

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const Situacao = ({ f }) => {
  if (f.anonimizado_em) return <span className="cmp-selo cmp-tom-roxo">🔒 Anonimizado</span>;
  return f.ativo
    ? <span className="cmp-selo cmp-tom-verde">✅ Ativo</span>
    : <span className="cmp-selo cmp-tom-amarelo">⏸ Inativo</span>;
};

const FornecedoresPagina = ({ usuario }) => {
  const { toast, confirmar } = useExecucaoUI();
  const admin = isAdministrador(usuario);
  const lista = useAsyncData(() => comprasCotacaoService.listarFornecedores(), []);
  // Desempenho vem dos KPIs (migration 39); se ainda não existir, as colunas ficam em "—"
  const kpis = useAsyncData(async () => {
    const r = await comprasCotacaoService.indicadoresCotacao();
    return { success: true, data: r.success ? r.data : null };
  }, []);

  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('ativos');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState(undefined); // undefined fechado · null novo · objeto editar
  const [anonimizando, setAnonimizando] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const fornecedores = useMemo(() => lista.data ?? [], [lista.data]);
  const desempenho = useMemo(
    () => new Map((kpis.data?.por_fornecedor ?? []).map((p) => [p.fornecedor_id, p])),
    [kpis.data]
  );
  const categorias = useMemo(
    () => [...new Set(fornecedores.flatMap((f) => f.categorias ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [fornecedores]
  );
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return fornecedores.filter((f) => {
      if (situacao === 'ativos' && (!f.ativo || f.anonimizado_em)) return false;
      if (situacao === 'inativos' && f.ativo && !f.anonimizado_em) return false;
      if (categoria && !(f.categorias ?? []).includes(categoria)) return false;
      if (!q) return true;
      return semAcento([f.empresa, f.nome_contato, f.whatsapp, f.email, ...(f.categorias ?? [])].join(' ')).includes(q);
    });
  }, [fornecedores, busca, situacao, categoria]);

  const recarregar = () => { lista.refresh(); kpis.refresh(); };

  const alternarAtivo = async (f) => {
    setOcupado(f.id);
    const r = await comprasCotacaoService.definirFornecedorAtivo(f.id, !f.ativo);
    setOcupado(null);
    if (!r.success) { toast.error(r.message || 'Não foi possível alterar a situação.'); return; }
    toast.success(f.ativo ? 'Fornecedor inativado' : 'Fornecedor ativado');
    recarregar();
  };

  const excluir = async (f) => {
    const ok = await confirmar({
      titulo: 'Excluir fornecedor?',
      mensagem: `${f.empresa} será removido do cadastro. Isto não pode ser desfeito.`,
      confirmarTexto: 'Excluir',
    });
    if (!ok) return;
    setOcupado(f.id);
    const r = await comprasCotacaoService.excluirFornecedor(f.id);
    setOcupado(null);
    if (!r.success) { toast.error(r.message || 'Não foi possível excluir.'); return; }
    toast.success('Fornecedor excluído');
    recarregar();
  };

  const jaParticipou = (f) => (desempenho.get(f.id)?.enviados ?? 0) > 0;
  const btn = 'execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-icone';

  const acoes = (f) => {
    if (f.anonimizado_em) return <span className="text-xs text-slate-400">Sem ações</span>;
    const bloqueado = ocupado === f.id;
    const motivoExcluir = jaParticipou(f) ? 'Tem cotações ou compras. Use Inativar.' : null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={btn} aria-label={`Editar ${f.empresa}`} title="Editar" disabled={bloqueado} onClick={() => setEditando(f)}>
          <FaPen aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label={`${f.ativo ? 'Inativar' : 'Ativar'} ${f.empresa}`} title={f.ativo ? 'Inativar' : 'Ativar'} disabled={bloqueado} onClick={() => alternarAtivo(f)}>
          <FaPowerOff aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label={`Excluir ${f.empresa}`} title={motivoExcluir ?? 'Excluir'} disabled={bloqueado || Boolean(motivoExcluir)} onClick={() => excluir(f)}>
          <FaTrash aria-hidden="true" />
        </button>
        {admin && (
          <button type="button" className={btn} aria-label={`Anonimizar ${f.empresa}`} title="Anonimizar (LGPD)" disabled={bloqueado} onClick={() => setAnonimizando(f)}>
            <FaUserSlash aria-hidden="true" />
          </button>
        )}
        {motivoExcluir && <span className="text-xs text-slate-400 w-full">{motivoExcluir}</span>}
      </div>
    );
  };

  const whats = (f) => {
    if (f.anonimizado_em || !f.whatsapp) return '—';
    const href = linkWhatsapp(f.whatsapp);
    const txt = mascaraWhatsapp(f.whatsapp);
    return href
      ? <a className="cmp-link inline-flex items-center gap-1 min-h-[44px] md:min-h-0" href={href} target="_blank" rel="noopener noreferrer"><FaWhatsapp aria-hidden="true" />{txt}<span className="sr-only"> (abre o WhatsApp)</span></a>
      : txt;
  };

  const dado = (f, chave, fmt = (v) => v) => {
    const d = desempenho.get(f.id);
    return d && d[chave] !== null && d[chave] !== undefined ? fmt(d[chave]) : '—';
  };

  const filtrando = Boolean(busca || categoria || situacao !== 'ativos');

  return (
    <div className="cmp-pagina">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Fornecedores</h2>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={() => setEditando(null)}>＋ Novo fornecedor</button>
      </div>

      <div className="cmp-filtros" role="search">
        <div className="cmp-filtros-campos">
          <div>
            <label className="execucao-form-label" htmlFor="forn-busca">Buscar</label>
            <input id="forn-busca" type="search" className="execucao-form-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Empresa, contato, WhatsApp…" autoComplete="off" />
          </div>
          <div>
            <label className="execucao-form-label" htmlFor="forn-situacao">Situação</label>
            <select id="forn-situacao" className="execucao-form-select" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </div>
          <div>
            <label className="execucao-form-label" htmlFor="forn-categoria">Categoria</label>
            <select id="forn-categoria" className="execucao-form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div aria-busy={lista.loading || undefined}>
        {lista.loading && !lista.data && (
          <div className="grid gap-2" aria-label="Carregando fornecedores">
            {[0, 1, 2].map((i) => <div key={i} className="cmp-skeleton h-16" />)}
          </div>
        )}

        {lista.error && !lista.loading && <ErroCarregamento mensagem={lista.error} onTentarNovamente={() => lista.reload()} />}

        {!lista.error && lista.data && fornecedores.length === 0 && (
          <div className="execucao-card"><div className="execucao-empty-state">
            <div className="execucao-empty-title">Nenhum fornecedor ainda.</div>
            <div className="execucao-empty-text">Cadastre o primeiro para enviar cotações.</div>
            <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque mt-4" onClick={() => setEditando(null)}>＋ Novo fornecedor</button>
          </div></div>
        )}

        {!lista.error && fornecedores.length > 0 && filtrados.length === 0 && (
          <div className="execucao-card"><div className="execucao-empty-state">
            <div className="execucao-empty-title">Nada encontrado.</div>
            {filtrando && (
              <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque mt-4"
                onClick={() => { setBusca(''); setCategoria(''); setSituacao('ativos'); }}>Limpar busca</button>
            )}
          </div></div>
        )}

        {filtrados.length > 0 && (
          <>
            <p className="sr-only" role="status">{filtrados.length} fornecedor(es) listado(s)</p>
            {/* Desktop: tabela */}
            <div className="cmp-tabela-rolagem hidden md:block">
              <table className="cmp-tabela w-full text-sm">
                <caption className="sr-only">Fornecedores cadastrados</caption>
                <thead>
                  <tr>
                    <th scope="col" className="text-left p-2">Empresa</th>
                    <th scope="col" className="text-left p-2">Contato</th>
                    <th scope="col" className="text-left p-2">WhatsApp</th>
                    <th scope="col" className="text-left p-2">Categorias</th>
                    <th scope="col" className="text-right p-2">Taxa de resposta</th>
                    <th scope="col" className="text-right p-2">Vitórias</th>
                    <th scope="col" className="text-left p-2">Situação</th>
                    <th scope="col" className="text-left p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((f) => (
                    <tr key={f.id} className="border-t border-slate-700">
                      <th scope="row" className="text-left p-2 font-medium">{f.empresa}</th>
                      <td className="p-2">{f.nome_contato}</td>
                      <td className="p-2">{whats(f)}</td>
                      <td className="p-2">{(f.categorias ?? []).join(', ') || '—'}</td>
                      <td className="p-2 text-right">{dado(f, 'taxa', pct)}</td>
                      <td className="p-2 text-right">{dado(f, 'vitorias')}</td>
                      <td className="p-2"><Situacao f={f} /></td>
                      <td className="p-2">{acoes(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cartões */}
            <ul className="grid gap-3 md:hidden">
              {filtrados.map((f) => (
                <li key={f.id} className="cmp-cartao">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold break-words">{f.empresa}</div>
                      <div className="text-sm text-slate-300 break-words">{f.nome_contato}</div>
                    </div>
                    <Situacao f={f} />
                  </div>
                  <div className="text-sm mt-2">{whats(f)}</div>
                  {(f.categorias ?? []).length > 0 && <div className="text-xs text-slate-400 mt-1">{f.categorias.join(' · ')}</div>}
                  <div className="text-xs text-slate-400 mt-1">Taxa de resposta: {dado(f, 'taxa', pct)} · Vitórias: {dado(f, 'vitorias')}</div>
                  <div className="mt-3">{acoes(f)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {editando !== undefined && (
        <ModalFornecedor
          fornecedor={editando}
          onClose={() => setEditando(undefined)}
          onSalvo={recarregar}
          onVerExistente={() => { setEditando(undefined); setBusca(''); setSituacao('todos'); }}
        />
      )}
      {anonimizando && (
        <ModalAnonimizar fornecedor={anonimizando} onClose={() => setAnonimizando(null)} onConcluido={recarregar} />
      )}
    </div>
  );
};

export default FornecedoresPagina;
