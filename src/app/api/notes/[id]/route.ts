import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const update: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.title === "string") update.title = body.title.slice(0, 240);
    if (typeof body.content === "string") update.content = body.content;
    if (typeof body.folderId === "string" || body.folderId === null) update.folderId = body.folderId;
    if (typeof body.favorite === "boolean") update.favorite = body.favorite;
    if (typeof body.deleted === "boolean") update.deleted = body.deleted;
    if (typeof body.lastOpenedAt === "string" && !Number.isNaN(Date.parse(body.lastOpenedAt))) update.lastOpenedAt = new Date(body.lastOpenedAt);
    const [note] = await db.insert(notes).values({
      id,
      title: update.title ?? "Untitled note",
      content: update.content ?? "",
      ...update,
    }).onConflictDoUpdate({ target: notes.id, set: update }).returning();
    if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
    return Response.json({ note });
  } catch {
    return Response.json({ error: "Your changes are saved on this device. Reconnect to sync." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const [note] = await db.delete(notes).where(eq(notes.id, id)).returning();
    if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "The note could not be permanently deleted." }, { status: 500 });
  }
}
