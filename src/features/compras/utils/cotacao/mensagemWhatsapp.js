// Montagem de mensagem e link do WhatsApp (plano §10.3). Funções puras.

// Placeholders: {contato} {empresa} {empresa_publica} {numero} {qtd_itens} {link} {prazo}.
// Variável ausente vira vazio. {link} fica cercado de espaços para o WhatsApp não colar pontuação na URL.
export const montarMensagem = (template, vars = {}) => String(template ?? '')
  .replace(/\{(\w+)\}/g, (_, nome) => {
    const v = vars[nome];
    const txt = v === null || v === undefined ? '' : String(v);
    return nome === 'link' && txt ? ` ${txt} ` : txt;
  })
  .replace(/ {2,}/g, ' ')
  .trim();

// Número já normalizado (55DDDNÚMERO, 12–13 dígitos). Devolve '' se inválido.
export const urlWhatsapp = (numero, texto = '') => {
  const digitos = String(numero ?? '').replace(/\D/g, '');
  if (digitos.length < 12 || digitos.length > 13) return '';
  return `https://wa.me/${digitos}?text=${encodeURIComponent(String(texto))}`;
};
