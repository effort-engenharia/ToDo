import React, { useCallback, useMemo, useState } from 'react';
import { FaBox, FaMagic } from 'react-icons/fa';
import { execucaoService } from '../../../services/supabase/execucao';
import { useAsyncData } from '../hooks/useAsyncData';
import { useExecucaoUI } from './ui/ExecucaoUI';
import { Carregando, ErroCarregamento } from './ui/Estados';
import AlertaEdicaoPedido from './pedido-material/AlertaEdicaoPedido';
import FormularioPedido from './pedido-material/FormularioPedido';
import HistoricoPedido from './pedido-material/HistoricoPedido';
import ListaPedidos from './pedido-material/ListaPedidos';
import ListasObrasPendentes from './pedido-material/ListasObrasPendentes';
import TemplatesMateriais from './pedido-material/TemplatesMateriais';
import { itensComKey, novoItem } from './pedido-material/utils';

const VALORES_VAZIOS = () => ({
  descricao: '',
  urgencia: 'normal',
  itens: [novoItem()],
  observacoes: '',
  data_material_disponivel: ''
});

const valoresDoPedido = (pedido, { exigirNome = false, novaData = null } = {}) => {
  const temItens = Array.isArray(pedido.itens) && pedido.itens.length > 0 &&
    (!exigirNome || pedido.itens.some((i) => i.nome));

  return {
    descricao: pedido.descricao || '',
    urgencia: pedido.urgencia || 'normal',
    itens: temItens ? itensComKey(pedido.itens) : [novoItem()],
    observacoes: pedido.observacoes || '',
    data_material_disponivel: novaData || pedido.data_material_disponivel || ''
  };
};

const PedidoMaterial = ({ usuario }) => {
  const { toast } = useExecucaoUI();
  const [abaAtiva, setAbaAtiva] = useState('pedidos'); // 'pedidos' ou 'templates'

  const {
    data: pedidosData,
    loading: carregandoPedidos,
    error: erroPedidos,
    reload: recarregarPedidos
  } = useAsyncData(() => execucaoService.buscarPedidosMaterial(), []);

  const {
    data: templatesData,
    loading: carregandoTemplates,
    error: erroTemplates,
    reload: recarregarTemplates
  } = useAsyncData(() => execucaoService.buscarTemplatesMateriais(), [], { initialData: [] });

  const pedidos = useMemo(() => pedidosData ?? [], [pedidosData]);
  const templates = useMemo(() => templatesData ?? [], [templatesData]);

  const [formulario, setFormulario] = useState(null); // { pedido, valores, dataDefinidaPeloAlerta }
  const [pedidoParaAlerta, setPedidoParaAlerta] = useState(null);
  const [historico, setHistorico] = useState(null); // { pedido, itens }

  const fecharFormulario = useCallback(() => setFormulario(null), []);
  const fecharAlerta = useCallback(() => setPedidoParaAlerta(null), []);
  const fecharHistorico = useCallback(() => setHistorico(null), []);

  const { listasObrasPendentes, pedidosNormais } = useMemo(() => {
    const pendentes = [];
    const normais = [];
    for (const p of pedidos) {
      const semItens = !p.itens || p.itens.length === 0 || p.itens.every((i) => !i.nome);
      if (p.obra_id && semItens && p.status !== 'entregue') pendentes.push(p);
      if (!p.obra_id || (p.itens?.length > 0 && p.itens.some((i) => i.nome))) normais.push(p);
    }
    return { listasObrasPendentes: pendentes, pedidosNormais: normais };
  }, [pedidos]);

  const handleNovoPedido = () => {
    setFormulario({ pedido: null, valores: VALORES_VAZIOS(), dataDefinidaPeloAlerta: false });
  };

  const handleAbrirListaObra = (pedido) => {
    setFormulario({
      pedido,
      valores: valoresDoPedido(pedido, { exigirNome: true }),
      dataDefinidaPeloAlerta: false
    });
  };

  // Pedido que já tem data limite exige confirmação e nova data antes da edição
  const handleEditar = (pedido) => {
    if (pedido.id && pedido.data_material_disponivel) {
      setPedidoParaAlerta(pedido);
    } else {
      setFormulario({ pedido, valores: valoresDoPedido(pedido), dataDefinidaPeloAlerta: false });
    }
  };

  const handleConfirmarEdicao = (novaData) => {
    const pedido = pedidoParaAlerta;
    setPedidoParaAlerta(null);
    setFormulario({
      pedido,
      valores: valoresDoPedido(pedido, { novaData }),
      dataDefinidaPeloAlerta: true
    });
  };

  const handleVerHistorico = async (pedido) => {
    try {
      const result = await execucaoService.buscarHistoricoPedido(pedido.id);
      if (!result?.success) {
        toast.error(result?.message || 'Não foi possível carregar o histórico.');
        return;
      }
      setHistorico({ pedido, itens: result.data || [] });
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error(error.message || 'Não foi possível carregar o histórico.');
    }
  };

  const handleSalvo = () => {
    setFormulario(null);
    recarregarPedidos();
  };

  // pedidosData só é null antes da primeira resposta; recargas não desmontam a tela (nem os modais)
  const primeiraCarga = pedidosData === null;
  if (carregandoPedidos && primeiraCarga) return <Carregando />;
  if (erroPedidos && primeiraCarga) {
    return <ErroCarregamento mensagem={erroPedidos} onTentarNovamente={recarregarPedidos} />;
  }

  return (
    <div className="execucao-animate-fade-in">
      <div className="execucao-tabs mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'pedidos'}
          className={`execucao-tab ${abaAtiva === 'pedidos' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('pedidos')}
        >
          <FaBox className="mr-2" aria-hidden="true" />
          Pedidos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'templates'}
          className={`execucao-tab ${abaAtiva === 'templates' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('templates')}
        >
          <FaMagic className="mr-2" aria-hidden="true" />
          Templates
          <span className="ml-2 bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full text-xs">
            {templates.length}
          </span>
        </button>
      </div>

      {abaAtiva === 'templates' && (
        <TemplatesMateriais
          templates={templates}
          loading={carregandoTemplates}
          error={erroTemplates}
          usuario={usuario}
          onRecarregar={recarregarTemplates}
        />
      )}

      {abaAtiva === 'pedidos' && (
        <>
          {erroPedidos && (
            <div className="mb-4">
              <ErroCarregamento mensagem={erroPedidos} onTentarNovamente={recarregarPedidos} />
            </div>
          )}
          <ListasObrasPendentes listas={listasObrasPendentes} onPreencher={handleAbrirListaObra} />
          <ListaPedidos
            pedidos={pedidosNormais}
            onNovo={handleNovoPedido}
            onEditar={handleEditar}
            onHistorico={handleVerHistorico}
          />
        </>
      )}

      {formulario && (
        <FormularioPedido
          pedido={formulario.pedido}
          valoresIniciais={formulario.valores}
          dataDefinidaPeloAlerta={formulario.dataDefinidaPeloAlerta}
          templates={templates}
          usuario={usuario}
          onClose={fecharFormulario}
          onSalvo={handleSalvo}
          onRecarregar={recarregarPedidos}
          onTemplatesAlterados={recarregarTemplates}
        />
      )}

      {pedidoParaAlerta && (
        <AlertaEdicaoPedido
          pedido={pedidoParaAlerta}
          onConfirmar={handleConfirmarEdicao}
          onClose={fecharAlerta}
        />
      )}

      {historico && (
        <HistoricoPedido
          pedido={historico.pedido}
          historico={historico.itens}
          onClose={fecharHistorico}
        />
      )}
    </div>
  );
};

export default PedidoMaterial;
