import React, { useMemo, useState } from 'react';
import { FaBolt } from 'react-icons/fa';
import { execucaoPlanejamentoService } from '../../../../../services/supabase/execucaoPlanejamento';
import { addDias, dataLocalISO, parseDataLocal } from '../../../utils/datas';
import Modal from '../../ui/Modal';
import { useExecucaoUI } from '../../ui/ExecucaoUI';
import { addDiasUteis, ehDiaUtil, proximoDiaUtil } from '../utils';
import {
  camposDoContrato,
  equipeDaLinha,
  etapasParaPayload,
  resolverCidade,
  sugerirTemplate,
  tipoEtapaDoTipoObra
} from './cadastroUtils';
import { formatarHoras } from '../../../utils/formatos';
import SeletorContrato from './SeletorContrato';
import SeletorEquipe from './SeletorEquipe';
import { useDadosCadastro } from './useDadosCadastro';
import './cadastro.css';

// Serviço rápido com template = UMA atividade com o nome do serviço (o do template) e todos os itens do
// template como passos dentro dela. Item que tem sub-etapas é só um título de grupo: as horas ficam nas sub-etapas.
const itemTemSubs = (template, item) => template.itens.some((i) => i.pai_ordem === item.ordem);

const horasDoItem = (template, item) => (itemTemSubs(template, item) ? 0 : Number(item.horas_previstas) || 0);

const diasDoTemplate = (template) =>
  Math.max(1, template.itens
    .filter((i) => i.pai_ordem == null)
    .reduce((soma, i) => soma + Math.max(1, Number(i.duracao_dias) || 1), 0));

const resumoTemplate = (template) => {
  const horas = template.itens.reduce((soma, item) => soma + horasDoItem(template, item), 0);
  return {
    titulo: template.nome,
    horas,
    dias: diasDoTemplate(template),
    passos: template.itens.map((item, i) => ({
      chave: item.id ?? i,
      nome: item.nome,
      sub: item.pai_ordem != null,
      detalhe: horasDoItem(template, item) > 0 ? formatarHoras(horasDoItem(template, item)) : ''
    }))
  };
};

const montarLinhasRapido = (template, { data, calendario, equipe, tipoEtapa }) => {
  const inicio = parseDataLocal(data);
  const fim = addDiasUteis(inicio, diasDoTemplate(template) - 1, calendario);
  const base = {
    data_inicio: dataLocalISO(inicio),
    data_fim: dataLocalISO(fim),
    lider_id: equipe.liderId,
    apoio_ids: equipe.apoioIds,
    progresso: 0
  };
  const topo = {
    ...base,
    _chave: 'rapido-topo',
    pai_chave: null,
    nome: template.nome,
    descricao: '',
    tipo: tipoEtapa,
    ordem: 1,
    duracao_dias: diasDoTemplate(template),
    horas_previstas: '',
    qtd_tecnicos: 1 + equipe.apoioIds.length,
    pop_id: null
  };
  const passos = template.itens.map((item, i) => ({
    ...base,
    _chave: `rapido-passo-${i}`,
    pai_chave: topo._chave,
    nome: item.nome,
    descricao: item.descricao || '',
    tipo: item.tipo || 'geral',
    ordem: i + 2,
    duracao_dias: 0,
    horas_previstas: horasDoItem(template, item) > 0 ? String(horasDoItem(template, item)) : '',
    qtd_tecnicos: item.qtd_tecnicos || 1,
    pop_id: item.pop_id || null
  }));
  return [topo, ...passos];
};

