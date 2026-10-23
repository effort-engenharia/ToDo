# Implementação das melhorias do módulo Execução

Resumo da implementação de [SUGESTOES_MELHORIAS_EXECUCAO.md](./SUGESTOES_MELHORIAS_EXECUCAO.md).
Commit na `main`: `be90616` (branch `feat/melhorias-execucao`, já removida).

> **Atenção:** nada foi testado no navegador nem em um Android real. A validação foi: lint do módulo, `npm run check:contract`, `vite build` e testes das funções do banco com rollback.

---

## 1. O que foi feito

### Banco de dados (migrações `20261023_04` a `20261023_11`, já aplicadas em produção)
Todas são aditivas (não alteram nem removem o que já existia) e foram testadas com rollback. Nenhum dado de teste ficou no banco.

| Migração | Conteúdo |
|---|---|
| 04 | Cidades (6) e feriados 2026–2032 (nacionais, SP, municipais), tipos de serviço, funções de dias úteis, equipe por atividade (líder + apoios), novas colunas (horas previstas, datas reais etc.) |
| 05 | Notificações por destinatário, status de atividade idempotente (para offline), jornadas e ausências, capacidade, horas extras, evidências (bucket privado), falta de material |
| 06 | Contratos pendentes, `criar_obra_completa` (atômica), `deslocar_etapas` (prévia/aplicar), saúde das obras, painel da carteira, indicadores, status para o Comercial |
| 07 | Histórico de alterações em 18 tabelas, lixeira do Storage (30 dias), `execucao_desfazer` |
| 08 | Hardening de funções/permissões, progresso ponderado da obra, broadcast em tempo real do status |
| 09 | Correção da `criar_obra_completa` após o hardening |
| 10 | `deslocar_etapas` passa a mover atividades em dias úteis e atualiza o fim previsto da obra |
| 11 | `execucao_contexto_atividades`: dá ao técnico cliente, endereço e contato sem expor valores do contrato |

### Cadastro de obras (itens 0.1, 1.1–1.5, 1.7)
- Contratos pendentes do Comercial na Nova Obra, com busca, contador no botão, "Não planejar" e revisão em lote.
- Tipo de serviço sugere o template automaticamente.
- Prévia editável das etapas em dias úteis (feriados da cidade) e opção "obra já em andamento".
- Serviço rápido (1 etapa e 1 atividade).
- Seletor de equipe (líder + apoios).
- Formulário de template corrigido (tipos válidos, horas previstas, nº de técnicos, POP).
- Feriados e cidades editáveis (Configurações).

### Planejamento Macro (itens 2.1–2.8)
- Painel da carteira com filtros por clique.
- Linha do tempo como modo do Resumo de Etapas.
- Selo de saúde (no prazo / em risco / atrasada) com motivos.
- Previsto × realizado (datas e horas).
- Reprogramação com prévia antes/depois e confirmação (**não é automática**), notificando técnicos.
- Pendências de replanejamento pedidas pelo técnico.
- Carga da equipe em horas.
- Pauta semanal em PDF.

### Técnico (itens 0.3–0.5, 3.1, 3.2, 3.4)
- Tela "Meu dia" para celular, com ações de um toque.
- Pausa com motivo padronizado e pedido de replanejamento.
- Horas realizadas ao concluir.
- Rota (Google Maps/Waze), Ligar e WhatsApp.
- Falta de material e status de material.
- Notificações clicáveis.

### Offline, PWA e evidências (itens 3.3, 3.5, 3.6)
- PWA instalável (service worker restrito ao app; não intercepta Supabase nem dados do Comercial).
- Fila offline com sincronização ao voltar a internet, usando id do cliente para não duplicar.
- Cache local das atividades do técnico.
- Foto, vídeo e áudio na conclusão, comprimidos no celular, com carimbo de local, data e hora.
- Fila própria de upload com reenvio automático.
- O admin vê as evidências na atividade (Atividades do Dia).

