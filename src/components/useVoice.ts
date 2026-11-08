"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useVoice(onTranscript: (text: string, final: boolean) => void, onNotice: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const keepListening = useRef(false);
  const callbacks = useRef({ onTranscript, onNotice });
  // Keep the latest callbacks available to the recognition handlers without
  // re-creating them on every render (the handlers outlive a render pass).
  useEffect(() => { callbacks.current = { onTranscript, onNotice }; }, [onTranscript, onNotice]);

  const stop = useCallback(() => {
    keepListening.current = false;
    recognition.current?.stop();
    recognition.current = null;
    setListening(false);
    setContinuous(false);
  }, []);

  const start = useCallback((conversation = false) => {
    const speechWindow = window as SpeechWindow;
    const RecognitionClass = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!RecognitionClass) {
      callbacks.current.onNotice("Voice input isn’t supported in this browser. Try Chrome or Edge, or type your request.");
      return;
    }
    recognition.current?.abort();
    const instance = new RecognitionClass();
    instance.lang = "en-US";
    instance.continuous = conversation;
    instance.interimResults = true;
    keepListening.current = conversation;
    instance.onstart = () => { setListening(true); setContinuous(conversation); };
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        callbacks.current.onTranscript(result[0].transcript, result.isFinal);
      }
    };
    instance.onerror = (event) => {
      keepListening.current = false;
      setListening(false);
      setContinuous(false);
      if (event.error !== "aborted") callbacks.current.onNotice(event.error === "not-allowed" ? "Microphone access was declined. Allow microphone access in your browser to use voice input." : event.error === "no-speech" ? "No speech detected. Tap the microphone to try again." : "Voice recognition is unavailable right now. You can still type your request.");
    };
    instance.onend = () => {
      if (keepListening.current) {
        try { instance.start(); } catch { keepListening.current = false; setListening(false); setContinuous(false); }
      } else { setListening(false); setContinuous(false); }
    };
    recognition.current = instance;
    try { instance.start(); } catch { callbacks.current.onNotice("The microphone could not start. Please try again."); }
  }, []);

  useEffect(() => () => { keepListening.current = false; recognition.current?.abort(); }, []);
  return { listening, continuous, start, stop, toggle: () => listening ? stop() : start(false) };
}
