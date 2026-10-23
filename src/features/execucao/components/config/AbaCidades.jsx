import React, { useState } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';

const FormCidade = ({ cidade, onSalvar, onClose }) => {
  const [nome, setNome] = useState(cidade?.nome ?? '');
  const [uf, setUf] = useState(cidade?.uf?.trim() ?? 'SP');
  const [ativa, setAtiva] = useState(cidade?.ativa ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome da cidade.');
    if (!/^[A-Za-z]{2}$/.test(uf.trim())) return setErro('Informe a UF com 2 letras.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({ nome: nome.trim(), uf: uf.trim().toUpperCase(), ativa });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo={cidade ? 'Editar cidade' : 'Nova cidade'} onClose={onClose} tamanho="sm">
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="cidade-nome">Nome</label>
            <input id="cidade-nome" className="execucao-form-input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="cidade-uf">UF</label>
            <input id="cidade-uf" className="execucao-form-input" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
          </div>
          <label className="cfg-check">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Cidade atendida (ativa)
          </label>
        </div>
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AbaCidades = () => {
  const { toast, confirmar } = useExecucaoUI();
  const { data, loading, error, reload } = useAsyncData(() => servico.buscarCidades(), []);
  const [editando, setEditando] = useState(null);

  const salvar = async (dados) => {
    const resultado = editando?.id
      ? await servico.atualizarCidade(editando.id, dados)
      : await servico.criarCidade(dados);
    const ok = notificarResultado(resultado, toast, 'Cidade salva');
    if (ok) {
      setEditando(null);
      reload();
    }
    return ok;
  };

  const alternarAtiva = async (cidade) => {
    const resultado = await servico.atualizarCidade(cidade.id, { ativa: !cidade.ativa });
    if (notificarResultado(resultado, toast)) reload();
  };

  const excluir = async (cidade) => {
    const confirmado = await confirmar({
      titulo: 'Excluir cidade',
      mensagem: `Excluir "${cidade.nome}"? Os feriados municipais dessa cidade também serão excluídos. Se houver obras ou jornadas vinculadas, a exclusão será recusada: prefira desativar.`,
      confirmarTexto: 'Excluir',
    });
    if (!confirmado) return;
    if (notificarResultado(await servico.excluirCidade(cidade.id), toast, 'Cidade excluída')) reload();
  };

  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !data) return <Carregando />;

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Cidades atendidas</h3>
        <button type="button" className="execucao-btn execucao-btn-primary execucao-btn-sm" onClick={() => setEditando({})}>
          <FaPlus aria-hidden="true" /> Nova cidade
        </button>
      </div>
      <p className="cfg-muted mb-4">
        As obras apontam para este cadastro. Os feriados municipais valem para as obras da cidade e para a capacidade da equipe com cidade-base igual.
      </p>

      {!data?.length ? (
        <EstadoVazio titulo="Nenhuma cidade cadastrada" texto="Cadastre as cidades atendidas pela Execução." />
      ) : (
        <div className="cfg-table-wrap">
          <table className="execucao-table">
            <thead>
              <tr><th>Cidade</th><th>UF</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody>
              {data.map((cidade) => (
                <tr key={cidade.id}>
                  <td className="text-slate-100">{cidade.nome}</td>
                  <td>{cidade.uf}</td>
                  <td>
                    <button
                      type="button"
                      className={`execucao-badge ${cidade.ativa ? 'execucao-badge-green' : 'execucao-badge-gray'}`}
                      onClick={() => alternarAtiva(cidade)}
                      title={cidade.ativa ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      {cidade.ativa ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td>
                    <div className="cfg-actions">
                      <button type="button" className="cfg-icon-btn" aria-label={`Editar ${cidade.nome}`} onClick={() => setEditando(cidade)}>
                        <FaEdit aria-hidden="true" />
                      </button>
                      <button type="button" className="cfg-icon-btn perigo" aria-label={`Excluir ${cidade.nome}`} onClick={() => excluir(cidade)}>
                        <FaTrash aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && <FormCidade cidade={editando.id ? editando : null} onSalvar={salvar} onClose={() => setEditando(null)} />}
    </div>
  );
};

export default AbaCidades;
