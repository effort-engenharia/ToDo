import React, { useState } from 'react';
import { FaEdit } from 'react-icons/fa';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';

const EQUIPES = { execucao: 'Execução', orcamentos: 'Orçamentos' };
const TIPOS_OBRA = { eletrica: 'Elétrica', civil: 'Civil', galpao: 'Galpão', misto: 'Misto' };

const carregar = async () => {
  const [tipos, templates] = await Promise.all([servico.buscarTiposServico(), servico.buscarTemplatesResumo()]);
  for (const r of [tipos, templates]) if (!r.success) return r;
  return { success: true, data: { tipos: tipos.data, templates: templates.data } };
};

const FormTipo = ({ tipo, templates, onSalvar, onClose }) => {
  const [form, setForm] = useState({
    nome: tipo.nome,
    equipe_responsavel: tipo.equipe_responsavel,
    tipo_obra: tipo.tipo_obra,
    template_padrao_id: tipo.template_padrao_id ?? '',
    evidencias_minimas: String(tipo.evidencias_minimas ?? 0),
    ativo: tipo.ativo,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const evidencias = Number(form.evidencias_minimas);
    if (!form.nome.trim()) return setErro('Informe o nome.');
    if (!Number.isInteger(evidencias) || evidencias < 0 || evidencias > 50) return setErro('Evidências mínimas: informe um número inteiro entre 0 e 50.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({
      nome: form.nome.trim(),
      equipe_responsavel: form.equipe_responsavel,
      tipo_obra: form.tipo_obra,
      template_padrao_id: form.template_padrao_id || null,
      evidencias_minimas: evidencias,
      ativo: form.ativo,
    });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo={`Tipo de serviço: ${tipo.nome}`} onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="tip-nome">Nome</label>
            <input id="tip-nome" className="execucao-form-input" value={form.nome} onChange={mudar('nome')} maxLength={80} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="tip-equipe">Equipe responsável</label>
            <select id="tip-equipe" className="execucao-form-select" value={form.equipe_responsavel} onChange={mudar('equipe_responsavel')}>
              {Object.entries(EQUIPES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="tip-obra">Tipo de obra</label>
            <select id="tip-obra" className="execucao-form-select" value={form.tipo_obra} onChange={mudar('tipo_obra')}>
              {Object.entries(TIPOS_OBRA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="tip-template">Template padrão</label>
            <select id="tip-template" className="execucao-form-select" value={form.template_padrao_id} onChange={mudar('template_padrao_id')}>
              <option value="">Nenhum</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="tip-evid">Evidências mínimas</label>
            <input id="tip-evid" type="number" min="0" max="50" step="1" className="execucao-form-input" value={form.evidencias_minimas} onChange={mudar('evidencias_minimas')} />
          </div>
          <label className="cfg-check cfg-full">
            <input type="checkbox" checked={form.ativo} onChange={mudar('ativo')} />
            Ativo (aparece no cadastro de obras)
          </label>
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

const AbaTiposServico = () => {
  const { toast } = useExecucaoUI();
  const { data, loading, error, reload } = useAsyncData(carregar, []);
  const [editando, setEditando] = useState(null);

  const salvar = async (dados) => {
    const ok = notificarResultado(await servico.atualizarTipoServico(editando.codigo, dados), toast, 'Tipo de serviço salvo');
    if (ok) {
      setEditando(null);
      reload();
    }
    return ok;
  };

  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !data) return <Carregando />;
  if (!data.tipos.length) return <EstadoVazio titulo="Nenhum tipo de serviço" />;

  const nomeTemplate = (id) => data.templates.find((t) => t.id === id)?.nome ?? '—';

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Tipos de serviço</h3>
      </div>
      <p className="cfg-note">Mapeiam o tipo de oportunidade do Comercial. Os termos de correspondência são mantidos pelo sistema.</p>
      <div className="cfg-table-wrap">
        <table className="execucao-table">
          <thead>
            <tr><th>Tipo</th><th>Equipe</th><th>Tipo de obra</th><th>Template padrão</th><th>Evidências</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {data.tipos.map((t) => (
              <tr key={t.codigo}>
                <td className="text-slate-100">{t.nome}<div className="cfg-muted">{t.modalidade === 'servico' ? 'Serviço rápido' : 'Obra'}</div></td>
                <td>{EQUIPES[t.equipe_responsavel] ?? t.equipe_responsavel}</td>
                <td>{TIPOS_OBRA[t.tipo_obra] ?? t.tipo_obra}</td>
                <td>{nomeTemplate(t.template_padrao_id)}</td>
                <td>{t.evidencias_minimas}</td>
                <td><span className={`execucao-badge ${t.ativo ? 'execucao-badge-green' : 'execucao-badge-gray'}`}>{t.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div className="cfg-actions">
                    <button type="button" className="cfg-icon-btn" aria-label={`Editar ${t.nome}`} onClick={() => setEditando(t)}><FaEdit aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && <FormTipo tipo={editando} templates={data.templates} onSalvar={salvar} onClose={() => setEditando(null)} />}
    </div>
  );
};

export default AbaTiposServico;
