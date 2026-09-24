import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { premiacaoService } from '../../../services/supabase/premiacao';
import { CLASSIFICACOES } from '../../../config/premiacao';
import { calcularPremiacao, classificar, normalizarNome } from '../../../utils/premiacao';

export const EVENTO_PREMIACAO_ATUALIZADA = 'premiacao-config-updated';

/**
 * Premiação do time + comissão PJ para o mês comercial selecionado.
 * @param {{ data: object[], ano: number, mes: number }} params  mes 0-11 (mês comercial do filtro)
 */
export function usePremiacao({ data, ano, mes }) {
  const { usuario, isAdmin } = useAuth();
  const admin = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const meuNome = normalizarNome(usuario?.nome_vendedor_comercial);

  const [config, setConfig] = useState(null);
  const [metas, setMetas] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const recarregar = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_PREMIACAO_ATUALIZADA, recarregar);
    return () => window.removeEventListener(EVENTO_PREMIACAO_ATUALIZADA, recarregar);
  }, []);

  useEffect(() => {
    let cancelado = false;
    const mesNum = Number(mes);
    const anoNum = Number(ano);
    if (!Number.isInteger(mesNum) || !Number.isInteger(anoNum)) return undefined;

    (async () => {
      setCarregando(true);
      try {
        const { config: cfg } = await premiacaoService.obterConfig();
        if (cancelado) return;
        setConfig(cfg);
        if (!cfg.habilitado) {
          setMetas(null);
        } else {
          const m = await premiacaoService.buscarMetas(anoNum, mesNum + 1);
          if (!cancelado) setMetas(m);
        }
        if (!cancelado) setErro(null);
      } catch (e) {
        console.error('[usePremiacao] Erro ao carregar premiação:', e);
        if (!cancelado) {
          setErro(e?.message || 'Erro ao carregar premiação');
          setConfig(null);
          setMetas(null);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ano, mes, versao]);

  const ativo = !!config?.habilitado && (config.visibilidade === 'todos' || admin);

  const resultado = useMemo(() => {
    if (!ativo || !config) return null;
    return calcularPremiacao({ data: data || [], metas: metas || {}, config });
  }, [ativo, config, metas, data]);

  const classificacaoDe = useCallback(
    (nome) => (config ? classificar(nome, config) : null),
    [config]
  );

  const podeVer = useCallback(
    (nome) => admin || (!!meuNome && normalizarNome(nome) === meuNome),
    [admin, meuNome]
  );

  const meuTipo = config && meuNome ? classificar(meuNome, config) : null;

  return {
    ativo,
    admin,
    carregando,
    erro,
    config,
    metas,
    resultado,
    meuNome,
    meuTipo,
    souEfetivo: meuTipo === CLASSIFICACOES.EFETIVO,
    classificacaoDe,
    podeVer,
  };
}

export default usePremiacao;
