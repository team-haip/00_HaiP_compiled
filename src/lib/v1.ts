import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "./db";

export function newApiKey() {
  return "geo_" + randomBytes(24).toString("base64url");
}

/** Resolves the project from `X-API-Key` (or `Authorization: Bearer`). */
export async function authProject(req: Request) {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key) return null;
  return db.project.findUnique({ where: { apiKey: key }, include: { competitors: true, prompts: { where: { active: true } }, schedule: true } });
}

export function unauthorized() {
  return NextResponse.json({ error: "Missing or invalid API key. Send it as X-API-Key." }, { status: 401 });
}
