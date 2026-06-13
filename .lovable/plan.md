# Sistema Avançado de Segurança, Reputação e Anti-Abuso

Construir um sistema em camadas que protege o WaveChat contra spam, golpes, bots, contas descartáveis e reincidentes — sem bloqueio permanente de IP e sem ler conversas privadas.

## Princípios

- **IPs nunca são banidos permanentemente.** São apenas *classificados* (baixo/médio/alto/crítico) e usados como sinal de risco.
- **Dispositivos podem ser bloqueados** (fingerprint), pois identificam o aparelho, não a rede.
- **Conversas privadas continuam privadas.** Toda análise é sobre metadados, comportamento e conteúdo denunciado/público.
- **Hash com pepper** em todos os identificadores sensíveis (IP, fingerprint). O valor cru nunca fica em texto puro no banco.

## Camadas

### 1. Conta banida → registro completo
Estender `moderation_actions` (já existe) e garantir snapshot de: motivo, data, evidências (snapshots já criados), denúncias vinculadas, histórico. Quando um usuário é banido, marcar `profiles.banned_at` e desativar sessão.

### 2. Fingerprint de dispositivo
Nova tabela `device_fingerprints`:
- `fingerprint_hash` (hash de UA + plataforma + screen + tz + device_id nativo)
- `user_id`, `first_seen_at`, `last_seen_at`, `account_count`, `banned_account_count`
- `risk_level` (low/medium/high/critical), `is_blocked` (bool, gravíssimo apenas)

Gerado no cliente em `src/lib/device-fingerprint.ts` (combina sinais já permitidos). Reportado via serverFn `recordDeviceFingerprint`.

Na criação de conta e login: serverFn `checkDeviceFingerprint` retorna `{ allowed, requires_verification, risk }`. Se `is_blocked=true` → bloqueia. Se reincidente (já vinculado a conta banida) → exige verificação adicional / restringe.

### 3. Monitoramento de IP (classificação, não bloqueio)
Nova tabela `ip_reputation`:
- `ip_hash`, `country`, `region`, `accounts_created`, `accounts_banned`, `risk_level`, `last_seen_at`
- Função `recompute_ip_risk(ip_hash)` atualiza `risk_level` baseado em ratio banidos/criados e volume.

Substituir a lógica atual de banimento de IP (`banned_ips` + `check-signup-ip`) por classificação. IPs "crítico" exigem captcha/verificação; nunca bloqueiam de cara. Manter `banned_ips` apenas para casos gravíssimos (camada 8).

### 4. Trust Score (já existe `user_trust_scores`)
Estender `recompute_trust_score(user_id)`:
- **+**: idade da conta, perfil completo, sem denúncias, sem bloqueios recebidos, atividade saudável (mensagens recíprocas).
- **−**: denúncias confirmadas, spam reportado, golpes, múltiplas contas do mesmo fingerprint, múltiplas contas do mesmo IP, comportamento bot (rate alto, repetição).

Score 0–100. Usado pelas camadas 5 e 6.

### 5. Restrições para contas novas
ServerFn `checkRateLimit(action)` consulta:
- Idade da conta + trust score.
- Limites por dia: mensagens, convites, grupos criados, links enviados.

Aplicada nos hooks de envio (mensagens / convites / criar grupo). Limites configuráveis em `moderation_weights` (estender com `limit_*` colunas).

### 6. Detecção de comportamento suspeito
Estender `behavior_signals` (já existe) com tipos:
- `mass_account_creation` (mesmo fp/ip)
- `high_send_rate`
- `repeated_content_hash` (hash de mensagem, NÃO conteúdo)
- `bot_pattern` (timing constante)

Trigger/cron `detect_suspicious_behavior()` roda a cada N min, gera sinais e ajusta trust score.

