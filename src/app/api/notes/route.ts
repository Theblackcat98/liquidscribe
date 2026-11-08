import { db } from "@/db";
import { notes, folders } from "@/db/schema";
import { ensureWorkspace } from "@/lib/server/workspace";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureWorkspace();
    const [allNotes, allFolders] = await Promise.all([db.select().from(notes), db.select().from(folders)]);
    return Response.json({ notes: allNotes, folders: allFolders });
  } catch {
    return Response.json({ error: "Your workspace could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const folderId = typeof body.folderId === "string" ? body.folderId : null;
    if (folderId) {
      const folder = await db.select().from(folders).where(eq(folders.id, folderId));
      if (!folder.length) return Response.json({ error: "That folder no longer exists." }, { status: 404 });
    }
    const [note] = await db.insert(notes).values({
      id: crypto.randomUUID(),
      title: typeof body.title === "string" ? body.title.slice(0, 240) : "Untitled note",
      content: typeof body.content === "string" ? body.content : "",
      folderId,
    }).returning();
    return Response.json({ note }, { status: 201 });
  } catch {
    return Response.json({ error: "The note could not be created." }, { status: 500 });
  }
}
