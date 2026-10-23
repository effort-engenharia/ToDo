# Melhorias de Negócio — Módulo Execução

> **Foco:** otimizar o dia a dia do time, simplificar o cadastro e o acompanhamento de obras, melhorar a usabilidade do técnico e transformar o Planejamento Macro na visão do todo da carteira.
> **Premissa:** o sistema funciona. As sugestões evoluem o que existe, sem reescrever.
> **Data:** 23/10/2026 (revisão 5, após as respostas do time). Complementa a [AUDITORIA_DASHBOARD_EXECUCAO.md](./AUDITORIA_DASHBOARD_EXECUCAO.md), que tratou bugs, segurança e performance.
>
> **O que mudou na revisão 2:** 1.1 aproveita a busca que já existe no "Nova Obra" (sem tela nova); 1.3 mantém o cadastro atual e só acrescenta a prévia das etapas; 2.1, 2.5 e 2.8 foram detalhados; 2.2 virou um modo da aba Resumo de Etapas; **modo offline (3.6)** e **fotos e vídeos (3.3)** subiram de prioridade; 4.4 ganhou o desenho da seção no dashboard Comercial; **nova 2.9: capacidade produtiva em horas técnicas**.
>
> **O que mudou na revisão 5:** feriados **nacionais, estaduais (SP) e municipais** das 6 cidades, editáveis, com cadastro de cidades (1.5); jornada com **descontos editáveis** em modelos versionados (2.9); **nova 2.10**, fluxo de horas extras/emergências com justificativa e aprovação.
>
> **O que mudou na revisão 4 (respostas do time):**
> - **Cadastro:** triagem inicial dos 491 contratos e opção "obra já em andamento" (1.1/1.3); **Laudos** ficam fora da Execução (1.2).
> - **Equipes e jornada:** **nova 1.7, equipe com 1 ou N técnicos**; jornada real **07:00–12:00 / 13:15–17:00 (8h45)**, com até 2 h extras e fim de semana/feriado só em emergência (1.5, 2.6, 2.9).
> - **Infraestrutura:** tudo pensado para **Android** (3.3, 3.5, 3.6); **nova 0.6, plano do Supabase**.
> - **Evidências:** **localização, data e hora** gravadas em cada uma (3.3).
> - **Nova Fase 5:** auditoria, histórico de alterações e desfazer.
>
> **O que mudou na revisão 3:** 3.3 inclui **áudios** e **compressão de fotos/vídeos/áudios no próprio celular**, com bibliotecas gratuitas, sem servidor extra (o Supabase não comprime vídeo); 2.9 passou a usar **horas previstas no template** e **horas disponíveis líquidas** por colaborador, **sem o técnico precisar iniciar/pausar** para contar horas ("Iniciar" ficou opcional).

---

## 1. O que os dados mostram

Antes de sugerir, cruzei o código com o que está no banco de produção:

| Fato | Valor | Implicação |
|---|---|---|
| Contratos fechados no Comercial (`fase = CONTRATO/VENDA`) | **491** (≈ 25–30 por mês nos últimos 12 meses) | Há demanda constante chegando para a Execução |
| Obras cadastradas na Execução | **0** (nenhuma obra, etapa ou atividade) | O módulo ainda não foi adotado no dia a dia. **A prioridade nº 1 é reduzir o atrito para começar a usar** |
| Usuários com perfil TÉCNICO | **1** (3 ADMIN_EXECUCAO) | A tela do técnico ainda vai ser descoberta pelo time; vale acertar antes da adoção |
| Mix de contratos | Medição Ôhmica ≈ **200** (ticket ≈ R$ 700–800) · SPDA **96** (≈ R$ 6 mil) · Adequação Elétrica **63** (≈ R$ 100 mil) · Estação de Recarga 18 · Laudos 18 · Quadros (bomba/disjuntores/elevador) ≈ 23 · Civil 10 | **A maior parte do volume é serviço curto (1 visita ou poucos dias)**; poucas obras grandes concentram o valor |
| Templates cadastrados | Galpão Industrial, Obra Civil Padrão, Obra Elétrica Padrão, SPDA, Manutenção Predial | **Não há template para Medição Ôhmica, Estação de Recarga, Quadros nem Adequação Elétrica**, que somam a maioria dos contratos da Execução (Laudos são da equipe de Orçamentos) |
| Contratos recentes com cronograma preenchido no Comercial | ≈ 95% têm início e término | O cronograma já nasce no Comercial e pode ser reaproveitado |
| Contratos recentes com contato/endereço | ≈ 70% | Há uma lacuna de dados que o técnico sente em campo |

**Leitura:** o desenho atual (obra com várias etapas, template sequencial e Gantt por obra) atende bem as obras grandes, mas é pesado para cerca de 60% da demanda, que são serviços de uma visita. As sugestões abaixo tratam esses dois perfis de forma diferente.

---

## 2. Princípios usados para selecionar as sugestões

1. **Começar pelo que bloqueia a adoção**, antes de qualquer recurso novo.
2. **Não pedir ao usuário um dado que o sistema já tem.** O Comercial já registra cliente, endereço, contato, cronograma e valor.
3. **Um clique a menos vale mais que uma tela a mais.** Nada de módulos novos quando um atalho resolve.
4. **Medir com dados que já existem.** O histórico de status já guarda quando cada atividade foi iniciada e concluída.
5. **Evitar complexidade de software de cronograma** (dependências arbitrárias, caminho crítico). As obras da carteira são essencialmente sequenciais.

---

## 3. Resumo das sugestões

| # | Sugestão | Para quem | Impacto | Esforço* | Fase |
|---|---|---|---|---|---|
| **0.1** | Corrigir o formulário de templates (hoje não salva tipos válidos) | Planejamento | 🔴 Alto | 0,5 d | 0 |
| **0.2** | Etapa de vários dias não deve aparecer como "atrasada" a partir do 2º dia | Todos | 🔴 Alto | 1 d | 0 |
| **0.3** | Técnico poder pausar/reportar impedimento pela própria tela | Técnico | 🔴 Alto | 0,5 d | 0 |
| **0.4** | Endereço abre o mapa; contato liga/abre WhatsApp | Técnico | 🟠 Médio | 0,5 d | 0 |
| **0.5** | Notificação leva direto à atividade | Admin | 🟡 Médio | 0,5 d | 0 |
| **0.6** | **Plano do Supabase**: migrar para o Pro antes de liberar vídeos (gratuito = 1 GB e sem backup) | Gestão | 🔴 Alto | decisão | 0 |
| **1.1** | No "Nova Obra" atual: listar só contratos ainda não planejados, com tipo/data/valor, e contador no botão | Planejamento | 🔴 Alto | 1,5 d | 1 |
| **1.2** | Template sugerido pelo tipo de serviço do contrato | Planejamento | 🟠 Alto | 1 d | 1 |
| **1.3** | **Prévia das etapas dentro do cadastro atual** (datas e responsáveis editáveis antes de salvar) | Planejamento | 🔴 Alto | 2 d | 1 |
| **1.4** | **Botão "⚡ Serviço rápido"** ao lado do "Nova Obra", para serviços de 1 visita | Planejamento | 🔴 Alto | 1,5 d | 1 |
| **1.5** | Dias úteis seg–sex, **feriados nacionais, estaduais e municipais editáveis** (6 cidades), cadastro de cidades, alerta de prazo | Planejamento | 🟠 Alto | 2,5 d | 1 |
| **1.6** | Templates para o mix real (você vai ajustar/criar; o plano garante os campos) | Planejamento | 🟠 Alto | (dados) | 1 |
| **1.7** | **Equipe na atividade: 1 ou N técnicos** (líder + apoios) | Todos | 🔴 Alto | 3 d | 1 |
| **2.1** | **Painel da carteira**: indicadores que dizem onde agir, cada um filtrando a lista | Gestão | 🔴 Alto | 2 d | 2 |
| **2.2** | **Linha do tempo por obra** como novo modo da aba Resumo de Etapas | Gestão | 🔴 Alto | 2,5 d | 2 |
| **2.3** | Semáforo de saúde da obra (no prazo / em risco / atrasada / pendência) | Gestão | 🟠 Alto | 1,5 d | 2 |
| **2.4** | Previsto × realizado automático + progresso ponderado | Gestão | 🟠 Médio | 1,5 d | 2 |
| **2.5** | Reprogramar etapas seguintes: o sistema propõe, o gestor confirma | Planejamento | 🟠 Alto | 1,5 d | 2 |
| **2.6** | **Carga por técnico na semana** (quem está livre/sobrecarregado) | Gestão | 🔴 Alto | 2 d | 2 |
| **2.7** | Pedido de "atualizar planejamento" vira pendência visível na obra | Gestão | 🟡 Médio | 1 d | 2 |
| **2.8** | "Pauta da semana" em PDF para a reunião de planejamento | Gestão | 🟡 Médio | 1 d | 2 |
| **2.9** | **Capacidade produtiva em horas técnicas**: horas previstas no template, jornada com **descontos editáveis**, sem cronômetro | Gestão/Financeiro | 🔴 Alto | 5 d | 2 |
| **2.10** | **Horas extras e emergências**: registro com justificativa, aprovação/cancelamento pelo admin com justificativa | Gestão | 🟠 Alto | 2,5 d | 2 |
| **3.1** | **"Meu dia" mobile-first** para o técnico | Técnico | 🔴 Alto | 2,5 d | 3 |
| **3.2** | Motivos de pausa padronizados | Técnico/Gestão | 🟠 Médio | 0,5 d | 3 |
| **3.3** | **Conclusão com fotos, vídeos e áudios** + checklist do POP + **compressão no celular (gratuita, sem servidor)** | Técnico/Qualidade | 🔴 Alto | 5 d | 3 |
| **3.4** | Material visível ao técnico + **botão "Falta material"** | Técnico | 🔴 Alto | 1,5 d | 3 |
| **3.5** | Instalável no celular (PWA) | Técnico | 🟠 Alto | 1 d | 3 |
| **3.6** | **Modo offline com sincronização automática** | Técnico | 🔴 Alto | 6–8 d | 3 |
| **4.1** | Reatribuir técnico direto na lista do dia | Admin | 🟡 Médio | 0,5 d | 4 |
| **4.2** | Desempenho acionável: pontualidade, causas de pausa, horas realizadas × previstas | Gestão | 🟠 Alto | 2 d | 4 |
| **4.3** | Calibrar as horas dos templates com o realizado | Planejamento | 🟠 Médio | 1 d | 4 |
| **4.4** | **Status da execução em tempo real no dashboard Comercial** | Comercial | 🟠 Alto | 2–3 d | 4 |
| **5.1** | Registro automático de todas as alterações (auditoria) | Gestão | 🟠 Alto | 1,5 d | 5* |
| **5.2** | Menu **"Histórico de alterações"** (quem mudou o quê, antes × depois) | Gestão | 🟠 Alto | 2 d | 5 |
| **5.3** | **Desfazer (rollback)** com checagem de conflito e lixeira de arquivos | Gestão | 🟠 Alto | 2,5 d | 5 |

\* Esforço estimado em dias de desenvolvimento para uma pessoa que já conhece o código. Serve para priorizar, não é compromisso. Em 5.1, o gatilho de auditoria pode ser instalado já na Fase 0/1, para acumular histórico.

---

## 4. Fase 0: destravar o uso (≈ 3 dias)

São problemas que o time vai encontrar na primeira semana. Corrigir antes de apresentar o módulo evita frustração e perda de confiança.

### 0.1 Formulário de templates não salva tipos válidos

**Situação atual (verificada no banco):**
- No item do template, o seletor "Tipo" oferece **Etapa / Marco / Fase** (`planejamento/TemplateFormModal.jsx`), mas o banco só aceita `eletrica, civil, galpao, geral, administrativo, gestao, estoque`. Escolher qualquer opção do seletor faz o salvamento falhar.
- O "Tipo de Obra" do template é um campo de texto com a dica *"Ex: Elétrica, Civil, Galpão..."*, mas o banco só aceita `eletrica, civil, galpao, misto, spda, manutencao`. Digitar "Elétrica" falha.
- Além disso, **o tipo do item é o que define em qual agenda a atividade cai** (elétrica, civil, galpão ou gestão) e se gera pedido de material (`estoque`). Hoje isso não pode ser escolhido pela tela.

**Passo a passo:**
1. Em `planejamento/constants.js`, criar `TIPOS_ETAPA` com os rótulos: Elétrica, Civil, Galpão, Gestão, Administrativo, **Material (estoque)** e Geral.
2. Em `TemplateFormModal.jsx`, trocar as opções Etapa/Marco/Fase por `TIPOS_ETAPA`.
3. Trocar o `<input>` de "Tipo de Obra" por um `<select>` com os tipos de serviço (ver 1.2).
4. Migração: ampliar o CHECK de `execucao_templates_etapas.tipo_obra` e de `execucao_obras.tipo_obra` para a lista de serviços da seção 1.2 (ou trocar por uma tabela de tipos, também em 1.2).

**Aceite:** criar um template novo com 3 itens de tipos diferentes pela tela e usá-lo em uma obra.

### 0.2 Etapa de vários dias aparece como atrasada no 2º dia

**Situação atual:** ao sincronizar uma etapa com a agenda, é criada **uma** atividade com `data_programada = início da etapa` (`PlanejamentoMacro.jsx`, `sincronizarAtividadeDaEtapa`). Uma "Fabricação da Estrutura" de 10 dias aparece na agenda só no 1º dia e, do 2º dia em diante, é contada como **atrasada** em Atividades do Dia e na Visão Geral (regra `data_programada < hoje`).

**Passo a passo:**
1. Migração: `ALTER TABLE execucao_atividades ADD COLUMN data_fim date;` (nula para atividades de um dia).
2. `sincronizarAtividadeDaEtapa` passa a gravar `data_fim = etapa.data_fim`.
3. Regra de atraso: `COALESCE(data_fim, data_programada) < hoje` e status não concluído. Ajustar em `buscarAtividadesDoDiaComAtrasadas`, `buscarEstatisticasDia`, na RPC `gerar_notificacoes_atraso` e nos cálculos locais de `AtividadesDia`/`ExecucaoHome`.
4. "Hoje" do técnico e "Atividades do Dia" incluem atividades com `data_programada <= hoje <= data_fim`, exibindo **"Dia 3 de 10"** no card.
5. Ao editar as datas da etapa, atualizar `data_programada`/`data_fim` da atividade vinculada (o vínculo por `etapa_id` já existe).

**Aceite:** uma etapa de 5 dias aparece todos os dias na lista do técnico e só fica "atrasada" depois do 5º dia.

### 0.3 Técnico não consegue pausar nem reportar impedimento