### 7. Painel de Segurança (SuperAdmin)
Novo tab `SecurityTab.tsx` em `admin.tsx`:
- **Usuários de alto risco**: lista ordenada por trust score asc.
- **Dispositivos reincidentes**: `device_fingerprints` com `banned_account_count > 0`.
- **IPs de alto risco**: `ip_reputation` ordenado por risk_level/ratio.
- **Histórico**: links para denúncias e ações de moderação por entidade.
- Ações: bloquear fingerprint, marcar IP como crítico, forçar verificação.

### 8. Casos graves
Quando ação de moderação é `banned` com severidade `gravissima` (CSAM, golpes graves, etc.):
- Banir conta.
- Marcar todos fingerprints vinculados como `is_blocked=true`.
- Marcar IPs vinculados como `risk_level='critical'`.
- Preservar snapshots (já existem via `evidence_snapshot`).
- Registrar em `audit_logs` (já existe).

Implementado em `apply_moderation_action` (estender RPC).

## Arquivos

### Migration (uma só)
- `device_fingerprints` (CREATE + GRANT + RLS)
- `ip_reputation` (CREATE + GRANT + RLS) — apenas SuperAdmin lê; serverFns escrevem via service role
- Estender `user_trust_scores`: adicionar colunas `device_signal`, `ip_signal`, `behavior_signal`
- Estender `moderation_weights`: `limit_messages_per_day_new`, `limit_invites_per_day_new`, `limit_groups_per_day_new`, `limit_links_per_day_new`, `new_account_days`
- RPC `recompute_ip_risk(ip_hash text)`
- RPC `recompute_device_risk(fp_hash text)`
- RPC estendida `recompute_trust_score(user_id uuid)`
- Trigger em `moderation_actions` para propagar bans gravíssimos a fingerprints/IPs

### Cliente
- `src/lib/device-fingerprint.ts` — gera hash do dispositivo (sem invasivo: UA, plataforma, screen, tz, device id nativo do Capacitor quando disponível).
- Chamar `recordDeviceFingerprint` no login/signup (já temos `recordDeviceInfo`, estender).

### Server functions
- `src/lib/security.functions.ts`:
  - `recordDeviceFingerprint` (auth)
  - `checkSignupRisk` (public — recebe fp_hash, retorna { allowed, requires_verification })
  - `checkRateLimit` (auth)
  - `listHighRiskUsers`, `listSuspiciousDevices`, `listHighRiskIps` (superadmin)
  - `blockDeviceFingerprint`, `setIpRiskLevel` (superadmin)
- Estender `src/lib/moderation.functions.ts.applyModerationAction` → propagar gravíssima.

### Rota pública
- Estender `/api/public/auth/check-signup-ip` para retornar classificação (allowed sempre true exceto crítico/bloqueio explícito) e atualizar `ip_reputation`.

### UI
- `src/components/admin/SecurityTab.tsx` (novo)
- Integrar no `src/routes/admin.tsx` (visível apenas para SuperAdmin)
- Aplicar `checkRateLimit` nos pontos de envio (mensagens, convites, criar grupo)

## Privacidade

- IP e fingerprint **sempre** com `sha256(pepper + valor)`. Cru jamais persistido.
- Conversas privadas: nenhuma análise automática (já garantido).
- Cliente envia apenas hashes e métricas agregadas.

## Detalhes técnicos

- Pepper: `process.env.SPAM_HASH_PEPPER` (já existe).
- Fingerprint = `sha256(pepper + JSON.stringify({platform, ua_class, screen_bucket, tz, native_device_id?}))`. Buckets para evitar identificação 1:1 desnecessária.
- Limites default (novos por dia, conta <7d, trust<30): 30 msgs, 5 convites, 1 grupo, 5 links.
- Risk IP: ratio banidos/criados ≥0.5 e total ≥5 → high; ≥0.8 e ≥10 → critical.

## Tamanho

~1 migration grande, ~3 novos arquivos client/server, ~2 arquivos editados, 1 UI tab. Implementação direta — sem dependências externas novas.