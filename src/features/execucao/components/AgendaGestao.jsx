import React from 'react';
import AgendaBase from './AgendaBase';

const AgendaGestao = ({ usuario }) => {
  return (
    <AgendaBase 
      usuario={usuario}
      tipoExecucao="gestao"
      titulo="Agenda de Gestão"
      iconColor="text-purple-400"
    />
  );
};

export default AgendaGestao;
