import { db } from "@/db";
import { folders } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "Give your folder a name." }, { status: 400 });
    }
    const [folder] = await db.insert(folders).values({
      id: crypto.randomUUID(),
      name: body.name.trim().slice(0, 60),
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      color: ["sage", "sand", "blue", "lavender"].includes(body.color) ? body.color : "sage",
    }).returning();
    return Response.json({ folder }, { status: 201 });
  } catch {
    return Response.json({ error: "The folder could not be created." }, { status: 500 });
  }
}
