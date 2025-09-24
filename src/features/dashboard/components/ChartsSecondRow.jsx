import React from 'react';
import EditableGauge from '../../../components/EditableGauge';
import MultiTitleGauge from '../../../components/MultiTitleGauge';
import GanhosPerdas from './GanhosPerdas';

const ChartsSecondRow = ({
  totalClientesAtendidos,
  metaClientesAtendidos,
  setMetaClientesAtendidos,
  metaEntrada,
  metaPersonalizada,
  ganhosPerdas
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
    {/* Editable Gauge - Total de Clientes Atendidos */}
    <EditableGauge
      title="Total de Clientes Atendidos"
      value={totalClientesAtendidos}
      maxValue={metaClientesAtendidos}
      onMaxValueChange={setMetaClientesAtendidos}
      emoji="👥"
      color="#10B981"
      labelSuffix=""
    />

    {/* Ganhos vs Perdas */}
    <GanhosPerdas ganhosPerdas={ganhosPerdas} />

    {/* Multi Title Gauge - Valor de Entrada */}
    <MultiTitleGauge
      title="Meta Valor de Entrada"
      value={(metaEntrada?.valor || 0) / 1000} // Converter valor para milhares
      maxValue={metaPersonalizada / 1000} // Converter meta para milhares
      unit="k"
      emoji="💰"
      color="#10B981"
      labelSuffix="k"
    />
  </div>
);

export default ChartsSecondRow;