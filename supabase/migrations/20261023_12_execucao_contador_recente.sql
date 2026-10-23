-- 12: o contador de pendências (selo do menu e botão "Nova Obra") considera só contratos recentes (últimos 120 dias
-- ou com início futuro). Contratos antigos continuam na lista e em "Revisar pendentes", mas não inflam o alerta.
CREATE OR REPLACE FUNCTION public.execucao_contar_contratos_pendentes() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
    FROM public.execucao_contratos_pendentes(false, NULL) p
   WHERE COALESCE(p.cronograma_data_inicio, p.created_at::date) >= current_date - 120
$$;
