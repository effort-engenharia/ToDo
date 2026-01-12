import React from 'react';
import AgendaBase from './AgendaBase';

const AgendaEletrica = ({ usuario }) => {
  return (
    <AgendaBase 
      usuario={usuario}
      tipoExecucao="eletrica"
      titulo="Agenda Elétrica"
      iconColor="text-yellow-400"
    />
  );
};

export default AgendaEletrica;
