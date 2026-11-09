import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { log } from "./env";
import { errMsg } from "./util";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
export function fail(e: unknown, status = 500) {
  const message = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : errMsg(e);
  const code = e instanceof z.ZodError ? 400 : status;
  log("api.error", { message, status: code });
  return NextResponse.json({ error: message }, { status: code });
}

/** Single-project MVP: returns the first project or null. */
export async function currentProject() {
  return db.project.findFirst({ orderBy: { createdAt: "asc" }, include: { competitors: true, prompts: { orderBy: { createdAt: "asc" } }, schedule: true } });
}

export async function requireProject() {
  const p = await currentProject();
  if (!p) throw new Error("No project registered. Complete onboarding first.");
  return p;
}
