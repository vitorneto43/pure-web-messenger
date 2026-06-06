---
name: Próxima versão Android (terça)
description: Pendências confirmadas pelo usuário para a próxima build do app Android — funcionam no web mas não no APK atual
type: feature
---
Itens a entregar na próxima versão do app (a partir de terça-feira). Funcionam no preview/web, mas o APK atual não está executando — provavelmente faltam permissões/plugins Capacitor ou wiring nativo.

1. **Baixar e compartilhar status** no app nativo (atualmente só funciona no web). Verificar `@capacitor/filesystem` + `@capacitor/share` no fluxo de `src/lib/share-message.ts` e download. Conferir permissões `WRITE_EXTERNAL_STORAGE` / `READ_MEDIA_*` no `AndroidManifest.xml`.
2. **Baixar e compartilhar o QR code** (convite) no app nativo — mesmo problema, precisa rodar via Filesystem/Share do Capacitor em vez de `<a download>`.
3. **Google Login Auth** funcionando dentro do APK. No web usa `lovable.auth.signInWithOAuth("google")` via popup — no app precisa de fluxo nativo (Capacitor browser/custom tabs ou `@capacitor-community/google-auth`) com redirect deep link configurado.
4. **Geolocalização** no app nativo. Adicionar `@capacitor/geolocation`, permissões `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` no manifest, e usar o plugin em vez de `navigator.geolocation` quando `Capacitor.isNativePlatform()`.

Deadline: nova versão a partir de terça-feira.
