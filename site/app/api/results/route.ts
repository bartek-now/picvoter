import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ballots } from "../../../db/schema";
import pairs from "../../../public/pairs.json";
import { summarize } from "../../../lib/voting.mjs";
export async function GET(request: Request) {
  const key = (env as unknown as { RESULTS_KEY?: string }).RESULTS_KEY;
  if (!key || request.headers.get("authorization") !== `Bearer ${key}`) return Response.json({ error: "Enter the results key." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try { return Response.json(summarize(await getDb().select().from(ballots), pairs), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Could not load results. Please try again." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  const key = (env as unknown as { RESULTS_KEY?: string }).RESULTS_KEY;
  const headers = { "Cache-Control": "no-store" };
  if (!key || request.headers.get("authorization") !== `Bearer ${key}`) return Response.json({ error: "Enter the results key." }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415, headers });
  let name: string, updatedAt: string;
  try {
    const value = await request.json() as { name?: unknown; updatedAt?: unknown } | null;
    if (!value || typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 || typeof value.updatedAt !== "string" || value.updatedAt.length > 40 || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error("Invalid vote.");
    name = value.name;
    updatedAt = value.updatedAt;
  } catch { return Response.json({ error: "Invalid vote. Reload results and try again." }, { status: 400, headers }); }
  try {
    const deleted = await getDb().delete(ballots).where(and(eq(ballots.name, name), eq(ballots.updatedAt, updatedAt))).returning({ id: ballots.id });
    if (!deleted.length) return Response.json({ error: "This vote changed or was already deleted. Reload results before trying again." }, { status: 409, headers });
    return Response.json({ deleted: true }, { headers });
  } catch { return Response.json({ error: "Could not delete the vote. Please try again." }, { status: 503, headers }); }
}
