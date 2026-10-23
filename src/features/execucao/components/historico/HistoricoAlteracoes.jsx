import React, { useMemo, useState } from 'react';
import { FaEye, FaUndo } from 'react-icons/fa';
import { execucaoService } from '../../../../services/supabase/execucao';
import { execucaoAuditoriaService as servico } from '../../../../services/supabase/execucaoAuditoria';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { addDias, dataLocalISO } from '../../utils/datas';
import { formatarDataHora, notificarResultado } from '../../utils/formatos';
import { isAdminExecucao } from '../../utils/permissoes';
import { Carregando, ErroCarregamento, EstadoVazio } from '../ui/Estados';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import Modal from '../ui/Modal';
import '../config/config.css';
import DetalheAlteracao from './DetalheAlteracao';
import ManutencaoHistorico from './ManutencaoHistorico';
import { TABELAS, artigoTabela, rotuloTabela } from './rotulos';
import './historico.css';

const TAMANHO_PAGINA = 25;

const PERIODOS = [
  { valor: '7', rotulo: 'Últimos 7 dias', dias: 7 },
  { valor: '30', rotulo: 'Últimos 30 dias', dias: 30 },
  { valor: '90', rotulo: 'Últimos 90 dias', dias: 90 },
  { valor: 'todos', rotulo: 'Todo o histórico' },
  { valor: 'custom', rotulo: 'Escolher datas' },
];

const carregarFiltros = async () => {
  const [usuarios, obras] = await Promise.all([execucaoService.buscarTecnicos(), servico.buscarObrasResumo()]);
  for (const r of [usuarios, obras]) if (!r.success) return r;
  return { success: true, data: { usuarios: usuarios.data, obras: obras.data } };
};

const ModalConflito = ({ conflitos, nomes, onVerMudanca, onForcar, onClose, forcando }) => (
  <Modal titulo="Há alterações posteriores" onClose={onClose} tamanho="md">
    <p className="text-slate-300 mb-3">
      Alguns registros desta ação foram alterados depois por outra ação. Desfazer agora sobrescreve essas mudanças.
    </p>
    <ul className="hist-conflitos">
      {conflitos.map((c) => (
        <li key={`${c.tabela}-${c.registro_id}`}>
          {artigoTabela(c.tabela).replace(/^\w/, (l) => l.toUpperCase())} foi {c.operacao === 'DELETE' ? 'excluído(a)' : c.operacao === 'INSERT' ? 'criado(a)' : 'alterado(a)'} depois
          {c.usuario_id ? ` por ${nomes.get(c.usuario_id) ?? 'outro usuário'}` : ''} em {formatarDataHora(c.quando, { comAno: true })}.{' '}
          <button type="button" className="underline text-blue-400" onClick={() => onVerMudanca(c)}>Ver mudança</button>
        </li>
      ))}
    </ul>
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="execucao-btn execucao-btn-danger" onClick={onForcar} disabled={forcando}>
        {forcando ? 'Desfazendo…' : 'Desfazer mesmo assim'}
      </button>
    </div>
  </Modal>
);

