-- 07: auditoria automática, histórico legível, desfazer (rollback) e lixeira de arquivos

CREATE TABLE IF NOT EXISTS public.execucao_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela text NOT NULL,
  registro_id text NOT NULL,
  operacao text NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  depois jsonb,
  campos_alterados text[],
  usuario_id uuid,
  transacao bigint NOT NULL DEFAULT txid_current(),
  contexto text,
  desfeito_em timestamptz,
  desfeito_por uuid,
  desfeito_transacao bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aud_registro ON public.execucao_auditoria (tabela, registro_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_aud_transacao ON public.execucao_auditoria (transacao);
CREATE INDEX IF NOT EXISTS idx_aud_created ON public.execucao_auditoria (created_at DESC);
ALTER TABLE public.execucao_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY aud_admin_select ON public.execucao_auditoria FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_execucao()));

-- Lixeira de arquivos do Storage: caminhos de arquivos cujo registro foi excluído (30 dias de carência)
CREATE TABLE IF NOT EXISTS public.execucao_lixeira_storage (
  bucket text NOT NULL,
  caminho text NOT NULL,
  excluido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, caminho)
);
ALTER TABLE public.execucao_lixeira_storage ENABLE ROW LEVEL SECURITY;
CREATE POLICY lixeira_admin ON public.execucao_lixeira_storage FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));

-- Gatilho de auditoria: nunca bloqueia a gravação (qualquer erro é ignorado)
CREATE OR REPLACE FUNCTION public.execucao_auditar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_antes jsonb; v_depois jsonb; v_base jsonb; v_campos text[]; v_reg text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN v_antes := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN v_depois := to_jsonb(NEW);
    ELSE v_antes := to_jsonb(OLD); v_depois := to_jsonb(NEW); END IF;
    v_base := COALESCE(v_depois, v_antes);
    v_reg := CASE TG_TABLE_NAME
               WHEN 'execucao_atividades_equipe' THEN (v_base ->> 'atividade_id') || ':' || (v_base ->> 'usuario_id')
               ELSE v_base ->> 'id' END;
    IF TG_OP = 'UPDATE' THEN
      SELECT array_agg(k) INTO v_campos FROM jsonb_object_keys(v_depois) k
       WHERE v_depois -> k IS DISTINCT FROM v_antes -> k AND k NOT IN ('updated_at', 'progresso_geral', 'created_at');
      IF v_campos IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
    END IF;
    INSERT INTO public.execucao_auditoria (tabela, registro_id, operacao, antes, depois, campos_alterados, usuario_id, contexto)
    VALUES (TG_TABLE_NAME, v_reg, TG_OP, v_antes, v_depois, v_campos, public.current_usuario_id(),
            NULLIF(current_setting('execucao.contexto', true), ''));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'execucao_obras', 'execucao_obras_etapas', 'execucao_atividades', 'execucao_atividades_equipe',
    'execucao_pedidos_material', 'execucao_pops', 'execucao_pops_arquivos', 'execucao_obras_arquivos',
    'execucao_templates_etapas', 'execucao_templates_etapas_itens', 'execucao_templates_materiais',
    'execucao_jornadas_modelo', 'execucao_ausencias', 'execucao_horas_extras', 'execucao_feriados',
    'execucao_cidades', 'execucao_atividades_evidencias', 'execucao_planejamento_macro'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.execucao_auditar()', t);
  END LOOP;
END $$;

