import React from 'react';
import AgendaBase from './AgendaBase';

const AgendaGalpao = ({ usuario }) => {
  return (
    <AgendaBase 
      usuario={usuario}
      tipoExecucao="galpao"
      titulo="Agenda Galpão"
      iconColor="text-blue-400"
    />
  );
};

export default AgendaGalpao;
