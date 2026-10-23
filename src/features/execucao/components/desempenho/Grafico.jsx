import React from 'react';
import { useEChart } from '../../hooks/useEChart';

// O contêiner precisa existir quando o hook monta; por isso o gráfico vive neste componente
// (renderizado só quando há dados) e não no componente da página, que pode exibir um spinner antes.
// `option` deve ser memoizada pelo chamador.
export default function Grafico({ option, rotulo, altura = 288 }) {
  const ref = useEChart(option);
  return <div ref={ref} role="img" aria-label={rotulo} style={{ height: altura }} />;
}