**Situação atual:** em **Minhas Atividades** (única tela operacional do técnico) existem apenas *Iniciar*, *Concluir* e *Comentar*. O fluxo de pausa com motivo e com "solicitar atualização do planejamento" existe só em **Atividades do Dia**, que o técnico não acessa. Ou seja, o gestor só sabe que algo travou se o técnico ligar.

**Passo a passo:**
1. Extrair o modal de pausa de `AtividadesDia.jsx` para `components/atividade/ModalPausa.jsx`.
2. Usá-lo em `MinhasAtividades.jsx` com os botões **Pausar** (quando em andamento) e **Retomar** (quando pausada).
3. A RPC `alterar_status_atividade` já valida que o técnico só altera as próprias atividades e já gera a notificação de pausa ao admin; nada muda no banco.

**Aceite:** o técnico pausa com motivo pelo celular e o admin recebe a notificação.

### 0.4 Endereço vira navegação; contato vira ligação

**Situação atual:** o endereço é texto truncado em 40 caracteres e a atividade não tem o contato do cliente, embora a obra tenha (`execucao_obras.contato_cliente`, vindo do Comercial).

**Passo a passo:**
1. No serviço, incluir na consulta das atividades a obra via etapa: `etapa:execucao_obras_etapas(obra:execucao_obras(contato_cliente, endereco, cidade))`. Para atividades avulsas, adicionar `contato_cliente` ao formulário da agenda.
2. No card e no detalhe: botão **Navegar** (`https://www.google.com/maps/search/?api=1&query=<endereço, cidade>`; no celular abre o app de mapas), botão **Ligar** (`tel:`) e **WhatsApp** (`https://wa.me/55<número>`). Normalizar o número só com dígitos.

**Aceite:** com um toque no card, o técnico abre a rota ou liga para o cliente.

### 0.5 Notificação clicável

**Situação atual:** o sino lista as notificações, mas não leva à atividade.

**Passo a passo:** ao clicar, marcar como lida e navegar para `#/execucao/atividades-dia?atividade=<id>`, que abre o detalhe. A navegação por hash já existe em `ExecucaoDashboard.jsx`; basta ler o parâmetro na tela de destino.

### 0.6 Plano do Supabase: armazenamento e backups (decisão, não código)

**Situação atual (resposta 8 + verificação no projeto):** o projeto está no **plano gratuito**. Uso atual: **20 MB** de banco e **3,7 MB** de arquivos.

| Limite do plano gratuito | Valor | Impacto neste plano |
|---|---|---|
| Armazenamento de arquivos | **1 GB** | Com fotos, vídeos e áudios (3.3), a estimativa é de **~400 MB/mês** mesmo com compressão. **Enche em 2 a 3 meses** |
| Tamanho máximo por arquivo | 50 MB | Atende, com a compressão e o limite de 60 s por vídeo |
| Banco de dados | 500 MB | Atende por bastante tempo (auditoria 5.1 cresce, mas pouco) |
| **Backups** | **Nenhum** | Um erro grave ou uma exclusão acidental **não tem como ser recuperado pelo Supabase** |
| Pausa por inatividade | Após 7 dias sem uso | Com uso diário não acontece, mas pode ocorrer em férias coletivas |

**Recomendação:**
- **Fases 0 a 2** (cadastro, planejamento, painéis) cabem tranquilamente no plano gratuito.
- **Antes de liberar as evidências (3.3)**, migrar para o **plano Pro** (cerca de US$ 25/mês; conferir o valor atual em supabase.com/pricing). O Pro tem 100 GB de arquivos, 8 GB de banco, **backup diário** e não pausa.
- Se preferir continuar no gratuito por mais tempo: liberar no início **só fotos e áudios** (que ocupam pouco) e deixar vídeos para depois da migração.

---

## 5. Fase 1: cadastro de obra, do contrato à agenda (≈ 12 dias)

**Objetivo:** um contrato fechado vira obra planejada, com atividades na agenda dos técnicos, **em menos de 2 minutos** e sem redigitar dados do Comercial.

### 1.1 Melhorar a seleção de contratos no "Nova Obra" (sem tela nova)

> **Revisado após feedback:** a ideia **não é criar outra tela**. O modal "Nova Obra" já tem a busca e a lista de contratos em CONTRATO/VENDA. A proposta é aperfeiçoar o que existe e deixar visível que há contratos esperando planejamento.

**Situação atual (verificada em `planejamento/ObraFormModal.jsx`):**
- A lista traz **todos** os contratos fechados, **inclusive os que já viraram obra**. Nada impede cadastrar o mesmo contrato duas vezes.
- A busca filtra só pelo nome do cliente; não há ordem por data nem indicação de tipo de serviço, valor ou prazo.
- Com 491 contratos históricos, a lista fica longa e os contratos novos se perdem.
- Para saber que existe contrato novo, o planejador precisa abrir o modal e procurar.

**Proposta (3 ajustes no que existe):**

1. **A lista só mostra o que falta planejar:** contratos sem obra vinculada, ordenados pelo início previsto. Cada opção passa a mostrar **cliente · tipo de serviço · início previsto · valor**, com destaque para vencidos e para os dos próximos 7 dias. **Contratos de serviços que não são da Execução** (ex.: **Laudos**, feitos pela equipe de Orçamentos) **não aparecem** (ver 1.2).
2. **Contador no botão:** `[+ Nova Obra  (12 contratos aguardando)]`. É o mesmo botão de hoje, só com o número. Ao abrir, a lista já vem filtrada. **O contador é único para todos os ADMIN_EXECUCAO**: não há "obra de um admin ou de outro".
3. **"Não planejar este contrato"**: um link discreto na opção selecionada, com motivo (já concluído antes do sistema, cancelado, outro), para limpar a lista sem apagar nada no Comercial.

**Organização inicial dos contratos existentes (resposta 6):** dos 491 contratos já fechados, alguns **ainda estão em execução**, outros **já foram concluídos** e outros **vão entrar no planejamento**. O ADMIN_EXECUCAO faz essa triagem uma única vez:
- **Já concluídos:** marcar vários de uma vez como "Não planejar → já concluído". No "Revisar pendentes", que abre a partir do contador, há uma lista com caixas de seleção e um botão de ação em lote.
- **Em execução hoje:** cadastrar normalmente pelo "Nova Obra", ligando a opção **"Obra já em andamento"** da prévia (1.3). As etapas com fim antes de hoje entram como concluídas, e a atual entra em andamento com o progresso informado.
- **Vão entrar no planejamento:** seguem o fluxo normal.

Não é preciso data de corte: a triagem inicial resolve, e depois a lista mostra só o que é novo.

```
┌ Nova Obra ───────────────────────────────────────────────────────┐
│ Buscar Cliente (Contrato/Venda)  [ jardim            ]           │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Ed. Aurora · Medição Ôhmica · início 21/10 (vencido) · R$790│ │
│ │   Cond. Jardim Sul · SPDA · início 28/10 · R$ 6.200          │ │
│ │   Ind. Metalúrgica XYZ · Adequação · início 03/11 · R$ 98 mil │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ☐ Mostrar também contratos já planejados / antigos               │
└──────────────────────────────────────────────────────────────────┘
```

**Passo a passo:**
1. Migração:
   ```sql
   CREATE TABLE public.execucao_contratos_ignorados (
     apontamento_id uuid PRIMARY KEY REFERENCES public.apontamentos_comerciais(id),
     motivo text NOT NULL,
     ignorado_por uuid REFERENCES public.usuarios(id),
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE public.execucao_contratos_ignorados ENABLE ROW LEVEL SECURITY;
   CREATE POLICY ign_admin ON public.execucao_contratos_ignorados FOR ALL TO authenticated
     USING ((SELECT public.is_admin_execucao())) WITH CHECK ((SELECT public.is_admin_execucao()));
   -- impede duas obras para o mesmo contrato
   CREATE UNIQUE INDEX IF NOT EXISTS uq_obra_apontamento ON public.execucao_obras (apontamento_id) WHERE apontamento_id IS NOT NULL;
   ```
2. Serviço: `buscarApontamentosParaObra({ somentePendentes = true })` passa a excluir contratos com obra, os marcados como "não planejar" e os de tipos de serviço que não são da Execução (1.2), a ordenar por `cronograma_data_inicio` e a trazer `tipo_oportunidade` e `valor_total_servico`. Nova `contarContratosPendentes()` usa `count: 'exact', head: true` (barata) para o contador do botão.
3. `ObraFormModal.jsx`: enriquecer o texto das opções, adicionar o checkbox "mostrar também..." e o link "Não planejar". Criar `planejamento/RevisarContratosPendentes.jsx` (lista com seleção múltipla e ação em lote), aberta pelo contador, para a triagem inicial.
4. `PlanejamentoMacro.jsx`: contador no botão "Nova Obra".

**Aceite:** um contrato que já virou obra não aparece mais na lista; um contrato novo do Comercial aparece no topo e o botão mostra quantos estão aguardando.

> A tabela `apontamentos_comerciais` está sem RLS (pendência da auditoria anterior). Quando for protegida, o ADMIN_EXECUCAO precisa continuar lendo esses campos.

### 1.2 Template sugerido pelo tipo de serviço

O Comercial já informa `tipo_oportunidade` (SPDA, MEDIÇÃO OHMICA, ADEQUAÇÃO ELÉTRICA...). Esse campo deve escolher o template.

**Passo a passo:**
1. Migração: tabela de tipos de serviço, que substitui os CHECKs fixos de `tipo_obra`:
   ```sql
   CREATE TABLE public.execucao_tipos_servico (
     codigo text PRIMARY KEY,                   -- 'medicao_ohmica', 'spda', 'adequacao_eletrica'...
     nome text NOT NULL,
     modalidade text NOT NULL CHECK (modalidade IN ('servico', 'obra')),  -- 1 visita x várias etapas
     equipe_responsavel text NOT NULL DEFAULT 'execucao'
       CHECK (equipe_responsavel IN ('execucao', 'orcamentos')),          -- Laudos = orçamentos (fora da Execução)
     template_padrao_id uuid REFERENCES public.execucao_templates_etapas(id),
     termos_comercial text[] NOT NULL DEFAULT '{}', -- valores de tipo_oportunidade que mapeiam para cá
     ativo boolean DEFAULT true
   );
   ```
   Exemplo de `termos_comercial` para Medição Ôhmica: `{'MEDIÇÃO OHMICA', 'Medição Ohmica'}`. A comparação deve ignorar maiúsculas e acentos, porque hoje o Comercial tem variações do mesmo tipo.
2. Ao selecionar o contrato no "Nova Obra", resolver `tipo_oportunidade → tipo de serviço → template` e pré-selecionar o template e o tipo de obra.
3. Em uma tela simples de configuração (aba Templates), o gestor ajusta o mapeamento.
4. Cadastro inicial (resposta 4): **Medição Ôhmica → Execução**; **Laudos → Orçamentos** (não aparecem na lista do "Nova Obra").

**Recomendação ao Comercial (fora do escopo, mas relevante):** padronizar `tipo_oportunidade` como lista fechada. Hoje existem "MEDIÇÃO OHMICA" e "Medição Ohmica", "SPDA" e variações, o que divide os números.

### 1.3 Prévia do cronograma dentro do cadastro atual

> **Revisado após feedback:** o cadastro **continua como está hoje** (mesmo modal, mesmos campos). Não há assistente em passos. São duas mudanças independentes:
> - **1.3 (este item):** dentro do "Nova Obra" atual, ao escolher um template, aparece uma **prévia das etapas** para ajustar antes de salvar.
> - **1.4 (próximo item):** um **botão separado de "Serviço rápido"** para serviços de uma visita.

**Hoje:** ao escolher um template, o modal só informa que "as etapas serão criadas ao salvar". As etapas aparecem depois, e para mandar as atividades à agenda é preciso abrir etapa por etapa e definir o responsável.

**Proposta:** quando um template é escolhido, o modal mostra logo abaixo uma tabela compacta com as etapas já calculadas, com datas e responsável editáveis.

```
┌ Nova Obra (modal atual) ─────────────────────────────────────────┐
│ ... campos atuais: cliente, endereço, datas, tipo, responsável ...│
│ Template: [SPDA ▾]                                                │
│ ┌ Prévia das etapas ───────────────────────────────────────────┐ │
│ │ #  Etapa               Início   Fim     Responsável          │ │
│ │ 1  Inspeção e Projeto  28/10    30/10   [João ▾]             │ │
│ │ 2  Aprovação ART       31/10    03/11   [—    ▾]             │ │
│ │ 3  Materiais 📦        04/11    06/11   (gera pedido)        │ │
│ │ 4  Captores            07/11    10/11   [João ▾]             │ │
│ │ Término previsto 18/11 · contratado 15/11  ⚠ +3 dias úteis   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ☑ Enviar etapas com responsável para a agenda dos técnicos       │
│                                        [Cancelar]  [Salvar obra] │
└──────────────────────────────────────────────────────────────────┘
```

- O **responsável geral** escolhido na obra (campo que já existe) preenche todas as etapas por padrão; o planejador troca só as exceções.
- Mudar a data de uma etapa desloca as seguintes, na própria prévia.
- Se o término calculado passar do prazo contratado, o aviso aparece antes de salvar.
- **"Obra já em andamento"** (para os contratos que já estão em execução quando o sistema entra em uso): ao ligar esta opção, as etapas que terminam antes de hoje entram como **concluídas**, e a etapa atual pede o **% de progresso**. Assim a obra entra no sistema no ponto real em que está, sem lançar o passado à mão.

**Passo a passo:**
1. Novo componente `planejamento/PreviaEtapas.jsx`, exibido em `ObraFormModal.jsx` quando há template selecionado (só na criação). Ele usa `gerarEtapasDoTemplate` (já existe em `utils.js`) e guarda as etapas editadas no estado do formulário.
2. `PlanejamentoMacro.jsx` passa a criar as etapas a partir da prévia editada, em vez de recalcular do template.
3. Ao salvar, **uma única RPC transacional** cria obra, etapas, atividades (das etapas com responsável) e pedido (etapas de estoque), eliminando o rollback manual atual:
   ```sql
   CREATE FUNCTION public.criar_obra_completa(p_obra jsonb, p_etapas jsonb, p_criar_atividades boolean)
   RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$ ... $$;
   ```
4. Gravar também `valor_contrato` (vem de `valor_total_servico` do contrato), campo que o banco já tem e o formulário não pede. Ele alimenta o painel 2.1.

**Aceite:** ao salvar a obra, as etapas já estão com datas e responsáveis certos e as atividades já estão na agenda dos técnicos, sem abrir etapa por etapa.

### 1.4 "Serviço rápido" para serviços de uma visita

