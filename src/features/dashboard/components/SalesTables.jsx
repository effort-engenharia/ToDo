import React, { useMemo } from 'react';
import RegionSalesTable from '../../../components/RegionSalesTable';
import VendorSalesTable from '../../../components/VendorSalesTable';
import SalesPodium from '../../../components/SalesPodium';
import PremiacaoTimeCard from '../../../components/premiacao/PremiacaoTimeCard';
import ComissaoPJCard from '../../../components/premiacao/ComissaoPJCard';
import { CLASSIFICACOES } from '../../../config/premiacao';

const SalesTables = ({
  regioes,
  vendedores,
  vendasPorMes,
  clientesPorVendedor,
  premiacao,
  anoPremiacao,
  mesPremiacao,
}) => {
  const classificacaoDe = premiacao?.ativo ? premiacao.classificacaoDe : null;

  // Memo evita que o SalesPodium ressincronize a cada render
  const vendedoresPodio = useMemo(() => {
    if (!classificacaoDe || !Array.isArray(vendedores)) return vendedores;
    return vendedores.filter((v) => classificacaoDe(v.vendedor) !== CLASSIFICACOES.PJ);
  }, [vendedores, classificacaoDe]);

  return (
    <>
      {/* Tabelas de vendas divididas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <RegionSalesTable regionData={regioes} />
        <VendorSalesTable
          vendorData={vendedores}
          vendasPorMes={vendasPorMes}
          clientesPorVendedor={clientesPorVendedor}
        />
      </div>

      {/* Podium dos Campeões */}
      <div className="mb-6 sm:mb-8">
        <SalesPodium vendedoresReais={vendedoresPodio} />
      </div>

      {premiacao?.ativo && premiacao.resultado && (
        <div className="mb-6 sm:mb-8">
          <PremiacaoTimeCard premiacao={premiacao} ano={anoPremiacao} mes={mesPremiacao} />
        </div>
      )}

      {premiacao?.ativo && premiacao.resultado?.pjs.some((p) => premiacao.podeVer(p.nome)) && (
        <div className="mb-6 sm:mb-8">
          <ComissaoPJCard premiacao={premiacao} />
        </div>
      )}
    </>
  );
};

export default SalesTables;