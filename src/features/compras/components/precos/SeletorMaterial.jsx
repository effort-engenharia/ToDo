import React, { useEffect, useId, useState } from 'react';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';

// Seletor de material do catálogo (plano §10.2 passo 2 e §10.5 decisão). Select nativo (acessível por teclado e leitor de tela)
// com as sugestões de `compras_material_sugerir` (alias/exato/similar) e a opção "Criar novo material".
// A confirmação é sempre da atendente (D12): nenhuma sugestão é aplicada sozinha.
const ROTULO_ORIGEM = { alias: 'confirmado antes', exato: 'mesmo nome', similar: 'parecido' };

export default function SeletorMaterial({ nome, unidade, valor, onChange, rotulo = 'Material', desabilitado = false, id: idProp }) {
  const idAuto = useId();
  const id = idProp ?? idAuto;
  const [sugestoes, setSugestoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    comprasCotacaoService.sugerirMaterial(nome, unidade, 5).then((r) => {
      if (!vivo) return;
      setSugestoes(r.success && Array.isArray(r.data) ? r.data : []);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [nome, unidade]);

  // Material já vinculado mas fora das sugestões: continua na lista
  const opcoes = valor && !sugestoes.some((s) => s.id === valor)
    ? [{ id: valor, nome: 'Material confirmado', unidade, origem: null }, ...sugestoes]
    : sugestoes;

  const aoEscolher = async (e) => {
    const v = e.target.value;
    setErro('');
    if (v === '__novo') {
      setCriando(true);
      const r = await comprasCotacaoService.salvarMaterial(null, { nome, unidade });
      setCriando(false);
      if (!r.success) { setErro(r.message || 'Não foi possível criar o material.'); return; }
      onChange(r.data, { id: r.data, nome, unidade, novo: true });
      return;
    }
    onChange(v || null, opcoes.find((o) => o.id === v) ?? null);
  };

  return (
    <div className="cmp-campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} className="execucao-form-select" value={valor ?? ''} onChange={aoEscolher} disabled={desabilitado || criando} aria-busy={carregando || criando || undefined}>
        <option value="">{carregando ? 'Buscando…' : '⚠ Confirme o material'}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}{o.unidade ? ` (${o.unidade})` : ''}{o.origem ? ` · Sugerido: ${ROTULO_ORIGEM[o.origem] ?? o.origem}` : ''}
          </option>
        ))}
        <option value="__novo">＋ Criar novo material “{nome}”</option>
      </select>
      {erro && <p className="cmp-erro-campo" role="alert">{erro}</p>}
    </div>
  );
}
