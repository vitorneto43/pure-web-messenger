import { HandTalkWidget } from "./HandTalkWidget";
import { VLibrasWidget } from "./VLibrasWidget";

/**
 * Fase 5 — Provider de Língua de Sinais.
 *
 * Se `VITE_HANDTALK_TOKEN` estiver definido, ativa o HandTalk (avatar Hugo,
 * LIBRAS completa — produto pago, https://www.handtalk.me/plugin).
 * Caso contrário, mantém o VLibras (gratuito, governo BR) já em produção.
 *
 * Ambos widgets expõem o mesmo contrato:
 *   - window.wavechatOpenVLibras()
 *   - evento `wavechat:open-vlibras`
 *   - window.plugin.translate(text)
 * de modo que PostLibrasButton, ChatSidebar e demais integrações continuam
 * funcionando sem alteração ao trocar de provider.
 */
export function SignLanguageProvider() {
  const token = import.meta.env.VITE_HANDTALK_TOKEN as string | undefined;
  if (token && token.trim().length > 0) {
    return <HandTalkWidget token={token.trim()} />;
  }
  return <VLibrasWidget />;
}
