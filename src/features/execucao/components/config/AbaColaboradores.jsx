import React, { useMemo, useState } from 'react';
import { FaEdit, FaHistory, FaTrash } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoCapacidadeService as servico } from '../../../../services/supabase/execucaoCapacidade';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dataLocalISO, formatarDataBR } from '../../utils/datas';
import { formatarMinutos, notificarResultado } from '../../utils/formatos';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import { brutoReferencia, minutosLiquidos } from './jornadas';

const MODELO_PADRAO = 'Padrão Execução';

const carregar = async () => {
  const [usuarios, modelos, vinculos] = await Promise.all([
    execucaoService.buscarTecnicos(),
    servico.buscarJornadasModelo(),
    servico.buscarJornadasColaborador(),
  ]);
  for (const r of [usuarios, modelos, vinculos]) if (!r.success) return r;
  return { success: true, data: { usuarios: usuarios.data, modelos: modelos.data, vinculos: vinculos.data } };
};

const FormVinculo = ({ usuario, nomesModelos, onSalvar, onClose }) => {
  const [modelo, setModelo] = useState(nomesModelos.includes(MODELO_PADRAO) ? MODELO_PADRAO : nomesModelos[0] ?? '');
  const [vigente, setVigente] = useState(dataLocalISO());
  const [ajuste, setAjuste] = useState('0');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    const minutos = Number(ajuste);
    if (!modelo) return setErro('Escolha o modelo de jornada.');
    if (!vigente) return setErro('Informe a data de vigência.');
    if (!Number.isInteger(minutos) || Math.abs(minutos) > 480) return setErro('Ajuste: informe minutos inteiros entre -480 e 480.');
    setErro('');
    setSalvando(true);
    const ok = await onSalvar({ usuario_id: usuario.id, vigente_desde: vigente, modelo_nome: modelo, ajuste_minutos_dia: minutos });
    if (!ok) setSalvando(false);
  };

  return (
    <Modal titulo={`Jornada de ${usuario.nome_completo}`} onClose={onClose} tamanho="sm">
      <form onSubmit={enviar} noValidate>
        <div className="cfg-form-grid">
          <div className="execucao-form-group cfg-full">
            <label className="execucao-form-label" htmlFor="vin-modelo">Modelo</label>
            <select id="vin-modelo" className="execucao-form-select" value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {nomesModelos.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="vin-vigente">Vigente desde</label>
            <input id="vin-vigente" type="date" className="execucao-form-input" value={vigente} onChange={(e) => setVigente(e.target.value)} />
          </div>
          <div className="execucao-form-group">
            <label className="execucao-form-label" htmlFor="vin-ajuste">Ajuste individual (min/dia)</label>
            <input id="vin-ajuste" type="number" step="1" className="execucao-form-input" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
          </div>
        </div>
        <p className="cfg-muted mt-3">Use ajuste negativo para reduzir (ex.: -60) ou positivo para aumentar as horas disponíveis. Um vínculo na mesma data substitui o anterior.</p>
        {erro && <p className="cfg-erro" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
};

const AbaColaboradores = () => {
  const { toast, confirmar } = useExecucaoUI();
  const { data, loading, error, reload } = useAsyncData(carregar, []);
  const [editando, setEditando] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const nomesModelos = useMemo(() => [...new Set((data?.modelos ?? []).map((m) => m.nome))], [data]);
  const hoje = dataLocalISO();

  const linhas = useMemo(() => {
    if (!data) return [];
    return data.usuarios.map((u) => {
      const historico = data.vinculos.filter((v) => v.usuario_id === u.id); // já vem do mais novo ao mais antigo
      const vigente = historico.find((v) => v.vigente_desde <= hoje) ?? null;
      const nomeModelo = vigente?.modelo_nome ?? MODELO_PADRAO;
      const versao = data.modelos.find((m) => m.nome === nomeModelo && m.vigente_desde <= hoje);
      const liquido = versao ? minutosLiquidos(brutoReferencia(versao.periodos), versao.descontos, vigente?.ajuste_minutos_dia ?? 0) : null;
      return { usuario: u, historico, vigente, nomeModelo, liquido };
    });
  }, [data, hoje]);

  const salvar = async (registro) => {
    const ok = notificarResultado(await servico.salvarJornadaColaborador(registro), toast, 'Jornada do colaborador salva');
    if (ok) {
      setEditando(null);
      reload();
    }
    return ok;
  };

  const excluir = async (vinculo) => {
    const confirmado = await confirmar({
      titulo: 'Excluir vínculo',
      mensagem: `Excluir o vínculo vigente desde ${formatarDataBR(vinculo.vigente_desde)} (${vinculo.modelo_nome})?`,
      confirmarTexto: 'Excluir',
    });
    if (confirmado && notificarResultado(await servico.excluirJornadaColaborador(vinculo.usuario_id, vinculo.vigente_desde), toast, 'Vínculo excluído')) reload();
  };

  if (error && !data) return <ErroCarregamento mensagem={error} onTentarNovamente={reload} />;
  if (loading && !data) return <Carregando />;
  if (!linhas.length) return <EstadoVazio titulo="Nenhum colaborador" texto="Não há técnicos ativos cadastrados." />;

  return (
    <div className="execucao-card">
      <div className="execucao-card-header">
        <h3 className="execucao-card-title">Jornada por colaborador</h3>
      </div>
      <p className="cfg-note">
        Quem não tem vínculo usa o modelo “{MODELO_PADRAO}”. Para jornadas diferentes, vincule outro modelo ou um ajuste individual em minutos por dia, a partir de uma data.
      </p>
      <div className="cfg-table-wrap">
        <table className="execucao-table">
          <thead>
            <tr><th>Colaborador</th><th>Modelo vigente</th><th>Ajuste</th><th>Líquido/dia</th><th>Desde</th><th><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {linhas.map(({ usuario, historico, vigente, nomeModelo, liquido }) => (
              <React.Fragment key={usuario.id}>
                <tr>
                  <td className="text-slate-100">
                    {usuario.nome_completo}
                    {usuario.nivel_acesso?.nome !== 'TECNICO' && <span className="execucao-badge execucao-badge-gray ml-2">{usuario.nivel_acesso?.nome}</span>}
                  </td>
                  <td>{nomeModelo}{!vigente && <span className="cfg-muted"> (padrão)</span>}</td>
                  <td>{vigente?.ajuste_minutos_dia ? `${vigente.ajuste_minutos_dia > 0 ? '+' : ''}${vigente.ajuste_minutos_dia} min` : '—'}</td>
                  <td>{liquido === null ? '—' : formatarMinutos(liquido)}</td>
                  <td>{vigente ? formatarDataBR(vigente.vigente_desde) : '—'}</td>
                  <td>
                    <div className="cfg-actions">
                      <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" onClick={() => setEditando(usuario)}>
                        <FaEdit aria-hidden="true" /> Alterar
                      </button>
                      {historico.length > 0 && (
                        <button
                          type="button"
                          className="cfg-icon-btn"
                          aria-expanded={expandido === usuario.id}
                          aria-label={`Histórico de jornada de ${usuario.nome_completo} (${historico.length})`}
                          onClick={() => setExpandido(expandido === usuario.id ? null : usuario.id)}
                        >
                          <FaHistory aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandido === usuario.id && historico.map((h) => (
                  <tr key={`${usuario.id}-${h.vigente_desde}`}>
                    <td className="cfg-muted" colSpan={2}>↳ {h.modelo_nome} desde {formatarDataBR(h.vigente_desde)}</td>
                    <td className="cfg-muted" colSpan={3}>Ajuste: {h.ajuste_minutos_dia} min/dia</td>
                    <td>
                      <div className="cfg-actions">
                        <button type="button" className="cfg-icon-btn perigo" aria-label={`Excluir vínculo de ${formatarDataBR(h.vigente_desde)}`} onClick={() => excluir(h)}>
                          <FaTrash aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editando && <FormVinculo usuario={editando} nomesModelos={nomesModelos} onSalvar={salvar} onClose={() => setEditando(null)} />}
    </div>
  );
};

export default AbaColaboradores;
