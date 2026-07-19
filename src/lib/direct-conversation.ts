import { supabase } from "@/integrations/supabase/client";
import { isMutualFollow, MUTUAL_FOLLOW_MESSAGE } from "@/lib/mutual-follow";


/** Find or create a 1:1 conversation between the current user and another user. */
export async function getOrCreateDirectConversation(
  meId: string,
  otherUserId: string,
): Promise<string> {
  if (!(await isMutualFollow(meId, otherUserId))) {
    throw new Error(MUTUAL_FOLLOW_MESSAGE);
  }

  const { data: myConvs } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversations!inner(is_group)")
    .eq("user_id", meId);
  const candidateIds = (myConvs ?? [])
    .filter((m: any) => !m.conversations.is_group)
    .map((m: any) => m.conversation_id as string);
  if (candidateIds.length) {
    const { data: matches } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", candidateIds);
    if (matches && matches.length) return matches[0].conversation_id as string;
  }
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ is_group: false, created_by: meId })
    .select()
    .single();
  if (convErr) throw convErr;
  const { error: memErr } = await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: meId },
    { conversation_id: conv.id, user_id: otherUserId },
  ]);
  if (memErr) throw memErr;
  return conv.id as string;
}
