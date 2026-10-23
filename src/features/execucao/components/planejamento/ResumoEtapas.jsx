import React, { useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaCalendarWeek,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationCircle,
  FaFileExcel,
  FaFilePdf,
  FaListAlt,
  FaStream,
  FaTasks,
  FaUsers
} from 'react-icons/fa';
import { addDias, dataLocalISO, parseDataLocal } from '../../utils/datas';
import { useExecucaoUI } from '../ui/ExecucaoUI';
import { exportarEtapasExcel, exportarEtapasPDF } from './exportacao';
import ResumoVisaoAno from './ResumoVisaoAno';
import ResumoVisaoLinhaDoTempo from './ResumoVisaoLinhaDoTempo';
import ResumoVisaoMes from './ResumoVisaoMes';
import ResumoVisaoSemana from './ResumoVisaoSemana';
import ResumoVisaoTabela from './ResumoVisaoTabela';
import { etapaAtrasada, formatarDataCurta, inicioDeHoje, intervaloFiltroResumo, rotuloPeriodo } from './utils';

const MODOS = [
  { id: 'tabela', rotulo: 'Tabela', icone: <FaListAlt size={12} aria-hidden="true" />, titulo: null },
  { id: 'agenda', rotulo: 'Semana', icone: <FaCalendarAlt size={12} aria-hidden="true" />, titulo: 'Visualização semanal' },
  { id: 'mensal', rotulo: 'Mês', icone: <FaCalendarAlt size={12} aria-hidden="true" />, titulo: 'Visualização mensal' },
  { id: 'anual', rotulo: 'Ano', icone: <FaCalendarAlt size={12} aria-hidden="true" />, titulo: 'Visualização anual' },
  { id: 'linha', rotulo: 'Linha do tempo', icone: <FaStream size={12} aria-hidden="true" />, titulo: 'Todas as obras, do início ao fim, com progresso e saúde' }
];

const SEM_SAUDE = new Map();

const NAV_BOTOES = 'execucao-btn execucao-btn-secondary execucao-btn-sm';
const NAV_CONTAINER = 'flex items-center justify-between mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700';

const comDadosDaObra = (etapa, obra) => ({
  ...etapa,
  cliente: obra.nome_cliente,
  cidade: obra.cidade,
  obra_id: obra.id
});

// Percorre todas as etapas de todas as obras que passam pelo filtro de equipe
const coletarEtapas = (obras, filtroTipo, aceitar = () => true) => {
  const resultado = [];
  obras.forEach((obra) => {
    obra.etapas?.forEach((etapa) => {
      if (filtroTipo !== 'todos' && etapa.tipo !== filtroTipo) return;
      const inicio = parseDataLocal(etapa.data_inicio);
      const fim = parseDataLocal(etapa.data_fim);
      if (aceitar(inicio, fim)) resultado.push({ etapa: comDadosDaObra(etapa, obra), inicio, fim });
    });
  });
  return resultado;
};

// Distribui nos dias as etapas (com datas válidas) que os cobrem
const distribuirNosDias = (obras, filtroTipo, dias) => {
  coletarEtapas(obras, filtroTipo, (inicio, fim) => Boolean(inicio && fim)).forEach(({ etapa, inicio, fim }) => {
    dias.forEach((dia) => {
      if (dia.data >= inicio && dia.data <= fim) dia.etapas.push(etapa);
    });
  });
};

