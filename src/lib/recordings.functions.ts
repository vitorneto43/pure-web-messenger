import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRecordingConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { recordingConfig } = await import("./livekit-egress.server");
  return recordingConfig();
});

export const startLiveRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: live } = await supabase
      .from("live_sessions")
      .select("id,host_id,status,livekit_room,will_record")
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live) throw new Error("Live não encontrada");
    if (live.host_id !== userId) throw new Error("Apenas o host pode gravar");
    if (live.status !== "live") throw new Error("Live não está ativa");

    // already recording?
    const { data: existing } = await supabase
      .from("live_recordings")
      .select("id,status")
      .eq("live_id", data.liveId)
      .in("status", ["pending", "recording", "processing"])
      .maybeSingle();
    if (existing) return { ok: true, recordingId: existing.id, already: true };

    const { startRoomCompositeEgress } = await import("./livekit-egress.server");
    const res = await startRoomCompositeEgress({
      room: live.livekit_room,
      hostId: userId,
      liveId: live.id,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rec, error } = await supabaseAdmin
      .from("live_recordings")
      .insert({
        live_id: live.id,
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
    await supabaseAdmin.from("live_sessions").update({ will_record: true }).eq("id", live.id);
    return { ok: true, recordingId: rec.id };
  });

export const stopLiveRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rec } = await supabase
      .from("live_recordings")
      .select("id,host_id,livekit_egress_id,status")
      .eq("live_id", data.liveId)
      .in("status", ["pending", "recording", "processing"])
      .maybeSingle();
    if (!rec) return { ok: true };
    if (rec.host_id !== userId) throw new Error("Apenas o host pode parar a gravação");
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

export const listMyRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("live_recordings")
      .select("*")
      .eq("host_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const togglePublishRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; isPublic: boolean }) =>
    z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("live_recordings")
      .update({ is_public: data.isPublic })
      .eq("id", data.id)
      .eq("host_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rec } = await context.supabase
      .from("live_recordings")
      .select("storage_path,host_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!rec || rec.host_id !== context.userId) throw new Error("Forbidden");
    if (rec.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("live-recordings").remove([rec.storage_path]);
    }
    const { error } = await context.supabase.from("live_recordings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRecordingSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rec } = await context.supabase
      .from("live_recordings")
      .select("storage_path,host_id,is_public")
      .eq("id", data.id)
      .maybeSingle();
    if (!rec) throw new Error("Não encontrada");
    if (rec.host_id !== context.userId && !rec.is_public) throw new Error("Forbidden");
    if (!rec.storage_path) throw new Error("Gravação ainda processando");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("live-recordings")
      .createSignedUrl(rec.storage_path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
