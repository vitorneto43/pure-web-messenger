# WaveChat - Guia Completo para Compilar APK/AAB via Celular

**Versão**: 1.22  
**Data**: 23 de maio de 2026

---

## 📱 Resumo: Como Funciona

1. Você faz upload do código no GitHub
2. GitHub Actions compila automaticamente (leva ~20 minutos)
3. Você baixa o APK/AAB direto no celular
4. Pronto! Sem precisar de computador

---

## 🚀 Passo 1: Criar Conta GitHub (via Celular)

### 1.1 Abrir GitHub no Celular

1. Abra o navegador do celular
2. Acesse: **https://github.com**
3. Clique em **"Sign up"** (canto superior direito)

### 1.2 Preencher Dados

- **Email**: seu-email@gmail.com
- **Senha**: senha forte (ex: WaveChat@2026)
- **Username**: seu-usuario-wavechat

### 1.3 Confirmar Email

1. Abra seu email
2. Clique no link de confirmação do GitHub
3. Pronto! Conta criada

---

## 📁 Passo 2: Criar Repositório no GitHub

### 2.1 Criar Novo Repositório

1. No GitHub, clique em **"+"** (canto superior direito)
2. Selecione **"New repository"**
3. Preencha:
   - **Repository name**: `wavechat`
   - **Description**: WaveChat — chat com chamadas de voz e vídeo
   - **Public** (deixe público para facilitar)
   - **Marque**: "Add a README file"
4. Clique em **"Create repository"**

### 2.2 Copiar Link do Repositório

1. Clique em **"Code"** (botão verde)
2. Copie o link HTTPS
3. Exemplo: `https://github.com/seu-usuario/wavechat.git`

---

## 💻 Passo 3: Fazer Upload do Código

### Opção A: Via GitHub Web (Mais Fácil)

1. No repositório GitHub, clique em **"Add file"**
2. Selecione **"Upload files"**
3. Selecione todos os arquivos do WaveChat
4. Clique em **"Commit changes"**

**Nota**: Se tiver muitos arquivos, use a Opção B

### Opção B: Via Git (Mais Rápido)

Se tiver acesso a um computador ou tablet com terminal:

```bash
cd /caminho/para/WaveChat
git remote add origin https://github.com/seu-usuario/wavechat.git
git branch -M main
git push -u origin main
```

---

## 🔐 Passo 4: Configurar Secrets (Obrigatório)

Os secrets são como senhas que o GitHub usa para compilar.

### 4.1 Acessar Secrets

1. No repositório GitHub, vá em **Settings**
2. Clique em **"Secrets and variables"** (lado esquerdo)
3. Clique em **"Actions"**

### 4.2 Adicionar Secrets

Clique em **"New repository secret"** e adicione:

#### Secret 1: `ANDROID_KEYSTORE_PATH`
- **Value**: `./wavechat.jks`

#### Secret 2: `ANDROID_KEYSTORE_PASSWORD`
- **Value**: `wavechat2026` (ou sua senha)

#### Secret 3: `ANDROID_KEYSTORE_ALIAS`
- **Value**: `wavechat`

#### Secret 4: `ANDROID_KEY_PASSWORD`
- **Value**: `wavechat2026` (ou sua senha)

**⚠️ Importante**: Esses secrets são privados. Ninguém consegue ver.

---

## 🔨 Passo 5: Compilar APK/AAB

### 5.1 Disparar Build Automático

Quando você faz push de código, o GitHub compila automaticamente.

**Para forçar um build:**

1. Vá em **Actions** (no repositório)
2. Clique em **"Build APK and AAB"**
3. Clique em **"Run workflow"** (lado direito)
4. Selecione **"main"** branch
5. Clique em **"Run workflow"** (botão verde)

### 5.2 Acompanhar Compilação

1. Vá em **Actions**
2. Veja o workflow em andamento (bolinha amarela = compilando)
3. Aguarde conclusão (leva ~15-20 minutos)
4. Quando terminar, a bolinha fica verde ✅

---

## 📥 Passo 6: Baixar APK/AAB no Celular

### 6.1 Acessar Artifacts

1. Vá em **Actions**
2. Clique no workflow mais recente (o que compilou)
3. Desça até **"Artifacts"** (no final da página)

### 6.2 Baixar Arquivo

Você verá 3 arquivos:

| Arquivo | Tamanho | Uso |
|---------|---------|-----|
| **app-debug.apk** | ~50-80 MB | Teste (sem assinatura) |
| **app-release.apk** | ~40-60 MB | Produção (assinado) |
| **app-release.aab** | ~30-50 MB | Google Play Store |

