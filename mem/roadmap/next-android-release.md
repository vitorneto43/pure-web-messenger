---
name: Próxima versão Android (terça)
description: Pendências confirmadas pelo usuário para a próxima build do app Android — funcionam no web mas não no APK atual
type: feature
---
Itens entregues no código (a validar na próxima build APK):

1. **Download de status no app nativo** — `src/lib/download.ts` agora usa `saveNativeImageToGallery` para imagens e `@capacitor/filesystem` + `@capacitor/share` para vídeo/outros, abrindo o share sheet para o usuário salvar/compartilhar fora do app.
2. **Download/Compartilhar QR code** — `src/components/InviteDialog.tsx` já chamava `saveNativeImageToGallery` + `@capacitor/share`; nenhuma alteração adicional necessária.
3. **Geolocalização nativa** — `src/hooks/use-live-location-broadcast.tsx` agora usa `@capacitor/geolocation` (`watchPosition`) com fallback para `navigator.geolocation` no web. `ShareLocationDialog` já estava correto.
4. **Google Login no APK** — novo `src/lib/native-google-auth.ts` abre o broker em Chrome Custom Tab via `@capacitor/browser`; deep link `com.wavechat.app://oauth-callback` retorna ao app, `AuthProvider` aplica tokens via `supabase.auth.setSession`. Intent filter adicionado em `AndroidManifest.xml`.

Plugins Capacitor instalados: `@capacitor/browser`, `@capacitor/app` (além dos já existentes).

A testar no APK: confirmar que o broker da Lovable aceita o redirect_uri `com.wavechat.app://oauth-callback`. Se rejeitar, será preciso configurar App Links HTTPS via assetlinks.json em `webconnectchat.com` e usar `https://webconnectchat.com/oauth-callback` como redirect.
