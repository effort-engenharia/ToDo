// Links de navegação e contato para o celular do técnico (0.4)

const normalizarTexto = (v) => String(v ?? '').trim();

export const enderecoCompleto = (endereco, cidade) => {
  const e = normalizarTexto(endereco);
  const c = normalizarTexto(cidade);
  if (!e) return '';
  if (!c || e.toLowerCase().includes(c.toLowerCase())) return e;
  return `${e}, ${c}`;
};

export const urlGoogleMaps = (endereco) =>
  (endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : null);

export const urlWaze = (endereco) =>
  (endereco ? `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes` : null);

// O contato vem como texto livre ("João 13 99999-8888"): extrai o primeiro telefone brasileiro (somente dígitos)
export const extrairTelefone = (texto) => {
  const t = normalizarTexto(texto);
  if (!t) return null;
  const achado = t.match(/(?:\+?55[\s-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/);
  const digitos = (achado ? achado[0] : t).replace(/\D/g, '');
  const semPais = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  return semPais.length >= 10 && semPais.length <= 11 ? semPais : null;
};

export const urlLigar = (texto) => {
  const tel = extrairTelefone(texto);
  return tel ? `tel:+55${tel}` : null;
};

export const urlWhatsApp = (texto) => {
  const tel = extrairTelefone(texto);
  return tel ? `https://wa.me/55${tel}` : null;
};

// Cliente da atividade: `contexto` (RPC execucao_contexto_atividades) tem prioridade; o join com a obra é fallback (admin)
export const obraDaAtividade = (atividade) => atividade?.contexto ?? atividade?.etapa?.obra ?? null;

export const clienteDaAtividade = (atividade) =>
  atividade?.cliente_nome || obraDaAtividade(atividade)?.nome_cliente || '';

export const contatoDaAtividade = (atividade) => {
  const obra = obraDaAtividade(atividade);
  const endereco = enderecoCompleto(atividade?.endereco || obra?.endereco, obra?.cidade);
  return {
    endereco,
    contato: normalizarTexto(obra?.contato_cliente),
    mapa: urlGoogleMaps(endereco),
    waze: urlWaze(endereco),
    ligar: urlLigar(obra?.contato_cliente),
    whatsapp: urlWhatsApp(obra?.contato_cliente)
  };
};
