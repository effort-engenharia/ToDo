// Utilitário para atualizar valores diretamente no código
// Este arquivo permite salvar as metas editadas diretamente no código-fonte

import { METAS_CONFIG } from '../config/metas';

export const updateMetaInCode = async (metaName, newValue) => {
  try {
    // Em um ambiente de produção, isso seria feito via API
    // Por enquanto, vamos usar localStorage como fallback
    const metaKey = `meta_${metaName}`;
    localStorage.setItem(metaKey, newValue.toString());
    
    console.log(`📝 Meta ${metaName} atualizada para: ${newValue} (salva no localStorage)`);
    console.log(`💡 Valor padrão no código: ${METAS_CONFIG[metaName]}`);
    
    // TODO: Implementar chamada para API que atualiza o arquivo de configuração
    // await fetch('/api/update-meta', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ metaName, newValue })
    // });
    
    return true;
  } catch (error) {
    console.error('Erro ao atualizar meta no código:', error);
    return false;
  }
};

export const getMetaFromCode = (metaName, defaultValue = null) => {
  try {
    const metaKey = `meta_${metaName}`;
    const saved = localStorage.getItem(metaKey);
    const fallbackValue = defaultValue || METAS_CONFIG[metaName] || 300;
    return saved ? parseInt(saved) : fallbackValue;
  } catch (error) {
    console.error('Erro ao recuperar meta do código:', error);
    return defaultValue || METAS_CONFIG[metaName] || 300;
  }
};

// Usar a configuração centralizada
export const DEFAULT_METAS = METAS_CONFIG;
