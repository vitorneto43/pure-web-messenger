import { useCallback, useEffect, useRef, useState } from "react";

// Fala texto usando a Web Speech API do navegador (grátis, funciona offline).
// Retorna { speak, stop, speaking }.
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, lang?: string) => {
    if (!text) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "pt-BR") || "pt-BR";
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utterRef.current = u;
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const supported = typeof window !== "undefined" && !!window.speechSynthesis;
  return { speak, stop, speaking, supported };
}

// Reconhecimento de voz (browser). Retorna callbacks para start/stop e o último
// comando reconhecido. Usa continuous:false — cada acionamento captura uma frase.
type SR = any;
export function useVoiceCommand(onCommand: (text: string) => void, lang = "pt-BR") {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported) return;
    try {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec: SR = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const text = e?.results?.[0]?.[0]?.transcript ?? "";
        if (text) onCommand(text.trim().toLowerCase());
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }, [lang, onCommand, supported]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, listening, supported };
}
