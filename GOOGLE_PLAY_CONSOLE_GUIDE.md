# WaveChat - Guia Google Play Console

**Data**: 23 de maio de 2026  
**Versão**: 1.22  
**Status**: Implementado

---

## 1. Preparação Inicial

### 1.1 Requisitos

- ✅ Google Developer Account ($25 USD - pagamento único)
- ✅ AAB (Android App Bundle) assinado
- ✅ Ícones e screenshots
- ✅ Descrição e política de privacidade
- ✅ Permissões declaradas

### 1.2 Criar Google Developer Account

1. Acesse [Google Play Console](https://play.google.com/console)
2. Clique em "Criar conta"
3. Preencha dados pessoais
4. Aceite termos de serviço
5. Pague taxa de $25 USD
6. Aguarde aprovação (24-48 horas)

---

## 2. Criar Aplicativo

### 2.1 Novo Aplicativo

1. No Google Play Console, clique em "Criar aplicativo"
2. Preencha:
   - **Nome do app**: WaveChat
   - **Idioma padrão**: Português (Brasil)
   - **Tipo de app**: Aplicativo
   - **Categoria**: Social
   - **Classificação indicativa**: 12+ (ou conforme necessário)
3. Clique em "Criar"

### 2.2 Informações do Aplicativo

1. Vá em "Configuração do aplicativo"
2. Preencha:
   - **Nome do app**: WaveChat
   - **Descrição curta**: Chat com chamadas de voz e vídeo em tempo real
   - **Descrição completa**: 
     ```
     WaveChat é um aplicativo de mensageria instantânea com suporte a chamadas de voz e vídeo em tempo real.
     
     Características:
     • Chat em tempo real com criptografia end-to-end
     • Chamadas de voz e vídeo de alta qualidade
     • Compartilhamento de mídia (fotos, vídeos)
     • Notificações push
     • Funcionamento offline
     • Sincronização automática
     
     Privacidade:
     Seus dados são criptografados e nunca compartilhados com terceiros.
     ```
   - **URL de privacidade**: https://wavechat.com/privacy
   - **URL de suporte**: https://wavechat.com/support
   - **Email de contato**: support@wavechat.com

### 2.3 Classificação de Conteúdo

1. Vá em "Classificação de conteúdo"
2. Preencha questionário:
   - **Violência**: Não
   - **Conteúdo sexual**: Não
   - **Profanidade**: Não
   - **Álcool/Tabaco/Drogas**: Não
   - **Jogos de azar**: Não
   - **Outros**: Não
3. Clique em "Salvar"

---

## 3. Ícones e Imagens

### 3.1 Ícone do Aplicativo

**Requisitos**:
- Tamanho: 512x512 px
- Formato: PNG
- Sem cantos arredondados (o sistema adiciona)
- Sem transparência (fundo sólido)

**Criar ícone**:
```bash
# Usar ferramentas como:
# - Figma
# - Adobe XD
# - Canva
# - GIMP

# Ou converter de SVG
convert icon.svg -resize 512x512 icon.png
```

### 3.2 Imagens de Destaque

**Requisitos**:
- Tamanho: 1024x500 px
- Formato: PNG ou JPEG
- Máximo 5 imagens

**Exemplos de imagens**:
1. Chat em tempo real
2. Chamadas de voz
3. Chamadas de vídeo
4. Compartilhamento de mídia
5. Notificações

### 3.3 Screenshots

**Requisitos**:
- Tamanho: 1080x1920 px (ou 1440x2560 px)
- Formato: PNG ou JPEG
- Mínimo 2, máximo 8 screenshots
- Mostrar principais funcionalidades

**Exemplos de screenshots**:
1. Tela de login
2. Lista de conversas
3. Chat aberto
4. Chamada de voz
5. Chamada de vídeo
6. Configurações

### 3.4 Imagem de Capa (Opcional)

**Requisitos**:
- Tamanho: 1200x500 px
- Formato: PNG ou JPEG

---

## 4. Upload do AAB

### 4.1 Gerar AAB Assinado

```bash
# No diretório do projeto
./gradlew bundleRelease

# Arquivo gerado em:
# android/app/release/app-release.aab
```

### 4.2 Verificar Assinatura

```bash
# Verificar se o AAB está assinado
jarsigner -verify -verbose -certs android/app/release/app-release.aab

# Resultado esperado:
# sm 3024 Fri May 23 10:00:00 BRT 2026 AndroidManifest.xml
# X.509, CN=WaveChat, OU=Development, O=WaveChat, L=São Paulo, ST=SP, C=BR
```

### 4.3 Upload no Google Play Console

1. Vá em "Teste" → "Teste interno"
2. Clique em "Criar versão"
3. Clique em "Fazer upload do AAB"
4. Selecione `app-release.aab`
5. Preencha "Notas da versão":
   ```
   Versão 1.22
   - Correção de bugs de chamadas
   - Melhorias de interface
   - Melhor desempenho
   ```
6. Clique em "Salvar"

---

## 5. Teste Interno

### 5.1 Adicionar Testadores

1. Vá em "Teste" → "Teste interno"
2. Clique em "Gerenciar testadores"
3. Clique em "Criar lista"
4. Preencha:
   - **Nome da lista**: Internal Testers
   - **Email dos testadores**: seu-email@gmail.com
5. Clique em "Salvar"

### 5.2 Compartilhar Link de Teste

1. Vá em "Teste" → "Teste interno"
2. Copie "Link de teste aberto"
3. Compartilhe com testadores
4. Testadores clicam no link e instalam o app

### 5.3 Coletar Feedback

Aguarde feedback dos testadores:
- Funcionalidades funcionam?
- Há crashes?
- Performance está boa?
- Interface está clara?

---

## 6. Teste Alfa

### 6.1 Criar Versão Alfa

1. Vá em "Teste" → "Teste alfa"
2. Clique em "Criar versão"
3. Upload do AAB (mesmo do teste interno)
4. Preencha notas da versão
5. Clique em "Salvar"

### 6.2 Adicionar Testadores Alfa

1. Clique em "Gerenciar testadores alfa"
2. Adicione até 1000 testadores
3. Compartilhe link de teste

---

## 7. Teste Beta

### 7.1 Criar Versão Beta

1. Vá em "Teste" → "Teste beta"
2. Clique em "Criar versão"
3. Upload do AAB
4. Preencha notas da versão
5. Clique em "Salvar"

### 7.2 Adicionar Testadores Beta

1. Clique em "Gerenciar testadores beta"
2. Adicione até 10.000 testadores
3. Compartilhe link de teste

---

## 8. Lançamento em Produção

### 8.1 Preparar Lançamento

1. Vá em "Lançamento" → "Produção"
2. Clique em "Criar versão"
3. Upload do AAB
4. Preencha:
   - **Notas da versão**: 
     ```
     Versão 1.22
     
     Novidades:
     • Correção de bugs de chamadas
     • Melhorias de interface
     • Melhor desempenho
     • Melhor suporte a Android antigo
     ```

### 8.2 Verificar Conformidade

Google Play verifica:
- ✅ Permissões declaradas
- ✅ Política de privacidade
- ✅ Conteúdo do app
- ✅ Classificação indicativa
- ✅ Segurança

### 8.3 Lançar Aplicativo

1. Clique em "Revisar"
2. Verifique todas as informações
3. Clique em "Lançar"
4. Aguarde aprovação (24-48 horas)

---

## 9. Permissões Necessárias

### 9.1 Declarar Permissões

O Google Play verifica se o app realmente precisa das permissões declaradas.

**Permissões do WaveChat**:

```xml
<!-- AndroidManifest.xml -->

<!-- Comunicação -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Chamadas de voz/vídeo -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Notificações -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Foreground Service -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" />

<!-- Full Screen Intent (chamadas) -->
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />

<!-- Vibração -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Mídia -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

<!-- Opcional: Contatos -->
<uses-permission android:name="android.permission.READ_CONTACTS" />
```

### 9.2 Justificar Permissões

No Google Play Console, vá em "Configuração do aplicativo" → "Permissões" e justifique cada uma:

| Permissão | Justificativa |
|-----------|---------------|
| RECORD_AUDIO | Necessário para chamadas de voz |
| CAMERA | Necessário para chamadas de vídeo |
| POST_NOTIFICATIONS | Notificações de chamadas recebidas |
| FOREGROUND_SERVICE | Manter chamada ativa em background |
| USE_FULL_SCREEN_INTENT | Mostrar tela de chamada em lock screen |
| READ_MEDIA_IMAGES | Compartilhar fotos no chat |
| READ_MEDIA_VIDEO | Compartilhar vídeos no chat |

---

## 10. Política de Privacidade

### 10.1 Criar Política

```markdown
# Política de Privacidade - WaveChat

**Última atualização**: 23 de maio de 2026

## 1. Informações que Coletamos

- Email e nome de usuário
- Contatos (se permitido)
- Mensagens e chamadas (criptografadas)
- Localização (se permitido)
- Informações de dispositivo

## 2. Como Usamos Suas Informações

- Fornecer serviço de chat e chamadas
- Melhorar o app
- Enviar notificações
- Suporte ao usuário

## 3. Compartilhamento de Dados

Não compartilhamos dados com terceiros, exceto:
- Serviços de hospedagem (Supabase, Firebase)
- Provedores de pagamento

## 4. Segurança

Usamos criptografia end-to-end para:
- Mensagens
- Chamadas de voz
- Chamadas de vídeo

## 5. Seus Direitos

Você pode:
- Acessar seus dados
- Solicitar exclusão
- Exportar dados
- Revogar consentimento

## 6. Contato

Email: privacy@wavechat.com
```

### 10.2 Publicar Política

1. Publique em seu website: `https://wavechat.com/privacy`
2. Adicione URL no Google Play Console
3. Certifique-se de que é acessível

---

## 11. Termos de Serviço

### 11.1 Criar Termos

```markdown
# Termos de Serviço - WaveChat

**Última atualização**: 23 de maio de 2026

## 1. Aceitação dos Termos

Ao usar WaveChat, você concorda com estes termos.

## 2. Uso Aceitável

Você concorda em:
- Não usar para atividades ilegais
- Não compartilhar conteúdo ofensivo
- Não spamear ou assediar outros usuários
- Não tentar contornar segurança

## 3. Propriedade Intelectual

Todo conteúdo do WaveChat é propriedade intelectual de WaveChat.

## 4. Limitação de Responsabilidade

WaveChat não é responsável por:
- Perda de dados
- Interrupção de serviço
- Danos indiretos

## 5. Encerramento

Podemos encerrar sua conta se violar estes termos.

## 6. Mudanças nos Termos

Podemos alterar estes termos a qualquer momento.

## 7. Contato

Email: legal@wavechat.com
```

---

## 12. Checklist Pré-Lançamento

- [ ] AAB gerado e assinado
- [ ] Ícone 512x512 criado
- [ ] 2-8 screenshots criados
- [ ] Descrição completa escrita
- [ ] Política de privacidade publicada
- [ ] Termos de serviço publicados
- [ ] Permissões justificadas
- [ ] Classificação indicativa definida
- [ ] Teste interno realizado
- [ ] Teste alfa realizado
- [ ] Teste beta realizado
- [ ] Versão incrementada (1.22)
- [ ] Notas de versão preenchidas

---

## 13. Pós-Lançamento

### 13.1 Monitorar Avaliações

1. Vá em "Avaliações" no Google Play Console
2. Leia feedback dos usuários
3. Responda a avaliações negativas
4. Corrija bugs relatados

### 13.2 Atualizar Aplicativo

1. Corrija bugs
2. Incremente versionCode
3. Crie nova versão (teste interno → beta → produção)
4. Publique atualização

### 13.3 Análise

1. Vá em "Estatísticas"
2. Monitore:
   - Instalações
   - Desinstalações
   - Crashes
   - Avaliações
   - Retenção

---

## 14. Próximos Passos

1. **Fase 9**: Documentação final e entrega

---

## 15. Referências

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Bundle Format](https://developer.android.com/guide/app-bundle)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)
- [Privacy Policy Template](https://www.privacypolicies.com/)

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 1.22 (versionCode: 23)
