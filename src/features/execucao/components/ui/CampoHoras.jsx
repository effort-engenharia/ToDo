import React, { useEffect, useState } from 'react';
import { horasParaHHMM, hhmmParaHoras } from '../../utils/formatos';

// Campo de duração em HH:MM. Quem usa continua trabalhando com horas decimais
// (value e onChange em string decimal com ponto, ex.: "0.25"), mas o usuário vê e digita "00:15".
const CampoHoras = ({ value, onChange, className = '', placeholder = '00:00', ...resto }) => {
  const [texto, setTexto] = useState(() => horasParaHHMM(value));
  const [foco, setFoco] = useState(false);

  // Reflete mudanças externas (ex.: abrir outro template) enquanto o campo não está sendo digitado
  useEffect(() => {
    if (!foco) setTexto(horasParaHHMM(value));
  }, [value, foco]);

  const aoDigitar = (e) => {
    const limpo = e.target.value.replace(/[^\d:hH]/g, '').slice(0, 7);
    setTexto(limpo);
    const horas = hhmmParaHoras(limpo);
    if (limpo === '') onChange('');
    else if (horas != null) onChange(String(Math.round(horas * 10000) / 10000));
  };

  const aoSair = () => {
    setFoco(false);
    const horas = hhmmParaHoras(texto);
    setTexto(horas == null ? '' : horasParaHHMM(horas));
    if (horas == null) onChange('');
  };

  return (
    <input
      {...resto}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      placeholder={placeholder}
      value={texto}
      onFocus={() => setFoco(true)}
      onChange={aoDigitar}
      onBlur={aoSair}
    />
  );
};

export default CampoHoras;
