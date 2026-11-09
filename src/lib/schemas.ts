import { z } from "zod";

export const urlSchema = z.string().trim().url("Enter a valid URL including https://").refine((u) => /^https?:\/\//.test(u), "Only http/https URLs");

export const projectInput = z.object({
  company: z.string().trim().min(1, "Company name is required"),
  brand: z.string().trim().min(1, "Brand name is required"),
  website: urlSchema,
  aliases: z.array(z.string().trim().min(1)).default([]),
  competitors: z.array(z.object({ name: z.string().trim().min(1), domain: z.string().trim().optional() })).default([]),
  prompts: z.array(z.string().trim().min(3)).default([]),
});
export type ProjectInput = z.infer<typeof projectInput>;
