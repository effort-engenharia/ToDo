import React, { useState } from 'react';
import { FaFilePdf } from 'react-icons/fa';
import { execucaoCapacidadeService } from '../../../../../services/supabase/execucaoCapacidade';
import { execucaoPlanejamentoService as servico } from '../../../../../services/supabase/execucaoPlanejamento';
import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { exportarPautaSemanal } from '../exportacao';
import { resumirCargaSemana } from './carga';
import { intervaloDaPauta, montarPauta } from './pautaSemanal';

const resultadoOuNulo = (resultado) => (resultado?.success ? resultado.data : null);

// "Pauta da semana": PDF para conduzir a reunião de planejamento (item 2.8)
const PautaSemanalBotao = ({ tecnicos }) => {
  const { toast } = useExecucaoUI();
  const [semana, setSemana] = useState('0');
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    if (gerando) return;
    setGerando(true);
    try {
      const { inicio, fim } = intervaloDaPauta(Number(semana));
      const anteriorFim = dataLocalISO(addDias(parseDataLocal(inicio), -1));
      const anteriorInicio = dataLocalISO(addDias(parseDataLocal(inicio), -7));

      const [dados, saude, obras, pendencias, capacidade, indicadores] = await Promise.all([
        servico.buscarDadosPautaSemanal(inicio, fim),
        servico.buscarSaudeObras(),
        servico.buscarObrasAbertasResumo(),
        servico.listarPendenciasReplanejamento(),
        execucaoCapacidadeService.buscarCapacidade(inicio, fim),
        execucaoCapacidadeService.buscarIndicadores(anteriorInicio, anteriorFim)
      ]);

      // Sem as etapas e atividades da semana não há pauta; os demais blocos são opcionais
      if (!dados.success) {
        toast.error(`Não foi possível carregar os dados da pauta: ${dados.message}`);
        return;
      }

      const nomes = new Map((tecnicos ?? []).map((t) => [t.id, t.nome_completo]));
      const pauta = montarPauta({
        inicio,
        fim,
        obrasAbertas: resultadoOuNulo(obras),
        saude: resultadoOuNulo(saude),
        pendencias: resultadoOuNulo(pendencias),
        dados: dados.data,
        carga: capacidade.success ? resumirCargaSemana(capacidade.data, nomes) : null,
        indicadores: resultadoOuNulo(indicadores),
        nomes
      });

      // Deixa o navegador pintar o estado "Gerando..." antes do trabalho pesado do PDF
      await new Promise(requestAnimationFrame);
      await exportarPautaSemanal(pauta);

      const faltantes = [
        !saude.success && 'saúde das obras',
        !pendencias.success && 'pedidos de replanejamento',
        !capacidade.success && 'carga da equipe',
        !indicadores.success && 'números da semana passada'
      ].filter(Boolean);
      if (faltantes.length) toast.info(`Pauta gerada sem: ${faltantes.join(', ')}.`);
      else toast.success('Pauta da semana gerada.');
    } catch (erro) {
      console.error('Erro ao gerar a pauta da semana:', erro);
      toast.error(`Não foi possível gerar a pauta: ${erro.message}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="pauta-semana" className="sr-only">Semana da pauta</label>
      <select
        id="pauta-semana"
        className="execucao-form-select text-sm py-1"
        value={semana}
        onChange={(e) => setSemana(e.target.value)}
        disabled={gerando}
      >
        <option value="0">Esta semana</option>
        <option value="1">Próxima semana</option>
      </select>
      <button
        type="button"
        onClick={gerar}
        disabled={gerando}
        className="execucao-btn execucao-btn-secondary flex items-center gap-1.5"
        title="PDF para conduzir a reunião semanal"
      >
        <FaFilePdf className="text-red-400" aria-hidden="true" />
        {gerando ? 'Gerando...' : 'Pauta da semana'}
      </button>
    </div>
  );
};

export default React.memo(PautaSemanalBotao);
