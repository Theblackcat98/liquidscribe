"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Search, FileText, Star, Clock3, ArrowUpRight, Plus, ShieldCheck, Cpu, Check, LoaderCircle, RefreshCw, Download, HardDrive, Type, SlidersHorizontal, History, RotateCcw, ArrowRight, LockKeyhole, Folder, Info } from "lucide-react";
import { plainText, type Folder as FolderType, type Note, type RuntimeStatus } from "@/lib/workspace";

export type Preferences = { fontSize: number; serif: boolean; wide: boolean; showWordCount: boolean };
export type NoteVersion = { id: string; title: string; content: string; createdAt: string; label: string };

export function Modal({ title, subtitle, children, onClose, className = "" }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const timeout = setTimeout(() => {
      const field = ref.current?.querySelector<HTMLElement>("input:not([readonly]), textarea, select") || ref.current?.querySelector<HTMLElement>("button");
      field?.focus();
    }, 30);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const focusable = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => { clearTimeout(timeout); document.removeEventListener("keydown", handler); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></header>{children}</div></div>;
}

export function SearchDialog({ notes, folders, onNote, onNew, onClose, initialQuery = "" }: { notes: Note[]; folders: FolderType[]; onNote: (id: string) => void; onNew: () => void; onClose: () => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const results = notes.filter((note) => !note.deleted && (filter !== "favorites" || note.favorite) && `${note.title} ${plainText(note.content)} ${folders.find((folder) => folder.id === note.folderId)?.name || ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => filter === "recent" ? b.lastOpenedAt.localeCompare(a.lastOpenedAt) : b.updatedAt.localeCompare(a.updatedAt));
  const choose = (id: string) => { onNote(id); onClose(); };
  return <Modal title="Find your next thought" onClose={onClose} className="search-modal">
    <div className="search-dialog-input"><Search size={20} /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} placeholder="Search notes, ideas, and everything between…" onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelected((index) => Math.min(index + 1, results.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelected((index) => Math.max(0, index - 1)); } if (event.key === "Enter" && results[selected]) choose(results[selected].id); }} /><kbd>esc</kbd></div>
    <div className="dialog-tabs search-filters">{[["all", "All notes", FileText], ["favorites", "Favorites", Star], ["recent", "Recent", Clock3]].map(([id, label, Icon]) => { const FilterIcon = Icon as typeof FileText; return <button key={id as string} className={filter === id ? "active" : ""} onClick={() => { setFilter(id as string); setSelected(0); }}><FilterIcon size={14} />{label as string}</button>; })}</div>
    <div className="search-results">{results.length ? results.map((note, index) => <button key={note.id} className={`search-result ${selected === index ? "selected" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => choose(note.id)}><span className="search-result-icon"><FileText size={19} /></span><span><strong>{note.title || "Untitled note"}{note.favorite && <Star size={11} fill="currentColor" />}</strong><small>{folders.find((folder) => folder.id === note.folderId)?.name || "Unfiled"}<span>·</span>{plainText(note.content).slice(0, 75) || "A fresh page, waiting for you."}</small></span><ArrowUpRight size={16} /></button>) : <div className="dialog-empty"><Search size={28} /><h3>No thoughts found. Yet.</h3><p>Try another word, or give this one a new home.</p><button className="small-primary" onClick={() => { onNew(); onClose(); }}><Plus size={14} />Create a note</button></div>}</div>
    <footer className="search-dialog-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate <kbd>↵</kbd> to open</span><span>{results.length} note{results.length === 1 ? "" : "s"}</span></footer>
  </Modal>;
}

export function PromptDialog({ title, label, initialValue = "", placeholder, onSubmit, onClose, options, validate }: { title: string; label: string; initialValue?: string; placeholder?: string; onSubmit: (value: string) => void; onClose: () => void; options?: { value: string; label: string }[]; validate?: (value: string) => string | null }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  return <Modal title={title} onClose={onClose} className="prompt-modal"><form onSubmit={(event) => { event.preventDefault(); if (!value.trim()) { setError("A name or address is needed to continue."); return; } const validationError = validate?.(value.trim()); if (validationError) { setError(validationError); return; } onSubmit(value.trim()); onClose(); }}><label className="field-label" htmlFor="prompt-value">{label}</label>{options ? <select id="prompt-value" className="text-input" value={value} onChange={(event) => setValue(event.target.value)}><option value="">Unfiled</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id="prompt-value" className="text-input" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} autoFocus />}{error && <p className="field-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Continue<ArrowRight size={14} /></button></div></form></Modal>;
}

export function SettingsDialog({ initialTab, preferences, onPreferences, runtime, onRefresh, model, onModel, onExport, onClose }: { initialTab: string; preferences: Preferences; onPreferences: (preferences: Preferences) => void; runtime: RuntimeStatus; onRefresh: () => Promise<void>; model: string; onModel: (model: string) => void; onExport: () => void; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const refresh = async () => { setChecking(true); await onRefresh(); setChecking(false); setChecked(true); };
  return <Modal title="Make yourself at home" subtitle="A few preferences for a space that feels like yours." onClose={onClose} className="settings-modal">
    <div className="dialog-tabs settings-tabs">{[["writing", "Writing", Type], ["assistant", "Local assistant", Cpu], ["privacy", "Data & privacy", ShieldCheck]].map(([id, label, Icon]) => { const TabIcon = Icon as typeof Type; return <button key={id as string} className={tab === id ? "active" : ""} onClick={() => setTab(id as string)}><TabIcon size={15} />{label as string}</button>; })}</div>
    <div className="settings-content">{tab === "writing" ? <>
      <div className="setting-row"><div><strong>Editor typeface</strong><p>A familiar rhythm for your words.</p></div><div className="segmented-control"><button className={preferences.serif ? "active" : ""} onClick={() => onPreferences({ ...preferences, serif: true })}>Serif</button><button className={!preferences.serif ? "active" : ""} onClick={() => onPreferences({ ...preferences, serif: false })}>Sans serif</button></div></div>
      <div className="setting-row"><div><strong>Text size</strong><p>Find your comfortable reading size.</p></div><div className="range-control"><input aria-label="Editor text size" type="range" min="15" max="22" value={preferences.fontSize} onChange={(event) => onPreferences({ ...preferences, fontSize: Number(event.target.value) })} /><span>{preferences.fontSize}px</span></div></div>
      <div className="setting-row"><div><strong>Line length</strong><p>A little room, or a little more.</p></div><div className="segmented-control"><button className={!preferences.wide ? "active" : ""} onClick={() => onPreferences({ ...preferences, wide: false })}>Comfortable</button><button className={preferences.wide ? "active" : ""} onClick={() => onPreferences({ ...preferences, wide: true })}>Wide</button></div></div>
      <div className="setting-row"><div><strong>Word count</strong><p>Show a quiet count in the status bar.</p></div><button className={`toggle ${preferences.showWordCount ? "on" : ""}`} role="switch" aria-checked={preferences.showWordCount} aria-label="Show word count" onClick={() => onPreferences({ ...preferences, showWordCount: !preferences.showWordCount })}><span /></button></div>
      <div className="settings-note"><Check size={15} /><span>Preferences are saved automatically on this device.</span></div>
    </> : tab === "assistant" ? <>
      <div className={`runtime-card ${runtime.available ? "connected" : ""}`}><span className="runtime-card-icon"><Cpu size={23} /></span><div><strong>{runtime.available ? "Your local model is ready" : "Built-in writing tools are ready"}</strong><p>{runtime.available ? `${runtime.models.length} installed model${runtime.models.length === 1 ? "" : "s"} · running through Ollama` : "Connect Ollama for conversation and visual understanding."}</p></div><i /></div>
      <label className="field-label" htmlFor="runtime-endpoint">Local runtime endpoint</label><input id="runtime-endpoint" className="text-input mono-input" readOnly value={runtime.endpoint} /><p className="field-help">Set OLLAMA_BASE_URL on your server to use a different local endpoint.</p>
      <label className="field-label" htmlFor="model-choice">Preferred model</label><select id="model-choice" className="text-input" value={model || runtime.model} onChange={(event) => onModel(event.target.value)}>{!runtime.models.length && <option value={runtime.model}>{runtime.model} (not connected)</option>}{runtime.models.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      <div className="runtime-setup"><strong>A private assistant, in three small steps.</strong><ol><li>Install <a href="https://ollama.com/download" target="_blank" rel="noreferrer">Ollama<ArrowUpRight size={11} /></a> on the machine running LiquidScribe.</li><li>Run <code>ollama pull llama3.2</code> in your terminal.</li><li>Refresh the connection below. You’re ready to write.</li></ol><p>For camera and screen understanding, install a vision model such as <code>llava</code> and select it above.</p></div>
      <button className="secondary-button refresh-runtime" onClick={() => void refresh()} disabled={checking}>{checking ? <LoaderCircle size={15} className="spin" /> : checked ? <RefreshCw size={15} /> : <RefreshCw size={15} />}{checking ? "Checking your device…" : checked ? "Check again" : "Check connection"}</button>{checked && <span className="connection-result">{runtime.available ? "Connected locally." : "No model found. Writing tools still work."}</span>}
    </> : <>
      <div className="privacy-detail"><span><HardDrive size={23} /></span><div><h3>Your words have a home. Here.</h3><p>Drafts are saved in this browser and synced to your local LiquidScribe database. Your notes are not sent to a cloud service.</p></div></div>
      <div className="privacy-detail"><span><LockKeyhole size={23} /></span><div><h3>Assistance with your permission.</h3><p>Text and captures are only shared with the assistant when you send a request. Connected Ollama models run on your server.</p></div></div>
      <div className="privacy-notice"><Info size={17} /><p><strong>A note about voice input.</strong> Your browser’s speech recognition may use an online service. Audio is handled by your browser, not stored by LiquidScribe. You can always type instead.</p></div>
      <button className="secondary-button" onClick={onExport}><Download size={15} />Export your workspace</button><p className="field-help">Downloads all notes and folders as a JSON backup.</p>
    </>}</div><footer className="settings-footer"><ShieldCheck size={13} /><span>Local by design. Thoughtful by default.</span><button className="small-primary" onClick={onClose}>Done<Check size={13} /></button></footer>
  </Modal>;
}

export function HistoryDialog({ versions, onRestore, onClose }: { versions: NoteVersion[]; onRestore: (version: NoteVersion) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(versions[0]?.id || null);
  const version = versions.find((item) => item.id === selected);
  return <Modal title="A way back to your words" subtitle="Recent snapshots of this document. Restore any version without losing your current draft." onClose={onClose} className="history-modal"><div className="history-layout"><div className="version-list">{versions.length ? versions.map((item) => <button key={item.id} className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}><History size={15} /><span><strong>{item.label}</strong><small>{new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></span></button>) : <p className="field-help">Your first snapshot will be saved when you start editing.</p>}</div><div className="version-preview">{version ? <><span className="eyebrow">SNAPSHOT PREVIEW</span><h3>{version.title}</h3><p>{plainText(version.content).slice(0, 1800) || "An empty page. A new beginning."}</p><button className="secondary-button" onClick={() => { onRestore(version); onClose(); }}><RotateCcw size={14} />Restore this version</button></> : <div className="dialog-empty"><Folder size={28} /><p>A little history starts with a little writing.</p></div>}</div></div></Modal>;
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="A few ways to stay in flow" subtitle="Small shortcuts. More room for your thoughts." onClose={onClose} className="shortcuts-modal"><div className="shortcut-list">{[["Search your workspace", "⌘ / Ctrl + K"], ["Create a new note", "⌘ / Ctrl + J"], ["Save immediately", "⌘ / Ctrl + S"], ["Toggle the sidebar", "⌘ / Ctrl + \\"], ["Bold or italic", "⌘ / Ctrl + B / I"], ["Undo an edit", "⌘ / Ctrl + Z"], ["Send to the assistant", "Enter"], ["A new line in the assistant", "Shift + Enter"]].map(([label, shortcut]) => <div key={label}><span>{label}</span><kbd>{shortcut}</kbd></div>)}</div><div className="settings-note"><SlidersHorizontal size={15} />Select any text to reveal contextual writing actions.</div></Modal>;
}