Medição Ôhmica, sozinha, soma cerca de 40% dos contratos (≈ 200) e normalmente é **uma visita**. Laudos também são de uma visita, mas ficam com a equipe de Orçamentos, fora da Execução. Para eles, obra + template + etapa é burocracia.

**Proposta:** um **segundo botão ao lado do "Nova Obra"**: `[+ Nova Obra]  [⚡ Serviço rápido]`. O "Nova Obra" continua exatamente como é (com as melhorias 1.1 e 1.3). O Serviço rápido abre um modal curto:

```
┌ ⚡ Serviço rápido ───────────────────────────────┐
│ Contrato: [Ed. Aurora · Medição Ôhmica ▾]        │  ← mesma lista do 1.1
│ Data: [28/10]  Horário: [09:00]–[11:00]          │
│ Técnico: [João ▾]                                │
│ Observação: [                               ]    │
│                          [Cancelar] [Agendar]    │
└──────────────────────────────────────────────────┘
```

Nos bastidores, cria obra + uma etapa + a atividade na agenda, mantendo a mesma estrutura de dados. Assim o serviço aparece no Planejamento, nos indicadores e no previsto × realizado sem nenhum caso especial.

**Passo a passo:**
1. `planejamento/ServicoRapidoModal.jsx`, usando a RPC `criar_obra_completa` com uma etapa. Cliente, endereço, contato e valor vêm do contrato selecionado.
2. Se o contrato escolhido no "Nova Obra" for de um tipo `modalidade = 'servico'` (1.2), o modal sugere: *"Este é um serviço de uma visita. Usar o Serviço rápido?"*.
3. No Planejamento Macro, filtro **"Ocultar serviços rápidos"**, para que as obras grandes não se percam entre dezenas de medições.
4. **(Opcional, depois)** Agendar vários de uma vez: selecionar vários contratos de serviço rápido da mesma cidade e agendá-los no mesmo dia para o mesmo técnico.

**Aceite:** agendar uma Medição Ôhmica leva menos de 30 segundos.

### 1.5 Dias úteis, feriados (nacionais, estaduais e municipais) e alerta de prazo

**Hoje:** as etapas do template somam dias **corridos**, sem fim de semana nem feriado.

**Regras (respostas do time):**
- **Dias úteis: segunda a sexta.** Sábado, domingo e feriado **não entram no cálculo automático** e só são usados em **emergências** (com registro e aprovação, item 2.10).
- **Feriados em três níveis, todos editáveis pelo admin:**
  - **nacionais** (ex.: 1º/jan, Tiradentes, 1º/mai, 7/set, 12/out, 2/nov, 15/nov, **20/nov**, 25/dez, Sexta-feira Santa);
  - **estaduais de SP** (ex.: **9 de julho**);
  - **municipais** das cidades atendidas: **Guarujá, Santos, São Vicente, Praia Grande, Bertioga e São Sebastião**.
- **Datas móveis** (Carnaval, Sexta-feira Santa, Corpus Christi) mudam todo ano. O sistema calcula as datas a partir da Páscoa e o admin decide, ano a ano, se cada uma é **feriado** ou **dia normal** (Carnaval e Corpus Christi costumam ser ponto facultativo, conforme decreto de cada prefeitura).

**Como o feriado se aplica (dois efeitos diferentes):**

| Efeito | Quais feriados contam | Exemplo |
|---|---|---|
| **Cronograma da obra** (datas das etapas) | Nacionais + estaduais + municipais **da cidade da obra** | Obra em Santos não tem etapa no aniversário de Santos, mas pode ter no feriado de Bertioga |
| **Capacidade do colaborador** (horas disponíveis, 2.9) | Nacionais + estaduais + municipais **da cidade-base da equipe** | Se a equipe é de Guarujá, o feriado de Guarujá zera as horas normais de todos naquele dia |

**Cidades padronizadas:** no Comercial, a mesma cidade aparece escrita de formas diferentes (ex.: "GUARUJÁ" em 232 contratos e "Guarujá" em 88). Por isso, as obras passam a apontar para um **cadastro de cidades**, e a ligação com o contrato é feita comparando o nome sem diferenciar maiúsculas e acentos.

```
┌ Configurações → Feriados ─────────────────────────────────────────────────┐
│ Ano: [2026 ▾]   Filtro: [Todos ▾]               [+ Novo feriado] [Copiar p/ 2027] │
├───────────────────────────────────────────────────────────────────────────┤
│ 01/01  Confraternização Universal       Nacional        repete todo ano  ✎ 🗑 │
│ 16/02  Carnaval                         Nacional        móvel · [Feriado ▾]  │
│ 09/07  Revolução Constitucionalista     Estadual (SP)   repete todo ano  ✎ 🗑 │
│ dd/mm  Aniversário da cidade            Municipal · Santos   repete todo ano ✎ 🗑 │
│ ...                                                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

**Passo a passo:**
1. Migrações:
   ```sql
   CREATE TABLE public.execucao_cidades (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     nome text NOT NULL, uf char(2) NOT NULL DEFAULT 'SP',
     ativa boolean NOT NULL DEFAULT true,
     UNIQUE (nome, uf)
   );
   -- carga inicial: Guarujá, Santos, São Vicente, Praia Grande, Bertioga, São Sebastião (todas SP)

   CREATE TABLE public.execucao_feriados (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     data date NOT NULL,
     descricao text NOT NULL,
     abrangencia text NOT NULL CHECK (abrangencia IN ('nacional', 'estadual', 'municipal')),
     uf char(2),                                        -- obrigatório se estadual
     cidade_id uuid REFERENCES public.execucao_cidades(id), -- obrigatório se municipal
     recorrente boolean NOT NULL DEFAULT true,          -- data fixa que se repete todo ano
     movel text,                                        -- 'carnaval' | 'sexta_santa' | 'corpus_christi' (calculadas pela Páscoa)
     considerar_feriado boolean NOT NULL DEFAULT true,  -- false = ponto facultativo tratado como dia normal
     CHECK ((abrangencia = 'municipal') = (cidade_id IS NOT NULL))
   );

   ALTER TABLE public.execucao_obras ADD COLUMN cidade_id uuid REFERENCES public.execucao_cidades(id);
   -- preencher a partir do texto atual comparando sem maiúsculas/acentos (extensão unaccent)
   ```
   Carga inicial: feriados **nacionais** e o **estadual de SP**. Os **municipais** das 6 cidades são cadastrados pelo admin, conferindo o calendário oficial de cada prefeitura (as datas e os decretos mudam).
2. `utils/datas.js`: `addDiasUteis(data, n, feriados)`, `ehDiaUtil(data, feriados)` e `datasMoveis(ano)` (Páscoa, Carnaval, Sexta-feira Santa, Corpus Christi).
3. Serviço: `buscarFeriados({ inicio, fim, cidadeId })`, que devolve nacionais + estaduais da UF + municipais da cidade; usado pela prévia (1.3), pelo deslocamento de etapas (2.5) e pela capacidade (2.9).
4. Tela **Configurações → Feriados** (só admin): incluir, editar e excluir; filtro por ano e abrangência; botão **"Copiar para o próximo ano"** (copia os recorrentes e recalcula os móveis); e **Configurações → Cidades** para ativar novas cidades atendidas.
5. Na agenda e na prévia, marcar uma atividade em sábado, domingo ou feriado mostra o aviso **"Dia não útil: será hora extra/emergência"** e pede a justificativa (2.10).
6. Na prévia (1.3), mostrar o término calculado contra `cronograma_data_termino` do contrato e avisar quando passar.

### 1.6 Templates para o mix real

> **Resposta 7:** os templates serão **revisados e completados por você**. A tabela abaixo é só uma **referência** de ponto de partida. O que importa para este plano é que o formulário de templates funcione (**0.1 é pré-requisito**) e já tenha os campos **Tipo** (que define a agenda), **Horas previstas**, **Nº de técnicos** e **POP** (2.9 e 3.3).

Referência (durações em dias úteis):

| Template | Modalidade | Etapas sugeridas (tipo → agenda) |
|---|---|---|
| Medição Ôhmica | serviço | Medição em campo (elétrica, 1) → Emissão do relatório da medição (gestão, 1) |
| SPDA *(revisar existente)* | obra | Já existe; trocar "Materiais" de `geral` para **`estoque`** para gerar o pedido automaticamente |
| Adequação Elétrica | obra | Levantamento (gestão) → Projeto (gestão) → Material (estoque) → Infraestrutura (elétrica) → Quadros (elétrica) → Cabeamento (elétrica) → Testes (gestão) → Entrega/ART (administrativo) |
| Estação de Recarga | obra | Vistoria e dimensionamento (gestão) → Material (estoque) → Instalação (elétrica) → Comissionamento (gestão) |
| Quadros (bomba, disjuntores, elevador) | obra | Levantamento (gestão) → Material (estoque) → Montagem (galpão/elétrica) → Instalação (elétrica) → Testes (gestão) |

Observação: o template "Manutenção Predial" atual tem as etapas "Orçamento" e "Aprovação", que pertencem à fase comercial. Após o contrato, elas tendem a não fazer sentido.

### 1.7 Equipe na atividade: 1 ou N técnicos (resposta 2)

**Situação atual:** na prática, uma atividade pode ter **1 ou vários técnicos**, mas o sistema só guarda **um** (`tecnico_responsavel_id`). Hoje, quem não é o responsável não vê a atividade na própria tela, não consegue concluir nem anexar evidências, e não entra na carga nem nas horas.

**Proposta:** cada etapa e atividade passa a ter uma **equipe**, com um **líder** (o atual "responsável", mantido por compatibilidade) e quantos **apoios** forem necessários.

```
Técnicos: [João ★ líder] [Maria] [+ adicionar]
```

- Na **prévia do cronograma (1.3)**, no **Serviço rápido (1.4)**, na **etapa** e na **agenda**, o campo "Técnico" vira uma **seleção múltipla**. O nº de técnicos sugerido vem do template (`qtd_tecnicos`, item 2.9).
- **Todos os participantes** veem a atividade no "Meu dia", podem iniciar, pausar, concluir e anexar evidências. A atividade tem **um único status**: quando qualquer participante conclui, ela fica concluída para todos.
- **Horas:** as horas previstas da atividade (homem-hora) são divididas **igualmente** entre os participantes por padrão, com ajuste por pessoa se necessário. Isso alimenta a carga (2.6) e a capacidade (2.9) de cada um.
- **Notificações** de transferência, remarcação e material chegam a todos os participantes.

**Passo a passo:**
1. Migração:
   ```sql
   CREATE TABLE public.execucao_atividades_equipe (
     atividade_id uuid NOT NULL REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
     usuario_id   uuid NOT NULL REFERENCES public.usuarios(id),
     papel        text NOT NULL DEFAULT 'apoio' CHECK (papel IN ('lider', 'apoio')),
     horas_previstas numeric(6,2),            -- nulo = divisão igual
     PRIMARY KEY (atividade_id, usuario_id)
   );
   ALTER TABLE public.execucao_obras_etapas ADD COLUMN equipe_ids uuid[] NOT NULL DEFAULT '{}'; -- equipe planejada da etapa
   -- backfill: o responsável atual vira líder
   INSERT INTO public.execucao_atividades_equipe (atividade_id, usuario_id, papel)
   SELECT id, tecnico_responsavel_id, 'lider' FROM public.execucao_atividades WHERE tecnico_responsavel_id IS NOT NULL;
   ```
2. **Segurança (RLS):** as políticas do técnico em `execucao_atividades` (`atv_tecnico_select`/`atv_tecnico_update`) e a checagem da RPC `alterar_status_atividade` passam a aceitar **"é líder OU participante"** (`EXISTS` em `execucao_atividades_equipe`). Histórico, comentários e evidências herdam isso automaticamente, porque já dependem de o técnico enxergar a atividade.
3. Serviço: `buscarAtividadesTecnico` passa a buscar pela equipe; `criarAtividadeDeEtapa` e a RPC `criar_obra_completa` gravam a equipe; `transferirAtividade` passa a trocar participantes.
4. UI: componente `SeletorEquipe.jsx` (seleção múltipla com líder), usado na prévia, no Serviço rápido, na etapa e na agenda. Cards mostram as iniciais da equipe.

**Aceite:** uma atividade com João (líder) e Maria aparece no "Meu dia" dos dois; Maria conclui com fotos; a atividade fica concluída para ambos, e as horas aparecem na carga de cada um.

---

## 6. Fase 2: Planejamento Macro como visão do todo (≈ 21 dias)

**Objetivo:** em 10 segundos, o gestor responde "o que temos para entregar, o que está em risco e quem está livre?".

**Hoje (verificado):**
- **Aba Obras:** 4 contadores (total, em andamento, concluídas, atrasadas) e cards de obra com Gantt individual (uma obra expandida por vez).
- **Aba Resumo de Etapas:** já reúne **as etapas de todas as obras**, em tabela (ordenada por data, cliente ou tipo de equipe), agenda semanal, calendário mensal e visão anual, com exportação.
- **O que falta:** uma visão **por obra** no tempo (do início ao fim, com progresso e saúde), indicadores que apontem onde agir e a carga de cada técnico.

### 2.1 Painel da carteira (substitui os 4 contadores da aba Obras)

**A ideia:** os 4 contadores de hoje dizem *quantas* obras existem em cada status, mas não dizem *onde agir*. O painel troca esses números por **perguntas que o gestor faz toda manhã**, e cada número é um botão que filtra a lista logo abaixo para mostrar exatamente aquelas obras.

```
┌───────────┬────────────┬───────────┬───────────┬──────────────┬──────────────┐
│Em execução│Começam nos │ Atrasadas │ Em risco  │ Pendências   │ Carteira a   │
│    14     │próx. 15 d  │   3 🔴    │   4 🟠    │   5 ⚠        │ executar     │
│           │    6       │           │           │ 2 sem resp.  │ R$ 1,2 mi    │
│           │            │           │           │ 3 material   │ ≈ 9 semanas* │
└───────────┴────────────┴───────────┴───────────┴──────────────┴──────────────┘
   (clicar em qualquer número filtra a lista de obras abaixo)
