import React from 'react';

// Selo "Passos pendentes": a atividade da etapa já foi concluída, mas há passos (sub-etapas) em aberto.
// A etapa só fica concluída quando o servidor assim definir (todos os passos concluídos).
const SeloPassosPendentes = ({ quantidade, className = '' }) => {
  if (!quantidade) return null;
  const texto = `${quantidade} ${quantidade === 1 ? 'passo pendente' : 'passos pendentes'}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-amber-300/40 bg-amber-300/10 px-1.5 py-0.5 text-xs font-medium text-amber-200 ${className}`}
      title="A atividade foi concluída, mas a etapa segue em andamento até todos os passos serem concluídos"
    >
      <span aria-hidden="true">⚠️</span> {texto}
    </span>
  );
};

export default SeloPassosPendentes;
