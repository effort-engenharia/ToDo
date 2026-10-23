import React from 'react';
import { FaBuilding, FaCalendarAlt, FaClipboardList, FaExclamationTriangle, FaMapMarkerAlt } from 'react-icons/fa';
import { parseDataLocal } from '../../utils/datas';
import { calcularDiasRestantes, isDataAtrasada } from './utils';

const FORMATO_DATA_LIMITE = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };

// Listas de obras aguardando preenchimento dos itens
export default function ListasObrasPendentes({ listas, onPreencher }) {
  if (listas.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <FaClipboardList className="text-amber-400 text-lg" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">📦 Listas de Materiais Pendentes</h3>
          <p className="text-xs text-slate-400">
            Listas de obras aguardando preenchimento dos itens
          </p>
        </div>
        <span className="ml-auto bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-semibold">
          {listas.length} pendente{listas.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {listas.map((pedido) => {
          const diasRestantes = calcularDiasRestantes(pedido.data_lista_pronta);
          const atrasada = isDataAtrasada(pedido.data_lista_pronta);

          return (
            <div
              key={pedido.id}
              className={`relative overflow-hidden rounded-xl border-2 ${
                atrasada
                  ? 'bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-500/50'
                  : 'bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-500/30'
              } p-5 transition-all hover:scale-[1.02] hover:shadow-xl`}
            >
              {atrasada && diasRestantes !== null && (
                <div className="absolute top-3 right-3">
                  <span className="flex items-center gap-1 bg-red-500/30 text-red-400 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
                    <FaExclamationTriangle size={10} aria-hidden="true" />
                    {Math.abs(diasRestantes)} dia{Math.abs(diasRestantes) > 1 ? 's' : ''} atrasada
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  atrasada ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  <FaBuilding className={`text-xl ${atrasada ? 'text-red-400' : 'text-amber-400'}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-slate-100 truncate">
                    {pedido.cliente_nome || 'Cliente não definido'}
                  </h4>
                  {pedido.endereco_obra && (
                    <p className="text-sm text-slate-400 flex items-center gap-1 truncate">
                      <FaMapMarkerAlt size={10} aria-hidden="true" />
                      {pedido.endereco_obra}
                    </p>
                  )}
                </div>
              </div>

              <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${
                atrasada ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-700/50'
              }`}>
                <FaCalendarAlt className={atrasada ? 'text-red-400' : 'text-amber-400'} aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Data limite para lista pronta</p>
                  <p className={`font-bold ${atrasada ? 'text-red-400' : 'text-slate-100'}`}>
                    {pedido.data_lista_pronta
                      ? parseDataLocal(pedido.data_lista_pronta)?.toLocaleDateString('pt-BR', FORMATO_DATA_LIMITE)
                      : 'Não definida'}
                  </p>
                </div>
                {!atrasada && diasRestantes !== null && diasRestantes >= 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                    {diasRestantes === 0 ? 'Hoje!' : `${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onPreencher(pedido)}
                className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                  atrasada
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                }`}
              >
                <FaClipboardList aria-hidden="true" />
                Preencher Lista de Materiais
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
