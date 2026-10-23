import React, { useEffect, useState } from 'react';
import { horasParaHHMM, hhmmParaHoras } from '../../utils/formatos';

// Máscara HH:MM: só dígitos (e ":" opcional), horas com até 2 dígitos e minutos de 00 a 59.
const mascarar = (bruto) => {
  const texto = String(bruto ?? '');
  const somenteDigitos = (v) => v.replace(/\D/g, '');
  let horas;
  let minutos = '';
  let temSeparador = false;

  if (/[:hH]/.test(texto)) {
    const [h, ...resto] = texto.split(/[:hH]/);
    horas = somenteDigitos(h).slice(0, 2);
    minutos = somenteDigitos(resto.join('')).slice(0, 2);
    temSeparador = true;
  } else {
    const digitos = somenteDigitos(texto).slice(0, 4);
    horas = digitos.slice(0, 2);
    minutos = digitos.slice(2);
    temSeparador = digitos.length > 2;
  }

  if (minutos && Number(minutos[0]) > 5) minutos = ''; // minutos só até 59
  if (!horas && !temSeparador) return '';
  return temSeparador ? `${horas}:${minutos}` : horas;
};

// "7" -> "07:00"; "13:3" -> "13:30"; "" -> ""
const completar = (mascarado) => {
  if (!mascarado) return '';
  const [h = '', m = ''] = mascarado.split(':');
  if (!h && !m) return '';
  return `${h.padStart(2, '0')}:${m.padEnd(2, '0')}`;
};

// Campo de duração em HH:MM. Quem usa continua trabalhando com horas decimais
// (value e onChange em string decimal com ponto, ex.: "0.25"), mas o usuário vê e digita "00:15".
const CampoHoras = ({ value, onChange, className = '', placeholder = 'HH:MM', ...resto }) => {
  const [texto, setTexto] = useState(() => horasParaHHMM(value));
  const [foco, setFoco] = useState(false);

  // Reflete mudanças externas (ex.: abrir outro template) enquanto o campo não está sendo digitado
  useEffect(() => {
    if (!foco) setTexto(horasParaHHMM(value));
  }, [value, foco]);

  const emitir = (mascarado) => {
    const horas = hhmmParaHoras(completar(mascarado));
    onChange(horas == null ? '' : String(Math.round(horas * 10000) / 10000));
  };

  const aoDigitar = (e) => {
    const mascarado = mascarar(e.target.value);
    setTexto(mascarado);
    emitir(mascarado);
  };

  const aoSair = () => {
    setFoco(false);
    setTexto(completar(texto));
  };

  return (
    <input
      {...resto}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
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
