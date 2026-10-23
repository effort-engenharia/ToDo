-- 04: cidades, feriados, tipos de serviço, contratos ignorados, equipe, colunas novas (somente aditivo)

-- Normalização de texto (sem maiúsculas/acentos) usada para casar cidades e tipos de serviço do Comercial
CREATE OR REPLACE FUNCTION public.execucao_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(btrim(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')))
$$;

CREATE OR REPLACE FUNCTION public.execucao_pascoa(p_ano int) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
BEGIN
  a := p_ano % 19; b := p_ano / 100; c := p_ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31; dia := ((h + l - 7 * m + 114) % 31) + 1;
  RETURN make_date(p_ano, mes, dia);
END $$;

-- Cidades atendidas
CREATE TABLE IF NOT EXISTS public.execucao_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  uf char(2) NOT NULL DEFAULT 'SP',
  ativa boolean NOT NULL DEFAULT true,
  nome_norm text GENERATED ALWAYS AS (public.execucao_norm(nome)) STORED,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nome_norm, uf)
);
INSERT INTO public.execucao_cidades (nome, uf) VALUES
  ('Guarujá', 'SP'), ('Santos', 'SP'), ('São Vicente', 'SP'),
  ('Praia Grande', 'SP'), ('Bertioga', 'SP'), ('São Sebastião', 'SP')
ON CONFLICT DO NOTHING;

-- Feriados (datas concretas por ano; "recorrente" serve ao botão "copiar para o próximo ano")
CREATE TABLE IF NOT EXISTS public.execucao_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  descricao text NOT NULL,
  abrangencia text NOT NULL CHECK (abrangencia IN ('nacional', 'estadual', 'municipal')),
  uf char(2),
  cidade_id uuid REFERENCES public.execucao_cidades(id) ON DELETE CASCADE,
  recorrente boolean NOT NULL DEFAULT true,
  movel text CHECK (movel IN ('carnaval', 'sexta_santa', 'corpus_christi')),
  considerar_feriado boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CHECK ((abrangencia = 'municipal') = (cidade_id IS NOT NULL)),
  CHECK (abrangencia <> 'estadual' OR uf IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execucao_feriado
  ON public.execucao_feriados (data, abrangencia, COALESCE(uf::text, ''), COALESCE(cidade_id::text, ''), descricao);
CREATE INDEX IF NOT EXISTS idx_execucao_feriados_data ON public.execucao_feriados (data);

DO $$
DECLARE ano int; pascoa date;
BEGIN
  FOR ano IN 2026..2032 LOOP
    pascoa := public.execucao_pascoa(ano);
    INSERT INTO public.execucao_feriados (data, descricao, abrangencia, uf, recorrente, movel, considerar_feriado) VALUES
      (make_date(ano, 1, 1),   'Confraternização Universal', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 4, 21),  'Tiradentes', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 5, 1),   'Dia do Trabalho', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 9, 7),   'Independência do Brasil', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 10, 12), 'Nossa Senhora Aparecida', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 11, 2),  'Finados', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 11, 15), 'Proclamação da República', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 11, 20), 'Consciência Negra', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 12, 25), 'Natal', 'nacional', NULL, true, NULL, true),
      (make_date(ano, 7, 9),   'Revolução Constitucionalista', 'estadual', 'SP', true, NULL, true),
      (pascoa - 2,             'Sexta-feira Santa', 'nacional', NULL, false, 'sexta_santa', true),
      (pascoa - 48,            'Carnaval (segunda)', 'nacional', NULL, false, 'carnaval', false),
      (pascoa - 47,            'Carnaval (terça)', 'nacional', NULL, false, 'carnaval', false),
      (pascoa + 60,            'Corpus Christi', 'nacional', NULL, false, 'corpus_christi', false)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.execucao_eh_feriado(p_data date, p_cidade uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.execucao_feriados f
     WHERE f.data = p_data AND f.considerar_feriado
       AND (f.abrangencia = 'nacional'
         OR (f.abrangencia = 'estadual' AND f.uf = COALESCE((SELECT c.uf FROM public.execucao_cidades c WHERE c.id = p_cidade), 'SP'))
         OR (f.abrangencia = 'municipal' AND f.cidade_id = p_cidade)))
$$;