```

| Indicador | O que conta | Pergunta que responde | Ação típica ao clicar |
|---|---|---|---|
| **Em execução** | Obras com alguma atividade iniciada e não concluídas | "Quanto temos em campo agora?" | Ver o andamento de cada uma |
| **Começam nos próximos 15 dias** | Obras com início previsto na janela | "O que preciso preparar (material, equipe, ART)?" | Conferir responsáveis e pedidos de material |
| **Atrasadas** | Regra 🔴 do item 2.3 | "O que já estourou?" | Replanejar (2.5) ou cobrar a equipe |
| **Em risco** | Regra 🟠 do item 2.3 (vai atrasar se nada mudar) | "O que ainda dá para salvar?" | Antecipar material, reforçar equipe |
| **Pendências** | Etapas próximas **sem responsável**, material **sem data**, pedidos do técnico para **replanejar** (2.7), **horas extras/emergências a aprovar** (2.10) | "O que depende de uma decisão minha?" | Resolver uma a uma |
| **Carteira a executar** | Soma de `valor_contrato × (1 − progresso)` das obras abertas | "Quanto temos vendido e ainda não entregue?" | Conversar com o Comercial sobre o ritmo de vendas |

\* Com a capacidade em horas (item 2.9), o painel também mostra **quantas semanas de trabalho** a carteira representa para a equipe atual.

**Passo a passo:**
1. RPC `execucao_painel_carteira()` que devolve os contadores numa só consulta (sem trazer todas as obras ao navegador).
2. `planejamento/PainelCarteira.jsx` no lugar dos 4 cards atuais; clicar aplica o filtro na lista existente (`filtroStatus` ganha os valores `em_risco`, `pendencias`, `inicio_proximo`).
3. O valor em R$ só aparece para quem tem perfil de gestão.

### 2.2 Linha do tempo por obra, como um modo da aba Resumo de Etapas (não é aba nova)

> **Revisado após feedback:** o Resumo de Etapas já mostra todas as obras, mas **etapa por etapa e dia a dia** (tabela, semana, mês, ano). Ele responde *"o que acontece em cada dia?"*. A linha do tempo responde outra pergunta: *"como está cada obra, do início ao fim?"*. Para não duplicar, ela entra como **mais um botão de visualização dentro do Resumo de Etapas**, ao lado de Tabela/Semana/Mês/Ano, reaproveitando os mesmos filtros e a mesma exportação.

```
Resumo de Etapas   [Tabela] [Semana] [Mês] [Ano] [▶ Linha do tempo]
                     Out          Nov                    Dez
                     │  hoje      │                      │
Ind. Metalúrgica XYZ ████████▓▓▓▓▓░░░░░░░░░░░░░           🟠 em risco
Cond. Jardim Sul          ███░░░░░░░                      🟢
Galpão Logística         ██████████████░░░░░░░░░░░░░░░░░  🟢
Ed. Aurora (SPDA)   ▓▓▓▓▓▓▓▓▓▓│                           🔴 atrasada 4d
```

**Diferença em relação ao que existe:**

| | Visões atuais (Tabela/Semana/Mês/Ano) | Linha do tempo (nova) |
|---|---|---|
| Unidade | Etapa | **Obra** (expande para as etapas) |
| Responde | O que acontece em cada dia | Como está cada obra no todo; quais se sobrepõem |
| Mostra progresso e saúde | Não | **Sim** (preenchimento da barra = progresso; cor = 2.3) |
| Mostra prazo contratado e chegada de material | Não | **Sim** (marcos ◆) |

**Passo a passo:**
1. `planejamento/ResumoVisaoLinhaDoTempo.jsx`, no mesmo padrão de `ResumoVisaoSemana/Mes/Ano.jsx`, reaproveitando a escala de datas de `GanttObra.jsx`.
2. Em `ResumoEtapas.jsx`, adicionar `'linha'` aos modos de visualização.
3. Uma linha por obra; clicar expande as etapas da obra ali mesmo. Agrupar por **responsável**, **tipo de serviço** ou **cidade**.
4. Marcos ◆: `data_material_disponivel` do pedido vinculado e o prazo contratado.

**Aceite:** numa tela, ver todas as obras ativas e as que começam em 30 dias, com saúde e progresso, sem abrir obra por obra.

### 2.3 Semáforo de saúde da obra

Hoje "atrasada" é só "fim previsto < hoje e progresso < 100%". Isso avisa tarde demais. Regras propostas, **explícitas e exibidas no tooltip** para o time confiar no indicador:

| Situação | Regra |
|---|---|
| 🔴 **Atrasada** | Fim previsto < hoje e não concluída, **ou** alguma etapa vencida há mais de 2 dias úteis |
| 🟠 **Em risco** | Progresso real < progresso esperado − 15 p.p. (esperado = dias úteis decorridos ÷ dias úteis totais), **ou** etapa que começa em até 5 dias úteis sem responsável, **ou** material sem data de disponibilidade a 5 dias úteis da etapa que depende dele |
| ⚠ **Pendência** | Pedido do técnico para "atualizar planejamento" em aberto (2.7) ou atividade pausada há mais de 1 dia útil |
| 🟢 **No prazo** | Demais casos |

**Passo a passo:** função pura `calcularSaude(obra, hoje, feriados)` em `planejamento/utils.js` (testável), usada pelo painel, pela linha do tempo e pelos cards. O limite de 15 p.p. fica configurável.

### 2.4 Previsto × realizado automático e progresso ponderado

**Hoje:** o banco tem `data_inicio_real`/`data_fim_real` na obra, mas nada as preenche. O progresso da obra é a média simples das etapas, então uma etapa de 1 dia pesa o mesmo que uma de 15.

**Passo a passo:**
1. Trigger após mudança de status em `execucao_atividades`:
   - 1ª atividade da obra **iniciada ou concluída** ("Iniciar" é opcional) → `data_inicio_real` da etapa e da obra (se nulas);
   - todas as etapas concluídas → `data_fim_real` da obra = hoje.
   (Adicionar `data_inicio_real`/`data_fim_real` em `execucao_obras_etapas`.)
2. Trocar `recalcularProgressoObra` por média **ponderada pela duração** de cada etapa (ou pelas horas estimadas, quando existirem, ver 2.9).
3. Exibir no card e na linha do tempo: **"Início: previsto 28/10 · real 30/10 (+2)"** e, ao concluir, **desvio de prazo em dias úteis**.

### 2.5 Reprogramar etapas seguintes (o sistema propõe, o gestor confirma)

> **Respondendo à dúvida:** **não é totalmente automático, de propósito.** O sistema calcula e **propõe** o deslocamento; o gestor confirma com um clique.

**Por que não deslocar sozinho:**
- Nem todo atraso empurra o resto: a equipe pode recuperar o tempo, ou a etapa seguinte pode correr em paralelo (ex.: "Projeto" atrasou, mas a "Compra de material" pode começar).
- Mudar datas sozinho moveria atividades na agenda dos técnicos sem ninguém perceber, o que gera mais confusão que ajuda.
- Com confirmação, o gestor fica ciente do impacto, inclusive quando o atraso estoura o prazo contratado.

**Como funciona:** ao salvar uma etapa com o fim alterado:

```
┌ Reprogramar etapas seguintes? ───────────────────────────────────┐
│ "Fundação" terminará 3 dias úteis depois do previsto.            │
│                                                                  │
│ Etapa              Antes            Depois                       │
│ Estrutura          04/11 – 12/11 →  07/11 – 17/11                │
│ Alvenaria          13/11 – 19/11 →  18/11 – 24/11                │
│ Pintura            20/11 – 22/11 →  25/11 – 27/11                │
│ Término da obra:   22/11         →  27/11  ⚠ passa do contratado │
│ 3 atividades na agenda de João e Maria serão remarcadas.         │
│                                                                  │
│        [Só esta etapa]   [Deslocar as seguintes]                 │
└──────────────────────────────────────────────────────────────────┘
```

**Passo a passo:**
1. No `EtapaFormModal.jsx`, comparar o fim antigo com o novo; havendo etapas posteriores (por `ordem`), mostrar a prévia acima.
2. RPC `deslocar_etapas(p_obra_id, p_a_partir_da_ordem, p_dias_uteis)`, que atualiza etapas **e** atividades vinculadas numa transação e devolve o novo término.
3. Notificar os técnicos cujas atividades mudaram de data.
4. **Opcional, depois:** uma configuração por obra "sempre deslocar automaticamente", para quem preferir.

### 2.6 Carga por técnico na semana

Com poucos técnicos, a pergunta diária é **"quem está livre?"**. A primeira versão conta atividades por dia; com o item 2.9 passa a mostrar **horas alocadas × horas disponíveis**, que é a medida correta (uma medição de 2 h e uma montagem de 8 h não pesam igual). Com equipes (1.7), as horas de cada atividade são distribuídas entre os participantes.

**Jornada da empresa (resposta 3):** segunda a sexta, **07:00–12:00 e 13:15–17:00 = 8h45 por dia**; até **2 h extras por dia**; sábado, domingo e feriado **só em emergência**.

| Cor | Situação no dia |
|---|---|
| 🟢 | Até a **jornada líquida** do colaborador (8h45 − descontos, item 2.9) |
| 🟡 | Até 2 h acima da jornada líquida (**hora extra**, gera registro para aprovação, 2.10) |
| 🔴 | Mais de 2 h acima da jornada líquida (**acima do limite diário**) |
| 🟣 | Atividade em sábado, domingo ou feriado (**emergência**, 2.10) |

```
              Seg 27       Ter 28       Qua 29         Qui 30       Sex 31      Sáb 01
João          6h/8h45 🟢   8h45 🟢      10h/8h45 🟡    4h 🟢        férias      —
Maria         2h 🟢        —            —              11h30 🔴     6h 🟢       4h 🟣
(Sem técnico) 4h           —            6h             —            —
```

**Passo a passo:**
1. RPC `execucao_carga_tecnicos(p_inicio, p_fim)`: atividades (ou horas) por técnico por dia, considerando `data_fim` (item 0.2) e ausências (item 2.9).
2. `planejamento/CargaTecnicos.jsx` como **modo "Equipe"** do Resumo de Etapas (mesmo critério do 2.2: sem aba nova). Clicar numa célula lista as atividades e permite **reatribuir**.
3. Cores conforme a tabela acima (a jornada e o limite de horas extras vêm do cadastro do colaborador, item 2.9). A linha **"Sem técnico"** mostra o que ainda precisa ser distribuído.

### 2.7 "Atualizar planejamento" vira pendência

**Hoje:** a opção existe na pausa, mas só acrescenta um texto ao motivo. O planejador só percebe se ler o histórico.

**Passo a passo:**
1. Migração: `ALTER TABLE execucao_atividades ADD COLUMN solicita_replanejamento boolean DEFAULT false, ADD COLUMN replanejamento_resolvido_em timestamptz;`
2. A pausa com essa opção marca a flag (parâmetro novo na RPC `alterar_status_atividade`).
3. Badge ⚠ na obra (painel 2.1 e linha do tempo) com a ação **"Resolver"**, que abre a etapa e oferece 2.5. Resolver limpa a pendência.

### 2.8 Relatório da reunião semanal (pauta pronta em PDF)

**A ideia:** muitas equipes fazem uma reunião semanal de planejamento (segunda de manhã, por exemplo) montando a pauta de cabeça ou numa planilha. O sistema já tem tudo o que essa pauta precisa. Um botão **"Pauta da semana"** gera um PDF de 1 a 2 páginas, para projetar ou imprimir, que **conduz a reunião na ordem certa**:

```
PAUTA DA SEMANA · 27/10 a 31/10                    gerado em 27/10 07:30
─────────────────────────────────────────────────────────────────────────
1. PROBLEMAS (decidir hoje)
   🔴 Ed. Aurora (SPDA) · atrasada 4 dias · Captores · motivo: chuva (pausa 22/10)
   🟠 Ind. XYZ · em risco · material sem data, etapa "Quadros" começa 30/10
   ⚠  Cond. Jardim Sul · técnico pediu replanejamento: "acesso só após 14h"

2. O QUE COMEÇA ESTA SEMANA (conferir material e equipe)
   28/10 Galpão Logística · Fundação · resp. Maria · material ✓
   30/10 Ind. XYZ · Quadros · resp. — (SEM RESPONSÁVEL)

3. O QUE TERMINA ESTA SEMANA (confirmar entrega/faturamento)
   31/10 Cond. Jardim Sul · SPDA · entrega prevista

4. CARGA DA EQUIPE
   João 112% ⚠ · Maria 64% · (sem técnico) 10 h

5. NÚMEROS DA SEMANA PASSADA
   Atividades concluídas no prazo: 82% · Pausas: 5 (3 por falta de material)
```

**Por que ajuda:** a reunião fica mais curta (começa pelos problemas), ninguém esquece de checar material e equipe do que vai começar, e o PDF vira registro do que foi combinado.

**Passo a passo:**
1. `planejamento/exportacao.js`: nova função `exportarPautaSemanal({ inicio, fim })`, usando o jsPDF que já é carregado sob demanda.
2. Dados: obras com saúde 🔴/🟠/⚠ (2.3), etapas com início ou fim na semana, carga (2.6) e indicadores (4.2).
3. Botão "Pauta da semana" no topo do Planejamento Macro.
4. Aproveitar para incluir **responsável** na exportação atual de etapas (Excel/PDF), que hoje não traz essa coluna.

### 2.9 Capacidade produtiva em horas técnicas (sugerida por você)

**A ideia:** cadastrar quantas horas cada colaborador tem disponíveis e quantas horas cada atividade consome. Com isso o sistema calcula **capacidade × demanda** e responde:
- "Temos equipe para assumir este contrato em novembro?" (Execução e Comercial)
- "Quantas semanas de trabalho temos vendidas?" (painel 2.1)
- "Quanto faturamos por hora técnica em cada tipo de serviço?" (futuro dash financeiro/gestão)

> **Revisado após feedback: sem cronômetro para o técnico.** As horas **não** dependem de o colaborador iniciar e pausar tarefas. Funciona assim:
> - **Horas previstas** são definidas **no planejamento**: no template e na prévia do cronograma (1.3).
> - **Horas disponíveis** de cada colaborador já são **líquidas**: **jornada bruta − descontos**. A jornada da empresa é **07:00–12:00 e 13:15–17:00 = 8h45/dia**, já sem o almoço. Os **descontos** (ex.: deslocamento, café, almoxarifado, DDS) são **editáveis pelo admin** e a conta é feita automaticamente (ver "Jornada e descontos" abaixo).
> - **Hora extra:** até **2 h/dia** além da jornada (capacidade máxima de 10h45/dia). **Sábado, domingo e feriado** ficam com **0 h** na capacidade normal e só são usados como **emergência**.
> - Ao **concluir**, as horas realizadas assumem as **previstas** automaticamente. O técnico só mexe se a atividade levou bem mais ou bem menos.

**Como fica em cada tela:**

```
TEMPLATE (aba Templates)                         CADASTRO (prévia 1.3)
# Etapa              Horas  Técnicos  Dias*      # Etapa            Horas  Téc.  Início  Fim    Resp.
1 Inspeção e Projeto   6h      1      1 d        1 Inspeção...       6h    1    28/10   28/10  João
2 Captores            16h      2      2 d        2 Captores         16h    2    29/10   30/10  João+Maria
3 Descidas            20h      2      2 d        ...  (horas editáveis por obra)
* dias sugeridos = horas ÷ (técnicos × horas disponíveis/dia), arredondado para cima; editável

