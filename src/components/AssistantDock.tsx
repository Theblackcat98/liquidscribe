"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, ChevronDown, FileText, Minus, Plus, Camera, Monitor, Mic, AudioLines, ArrowUp, Cpu, Check, LockKeyhole, X, LoaderCircle, Square, ArrowDownToLine, CircleAlert, TextCursor, EyeOff } from "lucide-react";
import { useVoice } from "./useVoice";
import type { AIAction, RuntimeStatus } from "@/lib/workspace";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; mode?: "model" | "tools"; error?: boolean; canInsert?: boolean };
type Props = {
  runtime: RuntimeStatus; model: string; onModel: (model: string) => void; busy: boolean; listeningExternal?: boolean;
  messages: ChatMessage[]; onSend: (text: string, image?: string) => void; onCancel: () => void;
  onCapture: (kind: "camera" | "screen") => void; image?: string; onRemoveImage: () => void;
  onSettings: () => void; onNotice: (message: string) => void; onInsert: (text: string) => void;
  contextMode: string; onContext: (mode: string) => void; minimized: boolean; onMinimize: () => void;
};

export function AssistantDock(props: Props) {
  const [input, setInput] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const voiceBase = useRef("");
  const busyRef = useRef(props.busy);
  busyRef.current = props.busy;
  // Mirrors voice.continuous for the recognition callback, which is created
  // before `voice` exists (reading `voice` inside its own initializer is a TDZ trap).
  const continuousRef = useRef(false);
  const sendRef = useRef<(text: string) => void>(() => {});
  const voice = useVoice((text, final) => {
    setInput(`${voiceBase.current}${voiceBase.current ? " " : ""}${text}`);
    if (final) {
      voiceBase.current = `${voiceBase.current}${voiceBase.current ? " " : ""}${text}`;
      if (continuousRef.current && !busyRef.current) sendRef.current(voiceBase.current);
    }
  }, props.onNotice);
  const submit = (text = input) => {
    if ((!text.trim() && !props.image) || props.busy) return;
    props.onSend(text.trim(), props.image);
    setInput("");
    voiceBase.current = "";
    if (voice.listening && !voice.continuous) voice.stop();
  };
  sendRef.current = submit;
  useEffect(() => { continuousRef.current = voice.continuous; }, [voice.continuous]);
  const startVoice = (continuous: boolean) => {
    if (voice.listening) { voice.stop(); return; }
    voiceBase.current = input;
    if (props.minimized) props.onMinimize();
    voice.start(continuous);
  };
  const modelName = props.runtime.available ? props.model || props.runtime.model : "Writing tools";
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [props.messages.length, props.busy]);

  return <section className={`assistant-dock ${props.busy ? "is-processing" : ""} ${voice.listening ? "is-listening" : ""} ${props.minimized ? "is-minimized" : ""}`} aria-label="LiquidScribe assistant">
    <header className="assistant-header"><span className="assistant-symbol"><Sparkles size={17} strokeWidth={1.6} /></span><h2>LiquidScribe assistant</h2><span className="assistant-header-divider" /><span className="assistant-tagline">{props.busy ? "Thinking alongside you…" : voice.listening ? "Listening. Take your time." : "A little help. Stay in your flow."}</span>
      {voice.listening && <span className="voice-wave" aria-label="Listening"><i /><i /><i /><i /><i /></span>}
      {props.busy && <LoaderCircle size={13} className="spin assistant-spinner" />}
      <div className="assistant-header-actions"><button className="local-mode-badge" onClick={props.onSettings} title="Local processing and model settings"><i />Local mode</button><div className="context-menu-wrap"><button className="context-button" onClick={() => setContextOpen(!contextOpen)} aria-expanded={contextOpen}>{props.contextMode === "selection" ? <TextCursor size={12} /> : props.contextMode === "none" ? <EyeOff size={12} /> : <FileText size={12} />}<span>{props.contextMode === "selection" ? "Selected text" : props.contextMode === "none" ? "No context" : "Current document"}</span><ChevronDown size={11} /></button>{contextOpen && <><button className="popover-dismiss" onClick={() => setContextOpen(false)} aria-label="Close context menu" /><div className="popover context-popover"><span className="menu-eyebrow">ASSISTANT CONTEXT</span>{[["document", "Current document", FileText], ["selection", "Selected text only", TextCursor], ["none", "No document context", EyeOff]].map(([id, label, Icon]) => { const ContextIcon = Icon as typeof FileText; return <button key={id as string} onClick={() => { props.onContext(id as string); setContextOpen(false); }}><ContextIcon size={14} /><span>{label as string}</span>{props.contextMode === id && <Check size={13} />}</button>; })}</div></>}</div><button className="icon-button minimize-assistant" onClick={props.onMinimize} aria-label={props.minimized ? "Expand assistant" : "Minimize assistant"} title={props.minimized ? "Expand assistant" : "Minimize assistant"}>{props.minimized ? <Plus size={15} /> : <Minus size={15} />}</button></div>
    </header>
    {!props.minimized && <>
      {props.messages.length > 0 && <div className="assistant-conversation" ref={conversationRef} aria-live="polite">{props.messages.map((message) => <div key={message.id} className={`chat-message ${message.role} ${message.error ? "error" : ""}`}><span className="chat-message-icon">{message.role === "assistant" ? message.error ? <CircleAlert size={13} /> : <Sparkles size={13} /> : <span>J</span>}</span><div><p>{message.content}</p>{message.canInsert && <button className="insert-response" onClick={() => props.onInsert(message.content)}><ArrowDownToLine size={12} />Insert into note</button>}{message.mode === "tools" && <small>Built-in writing tools · on your device</small>}</div></div>)}</div>}
      {props.image && <div className="attachment-row"><span className="attachment-chip"><img src={props.image} alt="Attached capture" /><span>Visual context attached</span><button onClick={props.onRemoveImage} aria-label="Remove attached capture"><X size={12} /></button></span></div>}
      <div className="assistant-input-row"><textarea ref={inputRef} value={input} rows={1} placeholder={voice.listening ? "Listening — your words will appear here…" : "Ask anything, or tell me what you’re thinking…"} aria-label="Message the assistant" onChange={(event) => { setInput(event.target.value); voiceBase.current = event.target.value; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} /></div>
      <footer className="assistant-controls"><div className="capture-controls"><button className="icon-button" onClick={() => props.onCapture("camera")} title="Open camera preview" aria-label="Open camera"><Camera size={17} strokeWidth={1.6} /></button><button className="icon-button" onClick={() => props.onCapture("screen")} title="Share a screen preview" aria-label="Share screen"><Monitor size={17} strokeWidth={1.6} /></button><span className="control-divider" /><button className={`voice-button ${voice.listening ? "active" : ""}`} onClick={() => startVoice(false)} title="Push to talk · uses your browser’s speech service" aria-pressed={voice.listening}><Mic size={15} strokeWidth={1.7} /><span>{voice.listening && !voice.continuous ? "Listening…" : "Push to talk"}</span></button><button className={`conversation-button ${voice.continuous ? "active" : ""}`} onClick={() => startVoice(true)} title="Continuous voice conversation · browser speech service" aria-pressed={voice.continuous}><AudioLines size={16} strokeWidth={1.6} /><span>Voice conversation</span><span className={`mini-toggle ${voice.continuous ? "on" : ""}`}><i /></span></button></div>
        <div className="assistant-send-controls"><div className="model-menu-wrap"><button className="model-button" onClick={() => setModelOpen(!modelOpen)} aria-expanded={modelOpen}><Cpu size={12} /><span>{modelName}</span><ChevronDown size={11} /></button>{modelOpen && <><button className="popover-dismiss" onClick={() => setModelOpen(false)} aria-label="Close model menu" /><div className="popover model-popover"><span className="menu-eyebrow">YOUR ASSISTANT</span><button onClick={() => { props.onModel(""); setModelOpen(false); }}><Sparkles size={14} /><span>Built-in writing tools</span>{!props.runtime.available && <Check size={13} />}</button>{props.runtime.models.map((model) => <button key={model} onClick={() => { props.onModel(model); setModelOpen(false); }}><Cpu size={14} /><span>{model}</span>{props.model === model && <Check size={13} />}</button>)}<div className="menu-separator" /><button onClick={() => { props.onSettings(); setModelOpen(false); }}>Configure local model<ArrowUp size={13} className="diagonal-arrow" /></button></div></>}</div><button className={`send-button ${props.busy ? "cancel" : ""}`} onClick={() => props.busy ? props.onCancel() : submit()} disabled={!props.busy && !input.trim() && !props.image} title={props.busy ? "Cancel processing" : "Send to assistant"} aria-label={props.busy ? "Cancel processing" : "Send to assistant"}>{props.busy ? <Square size={12} fill="currentColor" /> : <ArrowUp size={17} />}</button></div>
      </footer>
      <div className="dock-chips" aria-label="Quick actions">
        <button type="button" disabled={props.busy} onClick={() => props.onSend("Tighten this passage, keep the meaning.", props.image)}>Tighten</button>
        <button type="button" disabled={props.busy} onClick={() => props.onSend("Summarise this note.", props.image)}>Summarise</button>
        <button type="button" disabled={props.busy} onClick={() => props.onSend("Review this note for gaps and unclear claims.", props.image)}>Review</button>
        <button type="button" disabled={props.busy} onClick={() => props.onSend("Extract the action items from this note.", props.image)}>Action items</button>
        <span className="dock-hint">grounded in this note</span>
      </div>
      <div className="assistant-footnote"><span><LockKeyhole size={10} />Your notes stay local. You’re always in control.</span><span><kbd>↵</kbd> to send<span className="footnote-dot">·</span><kbd>⇧ ↵</kbd> for a new line</span></div>
    </>}
  </section>;
}
