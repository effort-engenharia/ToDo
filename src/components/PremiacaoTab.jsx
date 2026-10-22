import React, { useEffect, useMemo, useState } from 'react';
import { FaTrophy, FaSave, FaPlus, FaTrash, FaClock, FaUser } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { premiacaoService } from '../services/supabase/premiacao';
import {
  CLASSIFICACOES,
  ROTULOS_CLASSIFICACAO,
  MODOS_COMISSAO_PJ,
  mesclarConfigPremiacao,
} from '../config/premiacao';
import { normalizarNome } from '../utils/premiacao';
import { mesComercialAtual, rotuloMesComercial } from '../utils/periodoComercial';
import { formatCurrency } from '../utils/formatters';
import { effortColors } from '../utils/effortTheme';
import { EVENTO_PREMIACAO_ATUALIZADA } from '../features/dashboard/hooks/usePremiacao';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400';

const Secao = ({ titulo, descricao, children }) => (
  <section className="p-4 rounded-xl border border-gray-200 bg-white">
    <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
    {descricao && <p className="text-xs text-gray-500 mt-0.5 mb-3">{descricao}</p>}
    {children}
  </section>
);

const CampoValor = ({ label, value, onChange, step = '0.01', min = '0', sufixo }) => (
  <label className="block">
    <span className="text-xs text-gray-600">{label}</span>
    <div className="flex items-center gap-1 mt-1">
      <input
        type="number"
        step={step}
        min={min}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={inputCls}
      />
      {sufixo && <span className="text-xs text-gray-500">{sufixo}</span>}
    </div>
  </label>
);