const ResumoEtapas = ({ obras, filtroPeriodo, onAddAtividade, saudePorObra = SEM_SAUDE, onAbrirObra }) => {
  const { toast } = useExecucaoUI();
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('data'); // data, cliente, equipe
  const [modoVisualizacao, setModoVisualizacao] = useState('tabela'); // tabela, agenda, mensal, anual, linha
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesOffset, setMesOffset] = useState(0);
  const [anoOffset, setAnoOffset] = useState(0);
  const [exportando, setExportando] = useState(null); // 'excel' | 'pdf' | null

  // Todas as etapas de todas as obras em uma lista única, filtradas e ordenadas
  const todasEtapas = useMemo(() => {
    const intervalo = intervaloFiltroResumo(filtroPeriodo);
    const itens = coletarEtapas(obras, filtroTipo, (inicio, fim) => {
      if (!intervalo) return true;
      return Boolean(inicio && fim && inicio <= intervalo.fim && fim >= intervalo.inicio);
    });

    const tempo = (item) => item.inicio?.getTime() ?? 0;
    const porData = (a, b) => tempo(a) - tempo(b);

    switch (ordenacao) {
      case 'cliente':
        itens.sort((a, b) => (a.etapa.cliente || '').localeCompare(b.etapa.cliente || '') || porData(a, b));
        break;
      case 'equipe':
        itens.sort((a, b) => (a.etapa.tipo || '').localeCompare(b.etapa.tipo || '') || porData(a, b));
        break;
      default:
        itens.sort(porData);
    }

    return itens.map((item) => item.etapa);
  }, [obras, filtroPeriodo, filtroTipo, ordenacao]);

  // Visualização de agenda (semana)
  const agendaData = useMemo(() => {
    const hoje = inicioDeHoje();
    const inicioSemana = addDias(hoje, -hoje.getDay() + semanaOffset * 7);
    const hojeStr = hoje.toDateString();

    const dias = Array.from({ length: 7 }, (_, i) => {
      const data = addDias(inicioSemana, i);
      return {
        chave: dataLocalISO(data),
        data,
        diaSemana: data.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', ''),
        diaNumero: data.getDate(),
        isHoje: data.toDateString() === hojeStr,
        etapas: []
      };
    });
    distribuirNosDias(obras, filtroTipo, dias);

    return {
      dias,
      inicioSemana,
      fimSemana: dias[6].data,
      mesAno: inicioSemana.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    };
  }, [obras, semanaOffset, filtroTipo]);

  // Visualização MENSAL (6 semanas começando no domingo anterior ao dia 1)
  const mensalData = useMemo(() => {
    const hoje = inicioDeHoje();
    const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
    const inicioGrade = addDias(mesAtual, -mesAtual.getDay());
    const hojeStr = hoje.toDateString();

    const dias = Array.from({ length: 42 }, (_, i) => {
      const data = addDias(inicioGrade, i);
      return {
        chave: dataLocalISO(data),
        data,
        diaNumero: data.getDate(),
        isMesAtual: data.getMonth() === mesAtual.getMonth(),
        isHoje: data.toDateString() === hojeStr,
        etapas: []
      };
    });
    distribuirNosDias(obras, filtroTipo, dias);

    const semanas = Array.from({ length: 6 }, (_, i) => dias.slice(i * 7, (i + 1) * 7));

    return {
      semanas,
      mesAno: mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    };
  }, [obras, mesOffset, filtroTipo]);

  // Visualização ANUAL
  const anualData = useMemo(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear() + anoOffset;
    const itens = coletarEtapas(obras, filtroTipo, (inicio, fim) => Boolean(inicio && fim));

    const meses = Array.from({ length: 12 }, (_, m) => {
      const primeiroDia = new Date(ano, m, 1);
      const ultimoDia = new Date(ano, m + 1, 0);

      return {
        mes: m,
        nomeLongo: primeiroDia.toLocaleDateString('pt-BR', { month: 'long' }),
        etapas: itens
          .filter(({ inicio, fim }) => inicio <= ultimoDia && fim >= primeiroDia)
          .map(({ etapa }) => etapa),
        isAtual: m === hoje.getMonth() && anoOffset === 0
      };
    });

    return { meses, ano };
  }, [obras, anoOffset, filtroTipo]);

  const stats = useMemo(() => {
    const hoje = inicioDeHoje();
    const porTipo = { eletrica: 0, civil: 0, galpao: 0, geral: 0, administrativo: 0 };
    let atrasadas = 0;

    todasEtapas.forEach((e) => {
      porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
      if (etapaAtrasada(e, hoje)) atrasadas++;
    });

    return {
      totalEtapas: todasEtapas.length,
      porTipo,
      atrasadas,
      totalClientes: new Set(todasEtapas.map((e) => e.cliente)).size
    };
  }, [todasEtapas]);

  const periodoLabel = rotuloPeriodo(filtroPeriodo);

  const exportar = async (formato) => {
    if (exportando) return;
    setExportando(formato);
    try {
      // Deixa o navegador pintar o estado "Gerando..." antes do trabalho pesado
      await new Promise(requestAnimationFrame);
      if (formato === 'excel') await exportarEtapasExcel(todasEtapas);
      else await exportarEtapasPDF(todasEtapas, periodoLabel);
    } catch (error) {
      console.error('Erro ao exportar etapas:', error);
      toast.error(`Não foi possível gerar o arquivo ${formato === 'excel' ? 'Excel' : 'PDF'}: ${error.message}`);
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="execucao-animate-fade-in">
      {/* Header do Resumo */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaCalendarWeek className="text-sky-400" aria-hidden="true" />
            Resumo de Etapas - {periodoLabel}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {stats.totalEtapas} etapas em {stats.totalClientes} clientes
          </p>
        </div>

        {/* Modo de Visualização + Filtros */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Botões de Exportação */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportar('excel')}
              disabled={Boolean(exportando)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm flex items-center gap-1.5"
              title="Exportar para Excel"
            >
              <FaFileExcel className="text-green-400" size={14} aria-hidden="true" />
              {exportando === 'excel' ? 'Gerando...' : 'Excel'}
            </button>
            <button
              type="button"
              onClick={() => exportar('pdf')}
              disabled={Boolean(exportando)}
              className="execucao-btn execucao-btn-secondary execucao-btn-sm flex items-center gap-1.5"
              title="Exportar para PDF"
            >
              <FaFilePdf className="text-red-400" size={14} aria-hidden="true" />
              {exportando === 'pdf' ? 'Gerando...' : 'PDF'}
            </button>
          </div>

          {/* Toggle Visualizações */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1">
            {MODOS.map(({ id, rotulo, icone, titulo }) => (
              <button
                type="button"
                key={id}
                onClick={() => setModoVisualizacao(id)}
                aria-pressed={modoVisualizacao === id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  modoVisualizacao === id
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={titulo ?? undefined}
              >
                {icone}
                {rotulo}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="resumo-filtro-equipe" className="text-slate-400 text-sm">Equipe:</label>
            <select
              id="resumo-filtro-equipe"
              className="execucao-form-select text-sm py-1"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todas</option>
              <option value="eletrica">⚡ Elétrica</option>
              <option value="civil">🏗️ Civil</option>
              <option value="galpao">🏭 Galpão</option>
              <option value="geral">📋 Geral</option>
              <option value="administrativo">📊 Adm</option>
            </select>
          </div>

          {modoVisualizacao === 'tabela' && (
            <div className="flex items-center gap-2">
              <label htmlFor="resumo-ordenacao" className="text-slate-400 text-sm">Ordenar:</label>
              <select
                id="resumo-ordenacao"
                className="execucao-form-select text-sm py-1"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
              >
                <option value="data">📅 Por Data</option>
                <option value="cliente">👤 Por Cliente</option>
                <option value="equipe">👷 Por Equipe</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Navegação da Agenda SEMANAL */}
      {modoVisualizacao === 'agenda' && (
        <div className={NAV_CONTAINER}>
          <button type="button" onClick={() => setSemanaOffset(prev => prev - 1)} className={NAV_BOTOES}>
            <FaChevronLeft aria-hidden="true" /> Anterior
          </button>

          <div className="text-center">
            <div className="text-lg font-bold text-white capitalize">{agendaData.mesAno}</div>
            <div className="text-sm text-slate-400">
              {formatarDataCurta(agendaData.inicioSemana)} - {formatarDataCurta(agendaData.fimSemana)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSemanaOffset(0)} className={NAV_BOTOES}>
              Hoje
            </button>
            <button type="button" onClick={() => setSemanaOffset(prev => prev + 1)} className={NAV_BOTOES}>
              Próxima <FaChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Navegação MENSAL */}
      {modoVisualizacao === 'mensal' && (
        <div className={NAV_CONTAINER}>
          <button type="button" onClick={() => setMesOffset(prev => prev - 1)} className={NAV_BOTOES}>
            <FaChevronLeft aria-hidden="true" /> Mês Anterior
          </button>

          <div className="text-center">
            <div className="text-lg font-bold text-white capitalize">{mensalData.mesAno}</div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMesOffset(0)} className={NAV_BOTOES}>
              Mês Atual
            </button>
            <button type="button" onClick={() => setMesOffset(prev => prev + 1)} className={NAV_BOTOES}>
              Próximo Mês <FaChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Navegação ANUAL */}
      {modoVisualizacao === 'anual' && (
        <div className={NAV_CONTAINER}>
          <button type="button" onClick={() => setAnoOffset(prev => prev - 1)} className={NAV_BOTOES}>
            <FaChevronLeft aria-hidden="true" /> Ano Anterior
          </button>

          <div className="text-center">
            <div className="text-lg font-bold text-white">{anualData.ano}</div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAnoOffset(0)} className={NAV_BOTOES}>
              Ano Atual
            </button>
            <button type="button" onClick={() => setAnoOffset(prev => prev + 1)} className={NAV_BOTOES}>
              Próximo Ano <FaChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Cards de Estatísticas Compactos */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
          <FaUsers className="text-sky-400" aria-hidden="true" />
          <span className="text-slate-400 text-sm">Clientes:</span>
          <span className="text-white font-bold">{stats.totalClientes}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
          <FaTasks className="text-yellow-400" aria-hidden="true" />
          <span className="text-slate-400 text-sm">Etapas:</span>
          <span className="text-white font-bold">{stats.totalEtapas}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
          <span>⚡</span>
          <span className="text-yellow-300 font-medium">{stats.porTipo.eletrica || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/30">
          <span>🏗️</span>
          <span className="text-orange-300 font-medium">{stats.porTipo.civil || 0}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <span>🏭</span>
          <span className="text-purple-300 font-medium">{stats.porTipo.galpao || 0}</span>
        </div>
        {stats.atrasadas > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/30 animate-pulse">
            <FaExclamationCircle className="text-red-400" aria-hidden="true" />
            <span className="text-red-300 font-medium">{stats.atrasadas} atrasadas</span>
          </div>
        )}
      </div>

      {/* Conteúdo baseado no modo de visualização */}
      {modoVisualizacao === 'linha' ? (
        <ResumoVisaoLinhaDoTempo
          obras={obras}
          filtroTipo={filtroTipo}
          saudePorObra={saudePorObra}
          onAbrirObra={onAbrirObra}
        />
      ) : todasEtapas.length === 0 ? (
        <div className="execucao-card text-center py-12">
          <FaCalendarAlt className="mx-auto text-slate-600 mb-4" size={48} aria-hidden="true" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">Nenhuma etapa no período</h3>
          <p className="text-slate-500">Não há etapas programadas para {periodoLabel.toLowerCase()}</p>
        </div>
      ) : modoVisualizacao === 'agenda' ? (
        <ResumoVisaoSemana dias={agendaData.dias} onAddAtividade={onAddAtividade} />
      ) : modoVisualizacao === 'mensal' ? (
        <ResumoVisaoMes semanas={mensalData.semanas} onAddAtividade={onAddAtividade} />
      ) : modoVisualizacao === 'anual' ? (
        <ResumoVisaoAno meses={anualData.meses} ano={anualData.ano} />
      ) : (
        <ResumoVisaoTabela etapas={todasEtapas} onAddAtividade={onAddAtividade} />
      )}
    </div>
  );
};

export default React.memo(ResumoEtapas);