CONCLUSÃO (técnico, 3.3)
Horas: 6 h previstas   [Levou diferente? ✎]   (um toque abre: 4 h · 6 h · 8 h · outro)
```

#### Jornada e descontos (editáveis pelo admin)

```
┌ Equipe → Capacidade → Jornadas ───────────────────────────────────────────┐
│ Modelo: [Padrão Execução ▾]                     vigente desde [01/11/2026] │
│ Horários:  07:00–12:00 · 13:15–17:00  (seg a sex)       Bruto: 8h45/dia    │
│ Descontos:                                                                 │
│   Deslocamento entre obras ........ [45] min   ✎ 🗑                        │
│   Café / pausas curtas .............. [15] min  ✎ 🗑                        │
│   Almoxarifado / carregar material .. [15] min  ✎ 🗑                        │
│   [+ adicionar desconto]                                                   │
│                                    Disponível líquido: 7h30/dia            │
│ Hora extra: até [2] h/dia · Sáb/Dom/Feriado: só emergência                 │
│                                                                            │
│ Aplicado a: João, Maria, Pedro (padrão)  ·  Exceções: Ana → modelo "Meio período" │
└────────────────────────────────────────────────────────────────────────────┘
```
(Os minutos acima são só exemplo; os valores reais são definidos pelo admin.)

- **Modelos de jornada:** o admin cria um modelo (ex.: "Padrão Execução") com os horários e a lista de descontos, e o aplica a todos. Para quem tem jornada diferente, usa outro modelo (ex.: "Meio período") ou um ajuste individual.
- **Vigência:** mudar a jornada ou os descontos cria uma **nova versão a partir de uma data**. O passado não é recalculado, então os indicadores de meses anteriores continuam corretos.
- **Cidade-base:** o modelo indica a cidade-base da equipe, usada para aplicar os feriados municipais à capacidade (1.5).
- Toda alteração fica no histórico (5.1).

**Modelo de dados proposto** (simples, reaproveitável depois):

```sql
-- Modelos de jornada (horários + descontos editáveis), versionados por vigência
CREATE TABLE public.execucao_jornadas_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  vigente_desde date NOT NULL,
  periodos jsonb NOT NULL,   -- ex.: {"seg":[["07:00","12:00"],["13:15","17:00"]], ..., "sab":[], "dom":[]}
  descontos jsonb NOT NULL DEFAULT '[]', -- ex.: [{"descricao":"Deslocamento","minutos":45}, ...] (minutos por dia útil)
  horas_extra_max_dia numeric(4,2) NOT NULL DEFAULT 2,
  cidade_base_id uuid REFERENCES public.execucao_cidades(id),  -- feriados municipais da capacidade (1.5)
  UNIQUE (nome, vigente_desde)
);

-- Qual modelo vale para cada colaborador (com ajuste individual opcional)
CREATE TABLE public.execucao_jornadas_colaborador (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  vigente_desde date NOT NULL,
  modelo_nome text NOT NULL,                 -- usa a versão do modelo vigente em cada data
  ajuste_minutos_dia int NOT NULL DEFAULT 0, -- + ou − em relação ao modelo (exceções individuais)
  PRIMARY KEY (usuario_id, vigente_desde)
);
-- Horas disponíveis do dia = soma dos períodos − soma dos descontos + ajuste individual
--   (0 em sábado, domingo, feriado e ausência)

-- Férias, atestados, treinamentos (zeram ou reduzem as horas disponíveis no período)
CREATE TABLE public.execucao_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  data_inicio date NOT NULL, data_fim date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ferias', 'atestado', 'treinamento', 'folga', 'outro')),
  horas_por_dia numeric(4,2), -- nulo = dia inteiro
  observacao text
);

-- Horas PREVISTAS (homem-hora): definidas no template, herdadas e ajustáveis na etapa/atividade
ALTER TABLE public.execucao_templates_etapas_itens ADD COLUMN horas_previstas numeric(6,2), ADD COLUMN qtd_tecnicos int NOT NULL DEFAULT 1;
ALTER TABLE public.execucao_obras_etapas          ADD COLUMN horas_previstas numeric(6,2), ADD COLUMN qtd_tecnicos int NOT NULL DEFAULT 1;
ALTER TABLE public.execucao_atividades            ADD COLUMN horas_previstas numeric(6,2),
                                                  ADD COLUMN horas_realizadas numeric(6,2),      -- = previstas ao concluir, salvo ajuste
                                                  ADD COLUMN horas_ajustadas boolean NOT NULL DEFAULT false;
```

**Como os números são obtidos sem trabalho extra para o técnico:**

| Número | De onde vem | Quem informa |
|---|---|---|
| Horas disponíveis no dia | Jornada líquida do dia − ausências − feriados (1.5) | Gestor, uma vez por colaborador |
| Horas previstas da etapa | Template (padrão) → ajustável na prévia 1.3 ou ao editar a etapa | Planejador, ao montar o cronograma |
| Horas por dia na agenda | Horas previstas ÷ dias úteis da etapa ÷ nº de técnicos | Calculado |
| Horas realizadas | Iguais às previstas ao **concluir**; o técnico só ajusta se foi diferente | Automático (ajuste opcional) |

**O que muda para o técnico:** **nada de cronômetro.** "Iniciar" continua existindo, mas é **opcional**: serve só para o gestor ver quem está em campo. "Pausar" é só para **impedimentos** (falta de material, chuva...), não para controlar horas. O técnico pode concluir direto.

**Indicadores que passam a existir:**

| Indicador | Fórmula | Uso |
|---|---|---|
| Ocupação da equipe | horas previstas alocadas ÷ horas disponíveis | Saber se cabe mais serviço (2.6) |
| Horas extras e de emergência | horas alocadas acima da jornada / em fim de semana ou feriado | Custo extra e sinal de equipe subdimensionada |
| Capacidade livre (próximos 30 dias) | horas disponíveis − horas previstas | Resposta rápida ao Comercial: "conseguimos começar dia X" |
| Semanas de carteira | horas previstas das obras abertas ÷ horas disponíveis por semana | Painel 2.1; ritmo de vendas × capacidade |
| Receita por hora técnica | `valor_contrato` ÷ horas (realizadas, ou previstas enquanto a obra está aberta) | Precificação por tipo de serviço (dash financeiro) |
| Desvio de horas | horas realizadas ÷ previstas, **só nas atividades em que houve ajuste** | Calibrar templates (4.3) |

**Cuidados:**
- **Horas extras e emergências** seguem o fluxo de registro, justificativa e aprovação do item **2.10**; só as **aprovadas** entram nos indicadores de horas extras.
- **Qualidade do realizado:** como o realizado assume o previsto, o desvio só aparece se alguém ajustar quando a atividade foge do normal. Duas formas de garantir isso sem burocracia: (a) o ajuste do técnico na conclusão é **um toque** com valores sugeridos; (b) o gestor pode revisar/ajustar as horas das atividades concluídas na semana (aproveitando a pauta 2.8).
- **Custo por hora** (salário + encargos) é dado sensível: se for usado no futuro, deve ficar numa tabela separada, visível só para o Administrador (RLS própria) e alinhado à LGPD.
- **Equipes (resposta 2: 1 ou N técnicos):** resolvido pelo item **1.7**. As horas previstas da atividade são divididas entre os participantes (igualmente, por padrão).
- **Hora extra e emergência:** horas acima da jornada líquida num dia útil, ou em sábado/domingo/feriado, geram um registro com justificativa e aprovação (**2.10**). Isso alimenta dois indicadores para a gestão e o futuro dash financeiro: **horas extras aprovadas** e **horas de emergência no mês**.
- **Começar simples:** na primeira versão, horas previstas nos templates e jornada padrão igual para todos; ausências e jornadas individuais depois.

**Passo a passo:**
1. Migrações acima, com RLS no padrão (admin gerencia jornadas e ausências; técnico vê as próprias e ajusta só as horas das próprias atividades).
2. **Template (0.1):** colunas **Horas** e **Técnicos** em cada item; a coluna **Dias** passa a ser sugerida a partir das horas (editável).
3. **Prévia do cronograma (1.3) e Serviço rápido (1.4):** horas herdadas do template, editáveis; ao mudar as horas ou o nº de técnicos, as datas da prévia se ajustam.
4. **Sincronização com a agenda:** `horas_previstas` passa da etapa para a atividade.
5. **Conclusão (3.3):** preencher `horas_realizadas = horas_previstas`, com o atalho "Levou diferente?".
6. Tela **Equipe → Capacidade** (aba em "Desempenho do Time"): **modelos de jornada com descontos editáveis**, vínculo de cada colaborador ao modelo, horas disponíveis resultantes e calendário de ausências.
7. RPC `execucao_capacidade(p_inicio, p_fim)`: disponível × previsto × realizado por pessoa e por dia. Usada pela carga (2.6), pelo painel (2.1) e pelos indicadores (4.2).
8. Para o futuro dash financeiro/gestão: expor uma **view só de leitura** (`vw_execucao_horas_por_obra`), para não acoplar o novo dashboard às tabelas internas.

### 2.10 Horas extras e emergências: registro, justificativa e aprovação

**Regra definida pelo time:** quem gera a hora extra ou a emergência **registra com justificativa**; depois, um **admin aprova ou cancela, também com justificativa**. Não bloqueia o trabalho: a atividade segue agendada enquanto a aprovação está pendente.

**Quando o registro é criado (automaticamente, pedindo só a justificativa):**

| Situação | Quem registra | Tipo |
|---|---|---|
| Planejador aloca mais de 8h45 (jornada líquida) num dia útil para um técnico | Planejador, ao salvar a agenda, etapa ou prévia | **Hora extra planejada** |
| Planejador marca atividade em sábado, domingo ou feriado | Planejador | **Emergência** |
| Técnico conclui informando mais horas do que o previsto e o dia passa da jornada ("Levou diferente?", 2.9) | Técnico, na conclusão (funciona offline) | **Hora extra realizada** |
| Técnico é acionado para emergência fora do planejado | Técnico ou admin | **Emergência** |

Acima do limite de **2 h extras/dia**, o sistema avisa (*"Ultrapassa o limite diário de 2 h extras"*), mas permite registrar com justificativa, pois emergências acontecem.

**Fluxo:**

```
[Registro + justificativa] ──► 🟡 Pendente ──► Admin: [✔ Aprovar] ou [✖ Cancelar] + justificativa
                                                      │                  │
                                                🟢 Aprovada        🔴 Cancelada
                                         (conta nos indicadores)  (não conta; quem registrou é avisado)
