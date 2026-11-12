"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Editor } from "@tiptap/react";
import { PanelLeftOpen, ChevronRight, Star, History, Ellipsis, Check, LoaderCircle, ShieldCheck, Sparkles, FileText, FolderInput, Copy, Download, Printer, Trash2, RotateCcw, X, CircleHelp, WifiOff, ArrowRight, Folder, Feather } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { DocumentEditor, getMarkdown, type DocumentEditorHandle } from "./DocumentEditor";
import { EditorToolbar } from "./EditorToolbar";
import { AssistantDock, type ChatMessage } from "./AssistantDock";
import { CapturePreview } from "./CapturePreview";
import { SearchDialog, SettingsDialog, PromptDialog, HistoryDialog, ShortcutsDialog, Modal, type Preferences, type NoteVersion } from "./Dialogs";
import { INITIAL_NOTE_ID, plainText, wordCount, readingTime, type Note, type Folder as FolderType, type AIAction, type AssistantReply, type RuntimeStatus } from "@/lib/workspace";

type Props = { initialNotes: Note[]; initialFolders: FolderType[] };
type DialogState = { type: "search" | "folder" | "history" | "link" | "move" | "shortcuts" } | { type: "settings"; tab: string } | { type: "delete"; id: string } | null;
const CACHE_KEY = "liquidscribe:workspace:v1";
const defaultPreferences: Preferences = { fontSize: 17, serif: true, wide: false, showWordCount: true };
const defaultRuntime: RuntimeStatus = { available: false, models: [], model: "local-model", endpoint: "http://127.0.0.1:8080" };

function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function store(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The editor remains usable when browser storage is unavailable. */ } }
function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportMarkdown(content: string) {
  return content.replace(/<ai-suggestion\b[^>]*data-original="([^"]*)"[^>]*><\/ai-suggestion>/g, (_, text: string) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, "\n").replace(/&amp;/g, "&"));
}

