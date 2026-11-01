import React, { useMemo, useState } from 'react';
import { mascaraWhatsapp, whatsappValido } from '../fornecedores/formatos';

const MAX_FORNECEDORES = 15;
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function PassoFornecedores({ fornecedores, carregando, erro, selecionados, onAlternar, onCadastrar, onEditar, onRecarregar, desempenho = null }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const ativos = useMemo(() => (fornecedores ?? []).filter((f) => f.ativo && !f.anonimizado_em), [fornecedores]);
  const categorias = useMemo(() => [...new Set(ativos.flatMap((f) => f.categorias ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [ativos]);
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return ativos.filter((f) => (!categoria || (f.categorias ?? []).includes(categoria))
      && (!q || semAcento([f.empresa, f.nome_contato, ...(f.categorias ?? [])].join(' ')).includes(q)));
  }, [ativos, busca, categoria]);

  if (erro) {
    return (
      <div className="cmp-aviso-erro" role="alert">
        <span>{erro}</span>
        <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={onRecarregar}>Tentar novamente</button>
      </div>
    );
  }
  if (carregando) return <div className="cmp-skeleton h-40 w-full rounded-xl" aria-busy="true" role="status" aria-label="Carregando fornecedores" />;
  if (ativos.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-slate-200 mb-3">Nenhum fornecedor cadastrado</p>
        <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={onCadastrar}>Cadastrar fornecedor</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="cmp-campo flex-1 min-w-[12rem]">
          <label htmlFor="cmp-forn-busca">Buscar fornecedor</label>
          <input id="cmp-forn-busca" type="search" className="execucao-form-input" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onCadastrar}>＋ Cadastrar fornecedor</button>
      </div>
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => (
            <button key={c} type="button" aria-pressed={categoria === c} className={`cmp-selo cmp-btn-toque ${categoria === c ? 'bg-teal-500/20 text-teal-200 border border-teal-400' : 'bg-slate-500/15 text-slate-300 border border-slate-500/40'}`} onClick={() => setCategoria(categoria === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <p className="cmp-texto-mudo mb-2" aria-live="polite">{selecionados.size} de {MAX_FORNECEDORES} selecionados</p>
      {filtrados.length === 0 ? (
        <p className="text-slate-300 py-4">Nada encontrado.</p>
      ) : (
        <ul className="cmp-lista-limpa">
          {filtrados.map((f) => {
            const valido = whatsappValido(f.whatsapp);
            const marcado = selecionados.has(f.id);
            const cheio = !marcado && selecionados.size >= MAX_FORNECEDORES;
            const taxa = desempenho?.get(f.id)?.taxa;
            return (
              <li key={f.id} className="cmp-linha">
                <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" style={{ minHeight: 44 }}>
                  <input type="checkbox" className="cmp-checkbox mt-1" checked={marcado} disabled={!valido || cheio} onChange={() => onAlternar(f.id)} />
                  <span className="min-w-0">
                    <strong className="text-slate-100 break-words">{f.empresa}</strong>
                    <span className="block text-sm text-slate-300">{f.nome_contato} · {valido ? mascaraWhatsapp(f.whatsapp) : 'WhatsApp inválido'}</span>
                    {(f.categorias ?? []).length > 0 && <span className="block cmp-texto-mudo">{f.categorias.join(' · ')}</span>}
                    {taxa != null && <span className="block cmp-texto-mudo">📨 taxa de resposta {Math.round(Number(taxa))}%</span>}
                  </span>
                </label>
                {!valido && <button type="button" className="cmp-link" onClick={() => onEditar(f)}>Corrigir</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
