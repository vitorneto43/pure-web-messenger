import { Forward, Languages, MessageSquareReply, Share2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { shareMessageExternally } from "@/lib/share-message";

export interface ActionableMessage {
  id: string;
  sender_id: string;
  created_at: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  deleted_for_everyone_at: string | null;
}

// Janela para "apagar para todos" — 1 hora.
const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 1000;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: ActionableMessage | null;
  onForward: () => void;
  onTranslate?: (text: string) => void;
  onSuggestReply?: (text: string) => void;
}

export function MessageActionsDialog({
  open,
  onOpenChange,
  message,
  onForward,
  onTranslate,
  onSuggestReply,
}: Props) {
  const { user } = useAuth();
  if (!message || !user) return null;

  const isMine = message.sender_id === user.id;
  const isAlreadyDeletedForAll = !!message.deleted_for_everyone_at;
  const hasText = !!message.content && !message.content.startsWith("[[");
  const withinWindow =
    Date.now() - new Date(message.created_at).getTime() < DELETE_FOR_EVERYONE_WINDOW_MS;

  async function deleteForMe() {
    try {
      const { data: row, error: readErr } = await supabase
        .from("messages")
        .select("deleted_for")
        .eq("id", message!.id)
        .single();
      if (readErr) throw readErr;
      const current = (row?.deleted_for as string[] | null) ?? [];
      if (!current.includes(user!.id)) {
        const { error } = await supabase
          .from("messages")
          .update({ deleted_for: [...current, user!.id] })
          .eq("id", message!.id);
        if (error) throw error;
      }
      toast.success("Mensagem apagada para você");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao apagar");
    }
  }

  async function deleteForEveryone() {
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          deleted_for_everyone_at: new Date().toISOString(),
          content: null,
          attachment_url: null,
          attachment_type: null,
          attachment_name: null,
        })
        .eq("id", message!.id);
      if (error) throw error;
      toast.success("Mensagem apagada para todos");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao apagar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mensagem</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          {!isAlreadyDeletedForAll && hasText && onTranslate && (
            <Button
              variant="ghost"
              className="justify-start h-12"
              onClick={() => onTranslate(message!.content!)}
            >
              <Languages className="size-4 mr-3 text-primary" /> Traduzir com IA
            </Button>
          )}
          {!isAlreadyDeletedForAll && hasText && !isMine && onSuggestReply && (
            <Button
              variant="ghost"
              className="justify-start h-12"
              onClick={() => onSuggestReply(message!.content!)}
            >
              <MessageSquareReply className="size-4 mr-3 text-primary" /> Responder com IA
            </Button>
          )}
          {!isAlreadyDeletedForAll && (
            <Button variant="ghost" className="justify-start h-12" onClick={onForward}>
              <Forward className="size-4 mr-3" /> Encaminhar
            </Button>
          )}
          {!isAlreadyDeletedForAll && (message!.content || message!.attachment_url) && (
            <Button
              variant="ghost"
              className="justify-start h-12"
              onClick={async () => {
                await shareMessageExternally({
                  content: message!.content,
                  attachment_url: message!.attachment_url,
                  attachment_type: message!.attachment_type,
                  attachment_name: message!.attachment_name,
                });
                onOpenChange(false);
              }}
            >
              <Share2 className="size-4 mr-3 text-primary" /> Compartilhar fora do WaveChat
            </Button>
          )}
          <Button variant="ghost" className="justify-start h-12" onClick={deleteForMe}>
            <Trash2 className="size-4 mr-3" /> Apagar para mim
          </Button>
          {isMine && !isAlreadyDeletedForAll && withinWindow && (
            <Button
              variant="ghost"
              className="justify-start h-12 text-destructive hover:text-destructive"
              onClick={deleteForEveryone}
            >
              <Users className="size-4 mr-3" /> Apagar para todos
            </Button>
          )}
          {isMine && !isAlreadyDeletedForAll && !withinWindow && (
            <p className="text-[11px] text-muted-foreground px-2">
              Tempo limite para apagar para todos expirou (1 hora).
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
