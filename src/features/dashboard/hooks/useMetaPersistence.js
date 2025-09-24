import { useEffect } from 'react';

/**
 * Hook para gerenciar persistência de metas
 * @param {Number} metaPersonalizada - Valor atual da meta personalizada
 * @param {Number} metaClientesAtendidos - Valor atual da meta de clientes atendidos
 * @param {Number} defaultValue - Valor padrão da meta
 * @param {Function} salvarMetaFn - Função para salvar meta no Supabase
 * @param {Function} updateMetaInCode - Função para atualizar meta no localStorage
 */
export const useMetaPersistence = (
  metaPersonalizada, 
  metaClientesAtendidos,
  defaultValues, 
  salvarMetaFn,
  updateMetaInCode
) => {
  // Salvar meta personalizada no Supabase e localStorage sempre que mudar
  useEffect(() => {
    const saveMeta = async () => {
      try {
        await salvarMetaFn(
          'valor_entrada', 
          metaPersonalizada, 
          `Meta atualizada via App em ${new Date().toLocaleString('pt-BR')}`
        );
      } catch (error) {
        console.error('Erro ao salvar meta de valor de entrada:', error);
        // Fallback para localStorage
        updateMetaInCode('valorEntrada', metaPersonalizada);
      }
    };
    
    if (metaPersonalizada !== defaultValues.valorEntrada) {
      saveMeta();
    }
  }, [metaPersonalizada, defaultValues.valorEntrada, salvarMetaFn, updateMetaInCode]);

  // Salvar meta de clientes atendidos no Supabase e localStorage sempre que mudar
  useEffect(() => {
    const saveMeta = async () => {
      try {
        await salvarMetaFn(
          'clientes_atendidos', 
          metaClientesAtendidos, 
          `Meta atualizada via App em ${new Date().toLocaleString('pt-BR')}`
        );
      } catch (error) {
        console.error('Erro ao salvar meta de clientes atendidos:', error);
        // Fallback para localStorage
        updateMetaInCode('clientesAtendidos', metaClientesAtendidos);
      }
    };
    
    if (metaClientesAtendidos !== defaultValues.clientesAtendidos) {
      saveMeta();
    }
  }, [metaClientesAtendidos, defaultValues.clientesAtendidos, salvarMetaFn, updateMetaInCode]);
};