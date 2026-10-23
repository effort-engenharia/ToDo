import React from 'react';
import { FaBolt, FaBox, FaHardHat, FaTasks, FaWarehouse, FaWrench } from 'react-icons/fa';

const ICONES = {
  FaBolt,
  FaHardHat,
  FaWarehouse,
  FaWrench,
  FaBox
};

export default function IconeTemplate({ icone, size = 24 }) {
  const Icone = ICONES[icone] ?? FaTasks;
  return <Icone size={size} aria-hidden="true" />;
}