```

```
┌ Horas extras e emergências ────────────────────── 3 pendentes ┐
│ [Pendentes] [Aprovadas] [Canceladas]   Período: [Out/2026 ▾]   │
├────────────────────────────────────────────────────────────────┤
│ ☐ 29/10 João   +1h30 extra   Ind. XYZ · Quadros               │
│        "Cliente liberou acesso só às 15h"  (registrado por Fábio)│
│ ☐ 01/11 Maria  4h emergência (sábado) · Cond. Jardim Sul       │
│        "Queda de energia no condomínio"   (registrado por Maria) │
│                         [✖ Cancelar selecionadas] [✔ Aprovar selecionadas] │
└────────────────────────────────────────────────────────────────┘
```

- **Aprovar/cancelar em lote**, com uma justificativa para o grupo.
- **Quem registrou é notificado** da decisão, com a justificativa.
- **Autoaprovação:** como todos os admins têm o mesmo nível, um admin pode aprovar algo que ele mesmo registrou. O sistema permite, mas **marca "autoaprovado"** no histórico, para dar transparência.
- Badge com o número de pendentes no menu e no painel da carteira (2.1, em "Pendências").
- Tudo fica no histórico de alterações (5.1).

**Passo a passo:**
1. Migração:
   ```sql
   CREATE TABLE public.execucao_horas_extras (
     id uuid PRIMARY KEY,                          -- gerado no app (permite registro offline pelo técnico)
     usuario_id uuid NOT NULL REFERENCES public.usuarios(id),         -- quem fez/fará as horas
     atividade_id uuid REFERENCES public.execucao_atividades(id) ON DELETE SET NULL,
     data date NOT NULL,
     horas numeric(5,2) NOT NULL CHECK (horas > 0),
     tipo text NOT NULL CHECK (tipo IN ('extra_planejada', 'extra_realizada', 'emergencia')),
     justificativa text NOT NULL CHECK (length(trim(justificativa)) >= 5),
     registrado_por uuid NOT NULL REFERENCES public.usuarios(id),
     status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'cancelada')),
     justificativa_decisao text,
     decidido_por uuid REFERENCES public.usuarios(id),
     decidido_em timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (status = 'pendente' OR (decidido_por IS NOT NULL AND length(trim(coalesce(justificativa_decisao, ''))) >= 5))
   );
   CREATE INDEX ON public.execucao_horas_extras (status, data);
   ```
   RLS: o técnico vê e cria registros **dele**; o admin vê todos, cria e decide. A decisão é feita por RPC `decidir_horas_extras(p_ids uuid[], p_aprovar boolean, p_justificativa text)`, que valida `is_admin_execucao()`, grava quem decidiu e notifica.
2. **Detecção no planejamento:** ao salvar agenda, etapa, prévia ou deslocamento (2.5), a RPC de capacidade (2.9) compara as horas alocadas com a jornada do dia. Se passar, ou se for dia não útil, o app abre o campo de justificativa antes de concluir o salvamento.
3. **Detecção na conclusão:** em `ConcluirAtividade.jsx`, se o ajuste de horas fizer o dia passar da jornada, pedir a justificativa ali mesmo. O registro entra na fila offline (3.6).
4. Tela **Gestão → Horas extras e emergências**, com abas Pendentes/Aprovadas/Canceladas, seleção em lote e modal de justificativa obrigatória.
5. Indicadores (2.9 e 4.2): **horas extras aprovadas** e **horas de emergência** por mês, por colaborador e por obra. Pendentes aparecem à parte.

**Aceite:** o planejador aloca 10 h para João numa quarta; o sistema pede a justificativa e cria um registro pendente de 1h15; outro admin aprova com justificativa; João é notificado; a hora extra aparece no indicador do mês.

---

## 7. Fase 3: tela do técnico (≈ 19 dias)

**Objetivo:** com o celular na mão, em campo e **mesmo sem internet**, o técnico sabe o que fazer, chega ao local, executa e registra com fotos e vídeos, **sem ligar para o escritório**. Quando o sinal volta, tudo sincroniza sozinho.

> **Confirmado com você:** os técnicos frequentemente trabalham em locais de difícil acesso, sem sinal. Por isso o **modo offline (3.6)** sai de "opcional" e vira parte central desta fase, e o **PWA (3.5)** é a base dele.

### 3.1 "Meu dia" mobile-first

Hoje: Visão Geral → Minhas Atividades (abas Hoje/Semana/Todas) → card → detalhe → ação. Os cards e botões não têm tamanho mínimo de toque e o endereço vem cortado.

```
┌──────────────────────────────┐
│ Hoje, qui 23/10   3 atividades│
│ ● Offline · 2 envios pendentes│  ← aparece só sem internet (3.6)
├──────────────────────────────┤
│ 08:00  SPDA · Dia 2 de 4      │
│ Cond. Jardim Sul              │
│ R. das Flores, 120 – Centro   │
│ ┌────────┬────────┬────────┐  │
│ │🧭 Rota │📞 Ligar│📘 POP  │  │
│ └────────┴────────┴────────┘  │
│ 📦 Material: disponível ✓     │
│ [      ✔ CONCLUIR          ]  │
├──────────────────────────────┤
│ 14:00  Medição Ôhmica         │
│ ...                           │
├──────────────────────────────┤
│ Amanhã: 2 atividades  ›       │
└──────────────────────────────┘
```

**Passo a passo:**
1. Para o perfil TÉCNICO, a **página inicial passa a ser "Meu dia"**. Hoje ele cai na Visão Geral, que traz contadores e atalhos, mas obriga mais um clique para chegar ao que fazer. Ajuste em `ExecucaoDashboard.jsx` (página padrão por perfil).
2. `components/tecnico/MeuDia.jsx` + `CardAtividadeCampo.jsx`: endereço completo, ações 0.4, POP vinculado (3.3), status do material (3.4), botão principal **grande** **Concluir** (o técnico pode concluir direto; "Iniciar" é opcional e só sinaliza ao gestor que ele está em campo; "Pausar" é ação secundária, só para impedimentos). Nenhum cronômetro (2.9).
3. CSS: alvos de toque ≥ 44 px, fonte ≥ 16 px nos campos (evita zoom automático ao tocar) e barra de ação fixa no rodapé do detalhe.
4. Bloco **"Amanhã"** no fim, para o técnico se preparar (e para os dados de amanhã já ficarem guardados no celular, ver 3.6).
5. Manter "Minhas Atividades" (semana/todas) como está, acessível pelo menu.

### 3.2 Motivos de pausa padronizados

**Hoje:** o motivo é texto livre, o que impede saber **por que** as atividades travam.

**Passo a passo:** chips de seleção rápida (**Falta de material · Cliente ausente/sem acesso · Chuva/clima · Aguardando outra equipe · Problema técnico · Outro**) mais um texto opcional. Gravar em `execucao_atividades_historico` uma coluna nova `motivo_codigo text`, que alimenta o Pareto de 4.2.

### 3.3 Conclusão com fotos, vídeos, áudios e checklist do POP

Hoje a comprovação do que foi feito em campo fica no WhatsApp do técnico. **Requisitos confirmados:**
- fotos, vídeos e áudios na finalização, com compressão para economizar armazenamento;
- **localização, data e hora** em cada evidência (resposta 9).

O uso é **interno** (registro e comprovação do serviço); o que é entregue ao cliente não faz parte deste dashboard (resposta 5).

```
┌ Concluir atividade ─────────────────────┐
│ Checklist (POP Medição Ôhmica)          │
│ ☑ Medir resistência do aterramento*     │
│ ☑ Registrar valores no formulário*      │
│ ☐ Limpar caixa de inspeção              │
│                                         │
│ Evidências  (3 fotos · 1 vídeo · 1 áudio)│
│ [📷 Foto] [🎥 Vídeo] [🎙 Áudio] [🖼 Galeria]│
│ ▢ ▢ ▢ ▶ 🔊0:42                          │
│                                         │
│ Observação: [                         ] │
│ Horas: 6 h previstas  [Levou diferente?]│  ← 2.9, sem cronômetro
│          [Cancelar]  [✔ Concluir]       │
└─────────────────────────────────────────┘
* obrigatórios
```

**Áudio:** útil para o técnico relatar o que viu sem digitar (mãos ocupadas, luva, chuva). É gravado direto no app (`MediaRecorder`), com limite sugerido de **3 min por áudio**. No Android, o áudio é gravado em WebM/Opus, já compactado. Mais adiante, os áudios podem ser **transcritos em texto** para facilitar a busca, sem que ninguém precise ouvir de novo.

#### Compressão: no próprio celular, gratuita e sem servidor extra

> **Revisado após feedback:** em vez de um serviço de compressão no servidor, **toda a compressão acontece no celular, antes do envio**, com bibliotecas gratuitas e de código aberto. Não há servidor extra, custo mensal nem dados de clientes passando por terceiros. E, como o arquivo já sai pequeno do celular, **o envio com sinal fraco fica mais rápido** e a fila offline (3.6) ocupa menos espaço. Comprimir no servidor só reduziria o armazenamento; comprimir no celular reduz o armazenamento **e** o envio.

**Por que não dá para fazer "dentro do Supabase":** as Edge Functions do Supabase têm limite de **2 segundos de CPU** por chamada e 150–256 MB de memória, e não executam programas como o `ffmpeg`. Recodificar vídeo ali não é viável. A transformação de imagens do Supabase (planos pagos) só redimensiona na hora de exibir; o arquivo guardado continua grande. Não existe hoje uma extensão nativa de compressão de vídeo no Supabase.

| Mídia | Como comprime | Ferramenta (gratuita) | Resultado típico |
|---|---|---|---|
| **Foto** | Redimensiona (lado maior 1920 px) e recomprime (JPEG/WebP ~80%) antes de enviar | [`browser-image-compression`](https://www.npmjs.com/package/browser-image-compression) (MIT) | 4–5 MB → **300–400 KB** |
| **Áudio** | Gravado **já comprimido** dentro do app, com taxa baixa de voz (32 kbps) | `MediaRecorder`, nativo do navegador, sem biblioteca | 1 min ≈ **240–500 KB** (não precisa de etapa extra) |
| **Vídeo** | Recodifica no celular para 720p ~1,5–2 Mbps, usando o **hardware de vídeo do aparelho** | [`mediabunny`](https://mediabunny.dev) (código aberto, usa a API WebCodecs do navegador) | 60 s: 80–130 MB → **10–15 MB** |

**Detalhes que importam:**
- **Vídeo, compatibilidade (resposta 8: todos os celulares do time são Android):** a compressão via WebCodecs funciona no **Chrome do Android** atualizado, que é o cenário mais estável para essa tecnologia. Os problemas relatados com o áudio do vídeo comprimido aconteceram no Safari do iPhone, que não é usado pelo time. Mesmo assim, vale testar nos aparelhos reais.
- **Plano de contingência automático:** se o aparelho não suportar ou a compressão falhar, o vídeo é enviado **como está**, respeitando o **limite de 60 s**. Nada se perde, só fica maior.
- **Tempo e bateria:** comprimir 60 s de vídeo leva, em geral, de alguns segundos a cerca de meio minuto num celular recente, com uma barra "Otimizando vídeo...". Acontece uma vez, antes de entrar na fila de envio, e **funciona offline**.
- **Localização, data e hora (resposta 9):** no momento da captura, o app registra a data/hora do aparelho e a localização (GPS, com a precisão em metros). Isso fica salvo junto da evidência e é **gravado como carimbo visível no canto da foto** (`23/10/2026 14:32 · -23.5505, -46.6333 · ±8 m`), aproveitando o mesmo passo da compressão. Se o GPS não responder em poucos segundos (ex.: dentro de subsolo), a foto é salva com "localização indisponível", sem travar o técnico.
- **Privacidade (LGPD):** a localização é capturada **só no momento da foto/vídeo/áudio**; não há rastreamento contínuo. Recomenda-se informar os colaboradores por escrito (ex.: comunicado ou termo de ciência) sobre essa coleta e sua finalidade.
- **Miniaturas:** a miniatura de foto e o quadro de capa do vídeo são gerados no celular (canvas) e enviados junto, também de graça.
- **Originais:** como só o arquivo comprimido sobe, não há original pesado para apagar depois.

> **Se um dia precisar de mais** (ex.: padronizar todos os vídeos num único formato), o desenho com um pequeno serviço `ffmpeg` no servidor continua possível como evolução. **Não é necessário para começar.**

**Economia estimada:** com ~25 obras/mês e, por exemplo, 6 fotos + 1 vídeo + 1 áudio por obra, o volume fica em **~400 MB/mês**, em vez de 3–4 GB sem compressão.

**Passo a passo:**
1. Migrações:
   ```sql
   ALTER TABLE public.execucao_templates_etapas_itens ADD COLUMN pop_id uuid REFERENCES public.execucao_pops(id);
   ALTER TABLE public.execucao_obras_etapas          ADD COLUMN pop_id uuid REFERENCES public.execucao_pops(id);
   ALTER TABLE public.execucao_pops ADD COLUMN checklist jsonb NOT NULL DEFAULT '[]'; -- [{ "item": "Medir resistência de aterramento", "obrigatorio": true }]

   CREATE TABLE public.execucao_atividades_evidencias (
     id uuid PRIMARY KEY,                       -- gerado no celular (envio offline sem duplicar)
     atividade_id uuid NOT NULL REFERENCES public.execucao_atividades(id) ON DELETE CASCADE,
     tipo text NOT NULL CHECK (tipo IN ('foto', 'video', 'audio', 'checklist', 'observacao')),
     caminho_storage text, caminho_miniatura text,
     mime_type text, tamanho_original_bytes bigint, tamanho_bytes bigint, duracao_segundos int,
     comprimido boolean NOT NULL DEFAULT false, -- false = aparelho não suportou e o arquivo subiu como estava
     conteudo jsonb,                            -- checklist marcado / observação / transcrição futura do áudio
     capturado_em timestamptz,                  -- quando foi feito no campo (não quando sincronizou)
     latitude numeric(9,6), longitude numeric(9,6), precisao_metros numeric(7,1),
     criado_por uuid REFERENCES public.usuarios(id),
     created_at timestamptz DEFAULT now()
   );
   ```
   Bucket privado `atividades-evidencias` com RLS no padrão (técnico grava nas próprias atividades; admin lê tudo; visualização por URL assinada). Definir no bucket um **limite de tamanho por arquivo** (ex.: 50 MB) como proteção.
2. `npm i browser-image-compression mediabunny` e um módulo `src/features/execucao/midia/comprimir.js` com `comprimirFoto(file)`, `comprimirVideo(file, { onProgresso })` (com contingência) e `gerarMiniatura(file)`. Carregar essas bibliotecas **sob demanda** (`import()`), como já é feito com o PDF/Excel, para não pesar a abertura do app.
3. `src/features/execucao/midia/gravadorAudio.js` com `MediaRecorder` (`audioBitsPerSecond: 32000`), limite de 3 min e indicador de tempo.
4. `components/atividade/ConcluirAtividade.jsx` com checklist do POP (itens obrigatórios bloqueiam a conclusão), botões **Foto / Vídeo / Áudio / Galeria**, barra "Otimizando..." por arquivo, observação e horas (2.9). Por tipo de serviço, configurar o mínimo de evidências (ex.: Medição Ôhmica/SPDA ≥ 2 fotos). Pedir a permissão de localização na primeira captura, com texto explicando o motivo.
5. Arquivos comprimidos entram na **fila do modo offline (3.6)**; vídeos usam **envio retomável** (protocolo TUS do Supabase Storage).
6. A etapa herda o POP do item do template; a atividade mostra o botão **📘 POP**.
7. No detalhe da obra, aba **Evidências**: galeria de fotos, vídeos (com player) e áudios de todas as etapas, por data, com data, hora, autor e um link "ver no mapa" para a localização de cada uma.
8. **Teste obrigatório antes de liberar:** gravar e comprimir vídeo com som nos celulares Android reais do time (incluindo o modelo mais antigo) e conferir se o áudio do vídeo saiu correto e se a localização foi capturada.
9. **Armazenamento:** liberar vídeos só depois da decisão do item **0.6** (plano do Supabase).

**Aceite:** o técnico conclui com 3 fotos, 1 vídeo de 60 s e 1 áudio, mesmo offline. Ao sincronizar, a galeria da obra mostra tudo, e o vídeo ocupa menos de 15 MB nos aparelhos compatíveis.

### 3.4 Material visível ao técnico e aviso de falta de material

**Hoje:** o pedido de material existe e se liga à obra/etapa, mas o técnico não vê nem consegue avisar que falta algo.

**Passo a passo:**
1. No card, indicador **📦 Material: disponível ✓ / previsto para 30/10 / pendente**, a partir do pedido vinculado à mesma obra.
2. Botão **"Falta material"** no detalhe da atividade, em três toques:
   - o técnico escreve ou dita o que falta e pode anexar uma foto (ex.: da peça ou etiqueta);
   - o sistema cria um pedido `pendente`, vinculado à atividade e à obra, com urgência **alta**;
   - pergunta *"Pausar a atividade até o material chegar?"* e, se sim, pausa com o motivo "Falta de material" (3.2).
3. O admin recebe notificação na hora (ou assim que o celular sincronizar, se estiver offline) e o pedido aparece em destaque na tela de Pedido de Material e no painel 2.1 (Pendências → material).
4. Quando o admin marca o material como disponível, o técnico vê o card mudar para **📦 disponível ✓** e recebe uma notificação.
5. Permissão: política RLS de INSERT em `execucao_pedidos_material` para o técnico, restrita a `solicitante_id = current_usuario_id()`.

### 3.5 Instalável no celular (PWA)

O técnico "instala" o sistema na tela inicial do celular (o time usa **Android**), com ícone próprio, abrindo em tela cheia, sem barra do navegador, como um aplicativo, mas **sem passar por loja de aplicativos** e com atualização automática a cada publicação.

**Passo a passo:**
1. Adicionar `vite-plugin-pwa` (gera o `manifest.webmanifest` e o service worker a partir do `vite.config.js`).
2. Ícones (192 px e 512 px, mais o ícone "maskable" do Android), nome "Effort Execução", cor de tema e `start_url` apontando para `#/execucao`.
3. Aviso "Nova versão disponível, toque para atualizar" quando houver publicação nova.
4. Instrução de 1 minuto para o time: abrir o sistema no Chrome do Android → menu ⋮ → **"Instalar app"** (o Chrome também oferece a instalação sozinho, num aviso na parte de baixo da tela).

### 3.6 Modo offline com sincronização automática

**Como o técnico percebe:**
- Sem sinal, o app **continua abrindo** e mostrando o "Meu dia" e o "Amanhã".
- Ele pode **iniciar, pausar, concluir, comentar, marcar checklist, tirar fotos e gravar vídeos** normalmente.
- Uma faixa discreta mostra **"Offline · 4 envios pendentes"**.
- Quando o sinal volta (ou ao abrir o app com internet), tudo é enviado sozinho, **na ordem em que aconteceu e com o horário real**, e a faixa some.

