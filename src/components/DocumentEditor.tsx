"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Sparkles, WandSparkles, AlignLeft, MessageCircle, Expand, Trash2 } from "lucide-react";
import { SuggestionNode } from "./SuggestionNode";
import type { AIAction } from "@/lib/workspace";

export type DocumentEditorHandle = {
  editor: Editor | null;
  focus: () => void;
  suggest: (original: string, replacement: string) => void;
  insert: (text: string) => void;
  resolveAll: (accept: boolean) => void;
};

type Props = {
  noteId: string;
  content: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  onEditorReady: (editor: Editor) => void;
  onAction: (action: AIAction, selectedText: string) => void;
  onSuggestionCount: (count: number) => void;
  onToast: (message: string) => void;
};

export function getMarkdown(editor: Editor) {
  return (editor.storage as unknown as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() || "";
}

export function countSuggestions(editor: Editor) {
  let count = 0;
  editor.state.doc.descendants((node) => { if (node.type.name === "aiSuggestion") count++; });
  return count;
}

export const DocumentEditor = forwardRef<DocumentEditorHandle, Props>(function DocumentEditor(props, ref) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const pendingRange = useRef<{ from: number; to: number } | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }, heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Let a thought become a sentence…" }),
      Markdown.configure({ html: true, transformPastedText: true }),
      SuggestionNode.configure({ onResolve: (accepted: boolean) => callbacks.current.onToast(accepted ? "Suggestion accepted. Your words, your choice." : "Suggestion rejected. Original text restored.") }),
    ],
    content: props.content,
    editable: props.editable,
    immediatelyRender: true,
    editorProps: { attributes: { class: "document-prose", spellcheck: "true", "aria-label": "Document body" } },
    onUpdate: ({ editor: current }) => {
      callbacks.current.onChange(getMarkdown(current));
      callbacks.current.onSuggestionCount(countSuggestions(current));
    },
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to, empty } = current.state.selection;
      if (!empty && !current.state.doc.nodeAt(from)?.isAtom) pendingRange.current = { from, to };
    },
    onCreate: ({ editor: current }) => {
      callbacks.current.onEditorReady(current);
      callbacks.current.onSuggestionCount(countSuggestions(current));
    },
  });

  useEffect(() => { editor?.setEditable(props.editable); }, [editor, props.editable]);

  useImperativeHandle(ref, () => ({
    editor,
    focus: () => { editor?.commands.focus(); },
    suggest: (original, replacement) => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      const range = !empty ? { from, to } : pendingRange.current;
      const target = range ? editor.state.doc.textBetween(range.from, range.to, " ") : original;
      const command = editor.chain().focus();
      if (range) command.insertContentAt(range, { type: "aiSuggestion", attrs: { original: target, replacement } });
      else command.insertContentAt(editor.state.selection.to, { type: "aiSuggestion", attrs: { original, replacement } });
      command.run();
      pendingRange.current = null;
      requestAnimationFrame(() => editor.view.dom.querySelector(".inline-suggestion")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    },
    insert: (text) => { editor?.chain().focus().insertContent(text).run(); },
    resolveAll: (accept) => {
      if (!editor) return;
      const items: { from: number; to: number; text: string }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "aiSuggestion") items.push({ from: pos, to: pos + node.nodeSize, text: accept ? node.attrs.replacement : node.attrs.original });
      });
      const tr = editor.state.tr;
      items.reverse().forEach((item) => {
        tr.replaceWith(item.from, item.to, item.text ? editor.schema.text(item.text) : []);
      });
      if (items.length) editor.view.dispatch(tr);
      callbacks.current.onToast(`${items.length} suggestion${items.length === 1 ? "" : "s"} ${accept ? "accepted" : "rejected"}.`);
    },
  }), [editor]);

  if (!editor) return <div className="editor-loading"><span />Making room for your thoughts…</div>;

  return (
    <div className="tiptap-container">
      {props.editable && <BubbleMenu editor={editor} pluginKey="writingActions" shouldShow={({ editor: current, from, to }) => to > from && !current.state.doc.nodeAt(from)?.isAtom && current.isEditable} options={{ placement: "top", offset: 12 }}>
        <div className="selection-toolbar">
          <span className="selection-ai"><Sparkles size={13} /> Ask AI</span>
          {([
            ["rewrite", "Rewrite", WandSparkles],
            ["summarize", "Summarize", AlignLeft],
            ["explain", "Explain", MessageCircle],
            ["expand", "Expand", Expand],
            ["remove", "Remove", Trash2],
          ] as const).map(([action, label, Icon]) => <button key={action} title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => {
            const { from, to } = editor.state.selection;
            pendingRange.current = { from, to };
            props.onAction(action, editor.state.doc.textBetween(from, to, "\n"));
          }}><Icon size={13} /><span>{label}</span></button>)}
        </div>
      </BubbleMenu>}
      <EditorContent editor={editor} />
    </div>
  );
});
