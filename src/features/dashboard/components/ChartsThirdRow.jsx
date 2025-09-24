import React from 'react';
import ServicesChart from '../../../components/ServicesChart';
import OriginChart from '../../../components/OriginChart';

const ChartsThirdRow = ({ servicosObject, origemClientes, servicosFechadosPorOrigem }) => (
  <>
    {/* Terceira linha - Serviços Negociados */}
    <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <ServicesChart data={servicosObject} />
    </div>

    {/* Quarta linha - Origem dos Clientes */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {/* POR ONDE NOSSO CLIENTE ESTÁ CHEGANDO */}
      <OriginChart 
        data={origemClientes || {}} 
        title="POR ONDE NOSSO CLIENTE ESTÁ CHEGANDO"
      />

      {/* QUAL CLIENTE ESTÁ FECHANDO MAIS SERVIÇO? */}
      <OriginChart 
        data={servicosFechadosPorOrigem || {}}
        title="QUAL CLIENTE ESTÁ FECHANDO MAIS SERVIÇO?"
      />
    </div>
  </>
);

export default ChartsThirdRow;