// "09:30" + 2.25h -> "11:45" (limitado ao fim do dia)
const somarHoras = (hhmm, horas) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + Math.round((Number(horas) || 0) * 60));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  const [telefone, setTelefone] = useState(contratoInicial?.contato_cliente || '');
  const [tipoCodigo, setTipoCodigo] = useState(contratoInicial?.tipo_servico_codigo || tipoServicoInicial || '');
  const [data, setData] = useState(() => dataSugerida(contratoInicial));
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('11:00');
  const [inicioTemplate, setInicioTemplate] = useState(''); // horário de início opcional (modo template)
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
    setTelefone(campos.contato_cliente || '');
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
    if (!template && horaFim <= horaInicio) {
      toast.error('O horário final deve ser depois do inicial.');
      return;
    }
    if (!equipe.liderId) {
      toast.error('Escolha o técnico para agendar o serviço.');
      return;
    }

    const tipoEtapa = itemBase?.tipo && itemBase.tipo !== 'estoque' ? itemBase.tipo : tipoEtapaDoTipoObra(tipo?.tipo_obra);
    // Com template: uma atividade com o nome do template e os itens dele como passos
    const tipoDoTemplate = template?.itens?.find((i) => i.tipo && i.tipo !== 'estoque')?.tipo;
    const linhasTemplate = template
      ? montarLinhasRapido(template, {
          data,
          calendario,
          equipe,
          tipoEtapa: tipoDoTemplate || tipoEtapaDoTipoObra(tipo?.tipo_obra)
        })
      : [];
    // Horário opcional: o fim sai das horas previstas dos passos (padrão de 2h se o template não tiver horas)
    if (linhasTemplate.length && inicioTemplate) {
      const horas = linhasTemplate.reduce((soma, l) => soma + (l.pai_chave ? Number(l.horas_previstas) || 0 : 0), 0);
      linhasTemplate[0] = {
        ...linhasTemplate[0],
        hora_inicio: inicioTemplate,
        hora_fim: somarHoras(inicioTemplate, horas > 0 ? horas : 2)
      };
    }
    const obra = {
      nome_cliente: cliente.trim(),
      endereco: endereco.trim(),
      cidade: contrato?.cidade || '',
      cidade_id: cidadeId,
      data_inicio_prevista: data,
      data_fim_prevista: linhasTemplate.length ? linhasTemplate[0].data_fim : data,
      tipo_obra: tipo?.tipo_obra || template?.tipo_obra || 'eletrica',
      prioridade: 'media',
      responsavel_id: equipe.liderId,
      observacoes: observacao.trim(),
      contato_cliente: telefone.trim(),
      apontamento_id: contrato?.id || '',
      template_id: template?.id || '',
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
            <div className="execucao-form-group !mb-0">
              <label htmlFor="rapido-telefone" className="execucao-form-label">Telefone do cliente</label>
              <input
                id="rapido-telefone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className="execucao-form-input"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(13) 99999-9999"
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
            {template && (() => {
              const resumo = resumoTemplate(template);
              return (
                <div className="cad-rapido-resumo" aria-label="O que será criado">
                  <div className="cad-rapido-atividade">
                    Atividade: <strong>{resumo.titulo}</strong>
                    <span className="text-slate-400">
                      {resumo.horas > 0 ? ` · ${formatarHoras(resumo.horas)}` : ''}{resumo.dias > 1 ? ` · ${resumo.dias} dias úteis` : ''}
                    </span>
                  </div>
                  <ul className="cad-rapido-etapas" aria-label="Passos da atividade">
                    {resumo.passos.map((passo) => (
                      <li key={passo.chave} className={passo.sub ? 'cad-rapido-sub' : undefined}>
                        {passo.nome}
                        <span className="text-slate-500">{passo.detalhe ? ` · ${passo.detalhe}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${template ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
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
            {template && (
              <div className="execucao-form-group !mb-0">
                <label htmlFor="rapido-inicio-tpl" className="execucao-form-label">Horário de início (opcional)</label>
                <input
                  id="rapido-inicio-tpl"
                  type="time"
                  className="execucao-form-input"
                  value={inicioTemplate}
                  onChange={(e) => setInicioTemplate(e.target.value)}
                />
              </div>
            )}
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
              Vira uma única atividade na agenda do técnico, com o nome do template; as etapas dele aparecem dentro dela, como passos. Sem horário, a atividade fica sem hora marcada.
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