**Como funciona por trás (arquitetura):**

```
Celular                                              Supabase
┌──────────────────────────────────────┐
│ Tela "Meu dia"                       │
│   lê de ↓                            │
│ Cache local (IndexedDB)              │ ← atualizado sempre que há sinal
│   atividades de hoje e amanhã, POPs, │   (hoje + próximos dias + POPs)
│   contatos, endereços                │
│                                      │
│ Fila de envio (IndexedDB)            │ ── quando há sinal ──► RPCs / Storage
│   [concluir 11:40] [foto 1] [vídeo 1]│    em ordem, com horário real,
│   [áudio 1] [horas 6h (previstas)]   │    sem duplicar (id gerado no celular)
└──────────────────────────────────────┘
```

**Passo a passo:**
1. **Base PWA (3.5):** o service worker guarda os arquivos do próprio app, para abrir sem internet.
2. **Cache de dados:** biblioteca `idb` ou `Dexie` (IndexedDB). Ao abrir com sinal (e a cada ~15 min em uso), baixar e guardar as atividades do técnico de **hoje até +3 dias**, os POPs vinculados, contatos e endereços. As telas do técnico passam a ler do cache e atualizam quando chega dado novo.
3. **Fila de envio (outbox):** toda ação do técnico vira um item da fila com `{ id gerado no celular, tipo, dados, ocorrido_em }`. Fotos e vídeos ficam guardados no próprio IndexedDB até o envio.
4. **Sincronização:** processar a fila ao recuperar a conexão (evento `online`), ao abrir o app e ao voltar o app para a frente. Como o time usa **Android**, também dá para usar o *Background Sync* do Chrome: a fila é enviada **mesmo com o app fechado**, assim que o celular encontra sinal.
5. **Ajustes no banco para aceitar ações atrasadas sem duplicar:**
   - a RPC `alterar_status_atividade` ganha `p_ocorrido_em timestamptz` (o horário real em campo vai para o histórico e para as datas reais de início/fim do item 2.4) e `p_id_cliente uuid` (chave de idempotência: reenviar a mesma ação não a repete);
   - comentários e evidências usam o `id` gerado no celular, então um reenvio vira "já existe" em vez de duplicar.
6. **Conflitos (regras simples e previsíveis):**
   - se o admin **transferiu** a atividade para outro técnico enquanto este estava offline, a ação é recusada e o técnico vê *"Esta atividade foi transferida para Maria"*. As fotos e comentários **não se perdem**: ficam registrados na atividade;
   - se o admin **remarcou** a data, a ação do técnico vale (o trabalho foi feito) e o admin é notificado;
   - o servidor é sempre a fonte da verdade para dados de planejamento; o celular é a fonte da verdade para o que foi feito em campo.
7. **Login expirado offline:** a sessão do Supabase se renova sozinha quando há sinal. Se expirar durante dias offline, a fila **é preservada** e é enviada depois do novo login.
8. **Limites do aparelho:** o app pede **armazenamento persistente** (`navigator.storage.persist()`), que o Chrome concede a apps instalados (3.5), para o Android não apagar a fila quando o celular estiver com pouco espaço. Mesmo assim, vale exibir um aviso se o espaço livre do celular estiver baixo e orientar o time a abrir o app com sinal ao final do dia.

**Aceite:** em modo avião, o técnico inicia, conclui com 3 fotos e 1 vídeo e comenta; ao desligar o modo avião, tudo aparece para o admin com os horários reais de campo, sem duplicidade.

---

## 8. Fase 4: gestão e melhoria contínua (≈ 6 dias)

### 4.1 Reatribuir técnico direto na lista

Em **Atividades do Dia**, um seletor de técnico em cada linha (troca imediata, usando `transferirAtividade`, que já registra no histórico) e um **filtro por técnico**. Evita abrir a agenda e editar a atividade só para trocar a pessoa.

### 4.2 Desempenho acionável

As telas atuais mostram volume e taxa de conclusão. Proposta de indicadores **que geram ação**, calculados com dados que **já existem** no histórico:

| Indicador | Cálculo | Ação que permite |
|---|---|---|
| **Pontualidade** | % de atividades concluídas até `COALESCE(data_fim, data_programada)` | Identificar onde o planejamento está otimista |
| **Causas de pausa** (Pareto) | Contagem por `motivo_codigo` (3.2) | Atacar a causa principal (ex.: material → antecipar compras) |
| **Horas realizadas × previstas** por tipo de serviço | `horas_realizadas ÷ horas_previstas` nas atividades com ajuste (2.9) | Calibrar templates (4.3) |
| **Obras entregues no prazo** | `data_fim_real <= data_fim_prevista` (2.4) | Indicador de cliente/comercial |
| **Lead time contrato → início** | `obra.data_inicio_real − apontamento.created_at` | Saber se os contratos novos (1.1) estão sendo planejados a tempo |

Cada número é clicável e abre a lista de atividades/obras correspondente. O ranking de técnicos por volume deve ser usado com cautela: ele premia quantidade, não qualidade nem atividades difíceis.

### 4.3 Calibrar as horas dos templates com o realizado

Na aba Templates, ao lado das horas previstas de cada item: **"Realizado médio: 7,5 h (12 execuções, 4 com ajuste)"** e o botão **"Usar média"**. A média usa as horas realizadas da conclusão (2.9), que só diferem das previstas quando alguém ajusta. Por isso o número de ajustes aparece junto, para indicar o quanto a média é confiável. Fecha o ciclo: quanto mais o sistema é usado, mais realista fica o planejamento.

### 4.4 Status da execução em tempo real no dashboard Comercial

**A ideia:** o Comercial vende e depois perde a visibilidade do que acontece com o contrato. Uma **nova seção no dashboard Comercial** mostra, para cada contrato fechado, em que pé está a execução. Assim o vendedor acompanha o cliente, sabe quando faturar parcelas e quando pedir avaliação ou indicação, **sem perguntar à Execução**.

**Onde entra (verificado no código):** o Dashboard V2 do Comercial já tem o card **"Fechados recentes"** (`features/dashboard-v2/components/ClientesFechados.jsx`). A proposta tem três pontos de contato:

1. **Selo de status em cada contrato** de "Fechados recentes" e na lista de Apontamentos: `Aguardando planejamento` · `Planejada (início 28/10)` · `Em execução 60%` · `⚠ Atrasada` · `✔ Concluída 12/11`.
2. **Nova seção "Execução dos contratos"** no Dashboard V2:

