// Carimbo de localização/data/hora: capturado só no momento da evidência (sem rastreamento contínuo).

const pad = (n) => String(n).padStart(2, '0');

export const formatarDataHora = (data) =>
  `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} ${pad(data.getHours())}:${pad(data.getMinutes())}`;

// Texto impresso no canto da foto: `23/10/2026 14:32 · -23.55050, -46.63330 · ±8 m`
export const textoCarimbo = (data, loc) => {
  const partes = [formatarDataHora(data)];
  if (loc?.status === 'ok') {
    partes.push(`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
    if (loc.precisao != null) partes.push(`±${Math.round(loc.precisao)} m`);
  } else {
    partes.push('localização indisponível');
  }
  return partes.join(' · ');
};

const SEM_LOCALIZACAO = (status) => ({ status, latitude: null, longitude: null, precisao: null });

const permissaoNegada = async () => {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state === 'denied';
  } catch {
    return false;
  }
};

// Nunca rejeita. status: ok | negada | indisponivel | tempo_esgotado | nao_suportado
export async function obterLocalizacao({ timeoutMs = 6000, maxIdadeMs = 120000 } = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return SEM_LOCALIZACAO('nao_suportado');
  if (await permissaoNegada()) return SEM_LOCALIZACAO('negada');

  return new Promise((resolve) => {
    let resolvido = false;
    const fim = (r) => { if (!resolvido) { resolvido = true; resolve(r); } };
    // Rede de segurança: alguns aparelhos nunca chamam o callback se o aviso de permissão ficar aberto
    const guarda = setTimeout(() => fim(SEM_LOCALIZACAO('tempo_esgotado')), timeoutMs + 2000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(guarda);
        fim({
          status: 'ok',
          latitude: Math.round(pos.coords.latitude * 1e6) / 1e6,
          longitude: Math.round(pos.coords.longitude * 1e6) / 1e6,
          precisao: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy * 10) / 10 : null
        });
      },
      (err) => {
        clearTimeout(guarda);
        fim(SEM_LOCALIZACAO(err?.code === 1 ? 'negada' : err?.code === 3 ? 'tempo_esgotado' : 'indisponivel'));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: maxIdadeMs }
    );
  });
}

// Aquece o GPS/permissão quando o técnico toca no botão, antes da câmera abrir
export const aquecerLocalizacao = () => { obterLocalizacao({ timeoutMs: 8000 }); };

// Instante da captura: usa a data do arquivo da câmera quando plausível; senão, agora (relógio do aparelho)
export const instanteDaCaptura = (arquivo) => {
  const agora = Date.now();
  const mod = Number(arquivo?.lastModified);
  if (Number.isFinite(mod) && mod <= agora + 60_000 && agora - mod < 24 * 3600_000) return new Date(Math.min(mod, agora));
  return new Date(agora);
};