### Admin (itens 2.9, 2.10, 4.1–4.3, 5.1–5.3)
- Configurações: jornada, descontos, ausências, tipos de serviço e calibração de templates.
- Capacidade da equipe (horas disponíveis × alocadas) com reatribuição.
- Horas extras: registro com justificativa e aprovação/cancelamento com justificativa, inclusive em lote.
- Histórico de alterações com filtros, antes × depois e **Desfazer**.
- Manutenção: purga da lixeira do Storage e retenção do histórico.
- Indicadores acionáveis no Desempenho do Time.

### Comercial (item 4.4)
- Seção "Execução dos contratos" e selo de status nos fechados recentes (atualiza a cada 2 min, com realtime opcional).

---

## 2. O que NÃO foi feito

- **Item 0.6:** decisão de plano. O plano gratuito tem 1 GB; migrar ao Supabase Pro antes de liberar vídeos.
- Foto na falta de material (a função do banco não aceita anexo).
- Marcos de material e prazo contratado na linha do tempo.
- Limite de desvio (15 p.p.) configurável.
- Aviso ao vendedor quando a obra conclui ou atrasa (4.4, item 3) e selo na lista de Apontamentos.
- Notificar o técnico quando o admin reagenda uma atividade manualmente (só `deslocar_etapas` notifica).
- Vincular hora extra a uma atividade; indicadores clicáveis (abrir lista de atividades).
- Agendar vários serviços rápidos de uma vez e equipe no `AtividadeEtapaModal`.
- Concluir com evidências totalmente offline pela fila principal (evidências usam fila própria; a fila principal leva só `horasRealizadas`).
- Item 1.6 (conteúdo dos templates): depende do preenchimento pelo time.
- Snapshot `supabase/schema/*.sql` não foi atualizado com as novas tabelas.

---

## 3. Riscos e pontos de atenção

| Risco | Detalhe / mitigação |
|---|---|
| Sem teste real | Nada foi testado em navegador ou Android reais (câmera, GPS, gravação, Background Sync, instalação do PWA) |
| Atualização do service worker | Ao publicar versão nova o app recarrega sozinho e pode interromper um formulário aberto |
| Desativar o PWA | Publicar com `VITE_PWA_SELF_DESTROY=1 npm run build`; por aparelho: `localStorage.effort_sw_off='1'` |
| Dependências | `npm install` precisou de `--legacy-peer-deps` (conflito antigo do `@emoji-mart/react`) e atualizou ~47 pacotes transitivos. Rode o build em CI |
| Armazenamento | Plano gratuito: 1 GB, 50 MB/arquivo, sem backup. Estimativa: 300–400 MB/mês com fotos, vídeo e áudio por obra |
| Exclusão de obra | A atividade fica solta (sem etapa) e continua na agenda do técnico (já era assim). O Desfazer reconecta |
| Lixeira | Arquivos excluídos só saem do Storage após 30 dias, pela rotina em Histórico → Manutenção (disparada pelo admin). Depois disso o Desfazer não restaura o arquivo |
| Contratos sem planejamento | A seção do Comercial lista só os criados nos últimos 120 dias; a chamada usa os ids de todos os contratos ativos (payload grande em volumes altos) |
| Obra "em andamento" | A atividade da etapa atual nasce pendente com data no passado e pode aparecer como atrasada |
| Fila offline | A fila fica no aparelho por usuário; se outra pessoa logar no mesmo celular, as pendências só sobem quando o dono voltar |
| Vídeo | Upload simples (sem retomada); com sinal muito fraco pode precisar de várias tentativas. WebM sem duração no cabeçalho limita a busca no player |
| Histórico | `execucao_tipos_servico` e `execucao_jornadas_colaborador` não geram histórico |
| Sub-etapas | `deslocar_etapas` filtra por ordem; pode incluir sub-etapa sem a etapa pai (a prévia avisa) |
| Alertas do Supabase | Funções `SECURITY DEFINER` liberadas a `authenticated` são intencionais e checam permissão internamente |

---

## 4. Checklist de testes manuais