const HistoricoAlteracoes = ({ usuario }) => {
  const { toast, confirmar } = useExecucaoUI();
  const admin = isAdminExecucao(usuario);

  const [obraId, setObraId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [tabela, setTabela] = useState('');
  const [periodo, setPeriodo] = useState('7');
  const [inicioCustom, setInicioCustom] = useState('');
  const [fimCustom, setFimCustom] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [detalhe, setDetalhe] = useState(null);
  const [conflito, setConflito] = useState(null);
  const [desfazendo, setDesfazendo] = useState(null);

  const buscaDebounced = useDebouncedValue(busca, 350);
  const filtros = useAsyncData(carregarFiltros, []);
  const nomes = useMemo(() => new Map((filtros.data?.usuarios ?? []).map((u) => [u.id, u.nome_completo])), [filtros.data]);

  const intervalo = useMemo(() => {
    if (periodo === 'custom') return { inicio: inicioCustom || null, fim: fimCustom || null };
    const p = PERIODOS.find((x) => x.valor === periodo);
    return p?.dias ? { inicio: dataLocalISO(addDias(new Date(), -p.dias)), fim: null } : { inicio: null, fim: null };
  }, [periodo, inicioCustom, fimCustom]);

  const lista = useAsyncData(
    () => servico.listarHistoricoAlteracoes({
      obraId, usuarioId, tabela, busca: buscaDebounced, ...intervalo, limite: TAMANHO_PAGINA + 1, offset: pagina * TAMANHO_PAGINA,
    }),
    [obraId, usuarioId, tabela, buscaDebounced, intervalo, pagina],
  );

  // Qualquer mudança de filtro volta para a primeira página
  const filtrar = (setter) => (e) => {
    setter(e.target.value);
    setPagina(0);
  };

  const itens = (lista.data ?? []).slice(0, TAMANHO_PAGINA);
  const temProxima = (lista.data ?? []).length > TAMANHO_PAGINA;

  const finalizarDesfazer = (resultado) => {
    const r = resultado.data;
    toast.success(`Ação desfeita: ${r.desfeitas} alteração(ões) revertida(s)${r.restauradas ? ` e ${r.restauradas} registro(s) restaurado(s)` : ''}.`);
    setConflito(null);
    lista.reload();
  };

  const desfazer = async (item) => {
    const confirmado = await confirmar({
      titulo: 'Desfazer ação',
      mensagem: `Desfazer: “${item.resumo}”? Todas as alterações dessa ação serão revertidas, e o desfazer também ficará registrado no histórico.`,
      confirmarTexto: 'Desfazer',
    });
    if (!confirmado) return;
    setDesfazendo(item.transacao);
    const resultado = await servico.alterarDesfazerTransacao(item.transacao, false);
    setDesfazendo(null);
    if (!notificarResultado(resultado, toast)) return;
    if (resultado.data?.ok === false) setConflito({ item, conflitos: resultado.data.conflitos ?? [] });
    else finalizarDesfazer(resultado);
  };

  const forcarDesfazer = async () => {
    setDesfazendo(conflito.item.transacao);
    const resultado = await servico.alterarDesfazerTransacao(conflito.item.transacao, true);
    setDesfazendo(null);
    if (notificarResultado(resultado, toast)) finalizarDesfazer(resultado);
  };

  const verMudancaPosterior = async (c) => {
    const resultado = await servico.buscarUltimaTransacaoDoRegistro(c.tabela, c.registro_id);
    if (!notificarResultado(resultado, toast)) return;
    if (resultado.data) setDetalhe({ transacao: resultado.data, titulo: 'Mudança posterior' });
  };

  if (!admin) {
    return <EstadoVazio titulo="Acesso restrito" texto="O histórico de alterações é exclusivo dos administradores da Execução." />;
  }

  return (
    <div className="execucao-animate-fade-in">
      <div className="execucao-card">
        <div className="execucao-card-header">
          <h3 className="execucao-card-title">Histórico de alterações</h3>
        </div>

        <div className="cfg-toolbar">
          <div className="cfg-field">
            <label htmlFor="hist-obra">Obra</label>
            <select id="hist-obra" className="execucao-form-select" value={obraId} onChange={filtrar(setObraId)}>
              <option value="">Todas</option>
              {(filtros.data?.obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome_cliente}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <label htmlFor="hist-usuario">Usuário</label>
            <select id="hist-usuario" className="execucao-form-select" value={usuarioId} onChange={filtrar(setUsuarioId)}>
              <option value="">Todos</option>
              {(filtros.data?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <label htmlFor="hist-tabela">Tipo de registro</label>
            <select id="hist-tabela" className="execucao-form-select" value={tabela} onChange={filtrar(setTabela)}>
              <option value="">Todos</option>
              {Object.keys(TABELAS).map((t) => <option key={t} value={t}>{rotuloTabela(t)}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <label htmlFor="hist-periodo">Período</label>
            <select id="hist-periodo" className="execucao-form-select" value={periodo} onChange={filtrar(setPeriodo)}>
              {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
            </select>
          </div>
          {periodo === 'custom' && (
            <>
              <div className="cfg-field">
                <label htmlFor="hist-ini">De</label>
                <input id="hist-ini" type="date" className="execucao-form-input" value={inicioCustom} max={fimCustom || undefined} onChange={filtrar(setInicioCustom)} />
              </div>
              <div className="cfg-field">
                <label htmlFor="hist-fim">Até</label>
                <input id="hist-fim" type="date" className="execucao-form-input" value={fimCustom} min={inicioCustom || undefined} onChange={filtrar(setFimCustom)} />
              </div>
            </>
          )}
          <div className="cfg-field cfg-grow">
            <label htmlFor="hist-busca">Buscar</label>
            <input id="hist-busca" type="search" className="execucao-form-input" placeholder="Nome, obra, atividade…" value={busca} onChange={filtrar(setBusca)} />
          </div>
        </div>

        {lista.error && !lista.data ? (
          <ErroCarregamento mensagem={lista.error} onTentarNovamente={lista.reload} />
        ) : !lista.data ? (
          <Carregando />
        ) : !itens.length ? (
          <EstadoVazio
            titulo={pagina > 0 ? 'Fim do histórico' : 'Nenhuma alteração encontrada'}
            texto={pagina > 0 ? 'Não há mais registros nesta página.' : 'Ajuste os filtros ou o período para ver outras alterações.'}
          />
        ) : (
          <div aria-busy={lista.loading}>
            <ul className="hist-lista">
              {itens.map((item) => (
                <li key={item.transacao} className="hist-item">
                  <div className="hist-quando">{formatarDataHora(item.quando)}</div>
                  <div>
                    <div className="hist-usuario">{item.usuario_nome ?? 'Sistema'}</div>
                    <p className="hist-resumo">{item.resumo}</p>
                    <div className="hist-badges">
                      {item.itens > 1 && <span className="execucao-badge execucao-badge-gray">{item.itens} alterações</span>}
                      {item.desfeito && <span className="execucao-badge execucao-badge-orange">Desfeita</span>}
                      {item.contexto === 'desfazer' && <span className="execucao-badge execucao-badge-purple">Desfazer</span>}
                    </div>
                  </div>
                  <div className="hist-acoes">
                    <button
                      type="button"
                      className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                      onClick={() => setDetalhe({ transacao: item.transacao, titulo: item.resumo })}
                    >
                      <FaEye aria-hidden="true" /> Ver
                    </button>
                    {item.desfazivel && (
                      <button
                        type="button"
                        className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                        onClick={() => desfazer(item)}
                        disabled={desfazendo === item.transacao}
                      >
                        <FaUndo aria-hidden="true" /> {desfazendo === item.transacao ? 'Desfazendo…' : 'Desfazer'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <nav className="hist-paginacao" aria-label="Paginação do histórico">
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span aria-live="polite">Página {pagina + 1}</span>
              <button type="button" className="execucao-btn execucao-btn-secondary execucao-btn-sm" disabled={!temProxima} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
            </nav>
          </div>
        )}
      </div>

      <ManutencaoHistorico />

      {detalhe && <DetalheAlteracao transacao={detalhe.transacao} titulo={detalhe.titulo} nomesUsuarios={nomes} onClose={() => setDetalhe(null)} />}
      {conflito && (
        <ModalConflito
          conflitos={conflito.conflitos}
          nomes={nomes}
          forcando={desfazendo === conflito.item.transacao}
          onVerMudanca={verMudancaPosterior}
          onForcar={forcarDesfazer}
          onClose={() => setConflito(null)}
        />
      )}
    </div>
  );
};

export default HistoricoAlteracoes;
