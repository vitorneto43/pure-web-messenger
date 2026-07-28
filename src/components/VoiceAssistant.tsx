import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";
import { describeImage } from "@/lib/accessibility.functions";
import { VoicePostComposer } from "@/components/posts/VoicePostComposer";
import { useAuth } from "@/hooks/use-auth";
import {
  findProfileByName,
  listVoiceConversations,
  matchConversation,
  readConversationMessages,
  sendVoiceMessage,
  setFollowState,
  type VoiceConversation,
} from "@/lib/voice-chat";

/**
 * Assistente de voz global da WaveChat — acessibilidade total para cegos.
 *
 * Ativação:
 *  - Botão flutuante (canto inferior direito) com aria-label descritivo.
 *  - Atalho global: Alt+A (Windows/Linux) ou Ctrl+Option+A (macOS).
 *
 * Ao ativar, faz um "greeting" e entra em escuta contínua em pt-BR.
 * Comandos suportados (todos em português, sem precisar apertar nada):
 *   "ajuda", "o que posso falar"        → lista comandos
 *   "ir para início" / "home" / "feed"
 *   "abrir chat" / "conversas"
 *   "abrir lives" / "ao vivo"
 *   "fazer live" / "começar transmissão"
 *   "postar por voz" / "novo post"
 *   "abrir perfil"
 *   "abrir descobrir" / "descobrir"
 *   "abrir comunidades" / "ecossistemas"
 *   "abrir configurações"
 *   "ler feed" / "ler posts"            → lê cada post do feed atual
 *   "descrever imagem" / "descrever foto" → descreve imagem do post atual
 *   "próximo" / "próximo post"          → avança na leitura
 *   "anterior"                          → volta um post
 *   "parar" / "cancelar" / "silêncio"   → para tudo
 *   "voltar"                            → history.back
 *   "sair" / "encerrar assistente"
 */
