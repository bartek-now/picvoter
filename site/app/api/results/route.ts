import { env } from "cloudflare:workers";
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
