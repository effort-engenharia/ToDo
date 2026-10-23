import React, { useMemo } from 'react';
import { execucaoAuditoriaService as servico } from '../../../../services/supabase/execucaoAuditoria';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatarDataHora } from '../../utils/formatos';
import { Carregando, ErroCarregamento } from '../ui/Estados';
import Modal from '../ui/Modal';
import {
  CAMPOS_OCULTOS, OPERACOES, artigoTabela, formatarValor, rotuloCampo, rotuloTabela,
} from './rotulos';

const LIMITE_LINHAS = 50;

const LinhaAuditoria = ({ linha, nomes }) => {
  const operacao = OPERACOES[linha.operacao] ?? { rotulo: linha.operacao, classe: 'execucao-badge-gray' };
  const base = linha.operacao === 'DELETE' ? linha.antes : linha.depois;

  const campos = linha.operacao === 'UPDATE'
    ? (linha.campos_alterados ?? [])
    : Object.keys(base ?? {}).filter((c) => !CAMPOS_OCULTOS.has(c) && base[c] !== null && base[c] !== '');

  return (
    <section className="hist-linha-detalhe" aria-label={`${operacao.rotulo} em ${rotuloTabela(linha.tabela)}`}>
      <h4>
        <span className={`execucao-badge ${operacao.classe}`}>{operacao.rotulo}</span>
        <span>{artigoTabela(linha.tabela)}</span>
        {linha.desfeito_em && <span className="execucao-badge execucao-badge-gray">Desfeita</span>}
      </h4>
      <table className="hist-diff">
        <thead>
          <tr>
            <th scope="col">Campo</th>
            {linha.operacao === 'UPDATE' ? <><th scope="col">Antes</th><th scope="col">Depois</th></> : <th scope="col">Valor</th>}
          </tr>
        </thead>
        <tbody>
          {campos.map((campo) => (
            <tr key={campo}>
              <th scope="row">{rotuloCampo(campo)}</th>
              {linha.operacao === 'UPDATE' ? (
                <>
                  <td className="hist-antes">{formatarValor(campo, linha.antes?.[campo], nomes)}</td>
                  <td className="hist-depois">{formatarValor(campo, linha.depois?.[campo], nomes)}</td>
                </>
              ) : (
                <td>{formatarValor(campo, base?.[campo], nomes)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

const DetalheAlteracao = ({ transacao, titulo, nomesUsuarios, onClose }) => {
  const { data, loading, error, reload } = useAsyncData(() => servico.buscarDetalheTransacao(transacao), [transacao]);
  const linhas = useMemo(() => data ?? [], [data]);

  return (
    <Modal titulo={titulo || 'Detalhe da alteração'} onClose={onClose} tamanho="lg">
      {error && !data ? <ErroCarregamento mensagem={error} onTentarNovamente={reload} />
        : loading && !data ? <Carregando />
          : !linhas.length ? <p className="text-slate-400">Nenhum detalhe disponível (o registro pode ter sido removido pela retenção).</p>
            : (
              <>
                <p className="cfg-muted mb-3">{linhas.length} alteração(ões) nesta ação · {formatarDataHora(linhas[0].created_at, { comAno: true })}</p>
                {linhas.slice(0, LIMITE_LINHAS).map((l) => <LinhaAuditoria key={l.id} linha={l} nomes={nomesUsuarios} />)}
                {linhas.length > LIMITE_LINHAS && <p className="cfg-muted">… e mais {linhas.length - LIMITE_LINHAS} alteração(ões) da mesma ação.</p>}
              </>
            )}
    </Modal>
  );
};

export default DetalheAlteracao;
