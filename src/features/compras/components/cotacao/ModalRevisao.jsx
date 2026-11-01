import React, { useMemo, useState } from 'react';
import Modal from '../../../execucao/components/ui/Modal';
import { useExecucaoUI } from '../../../execucao/components/ui/ExecucaoUI';
import comprasCotacaoService from '../../../../services/supabase/comprasCotacao';
import PainelEnvio from './PainelEnvio';
import SeletorPrazo from './SeletorPrazo';
import { prazoPadrao } from '../../utils/cotacao/envio';

const qtd = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Diff entre a lista antes e depois da revisão (por id da linha da cotação)
const diffLinhas = (antes, depois) => {
  const a = new Map(antes.map((l) => [l.id, l]));
  const d = new Map(depois.map((l) => [l.id, l]));
  const saida = [];
  depois.forEach((l) => {
    const x = a.get(l.id);
    if (!x) saida.push(`➕ ${l.descricao}: ${qtd(l.quantidade)} ${l.unidade}`);
    else if (Number(x.quantidade) !== Number(l.quantidade) || x.descricao !== l.descricao) {
      saida.push(`✏️ ${l.descricao}: ${qtd(x.quantidade)} → ${qtd(l.quantidade)} ${l.unidade}`);
    }
  });
  antes.forEach((l) => { if (!d.has(l.id)) saida.push(`➖ ${l.descricao}: removido`); });
  return saida;
};

/**
 * "Revisar cotação" (§10.5/B.5.7): 1) motivo e novo prazo → 2) alterações da lista → 3) avisar fornecedores (envio em 2 etapas).
 * `compras_cotacao_revisar` recompõe a lista e marca `precisa_reconfirmar`; o diff é mostrado depois, com o resultado.
 */
export default function ModalRevisao({ cotacao, linhasAtuais, convites, config, tokens, onToken, onAtualizar, onClose }) {
  const { toast } = useExecucaoUI();
  const [passo, setPasso] = useState(1);
  const [motivo, setMotivo] = useState('Lista alterada após o envio');
  const [prazo, setPrazo] = useState(() => prazoPadrao(48));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [antes] = useState(linhasAtuais);

  const diff = useMemo(() => (resultado ? diffLinhas(antes, resultado.itens ?? []) : []), [antes, resultado]);
  const idsReconfirmar = resultado?.convites_reconfirmar?.map((c) => c.convite_id) ?? [];

  const revisar = async () => {
    setErro('');
    if (motivo.trim().length < 3) { setErro('Informe o motivo da revisão.'); return; }
    if (!prazo.iso || new Date(prazo.iso).getTime() <= Date.now()) { setErro('Escolha um horário futuro para o novo prazo.'); return; }
    setOcupado(true);
    const r = await comprasCotacaoService.revisar(cotacao.id, motivo.trim(), prazo.iso);
    setOcupado(false);
    if (!r.success) { setErro(r.message || 'Não foi possível revisar a cotação.'); return; }
    setResultado(r.data);
    onAtualizar?.();
    toast.success(`Cotação revisada (lista v${r.data?.versao_lista ?? ''}).`);
    setPasso(2);
  };

  const prazoCotacao = prazo.iso ?? cotacao.prazo_resposta;
  const cotacaoAtual = { ...cotacao, prazo_resposta: prazoCotacao, versao_lista: resultado?.versao_lista ?? cotacao.versao_lista };

  return (
    <Modal tamanho="lg" variante="cheia" cabecalho={`Revisar cotação nº ${cotacao.numero}`} onClose={onClose}>
      <p className="cmp-texto-mudo mb-3" aria-live="polite">Passo {passo} de 3 · {['Motivo e novo prazo', 'Alterações da lista', 'Avisar fornecedores'][passo - 1]}</p>
      {erro && <div className="cmp-aviso-erro" role="alert"><span>{erro}</span></div>}

      {passo === 1 && (
        <div>
          <p className="text-slate-200 mb-3">A lista será recomposta a partir dos pedidos atuais. Fornecedores que já responderam serão marcados para reconfirmar.</p>
          <div className="cmp-campo mb-3">
            <label htmlFor="cmp-rev-motivo">Motivo *</label>
            <input id="cmp-rev-motivo" className="execucao-form-input" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <SeletorPrazo valor={prazo} onChange={setPrazo} />
          <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
            <button type="button" className="execucao-btn execucao-btn-secondary cmp-btn-toque" onClick={onClose} disabled={ocupado}>Cancelar</button>
            <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={revisar} disabled={ocupado} aria-busy={ocupado || undefined}>{ocupado ? 'Revisando…' : 'Revisar cotação'}</button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div>
          <h3 className="cmp-bloco-titulo">Alterações da lista</h3>
          {diff.length === 0 ? <p className="text-slate-300">A lista não mudou em relação à anterior.</p> : (
            <ul className="list-disc pl-5 text-sm text-slate-200 space-y-1">{diff.map((t) => <li key={t}>{t}</li>)}</ul>
          )}
          <p className="cmp-texto-mudo mt-3">Nova versão da lista: v{resultado?.versao_lista}. Novo prazo: definido.</p>
          <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
            <span />
            <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={() => setPasso(3)}>Avisar fornecedores</button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div>
          <PainelEnvio
            cotacao={cotacaoAtual} convites={convites} config={config} qtdItens={(resultado?.itens ?? antes).length}
            tokens={tokens} onToken={onToken} onAtualizado={onAtualizar} destaques={null}
            apenas={idsReconfirmar} titulo="Avisar fornecedores" tipoMensagem="revisao"
          />
          {idsReconfirmar.length === 0 && <p className="text-slate-300">Nenhum fornecedor precisa reconfirmar.</p>}
          <div className="cmp-rodape execucao-modal-footer !px-0 !pb-0">
            <span />
            <button type="button" className="execucao-btn execucao-btn-primary cmp-btn-toque" onClick={onClose}>Concluir</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
