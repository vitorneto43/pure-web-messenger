import { useCallback, useEffect, useRef } from "react";
import { useSpeech, useVoiceCommand } from "./use-accessibility";

interface Options {
  onOpen: () => void;
  /** fala uma mensagem de boas-vindas quando abre? */
  speakOnOpen?: boolean;
}

/**
 * Atalhos de acessibilidade para abrir o postador por voz.
 *
 * 1. Teclado: Ctrl+Shift+V (ou Cmd+Shift+V) abre o compositor de voz de qualquer lugar.
 * 2. Comando de voz: pressionar e segurar a BARRA DE ESPAÇO por ~1s ativa o microfone
 *    por 3s; falar "postar por voz" ou "novo post" abre o compositor.
 * 3. TTS de boas-vindas quando abre.
 *
 * Tudo é opcional: se o navegador não suportar voz/teclado, o botão visual continua
 * acessível via leitor de tela (aria-label do botão "Voz").
 */
export function useVoicePostShortcut({ onOpen, speakOnOpen = true }: Options) {
  const { speak, stop } = useSpeech();
  const spaceTimer = useRef<number | null>(null);
  const spaceStart = useRef<number | null>(null);
  const heldRef = useRef(false);
  const speakingWelcome = useRef(false);

  const openVoice = useCallback(() => {
    stop();
    onOpen();
    if (speakOnOpen && !speakingWelcome.current) {
      speakingWelcome.current = true;
      speak("Postar por voz aberto. Toque em gravar, ou pressione G, para começar a falar seu post.", "pt-BR");
      setTimeout(() => (speakingWelcome.current = false), 5000);
    }
  }, [onOpen, speak, stop, speakOnOpen]);

  const { start: startVoiceCommand, stop: stopVoiceCommand, listening } = useVoiceCommand(
    useCallback(
      (text: string) => {
        if (/postar por voz|novo post|criar post|publicar por voz/.test(text)) {
          openVoice();
        }
      },
      [openVoice],
    ),
    "pt-BR",
  );

  // 1) Atalho de teclado: Ctrl+Shift+V / Cmd+Shift+V
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v";
      if (shortcut) {
        e.preventDefault();
        openVoice();
        return;
      }
      // Tecla "G" dentro do compositor de voz (não gerenciado aqui, mas documentado)
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openVoice]);

  // 2) Atalho de voz: segurar espaço por 1s ativa microfone
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && spaceStart.current === null) {
        spaceStart.current = Date.now();
        spaceTimer.current = window.setTimeout(() => {
          heldRef.current = true;
          if (!listening) startVoiceCommand();
        }, 800);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (spaceTimer.current) {
          clearTimeout(spaceTimer.current);
          spaceTimer.current = null;
        }
        spaceStart.current = null;
        if (heldRef.current) {
          heldRef.current = false;
          setTimeout(() => stopVoiceCommand(), 3000);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spaceTimer.current) clearTimeout(spaceTimer.current);
    };
  }, [listening, startVoiceCommand, stopVoiceCommand]);

  return { openVoice };
}
