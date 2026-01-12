import React from 'react';
import AgendaBase from './AgendaBase';

const AgendaCivil = ({ usuario }) => {
  return (
    <AgendaBase 
      usuario={usuario}
      tipoExecucao="civil"
      titulo="Agenda Civil"
      iconColor="text-orange-400"
    />
  );
};

export default AgendaCivil;
