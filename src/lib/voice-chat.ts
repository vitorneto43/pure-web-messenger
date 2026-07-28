import { supabase } from "@/integrations/supabase/client";
import { sendMessagePush } from "@/lib/push.functions";

/** Normaliza texto falado: sem acentos, minúsculo, sem pontuação. */
export function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VoiceConversation = {
  id: string;
  title: string;
  isGroup: boolean;
};

/** Lista as conversas do usuário com um título legível para busca por voz. */
export async function listVoiceConversations(userId: string): Promise<VoiceConversation[]> {
  const { data: members } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const convIds = (members ?? []).map((m) => m.conversation_id);
  if (!convIds.length) return [];

  const { data: convs } = await supabase
    .from("conversations")
    .select("id, name, is_group, updated_at")
    .in("id", convIds)
    .order("updated_at", { ascending: false });

  const { data: allMembers } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds);

  const otherIds = Array.from(
    new Set((allMembers ?? []).filter((m) => m.user_id !== userId).map((m) => m.user_id)),
  );
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, username, display_name").in("id", otherIds)
    : { data: [] as any[] };
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return (convs ?? []).map((c: any) => {
    if (c.is_group) return { id: c.id, title: c.name || "Grupo", isGroup: true };
    const other = (allMembers ?? []).find(
      (m) => m.conversation_id === c.id && m.user_id !== userId,
    );
    const p: any = other ? profileMap.get(other.user_id) : null;
    return {
      id: c.id,
      title: p?.display_name || p?.username || "Conversa",
      isGroup: false,
    };
  });
}

/** Procura a conversa cujo título mais se aproxima do nome falado. */
export function matchConversation(list: VoiceConversation[], spoken: string) {
  const q = normalize(spoken);
  if (!q) return null;
  const scored = list
    .map((c) => {
      const t = normalize(c.title);
      let score = 0;
      if (t === q) score = 100;
      else if (t.startsWith(q) || q.startsWith(t)) score = 80;
      else if (t.includes(q) || q.includes(t)) score = 60;
      else {
        const words = q.split(" ").filter((w) => w.length > 2);
        score = words.filter((w) => t.includes(w)).length * 20;
      }
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.c ?? null;
}

export type VoiceMessage = { mine: boolean; author: string; text: string };

/** Últimas mensagens de uma conversa, prontas para narração. */
export async function readConversationMessages(
  conversationId: string,
  userId: string,
  limit = 10,
): Promise<VoiceMessage[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, content, attachment_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const msgs = (data ?? []).slice().reverse();
  const senderIds = Array.from(new Set(msgs.map((m: any) => m.sender_id)));
  const { data: profiles } = senderIds.length
    ? await supabase.from("profiles").select("id, display_name, username").in("id", senderIds)
    : { data: [] as any[] };
  const map = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name || p.username]));
  return msgs.map((m: any) => ({
    mine: m.sender_id === userId,
    author: m.sender_id === userId ? "Você" : map.get(m.sender_id) || "Alguém",
    text:
      (m.content && String(m.content).trim()) ||
      (m.attachment_type?.startsWith("image")
        ? "enviou uma imagem"
        : m.attachment_type
          ? "enviou um arquivo"
          : ""),
  }));
}

/** Envia uma mensagem de texto ditada por voz. */
export async function sendVoiceMessage(
  conversationId: string,
  userId: string,
  content: string,
) {
  const text = content.trim();
  if (!text) return { ok: false as const, error: "Mensagem vazia" };
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    content: text,
  });
  if (error) return { ok: false as const, error: error.message };
  void supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  void sendMessagePush({ data: { conversationId, preview: text } }).catch(() => {});
  return { ok: true as const };
}

/** Busca um perfil pelo nome/@usuário falado. */
export async function findProfileByName(spoken: string) {
  const q = normalize(spoken).replace(/^arroba\s*/, "").replace(/^@/, "").trim();
  if (!q) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(10);
  if (!data?.length) return null;
  const exact = data.find(
    (p: any) => normalize(p.username) === q || normalize(p.display_name || "") === q,
  );
  return (exact ?? data[0]) as { id: string; username: string; display_name: string };
}

/** Segue ou deixa de seguir garantindo o estado desejado. */
export async function setFollowState(targetId: string, userId: string, follow: boolean) {
  const { data: existing } = await supabase
    .from("profile_follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("following_id", targetId)
    .maybeSingle();
  const isFollowing = !!existing;
  if (isFollowing === follow) return { ok: true as const, changed: false, following: follow };
  const { data, error } = await supabase.rpc("toggle_follow", { _target: targetId });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, changed: true, following: !!data };
}