const PremiacaoTab = () => {
  const { usuario, isAdmin } = useAuth();
  const admin = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const autor = usuario?.nome_completo || usuario?.email || null;

  const atual = mesComercialAtual();
  const [ano, setAno] = useState(atual.ano);
  const [mes, setMes] = useState(atual.mes);

  const [config, setConfig] = useState(null);
  const [info, setInfo] = useState({ atualizadoEm: null, atualizadoPor: null });
  const [nomes, setNomes] = useState([]);
  const [metas, setMetas] = useState({ base: '', ideal: '', plus: '' });
  const [sugestaoIdeal, setSugestaoIdeal] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const avisar = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [cfg, lista] = await Promise.all([
          premiacaoService.obterConfig(),
          premiacaoService.listarNomesVendedores(),
        ]);
        if (cancelado) return;
        setConfig(cfg.config);
        setInfo({ atualizadoEm: cfg.atualizadoEm, atualizadoPor: cfg.atualizadoPor });
        setNomes(lista);
      } catch (e) {
        if (!cancelado) avisar('erro', e.message || 'Erro ao carregar configuração.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const m = await premiacaoService.buscarMetas(ano, mes + 1);
        if (cancelado) return;
        setSugestaoIdeal(m.sugestaoIdeal);
        setMetas({
          base: m.base || '',
          ideal: m.ideal || m.sugestaoIdeal || '',
          plus: m.plus || '',
        });
      } catch (e) {
        if (!cancelado) avisar('erro', e.message || 'Erro ao carregar metas do mês.');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ano, mes]);

  const todosNomes = useMemo(() => {
    const set = new Set(nomes);
    Object.keys(config?.vendedores || {}).forEach((n) => set.add(normalizarNome(n)));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [nomes, config]);

  const tipoDe = (nome) => {
    const entrada = Object.entries(config?.vendedores || {}).find(([k]) => normalizarNome(k) === nome);
    return entrada ? entrada[1] : CLASSIFICACOES.NAO_CLASSIFICADO;
  };

  const qtdEfetivos = todosNomes.filter((n) => tipoDe(n) === CLASSIFICACOES.EFETIVO).length;
  const metaIndividualPrevia = qtdEfetivos > 0 && Number(metas.ideal) > 0 ? Number(metas.ideal) / qtdEfetivos : 0;

  const alterar = (patch) => setConfig((c) => ({ ...c, ...patch }));

  const alterarTipo = (nome, tipo) => {
    setConfig((c) => {
      const vendedores = {};
      Object.entries(c.vendedores || {}).forEach(([k, v]) => {
        if (normalizarNome(k) !== nome) vendedores[k] = v;
      });
      if (tipo !== CLASSIFICACOES.NAO_CLASSIFICADO) vendedores[nome] = tipo;
      return { ...c, vendedores };
    });
  };

  const alterarFaixa = (idx, patch) => {
    setConfig((c) => {
      const faixas = c.comissaoPJ.faixas.map((f, i) => (i === idx ? { ...f, ...patch } : f));
      return { ...c, comissaoPJ: { ...c.comissaoPJ, faixas } };
    });
  };

  const validarConfig = (c) => {
    const p = c.premios;
    if (![p.base, p.ideal, p.ideal_plus].every((v) => Number(v) >= 0)) return 'Prêmios devem ser ≥ 0.';
    if (!(Number(p.base) <= Number(p.ideal) && Number(p.ideal) <= Number(p.ideal_plus))) {
      return 'Os prêmios devem ser crescentes: Meta Base ≤ Meta Ideal ≤ Meta Ideal Plus.';
    }
    const col = Number(c.distribuicao.coletivo);
    if (!(col >= 0 && col <= 1)) return 'A parcela coletiva deve estar entre 0% e 100%.';
    if (!(Number(c.gatilhoBasePct) >= 0)) return 'O gatilho da Meta Base deve ser ≥ 0%.';
    const faixas = c.comissaoPJ.faixas;
    for (let i = 0; i < faixas.length; i++) {
      const f = faixas[i];
      if (!(Number(f.pct) >= 0)) return `Faixa ${i + 1}: alíquota inválida.`;
      const ultima = i === faixas.length - 1;
      if (ultima && f.ate != null && f.ate !== '') return 'A última faixa deve ficar sem limite ("sem teto").';
      if (!ultima) {
        if (!(Number(f.ate) > 0)) return `Faixa ${i + 1}: limite "até" obrigatório.`;
        if (i > 0 && !(Number(f.ate) > Number(faixas[i - 1].ate))) return `Faixa ${i + 1}: limite deve ser maior que o da faixa anterior.`;
      }
    }
    return null;
  };

  const salvarConfig = async () => {
    const c = {
      ...config,
      comissaoPJ: {
        ...config.comissaoPJ,
        faixas: config.comissaoPJ.faixas.map((f, i, arr) => ({
          ate: i === arr.length - 1 ? null : Number(f.ate),
          pct: Number(f.pct),
        })),
      },
    };
    const problema = validarConfig(c);
    if (problema) return avisar('erro', problema);

    setSalvando(true);
    try {
      const salva = await premiacaoService.salvarConfig(c, autor);
      setConfig(mesclarConfigPremiacao(salva));
      setInfo({ atualizadoEm: new Date().toISOString(), atualizadoPor: autor });
      window.dispatchEvent(new CustomEvent(EVENTO_PREMIACAO_ATUALIZADA));
      avisar('ok', 'Configuração de premiação salva.');
    } catch (e) {
      avisar('erro', e.message || 'Erro ao salvar configuração.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarMetas = async () => {
    setSalvando(true);
    try {
      await premiacaoService.salvarMetas(ano, mes + 1, metas, autor);
      window.dispatchEvent(new CustomEvent(EVENTO_PREMIACAO_ATUALIZADA));
      avisar('ok', `Metas de ${MESES[mes]}/${ano} salvas.`);
    } catch (e) {
      avisar('erro', e.message || 'Erro ao salvar metas.');
    } finally {
      setSalvando(false);
    }
  };

  if (!admin) {
    return <p className="text-sm text-gray-500">Apenas administradores podem configurar a premiação.</p>;
  }
  if (carregando || !config) {
    return <p className="text-sm text-gray-500">Carregando configuração de premiação…</p>;
  }

  const anos = [atual.ano - 1, atual.ano, atual.ano + 1];
  const pctColetivo = Math.round(Number(config.distribuicao.coletivo) * 100);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <FaTrophy className="mr-2" style={{ color: effortColors.amareloEffort }} />
          Premiação do time e comissão PJ
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Os cálculos aparecem no Dashboard Comercial (Clássico e Moderno) somente quando a premiação está habilitada.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            msg.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.texto}
        </div>
      )}

      {/* Metas do mês */}
      <Secao
        titulo="Metas do mês comercial"
        descricao="Base da premiação coletiva (soma das entradas líquidas dos vendedores efetivos)."
      >
        <div className="flex flex-wrap gap-3 mb-3">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={`${inputCls} w-auto`}>
            {MESES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className={`${inputCls} w-auto`}>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500 self-center">Período: {rotuloMesComercial(ano, mes)}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CampoValor label="Meta Base (R$)" value={metas.base} onChange={(v) => setMetas((m) => ({ ...m, base: v }))} />
          <CampoValor label="Meta Ideal (R$)" value={metas.ideal} onChange={(v) => setMetas((m) => ({ ...m, ideal: v }))} />
          <CampoValor label="Meta Ideal Plus (R$)" value={metas.plus} onChange={(v) => setMetas((m) => ({ ...m, plus: v }))} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <p className="text-xs text-gray-500">
            {sugestaoIdeal > 0 && <>Meta de entrada atual do mês: {formatCurrency(sugestaoIdeal)}. </>}
            Meta Individual = Meta Ideal ÷ {qtdEfetivos} efetivo(s) ={' '}
            <strong>{formatCurrency(metaIndividualPrevia)}</strong>
          </p>
          <button
            type="button"
            onClick={salvarMetas}
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
          >
            <FaSave /> Salvar metas do mês
          </button>
        </div>
      </Secao>

      {/* Prêmios por nível */}
      <Secao titulo="Prêmio liberado por nível" descricao="Valor total do time, rateado entre os elegíveis.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CampoValor label="Meta Base (R$)" value={config.premios.base} onChange={(v) => alterar({ premios: { ...config.premios, base: v } })} />
          <CampoValor label="Meta Ideal (R$)" value={config.premios.ideal} onChange={(v) => alterar({ premios: { ...config.premios, ideal: v } })} />
          <CampoValor label="Meta Ideal Plus (R$)" value={config.premios.ideal_plus} onChange={(v) => alterar({ premios: { ...config.premios, ideal_plus: v } })} />
        </div>
      </Secao>

      {/* Vendedores */}
      <Secao
        titulo="Classificação dos vendedores"
        descricao="Efetivo: entra no divisor, no coletivo e no rateio. PJ: só comissão por faixa (fora do pódio). Líder/Desligado: fora da premiação."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {todosNomes.map((nome) => (
            <div key={nome} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-sm font-medium text-gray-800 truncate">{nome}</span>
              <select
                value={tipoDe(nome)}
                onChange={(e) => alterarTipo(nome, e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                {Object.values(CLASSIFICACOES).map((t) => (
                  <option key={t} value={t}>{ROTULOS_CLASSIFICACAO[t]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Secao>

      {/* Parâmetros */}
      <Secao titulo="Parâmetros">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CampoValor
            label="Gatilho da Meta Base (% acima da meta)"
            value={config.gatilhoBasePct}
            onChange={(v) => alterar({ gatilhoBasePct: v })}
            sufixo="%"
          />
          <CampoValor
            label={`Parcela coletiva (performance = ${100 - pctColetivo}%)`}
            value={pctColetivo}
            step="1"
            onChange={(v) => alterar({ distribuicao: { coletivo: (Number(v) || 0) / 100, performance: 1 - (Number(v) || 0) / 100 } })}
            sufixo="%"
          />
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Comissão PJ (base: valor bruto dos contratos)</div>
          <label className="block mb-3 max-w-sm">
            <span className="text-xs text-gray-600">Modo de cálculo</span>
            <select
              value={config.comissaoPJ.modo}
              onChange={(e) => alterar({ comissaoPJ: { ...config.comissaoPJ, modo: e.target.value } })}
              className={`${inputCls} mt-1`}
            >
              <option value={MODOS_COMISSAO_PJ.FAIXA_ATINGIDA}>Faixa atingida vale sobre todo o valor</option>
              <option value={MODOS_COMISSAO_PJ.PROGRESSIVA}>Progressiva (cada faixa sobre a sua parte)</option>
            </select>
          </label>
          <div className="space-y-2">
            {config.comissaoPJ.faixas.map((f, i, arr) => {
              const ultima = i === arr.length - 1;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <span className="col-span-2 text-xs text-gray-500 pb-2">Faixa {i + 1}</span>
                  <div className="col-span-4">
                    {ultima ? (
                      <div className="text-xs text-gray-500 pb-2">Sem teto</div>
                    ) : (
                      <CampoValor label="Até (R$)" value={f.ate} onChange={(v) => alterarFaixa(i, { ate: v })} />
                    )}
                  </div>
                  <div className="col-span-4">
                    <CampoValor label="Alíquota" value={f.pct} onChange={(v) => alterarFaixa(i, { pct: v })} sufixo="%" />
                  </div>
                  <div className="col-span-2 pb-1">
                    {!ultima && arr.length > 1 && (
                      <button
                        type="button"
                        onClick={() => alterar({ comissaoPJ: { ...config.comissaoPJ, faixas: arr.filter((_, j) => j !== i) } })}
                        className="p-2 text-red-500 hover:text-red-700"
                        title="Remover faixa"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const arr = config.comissaoPJ.faixas;
              const penultimaAte = arr.length > 1 ? Number(arr[arr.length - 2].ate) || 0 : 0;
              const nova = { ate: penultimaAte + 10000, pct: arr[arr.length - 1]?.pct ?? 0 };
              alterar({ comissaoPJ: { ...config.comissaoPJ, faixas: [...arr.slice(0, -1), nova, arr[arr.length - 1]] } });
            }}
            className="mt-2 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <FaPlus className="w-3 h-3" /> Adicionar faixa
          </button>
        </div>
      </Secao>

      {/* Publicação */}
      <Secao titulo="Publicação">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!config.habilitado}
              onChange={(e) => alterar({ habilitado: e.target.checked })}
            />
            Premiação habilitada no dashboard
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Visível para
            <select
              value={config.visibilidade}
              onChange={(e) => alterar({ visibilidade: e.target.value })}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="admin">Somente administradores (homologação)</option>
              <option value="todos">Todos (cada vendedor vê a própria linha)</option>
            </select>
          </label>
        </div>
      </Secao>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="flex items-center">
            <FaClock className="mr-1 text-gray-400" />
            Última alteração:{' '}
            <strong className="ml-1 text-gray-800">
              {info.atualizadoEm ? new Date(info.atualizadoEm).toLocaleString('pt-BR') : '—'}
            </strong>
          </span>
          <span className="flex items-center">
            <FaUser className="mr-1 text-gray-400" />
            Por: <strong className="ml-1 text-gray-800">{info.atualizadoPor || '—'}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={salvarConfig}
          disabled={salvando}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 disabled:opacity-50 flex items-center gap-2"
          style={{ background: effortColors.amareloEffort }}
        >
          <FaSave /> Salvar configuração
        </button>
      </div>
    </div>
  );
};

export default PremiacaoTab;
