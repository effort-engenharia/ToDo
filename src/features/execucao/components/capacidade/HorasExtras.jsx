import React, { useEffect, useMemo, useState } from 'react';
import { FaCheck, FaPlus, FaTimes } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dataLocalISO, formatarDataBR, parseDataLocal } from '../../utils/datas';
import { formatarDataHora, formatarHoras, notificarResultado } from '../../utils/formatos';
import { isAdminExecucao } from '../../utils/permissoes';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import '../config/config.css';
import './capacidade.css';

const LIMITE_EXTRA_DIA_HORAS = 2;

const TIPOS = {
  extra_planejada: { rotulo: 'Extra planejada', classe: 'execucao-badge-yellow' },
  extra_realizada: { rotulo: 'Extra realizada', classe: 'execucao-badge-orange' },
  emergencia: { rotulo: 'Emergência', classe: 'execucao-badge-purple' },
};

const ABAS = [
  { id: 'pendente', rotulo: 'Pendentes' },
  { id: 'aprovada', rotulo: 'Aprovadas' },
  { id: 'cancelada', rotulo: 'Canceladas' },
];

const STATUS_BADGE = {
  pendente: { rotulo: 'Pendente', classe: 'execucao-badge-yellow' },
  aprovada: { rotulo: 'Aprovada', classe: 'execucao-badge-green' },
  cancelada: { rotulo: 'Cancelada', classe: 'execucao-badge-red' },
};

const mesAtual = () => dataLocalISO().slice(0, 7);

const intervaloDoMes = (mes) => {
  if (!mes) return {};
  const [ano, m] = mes.split('-').map(Number);
  return { inicio: `${mes}-01`, fim: dataLocalISO(new Date(ano, m, 0)) };
};

