import React, { useId, useState } from 'react';
import { normalizarUnidade } from '../../utils/cotacao/normalizacao';
import { padraoEndereco, quantidadeDaLinha } from '../../utils/cotacao/montagem';
import SeletorMaterial from '../precos/SeletorMaterial';

const MAX_DESC = 200;
const MAX_OBS = 200;
const qtdTexto = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function Linha({ linha, indice, todas, pedidosPorId, onAlterar, onSeparar, onJuntar }) {
  const idBase = useId();
  const [aberto, setAberto] = useState(false);
  const [juntando, setJuntando] = useState(false);
  const elegiveis = todas.filter((o) => o._chave !== linha._chave && normalizarUnidade(o.unidade) === normalizarUnidade(linha.unidade));
  const nPedidos = new Set((linha.origens ?? []).map((o) => o.pedido_id)).size;

  return (
    <li className="cmp-bloco !mb-0">
      <div className="cmp-grade-campos">
        <div className="cmp-campo">
          <label htmlFor={`${idBase}-desc`}>Descrição pública *</label>
          <input
            id={`${idBase}-desc`} className="execucao-form-input" maxLength={MAX_DESC} value={linha.descricao}
            onChange={(e) => onAlterar(linha._chave, { descricao: e.target.value })} aria-describedby={`${idBase}-desc-n`}
          />
          <span id={`${idBase}-desc-n`} className="cmp-texto-mudo">{linha.descricao.length}/{MAX_DESC}</span>
        </div>
        <div className="cmp-campo">
          <span className="cmp-rotulo">Quantidade</span>
          <p className="text-sm text-slate-100">
            {qtdTexto(quantidadeDaLinha(linha))} {linha.unidade}
            {nPedidos > 1 && <span className="cmp-selo ml-2 bg-blue-500/15 text-blue-300 border border-blue-500/40">somado ({nPedidos} pedidos)</span>}
          </p>
        </div>
        <SeletorMaterial
          nome={linha.descricao || 'Material'} unidade={linha.unidade} valor={linha.material_id}
          onChange={(id) => onAlterar(linha._chave, { material_id: id })}
        />
        <div className="cmp-campo">
          <label htmlFor={`${idBase}-obs`}>Observação pública</label>
          <input id={`${idBase}-obs`} className="execucao-form-input" maxLength={MAX_OBS} value={linha.observacao_publica ?? ''} onChange={(e) => onAlterar(linha._chave, { observacao_publica: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {linha.origens.length} {linha.origens.length === 1 ? 'origem' : 'origens'} {aberto ? '▴' : '▾'}
        </button>
        {elegiveis.length > 0 && (
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" aria-expanded={juntando} onClick={() => setJuntando((v) => !v)}>
            Juntar com…
          </button>
        )}
      </div>

      {aberto && (
        <ul className="cmp-lista-limpa mt-2" aria-label="Composição da linha">
          {linha.origens.map((o) => (
            <li key={`${o.pedido_id}:${o.item_id}`} className="cmp-linha">
              <span className="text-sm text-slate-200">{pedidosPorId.get(o.pedido_id) ?? 'Pedido'}: {qtdTexto(o.quantidade)} {linha.unidade}</span>
              {linha.origens.length > 1 && (
                <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => onSeparar(linha._chave, o)}>
                  Separar linha
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {juntando && (
        <div className="cmp-sugestao mt-2" role="group" aria-label={`Juntar linha ${indice + 1} com`}>
          <p className="cmp-texto-mudo mb-2">Só linhas com a mesma unidade ({linha.unidade}). Confirme que são o mesmo material.</p>
          <div className="flex flex-col gap-2">
            {elegiveis.map((o) => (
              <button key={o._chave} type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque text-left" onClick={() => { setJuntando(false); onJuntar(linha._chave, o._chave); }}>
                {o.descricao} · {qtdTexto(quantidadeDaLinha(o))} {o.unidade}
              </button>
            ))}
            <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm cmp-btn-toque" onClick={() => setJuntando(false)}>Fechar</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function PassoItens({ itens, pedidosPorId, regiao, onAlterar, onSeparar, onJuntar }) {
  const [dispensado, setDispensado] = useState(false);
  return (
    <div>
      {!dispensado && (
        <div className="cmp-aviso flex justify-between gap-2" role="note">
          <span>Esta descrição será vista pelo fornecedor. Não inclua cliente, obra ou endereço.</span>
          <button type="button" className="underline font-semibold" onClick={() => setDispensado(true)}>Entendi</button>
        </div>
      )}
      {regiao && padraoEndereco.test(regiao) && (
        <div className="cmp-aviso" role="status">A região de entrega parece conter um endereço. Informe só cidade/bairro.</div>
      )}
      <ul className="cmp-lista-limpa">
        {itens.map((l, i) => (
          <Linha key={l._chave} linha={l} indice={i} todas={itens} pedidosPorId={pedidosPorId} onAlterar={onAlterar} onSeparar={onSeparar} onJuntar={onJuntar} />
        ))}
      </ul>
    </div>
  );
}
