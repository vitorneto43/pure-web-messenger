# Revisão completa do sistema de moderação do WaveChat

Vou reorganizar a moderação em camadas separadas, com privacidade absoluta para conversas privadas e foco automático apenas em conteúdo público e comportamento.

## Princípios

1. **Conversas privadas são intocáveis**: o servidor não lê, não analisa, não armazena conteúdo de mensagens entre usuários.
2. **Moderação automática só atua em**: status, perfis (bio, nome, foto), grupos públicos, e *metadados* de comportamento (taxa de envio, repetição, IPs, dispositivos).
3. **Mensagens privadas só vão para moderação quando denunciadas pelo participante** — e só essa mensagem específica.

## Mudanças por área

### 1. Remover análise automática de conteúdo de mensagens
- Desativar o `spam-detector` rodando no `ChatWindow` para mensagens privadas 1-a-1.
- Remover envio automático de `score`/`reasons` ao servidor por mensagem privada.
- Manter o detector apenas como hint local (UI: "essa mensagem parece phishing, tem certeza?") sem enviar nada.

### 2. Detecção comportamental (sem ler conteúdo)
Novo módulo server-side baseado puramente em metadados:
- **Rate limiting**: nº de mensagens/minuto por usuário, nº de destinatários distintos/hora, nº de mensagens iguais (hash do tamanho + timestamp, não do texto) para muitos destinatários.
- **IP/Device fingerprint**: contagem de contas criadas pelo mesmo `ip_hash` ou `device_id` (já temos `device-tracking`).
- **Sinal de bot**: cadência regular, ausência de digitação, criação imediata pós-cadastro.
Gera `behavior_signals` (não `spam_signals` de conteúdo).

### 3. Trust Score
Nova tabela `user_trust_scores`:
- `score` (0-100), recalculado por trigger/cron.
- Positivos: idade da conta, perfil completo, sem denúncias confirmadas, sem bloqueios recebidos.
- Negativos: denúncias confirmadas, bloqueios recebidos, sinais comportamentais, reincidência.
- Função `recompute_trust_score(user_id)` + view `user_trust_view`.

### 4. Moderação de conteúdo público (mais forte)
Apenas nestes alvos:
- `statuses` (texto, mídia, caption)
- `profiles` (display_name, username, bio, avatar)
- grupos públicos (nome, descrição, foto)
Hooks no `INSERT`/`UPDATE` chamam server fn que avalia score (regex de nudez explícita / golpe / link suspeito / repetição), e em casos graves move para fila de revisão automática.

### 5. Sistema de denúncias (já existe, refinar)
- Garantir que toda denúncia de mensagem armazene: mensagem + anexo + remetente + destinatário + motivo, em snapshot imutável dentro do próprio `content_reports` (snapshot JSON `evidence_snapshot`), para que mesmo se a mensagem for apagada o moderador ainda veja.
- Mensagens privadas **só** entram em `content_reports` por denúncia explícita.

### 6. Painel de moderação
Novas abas/filtros em `ModerationTab`:
- Pendentes / Em análise / Resolvidas / Rejeitadas
- Por tipo: mensagem (denunciada) / status / perfil / grupo / comportamento
- Para cada item: histórico do denunciado (denúncias anteriores, strikes, trust score, bloqueios recebidos)
- Ações: avisar, restringir 24h, suspender 7d, suspender 30d, banir, banir + IP.

### 7. Punições graduadas
Função `apply_moderation_action`:
- `warning` → nota + notificação
- `restriction` → não envia para não-contatos por X horas
- `suspension_short` (24h), `suspension_long` (7-30d)
- `ban` permanente
- `ban_with_ip` para gravíssimos (CSAM, golpe grave, ameaça)
Reincidência sobe automaticamente a próxima ação.

### 8. Modo Aprendizado
Flag global `moderation_learning_mode` em `app_settings`:
- Quando `true`, ações automáticas viram apenas `proposed_action` (vão pra fila de revisão humana, não executam).
- SuperAdmin liga/desliga no painel.

### 9. Configuração por SuperAdmin
Nova tabela `moderation_weights` (singleton) com pesos editáveis:
- `weight_report`, `weight_spam`, `weight_links`, `weight_blocks`, `weight_behavior`
- `threshold_warning`, `threshold_restriction`, `threshold_suspension`, `threshold_ban`
- UI em `ModerationTab > Configurações`.

## Detalhes técnicos

### Migrações
- `user_trust_scores` (user_id PK, score, components jsonb, updated_at)
- `behavior_signals` (id, user_id, kind, weight, metadata jsonb, ip_hash, device_hash, created_at)
- `moderation_weights` (singleton row)
- `app_settings` se ainda não existir (key/value jsonb)
- `content_reports`: adicionar `evidence_snapshot jsonb`, `status` enum estendido (`pending|in_review|resolved|rejected`), `assigned_to uuid`
- Função `recompute_trust_score(uuid)`, `apply_moderation_action(...)`, `report_message(...)` (snapshot atômico)
- Todas com GRANTs + RLS

### Server fns
- `src/lib/trust.functions.ts` — getMyTrust, recomputeTrust (admin)
- `src/lib/behavior.functions.ts` — recordBehaviorSignal (chamado por outros fns server-side em send_message wrapper / signup / etc., **nunca recebe texto**)
- `src/lib/moderation.functions.ts` — estender com listReportsByStatus, assignReport, resolveReport, rejectReport, applyAction, getModerationWeights, updateModerationWeights, toggleLearningMode
- `src/lib/public-content-moderation.functions.ts` — scanStatus, scanProfile (chamados em update de status/profile)

### Cliente
- `ChatWindow`: remover chamada de `reportSpamSignal` automática. Manter só hint visual local.
- `ReportContentDialog`: ao denunciar mensagem, chamar `report_message` que faz snapshot.
- `ModerationTab`: novas abas (status filters), exibir trust score, histórico, ações graduadas, painel de pesos + toggle modo aprendizado.
- `CreateStatusDialog` / edição de perfil: chamar `scanStatus`/`scanProfile` no salvar.

### Privacidade — invariante
Grep final garantirá que `messages.content` **só** é lido por:
- o próprio remetente/destinatário (RLS),
- `report_message` (snapshot no momento da denúncia, autorizada pelo participante),
- moderador via `content_reports.evidence_snapshot` (já é cópia).
Nada de leitura em massa, nada de scan automático.

## Escopo desta entrega

Vou implementar tudo acima em uma sequência de edits. Como é grande, vou:
1. Criar a migração consolidada primeiro (uma só, aprovada de uma vez).
2. Em seguida, escrever as server fns novas + atualizar as existentes.
3. Atualizar `ChatWindow` para parar a análise automática.
4. Atualizar `ModerationTab` com abas, pesos, learning mode.
5. Atualizar `ReportContentDialog` / fluxo de denúncia de mensagem com snapshot.
6. Atualizar criação/edição de status e perfil para chamar scan público.

Confirma que posso prosseguir? Se quiser podar algo (ex.: deixar Trust Score pra depois, ou pular o painel de pesos por agora), me diga antes de eu começar a migração.
