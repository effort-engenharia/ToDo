-- 11: dados mínimos da obra para o técnico (cliente, endereço, contato), sem expor valores do contrato.
-- Técnico não lê execucao_obras (RLS); esta função devolve só o necessário das atividades em que ele participa.
CREATE OR REPLACE FUNCTION public.execucao_contexto_atividades(p_ids uuid[])
RETURNS TABLE (atividade_id uuid, obra_id uuid, nome_cliente text, endereco text, cidade text, contato_cliente text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, o.id, o.nome_cliente, o.endereco, o.cidade, o.contato_cliente
    FROM public.execucao_atividades a
    JOIN public.execucao_obras_etapas e ON e.id = a.etapa_id
    JOIN public.execucao_obras o ON o.id = e.obra_id
   WHERE a.id = ANY (p_ids)
     AND (public.is_admin_execucao() OR a.tecnico_responsavel_id = public.current_usuario_id() OR public.execucao_participa(a.id));
$$;
REVOKE ALL ON FUNCTION public.execucao_contexto_atividades(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_contexto_atividades(uuid[]) TO authenticated;
