import React from 'react';
import { FaExclamationTriangle, FaPlus, FaSyncAlt, FaTrash } from 'react-icons/fa';
import { TIPOS_ETAPA } from '../constants';
import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import { deslocamentoUteis, diasUteisEntre, formatarDataCurta, proximoDiaUtil } from '../utils';
import { editarDataPrevia, situacaoAndamento, terminoPrevisto } from './cadastroUtils';
import SeletorEquipe from './SeletorEquipe';
import './cadastro.css';

const ROTULO_SITUACAO = { concluida: 'Concluída', em_andamento: 'Em andamento', pendente: 'Pendente' };
const COR_SITUACAO = { concluida: 'cad-tag-verde', em_andamento: 'cad-tag-amarela', pendente: '' };

// Prévia editável das etapas geradas pelo template (datas em dias úteis, equipe, obra já em andamento).
// O estado das linhas fica no formulário da obra; aqui só se edita e se calcula o resumo.
const PreviaEtapas = ({
  etapas,
  onChange,
  tecnicos,
  calendario,
  dataFimContratada,
  onUsarTermino,
  onRecalcular,
  andamento,
  onAndamento,
  criarAtividades,
  onCriarAtividades
}) => {
  const hojeISO = dataLocalISO();
  // Mudar a equipe da etapa pai leva junto as sub-etapas que tinham o mesmo líder
  const atualizar = (indice, mudancas) => {
    const alvo = etapas[indice];
    const mudouEquipe = !alvo.pai_chave && ('lider_id' in mudancas || 'apoio_ids' in mudancas);
    onChange(etapas.map((e, i) => {
      if (i === indice) return { ...e, ...mudancas };
      if (mudouEquipe && e.pai_chave === alvo._chave && e.lider_id === alvo.lider_id) {
        return { ...e, lider_id: mudancas.lider_id ?? e.lider_id, apoio_ids: mudancas.apoio_ids ?? e.apoio_ids };
      }
      return e;
    }));
  };

  // Remover uma etapa principal remove também as sub-etapas dela
  const remover = (indice) => {
    const alvo = etapas[indice];
    onChange(etapas.filter((e, i) => i !== indice && e.pai_chave !== alvo._chave));
  };

  // Sub-etapa: logo abaixo da etapa pai (e das outras sub-etapas dela), dentro das datas do pai
  const adicionarSub = (indicePai) => {
    const pai = etapas[indicePai];
    let posicao = indicePai;
    etapas.forEach((e, i) => { if (e.pai_chave === pai._chave) posicao = i; });
    const nova = {
      _chave: `s${Date.now().toString(36)}${etapas.length}`,
      pai_chave: pai._chave,
      nome: '',
      descricao: '',
      tipo: pai.tipo,
      duracao_dias: 0,
      horas_previstas: '',
      qtd_tecnicos: pai.qtd_tecnicos || 1,
      pop_id: null,
      data_inicio: pai.data_inicio,
      data_fim: pai.data_fim,
      lider_id: pai.lider_id,
      apoio_ids: pai.apoio_ids,
      progresso: 0
    };
    onChange([...etapas.slice(0, posicao + 1), nova, ...etapas.slice(posicao + 1)]);
  };

  // "1", "1.1", "1.2", "2"...
  const rotulos = (() => {
    let principal = 0;
    const contagem = new Map();
    const mapa = new Map();
    etapas.forEach((e) => {
      if (!e.pai_chave) {
        principal += 1;
        mapa.set(e._chave, `${principal}`);
        contagem.set(e._chave, 0);
      } else {
        const n = (contagem.get(e.pai_chave) ?? 0) + 1;
        contagem.set(e.pai_chave, n);
        mapa.set(e._chave, `${mapa.get(e.pai_chave) ?? '?'}.${n}`);
      }
    });
    return mapa;
  })();
  const totalSubs = etapas.filter((e) => e.pai_chave).length;

  const adicionar = () => {
    const ultimoFim = etapas.length ? parseDataLocal(terminoPrevisto(etapas)) : new Date();
    const inicio = proximoDiaUtil(etapas.length ? addDias(ultimoFim, 1) : ultimoFim, calendario);
    onChange([
      ...etapas,
      {
        _chave: `n${Date.now().toString(36)}${etapas.length}`,
        nome: '',
        descricao: '',
        tipo: 'geral',
        duracao_dias: 1,
        horas_previstas: '',
        qtd_tecnicos: 1,
        pop_id: null,
        data_inicio: dataLocalISO(inicio),
        data_fim: dataLocalISO(inicio),
        lider_id: '',
        apoio_ids: [],
        progresso: 0
      }
    ]);
  };

  const fimCalculado = terminoPrevisto(etapas);
  const diasAtraso = dataFimContratada && fimCalculado && fimCalculado > dataFimContratada
    ? deslocamentoUteis(parseDataLocal(dataFimContratada), parseDataLocal(fimCalculado), calendario)
    : 0;
  const temPassado = !andamento && etapas.some((e) => e.data_inicio && e.data_inicio < hojeISO);
  const haEtapaComResponsavel = etapas.some((e) => e.tipo !== 'estoque' && e.lider_id);

  return (
    <section className="cad-previa" aria-labelledby="cad-previa-titulo">
      <div className="cad-previa-topo">
        <h4 id="cad-previa-titulo" className="text-sm font-medium text-purple-300">
          Prévia das etapas ({etapas.length - totalSubs}{totalSubs ? ` · ${totalSubs} sub-etapas` : ''})
        </h4>
        <button type="button" className="cad-link" onClick={onRecalcular} title="Recalcula as datas a partir do início previsto da obra">
          <FaSyncAlt size={10} aria-hidden="true" /> Recalcular datas
        </button>
      </div>

      {!calendario.carregado && (
        <p className="cad-aviso" role="status">
          Feriados não carregados: as datas consideram apenas sábados e domingos.
        </p>
      )}

      <div className="cad-previa-tabela-wrap">
        <table className="cad-previa-tabela">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Etapa</th>
              <th scope="col">Tipo</th>
              <th scope="col">Início</th>
              <th scope="col">Fim</th>
              <th scope="col" title="Dias úteis">Dias</th>
              <th scope="col">Responsável / equipe</th>
              {andamento && <th scope="col">Situação</th>}
              <th scope="col"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((etapa, i) => {
              const situacao = andamento ? situacaoAndamento(etapa, hojeISO) : null;
              const dias = etapa.data_inicio && etapa.data_fim
                ? diasUteisEntre(parseDataLocal(etapa.data_inicio), parseDataLocal(etapa.data_fim), calendario)
                : 0;
              const ehSub = Boolean(etapa.pai_chave);
              const rotulo = rotulos.get(etapa._chave);
              return (
                <tr key={etapa._chave} className={ehSub ? 'cad-previa-sub' : undefined}>
                  <td className="text-slate-500">{rotulo}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {ehSub && <span className="text-slate-500" aria-hidden="true">↳</span>}
                      <input
                        type="text"
                        className="cad-previa-input"
                        value={etapa.nome}
                        onChange={(e) => atualizar(i, { nome: e.target.value })}
                        aria-label={`Nome da ${ehSub ? 'sub-etapa' : 'etapa'} ${rotulo}`}
                        required
                      />
                      {!ehSub && (
                        <button
                          type="button"
                          className="cad-link shrink-0"
                          onClick={() => adicionarSub(i)}
                          title="Adicionar sub-etapa (parte da etapa, dentro das mesmas datas)"
                          aria-label={`Adicionar sub-etapa à etapa ${rotulo}`}
                        >
                          <FaPlus size={9} aria-hidden="true" /> sub
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      className="cad-previa-input"
                      value={etapa.tipo}
                      onChange={(e) => atualizar(i, e.target.value === 'estoque'
                        ? { tipo: 'estoque', lider_id: '', apoio_ids: [] }
                        : { tipo: e.target.value })}
                      aria-label={`Tipo da etapa ${rotulo}`}
                    >
                      {TIPOS_ETAPA.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      className="cad-previa-input"
                      value={etapa.data_inicio}
                      onChange={(e) => e.target.value && onChange(editarDataPrevia(etapas, i, 'data_inicio', e.target.value, calendario))}
                      aria-label={`Início da etapa ${rotulo}`}
                      disabled={ehSub}
                      title={ehSub ? 'A sub-etapa acompanha as datas da etapa pai' : undefined}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="cad-previa-input"
                      value={etapa.data_fim}
                      min={etapa.data_inicio}
                      onChange={(e) => e.target.value && onChange(editarDataPrevia(etapas, i, 'data_fim', e.target.value, calendario))}
                      aria-label={`Fim da etapa ${rotulo}`}
                      disabled={ehSub}
                      title={ehSub ? 'A sub-etapa acompanha as datas da etapa pai' : undefined}
                      required
                    />
                  </td>
                  <td className="text-slate-400 text-center">{ehSub ? '—' : dias}</td>
                  <td>
                    {etapa.tipo === 'estoque' ? (
                      <span className="cad-tag cad-tag-azul">📦 gera pedido de material</span>
                    ) : (
                      <SeletorEquipe
                        tecnicos={tecnicos}
                        liderId={etapa.lider_id}
                        apoioIds={etapa.apoio_ids}
                        sugerido={etapa.qtd_tecnicos}
                        rotulo={`Equipe da etapa ${rotulo}`}
                        onChange={({ liderId, apoioIds }) => atualizar(i, { lider_id: liderId, apoio_ids: apoioIds })}
                      />
                    )}
                  </td>
                  {andamento && (
                    <td>
                      <span className={`cad-tag ${COR_SITUACAO[situacao]}`}>{ROTULO_SITUACAO[situacao]}</span>
                      {situacao === 'em_andamento' && (
                        <label className="cad-previa-progresso">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            className="cad-previa-input"
                            value={etapa.progresso}
                            onChange={(e) => atualizar(i, { progresso: Math.min(99, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                            aria-label={`Progresso atual da etapa ${rotulo} em porcentagem`}
                          />
                          %
                        </label>
                      )}
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="cad-previa-remover"
                      onClick={() => remover(i)}
                      aria-label={`Remover ${ehSub ? 'sub-etapa' : 'etapa'} ${rotulo}`}
                    >
                      <FaTrash size={10} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="cad-link mt-2" onClick={adicionar}>
        <FaPlus size={10} aria-hidden="true" /> Adicionar etapa
      </button>

      {etapas.length > 0 && (
        <p className={`cad-previa-resumo ${diasAtraso > 0 ? 'cad-previa-resumo-alerta' : ''}`} role="status">
          Término previsto {formatarDataCurta(fimCalculado)}
          {dataFimContratada && <> · contratado {formatarDataCurta(dataFimContratada)}</>}
          {diasAtraso > 0 && (
            <>
              {' '}<FaExclamationTriangle aria-hidden="true" /> +{diasAtraso} {diasAtraso === 1 ? 'dia útil' : 'dias úteis'}
              <button type="button" className="cad-link ml-2" onClick={() => onUsarTermino(fimCalculado)}>
                Usar como término previsto da obra
              </button>
            </>
          )}
        </p>
      )}

      <div className="cad-previa-opcoes">
        <label className="cad-opcao">
          <input type="checkbox" className="w-4 h-4" checked={andamento} onChange={(e) => onAndamento(e.target.checked)} />
          <span>
            <strong>Obra já em andamento</strong>
            <small>Etapas que terminam antes de hoje entram como concluídas; a etapa atual entra em andamento com o progresso informado.</small>
          </span>
        </label>
        <label className="cad-opcao">
          <input type="checkbox" className="w-4 h-4" checked={criarAtividades} onChange={(e) => onCriarAtividades(e.target.checked)} />
          <span>
            <strong>Enviar etapas com responsável para a agenda dos técnicos</strong>
            <small>
              {criarAtividades
                ? (haEtapaComResponsavel ? 'As atividades são criadas ao salvar.' : 'Nenhuma etapa tem responsável ainda.')
                : 'As etapas serão salvas sem atividades na agenda.'}
            </small>
          </span>
        </label>
      </div>

      {temPassado && (
        <p className="cad-aviso" role="status">
          <FaExclamationTriangle aria-hidden="true" /> Há etapas com início no passado. Ajuste as datas ou ative &quot;Obra já em andamento&quot;.
        </p>
      )}
    </section>
  );
};

export default PreviaEtapas;
