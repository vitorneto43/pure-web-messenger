// Adsterra removido em 2026-06-18.
//
// Motivo: a rede Adsterra (highperformanceformat.com / effectivecpmnetwork.com)
// distribui malvertising (popunders, redirects para IPTV/golpes/fake updates) e
// fez o Google Ads classificar webconnectchat.com como "Site comprometido",
// reprovando as campanhas. Os arquivos /public/ads/* e o script nativo
// invoke.js foram removidos. Este componente vira um no-op para não quebrar
// imports existentes em ChatSidebar e StatusViewer.

type Variant = "banner_320x50" | "banner_300x250" | "native";

interface Props {
  variant?: Variant;
  className?: string;
}

export function AdsterraBanner(_props: Props) {
  return null;
}