### 4.1 Antes de tudo (nada pode ter quebrado)
- [ ] Login e logout funcionam (admin Comercial, admin Execução e técnico).
- [ ] Dashboard Comercial abre, com os números de sempre.
- [ ] Impersonation continua bloqueando escritas.
- [ ] Telas antigas do Execução abrem: Visão Geral, Atividades do Dia, Agendas, Pedido de Material, POPs, Desempenho.

### 4.2 Admin — cadastro e planejamento
- [ ] O botão **Nova Obra** mostra o contador de contratos pendentes.
- [ ] Selecionar um contrato preenche cliente/tipo de serviço e sugere o template.
- [ ] A prévia das etapas calcula datas em dias úteis (pula fim de semana e feriado da cidade).
- [ ] Alterar a data de uma etapa desloca as seguintes.
- [ ] Criar a obra gera etapas e atividades; criar o mesmo contrato duas vezes é bloqueado.
- [ ] "Obra já em andamento" marca as etapas anteriores como concluídas.
- [ ] "Não planejar" tira o contrato da lista e dá para restaurar em "Revisar pendentes".
- [ ] **Serviço rápido** cria obra com 1 etapa e 1 atividade.
- [ ] Template: salvar com horas, nº de técnicos e POP; editar e duplicar mantendo esses campos.
- [ ] Painel da carteira: clicar nos números filtra a lista.
- [ ] Resumo de Etapas → modo **Linha do tempo** (zoom semana/mês, clique abre a obra).
- [ ] Reprogramar: a prévia antes/depois aparece; só grava ao confirmar; técnicos recebem notificação.
- [ ] Pauta semanal em PDF abre e os dados conferem.
- [ ] Editar uma obra/etapa já existente continua funcionando.

### 4.3 Admin — configurações, capacidade e histórico
- [ ] Configurações → Feriados e cidades: criar, editar, desativar; "Copiar para o próximo ano".
- [ ] Jornada: editar descontos e ver a prévia do líquido; ausências/férias.
- [ ] Capacidade da equipe: horas por técnico/dia/semana, linha "Sem técnico", reatribuir atividade.
- [ ] Horas extras: registrar com justificativa; aprovar e cancelar (um a um e em lote) com justificativa. O selo do menu atualiza.
- [ ] Histórico: filtrar, ver antes × depois, **Desfazer** uma alteração, e o aviso de conflito.
- [ ] Excluir uma obra de teste, depois restaurá-la pelo Histórico (com arquivo anexado).
- [ ] Manutenção do histórico: verificar a lixeira (sem apagar nada que precise).
- [ ] Desempenho do Time: indicadores aparecem sem erro.

### 4.4 Técnico — no Android
- [ ] Abre direto em **Meu Dia**; os botões são fáceis de tocar.
- [ ] Atividades como líder e como apoio aparecem.
- [ ] Iniciar, Pausar (com motivo e pedido de replanejamento) e Concluir (com horas realizadas).
- [ ] Rota, Waze, Ligar e WhatsApp abrem corretamente (cliente, endereço e contato aparecem).
- [ ] Falta de material (com e sem pausar) gera aviso ao admin; o status de material aparece no cartão.
- [ ] Notificação clicável leva à atividade.
- [ ] O técnico não vê dados de outros técnicos nem valores de contrato.

### 4.5 PWA e offline (Android/Chrome)
- [ ] Instalar o app ("Adicionar à tela inicial") e abrir pelo ícone.
- [ ] Com internet: abrir Meu Dia (isso carrega o cache).
- [ ] Ativar o modo avião e abrir o app: continua logado e mostra as atividades.
- [ ] Iniciar e pausar uma atividade offline: aparece "Pendente de envio".
- [ ] Voltar a internet: a fila sincroniza e o admin vê o status com a hora original da ação.
- [ ] Repetir a ação não duplica o histórico.
- [ ] O Comercial no navegador comum não mostra versão desatualizada após um deploy.

### 4.6 Evidências
- [ ] Concluir com foto: tamanho final ≲ 400 KB e carimbo (data, hora, coordenadas) na imagem.
- [ ] Negar a permissão de localização: segue sem coordenadas, sem travar.
- [ ] Gravar vídeo (limite 60 s) e áudio (limite 3 min); conferir o tamanho.
- [ ] Concluir sem internet: a conclusão não trava e as evidências sobem depois.
- [ ] O admin vê as evidências em Atividades do Dia (miniaturas, player, link do mapa).
- [ ] Conferir o consumo de Storage no painel do Supabase.

