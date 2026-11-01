// Formatos do cadastro de fornecedores (puro).

export const apenasDigitos = (t) => String(t ?? '').replace(/\D/g, '');

// Remove o 55 do país quando o número tem 12–13 dígitos (colagem "+55 41 …" ou valor já normalizado do banco)
export const semPais = (t) => {
  const d = apenasDigitos(t).replace(/^0+/, '');
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
};

// "(41) 99999-9999" / "(41) 9999-9999" (aceita número parcial)
export const mascaraWhatsapp = (t) => {
  const d = semPais(t).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}${resto.length > corte ? `-${resto.slice(corte)}` : ''}`;
};

export const whatsappValido = (t) => /^[1-9]\d{9,10}$/.test(semPais(t));

// Número para o banco (normaliza lá): só dígitos, sem 55
export const whatsappParaSalvar = (t) => semPais(t);

// Link wa.me do número normalizado (55 + DDD + número)
export const linkWhatsapp = (t) => {
  const d = semPais(t);
  return /^[1-9]\d{9,10}$/.test(d) ? `https://wa.me/55${d}` : null;
};

const aplicar = (d, tamanhos, seps) => {
  let i = 0;
  let saida = '';
  tamanhos.forEach((t, idx) => {
    const parte = d.slice(i, i + t);
    if (!parte) return;
    saida += (idx > 0 ? seps[idx - 1] : '') + parte;
    i += t;
  });
  return saida;
};

// Até 11 dígitos = CPF; acima = CNPJ
export const mascaraDocumento = (t) => {
  const d = apenasDigitos(t).slice(0, 14);
  return d.length <= 11 ? aplicar(d, [3, 3, 3, 2], ['.', '.', '-']) : aplicar(d, [2, 3, 3, 4, 2], ['.', '.', '/', '-']);
};

// Documento é opcional e só o formato é checado (CPF 11 / CNPJ 14 dígitos)
export const documentoValido = (t) => {
  const n = apenasDigitos(t).length;
  return n === 0 || n === 11 || n === 14;
};

export const emailValido = (t) => !String(t ?? '').trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(t).trim());
