import React, { useMemo, useState } from 'react';
import { FaBolt } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { ehDiaUtil, proximoDiaUtil } from '../utils';
import {
  camposDoContrato,
  equipeDaLinha,
  etapasParaPayload,
  gerarEtapasPrevia,
  resolverCidade,
  sugerirTemplate,
  terminoPrevisto,
  tipoEtapaDoTipoObra
} from './cadastroUtils';
import { formatarHoras } from '../../../utils/formatos';
import SeletorContrato from './SeletorContrato';
import SeletorEquipe from './SeletorEquipe';
import { useDadosCadastro } from './useDadosCadastro';
import './cadastro.css';

// Linhas "1. Etapa · 1d · 2h" / "1.1 Sub-etapa · 30min" para o resumo do template escolhido
const resumoTemplate = (template) => {
  let principal = 0;
  const rotulos = new Map();
  const contagem = new Map();
  return template.itens.map((item, i) => {
    const sub = item.pai_ordem != null;
    let rotulo;
    if (!sub) {
      principal += 1;
      rotulo = `${principal}`;
      rotulos.set(item.ordem, rotulo);
    } else {
      const n = (contagem.get(item.pai_ordem) ?? 0) + 1;
      contagem.set(item.pai_ordem, n);
      rotulo = `${rotulos.get(item.pai_ordem) ?? '?'}.${n}`;
    }
    const partes = [
      sub ? null : `${item.duracao_dias || 1}d`,
      item.horas_previstas ? formatarHoras(item.horas_previstas) : null
    ].filter(Boolean);
    return { chave: item.id ?? i, rotulo, nome: item.nome, sub, detalhe: partes.join(' · ') };
  });
};

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
  // null = segue o template sugerido pelo tipo de serviço; '' = sem template; id = template escolhido
  const [templateEscolhido, setTemplateEscolhido] = useState(null);

  const tipo = tiposExecucao.find((t) => t.codigo === tipoCodigo) ?? null;
  const templatesAtivos = useMemo(() => (templates ?? []).filter((t) => t.ativo && t.itens?.length), [templates]);
  const templatePadrao = useMemo(() => sugerirTemplate(tipo, templates ?? []), [tipo, templates]);
  const template = templateEscolhido === null
    ? templatePadrao
    : (templatesAtivos.find((t) => t.id === templateEscolhido) ?? null);
  const itemBase = template?.itens?.[0] ?? null;
  const qtdSugerida = template ? Math.max(1, ...template.itens.map((i) => i.qtd_tecnicos || 1)) : 1;

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
    // Com template: todas as etapas e sub-etapas dele, a partir da data escolhida, com a mesma equipe
    const linhasTemplate = template
      ? gerarEtapasPrevia(template, { inicioISO: data, calendario, responsavelId: equipe.liderId, primeiroNaData: true })
          .map((l) => ({ ...l, lider_id: equipe.liderId, apoio_ids: equipe.apoioIds }))
      : [];
    const obra = {
      nome_cliente: cliente.trim(),
      endereco: endereco.trim(),
      cidade: contrato?.cidade || '',
      cidade_id: cidadeId,
      data_inicio_prevista: data,
      data_fim_prevista: linhasTemplate.length ? (terminoPrevisto(linhasTemplate) || data) : data,
      tipo_obra: tipo?.tipo_obra || template?.tipo_obra || 'eletrica',
      prioridade: 'media',
      responsavel_id: equipe.liderId,
      observacoes: observacao.trim(),
      contato_cliente: contrato?.contato_cliente || '',
      apontamento_id: contrato?.id || '',
      template_id: template?.id || '',
      valor_contrato: contrato?.valor_total_servico ?? '',
      tipo_servico_codigo: tipo?.codigo || '',
      rapido: true,
      status: 'planejada'
    };
    const etapaUnica = {
      nome: tipo?.nome || 'Serviço',
      descricao: observacao.trim(),
      tipo: tipoEtapa,
      data_inicio: data,
      data_fim: data,
      ordem: 1,
      ...equipeDaLinha(equipe.liderId, equipe.apoioIds),
      horas_previstas: '',
      qtd_tecnicos: 1 + equipe.apoioIds.length,
      pop_id: '',
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      observacoes: observacao.trim()
    };

    setSalvando(true);
    try {
      const etapas = linhasTemplate.length ? etapasParaPayload(linhasTemplate) : [etapaUnica];
      const resultado = await execucaoPlanejamentoService.criarObraCompleta(obra, etapas, true);
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

          <div className="execucao-form-group !mb-0">
            <label htmlFor="rapido-template" className="execucao-form-label">Template de etapas</label>
            <select
              id="rapido-template"
              className="execucao-form-select"
              value={templateEscolhido === null ? (templatePadrao?.id ?? '') : templateEscolhido}
              onChange={(e) => setTemplateEscolhido(e.target.value)}
            >
              <option value="">Sem template (uma única atividade)</option>
              {templatesAtivos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} · {t.itens.filter((i) => i.pai_ordem == null).length} etapa(s)
                </option>
              ))}
            </select>
            {template && (
              <ul className="cad-rapido-etapas" aria-label="Etapas que serão criadas">
                {resumoTemplate(template).map((linha) => (
                  <li key={linha.chave} className={linha.sub ? 'cad-rapido-sub' : undefined}>
                    {linha.rotulo}. {linha.nome}
                    <span className="text-slate-500">{linha.detalhe ? ` · ${linha.detalhe}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${template ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`}>
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-data" className="execucao-form-label">{template ? 'Data de início *' : 'Data *'}</label>
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
            {!template && (<>
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
            </>)}
          </div>
          {template && (
            <p className="text-xs text-slate-400">
              As etapas seguem em dias úteis a partir da data de início e as sub-etapas entram na agenda do técnico dentro do dia da etapa.
            </p>
          )}
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
              sugerido={qtdSugerida}
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
