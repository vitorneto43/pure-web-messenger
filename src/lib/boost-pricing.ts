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
  states: string[]; // BR UF codes; [] = país todo
  ageMin: number;
  ageMax: number;
  gender: BoostGender;
  objective: BoostObjective;
}

const BASE_CPM_CENTS = 5000;
const PREMIUM_OBJECTIVES: BoostObjective[] = ["chat", "network", "cross_platform"];

export function calculateCpm(input: Omit<CustomBoostInput, "budgetCents" | "durationDays">): number {
  let cpm = BASE_CPM_CENTS;
  if (input.states.length > 0) cpm = Math.round(cpm * 1.2);
  if (input.gender !== "all") cpm = Math.round(cpm * 1.1);
  const ageRestricted = input.ageMin > 13 || input.ageMax < 80;
  if (ageRestricted) cpm = Math.round(cpm * 1.15);
  if (PREMIUM_OBJECTIVES.includes(input.objective)) cpm = Math.round(cpm * 1.3);
  return cpm;
}

export function estimateViews(input: CustomBoostInput): number {
  const cpm = calculateCpm(input);
  if (cpm <= 0) return 0;
  return Math.floor((input.budgetCents / cpm) * 1000);
}

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

export const OBJECTIVES: { key: BoostObjective; label: string; emoji: string; premium: boolean }[] = [
  { key: "views", label: "Mais visualizações", emoji: "👀", premium: false },
  { key: "comments", label: "Mais comentários", emoji: "💬", premium: false },
  { key: "profile_visits", label: "Ver perfil", emoji: "👤", premium: false },
  { key: "chat", label: "Iniciar conversa no chat", emoji: "💼", premium: true },
  { key: "network", label: "Networking", emoji: "🤝", premium: true },
  { key: "website", label: "Visitas ao site", emoji: "🌐", premium: false },
  { key: "cross_platform", label: "Perfis em outras plataformas", emoji: "🔗", premium: true },
];
