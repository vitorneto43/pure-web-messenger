import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCall } from "@/hooks/use-call";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function IncomingCallDialog() {
  const { t } = useTranslation();
  const { incoming, acceptIncoming, declineIncoming } = useCall();
  const [ringAnimation, setRingAnimation] = useState(true);

  useEffect(() => {
    if (!incoming) return;

    // Pulse animation for the accept button
    const interval = setInterval(() => {
      setRingAnimation((prev) => !prev);
    }, 1500);

    return () => clearInterval(interval);
  }, [incoming]);

  if (!incoming) return null;

  const peer = incoming.peerProfile;
  const isVideo = incoming.kind === "video";

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Main card */}
      <div className="w-full max-w-sm bg-gradient-to-b from-zinc-900 to-black rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        {/* Header with caller info */}
        <div className="relative pt-8 pb-12 px-6 text-center">
          {/* Decorative gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent pointer-events-none" />

          {/* Avatar */}
          <div className="relative mb-6 flex justify-center">
            <div className="relative">
              <Avatar className="size-32 border-4 border-white/20 shadow-xl">
                <AvatarImage src={peer?.avatar_url ?? undefined} />
                <AvatarFallback className="text-5xl bg-gradient-to-br from-blue-500 to-purple-600">
                  {peer?.display_name?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>

              {/* Call type badge */}
              <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-2 shadow-lg border-2 border-black">
                <div className="text-white text-sm font-bold">
                  {isVideo ? "📹" : "🎤"}
                </div>
              </div>
            </div>
          </div>

          {/* Caller name */}
          <h2 className="text-3xl font-bold text-white mb-2">
            {peer?.display_name ?? t("call.unknownCaller")}
          </h2>

          {/* Call type */}
          <p className="text-sm text-zinc-400 font-medium">
            {isVideo ? t("call.incomingVideo") : t("call.incomingVoice")}
          </p>

          {/* Ringing animation */}
          <div className="mt-6 flex justify-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-zinc-400 font-medium">{t("call.statusConnecting")}</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse animation-delay-100" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-8 flex gap-4">
          {/* Decline button */}
          <Button
            onClick={declineIncoming}
            className="flex-1 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            title={t("call.declineTitle")}
          >
            <PhoneOff className="size-6" />
            <span className="hidden sm:inline">{t("call.decline")}</span>
          </Button>

          {/* Accept button - prominent with animation */}
          <Button
            onClick={acceptIncoming}
            className={`flex-1 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
              ringAnimation ? "ring-4 ring-green-400/50 ring-offset-2 ring-offset-black" : ""
            }`}
            title={t("call.answerTitle")}
          >
            <Phone className="size-6" />
            <span className="hidden sm:inline">{t("call.answer")}</span>
          </Button>
        </div>

        {/* Footer info */}
        <div className="px-6 pb-6 text-center text-xs text-zinc-500 border-t border-white/5 pt-4">
          <p>{t("call.swipeHint")}</p>
        </div>
      </div>

      {/* Floating elements for visual appeal */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated background circles */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-200" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      </div>
    </div>
  );
}