CREATE OR REPLACE FUNCTION public.execucao_dia_util(p_data date, p_cidade uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXTRACT(ISODOW FROM p_data) BETWEEN 1 AND 5 AND NOT public.execucao_eh_feriado(p_data, p_cidade)
$$;

CREATE OR REPLACE FUNCTION public.execucao_add_dias_uteis(p_data date, p_n int, p_cidade uuid DEFAULT NULL) RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE d date := p_data; restante int := abs(coalesce(p_n, 0)); passo int := CASE WHEN coalesce(p_n, 0) < 0 THEN -1 ELSE 1 END; guarda int := 0;
BEGIN
  WHILE restante > 0 AND guarda < 3660 LOOP
    d := d + passo; guarda := guarda + 1;
    IF public.execucao_dia_util(d, p_cidade) THEN restante := restante - 1; END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.execucao_dias_uteis_entre(p_inicio date, p_fim date, p_cidade uuid DEFAULT NULL) RETURNS int
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::int FROM generate_series(p_inicio, p_fim, interval '1 day') g(d)
   WHERE public.execucao_dia_util(g.d::date, p_cidade)
$$;

-- Tipos de serviço (mapeiam o tipo_oportunidade do Comercial)
CREATE TABLE IF NOT EXISTS public.execucao_tipos_servico (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  modalidade text NOT NULL CHECK (modalidade IN ('servico', 'obra')),
  equipe_responsavel text NOT NULL DEFAULT 'execucao' CHECK (equipe_responsavel IN ('execucao', 'orcamentos')),
  tipo_obra text NOT NULL DEFAULT 'eletrica' CHECK (tipo_obra IN ('eletrica', 'civil', 'galpao', 'misto')),
  template_padrao_id uuid REFERENCES public.execucao_templates_etapas(id) ON DELETE SET NULL,
  termos_comercial text[] NOT NULL DEFAULT '{}',   -- sempre normalizados (execucao_norm)
  evidencias_minimas int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);
INSERT INTO public.execucao_tipos_servico (codigo, nome, modalidade, equipe_responsavel, tipo_obra, termos_comercial, evidencias_minimas) VALUES
  ('medicao_ohmica', 'Medição Ôhmica', 'servico', 'execucao', 'eletrica', ARRAY['medicao ohmica'], 2),
  ('laudos', 'Laudos', 'servico', 'orcamentos', 'eletrica', ARRAY['laudos', 'laudo'], 0),
  ('spda', 'SPDA', 'obra', 'execucao', 'eletrica', ARRAY['spda'], 2),
  ('adequacao_eletrica', 'Adequação Elétrica', 'obra', 'execucao', 'eletrica', ARRAY['adequacao eletrica'], 0),
  ('estacao_recarga', 'Estação de Recarga', 'obra', 'execucao', 'eletrica', ARRAY['estacao de recarga'], 0),
  ('quadros_bomba', 'Quadros de Bomba', 'obra', 'execucao', 'eletrica', ARRAY['quadros de bomba', 'quadro de bomba'], 0),
  ('quadro_disjuntores', 'Quadro de Disjuntores', 'obra', 'execucao', 'eletrica', ARRAY['quadro de disjuntores', 'quadros de disjuntores'], 0),
  ('quadro_elevador', 'Quadro de Elevador', 'obra', 'execucao', 'eletrica', ARRAY['quadro de elevador'], 0),
  ('civil', 'Civil', 'obra', 'execucao', 'civil', ARRAY['civil'], 0),
  ('manutencao_eletrica', 'Manutenção Elétrica', 'obra', 'execucao', 'eletrica', ARRAY['manutencao eletrica', 'manutencoes eletricas'], 0),
  ('projetos_eletricos', 'Projetos Elétricos', 'obra', 'execucao', 'eletrica', ARRAY['projetos eletricos'], 0),
  ('entrada_energia', 'Entrada de Energia', 'obra', 'execucao', 'eletrica', ARRAY['entrada de energia'], 0),
  ('prumadas', 'Prumadas', 'obra', 'execucao', 'eletrica', ARRAY['prumadas'], 0),
  ('centro_medicao', 'Centro de Medição', 'obra', 'execucao', 'eletrica', ARRAY['centro de medicao', 'cm'], 0),
  ('cabine_primaria', 'Cabine Primária', 'obra', 'execucao', 'eletrica', ARRAY['cabine primaria'], 0),
  ('avcb', 'AVCB', 'obra', 'execucao', 'eletrica', ARRAY['avcb'], 0),
  ('iluminacao', 'Sistema de Iluminação', 'obra', 'execucao', 'eletrica', ARRAY['sistema de iluminacao'], 0)
ON CONFLICT (codigo) DO NOTHING;

-- Contratos que o admin decidiu não planejar
CREATE TABLE IF NOT EXISTS public.execucao_contratos_ignorados (
  apontamento_id uuid PRIMARY KEY REFERENCES public.apontamentos_comerciais(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  ignorado_por uuid REFERENCES public.usuarios(id),
  created_at timestamptz DEFAULT now()
);

-- Colunas novas (todas opcionais: o app atual continua funcionando)
ALTER TABLE public.execucao_obras
  ADD COLUMN IF NOT EXISTS cidade_id uuid REFERENCES public.execucao_cidades(id),
  ADD COLUMN IF NOT EXISTS tipo_servico_codigo text REFERENCES public.execucao_tipos_servico(codigo),
  ADD COLUMN IF NOT EXISTS rapido boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_obra_apontamento ON public.execucao_obras (apontamento_id) WHERE apontamento_id IS NOT NULL;

ALTER TABLE public.execucao_templates_etapas
  ADD COLUMN IF NOT EXISTS tipo_servico_codigo text REFERENCES public.execucao_tipos_servico(codigo);
ALTER TABLE public.execucao_templates_etapas_itens
  ADD COLUMN IF NOT EXISTS horas_previstas numeric(6,2),
  ADD COLUMN IF NOT EXISTS qtd_tecnicos int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pop_id uuid REFERENCES public.execucao_pops(id) ON DELETE SET NULL;

ALTER TABLE public.execucao_obras_etapas
  ADD COLUMN IF NOT EXISTS horas_previstas numeric(6,2),
  ADD COLUMN IF NOT EXISTS qtd_tecnicos int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS equipe_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_inicio_real date,
  ADD COLUMN IF NOT EXISTS data_fim_real date,
  ADD COLUMN IF NOT EXISTS pop_id uuid REFERENCES public.execucao_pops(id) ON DELETE SET NULL;

ALTER TABLE public.execucao_atividades
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS horas_previstas numeric(6,2),
  ADD COLUMN IF NOT EXISTS horas_realizadas numeric(6,2),
  ADD COLUMN IF NOT EXISTS horas_ajustadas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicita_replanejamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replanejamento_resolvido_em timestamptz,
  ADD COLUMN IF NOT EXISTS inicio_real_em timestamptz,
  ADD COLUMN IF NOT EXISTS fim_real_em timestamptz;
ALTER TABLE public.execucao_atividades
  DROP CONSTRAINT IF EXISTS execucao_atividades_data_fim_check;
ALTER TABLE public.execucao_atividades
  ADD CONSTRAINT execucao_atividades_data_fim_check CHECK (data_fim IS NULL OR data_fim >= data_programada);

ALTER TABLE public.execucao_atividades_historico
  ADD COLUMN IF NOT EXISTS motivo_codigo text;

-- Equipe da atividade (líder + apoios)
CREATE TABLE IF NOT EXISTS public.execucao_atividades_equipe (
  atividade_id uuid NOT NULL REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  papel text NOT NULL DEFAULT 'apoio' CHECK (papel IN ('lider', 'apoio')),
  horas_previstas numeric(6,2),
  PRIMARY KEY (atividade_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_equipe_usuario ON public.execucao_atividades_equipe (usuario_id);

CREATE OR REPLACE FUNCTION public.execucao_participa(p_atividade uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.execucao_atividades_equipe e
                  WHERE e.atividade_id = p_atividade AND e.usuario_id = public.current_usuario_id())
$$;

CREATE OR REPLACE FUNCTION public.execucao_sync_lider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tecnico_responsavel_id IS NULL THEN
    DELETE FROM public.execucao_atividades_equipe WHERE atividade_id = NEW.id AND papel = 'lider';
  ELSE
    DELETE FROM public.execucao_atividades_equipe
     WHERE atividade_id = NEW.id AND papel = 'lider' AND usuario_id <> NEW.tecnico_responsavel_id;
    INSERT INTO public.execucao_atividades_equipe (atividade_id, usuario_id, papel)
    VALUES (NEW.id, NEW.tecnico_responsavel_id, 'lider')
    ON CONFLICT (atividade_id, usuario_id) DO UPDATE SET papel = 'lider';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_lider ON public.execucao_atividades;
CREATE TRIGGER trg_sync_lider AFTER INSERT OR UPDATE OF tecnico_responsavel_id ON public.execucao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.execucao_sync_lider();

INSERT INTO public.execucao_atividades_equipe (atividade_id, usuario_id, papel)
SELECT id, tecnico_responsavel_id, 'lider' FROM public.execucao_atividades WHERE tecnico_responsavel_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Define líder e apoios de uma atividade (admin)
CREATE OR REPLACE FUNCTION public.execucao_definir_equipe(p_atividade uuid, p_lider uuid, p_apoios uuid[] DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_execucao() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.execucao_atividades SET tecnico_responsavel_id = p_lider, updated_at = now() WHERE id = p_atividade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada'; END IF;
  DELETE FROM public.execucao_atividades_equipe WHERE atividade_id = p_atividade AND papel = 'apoio';
  INSERT INTO public.execucao_atividades_equipe (atividade_id, usuario_id, papel)
  SELECT p_atividade, u, 'apoio' FROM unnest(COALESCE(p_apoios, '{}')) u WHERE u IS DISTINCT FROM p_lider
  ON CONFLICT (atividade_id, usuario_id) DO NOTHING;
END $$;

-- RLS das tabelas novas
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['execucao_cidades', 'execucao_feriados', 'execucao_tipos_servico', 'execucao_contratos_ignorados', 'execucao_atividades_equipe'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY cidades_read ON public.execucao_cidades FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY cidades_admin ON public.execucao_cidades FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY feriados_read ON public.execucao_feriados FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY feriados_admin ON public.execucao_feriados FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY tipos_read ON public.execucao_tipos_servico FOR SELECT TO authenticated USING ((SELECT public.is_usuario_execucao()));
CREATE POLICY tipos_admin ON public.execucao_tipos_servico FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY ignorados_admin ON public.execucao_contratos_ignorados FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY equipe_admin ON public.execucao_atividades_equipe FOR ALL TO authenticated
  USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
CREATE POLICY equipe_tecnico_select ON public.execucao_atividades_equipe FOR SELECT TO authenticated
  USING ((SELECT public.execucao_participa(atividade_id)));

-- Técnico enxerga/atualiza atividades em que é líder OU participante
DROP POLICY IF EXISTS atv_tecnico_select ON public.execucao_atividades;
DROP POLICY IF EXISTS atv_tecnico_update ON public.execucao_atividades;
CREATE POLICY atv_tecnico_select ON public.execucao_atividades FOR SELECT TO authenticated
  USING (tecnico_responsavel_id = (SELECT public.current_usuario_id()) OR (SELECT public.execucao_participa(id)));
CREATE POLICY atv_tecnico_update ON public.execucao_atividades FOR UPDATE TO authenticated
  USING (tecnico_responsavel_id = (SELECT public.current_usuario_id()) OR (SELECT public.execucao_participa(id)))
  WITH CHECK (tecnico_responsavel_id = (SELECT public.current_usuario_id()) OR (SELECT public.execucao_participa(id)));

-- Permissões das funções novas
REVOKE ALL ON FUNCTION public.execucao_norm(text), public.execucao_pascoa(int),
  public.execucao_eh_feriado(date, uuid), public.execucao_dia_util(date, uuid),
  public.execucao_add_dias_uteis(date, int, uuid), public.execucao_dias_uteis_entre(date, date, uuid),
  public.execucao_participa(uuid), public.execucao_sync_lider(),
  public.execucao_definir_equipe(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execucao_norm(text), public.execucao_pascoa(int),
  public.execucao_eh_feriado(date, uuid), public.execucao_dia_util(date, uuid),
  public.execucao_add_dias_uteis(date, int, uuid), public.execucao_dias_uteis_entre(date, date, uuid),
  public.execucao_participa(uuid), public.execucao_definir_equipe(uuid, uuid, uuid[]) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_atv_data_fim ON public.execucao_atividades (data_programada, data_fim);
CREATE INDEX IF NOT EXISTS idx_obras_cidade ON public.execucao_obras (cidade_id);
