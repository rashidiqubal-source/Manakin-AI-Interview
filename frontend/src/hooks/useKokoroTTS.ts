"use client";

import { useState, useRef, useCallback } from "react";
import { generateTTSAPI } from "@/services/api";

export interface KokoroTTSState {
  isPlaying: boolean;
  isSynthesizing: boolean;
  lastSpokenText: string | null;
  ttsDurationSec: number;
}

export function useKokoroTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null);
  const [ttsDurationSec, setTtsDurationSec] = useState<number>(0);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedCallbackRef = useRef<(() => void) | null>(null);

  const stopAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsSynthesizing(false);
  }, []);

  const speakQuestion = useCallback(
    async (text: string, onEnded?: () => void) => {
      if (!text || !text.trim()) return;

      stopAudio();
      setLastSpokenText(text);
      setIsSynthesizing(true);
      onEndedCallbackRef.current = onEnded || null;

      try {
        // 1. Fetch Kokoro TTS audio from backend
        const res = await generateTTSAPI(text, "af_heart");

        if (res && res.data && res.data.audioBase64) {
          setIsSynthesizing(false);
          const audio = new Audio(res.data.audioBase64);
          activeAudioRef.current = audio;
          const dur = res.data.durationSec || 4;
          setTtsDurationSec(dur);

          audio.onplay = () => {
            setIsPlaying(true);
          };

          audio.onended = () => {
            setIsPlaying(false);
            activeAudioRef.current = null;
            if (onEndedCallbackRef.current) {
              onEndedCallbackRef.current();
            }
          };

          audio.onerror = () => {
            console.warn("[KokoroTTS] Audio playback failed, falling back to Web Speech API");
            playBrowserSpeech(text, onEnded);
          };

          try {
            await audio.play();
            return;
          } catch (playErr: any) {
            console.warn("[KokoroTTS] audio.play() blocked by browser policy, using speech fallback:", playErr.message);
            playBrowserSpeech(text, onEnded);
            return;
          }
        }
      } catch (err: any) {
        console.warn("[KokoroTTS] Backend synthesis error, falling back to Web Speech API:", err.message);
      }

      // 2. Resilient Browser SpeechSynthesis fallback
      setIsSynthesizing(false);
      playBrowserSpeech(text, onEnded);
    },
    [stopAudio]
  );

  const playBrowserSpeech = (text: string, onEnded?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsPlaying(false);
      if (onEnded) onEnded();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      utterance.onstart = () => {
        setIsPlaying(true);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        if (onEnded) onEnded();
      };

      utterance.onerror = (e) => {
        console.warn("[KokoroTTS] SpeechSynthesis error:", e);
        setIsPlaying(false);
        if (onEnded) onEnded();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlaying(false);
      if (onEnded) onEnded();
    }
  };

  const replayLastQuestion = useCallback(() => {
    if (lastSpokenText) {
      speakQuestion(lastSpokenText, onEndedCallbackRef.current || undefined);
    }
  }, [lastSpokenText, speakQuestion]);

  return {
    isPlaying,
    isSynthesizing,
    lastSpokenText,
    ttsDurationSec,
    speakQuestion,
    stopAudio,
    replayLastQuestion,
  };
}
