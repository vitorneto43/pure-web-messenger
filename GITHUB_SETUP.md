# WaveChat - Guia de Setup GitHub e CI/CD

## 🚀 Configuração Inicial

### 1. Criar Repositório no GitHub

```bash
# Criar novo repositório em https://github.com/new
# Nome: wavechat (ou seu nome preferido)
# Descrição: WaveChat — chat, chamadas de voz e vídeo em tempo real
# Público ou Privado: sua escolha
# Não inicialize com README (já temos um)
```

### 2. Adicionar Remote e Push

```bash
cd /caminho/para/WaveChat

# Adicionar remote
git remote add origin https://github.com/seu-usuario/wavechat.git

# Renomear branch para main
git branch -M main

# Push inicial
git push -u origin main
```

## 🔐 Configurar Secrets

Para que o CI/CD funcione, você precisa adicionar secrets no GitHub:

### 1. Acessar Secrets

1. Vá em: `Settings` → `Secrets and variables` → `Actions`
2. Clique em `New repository secret`

### 2. Adicionar Secrets Necessários

#### Para Build Debug (opcional)
Não é necessário adicionar secrets para builds de debug.

#### Para Build Release (obrigatório para APK/AAB de release)

**`ANDROID_KEYSTORE_PATH`**
```
./wavechat.jks
```

**`ANDROID_KEYSTORE_PASSWORD`**
```
sua-senha-forte-do-keystore
```

**`ANDROID_KEYSTORE_ALIAS`**
```
wavechat
```

**`ANDROID_KEY_PASSWORD`**
```
sua-senha-forte-da-chave
```

#### Para Google Play Release (opcional)

**`GOOGLE_PLAY_SERVICE_ACCOUNT`**
- Baixar arquivo JSON do Google Play Console
- Copiar todo o conteúdo JSON como secret

**`SLACK_WEBHOOK_URL`** (opcional)
- Para notificações no Slack
- Criar webhook em: https://api.slack.com/messaging/webhooks

## 📋 Como Usar os Workflows

### Build Automático (a cada push)

O workflow `build-apk-aab.yml` é executado automaticamente:
- A cada push em `main` ou `develop`
- A cada pull request
- Manualmente via `workflow_dispatch`

**Resultado:**
- APK de debug
- APK de release (se secrets estiverem configurados)
- AAB de release (se secrets estiverem configurados)

**Acessar artifacts:**
1. Vá em `Actions` no GitHub
2. Clique no workflow mais recente
3. Desça até `Artifacts`
4. Baixe o arquivo desejado

### Release para Google Play (manual)

O workflow `release.yml` permite publicar no Google Play:

1. Vá em `Actions`
2. Clique em `Release to Google Play`
3. Clique em `Run workflow`
4. Selecione o track:
   - `internal`: Teste interno
   - `alpha`: Teste alfa
   - `beta`: Teste beta
   - `production`: Produção
5. Clique em `Run workflow`

## 🏷️ Criar Release com Tag

Para criar uma release automática com APK/AAB:

```bash
# Criar tag
git tag v1.22

# Push tag
git push origin v1.22
```

Isso vai:
1. Compilar APK e AAB
2. Criar release no GitHub
3. Fazer upload dos arquivos

## 📊 Monitorar Builds

### Ver Status dos Workflows

1. Vá em `Actions` no GitHub
2. Veja o histórico de execuções
3. Clique em um workflow para ver detalhes

### Ver Logs

1. Clique no workflow
2. Clique em `build` (ou outro job)
3. Expanda as seções para ver logs detalhados

### Troubleshooting

Se um build falhar:

1. Clique no workflow com falha
2. Vá para a seção que falhou
3. Leia a mensagem de erro
4. Corrija o problema localmente
5. Faça push novamente

## 🔄 Atualizar Versão

Para incrementar a versão e criar um novo release:

```bash
# Editar versionCode em android/app/build.gradle
# Editar versionName em android/app/build.gradle
# Editar version em package.json

# Fazer commit
git add .
git commit -m "chore: bump version to 1.23"

# Criar tag
git tag v1.23

# Push
git push origin main v1.23
```

## 📝 Estrutura de Branches

Recomendamos:

```
main (produção)
  ↓
develop (desenvolvimento)
  ↓
feature/nome-da-feature (features)
```

### Fluxo de Desenvolvimento

```bash
# Criar feature branch
git checkout -b feature/minha-feature develop

# Fazer mudanças
git add .
git commit -m "feat: adicionar nova feature"

# Push
git push origin feature/minha-feature

# Criar Pull Request no GitHub
# Após aprovação, merge para develop

# Quando pronto para release:
git checkout main
git merge develop
git tag v1.23
git push origin main v1.23
```

## 🚀 Primeiro Build

1. Faça push do código para GitHub
2. Vá em `Actions`
3. Veja o workflow `Build APK and AAB` executando
4. Aguarde conclusão (~15-20 minutos)
5. Baixe os artifacts

## 📚 Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Android Gradle Plugin](https://developer.android.com/build/releases/gradle-plugin)
- [Google Play Console API](https://developers.google.com/android-publisher)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)

## ⚠️ Notas Importantes

1. **Secrets são privados**: Nunca commite secrets no código
2. **Keystore é sensível**: Proteja seu keystore.jks
3. **Builds levam tempo**: Primeiro build pode levar 20+ minutos
4. **Cache do Gradle**: Workflows subsequentes serão mais rápidos

## 🆘 Problemas Comuns

### "Android Gradle plugin requires Java 17"
✅ Resolvido no workflow (usa Java 17)

### "Build failed: Keystore not found"
- Adicione os secrets `ANDROID_KEYSTORE_*`
- Verifique os nomes dos secrets

### "Google Play upload failed"
- Verifique `GOOGLE_PLAY_SERVICE_ACCOUNT` secret
- Verifique se o service account tem permissões

### "Build timeout"
- Builds podem levar 20+ minutos
- GitHub Actions tem limite de 6 horas

---

**Versão**: 1.22  
**Última atualização**: 23 de maio de 2026
