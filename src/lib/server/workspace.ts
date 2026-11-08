import { db } from "@/db";
import { folders, notes } from "@/db/schema";
import { starterFolders, starterNotes } from "@/lib/workspace";
import { sql } from "drizzle-orm";

let seedPromise: Promise<void> | undefined;

export function ensureWorkspace() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await db.transaction(async (tx) => {
        const existing = await tx.select({ id: folders.id }).from(folders).limit(1);
        if (existing.length) return;
        await tx.insert(folders).values(starterFolders).onConflictDoNothing();
        await tx.insert(notes).values(starterNotes.map((note) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt),
          lastOpenedAt: new Date(note.lastOpenedAt),
        }))).onConflictDoNothing();
      });
    })().catch((error) => { seedPromise = undefined; throw error; });
  }
  return seedPromise;
}

export async function getWorkspace() {
  await ensureWorkspace();
  const [allNotes, allFolders] = await Promise.all([
    db.select().from(notes).orderBy(sql`${notes.updatedAt} desc`),
    db.select().from(folders).orderBy(folders.createdAt),
  ]);
  return { notes: allNotes, folders: allFolders };
}
