import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mint a LiveKit access token scoped to a 1:1 call.
 * The room name is deterministic: `call-${callId}`.
 * Only the caller or callee may join.
 */
export const createCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string }) =>
    z.object({ callId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: call, error } = await supabase
      .from("calls")
      .select("id, caller_id, callee_id, kind, status")
      .eq("id", data.callId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!call) throw new Error("Chamada não encontrada");
    if (call.caller_id !== userId && call.callee_id !== userId) {
      throw new Error("Sem acesso a esta chamada");
    }
    if (!["ringing", "accepted"].includes(call.status)) {
      throw new Error("Chamada já encerrada");
    }
    const { createLiveKitToken } = await import("./livekit-token.server");
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();
    const token = await createLiveKitToken({
      identity: userId,
      name: prof?.display_name || prof?.username || "Usuário",
      room: `call-${call.id}`,
      canPublish: true,
      ttlSeconds: 60 * 60 * 4,
    });
    return token;
  });

/**
 * Mint a LiveKit token for an ad-hoc group call inside a conversation.
 * Any member of the conversation can join. Room name is deterministic per
 * conversation so everyone hits the same room.
 */
export const createGroupCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; roomSuffix?: string }) =>
    z.object({
      conversationId: z.string().uuid(),
      roomSuffix: z.string().min(1).max(64).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: membership } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Você não faz parte desta conversa");
    const { createLiveKitToken } = await import("./livekit-token.server");
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();
    const suffix = data.roomSuffix ?? "main";
    const token = await createLiveKitToken({
      identity: userId,
      name: prof?.display_name || prof?.username || "Usuário",
      room: `gcall-${data.conversationId}-${suffix}`,
      canPublish: true,
      ttlSeconds: 60 * 60 * 4,
    });
    return token;
  });

/**
 * Start composite recording of a 1:1 call. Caller-only.
 */
export const startCallRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string }) =>
    z.object({ callId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: call } = await supabase
      .from("calls")
      .select("id, caller_id, callee_id, status")
      .eq("id", data.callId)
      .maybeSingle();
    if (!call) throw new Error("Chamada não encontrada");
    if (call.caller_id !== userId) {
      throw new Error("Apenas quem ligou pode gravar");
    }
    if (call.status !== "accepted") throw new Error("Chamada não está ativa");

    const { data: existing } = await supabase
      .from("live_recordings")
      .select("id,status")
      .eq("call_id", data.callId)
      .in("status", ["pending", "recording", "processing"])
      .maybeSingle();
    if (existing) return { ok: true, recordingId: existing.id, already: true };

    const { startRoomCompositeEgress } = await import("./livekit-egress.server");
    const res = await startRoomCompositeEgress({
      room: `call-${call.id}`,
      hostId: userId,
      liveId: call.id, // used only for filepath naming
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rec, error } = await supabaseAdmin
      .from("live_recordings")
      .insert({
        call_id: call.id,
        live_id: null,
        host_id: userId,
        livekit_egress_id: res.egressId,
        status: "recording",
        storage_path: res.storagePath,
        file_url: res.fileUrl || null,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, recordingId: rec.id };
  });

export const stopCallRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string }) =>
    z.object({ callId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rec } = await supabase
      .from("live_recordings")
      .select("id, host_id, livekit_egress_id, status")
      .eq("call_id", data.callId)
      .in("status", ["pending", "recording", "processing"])
      .maybeSingle();
    if (!rec) return { ok: true };
    if (rec.host_id !== userId) throw new Error("Sem permissão");
    if (rec.livekit_egress_id) {
      try {
        const { stopEgress } = await import("./livekit-egress.server");
        await stopEgress(rec.livekit_egress_id);
      } catch (e) {
        console.error("stopEgress failed", e);
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("live_recordings")
      .update({ status: "processing", ended_at: new Date().toISOString() })
      .eq("id", rec.id);
    return { ok: true };
  });
