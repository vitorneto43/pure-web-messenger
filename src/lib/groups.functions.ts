import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categoryEnum = z.enum([
  "business","tech","games","music","entertainment","relationships","travel","sports","education","other",
]);
const visibilityEnum = z.enum(["private", "public"]);
const joinPolicyEnum = z.enum(["open", "request"]);
const reportReasonEnum = z.enum(["spam","adult","violence","scam","copyright","other"]);
const sortEnum = z.enum(["popular","recent","growing"]);

export type GroupCategory = z.infer<typeof categoryEnum>;
export type GroupVisibility = z.infer<typeof visibilityEnum>;
export type GroupJoinPolicy = z.infer<typeof joinPolicyEnum>;

export type PublicGroup = {
  id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  category: GroupCategory | null;
  join_policy: GroupJoinPolicy;
  member_count: number;
  created_at: string;
};

function makePublicClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Public reads ----------

export const discoverGroupsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    sort: sortEnum.default("popular"),
    category: categoryEnum.optional(),
    limit: z.number().int().min(1).max(50).default(24),
  }).parse(d ?? {}))
  .handler(async ({ data }): Promise<{ groups: PublicGroup[] }> => {
    const sb = makePublicClient();
    let q = sb.from("conversations")
      .select("id, name, description, avatar_url, category, join_policy, member_count, created_at")
      .eq("is_group", true)
      .eq("visibility", "public");
    if (data.category) q = q.eq("category", data.category);
    if (data.sort === "recent") q = q.order("created_at", { ascending: false });
    else q = q.order("member_count", { ascending: false });
    q = q.limit(data.limit);
    const { data: rows, error } = await q;
    if (error) { console.error("discoverGroupsPublic", error); return { groups: [] }; }
    return { groups: (rows ?? []) as PublicGroup[] };
  });

export const searchGroupsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().min(1).max(60),
    limit: z.number().int().min(1).max(30).default(15),
  }).parse(d))
  .handler(async ({ data }): Promise<{ groups: PublicGroup[] }> => {
    const sb = makePublicClient();
    const { data: rows, error } = await sb
      .from("conversations")
      .select("id, name, description, avatar_url, category, join_policy, member_count, created_at")
      .eq("is_group", true)
      .eq("visibility", "public")
      .ilike("name", `%${data.q}%`)
      .order("member_count", { ascending: false })
      .limit(data.limit);
    if (error) { console.error("searchGroupsPublic", error); return { groups: [] }; }
    return { groups: (rows ?? []) as PublicGroup[] };
  });

export const getGroupPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ group: PublicGroup | null; admins: { id: string; username: string; display_name: string; avatar_url: string | null }[] }> => {
    const sb = makePublicClient();
    const { data: g } = await sb
      .from("conversations")
      .select("id, name, description, avatar_url, category, join_policy, member_count, created_at, visibility, is_group")
      .eq("id", data.id)
      .maybeSingle();
    if (!g || g.is_group !== true || g.visibility !== "public") return { group: null, admins: [] };
    const { data: adminRows } = await sb
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.id)
      .eq("role", "admin");
    const ids = (adminRows ?? []).map((a: any) => a.user_id);
    let admins: any[] = [];
    if (ids.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      admins = profs ?? [];
    }
    const { visibility: _v, is_group: _ig, ...pub } = g as any;
    return { group: pub as PublicGroup, admins };
  });

// ---------- Authenticated ----------

export const getGroupMembershipStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    const { data: req } = await supabase
      .from("group_join_requests")
      .select("status")
      .eq("conversation_id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    return {
      isMember: !!mem,
      isAdmin: mem?.role === "admin",
      requestStatus: (req?.status as "pending"|"approved"|"rejected"|undefined) ?? null,
    };
  });

export const joinOpenGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g, error: gErr } = await supabase
      .from("conversations")
      .select("id, visibility, join_policy, is_group")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr || !g || !g.is_group || g.visibility !== "public") throw new Error("Grupo não encontrado");
    if (g.join_policy !== "open") throw new Error("Este grupo exige aprovação");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversation_members")
      .insert({ conversation_id: data.id, user_id: userId, role: "member" });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

export const requestJoinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    message: z.string().max(280).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("conversations")
      .select("id, visibility, is_group")
      .eq("id", data.id).maybeSingle();
    if (!g || !g.is_group || g.visibility !== "public") throw new Error("Grupo não encontrado");
    const { error } = await supabase
      .from("group_join_requests")
      .upsert({ conversation_id: data.id, user_id: userId, message: data.message ?? null, status: "pending" }, { onConflict: "conversation_id,user_id" });
    if (error) throw error;
    return { ok: true };
  });

export const decideJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    requestId: z.string().uuid(),
    decision: z.enum(["approved","rejected"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_join_requests")
      .update({ status: data.decision, decided_by: userId, decided_at: new Date().toISOString() })
      .eq("id", data.requestId);
    if (error) throw error;
    return { ok: true };
  });

export const listPendingJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("group_join_requests")
      .select("id, user_id, message, created_at")
      .eq("conversation_id", data.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const ids = (rows ?? []).map((r: any) => r.user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
      profiles = p ?? [];
    }
    return {
      requests: (rows ?? []).map((r: any) => ({
        ...r,
        profile: profiles.find(p => p.id === r.user_id) ?? null,
      })),
    };
  });

export const updateGroupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    category: categoryEnum.nullable().optional(),
    visibility: visibilityEnum.optional(),
    join_policy: joinPolicyEnum.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("conversations").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const reportGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    reason: reportReasonEnum,
    details: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("group_reports").insert({
      conversation_id: data.id, reporter_id: userId, reason: data.reason, details: data.details ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listGroupReportsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" } as any);
    const { data: isMod } = await supabase.rpc("has_role", { _user_id: userId, _role: "moderator" } as any);
    if (!isAdmin && !isMod) throw new Error("Forbidden");
    const { data } = await supabase
      .from("group_reports")
      .select("id, conversation_id, reporter_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return { reports: data ?? [] };
  });
