import React from 'react';
import RegionSalesTable from '../../../components/RegionSalesTable';
import VendorSalesTable from '../../../components/VendorSalesTable';
import SalesPodium from '../../../components/SalesPodium';

const SalesTables = ({ regioes, vendedores }) => (
  <>
    {/* Tabelas de vendas divididas */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <RegionSalesTable regionData={regioes} />
      <VendorSalesTable vendorData={vendedores} />
    </div>

    {/* Podium dos Campeões */}
    <div className="mb-6 sm:mb-8">
      <SalesPodium vendedoresReais={vendedores} />
    </div>
  </>
);

export default SalesTables;