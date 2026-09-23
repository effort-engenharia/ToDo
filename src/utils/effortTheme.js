/**
 * Effort Theme — tokens da paleta do site effortengenharia.com
 * Uso: import { effortColors, semanaCores } from '../utils/effortTheme';
 */

export const effortColors = {
  // Marca
  amareloEffort: '#F5B841',    // amarelo dourado principal
  amareloEscuro: '#D4941C',
  amareloClaro: '#FFD97A',

  // Escuros / neutros
  preto: '#0B0F14',
  cinzaEscuro: '#111827',
  cinzaMedio: '#1F2937',
  cinzaGrafite: '#374151',
  cinzaSuave: '#6B7280',
  cinzaClaro: '#F3F4F6',
  branco: '#FFFFFF',

  // Semânticas
  sucesso: '#10B981',
  aviso: '#F5B841',
  perigo: '#EF4444',
  info: '#3B82F6',
  laranja: '#F97316',
};

/**
 * Cores das 4 semanas do mês comercial.
 * Semana 1 (verde) → 2 (amarelo) → 3 (laranja) → 4 (vermelho)
 * A ideia é sinalizar urgência crescente conforme o mês avança.
 */
export const semanaCores = [
  {
    id: 1,
    nome: 'Semana 1',
    label: 'Início',
    cor: '#10B981',
    corClara: '#D1FAE5',
    corEscura: '#065F46',
    hexRgba: 'rgba(16, 185, 129, 0.15)',
    text: 'text-emerald-600',
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
  },
  {
    id: 2,
    nome: 'Semana 2',
    label: 'Ritmo',
    cor: '#F5B841',
    corClara: '#FEF3C7',
    corEscura: '#92400E',
    hexRgba: 'rgba(245, 184, 65, 0.15)',
    text: 'text-yellow-500',
    bg: 'bg-yellow-500',
    border: 'border-yellow-500',
    ring: 'ring-yellow-500',
  },
  {
    id: 3,
    nome: 'Semana 3',
    label: 'Sprint',
    cor: '#F97316',
    corClara: '#FED7AA',
    corEscura: '#9A3412',
    hexRgba: 'rgba(249, 115, 22, 0.15)',
    text: 'text-orange-500',
    bg: 'bg-orange-500',
    border: 'border-orange-500',
    ring: 'ring-orange-500',
  },
  {
    id: 4,
    nome: 'Semana 4',
    label: 'Fechamento',
    cor: '#EF4444',
    corClara: '#FEE2E2',
    corEscura: '#7F1D1D',
    hexRgba: 'rgba(239, 68, 68, 0.15)',
    text: 'text-red-500',
    bg: 'bg-red-500',
    border: 'border-red-500',
    ring: 'ring-red-500',
  },
];

export const medalhas = {
  bronze: {
    nome: 'Bronze',
    min: 50,
    cor: '#B45309',
    fundo: 'linear-gradient(135deg, #CD7F32 0%, #7C3A05 100%)',
    icone: '🥉',
  },
  prata: {
    nome: 'Prata',
    min: 75,
    cor: '#6B7280',
    fundo: 'linear-gradient(135deg, #E5E7EB 0%, #6B7280 100%)',
    icone: '🥈',
  },
  ouro: {
    nome: 'Ouro',
    min: 100,
    cor: '#F5B841',
    fundo: 'linear-gradient(135deg, #FCD34D 0%, #D97706 100%)',
    icone: '🥇',
  },
  diamante: {
    nome: 'Diamante',
    min: 150,
    cor: '#3B82F6',
    fundo: 'linear-gradient(135deg, #93C5FD 0%, #1E40AF 100%)',
    icone: '💎',
  },
};

/**
 * Recebe percentual (0-∞) e retorna a medalha correspondente ou null.
 */
export function medalhaPara(percentual) {
  if (percentual >= 150) return medalhas.diamante;
  if (percentual >= 100) return medalhas.ouro;
  if (percentual >= 75) return medalhas.prata;
  if (percentual >= 50) return medalhas.bronze;
  return null;
}

export default effortColors;
