import React, { useMemo, useState } from 'react';
import { FaBolt } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { ehDiaUtil, proximoDiaUtil } from '../utils';
import { camposDoContrato, equipeDaLinha, resolverCidade, sugerirTemplate, tipoEtapaDoTipoObra } from './cadastroUtils';
import SeletorContrato from './SeletorContrato';
import SeletorEquipe from './SeletorEquipe';
import { useDadosCadastro } from './useDadosCadastro';
import './cadastro.css';

const mensagemDe = (resultado) => resultado?.message || 'erro desconhecido';

// Início do contrato no futuro vira a data sugerida; contratos vencidos ou sem data usam o próximo dia útil
const dataSugerida = (contrato) => {
  const inicio = contrato?.cronograma_data_inicio;
  return inicio && inicio >= dataLocalISO() ? inicio : dataLocalISO(proximoDiaUtil(new Date(), null));
};

// "Serviço rápido": obra (rapido = true) + 1 etapa + 1 atividade na agenda, criadas em uma única transação.
const ServicoRapidoModal = ({
  tecnicos,
  templates,
  usuarioId,
  contratoInicial = null,
  tipoServicoInicial = '',
  onCriado,
  onClose,
  onContratosAlterados
}) => {
  const { toast } = useExecucaoUI();
  const { tiposExecucao, cidades, calendarioDe, carregando } = useDadosCadastro();
  const [contrato, setContrato] = useState(contratoInicial);
  const [cliente, setCliente] = useState(contratoInicial?.nome_cliente || '');
  const [endereco, setEndereco] = useState(contratoInicial ? camposDoContrato(contratoInicial).endereco : '');
  const [tipoCodigo, setTipoCodigo] = useState(contratoInicial?.tipo_servico_codigo || tipoServicoInicial || '');
  const [data, setData] = useState(() => dataSugerida(contratoInicial));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('11:00');
  const [equipe, setEquipe] = useState({ liderId: '', apoioIds: [] });
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const tipo = tiposExecucao.find((t) => t.codigo === tipoCodigo) ?? null;
  const templatePadrao = useMemo(() => sugerirTemplate(tipo, templates), [tipo, templates]);
  const itemBase = templatePadrao?.itens?.[0] ?? null;

  const cidadeId = contrato?.cidade_id || resolverCidade(contrato?.cidade, cidades)?.id || '';
  const calendario = useMemo(() => calendarioDe(cidadeId), [calendarioDe, cidadeId]);
  const dataSelecionada = parseDataLocal(data);
  const diaNaoUtil = Boolean(dataSelecionada && !ehDiaUtil(dataSelecionada, calendario));

  const handleContrato = (escolhido) => {
    setContrato(escolhido);
    if (!escolhido) return;
    const campos = camposDoContrato(escolhido);
    setCliente(campos.nome_cliente);
    setEndereco(campos.endereco);
    if (escolhido.tipo_servico_codigo) setTipoCodigo(escolhido.tipo_servico_codigo);
    setData(dataSugerida(escolhido));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    if (!cliente.trim()) {
      toast.error('Informe o cliente.');
      return;
    }
    if (horaFim <= horaInicio) {
      toast.error('O horário final deve ser depois do inicial.');
      return;
    }
    if (!equipe.liderId) {
      toast.error('Escolha o técnico para agendar o serviço.');
      return;
    }

    const tipoEtapa = itemBase?.tipo && itemBase.tipo !== 'estoque' ? itemBase.tipo : tipoEtapaDoTipoObra(tipo?.tipo_obra);
    const obra = {
      nome_cliente: cliente.trim(),
      endereco: endereco.trim(),
      cidade: contrato?.cidade || '',
      cidade_id: cidadeId,
      data_inicio_prevista: data,
      data_fim_prevista: data,
      tipo_obra: tipo?.tipo_obra || 'eletrica',
      prioridade: 'media',
      responsavel_id: equipe.liderId,
      observacoes: observacao.trim(),
      contato_cliente: contrato?.contato_cliente || '',
      apontamento_id: contrato?.id || '',
      template_id: templatePadrao?.id || '',
      valor_contrato: contrato?.valor_total_servico ?? '',
      tipo_servico_codigo: tipo?.codigo || '',
      rapido: true,
      status: 'planejada'
    };
    const etapa = {
      nome: tipo?.nome || itemBase?.nome || 'Serviço',
      descricao: observacao.trim(),
      tipo: tipoEtapa,
      data_inicio: data,
      data_fim: data,
      ordem: 1,
      ...equipeDaLinha(equipe.liderId, equipe.apoioIds),
      horas_previstas: itemBase?.horas_previstas != null ? String(itemBase.horas_previstas) : '',
      qtd_tecnicos: 1 + equipe.apoioIds.length,
      pop_id: itemBase?.pop_id || '',
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      observacoes: observacao.trim()
    };

    setSalvando(true);
    try {
      const resultado = await execucaoPlanejamentoService.criarObraCompleta(obra, [etapa], true);
      if (!resultado.success) {
        toast.error(`Não foi possível agendar o serviço: ${mensagemDe(resultado)}`);
        return;
      }
      toast.success('Serviço agendado na agenda do técnico.');
      onCriado?.(resultado.data);
    } catch (err) {
      console.error('Erro ao agendar serviço rápido:', err);
      toast.error(`Não foi possível agendar o serviço: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo="Serviço rápido"
      cabecalho={
        <>
          <FaBolt className="text-yellow-400" aria-hidden="true" />
          Serviço rápido
        </>
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Para serviços de uma visita: cria a obra, uma etapa e a atividade na agenda do técnico de uma só vez.
          </p>

          <SeletorContrato
            selecionado={contrato}
            onSelecionar={handleContrato}
            usuarioId={usuarioId}
            onIgnorado={onContratosAlterados}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-cliente" className="execucao-form-label">Cliente *</label>
              <input
                id="rapido-cliente"
                type="text"
                className="execucao-form-input"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                required
              />
            </div>
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-endereco" className="execucao-form-label">Endereço</label>
              <input
                id="rapido-endereco"
                type="text"
                className="execucao-form-input"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
          </div>

          {tiposExecucao.length > 0 && (
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-tipo" className="execucao-form-label">Tipo de serviço</label>
              <select
                id="rapido-tipo"
                className="execucao-form-select"
                value={tipoCodigo}
                onChange={(e) => setTipoCodigo(e.target.value)}
                disabled={carregando}
              >
                <option value="">Não informado</option>
                {tiposExecucao.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-data" className="execucao-form-label">Data *</label>
              <input
                id="rapido-data"
                type="date"
                className="execucao-form-input"
                value={data}
                min={dataLocalISO(addDias(new Date(), -365))}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-hora-inicio" className="execucao-form-label">Início</label>
              <input
                id="rapido-hora-inicio"
                type="time"
                className="execucao-form-input"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                required
              />
            </div>
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-hora-fim" className="execucao-form-label">Fim</label>
              <input
                id="rapido-hora-fim"
                type="time"
                className="execucao-form-input"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                required
              />
            </div>
          </div>
          {diaNaoUtil && (
            <p className="cad-aviso" role="status">
              Dia não útil (fim de semana ou feriado): só deve ser usado em emergência, como hora extra.
            </p>
          )}

          <div className="execucao-form-group !mb-0">
            <span className="execucao-form-label block">Técnicos *</span>
            <SeletorEquipe
              tecnicos={tecnicos}
              liderId={equipe.liderId}
              apoioIds={equipe.apoioIds}
              sugerido={itemBase?.qtd_tecnicos || 1}
              rotulo="Técnicos"
              onChange={setEquipe}
            />
          </div>

          <div className="execucao-form-group !mb-0">
            <label htmlFor="rapido-obs" className="execucao-form-label">Observação</label>
            <textarea
              id="rapido-obs"
              className="execucao-form-textarea"
              rows="2"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <div className="execucao-modal-footer -mx-6 -mb-6 mt-6">
          <button type="button" className="execucao-btn execucao-btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="execucao-btn execucao-btn-primary" disabled={salvando}>
            {salvando ? 'Agendando...' : 'Agendar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ServicoRapidoModal;
