export type Note = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  favorite: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type Folder = { id: string; name: string; parentId: string | null; color: string };
export type AIAction = "rewrite" | "summarize" | "explain" | "expand" | "remove" | "ask";
export type AssistantReply = { text: string; mode: "model" | "tools"; edit: boolean; action: AIAction };
export type RuntimeStatus = { available: boolean; models: string[]; model: string; endpoint: string };

export const INITIAL_NOTE_ID = "note-focused-writing";
export const SUGGESTION_ORIGINAL = "a little help when you need it.";
export const SUGGESTION_REPLACEMENT = "a thoughtful nudge, right when you need it.";

export const starterFolders: Folder[] = [
  { id: "personal", name: "Personal", parentId: null, color: "sage" },
  { id: "writing", name: "Writing", parentId: "personal", color: "sage" },
  { id: "ideas", name: "Ideas", parentId: "personal", color: "sand" },
  { id: "journal", name: "Journal", parentId: "personal", color: "lavender" },
  { id: "work", name: "Work", parentId: null, color: "blue" },
  { id: "product", name: "Product", parentId: "work", color: "blue" },
  { id: "research", name: "Research", parentId: "work", color: "sand" },
];

export const focusedWriting = `The best ideas rarely arrive in a rush. They come when we slow down, make a little room, and let ourselves pay attention.

## Make space for the thought

We live in an age of infinite inputs. A dozen tabs, a handful of notifications, and the quiet pull of everything we haven’t done yet. But the most meaningful work asks for something simpler: our undivided attention.

Writing is a practice of noticing. Of staying with a thought long enough to discover what it’s really trying to say. The blank page isn’t an obstacle. It’s an invitation.

## A quieter kind of tool

The best tools get out of the way. They give your ideas room to breathe, and <ai-suggestion data-original="${SUGGESTION_ORIGINAL}" data-replacement="${SUGGESTION_REPLACEMENT}"></ai-suggestion>

> You don’t need more time. You need a place where your attention can land.

## Write first. Edit second.

Give yourself permission to write imperfectly. Let the first draft be a conversation with yourself — curious, unfinished, a little messy. Clarity comes from returning to the page, not from waiting for it.

### A small practice

- Close what you don’t need.
- Start with one honest sentence.
- Follow the thought before you judge it.

The page is patient. Begin there.`;

const sampleNotes: Array<[string, string, string, string, boolean]> = [
  [INITIAL_NOTE_ID, "The art of focused writing", "writing", focusedWriting, true],
  ["note-small-things", "Small things, big differences", "writing", "## Notice the ordinary\n\nThe light through the kitchen window. A sentence that stays with you. The way a good walk untangles a complicated thought.\n\nThere is material everywhere, if we let ourselves notice.\n\n## A collection of small things\n\n- A well-made cup of coffee.\n- The sound of rain before sleep.\n- A conversation with no particular destination.", false],
  ["note-ideas", "A few ideas worth keeping", "ideas", "## Seeds, not plans\n\nNot every idea needs to become something. Some just need a place to land.\n\n- A reading journal that connects ideas instead of collecting quotes.\n- A weekly walk with a different friend.\n- A tiny website about the things I’m learning.\n\n**Next step:** pick one and give it twenty minutes.", true],
  ["note-friday", "Friday, a little slower", "journal", "## April 17\n\nTook the long way home today. No podcast, no calls. Just the evening and a little room to think.\n\nI noticed how rarely I let a thought finish before reaching for my phone. Something to practice.\n\n**Today’s small win:** finished the first draft.\n\n**Tomorrow:** more of this.", false],
  ["note-principles", "LiquidScribe · product principles", "product", "## The document comes first\n\nLiquidScribe should feel like a thoughtful writing space, not a chatbot with an editor attached.\n\n### What we believe\n\n- Writing continuity matters more than feature density.\n- Every edit should be understandable and reversible.\n- Local processing is a meaningful form of privacy.\n- Voice and visual context should support the page, not compete with it.\n\n> An intelligent tool. An uninterrupted thought.", true],
  ["note-attention", "Field notes: attention & creativity", "research", "## Attention as a creative practice\n\nQuestions worth exploring:\n\n1. How does the environment shape the quality of our attention?\n2. What is the relationship between boredom and original thinking?\n3. Can a tool help us notice more without asking us to do more?\n\n## Observations\n\nThe most useful distinction so far: capturing a thought is not the same as developing it. A good workspace should support both, but keep them separate.", false],
  ["note-reading", "An unhurried reading list", "personal", "## On the bedside table\n\n- **The Creative Act** — Rick Rubin\n- **Four Thousand Weeks** — Oliver Burkeman\n- **A Field Guide to Getting Lost** — Rebecca Solnit\n\n## A note to myself\n\nRead slowly. Keep a pencil nearby. It’s better to remember one idea than finish five books.", false],
  ["note-intentions", "April intentions", "journal", "## Less, but better\n\nThis month, I’m making a little more space for the things that feel easy to postpone.\n\n- Write something every morning.\n- Take a walk without a destination.\n- Finish the book I keep starting.\n- Call someone I miss.\n\nNo streaks. No metrics. Just a direction.", false],
  ["note-maya", "A conversation with Maya", "product", "## Notes from our catch-up\n\nWhat makes a writing tool feel trustworthy? Maya’s answer: “I always know where my work is, and I can always get back to where I was.”\n\n### Follow-up ideas\n\n- Make save state visible but quiet.\n- Keep version history approachable.\n- Show suggestions in context, never in a separate maze of panels.", false],
  ["note-questions", "The shape of a good question", "research", "## Start with curiosity\n\nA good question opens a door rather than asking for a password.\n\nInstead of “Is this useful?” try “What becomes possible when this exists?”\n\nInstead of “What should I write?” try “What have I noticed that I haven’t said yet?”\n\n**An experiment:** collect the questions that change how I see a problem.", false],
];

export const starterNotes: Note[] = sampleNotes.map(([id, title, folderId, content, favorite], i) => ({
  id, title, folderId, content, favorite, deleted: false,
  createdAt: new Date(Date.UTC(2026, 3, 18 - i, 9)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 3, 18, 10, 42 - i)).toISOString(),
  lastOpenedAt: new Date(Date.UTC(2026, 3, 18, 10, 42 - i)).toISOString(),
}));

export function plainText(markdown: string) {
  return markdown
    .replace(/<ai-suggestion[^>]*data-replacement="([^"]*)"[^>]*><\/ai-suggestion>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[#*_`>\[\]]/g, "")
    .trim();
}

export function wordCount(markdown: string) {
  const text = plainText(markdown);
  return text ? text.split(/\s+/).length : 0;
}

export function readingTime(markdown: string) {
  return Math.max(1, Math.ceil(wordCount(markdown) / 200));
}
