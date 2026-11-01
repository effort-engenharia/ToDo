import React, { useEffect, useState } from 'react';
import { cotacaoDoHash } from '../../utils/navegacaoCompras';
import ListaCotacoes from './ListaCotacoes';
import DetalheCotacao from './DetalheCotacao';

// Seção Cotações (#/compras/cotacoes[?id=]): lista ou detalhe conforme o hash. O hash é a fonte da verdade (botão voltar funciona).
const CotacoesPagina = ({ usuario, config }) => {
  const [id, setId] = useState(() => cotacaoDoHash());
  useEffect(() => {
    const aoNavegar = () => setId(cotacaoDoHash());
    window.addEventListener('popstate', aoNavegar);
    window.addEventListener('hashchange', aoNavegar);
    return () => { window.removeEventListener('popstate', aoNavegar); window.removeEventListener('hashchange', aoNavegar); };
  }, []);

  return (
    <div className="cmp-pagina">
      {id ? <DetalheCotacao key={id} cotacaoId={id} usuario={usuario} config={config} /> : <ListaCotacoes />}
    </div>
  );
};

export default CotacoesPagina;
