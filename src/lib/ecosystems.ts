import { supabase } from "@/integrations/supabase/client";

export type EcosystemCategory = "business" | "study" | "sports" | "community" | "government" | "other";
export type EcosystemVisibility = "private" | "unlisted";
export type EcosystemJoinPolicy = "invite" | "link" | "code" | "request";
export type EcosystemRole = "owner" | "admin" | "moderator" | "member";

export interface Ecosystem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: EcosystemCategory;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  website: string | null;
  contact_email: string | null;
  visibility: EcosystemVisibility;
  join_policy: EcosystemJoinPolicy;
  join_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  allow_public_crosspost: boolean;
  public_crosspost_requires_admin: boolean;
}

export interface EcosystemMembership {
  ecosystem_id: string;
  user_id: string;
  role: EcosystemRole;
  status: "active" | "pending" | "banned";
  joined_at: string;
}

const sb = supabase as any;

export const CATEGORIES: { value: EcosystemCategory; label: string; description: string }[] = [
  { value: "business", label: "Wavechat for Business", description: "Empresas e times corporativos" },
  { value: "study", label: "Wavechat for Study", description: "Universidades, escolas e cursos" },
  { value: "sports", label: "Wavechat for Sports", description: "Clubes, times e torcidas" },
  { value: "community", label: "Wavechat for Communities", description: "Comunidades locais e grupos" },
  { value: "government", label: "Wavechat for Government", description: "Órgãos e instituições" },
  { value: "other", label: "Outro", description: "Outra categoria de organização" },
];

export async function listMyEcosystems(): Promise<Ecosystem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from("ecosystem_members")
    .select("ecosystem_id, role, ecosystems:ecosystem_id ( * )")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.ecosystems as Ecosystem)
    .filter(Boolean)
    .sort((a: Ecosystem, b: Ecosystem) => a.name.localeCompare(b.name));
}

export async function getEcosystemBySlug(slug: string): Promise<Ecosystem | null> {
  const { data, error } = await sb.from("ecosystems").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Ecosystem) ?? null;
}

export async function getMyRole(ecosystemId: string): Promise<EcosystemRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("ecosystem_members")
    .select("role, status")
    .eq("ecosystem_id", ecosystemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data.role as EcosystemRole;
}

function randomCode(len = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createEcosystem(input: {
  name: string;
  slug: string;
  description?: string;
  category: EcosystemCategory;
  visibility?: EcosystemVisibility;
  join_policy?: EcosystemJoinPolicy;
  primary_color?: string;
  website?: string;
  contact_email?: string;
}): Promise<Ecosystem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login para criar um ecossistema.");
  const { data, error } = await sb
    .from("ecosystems")
    .insert({
      ...input,
      visibility: input.visibility ?? "private",
      join_policy: input.join_policy ?? "invite",
      join_code: randomCode(8),
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Ecosystem;
}

export async function joinByCode(code: string): Promise<Ecosystem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login para entrar em um ecossistema.");
  const trimmed = code.trim();
  const { data: inv } = await sb
    .from("ecosystem_invites")
    .select("id, ecosystem_id, role_on_join, expires_at, max_uses, uses")
    .eq("code", trimmed)
    .maybeSingle();

  let ecosystemId: string | null = null;
  let role: EcosystemRole = "member";
  let inviteId: string | null = null;

  if (inv) {
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) throw new Error("Convite expirado.");
    if (inv.max_uses != null && inv.uses >= inv.max_uses) throw new Error("Convite esgotado.");
    ecosystemId = inv.ecosystem_id;
    role = inv.role_on_join as EcosystemRole;
    inviteId = inv.id;
  } else {
    // Try join_code direto no ecosystems
    const { data: eco } = await sb
      .from("ecosystems")
      .select("id, join_policy")
      .eq("join_code", trimmed)
      .maybeSingle();
    if (!eco) throw new Error("Código inválido.");
    if (eco.join_policy === "invite") throw new Error("Este ecossistema aceita apenas convites diretos.");
    ecosystemId = eco.id;
  }

  const { error: memErr } = await sb
    .from("ecosystem_members")
    .upsert(
      { ecosystem_id: ecosystemId, user_id: user.id, role, status: "active" },
      { onConflict: "ecosystem_id,user_id" },
    );
  if (memErr) throw memErr;

  if (inviteId) {
    await sb.rpc("noop"); // placeholder; incrementing uses handled by admin fn later
    await sb.from("ecosystem_invites").update({ uses: (inv!.uses ?? 0) + 1 }).eq("id", inviteId);
  }

  const { data: full } = await sb.from("ecosystems").select("*").eq("id", ecosystemId).single();
  return full as Ecosystem;
}

// ============================================================================
// Members admin
// ============================================================================

