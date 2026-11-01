import React, { useState } from 'react';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import { formatarBRL, formatarPercentual } from '../../utils/cotacao/moeda';
import { formatarDataHora } from '../../utils/statusCompra';

// "Ver versões anteriores" (B.5.2): disclosure que carrega as versões do convite e mostra o diff de preço por item.
export default function VersoesResposta({ conviteId, linhas }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState({ carregando: false, erro: '', versoes: null });

  const alternar = async () => {
    const abrir = !aberto;
    setAberto(abrir);
    if (!abrir || estado.versoes) return;
    setEstado({ carregando: true, erro: '', versoes: null });
    const r = await comprasCotacaoService.respostasVersoes(conviteId);
    setEstado(r.success ? { carregando: false, erro: '', versoes: r.data ?? [] } : { carregando: false, erro: r.message || 'Falha ao carregar', versoes: null });
  };

  const nome = (id) => linhas?.find((l) => l.id === id)?.descricao ?? 'Item';
  const versoes = estado.versoes ?? [];

  return (
    <div className="mt-2">
      <button type="button" className="cmp-link text-sm" aria-expanded={aberto} onClick={alternar}>ver versões anteriores {aberto ? '▴' : '▾'}</button>
      {aberto && (
        <div className="mt-2" aria-busy={estado.carregando || undefined}>
          {estado.carregando && <div className="cmp-skeleton h-12 w-full rounded" />}
          {estado.erro && <p className="cmp-erro-campo" role="alert">{estado.erro}</p>}
          {estado.versoes && versoes.length < 2 && <p className="cmp-texto-mudo">Só há uma versão.</p>}
          {versoes.length >= 2 && (
            <ul className="cmp-lista-limpa">
              {versoes.slice(1).map((v, i) => {
                const antes = versoes[i];
                const mudancas = (v.itens ?? []).map((it) => {
                  const ant = (antes.itens ?? []).find((x) => x.cotacao_item_id === it.cotacao_item_id);
                  const p0 = ant?.tem_item ? Number(ant.preco_unitario) : null;
                  const p1 = it.tem_item ? Number(it.preco_unitario) : null;
                  if (p0 === p1) return null;
                  const pct = p0 && p1 != null ? (p1 - p0) / p0 : null;
                  return { id: it.cotacao_item_id, texto: `${nome(it.cotacao_item_id)}: ${p0 == null ? 'não tinha' : formatarBRL(p0, 4)} → ${p1 == null ? 'não tem' : formatarBRL(p1, 4)}${pct != null ? ` (${formatarPercentual(pct, { sinal: true })})` : ''}` };
                }).filter(Boolean);
                return (
                  <li key={v.id} className="cmp-linha">
                    <div>
                      <p className="text-sm text-slate-100">v{v.versao} · {formatarDataHora(v.enviado_em)}{v.recusou ? ' · não vai cotar' : ''}</p>
                      {mudancas.length === 0 ? <p className="cmp-texto-mudo">Sem mudança de preço nos itens.</p> : (
                        <ul className="text-sm text-slate-300 list-disc pl-5">{mudancas.map((m) => <li key={m.id}>{m.texto}</li>)}</ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