export function VoiceAssistant() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useAuth();
  const describe = useServerFn(describeImage);

  const [active, setActive] = useState(false);
  const [heard, setHeard] = useState("");
  const [voicePostOpen, setVoicePostOpen] = useState(false);
  const [wakeOn, setWakeOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("wavechat.wakeword") !== "off";
  });

  const recRef = useRef<any>(null);
  const wakeRecRef = useRef<any>(null);
  const stoppingRef = useRef(false);
  const wakeStoppingRef = useRef(false);
  const readingRef = useRef(false);
  const readIndexRef = useRef(0);
  const activeRef = useRef(false);
  const wakeOnRef = useRef(wakeOn);
  // Contexto conversacional: quando o assistente faz uma pergunta,
  // a próxima frase é interpretada como resposta a ela.
  const pendingRef = useRef<
    | null
    | "lives"
    | "posts"
    | "wavetube"
    | "waveshorts"
    | "open-conv"
    | "dictate"
    | "confirm-send"
    | "follow"
    | "unfollow"
  >(null);
  // Estado do fluxo de chat por voz
  const draftRef = useRef("");
  const convListRef = useRef<VoiceConversation[]>([]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { wakeOnRef.current = wakeOn; }, [wakeOn]);

  const srSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && !!window.speechSynthesis;

  // ---------- TTS helpers ----------
  const speak = useCallback((text: string, opts?: { onEnd?: () => void }) => {
    if (!ttsSupported || !text) { opts?.onEnd?.(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.02;
      u.onend = () => opts?.onEnd?.();
      u.onerror = () => opts?.onEnd?.();
      window.speechSynthesis.speak(u);
    } catch { opts?.onEnd?.(); }
  }, [ttsSupported]);

  const stopSpeak = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  // ---------- Reconhecimento contínuo ----------
  const startRecognition = useCallback(() => {
    if (!srSupported) return;
    try { recRef.current?.stop?.(); } catch {}
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else setHeard(r[0].transcript);
      }
      finalText = finalText.trim().toLowerCase();
      if (finalText) {
        setHeard(finalText);
        handleCommand(finalText);
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") {
        toast.error("Permita o microfone para usar o assistente por voz.");
        setActive(false);
      }
    };
    rec.onend = () => {
      // Reinicia enquanto o assistente estiver ativo (para ser realmente contínuo)
      if (activeRef.current && !stoppingRef.current) {
        try { rec.start(); } catch {}
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch {}
  }, [srSupported]);

  const stopRecognition = useCallback(() => {
    stoppingRef.current = true;
    try { recRef.current?.stop?.(); } catch {}
    recRef.current = null;
    setTimeout(() => { stoppingRef.current = false; }, 200);
  }, []);

  // ---------- Leitura do feed ----------
  const readFeed = useCallback(async (fromIndex = 0) => {
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>('article[data-voice-post="1"]'),
    );
    if (!articles.length) {
      speak("Não encontrei posts nesta página. Diga: ir para início, para abrir o feed.");
      return;
    }
    readingRef.current = true;
    for (let i = fromIndex; i < articles.length; i++) {
      if (!readingRef.current) return;
      readIndexRef.current = i;
      const el = articles[i];
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const author = el.getAttribute("data-voice-author") ?? "Alguém";
      const kind = el.getAttribute("data-voice-kind") ?? "text";
      const text = (el.getAttribute("data-voice-text") ?? "").trim();
      const image = el.getAttribute("data-voice-image") ?? "";

      let msg = `Post ${i + 1} de ${articles.length}, de ${author}. `;
      if (text) msg += text + ". ";
      else if (kind === "image") msg += "Publicou uma imagem sem legenda. ";
      else if (kind === "video") msg += "Publicou um vídeo. ";

      await new Promise<void>((resolve) => speak(msg, { onEnd: () => resolve() }));
      if (!readingRef.current) return;

      // Descreve imagem se houver
      if (image) {
        try {
          const r = await describe({ data: { imageUrl: image } });
          if (r?.ok && r.content) {
            await new Promise<void>((resolve) =>
              speak("Descrição da foto: " + r.content, { onEnd: () => resolve() }),
            );
          }
        } catch {}
      }
      if (!readingRef.current) return;
    }
    readingRef.current = false;
    speak("Fim do feed. Diga: próximo, para continuar rolando, ou postar por voz, para publicar.");
  }, [describe, speak]);

  const stopReading = useCallback(() => {
    readingRef.current = false;
    stopSpeak();
  }, [stopSpeak]);

  // ---------- Chat por voz ----------
  const currentConversationId = useCallback(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/\/chat\/([^/?#]+)/);
    return m?.[1] ?? null;
  }, []);

  const openConversationByName = useCallback(
    async (name: string) => {
      if (!user) { speak("Você precisa entrar primeiro."); return; }
      speak("Procurando a conversa.");
      try {
        if (!convListRef.current.length) {
          convListRef.current = await listVoiceConversations(user.id);
        }
        const conv = matchConversation(convListRef.current, name);
        if (!conv) {
          speak(`Não encontrei uma conversa com ${name}. Diga: abrir conversa, e o nome novamente.`);
          pendingRef.current = "open-conv";
          return;
        }
        navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id } });
        speak(`Abrindo a conversa com ${conv.title}. Diga: ler conversa, para eu ler as mensagens, ou escrever mensagem, para responder.`);
      } catch {
        speak("Não consegui abrir a conversa agora.");
      }
    },
    [navigate, speak, user],
  );

  const readCurrentConversation = useCallback(async () => {
    const convId = currentConversationId();
    if (!user) { speak("Você precisa entrar primeiro."); return; }
    if (!convId) {
      speak("Você não está em uma conversa. Diga: abrir conversa, e o nome da pessoa.");
      pendingRef.current = "open-conv";
      return;
    }
    try {
      const msgs = await readConversationMessages(convId, user.id, 10);
      if (!msgs.length) { speak("Esta conversa está vazia. Diga: escrever mensagem, para começar."); return; }
      readingRef.current = true;
      for (const m of msgs) {
        if (!readingRef.current) return;
        const line = `${m.author} disse: ${m.text || "mensagem sem texto"}.`;
        await new Promise<void>((resolve) => speak(line, { onEnd: () => resolve() }));
      }
      readingRef.current = false;
      speak("Fim das mensagens. Diga: escrever mensagem, para responder.");
    } catch {
      speak("Não consegui ler a conversa agora.");
    }
  }, [currentConversationId, speak, user]);

  const sendDraft = useCallback(async () => {
    const convId = currentConversationId();
    if (!user || !convId) { speak("Não estou em uma conversa aberta."); return; }
    const r = await sendVoiceMessage(convId, user.id, draftRef.current);
    draftRef.current = "";
    if (r.ok) speak("Mensagem enviada.");
    else speak("Não consegui enviar a mensagem.");
  }, [currentConversationId, speak, user]);

  const doFollow = useCallback(
    async (name: string, follow: boolean) => {
      if (!user) { speak("Você precisa entrar primeiro."); return; }
      try {
        const profile = await findProfileByName(name);
        if (!profile) { speak(`Não encontrei o perfil ${name}.`); return; }
        if (profile.id === user.id) { speak("Esse perfil é o seu."); return; }
        const label = profile.display_name || profile.username;
        const r = await setFollowState(profile.id, user.id, follow);
        if (!r.ok) { speak("Não consegui concluir agora."); return; }
        if (!r.changed) {
          speak(follow ? `Você já está seguindo ${label}.` : `Você já não seguia ${label}.`);
          return;
        }
        speak(r.following ? `Seguindo ${label}.` : `Deixado de seguir ${label}.`);
      } catch {
        speak("Não consegui concluir agora.");
      }
    },
    [speak, user],
  );



  // ---------- Roteador de comandos ----------
  const handleCommand = useCallback(
    (raw: string) => {
      const t = raw.toLowerCase();
      const match = (re: RegExp) => re.test(t);
      const isYes = /\b(sim|quero|claro|vamos|pode ser|com certeza|bora|manda|ok|okay)\b/.test(t);
      const isNo = /\b(não|nao|agora não|depois|negativo)\b/.test(t);

      // Parar / cancelar
      if (match(/\b(parar|pare|silêncio|silencio|cancelar|cala a boca)\b/)) {
        pendingRef.current = null;
        stopReading();
        speak("Ok, parei.");
        return;
      }

      // Respostas a perguntas anteriores
      if (pendingRef.current) {
        const ctx = pendingRef.current;
        pendingRef.current = null;
        if (ctx === "open-conv") {
          void openConversationByName(raw);
          return;
        }
        if (ctx === "follow" || ctx === "unfollow") {
          void doFollow(raw, ctx === "follow");
          return;
        }
        if (ctx === "dictate") {
          draftRef.current = raw.trim();
          pendingRef.current = "confirm-send";
          speak(`Você disse: ${draftRef.current}. Envio agora? Diga sim ou não.`);
          return;
        }
        if (ctx === "confirm-send") {
          if (isYes || /\b(envia|enviar|manda|mandar)\b/.test(t)) { void sendDraft(); return; }
          if (isNo || /\b(regravar|de novo|repetir|corrigir)\b/.test(t)) {
            draftRef.current = "";
            pendingRef.current = "dictate";
            speak("Certo. Fale a mensagem novamente.");
            return;
          }
          draftRef.current = "";
          speak("Mensagem descartada.");
          return;
        }
        if (ctx === "lives") {
          if (isYes || /\b(começar|iniciar|criar|fazer|nova)\b/.test(t)) {
            speak("Ótimo, vamos criar sua live.");
            navigate({ to: "/live/new" });
            return;
          }
          if (isNo) { speak("Sem problema, continue explorando as lives."); return; }
        }
        if (ctx === "posts") {
          if (/\b(imagem|foto|figura|desenho)\b/.test(t)) {
            speak("Abrindo o postador. Descreva sua imagem por voz.");
            setVoicePostOpen(true);
            return;
          }
          if (/\b(escrit|texto|palavra|falar|voz)\b/.test(t) || isYes) {
            speak("Abrindo o postador por voz. Fale sua mensagem.");
            setVoicePostOpen(true);
            return;
          }
          if (isNo) { speak("Sem problema."); return; }
        }
        if (ctx === "wavetube" || ctx === "waveshorts") {
          if (/\b(vídeo|video)\b/.test(t) || isYes) {
            speak("Role o feed e diga: ler feed, para eu narrar. Ou diga um autor.");
            return;
          }
          if (/\b(autor|criador|canal|pessoa|usuário|usuario)\b/.test(t)) {
            speak("Diga: abrir perfil, seguido do arroba, ou navegue por descobrir.");
            navigate({ to: "/descobrir" });
            return;
          }
          if (isNo) { speak("Certo, ficamos por aqui."); return; }
        }
        // Se não bateu com nada, cai para o roteador normal
      }

      // Ajuda
      if (match(/\b(ajuda|comandos|o que posso (falar|dizer)|socorro)\b/)) {
        speak(
          "Comandos disponíveis: ir para início, abrir chat, abrir lives, fazer live, postar por voz, abrir perfil, abrir descobrir, abrir comunidades, ler feed, descrever imagem, próximo, anterior, voltar, parar, ou sair.",
        );
        return;
      }

      // Encerrar assistente
      if (match(/\b(desativar|desativa|desliga(r)?|encerrar|sair|fechar)\s+(o\s+)?assistente\b/) || match(/\b(sair|encerrar|desligar|fechar assistente)\b/)) {
        speak("Assistente encerrado.");
        setTimeout(() => deactivate(), 800);
        return;
      }

      // Voltar
      if (match(/\bvoltar\b/)) {
        speak("Voltando.");
        try { router.history.back(); } catch {}
        return;
      }

      // ----- Chat por voz -----
      {
        const openConv = t.match(
          /\b(?:abrir|abra|abre|iniciar|ir para)\s+(?:a\s+)?(?:conversa|chat)\s+(?:com\s+)?(.+)$/,
        ) || t.match(/\b(?:falar|conversar|escrever)\s+com\s+(.+)$/);
        if (openConv?.[1]) { void openConversationByName(openConv[1]); return; }
      }
      if (match(/\b(abrir|abre|abra)\s+(uma\s+)?(conversa|chat)\b/) && match(/\bconversa\b/)) {
        pendingRef.current = "open-conv";
        speak("Com quem você quer conversar? Diga o nome da pessoa.");
        return;
      }
      if (match(/\b(ler|leia|leiam)\s+(a\s+)?(conversa|mensagens|chat)\b/)) {
        void readCurrentConversation();
        return;
      }
      {
        const dictate = t.match(
          /\b(?:escrever|escreva|responder|responda|enviar|envie|mandar|manda)\s+(?:uma\s+)?(?:mensagem|resposta)\s*(?:dizendo|falando|:)?\s*(.+)$/,
        );
        if (dictate?.[1] && dictate[1].trim().length > 1) {
          draftRef.current = dictate[1].trim();
          pendingRef.current = "confirm-send";
          speak(`Você disse: ${draftRef.current}. Envio agora? Diga sim ou não.`);
          return;
        }
      }
      if (match(/\b(escrever|escreva|responder|responda|enviar|envie|ditar)\s+(uma\s+)?(mensagem|resposta)\b/)) {
        if (!currentConversationId()) {
          pendingRef.current = "open-conv";
          speak("Você não está em uma conversa. Com quem você quer falar?");
          return;
        }
        pendingRef.current = "dictate";
        speak("Fale sua mensagem depois do aviso.");
        return;
      }

      // ----- Seguir / deixar de seguir -----
      {
        const unf = t.match(/\b(?:deixar de seguir|parar de seguir|desseguir|dessegue)\s+(?:o\s+|a\s+|perfil\s+)?(.+)$/);
        if (unf?.[1]) { void doFollow(unf[1], false); return; }
        const fol = t.match(/\b(?:seguir|segue|siga)\s+(?:o\s+|a\s+|perfil\s+)?(.+)$/);
        if (fol?.[1]) { void doFollow(fol[1], true); return; }
      }
      if (match(/\b(deixar de seguir|parar de seguir)\b/)) {
        pendingRef.current = "unfollow";
        speak("Qual perfil você quer deixar de seguir?");
        return;
      }
      if (match(/\bseguir\b/)) {
        pendingRef.current = "follow";
        speak("Qual perfil você quer seguir?");
        return;
      }

      // Navegação

      if (match(/\b(início|inicio|home|feed principal|página inicial)\b/) || match(/^ir para (início|inicio|home)/)) {
        speak("Abrindo o início.");
        navigate({ to: "/" });
        return;
      }
      if (match(/\b(abrir )?(chat|conversas|mensagens)\b/)) {
        speak("Abrindo o chat.");
        navigate({ to: "/chat" });
        return;
      }
      if (match(/\bfazer live\b|\b(começar|iniciar) (transmissão|live)\b/)) {
        speak("Vamos criar sua live.");
        navigate({ to: "/live/new" });
        return;
      }
      if (match(/\b(abrir )?(lives?|ao vivo|transmiss(ão|oes))\b/)) {
        navigate({ to: "/live" });
        pendingRef.current = "lives";
        speak("Estamos nas lives. Quer começar uma?");
        return;
      }
      if (match(/\bwave\s*tube\b|\bwavetube\b/)) {
        navigate({ to: "/wavetube" });
        pendingRef.current = "wavetube";
        speak("Estamos no WaveTube. Você quer ver um vídeo específico ou um autor específico?");
        return;
      }
      if (match(/\bwave\s*shorts?\b|\bwaveshorts?\b|\bshorts?\b/)) {
        navigate({ to: "/waveshorts" });
        pendingRef.current = "waveshorts";
        speak("Estamos no WaveShorts. Você quer ver um vídeo específico ou um autor específico?");
        return;
      }
      if (match(/\bwave\s*chat\s*for\b|\bwavechat\s*for\b|\b(planos?|assinatura|ecossistemas? privad)/)) {
        speak("Abrindo o WaveChat For.");
        navigate({ to: "/ecosystems/pricing" });
        return;
      }
      if (match(/\b(abrir )?(descobrir|explorar)\b/)) {
        speak("Abrindo descobrir.");
        navigate({ to: "/descobrir" });
        return;
      }
      if (match(/\b(comunidades?|ecossistemas?|movimento)\b/)) {
        speak("Abrindo comunidades.");
        navigate({ to: "/movimento" });
        return;
      }
      if (match(/\b(abrir )?perfil\b/)) {
        if (!user) {
          speak("Você precisa entrar primeiro. Abrindo a página de login.");
          navigate({ to: "/auth" });
        } else {
          speak("Abrindo seu perfil.");
          navigate({ to: "/profile" });
        }
        return;
      }
      if (match(/\bpostar por voz\b|\bpublicar por voz\b/)) {
        speak("Abrindo o postador por voz. Toque em gravar, ou pressione a letra G.");
        setVoicePostOpen(true);
        return;
      }
      if (match(/\b(criar|novo|fazer|publicar) (um )?posts?\b|\bcriar posts?\b/)) {
        pendingRef.current = "posts";
        speak("Estamos na criação de posts. Você quer criar um post escrito ou criar uma imagem?");
        return;
      }

      // Leitura
      if (match(/\b(ler|leia|leiam) (o )?(feed|posts|timeline|linha do tempo)\b/) || match(/\bler tudo\b/)) {
        readFeed(0);
        return;
      }
      if (match(/\b(próximo|proximo|avançar|avancar)\b/)) {
        readFeed(readIndexRef.current + 1);
        return;
      }
      if (match(/\banterior\b|\bvoltar (post|um post)\b/)) {
        readFeed(Math.max(0, readIndexRef.current - 1));
        return;
      }
      if (match(/\b(descrever|descreva|descreve) (a )?(imagem|foto|figura)\b/)) {
        const articles = Array.from(
          document.querySelectorAll<HTMLElement>('article[data-voice-post="1"]'),
        );
        const el = articles[readIndexRef.current] || articles[0];
        const image = el?.getAttribute("data-voice-image");
        if (!image) { speak("Este post não tem imagem."); return; }
        speak("Descrevendo a imagem, um momento.");
        describe({ data: { imageUrl: image } })
          .then((r) => {
            if (r?.ok && r.content) speak("Descrição: " + r.content);
            else speak("Não consegui descrever agora.");
          })
          .catch(() => speak("Não consegui descrever agora."));
        return;
      }

      // Silencioso quando não reconhece — evita interromper
    },
    [describe, navigate, readFeed, router, speak, stopReading, user],
  );

  // ---------- Ativação / desativação ----------
  const activate = useCallback(() => {
    if (!srSupported) {
      toast.error("Assistente por voz requer Chrome, Edge ou Android.");
      return;
    }
    // Encerra o listener de palavra-chave para liberar o microfone
    try {
      wakeStoppingRef.current = true;
      wakeRecRef.current?.stop?.();
      wakeRecRef.current = null;
      setTimeout(() => { wakeStoppingRef.current = false; }, 200);
    } catch {}
    setActive(true);
    activeRef.current = true;
    speak(
      "Assistente WaveChat ativo. Diga ajuda para ouvir os comandos, ou fale, por exemplo: ler feed, postar por voz, fazer live, abrir chat. Para me desligar, diga desativar assistente.",
    );
    setTimeout(() => startRecognition(), 300);
  }, [speak, srSupported, startRecognition]);

  const deactivate = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    stopReading();
    stopRecognition();
    // Retoma o listener de palavra-chave, se habilitado
    setTimeout(() => {
      if (wakeOnRef.current) startWakeListener();
    }, 400);
  }, [stopReading, stopRecognition]);

  // ---------- Listener de palavra-chave ("ativar assistente") ----------
  const startWakeListener = useCallback(() => {
    if (!srSupported || activeRef.current || !wakeOnRef.current) return;
    try { wakeRecRef.current?.stop?.(); } catch {}
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      const t = text.toLowerCase();
      // Aceita variações comuns e pequenas confusões do reconhecedor
      if (/\b(ativar|ativa|ligar|liga|acordar|iniciar)\s+(o\s+)?(assistente|wavechat)\b/.test(t)) {
        activate();
      } else if (
        /\b(desativar|desativa|desligar|desliga|encerrar|parar|dormir)\s+(o\s+)?(assistente|wavechat)\b/.test(t)
      ) {
        // Já está inativo — só confirma para o usuário
        speak("Assistente já está em espera. Diga ativar assistente para começar.");
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        // Sem permissão de microfone — não insiste; usuário pode ligar pelo botão
        setWakeOn(false);
        wakeOnRef.current = false;
        localStorage.setItem("wavechat.wakeword", "off");
      }
    };
    rec.onend = () => {
      if (!activeRef.current && wakeOnRef.current && !wakeStoppingRef.current) {
        try { rec.start(); } catch {}
      }
    };
    wakeRecRef.current = rec;
    try { rec.start(); } catch {}
  }, [activate, speak, srSupported]);

  const toggleWake = useCallback(() => {
    const next = !wakeOnRef.current;
    setWakeOn(next);
    wakeOnRef.current = next;
    localStorage.setItem("wavechat.wakeword", next ? "on" : "off");
    if (next) {
      speak("Escuta de ativação ligada. Diga: ativar assistente.");
      startWakeListener();
    } else {
      try {
        wakeStoppingRef.current = true;
        wakeRecRef.current?.stop?.();
        wakeRecRef.current = null;
      } catch {}
      speak("Escuta de ativação desligada.");
    }
  }, [speak, startWakeListener]);

  // Inicia a escuta passiva após o primeiro gesto do usuário (política do navegador)
  useEffect(() => {
    if (!srSupported) return;
    let started = false;
    const boot = () => {
      if (started || activeRef.current || !wakeOnRef.current) return;
      started = true;
      startWakeListener();
    };
    // Tenta iniciar já (funciona em Android/Chrome se o mic estiver permitido)
    const t = setTimeout(boot, 800);
    const onGesture = () => boot();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    window.addEventListener("touchstart", onGesture, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, [srSupported, startWakeListener]);

  // Atalho global: Alt+A
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        if (activeRef.current) deactivate();
        else activate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activate, deactivate]);

  useEffect(() => () => {
    stopReading();
    stopRecognition();
    try {
      wakeStoppingRef.current = true;
      wakeRecRef.current?.stop?.();
      wakeRecRef.current = null;
    } catch {}
  }, [stopReading, stopRecognition]);

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => (active ? deactivate() : activate())}
        aria-label={
          active
            ? "Desligar assistente de voz WaveChat. Ou diga: desativar assistente. Atalho: Alt mais A."
            : (wakeOn
                ? "Ligar assistente de voz WaveChat. Você também pode dizer: ativar assistente. Atalho: Alt mais A."
                : "Ligar assistente de voz WaveChat. Atalho: Alt mais A.")
        }
        aria-pressed={active}
        className={
          "fixed z-[70] bottom-24 right-4 md:bottom-6 md:right-6 size-14 rounded-full grid place-items-center shadow-lg transition-transform focus:outline-none focus:ring-4 focus:ring-pink-500/40 " +
          (active
            ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
            : "bg-gradient-to-br from-pink-500 to-purple-600 text-white hover:scale-105")
        }
      >
        {active ? <MicOff className="size-6" aria-hidden /> : <Mic className="size-6" aria-hidden />}
        {!active && wakeOn && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse"
            title="Escutando palavra de ativação"
          />
        )}
      </button>

      {/* Chip discreto: escuta passiva ligada / desligada */}
      {!active && srSupported && (
        <button
          type="button"
          onClick={toggleWake}
          aria-label={
            wakeOn
              ? 'Escuta de ativação ligada. Diga "ativar assistente". Toque para desligar a escuta passiva.'
              : 'Ativar escuta passiva por palavra-chave "ativar assistente".'
          }
          className={
            "fixed z-[69] bottom-40 right-4 md:bottom-24 md:right-6 max-w-[min(80vw,240px)] text-left rounded-full backdrop-blur shadow px-3 py-1.5 text-[11px] hover:bg-background " +
            (wakeOn
              ? "bg-background/90 border border-emerald-500/40 text-muted-foreground"
              : "bg-background/90 border border-border text-muted-foreground")
          }
        >
          {wakeOn ? (<>🎙️ Diga <b className="text-foreground">"ativar assistente"</b></>) : "Ativar escuta por voz"}
        </button>
      )}

      {/* Painel de status quando ativo (para quem enxerga) */}
      {active && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-[70] bottom-40 right-4 md:bottom-24 md:right-6 max-w-[min(90vw,340px)] rounded-xl bg-background/95 backdrop-blur border border-rose-500/40 shadow-2xl p-3 text-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold">Assistente WaveChat ouvindo…</span>
            <button
              onClick={deactivate}
              aria-label="Fechar assistente"
              className="ml-auto size-6 grid place-items-center rounded hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-muted-foreground text-xs">
            Diga <b>"ajuda"</b>, <b>"ler feed"</b>, <b>"postar por voz"</b>, <b>"fazer live"</b>, <b>"abrir chat"</b>, <b>"parar"</b>.
          </p>
          {heard && (
            <p className="mt-1.5 text-xs">
              <HelpCircle className="inline size-3 mr-1" aria-hidden /> Você disse: <i>{heard}</i>
            </p>
          )}
        </div>
      )}

      <VoicePostComposer open={voicePostOpen} onOpenChange={setVoicePostOpen} />
    </>
  );
}