-- Lixeira: registra o arquivo quando o registro some e o remove da lixeira se o registro voltar
CREATE OR REPLACE FUNCTION public.execucao_lixeira_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bucket text; v_row jsonb; v_cam text;
BEGIN
  BEGIN
    v_bucket := CASE TG_TABLE_NAME WHEN 'execucao_obras_arquivos' THEN 'obras-arquivos'
                                   WHEN 'execucao_pops_arquivos' THEN 'pops-arquivos'
                                   ELSE 'atividades-evidencias' END;
    v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    FOREACH v_cam IN ARRAY ARRAY[v_row ->> 'caminho_storage', v_row ->> 'caminho_miniatura'] LOOP
      CONTINUE WHEN v_cam IS NULL;
      IF TG_OP = 'DELETE' THEN
        INSERT INTO public.execucao_lixeira_storage (bucket, caminho) VALUES (v_bucket, v_cam) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.execucao_lixeira_storage WHERE bucket = v_bucket AND caminho = v_cam;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['execucao_obras_arquivos', 'execucao_pops_arquivos', 'execucao_atividades_evidencias'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_lixeira ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_lixeira AFTER INSERT OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.execucao_lixeira_trg()', t);
  END LOOP;
END $$;

-- Arquivos na lixeira há mais de N dias (o app remove do Storage e confirma)
CREATE OR REPLACE FUNCTION public.execucao_lixeira_pendentes(p_dias int DEFAULT 30)
RETURNS TABLE (bucket text, caminho text, excluido_em timestamptz)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT l.bucket, l.caminho, l.excluido_em FROM public.execucao_lixeira_storage l
   WHERE public.is_admin_execucao() AND l.excluido_em < now() - make_interval(days => p_dias)
$$;

CREATE OR REPLACE FUNCTION public.execucao_lixeira_confirmar(p_bucket text, p_caminhos text[]) RETURNS int
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  DELETE FROM public.execucao_lixeira_storage WHERE bucket = p_bucket AND caminho = ANY (p_caminhos);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Retenção do histórico (padrão 12 meses)
CREATE OR REPLACE FUNCTION public.execucao_auditoria_limpar(p_dias int DEFAULT 365) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  DELETE FROM public.execucao_auditoria WHERE created_at < now() - make_interval(days => GREATEST(p_dias, 30));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Resumo legível de uma linha de auditoria
CREATE OR REPLACE FUNCTION public.execucao_resumo_linha(p_tabela text, p_op text, p_antes jsonb, p_depois jsonb,
                                                        p_campos text[], p_itens int, p_obra_nome text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d jsonb := COALESCE(p_depois, p_antes); rot text; nome text; diff text := ''; c text; n int := 0;
  rotulos jsonb := '{"data_inicio":"início","data_fim":"fim","data_programada":"data","status":"status","progresso":"progresso",
    "tecnico_responsavel_id":"técnico","responsavel_id":"responsável","nome":"nome","titulo":"título","horas_previstas":"horas previstas",
    "data_inicio_prevista":"início previsto","data_fim_prevista":"fim previsto","prioridade":"prioridade","endereco":"endereço",
    "horas":"horas","ativo":"ativo","descricao":"descrição","observacoes":"observações"}';
BEGIN
  rot := CASE p_tabela
    WHEN 'execucao_obras' THEN 'a obra' WHEN 'execucao_obras_etapas' THEN 'a etapa' WHEN 'execucao_atividades' THEN 'a atividade'
    WHEN 'execucao_atividades_equipe' THEN 'a equipe da atividade' WHEN 'execucao_pedidos_material' THEN 'o pedido de material'
    WHEN 'execucao_pops' THEN 'o POP' WHEN 'execucao_pops_arquivos' THEN 'um arquivo de POP' WHEN 'execucao_obras_arquivos' THEN 'um arquivo da obra'
    WHEN 'execucao_templates_etapas' THEN 'o template' WHEN 'execucao_templates_etapas_itens' THEN 'um item de template'
    WHEN 'execucao_templates_materiais' THEN 'o template de materiais' WHEN 'execucao_jornadas_modelo' THEN 'o modelo de jornada'
    WHEN 'execucao_ausencias' THEN 'a ausência' WHEN 'execucao_horas_extras' THEN 'o registro de hora extra'
    WHEN 'execucao_feriados' THEN 'o feriado' WHEN 'execucao_cidades' THEN 'a cidade'
    WHEN 'execucao_atividades_evidencias' THEN 'uma evidência' ELSE 'um registro' END;
  nome := COALESCE(d ->> 'nome_cliente', d ->> 'titulo', d ->> 'nome', d ->> 'descricao', d ->> 'data', '');
  IF p_op = 'INSERT' THEN
    RETURN format('Criou %s%s%s', rot, CASE WHEN nome <> '' THEN ' "' || left(nome, 60) || '"' ELSE '' END,
                  CASE WHEN p_obra_nome IS NOT NULL AND p_tabela <> 'execucao_obras' THEN ' · obra ' || p_obra_nome ELSE '' END);
  ELSIF p_op = 'DELETE' THEN
    RETURN format('Excluiu %s%s%s%s', rot, CASE WHEN nome <> '' THEN ' "' || left(nome, 60) || '"' ELSE '' END,
                  CASE WHEN p_obra_nome IS NOT NULL AND p_tabela <> 'execucao_obras' THEN ' · obra ' || p_obra_nome ELSE '' END,
                  CASE WHEN p_itens > 1 THEN ' (e ' || (p_itens - 1) || ' item(ns) relacionado(s))' ELSE '' END);
  END IF;
  FOREACH c IN ARRAY COALESCE(p_campos, '{}') LOOP
    n := n + 1; EXIT WHEN n > 3;
    diff := diff || CASE WHEN diff = '' THEN '' ELSE '; ' END
         || COALESCE(rotulos ->> c, c) || ' ' || left(COALESCE(p_antes ->> c, '—'), 30) || ' → ' || left(COALESCE(p_depois ->> c, '—'), 30);
  END LOOP;
  RETURN format('Alterou %s%s%s: %s%s', rot, CASE WHEN nome <> '' THEN ' "' || left(nome, 60) || '"' ELSE '' END,
                CASE WHEN p_obra_nome IS NOT NULL AND p_tabela <> 'execucao_obras' THEN ' · obra ' || p_obra_nome ELSE '' END,
                diff, CASE WHEN p_itens > 1 THEN ' (e ' || (p_itens - 1) || ' alteração(ões) relacionada(s))' ELSE '' END);
END $$;

-- Histórico agrupado por ação (transação)
CREATE OR REPLACE FUNCTION public.execucao_listar_historico(
  p_obra uuid DEFAULT NULL, p_usuario uuid DEFAULT NULL, p_tabela text DEFAULT NULL,
  p_inicio date DEFAULT NULL, p_fim date DEFAULT NULL, p_busca text DEFAULT NULL,
  p_limite int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS TABLE (transacao bigint, quando timestamptz, usuario_id uuid, usuario_nome text, tabelas text[], itens int,
               obra_id uuid, obra_nome text, resumo text, desfeito boolean, desfazivel boolean, contexto text)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH linhas AS (
    SELECT a.*,
      CASE a.tabela
        WHEN 'execucao_obras' THEN a.registro_id::uuid
        WHEN 'execucao_obras_etapas' THEN (COALESCE(a.depois, a.antes) ->> 'obra_id')::uuid
        WHEN 'execucao_pedidos_material' THEN (COALESCE(a.depois, a.antes) ->> 'obra_id')::uuid
        WHEN 'execucao_obras_arquivos' THEN (COALESCE(a.depois, a.antes) ->> 'obra_id')::uuid
        WHEN 'execucao_atividades' THEN (SELECT e.obra_id FROM public.execucao_obras_etapas e
                                          WHERE e.id = (COALESCE(a.depois, a.antes) ->> 'etapa_id')::uuid)
      END AS obra
      FROM public.execucao_auditoria a
     WHERE public.is_admin_execucao()
       AND (p_inicio IS NULL OR a.created_at >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'))
       AND (p_fim IS NULL OR a.created_at < ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
       AND (p_usuario IS NULL OR a.usuario_id = p_usuario)
       AND (p_tabela IS NULL OR a.tabela = p_tabela)
  ), grp AS (
    SELECT l.transacao, min(l.id) AS primeiro, max(l.created_at) AS quando, (array_agg(l.usuario_id) FILTER (WHERE l.usuario_id IS NOT NULL))[1] AS usuario,
           array_agg(DISTINCT l.tabela) AS tabelas, count(*)::int AS itens, (array_agg(l.obra) FILTER (WHERE l.obra IS NOT NULL))[1] AS obra,
           bool_and(l.desfeito_em IS NOT NULL) AS desfeito, max(l.contexto) AS contexto
      FROM linhas l GROUP BY l.transacao
  )
  SELECT g.transacao, g.quando, g.usuario, u.nome_completo::text, g.tabelas, g.itens, g.obra, ob.nome, rs.resumo,
         g.desfeito, (g.quando > now() - interval '30 days') AND NOT g.desfeito, g.contexto
    FROM grp g
    JOIN public.execucao_auditoria p ON p.id = g.primeiro
    LEFT JOIN public.usuarios u ON u.id = g.usuario
    LEFT JOIN LATERAL (SELECT COALESCE(
        (SELECT o.nome_cliente::text FROM public.execucao_obras o WHERE o.id = g.obra),
        (SELECT d.antes ->> 'nome_cliente' FROM public.execucao_auditoria d
          WHERE d.tabela = 'execucao_obras' AND d.registro_id = g.obra::text AND d.operacao = 'DELETE' ORDER BY d.id DESC LIMIT 1)) AS nome) ob ON true
    CROSS JOIN LATERAL (SELECT public.execucao_resumo_linha(p.tabela, p.operacao, p.antes, p.depois, p.campos_alterados, g.itens, ob.nome) AS resumo) rs
   WHERE (p_obra IS NULL OR g.obra = p_obra)
     AND (COALESCE(p_busca, '') = '' OR public.execucao_norm(rs.resumo) LIKE '%' || public.execucao_norm(p_busca) || '%'
          OR public.execucao_norm(COALESCE(u.nome_completo, '')) LIKE '%' || public.execucao_norm(p_busca) || '%')
   ORDER BY g.quando DESC
   LIMIT GREATEST(p_limite, 1) OFFSET GREATEST(p_offset, 0)
$$;

-- Desfazer uma ação inteira (todas as linhas da mesma transação), com checagem de conflito
CREATE OR REPLACE FUNCTION public.execucao_desfazer(p_transacao bigint, p_forcar boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public.current_usuario_id();
  r record; v_conflitos jsonb := '[]'::jsonb; v_cols text; v_pend jsonb := '[]'::jsonb; v_item jsonb;
  v_desfeitas int := 0; v_restauradas int := 0; v_pass int := 0; v_progresso boolean; v_novo jsonb;
  v_chaves text[];
BEGIN
  IF NOT public.is_admin_execucao() OR v_uid IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.execucao_auditoria WHERE transacao = p_transacao AND desfeito_em IS NULL) THEN
    RAISE EXCEPTION 'Esta ação não existe ou já foi desfeita';
  END IF;
  IF EXISTS (SELECT 1 FROM public.execucao_auditoria WHERE transacao = p_transacao AND created_at < now() - interval '30 days') THEN
    RAISE EXCEPTION 'O prazo de 30 dias para desfazer esta ação terminou';
  END IF;

  -- Conflito: o mesmo registro foi alterado depois, por outra ação
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tabela', c.tabela, 'registro_id', c.registro_id, 'quando', c.created_at,
           'usuario_id', c.usuario_id, 'operacao', c.operacao)), '[]'::jsonb)
    INTO v_conflitos
    FROM (SELECT DISTINCT ON (a2.tabela, a2.registro_id) a2.tabela, a2.registro_id, a2.created_at, a2.usuario_id, a2.operacao
            FROM public.execucao_auditoria a1
            JOIN public.execucao_auditoria a2 ON a2.tabela = a1.tabela AND a2.registro_id = a1.registro_id
                                             AND a2.transacao <> p_transacao AND a2.id > a1.id
           WHERE a1.transacao = p_transacao AND a1.desfeito_em IS NULL
           ORDER BY a2.tabela, a2.registro_id, a2.id DESC) c;
  IF jsonb_array_length(v_conflitos) > 0 AND NOT p_forcar THEN
    RETURN jsonb_build_object('ok', false, 'conflitos', v_conflitos);
  END IF;

  PERFORM set_config('execucao.contexto', 'desfazer', true);

  -- Fase 1: recriar registros excluídos (várias passadas por causa das chaves estrangeiras)
  FOR r IN SELECT * FROM public.execucao_auditoria WHERE transacao = p_transacao AND desfeito_em IS NULL AND operacao = 'DELETE' ORDER BY id LOOP
    v_pend := v_pend || jsonb_build_array(jsonb_build_object('tabela', r.tabela, 'antes', r.antes));
  END LOOP;
  WHILE jsonb_array_length(v_pend) > 0 AND v_pass < 12 LOOP
    v_pass := v_pass + 1; v_progresso := false; v_novo := '[]'::jsonb;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_pend) LOOP
      BEGIN
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', v_item ->> 'tabela', v_item ->> 'tabela')
          USING (v_item -> 'antes');
        v_restauradas := v_restauradas + 1; v_progresso := true;
      EXCEPTION
        WHEN unique_violation THEN v_progresso := true;                   -- já existe (ex.: líder recriado por gatilho)
        WHEN foreign_key_violation THEN v_novo := v_novo || jsonb_build_array(v_item);  -- tenta de novo depois do pai
      END;
    END LOOP;
    v_pend := v_novo;
    EXIT WHEN NOT v_progresso;
  END LOOP;
  IF jsonb_array_length(v_pend) > 0 THEN
    RAISE EXCEPTION 'Não foi possível restaurar % registro(s): dependências ausentes', jsonb_array_length(v_pend);
  END IF;

  -- Fase 2: inverter inclusões e alterações, da mais recente para a mais antiga
  FOR r IN SELECT * FROM public.execucao_auditoria WHERE transacao = p_transacao AND desfeito_em IS NULL AND operacao <> 'DELETE' ORDER BY id DESC LOOP
    IF r.tabela = 'execucao_atividades_equipe' THEN
      v_chaves := string_to_array(r.registro_id, ':');
      IF r.operacao = 'INSERT' THEN
        DELETE FROM public.execucao_atividades_equipe WHERE atividade_id = v_chaves[1]::uuid AND usuario_id = v_chaves[2]::uuid;
      ELSE
        UPDATE public.execucao_atividades_equipe SET papel = r.antes ->> 'papel', horas_previstas = (r.antes ->> 'horas_previstas')::numeric
         WHERE atividade_id = v_chaves[1]::uuid AND usuario_id = v_chaves[2]::uuid;
      END IF;
    ELSIF r.operacao = 'INSERT' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id = $1', r.tabela) USING r.registro_id::uuid;
    ELSE
      SELECT string_agg(format('%I', k), ', ') INTO v_cols FROM unnest(r.campos_alterados) k;
      EXECUTE format('UPDATE public.%I t SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE t.id = $2',
                     r.tabela, v_cols, v_cols, r.tabela) USING r.antes, r.registro_id::uuid;
    END IF;
    v_desfeitas := v_desfeitas + 1;
  END LOOP;

  UPDATE public.execucao_auditoria SET desfeito_em = now(), desfeito_por = v_uid, desfeito_transacao = txid_current()
   WHERE transacao = p_transacao AND desfeito_em IS NULL;

  RETURN jsonb_build_object('ok', true, 'desfeitas', v_desfeitas, 'restauradas', v_restauradas, 'conflitos', v_conflitos);
END $$;

REVOKE ALL ON FUNCTION public.execucao_auditar(), public.execucao_lixeira_trg(), public.execucao_sync_lider() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.execucao_lixeira_pendentes(int), public.execucao_lixeira_confirmar(text, text[]),
  public.execucao_auditoria_limpar(int), public.execucao_resumo_linha(text, text, jsonb, jsonb, text[], int, text),
  public.execucao_listar_historico(uuid, uuid, text, date, date, text, int, int), public.execucao_desfazer(bigint, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_lixeira_pendentes(int), public.execucao_lixeira_confirmar(text, text[]),
  public.execucao_auditoria_limpar(int), public.execucao_resumo_linha(text, text, jsonb, jsonb, text[], int, text),
  public.execucao_listar_historico(uuid, uuid, text, date, date, text, int, int), public.execucao_desfazer(bigint, boolean)
  TO authenticated;
