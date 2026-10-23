import React, { useMemo, useState } from 'react';
import {
  FaBox,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaEdit,
  FaFilter,
  FaPlus,
  FaSearch,
  FaTimesCircle,
  FaTruck
} from 'react-icons/fa';
import { formatarDataBR } from '../../utils/datas';
import useDebouncedValue from './useDebouncedValue';

const STATUS_ICONE = {
  pendente: <FaClock className="text-yellow-400" aria-hidden="true" />,
  aprovado: <FaCheckCircle className="text-green-400" aria-hidden="true" />,
  recusado: <FaTimesCircle className="text-red-400" aria-hidden="true" />,
  entregue: <FaTruck className="text-blue-400" aria-hidden="true" />
};

const STATUS_ROTULO = {
  concluido: 'Concluído',
  solicitado: 'Solicitado',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  entregue: 'Entregue'
};

const STATUS_COR = {
  concluido: 'green',
  solicitado: 'purple',
  pendente: 'yellow',
  aprovado: 'blue',
  recusado: 'red',
  entregue: 'green'
};

const URGENCIA_COR = {
  baixa: 'blue',
  normal: 'gray',
  alta: 'orange',
  urgente: 'red'
};

export default function ListaPedidos({ pedidos, onNovo, onEditar, onHistorico }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const buscaDebounced = useDebouncedValue(busca, 250);

  const pedidosFiltrados = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase();
    return pedidos.filter((p) => {
      const matchBusca = !termo ||
        p.descricao?.toLowerCase().includes(termo) ||
        p.solicitante?.nome_completo?.toLowerCase().includes(termo) ||
        p.cliente_nome?.toLowerCase().includes(termo);
      const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [pedidos, buscaDebounced, filtroStatus]);

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1 flex gap-4">
          <div className="execucao-search flex-1 max-w-md">
            <FaSearch className="execucao-search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar pedidos..."
              aria-label="Buscar pedidos"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="execucao-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400" aria-hidden="true" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="execucao-form-select text-sm"
              aria-label="Filtrar por status"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="recusado">Recusados</option>
              <option value="entregue">Entregues</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onNovo} className="execucao-btn execucao-btn-primary">
            <FaPlus aria-hidden="true" /> Novo Pedido
          </button>
        </div>
      </div>

      {pedidosFiltrados.length === 0 ? (
        <div className="execucao-card">
          <div className="execucao-empty-state">
            <div className="execucao-empty-icon">
              <FaBox aria-hidden="true" />
            </div>
            <div className="execucao-empty-title">Nenhum pedido encontrado</div>
            <div className="execucao-empty-text">
              {busca || filtroStatus !== 'todos'
                ? 'Tente ajustar sua busca ou os filtros.'
                : 'Clique em "Novo Pedido" para solicitar materiais.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => (
            <div key={pedido.id} className="execucao-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {STATUS_ICONE[pedido.status] ?? <FaClock className="text-gray-400" aria-hidden="true" />}
                    <h4 className="text-slate-100 font-semibold">
                      {pedido.descricao || 'Pedido de Material'}
                    </h4>
                    <span className={`execucao-badge execucao-badge-${STATUS_COR[pedido.status] ?? 'gray'}`}>
                      {STATUS_ROTULO[pedido.status] ?? pedido.status}
                    </span>
                    <span className={`execucao-badge execucao-badge-${URGENCIA_COR[pedido.urgencia] ?? 'gray'}`}>
                      {pedido.urgencia}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>
                      Solicitante: {pedido.solicitante?.nome_completo || 'N/A'}
                    </span>
                    <span>
                      Data do Pedido: {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                    </span>
                    {pedido.data_material_disponivel && (
                      <span
                        className="flex items-center gap-1 cursor-help"
                        title="Data limite para chegada dos materiais"
                      >
                        <FaCalendarAlt className="text-green-400" size={12} aria-hidden="true" />
                        Data Limite: {formatarDataBR(pedido.data_material_disponivel)}
                      </span>
                    )}
                    <span>
                      Itens: {pedido.itens?.length || 0}
                    </span>
                  </div>

                  {pedido.itens?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pedido.itens.slice(0, 3).map((item, idx) => (
                        // Lista somente leitura derivada do pedido: índice estável
                        <span key={`${item.nome}-${idx}`} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                          {item.quantidade} {item.unidade} - {item.nome}
                        </span>
                      ))}
                      {pedido.itens.length > 3 && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">
                          +{pedido.itens.length - 3} itens
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEditar(pedido)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Editar"
                    aria-label={`Editar pedido ${pedido.descricao || ''}`.trim()}
                  >
                    <FaEdit aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onHistorico(pedido)}
                    className="execucao-btn execucao-btn-secondary execucao-btn-sm"
                    title="Ver Histórico"
                    aria-label={`Ver histórico do pedido ${pedido.descricao || ''}`.trim()}
                  >
                    <FaClipboardList aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
