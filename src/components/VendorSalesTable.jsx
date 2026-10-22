import React, { useState, useMemo } from 'react';
import { FaUsers, FaTrophy, FaCalendarAlt, FaUserFriends, FaSearch } from 'react-icons/fa';
import { formatCurrency } from '../utils/dataProcessing';
import { useAuth } from '../contexts/AuthContext';
import {
  mesComercialAtual,
  intervaloDoMesComercial,
  rotuloMesComercial,
  rangeCurtoMesComercial
} from '../utils/periodoComercial';

// Nomes curtos dos meses para o header da grade
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cor por vendedor (mantém a paleta original e adiciona os novos)
const getVendorColor = (vendedor) => {
  if (!vendedor || typeof vendedor !== 'string') return 'text-gray-600 bg-gray-50';
  switch (vendedor.toUpperCase()) {
    case 'EDUARDA': return 'text-blue-600 bg-blue-50';
    case 'PAMELLI': return 'text-green-600 bg-green-50';
    case 'EDGAR': return 'text-purple-600 bg-purple-50';
    case 'VITOR': return 'text-orange-600 bg-orange-50';
    case 'FÁBIO':
    case 'FABIO': return 'text-teal-600 bg-teal-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

const getRankingBadge = (index) => {
  if (index === 0) return 'bg-yellow-500 text-white';
  if (index === 1) return 'bg-gray-400 text-white';
  if (index === 2) return 'bg-orange-600 text-white';
  return 'bg-gray-200 text-gray-700';
};

// Extrai o primeiro nome uppercase (usado para casar com proprietario_relacionamento)
const primeiroNomeUpper = (nomeCompleto) => {
  if (!nomeCompleto) return null;
  return nomeCompleto.trim().split(/\s+/)[0].toUpperCase();
};

const EmptyState = ({ mensagem }) => (
  <div className="flex items-center justify-center h-56">
    <div className="text-center">
      <FaTrophy className="mx-auto text-4xl text-gray-300 mb-3" />
      <p className="text-gray-500 text-sm">{mensagem}</p>
    </div>
  </div>
);

/**
 * Card unificado com 3 abas:
 *  - Ranking:  total consolidado por vendedor (vem do período filtrado no dashboard)
 *  - Por Mês:  matriz vendedor × mês do ano vigente
 *  - Clientes: lista de clientes fechados por vendedor no ano vigente
 * Vendedor não-admin só vê a própria linha/lista.
 */
const VendorSalesTable = ({ vendorData, vendasPorMes, clientesPorVendedor }) => {
  const [abaAtiva, setAbaAtiva] = useState('ranking');
  const [vendedorSelecionado, setVendedorSelecionado] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  // Filtro de período da aba "Clientes": 'mes' | 'ano' | 'custom'
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const { usuario, isAdmin } = useAuth();

  const admin = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const meuVendedor = primeiroNomeUpper(usuario?.nome_completo);

  // Filtro por permissão
  const filtrarPorPermissao = (lista) => {
    if (admin || !meuVendedor) return lista;
    return lista.filter(item => (item.vendedor || '').toUpperCase() === meuVendedor);
  };

  const rankingVisivel = useMemo(
    () => filtrarPorPermissao(vendorData || []),
    [vendorData, admin, meuVendedor]
  );

  const linhasPorMes = useMemo(
    () => filtrarPorPermissao(vendasPorMes?.vendedores || []),
    [vendasPorMes, admin, meuVendedor]
  );

  // Totais recalculados para o escopo visível
  const totaisPorMesVisiveis = useMemo(() => {
    const totais = new Array(12).fill(0);
    linhasPorMes.forEach(v => v.meses.forEach((val, i) => { totais[i] += val; }));
    return totais;
  }, [linhasPorMes]);

  const totalAnoVisivel = useMemo(
    () => linhasPorMes.reduce((sum, v) => sum + v.totalAno, 0),
    [linhasPorMes]
  );

  // Vendedores disponíveis na aba "Clientes"
  const vendedoresParaClientes = useMemo(() => {
    const todos = Object.keys(clientesPorVendedor || {}).sort();
    if (admin || !meuVendedor) return todos;
    return todos.filter(v => v.toUpperCase() === meuVendedor);
  }, [clientesPorVendedor, admin, meuVendedor]);

  const vendedorEfetivo = vendedorSelecionado && vendedoresParaClientes.includes(vendedorSelecionado)
    ? vendedorSelecionado
    : (vendedoresParaClientes[0] || null);

  // Intervalo efetivo (Date de/até 00:00) baseado no filtro de período
  const intervaloEfetivo = useMemo(() => {
    const hoje = new Date();
    if (filtroPeriodo === 'mes') {
      // Mês comercial vigente (regra do dia 22 a partir de 23/07/2026)
      const { ano, mes } = mesComercialAtual(hoje);
      return intervaloDoMesComercial(ano, mes);
    }
    if (filtroPeriodo === 'ano') {
      const de = new Date(hoje.getFullYear(), 0, 1);
      const ate = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { de, ate };
    }
    // custom
    const de = dataDe ? new Date(dataDe + 'T00:00:00') : null;
    const ate = dataAte ? new Date(dataAte + 'T23:59:59') : null;
    return { de, ate };
  }, [filtroPeriodo, dataDe, dataAte]);

  const clientesDoVendedor = useMemo(() => {
    if (!vendedorEfetivo) return [];
    const lista = clientesPorVendedor?.[vendedorEfetivo] || [];
    const { de, ate } = intervaloEfetivo;
    const termo = buscaCliente.trim().toLowerCase();
    return lista.filter(c => {
      // Filtro por termo
      if (termo && !c.cliente.toLowerCase().includes(termo)) return false;
      // Filtro por data (se algum limite foi informado)
      if (de || ate) {
        if (!c.data) return false;
        const d = new Date(c.data);
        if (isNaN(d.getTime())) return false;
        if (de && d < de) return false;
        if (ate && d > ate) return false;
      }
      return true;
    });
  }, [vendedorEfetivo, clientesPorVendedor, buscaCliente, intervaloEfetivo]);

  const totalClientesDoVendedor = useMemo(
    () => clientesDoVendedor.reduce((sum, c) => sum + c.valor, 0),
    [clientesDoVendedor]
  );

  // Rótulo humano do período ativo (usado no header/rodapé)
  const rotuloPeriodo = useMemo(() => {
    const hoje = new Date();
    if (filtroPeriodo === 'mes') {
      const { ano, mes } = mesComercialAtual(hoje);
      return rotuloMesComercial(ano, mes);
    }
    if (filtroPeriodo === 'ano') return `Ano de ${hoje.getFullYear()}`;
    // custom
    if (!dataDe && !dataAte) return 'Período livre (todos)';
    const fmt = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '…';
    return `${fmt(dataDe)} a ${fmt(dataAte)}`;
  }, [filtroPeriodo, dataDe, dataAte]);

  const anoVigente = vendasPorMes?.ano || new Date().getFullYear();

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center text-center w-full">
          <FaUsers className="mr-2 sm:mr-3 text-lg sm:text-xl" />
          Vendas por Vendedor
        </h3>
        {!admin && meuVendedor && (
          <p className="mt-1 text-center text-xs text-white/80">
            Visualizando apenas seus dados ({meuVendedor})
          </p>
        )}
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { id: 'ranking',  label: 'Ranking',              icon: <FaTrophy /> },
          { id: 'porMes',   label: `Por Mês (${anoVigente})`, icon: <FaCalendarAlt /> },
          { id: 'clientes', label: 'Clientes',             icon: <FaUserFriends /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAbaAtiva(tab.id)}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 border-b-2 ${
              abaAtiva === tab.id
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-purple-700 hover:bg-white/60'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-4 sm:p-6">
        {/* --- ABA RANKING --- */}
        {abaAtiva === 'ranking' && (
          rankingVisivel.length === 0 ? (
            <EmptyState mensagem="Sem dados de vendas por vendedor no período selecionado." />
          ) : (
            <>
              <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center justify-center text-center">
                <FaTrophy className="mr-2 text-yellow-600 text-sm sm:text-base" />
                <span className="hidden sm:inline">TOTAL DE VENDAS POR VENDEDOR</span>
                <span className="sm:hidden">RANKING</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-2 text-gray-600 font-medium text-sm">#</th>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium text-sm">Proprietário do relacionamento</th>
                      <th className="text-right py-3 px-2 text-gray-600 font-medium text-sm">Valor de Entrada</th>
                      <th className="text-right py-3 px-2 text-gray-600 font-medium text-sm">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingVisivel.map((item, index) => (
                      <tr key={item.vendedor + index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRankingBadge(index)}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <div className={`text-lg font-bold px-3 py-2 rounded-lg ${getVendorColor(item.vendedor)}`}>
                            {item.vendedor}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <span className="text-lg font-medium text-blue-600">
                            {formatCurrency(item.valorEntrada)}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <span className="text-xl font-bold text-green-600">
                            {formatCurrency(item.valor)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Estatísticas resumidas */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {rankingVisivel.length}
                    </div>
                    <div className="text-purple-600 text-sm font-medium">
                      {admin ? 'Vendedores Ativos' : 'Sua conta'}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(rankingVisivel.reduce((s, i) => s + (i.valorEntrada || 0), 0))}
                    </div>
                    <div className="text-blue-600 text-sm font-medium">Total Valor Entrada</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(rankingVisivel.reduce((s, i) => s + (i.valor || 0), 0))}
                    </div>
                    <div className="text-green-600 text-sm font-medium">Valor Total</div>
                  </div>
                </div>
              </div>
            </>
          )
        )}

        {/* --- ABA POR MÊS --- */}
        {abaAtiva === 'porMes' && (
          linhasPorMes.length === 0 ? (
            <EmptyState mensagem={`Sem vendas fechadas em ${anoVigente}.`} />
          ) : (
            <>
              <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-1 flex items-center justify-center text-center">
                <FaCalendarAlt className="mr-2 text-purple-600" />
                VENDAS POR MÊS — {anoVigente}
              </h4>
              <p className="text-[11px] text-gray-500 text-center mb-3">
                A partir de <strong>Ago/2026</strong> os meses seguem o fechamento comercial (dia 23 ao 22).
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-2 text-gray-600 font-medium sticky left-0 bg-gray-50 z-10">Vendedor</th>
                      {MESES_CURTOS.map((m, i) => {
                        const range = rangeCurtoMesComercial(anoVigente, i);
                        return (
                          <th
                            key={m}
                            className="text-right py-2 px-2 text-gray-600 font-medium whitespace-nowrap"
                            title={range ? `Mês comercial: ${range}` : `Mês calendário`}
                          >
                            <div>{m}</div>
                            {range && (
                              <div className="text-[10px] font-normal text-gray-400 leading-tight">
                                {range}
                              </div>
                            )}
                          </th>
                        );
                      })}
                      <th className="text-right py-2 px-2 text-gray-700 font-bold whitespace-nowrap bg-purple-50">
                        Total {anoVigente}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasPorMes.map((v) => (
                      <tr key={v.vendedor} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 sticky left-0 bg-white">
                          <span className={`inline-block font-semibold px-2 py-1 rounded ${getVendorColor(v.vendedor)}`}>
                            {v.vendedor}
                          </span>
                        </td>
                        {v.meses.map((val, i) => (
                          <td key={i} className={`text-right py-2 px-2 ${val > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                            {val > 0 ? formatCurrency(val) : '—'}
                          </td>
                        ))}
                        <td className="text-right py-2 px-2 font-bold text-green-600 bg-green-50">
                          {formatCurrency(v.totalAno)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                      <td className="py-3 px-2 sticky left-0 bg-gray-100">Total do mês</td>
                      {totaisPorMesVisiveis.map((val, i) => (
                        <td key={i} className={`text-right py-3 px-2 ${val > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                          {val > 0 ? formatCurrency(val) : '—'}
                        </td>
                      ))}
                      <td className="text-right py-3 px-2 text-green-700 bg-green-100">
                        {formatCurrency(totalAnoVisivel)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Destaque do consolidado */}
              <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 text-center">
                <p className="text-sm text-green-700 font-medium mb-1">
                  {admin
                    ? `Total consolidado do time em ${anoVigente}`
                    : `Seu total consolidado em ${anoVigente}`}
                </p>
                <p className="text-3xl sm:text-4xl font-extrabold text-green-700">
                  {formatCurrency(totalAnoVisivel)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Baseado na data de criação do apontamento
                </p>
              </div>
            </>
          )
        )}

        {/* --- ABA CLIENTES --- */}
        {abaAtiva === 'clientes' && (
          vendedoresParaClientes.length === 0 || !vendedorEfetivo ? (
            <EmptyState mensagem="Sem clientes fechados no histórico." />
          ) : (
            <>
              <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-1 flex items-center justify-center text-center">
                <FaUserFriends className="mr-2 text-purple-600" />
                CLIENTES FECHADOS
              </h4>
              <p className="text-xs text-gray-500 text-center mb-4">{rotuloPeriodo}</p>

              {/* Chips de período */}
              <div className="flex flex-wrap gap-2 mb-3 justify-center">
                {[
                  { id: 'mes',    label: 'Este mês' },
                  { id: 'ano',    label: 'Este ano' },
                  { id: 'custom', label: 'Personalizado' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFiltroPeriodo(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      filtroPeriodo === p.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:text-purple-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Inputs de intervalo customizado */}
              {filtroPeriodo === 'custom' && (
                <div className="flex flex-col sm:flex-row gap-2 mb-3 items-center justify-center">
                  <label className="text-xs text-gray-600 flex items-center gap-1">
                    De:
                    <input
                      type="date"
                      value={dataDe}
                      onChange={(e) => setDataDe(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </label>
                  <label className="text-xs text-gray-600 flex items-center gap-1">
                    Até:
                    <input
                      type="date"
                      value={dataAte}
                      onChange={(e) => setDataAte(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </label>
                  {(dataDe || dataAte) && (
                    <button
                      type="button"
                      onClick={() => { setDataDe(''); setDataAte(''); }}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {/* Filtros (vendedor + busca) */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                {admin && (
                  <select
                    value={vendedorEfetivo}
                    onChange={(e) => setVendedorSelecionado(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    {vendedoresParaClientes.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}
                <div className="relative flex-1">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>

              {clientesDoVendedor.length === 0 ? (
                <EmptyState mensagem="Nenhum cliente encontrado no período selecionado." />
              ) : (
                <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">#</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Cliente</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Tipo</th>
                        <th className="text-left py-2 px-3 text-gray-600 font-medium">Data</th>
                        <th className="text-right py-2 px-3 text-gray-600 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesDoVendedor.map((c, i) => (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                          <td className="py-2 px-3 text-gray-800 font-medium">{c.cliente}</td>
                          <td className="py-2 px-3 text-gray-600 text-xs">{c.tipo || '—'}</td>
                          <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">
                            {c.data
                              ? new Date(c.data).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-green-600 font-semibold whitespace-nowrap">
                            {formatCurrency(c.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-100">
                      <tr className="font-bold border-t-2 border-gray-300">
                        <td colSpan={4} className="py-2 px-3 text-gray-700">
                          {clientesDoVendedor.length} {clientesDoVendedor.length === 1 ? 'cliente' : 'clientes'} — {vendedorEfetivo} — {rotuloPeriodo}
                        </td>
                        <td className="py-2 px-3 text-right text-green-700">
                          {formatCurrency(totalClientesDoVendedor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

export default VendorSalesTable;