### 4.7 Comercial
- [ ] A seção **Execução dos contratos** aparece com as contagens e o filtro por status.
- [ ] Os selos aparecem em "Fechados recentes".
- [ ] Se a consulta falhar, aparece aviso local e o resto do dashboard segue normal.
- [ ] O status muda após o técnico concluir uma atividade (até 2 min, ou na hora se o realtime conectar).

---

## 5. Próximos passos sugeridos

1. Corrigir o que o teste manual apontar.
2. Cadastrar e ajustar os templates (item 1.6) com horas previstas, nº de técnicos e POP.
3. Decidir o plano do Supabase (Pro) antes de liberar vídeos (0.6).
4. Implementar os itens pendentes da seção 2 por ordem de valor (aviso ao vendedor, foto na falta de material).
5. Atualizar o snapshot `supabase/schema/*.sql`.

---

## 6. Testes automatizados em produção (23/10, com as contas de admin e técnico do `.env`)

Rodados com navegador real (Chrome, Playwright) contra o Supabase de produção; todos os dados de teste (`ZZ_*`) foram removidos, inclusive os arquivos do Storage.

**Causa dos erros de console (401) em produção:** os 3 usuários ADMIN_EXECUCAO estavam com **e-mail não confirmado** no Supabase Auth. O login libera esses usuários sem sessão ("Email not confirmed"), e as regras de segurança (RLS) do módulo recusavam tudo como anônimo (`gerar_notificacoes_atraso`, `execucao_contar_contratos_pendentes` etc.). **Correção aplicada no banco:** e-mail confirmado dos 3 admins (`auth.users.email_confirmed_at`). Também foi adicionado um aviso na tela quando o usuário entra sem sessão (`AvisoSessao`). **Atenção:** todo novo usuário do módulo precisa ter o e-mail confirmado (use a ação de confirmar e-mail do cadastro de usuários).

| Área | Resultado |
|---|---|
| Admin: todas as 15 páginas do menu | OK, sem erros de console |
| Nova Obra a partir de contrato (SPDA, 8 etapas, prévia em dias úteis, feriados Finados/Consciência Negra pulados) | OK |
| Reprogramar etapas (prévia → confirmar) | OK |
| Histórico: registro e **Desfazer** (alteração e criação) | OK |
| Pauta semanal em PDF | OK (arquivo gerado e conferido) |
| Horas extras: registrar → aprovar com justificativa | OK |
| Configurações: criar feriado | OK |
| Pedido de replanejamento → Resolver | OK |
| Capacidade da equipe com atividades reais | OK |
| Técnico (celular 393×851): Meu Dia, contato/rota, Iniciar, Pausar com motivo, Falta de material | OK |
| Técnico: concluir com foto (4,3 MB → 329 KB, GPS e carimbo gravados) e admin vê a evidência | OK |
| Técnico offline: ação offline fica "Pendente de envio" e sincroniza ao voltar a conexão | OK |
| Sino de notificações do admin (conclusão, pausa, falta de material) | OK |

**Problemas encontrados e corrigidos nesta rodada**
- Concluir **uma** atividade fechava a **etapa inteira** (migração 13: a etapa só conclui quando todas as atividades concluem).
- Selo "aguardando" mostrava 448 contratos (a maioria de 2025): o contador agora considera só contratos recentes (últimos 120 dias) — a lista completa continua disponível (migração 12).
- Linha do tempo ficava minúscula com poucas obras (largura mínima aplicada).
- Filtros da aba Obras ocupavam uma linha cada; ícones dos botões do técnico espremidos.

**Não coberto pelos testes**
- Seção do Comercial (as contas do `.env` são do módulo Execução; testar logado no Comercial).
- Instalação do PWA e Background Sync em Android real; vídeo e áudio; GPS real.
- Perfil admin em celular e impersonation.
