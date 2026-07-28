/**
 * Comandos por gestos da WaveChat.
 *
 * O reconhecedor de sinais (`recognizeSign`) devolve rótulos — letras da
 * dactilologia, palavras treinadas no app ou classes do Teachable Machine.
 * Este módulo transforma o texto montado a partir desses rótulos em AÇÕES
 * do produto: abrir live, criar story, postar, ir para o WaveTube etc.
 */

export type SignCommandId =
  | "live"
  | "end-live"
  | "story"
  | "post"
  | "wavetube"
  | "waveshorts"
  | "chat"
  | "home"
  | "descobrir"
  | "movimento"
  | "ecosystems"
  | "perfil"
  | "ajuda"
  | "limpar";

export type SignCommand = {
  id: SignCommandId;
  label: string;
  /** Frase-gesto sugerida (o que o usuário deve sinalizar/soletrar). */
  hint: string;
  /** Palavras-chave aceitas (sem acento, maiúsculas). */
  keywords: string[];
};

export const SIGN_COMMANDS: SignCommand[] = [
  { id: "live", label: "Abrir/iniciar live", hint: "LIVE", keywords: ["LIVE", "AOVIVO", "AO VIVO", "TRANSMITIR", "TRANSMISSAO"] },
  { id: "end-live", label: "Encerrar transmissão", hint: "ENCERRAR", keywords: ["ENCERRAR", "ENCERRAR LIVE", "FINALIZAR", "PARAR LIVE"] },
  { id: "story", label: "Criar story", hint: "STORY", keywords: ["STORY", "STORIES", "STATUS"] },
  { id: "post", label: "Criar post em LIBRAS", hint: "POST", keywords: ["POST", "POSTAR", "PUBLICAR", "POSTAGEM"] },
  { id: "wavetube", label: "Abrir WaveTube", hint: "TUBE", keywords: ["WAVETUBE", "TUBE", "VIDEO", "VIDEOS"] },
  { id: "waveshorts", label: "Abrir WaveShorts", hint: "SHORTS", keywords: ["WAVESHORTS", "SHORTS", "CURTOS"] },
  { id: "chat", label: "Abrir conversas", hint: "CHAT", keywords: ["CHAT", "CONVERSA", "CONVERSAS", "MENSAGEM"] },
  { id: "home", label: "Ir para o início", hint: "INICIO", keywords: ["INICIO", "HOME", "FEED", "VOLTAR"] },
  { id: "descobrir", label: "Descobrir pessoas", hint: "DESCOBRIR", keywords: ["DESCOBRIR", "EXPLORAR", "PESSOAS"] },
  { id: "movimento", label: "Comunidades / movimento", hint: "COMUNIDADE", keywords: ["COMUNIDADE", "COMUNIDADES", "MOVIMENTO", "GRUPO", "GRUPOS"] },
  { id: "ecosystems", label: "WaveChat For", hint: "WAVECHAT FOR", keywords: ["WAVECHAT FOR", "WAVECHATFOR", "ECOSSISTEMA", "ECOSSISTEMAS", "FOR"] },
  { id: "perfil", label: "Meu perfil", hint: "PERFIL", keywords: ["PERFIL", "MEUPERFIL", "MEU PERFIL"] },
  { id: "ajuda", label: "Ajuda dos gestos", hint: "AJUDA", keywords: ["AJUDA", "COMANDOS", "SOCORRO"] },
  { id: "limpar", label: "Limpar legenda", hint: "LIMPAR", keywords: ["LIMPAR", "APAGARTUDO", "LIMPA"] },
];

export function normalizeSignText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casa o texto montado pelos gestos com um comando. Aceita a palavra em
 * qualquer posição da frase (o usuário pode soletrar antes de acertar).
 */
export function matchSignCommand(text: string): SignCommand | null {
  const t = normalizeSignText(text);
  if (!t) return null;
  const words = t.split(" ");
  const tail = words.slice(-3).join(" ");
  for (const cmd of SIGN_COMMANDS) {
    for (const kw of cmd.keywords) {
      const k = normalizeSignText(kw);
      if (!k) continue;
      if (t === k || tail === k || tail.endsWith(` ${k}`) || words[words.length - 1] === k) {
        return cmd;
      }
    }
  }
  return null;
}
