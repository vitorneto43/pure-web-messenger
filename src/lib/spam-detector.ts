// Detecção de spam executada NO CLIENTE.
// O servidor nunca recebe o texto das mensagens — só recebe a *categoria*
// de risco e a pontuação calculadas aqui. As mensagens permanecem privadas
// e só poderão ser acessadas em caso de exigência de autoridade competente.

const PATTERNS: Array<{ re: RegExp; reason: string; score: number }> = [
  { re: /(https?:\/\/\S+){3,}/i, reason: "many_links", score: 3 },
  { re: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rebrand\.ly|is\.gd|ow\.ly)\b/i, reason: "shortener_link", score: 2 },
  { re: /\b(bitcoin|btc|usdt|cripto|investimento garantido|lucro garantido|double your money|invest now)\b/i, reason: "crypto_scam", score: 3 },
  { re: /\b(cart[aã]o de cr[eé]dito|cvv|senha do banco|pix urgente|c[oó]digo de verifica[cç][aã]o|verification code)\b/i, reason: "credential_phishing", score: 4 },
  { re: /\b(nudes?|pack\s*\$?\d|onlyfans|porn|xxx|hot\s*girls?|garotas?\s*de\s*programa|acompanhante\s*sexual)\b/i, reason: "adult_content", score: 3 },
  { re: /\b(ganhe\s*r\$|pr[eê]mio|sorteio|free money|click here to win|voc[eê] ganhou)\b/i, reason: "fake_prize", score: 2 },
  { re: /\b(aposta(s|r)?|cassino|bet365|blaze|tigrinho|jogo do (bicho|aviator))\b/i, reason: "gambling_promo", score: 2 },
  { re: /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{20,}/, reason: "shouting", score: 1 },
  { re: /\b(wa\.me\/|chat\.whatsapp\.com\/|t\.me\/)\S{6,}/i, reason: "external_chat_invite", score: 2 },
  { re: /\b(menor de idade|child|cp\b|loli|incest)\b/i, reason: "illegal_minor", score: 6 },
];

export interface ClientSpamReport {
  score: number;
  reasons: string[];
}

export function analyzeMessageLocally(content: string): ClientSpamReport {
  const reasons: string[] = [];
  let score = 0;
  for (const p of PATTERNS) {
    if (p.re.test(content)) {
      reasons.push(p.reason);
      score += p.score;
    }
  }
  if (/(.{4,})\1{4,}/i.test(content)) {
    reasons.push("repeated_pattern");
    score += 2;
  }
  return { score, reasons };
}
