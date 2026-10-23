import React from 'react';
import { FaTasks } from 'react-icons/fa';
import { ICONE_TIPO_ETAPA, ICONE_TIPO_OBRA, ICONES_TEMPLATE } from './constants';

export const IconeTipoEtapa = ({ tipo, size }) => {
  const { Icone, cor } = ICONE_TIPO_ETAPA[tipo] ?? ICONE_TIPO_ETAPA.geral;
  return <Icone className={cor} size={size} aria-hidden="true" />;
};

export const IconeTipoObra = ({ tipo }) => {
  const { Icone, cor } = ICONE_TIPO_OBRA[tipo] ?? ICONE_TIPO_OBRA.padrao;
  return <Icone className={cor} aria-hidden="true" />;
};

export const IconeTemplate = ({ icone, size }) => {
  const Icone = ICONES_TEMPLATE[icone] ?? FaTasks;
  return <Icone size={size} aria-hidden="true" />;
};
