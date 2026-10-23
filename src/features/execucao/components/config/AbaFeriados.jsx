import React, { useMemo, useState } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCopy } from 'react-icons/fa';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatarDataBR, parseDataLocal } from '../../utils/datas';
import { notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import { chaveFeriado, dataNoAno } from './calendario';

const ABRANGENCIAS = [
  { valor: 'nacional', rotulo: 'Nacional' },
  { valor: 'estadual', rotulo: 'Estadual' },
  { valor: 'municipal', rotulo: 'Municipal' },
];

const MOVEIS = [
  { valor: '', rotulo: 'Data fixa' },
  { valor: 'carnaval', rotulo: 'Móvel: Carnaval' },
  { valor: 'sexta_santa', rotulo: 'Móvel: Sexta-feira Santa' },
  { valor: 'corpus_christi', rotulo: 'Móvel: Corpus Christi' },
];

const rotuloAbrangencia = (f) => {
  if (f.abrangencia === 'estadual') return `Estadual (${f.uf})`;
  if (f.abrangencia === 'municipal') return `Municipal · ${f.cidade?.nome ?? 'cidade'}`;
  return 'Nacional';
};

const rotuloTipo = (f) => {
  if (f.movel) return 'Móvel (muda todo ano)';
  return f.recorrente ? 'Repete todo ano' : 'Só este ano';
};

const FormFeriado = ({ feriado, anoPadrao, cidades, onSalvar, onClose }) => {
  const [form, setForm] = useState({
    data: feriado?.data ?? `${anoPadrao}-01-01`,
    descricao: feriado?.descricao ?? '',
    abrangencia: feriado?.abrangencia ?? 'nacional',
    uf: feriado?.uf?.trim() ?? 'SP',
    cidade_id: feriado?.cidade_id ?? '',
    recorrente: feriado?.recorrente ?? true,
    movel: feriado?.movel ?? '',
    considerar_feriado: feriado?.considerar_feriado ?? true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.data) return setErro('Informe a data.');
    if (!form.descricao.trim()) return setErro('Informe a descrição.');
    if (form.abrangencia === 'municipal' && !form.cidade_id) return setErro('Escolha a cidade do feriado municipal.');
    if (form.abrangencia === 'estadual' && !/^[A-Za-z]{2}$/.test(form.uf.trim())) return setErro('Informe a UF com 2 letras.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({
      data: form.data,
      descricao: form.descricao.trim(),
      abrangencia: form.abrangencia,
      uf: form.abrangencia === 'estadual' ? form.uf.trim().toUpperCase() : null,
      cidade_id: form.abrangencia === 'municipal' ? form.cidade_id : null,
      recorrente: form.movel ? false : form.recorrente,
      movel: form.movel || null,
      considerar_feriado: form.considerar_feriado,
    });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo={feriado ? 'Editar feriado' : 'Novo feriado'} onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="fer-data">Data</label>
            <input id="fer-data" type="date" className="execucao-form-input" value={form.data} onChange={mudar('data')} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="fer-abr">Abrangência</label>
            <select id="fer-abr" className="execucao-form-select" value={form.abrangencia} onChange={mudar('abrangencia')}>
              {ABRANGENCIAS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
            </select>
          </div>
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="fer-desc">Descrição</label>
            <input id="fer-desc" className="execucao-form-input" value={form.descricao} onChange={mudar('descricao')} maxLength={120} />
          </div>
          {form.abrangencia === 'estadual' && (
            <div className="execucao-form-group">
              <label className="execucao-form-label" htmlFor="fer-uf">UF</label>
              <input id="fer-uf" className="execucao-form-input" value={form.uf} onChange={mudar('uf')} maxLength={2} />
            </div>
          )}
          {form.abrangencia === 'municipal' && (
            <div className="execucao-form-group">
              <label className="execucao-form-label" htmlFor="fer-cidade">Cidade</label>
              <select id="fer-cidade" className="execucao-form-select" value={form.cidade_id} onChange={mudar('cidade_id')}>
                <option value="">Selecione…</option>
                {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="fer-tipo">Tipo de data</label>
            <select id="fer-tipo" className="execucao-form-select" value={form.movel} onChange={mudar('movel')}>
              {MOVEIS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
          {!form.movel && (
            <label className="cfg-check">
              <input type="checkbox" checked={form.recorrente} onChange={mudar('recorrente')} />
              Repete todo ano na mesma data
            </label>
          )}
          <label className="cfg-check cfg-full">
            <input type="checkbox" checked={form.considerar_feriado} onChange={mudar('considerar_feriado')} />
            Considerar como feriado (desmarque para ponto facultativo tratado como dia normal)
          </label>
        </div>
        {feriado && <p className="cfg-muted mt-3">A alteração vale apenas para este ano. Use “Copiar para o próximo ano” para replicar.</p>}
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
};

const AbaFeriados = () => {
  const { toast, confirmar } = useExecucaoUI();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [abrangencia, setAbrangencia] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [copiando, setCopiando] = useState(false);

  const feriados = useAsyncData(() => servico.buscarFeriados(ano), [ano]);
  const cidades = useAsyncData(() => servico.buscarCidades(), []);

  const anos = useMemo(() => Array.from({ length: 7 }, (_, i) => anoAtual - 1 + i), [anoAtual]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (feriados.data ?? []).filter((f) =>
      (!abrangencia || f.abrangencia === abrangencia)
      && (!cidadeId || f.cidade_id === cidadeId)
      && (!termo || f.descricao.toLowerCase().includes(termo)));
  }, [feriados.data, abrangencia, cidadeId, busca]);

  const salvar = async (dados) => {
    const resultado = editando?.id
      ? await servico.atualizarFeriado(editando.id, dados)
      : await servico.criarFeriado(dados);
    const ok = notificarResultado(resultado, toast, 'Feriado salvo');
    if (ok) {
      setEditando(null);
      if (dados.data.slice(0, 4) !== String(ano)) setAno(Number(dados.data.slice(0, 4)));
      else feriados.reload();
    }
    return ok;
  };

  const alterarConsiderar = async (f, considerar) => {
    if (notificarResultado(await servico.atualizarFeriado(f.id, { considerar_feriado: considerar }), toast)) feriados.reload();
  };

  const excluir = async (f) => {
    const confirmado = await confirmar({
      titulo: 'Excluir feriado',
      mensagem: `Excluir "${f.descricao}" de ${formatarDataBR(f.data)}?`,
      confirmarTexto: 'Excluir',
    });
    if (confirmado && notificarResultado(await servico.excluirFeriado(f.id), toast, 'Feriado excluído')) feriados.reload();
  };

  const copiarProximoAno = async () => {
    const origem = (feriados.data ?? []).filter((f) => f.recorrente || f.movel);
    if (!origem.length) return toast.info(`Não há feriados fixos ou móveis em ${ano} para copiar.`);
    const confirmado = await confirmar({
      titulo: `Copiar para ${ano + 1}`,
      mensagem: `Copiar ${origem.length} feriado(s) fixo(s) e móvel(is) de ${ano} para ${ano + 1}? Datas móveis são recalculadas pela Páscoa e feriados já existentes são mantidos. Depois, confira se Carnaval e Corpus Christi devem ser feriado.`,
      confirmarTexto: 'Copiar',
      perigo: false,
    });
    if (!confirmado) return;
    setCopiando(true);
    try {
      const existentes = await servico.buscarFeriados(ano + 1);
      if (!existentes.success) return notificarResultado(existentes, toast);
      const chaves = new Set(existentes.data.map(chaveFeriado));
      const novos = origem
        .map((f) => ({
          data: dataNoAno(f, ano + 1),
          descricao: f.descricao,
          abrangencia: f.abrangencia,
          uf: f.uf,
          cidade_id: f.cidade_id,
          recorrente: f.recorrente,
          movel: f.movel,
          considerar_feriado: f.considerar_feriado,
        }))
        .filter((f) => !chaves.has(chaveFeriado(f)));
      if (!novos.length) return toast.info(`${ano + 1} já tem todos esses feriados.`);
      const resultado = await servico.criarFeriadosEmLote(novos);
      if (notificarResultado(resultado, toast, `${novos.length} feriado(s) criado(s) em ${ano + 1}`)) setAno(ano + 1);
    } finally {
      setCopiando(false);
    }
  };

  if (feriados.error && !feriados.data) return <ErroCarregamento mensagem={feriados.error} onTentarNovamente={feriados.reload} />;
  if ((feriados.loading && !feriados.data) || (cidades.loading && !cidades.data)) return <Carregando />;
  if (cidades.error && !cidades.data) return <ErroCarregamento mensagem={cidades.error} onTentarNovamente={cidades.reload} />;

  const listaCidades = cidades.data ?? [];

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Feriados</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={copiarProximoAno} disabled={copiando}>
            <FaCopy aria-hidden="true" /> {copiando ? 'Copiando…' : `Copiar para ${ano + 1}`}
          </button>
          <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm" onClick={() => setEditando({})}>
            <FaPlus aria-hidden="true" /> Novo feriado
          </button>
        </div>
      </div>

      <p className="cfg-note">
        Cronograma das obras: nacionais + estaduais + municipais da cidade da obra. Capacidade da equipe: nacionais + estaduais + municipais da cidade-base da jornada.
        Feriados marcados como “Dia normal” (ponto facultativo) não bloqueiam o dia.
      </p>

      <div className="cfg-toolbar">
        <div className="cfg-field">
          <label htmlFor="fer-filtro-ano">Ano</label>
          <select id="fer-filtro-ano" className="execucao-form-select" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="cfg-field">
          <label htmlFor="fer-filtro-abr">Abrangência</label>
          <select id="fer-filtro-abr" className="execucao-form-select" value={abrangencia} onChange={(e) => setAbrangencia(e.target.value)}>
            <option value="">Todas</option>
            {ABRANGENCIAS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
          </select>
        </div>
        <div className="cfg-field">
          <label htmlFor="fer-filtro-cidade">Cidade</label>
          <select id="fer-filtro-cidade" className="execucao-form-select" value={cidadeId} onChange={(e) => setCidadeId(e.target.value)}>
            <option value="">Todas</option>
            {listaCidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="cfg-field cfg-grow">
          <label htmlFor="fer-filtro-busca">Buscar</label>
          <input id="fer-filtro-busca" className="execucao-form-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição do feriado" />
        </div>
      </div>

      {!filtrados.length ? (
        <EstadoVazio titulo="Nenhum feriado encontrado" texto={`Nada cadastrado em ${ano} com esses filtros.`} />
      ) : (
        <div className="cfg-table-wrap">
          <table className="execucao-table">
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Abrangência</th><th>Tipo</th><th>Conta como</th><th><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody>
              {filtrados.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap">
                    <span className="text-slate-100">{formatarDataBR(f.data)}</span>{' '}
                    <span className="cfg-muted">{parseDataLocal(f.data)?.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                  </td>
                  <td className="text-slate-100">{f.descricao}</td>
                  <td>{rotuloAbrangencia(f)}</td>
                  <td className="cfg-muted">{rotuloTipo(f)}</td>
                  <td>
                    <select
                      className="execucao-form-select"
                      style={{ padding: '0.25rem 0.5rem', minWidth: '8rem' }}
                      aria-label={`Tratamento de ${f.descricao}`}
                      value={f.considerar_feriado ? 'sim' : 'nao'}
                      onChange={(e) => alterarConsiderar(f, e.target.value === 'sim')}
                    >
                      <option value="sim">Feriado</option>
                      <option value="nao">Dia normal</option>
                    </select>
                  </td>
                  <td>
                    <div className="cfg-actions">
                      <button type="button" className="cfg-icon-btn" aria-label={`Editar ${f.descricao}`} onClick={() => setEditando(f)}><FaEdit aria-hidden="true" /></button>
                      <button type="button" className="cfg-icon-btn perigo" aria-label={`Excluir ${f.descricao}`} onClick={() => excluir(f)}><FaTrash aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormFeriado
          feriado={editando.id ? editando : null}
          anoPadrao={ano}
          cidades={listaCidades}
          onSalvar={salvar}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
};

export default AbaFeriados;
