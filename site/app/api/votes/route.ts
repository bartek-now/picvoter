import { getDb } from "../../../db";
import { ballots } from "../../../db/schema";
import pairs from "../../../public/pairs.json";
import { validateBallot, isNameConflict } from "../../../lib/voting.mjs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415 });
  let ballot;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing vote.");
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 8192) { await reader.cancel(); return Response.json({ error: "Vote is too large." }, { status: 413 }); } chunks.push(value); }
    const body = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    ballot = validateBallot(JSON.parse(new TextDecoder().decode(body)), pairs);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid vote." }, { status: 400 }); }
  try {
    await getDb().insert(ballots).values(ballot).onConflictDoUpdate({ target: ballots.id, set: { name: ballot.name, ranking: ballot.ranking, updatedAt: ballot.updatedAt } });
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isNameConflict(error)) return Response.json({ error: "That name is already taken. Please add your surname initial (for example, Alex M.).", code: "NAME_TAKEN" }, { status: 409 });
    return Response.json({ error: "Could not save your vote. Please try again." }, { status: 503 });
  }
}
