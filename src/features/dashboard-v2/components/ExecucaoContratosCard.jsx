import React, { useMemo, useState } from 'react';
import { FaHardHat, FaSyncAlt } from 'react-icons/fa';
import { effortColors } from '../../../utils/effortTheme';
import { useAuth } from '../../../contexts/AuthContext';
import SeloExecucao from './SeloExecucao';
import { formatarDataCurta, formatarProgresso, statusEfetivo } from '../utils/statusExecucao';
import './ExecucaoContratos.css';

const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA_AGUARDANDO_DIAS = 120; // evita listar contratos antigos que nunca passaram pela Execução
const JANELA_CONCLUIDAS_DIAS = 30;
const LIMITE_INICIAL = 8;

const TILES = [
  { chave: 'aguardando_planejamento', rotulo: 'Aguardando planejamento' },
  { chave: 'planejada', rotulo: 'Planejadas' },
  { chave: 'em_andamento', rotulo: 'Em execução' },
  { chave: 'atrasada', rotulo: 'Atrasadas' },
  { chave: 'concluida', rotulo: `Concluídas (${JANELA_CONCLUIDAS_DIAS} d)` },
];

const ORDEM = { atrasada: 0, em_andamento: 1, planejada: 2, aguardando_planejamento: 3, concluida: 4 };

// Pausada é exibida junto de "Em execução"
const grupoDe = (chave) => (chave === 'pausada' ? 'em_andamento' : chave);

function dataIsoParaMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

