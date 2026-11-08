"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Link2, Undo2, Redo2, Maximize2, Minimize2, ListTree, ChevronDown, PencilLine } from "lucide-react";

type Props = { editor: Editor | null; mode: string; onMode: (mode: string) => void; focus: boolean; onFocus: () => void; outline: boolean; onOutline: () => void; onLink: () => void; editable: boolean };

export function EditorToolbar({ editor, mode, onMode, focus, onFocus, outline, onOutline, onLink, editable }: Props) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current?.isActive("bold"), italic: current?.isActive("italic"), strike: current?.isActive("strike"), code: current?.isActive("code"), bullet: current?.isActive("bulletList"), ordered: current?.isActive("orderedList"), quote: current?.isActive("blockquote"), link: current?.isActive("link"),
    heading: current?.isActive("heading", { level: 1 }) ? "1" : current?.isActive("heading", { level: 2 }) ? "2" : current?.isActive("heading", { level: 3 }) ? "3" : "paragraph",
    canUndo: current?.can().undo(), canRedo: current?.can().redo(),
  }) });
  const disabled = !editable || mode !== "editing";
  const tools = [
    { label: "Bold · ⌘B", icon: Bold, active: state?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { label: "Italic · ⌘I", icon: Italic, active: state?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { label: "Strikethrough", icon: Strikethrough, active: state?.strike, run: () => editor?.chain().focus().toggleStrike().run() },
    { label: "Inline code", icon: Code, active: state?.code, run: () => editor?.chain().focus().toggleCode().run() },
  ];
  return <div className="editor-toolbar" role="toolbar" aria-label="Document formatting">
    <div className="toolbar-left"><div className="editor-mode-control"><PencilLine size={13} /><select aria-label="Document view" value={mode} onChange={(event) => onMode(event.target.value)}><option value="editing">Editing</option><option value="preview">Reading</option><option value="source">Markdown</option></select><ChevronDown size={10} /></div><span className="toolbar-divider" /><button className="toolbar-button" disabled={disabled || !state?.canUndo} onClick={() => editor?.chain().focus().undo().run()} title="Undo · ⌘Z" aria-label="Undo"><Undo2 size={15} /></button><button className="toolbar-button" disabled={disabled || !state?.canRedo} onClick={() => editor?.chain().focus().redo().run()} title="Redo · ⌘⇧Z" aria-label="Redo"><Redo2 size={15} /></button><span className="toolbar-divider" /><div className="heading-control"><select aria-label="Text style" disabled={disabled} value={state?.heading || "paragraph"} onChange={(event) => { if (event.target.value === "paragraph") editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().toggleHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run(); }}><option value="paragraph">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select><ChevronDown size={10} /></div><span className="toolbar-divider format-divider" />
      {tools.map(({ label, icon: Icon, active, run }) => <button key={label} className={`toolbar-button ${active ? "active" : ""}`} disabled={disabled} onClick={run} title={label} aria-label={label} aria-pressed={!!active}><Icon size={15} strokeWidth={1.8} /></button>)}
      <span className="toolbar-divider lists-divider" /><button className={`toolbar-button ${state?.bullet ? "active" : ""}`} disabled={disabled} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list" aria-label="Bullet list"><List size={16} /></button><button className={`toolbar-button optional-format ${state?.ordered ? "active" : ""}`} disabled={disabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list" aria-label="Numbered list"><ListOrdered size={16} /></button><button className={`toolbar-button ${state?.quote ? "active" : ""}`} disabled={disabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Quote" aria-label="Quote"><Quote size={15} /></button><button className={`toolbar-button ${state?.link ? "active" : ""}`} disabled={disabled} onClick={onLink} title="Insert link" aria-label="Insert link"><Link2 size={15} /></button>
    </div><div className="toolbar-right"><button className={`focus-button ${focus ? "active" : ""}`} onClick={onFocus} title="Toggle distraction-free writing">{focus ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span>{focus ? "Exit focus" : "Focus"}</span></button><span className="toolbar-divider" /><button className={`toolbar-button ${outline ? "active" : ""}`} onClick={onOutline} title="Document outline" aria-label="Toggle document outline" aria-pressed={outline}><ListTree size={16} /></button></div>
  </div>;
}
