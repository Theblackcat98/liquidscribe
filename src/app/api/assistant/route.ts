import { getRuntimeStatus, runAssistant } from "@/lib/server/assistant";
import type { AIAction } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET() {
  return Response.json(await getRuntimeStatus());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actions: AIAction[] = ["rewrite", "summarize", "explain", "expand", "remove", "ask"];
    if (!actions.includes(body.action) || typeof body.content !== "string") {
      return Response.json({ error: "Choose a writing action and include your document." }, { status: 400 });
    }
    if (typeof body.image === "string" && body.image.length > 8_000_000) {
      return Response.json({ error: "This capture is too large. Try a smaller image." }, { status: 413 });
    }
    const reply = await runAssistant({
      action: body.action,
      content: body.content.slice(0, 40000),
      selectedText: typeof body.selectedText === "string" ? body.selectedText.slice(0, 16000) : "",
      instruction: typeof body.instruction === "string" ? body.instruction.slice(0, 4000) : "",
      image: typeof body.image === "string" ? body.image : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      useTools: body.useTools === true,
    });
    return Response.json(reply);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Something interrupted the assistant. Your document is safe." }, { status: 503 });
  }
}
