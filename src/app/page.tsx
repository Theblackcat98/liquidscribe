import { Workspace } from "@/components/Workspace";
import { getWorkspace } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { notes, folders } = await getWorkspace();
  const initialNotes = notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastOpenedAt: note.lastOpenedAt.toISOString(),
  }));
  return <Workspace initialNotes={initialNotes} initialFolders={folders} />;
}
