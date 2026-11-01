// Helpers da conclusão da atividade (origem das horas e link do mapa) compartilhados entre as telas da gestão.

const ORIGEM_HORAS = {
  previstas: ' (igual às previstas: não houve início registrado)',
  intervalos: ' (medidas pelos intervalos em andamento)',
  ajuste_admin: ' (ajustadas pela gestão)',
  ajuste_tecnico: ' (ajustadas pelo técnico)'
};

// Rótulo da origem das horas realizadas. `horas_origem` nulo = histórico anterior à medição no servidor
// (nesse caso `horas_ajustadas` não é mais confiável para dizer quem ajustou).
export const rotuloOrigemHoras = (atividade) =>
  ORIGEM_HORAS[atividade?.horas_origem] ?? (atividade?.horas_ajustadas ? ' (ajustadas)' : '');

export const linkMapa = (latitude, longitude) => `https://maps.google.com/?q=${latitude},${longitude}`;