**Para testar no celular:**
- Baixe `app-debug.apk` ou `app-release.apk`

**Para publicar na loja:**
- Use `app-release.aab`

### 6.3 Instalar APK no Celular

1. Baixe o APK no celular
2. Abra o arquivo
3. Clique em **"Instalar"**
4. Se pedir permissão, clique **"Permitir"**
5. Pronto! App instalado

---

## 🔄 Passo 7: Atualizar Código

Sempre que quiser fazer mudanças:

### Via GitHub Web

1. Vá em **"Code"** (no repositório)
2. Clique em um arquivo para editar
3. Clique no ícone de lápis (editar)
4. Faça as mudanças
5. Clique em **"Commit changes"**
6. GitHub compila automaticamente

### Via Git (Mais Rápido)

```bash
# Fazer mudanças localmente
# Depois:
git add .
git commit -m "Descrição das mudanças"
git push origin main
```

---

## 📱 Passo 8: Publicar na Google Play

### 8.1 Criar Conta Developer

1. Acesse: https://play.google.com/console
2. Clique em **"Create account"**
3. Pague $25 USD
4. Aguarde aprovação (24-48 horas)

### 8.2 Criar Aplicativo

1. No Google Play Console, clique em **"Create app"**
2. Preencha informações:
   - Nome: WaveChat
   - Categoria: Social
   - Tipo: App
3. Clique em **"Create"**

### 8.3 Fazer Upload do AAB

1. Vá em **"Release"** → **"Production"**
2. Clique em **"Create new release"**
3. Clique em **"Upload AAB"**
4. Selecione o arquivo `app-release.aab` que baixou
5. Preencha notas de versão
6. Clique em **"Review"** → **"Publish"**

---

## 🎯 Fluxo Completo (Resumido)

```
1. Criar conta GitHub
   ↓
2. Criar repositório
   ↓
3. Upload do código WaveChat
   ↓
4. Adicionar secrets (keystore, senhas)
   ↓
5. Disparar build (Actions → Run workflow)
   ↓
6. Aguardar ~20 minutos
   ↓
7. Baixar APK/AAB nos Artifacts
   ↓
8. Instalar no celular ou publicar na loja
```

---

## ❓ Perguntas Frequentes

### P: Quanto tempo leva para compilar?
**R**: ~15-20 minutos na primeira vez. Builds subsequentes são mais rápidos (~10 minutos).

### P: Preciso de computador?
**R**: Não! Tudo funciona pelo celular e GitHub.

### P: O APK é seguro?
**R**: Sim! É assinado com seu keystore privado.

### P: Posso fazer mudanças no código?
**R**: Sim! Edite direto no GitHub Web ou via Git.

### P: Quanto custa?
**R**: GitHub Actions é grátis para repositórios públicos (2000 minutos/mês).

### P: Posso publicar na Google Play?
**R**: Sim! Use o arquivo `app-release.aab` (custa $25 USD para criar conta developer).

### P: E se o build falhar?
**R**: Vá em Actions, clique no build com falha e leia os logs para ver o erro.

### P: Posso fazer builds privados?
**R**: Sim, mas repositórios privados têm limite de 2000 minutos/mês no GitHub Actions.

---

## 🚨 Troubleshooting

### Erro: "Build failed"

**Solução**:
1. Vá em **Actions**
2. Clique no build com falha
3. Clique em **"build"** job
4. Leia a mensagem de erro
5. Corrija o código e faça push novamente

### Erro: "Keystore not found"

**Solução**:
- Verifique se adicionou os 4 secrets corretamente
- Nomes devem ser exatos: `ANDROID_KEYSTORE_PATH`, etc.

### Erro: "Gradle build failed"

**Solução**:
- Verifique se o código está correto
- Tente fazer push novamente
- Se persistir, leia os logs detalhados

---

## 📞 Suporte

- **GitHub Docs**: https://docs.github.com
- **Android Docs**: https://developer.android.com
- **Capacitor Docs**: https://capacitorjs.com

---

## ✅ Checklist Final

- [ ] Conta GitHub criada
- [ ] Repositório criado
- [ ] Código enviado
- [ ] 4 secrets adicionados
- [ ] Build disparado
- [ ] APK/AAB baixado
- [ ] App instalado no celular
- [ ] Tudo funcionando!

---

**Desenvolvido com ❤️ para funcionar 100% via celular**

**Versão**: 1.22  
**Última atualização**: 23 de maio de 2026
