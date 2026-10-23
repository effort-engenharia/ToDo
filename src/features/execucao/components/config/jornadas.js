import { horaParaMinutos } from '../../utils/formatos';

export const DIAS = [
  { chave: 'seg', rotulo: 'Seg' },
  { chave: 'ter', rotulo: 'Ter' },
  { chave: 'qua', rotulo: 'Qua' },
  { chave: 'qui', rotulo: 'Qui' },
  { chave: 'sex', rotulo: 'Sex' },
  { chave: 'sab', rotulo: 'Sáb' },
  { chave: 'dom', rotulo: 'Dom' },
];

export const PERIODOS_PADRAO = [['07:00', '12:00'], ['13:15', '17:00']];

export const periodosPadrao = () =>
  Object.fromEntries(DIAS.map(({ chave }) => [chave, ['sab', 'dom'].includes(chave) ? [] : PERIODOS_PADRAO.map((p) => [...p])]));

// Formato do banco ({seg:[["07:00","12:00"]]}) -> formato do formulário ({seg:[{ini,fim}]})
export const periodosParaForm = (periodos) =>
  Object.fromEntries(DIAS.map(({ chave }) => [
    chave,
    (periodos?.[chave] ?? []).map(([ini, fim]) => ({ ini: String(ini).slice(0, 5), fim: String(fim).slice(0, 5) })),
  ]));

export const periodosParaBanco = (form) =>
  Object.fromEntries(DIAS.map(({ chave }) => [chave, (form[chave] ?? []).map(({ ini, fim }) => [ini, fim])]));

export const minutosDoDia = (periodos) =>
  (periodos ?? []).reduce((soma, p) => {
    const [ini, fim] = Array.isArray(p) ? p : [p.ini, p.fim];
    return soma + Math.max(0, horaParaMinutos(fim) - horaParaMinutos(ini));
  }, 0);

export const totalDescontos = (descontos) =>
  (descontos ?? []).reduce((soma, d) => soma + (Number(d.minutos) || 0), 0);

// Mesma regra do banco: líquido = bruto − descontos + ajuste (0 em dia sem expediente)
export const minutosLiquidos = (bruto, descontos, ajuste = 0) =>
  (bruto > 0 ? Math.max(0, bruto - totalDescontos(descontos) + (Number(ajuste) || 0)) : 0);

// Bruto do primeiro dia útil com expediente (referência para exibir "x h/dia")
export const brutoReferencia = (periodos) => {
  for (const { chave } of DIAS) {
    const minutos = minutosDoDia(periodos?.[chave]);
    if (minutos > 0) return minutos;
  }
  return 0;
};

// Retorna mensagem de erro ou '' se os períodos são válidos (início < fim e sem sobreposição)
export const validarPeriodos = (form) => {
  for (const { chave, rotulo } of DIAS) {
    const ordenados = [...(form[chave] ?? [])].sort((a, b) => horaParaMinutos(a.ini) - horaParaMinutos(b.ini));
    for (let i = 0; i < ordenados.length; i += 1) {
      const { ini, fim } = ordenados[i];
      if (!ini || !fim) return `${rotulo}: preencha início e fim de todos os períodos.`;
      if (horaParaMinutos(ini) >= horaParaMinutos(fim)) return `${rotulo}: o início deve ser anterior ao fim.`;
      if (i > 0 && horaParaMinutos(ini) < horaParaMinutos(ordenados[i - 1].fim)) return `${rotulo}: períodos sobrepostos.`;
    }
  }
  return '';
};