const FormRegistro = ({ usuario, admin, usuarios, onSalvar, onClose }) => {
  const [form, setForm] = useState({
    usuario_id: admin ? '' : usuario.id,
    data: dataLocalISO(),
    horas: '',
    tipo: 'extra_planejada',
    justificativa: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const horas = Number(String(form.horas).replace(',', '.'));
  const diaSemana = form.data ? parseDataLocal(form.data)?.getDay() : null;
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  const aviso = [];
  if (horas > LIMITE_EXTRA_DIA_HORAS && form.tipo !== 'emergencia') aviso.push(`Ultrapassa o limite diário de ${LIMITE_EXTRA_DIA_HORAS} h extras. Você pode registrar mesmo assim, com a justificativa.`);
  if (fimDeSemana && form.tipo !== 'emergencia') aviso.push('Sábado e domingo só são usados em emergência; considere o tipo “Emergência”.');

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.usuario_id) return setErro('Escolha o colaborador.');
    if (!form.data) return setErro('Informe a data.');
    if (Number.isNaN(horas) || horas <= 0 || horas > 24) return setErro('Informe as horas (maior que 0 e até 24). Ex.: 1,5 = 1h30.');
    if (form.justificativa.trim().length < 5) return setErro('A justificativa precisa ter pelo menos 5 caracteres.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({
      ...(globalThis.crypto?.randomUUID ? { id: globalThis.crypto.randomUUID() } : {}),
      usuario_id: form.usuario_id,
      data: form.data,
      horas: Math.round(horas * 100) / 100,
      tipo: form.tipo,
      justificativa: form.justificativa.trim(),
      registrado_por: usuario.id,
    });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo="Registrar hora extra ou emergência" onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          {admin ? (
            <div className="execucao-form-group">
              <label className="execucao-form-label" htmlFor="he-user">Colaborador</label>
              <select id="he-user" className="execucao-form-select" value={form.usuario_id} onChange={mudar('usuario_id')}>
                <option value="">Selecione…</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
              </select>
            </div>
          ) : (
            <div className="execucao-form-group">
              <span className="execucao-form-label">Colaborador</span>
              <div className="text-slate-100">{usuario.nome_completo}</div>
            </div>
          )}
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="he-tipo">Tipo</label>
            <select id="he-tipo" className="execucao-form-select" value={form.tipo} onChange={mudar('tipo')}>
              {Object.entries(TIPOS).map(([valor, t]) => <option key={valor} value={valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="he-data">Data</label>
            <input id="he-data" type="date" className="execucao-form-input" value={form.data} onChange={mudar('data')} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="he-horas">Horas (ex.: 1,5 = 1h30)</label>
            <input id="he-horas" className="execucao-form-input" inputMode="decimal" value={form.horas} onChange={mudar('horas')} />
          </div>
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="he-just">Justificativa</label>
            <textarea id="he-just" className="execucao-form-textarea" rows={3} value={form.justificativa} onChange={mudar('justificativa')} maxLength={500} />
          </div>
        </div>
        {aviso.map((texto) => <p key={texto} className="cfg-note mt-3" role="status">{texto}</p>)}
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>{salvando ? 'Registrando…' : 'Registrar'}</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalDecisao = ({ acao, registros, usuario, onConfirmar, onClose }) => {
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const aprovar = acao === 'aprovar';
  const totalHoras = registros.reduce((soma, r) => soma + Number(r.horas), 0);
  const proprios = registros.filter((r) => r.registrado_por === usuario.id).length;

  const enviar = async (e) => {
    e.preventDefault();
    if (justificativa.trim().length < 5) return setErro('A justificativa precisa ter pelo menos 5 caracteres.');
    setErro('');
    setEnviando(true);
    const ok = await onConfirmar(justificativa.trim());
    if (!ok) setEnviando(false);
  };

  return (
    <Modal titulo={`${aprovar ? 'Aprovar' : 'Cancelar'} ${registros.length} registro(s)`} onClose={onClose} tamanho="sm">
      <form onSubmit={enviar} noValidate>
        <p className="text-slate-300 mb-3">
          {registros.length} registro(s), total de <strong>{formatarHoras(totalHoras)}</strong>. A justificativa será enviada a quem registrou.
        </p>
        {proprios > 0 && <p className="cfg-note" role="status">{proprios} registro(s) foram feitos por você e serão marcados como “autoaprovados”.</p>}
        <div className="execucao-form-group">
          <label className="execucao-form-label" htmlFor="he-decisao">Justificativa da decisão</label>
          <textarea id="he-decisao" className="execucao-form-textarea" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} maxLength={500} />
        </div>
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Voltar</button>
          <button type="submit" className={`execucao-btn ${aprovar ? 'execucao-btn-success' : 'execucao-btn-danger'}`} disabled={enviando}>
            {enviando ? 'Enviando…' : aprovar ? 'Aprovar' : 'Cancelar registros'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const HorasExtras = ({ usuario }) => {
  const { toast } = useExecucaoUI();
  const admin = isAdminExecucao(usuario);
  const [aba, setAba] = useState('pendente');
  const [mes, setMes] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [tipo, setTipo] = useState('');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [registrando, setRegistrando] = useState(false);
  const [decisao, setDecisao] = useState(null);

  const usuarios = useAsyncData(() => (admin ? execucaoService.buscarTecnicos() : Promise.resolve({ success: true, data: [] })), [admin]);
  const filtroUsuario = admin ? usuarioId : usuario.id;
  const periodo = useMemo(() => intervaloDoMes(mes), [mes]);

  const lista = useAsyncData(
    () => servico.buscarHorasExtras({ status: aba, ...periodo, usuarioId: filtroUsuario, tipo }),
    [aba, periodo, filtroUsuario, tipo],
  );
  const pendentes = useAsyncData(() => servico.contarHorasExtrasPendentes(), []);

  // Seleção só vale para a lista exibida
  useEffect(() => { setSelecionados(new Set()); }, [aba, periodo, filtroUsuario, tipo]);

  const registros = useMemo(() => lista.data ?? [], [lista.data]);
  const escolhidos = useMemo(() => registros.filter((r) => selecionados.has(r.id)), [registros, selecionados]);

  const trocarAba = (id) => {
    setAba(id);
    setMes(id === 'pendente' ? '' : mesAtual());
  };

  const alternar = (id) => setSelecionados((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });
  const todosSelecionados = registros.length > 0 && selecionados.size === registros.length;

  const recarregar = () => { lista.reload(); pendentes.reload(); };

  const registrar = async (dados) => {
    const ok = notificarResultado(await servico.criarHoraExtra(dados), toast, 'Registro enviado para aprovação');
    if (ok) {
      setRegistrando(false);
      recarregar();
    }
    return ok;
  };

  const decidir = async (justificativa) => {
    const ids = decisao.registros.map((r) => r.id);
    const resultado = decisao.acao === 'aprovar'
      ? await servico.aprovarHorasExtras(ids, justificativa)
      : await servico.cancelarHorasExtras(ids, justificativa);
    if (!notificarResultado(resultado, toast)) return false;
    const decididos = Number(resultado.data) || 0;
    const verbo = decisao.acao === 'aprovar' ? 'aprovado(s)' : 'cancelado(s)';
    if (decididos < ids.length) toast.info(`${decididos} de ${ids.length} registro(s) ${verbo}; os demais já tinham sido decididos.`);
    else toast.success(`${decididos} registro(s) ${verbo}`);
    setDecisao(null);
    setSelecionados(new Set());
    recarregar();
    return true;
  };

  const totalPendentes = pendentes.data ?? 0;

  return (
    <div className="execucao-animate-fade-in">
      <div className="execucao-card">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">
            Horas extras e emergências
            {totalPendentes > 0 && <span className="execucao-badge execucao-badge-yellow ml-2">{totalPendentes} pendente(s)</span>}
          </h3>
          <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm" onClick={() => setRegistrando(true)}>
            <FaPlus aria-hidden="true" /> Registrar
          </button>
        </div>

        <div className="cfg-tabs" role="tablist" aria-label="Situação dos registros">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className="cfg-tab"
              aria-selected={aba === a.id}
              onClick={() => trocarAba(a.id)}
            >
              {a.rotulo}{a.id === 'pendente' && totalPendentes > 0 ? ` (${totalPendentes})` : ''}
            </button>
          ))}
        </div>

        <div className="cfg-toolbar">
          <div className="cfg-field">
            <label htmlFor="he-f-mes">Mês</label>
            <input id="he-f-mes" type="month" className="execucao-form-input" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <label className="cfg-check">
            <input type="checkbox" checked={mes === ''} onChange={(e) => setMes(e.target.checked ? '' : mesAtual())} />
            Todo o período
          </label>
          {admin && (
            <div className="cfg-field">
              <label htmlFor="he-f-user">Colaborador</label>
              <select id="he-f-user" className="execucao-form-select" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Todos</option>
                {(usuarios.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
              </select>
            </div>
          )}
          <div className="cfg-field">
            <label htmlFor="he-f-tipo">Tipo</label>
            <select id="he-f-tipo" className="execucao-form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([valor, t]) => <option key={valor} value={valor}>{t.rotulo}</option>)}
            </select>
          </div>
        </div>

        {lista.error && !lista.data ? (
          <ErroCarregamento mensagem={lista.error} onTentarNovamente={lista.reload} />
        ) : !lista.data ? (
          <Carregando />
        ) : !registros.length ? (
          <EstadoVazio
            titulo={aba === 'pendente' ? 'Nenhum registro pendente' : `Nenhum registro ${aba === 'aprovada' ? 'aprovado' : 'cancelado'}`}
            texto="Ajuste os filtros ou registre uma nova hora extra."
          />
        ) : (
          <>
            {admin && aba === 'pendente' && (
              <label className="cfg-check mb-2">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={() => setSelecionados(todosSelecionados ? new Set() : new Set(registros.map((r) => r.id)))}
                />
                Selecionar todos ({registros.length})
              </label>
            )}
            <ul className="he-lista">
              {registros.map((r) => {
                const t = TIPOS[r.tipo] ?? { rotulo: r.tipo, classe: 'execucao-badge-gray' };
                const nomeUsuario = r.usuario?.nome_completo ?? 'Colaborador';
                const obra = r.atividade?.etapa?.obra?.nome_cliente;
                const podeDecidir = admin && r.status === 'pendente';
                return (
                  <li key={r.id} className="he-item">
                    {podeDecidir ? (
                      <input
                        type="checkbox"
                        checked={selecionados.has(r.id)}
                        onChange={() => alternar(r.id)}
                        aria-label={`Selecionar ${t.rotulo.toLowerCase()} de ${nomeUsuario} em ${formatarDataBR(r.data)}`}
                      />
                    ) : <span aria-hidden="true" />}
                    <div>
                      <div className="he-titulo">
                        <span>{formatarDataBR(r.data)} · {nomeUsuario}</span>
                        <span className={`execucao-badge ${t.classe}`}>{formatarHoras(r.horas)} · {t.rotulo}</span>
                        {r.status !== 'pendente' && <span className={`execucao-badge ${STATUS_BADGE[r.status].classe}`}>{STATUS_BADGE[r.status].rotulo}</span>}
                        {r.autoaprovado && <span className="execucao-badge execucao-badge-gray">Autoaprovado</span>}
                      </div>
                      {(obra || r.atividade?.titulo) && <div className="he-meta">{[obra, r.atividade?.titulo].filter(Boolean).join(' · ')}</div>}
                      <p className="he-just">“{r.justificativa}”</p>
                      <div className="he-meta">
                        Registrado por {r.registrador?.nome_completo ?? '—'} em {formatarDataHora(r.created_at, { comAno: true })}
                      </div>
                      {r.status !== 'pendente' && (
                        <div className="he-meta">
                          {r.status === 'aprovada' ? 'Aprovada' : 'Cancelada'} por {r.decisor?.nome_completo ?? '—'} em {formatarDataHora(r.decidido_em, { comAno: true })}: “{r.justificativa_decisao}”
                        </div>
                      )}
                    </div>
                    {podeDecidir && (
                      <div className="he-acoes cfg-actions">
                        <button type="button" className="execucao-btn execucao-btn-success execucao-btn-sm" onClick={() => setDecisao({ acao: 'aprovar', registros: [r] })}>
                          <FaCheck aria-hidden="true" /> Aprovar
                        </button>
                        <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm" onClick={() => setDecisao({ acao: 'cancelar', registros: [r] })}>
                          <FaTimes aria-hidden="true" /> Cancelar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {registros.length >= 300 && <p className="cfg-muted mt-2">Mostrando os 300 primeiros registros; refine os filtros para ver os demais.</p>}
          </>
        )}

        {admin && aba === 'pendente' && escolhidos.length > 0 && (
          <div className="he-barra" role="region" aria-label="Ações em lote">
            <span className="text-slate-200">
              {escolhidos.length} selecionado(s) · {formatarHoras(escolhidos.reduce((s, r) => s + Number(r.horas), 0))}
            </span>
            <div className="cfg-actions">
              <button type="button" className="execucao-btn execucao-btn-danger execucao-btn-sm" onClick={() => setDecisao({ acao: 'cancelar', registros: escolhidos })}>
                <FaTimes aria-hidden="true" /> Cancelar selecionadas
              </button>
              <button type="button" className="execucao-btn execucao-btn-success execucao-btn-sm" onClick={() => setDecisao({ acao: 'aprovar', registros: escolhidos })}>
                <FaCheck aria-hidden="true" /> Aprovar selecionadas
              </button>
            </div>
          </div>
        )}
      </div>

      {registrando && (
        <FormRegistro usuario={usuario} admin={admin} usuarios={usuarios.data ?? []} onSalvar={registrar} onClose={() => setRegistrando(false)} />
      )}
      {decisao && (
        <ModalDecisao acao={decisao.acao} registros={decisao.registros} usuario={usuario} onConfirmar={decidir} onClose={() => setDecisao(null)} />
      )}
    </div>
  );
};

export default HorasExtras;
