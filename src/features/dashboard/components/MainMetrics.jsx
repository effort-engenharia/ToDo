import React from 'react';
import { FaUsers, FaTrophy, FaBullseye, FaStar } from 'react-icons/fa';
import ModernMetricCard from './ModernMetricCard';
import EditableMetricCard from '../../../components/EditableMetricCard';
import { formatCurrency } from '../../../utils/dataProcessing';

const MainMetrics = ({
  totalClientesAtendidos,
  funil,
  receitas,
  metaEntrada,
  metaPersonalizada,
  setMetaPersonalizada,
  taxaDeSucesso
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
    <ModernMetricCard
      title="Clientes Atendidos"
      value={totalClientesAtendidos || 0}
      subtitle="Total contactados"
      icon={FaUsers}
      gradient="bg-gradient-to-br from-blue-500 to-blue-600"
    />
    <ModernMetricCard
      title="Contratos/Vendas"
      value={funil?.contratoVenda || 0}
      subtitle={formatCurrency(receitas?.recebido || 0)}
      icon={FaTrophy}
      gradient="bg-gradient-to-br from-green-500 to-green-600"
    />
    <EditableMetricCard
      title="Meta de Entrada"
      value={metaEntrada?.valor || 0}
      metaValue={metaPersonalizada}
      onMetaChange={setMetaPersonalizada}
      icon={FaBullseye}
      gradient="bg-gradient-to-br from-purple-500 to-purple-600"
    />
    <ModernMetricCard
      title="Taxa de Sucesso"
      value={taxaDeSucesso}
      subtitle="Conversão geral"
      icon={FaStar}
      gradient="bg-gradient-to-br from-yellow-500 to-orange-500"
    />
  </div>
);

export default MainMetrics;