import React, { useMemo, useState } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCodeBranch, FaTimes } from 'react-icons/fa';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dataLocalISO, formatarDataBR } from '../../utils/datas';
import { formatarMinutos, notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import {
  DIAS, brutoReferencia, minutosDoDia, minutosLiquidos, periodosPadrao, periodosParaBanco, periodosParaForm,
  totalDescontos, validarPeriodos,
} from './jornadas';

const FormJornada = ({ modo, base, cidades, onSalvar, onClose }) => {
  const [nome, setNome] = useState(base?.nome ?? '');
  const [vigente, setVigente] = useState(modo === 'editar' ? base.vigente_desde : dataLocalISO());
  const [periodos, setPeriodos] = useState(() => periodosParaForm(base?.periodos ?? periodosPadrao()));
  const [descontos, setDescontos] = useState(() => (base?.descontos ?? []).map((d) => ({ descricao: d.descricao, minutos: String(d.minutos) })));
  const [extra, setExtra] = useState(String(base?.horas_extra_max_dia ?? 2));
  const [cidadeBase, setCidadeBase] = useState(base?.cidade_base_id ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const brutoDias = periodos;
  const bruto = brutoReferencia(Object.fromEntries(DIAS.map(({ chave }) => [chave, brutoDias[chave].map((p) => [p.ini, p.fim])])));
  const descontosValidos = descontos.map((d) => ({ minutos: Number(d.minutos) || 0 }));
  const liquido = minutosLiquidos(bruto, descontosValidos);

  const mudarPeriodo = (dia, indice, campo, valor) =>
    setPeriodos((p) => ({ ...p, [dia]: p[dia].map((x, i) => (i === indice ? { ...x, [campo]: valor } : x)) }));
  const adicionarPeriodo = (dia) => setPeriodos((p) => ({ ...p, [dia]: [...p[dia], { ini: '', fim: '' }] }));
  const removerPeriodo = (dia, indice) => setPeriodos((p) => ({ ...p, [dia]: p[dia].filter((_, i) => i !== indice) }));
  const copiarSegunda = () =>
    setPeriodos((p) => ({ ...p, ter: p.seg.map((x) => ({ ...x })), qua: p.seg.map((x) => ({ ...x })), qui: p.seg.map((x) => ({ ...x })), sex: p.seg.map((x) => ({ ...x })) }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome do modelo.');
    if (!vigente) return setErro('Informe a data de vigência.');
    const erroPeriodos = validarPeriodos(periodos);
    if (erroPeriodos) return setErro(erroPeriodos);
    const preenchidos = descontos.filter((d) => d.descricao.trim() || d.minutos !== '');
    for (const d of preenchidos) {
      if (!d.descricao.trim()) return setErro('Informe a descrição de todos os descontos.');
      const minutos = Number(d.minutos);
      if (!Number.isInteger(minutos) || minutos < 0 || minutos > 600) return setErro(`Desconto "${d.descricao}": informe minutos inteiros entre 0 e 600.`);
    }
    const horasExtra = Number(extra.replace(',', '.'));
    if (Number.isNaN(horasExtra) || horasExtra < 0 || horasExtra > 12) return setErro('Horas extras por dia: informe um valor entre 0 e 12.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({
      nome: nome.trim(),
      vigente_desde: vigente,
      periodos: periodosParaBanco(periodos),
      descontos: preenchidos.map((d) => ({ descricao: d.descricao.trim(), minutos: Number(d.minutos) })),
      horas_extra_max_dia: horasExtra,
      cidade_base_id: cidadeBase || null,
    });
    if (!ok) setSalvando(false);
  };

  const titulo = { novo: 'Novo modelo de jornada', versao: `Nova versão de “${base?.nome}”`, editar: `Editar versão de “${base?.nome}”` }[modo];

  return (
    <Modal titulo={titulo} onClose={onClose} tamanho="lg">
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="jor-nome">Nome do modelo</label>
            <input id="jor-nome" className="execucao-form-input" value={nome} onChange={(e) => setNome(e.target.value)} disabled={modo !== 'novo'} maxLength={80} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="jor-vigente">Vigente desde</label>
            <input id="jor-vigente" type="date" className="execucao-form-input" value={vigente} onChange={(e) => setVigente(e.target.value)} />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="execucao-form-label">Horários de trabalho (sem o almoço)</legend>
          {DIAS.map(({ chave, rotulo }) => (
            <div key={chave} className="cfg-dia">
              <span className="cfg-dia-nome">{rotulo}</span>
              <div>
                {periodos[chave].length === 0 && <span className="cfg-muted">Sem expediente (só emergência)</span>}
                {periodos[chave].map((p, i) => (
                  <div key={i} className="cfg-periodo">
                    <input type="time" className="execucao-form-input" aria-label={`${rotulo}: início do período ${i + 1}`} value={p.ini} onChange={(e) => mudarPeriodo(chave, i, 'ini', e.target.value)} />
                    <span aria-hidden="true">–</span>
                    <input type="time" className="execucao-form-input" aria-label={`${rotulo}: fim do período ${i + 1}`} value={p.fim} onChange={(e) => mudarPeriodo(chave, i, 'fim', e.target.value)} />
                    <button type="button" className="cfg-icon-btn perigo" aria-label={`Remover período ${i + 1} de ${rotulo}`} onClick={() => removerPeriodo(chave, i)}><FaTimes aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => adicionarPeriodo(chave)}>+ período</button>
                {chave === 'seg' && (
                  <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm ml-2" onClick={copiarSegunda}>Copiar para ter–sex</button>
                )}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="execucao-form-label">Descontos por dia útil (minutos)</legend>
          {descontos.map((d, i) => (
            <div key={i} className="cfg-desconto">
              <input className="execucao-form-input" aria-label={`Descrição do desconto ${i + 1}`} placeholder="Ex.: deslocamento entre obras" value={d.descricao} maxLength={80}
                onChange={(e) => setDescontos((l) => l.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} />
              <input className="execucao-form-input" type="number" min="0" max="600" step="1" aria-label={`Minutos do desconto ${i + 1}`} placeholder="min" value={d.minutos}
                onChange={(e) => setDescontos((l) => l.map((x, j) => (j === i ? { ...x, minutos: e.target.value } : x)))} />
              <button type="button" className="cfg-icon-btn perigo" aria-label={`Remover desconto ${i + 1}`} onClick={() => setDescontos((l) => l.filter((_, j) => j !== i))}><FaTrash aria-hidden="true" /></button>
            </div>
          ))}
          <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setDescontos((l) => [...l, { descricao: '', minutos: '' }])}>+ adicionar desconto</button>
        </fieldset>

        <div className="cfg-form-grid mt-4">
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="jor-extra">Hora extra máxima por dia (h)</label>
            <input id="jor-extra" className="execucao-form-input" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="jor-cidade">Cidade-base (feriados municipais)</label>
            <select id="jor-cidade" className="execucao-form-select" value={cidadeBase} onChange={(e) => setCidadeBase(e.target.value)}>
              <option value="">Nenhuma (só nacionais e estaduais)</option>
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="cfg-resumo mt-4" aria-live="polite">
          <span>Bruto: <strong>{formatarMinutos(bruto)}/dia</strong></span>
          <span>Descontos: <strong>{formatarMinutos(totalDescontos(descontosValidos))}</strong></span>
          <span>Disponível líquido: <strong>{formatarMinutos(liquido)}/dia</strong></span>
        </div>

        {modo === 'versao' && <p className="cfg-muted mt-3">A nova versão vale a partir da data de vigência; o passado não é recalculado.</p>}
        {modo === 'editar' && <p className="cfg-muted mt-3">Editar uma versão existente também altera o cálculo das datas já vigentes por ela. Para mudar só daqui para frente, crie uma nova versão.</p>}
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
};

const AbaJornadas = () => {
  const { toast, confirmar } = useExecucaoUI();
  const modelos = useAsyncData(() => servico.buscarJornadasModelo(), []);
  const cidades = useAsyncData(() => servico.buscarCidades(), []);
  const colaboradores = useAsyncData(() => servico.buscarJornadasColaborador(), []);
  const [form, setForm] = useState(null);

  const grupos = useMemo(() => {
    const mapa = new Map();
    (modelos.data ?? []).forEach((m) => {
      if (!mapa.has(m.nome)) mapa.set(m.nome, []);
      mapa.get(m.nome).push(m);
    });
    return [...mapa.entries()];
  }, [modelos.data]);

  const nomeCidade = (id) => cidades.data?.find((c) => c.id === id)?.nome ?? '—';

  const salvar = async (dados) => {
    const resultado = form.modo === 'editar'
      ? await servico.atualizarJornadaModelo(form.base.id, dados)
      : await servico.criarJornadaModelo(dados);
    const ok = notificarResultado(resultado, toast, 'Jornada salva');
    if (ok) {
      setForm(null);
      modelos.reload();
    }
    return ok;
  };

  const excluir = async (versao, qtdVersoes) => {
    const usadoPor = (colaboradores.data ?? []).filter((c) => c.modelo_nome === versao.nome).length;
    if (qtdVersoes === 1 && usadoPor > 0) {
      return toast.error(`“${versao.nome}” é usado por ${usadoPor} vínculo(s) de colaborador. Altere esses vínculos antes de excluir.`);
    }
    const confirmado = await confirmar({
      titulo: 'Excluir versão',
      mensagem: `Excluir a versão de “${versao.nome}” vigente desde ${formatarDataBR(versao.vigente_desde)}? Datas anteriores à próxima versão ficam sem jornada se não houver outra versão mais antiga.`,
      confirmarTexto: 'Excluir',
    });
    if (confirmado && notificarResultado(await servico.excluirJornadaModelo(versao.id), toast, 'Versão excluída')) modelos.reload();
  };

  const erro = modelos.error || cidades.error || colaboradores.error;
  if (erro && !modelos.data) return <ErroCarregamento mensagem={erro} onTentarNovamente={() => { modelos.reload(); cidades.reload(); colaboradores.reload(); }} />;
  if (!modelos.data || !cidades.data) return <Carregando />;

  const hoje = dataLocalISO();

  return (
    <div>
      <div className="execucao-card mb-4">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">Modelos de jornada e descontos</h3>
          <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm" onClick={() => setForm({ modo: 'novo', base: null })}>
            <FaPlus aria-hidden="true" /> Novo modelo
          </button>
        </div>
        <p className="cfg-note">
          Horas disponíveis = horários − descontos (valores em minutos por dia útil). Cada mudança deve ser uma <strong>nova versão</strong> com data de vigência,
          assim os meses anteriores continuam corretos. Sábado, domingo e feriados ficam com 0 h na capacidade normal.
        </p>
      </div>

      {!grupos.length && <EstadoVazio titulo="Nenhum modelo cadastrado" texto="Crie o modelo padrão da equipe." />}

      {grupos.map(([nome, versoes]) => {
        const vigente = versoes.find((v) => v.vigente_desde <= hoje)?.id;
        return (
          <section key={nome} className="execucao-card cfg-modelo" aria-label={`Modelo ${nome}`}>
            <div className="execucao-card-header">
              <h4 className="execucao-card-title">{nome}</h4>
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setForm({ modo: 'versao', base: versoes[0] })}>
                <FaCodeBranch aria-hidden="true" /> Nova versão
              </button>
            </div>
            <div className="cfg-table-wrap">
              <table className="execucao-table">
                <thead>
                  <tr><th>Vigente desde</th><th>Horários (seg)</th><th>Bruto</th><th>Descontos</th><th>Líquido</th><th>Extra máx.</th><th>Cidade-base</th><th><span className="sr-only">Ações</span></th></tr>
                </thead>
                <tbody>
                  {versoes.map((v) => {
                    const bruto = brutoReferencia(v.periodos);
                    return (
                      <tr key={v.id}>
                        <td className="whitespace-nowrap">
                          {formatarDataBR(v.vigente_desde)}
                          {v.id === vigente && <span className="execucao-badge execucao-badge-green ml-2">Vigente</span>}
                          {v.vigente_desde > hoje && <span className="execucao-badge execucao-badge-blue ml-2">Futura</span>}
                        </td>
                        <td className="cfg-muted">{(v.periodos?.seg ?? []).map(([a, b]) => `${a}–${b}`).join(' · ') || '—'}</td>
                        <td>{formatarMinutos(bruto)}</td>
                        <td>
                          {formatarMinutos(totalDescontos(v.descontos))}
                          {(v.descontos ?? []).length > 0 && (
                            <div className="cfg-muted">{v.descontos.map((d) => `${d.descricao} ${d.minutos}min`).join(' · ')}</div>
                          )}
                        </td>
                        <td className="text-slate-100">{formatarMinutos(minutosLiquidos(bruto, v.descontos))}</td>
                        <td>{formatarMinutos(Number(v.horas_extra_max_dia) * 60)}</td>
                        <td>{nomeCidade(v.cidade_base_id)}</td>
                        <td>
                          <div className="cfg-actions">
                            <button type="button" className="cfg-icon-btn" aria-label={`Editar versão de ${formatarDataBR(v.vigente_desde)}`} onClick={() => setForm({ modo: 'editar', base: v })}><FaEdit aria-hidden="true" /></button>
                            <button type="button" className="cfg-icon-btn perigo" aria-label={`Excluir versão de ${formatarDataBR(v.vigente_desde)}`} onClick={() => excluir(v, versoes.length)}><FaTrash aria-hidden="true" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="cfg-muted mt-2">
              Semana: {DIAS.map(({ chave, rotulo }) => `${rotulo} ${formatarMinutos(minutosDoDia(versoes[0].periodos?.[chave]))}`).join(' · ')} (versão mais recente)
            </p>
          </section>
        );
      })}

      {form && (
        <FormJornada modo={form.modo} base={form.base} cidades={cidades.data} onSalvar={salvar} onClose={() => setForm(null)} />
      )}
    </div>
  );
};

export default AbaJornadas;
