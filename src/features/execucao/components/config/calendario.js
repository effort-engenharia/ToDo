import { addDias, dataLocalISO, parseDataLocal } from '../../utils/datas';

// Domingo de Páscoa (algoritmo anônimo gregoriano; mesmo cálculo usado no banco)
export const pascoa = (ano) => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
};

const MS_DIA = 24 * 60 * 60 * 1000;

// Dias entre dois dias civis, imune a horário de verão
const diasEntre = (a, b) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DIA);

// Data equivalente do feriado no ano de destino: fixo mantém dia/mês; móvel mantém a distância da Páscoa
export const dataNoAno = (feriado, anoDestino) => {
  const origem = parseDataLocal(feriado.data);
  if (feriado.movel) {
    const deslocamento = diasEntre(pascoa(origem.getFullYear()), origem);
    return dataLocalISO(addDias(pascoa(anoDestino), deslocamento));
  }
  const ultimoDia = new Date(anoDestino, origem.getMonth() + 1, 0).getDate();
  return dataLocalISO(new Date(anoDestino, origem.getMonth(), Math.min(origem.getDate(), ultimoDia)));
};

export const chaveFeriado = (f) =>
  [f.data, f.abrangencia, f.uf || '', f.cidade_id || '', f.descricao.trim().toLowerCase()].join('|');