const ExecucaoContratosConteudo = ({ allData, statusExecucao }) => {
  const { mapa = {}, carregando, erro, aoVivo, atualizadoEm, recarregar } = statusExecucao || {};
  const { usuario } = useAuth();
  const meuNome = usuario?.nome_vendedor_comercial;

  const [filtro, setFiltro] = useState(null);
  const [soMeus, setSoMeus] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const linhas = useMemo(() => {
    if (!Array.isArray(allData)) return [];
    const agora = Date.now();
    const out = [];
    allData.forEach((it) => {
      if (!it?.id || it.fase !== 'CONTRATO/VENDA' || it.ativo === false || it.duplicado_de) return;
      const info = mapa[it.id];
      const chave = statusEfetivo(info);
      if (!chave || !(chave in ORDEM || chave === 'pausada')) return;
      const grupo = grupoDe(chave);

      if (grupo === 'aguardando_planejamento') {
        const criado = new Date(it.created_at).getTime();
        if (isNaN(criado) || agora - criado > JANELA_AGUARDANDO_DIAS * DIA_MS) return;
      }
      if (grupo === 'concluida') {
        const entregue = dataIsoParaMs(info.entregue_em);
        if (entregue == null || agora - entregue > JANELA_CONCLUIDAS_DIAS * DIA_MS) return;
      }
      out.push({ it, info, chave, grupo });
    });
    return out;
  }, [allData, mapa]);

  const baseFiltrada = useMemo(
    () => (soMeus && meuNome ? linhas.filter((l) => l.it.proprietario_relacionamento === meuNome) : linhas),
    [linhas, soMeus, meuNome]
  );

  const contagem = useMemo(() => {
    const c = {};
    baseFiltrada.forEach((l) => {
      c[l.grupo] = (c[l.grupo] || 0) + 1;
    });
    return c;
  }, [baseFiltrada]);

  const visiveis = useMemo(() => {
    const lista = filtro ? baseFiltrada.filter((l) => l.grupo === filtro) : baseFiltrada;
    return [...lista].sort((a, b) => {
      const d = (ORDEM[a.grupo] ?? 9) - (ORDEM[b.grupo] ?? 9);
      if (d !== 0) return d;
      const da = a.info.entrega_prevista || a.info.entregue_em || '9999';
      const db = b.info.entrega_prevista || b.info.entregue_em || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }, [baseFiltrada, filtro]);

  const lista = expandido ? visiveis : visiveis.slice(0, LIMITE_INICIAL);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="exec-ctr-header">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${effortColors.sucesso}22`, color: effortColors.sucesso }}
          >
            <FaHardHat className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Execução dos contratos</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Status das obras</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aoVivo && <span className="exec-ctr-live">ao vivo</span>}
          {atualizadoEm && (
            <span className="exec-ctr-meta">
              atualizado {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            className="exec-ctr-btn"
            onClick={() => recarregar?.()}
            disabled={carregando}
            title="Atualizar agora"
          >
            <FaSyncAlt className={carregando ? 'animate-spin inline' : 'inline'} /> Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div className="exec-ctr-erro mb-3" role="alert">
          <span>
            Não foi possível atualizar o status da execução agora.
            {Object.keys(mapa).length > 0 ? ' Exibindo os últimos dados carregados.' : ''}
          </span>
          <button type="button" className="exec-ctr-btn" onClick={() => recarregar?.()}>
            Tentar de novo
          </button>
        </div>
      )}

      <div className="exec-ctr-tiles">
        {TILES.map((t) => (
          <button
            key={t.chave}
            type="button"
            className={`exec-ctr-tile ${filtro === t.chave ? 'exec-ctr-tile--ativo' : ''}`}
            onClick={() => {
              setFiltro((atual) => (atual === t.chave ? null : t.chave));
              setExpandido(false);
            }}
            aria-pressed={filtro === t.chave}
          >
            <div className="exec-ctr-tile-num">{contagem[t.chave] || 0}</div>
            <div className="exec-ctr-tile-rot">{t.rotulo}</div>
          </button>
        ))}
      </div>

      {meuNome && (
        <div className="exec-ctr-filtros">
          <label>
            <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} />
            Só meus contratos
          </label>
          {filtro && (
            <button type="button" className="exec-ctr-btn" onClick={() => setFiltro(null)}>
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="exec-ctr-vazio">
          {carregando && Object.keys(mapa).length === 0
            ? 'Carregando status da execução…'
            : 'Nenhum contrato para exibir com os filtros atuais.'}
        </div>
      ) : (
        <ul className="exec-ctr-lista">
          {lista.map(({ it, info, chave }) => {
            const prog = formatarProgresso(info);
            const concluida = chave === 'concluida';
            const dataPrazo = formatarDataCurta(concluida ? info.entregue_em : info.entrega_prevista);
            const mostrarBarra = ['em_andamento', 'atrasada', 'pausada'].includes(chave) && prog != null;
            return (
              <li key={it.id} className="exec-ctr-linha">
                <div style={{ minWidth: 0 }}>
                  <div className="exec-ctr-cliente">{it.nome_cliente || 'Sem nome'}</div>
                  <div className="exec-ctr-sub">{it.tipo_oportunidade || 'Serviço não informado'}</div>
                </div>
                <div className="exec-ctr-sub">{it.proprietario_relacionamento || 'sem vendedor'}</div>
                <div style={{ minWidth: 0 }}>
                  <SeloExecucao info={info} />
                  {mostrarBarra && (
                    <div className={`exec-ctr-barra ${chave === 'atrasada' ? 'exec-ctr-barra--vermelho' : ''}`}>
                      <span style={{ width: `${prog}%` }} />
                    </div>
                  )}
                </div>
                <div className={`exec-ctr-prazo ${chave === 'atrasada' ? 'exec-ctr-prazo--atrasado' : ''}`}>
                  {dataPrazo ? `${concluida ? 'Entregue' : 'Prev.'} ${dataPrazo}` : '—'}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visiveis.length > LIMITE_INICIAL && (
        <div className="exec-ctr-mais">
          <button type="button" className="exec-ctr-btn" onClick={() => setExpandido((v) => !v)}>
            {expandido ? 'Mostrar menos' : `Ver todos (${visiveis.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

// Falha de renderização aqui não pode derrubar o restante do dashboard
class ExecucaoContratosBoundary extends React.Component {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(erro) {
    console.warn('[ExecucaoContratosCard] erro de renderização:', erro);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="exec-ctr-erro" role="alert">
          <span>Não foi possível exibir a execução dos contratos agora.</span>
        </div>
      </div>
    );
  }
}

const ExecucaoContratosCard = (props) => (
  <ExecucaoContratosBoundary>
    <ExecucaoContratosConteudo {...props} />
  </ExecucaoContratosBoundary>
);

export default ExecucaoContratosCard;
