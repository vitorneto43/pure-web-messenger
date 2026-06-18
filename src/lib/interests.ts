// Lista fixa de interesses usada para segmentação de impulsionamento e
// recomendação de conteúdo. Mantemos curta (24 categorias) para o usuário
// não se perder; cada chave é estável e gravada no banco em profiles.interests
// (text[]) e em status_boosts.target_interests / post_boosts.target_interests.

export type InterestKey =
  | "music"
  | "sports"
  | "soccer"
  | "tech"
  | "gaming"
  | "fashion"
  | "beauty"
  | "fitness"
  | "food"
  | "travel"
  | "movies_tv"
  | "books"
  | "art"
  | "photography"
  | "cars"
  | "business"
  | "education"
  | "pets"
  | "family"
  | "spirituality"
  | "news"
  | "health"
  | "humor"
  | "diy";

export interface Interest {
  key: InterestKey;
  label: string; // PT padrão; UI pode traduzir via i18n se quiser
  emoji: string;
}

export const INTERESTS: Interest[] = [
  { key: "music", label: "Música", emoji: "🎵" },
  { key: "sports", label: "Esportes", emoji: "🏆" },
  { key: "soccer", label: "Futebol", emoji: "⚽" },
  { key: "tech", label: "Tecnologia", emoji: "💻" },
  { key: "gaming", label: "Games", emoji: "🎮" },
  { key: "fashion", label: "Moda", emoji: "👗" },
  { key: "beauty", label: "Beleza", emoji: "💄" },
  { key: "fitness", label: "Fitness", emoji: "💪" },
  { key: "food", label: "Comida", emoji: "🍔" },
  { key: "travel", label: "Viagem", emoji: "✈️" },
  { key: "movies_tv", label: "Cinema & TV", emoji: "🎬" },
  { key: "books", label: "Livros", emoji: "📚" },
  { key: "art", label: "Arte", emoji: "🎨" },
  { key: "photography", label: "Fotografia", emoji: "📷" },
  { key: "cars", label: "Carros", emoji: "🚗" },
  { key: "business", label: "Negócios", emoji: "💼" },
  { key: "education", label: "Educação", emoji: "🎓" },
  { key: "pets", label: "Pets", emoji: "🐶" },
  { key: "family", label: "Família", emoji: "👨‍👩‍👧" },
  { key: "spirituality", label: "Espiritualidade", emoji: "🕊️" },
  { key: "news", label: "Notícias", emoji: "📰" },
  { key: "health", label: "Saúde", emoji: "🏥" },
  { key: "humor", label: "Humor", emoji: "😂" },
  { key: "diy", label: "DIY & Decoração", emoji: "🛠️" },
];

export const INTEREST_KEYS = INTERESTS.map((i) => i.key);

// Mapa hashtag → interesse, usado para derivar interesses implícitos quando
// o usuário não preencheu manualmente. Adicione novas chaves conforme a base
// de hashtags da rede crescer.
export const HASHTAG_TO_INTEREST: Record<string, InterestKey> = {
  // music
  musica: "music", music: "music", show: "music", rock: "music", funk: "music",
  sertanejo: "music", pagode: "music", rap: "music", trap: "music",
  // sports / soccer
  futebol: "soccer", soccer: "soccer", brasileirao: "soccer", libertadores: "soccer",
  champions: "soccer", esporte: "sports", esportes: "sports", crossfit: "fitness",
  // tech / games
  tech: "tech", tecnologia: "tech", programador: "tech", dev: "tech", ia: "tech",
  games: "gaming", gamer: "gaming", lol: "gaming", freefire: "gaming", fortnite: "gaming",
  // fashion / beauty / fitness
  moda: "fashion", style: "fashion", outfit: "fashion", look: "fashion",
  beleza: "beauty", makeup: "beauty", maquiagem: "beauty",
  fitness: "fitness", treino: "fitness", gym: "fitness", academia: "fitness",
  // food / travel
  comida: "food", food: "food", receita: "food", churrasco: "food",
  viagem: "travel", travel: "travel", praia: "travel",
  // movies / books / art
  filme: "movies_tv", filmes: "movies_tv", serie: "movies_tv", netflix: "movies_tv",
  livro: "books", livros: "books", leitura: "books",
  arte: "art", desenho: "art", pintura: "art",
  foto: "photography", fotografia: "photography",
  // cars / business / edu
  carro: "cars", carros: "cars", motos: "cars",
  empreendedor: "business", negocios: "business", marketing: "business",
  estudos: "education", vestibular: "education", concurso: "education",
  // pets / family / spirit / news / health
  pets: "pets", cachorro: "pets", gato: "pets",
  familia: "family", maternidade: "family",
  deus: "spirituality", fe: "spirituality", oracao: "spirituality",
  noticias: "news", politica: "news",
  saude: "health",
  // humor / diy
  humor: "humor", memes: "humor",
  diy: "diy", decoracao: "diy",
};

export function deriveInterestsFromHashtags(tags: readonly string[]): InterestKey[] {
  const set = new Set<InterestKey>();
  for (const raw of tags ?? []) {
    const key = raw.toString().toLowerCase().replace(/^#/, "").trim();
    const hit = HASHTAG_TO_INTEREST[key];
    if (hit) set.add(hit);
  }
  return Array.from(set);
}

export function labelOfInterest(key: string): string {
  return INTERESTS.find((i) => i.key === key)?.label ?? key;
}

export function emojiOfInterest(key: string): string {
  return INTERESTS.find((i) => i.key === key)?.emoji ?? "•";
}