```
┌ Execução dos contratos ──────────────────────────────────── ● ao vivo ┐
│ Aguardando planejamento 5 │ Planejadas 8 │ Em execução 14 │ Concluídas no mês 11 │
├─────────────────────────────────────────────────────────────────────────┤
│ Cliente               Serviço         Vendedor   Status          Prev. entrega│
│ Ind. Metalúrgica XYZ  Adequação       Carlos     Em execução 45% 🟠  22/11     │
│ Cond. Jardim Sul      SPDA            Ana        Planejada        18/11     │
│ Ed. Aurora            Medição Ôhmica  Carlos     ✔ Concluída     21/10     │
│ ☐ Só meus contratos                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

3. **Aviso ao vendedor** quando uma obra dele é **concluída** (hora de faturar o restante e pedir indicação) ou fica **atrasada** (hora de alinhar a expectativa do cliente antes que ele ligue).

**Segurança e privacidade:** depois da auditoria anterior, o Comercial **não tem acesso** às tabelas `execucao_*` (RLS só para a Execução), e isso deve continuar assim. A seção usa uma **função de leitura que devolve apenas o necessário**:

```sql
CREATE OR REPLACE FUNCTION public.status_execucao_contratos(p_apontamento_ids uuid[] DEFAULT NULL)
RETURNS TABLE (apontamento_id uuid, status_execucao text, progresso int,
               inicio_previsto date, entrega_prevista date, entregue_em date, saude text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id,
         CASE WHEN o.id IS NULL THEN 'aguardando_planejamento' ELSE o.status END,
         o.progresso_geral, o.data_inicio_prevista, o.data_fim_prevista, o.data_fim_real,
         NULL::text  -- preenchido com calcularSaude/regra SQL do item 2.3
    FROM apontamentos_comerciais a
    LEFT JOIN execucao_obras o ON o.apontamento_id = a.id
   WHERE a.fase = 'CONTRATO/VENDA'
     AND (p_apontamento_ids IS NULL OR a.id = ANY (p_apontamento_ids))
$$;
-- liberar só para usuários autenticados ativos (Comercial e Execução)
```

Sem endereço, técnico, fotos ou valores internos da Execução: só status, progresso e datas.

**Tempo real:** duas opções, da mais simples à mais completa.

| Opção | Como | Quando usar |
|---|---|---|
| A. Atualização frequente | Recarrega ao abrir o dashboard, ao voltar para a aba e a cada 2 min | Primeira versão; suficiente para a maioria dos casos |
| B. Ao vivo | Trigger em `execucao_obras` publica um evento "status mudou" num canal **Realtime de broadcast** (`realtime.send`); o dashboard escuta e recarrega só o contrato afetado. O projeto já usa Realtime em `services/supabase/configuracoes.js` | Quando o time quiser ver a mudança no momento em que acontece |

> A opção B usa **broadcast** em vez de "escutar a tabela", porque escutar `execucao_obras` diretamente exigiria liberar leitura dessa tabela ao Comercial (o RLS bloquearia os eventos).

**Passo a passo:**
1. Migração com a função `status_execucao_contratos` (e, na opção B, o trigger de broadcast).
2. `services/supabase/execucaoStatus.js` com `buscarStatusExecucao(ids)` e `assinarMudancasExecucao(callback)`.
3. `features/dashboard-v2/components/ExecucaoContratosCard.jsx` (nova seção) e um `SeloExecucao.jsx` reutilizado em `ClientesFechados.jsx` e na lista de apontamentos.
4. Filtro "Só meus contratos", usando o vendedor do apontamento (`proprietario_relacionamento`).
5. Notificação ao vendedor (opção B): ao mudar para `concluida` ou ficar atrasada.

**Aceite:** quando o técnico conclui a última etapa de uma obra, o selo do contrato muda para "✔ Concluída" no dashboard Comercial (em até 2 min na opção A; imediatamente na B), sem o Comercial ter acesso aos dados internos da Execução.

---

## 9. Fase 5: auditoria, histórico de alterações e desfazer (≈ 6 dias, por último)

> **Resposta 1:** todos os ADMIN_EXECUCAO veem e alteram tudo; não há "obra de um admin". Por isso é importante saber **quem mudou o quê** e poder **desfazer** um engano. Esta fase fica por último, como você pediu.

**Situação atual:** existe histórico só para **atividades** (`execucao_atividades_historico`) e **pedidos** (`execucao_historico_pedidos`), e cada tela grava o seu. Obras, etapas, templates, POPs e equipes não têm registro de alteração. Não há como desfazer nada.

### 5.1 Registro automático de todas as alterações (auditoria)

Um **gatilho no banco** registra cada inclusão, alteração e exclusão nas tabelas da Execução, **sem depender de cada tela lembrar de gravar**. Ações feitas por RPC, por outro admin ou pelo celular do técnico (offline, ao sincronizar) entram igualmente.

```sql
CREATE TABLE public.execucao_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  operacao text NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,                 -- linha antes da mudança (UPDATE/DELETE)
  depois jsonb,                -- linha depois da mudança (INSERT/UPDATE)
  campos_alterados text[],     -- só os campos que mudaram (UPDATE)
  usuario_id uuid,             -- public.current_usuario_id() no momento da ação
  transacao bigint NOT NULL DEFAULT txid_current(),  -- agrupa tudo o que foi feito numa mesma ação
  desfeito_por bigint REFERENCES public.execucao_auditoria(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.execucao_auditoria (tabela, registro_id, created_at DESC);
CREATE INDEX ON public.execucao_auditoria (transacao);
CREATE INDEX ON public.execucao_auditoria (created_at DESC);
-- RLS: somente leitura para ADMIN_EXECUCAO; ninguém altera ou apaga pelo app

-- Função genérica + um gatilho por tabela
CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON public.execucao_obras
  FOR EACH ROW EXECUTE FUNCTION public.execucao_auditar();
-- idem para: execucao_obras_etapas, execucao_atividades, execucao_atividades_equipe,
-- execucao_pedidos_material, execucao_pops, execucao_templates_etapas(_itens),
-- execucao_templates_materiais, execucao_jornadas_modelo, execucao_jornadas_colaborador,
-- execucao_ausencias, execucao_horas_extras, execucao_feriados, execucao_cidades, execucao_tipos_servico
```

- **"Quem fez":** `current_usuario_id()` (criada na auditoria anterior) identifica o usuário logado, inclusive quando a mudança vem de uma RPC.
- **Uma ação = um grupo:** `transacao` junta tudo o que foi alterado numa mesma ação. Ex.: "deslocar etapas" (2.5) muda 4 etapas e 3 atividades, e isso aparece como **uma** linha no histórico, que pode ser desfeita de uma vez.
- **Campos ignorados:** `updated_at` e campos calculados (ex.: `progresso_geral` recalculado) não geram "alteração" sozinhos, para o histórico não ficar poluído.
- **Retenção:** guardar 12 meses e apagar o mais antigo com um job mensal (`pg_cron`). Estimativa: algumas centenas de alterações por dia ocupam **~10–20 MB/mês**, o que cabe no banco, inclusive no plano gratuito.

> **Dica:** o gatilho de auditoria é barato (≈ 1,5 dia) e **pode ser instalado já na Fase 0 ou 1**, mesmo que a tela e o desfazer fiquem para o fim. Assim, quando a tela chegar, já haverá meses de histórico.

### 5.2 Menu "Histórico de alterações"

Novo item no menu do admin (seção **Gestão**), com a lista em linguagem de gente, não em JSON:

```
┌ Histórico de alterações ─────────────────────────────────────────────────────┐
│ Filtros: [Obra ▾] [Usuário ▾] [Tipo ▾] [Período: últimos 7 dias ▾] [Buscar…]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 23/10 14:32  Fábio      Deslocou 4 etapas da obra Ind. XYZ (+3 dias úteis)   │ [Ver] [↶ Desfazer] │
│ 23/10 11:05  Matheus    Alterou "Fundação" (Galpão Logística): fim 30/10→04/11│ [Ver] [↶ Desfazer] │
│ 22/10 17:40  João (téc) Concluiu "Captores" (Cond. Jardim Sul) · 3 fotos      │ [Ver]              │
│ 22/10 09:12  João Victor Excluiu a obra "Teste" (5 etapas, 2 atividades)     │ [Ver] [↶ Desfazer] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **[Ver]** mostra o "antes × depois" campo a campo.
- No **detalhe de cada obra**, uma aba **"Histórico"** com o mesmo conteúdo filtrado para aquela obra.
- Visível só para **ADMIN_EXECUCAO/Administrador**. O técnico vê apenas o histórico das próprias atividades, como já acontece hoje.

### 5.3 Desfazer (rollback) com segurança

**Como funciona:** **[↶ Desfazer]** aplica o inverso de **toda a ação**, na ordem inversa:
- alteração → volta os campos alterados ao valor anterior (só esses campos);
- inclusão → exclui o que foi incluído;
- exclusão → recria os registros com o **mesmo id** (o pai primeiro, depois os filhos; ex.: a obra e depois as etapas).

**Proteções:**
1. **Conflito:** se algum registro foi alterado **depois** por outra ação, o sistema avisa antes: *"A etapa 'Fundação' foi alterada depois por Maria em 23/10 15:10. Desfazer agora sobrescreve essa mudança. [Ver mudança] [Desfazer mesmo assim] [Cancelar]"*.
2. **O desfazer também é registrado** (e pode ser desfeito), com o vínculo `desfeito_por`. Nada some sem rastro.
3. **Arquivos (fotos, vídeos, áudios, PDFs):** o banco não recupera arquivo apagado do Storage. Por isso a exclusão desses arquivos passa a ser **"lixeira"**: o registro é marcado `excluido_em` e o arquivo é mantido por **30 dias** antes de ser apagado de verdade por um job. Desfazer dentro desse prazo restaura tudo.
4. **Efeitos já percebidos pelas pessoas** (notificações enviadas, técnico que já viu a atividade) não são "desenviados". Ao desfazer uma remarcação, o técnico afetado recebe **nova notificação** com a data correta.
5. **Prazo:** o botão aparece para ações dos **últimos 30 dias**; depois disso, o histórico continua visível, mas o desfazer é desabilitado (o risco de conflito cresce muito).
6. **Permissão:** somente ADMIN_EXECUCAO/Administrador, via RPC `desfazer_alteracao(p_transacao bigint)` (`SECURITY DEFINER`, verifica `is_admin_execucao()` e roda tudo numa transação: ou desfaz tudo, ou nada).

**Passo a passo:**
1. Migração: tabela `execucao_auditoria`, função `execucao_auditar()`, gatilhos nas tabelas listadas e RLS (somente leitura para admin).
2. Coluna `excluido_em timestamptz` em `execucao_atividades_evidencias`, `execucao_obras_arquivos` e `execucao_pops_arquivos` (lixeira), com as consultas passando a filtrar `excluido_em IS NULL`. Job `pg_cron` diário que apaga do Storage os arquivos com mais de 30 dias na lixeira.
3. RPC `listar_historico(filtros)`, que agrupa por `transacao` e devolve um **resumo legível** (montado a partir de `tabela`, `operacao` e `campos_alterados`, com rótulos por campo: "data_fim" → "fim").
4. RPC `desfazer_alteracao(p_transacao)`, com a checagem de conflito (existe registro de auditoria posterior para o mesmo `registro_id` fora desta transação?) e um parâmetro `p_forcar boolean` para o "desfazer mesmo assim".
5. Telas `components/historico/HistoricoAlteracoes.jsx` (menu) e `HistoricoObra.jsx` (aba no detalhe da obra), com o modal de "antes × depois".
6. Entrada no menu lateral (`ExecucaoSidebar.jsx`) na seção Gestão: **"Histórico de alterações"**.

**Aceite:**
- um admin altera a data de uma etapa; outro admin vê no histórico "quem, quando, de → para";
- uma obra excluída por engano (com etapas, atividades e fotos) é restaurada com um clique, com os arquivos de volta;
- desfazer uma ação que tem alteração posterior exige confirmação explícita.

---

## 10. Ordem recomendada e marcos

Revisada com as respostas do time. O **modo offline e as evidências** são prioridade, o **PWA** vem antes (é a base do offline), a **equipe com N técnicos (1.7)** entra cedo (muda o modelo de dados) e o **histórico/desfazer** fica por último.

| Semanas | Entrega | Marco de negócio |
|---|---|---|
| 1 | Fase 0 completa (0.1–0.5) · colunas de horas/técnicos/POP nos templates · **gatilho de auditoria (5.1)** · decisão do plano Supabase (0.6) | Sistema pronto para você ajustar os templates e apresentar ao time |
| 2–3 | 1.1 Contratos no "Nova Obra" + triagem dos 491 · 1.2 Tipos de serviço (Laudos fora) · 1.3 Prévia (com "obra já em andamento") · 1.4 Serviço rápido · **1.7 Equipe** | **Todo contrato da Execução passa pelo sistema** |
| 3–4 | 3.1 Meu dia · 3.2 Motivos de pausa · 3.4 Falta de material · 3.5 PWA | **Técnicos usando no celular** |
| 5–7 | 3.6 Modo offline · 3.3 Evidências com fotos/áudios (e vídeos após o 0.6), localização/data/hora, compressão no celular | **Técnico registra tudo em campo, mesmo sem sinal** |
| 7–8 | 2.1 Painel · 2.2 Linha do tempo · 2.3 Saúde · 2.8 Pauta semanal · 1.5 Dias úteis, cidades e feriados | **Reunião semanal feita a partir do sistema** |
| 9–10 | 2.4 · 2.5 · 2.7 · 4.1 · 4.4 opção A (status no Comercial) | Replanejamento em poucos cliques; Comercial enxerga a execução |
| 11–12 | 2.9 Capacidade em horas (modelos de jornada com descontos) · 2.10 Horas extras/emergências com aprovação · 2.6 Carga em horas · 4.2 · 4.3 · 4.4 opção B (ao vivo) | **Capacidade produtiva medida**; base para o dash financeiro/gestão |
| 13–14 | 5.2 Histórico de alterações · 5.3 Desfazer com lixeira de arquivos | **Rastreabilidade completa e correção de enganos com um clique** |

> **Dica sobre 2.9 e 5.1:** os painéis de capacidade e a tela de histórico ficam para o fim, mas as **colunas de horas nos templates** e o **gatilho de auditoria** entram na semana 1. O registro das horas realizadas entra junto com o 3.3. Assim, quando as telas chegarem, já haverá semanas de dados acumulados.

**Sugestão de adoção:** depois da semana 4, lançar com **uma equipe e um tipo de serviço** (por exemplo, Medição Ôhmica ou SPDA) por 2 semanas, coletar feedback e só então ampliar.

### Como medir se as melhorias funcionaram

| Métrica | Meta sugerida (a validar) |
|---|---|
| Contratos novos planejados em até 2 dias úteis | ≥ 90% |
| Tempo médio para cadastrar uma obra a partir do contrato | < 2 min (obra) / < 30 s (serviço rápido) |
| Atividades com status atualizado pelo próprio técnico | ≥ 80% |
| Atividades concluídas com evidência (com localização) nos serviços que exigem | ≥ 95% |
| Redução de espaço após compressão de mídia | ≥ 80% |
| Pontualidade (4.2) | Medir no 1º mês e definir a meta a partir da linha de base |
| Ocupação da equipe (2.9) | Faixa saudável a definir (ex.: 75–90% da jornada normal) |
| Horas extras/emergência no mês (2.9) | Acompanhar a tendência; alta contínua indica equipe subdimensionada |
| Obras com pendência de replanejamento abertas há mais de 2 dias | 0 |

---

## 11. Respostas do time e decisões tomadas

| # | Pergunta | Resposta | Decisão no plano |
|---|---|---|---|
| 1 | Quem planeja? | Todos os ADMIN_EXECUCAO veem e alteram tudo; não há obra "de um admin". Querem log de quem alterou e histórico com rollback (por último) | Contador e filtros **únicos para todos** (1.1). **Nova Fase 5** (5.1–5.3), com o gatilho de auditoria instalado cedo |
| 2 | Equipes? | 1 ou N técnicos por atividade | **Novo item 1.7** (equipe com líder e apoios), refletido em RLS, "Meu dia", horas e carga |
| 3 | Jornada | Seg–Sex, 07:00–12:00 e 13:15–17:00; até 2 h extras/dia; sábado, domingo e feriado só em emergência | Dias úteis = seg–sex (1.5); capacidade **8h45/dia** + até 2 h extras; cores na carga (2.6); indicador de horas extras/emergência (2.9) |
| 4 | Quem faz Medição e Laudo? | Medição: Execução. Laudo: equipe de Orçamentos | Tipo de serviço com **equipe responsável** (1.2); **Laudos não aparecem** na Execução; template de Laudo removido da referência (1.6) |
| 5 | O que o cliente recebe? | Não é relevante para este dashboard | Evidências com **uso interno**; removidos o "zip para laudo" e as referências à entrega ao cliente (3.3) |
| 6 | Contratos históricos | O admin vai gerir: há contratos em execução, outros concluídos e outros que vão entrar no planejamento | **Triagem inicial** com ação em lote e opção **"obra já em andamento"** (1.1, 1.3); sem data de corte |
| 7 | Templates | Você ainda vai ajustar todos e criar os que faltam | 1.6 vira **referência**; o plano garante o **formulário funcionando (0.1)** e os campos de tipo, horas, técnicos e POP |
| 8 | Plano Supabase / celulares | Plano **gratuito**; todos **Android** | **Novo 0.6** (migrar ao Pro antes dos vídeos); compressão e offline pensados para o **Chrome do Android**, com *Background Sync* (3.3, 3.5, 3.6) |
| 9 | Localização | Sim: localização, data e hora | Capturadas em cada evidência, com **carimbo visível na foto** e aviso de privacidade (3.3) |

**Definições complementares (respondidas):**

| Tema | Resposta | Decisão no plano |
|---|---|---|
| Cidades dos feriados municipais | Guarujá, Santos, São Vicente, Praia Grande, Bertioga e São Sebastião; editável; considerar também estaduais e nacionais | Cadastro de **cidades** e de **feriados em 3 níveis**, editáveis, com datas móveis e "copiar para o próximo ano" (1.5) |
| Horas disponíveis | Há descontos e é preciso poder editá-los | **Modelos de jornada** com lista de **descontos editáveis** e vigência (2.9) |
| Aprovação de hora extra/emergência | Basta o registro com justificativa; depois o admin aprova ou cancela, também com justificativa | **Novo item 2.10** (registro → pendente → aprovada/cancelada, com justificativas obrigatórias) |

Não há mais perguntas em aberto que bloqueiem o início. Os valores dos descontos, os feriados municipais e os templates são **dados** que o time cadastra pelas telas previstas.

---

## Anexo: arquivos e tabelas envolvidos

| Área | Arquivos atuais | Novos (sugeridos) |
|---|---|---|
| Templates | `planejamento/TemplateFormModal.jsx`, `constants.js`, `utils.js` | Tabela `execucao_tipos_servico` (com `equipe_responsavel`); colunas `horas_previstas`, `qtd_tecnicos`, `pop_id` nos itens |
| Cadastro | `planejamento/ObraFormModal.jsx`, `PlanejamentoMacro.jsx`, `execucao.js` (`buscarApontamentosParaObra`) | `PreviaEtapas.jsx` (com "obra já em andamento"), `ServicoRapidoModal.jsx`, `RevisarContratosPendentes.jsx`, RPC `criar_obra_completa`, tabelas `execucao_contratos_ignorados` e `execucao_feriados` |
| Equipe | `AgendaBase.jsx`, `MinhasAtividades.jsx`, RLS `atv_tecnico_*`, RPC `alterar_status_atividade` | Tabela `execucao_atividades_equipe`, coluna `equipe_ids` em etapas, `SeletorEquipe.jsx` |
| Visão do todo | `ResumoEtapas.jsx` (+ `ResumoVisao*.jsx`), `GanttObra.jsx`, `ObraCard.jsx`, `AlertasEtapasAtrasadas.jsx`, `exportacao.js` | `PainelCarteira.jsx`, `ResumoVisaoLinhaDoTempo.jsx`, `CargaTecnicos.jsx`, `exportarPautaSemanal`, RPCs `execucao_painel_carteira`, `execucao_carga_tecnicos`, `deslocar_etapas` |
| Capacidade | — | Tabelas `execucao_jornadas_modelo` (horários + descontos editáveis, vigência), `execucao_jornadas_colaborador`, `execucao_ausencias`, `execucao_horas_extras` (+ RPC `decidir_horas_extras`); `execucao_cidades` e `execucao_feriados` (nacional/estadual/municipal); colunas `horas_previstas`/`qtd_tecnicos` em itens e etapas e `horas_previstas`/`horas_realizadas`/`horas_ajustadas` em atividades; RPC `execucao_capacidade`; view `vw_execucao_horas_por_obra` |
| Técnico | `MinhasAtividades.jsx`, `AtividadesDia.jsx` (modal de pausa), `ExecucaoDashboard.jsx`, `vite.config.js` | `tecnico/MeuDia.jsx`, `CardAtividadeCampo.jsx`, `atividade/ModalPausa.jsx`, `ConcluirAtividade.jsx` (foto/vídeo/áudio), camada offline (`offline/cache.js`, `offline/filaEnvio.js`), `vite-plugin-pwa`, tabela `execucao_atividades_evidencias` (com localização/data/hora), bucket `atividades-evidencias` |
| Compressão de mídia | — | `midia/comprimir.js` (`browser-image-compression`, `mediabunny`), `midia/gravadorAudio.js` (`MediaRecorder`); sem servidor extra |
| Histórico e desfazer | `ExecucaoSidebar.jsx` (novo item de menu) | Tabela `execucao_auditoria`, função/gatilhos `execucao_auditar()`, RPCs `listar_historico` e `desfazer_alteracao`, coluna `excluido_em` (lixeira) em tabelas de arquivos, `historico/HistoricoAlteracoes.jsx`, `HistoricoObra.jsx` |
| Comercial | `features/dashboard-v2/DashboardV2.jsx`, `components/ClientesFechados.jsx` | `ExecucaoContratosCard.jsx`, `SeloExecucao.jsx`, `services/supabase/execucaoStatus.js`, função `status_execucao_contratos` |
| Dados | `execucao_atividades`, RPC `alterar_status_atividade` | Colunas `data_fim`, `solicita_replanejamento`, `replanejamento_resolvido_em`; `data_inicio_real`/`data_fim_real` em etapas; `checklist` em POPs; `motivo_codigo` no histórico; parâmetros `p_ocorrido_em` e `p_id_cliente` na RPC |

Toda tabela nova deve seguir o padrão de RLS aplicado na auditoria anterior (`is_admin_execucao()` / `current_usuario_id()`).
