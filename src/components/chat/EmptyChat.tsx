import { useState } from "react";
import { MessageCircle, UserPlus, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "@/components/InviteDialog";
import { useTranslation } from "react-i18next";

interface Props {
  onNewChat?: () => void;
}

export function EmptyChat({ onNewChat }: Props) {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="h-full grid place-items-center px-6 text-center">
      <div className="max-w-sm w-full">
        <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-xl">
          <MessageCircle className="size-7 text-primary-foreground" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">{t("chat.emptyChatTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("chat.emptyChatDescription")}
        </p>

        <div className="mt-6 space-y-2">
          <Button
            onClick={() => setInviteOpen(true)}
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <Share2 className="size-5 mr-2" />
            {t("chat.inviteWhatsApp")}
          </Button>
          <Button
            onClick={() => setInviteOpen(true)}
            size="lg"
            variant="secondary"
            className="w-full"
          >
            <QrCode className="size-5 mr-2" />
            {t("chat.showQrCode")}
          </Button>
          {onNewChat && (
            <Button onClick={onNewChat} size="lg" variant="outline" className="w-full">
              <UserPlus className="size-5 mr-2" />
              {t("chat.searchUser")}
            </Button>
          )}
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground">
          {t("chat.emptyChatPromo")}
        </p>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