function safeMarkdownFilename(title: string) {
  const stem = title.trim().replace(/[<>:"\/\\|?*\u0000-\u001f\u007f]/g, "-").replace(/[. ]+$/g, "") || "Untitled note";
  const safeStem = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? `_${stem}` : stem;
  return `${safeStem}.md`;
}

export function Workspace({ initialNotes, initialFolders }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [folders, setFolders] = useState(initialFolders);
  const [activeId, setActiveId] = useState(initialNotes.find((note) => note.id === INITIAL_NOTE_ID && !note.deleted)?.id || initialNotes.find((note) => !note.deleted)?.id || initialNotes[0]?.id || "");
  const [view, setView] = useState("writing");
  const [workspace, setWorkspace] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [mode, setMode] = useState("editing");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "device">("saved");
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [documentMenu, setDocumentMenu] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [runtime, setRuntime] = useState(defaultRuntime);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextMode, setContextMode] = useState("document");
  const [dockMinimized, setDockMinimized] = useState(false);
  const [capture, setCapture] = useState<"camera" | "screen" | null>(null);
  const [image, setImage] = useState<string | undefined>();
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const editorRef = useRef<DocumentEditorHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef(notes); notesRef.current = notes;
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const loadedRef = useRef(loaded); loadedRef.current = loaded;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Note>());
  const requestRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const beforeFocus = useRef({ sidebar: false, dock: false });
  const activeNote = notes.find((note) => note.id === activeId) || notes[0];
  const activeNoteRef = useRef(activeNote); activeNoteRef.current = activeNote;
  const currentFolder = folders.find((folder) => folder.id === activeNote?.folderId);
  const parentFolder = folders.find((folder) => folder.id === currentFolder?.parentId);
  const words = wordCount(activeNote?.content || "");
  const characterCount = plainText(activeNote?.content || "").length;
  const headings = (activeNote?.content.match(/^#{1,3}\s+.+$/gm) || []).map((heading) => ({ level: heading.match(/^#+/)?.[0].length || 2, text: heading.replace(/^#+\s+/, "") }));

  const notice = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 4800);
  }, []);

  const persistNote = useCallback(async (note: Note) => {
    pending.current.set(note.id, note);
    setSaveState("saving");
    try {
      const response = await fetch(`/api/notes/${encodeURIComponent(note.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: note.title, content: note.content, folderId: note.folderId, favorite: note.favorite, deleted: note.deleted, lastOpenedAt: note.lastOpenedAt }),
      });
      if (!response.ok) throw new Error("Sync unavailable");
      if (pending.current.get(note.id)?.updatedAt === note.updatedAt) pending.current.delete(note.id);
      setSaveState(pending.current.size ? "saving" : "saved");
    } catch { setSaveState("device"); }
  }, []);

  const scheduleSave = useCallback((note: Note) => {
    const previous = timers.current.get(note.id); if (previous) clearTimeout(previous);
    pending.current.set(note.id, note);
    setSaveState("saving");
    timers.current.set(note.id, setTimeout(() => { timers.current.delete(note.id); void persistNote(note); }, 650));
  }, [persistNote]);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    const current = notesRef.current.find((note) => note.id === id); if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const all = notesRef.current.map((note) => note.id === id ? next : note);
    notesRef.current = all; setNotes(all); scheduleSave(next);
    return next;
  }, [scheduleSave]);

  const flushEditor = useCallback(() => {
    const current = editorRef.current?.editor;
    if (current && !current.isDestroyed && activeRef.current && current.getText() !== undefined) {
      const markdown = getMarkdown(current);
      if (markdown !== notesRef.current.find((note) => note.id === activeRef.current)?.content) updateNote(activeRef.current, { content: markdown });
    }
  }, [updateNote]);

  const recordVersion = useCallback((note: Note, label: string) => {
    if (!note) return;
    const key = `liquidscribe:versions:${note.id}`;
    const previous = readStored<NoteVersion[]>(key, []);
    if (previous[0]?.content === note.content && previous[0]?.title === note.title) { if (note.id === activeRef.current) setVersions(previous); return; }
    const snapshot: NoteVersion = { id: crypto.randomUUID(), title: note.title, content: note.content, createdAt: new Date().toISOString(), label };
    const next = [snapshot, ...previous].slice(0, 20); store(key, next);
    if (note.id === activeRef.current) setVersions(next);
  }, []);

  useEffect(() => {
    const cached = readStored<{ notes: Note[]; folders: FolderType[]; activeId: string; view: string } | null>(CACHE_KEY, null);
    if (cached && Array.isArray(cached.notes) && cached.notes.length && Array.isArray(cached.folders)) {
      setNotes(cached.notes); notesRef.current = cached.notes; setFolders(cached.folders);
      const id = cached.notes.some((note) => note.id === cached.activeId) ? cached.activeId : cached.notes[0].id;
      setActiveId(id); activeRef.current = id; setView(cached.view || "writing");
    }
    setPreferences(readStored("liquidscribe:preferences", defaultPreferences));
    setModel(readStored<string | null>("liquidscribe:model", null) ?? "");
    if (window.innerWidth < 800) setSidebarCollapsed(true);
    setLoaded(true);
    void fetch("/api/assistant").then((response) => response.json()).then((status: RuntimeStatus) => {
      setRuntime(status);
      const savedModel = readStored<string | null>("liquidscribe:model", null);
      if (savedModel === null || (savedModel && !status.models.includes(savedModel))) setModel(status.available ? status.model : "");
    }).catch(() => {});
    const retry = () => { pending.current.forEach((note) => void persistNote(note)); };
    window.addEventListener("online", retry);
    const saveOnExit = () => {
      pending.current.forEach((note) => { void fetch(`/api/notes/${note.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note), keepalive: true }).catch(() => {}); });
    };
    window.addEventListener("beforeunload", saveOnExit);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("beforeunload", saveOnExit); requestRef.current?.abort(); timers.current.forEach(clearTimeout); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [persistNote]);

  useEffect(() => {
    if (!loaded) return;
    store(CACHE_KEY, { notes, folders, activeId, view });
  }, [notes, folders, activeId, view, loaded]);
  useEffect(() => { if (loaded) store("liquidscribe:preferences", preferences); }, [preferences, loaded]);
  useEffect(() => { if (loaded) store("liquidscribe:model", model); }, [model, loaded]);
  useEffect(() => {
    if (!loaded || !activeNote) return;
    setVersions(readStored(`liquidscribe:versions:${activeId}`, []));
    recordVersion(activeNote, "Opened version");
    const interval = setInterval(() => { const note = notesRef.current.find((item) => item.id === activeRef.current); if (note) recordVersion(note, "Writing snapshot"); }, 60000);
    return () => clearInterval(interval);
    // A snapshot is tied to the selected document, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, loaded, recordVersion]);

  const abortRequest = useCallback(() => { requestRef.current?.abort(); requestRef.current = null; setBusy(false); }, []);
  const openNote = useCallback((id: string) => {
    flushEditor();
    const current = activeNoteRef.current; if (current) recordVersion(current, "Before switching notes");
    const note = notesRef.current.find((item) => item.id === id); if (!note) return;
    abortRequest(); setActiveId(id); activeRef.current = id;
    setView(note.deleted ? "trash" : note.folderId || "all");
    setMode("editing"); setDocumentMenu(false); setMessages([]); setImage(undefined); setCapture(null); setSuggestionCount(0); setOutlineOpen(false);
    if (window.innerWidth < 800) setSidebarCollapsed(true);
    updateNote(id, { lastOpenedAt: new Date().toISOString() });
    scrollRef.current?.scrollTo({ top: 0 });
  }, [abortRequest, flushEditor, recordVersion, updateNote]);

  const addNote = useCallback((title = "Untitled note", content = "", folderId?: string | null) => {
    flushEditor();
    if (activeNoteRef.current) recordVersion(activeNoteRef.current, "Before a new note");
    const chosenFolder = folderId !== undefined ? folderId : folders.find((folder) => folder.id === view)?.id || activeNoteRef.current?.folderId || folders.find((folder) => folder.id === "writing")?.id || null;
    const now = new Date().toISOString();
    const note: Note = { id: crypto.randomUUID(), title, content, folderId: chosenFolder, favorite: false, deleted: false, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const next = [note, ...notesRef.current]; notesRef.current = next; setNotes(next); scheduleSave(note);
    abortRequest(); setActiveId(note.id); activeRef.current = note.id; setView(chosenFolder || "all"); setMode("editing"); setMessages([]); setImage(undefined); setCapture(null); setDocumentMenu(false); setSuggestionCount(0);
    if (window.innerWidth < 800) setSidebarCollapsed(true);
    scrollRef.current?.scrollTo({ top: 0 });
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 120);
    return note;
  }, [abortRequest, flushEditor, folders, recordVersion, scheduleSave, view]);

  const newFolder = async (name: string) => {
    try {
      const response = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId: workspace === "work" ? "work" : null }) });
      if (!response.ok) throw new Error();
      const { folder } = await response.json(); setFolders((previous) => [...previous, folder]); setView(folder.id); notice(`“${name}” has a little room of its own.`);
    } catch { notice("The folder couldn’t be created. Reconnect to your local workspace and try again."); }
  };

  const refreshRuntime = async () => {
    try { const response = await fetch("/api/assistant"); const status: RuntimeStatus = await response.json(); setRuntime(status); if (!status.available) setModel(""); else if (!model || !status.models.includes(model)) setModel(status.model); }
    catch { notice("Couldn’t check the local runtime. Your writing tools are still available."); }
  };
  const exportNote = () => {
    flushEditor();
    const note = notesRef.current.find((item) => item.id === activeRef.current) || notesRef.current[0];
    if (!note) return;
    downloadFile(safeMarkdownFilename(note.title), `# ${note.title}\n\n${exportMarkdown(note.content)}\n`, "text/markdown;charset=utf-8");
    setDocumentMenu(false); notice("Your Markdown file is ready.");
  };
  const exportWorkspace = () => { flushEditor(); downloadFile(`LiquidScribe-workspace-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "LiquidScribe", version: 1, exportedAt: new Date().toISOString(), notes: notesRef.current, folders }, null, 2), "application/json"); notice("Your workspace backup has been downloaded."); };
  const deleteNote = (id: string) => {
    updateNote(id, { deleted: true }); setDialog(null); setDocumentMenu(false);
    const next = notesRef.current.find((note) => !note.deleted && note.id !== id);
    if (next) openNote(next.id); else setView("trash");
    notice("Note moved to Trash. You can always bring it back.");
  };
  const permanentlyDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" }); if (!response.ok) throw new Error();
      const timer = timers.current.get(id); if (timer) clearTimeout(timer); pending.current.delete(id);
      const next = notesRef.current.filter((note) => note.id !== id); notesRef.current = next; setNotes(next);
      try { localStorage.removeItem(`liquidscribe:versions:${id}`); } catch {}
      const another = next.find((note) => note.deleted) || next[0]; if (another) openNote(another.id); else addNote();
      setDialog(null); notice("The note was permanently deleted.");
    } catch { notice("Couldn’t permanently delete this note. Your local copy is safe."); }
  };
  const toggleFocus = () => {
    if (!focusMode) { beforeFocus.current = { sidebar: sidebarCollapsed, dock: dockMinimized }; setSidebarCollapsed(true); setDockMinimized(true); }
    else { setSidebarCollapsed(beforeFocus.current.sidebar); setDockMinimized(beforeFocus.current.dock); }
    setFocusMode(!focusMode); setOutlineOpen(false);
  };
  const reviewSuggestion = () => { editorRef.current?.editor?.view.dom.querySelector(".inline-suggestion")?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const runAction = async (action: AIAction, selectedText = "", instruction = "", attachedImage?: string) => {
    const note = activeNoteRef.current; if (!note || busy) return;
    flushEditor(); abortRequest();
    const currentEditor = editorRef.current?.editor;
    let original = selectedText; let from = 0; let to = 0;
    if (currentEditor && !selectedText) {
      const selection = currentEditor.state.selection;
      if (!selection.empty) { from = selection.from; to = selection.to; original = currentEditor.state.doc.textBetween(from, to, "\n"); }
      else if (["rewrite", "expand", "remove"].includes(action) || (action === "ask" && /rewrite|tighten|expand|remove|concise/i.test(instruction))) {
        from = selection.$from.start(); to = selection.$from.end(); original = currentEditor.state.doc.textBetween(from, to, "\n");
      }
    } else if (currentEditor && selectedText) { from = currentEditor.state.selection.from; to = currentEditor.state.selection.to; }
    const target = { from, to, original, noteId: note.id };
    recordVersion(note, "Before an assistant suggestion");
    const controller = new AbortController(); requestRef.current = controller; setBusy(true);
    if (dockMinimized && !focusMode) setDockMinimized(false);
    const label = action === "ask" ? instruction || "Help me think this through." : `${action.charAt(0).toUpperCase() + action.slice(1)}${selectedText ? " the selected passage" : action === "summarize" || action === "explain" ? " this document" : " this passage"}.`;
    setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "user", content: `${attachedImage ? "📎 Visual capture · " : ""}${label}` }]);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ action, content: contextMode === "none" ? "" : contextMode === "selection" ? original : plainText(note.content), selectedText: original, instruction, image: attachedImage, model: model || undefined, useTools: !model }) });
      const reply = await response.json() as AssistantReply & { error?: string };
      if (!response.ok || reply.error) throw new Error(reply.error || "The assistant couldn’t finish that request.");
      if (controller.signal.aborted || activeRef.current !== note.id) return;
      let canInsert = !reply.edit;
      if (reply.edit && original && currentEditor && !currentEditor.isDestroyed) {
        const safeFrom = Math.min(target.from, currentEditor.state.doc.content.size);
        const safeTo = Math.min(target.to, currentEditor.state.doc.content.size);
        if (currentEditor.state.doc.textBetween(safeFrom, safeTo, "\n") === original) {
          currentEditor.commands.setTextSelection({ from: safeFrom, to: safeTo });
          editorRef.current?.suggest(original, reply.text);
          setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "assistant", content: `A ${action === "remove" ? "removal" : action === "expand" ? "little more detail" : "fresh phrasing"}, ready for your review. Accept or reject the suggestion right in your document.`, mode: reply.mode }]);
        } else { canInsert = true; notice("You kept writing — your suggestion is safe in the assistant instead."); }
      }
      if (canInsert) setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "assistant", content: reply.text || "The passage would be removed. Select it and choose Remove to review that change.", mode: reply.mode, canInsert: !!reply.text && !attachedImage }]);
      setImage(undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "The assistant is unavailable. Your document is safe.";
      setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "assistant", content: message, error: true }]);
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };

  const sendMessage = (text: string, attachedImage?: string) => {
    let action: AIAction = "ask";
    if (!attachedImage) { if (/^remove\b/i.test(text)) action = "remove"; else if (/^expand\b/i.test(text)) action = "expand"; else if (/^rewrite\b/i.test(text)) action = "rewrite"; else if (/^summari[sz]e\b/i.test(text)) action = "summarize"; else if (/^explain\b/i.test(text)) action = "explain"; }
    void runAction(action, "", text, attachedImage);
  };
  const restoreVersion = (version: NoteVersion) => {
    if (!activeNote) return; recordVersion(activeNote, "Before restoring a version"); updateNote(activeNote.id, { title: version.title, content: version.content }); setEditorRevision((value) => value + 1); notice("Version restored. Your previous draft is still in history.");
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); if (editor?.isActive("link")) setDialog({ type: "link" }); else setDialog({ type: "search" }); }
      if (mod && event.key.toLowerCase() === "j") { event.preventDefault(); addNote(); notice("A fresh page, just for you."); }
      if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); flushEditor(); notesRef.current.forEach((note) => void persistNote(note)); notice("Your thoughts are safe on this device."); }
      if (mod && event.key === "\\") { event.preventDefault(); setSidebarCollapsed((value) => !value); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [addNote, editor, flushEditor, notice, persistNote]);

  if (!activeNote) return <div className="empty-workspace"><Feather size={40} /><h1>A little room for your thoughts.</h1><button className="primary-button" onClick={() => addNote()}>Create your first note<ArrowRight size={15} /></button></div>;
  const category = currentFolder?.id === "writing" ? "Essay" : currentFolder?.name || "Note";
  const editorStyle = { "--editor-font-size": `${preferences.fontSize}px`, "--editor-font-family": preferences.serif ? "'Lora', Georgia, serif" : "'DM Sans', sans-serif", "--sheet-width": preferences.wide ? "1020px" : "860px" } as CSSProperties;

  return <div className={`app-shell ${focusMode ? "focus-mode" : ""}`} style={editorStyle}>
    <Sidebar notes={notes} folders={folders} activeId={activeId} view={view} collapsed={sidebarCollapsed} workspace={workspace} onWorkspace={(value) => { setWorkspace(value); setView(value === "work" ? "work" : "all"); }} onView={(value) => { setView(value); if (window.innerWidth < 800) setSidebarCollapsed(false); }} onNote={openNote} onNew={() => { addNote(); notice("A fresh page, just for you."); }} onSearch={() => setDialog({ type: "search" })} onFolder={() => setDialog({ type: "folder" })} onSettings={(tab = "writing") => setDialog({ type: "settings", tab })} onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onExport={exportWorkspace} />
    <main className="workspace-main">
      <header className="document-topbar"><div className="breadcrumbs">{(sidebarCollapsed || focusMode) && <button className="icon-button open-sidebar" onClick={() => { setSidebarCollapsed(false); if (focusMode) toggleFocus(); }} title="Open sidebar" aria-label="Open sidebar"><PanelLeftOpen size={17} /></button>}<span className="breadcrumb-root">{parentFolder?.name || currentFolder?.name || "Personal"}</span><ChevronRight size={12} />{parentFolder && <><button className="breadcrumb-folder" onClick={() => { setView(currentFolder?.id || "all"); setSidebarCollapsed(false); }}>{currentFolder?.name}</button><ChevronRight size={12} /></>}<span className="breadcrumb-current">{activeNote.title || "Untitled note"}</span></div><div className="document-topbar-actions"><span className={`save-indicator ${saveState}`} title={saveState === "device" ? "Saved in this browser. Server sync will retry when available." : "Your notes are saved locally"}>{saveState === "saving" ? <LoaderCircle size={14} className="spin" /> : saveState === "device" ? <WifiOff size={14} /> : <Check size={15} />}<span>{saveState === "saving" ? "Saving…" : saveState === "device" ? "Saved on device" : "Saved just now"}</span></span><span className="topbar-divider" /><button className={`icon-button favorite-button ${activeNote.favorite ? "is-favorite" : ""}`} onClick={() => { updateNote(activeNote.id, { favorite: !activeNote.favorite }); notice(activeNote.favorite ? "Removed from favorites." : "A favorite thought, kept close."); }} title={activeNote.favorite ? "Remove from favorites" : "Add to favorites"} aria-label={activeNote.favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={activeNote.favorite}><Star size={16} fill={activeNote.favorite ? "currentColor" : "none"} strokeWidth={1.6} /></button><button className="icon-button" onClick={() => { flushEditor(); if (activeNote) recordVersion(activeNote, "Manual snapshot"); setDialog({ type: "history" }); }} title="Version history" aria-label="Version history"><History size={17} /></button><div className="document-menu-wrap"><button className={`icon-button ${documentMenu ? "active" : ""}`} onClick={() => setDocumentMenu(!documentMenu)} title="Document actions" aria-label="Document actions" aria-expanded={documentMenu}><Ellipsis size={19} /></button>{documentMenu && <><button className="popover-dismiss" onClick={() => setDocumentMenu(false)} aria-label="Close document menu" /><div className="popover document-popover"><span className="menu-eyebrow">THIS DOCUMENT</span><button onClick={() => { setDialog({ type: "move" }); setDocumentMenu(false); }}><FolderInput size={15} />Move to folder<ChevronRight size={12} /></button><button onClick={() => { flushEditor(); addNote(`${activeNote.title} (copy)`, activeNote.content, activeNote.folderId); notice("A copy is ready for a new direction."); }}><Copy size={15} />Make a copy</button><button onClick={exportNote}><Download size={15} />Export Markdown<ArrowRight size={12} /></button><button onClick={() => { setDocumentMenu(false); setTimeout(() => window.print(), 50); }}><Printer size={15} />Print document</button><div className="menu-separator" />{activeNote.deleted ? <><button onClick={() => { updateNote(activeNote.id, { deleted: false }); setView(activeNote.folderId || "all"); notice("Welcome back. Your note has been restored."); }}><RotateCcw size={15} />Restore note</button><button className="danger" onClick={() => { setDialog({ type: "delete", id: activeNote.id }); setDocumentMenu(false); }}><Trash2 size={15} />Delete permanently</button></> : <button className="danger" onClick={() => deleteNote(activeNote.id)}><Trash2 size={15} />Move to trash</button>}</div></>}</div></div></header>
      <EditorToolbar editor={editor} mode={mode} onMode={setMode} focus={focusMode} onFocus={toggleFocus} outline={outlineOpen} onOutline={() => setOutlineOpen(!outlineOpen)} editable={!activeNote.deleted} onLink={() => setDialog({ type: "link" })} />
      {activeNote.deleted && <div className="trash-banner"><Trash2 size={14} /><span>This note is in the trash.</span><button onClick={() => { updateNote(activeNote.id, { deleted: false }); setView(activeNote.folderId || "all"); notice("Your note has been restored."); }}><RotateCcw size={12} />Restore note</button><button onClick={() => setDialog({ type: "delete", id: activeNote.id })}>Delete permanently</button></div>}
      <div className="document-stage"><div className="document-scroll" ref={scrollRef}><article className={`document-sheet ${mode === "source" ? "source-mode" : ""}`}>
        <div className="document-metadata"><span className="document-category"><i />{category}</span><span className="metadata-dot">·</span><time dateTime={activeNote.createdAt}>{new Date(activeNote.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time><span className="metadata-dot">·</span><span>{readingTime(activeNote.content)} min read</span>{suggestionCount > 0 && <button className="suggestion-review" onClick={reviewSuggestion} title="Jump to the pending suggestion"><Sparkles size={11} />{suggestionCount} suggestion<ChevronRight size={10} /></button>}</div>
        <input ref={titleRef} className="document-title" aria-label="Document title" value={activeNote.title} placeholder="Untitled note" maxLength={240} readOnly={activeNote.deleted || mode === "preview"} onChange={(event) => updateNote(activeNote.id, { title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); editorRef.current?.focus(); } }} />
        {mode === "source" ? <textarea className="markdown-source" aria-label="Markdown source" value={activeNote.content} readOnly={activeNote.deleted} onChange={(event) => updateNote(activeNote.id, { content: event.target.value })} spellCheck={false} /> : <DocumentEditor key={`${activeNote.id}-${editorRevision}`} ref={editorRef} noteId={activeNote.id} content={activeNote.content} editable={mode === "editing" && !activeNote.deleted} onChange={(content) => updateNote(activeNote.id, { content })} onEditorReady={setEditor} onAction={(action, selected) => void runAction(action, selected)} onSuggestionCount={setSuggestionCount} onToast={notice} />}
        <div className="document-end-mark"><span /><Feather size={13} strokeWidth={1.3} /><span /></div>
      </article></div>
      {outlineOpen && <aside className="outline-drawer"><header><span><ListTreeIcon />On this page</span><button className="icon-button" onClick={() => setOutlineOpen(false)} aria-label="Close outline"><X size={15} /></button></header><div>{headings.length ? headings.map((heading, index) => <button key={`${heading.text}-${index}`} className={`outline-item level-${heading.level}`} onClick={() => { const elements = scrollRef.current?.querySelectorAll(".document-prose h1, .document-prose h2, .document-prose h3, .markdown-source"); elements?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span>{heading.text}</span></button>) : <p className="outline-empty">Add a heading to give your thoughts a little structure.</p>}</div><footer>{headings.length} headings<span>·</span>{words} words</footer></aside>}
      </div>
      <div className="assistant-area">{capture && <CapturePreview kind={capture} onClose={() => setCapture(null)} onCapture={(captureImage) => { setImage(captureImage); notice("Capture attached. Add a thought, then send when you’re ready."); }} onNotice={notice} />}<AssistantDock runtime={runtime} model={model} onModel={setModel} busy={busy} messages={messages} onSend={sendMessage} onCancel={() => { abortRequest(); notice("Request stopped. Your document hasn’t changed."); }} onCapture={(kind) => setCapture(capture === kind ? null : kind)} image={image} onRemoveImage={() => setImage(undefined)} onSettings={() => setDialog({ type: "settings", tab: "assistant" })} onNotice={notice} onInsert={(text) => { if (activeNote.deleted) { notice("Restore this note before adding to it."); return; } if (mode === "source") updateNote(activeNote.id, { content: `${activeNote.content}\n\n${text}` }); else editorRef.current?.insert(text); notice("Added to your document. Undo is always there."); }} contextMode={contextMode} onContext={setContextMode} minimized={dockMinimized} onMinimize={() => setDockMinimized(!dockMinimized)} /></div>
      <footer className="workspace-status"><div><span className="status-local"><ShieldCheck size={11} />Local workspace</span><span className="status-separator">·</span><span className={busy ? "status-processing" : ""}>{busy ? <><LoaderCircle size={10} className="spin" />Processing locally</> : saveState === "saving" ? "Saving your thoughts…" : saveState === "device" ? "Saved on this device" : "All changes saved"}</span></div><div>{preferences.showWordCount && <span>{words.toLocaleString()} words<span className="status-separator">·</span><span className="character-count">{characterCount.toLocaleString()} characters</span></span>}<button className="status-markdown" onClick={() => setMode(mode === "source" ? "editing" : "source")}>Markdown<ChevronRight size={9} /></button><button className="icon-button" onClick={() => setDialog({ type: "shortcuts" })} title="Keyboard shortcuts" aria-label="Keyboard shortcuts"><CircleHelp size={12} /></button></div></footer>
    </main>
    {toast && <div key={toast.id} className="toast" role="status"><span><Check size={13} /></span><p>{toast.message}</p><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={13} /></button></div>}
    {dialog?.type === "search" && <SearchDialog notes={notes} folders={folders} onNote={openNote} onNew={() => addNote()} onClose={() => setDialog(null)} />}
    {dialog?.type === "settings" && <SettingsDialog initialTab={dialog.tab} preferences={preferences} onPreferences={setPreferences} runtime={runtime} onRefresh={refreshRuntime} model={model} onModel={setModel} onExport={exportWorkspace} onClose={() => setDialog(null)} />}
    {dialog?.type === "folder" && <PromptDialog title="A home for a few thoughts" label="Folder name" placeholder="Something worth exploring…" onSubmit={(value) => void newFolder(value)} onClose={() => setDialog(null)} />}
    {dialog?.type === "history" && <HistoryDialog versions={versions} onRestore={restoreVersion} onClose={() => setDialog(null)} />}
    {dialog?.type === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
    {dialog?.type === "move" && <PromptDialog title="Find a new home" label="Move this note to" initialValue={activeNote.folderId || ""} options={folders.map((folder) => ({ value: folder.id, label: `${folders.find((item) => item.id === folder.parentId)?.name ? `${folders.find((item) => item.id === folder.parentId)?.name} / ` : ""}${folder.name}` }))} onSubmit={(value) => { updateNote(activeNote.id, { folderId: value || null }); setView(value || "all"); notice("Note moved. A change of scenery."); }} onClose={() => setDialog(null)} />}
    {dialog?.type === "link" && <PromptDialog title="Connect a thought" label="Link address" initialValue={editor?.getAttributes("link").href || "https://"} placeholder="https://example.com" validate={(value) => /^(https?:\/\/|mailto:)\S+/i.test(value) ? null : "Use a full https://, http://, or mailto: address."} onSubmit={(value) => { if (!/^(https?:\/\/|mailto:)/i.test(value)) { notice("Use a full https://, http://, or mailto: address."); return; } if (editor?.state.selection.empty) editor?.chain().focus().insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }).run(); else editor?.chain().focus().extendMarkRange("link").setLink({ href: value }).run(); }} onClose={() => setDialog(null)} />}
    {dialog?.type === "delete" && <Modal title="Let this note go?" subtitle="This permanently deletes the note and its local version history. This cannot be undone." onClose={() => setDialog(null)} className="confirm-modal"><div className="delete-note-preview"><FileText size={18} /><span>{notes.find((note) => note.id === dialog.id)?.title}</span></div><div className="modal-actions"><button className="secondary-button" onClick={() => setDialog(null)}>Keep note</button><button className="danger-button" onClick={() => void permanentlyDelete(dialog.id)}><Trash2 size={14} />Delete permanently</button></div></Modal>}
  </div>;
}

function ListTreeIcon() { return <Folder size={14} strokeWidth={1.6} />; }
