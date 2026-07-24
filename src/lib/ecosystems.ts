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