export interface EcosystemMember {
  ecosystem_id: string;
  user_id: string;
  role: EcosystemRole;
  status: "active" | "pending" | "banned";
  joined_at: string;
  profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export async function listEcosystemMembers(ecosystemId: string): Promise<EcosystemMember[]> {
  const { data, error } = await sb
    .from("ecosystem_members")
    .select("ecosystem_id, user_id, role, status, joined_at, profile:profiles!ecosystem_members_user_id_fkey(username,display_name,avatar_url)")
    .eq("ecosystem_id", ecosystemId)
    .order("joined_at", { ascending: true });
  if (error) {
    // fallback if FK alias fails
    const { data: d2, error: e2 } = await sb
      .from("ecosystem_members")
      .select("ecosystem_id, user_id, role, status, joined_at")
      .eq("ecosystem_id", ecosystemId)
      .order("joined_at", { ascending: true });
    if (e2) throw e2;
    return (d2 ?? []) as EcosystemMember[];
  }
  return (data ?? []) as EcosystemMember[];
}

export async function updateMemberRole(ecosystemId: string, userId: string, role: EcosystemRole) {
  const { error } = await sb
    .from("ecosystem_members")
    .update({ role })
    .eq("ecosystem_id", ecosystemId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setMemberStatus(ecosystemId: string, userId: string, status: "active" | "banned") {
  const { error } = await sb
    .from("ecosystem_members")
    .update({ status })
    .eq("ecosystem_id", ecosystemId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(ecosystemId: string, userId: string) {
  const { error } = await sb
    .from("ecosystem_members")
    .delete()
    .eq("ecosystem_id", ecosystemId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateEcosystem(
  ecosystemId: string,
  patch: Partial<Pick<Ecosystem,
    | "name" | "description" | "primary_color" | "website" | "contact_email"
    | "logo_url" | "banner_url" | "join_policy" | "visibility"
    | "allow_public_crosspost" | "public_crosspost_requires_admin"
  >>,
): Promise<Ecosystem> {
  const { data, error } = await sb
    .from("ecosystems")
    .update(patch)
    .eq("id", ecosystemId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Ecosystem;
}

export async function rotateJoinCode(ecosystemId: string): Promise<string> {
  const code = randomCode(8);
  const { error } = await sb.from("ecosystems").update({ join_code: code }).eq("id", ecosystemId);
  if (error) throw error;
  return code;
}

// ============================================================================
// Named invites (ecosystem_invites)
// ============================================================================

export interface EcosystemInvite {
  id: string;
  ecosystem_id: string;
  code: string;
  email: string | null;
  role_on_join: EcosystemRole;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  created_by: string;
  created_at: string;
}

export async function listEcosystemInvites(ecosystemId: string): Promise<EcosystemInvite[]> {
  const { data, error } = await sb
    .from("ecosystem_invites")
    .select("*")
    .eq("ecosystem_id", ecosystemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EcosystemInvite[];
}

export async function createEcosystemInvite(input: {
  ecosystem_id: string;
  role_on_join?: EcosystemRole;
  max_uses?: number | null;
  expires_at?: string | null;
  email?: string | null;
}): Promise<EcosystemInvite> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login.");
  const { data, error } = await sb
    .from("ecosystem_invites")
    .insert({
      ecosystem_id: input.ecosystem_id,
      code: randomCode(10),
      role_on_join: input.role_on_join ?? "member",
      max_uses: input.max_uses ?? null,
      expires_at: input.expires_at ?? null,
      email: input.email?.trim() || null,
      uses: 0,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as EcosystemInvite;
}

export async function revokeEcosystemInvite(inviteId: string) {
  const { error } = await sb.from("ecosystem_invites").delete().eq("id", inviteId);
  if (error) throw error;
}

export async function listEcosystemPosts(ecosystemId: string, limit = 30) {
  const { data, error } = await sb
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(username,display_name,avatar_url)")
    .eq("ecosystem_id", ecosystemId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// Fase 5: Planos / Cotas / Faturamento
// ============================================================================

export type EcosystemPlanTier = "free" | "pro" | "business" | "enterprise";
export type EcosystemPlanStatus = "active" | "past_due" | "canceled" | "trialing";

export interface EcosystemBilling {
  tier: EcosystemPlanTier;
  status: EcosystemPlanStatus;
  started_at: string;
  expires_at: string | null;
  custom_subdomain: string | null;
  billing_contact_email: string | null;
  limits: {
    members: number;
    posts_per_month: number;
    videos_per_month: number;
    lives_per_month: number;
    custom_branding: boolean;
    advanced_metrics: boolean;
    custom_subdomain: boolean;
    priority_support: boolean;
    display_name: string;
    price_brl_month: number;
  };
  usage: {
    members: number;
    posts_month: number;
    videos_month: number;
    lives_month: number;
  };
}

export interface PlanLimitRow {
  tier: EcosystemPlanTier;
  display_name: string;
  price_brl_month: number;
  member_limit: number;
  posts_per_month: number;
  videos_per_month: number;
  lives_per_month: number;
  custom_branding: boolean;
  advanced_metrics: boolean;
  custom_subdomain: boolean;
  priority_support: boolean;
}

export async function getEcosystemBilling(ecosystemId: string): Promise<EcosystemBilling | null> {
  const { data, error } = await sb.rpc("get_ecosystem_billing", { _ecosystem_id: ecosystemId });
  if (error) throw error;
  return (data as EcosystemBilling) ?? null;
}

export async function listPlanCatalog(): Promise<PlanLimitRow[]> {
  const { data, error } = await sb
    .from("ecosystem_plan_limits")
    .select("*")
    .order("price_brl_month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanLimitRow[];
}

export async function requestEcosystemUpgrade(
  ecosystemId: string,
  tier: EcosystemPlanTier,
  cycle: "monthly" | "yearly" = "monthly",
  notes?: string,
): Promise<string> {
  const { data, error } = await sb.rpc("request_ecosystem_upgrade", {
    _ecosystem_id: ecosystemId,
    _tier: tier,
    _cycle: cycle,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listBillingRequests(ecosystemId: string) {
  const { data, error } = await sb
    .from("ecosystem_billing_requests")
    .select("*")
    .eq("ecosystem_id", ecosystemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
