import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Check, Sparkles, X } from "lucide-react";

function SuggestionView({ node, editor, getPos, deleteNode, extension }: NodeViewProps) {
  const resolve = (accept: boolean) => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const text = accept ? node.attrs.replacement : node.attrs.original;
    const chain = editor.chain().focus();
    if (text) chain.insertContentAt({ from: pos, to: pos + node.nodeSize }, text).run();
    else deleteNode();
    extension.options.onResolve?.(accept);
  };

  return (
    <NodeViewWrapper as="span" className="inline-suggestion" data-label="AI suggestion">
      {node.attrs.original && <del>{node.attrs.original}</del>}{" "}
      {node.attrs.replacement && <ins>{node.attrs.replacement}</ins>}
      <span className="suggestion-controls" contentEditable={false}>
        <span className="suggestion-label"><Sparkles size={11} /> Suggested edit</span>
        <button type="button" onClick={() => resolve(true)} title="Accept suggestion" aria-label="Accept suggestion"><Check size={13} /></button>
        <button type="button" onClick={() => resolve(false)} title="Reject suggestion" aria-label="Reject suggestion"><X size={13} /></button>
      </span>
    </NodeViewWrapper>
  );
}

export const SuggestionNode = Node.create({
  name: "aiSuggestion",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addOptions() {
    return { onResolve: (_accepted: boolean) => {} };
  },
  addAttributes() {
    return {
      original: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-original") || "",
        renderHTML: (attributes) => ({ "data-original": attributes.original }),
      },
      replacement: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-replacement") || "",
        renderHTML: (attributes) => ({ "data-replacement": attributes.replacement }),
      },
    };
  },
  parseHTML() { return [{ tag: "ai-suggestion" }]; },
  renderHTML({ HTMLAttributes }) { return ["ai-suggestion", mergeAttributes(HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(SuggestionView); },
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void }, node: { attrs: { original: string; replacement: string } }) {
          const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "&#10;");
          state.write(`<ai-suggestion data-original="${escape(node.attrs.original)}" data-replacement="${escape(node.attrs.replacement)}"></ai-suggestion>`);
        },
      },
    };
  },
});
