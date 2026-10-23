import React, { useMemo, useState } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { addDias, dataLocalISO, formatarDataBR } from '../../utils/datas';
import { formatarHoras, notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';

const TIPOS = [
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'atestado', rotulo: 'Atestado' },
  { valor: 'treinamento', rotulo: 'Treinamento' },
  { valor: 'folga', rotulo: 'Folga' },
  { valor: 'outro', rotulo: 'Outro' },
];
const rotuloTipo = (valor) => TIPOS.find((t) => t.valor === valor)?.rotulo ?? valor;

const FormAusencia = ({ ausencia, usuarios, onSalvar, onClose }) => {
  const [form, setForm] = useState({
    usuario_id: ausencia?.usuario_id ?? '',
    tipo: ausencia?.tipo ?? 'ferias',
    data_inicio: ausencia?.data_inicio ?? dataLocalISO(),
    data_fim: ausencia?.data_fim ?? dataLocalISO(),
    horas_por_dia: ausencia?.horas_por_dia ?? '',
    observacao: ausencia?.observacao ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.usuario_id) return setErro('Escolha o colaborador.');
    if (!form.data_inicio || !form.data_fim) return setErro('Informe o período.');
    if (form.data_fim < form.data_inicio) return setErro('A data final não pode ser anterior à inicial.');
    const horas = form.horas_por_dia === '' ? null : Number(String(form.horas_por_dia).replace(',', '.'));
    if (horas !== null && (Number.isNaN(horas) || horas <= 0 || horas > 24)) return setErro('Horas por dia: informe um valor entre 0 e 24 ou deixe vazio para dia inteiro.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({
      usuario_id: form.usuario_id,
      tipo: form.tipo,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      horas_por_dia: horas,
      observacao: form.observacao.trim() || null,
    });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo={ausencia ? 'Editar ausência' : 'Nova ausência'} onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="aus-user">Colaborador</label>
            <select id="aus-user" className="execucao-form-select" value={form.usuario_id} onChange={mudar('usuario_id')}>
              <option value="">Selecione…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="aus-tipo">Tipo</label>
            <select id="aus-tipo" className="execucao-form-select" value={form.tipo} onChange={mudar('tipo')}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="aus-ini">De</label>
            <input id="aus-ini" type="date" className="execucao-form-input" value={form.data_inicio} onChange={mudar('data_inicio')} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="aus-fim">Até</label>
            <input id="aus-fim" type="date" className="execucao-form-input" value={form.data_fim} onChange={mudar('data_fim')} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="aus-horas">Horas ausentes por dia</label>
            <input id="aus-horas" className="execucao-form-input" inputMode="decimal" placeholder="Vazio = dia inteiro" value={form.horas_por_dia} onChange={mudar('horas_por_dia')} />
          </div>
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="aus-obs">Observação</label>
            <textarea id="aus-obs" className="execucao-form-textarea" rows={2} value={form.observacao} onChange={mudar('observacao')} maxLength={300} />
          </div>
        </div>
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
};

const AbaAusencias = () => {
  const { toast, confirmar } = useExecucaoUI();
  const [usuarioId, setUsuarioId] = useState('');
  const [inicio, setInicio] = useState(() => dataLocalISO(addDias(new Date(), -30)));
  const [fim, setFim] = useState(() => dataLocalISO(addDias(new Date(), 180)));
  const [editando, setEditando] = useState(null);

  const usuarios = useAsyncData(() => execucaoService.buscarTecnicos(), []);
  const ausencias = useAsyncData(() => servico.buscarAusencias({ inicio, fim, usuarioId }), [inicio, fim, usuarioId]);

  const nomes = useMemo(() => new Map((usuarios.data ?? []).map((u) => [u.id, u.nome_completo])), [usuarios.data]);

  const salvar = async (dados) => {
    const resultado = editando?.id ? await servico.atualizarAusencia(editando.id, dados) : await servico.criarAusencia(dados);
    const ok = notificarResultado(resultado, toast, 'Ausência salva');
    if (ok) {
      setEditando(null);
      ausencias.reload();
    }
    return ok;
  };

  const excluir = async (a) => {
    const confirmado = await confirmar({
      titulo: 'Excluir ausência',
      mensagem: `Excluir ${rotuloTipo(a.tipo).toLowerCase()} de ${nomes.get(a.usuario_id) ?? 'colaborador'} (${formatarDataBR(a.data_inicio)} a ${formatarDataBR(a.data_fim)})? As horas disponíveis voltam a ser contadas.`,
      confirmarTexto: 'Excluir',
    });
    if (confirmado && notificarResultado(await servico.excluirAusencia(a.id), toast, 'Ausência excluída')) ausencias.reload();
  };

  if (usuarios.error && !usuarios.data) return <ErroCarregamento mensagem={usuarios.error} onTentarNovamente={usuarios.reload} />;
  if (!usuarios.data) return <Carregando />;

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Ausências, férias e treinamentos</h3>
        <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm" onClick={() => setEditando({})}>
          <FaPlus aria-hidden="true" /> Nova ausência
        </button>
      </div>
      <p className="cfg-note">Ausências zeram (dia inteiro) ou reduzem (horas por dia) as horas disponíveis do colaborador no período.</p>

      <div className="cfg-toolbar">
        <div className="cfg-field">
          <label htmlFor="aus-f-user">Colaborador</label>
          <select id="aus-f-user" className="execucao-form-select" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.data.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
          </select>
        </div>
        <div className="cfg-field">
          <label htmlFor="aus-f-ini">De</label>
          <input id="aus-f-ini" type="date" className="execucao-form-input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="aus-f-fim">Até</label>
          <input id="aus-f-fim" type="date" className="execucao-form-input" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      {ausencias.error && !ausencias.data ? (
        <ErroCarregamento mensagem={ausencias.error} onTentarNovamente={ausencias.reload} />
      ) : !ausencias.data ? (
        <Carregando />
      ) : !ausencias.data.length ? (
        <EstadoVazio titulo="Nenhuma ausência no período" texto="Ajuste o período ou cadastre uma nova ausência." />
      ) : (
        <div className="cfg-table-wrap">
          <table className="execucao-table">
            <thead>
              <tr><th>Colaborador</th><th>Tipo</th><th>Período</th><th>Horas/dia</th><th>Observação</th><th><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody>
              {ausencias.data.map((a) => (
                <tr key={a.id}>
                  <td className="text-slate-100">{nomes.get(a.usuario_id) ?? 'Colaborador'}</td>
                  <td><span className="execucao-badge execucao-badge-purple">{rotuloTipo(a.tipo)}</span></td>
                  <td className="whitespace-nowrap">{formatarDataBR(a.data_inicio)} – {formatarDataBR(a.data_fim)}</td>
                  <td>{a.horas_por_dia == null ? 'Dia inteiro' : formatarHoras(a.horas_por_dia)}</td>
                  <td className="cfg-muted">{a.observacao || '—'}</td>
                  <td>
                    <div className="cfg-actions">
                      <button type="button" className="cfg-icon-btn" aria-label="Editar ausência" onClick={() => setEditando(a)}><FaEdit aria-hidden="true" /></button>
                      <button type="button" className="cfg-icon-btn perigo" aria-label="Excluir ausência" onClick={() => excluir(a)}><FaTrash aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && <FormAusencia ausencia={editando.id ? editando : null} usuarios={usuarios.data} onSalvar={salvar} onClose={() => setEditando(null)} />}
    </div>
  );
};

export default AbaAusencias;
