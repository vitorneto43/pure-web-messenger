// Shared CPM calculation for custom boosts. Used both client (estimate) and server.
// Base: R$ 50 per 1000 impressions (5000 cents).

export type BoostObjective =
  | "views"
  | "comments"
  | "profile_visits"
  | "chat"
  | "network"
  | "website"
  | "cross_platform";

export type BoostGender = "male" | "female" | "all";

export interface CustomBoostInput {
  budgetCents: number;
  durationDays: number;
  countries: string[]; // ISO 3166-1 alpha-2 codes; [] = worldwide
  states: string[]; // ISO 3166-2 subdivision codes (without country prefix); [] = whole country
  ageMin: number;
  ageMax: number;
  gender: BoostGender;
  objective: BoostObjective;
}

const BASE_CPM_CENTS = 5000;
const PREMIUM_OBJECTIVES: BoostObjective[] = ["chat", "network", "cross_platform"];

export function calculateCpm(
  input: Omit<CustomBoostInput, "budgetCents" | "durationDays">,
): number {
  let cpm = BASE_CPM_CENTS;
  // Country targeting: <=5 narrow countries = +25%, otherwise +10%; worldwide = base.
  if (input.countries.length > 0) {
    cpm = Math.round(cpm * (input.countries.length <= 5 ? 1.25 : 1.1));
  }
  if (input.states.length > 0) cpm = Math.round(cpm * 1.2);
  if (input.gender !== "all") cpm = Math.round(cpm * 1.1);
  const ageRestricted = input.ageMin > 13 || input.ageMax < 80;
  if (ageRestricted) cpm = Math.round(cpm * 1.15);
  if (PREMIUM_OBJECTIVES.includes(input.objective)) cpm = Math.round(cpm * 1.3);
  return cpm;
}

// budgetCents is the DAILY budget. Total spend = budgetCents * durationDays,
// and estimated views scale with the full campaign spend.
export function estimateViews(input: CustomBoostInput): number {
  const cpm = calculateCpm(input);
  if (cpm <= 0) return 0;
  const totalCents = input.budgetCents * input.durationDays;
  return Math.floor((totalCents / cpm) * 1000);
}


// Legacy export kept for any callers still importing BR_STATES from this module.
// Prefer `SUBDIVISIONS.BR` from `@/lib/world-regions`.
export { SUBDIVISIONS as REGION_SUBDIVISIONS } from "@/lib/world-regions";
export const BR_STATES: { code: string; name: string }[] = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" }, { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" }, { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" }, { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" }, { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" }, { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" }, { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" }, { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
];

export const OBJECTIVES: { key: BoostObjective; emoji: string; premium: boolean; i18nKey: string }[] = [
  { key: "views", emoji: "👀", premium: false, i18nKey: "boost.obj.views" },
  { key: "comments", emoji: "💬", premium: false, i18nKey: "boost.obj.comments" },
  { key: "profile_visits", emoji: "👤", premium: false, i18nKey: "boost.obj.profile_visits" },
  { key: "chat", emoji: "💼", premium: true, i18nKey: "boost.obj.chat" },
  { key: "network", emoji: "🤝", premium: true, i18nKey: "boost.obj.network" },
  { key: "website", emoji: "🌐", premium: false, i18nKey: "boost.obj.website" },
  { key: "cross_platform", emoji: "🔗", premium: true, i18nKey: "boost.obj.cross_platform" },
];
