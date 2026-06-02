import { createFileRoute } from "@tanstack/react-router";

// Android App Links verification file.
// Servido em: https://webconnectchat.com/.well-known/assetlinks.json
//
// IMPORTANTE: substitua o valor de sha256_cert_fingerprints abaixo pela
// impressão digital SHA-256 do certificado de assinatura do APK/AAB.
// Para obter: keytool -list -v -keystore <seu.keystore> -alias <alias>
// (ou na Play Console: Configuração > Integridade do app > Certificado de
//  assinatura do app pelo Google Play > Impressão digital do certificado SHA-256)
const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.wavechat.app",
      sha256_cert_fingerprints: [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
      ],
    },
  },
];

export const Route = createFileRoute("/api/public/.well-known/assetlinks{.}json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(ASSET_LINKS, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
