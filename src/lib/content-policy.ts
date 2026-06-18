// Camada 1 da moderação — regras locais (gratuita, roda no client e no server).
// Estilo: regex/keywords. Não bloqueia palavras isoladas comuns; foca em padrões
// problemáticos que o Google Ads marcaria como "Site comprometido" ou que
// quebram nossas Diretrizes da Comunidade.
//
// Veredito:
//   - "ok"    → segue normal
//   - "warn"  → mostra alerta amarelo, mas deixa publicar
//   - "block" → bloqueia o submit; mostra motivo + link p/ Diretrizes

export type PolicyKind = "post" | "status" | "live" | "boost";
export type PolicyVerdict = "ok" | "warn" | "block";

export interface PolicyReport {
  verdict: PolicyVerdict;
  category: string | null;
  reasons: string[];
  matched: string[];
}

interface Rule {
  re: RegExp;
  category: string;
  reason: string;
  severity: "warn" | "block";
  kinds?: PolicyKind[]; // se omitido, aplica a todos
}

const RULES: Rule[] = [
  // Pirataria / IPTV — principal causa do flag do Google Ads
  {
    re: /\b(iptv|lista\s*iptv|m3u8?\s*atualizad[oa]|tv\s*box|stalker\s*portal|sky\s*gr[áa]tis|claro\s*gr[áa]tis|netflix\s*gr[áa]tis|prime\s*gr[áa]tis|disney\s*plus\s*gr[áa]tis|hbo\s*max\s*gr[áa]tis|paramount\s*gr[áa]tis)\b/i,
    category: "piracy",
    reason: "Pirataria de TV/streaming (IPTV, listas, contas gratuitas)",
    severity: "block",
  },
  {
    re: /\b(futebol\s*ao\s*vivo\s*gr[áa]tis|jogo\s*do\s*[a-z]+\s*ao\s*vivo\s*gr[áa]tis|champions\s*ao\s*vivo\s*gr[áa]tis|brasileir[ãa]o\s*ao\s*vivo\s*gr[áa]tis|libertadores\s*ao\s*vivo\s*gr[áa]tis)\b/i,
    category: "piracy_sports",
    reason: "Transmissão pirata de esportes/futebol",
    severity: "block",
  },
  {
    re: /\b(filme\s*completo\s*dublado|filmes?\s*online\s*gr[áa]tis|baixar\s*filmes?\s*torrent|torrent\s*\d{3,4}p|x265\s*completo)\b/i,
    category: "piracy_movies",
    reason: "Distribuição não autorizada de filmes",
    severity: "block",
  },

  // Phishing / golpes financeiros
  {
    re: /\b(senha\s*do\s*banco|cvv\s*completo|c[óo]digo\s*de\s*verifica[çc][ãa]o\s*sms|seu\s*pix\s*foi\s*bloqueado|atualiza[çc][ãa]o\s*do\s*cart[ãa]o)\b/i,
    category: "phishing",
    reason: "Phishing / coleta de credenciais",
    severity: "block",
  },
  {
    re: /\b(lucro\s*garantid[oa]|dobr[oe]\s*seu\s*dinheiro|investimento\s*sem\s*risco|robô\s*do\s*aviator|robô\s*da\s*blaze|hack\s*do\s*tigrinho|m[ée]todo\s*infal[íi]vel\s*cassino)\b/i,
    category: "financial_scam",
    reason: "Golpe financeiro / promessa de lucro irreal",
    severity: "block",
  },

  // Conteúdo infantil — bloqueio absoluto
  {
    re: /\b(cp\s*v[íi]deo|lolicon|shotacon|nudes?\s*de\s*menor(es)?|menor\s*de\s*idade\s*nua?o?)\b/i,
    category: "child_safety",
    reason: "Conteúdo envolvendo menores",
    severity: "block",
  },

  // Drogas / armas
  {
    re: /\b(vendo\s*coca[íi]na|vendo\s*maconha|kit\s*para\s*plantio\s*indoor|vendo\s*arma\s*sem\s*registro|vendo\s*pistola|3d\s*printed\s*glock)\b/i,
    category: "weapons_drugs",
    reason: "Venda de drogas ou armas ilegais",
    severity: "block",
  },

  // Conteúdo adulto — block em Lives (sem suporte adulto), warn em Stories
  {
    re: /\b(nudes?\s*pack|onlyfans\s*gr[áa]tis|conte[úu]do\s*\+18|pack\s*sexo|garotas?\s*de\s*programa|acompanhante\s*sexual)\b/i,
    category: "adult",
    reason: "Conteúdo adulto/+18",
    severity: "block",
    kinds: ["live", "boost"],
  },
  {
    re: /\b(nudes?\s*pack|onlyfans|pack\s*sexo)\b/i,
    category: "adult_soft",
    reason: "Conteúdo possivelmente adulto — pode ser removido",
    severity: "warn",
    kinds: ["post", "status"],
  },

  // Encurtadores suspeitos (genéricos demais p/ block, vão como warn)
  {
    re: /\b(bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|ow\.ly|rebrand\.ly)\b/i,
    category: "suspicious_link",
    reason: "Link encurtado pode confundir moderação automática",
    severity: "warn",
  },

  // Spam óbvio
  {
    re: /(https?:\/\/\S+){4,}/i,
    category: "spam_links",
    reason: "Muitos links na mesma publicação",
    severity: "warn",
  },

  // Apologia a violência
  {
    re: /\b(como\s*fabricar\s*bomba|tutorial\s*matar|incentivo\s*ao\s*suic[íi]dio|autoles[ãa]o\s*passo\s*a\s*passo)\b/i,
    category: "violence",
    reason: "Apologia a violência ou automutilação",
    severity: "block",
  },

  // Jogos de azar — block em boosts, warn em posts/stories
  {
    re: /\b(blaze\s*tigrinho|fortune\s*tiger\s*m[ée]todo|aposta\s*esportiva\s*garantida|cassino\s*online\s*gr[áa]tis)\b/i,
    category: "gambling_promo",
    reason: "Promoção de jogos de azar",
    severity: "block",
    kinds: ["boost"],
  },
];

export function scanLocally(text: string, kind: PolicyKind): PolicyReport {
  const content = (text ?? "").toString();
  if (!content.trim()) {
    return { verdict: "ok", category: null, reasons: [], matched: [] };
  }

  const matched: string[] = [];
  const reasons: string[] = [];
  let worst: PolicyVerdict = "ok";
  let category: string | null = null;

  for (const rule of RULES) {
    if (rule.kinds && !rule.kinds.includes(kind)) continue;
    const m = content.match(rule.re);
    if (!m) continue;
    matched.push(m[0]);
    reasons.push(rule.reason);
    if (rule.severity === "block") {
      worst = "block";
      category = category ?? rule.category;
    } else if (worst !== "block") {
      worst = "warn";
      category = category ?? rule.category;
    }
  }

  return { verdict: worst, category, reasons, matched };
}

// Util para a UI: monta uma mensagem curta a partir do report.
export function describePolicyReport(report: PolicyReport): string {
  if (report.verdict === "ok") return "";
  const unique = Array.from(new Set(report.reasons));
  return unique.slice(0, 2).join(" · ");
}
